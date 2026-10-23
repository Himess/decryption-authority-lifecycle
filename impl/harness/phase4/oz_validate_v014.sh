#!/usr/bin/env bash
# Phase 4, P1.5: OpenZeppelin upgrades-core `validate` (storage layout and upgrade safety, the engine behind
# hardhat-upgrades) for the 0.14 line's upgrade steps, as impl/harness/level0/oz_validate.sh did for the other lines.
# Builds dedicated build-info (ast + storageLayout) into out-ozvalidate/ of the 0.14 worktree, runs the CLI from the
# main clone's node_modules (upgrades-core 1.44.2), and removes the build directories afterwards.
# Usage: bash impl/harness/phase4/oz_validate_v014.sh   (from fhe-authority-lifecycle/)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOG="$ROOT/results/phase4/raw/p15/oz_validate_v014.log"
HC="$ROOT/impl/wt-l0-v014/host-contracts"
CLI="$ROOT/impl/fhevm-main/host-contracts/node_modules/@openzeppelin/upgrades-core/dist/cli/cli.js"
export PATH="$USERPROFILE/.foundry/bin:$PATH"
mkdir -p "$(dirname "$LOG")"
: >"$LOG"
echo "upgrades-core $(node -e "console.log(require('$ROOT/impl/fhevm-main/host-contracts/node_modules/@openzeppelin/upgrades-core/package.json').version)") branch $(git -C "$HC" rev-parse --short HEAD)" | tee -a "$LOG"

F=test/acl/retirement/fixtures
rm -rf "$HC/out-ozvalidate" "$HC/cache-ozvalidate"
(cd "$HC" && forge build --ast --build-info --extra-output storageLayout --out out-ozvalidate --cache-path cache-ozvalidate \
  contracts/ACL.sol $F/ACL_v0_4_0.sol $F/ACL_v0_4_1.sol $F/ACL_v0_4_2.sol $F/ACL_v0_5_0.sol) >/dev/null

run() { # <contract> <reference> <expectation>
  echo "== $1 (reference $2), expected: $3" | tee -a "$LOG"
  (cd "$HC" && node "$CLI" validate out-ozvalidate/build-info --contract "$1" --reference "$2" --requireReference) >>"$LOG" 2>&1
  echo "rc=$?" | tee -a "$LOG"
}
run contracts/ACL.sol:ACL $F/ACL_v0_5_0.sol:ACL "pass (U6, v0.5.0 -> v0.5.1)"
run contracts/ACL.sol:ACL $F/ACL_v0_4_1.sol:ACL "pass (U6, v0.4.1 -> v0.5.1)"
run contracts/ACL.sol:ACL $F/ACL_v0_4_0.sol:ACL "pass (U6, v0.4.0 -> v0.5.1)"
run contracts/ACL.sol:ACL $F/ACL_v0_4_2.sol:ACL "fail (U6, v0.4.2 -> v0.5.1 drops the E1 fields of the namespace)"
# Negative control: v0.5.1 as the reference for v0.4.0 drops fields and must fail.
run $F/ACL_v0_4_0.sol:ACL contracts/ACL.sol:ACL "fail (negative control)"

rm -rf "$HC/out-ozvalidate" "$HC/cache-ozvalidate"
