#!/bin/bash
# [lifecycle Level 1, H9] Build and test the relayer pre-check under Profile H (tree fhevm-main-l1h9).
# Toolchain 1.99.1 (installed for the connector) instead of the relayer pin 1.97.1; offline sqlx data (.sqlx).
set -eu
source /srv/lifecycle/scripts/env.sh
cd /srv/lifecycle/src/fhevm-main-l1h9/relayer
export RUSTUP_TOOLCHAIN=1.99.1 SQLX_OFFLINE=true CARGO_TARGET_DIR=/srv/lifecycle/target/main
rustc --version; cargo --version
echo "== unit tests: signature pre-check and settings"
cargo test --locked --lib -- host::signature_prechecker config::settings 2>&1
echo "== clippy (lib and unit tests)"
cargo clippy --locked --lib --tests -- -D warnings 2>&1
echo "== rustfmt check (changed files)"
rustfmt --edition 2021 --check src/host/signature_prechecker.rs src/config/settings.rs src/startup.rs && echo FMT-OK
