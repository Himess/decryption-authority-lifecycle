#!/bin/bash
# usage: run_p11.sh <main|main-l3> <run-id>
# Phase 4, P1.1: E3 (the KDA route) and K8 in the connector, TC20 oracle part. The worker (unmodified: main harness
# tree; Level 3: main-l3 tree) against the Level 0 ACL on a local Anvil, behind fault_proxy_v2.py (no faults; it
# records every call). Runs the `p11_` test of tests/acl_p11_e3{,_h}.rs. ML-DSA-44/65/87 signatures come from
# p11_mldsa_tool.py (dilithium-py from the evm-ml-dsa-verifier checkout); the ERC-1271 rows reuse P0.4's ML-DSA-44
# stack and signer. Same layout as run_p04.sh: 127.0.0.1 only, random mnemonic (nothing printed), torn down on exit.
# Must be launched through heavy.sh (capped scope).
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
tree_arg="$1"; run_id="$2"
case "$tree_arg" in
  main)    tree=harness; target=acl_p11_e3 ;;
  main-l3) tree=l3;      target=acl_p11_e3_h ;;
  *) echo "unknown tree $tree_arg"; exit 2 ;;
esac
RUN=$L/runs/p11-$tree_arg-$run_id-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN"
ANVIL_PORT=58545; PROXY_PORT=58546; CHAIN_ID=12345
SRC=$L/src/fhevm-main-$tree
PRISTINE=$L/src/fhevm-main
echo "RUN dir=$RUN tree=$tree_arg anvil=127.0.0.1:$ANVIL_PORT proxy=127.0.0.1:$PROXY_PORT chain_id=$CHAIN_ID $(anvil --version | head -1)"

set +e
{
  echo "date=$(date -u +%FT%TZ) host=$(hostname) nproc=$(nproc) kernel=$(uname -r)"
  echo "tree HEAD=$(git -C "$SRC" rev-parse HEAD) pristine HEAD=$(git -C "$PRISTINE" rev-parse HEAD)"
  echo "== diff -rq pristine vs tree kms-connector and shared, excluding directories named 'tests'"
  for d in kms-connector shared; do
    if diff -rq --exclude=tests --exclude=target "$PRISTINE/$d" "$SRC/$d"; then echo "IDENTICAL $d"; else echo "DIFFERENT $d"; fi
  done
  echo "== harness inputs"
  sha256sum "$SRC/kms-connector/crates/kms-worker/tests/$target.rs" $L/harness/level0/*.json $L/harness/sol/src/*.sol \
    $L/harness/p04/artifacts/*.json $L/pq/mldsa_tool.py $L/pq/p11_mldsa_tool.py $L/scripts/fault_proxy_v2.py \
    $L/scripts/run_p11.sh
} > "$RUN/provenance.txt" 2>&1
set -e
grep -E "IDENTICAL|DIFFERENT" "$RUN/provenance.txt" | sed 's/^/PROVENANCE /'

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
export LIFECYCLE_L0_ACL_ARTIFACT=$L/harness/level0/level0_acl_main.json
export LIFECYCLE_BASE_ACL_ARTIFACT=$L/harness/level0/base_acl_main.json
export P04_RUN=$run_id P04_REWRITE_FILE=$RUN/rewrite.json P04_ARTIFACTS=$L/harness/p04/artifacts
export P04_F1600_HEX=$L/pq/evm-ml-dsa-verifier/helpers/f1600_170.hex
export P04_MLDSA_PY=$L/pq/venv/bin/python P04_MLDSA_TOOL=$L/pq/mldsa_tool.py P04_MLDSA_REPO=$L/pq/evm-ml-dsa-verifier
export P11_RUN=$run_id P11_MLDSA_PY=$L/pq/venv/bin/python P11_MLDSA_TOOL=$L/pq/p11_mldsa_tool.py
export P11_MLDSA_REPO=$L/pq/evm-ml-dsa-verifier
export KW_TREE=$tree KW_DB=1
set +e
$L/scripts/kw.sh main test --test "$target" p11_ -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl")"
grep -c "P11-RESULT" "$RUN/test.log" | sed 's/^/RUN p11_results=/'
grep "P11-SUMMARY" "$RUN/test.log" | sed 's/^.*P11-SUMMARY/RUN P11-SUMMARY/'
ln -sfn "$RUN" $L/runs/latest-p11-$tree_arg-$run_id
exit $rc
