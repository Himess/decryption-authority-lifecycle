#!/usr/bin/env bash
# Builds the Level 2 ACL artifacts for the real-connector harness on the VPS, the same way the Level 0 ones were
# built: the committed ACL source of a lifecycle/level2 worktree, compiled with that ref's default Foundry profile
# (the profile that produced the checkout's fhevm_host_bindings), with the address constants of those bindings
# (executor 0xe3a9..., pauser set 0x34e3..., and on main the confidential bridge 0xcC1f...).
# Output: results/level2/vps-artifacts/level2_acl_<line>.json (abi, bytecode, deployedBytecode, provenance).
# Usage: bash impl/harness/level2/build_vps_acl_artifacts.sh   (from fhe-authority-lifecycle/)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT="$ROOT/results/level2/vps-artifacts"
TOOLS="$ROOT/impl/.tools/vps-art"
w() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
mkdir -p "$OUT" "$TOOLS"

EXECUTOR=0xe3a9105a3a932253A70F126eb1E3b589C643dD24
PAUSER_SET=0x34e3eD8472e409dbF8FDf933cA996DC75e4Be126
BRIDGE=0xcC1fD31EA4CBEE42FebC00360894A13ba1A32106

build() { # <line> <worktree> <source clone for node_modules/dependencies> <env overrides for forge>
  local line="$1" wt="$ROOT/impl/$2" src="$ROOT/impl/$3/host-contracts" tmp="$TOOLS/$1"
  local commit; commit="$(git -C "$wt" rev-parse HEAD)"
  rm -rf "$tmp"; mkdir -p "$tmp"
  git -C "$wt" archive HEAD host-contracts | tar -x -C "$tmp"
  node -e "const fs=require('fs');const [s,d]=process.argv.slice(1);fs.symlinkSync(s+'/node_modules',d+'/node_modules','junction');fs.cpSync(s+'/dependencies',d+'/dependencies',{recursive:true});fs.cpSync(s+'/addresses',d+'/addresses',{recursive:true});" "$(w "$src")" "$(w "$tmp/host-contracts")"
  local addr="$tmp/host-contracts/addresses/FHEVMHostAddresses.sol"
  sed -i -E "s/(address constant fhevmExecutorAdd = )0x[0-9a-fA-F]{40};/\1$EXECUTOR;/; s/(address constant pauserSetAdd = )0x[0-9a-fA-F]{40};/\1$PAUSER_SET;/; s/(address constant confidentialBridgeAdd = )0x[0-9a-fA-F]{40};/\1$BRIDGE;/" "$addr"
  grep -E "fhevmExecutorAdd|pauserSetAdd|confidentialBridgeAdd" "$addr"
  (cd "$tmp/host-contracts" && env $4 FOUNDRY_ISOLATE=false forge build contracts/ACL.sol >/dev/null)
  python -I - "$(w "$tmp/host-contracts")" "$(w "$OUT/level2_acl_$line.json")" "$line" "$commit" "$(git -C "$wt" rev-parse HEAD:host-contracts/contracts/ACL.sol)" "$(git -C "$wt" rev-parse HEAD:host-contracts/contracts/ACLEvents.sol)" "$(forge --version | head -1)" <<'EOF'
import hashlib, json, re, sys
hc, out, line, commit, blob_acl, blob_events, forge = sys.argv[1:8]
art = json.load(open(hc + "/out/ACL.sol/ACL.json", encoding="utf-8"))
meta = json.loads(art["rawMetadata"])
addr = open(hc + "/addresses/FHEVMHostAddresses.sol", encoding="utf-8").read()
consts = {m.group(1): m.group(2) for m in re.finditer(r"address constant (\w+) = (0x[0-9a-fA-F]{40});", addr)}
used = ["fhevmExecutorAdd", "pauserSetAdd"] + (["confidentialBridgeAdd"] if line == "main" else [])
b = bytes.fromhex(art["bytecode"]["object"][2:])
d = bytes.fromhex(art["deployedBytecode"]["object"][2:])
res = {
    "contract": "ACL",
    "built_for": "lifecycle real-connector harness, Level 2 (test-only artifact)",
    "source": {"repo": "zama-ai/fhevm (local worktree)", "ref": "lifecycle/level2", "commit": commit,
               "git_blob": {"host-contracts/contracts/ACL.sol": blob_acl, "host-contracts/contracts/ACLEvents.sol": blob_events}},
    "compiler": {"solc": meta["compiler"]["version"], "forge": forge, "settings": {
        "optimizer": meta["settings"]["optimizer"], "evmVersion": meta["settings"]["evmVersion"],
        "metadata": meta["settings"].get("metadata")}, "profile": "default Foundry profile of this ref" if line == "main" else "production settings (optimizer on, 800 runs): the default profile exceeds EIP-170"},
    "address_constants": {k: consts[k] for k in used},
    "methodIdentifiers": art["methodIdentifiers"],
    "abi": art["abi"],
    "bytecode": art["bytecode"],
    "deployedBytecode": art["deployedBytecode"],
    "sizes": {"creation_bytes": len(b), "runtime_bytes": len(d)},
    "sha256": {"creation": hashlib.sha256(b).hexdigest(), "runtime": hashlib.sha256(d).hexdigest()},
}
json.dump(res, open(out, "w", encoding="utf-8"), indent=1)
print(line, "runtime", len(d), "bytes, sha256", res["sha256"]["runtime"][:16], "optimizer", res["compiler"]["settings"]["optimizer"])
EOF
}

build main wt-l2-main fhevm-main "LIFECYCLE_PROFILE=default"
# v0.13.8: its default Foundry profile is unoptimized, and the Level 2 ACL compiled that way is 25,236 runtime
# bytes, above the EIP-170 limit (24,576), so anvil refuses it. Zama's production (Hardhat) settings are used
# instead: optimizer on, 800 runs.
build v0.13.8 wt-l2-v0138 fhevm-v0.13.8 "FOUNDRY_OPTIMIZER=true FOUNDRY_OPTIMIZER_RUNS=800"
