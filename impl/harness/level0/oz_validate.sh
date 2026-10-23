#!/usr/bin/env bash
# OpenZeppelin upgrades-core `validate` (storage-layout and upgrade-safety check, the engine behind
# hardhat-upgrades' validateUpgrade/prepareUpgrade) for the Level 0 upgrade steps.
# Builds dedicated build-info (ast + storageLayout) into out-ozvalidate/, leaving Zama's out/ untouched.
# Usage: bash impl/harness/level0/oz_validate.sh   (from fhe-authority-lifecycle/)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOGS="$ROOT/results/level0/logs"
export PATH="$USERPROFILE/.foundry/bin:$PATH"
mkdir -p "$LOGS"

run() { # <clone> <log> <contract> <reference>
  local hc="$ROOT/impl/$1/host-contracts"
  echo "== $1: $3 (reference $4)" | tee -a "$LOGS/$2"
  (cd "$hc" && node node_modules/@openzeppelin/upgrades-core/dist/cli/cli.js validate out-ozvalidate/build-info \
    --contract "$3" --reference "$4" --requireReference) >>"$LOGS/$2" 2>&1
  echo "rc=$?" | tee -a "$LOGS/$2"
}

build() { # <clone> <files...>
  local hc="$ROOT/impl/$1/host-contracts"
  shift
  rm -rf "$hc/out-ozvalidate" "$hc/cache-ozvalidate"
  (cd "$hc" && forge build --ast --build-info --extra-output storageLayout \
    --out out-ozvalidate --cache-path cache-ozvalidate "$@") >/dev/null
}

: >"$LOGS/L0_oz_validate_v0.13.8.log"
build fhevm-v0.13.8 contracts/ACL.sol test/acl/retirement/fixtures/ACL_v0_4_0.sol
run fhevm-v0.13.8 L0_oz_validate_v0.13.8.log contracts/ACL.sol:ACL test/acl/retirement/fixtures/ACL_v0_4_0.sol:ACL

: >"$LOGS/L0_oz_validate_main.log"
build fhevm-main contracts/ACL.sol test/acl/retirement/fixtures/ACL_v0_4_0.sol \
  test/acl/retirement/fixtures/ACL_v0_4_1.sol test/acl/retirement/fixtures/ACL_v0_7_0.sol
run fhevm-main L0_oz_validate_main.log test/acl/retirement/fixtures/ACL_v0_4_1.sol:ACL test/acl/retirement/fixtures/ACL_v0_4_0.sol:ACL
run fhevm-main L0_oz_validate_main.log contracts/ACL.sol:ACL test/acl/retirement/fixtures/ACL_v0_7_0.sol:ACL
run fhevm-main L0_oz_validate_main.log contracts/ACL.sol:ACL test/acl/retirement/fixtures/ACL_v0_4_1.sol:ACL
# Negative control: the validator must flag a layout break. v0.4.0 -> v0.8.0 is compatible (append-only);
# the reverse direction (v0.8.0 as reference for v0.4.0) drops a field and must fail.
run fhevm-main L0_oz_validate_main.log test/acl/retirement/fixtures/ACL_v0_4_0.sol:ACL contracts/ACL.sol:ACL

# The dedicated build dirs are not git-ignored by Zama's .gitignore: remove them.
rm -rf "$ROOT/impl/fhevm-main/host-contracts/out-ozvalidate" "$ROOT/impl/fhevm-main/host-contracts/cache-ozvalidate" \
  "$ROOT/impl/fhevm-v0.13.8/host-contracts/out-ozvalidate" "$ROOT/impl/fhevm-v0.13.8/host-contracts/cache-ozvalidate"
