#!/bin/bash
# Phase 5, chain for P0.3 (EIP-8298, simulated): builds the three test binaries, starts the test Postgres, runs the
# three trees three times each, then removes the container. Every heavy step runs through heavy.sh (its own capped
# scope, live-service checks before and after); a failed build stops the chain, a failed run is logged and the chain
# continues. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p503.sh > /srv/lifecycle/logs/chain_p503.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p503.log
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

KW_TREE=harness step build-p503-v0.13.8 "$S/kw.sh" v0.13.8 build --test acl_p503_eip8298 || exit 1
KW_TREE=harness step build-p503-main "$S/kw.sh" main build --test acl_p503_eip8298 || exit 1
KW_TREE=l1 step build-p503-main-l1 "$S/kw.sh" main build --test acl_p503_eip8298_h || exit 1
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for r in r1 r2 r3; do
  for t in v0.13.8 main main-l1; do
    step "p503-$t-$r" "$S/run_p503.sh" "$t" "$r" || note "p503-$t-$r failed (continuing)"
  done
done
note "CHAIN DONE"
