#!/bin/bash
# Runs INSIDE the capped transient scope. Reports wall time / max RSS (GNU time) and the scope's cgroup memory.peak.
cg=$(awk -F: '$1=="0"{print $3}' /proc/self/cgroup)
echo "INSCOPE start=$(date -u +%FT%TZ) cgroup=$cg nice=$(nice) ionice=[$(ionice -p $$)] cmd=[$*]"
/usr/bin/time -v "$@"
rc=$?
echo "INSCOPE end=$(date -u +%FT%TZ) rc=$rc cgroup_memory.peak_bytes=$(cat /sys/fs/cgroup$cg/memory.peak 2>/dev/null) memory.max=$(cat /sys/fs/cgroup$cg/memory.max 2>/dev/null) memory.swap.max=$(cat /sys/fs/cgroup$cg/memory.swap.max 2>/dev/null) cpu.max=[$(cat /sys/fs/cgroup$cg/cpu.max 2>/dev/null)]"
exit $rc
