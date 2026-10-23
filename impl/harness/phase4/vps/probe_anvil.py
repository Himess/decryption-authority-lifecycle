"""Probes the VPS anvil before the P0.2 and P0.4 connector runs (local node on 127.0.0.1 only).

Usage: python3 -I probe_anvil.py <rpc_url> <artifacts dir> <f1600 hex file> <mldsa python> <mldsa tool> <mldsa repo>

Checks:
  1. anvil_setCode with 0xef0100 || delegate is executed as an EIP-7702 delegation (a call into the account runs the
     delegate: NoErc1271's fallback answers with empty data instead of failing on the 0xef byte);
  2. anvil_rollback(1) removes the last block;
  3. E4's ML-DSA-44 stack (Fireblocks verifier, MLDSA44Account1271) accepts a signature from E4's signer
     (isValidSignature returns 0x1626ba7e), with the account called directly and through a delegated EOA.
Prints one JSON object. The seed is E4's public local test seed (keccak256 of a fixed string, computed by the tool).
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

RPC, ART, F1600, PY, TOOL, REPO = sys.argv[1:7]
SEED_LABEL = b"fhe-authority-lifecycle/E4/local-test-seed/v1"


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(RPC, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def result(method, params):
    r = rpc(method, params)
    if "error" in r:
        raise RuntimeError(f"{method}: {r['error']}")
    return r["result"]


def keccak_hex(data_hex):
    # Keccak-256 through the node itself (web3_sha3), so no Python keccak package is needed.
    return result("web3_sha3", [data_hex])


def artifact(name, key):
    return json.load(open(os.path.join(ART, f"{name}.json")))[key]["object"]


def deploy(sender, code):
    tx = result("eth_sendTransaction", [{"from": sender, "data": code, "gas": hex(16_000_000)}])
    for _ in range(100):
        rcpt = result("eth_getTransactionReceipt", [tx])
        if rcpt:
            break
        time.sleep(0.1)
    assert rcpt and rcpt["status"] == "0x1", (rcpt, len(code))
    return rcpt["contractAddress"]


def mldsa(cmd, *args):
    seed = keccak_hex("0x" + SEED_LABEL.hex())[2:]
    out = subprocess.run([PY, "-I", "-B", TOOL, "--repo", REPO, cmd, *args], capture_output=True, text=True,
                         env={"PATH": os.environ.get("PATH", ""), "MLDSA44_SEED_HEX": seed}, check=True)
    return json.loads(out.stdout)


def word(addr_or_hex):
    return addr_or_hex[2:].lower().rjust(64, "0")


out = {"client": result("web3_clientVersion", [])}
sender = result("eth_accounts", [])[0]

# 1. delegation by anvil_setCode
no_erc = "0x" + "11" * 19 + "01"
result("anvil_setCode", [no_erc, artifact("NoErc1271", "deployedBytecode")])
x = "0x" + "22" * 19 + "02"
result("anvil_setCode", [x, "0xef0100" + no_erc[2:]])
sel = "0x1626ba7e" + "00" * 32 + word("0x40") + "00" * 32
r = rpc("eth_call", [{"to": x, "data": sel}, "latest"])
out["setcode_delegation"] = {"code": result("eth_getCode", [x, "latest"]), "call": r.get("result", r.get("error"))}

# 2. rollback
result("evm_mine", [])
h1 = int(result("eth_blockNumber", []), 16)
rb = rpc("anvil_rollback", [1])
h2 = int(result("eth_blockNumber", []), 16)
out["rollback"] = {"before": h1, "after": h2, "response": rb.get("result", rb.get("error"))}

# 3. ML-DSA-44 stack
helper_code = "0x" + "".join(open(F1600).read().split()).removeprefix("0x")
out["f1600_codehash"] = keccak_hex(helper_code)
helper = "0x" + "33" * 19 + "03"
result("anvil_setCode", [helper, helper_code])
verifier = deploy(sender, artifact("MLDSA44Verifier", "bytecode") + word(helper))
keys = mldsa("pubkey")
pk_hash = keccak_hex("0x" + keys["pk"])
blob = "0x" + "44" * 19 + "04"
result("anvil_setCode", [blob, "0x" + keys["blob"]])
account = deploy(sender, artifact("MLDSA44Account1271", "bytecode") + word(verifier) + word(blob) + pk_hash[2:])
digest = "0x" + "ab" * 32
sig = mldsa("sign", "--msg", digest)["sig"]
padded = sig + "00" * ((32 - len(sig) // 2 % 32) % 32)
call = "0x1626ba7e" + digest[2:] + word("0x40") + word(hex(len(sig) // 2)) + padded
direct = rpc("eth_call", [{"to": account, "data": call, "gas": hex(2_200_000)}, "latest"])
y = "0x" + "55" * 19 + "05"
result("anvil_setCode", [y, "0xef0100" + account[2:]])
delegated = rpc("eth_call", [{"to": y, "data": call, "gas": hex(2_200_000)}, "latest"])
out["mldsa"] = {"direct": (direct.get("result") or str(direct.get("error")))[:10],
                "via_delegated_eoa": (delegated.get("result") or str(delegated.get("error")))[:10]}
print(json.dumps(out))
