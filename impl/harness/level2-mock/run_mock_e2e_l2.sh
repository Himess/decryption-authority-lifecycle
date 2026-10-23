#!/usr/bin/env bash
# =============================================================================
# run_mock_e2e_l2.sh: Level 2 in Zama's own cleartext mock, end to end, on a local
# anvil. The E1 successor scenario and the SDK hygiene (typed ACCOUNT_RETIRED error,
# getAuthorityStatus, per-request transport keys and the purge on retirement).
# Derived from ../level0-mock/run_mock_e2e.sh (same deploy steps, no trace analysis).
#
#   0. preconditions: the worktree impl/wt-l2-mock is on lifecycle/level2-mock
#      (CleartextACL re-pointed at the ACL v0.4.2 backport, and the SDK hygiene
#      change) and its tracked files are clean;
#   1. anvil on a free local port (never 8545), --quiet so it prints no dev keys, with
#      Zama's runner flags (--chain-id 31337 --disable-code-size-limit);
#   2. sdk/js-sdk/test/.env.localcleartext with our RPC_URL (git-ignored);
#   3. Zama's deploy, unmodified: scripts/fhevm-deploy.sh --chain localcleartext
#      (profile v13), then scripts/fhetest-deploy.sh (its last step, initFheTest,
#      reverts on the v13 stack: ENV_BASELINE.md §4.5; we continue only if FHETest
#      code and its coprocessor config are on chain);
#   4. mock-e2e-l2.test.ts (vitest) against the worktree's SDK source;
#   5. git status of the worktree (tracked files must be unchanged); stop anvil.
#
# Usage:  impl/harness/level2-mock/run_mock_e2e_l2.sh
# Output: results/level2/raw/mock/L2M_*  (step logs, L2M_result.json, L2M_summary.txt)
# Local only: every RPC goes to 127.0.0.1; no Zama service is contacted.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib/env.sh"

H="$HARNESS_DIR/level2-mock"
CLONE="$IMPL_DIR/wt-l2-mock"
JS="$CLONE/sdk/js-sdk"
CT="$JS/contracts"
RAW="$PROJECT_DIR/results/level2/raw/mock"
mkdir -p "$RAW"
SUMMARY="$RAW/L2M_summary.txt"
export FOUNDRY_SOLC_VERSION="${FOUNDRY_SOLC_VERSION:-0.8.35}"
EXPECTED_BRANCH="lifecycle/level2-mock"

run_step() { # name, then command...
    local name="$1"; shift
    local log="$RAW/L2M_${name}.log"
    local s e rc
    s=$(now_s); "$@" >"$log" 2>&1; rc=$?; e=$(now_s)
    sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$log"
    echo "$name rc=$rc seconds=$((e - s)) log=$(basename "$log")" | tee -a "$SUMMARY"
    return $rc
}

# --- 0. preconditions ------------------------------------------------------------
branch="$(git -C "$CLONE" rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "$EXPECTED_BRANCH" ]]; then
    echo "worktree is on '$branch', expected '$EXPECTED_BRANCH'" >&2; exit 2
fi
if [[ -n "$(git -C "$CLONE" status --porcelain --untracked-files=no)" ]]; then
    echo "tracked files in $CLONE are modified; refusing to run" >&2; exit 2
fi
command -v jq >/dev/null || { echo "jq not found (expected impl/.tools/jq/jq.exe on Windows)" >&2; exit 2; }
[[ -d "$JS/node_modules" && -d "$CT/dependencies/forge-std-1.11.0" ]] || {
    echo "run impl/harness/level2/link_deps.mjs first (node_modules and soldeer junctions)" >&2; exit 2; }

{
    echo "=== Level 2 in Zama's cleartext mock: E1 successor and SDK hygiene ==="
    echo "worktree: $CLONE"
    echo "commit:   $(git -C "$CLONE" rev-parse HEAD) branch: $branch"
    echo "base:     lifecycle/level2 $(git -C "$CLONE" rev-parse lifecycle/level2)"
    echo "machine:  $(node -e 'const o=require("os");const c=o.cpus();console.log(`${c[0].model.trim()}, ${c.length} logical CPUs, ${(o.totalmem()/2**30).toFixed(1)} GiB RAM, ${o.type()} ${o.release()}`)')"
    print_toolchain
    echo "solc:     FOUNDRY_SOLC_VERSION=$FOUNDRY_SOLC_VERSION"
} | tee "$SUMMARY"

