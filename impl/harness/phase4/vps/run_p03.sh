#!/bin/bash
# usage: run_p03.sh <main|main-l1> <run-id>
# Phase 4, P0.3 (V6 and H7: stored results; H4 across a restart). The connector's HTTP endpoint runs as its own
# process (the `endpoint` binary of the same tree, built and copied by chain_p03.sh) on the test database; the
# kms-worker runs in the test process against the Level 0 ACL on a local Anvil, behind fault_proxy_v2.py (no
# faults; it records every call). Tree main: the unmodified harness tree; main-l1: the Level 1 tree. Same layout
# as run_tc13.sh: 127.0.0.1 only, random mnemonic (nothing printed), torn down on exit. Launch through heavy.sh.
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
tree_arg="$1"; run_id="$2"
case "$tree_arg" in
  main)    tree=harness; target=acl_p03_stored_results ;;
  main-l1) tree=l1;      target=acl_p03_stored_results_h ;;
  *) echo "unknown tree $tree_arg"; exit 2 ;;
esac
RUN=$L/runs/p03-$tree_arg-$run_id-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN"
ANVIL_PORT=58545; PROXY_PORT=58546; HTTP_PORT=58547; MONITORING_PORT=58548; CHAIN_ID=12345
SRC=$L/src/fhevm-main-$tree
PRISTINE=$L/src/fhevm-main
ENDPOINT_BIN=$L/bin/p03/endpoint-main-$tree
echo "RUN dir=$RUN tree=$tree_arg anvil=127.0.0.1:$ANVIL_PORT proxy=127.0.0.1:$PROXY_PORT endpoint=127.0.0.1:$HTTP_PORT $(anvil --version | head -1)"

set +e
{
  echo "date=$(date -u +%FT%TZ) host=$(hostname) nproc=$(nproc) kernel=$(uname -r)"
  echo "tree HEAD=$(git -C "$SRC" rev-parse HEAD) pristine HEAD=$(git -C "$PRISTINE" rev-parse HEAD)"
  echo "== git status --porcelain (tree)"
  git -C "$SRC" status --porcelain
  echo "== sha256 of every changed or added file of the tree"
  git -C "$SRC" status --porcelain | awk '{print $2}' | while read -r f; do
    if [ -d "$SRC/$f" ]; then find "$SRC/$f" -type f | sort | xargs sha256sum; else sha256sum "$SRC/$f"; fi
  done
  echo "== endpoint binary and harness inputs"
  sha256sum "$ENDPOINT_BIN" $L/harness/level0/*.json $L/harness/level1/RejectAll1271Wallet.json \
    $L/harness/sol/src/*.sol $L/scripts/fault_proxy_v2.py $L/scripts/run_p03.sh
} > "$RUN/provenance.txt" 2>&1
set -e

anvil --host 127.0.0.1 --port $ANVIL_PORT --chain-id $CHAIN_ID --mnemonic-random --silent > "$RUN/anvil.out" 2>&1 &
ANVIL_PID=$!
python3 -I $L/scripts/fault_proxy_v2.py $PROXY_PORT http://127.0.0.1:$ANVIL_PORT "$RUN/host_rpc.jsonl" > "$RUN/proxy.out" 2>&1 &
PROXY_PID=$!
trap 'kill $ANVIL_PID $PROXY_PID 2>/dev/null || true; pkill -f "^$ENDPOINT_BIN start" 2>/dev/null || true; wait 2>/dev/null || true; echo "RUN teardown done"' EXIT
for i in $(seq 1 100); do
  curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:$ANVIL_PORT >/dev/null && break
  sleep 0.2
done
for i in $(seq 1 100); do
  curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:$PROXY_PORT >/dev/null && break
  sleep 0.2
done
: > "$RUN/host_rpc.jsonl"   # drop the readiness probe
ss -ltnH | grep -E ":(${ANVIL_PORT}|${PROXY_PORT}|${HTTP_PORT}|${MONITORING_PORT})\b" | awk '{print "RUN listening " $4}'
export LIFECYCLE_ANVIL_URL=http://127.0.0.1:$ANVIL_PORT
export LIFECYCLE_HOST_RPC_URL=http://127.0.0.1:$PROXY_PORT
export LIFECYCLE_HOST_CHAIN_ID=$CHAIN_ID
export LIFECYCLE_SOL_OUT=$L/harness/sol/out
export LIFECYCLE_L0_ACL_ARTIFACT=$L/harness/level0/level0_acl_main.json
export LIFECYCLE_BASE_ACL_ARTIFACT=$L/harness/level0/base_acl_main.json
export LIFECYCLE_L1_REJECTALL_ARTIFACT=$L/harness/level1/RejectAll1271Wallet.json
export P03_RUN=$run_id P03_ENDPOINT_BIN=$ENDPOINT_BIN P03_LOG_DIR=$RUN P03_HTTP_PORT=$HTTP_PORT
export P03_MONITORING_PORT=$MONITORING_PORT P03_PROXY_LOG=$RUN/host_rpc.jsonl
export KW_TREE=$tree KW_DB=1
set +e
$L/scripts/kw.sh main test --test "$target" p03_ -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl")"
grep -c "P03-RESULT" "$RUN/test.log" | sed 's/^/RUN p03_results=/'
grep "P03-SUMMARY\|P03-H4" "$RUN/test.log" | sed 's/^.*\(P03-[A-Z0-9]*\)/RUN \1/'
ln -sfn "$RUN" $L/runs/latest-p03-$tree_arg-$run_id
exit $rc
