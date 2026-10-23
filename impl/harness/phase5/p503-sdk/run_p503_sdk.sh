#!/usr/bin/env bash
# =============================================================================
# run_p503_sdk.sh: Phase 5, P0.3 (proof class Mock). getAuthorityStatus on a local
# chain for an account that adopted regular code (EIP-8298, simulated with
# anvil_setCode): the SDK of lifecycle/phase4-sdk-status, through the public ethers
# and viem clients (p503-sdk-status.test.ts).
#
#   0. preconditions: impl/wt-l2-mock is on lifecycle/level2-mock and impl/wt-sdk-status
#      on lifecycle/phase4-sdk-status, tracked files clean in both; node_modules and
#      soldeer junctions exist (impl/harness/level2/link_deps.mjs); experiments/ built;
#   1. anvil on 127.0.0.1:8731 (never 8545), with the flags of Zama's runner
#      (--chain-id 31337 --disable-code-size-limit), --quiet so it prints no dev keys;
#   2. sdk/js-sdk/test/.env.localcleartext in wt-l2-mock with our RPC_URL (git-ignored);
#   3. Zama's deploy, unmodified, from wt-l2-mock: scripts/fhevm-deploy.sh --chain
#      localcleartext (profile v13). Its ACL is the lifecycle ACL v0.4.2 (Core and E1);
#   4. vitest: fault_proxy.py (empty rewrite table, recording only) on 127.0.0.1:8732, the rows;
#   5. git status of both worktrees (tracked files must be unchanged); secret scan; stop anvil.
#
# Usage:  impl/harness/phase5/p503-sdk/run_p503_sdk.sh <run-id>
# Output: results/phase5/raw/p503/sdk-<run-id>/
# Local only: every RPC goes to 127.0.0.1; no Zama service is contacted.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/env.sh"

run_id="${1:?usage: run_p503_sdk.sh <run-id>}"
H="$HARNESS_DIR/phase5/p503-sdk"
MOCK="$IMPL_DIR/wt-l2-mock"
SDK="$IMPL_DIR/wt-sdk-status"
CT="$MOCK/sdk/js-sdk/contracts"
OUT="$PROJECT_DIR/results/phase5/raw/p503/sdk-$run_id"
ANVIL_PORT=8731
PROXY_PORT=8732
mkdir -p "$OUT"
export FOUNDRY_SOLC_VERSION="${FOUNDRY_SOLC_VERSION:-0.8.35}"

check_tree() { # dir, branch
    local b; b="$(git -C "$1" rev-parse --abbrev-ref HEAD)"
    [[ "$b" == "$2" ]] || { echo "$1 is on '$b', expected '$2'" >&2; exit 2; }
    [[ -z "$(git -C "$1" status --porcelain --untracked-files=no)" ]] || {
        echo "tracked files under $1 are modified; refusing to run" >&2; exit 2; }
}
check_tree "$MOCK" lifecycle/level2-mock
check_tree "$SDK" lifecycle/phase4-sdk-status
[[ -d "$SDK/sdk/js-sdk/node_modules" && -d "$MOCK/sdk/js-sdk/node_modules" && -d "$CT/dependencies/forge-std-1.11.0" ]] || {
    echo "run: node impl/harness/level2/link_deps.mjs impl (wt-l2-mock, wt-sdk-status)" >&2; exit 2; }

node -e '
const fs=require("fs");
const [link,target]=process.argv.slice(1);
try { if (fs.realpathSync(link)!==fs.realpathSync(target)) { fs.rmSync(link,{recursive:false,force:true}); throw 0; } }
catch { fs.symlinkSync(target, link, process.platform==="win32"?"junction":"dir"); }
' "$H/node_modules" "$(cd "$SDK/sdk/js-sdk/node_modules" && pwd -W 2>/dev/null || pwd)"

# --- 1. anvil -------------------------------------------------------------------------
export RPC_URL="http://127.0.0.1:${ANVIL_PORT}"
for p in "$ANVIL_PORT" "$PROXY_PORT"; do
    if cast chain-id --rpc-url "http://127.0.0.1:$p" >/dev/null 2>&1; then
        echo "something already answers on port $p; refusing to reuse it" >&2; exit 2
    fi
