#!/bin/bash
# Phase 4, P0.3 rerun after the stale-artifact fix (DECISIONS_LOG D18). The first chain's Level 1 endpoint binary was
# linked against an old `kms-connector-api` build: files copied from M1 kept their M1 modification times, older than
# that build, so cargo took the old build as fresh. This chain:
#   1. gives every file of the Level 1 tree a fresh modification time, so cargo rebuilds every local crate;
#   2. rebuilds the Level 1 endpoint binary and checks that it carries the `account_retired` error code;
#   3. rebuilds the P0.3 Level 1 test target and runs P0.3 three times on the Level 1 tree;
#   4. runs P0.4's Level 1 test once more on the rebuilt tree (regression check of the earlier Level 1 binaries);
#   5. runs the relayer part of P0.3 and P0.4 (run_p03_relayer.sh) on the tree fhevm-main-l1h9, with the database
#      relayer_db created on lifecycle-pg.
# Every heavy step runs through heavy.sh. Launched detached:
#   nohup setsid /srv/lifecycle/scripts/chain_p03b.sh > /srv/lifecycle/logs/chain_p03b.outer 2>&1 < /dev/null &
set -u
L=/srv/lifecycle; S=$L/scripts
LOG=$L/logs/chain_p03b.log
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

n=$(find $L/src/fhevm-main-l1 -path '*/.git' -prune -o -type f -print | wc -l)
find $L/src/fhevm-main-l1 -path '*/.git' -prune -o -type f -print0 | xargs -0 touch
note "l1 tree: $n files touched"

KW_TREE=l1 step build-endpoint-l1b "$S/kw.sh" main cargo build -p endpoint --bin endpoint --locked || exit 1
cp $L/target/main/debug/endpoint $L/bin/p03/endpoint-main-l1 && note "endpoint-main-l1 $(sha256sum $L/bin/p03/endpoint-main-l1 | cut -c1-64)"
codes=$(grep -ac account_retired $L/bin/p03/endpoint-main-l1)
note "endpoint-main-l1 account_retired strings=$codes"
[ "$codes" -gt 0 ] || { note "endpoint-main-l1 still lacks account_retired"; exit 1; }
KW_TREE=l1 step build-p03-main-l1b "$S/kw.sh" main build --test acl_p03_stored_results_h || exit 1
KW_TREE=l1 step build-p04-main-l1b "$S/kw.sh" main build --test acl_p04_eip7851_h || exit 1

"$S/pg_up.sh" >> "$LOG" 2>&1 || { note "pg_up failed"; exit 1; }
for r in r4 r5 r6; do
  step "p03-main-l1-$r" "$S/run_p03.sh" main-l1 "$r" || note "p03-main-l1-$r failed (continuing)"
done
step p04-main-l1-r4 "$S/run_p04.sh" main-l1 r4 || note "p04-main-l1-r4 failed (continuing)"

docker exec lifecycle-pg psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='relayer_db'" | grep -q 1 \
  || docker exec lifecycle-pg psql -U postgres -c "CREATE DATABASE relayer_db" >> "$LOG" 2>&1
note "relayer_db: $(docker exec lifecycle-pg psql -U postgres -tAc "SELECT datname FROM pg_database WHERE datname='relayer_db'")"
step relayer-p03 "$S/run_p03_relayer.sh" || note "relayer-p03 failed (continuing)"
note "CHAIN DONE"
