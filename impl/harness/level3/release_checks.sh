#!/usr/bin/env bash
# Level 3 release checks for ACL v0.10.0 (E2) on lifecycle/level3 (impl/wt-l2-main):
#   1. OpenZeppelin upgrades-core `validate` (storage layout and upgrade safety) from the v0.9.0, v0.8.0 and v0.7.0
#      fixtures, plus the negative control (the reverse direction must fail);
#   2. Zama's CI upgrade check (ci/upgrade-check) with lifecycle/level2 (ACL v0.9.0) as the baseline;
#   3. the production build (solc 0.8.24, 800 runs, cancun) for the anvil harnesses: impl/.tools/build/main-l3-runs800.
# Dedicated build dirs, removed afterwards; Zama's out/ is left untouched. Nothing leaves the machine.
# Usage: bash impl/harness/level3/release_checks.sh   (from fhe-authority-lifecycle/)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WT="$ROOT/impl/wt-l2-main"
HC="$WT/host-contracts"
RAW="$ROOT/results/level3/raw"
export PATH="$USERPROFILE/.foundry/bin:$PATH"
export FOUNDRY_ISOLATE=false
mkdir -p "$RAW"
w() { cygpath -m "$1" 2>/dev/null || echo "$1"; }

# --- 1. OZ validate ---------------------------------------------------------------------------
LOG="$RAW/L3_oz_validate_main.log"
: >"$LOG"
rm -rf "$HC/out-ozvalidate" "$HC/cache-ozvalidate"
(cd "$HC" && forge build --ast --build-info --extra-output storageLayout --out out-ozvalidate --cache-path cache-ozvalidate \
  contracts/ACL.sol test/acl/retirement/fixtures/ACL_v0_9_0.sol test/acl/retirement/fixtures/ACL_v0_8_0.sol \
  test/acl/retirement/fixtures/ACL_v0_7_0.sol) >/dev/null
validate() { # <contract> <reference>
  echo "== $1 (reference $2)" | tee -a "$LOG"
  (cd "$HC" && node node_modules/@openzeppelin/upgrades-core/dist/cli/cli.js validate out-ozvalidate/build-info \
    --contract "$1" --reference "$2" --requireReference) >>"$LOG" 2>&1
  echo "rc=$?" | tee -a "$LOG"
}
validate contracts/ACL.sol:ACL test/acl/retirement/fixtures/ACL_v0_9_0.sol:ACL
validate contracts/ACL.sol:ACL test/acl/retirement/fixtures/ACL_v0_8_0.sol:ACL
validate contracts/ACL.sol:ACL test/acl/retirement/fixtures/ACL_v0_7_0.sol:ACL
# Negative control: v0.8.0 as the target of an upgrade from v0.10.0 drops the E1 fields and must fail.
validate test/acl/retirement/fixtures/ACL_v0_8_0.sol:ACL contracts/ACL.sol:ACL
rm -rf "$HC/out-ozvalidate" "$HC/cache-ozvalidate"

# --- 2. Zama CI upgrade check ---------------------------------------------------------------------
LOG2="$RAW/L3_upgrade_version_check_main.log"
BASE="$(mktemp -d)"
trap 'rm -rf "$BASE"' EXIT
git -C "$WT" archive lifecycle/level2 host-contracts | tar -x -C "$BASE"
node -e 'require("fs").symlinkSync(process.argv[1], process.argv[2], "junction")' "$(w "$HC/node_modules")" "$(w "$BASE/host-contracts/node_modules")"
node -e 'require("fs").symlinkSync(process.argv[1], process.argv[2], "junction")' "$(w "$HC/dependencies")" "$(w "$BASE/host-contracts/dependencies")"
cp -r "$HC/addresses" "$BASE/host-contracts/"
{
  echo "baseline: lifecycle/level2 $(git -C "$WT" rev-parse --short lifecycle/level2) (ACL v0.9.0); target: working tree $(git -C "$WT" rev-parse --short HEAD) + changes"
  (cd "$WT" && node sdk/js-sdk/node_modules/tsx/dist/cli.mjs ci/upgrade-check/check.ts "$(w "$BASE/host-contracts")" host-contracts --changed-contracts ACL)
  echo "rc=$?"
} >"$LOG2" 2>&1
tail -n 4 "$LOG2"

# --- 3. production build for the anvil harnesses --------------------------------------------------
LOG3="$RAW/L3_build_runs800.log"
(cd "$HC" && FOUNDRY_OPTIMIZER_RUNS=800 forge build --out "$(w "$ROOT/impl/.tools/build/main-l3-runs800")" \
  --cache-path "$(w "$ROOT/impl/.tools/build/main-l3-runs800-cache")") >"$LOG3" 2>&1
echo "runs800 build rc=$?" | tee -a "$LOG3"
grep -c "" "$LOG"
grep -E "^== |rc=|SUCCESS|FAILED" "$LOG"
