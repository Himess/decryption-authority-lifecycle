#!/bin/bash
# usage: bg.sh <name> <cmd...>  -- detach heavy.sh from the ssh session; writes logs/<name>.rc when finished
L=/srv/lifecycle
name="$1"
rm -f "$L/logs/$name.rc"
nohup setsid bash -c '"$0" "$@"; echo $? > "'"$L"'/logs/'"$name"'.rc"' "$L/scripts/heavy.sh" "$@" > "$L/logs/$name.outer" 2>&1 < /dev/null &
echo "started $name (pid $!)"
