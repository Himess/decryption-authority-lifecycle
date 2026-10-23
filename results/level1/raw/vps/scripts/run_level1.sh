#!/bin/bash
# usage: run_level1.sh main [extra cargo test filter/args...]
# Level 1 connector proof: Profile H in the kms-worker at main (lifecycle/level1 tree, KW_TREE=l1), against the Level 0
# ACL v0.8.0 on a local Anvil (127.0.0.1 only, random mnemonic, nothing printed) behind the JSON-RPC recorder.
# Derived from run_level0.sh / run_level2.sh. Everything is torn down on exit. Must be launched through heavy.sh.
set -euo pipefail
source /srv/lifecycle/scripts/env.sh
export HOME=$L/home
ver="$1"; shift
RUN=$L/runs/level1-$ver-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$RUN"
ANVIL_PORT=58545; REC_PORT=58546; CHAIN_ID=12345
SRC=$L/src/fhevm-$ver-l1
PRISTINE=$L/src/fhevm-$ver
echo "RUN dir=$RUN anvil=127.0.0.1:$ANVIL_PORT recorder=127.0.0.1:$REC_PORT chain_id=$CHAIN_ID $(anvil --version | head -1)"

# Provenance: this tree DIFFERS from pristine by design (the Level 1 connector change); record exactly how.
set +e
{
  echo "date=$(date -u +%FT%TZ) host=$(hostname) nproc=$(nproc) kernel=$(uname -r)"
  echo "l1 HEAD=$(git -C "$SRC" rev-parse HEAD) pristine HEAD=$(git -C "$PRISTINE" rev-parse HEAD)"
  echo "== git status --porcelain (pristine worktree; must be empty)"
  git -C "$PRISTINE" status --porcelain
  echo "== git status --porcelain (Level 1 tree)"
  git -C "$SRC" status --porcelain
  echo "== git diff --stat (Level 1 tree vs its HEAD, tracked files)"
  git -C "$SRC" diff --stat
  echo "== sha256 of every changed or added file"
  git -C "$SRC" status --porcelain | awk '{print $2}' | while read -r f; do
    if [ -d "$SRC/$f" ]; then find "$SRC/$f" -type f | sort | xargs sha256sum; else sha256sum "$SRC/$f"; fi
  done
  echo "== harness inputs"
  sha256sum $L/harness/level0/level0_acl_main.json $L/harness/level0/base_acl_main.json $L/harness/level1/*.json \
    $L/harness/sol/src/*.sol $L/scripts/rpc_recorder.py $L/scripts/run_level1.sh $L/scripts/analyze_level1.py
} > "$RUN/provenance.txt" 2>&1
set -e

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
export LIFECYCLE_L0_ACL_ARTIFACT=$L/harness/level0/level0_acl_$ver.json
export LIFECYCLE_BASE_ACL_ARTIFACT=$L/harness/level0/base_acl_main.json
export LIFECYCLE_L1_REJECTALL_ARTIFACT=$L/harness/level1/RejectAll1271Wallet.json
export KW_TREE=l1 KW_DB=1
set +e
$L/scripts/kw.sh "$ver" test --test acl_profile_h_real_chain "$@" -- --test-threads=1 --nocapture 2>&1 | tee "$RUN/test.log"
rc=${PIPESTATUS[0]}
set -e
echo "RUN rc=$rc host_rpc_records=$(wc -l < "$RUN/host_rpc.jsonl")"
python3 -I $L/scripts/analyze_level1.py "$RUN" > "$RUN/analysis.out" 2>&1 || echo "analysis rc=$?"
tail -n 60 "$RUN/analysis.out"
ln -sfn "$RUN" $L/runs/latest-level1-$ver
exit $rc
