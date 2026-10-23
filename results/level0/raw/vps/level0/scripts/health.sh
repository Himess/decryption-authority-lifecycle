#!/bin/bash
# One-line host health record: <live-service> state, load, available memory, swap use.
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gs=$(systemctl is-active <live-service> 2>/dev/null)
la=$(cut -d' ' -f1-3 /proc/loadavg)
ma=$(awk '/^MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo)
su=$(awk '/^SwapTotal:/ {t=$2} /^SwapFree:/ {f=$2} END {printf "%d", (t-f)/1024}' /proc/meminfo)
echo "$ts <live-service>=$gs load=[$la] mem_avail_mb=$ma swap_used_mb=$su ${1:+tag=$1}"
