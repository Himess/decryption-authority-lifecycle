#!/bin/bash
# Phase 5: Zama's own kms-worker suite (the lib and its eight test targets; not our harness files) on the Phase 5
# tree (main-l5: Level 3 plus Q5 at B_Q), twice, and once on the Level 3 tree of Phase 4 for the comparison. Same
# rules as Phase 4's chain_zama_suites.sh: Docker is unreachable for the tests (DOCKER_HOST points at a socket that does
# not exist), so the tests that start testcontainers fail the same way on every tree; a failure only on the Phase 5
# tree would be ours. Every heavy step runs through heavy.sh. Writes logs/chain_zama_suites_p5.done at the end.
#   nohup setsid /srv/lifecycle/scripts/chain_zama_suites_p5.sh > /srv/lifecycle/logs/chain_zama_suites_p5.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_zama_suites_p5.log
DONE=$L/logs/chain_zama_suites_p5.done
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

ZAMA_TESTS="--lib --test acl --test attempt_limit --test context --test event_picker --test health --test integration_tests --test response_publisher --test s3"
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for run in "l5 -r1" "l5 -r2" "l3 -p5"; do
  set -- $run
  DOCKER_HOST=unix:///nonexistent/docker.sock KW_TREE=$1 KW_DB=1 step "zama-kms-worker-$1$2" "$S/kw.sh" main cargo test \
    -p kms-worker --locked --no-fail-fast $ZAMA_TESTS -- --test-threads=1 || note "zama-kms-worker-$1$2: failures (see log)"
done
note "containers now: $(docker ps -a --format '{{.Names}}' | grep -c . ) (lifecycle-pg plus the host's own)"
