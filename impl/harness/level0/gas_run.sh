#!/usr/bin/env bash
# Level 0 gas measurements (local only). Writes raw outputs to results/level0/raw/.
#   1. Foundry suite test/acl/ACLRetirementGas.t.sol, per line, per compile profile
#      (runs200 = Zama's foundry.toml test profile; runs800 = Zama's Hardhat production settings), per hardfork.
#   2. anvil receipts (transaction-level gasUsed), main line, runs800 artifacts, per hardfork.
# Build output goes to impl/.tools/build (outside the clones).
# Usage: bash impl/harness/level0/gas_run.sh [main|v0.13.8|all]   (from fhe-authority-lifecycle/)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RAW="$ROOT/results/level0/raw"
BUILD="$ROOT/impl/.tools/build"
export PATH="$USERPROFILE/.foundry/bin:$PATH"
w() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
mkdir -p "$RAW" "$BUILD"
WHICH="${1:-all}"

env_record() { # <line>
{
  echo "date_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "machine: $(powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).Name" 2>/dev/null | tr -d '\r'), $(powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1)" 2>/dev/null | tr -d '\r') GB RAM, $(powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).Caption" 2>/dev/null | tr -d '\r')"
  echo "forge: $(forge --version | head -1)"
  echo "anvil: $(anvil --version | head -1)"
  echo "node: $(node --version)"
  for L in main v0.13.8; do
    echo "fhevm-$L: lifecycle/base=$(git -C "$ROOT/impl/fhevm-$L" rev-parse --short lifecycle/base) lifecycle/level0=$(git -C "$ROOT/impl/fhevm-$L" rev-parse --short lifecycle/level0) worktree-dirty=$(git -C "$ROOT/impl/fhevm-$L" status --porcelain -- host-contracts | wc -l)"
  done
} >"$RAW/L0_gas_environment_$1.txt"
}

foundry_suite() { # <line>
  local L="$1" HC="$ROOT/impl/fhevm-$1/host-contracts"
  for RUNS in 200 800; do
    for EVM in prague osaka amsterdam; do
      (cd "$HC" && FOUNDRY_OPTIMIZER_RUNS=$RUNS FOUNDRY_ISOLATE=false forge test \
        --match-path test/acl/ACLRetirementGas.t.sol --evm-version "$EVM" \
        --out "$(w "$BUILD/$L-runs$RUNS")" --cache-path "$(w "$BUILD/$L-runs$RUNS-cache")" -vv) \
        >"$RAW/L0_gas_${L}_runs${RUNS}_${EVM}.log" 2>&1
      echo "$L runs$RUNS $EVM rc=$? lines=$(grep -c 'GAS|' "$RAW/L0_gas_${L}_runs${RUNS}_${EVM}.log")"
    done
  done
}

if [ "$WHICH" = main ] || [ "$WHICH" = all ]; then
  env_record main
  foundry_suite main
  HC="$(w "$ROOT/impl/fhevm-main/host-contracts")"
  PORT=18571
  for EVM in prague osaka amsterdam; do
    node "$ROOT/impl/harness/level0/anvil_gas.mjs" "$HC" "$(w "$BUILD/main-runs800")" "$EVM" "$PORT" \
      "$(w "$RAW/L0_gas_anvil_main_$EVM.json")"
    PORT=$((PORT + 1))
  done
  node "$ROOT/impl/harness/level0/anvil_sstore_probe.mjs" "$HC" 18590 amsterdam 30000000 60000000 2000000000 \
    >"$RAW/L0_gas_anvil_sstore_probe_amsterdam.json"
  node "$ROOT/impl/harness/level0/anvil_sstore_probe.mjs" "$HC" 18595 prague 30000000 \
    >"$RAW/L0_gas_anvil_sstore_probe_prague.json"
fi
if [ "$WHICH" = v0.13.8 ] || [ "$WHICH" = all ]; then
  env_record v0.13.8
  foundry_suite v0.13.8
fi
