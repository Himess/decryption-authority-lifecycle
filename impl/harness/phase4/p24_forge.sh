#!/usr/bin/env bash
# Phase 4, P2.4: the frame-gas measurements that Phase 0-2 made in Foundry, rerun with the Foundry nightly whose
# Amsterdam schedule matches Sepolia's (P2_4 report): Level 0's gas suite (allow, retireAccount, carry, the ERC-7984
# transfer delta; main, Zama's production settings) and Profile A's gate overhead (main, default profile, as in
# level2/PROFILE_A.md). Each under amsterdam and osaka. Zama's suites run with FOUNDRY_ISOLATE=false.
# Usage: bash impl/harness/phase4/p24_forge.sh <nightly bin dir> <run label>   (from fhe-authority-lifecycle/)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
NIGHTLY="$1"
RUN="$2"
OUT="$ROOT/results/phase4/raw/p24/forge/$RUN"
BUILD="$ROOT/impl/.tools/build"
w() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
mkdir -p "$OUT"
export PATH="$NIGHTLY:$PATH"
L0="$ROOT/impl/fhevm-main/host-contracts"
L2="$ROOT/impl/wt-l2-main/host-contracts"
{
  echo "date_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "forge: $(command -v forge) $(forge --version | head -2 | tr '\n' ' ')"
  echo "level0 clone: $(git -C "$L0" rev-parse --abbrev-ref HEAD) $(git -C "$L0" rev-parse --short HEAD), dirty files under host-contracts: $(git -C "$L0" status --porcelain -- . | wc -l)"
  echo "level2 clone: $(git -C "$L2" rev-parse --abbrev-ref HEAD) $(git -C "$L2" rev-parse --short HEAD), dirty files under host-contracts: $(git -C "$L2" status --porcelain -- . | wc -l)"
} >"$OUT/environment.txt"
for EVM in amsterdam osaka; do
  (cd "$L0" && FOUNDRY_OPTIMIZER_RUNS=800 FOUNDRY_ISOLATE=false forge test --match-path test/acl/ACLRetirementGas.t.sol \
    --evm-version "$EVM" --out "$(w "$BUILD/p24n-main-runs800")" --cache-path "$(w "$BUILD/p24n-main-runs800-cache")" -vv) \
    >"$OUT/L0_gas_main_runs800_$EVM.log" 2>&1
  echo "L0 $EVM rc=$? lines=$(grep -c 'GAS|' "$OUT/L0_gas_main_runs800_$EVM.log")"
  (cd "$L2" && FOUNDRY_ISOLATE=false forge test --match-path test/acl/ACLRetirementProfileA.t.sol \
    --match-test test_Gas_A1GateOverhead --evm-version "$EVM" --out "$(w "$BUILD/p24n-l2-default")" \
    --cache-path "$(w "$BUILD/p24n-l2-default-cache")" -vv) >"$OUT/L2_profileA_gas_$EVM.log" 2>&1
  echo "ProfileA $EVM rc=$?"
done
