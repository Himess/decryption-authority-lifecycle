#!/bin/bash
# Phase 4, P1.2, step b: the Level 3 tree with Profile Q. The kms-worker unit tests for profile_q; clippy (warnings as
# errors) and rustfmt on the kms-worker crate, with this project's generated harness test files (acl_p0*, acl_p1*,
# acl_profile_h_real_chain) held out: they are test-only files, not part of the change; the P1.2 test target is built; one P1.2 run. Every heavy step runs
# through heavy.sh. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p12b.sh > /srv/lifecycle/logs/chain_p12b.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p12b.log
HT=$L/src/fhevm-main-l3/kms-connector/crates/kms-worker/tests
HOLD=$L/tmp/harness-hold
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
step() { local name="$1"; shift; note "START $name"; "$S/heavy.sh" "$name" "$@"; local rc=$?; note "END $name rc=$rc"; return $rc; }
cleanup() { mv -n "$HOLD"/acl_*.rs "$HT"/ 2>/dev/null; docker rm -f lifecycle-pg >/dev/null 2>&1 && note "lifecycle-pg removed"; }
trap cleanup EXIT
mkdir -p "$HOLD"
KW_TREE=l3 step p12-unit-l3 "$S/kw.sh" main cargo test -p kms-worker --lib --locked profile_q || { note "unit tests failed"; exit 1; }
mv "$HT"/acl_p0*.rs "$HT"/acl_p1*.rs "$HT"/acl_profile_h_real_chain.rs "$HOLD"/
KW_TREE=l3 step p12-clippy-l3 "$S/kw.sh" main cargo clippy -p kms-worker --all-targets --locked -- -D warnings || note "clippy failed"
KW_TREE=l3 step p12-fmt-l3 "$S/kw.sh" main cargo fmt -p kms-worker --check || note "fmt differences"
mv "$HOLD"/acl_*.rs "$HT"/
KW_TREE=l3 step build-p12-main-l3 "$S/kw.sh" main build --test acl_p12_profile_q || { note "build failed"; exit 1; }
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
step p12-main-l3-r1 "$S/run_p12.sh" r1 || note "p12 r1 failed"
note "CHAIN DONE"
