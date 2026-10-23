#!/bin/bash
# Phase 4, P0.1 chain: builds the main TC13 binary, starts the test Postgres, runs TC13 three times per line, then
# removes the container. Every heavy step runs through heavy.sh (its own capped scope, live-service checks before
# and after); the chain stops at the first heavy step that fails. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p01.sh > /srv/lifecycle/logs/chain_p01.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p01.log
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

KW_TREE=harness step build-tc13-main "$S/kw.sh" main build --test acl_tc13_faults || exit 1
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for v in v0.13.8 main; do
  for r in r1 r2 r3; do
    step "tc13-$v-$r" "$S/run_tc13.sh" "$v" "$r" || note "tc13-$v-$r failed (continuing)"
  done
done
note "CHAIN DONE"
