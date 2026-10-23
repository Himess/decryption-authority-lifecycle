#!/usr/bin/env bash
# Phase 5, Part B: the registry artifacts of the drill, built the way the Level 2 ones were
# (impl/harness/level2/build_vps_acl_artifacts.sh): the committed source of a lifecycle worktree, compiled with that
# ref's default Foundry profile, with the address constants of the connector harness's bindings.
#   - level3_acl_main.json            ACL v0.10.0 (Core, E1, E2) of impl/wt-l2-main, branch lifecycle/level3
#   - empty_uups_proxy_acl_main.json  EmptyUUPSProxyACL of the same tree (the first implementation behind the proxy)
# and copies, from the VPS, the artifacts the connector harness already uses there (built in Phase 3):
#   - base_acl_main.json              Zama's ACL v0.7.0 at main ed851716c, without Core (B5's release without Core)
#   - DeployableERC1967Proxy.json, ExecutorStub.json, DappStub.json (results/level0/raw/vps/harness_sol)
# Output: results/phase5/vps-artifacts/, with SHA256SUMS.
# Usage: bash impl/harness/phase5/build_p5_artifacts.sh   (from anywhere)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT="$ROOT/results/phase5/vps-artifacts"
TOOLS="$ROOT/impl/.tools/vps-art-p5"
w() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
mkdir -p "$OUT" "$TOOLS"

EXECUTOR=0xe3a9105a3a932253A70F126eb1E3b589C643dD24
PAUSER_SET=0x34e3eD8472e409dbF8FDf933cA996DC75e4Be126
BRIDGE=0xcC1fD31EA4CBEE42FebC00360894A13ba1A32106

wt="$ROOT/impl/wt-l2-main" src="$ROOT/impl/fhevm-main/host-contracts" tmp="$TOOLS/main"
branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD)"; commit="$(git -C "$wt" rev-parse HEAD)"
[[ "$branch" == "lifecycle/level3" ]] || { echo "$wt is on $branch, expected lifecycle/level3" >&2; exit 2; }
[[ -z "$(git -C "$wt" status --porcelain --untracked-files=no -- host-contracts)" ]] || { echo "tracked files modified under $wt/host-contracts" >&2; exit 2; }
rm -rf "$tmp"; mkdir -p "$tmp"
git -C "$wt" archive HEAD host-contracts | tar -x -C "$tmp"
node -e "const fs=require('fs');const [s,d]=process.argv.slice(1);fs.symlinkSync(s+'/node_modules',d+'/node_modules','junction');fs.cpSync(s+'/dependencies',d+'/dependencies',{recursive:true});fs.cpSync(s+'/addresses',d+'/addresses',{recursive:true});" "$(w "$src")" "$(w "$tmp/host-contracts")"
addr="$tmp/host-contracts/addresses/FHEVMHostAddresses.sol"
sed -i -E "s/(address constant fhevmExecutorAdd = )0x[0-9a-fA-F]{40};/\1$EXECUTOR;/; s/(address constant pauserSetAdd = )0x[0-9a-fA-F]{40};/\1$PAUSER_SET;/; s/(address constant confidentialBridgeAdd = )0x[0-9a-fA-F]{40};/\1$BRIDGE;/" "$addr"
grep -E "fhevmExecutorAdd|pauserSetAdd|confidentialBridgeAdd" "$addr"
(cd "$tmp/host-contracts" && env LIFECYCLE_PROFILE=default FOUNDRY_ISOLATE=false forge build contracts/ACL.sol contracts/emptyProxyACL/EmptyUUPSProxyACL.sol >/dev/null)

python -I - "$(w "$tmp/host-contracts")" "$(w "$OUT")" "$commit" "$(git -C "$wt" rev-parse HEAD:host-contracts/contracts/ACL.sol)" "$(forge --version | head -1)" <<'EOF'
import hashlib, json, re, sys
hc, out, commit, blob_acl, forge = sys.argv[1:6]
addr = open(hc + "/addresses/FHEVMHostAddresses.sol", encoding="utf-8").read()
consts = {m.group(1): m.group(2) for m in re.finditer(r"address constant (\w+) = (0x[0-9a-fA-F]{40});", addr)}
for name, rel, dest in (("ACL", "ACL.sol/ACL.json", "level3_acl_main.json"),
                        ("EmptyUUPSProxyACL", "EmptyUUPSProxyACL.sol/EmptyUUPSProxyACL.json", "empty_uups_proxy_acl_main.json")):
    art = json.load(open(hc + "/out/" + rel, encoding="utf-8"))
    meta = json.loads(art["rawMetadata"])
    b = bytes.fromhex(art["bytecode"]["object"][2:])
    d = bytes.fromhex(art["deployedBytecode"]["object"][2:])
    res = {
        "contract": name,
        "built_for": "lifecycle Phase 5 drill, Level 3 registry (test-only artifact)",
        "source": {"repo": "zama-ai/fhevm (local worktree)", "ref": "lifecycle/level3", "commit": commit,
                   "git_blob": {"host-contracts/contracts/ACL.sol": blob_acl}},
        "compiler": {"solc": meta["compiler"]["version"], "forge": forge, "settings": {
            "optimizer": meta["settings"]["optimizer"], "evmVersion": meta["settings"]["evmVersion"],
            "metadata": meta["settings"].get("metadata")}, "profile": "default Foundry profile of this ref"},
        "address_constants": {k: consts[k] for k in ("fhevmExecutorAdd", "pauserSetAdd", "confidentialBridgeAdd")},
        "methodIdentifiers": art["methodIdentifiers"],
        "abi": art["abi"],
        "bytecode": art["bytecode"],
        "deployedBytecode": art["deployedBytecode"],
        "sizes": {"creation_bytes": len(b), "runtime_bytes": len(d)},
        "sha256": {"creation": hashlib.sha256(b).hexdigest(), "runtime": hashlib.sha256(d).hexdigest()},
    }
    json.dump(res, open(out + "/" + dest, "w", encoding="utf-8"), indent=1)
    print(name, "runtime", len(d), "bytes, sha256", res["sha256"]["runtime"][:16])
EOF

# The artifacts the connector harness already uses on the VPS (built in Phase 3), copied as they are. The host and the
# key come from the environment, so neither is written in this file: LIFECYCLE_VPS=user@host, LIFECYCLE_VPS_KEY=path.
K=(-i "${LIFECYCLE_VPS_KEY:?set LIFECYCLE_VPS_KEY}" -o BatchMode=yes)
V="${LIFECYCLE_VPS:?set LIFECYCLE_VPS}:/srv/lifecycle/harness"
scp -q "${K[@]}" "$V/level0/base_acl_main.json" "$OUT/base_acl_main.json"
scp -q "${K[@]}" "$V/sol/out/Proxy.sol/DeployableERC1967Proxy.json" "$OUT/DeployableERC1967Proxy.json"
scp -q "${K[@]}" "$V/sol/out/ExecutorStub.sol/ExecutorStub.json" "$OUT/ExecutorStub.json"
scp -q "${K[@]}" "$V/sol/out/DappStub.sol/DappStub.json" "$OUT/DappStub.json"
(cd "$OUT" && sha256sum *.json > SHA256SUMS && cat SHA256SUMS)
