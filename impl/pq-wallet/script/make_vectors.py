"""Phase 5, B0: the ML-DSA-44 test vectors of the PQWallet Foundry tests (TEST ONLY).

Usage: python -I make_vectors.py <python with dilithium deps> <mldsa_tool.py> <evm-ml-dsa-verifier checkout> <out.json>

The keys and signatures come from E4's signer (experiments/E4/pq/mldsa_tool.py), a thin wrapper over the verifier
repository's own off-chain code (key derivation and deterministic FIPS 204 signing with an empty context, and
prepare.py for the key blob). Both test keys derive from public labels: the seed is keccak256 of the label. They are
test values only and never used on a public network; the seeds reach the signer through its environment only.

The tests place every account at a fixed address (the wallet with forge-std's deployCodeTo, the EIP-7702 account from
a fixed test private key), so each execute digest can be computed here:
  keccak256(abi.encode(EXECUTE_TYPEHASH, chainid, account, nonce, target, keccak256(data))), chain id 31337.
"""
import json
import os
import subprocess
import sys

from Crypto.Hash import keccak

py, tool, repo, out_path = sys.argv[1:5]

KEY_LABELS = {
    "k1": "fhe-authority-lifecycle/P5/B0/wallet-key/v1",
    "k2": "fhe-authority-lifecycle/P5/B0/other-key/v1",
}
CHAIN_ID = 31337
WALLET = "0x00000000000000000000000000000000000b0001"      # PQWalletTest.WALLET (deployCodeTo)
EOA = "0xe05fcc23807536bee418f142d19fa0d21bb0cff7"         # vm.addr(0xA11CE), checked by the test
TARGET = "0x00000000000000000000000000000000007a26e7"      # PQWalletTest.TARGET (a Recorder)
EXECUTE_TYPEHASH = "ee1ab2b804e7e54a9cdc20e1a9f6c0143c163e3d54a8b4ee164b0abd3e0ee2c2"
HASH_LABEL = b"fhe-authority-lifecycle/P5/B0/isValidSignature/v1"


def k256(b):
    h = keccak.new(digest_bits=256)
    h.update(b)
    return h.digest()


def word(x):
    if isinstance(x, str):
        x = int(x, 16)
    return x.to_bytes(32, "big")


def tool_call(seed, *args):
    env = {"PATH": os.environ.get("PATH", ""), "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""), "MLDSA44_SEED_HEX": seed.hex()}
    r = subprocess.run([py, "-I", "-B", tool, "--repo", repo, *args], env=env, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def record_call(value):
    return k256(b"record(uint256)")[:4] + word(value)


def execute_digest(account, nonce, target, data):
    return k256(bytes.fromhex(EXECUTE_TYPEHASH) + word(CHAIN_ID) + word(account) + word(nonce) + word(target) + k256(data))


out = {"chainId": CHAIN_ID, "wallet": WALLET, "eoa": EOA, "target": TARGET, "keys": {}, "isValidSignature": {}, "execute": []}
seeds = {name: k256(label.encode()) for name, label in KEY_LABELS.items()}
for name, seed in seeds.items():
    pub = tool_call(seed, "pubkey")
    pk = bytes.fromhex(pub["pk"])
    assert len(pk) == 1312 and len(bytes.fromhex(pub["blob"])) == 20545
    out["keys"][name] = {"label": KEY_LABELS[name], "pk": "0x" + pub["pk"], "blob": "0x" + pub["blob"],
                         "pkHash": "0x" + k256(pk).hex()}

h = k256(HASH_LABEL)
out["isValidSignature"] = {"hash": "0x" + h.hex(), "label": HASH_LABEL.decode()}
for name in ("k1", "k2"):
    s = tool_call(seeds[name], "sign", "--msg", "0x" + h.hex())
    assert s["self_verified"] is True
    out["isValidSignature"]["sig_" + name] = "0x" + s["sig"]

# The wallet (deployed, k1): nonce 0 then 1. The EIP-7702 account (k1): nonce 0. One signature by k2 at nonce 0, and
# one by k1 at nonce 0 for a call that reverts (Recorder.fail()).
plan = [("wallet", WALLET, 0, 42, "k1"), ("wallet", WALLET, 1, 43, "k1"), ("eoa", EOA, 0, 7, "k1"),
        ("wallet-k2", WALLET, 0, 42, "k2"), ("wallet-fail", WALLET, 0, None, "k1")]
for name, account, nonce, value, key in plan:
    data = record_call(value) if value is not None else k256(b"fail()")[:4]
    digest = execute_digest(account, nonce, TARGET, data)
    s = tool_call(seeds[key], "sign", "--msg", "0x" + digest.hex())
    assert s["self_verified"] is True
    out["execute"].append({"name": name, "account": account, "nonce": nonce, "value": value, "key": key,
                           "data": "0x" + data.hex(), "digest": "0x" + digest.hex(), "sig": "0x" + s["sig"]})

with open(out_path, "w", encoding="utf-8", newline="\n") as f:
    json.dump(out, f, indent=1)
print(f"wrote {out_path}: 2 keys, {2} isValidSignature signatures, {len(out['execute'])} execute signatures")
