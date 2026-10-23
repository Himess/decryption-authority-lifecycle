#!/bin/bash
# usage: run_p503.sh <main|main-l1|v0.13.8> <run-id>
# Phase 5, P0.3: EIP-8298 (SETCODEFROM), simulated, in the connector. The worker (unmodified: main and v0.13.8 harness
# trees; Level 1: main-l1 tree) against the Level 0 ACL on a local Anvil. The test gives account X regular wallet
# code with anvil_setCode; nothing is rewritten: fault_proxy_v2.py sits between the worker and Anvil with an empty
# rewrite table and records every host-chain call (the run fails if any answer was rewritten). Runs the `p503_` test of
# tests/acl_p503_eip8298{,_h}.rs. 127.0.0.1 only (ports 8711, 8712), random mnemonic (nothing printed), torn down on
# exit. Must be launched through heavy.sh (capped scope).
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
tree_arg="$1"; run_id="$2"
case "$tree_arg" in
  main)    ver=main;    tree=harness; target=acl_p503_eip8298 ;;
  main-l1) ver=main;    tree=l1;      target=acl_p503_eip8298_h ;;
  v0.13.8) ver=v0.13.8; tree=harness; target=acl_p503_eip8298 ;;
  *) echo "unknown tree $tree_arg"; exit 2 ;;
esac
RUN=$L/runs/p503-$tree_arg-$run_id-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN"
ANVIL_PORT=8711; PROXY_PORT=8712; CHAIN_ID=12345
SRC=$L/src/fhevm-$ver-$tree
PRISTINE=$L/src/fhevm-$ver
echo "RUN dir=$RUN tree=$tree_arg anvil=127.0.0.1:$ANVIL_PORT proxy=127.0.0.1:$PROXY_PORT chain_id=$CHAIN_ID $(anvil --version | head -1)"

set +e
{
  echo "date=$(date -u +%FT%TZ) host=$(hostname) nproc=$(nproc) kernel=$(uname -r)"
  echo "tree HEAD=$(git -C "$SRC" rev-parse HEAD) pristine HEAD=$(git -C "$PRISTINE" rev-parse HEAD)"
  echo "== diff -rq pristine vs tree kms-connector, excluding directories named 'tests'"
  if diff -rq --exclude=tests "$PRISTINE/kms-connector" "$SRC/kms-connector"; then echo "IDENTICAL"; else echo "DIFFERENT"; fi
  for d in crates/kms-worker/src crates/utils/src; do
    h1=$(cd "$SRC/kms-connector/$d" && find . -type f -not -path './tests/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64)
    h2=$(cd "$PRISTINE/kms-connector/$d" && find . -type f -not -path './tests/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64)
    echo "tree-sha256 $d (excluding ./tests): tree=$h1 pristine=$h2 $([ "$h1" = "$h2" ] && echo EQUAL || echo DIFFERENT)"
  done
  echo "== harness inputs"
  sha256sum "$SRC/kms-connector/crates/kms-worker/tests/$target.rs" $L/harness/level0/*.json $L/harness/sol/src/*.sol \
    $L/harness/p04/artifacts/*.json $L/pq/mldsa_tool.py $L/scripts/fault_proxy_v2.py $L/scripts/run_p503.sh
} > "$RUN/provenance.txt" 2>&1
set -e
grep -E "IDENTICAL|DIFFERENT|EQUAL" "$RUN/provenance.txt" | sed 's/^/PROVENANCE /'

for port in $ANVIL_PORT $PROXY_PORT; do
  if ss -ltnH | awk '{print $4}' | grep -qE ":${port}\$"; then echo "RUN port $port already in use"; exit 3; fi
done
echo '{}' > "$RUN/rewrite.json"
anvil --host 127.0.0.1 --port $ANVIL_PORT --chain-id $CHAIN_ID --mnemonic-random --silent > "$RUN/anvil.out" 2>&1 &
ANVIL_PID=$!
python3 -I $L/scripts/fault_proxy_v2.py $PROXY_PORT http://127.0.0.1:$ANVIL_PORT "$RUN/host_rpc.jsonl" \
  --rewrite-file "$RUN/rewrite.json" > "$RUN/proxy.out" 2>&1 &
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
export P04_RUN=$run_id P04_REWRITE_FILE=$RUN/rewrite.json P04_ARTIFACTS=$L/harness/p04/artifacts
export P04_F1600_HEX=$L/pq/evm-ml-dsa-verifier/helpers/f1600_170.hex
export P04_MLDSA_PY=$L/pq/venv/bin/python P04_MLDSA_TOOL=$L/pq/mldsa_tool.py P04_MLDSA_REPO=$L/pq/evm-ml-dsa-verifier
export KW_TREE=$tree KW_DB=1
set +e
$L/scripts/kw.sh "$ver" test --test "$target" p503_ -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
rewritten=$(grep -c '"rewrite":true' "$RUN/host_rpc.jsonl" || true)
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl") rewritten=$rewritten"
grep -c "P503-RESULT" "$RUN/test.log" | sed 's/^/RUN p503_results=/'
grep "P503-SUMMARY" "$RUN/test.log" | sed 's/^.*P503-SUMMARY/RUN P503-SUMMARY/'
ln -sfn "$RUN" $L/runs/latest-p503-$tree_arg-$run_id
if [ "$rewritten" != 0 ]; then echo "RUN FAIL: $rewritten rewritten answers (P0.3 rewrites nothing)"; exit 4; fi
exit $rc
