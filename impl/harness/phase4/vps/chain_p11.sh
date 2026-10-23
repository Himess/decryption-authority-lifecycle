#!/bin/bash
# Phase 4, P1.1 chain. The Level 3 tree (fhevm-main-l3, lifecycle/level3-connector) and the harness tree each get
# their P1.1 test target built; Zama's kms-worker unit tests run on the Level 3 tree (the tree this task changes);
# then P1.1 runs three times per tree, and the container is removed. Every heavy step runs through heavy.sh (its
# own capped scope, live-service checks before and after); a failed build stops the chain, a failed run or suite is
# logged and the chain continues. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p11.sh > /srv/lifecycle/logs/chain_p11.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p11.log
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

KW_TREE=l3 step build-p11-main-l3 "$S/kw.sh" main build --test acl_p11_e3_h || exit 1
KW_TREE=harness step build-p11-main "$S/kw.sh" main build --test acl_p11_e3 || exit 1
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
KW_TREE=l3 KW_DB=1 step suite-kms-worker-lib-l3 "$S/kw.sh" main cargo test -p kms-worker --lib --locked || note "kms-worker lib suite failed (continuing)"
for r in r1 r2 r3; do
  for t in main-l3 main; do
    step "p11-$t-$r" "$S/run_p11.sh" "$t" "$r" || note "p11-$t-$r failed (continuing)"
  done
done
note "CHAIN DONE"
