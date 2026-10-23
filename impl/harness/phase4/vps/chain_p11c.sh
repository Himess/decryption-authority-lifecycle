#!/bin/bash
# Phase 4, P1.1: the latency bench on the VPS (three runs, run_p11_latency.sh), then a second pass of Zama's own
# kms-worker suite on the unmodified harness tree, Level 1 and Level 3 (chain_zama_suites.sh with PASS=-r2).
# Every heavy step runs through heavy.sh. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p11c.sh > /srv/lifecycle/logs/chain_p11c.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p11c.log
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
note "START p11-latency"
"$S/heavy.sh" p11-latency "$S/run_p11_latency.sh"; note "END p11-latency rc=$?"
[ -e "$L/STOP" ] && { note "STOP file present; not starting the second suite pass"; exit 1; }
PASS=-r2 "$S/chain_zama_suites.sh"; note "END zama suites -r2 rc=$?"
note "CHAIN DONE"
