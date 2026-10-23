#!/bin/bash
# usage: heavy.sh <name> <cmd> [args...]
# Runs <cmd> in a capped transient scope with a FREEZE-not-kill watchdog (coordinator decision, run 2):
#   scope   : systemd-run --scope -p MemoryMax=2560M -p MemorySwapMax=3G -p CPUQuota=200% nice -n 19 ionice -c3
#   start   : refuse if /srv/lifecycle/STOP exists or <live-service> is not active; while the <other-service>
#             risczero/risc0-groth16-prover container runs (or MemAvailable < 1229 MB) poll every 120 s, max 60 min
#   running : <live-service> not active                  -> kill OWN scope at once, create STOP
#             MemAvailable < 1229 MB (1.2 GiB)          -> systemctl freeze OWN scope (cgroup v2 freezer)
#             frozen, MemAvailable > 2560 MB for 60 s   -> systemctl thaw OWN scope
#             frozen continuously > 45 min              -> kill OWN scope, create STOP
# Never touches anything but the transient scope it created.
set -u
L=/srv/lifecycle
name="$1"; shift
log="$L/logs/$name.log"; hlog="$L/logs/health.log"
unit="lifecycle-$name-$(date +%s)"
FREEZE_BELOW_MB=1229; THAW_ABOVE_MB=2560; THAW_STABLE_S=60; MAX_FROZEN_S=2700
WAIT_POLL_S=120; WAIT_MAX_S=3600
mkdir -p "$L/logs"
now() { date +%s; }
ts() { date -u +%FT%TZ; }
gs_ok() { [ "$(systemctl is-active <live-service> 2>/dev/null)" = "active" ]; }
mem_mb() { awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo; }
prover_running() { docker ps --format '{{.Image}}' 2>/dev/null | grep -q 'risczero/risc0-groth16-prover'; }
note() { echo "$(ts) [$name] $*" | tee -a "$hlog"; }
cg_path() { systemctl show -P ControlGroup "$unit.scope" 2>/dev/null; }
freeze_scope() { systemctl freeze "$unit.scope" 2>/dev/null || echo 1 > "/sys/fs/cgroup$(cg_path)/cgroup.freeze"; }
thaw_scope() { systemctl thaw "$unit.scope" 2>/dev/null || echo 0 > "/sys/fs/cgroup$(cg_path)/cgroup.freeze"; }
kill_scope() { systemctl kill --signal=SIGKILL "$unit.scope" 2>/dev/null; thaw_scope 2>/dev/null; touch "$L/STOP"; }

if [ -e "$L/STOP" ]; then echo "STOP marker present ($L/STOP); refusing to start $name"; exit 98; fi
"$L/scripts/health.sh" "before:$name" | tee -a "$hlog"
if ! gs_ok; then note "GUARD: <live-service> not active, not starting"; touch "$L/STOP"; exit 99; fi
waited=0
while prover_running || [ "$(mem_mb)" -lt $FREEZE_BELOW_MB ]; do
  p=no; prover_running && p=yes
  if [ $waited -ge $WAIT_MAX_S ]; then
    note "WAIT: prover_running=$p mem_avail_mb=$(mem_mb) after ${waited}s; starting anyway (freeze watchdog active)"; break
  fi
  note "WAIT: prover_running=$p mem_avail_mb=$(mem_mb); polling again in ${WAIT_POLL_S}s (waited ${waited}s)"
  sleep $WAIT_POLL_S; waited=$((waited + WAIT_POLL_S))
  if ! gs_ok; then note "GUARD: <live-service> not active while waiting"; touch "$L/STOP"; exit 99; fi
done
start=$(now)
systemd-run --scope --quiet --unit="$unit" -p MemoryMax=2560M -p MemorySwapMax=3G -p CPUQuota=200% \
  nice -n 19 ionice -c3 "$L/scripts/inscope.sh" "$@" >"$log" 2>&1 </dev/null &
pid=$!
peak_anon=0; peak_cur=0; peak_swap=0
frozen=0; frozen_since=0; above_since=0; frozen_total=0; freezes=0; killed=no
while kill -0 $pid 2>/dev/null; do
  sleep 5
  t=$(now); m=$(mem_mb)
  if [ "$killed" = no ]; then
    if ! gs_ok; then
      note "GUARD: <live-service> NOT active (mem_avail_mb=$m); killing own scope $unit"
      "$L/scripts/health.sh" "killed:$name" | tee -a "$hlog"; kill_scope; killed=<live-service>
    elif [ $frozen -eq 0 ] && [ "$m" -lt $FREEZE_BELOW_MB ]; then
      if freeze_scope; then
        frozen=1; frozen_since=$t; above_since=0; freezes=$((freezes + 1))
        note "FREEZE #$freezes of $unit (mem_avail_mb=$m < $FREEZE_BELOW_MB)"; "$L/scripts/health.sh" "frozen:$name" | tee -a "$hlog"
      fi
    elif [ $frozen -eq 1 ]; then
      if [ $((t - frozen_since)) -gt $MAX_FROZEN_S ]; then
        note "GUARD: frozen for $((t - frozen_since))s > ${MAX_FROZEN_S}s; killing own scope $unit"
        kill_scope; killed=frozen-too-long; frozen_total=$((frozen_total + t - frozen_since)); frozen=0
      elif [ "$m" -gt $THAW_ABOVE_MB ]; then
        [ $above_since -eq 0 ] && above_since=$t
        if [ $((t - above_since)) -ge $THAW_STABLE_S ] && thaw_scope; then
          frozen_total=$((frozen_total + t - frozen_since)); frozen=0
          note "THAW of $unit after $((t - frozen_since))s frozen (mem_avail_mb=$m > $THAW_ABOVE_MB for ${THAW_STABLE_S}s)"
          "$L/scripts/health.sh" "thawed:$name" | tee -a "$hlog"
        fi
      else
        above_since=0
      fi
    fi
  fi
  cg=$(cg_path)
  if [ -n "$cg" ] && [ -r "/sys/fs/cgroup$cg/memory.stat" ]; then
    a=$(awk '/^anon /{print int($2/1048576)}' "/sys/fs/cgroup$cg/memory.stat")
    c=$(( $(cat "/sys/fs/cgroup$cg/memory.current") / 1048576 ))
    s=$(( $(cat "/sys/fs/cgroup$cg/memory.swap.current" 2>/dev/null || echo 0) / 1048576 ))
    [ "${a:-0}" -gt "$peak_anon" ] && peak_anon=$a
    [ "${c:-0}" -gt "$peak_cur" ] && peak_cur=$c
    [ "${s:-0}" -gt "$peak_swap" ] && peak_swap=$s
  fi
done
wait $pid; rc=$?
end=$(now)
[ $frozen -eq 1 ] && frozen_total=$((frozen_total + end - frozen_since))
echo "HEAVY name=$name unit=$unit rc=$rc wall_s=$((end-start)) waited_before_start_s=$waited freezes=$freezes frozen_total_s=$frozen_total running_s=$((end-start-frozen_total)) killed=$killed sampled_peak_anon_mb=$peak_anon sampled_peak_cgroup_current_mb=$peak_cur sampled_peak_swap_mb=$peak_swap" | tee -a "$log" "$hlog"
"$L/scripts/health.sh" "after:$name" | tee -a "$hlog"
if ! gs_ok; then note "GUARD: <live-service> not active after $name"; touch "$L/STOP"; fi
exit $rc
