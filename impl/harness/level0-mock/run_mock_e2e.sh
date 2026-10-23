#!/usr/bin/env bash
# =============================================================================
# run_mock_e2e.sh: Level 0 gate G2-mock (part 1). The Decryption Authority
# Lifecycle Core, end to end in Zama's own cleartext mock, on a local anvil.
#
#   0. preconditions: the v0.13.8 clone is on lifecycle/level0-mock (CleartextACL
#      re-pointed at the ACL v0.4.1 backport) and its tracked files are clean;
#   1. anvil on a free local port (MOCK_PORT, else one the OS assigns; never 8545),
#      --quiet so it prints no dev keys, with Zama's runner flags
#      (--chain-id 31337 --disable-code-size-limit);
#   2. sdk/js-sdk/test/.env.localcleartext with our RPC_URL (git-ignored; Zama's
#      runner writes the same file, and Zama's scripts read it);
#   3. Zama's deploy, unmodified: scripts/fhevm-deploy.sh --chain localcleartext
#      (profile v13 -> scripts/v0.13.0/DeployCleartextFHEVMHost.s.sol), with Zama's
#      default 4-signer KMS set (non-forge: the relayer takes the on-chain view);
#   4. Zama's FHETest deploy, unmodified: scripts/fhetest-deploy.sh. Its last step,
#      initFheTest, reverts on the v13 stack (ENV_BASELINE.md §4.5); as in Baseline B
#      we continue only if FHETest code and its coprocessor config are on chain;
#   5. analysis build (same profile and solc, plus --ast, separate out dir) and
#      analyze_build.mjs: AST override check, line pins, source-map bundle;
#   6. build the test-only RetirableVault (scenario 4);
#   7. mock-e2e.test.ts (vitest) against the clone's SDK source;
#   8. git status of the clone (tracked files must be unchanged); stop anvil.
#
# Usage:  impl/harness/level0-mock/run_mock_e2e.sh [--keep-anvil]
# Env:    MOCK_PORT (optional), FOUNDRY_SOLC_VERSION (default 0.8.35, the version the
#         unpinned SDK project resolved to in Baseline B)
# Output: results/level0/raw/mock/M_*  (step logs incl. M_static_checks.log, M_result.json,
#         M_summary.txt)
# Local only: every RPC goes to 127.0.0.1; no Zama service is contacted.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib/env.sh"

KEEP_ANVIL=0
for a in "$@"; do
    case "$a" in
        --keep-anvil) KEEP_ANVIL=1 ;;
        *) echo "unknown option $a" >&2; exit 2 ;;
    esac
done

H="$HARNESS_DIR/level0-mock"
CLONE="$CLONE_V0138"
JS="$CLONE/sdk/js-sdk"
CT="$JS/contracts"
# scripts/repro.py points these elsewhere: its clone is on lifecycle/repro, and its logs never go over results/.
RAW="${MOCK_RAW_DIR:-$PROJECT_DIR/results/level0/raw/mock}"
mkdir -p "$RAW" "$H/.build"
SUMMARY="$RAW/M_summary.txt"
export FOUNDRY_SOLC_VERSION="${FOUNDRY_SOLC_VERSION:-0.8.35}"
EXPECTED_BRANCH="${MOCK_EXPECTED_BRANCH:-lifecycle/level0-mock}"

run_step() { # name, then command...
    local name="$1"; shift
    local log="$RAW/M_${name}.log"
    local s e rc
    s=$(now_s); "$@" >"$log" 2>&1; rc=$?; e=$(now_s)
    # strip ANSI colour codes in place (forge/vitest output)
    sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$log"
    echo "$name rc=$rc seconds=$((e - s)) log=$(basename "$log")" | tee -a "$SUMMARY"
    return $rc
}

# --- 0. preconditions ------------------------------------------------------------
branch="$(git -C "$CLONE" rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "$EXPECTED_BRANCH" ]]; then
    echo "clone is on '$branch', expected '$EXPECTED_BRANCH'" >&2; exit 2
fi
if [[ -n "$(git -C "$CLONE" status --porcelain --untracked-files=no)" ]]; then
    echo "tracked files in $CLONE are modified; refusing to run" >&2; exit 2
fi
command -v jq >/dev/null || { echo "jq not found (expected impl/.tools/jq/jq.exe on Windows)" >&2; exit 2; }
[[ -d "$JS/node_modules" && -d "$CT/dependencies/forge-std-1.11.0" ]] || {
    echo "run impl/harness/baselineB_cleartext.sh v0.13.8 once first (npm ci, soldeer)" >&2; exit 2; }

{
    echo "=== Level 0 G2-mock (part 1): Core end to end in Zama's cleartext mock ==="
    echo "clone:   $CLONE"
    echo "commit:  $(git -C "$CLONE" rev-parse HEAD) branch: $branch"
    echo "base:    lifecycle/level0 $(git -C "$CLONE" rev-parse -q --verify lifecycle/level0 || echo '(not in this clone)')"
    echo "machine: $(node -e 'const o=require("os");const c=o.cpus();console.log(`${c[0].model.trim()}, ${c.length} logical CPUs, ${(o.totalmem()/2**30).toFixed(1)} GiB RAM, ${o.type()} ${o.release()}`)')"
    print_toolchain
    echo "solc:    FOUNDRY_SOLC_VERSION=$FOUNDRY_SOLC_VERSION"
} | tee "$SUMMARY"

# node_modules junction -> the clone's js-sdk node_modules (one ethers copy for SDK and test)
node -e '
const fs=require("fs");
const [link,target]=process.argv.slice(1);
try { if (fs.realpathSync(link)!==fs.realpathSync(target)) { fs.rmSync(link,{recursive:false,force:true}); throw 0; } }
catch { fs.symlinkSync(target, link, process.platform==="win32"?"junction":"dir"); }
' "$H/node_modules" "$JS/node_modules"

