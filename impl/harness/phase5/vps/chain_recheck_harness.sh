#!/bin/bash
# Phase 5, P3: re-run, in an isolated build, the connector evidence that rests on Zama's unmodified kms-worker (the
# harness tree) and was built after another main-line tree had been built into the shared target directory (D120).
# Cargo names a path package's artifacts by its path relative to the workspace and judges them fresh by file times,
# so a worktree checked out earlier than another worktree's build can link that build's crates. Here the harness tree
# is the only tree ever built into $KW_TARGET_DIR, a new directory. Runs, twice each: TC13 (Phase 4 P0.1), TC14
# (P0.2), stored results (P0.3), EIP-7851 (P0.4) and EIP-8298 (Phase 5 P0.3) on main; then Zama's kms-worker suite on
# the harness tree once. The raw runs go to /srv/lifecycle/runs/*-rc*; they are compared with the committed ones.
#   nohup setsid /srv/lifecycle/scripts/chain_recheck_harness.sh > /srv/lifecycle/logs/chain_recheck_harness.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_recheck_harness.log
DONE=$L/logs/chain_recheck_harness.done
export KW_TARGET_DIR=$L/target/recheck-harness
H=$L/src/fhevm-main-harness
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

[ -e "$KW_TARGET_DIR" ] && { note "$KW_TARGET_DIR exists; it must be new"; exit 1; }
note "TREE harness $(git -C "$H" rev-parse --short HEAD), $(git -C "$H" status --porcelain | wc -l) changed or added files"
( cd "$H/kms-connector/crates/kms-worker/tests" && sha256sum acl_tc13_faults.rs acl_p02_decision_lag.rs \
  acl_p03_stored_results.rs acl_p04_eip7851.rs acl_p503_eip8298.rs ) | tee -a "$LOG"

KW_TREE=harness step rc-build-endpoint "$S/kw.sh" main cargo build -p endpoint --bin endpoint --locked || exit 1
[ -e "$L/bin/p03/endpoint-main-harness.phase4" ] || cp -p "$L/bin/p03/endpoint-main-harness" "$L/bin/p03/endpoint-main-harness.phase4"
cp "$KW_TARGET_DIR/debug/endpoint" "$L/bin/p03/endpoint-main-harness" \
  && note "endpoint-main-harness $(sha256sum "$L/bin/p03/endpoint-main-harness" | cut -c1-64) (Phase 4's kept as .phase4)"
KW_TREE=harness step rc-build "$S/kw.sh" main build --test acl_tc13_faults --test acl_p02_decision_lag \
  --test acl_p03_stored_results --test acl_p04_eip7851 --test acl_p503_eip8298 || exit 1
note "path crates compiled: $(grep -hE '^\s+Compiling [a-z_-]+ v[0-9.]+ \(/srv' "$L/logs/rc-build-endpoint.log" "$L/logs/rc-build.log" \
  | sed -E 's#^\s+Compiling ([a-z_-]+) v[0-9.]+ \(/srv/lifecycle/src/([^/]+)/.*#\1@\2#' | sort -u | tr '\n' ' ')"

"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for r in rc1 rc2; do
  step "rc-tc13-main-$r" "$S/run_tc13.sh" main "$r" || note "rc-tc13-main-$r failed (continuing)"
  step "rc-p02-main-$r" "$S/run_p02.sh" main "$r" || note "rc-p02-main-$r failed (continuing)"
  step "rc-p03-main-$r" "$S/run_p03.sh" main "$r" || note "rc-p03-main-$r failed (continuing)"
  step "rc-p04-main-$r" "$S/run_p04.sh" main "$r" || note "rc-p04-main-$r failed (continuing)"
  step "rc-p503-main-$r" "$S/run_p503.sh" main "$r" || note "rc-p503-main-$r failed (continuing)"
done
ZAMA_TESTS="--lib --test acl --test attempt_limit --test context --test event_picker --test health --test integration_tests --test response_publisher --test s3"
DOCKER_HOST=unix:///nonexistent/docker.sock KW_TREE=harness KW_DB=1 step rc-zama-kms-worker-harness "$S/kw.sh" main cargo test \
  -p kms-worker --locked --no-fail-fast $ZAMA_TESTS -- --test-threads=1 || note "rc-zama-kms-worker-harness: failures (see log)"
note "path crates compiled by the runs: $(grep -hE '^\s+Compiling [a-z_-]+ v[0-9.]+ \(/srv' $L/logs/rc-*-main-rc*.log $L/logs/rc-zama-kms-worker-harness.log 2>/dev/null \
  | sed -E 's#^\s+Compiling ([a-z_-]+) v[0-9.]+ \(/srv/lifecycle/src/([^/]+)/.*#\1@\2#' | sort -u | tr '\n' ' ')"
note "containers now: $(docker ps -a --format '{{.Names}}' | grep -c .)"
