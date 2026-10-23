#!/bin/bash
# usage: run_tc13.sh <v0.13.8|main> <run-id>
# Phase 4, P0.1 (TC13): the UNMODIFIED kms-worker against the Level 0 ACL on a local Anvil, with the fault proxy
# (fault_proxy.py) between the worker and Anvil. Runs tests/acl_tc13_faults.rs::tc13_view_fault_matrix of the
# harness worktree. Same layout as run_level0.sh: 127.0.0.1 only, random mnemonic (nothing printed), torn down on
# exit. Must be launched through heavy.sh (capped scope).
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
ver="$1"; run_id="$2"
RUN=$L/runs/tc13-$ver-$run_id-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN"
ANVIL_PORT=58545; PROXY_PORT=58546; CHAIN_ID=12345
SRC=$L/src/fhevm-$ver-harness
PRISTINE=$L/src/fhevm-$ver
case "$ver" in
  main) DELAY=12 ;;     # > Config::default().host_rpc_call_timeout (10 s)
  v0.13.8) DELAY=15 ;;  # no call timeout at v0.13.8
esac
echo "RUN dir=$RUN anvil=127.0.0.1:$ANVIL_PORT proxy=127.0.0.1:$PROXY_PORT chain_id=$CHAIN_ID delay_s=$DELAY $(anvil --version | head -1)"

set +e
{
  echo "date=$(date -u +%FT%TZ) host=$(hostname) nproc=$(nproc) kernel=$(uname -r)"
  echo "harness HEAD=$(git -C "$SRC" rev-parse HEAD) pristine HEAD=$(git -C "$PRISTINE" rev-parse HEAD)"
  echo "== diff -rq pristine vs harness kms-connector, excluding directories named 'tests'"
  if diff -rq --exclude=tests "$PRISTINE/kms-connector" "$SRC/kms-connector"; then echo "IDENTICAL"; else echo "DIFFERENT"; fi
  for d in crates/kms-worker/src crates/utils/src; do
    h1=$(cd "$SRC/kms-connector/$d" && find . -type f -not -path './tests/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64)
    h2=$(cd "$PRISTINE/kms-connector/$d" && find . -type f -not -path './tests/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64)
    echo "tree-sha256 $d (excluding ./tests): harness=$h1 pristine=$h2 $([ "$h1" = "$h2" ] && echo EQUAL || echo DIFFERENT)"
  done
  echo "== harness inputs"
  sha256sum "$SRC/kms-connector/crates/kms-worker/tests/acl_tc13_faults.rs" $L/harness/level0/*.json \
    $L/harness/sol/src/*.sol $L/scripts/fault_proxy.py $L/scripts/run_tc13.sh
} > "$RUN/provenance.txt" 2>&1
set -e
grep -E "IDENTICAL|DIFFERENT|EQUAL" "$RUN/provenance.txt" | sed 's/^/PROVENANCE /'

anvil --host 127.0.0.1 --port $ANVIL_PORT --chain-id $CHAIN_ID --mnemonic-random --silent > "$RUN/anvil.out" 2>&1 &
ANVIL_PID=$!
python3 -I $L/scripts/fault_proxy.py $PROXY_PORT http://127.0.0.1:$ANVIL_PORT "$RUN/host_rpc.jsonl" --delay $DELAY \
  > "$RUN/proxy.out" 2>&1 &
PROXY_PID=$!
trap 'kill $ANVIL_PID $PROXY_PID 2>/dev/null || true; wait 2>/dev/null || true; echo "RUN teardown done"' EXIT
for i in $(seq 1 100); do
  curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:$ANVIL_PORT >/dev/null && break
  sleep 0.2
done
for i in $(seq 1 100); do
  curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:$PROXY_PORT >/dev/null && break
  sleep 0.2
done
: > "$RUN/host_rpc.jsonl"   # drop the readiness probe
ss -ltnH | grep -E ":(${ANVIL_PORT}|${PROXY_PORT})\b" | awk '{print "RUN listening " $4}'
export LIFECYCLE_ANVIL_URL=http://127.0.0.1:$ANVIL_PORT
export LIFECYCLE_HOST_RPC_URL=http://127.0.0.1:$PROXY_PORT
export LIFECYCLE_HOST_CHAIN_ID=$CHAIN_ID
export LIFECYCLE_SOL_OUT=$L/harness/sol/out
export LIFECYCLE_L0_ACL_ARTIFACT=$L/harness/level0/level0_acl_$ver.json
if [ "$ver" = main ]; then export LIFECYCLE_BASE_ACL_ARTIFACT=$L/harness/level0/base_acl_main.json; fi
export TC13_RUN=$run_id
export KW_TREE=harness KW_DB=1
set +e
$L/scripts/kw.sh "$ver" test --test acl_tc13_faults tc13_ -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl")"
grep -c "TC13-RESULT" "$RUN/test.log" | sed 's/^/RUN tc13_results=/'
grep "TC13-SUMMARY" "$RUN/test.log" | sed 's/^.*TC13-SUMMARY/RUN TC13-SUMMARY/'
ln -sfn "$RUN" $L/runs/latest-tc13-$ver-$run_id
exit $rc
