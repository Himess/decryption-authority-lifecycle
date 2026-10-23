#!/bin/bash
# Phase 4, chain for P0.2 (TC14) and P0.4 (EIP-7851): builds the five test binaries, starts the test Postgres, runs
# P0.2 on both lines and P0.4 on its three trees, three times each, then removes the container. Every heavy step runs
# through heavy.sh (its own capped scope, live-service checks before and after); a failed build stops the chain, a
# failed run is logged and the chain continues. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p04.sh > /srv/lifecycle/logs/chain_p04.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p04.log
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

KW_TREE=harness step build-p0x-v0.13.8 "$S/kw.sh" v0.13.8 build --test acl_p02_decision_lag --test acl_p04_eip7851 || exit 1
KW_TREE=harness step build-p0x-main "$S/kw.sh" main build --test acl_p02_decision_lag --test acl_p04_eip7851 || exit 1
KW_TREE=l1 step build-p04-main-l1 "$S/kw.sh" main build --test acl_p04_eip7851_h || exit 1
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for r in r1 r2 r3; do
  for v in v0.13.8 main; do
    step "p02-$v-$r" "$S/run_p02.sh" "$v" "$r" || note "p02-$v-$r failed (continuing)"
  done
  for t in v0.13.8 main main-l1; do
    step "p04-$t-$r" "$S/run_p04.sh" "$t" "$r" || note "p04-$t-$r failed (continuing)"
  done
done
note "CHAIN DONE"
