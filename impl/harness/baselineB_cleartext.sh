#!/usr/bin/env bash
# =============================================================================
# Baseline B: Zama's cleartext host stack, unmodified, end to end on a local anvil.
#
#   1. start anvil on $HARNESS_PORT (default 18557; never 8545) with the same
#      flags as Zama's runner (sdk/js-sdk/test/scripts/localcleartext-run-tests.sh);
#   2. write sdk/js-sdk/test/.env.localcleartext (git-ignored), as Zama's runner does,
#      so Zama's scripts resolve our port;
#   3. deploy the cleartext host stack with Zama's own script:
#         sdk/js-sdk/contracts/scripts/fhevm-deploy.sh --chain localcleartext   (profile v13)
#   4. deploy FHETest with Zama's own script:
#         sdk/js-sdk/contracts/scripts/fhetest-deploy.sh --chain localcleartext
#      At fhevm ed851716c its last step, initFheTest(true), reverts on the v13 stack
#      (CleartextFHEVMExecutor has no checkHandleType; see ENV_BASELINE.md). FHETest
#      itself is deployed and configured before that step, so we record the failure
#      and continue only if FHETest's code and coprocessor config are in place;
#   5. run our round trip (impl/harness/cleartext-roundtrip) with fresh accounts from
#      impl/harness/.env: encrypt -> FHETest.setEuint64 -> (a) user decryption ->
#      (b) delegated user decryption -> two refusal controls;
#   6. optionally (--zama-suite) run Zama's own vitest cleartext suite against the
#      same node (it needs initFheTest, so it is expected to fail at ed851716c);
#   7. stop anvil.
#
# Usage:
#   impl/harness/baselineB_cleartext.sh [main|v0.13.8] [--zama-suite] [--keep-anvil]
#
# Level 0 reuses this script unchanged: point it at a clone whose
# sdk/js-sdk/contracts/src/v0.13.0/host-contracts/contracts/ACL.sol carries the
# modified ACL (CleartextACL inherits it), and extend roundtrip.test.ts.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

WHICH="${1:-main}"; shift || true
ZAMA_SUITE=0; KEEP_ANVIL=0
for a in "$@"; do
    case "$a" in
        --zama-suite) ZAMA_SUITE=1 ;;
        --keep-anvil) KEEP_ANVIL=1 ;;
        *) echo "unknown option $a" >&2; exit 2 ;;
    esac
done
CLONE="$(clone_dir "$WHICH")" || exit 2
JS="$CLONE/sdk/js-sdk"
CT="$JS/contracts"
PORT="$HARNESS_PORT"
export RPC_URL="http://127.0.0.1:${PORT}"
TAG="B_fhevm-${WHICH}"
SUMMARY="$LOG_DIR/${TAG}_summary.txt"
ANVIL_LOG="${TMPDIR:-/tmp}/fhe-harness-anvil-${PORT}.log"   # anvil prints its default dev keys: keep it out of results/

run_step() { # name, then command...
    local name="$1"; shift
    local log="$LOG_DIR/${TAG}_${name}.log"
    local s e rc
    s=$(now_s); "$@" >"$log" 2>&1; rc=$?; e=$(now_s)
    echo "$name rc=$rc seconds=$((e - s)) log=$(basename "$log")" | tee -a "$SUMMARY"
    return $rc
}

{
    echo "=== Baseline B ($WHICH) ==="
    echo "commit: $(git -C "$CLONE" rev-parse HEAD) branch: $(git -C "$CLONE" rev-parse --abbrev-ref HEAD)"
    echo "rpc:    $RPC_URL"
    print_toolchain
} | tee "$SUMMARY"

command -v jq >/dev/null || { echo "jq not found (expected impl/.tools/jq/jq.exe on Windows)" >&2; exit 2; }

# --- prerequisites (idempotent) ---------------------------------------------
if [[ ! -d "$JS/node_modules" ]]; then
    run_step jssdk_npm_ci bash -c "cd '$JS' && npm ci --ignore-scripts --no-audit --no-fund" || exit 1
fi
if [[ ! -d "$CT/dependencies/forge-std-1.11.0" ]]; then
    run_step contracts_soldeer bash -c "cd '$CT' && forge soldeer install && git checkout -- soldeer.lock" || exit 1
