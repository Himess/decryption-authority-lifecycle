#!/bin/bash
# Phase 4, P0.3 chain. Builds the `endpoint` binary of each tree and copies it aside (both trees share the target
# directory), builds the P0.3 test targets, runs Zama's endpoint suite and the kms-worker unit tests on the Level 1
# tree (the tree this task changes), then runs P0.3 three times per tree, and removes the container. Every heavy
# step runs through heavy.sh (its own capped scope, live-service checks before and after); a failed build stops
# the chain, a failed run or suite is logged and the chain continues. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p03.sh > /srv/lifecycle/logs/chain_p03.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p03.log
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
mkdir -p $L/bin/p03

for tree in harness l1; do
  KW_TREE=$tree step "build-endpoint-$tree" "$S/kw.sh" main cargo build -p endpoint --bin endpoint --locked || exit 1
  cp $L/target/main/debug/endpoint $L/bin/p03/endpoint-main-$tree && note "endpoint-main-$tree $(sha256sum $L/bin/p03/endpoint-main-$tree | cut -c1-64)"
done
KW_TREE=harness step build-p03-main "$S/kw.sh" main build --test acl_p03_stored_results || exit 1
KW_TREE=l1 step build-p03-main-l1 "$S/kw.sh" main build --test acl_p03_stored_results_h || exit 1
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
KW_TREE=l1 KW_DB=1 step suite-endpoint-l1 "$S/kw.sh" main cargo test -p endpoint --locked -- --test-threads=1 || note "endpoint suite failed (continuing)"
KW_TREE=l1 KW_DB=1 step suite-kms-worker-lib-l1 "$S/kw.sh" main cargo test -p kms-worker --lib --locked || note "kms-worker lib suite failed (continuing)"
for r in r1 r2 r3; do
  for t in main main-l1; do
    step "p03-$t-$r" "$S/run_p03.sh" "$t" "$r" || note "p03-$t-$r failed (continuing)"
  done
done
note "CHAIN DONE"
