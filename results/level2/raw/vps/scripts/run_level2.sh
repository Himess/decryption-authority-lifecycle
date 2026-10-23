#!/bin/bash
# usage: run_level2.sh <v0.13.8|main> [extra cargo test filter/args...]
# Level 2 connector proof: the E1 successor read through the UNMODIFIED connector's delegated path. Derived from
# run_level0.sh (same anvil on 127.0.0.1 with a random mnemonic and nothing printed, same JSON-RPC recorder, same
# provenance check); runs tests/acl_successor_real_chain.rs of the harness worktree against the Level 2 ACL artifact.
# Everything is torn down on exit. Must be launched through heavy.sh (capped scope).
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
ver="$1"; shift
RUN=$L/runs/level2-$ver-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN"
ANVIL_PORT=58545; REC_PORT=58546; CHAIN_ID=12345
SRC=$L/src/fhevm-$ver-harness
PRISTINE=$L/src/fhevm-$ver
echo "RUN dir=$RUN anvil=127.0.0.1:$ANVIL_PORT recorder=127.0.0.1:$REC_PORT chain_id=$CHAIN_ID $(anvil --version | head -1)"

# Provenance: the connector production code is byte-identical to the pristine checkout of the same commit.
set +e
{
  echo "date=$(date -u +%FT%TZ) host=$(hostname) nproc=$(nproc) kernel=$(uname -r)"
  echo "harness HEAD=$(git -C "$SRC" rev-parse HEAD) pristine HEAD=$(git -C "$PRISTINE" rev-parse HEAD)"
  echo "== git status --porcelain (harness worktree; only test files may appear)"
  git -C "$SRC" status --porcelain
  echo "== git status --porcelain (pristine worktree; must be empty)"
  git -C "$PRISTINE" status --porcelain
  echo "== diff -rq pristine vs harness kms-connector, excluding directories named 'tests'"
  if diff -rq --exclude=tests "$PRISTINE/kms-connector" "$SRC/kms-connector"; then echo "IDENTICAL"; else echo "DIFFERENT"; fi
  for d in crates/kms-worker/src crates/utils/src; do
    h1=$(cd "$SRC/kms-connector/$d" && find . -type f -not -path './tests/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64)
    h2=$(cd "$PRISTINE/kms-connector/$d" && find . -type f -not -path './tests/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64)
    echo "tree-sha256 $d (excluding ./tests): harness=$h1 pristine=$h2 $([ "$h1" = "$h2" ] && echo EQUAL || echo DIFFERENT)"
  done
  echo "== harness inputs"
  sha256sum "$SRC/kms-connector/crates/kms-worker/tests/acl_successor_real_chain.rs" $L/harness/level2/*.json \
    $L/harness/level0/base_acl_main.json $L/harness/sol/src/*.sol $L/scripts/rpc_recorder.py $L/scripts/run_level2.sh \
    $L/scripts/decode_level2.py $L/scripts/indep_check_l2.py
} > "$RUN/provenance.txt" 2>&1
set -e
grep -E "IDENTICAL|DIFFERENT|EQUAL" "$RUN/provenance.txt" | sed 's/^/PROVENANCE /'

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
export LIFECYCLE_L0_ACL_ARTIFACT=$L/harness/level2/level2_acl_$ver.json
if [ "$ver" = main ]; then export LIFECYCLE_BASE_ACL_ARTIFACT=$L/harness/level0/base_acl_main.json; fi
export KW_TREE=harness KW_DB=1
set +e
$L/scripts/kw.sh "$ver" test --test acl_successor_real_chain "$@" -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl")"
BASE_JSONL=$(ls $L/runs/$ver-*/host_rpc.jsonl 2>/dev/null | tr '\n' ' ')
python3 -I $L/scripts/decode_level2.py "$RUN" $BASE_JSONL > "$RUN/decode.out" 2>&1 || echo "decoder rc=$?"
tail -n 40 "$RUN/decode.out"
python3 -I $L/scripts/indep_check_l2.py "$RUN" > "$RUN/indep_check.out" 2>&1 || echo "indep check rc=$?"
tail -n 3 "$RUN/indep_check.out"
ln -sfn "$RUN" $L/runs/latest-level2-$ver
exit $rc