# node_modules junction -> the worktree's js-sdk node_modules (one ethers copy for SDK and test)
node -e '
const fs=require("fs");
const [link,target]=process.argv.slice(1);
try { if (fs.realpathSync(link)!==fs.realpathSync(target)) { fs.rmSync(link,{recursive:false,force:true}); throw 0; } }
catch { fs.symlinkSync(target, link, process.platform==="win32"?"junction":"dir"); }
' "$H/node_modules" "$(cd "$JS/node_modules" && pwd -W 2>/dev/null || pwd)"

# --- 1. anvil -----------------------------------------------------------------------
PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
if [[ "$PORT" == "8545" ]]; then echo "refusing port 8545" >&2; exit 2; fi
export RPC_URL="http://127.0.0.1:${PORT}"
if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    echo "something already answers on $RPC_URL; refusing to reuse it" >&2; exit 2
fi
ANVIL_LOG="$(mktemp)"   # outside results/; removed on exit
anvil --host 127.0.0.1 --port "$PORT" --chain-id 31337 --disable-code-size-limit --quiet >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
cleanup() {
    kill "$ANVIL_PID" 2>/dev/null; wait "$ANVIL_PID" 2>/dev/null
    rm -f "$ANVIL_LOG"
}
trap cleanup EXIT INT TERM
for _ in $(seq 1 150); do cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break; sleep 0.2; done
echo "rpc:      $RPC_URL (anvil pid $ANVIL_PID)" | tee -a "$SUMMARY"
cast rpc anvil_nodeInfo --rpc-url "$RPC_URL" | jq -c '{hardFork, chainId: .environment.chainId, gasLimit: .environment.gasLimit, baseFee: .environment.baseFee}' | tee -a "$SUMMARY"

# --- 2. the env file Zama's runner writes ----------------------------------------------
echo "RPC_URL=\"$RPC_URL\"" > "$JS/test/.env.localcleartext"

# --- 3. Zama's deploy scripts, unmodified (Zama's default deployer keys) ------------------
run_step fhevm_deploy env -u MNEMONIC FOUNDRY_PROFILE=v13 bash -c "cd '$CT' && bash scripts/fhevm-deploy.sh --chain localcleartext" || exit 1
run_step fhetest_deploy env -u MNEMONIC bash -c "cd '$CT' && bash scripts/fhetest-deploy.sh --chain localcleartext"
FHETEST_RC=$?
FHETEST_ADDR="$(jq -r '.localcleartext.fheTestAddress' "$JS/test/chains/chain-defaults.json")"
FHETEST_CODE="$(cast codesize "$FHETEST_ADDR" --rpc-url "$RPC_URL")"
FHETEST_ACL="$(cast call "$FHETEST_ADDR" 'getCoprocessorConfig()((address,address,address))' --rpc-url "$RPC_URL" 2>/dev/null)"
echo "fhetest_deploy rc=$FHETEST_RC; FHETest $FHETEST_ADDR codesize=$FHETEST_CODE config=$FHETEST_ACL" | tee -a "$SUMMARY"
if [[ "$FHETEST_RC" != 0 ]]; then
    grep -m1 -E "Error:" "$RAW/L2M_fhetest_deploy.log" | tee -a "$SUMMARY"
    [[ "$FHETEST_CODE" -gt 0 && "$FHETEST_ACL" == *"0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D"* ]] || {
        echo "FHETest missing or not configured: cannot continue" | tee -a "$SUMMARY"; exit 1; }
fi
echo "ACL on chain: $(cast call 0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D 'getVersion()(string)' --rpc-url "$RPC_URL")" | tee -a "$SUMMARY"

# --- 4. the end-to-end scenarios ---------------------------------------------------------
RESULT_JSON="$RAW/L2M_result.json"
run_step vitest env HARNESS_FHEVM_CLONE="$CLONE" HARNESS_RESULT_JSON="$RESULT_JSON" \
    bash -c "cd '$H' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts --reporter=verbose"
RT_RC=$?
grep -E "Tests +[0-9]+|Test Files|✓|×|FAIL" "$RAW/L2M_vitest.log" | head -40 | tee -a "$SUMMARY"

# --- 5. hygiene ---------------------------------------------------------------------------
echo "git status of the worktree (tracked files must be unchanged):" | tee -a "$SUMMARY"
git -C "$CLONE" status --short --untracked-files=no | tee -a "$SUMMARY"
echo "secret scan of results/level2/raw/mock (lines naming a private key or mnemonic):" | tee -a "$SUMMARY"
grep -rniE "private[ _-]?key|mnemonic" "$RAW"/L2M_*.log "$RAW"/L2M_result.json 2>/dev/null | grep -viE "sensitive values saved to" | wc -l | tee -a "$SUMMARY"
exit $RT_RC
