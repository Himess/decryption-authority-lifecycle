"""P2.4: how the EIP-7825 transaction gas cap (2^24) meets Amsterdam's state-creation pricing, on a local anvil.

Usage: python -I p24_cap_probe.py <anvil> <ACL artifact json> <hardfork> <port> <out.json>

Starts anvil (127.0.0.1, --auto-impersonate, block gas limit 2,000,000,000) twice: without and with
--enable-tx-gas-limit. Each time it deploys the ACL implementation from the artifact with a gas limit of 2^24 and with
a gas limit of 30,000,000, and records whether the transaction is accepted, its status and its gasUsed. No key is
used; anvil's stdout is discarded.
"""
import json
import subprocess
import sys
import time
import urllib.request

CAP = 16_777_216


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def main():
    anvil, artifact, fork, port, out = sys.argv[1:6]
    url = f"http://127.0.0.1:{port}"
    code = json.load(open(artifact, encoding="utf-8"))["bytecode"]["object"]
    sender = "0x00000000000000000000000000000000000ab0c1"
    result = {"hardfork": fork, "code_bytes": (len(code) - 2) // 2, "cap": CAP, "runs": []}
    for cap_check in (False, True):
        args = [anvil, "--host", "127.0.0.1", "--port", str(port), "--hardfork", fork, "--gas-limit", "2000000000",
                "--auto-impersonate", "--quiet"] + (["--enable-tx-gas-limit"] if cap_check else [])
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    rpc(url, "eth_chainId", [])
                    break
                except Exception:  # noqa: BLE001
                    time.sleep(0.2)
            rpc(url, "anvil_setBalance", [sender, hex(10**24)])
            for gas in (CAP, 30_000_000):
                res = rpc(url, "eth_sendTransaction", [{"from": sender, "data": code, "gas": hex(gas)}])
                row = {"cap_check": cap_check, "gas_limit": gas}
                if "error" in res:
                    row["accepted"] = False
                    row["error"] = res["error"].get("message", "")[:160]
                else:
                    rcpt = None
                    for _ in range(200):
                        rcpt = rpc(url, "eth_getTransactionReceipt", [res["result"]]).get("result")
                        if rcpt:
                            break
                        time.sleep(0.05)
                    row["accepted"] = True
                    row["status"] = rcpt["status"] if rcpt else None
                    row["gas_used"] = int(rcpt["gasUsed"], 16) if rcpt else None
                result["runs"].append(row)
                print(row, flush=True)
        finally:
            proc.terminate()
            proc.wait(timeout=10)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)


if __name__ == "__main__":
    main()
