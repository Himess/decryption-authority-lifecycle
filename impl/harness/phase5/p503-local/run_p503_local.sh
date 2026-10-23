#!/usr/bin/env bash
# =============================================================================
# run_p503_local.sh: Phase 5, P0.3 (proof class Mock). EIP-8298 simulated on a
# local EVM: verifiers and the SDK pre-check against an account that holds the
# regular code of an ML-DSA-44 ERC-1271 wallet (anvil_setCode; p503-eip8298.test.ts).
#
#   0. preconditions: impl/wt-l1-h9 is on lifecycle/level1 with clean tracked
#      files; udsig-h built against it (impl/harness/phase4/udsig-h-l1, target
#      impl/.tools/target-udsig-h-l1); experiments/contracts built; E4's venv and
#      udsig-harness exist;
#   1. node_modules junction -> the worktree's js-sdk node_modules;
#   2. vitest: anvil on 127.0.0.1:8721 and fault_proxy.py (empty rewrite table,
#      recording only) on 127.0.0.1:8722 (never 8545), deploys, runs the rows,
#      stops both;
#   3. git status of the worktree (tracked files must be unchanged); secret scan.
#
# Usage:  impl/harness/phase5/p503-local/run_p503_local.sh <run-id>
# Output: results/phase5/raw/p503/local-<run-id>/
# Local only: every RPC goes to 127.0.0.1; no Zama service is contacted.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/env.sh"

run_id="${1:?usage: run_p503_local.sh <run-id>}"
H="$HARNESS_DIR/phase5/p503-local"
CLONE="$IMPL_DIR/wt-l1-h9"
JS="$CLONE/sdk/js-sdk"
OUT="$PROJECT_DIR/results/phase5/raw/p503/local-$run_id"
ANVIL_PORT=8721
PROXY_PORT=8722
mkdir -p "$OUT"

branch="$(git -C "$CLONE" rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "lifecycle/level1" ]] || { echo "worktree is on '$branch', expected 'lifecycle/level1'" >&2; exit 2; }
[[ -z "$(git -C "$CLONE" status --porcelain --untracked-files=no)" ]] || {
    echo "tracked files under $CLONE are modified; refusing to run" >&2; exit 2; }
[[ -d "$JS/node_modules" ]] || { echo "run: node impl/harness/level2/link_deps.mjs impl wt-l1-h9" >&2; exit 2; }
for p in "$ANVIL_PORT" "$PROXY_PORT"; do
    if cast chain-id --rpc-url "http://127.0.0.1:$p" >/dev/null 2>&1; then
        echo "something already answers on port $p; refusing to reuse it" >&2; exit 2
    fi
done

node -e '
const fs=require("fs");
const [link,target]=process.argv.slice(1);
try { if (fs.realpathSync(link)!==fs.realpathSync(target)) { fs.rmSync(link,{recursive:false,force:true}); throw 0; } }
catch { fs.symlinkSync(target, link, process.platform==="win32"?"junction":"dir"); }
' "$H/node_modules" "$(cd "$JS/node_modules" && pwd -W 2>/dev/null || pwd)"

{
  echo "run=$run_id date=$(date -u +%FT%TZ)"
  echo "worktree commit: $(git -C "$CLONE" rev-parse HEAD) ($branch)"
  echo "anvil: $(anvil --version 2>/dev/null | head -1)"
  echo "udsig-h: $(sha256sum "$IMPL_DIR/.tools/target-udsig-h-l1/release/udsig-h.exe" 2>/dev/null | cut -c1-64) (impl/harness/phase4/udsig-h-l1)"
  sha256sum "$H/p503-eip8298.test.ts" "$H/vitest.config.mts" "$HARNESS_DIR/phase4/fault_proxy.py" | sed "s#$PROJECT_DIR/##"
} > "$OUT/provenance.txt"
env P503_OUT="$OUT" ANVIL_PORT=$ANVIL_PORT PROXY_PORT=$PROXY_PORT HARNESS_FHEVM_CLONE="$CLONE" \
    bash -c "cd '$H' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts --reporter=verbose" \
    >"$OUT/vitest.log" 2>&1
rc=$?
sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$OUT/vitest.log"
grep -E "Tests +[0-9]+|Test Files|✓|×|FAIL" "$OUT/vitest.log" | head -20 | tee "$OUT/summary.txt"
echo "vitest rc=$rc" | tee -a "$OUT/summary.txt"
echo "git status of the worktree (tracked files must be unchanged):" | tee -a "$OUT/summary.txt"
git -C "$CLONE" status --short --untracked-files=no | tee -a "$OUT/summary.txt"
python -I "$HARNESS_DIR/phase4/raw_scrub_scan.py" "$OUT" "$OUT/SCAN_REPORT.txt" --scan-only | tail -1 | tee -a "$OUT/summary.txt"
exit $rc
