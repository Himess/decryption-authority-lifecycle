#!/bin/bash
# Phase 4: Zama's own kms-worker suite (the lib and its eight test targets; not our harness files) on the unmodified
# harness tree (baseline), the Level 1 tree and the Level 3 tree, every target run (--no-fail-fast).
# Docker is unreachable for the tests (DOCKER_HOST points at a socket that does not exist): some of Zama's tests start
# testcontainers (an S3 server from a private registry), and no container beyond lifecycle-pg may run on this host.
# Those tests fail the same way on every tree; a failure only on our trees would be ours.
# Every heavy step runs through heavy.sh. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_zama_suites.sh > /srv/lifecycle/logs/chain_zama_suites.outer 2>&1 < /dev/null &
# PASS (optional, e.g. -r2) suffixes the step names and the chain log, for a repeat pass.
set -u
L=/srv/lifecycle; S=$L/scripts
PASS="${PASS:-}"
LOG=$L/logs/chain_zama_suites$PASS.log
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
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for t in harness l1 l3; do
  DOCKER_HOST=unix:///nonexistent/docker.sock KW_TREE=$t KW_DB=1 step "zama-kms-worker-$t$PASS" "$S/kw.sh" main cargo test \
    -p kms-worker --locked --no-fail-fast $ZAMA_TESTS -- --test-threads=1 || note "zama-kms-worker-$t$PASS: failures (see log)"
done
note "containers now: $(docker ps -a --format '{{.Names}}' | grep -c . ) (lifecycle-pg plus the host's own)"
note "CHAIN DONE"