# --- 1. anvil -----------------------------------------------------------------------
if [[ -n "${MOCK_PORT:-}" ]]; then
    PORT="$MOCK_PORT"
else
    PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
fi
if [[ "$PORT" == "8545" ]]; then echo "refusing port 8545" >&2; exit 2; fi
export RPC_URL="http://127.0.0.1:${PORT}"
if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    echo "something already answers on $RPC_URL; refusing to reuse it" >&2; exit 2
fi
ANVIL_LOG="$(mktemp)"   # outside results/; removed on exit
anvil --host 127.0.0.1 --port "$PORT" --chain-id 31337 --disable-code-size-limit --quiet >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
cleanup() {
    if [[ "$KEEP_ANVIL" != 1 ]]; then kill "$ANVIL_PID" 2>/dev/null; wait "$ANVIL_PID" 2>/dev/null; fi
    rm -f "$ANVIL_LOG"
}
trap cleanup EXIT INT TERM
for _ in $(seq 1 150); do cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break; sleep 0.2; done
echo "rpc:     $RPC_URL (anvil pid $ANVIL_PID)" | tee -a "$SUMMARY"
cast rpc anvil_nodeInfo --rpc-url "$RPC_URL" | jq -c '{hardFork, chainId: .environment.chainId, gasLimit: .environment.gasLimit, baseFee: .environment.baseFee}' | tee -a "$SUMMARY"

# --- 2. the env file Zama's runner writes ----------------------------------------------
echo "RPC_URL=\"$RPC_URL\"" > "$JS/test/.env.localcleartext"

# --- 3-4. Zama's deploy scripts, unmodified (Zama's default deployer keys) ----------------
run_step fhevm_deploy env -u MNEMONIC FOUNDRY_PROFILE=v13 bash -c "cd '$CT' && bash scripts/fhevm-deploy.sh --chain localcleartext" || exit 1
run_step fhetest_deploy env -u MNEMONIC bash -c "cd '$CT' && bash scripts/fhetest-deploy.sh --chain localcleartext"
FHETEST_RC=$?
FHETEST_ADDR="$(jq -r '.localcleartext.fheTestAddress' "$JS/test/chains/chain-defaults.json")"
FHETEST_CODE="$(cast codesize "$FHETEST_ADDR" --rpc-url "$RPC_URL")"
FHETEST_ACL="$(cast call "$FHETEST_ADDR" 'getCoprocessorConfig()((address,address,address))' --rpc-url "$RPC_URL" 2>/dev/null)"
echo "fhetest_deploy rc=$FHETEST_RC; FHETest $FHETEST_ADDR codesize=$FHETEST_CODE config=$FHETEST_ACL" | tee -a "$SUMMARY"
if [[ "$FHETEST_RC" != 0 ]]; then
    grep -m1 -E "Error:" "$RAW/M_fhetest_deploy.log" | tee -a "$SUMMARY"
    [[ "$FHETEST_CODE" -gt 0 && "$FHETEST_ACL" == *"0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D"* ]] || {
        echo "FHETest missing or not configured: cannot continue" | tee -a "$SUMMARY"; exit 1; }
fi
echo "ACL on chain: $(cast call 0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D 'getVersion()(string)' --rpc-url "$RPC_URL")" | tee -a "$SUMMARY"

# --- 5. analysis build + static checks --------------------------------------------------
run_step analysis_build env FOUNDRY_PROFILE=v13 bash -c "cd '$CT' && forge build --skip test --ast --out '$H/.build/sdk-out' --cache-path '$H/.build/sdk-cache'" || exit 1
run_step static_checks node "$H/analyze_build.mjs" --sdk-out "$H/.build/sdk-out" --clone "$CLONE" \
    --bundle "$H/.build/analysis-bundle.json" --report "$H/.build/analysis-report.txt" || exit 1
grep -E "^RESULT" "$RAW/M_static_checks.log" | tee -a "$SUMMARY"

# --- 6. test-only app contract (scenario 4) --------------------------------------------
run_step vault_build bash -c "cd '$H/contracts' && forge build --sizes" || exit 1

# --- 7. the end-to-end scenarios ---------------------------------------------------------
RESULT_JSON="$RAW/M_result.json"
run_step vitest env HARNESS_FHEVM_CLONE="$CLONE" HARNESS_RESULT_JSON="$RESULT_JSON" \
    HARNESS_BUNDLE="$H/.build/analysis-bundle.json" \
    HARNESS_VAULT_ARTIFACT="$H/.build/vault-out/RetirableVault.sol/RetirableVault.json" \
    bash -c "cd '$H' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts --reporter=verbose"
RT_RC=$?
grep -E "Tests +[0-9]+|Test Files|✓|×|FAIL" "$RAW/M_vitest.log" | head -40 | tee -a "$SUMMARY"

# --- 8. hygiene ---------------------------------------------------------------------------
echo "git status of the clone (tracked files must be unchanged):" | tee -a "$SUMMARY"
git -C "$CLONE" status --short | tee -a "$SUMMARY"
SCAN_LABEL="results/level0/raw/mock"
[[ -n "${MOCK_RAW_DIR:-}" ]] && SCAN_LABEL="the mock logs of this run"
echo "secret scan of $SCAN_LABEL (lines naming a private key or mnemonic):" | tee -a "$SUMMARY"
grep -rniE "private[ _-]?key|mnemonic" "$RAW"/M_*.log "$RAW"/M_result.json 2>/dev/null | grep -viE "sensitive values saved to" | wc -l | tee -a "$SUMMARY"
exit $RT_RC
