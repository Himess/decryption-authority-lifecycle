#!/bin/bash
# Fetches OpenZeppelin v5.1.0 (GitHub) and compiles the test-only helper contracts with forge 1.3.5.
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home; mkdir -p "$HOME"
cd $L/harness/sol
if [ ! -d lib/openzeppelin-contracts ]; then
  mkdir -p lib
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts
fi
echo "OZ commit: $(git -C lib/openzeppelin-contracts rev-parse HEAD)"
forge --version | head -1
forge build --sizes 2>&1
for c in ExecutorStub DappStub DeployableERC1967Proxy; do
  j=$(find out -name "$c.json" | head -1)
  echo "$c artifact=$j bytecode_len=$(jq -r .bytecode.object "$j" | wc -c) deployed_len=$(jq -r .deployedBytecode.object "$j" | wc -c) deployed_keccak=$(cast keccak $(jq -r .deployedBytecode.object "$j"))"
done