fi
[[ -f "$HARNESS_DIR/.env" ]] || node "$HARNESS_DIR/new_test_mnemonic.mjs" --clone "$CLONE" >/dev/null
set -a; source "$HARNESS_DIR/.env"; set +a      # HARNESS_MNEMONIC (never printed)
RT="$HARNESS_DIR/cleartext-roundtrip"
node -e '
const fs=require("fs"),path=require("path");
const [link,target]=process.argv.slice(1);
try { const cur=fs.realpathSync(link); if (cur!==fs.realpathSync(target)) { fs.rmSync(link,{recursive:false,force:true}); throw 0; } }
catch { fs.symlinkSync(target, link, process.platform==="win32"?"junction":"dir"); }
' "$RT/node_modules" "$JS/node_modules"

# --- 1. anvil -----------------------------------------------------------------
if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    echo "something already answers on $RPC_URL; refusing to reuse it (pick another HARNESS_PORT)" >&2
    exit 1
fi
anvil --port "$PORT" --chain-id 31337 --disable-code-size-limit >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
cleanup() { [[ "$KEEP_ANVIL" == 1 ]] || { kill "$ANVIL_PID" 2>/dev/null; wait "$ANVIL_PID" 2>/dev/null; }; }
trap cleanup EXIT INT TERM
for _ in $(seq 1 150); do cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break; sleep 0.2; done
cast rpc anvil_nodeInfo --rpc-url "$RPC_URL" | jq -c '{hardFork, chainId: .environment.chainId, gasLimit: .environment.gasLimit, baseFee: .environment.baseFee}' | tee -a "$SUMMARY"

# --- 2. same env file Zama's runner writes ---------------------------------------
echo "RPC_URL=\"$RPC_URL\"" > "$JS/test/.env.localcleartext"

# --- 3-4. Zama's deploy scripts, unmodified (Zama's default deployer keys) --------
run_step fhevm_deploy env -u MNEMONIC FOUNDRY_PROFILE=v13 bash -c "cd '$CT' && bash scripts/fhevm-deploy.sh --chain localcleartext" || exit 1
run_step fhetest_deploy env -u MNEMONIC bash -c "cd '$CT' && bash scripts/fhetest-deploy.sh --chain localcleartext"
FHETEST_RC=$?
FHETEST_ADDR="$(jq -r '.localcleartext.fheTestAddress' "$JS/test/chains/chain-defaults.json")"
FHETEST_CODE="$(cast codesize "$FHETEST_ADDR" --rpc-url "$RPC_URL")"
echo "fhetest_deploy rc=$FHETEST_RC; FHETest $FHETEST_ADDR codesize=$FHETEST_CODE" | tee -a "$SUMMARY"
if [[ "$FHETEST_RC" != 0 ]]; then
    grep -m1 -E "Error:" "$LOG_DIR/${TAG}_fhetest_deploy.log" | tee -a "$SUMMARY"
    [[ "$FHETEST_CODE" -gt 0 ]] || { echo "FHETest missing: cannot continue" | tee -a "$SUMMARY"; exit 1; }
fi

# --- 5. our round trip ----------------------------------------------------------------
RESULT_JSON="$LOG_DIR/${TAG}_roundtrip_result.json"
run_step roundtrip env HARNESS_FHEVM_CLONE="$CLONE" HARNESS_RESULT_JSON="$RESULT_JSON" \
    bash -c "cd '$RT' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts"
RT_RC=$?
grep -E "Tests +[0-9]+|Test Files" "$LOG_DIR/${TAG}_roundtrip.log" | tee -a "$SUMMARY"

# --- 6. Zama's own vitest cleartext suite (reuses this anvil) -------------------------
if [[ "$ZAMA_SUITE" == 1 ]]; then
    run_step zama_vitest_ethers_cleartext env MNEMONIC="$HARNESS_MNEMONIC" ZAMA_FHEVM_API_KEY=local-harness-not-a-key PORT="$PORT" \
        bash -c "cd '$JS' && bash test/scripts/localcleartext-run-tests.sh --foundry-profile=v13 --ethlib ethers"
    grep -E "Tests +[0-9]+|Test Files|Error:" "$LOG_DIR/${TAG}_zama_vitest_ethers_cleartext.log" | head -5 | tee -a "$SUMMARY"
fi

echo "git status of the clone (tracked files must be unchanged):" | tee -a "$SUMMARY"
git -C "$CLONE" status --short | tee -a "$SUMMARY"
exit $RT_RC
