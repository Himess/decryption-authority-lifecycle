#!/usr/bin/env bash
# =============================================================================
# run_pq_drill_local.sh: Phase 5, Part B on a local chain (proof class Mock). The paths set up with the real carry tool
# and watchtower, the old key's transactions, the SDK (getAuthorityStatus and the Profile H precheck), B5 (operator-
# ratified upgrades, the guard, the canary) and B8's receipts (pq-drill-local.test.ts).
#
#   0. preconditions: impl/wt-sdk-status on lifecycle/phase4-sdk-status with clean tracked files and its node_modules;
#      the artifacts of build_p5_artifacts.sh; impl/pq-wallet and impl/p3-operator-ratification built; E4's venv and
#      the verifier checkout (experiments/E4/pq/.venv, scratch/pq-verifiers/evm-ml-dsa-verifier);
#   1. node_modules junction -> the worktree's js-sdk node_modules;
#   2. vitest: anvil on 127.0.0.1:8761 (never 8545) with the chosen hardfork, fault_proxy.py on 127.0.0.1:8762 for the
#      SDK's reads (it answers 0xef0101 for the B3a account), the rows; both stopped at the end;
#   3. git status of the worktree (tracked files must be unchanged); secret scan.
#
# Usage:  impl/harness/phase5/pq-drill-local/run_pq_drill_local.sh <osaka|amsterdam> <run-id>
#         amsterdam uses the Foundry nightly of Phase 4 (scratch/foundry-nightly-9089a6b).
# Output: results/phase5/raw/pq-drill-local/<hardfork>-<run-id>/
# Local only: every RPC goes to 127.0.0.1; no Zama service is contacted.
# Overrides (scripts/repro.py sets them for a fresh clone): PQL_SDK (the SDK checkout) and PQL_SDK_BRANCH (its
# branch), PQL_OUT_ROOT (instead of results/phase5/raw/pq-drill-local), PQL_ANVIL_AMSTERDAM, PQL_PYTHON; the test
# itself reads PQL_MLDSA_PY, PQL_MLDSA_REPO and PQL_METER_ART.
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/env.sh"

hardfork="${1:?usage: run_pq_drill_local.sh <osaka|amsterdam> <run-id>}"
run_id="${2:?usage: run_pq_drill_local.sh <osaka|amsterdam> <run-id>}"
H="$HARNESS_DIR/phase5/pq-drill-local"
SDK="${PQL_SDK:-$IMPL_DIR/wt-sdk-status}"
SDK_BRANCH="${PQL_SDK_BRANCH:-lifecycle/phase4-sdk-status}"
OUT="${PQL_OUT_ROOT:-$PROJECT_DIR/results/phase5/raw/pq-drill-local}/$hardfork-$run_id"
PY="${PQL_PYTHON:-python}"
ANVIL_PORT=8761
PROXY_PORT=8762
case "$hardfork" in
  osaka) ANVIL_BIN="$(command -v anvil)" ;;
  amsterdam) ANVIL_BIN="${PQL_ANVIL_AMSTERDAM:-$PROJECT_DIR/../scratch/foundry-nightly-9089a6b/bin/anvil.exe}" ;;
  *) echo "hardfork is osaka or amsterdam" >&2; exit 2 ;;
esac
mkdir -p "$OUT"

b="$(git -C "$SDK" rev-parse --abbrev-ref HEAD)"
[[ "$b" == "$SDK_BRANCH" ]] || { echo "$SDK is on '$b', not '$SDK_BRANCH'" >&2; exit 2; }
[[ -z "$(git -C "$SDK" status --porcelain --untracked-files=no -- sdk/js-sdk)" ]] || { echo "tracked files under $SDK/sdk/js-sdk are modified" >&2; exit 2; }
[[ -d "$SDK/sdk/js-sdk/node_modules" ]] || { echo "the SDK's dependencies are missing: npm ci in $SDK/sdk/js-sdk (or, for the project's worktree, node impl/harness/level2/link_deps.mjs impl wt-sdk-status)" >&2; exit 2; }
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
' "$H/node_modules" "$(cd "$SDK/sdk/js-sdk/node_modules" && pwd -W 2>/dev/null || pwd)"

{
  echo "run=$run_id hardfork=$hardfork date=$(date -u +%FT%TZ)"
  echo "sdk worktree: $(git -C "$SDK" rev-parse HEAD) ($b)"
  echo "anvil: $("$ANVIL_BIN" --version 2>/dev/null | head -1)"
  echo "node: $(node --version)"
  sha256sum "$H/pq-drill-local.test.ts" "$H/vitest.config.mts" "$HARNESS_DIR/phase4/fault_proxy.py" \
    "$IMPL_DIR/carry-tool/carry.mjs" "$IMPL_DIR/watchtower/watchtower.mjs" "$IMPL_DIR/canary/canary.mjs" \
    "$PROJECT_DIR"/results/phase5/vps-artifacts/*.json | sed "s#$PROJECT_DIR/##"
} > "$OUT/provenance.txt"

env PQL_OUT="$OUT" PQL_HARDFORK="$hardfork" PQL_ANVIL="$ANVIL_BIN" PQL_PYTHON="$PY" ANVIL_PORT=$ANVIL_PORT PROXY_PORT=$PROXY_PORT \
    HARNESS_SDK_CLONE="$SDK" \
    bash -c "cd '$H' && node node_modules/vitest/vitest.mjs run --config vitest.config.mts --reporter=verbose" \
    >"$OUT/vitest.log" 2>&1
rc=$?
sed -i -E 's/\x1b\[[0-9;]*[mGK]//g' "$OUT/vitest.log"
grep -E "Tests +[0-9]+|Test Files|✓|×|FAIL" "$OUT/vitest.log" | head -30 | tee "$OUT/summary.txt"
echo "vitest rc=$rc" | tee -a "$OUT/summary.txt"
echo "git status of the SDK (tracked files must be unchanged):" | tee -a "$OUT/summary.txt"
git -C "$SDK" status --short --untracked-files=no -- sdk/js-sdk | tee -a "$OUT/summary.txt"
"$PY" -I "$HARNESS_DIR/phase4/raw_scrub_scan.py" "$OUT" "$OUT/SCAN_REPORT.txt" --scan-only | tail -1 | tee -a "$OUT/summary.txt"
exit $rc
