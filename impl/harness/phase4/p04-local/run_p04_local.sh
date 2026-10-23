#!/usr/bin/env bash
# =============================================================================
# run_p04_local.sh: Phase 4, P0.4 (proof class Mock). The EIP-7851 gap on a
# local EVM: verifiers and the SDK pre-check against an EIP-7702 account whose
# eth_getCode a proxy answers with 0xef0101 ‖ delegate (p04-eip7851.test.ts).
#
#   0. preconditions: impl/wt-l1-h9 is on lifecycle/level1 with clean tracked
#      files; udsig-h built against it (impl/harness/phase4/udsig-h-l1, target
#      impl/.tools/target-udsig-h-l1); experiments/contracts built; E4's venv and
#      udsig-harness exist;
#   1. node_modules junction -> the worktree's js-sdk node_modules;
#   2. vitest: anvil on 127.0.0.1:8611 and fault_proxy.py --rewrite-file on
#      127.0.0.1:8612 (never 8545), deploys, runs the rows, stops both;
#   3. git status of the worktree (tracked files must be unchanged).
#
# Usage:  impl/harness/phase4/p04-local/run_p04_local.sh <run-id>
# Output: results/phase4/raw/p04/local-<run-id>/
# Local only: every RPC goes to 127.0.0.1; no Zama service is contacted.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/env.sh"

run_id="${1:?usage: run_p04_local.sh <run-id>}"
H="$HARNESS_DIR/phase4/p04-local"
CLONE="$IMPL_DIR/wt-l1-h9"
JS="$CLONE/sdk/js-sdk"
OUT="$PROJECT_DIR/results/phase4/raw/p04/local-$run_id"
mkdir -p "$OUT"

branch="$(git -C "$CLONE" rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "lifecycle/level1" ]] || { echo "worktree is on '$branch', expected 'lifecycle/level1'" >&2; exit 2; }
[[ -z "$(git -C "$CLONE" status --porcelain --untracked-files=no)" ]] || {
    echo "tracked files under $CLONE are modified; refusing to run" >&2; exit 2; }
[[ -d "$JS/node_modules" ]] || { echo "run: node impl/harness/level2/link_deps.mjs impl wt-l1-h9" >&2; exit 2; }

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
  sha256sum "$H/p04-eip7851.test.ts" "$HARNESS_DIR/phase4/fault_proxy.py" | sed "s#$PROJECT_DIR/##"
} > "$OUT/provenance.txt"
env P04_OUT="$OUT" ANVIL_PORT=8611 PROXY_PORT=8612 HARNESS_FHEVM_CLONE="$CLONE" \
    bash -c "cd '$H' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts --reporter=verbose" \
    >"$OUT/vitest.log" 2>&1
rc=$?
sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$OUT/vitest.log"
grep -E "Tests +[0-9]+|Test Files|✓|×|FAIL" "$OUT/vitest.log" | head -20 | tee "$OUT/summary.txt"
echo "vitest rc=$rc" | tee -a "$OUT/summary.txt"
echo "git status of the worktree (tracked files must be unchanged):" | tee -a "$OUT/summary.txt"
git -C "$CLONE" status --short --untracked-files=no | tee -a "$OUT/summary.txt"
exit $rc
