"""P1.5: which ACL release Ethereum mainnet and Sepolia run today. Read-only.

Usage: python -I deployed_versions.py <project dir> <out.json>

For each chain: eth_blockNumber, then at that block the ACL proxy's EIP-1967 implementation slot (eth_getStorageAt),
`getVersion()` through the proxy (eth_call), and the implementation's code hash (eth_getCode). Then Sourcify's record of
the implementation, if any. No transaction is sent; at most a handful of requests per chain, one at a time.

Endpoints: mainnet uses the public endpoints the Phase 2 census used; Sepolia uses SEPOLIA_RPC_URL from the project's
.env, read here and never printed or written. Neither is a Zama, Fhenix or Inco endpoint.
"""
import json
import sys
import time
import urllib.request
from hashlib import sha3_256  # noqa: F401  (keccak is not in hashlib; the code hash is computed below)
from pathlib import Path

IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
GET_VERSION = "0x0d8e6e2c"  # getVersion()
CHAINS = [
    {"chain": "ethereum-mainnet", "chain_id": 1, "acl": "0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6",
     "endpoints": ["https://ethereum-rpc.publicnode.com", "https://rpc.mevblocker.io"]},
    {"chain": "sepolia", "chain_id": 11155111, "acl": "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D", "endpoints": None},
]


def keccak256(data: bytes) -> str:
    # Pure-Python Keccak-256 (the pre-NIST padding Ethereum uses), from the reference sponge construction.
    RC = [0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000, 0x000000000000808B,
          0x0000000080000001, 0x8000000080008081, 0x8000000000008009, 0x000000000000008A, 0x0000000000000088,
          0x0000000080008009, 0x000000008000000A, 0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
          0x8000000000008003, 0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
          0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008]
    ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]
    M = (1 << 64) - 1

    def rol(x, n):
        return ((x << n) | (x >> (64 - n))) & M if n else x

    def f(A):
        for rc in RC:
            C = [A[x][0] ^ A[x][1] ^ A[x][2] ^ A[x][3] ^ A[x][4] for x in range(5)]
            D = [C[(x - 1) % 5] ^ rol(C[(x + 1) % 5], 1) for x in range(5)]
            A = [[A[x][y] ^ D[x] for y in range(5)] for x in range(5)]
            B = [[0] * 5 for _ in range(5)]
            for x in range(5):
                for y in range(5):
                    B[y][(2 * x + 3 * y) % 5] = rol(A[x][y], ROT[x][y])
            A = [[B[x][y] ^ ((~B[(x + 1) % 5][y]) & B[(x + 2) % 5][y]) for y in range(5)] for x in range(5)]
            A[0][0] ^= rc
        return A

    rate = 136
    msg = bytearray(data) + b"\x01"
    while len(msg) % rate:
        msg += b"\x00"
    msg[-1] |= 0x80
    A = [[0] * 5 for _ in range(5)]
    for off in range(0, len(msg), rate):
        block = msg[off:off + rate]
        for i in range(rate // 8):
            x, y = i % 5, i // 5
            A[x][y] ^= int.from_bytes(block[8 * i:8 * i + 8], "little")
        A = f(A)
    out = b"".join(A[i % 5][i // 5].to_bytes(8, "little") for i in range(4))
    return "0x" + out.hex()


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json", "user-agent": "lifecycle-readonly"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read())
    time.sleep(0.25)  # well under 10 requests per second
    if "error" in j:
        raise RuntimeError(j["error"])
    return j["result"]


def decode_string(hexdata):
    b = bytes.fromhex(hexdata[2:])
    off = int.from_bytes(b[:32], "big")
    n = int.from_bytes(b[off:off + 32], "big")
    return b[off + 32:off + 32 + n].decode()


def sourcify(chain_id, address):
    url = f"https://sourcify.dev/server/v2/contract/{chain_id}/{address}?fields=compilation"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "lifecycle-readonly"}), timeout=30) as r:
            j = json.loads(r.read())
        c = j.get("compilation") or {}
        return {"match": j.get("match"), "compiler": c.get("compilerVersion"), "name": c.get("name"),
                "path": c.get("fullyQualifiedName")}
    except Exception as e:  # not verified (404) or unreachable
        return {"match": None, "note": str(e)[:80]}


def main():
    project, out = Path(sys.argv[1]), sys.argv[2]
    env = {}
    for line in (project / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    results = []
    for c in CHAINS:
        endpoints = c["endpoints"] or [env["SEPOLIA_RPC_URL"]]
        last = None
        for url in endpoints:
            try:
                block = rpc(url, "eth_blockNumber", [])
                slot = rpc(url, "eth_getStorageAt", [c["acl"], IMPL_SLOT, block])
                impl = "0x" + slot[-40:]
                version = decode_string(rpc(url, "eth_call", [{"to": c["acl"], "data": GET_VERSION}, block]))
                code = rpc(url, "eth_getCode", [impl, block])
                results.append({"chain": c["chain"], "chain_id": c["chain_id"], "block": int(block, 16), "acl_proxy": c["acl"],
                                "implementation": impl, "getVersion": version, "implementation_code_bytes": (len(code) - 2) // 2,
                                "implementation_code_keccak": keccak256(bytes.fromhex(code[2:])),
                                "endpoint": "public census endpoint" if c["endpoints"] else "SEPOLIA_RPC_URL (.env)",
                                "sourcify": sourcify(c["chain_id"], impl)})
                break
            except Exception as e:
                last = str(e)[:80]
        else:
            results.append({"chain": c["chain"], "error": last})
    Path(out).write_text(json.dumps({"date_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "results": results},
                                    indent=1), encoding="utf-8")
    for r in results:
        print({k: v for k, v in r.items() if k != "sourcify"}, "sourcify:", r.get("sourcify"))


if __name__ == "__main__":
    main()
