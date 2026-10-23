#!/bin/bash
# [lifecycle Level 1, H9] Zama's relayer lint target (`make clippy`), on the tree fhevm-main-l1h9.
set -eu
source /srv/lifecycle/scripts/env.sh
cd /srv/lifecycle/src/fhevm-main-l1h9/relayer
export RUSTUP_TOOLCHAIN=1.99.1 SQLX_OFFLINE=true CARGO_TARGET_DIR=/srv/lifecycle/target/main
echo "== make clippy: cargo clippy --workspace --all-targets --all-features -- -D warnings"
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings 2>&1
echo "CLIPPY-OK"
