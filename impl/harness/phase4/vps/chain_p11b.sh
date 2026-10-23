#!/bin/bash
# Phase 4, P1.1 rerun. The first chain's Level 3 runs matched every outcome but failed the test's error-code check on
# event requests, for which the harness reads no code back (only HTTP requests return one). The regenerated test
# checks codes on HTTP rows only and adds two HTTP refusals. This chain:
#   1. rebuilds both P1.1 test targets (the test files are new; nothing else changed);
#   2. runs Zama's own kms-worker suite (the lib and its eight test targets, not our harness files) on the Level 1 and
#      Level 3 trees, against lifecycle-pg (main's tests use DbInstance::setup_external with DATABASE_URL);
#   3. runs P1.1 three times per tree (runs r4-r6).
# Every heavy step runs through heavy.sh. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p11b.sh > /srv/lifecycle/logs/chain_p11b.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p11b.log
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
step() {  # name, command...
  local name="$1"; shift
  note "START $name"
  "$S/heavy.sh" "$name" "$@"; local rc=$?
  note "END $name rc=$rc"
  return $rc
}
cleanup() { docker rm -f lifecycle-pg >/dev/null 2>&1 && note "lifecycle-pg removed"; }
trap cleanup EXIT

ZAMA_TESTS="--lib --test acl --test attempt_limit --test context --test event_picker --test health --test integration_tests --test response_publisher --test s3"
KW_TREE=l3 step build-p11-main-l3b "$S/kw.sh" main build --test acl_p11_e3_h || exit 1
KW_TREE=harness step build-p11-mainb "$S/kw.sh" main build --test acl_p11_e3 || exit 1
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for t in l1 l3; do
  KW_TREE=$t KW_DB=1 step "suite-kms-worker-zama-$t" "$S/kw.sh" main cargo test -p kms-worker --locked $ZAMA_TESTS -- --test-threads=1 \
    || note "kms-worker Zama suite on $t failed (continuing)"
done
for r in r4 r5 r6; do
  for t in main-l3 main; do
    step "p11-$t-$r" "$S/run_p11.sh" "$t" "$r" || note "p11-$t-$r failed (continuing)"
  done
done
note "CHAIN DONE"
