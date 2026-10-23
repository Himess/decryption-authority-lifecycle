#!/usr/bin/env bash
# =============================================================================
# Baseline A: run Zama's host-contracts ACL test suites, unmodified, in the same
# order as Zama's CI workflow .github/workflows/host-contracts-hardhat-forge-tests.yml:
#
#   cp .env.example .env
#   npm --workspace=host-contracts ci --include=optional        (we add --ignore-scripts)
#   npm --workspace=host-contracts run test                     (we select test/acl/acl.ts)
#   [main only] PROVISION_BRIDGE_PROXY=true HARDHAT_NETWORK=hardhat npm run deploy:emptyProxies
#   forge soldeer install && forge test                         (we select test/acl/*)
#
# Usage:
#   impl/harness/baselineA_host_contracts.sh <main|v0.13.8> [acl|full] [--fresh-install]
#
# Deviations from CI, all recorded in results/level0/ENV_BASELINE.md:
#   * npm ci --ignore-scripts, then ONLY sqlite3's install script is run
#     (prebuilt binary from github.com/TryGhost/node-sqlite3 releases), because
#     test/coprocessorUtils.ts opens an in-memory sqlite3 DB at import time.
#   * soldeer (Foundry 1.8.5) rewrites soldeer.lock to its v2 format; the file
#     is restored with `git checkout` right after the install (checksums unchanged).
#   * forge test runs twice: Foundry 1.8.5 defaults (isolate = true) and
#     FOUNDRY_ISOLATE=false (the pre-1.8 default that Zama's tests assume).
# =============================================================================
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

WHICH="${1:-}"; SCOPE="${2:-acl}"; FRESH="${3:-}"
CLONE="$(clone_dir "$WHICH")" || exit 2
HC="$CLONE/host-contracts"
TAG="A_fhevm-${WHICH}"
SUMMARY="$LOG_DIR/${TAG}_summary.txt"

run_step() { # name, then command...
    local name="$1"; shift
    local log="$LOG_DIR/${TAG}_${name}.log"
    local s e rc
    s=$(now_s); "$@" >"$log" 2>&1; rc=$?; e=$(now_s)
    echo "$name rc=$rc seconds=$((e - s)) log=$(basename "$log")" | tee -a "$SUMMARY"
    return $rc
}

{
    echo "=== Baseline A ($WHICH, scope=$SCOPE) ==="
    echo "commit: $(git -C "$CLONE" rev-parse HEAD) branch: $(git -C "$CLONE" rev-parse --abbrev-ref HEAD)"
    print_toolchain
} | tee "$SUMMARY"

cd "$HC" || exit 2
[[ -f .env ]] || cp .env.example .env

if [[ ! -d node_modules || "$FRESH" == "--fresh-install" ]]; then
    run_step npm_ci bash -c "cd '$CLONE' && npm ci --workspace=host-contracts --include=optional --ignore-scripts --no-audit --no-fund"
fi
if ! find node_modules/sqlite3 -name '*.node' 2>/dev/null | grep -q .; then
    run_step npm_rebuild_sqlite3 bash -c "cd '$CLONE' && npm rebuild sqlite3 --workspace=host-contracts --foreground-scripts --loglevel=http"
fi

# 1. Hardhat (the overridden `test` task deploys the full host stack on the
#    in-process Hardhat network first, which also (re)generates addresses/).
if [[ "$SCOPE" == "full" ]]; then
    run_step hardhat_test env HARDHAT_NETWORK=hardhat npx hardhat test
else
    run_step hardhat_test_acl env HARDHAT_NETWORK=hardhat npx hardhat test test/acl/acl.ts
fi

# 2. Foundry. On main, CI regenerates addresses/ with the bridge proxy first.
if [[ "$WHICH" == "main" ]]; then
    run_step deploy_emptyProxies env PROVISION_BRIDGE_PROXY=true HARDHAT_NETWORK=hardhat npm run deploy:emptyProxies
fi
if [[ ! -d dependencies/forge-std-1.11.0 ]]; then
    run_step soldeer_install forge soldeer install
    git checkout -- soldeer.lock
fi

MATCH=()
[[ "$SCOPE" == "full" ]] || MATCH=(--match-path 'test/acl/*')
run_step forge_test_${SCOPE}_isolate-default forge test "${MATCH[@]}"
run_step forge_test_${SCOPE}_isolate-false env FOUNDRY_ISOLATE=false forge test "${MATCH[@]}"

echo "--- suite results" | tee -a "$SUMMARY"
for f in "$LOG_DIR/${TAG}"_hardhat_test*.log; do
    [[ -f "$f" ]] && { echo "[$(basename "$f")]"; grep -E "passing|failing|pending" "$f"; } | tee -a "$SUMMARY"
done
for f in "$LOG_DIR/${TAG}"_forge_test_${SCOPE}_*.log; do
    [[ -f "$f" ]] && { echo "[$(basename "$f")]"; grep -E "^Ran [0-9]+ test suites" "$f"; } | tee -a "$SUMMARY"
done
echo "git status (must be empty):" | tee -a "$SUMMARY"
git -C "$CLONE" status --short | tee -a "$SUMMARY"
