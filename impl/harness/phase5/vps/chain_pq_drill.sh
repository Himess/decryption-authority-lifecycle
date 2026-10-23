#!/bin/bash
# Phase 5, chain for the Part B connector drill: starts the test Postgres, runs the drill for each run id given
# (default: r1 r2 r3), then removes the container. Every run goes through heavy.sh (its own capped scope, live-service
# checks before and after); a failed run is logged and the chain continues. When it ends it writes
# logs/chain_pq_drill.done (the waiter's signal). Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_pq_drill.sh r1 > /srv/lifecycle/logs/chain_pq_drill.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_pq_drill.log
DONE=$L/logs/chain_pq_drill.done
rm -f "$DONE"
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
step() {  # name, command...
  local name="$1"; shift
  note "START $name"
  "$S/heavy.sh" "$name" "$@"; local rc=$?
  note "END $name rc=$rc"
  return $rc
}
cleanup() { docker rm -f lifecycle-pg >/dev/null 2>&1 && note "lifecycle-pg removed"; note "CHAIN DONE"; date -u +%FT%TZ > "$DONE"; }
trap cleanup EXIT

runs=("$@"); [ ${#runs[@]} -eq 0 ] && runs=(r1 r2 r3)
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for r in "${runs[@]}"; do
  step "pq-drill-$r" "$S/run_pq_drill.sh" "$r" || note "pq-drill-$r failed (continuing)"
done
