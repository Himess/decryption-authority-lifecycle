#!/bin/bash
# usage: run_pq_drill.sh <run-id>
# Phase 5, Part B: the full post-quantum path in the connector (B1-B4, and B6's connector part). The Phase 5 worker
# (main-l5 tree: Level 3 with Profile H, H7, E3, K8, Profile Q, and Q5 at B_Q) against the Level 3 ACL v0.10.0 (Core,
# E1, E2) on a local Anvil, behind fault_proxy_v2.py (no faults; it records every call and answers eth_getCode with
# 0xef0101 for the EIP-7851 path). Runs the `pq_` test of tests/acl_pq_drill.rs. The holders' wallets are the B0
# wallet (PQWallet); the ML-DSA-44 signatures of the wallets come from E4's signer (mldsa_tool.py), the KDA and
# operator signatures from p11_mldsa_tool.py (dilithium-py). The ceremony's files are kept in the run directory.
# 127.0.0.1 only (ports 8713, 8714), random mnemonic (nothing printed), torn down on exit. Must be launched through
# heavy.sh (capped scope).
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
run_id="$1"
tree_arg=main-l5; tree=l5; target=acl_pq_drill
RUN=$L/runs/pq-drill-$run_id-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN" "$RUN/ceremony"
ANVIL_PORT=8713; PROXY_PORT=8714; CHAIN_ID=12345
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
  echo "== Phase 5 files of the tree (branch lifecycle/phase5-connector)"
  sha256sum "$SRC/kms-connector/crates/kms-worker/src/core/profile_q.rs" \
    "$SRC/kms-connector/crates/kms-worker/src/core/event_processor/decryption.rs" \
    "$SRC/kms-connector/crates/kms-worker/src/core/event_processor/rpc.rs"
  echo "== harness inputs"
  sha256sum "$SRC/kms-connector/crates/kms-worker/tests/$target.rs" $L/harness/p5/*.json $L/harness/sol/src/*.sol \
    $L/harness/p04/artifacts/*.json $L/pq/mldsa_tool.py $L/pq/p11_mldsa_tool.py $L/scripts/fault_proxy_v2.py \
    $L/scripts/run_pq_drill.sh
} > "$RUN/provenance.txt" 2>&1
set -e
grep -E "IDENTICAL|DIFFERENT" "$RUN/provenance.txt" | sed 's/^/PROVENANCE /'

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
export LIFECYCLE_L0_ACL_ARTIFACT=$L/harness/p5/level3_acl_main.json
export LIFECYCLE_BASE_ACL_ARTIFACT=$L/harness/level0/base_acl_main.json
export PQ_RUN=$run_id PQ_ARTIFACTS=$L/harness/p5
export P04_RUN=$run_id P04_REWRITE_FILE=$RUN/rewrite.json P04_ARTIFACTS=$L/harness/p04/artifacts
export P04_F1600_HEX=$L/pq/evm-ml-dsa-verifier/helpers/f1600_170.hex
export P04_MLDSA_PY=$L/pq/venv/bin/python P04_MLDSA_TOOL=$L/pq/mldsa_tool.py P04_MLDSA_REPO=$L/pq/evm-ml-dsa-verifier
export P11_RUN=$run_id P11_MLDSA_PY=$L/pq/venv/bin/python P11_MLDSA_TOOL=$L/pq/p11_mldsa_tool.py
export P11_MLDSA_REPO=$L/pq/evm-ml-dsa-verifier
export P12_RUN=$run_id P12_DIR=$RUN/ceremony
export KW_TREE=$tree KW_DB=1
set +e
$L/scripts/kw.sh main test --test "$target" pq_ -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl") rewritten=$(grep -c '"rewrite":true' "$RUN/host_rpc.jsonl" || true)"
{ grep -c "PQ-RESULT" "$RUN/test.log" || true; } | sed 's/^/RUN pq_results=/'
{ grep -c "PQ-TX" "$RUN/test.log" || true; } | sed 's/^/RUN pq_tx=/'
{ grep "PQ-SUMMARY" "$RUN/test.log" || true; } | sed 's/^.*PQ-SUMMARY/RUN PQ-SUMMARY/'
ln -sfn "$RUN" $L/runs/latest-pq-drill-$run_id
exit $rc
