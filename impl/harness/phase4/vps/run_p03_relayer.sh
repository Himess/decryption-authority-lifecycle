#!/bin/bash
# Phase 4, P0.3 (relayer part) on the tree fhevm-main-l1h9 (lifecycle/level1 with H7 copied in). Must run through
# heavy.sh, with the lifecycle-pg container up. Steps:
#   1. the relayer's unit tests (lib target), including the H7 dedup-key test and the EIP-7851 pre-check tests;
#   2. tests/user_decrypt_v3_h7_test.rs (integration-tests feature, in-process mocks, database relayer_db on
#      lifecycle-pg), three runs, one test thread (the H7 dedup key is a process-wide switch);
#   3. Zama's lint target (`make clippy`) and rustfmt on the changed files.
# Toolchain 1.99.1 and offline sqlx data, as in Phase 3 (results/level1/raw/vps/l1h9/scripts).
set -u
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
cd $L/src/fhevm-main-l1h9/relayer || exit 2
export RUSTUP_TOOLCHAIN=1.99.1 SQLX_OFFLINE=true CARGO_TARGET_DIR=$L/target/main
export PGPASSFILE=$L/secrets/pgpass
export TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/relayer_db
rustc --version; cargo --version
echo "== changed files (sha256)"
sha256sum src/config/settings.rs src/core/user_decrypt_request.rs src/host/acl_checker.rs \
  src/host/signature_prechecker.rs src/http/endpoints/v2/handlers/user_decrypt.rs src/http/server.rs src/startup.rs \
  src/store/sql/repositories/user_decrypt_repo.rs tests/user_decrypt_v3_h7_test.rs
rc_all=0
echo "== 1. unit tests (lib)"
cargo test --locked --lib 2>&1 | tail -n 40; rc=${PIPESTATUS[0]}; echo "UNIT rc=$rc"; [ $rc = 0 ] || rc_all=1
cargo test --locked --lib -- core::user_decrypt_request host::signature_prechecker config::settings 2>&1 | grep -E "^test |test result" ; true
for r in r1 r2 r3; do
  echo "== 2. integration: user_decrypt_v3_h7_test $r"
  cargo test --locked --features integration-tests --test user_decrypt_v3_h7_test -- --test-threads=1 --nocapture 2>&1 \
    | grep -E "H7-RESULT|^test |test result|panicked" ; rc=${PIPESTATUS[0]}; echo "INTEGRATION $r rc=$rc"; [ $rc = 0 ] || rc_all=1
done
echo "== 3. make clippy: cargo clippy --workspace --all-targets --all-features -- -D warnings"
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings 2>&1 | tail -n 30; rc=${PIPESTATUS[0]}; echo "CLIPPY rc=$rc"; [ $rc = 0 ] || rc_all=1
echo "== rustfmt --check (changed files)"
rustfmt --edition 2021 --check src/config/settings.rs src/core/user_decrypt_request.rs src/host/acl_checker.rs \
  src/host/signature_prechecker.rs src/http/endpoints/v2/handlers/user_decrypt.rs src/http/server.rs src/startup.rs \
  src/store/sql/repositories/user_decrypt_repo.rs tests/user_decrypt_v3_h7_test.rs && echo FMT-OK || { echo FMT-DIFF; rc_all=1; }
echo "RELAYER-P03 rc=$rc_all"
exit $rc_all
