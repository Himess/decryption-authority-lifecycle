#!/usr/bin/env bash
# Regenerate the Level 0 test fixtures (ACL version snapshots and the vendored OZ ERC-7984 port) on both lines.
# Sources are read from committed git objects only (git show <ref>:<path>), plus two local, non-git inputs:
#   - impl/.tools/v0.14.2-src/host-contracts/contracts/ACL.sol (zama-ai/fhevm tag v0.14.2, git blob a73fcbcb...)
#   - experiments/node_modules/@openzeppelin/confidential-contracts (0.5.3)
# Usage: bash impl/harness/level0/regen_fixtures.sh   (from fhe-authority-lifecycle/)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
IMPL="$ROOT/impl"
H="$IMPL/harness/level0"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
w() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
export PYTHONIOENCODING=utf-8

MAIN="$IMPL/fhevm-main"
BP="$IMPL/fhevm-v0.13.8"
git -C "$BP" show lifecycle/base:host-contracts/contracts/ACL.sol >"$TMP/acl040.sol"
git -C "$BP" show lifecycle/level0:host-contracts/contracts/ACL.sol >"$TMP/acl041.sol"
git -C "$MAIN" show lifecycle/base:host-contracts/contracts/ACL.sol >"$TMP/acl070.sol"
git -C "$MAIN" show lifecycle/level0:host-contracts/contracts/ACL.sol >"$TMP/acl080.sol"
cp "$IMPL/.tools/v0.14.2-src/host-contracts/contracts/ACL.sol" "$TMP/acl050.sol"
C041="$(git -C "$BP" log -1 --format=%h lifecycle/level0 -- host-contracts/contracts/ACL.sol)"
C080="$(git -C "$MAIN" log -1 --format=%h lifecycle/level0 -- host-contracts/contracts/ACL.sol)"

# main line: full cross-version matrix
OUT="$MAIN/host-contracts/test/acl/retirement/fixtures"
mkdir -p "$OUT"
python -I "$(w "$H/make_fixtures.py")" "$(w "$OUT")" \
  "ACL_v0_4_0=$(w "$TMP/acl040.sol")|zama-ai/fhevm tag v0.13.8 (fe3ca89b5) host-contracts/contracts/ACL.sol, ACL v0.4.0" \
  "ACL_v0_4_1=$(w "$TMP/acl041.sol")|fhevm-v0.13.8 branch lifecycle/level0 ($C041) host-contracts/contracts/ACL.sol, ACL v0.4.1 (Level 0 backport)" \
  "ACL_v0_4_1_noguard=$(w "$TMP/acl041.sol")|fhevm-v0.13.8 branch lifecycle/level0 ($C041) host-contracts/contracts/ACL.sol, ACL v0.4.1 with the upgrade guard removed (U3 hazard demo only)" \
  "ACL_v0_5_0=$(w "$TMP/acl050.sol")|zama-ai/fhevm tag v0.14.2 host-contracts/contracts/ACL.sol, ACL v0.5.0" \
  "ACL_v0_7_0=$(w "$TMP/acl070.sol")|zama-ai/fhevm main ed851716c host-contracts/contracts/ACL.sol, ACL v0.7.0" \
  "ACL_v0_8_0_attribution=$(w "$TMP/acl080.sol")|fhevm-main branch lifecycle/level0 ($C080) host-contracts/contracts/ACL.sol, ACL v0.8.0 without the isAllowed exemption compare (gas attribution only)" \
  "ACL_v0_8_0_drift=$(w "$TMP/acl080.sol")|fhevm-main branch lifecycle/level0 ($C080) host-contracts/contracts/ACL.sol, ACL v0.8.0 with the retirement namespace moved (U4b only)"

# v0.13.8 line: in-line matrix
OUT="$BP/host-contracts/test/acl/retirement/fixtures"
mkdir -p "$OUT"
python -I "$(w "$H/make_fixtures.py")" "$(w "$OUT")" \
  "ACL_v0_4_0=$(w "$TMP/acl040.sol")|zama-ai/fhevm tag v0.13.8 (fe3ca89b5) host-contracts/contracts/ACL.sol, ACL v0.4.0" \
  "ACL_v0_4_1_noguard=$(w "$TMP/acl041.sol")|fhevm-v0.13.8 branch lifecycle/level0 ($C041) host-contracts/contracts/ACL.sol, ACL v0.4.1 with the upgrade guard removed (hazard demo only)" \
  "ACL_v0_4_1_drift=$(w "$TMP/acl041.sol")|fhevm-v0.13.8 branch lifecycle/level0 ($C041) host-contracts/contracts/ACL.sol, ACL v0.4.1 with the retirement namespace moved (U4b only)" \
  "ACL_v0_4_1_attribution=$(w "$TMP/acl041.sol")|fhevm-v0.13.8 branch lifecycle/level0 ($C041) host-contracts/contracts/ACL.sol, ACL v0.4.1 without the isAllowed exemption compare (gas attribution only)"

# vendored OpenZeppelin ERC-7984 port, both lines
OZ="$ROOT/experiments/node_modules/@openzeppelin/confidential-contracts"
for L in "$MAIN" "$BP"; do
  python -I "$(w "$H/port_oz_erc7984.py")" "$(w "$OZ")" "$(w "$L/host-contracts/test/acl/retirement/oz-confidential-contracts-0.5.3")"
done
