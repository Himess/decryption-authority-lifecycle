#!/usr/bin/env bash
# =============================================================================
# run_p11_crate.sh: Phase 4, P1.1 (proof class Mock). The verifier crate's whole
# suite with every K8 implementation and the fault switch, on a clean commit of
# lifecycle/level3-verifier: the KDA route tests, K8 (both modes, injected faults,
# 13-node assignments), ACVP and Wycheproof vectors per implementation, Profile H.
#
# Usage:  impl/harness/phase4/run_p11_crate.sh <run-id>
# Output: results/phase4/raw/p11/crate/<run-id>.txt
# Local only: no network at test time (vectors are in the crate's tests/vectors/).
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib/env.sh"

run_id="${1:?usage: run_p11_crate.sh <run-id>}"
W="$IMPL_DIR/wt-l1-main"
C="$W/shared/user-decryption-signature"
OUT="$PROJECT_DIR/results/phase4/raw/p11/crate"
mkdir -p "$OUT"
branch="$(git -C "$W" rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "lifecycle/level3-verifier" ]] || { echo "worktree is on '$branch'" >&2; exit 2; }
[[ -z "$(git -C "$W" status --porcelain --untracked-files=no)" ]] || { echo "tracked files modified; refusing" >&2; exit 2; }

{
  echo "run=$run_id date=$(date -u +%FT%TZ) machine=M1 ($(node -e 'const o=require("os");console.log(`${o.cpus()[0].model.trim()}, ${(o.totalmem()/2**30).toFixed(1)} GiB, ${o.type()} ${o.release()}`)'))"
  echo "branch=$branch commit=$(git -C "$W" rev-parse HEAD) $(rustc --version) $(cargo --version)"
  CARGO_TARGET_DIR="$IMPL_DIR/.tools/target-l3-crate" cargo test --locked --manifest-path "$C/Cargo.toml" \
      --features "k8 k8-fault-injection" -- --nocapture 2>&1
  echo "cargo rc=$?"
} > "$OUT/$run_id.txt"
grep -E "^test result:|^cargo rc=|K8-VECTORS-TOTAL" "$OUT/$run_id.txt"