done
ANVIL_LOG="$(mktemp)"   # outside results/; removed on exit
anvil --host 127.0.0.1 --port "$ANVIL_PORT" --chain-id 31337 --disable-code-size-limit --quiet >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
cleanup() {
    kill "$ANVIL_PID" 2>/dev/null; wait "$ANVIL_PID" 2>/dev/null
    rm -f "$ANVIL_LOG"
}
trap cleanup EXIT INT TERM
for _ in $(seq 1 150); do cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break; sleep 0.2; done

{
  echo "run=$run_id date=$(date -u +%FT%TZ)"
  echo "sdk worktree: $(git -C "$SDK" rev-parse HEAD) (lifecycle/phase4-sdk-status)"
  echo "mock worktree: $(git -C "$MOCK" rev-parse HEAD) (lifecycle/level2-mock)"
  echo "machine: $(node -e 'const o=require("os");const c=o.cpus();console.log(`${c[0].model.trim()}, ${c.length} logical CPUs, ${(o.totalmem()/2**30).toFixed(1)} GiB RAM, ${o.type()} ${o.release()}`)')"
  echo "node: $(node --version)  anvil: $(anvil --version 2>/dev/null | head -1)  forge: $(forge --version 2>/dev/null | head -1)"
  echo "solc: FOUNDRY_SOLC_VERSION=$FOUNDRY_SOLC_VERSION"
  echo "anvil: $(cast rpc anvil_nodeInfo --rpc-url "$RPC_URL" | jq -c '{hardFork, chainId: .environment.chainId}')"
  sha256sum "$H/p503-sdk-status.test.ts" "$H/vitest.config.mts" "$HARNESS_DIR/phase4/fault_proxy.py" | sed "s#$PROJECT_DIR/##"
} > "$OUT/provenance.txt"

# --- 2./3. Zama's deploy, unmodified (Zama's default deployer keys) ---------------------------
echo "RPC_URL=\"$RPC_URL\"" > "$MOCK/sdk/js-sdk/test/.env.localcleartext"
env -u MNEMONIC FOUNDRY_PROFILE=v13 bash -c "cd '$CT' && bash scripts/fhevm-deploy.sh --chain localcleartext" \
    >"$OUT/deploy.log" 2>&1
deploy_rc=$?
sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$OUT/deploy.log"
echo "fhevm-deploy rc=$deploy_rc" | tee "$OUT/summary.txt"
[[ $deploy_rc == 0 ]] || exit 1
echo "ACL on chain: $(cast call 0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D 'getVersion()(string)' --rpc-url "$RPC_URL")" \
    | tee -a "$OUT/summary.txt" "$OUT/provenance.txt"

# --- 4. the rows ------------------------------------------------------------------------------
env P503_OUT="$OUT" PROXY_PORT="$PROXY_PORT" HARNESS_MOCK_CLONE="$MOCK" HARNESS_SDK_CLONE="$SDK" \
    bash -c "cd '$H' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts --reporter=verbose" \
    >"$OUT/vitest.log" 2>&1
rc=$?
sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$OUT/vitest.log"
grep -E "Tests +[0-9]+|Test Files|✓|×|FAIL" "$OUT/vitest.log" | head -30 | tee -a "$OUT/summary.txt"
echo "vitest rc=$rc" | tee -a "$OUT/summary.txt"

# --- 5. hygiene -------------------------------------------------------------------------------
echo "git status of the worktrees (tracked files must be unchanged):" | tee -a "$OUT/summary.txt"
git -C "$MOCK" status --short --untracked-files=no | tee -a "$OUT/summary.txt"
git -C "$SDK" status --short --untracked-files=no | tee -a "$OUT/summary.txt"
python -I "$HARNESS_DIR/phase4/raw_scrub_scan.py" "$OUT" "$OUT/SCAN_REPORT.txt" --scan-only | tail -1 | tee -a "$OUT/summary.txt"
exit $rc
