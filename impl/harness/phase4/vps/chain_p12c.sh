#!/bin/bash
# Phase 4, P1.2, step c: P1.2 runs r2 and r3 (r1 ran in chain_p12b), then Zama's own kms-worker suite twice on the Level 3
# tree with Profile Q (the baseline and Level 1 are unchanged since chain_zama_suites.sh), as there: the library and its
# eight test targets, --no-fail-fast, Docker unreachable for the tests (D27). Every heavy step runs through heavy.sh.
#   nohup setsid /srv/lifecycle/scripts/chain_p12c.sh > /srv/lifecycle/logs/chain_p12c.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p12c.log
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
step() { local name="$1"; shift; note "START $name"; "$S/heavy.sh" "$name" "$@"; local rc=$?; note "END $name rc=$rc"; return $rc; }
cleanup() { docker rm -f lifecycle-pg >/dev/null 2>&1 && note "lifecycle-pg removed"; }
trap cleanup EXIT
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for r in r2 r3; do
  step "p12-main-l3-$r" "$S/run_p12.sh" "$r" || note "p12 $r failed (continuing)"
done
ZAMA_TESTS="--lib --test acl --test attempt_limit --test context --test event_picker --test health --test integration_tests --test response_publisher --test s3"
for pass in q1 q2; do
  DOCKER_HOST=unix:///nonexistent/docker.sock KW_TREE=l3 KW_DB=1 step "zama-kms-worker-l3-$pass" "$S/kw.sh" main cargo test \
    -p kms-worker --locked --no-fail-fast $ZAMA_TESTS -- --test-threads=1 || note "zama-kms-worker-l3-$pass: failures (see log)"
done
note "containers now: $(docker ps -a --format '{{.Names}}' | grep -c . ) (lifecycle-pg plus the host's own)"
note "CHAIN DONE"
