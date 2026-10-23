"""P2.5, step 2: Profile H's H2 verdict for every EIP-7702 delegate implementation in use on mainnet, run locally.

Usage: python -I p25_h2_matrix.py <raw_dir> <out_dir> <run label> <anvil> <cast> [port]

For each delegate code hash (raw_dir/delegate_code_by_hash.json, from p25_delegates.py), on a local anvil (Osaka,
127.0.0.1, port 8651 by default, started and stopped here):
  1. the delegate's runtime code is placed at a local address (anvil_setCode);
  2. a fresh account of ours, its key derived from a public label and the code hash, gets the EIP-7702 indicator
     0xef0100 || that address (anvil_setCode, as in the Level 1 harness);
  3. our key signs a fixed 32-byte digest with plain ECDSA (65 bytes, r || s || v), as a wallet's root key signs a
     request today;
  4. eth_call isValidSignature(digest, signature) on our account with H3's gas, B_exec 2,000,000 + 21,000 +
     64 x calldata bytes, and H2's verdict:
       magic value                         -> accepted through ERC-1271
       success with empty return data      -> accepted through the empty-success shim (H2's ECDSA fallback; the
                                              signature is 65 bytes and recovers the account)
       anything else (revert, wrong magic,
       short return data)                  -> refused under enforce
  5. debug_traceCall: if the call read our account's own storage (SLOAD at depth 1, the account's context), the
     verdict depends on storage this run cannot reproduce (a real account's initialisation): it is labelled [E].
Writes <out_dir>/h2_matrix_<run label>.json: per code hash only (no end account).
"""
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request

B_EXEC = 2_000_000
MAGIC = "1626ba7e"
SELECTOR = "1626ba7e"
DIGEST = "0x" + hashlib.sha256(b"fhe-authority-lifecycle P2.5 H2 matrix test digest").hexdigest()
KEY_LABEL = b"fhe-authority-lifecycle/P2.5/root-key/v1/"
SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def keccak(b):
    from Crypto.Hash import keccak as k  # noqa: PLC0415
    h = k.new(digest_bits=256)
    h.update(b)
    return h.digest()


def calldata(digest_hex, sig_hex):
    sig = bytes.fromhex(sig_hex[2:])
    padded = sig + b"\x00" * ((32 - len(sig) % 32) % 32)
    return "0x" + SELECTOR + digest_hex[2:] + f"{64:064x}" + f"{len(sig):064x}" + padded.hex()


def main():
    raw, out, label, anvil, cast = sys.argv[1:6]
    port = int(sys.argv[6]) if len(sys.argv) > 6 else 8651
    url = f"http://127.0.0.1:{port}"
    by_hash = json.load(open(os.path.join(raw, "delegate_code_by_hash.json")))
    agg = json.load(open(os.path.join(out, "delegates_aggregate.json")))
    accounts_by_hash = {g["code_hash"]: g["accounts"] for g in agg["groups"]}

    proc = subprocess.Popen([anvil, "--host", "127.0.0.1", "--port", str(port), "--hardfork", "osaka",
                             "--chain-id", "31337", "--gas-limit", "1000000000", "--quiet"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                rpc(url, "eth_chainId", [])
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.2)
        anvil_version = subprocess.run([anvil, "--version"], capture_output=True, text=True).stdout.strip()
        rows = []
        for code_hash, code in sorted(by_hash.items()):
            seed = keccak(KEY_LABEL + code_hash.encode())
            key = int.from_bytes(seed, "big") % (SECP256K1_N - 1) + 1
            key_hex = f"0x{key:064x}"
            account = subprocess.run([cast, "wallet", "address", "--private-key", key_hex],
                                     capture_output=True, text=True).stdout.strip()
            delegate = "0x" + keccak(b"P2.5 delegate " + code_hash.encode())[12:].hex()
            if code not in ("0x", ""):
                rpc(url, "anvil_setCode", [delegate, code])
            rpc(url, "anvil_setCode", [account, "0xef0100" + delegate[2:]])
            sig = subprocess.run([cast, "wallet", "sign", "--no-hash", "--private-key", key_hex, DIGEST],
                                 capture_output=True, text=True).stdout.strip()
            data = calldata(DIGEST, sig)
            gas = B_EXEC + 21_000 + 64 * ((len(data) - 2) // 2)
            call = {"to": account, "data": data, "gas": hex(gas)}
            res = rpc(url, "eth_call", [call, "latest"])
            if "error" in res:
                err = res["error"]
                rdata = err.get("data") if isinstance(err.get("data"), str) else ""
                verdict, detail = "refused", ("revert " + (rdata[:10] if rdata and rdata != "0x" else "(empty)"))
            else:
                ret = res["result"]
                if ret in ("0x", ""):
                    verdict, detail = "shim", "success, empty return data"
                elif len(ret) >= 10 and ret[2:10] == MAGIC and (len(ret) - 2) // 2 >= 32:
                    verdict, detail = "erc1271", "magic value"
                else:
                    verdict, detail = "refused", f"returned {ret[:18]}"
            trace = rpc(url, "debug_traceCall", [call, "latest", {"disableStorage": True, "enableMemory": False,
                                                                  "disableStack": True}])
            logs = (trace.get("result") or {}).get("structLogs") or []
            storage_reads = sum(1 for s in logs if s.get("op") == "SLOAD" and s.get("depth") == 1)
            rows.append({"code_hash": code_hash, "code_bytes": (len(code) - 2) // 2,
                         "accounts": accounts_by_hash.get(code_hash, 0), "verdict": verdict, "detail": detail,
                         "own_storage_reads": storage_reads, "label": "E" if storage_reads else "M",
                         "call_gas": gas})
            print(f"{code_hash[:12]} {verdict:8} {detail[:40]:40} sload={storage_reads} accounts={rows[-1]['accounts']}",
                  flush=True)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    totals = {}
    for r in rows:
        t = totals.setdefault(r["verdict"], {"codes": 0, "accounts": 0, "accounts_M": 0, "accounts_E": 0})
        t["codes"] += 1
        t["accounts"] += r["accounts"]
        t[f"accounts_{r['label']}"] += r["accounts"]
    result = {"meta": {"run": label, "anvil": anvil_version, "hardfork": "osaka", "digest": DIGEST,
                       "b_exec": B_EXEC, "head_block": agg["meta"]["head_block"],
                       "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
              "totals": totals, "rows": rows}
    with open(os.path.join(out, f"h2_matrix_{label}.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)
    print(json.dumps(totals, indent=1))


if __name__ == "__main__":
    main()
