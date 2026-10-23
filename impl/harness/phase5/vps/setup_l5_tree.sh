#!/bin/bash
# Phase 5: the Phase 5 connector tree. /srv/lifecycle/src/fhevm-main-l5 is a copy of the Level 3 tree (fhevm-main-l3:
# Profile H, H7, E3, K8 and Profile Q, as used in Phase 4) with the files of branch lifecycle/phase5-connector applied
# from /srv/lifecycle/tmp/p5conn/ (their repository paths, one per line, in files.list). The Level 3 tree is left as
# it is. Re-running refreshes the copied files only.
# Usage: setup_l5_tree.sh
set -euo pipefail
L=/srv/lifecycle
SRC=$L/src/fhevm-main-l3
DST=$L/src/fhevm-main-l5
IN=$L/tmp/p5conn
if [ ! -d "$DST" ]; then
  cp -a "$SRC" "$DST"
  echo "SETUP copied $SRC -> $DST"
fi
while read -r rel; do
  [ -z "$rel" ] && continue
  install -m 644 "$IN/files/$rel" "$DST/$rel"
  echo "SETUP $(sha256sum "$DST/$rel" | cut -c1-16) $rel"
done < "$IN/files.list"
if ! grep -q "^  l5)" "$L/scripts/kw.sh"; then
  sed -i 's#^  l3)       SRC=$L/src/fhevm-$ver-l3 ;;#  l3)       SRC=$L/src/fhevm-$ver-l3 ;;\n  l5)       SRC=$L/src/fhevm-$ver-l5 ;;#' "$L/scripts/kw.sh"
  echo "SETUP kw.sh gained KW_TREE=l5"
fi
grep -n "l5)" "$L/scripts/kw.sh"
echo "SETUP tree HEAD=$(git -C "$DST" rev-parse HEAD); modified files: $(git -C "$DST" status --porcelain | wc -l)"
