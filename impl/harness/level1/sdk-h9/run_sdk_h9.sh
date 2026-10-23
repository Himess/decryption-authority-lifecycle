#!/usr/bin/env bash
# =============================================================================
# run_sdk_h9.sh: Level 1, rule H9, on a local EVM. The SDK's precautionary
# user-decryption signature check (branch lifecycle/level1) with and without a
# Profile H policy, against real accounts on anvil (Osaka): E4's ML-DSA-44
# ERC-1271 account, EIP-7702 accounts, an EOA and a regular-code wallet.
#
#   0. preconditions: impl/wt-l1-h9 is on lifecycle/level1 with clean tracked
#      files under sdk/js-sdk; experiments/contracts is built (forge build) and E4's Python venv
#      exists (the ML-DSA-44 signer);
#   1. node_modules junction -> the worktree's js-sdk node_modules;
#   2. sdk-h9-real-evm.test.ts (vitest): starts its own anvil on 127.0.0.1
#      (port 18671, never 8545), deploys, runs the checks, stops anvil;
#   3. git status of sdk/js-sdk (tracked files must be unchanged).
#
# Usage:  impl/harness/level1/sdk-h9/run_sdk_h9.sh
# Output: results/level1/raw/L1_h9_sdk_{real_evm.json,vitest.log,deploy_records.jsonl}
# Local only: every RPC goes to 127.0.0.1; no Zama service is contacted.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/env.sh"

H="$HARNESS_DIR/level1/sdk-h9"
CLONE="$IMPL_DIR/wt-l1-h9"
JS="$CLONE/sdk/js-sdk"
RAW="$PROJECT_DIR/results/level1/raw"
mkdir -p "$RAW"

branch="$(git -C "$CLONE" rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "lifecycle/level1" ]] || { echo "worktree is on '$branch', expected 'lifecycle/level1'" >&2; exit 2; }
[[ -z "$(git -C "$CLONE" status --porcelain --untracked-files=no -- sdk/js-sdk)" ]] || {
    echo "tracked files under $JS are modified; refusing to run" >&2; exit 2; }
[[ -d "$JS/node_modules" ]] || { echo "run: node impl/harness/level2/link_deps.mjs impl wt-l1-h9" >&2; exit 2; }

# node_modules junction -> the worktree's js-sdk node_modules (one ethers copy for SDK and test)
node -e '
const fs=require("fs");
const [link,target]=process.argv.slice(1);
try { if (fs.realpathSync(link)!==fs.realpathSync(target)) { fs.rmSync(link,{recursive:false,force:true}); throw 0; } }
catch { fs.symlinkSync(target, link, process.platform==="win32"?"junction":"dir"); }
' "$H/node_modules" "$(cd "$JS/node_modules" && pwd -W 2>/dev/null || pwd)"

echo "commit: $(git -C "$CLONE" rev-parse --short HEAD) ($branch)" | tee "$RAW/L1_h9_sdk_summary.txt"
env HARNESS_FHEVM_CLONE="$CLONE" HARNESS_RESULT_JSON="$RAW/L1_h9_sdk_real_evm.json" ANVIL_PORT=18671 \
    bash -c "cd '$H' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts --reporter=verbose" \
    >"$RAW/L1_h9_sdk_vitest.log" 2>&1
rc=$?
sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$RAW/L1_h9_sdk_vitest.log"
grep -E "Tests +[0-9]+|Test Files|✓|×|FAIL" "$RAW/L1_h9_sdk_vitest.log" | head -20 | tee -a "$RAW/L1_h9_sdk_summary.txt"
echo "vitest rc=$rc" | tee -a "$RAW/L1_h9_sdk_summary.txt"
echo "git status of sdk/js-sdk (tracked files must be unchanged):" | tee -a "$RAW/L1_h9_sdk_summary.txt"
git -C "$CLONE" status --short --untracked-files=no -- sdk/js-sdk | tee -a "$RAW/L1_h9_sdk_summary.txt"
exit $rc
