#!/usr/bin/env bash
# Phase 4, P2.4: Amsterdam receipts on a local chain. Runs Phase 3's receipt harnesses unchanged (one transaction per
# step, receipt gasUsed) on the newest Foundry nightly's anvil, which applies Amsterdam's state-creation pricing
# (a new-slot SSTORE costs 125,169 gas there, against 43,249 on anvil 1.8.5 under any hardfork; see P2_4 report).
# Each harness runs under `amsterdam` and, for comparison on the same binary, `osaka`.
# Usage: bash impl/harness/phase4/p24_amsterdam.sh <nightly bin dir> <run label>   (from fhe-authority-lifecycle/)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
NIGHTLY="$1"
RUN="$2"
OUT="$ROOT/results/phase4/raw/p24/$RUN"
BUILD="$ROOT/impl/.tools/build"
H="$ROOT/impl/harness"
w() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
mkdir -p "$OUT"
export PATH="$NIGHTLY:$PATH"
{
  echo "date_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "anvil: $(command -v anvil) $(anvil --version | tr '\n' ' ')"
  echo "node: $(node --version)"
  echo "artifacts: main-runs800 (Level 0, ACL v0.8.0), main-l2-runs800 (Level 2, v0.9.0), main-l3-runs800 (Level 3, v0.10.0); Zama's production settings (solc 0.8.24, 800 runs, cancun)"
  for d in main-runs800 main-l2-runs800 main-l3-runs800; do
    echo "$d ACL.json sha256 $(sha256sum "$BUILD/$d/ACL.sol/ACL.json" | cut -c1-16)"
  done
} >"$OUT/environment.txt"
PORT=8671
for EVM in amsterdam osaka; do
  # The Level 3 and carry harnesses take P2.4's overrides (D63). Under Amsterdam: a 2e9 block gas limit and 30M gas for
  # deployments (the ACL's deployment needs more than 2^24 there; see raw/p24/cap), and carries chunked at 130 handles
  # so that every transaction stays under the 2^24 cap, with the fit taken at 10 and 100 handles. Under Osaka the
  # Phase 3 settings stay. Both check the largest single-transaction carry at exactly 2^24 gas.
  if [ "$EVM" = amsterdam ]; then
    P24ENV=(P24_ANVIL_ARGS="--gas-limit 2000000000" P24_DEPLOY_GAS=30000000 P24_CARRY_CHUNK=130 P24_FIT_LO=10 P24_FIT_HI=100 P24_VERIFY_CAP=1)
  else
    P24ENV=(P24_VERIFY_CAP=1)
  fi
  node "$H/level0/anvil_gas.mjs" "$(w "$ROOT/impl/fhevm-main/host-contracts")" "$(w "$BUILD/main-runs800")" "$EVM" "$PORT" \
    "$(w "$OUT/L0_gas_anvil_main_$EVM.json")" >"$OUT/L0_$EVM.log" 2>&1
  echo "L0 $EVM rc=$?"; PORT=$((PORT + 1))
  node "$H/level2/anvil_gas_e1.mjs" "$(w "$ROOT/impl/wt-l2-main/host-contracts")" "$(w "$BUILD/main-l2-runs800")" "$EVM" "$PORT" \
    "$(w "$OUT/L2_gas_anvil_main_$EVM.json")" >"$OUT/L2_$EVM.log" 2>&1
  echo "L2 $EVM rc=$?"; PORT=$((PORT + 1))
  env "${P24ENV[@]}" node "$H/level3/anvil_gas_e2.mjs" "$(w "$BUILD/main-l3-runs800")" "$EVM" "$PORT" \
    "$(w "$OUT/L3_gas_anvil_e2_$EVM.json")" >"$OUT/L3_$EVM.log" 2>&1
  echo "L3 $EVM rc=$?"; PORT=$((PORT + 1))
  env "${P24ENV[@]}" node "$H/level2/carry_e2e.mjs" "$(w "$BUILD/main-l2-runs800")" "$(w "$H/level2/carry/out")" "$EVM" "$PORT" \
    "$(w "$OUT/L2_carry_e2e_$EVM.json")" >"$OUT/carry_$EVM.log" 2>&1
  echo "carry $EVM rc=$?"; PORT=$((PORT + 1))
done
