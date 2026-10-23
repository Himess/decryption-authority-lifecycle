#!/bin/bash
# Phase 4, P1.1: the latency bench (impl/harness/phase4/p11-latency) on the VPS, the same code as on M1, built against
# the Level 3 tree's crate. Three runs of 200 iterations, each against a fresh local anvil on 127.0.0.1:58545.
# Must run through heavy.sh (capped scope). Output: $L/runs/p11-latency-<run>.{json,txt}.
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
export RUSTUP_TOOLCHAIN=1.99.1 CARGO_TARGET_DIR=$L/target/latency
B=$L/harness/p11-latency
cargo build --release --locked --manifest-path $B/Cargo.toml 2>&1 | tail -n 3
BIN=$CARGO_TARGET_DIR/release/p11-latency
echo "bench sha256 $(sha256sum $BIN | cut -c1-64)"
for r in r1 r2 r3; do
  anvil --host 127.0.0.1 --port 58545 --silent > /dev/null 2>&1 &
  AP=$!
  for i in $(seq 1 100); do
    curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:58545 >/dev/null && break
    sleep 0.2
  done
  {
    echo "run=$r date=$(date -u +%FT%TZ) machine=VPS (capped scope, $(nproc) vCPU visible) $(anvil --version | head -1) bench=$(sha256sum $BIN | cut -c1-16)"
    $BIN http://127.0.0.1:58545 $L/harness/p04/artifacts $L/pq/evm-ml-dsa-verifier/helpers/f1600_170.hex $L/pq/venv/bin/python \
      $L/pq/mldsa_tool.py $L/pq/p11_mldsa_tool.py $L/pq/evm-ml-dsa-verifier - 200 $L/runs/p11-latency-$r.json 2>&1
  } > $L/runs/p11-latency-$r.txt
  kill $AP; wait $AP 2>/dev/null || true
  grep -E "ecdsa, Profile|Profile H B_exec|kda ML-DSA-44 single" $L/runs/p11-latency-$r.txt
done
