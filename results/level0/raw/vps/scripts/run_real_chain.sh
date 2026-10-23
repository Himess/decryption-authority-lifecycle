#!/bin/bash
# usage: run_real_chain.sh <v0.13.8|main> [extra cargo test filter/args...]
# Starts a local Anvil (127.0.0.1 only, random mnemonic, nothing printed) plus a JSON-RPC recorder in
# front of it, then runs the real-chain harness test of the harness worktree. Everything is torn down
# on exit. Must be launched through heavy.sh (capped scope).
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
ver="$1"; shift
RUN=$L/runs/$ver-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN"
ANVIL_PORT=58545; REC_PORT=58546; CHAIN_ID=12345
echo "RUN dir=$RUN anvil=127.0.0.1:$ANVIL_PORT recorder=127.0.0.1:$REC_PORT chain_id=$CHAIN_ID $(anvil --version | head -1)"
anvil --host 127.0.0.1 --port $ANVIL_PORT --chain-id $CHAIN_ID --mnemonic-random --silent > "$RUN/anvil.out" 2>&1 &
ANVIL_PID=$!
python3 -I $L/scripts/rpc_recorder.py $REC_PORT http://127.0.0.1:$ANVIL_PORT "$RUN/host_rpc.jsonl" > "$RUN/recorder.out" 2>&1 &
REC_PID=$!
trap 'kill $ANVIL_PID $REC_PID 2>/dev/null || true; wait 2>/dev/null || true; echo "RUN teardown done"' EXIT
for i in $(seq 1 100); do
  curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:$ANVIL_PORT >/dev/null && break
  sleep 0.2
done
for i in $(seq 1 100); do
  curl -sf -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://127.0.0.1:$REC_PORT >/dev/null && break
  sleep 0.2
done
: > "$RUN/host_rpc.jsonl"   # drop the readiness probe
ss -ltnH | grep -E ":(${ANVIL_PORT}|${REC_PORT})\b" | awk '{print "RUN listening " $4}'
export LIFECYCLE_ANVIL_URL=http://127.0.0.1:$ANVIL_PORT
export LIFECYCLE_HOST_RPC_URL=http://127.0.0.1:$REC_PORT
export LIFECYCLE_HOST_CHAIN_ID=$CHAIN_ID
export LIFECYCLE_SOL_OUT=$L/harness/sol/out
export KW_TREE=harness KW_DB=1
set +e
$L/scripts/kw.sh "$ver" test --test acl_real_chain "$@" -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl")"
python3 -I $L/scripts/decode_host_rpc.py "$RUN/host_rpc.jsonl" "$RUN/test.log" > "$RUN/acl_calls.txt" 2>&1 || true
cat "$RUN/acl_calls.txt"
ln -sfn "$RUN" $L/runs/latest-$ver
exit $rc
