#!/bin/bash
# Phase 5, P3: the third round of the clean re-runs (D120), after chain_recheck_harness.sh (rounds rc1 and rc2), so the
# connector harness runs three times, as the brief asks. It reuses that chain's isolated build ($KW_TARGET_DIR, where
# only the harness tree is built) and the endpoint binary it installed; it builds nothing new unless a source changed.
#   /srv/lifecycle/scripts/chain_recheck_harness_r3.sh   (run in the foreground; it writes its own .done file)
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_recheck_harness.log
DONE=$L/logs/chain_recheck_harness_r3.done
export KW_TARGET_DIR=$L/target/recheck-harness
rm -f "$DONE"
note() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
step() {  # name, command...
  local name="$1"; shift
  note "START $name"
  "$S/heavy.sh" "$name" "$@"; local rc=$?
  note "END $name rc=$rc"
  return $rc
}
cleanup() { docker rm -f lifecycle-pg >/dev/null 2>&1 && note "lifecycle-pg removed"; note "ROUND 3 DONE"; date -u +%FT%TZ > "$DONE"; }
trap cleanup EXIT

[ -d "$KW_TARGET_DIR" ] || { note "$KW_TARGET_DIR missing: run chain_recheck_harness.sh first"; exit 1; }
"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
step "rc-tc13-main-rc3" "$S/run_tc13.sh" main rc3 || note "rc-tc13-main-rc3 failed (continuing)"
step "rc-p02-main-rc3" "$S/run_p02.sh" main rc3 || note "rc-p02-main-rc3 failed (continuing)"
step "rc-p03-main-rc3" "$S/run_p03.sh" main rc3 || note "rc-p03-main-rc3 failed (continuing)"
step "rc-p04-main-rc3" "$S/run_p04.sh" main rc3 || note "rc-p04-main-rc3 failed (continuing)"
step "rc-p503-main-rc3" "$S/run_p503.sh" main rc3 || note "rc-p503-main-rc3 failed (continuing)"
note "path crates compiled by round 3: $(grep -hE '^\s+Compiling [a-z_-]+ v[0-9.]+ \(/srv' $L/logs/rc-*-main-rc3.log 2>/dev/null \
  | sed -E 's#^\s+Compiling ([a-z_-]+) v[0-9.]+ \(/srv/lifecycle/src/([^/]+)/.*#\1@\2#' | sort -u | tr '\n' ' ')"
