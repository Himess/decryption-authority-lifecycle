#!/bin/bash
# [lifecycle Level 1, H9] Every relayer unit test (the lib target), on the already built tree fhevm-main-l1h9.
set -eu
source /srv/lifecycle/scripts/env.sh
cd /srv/lifecycle/src/fhevm-main-l1h9/relayer
export RUSTUP_TOOLCHAIN=1.99.1 SQLX_OFFLINE=true CARGO_TARGET_DIR=/srv/lifecycle/target/main
cargo test --locked --lib 2>&1
