"""P2.4: does the local Amsterdam chain apply EIP-8037's reservoir model, in which EIP-7825's 2^24 cap bounds
execution gas only and state gas may come from tx.gas above the cap?

Usage: python -I p24_reservoir_probe.py <anvil> <port> <out.json>

Starts anvil (127.0.0.1, Amsterdam, block gas limit 2,000,000,000, --auto-impersonate) without and with
--enable-tx-gas-limit. Places two small contracts with anvil_setCode (no deployment transaction), each looping n times
for n = the first calldata word:
- "state" writes n new storage slots (keys 1..n, value 1): mostly state gas;
- "exec" only loops (41 gas per iteration): execution gas only.
For each (code, n) it records:
- eth_estimateGas;
- eth_call with gas 2^24 and with gas 40,000,000;
- a transaction with gas 2^24 and one with gas 40,000,000: accepted or not, status, gasUsed.
Under EIP-8037 a 40M transaction is valid, its state gas may exceed 2^24, and its execution gas may not.
No key is used; anvil's stdout is discarded.
"""
import json
import subprocess
import sys
import time
import urllib.request

CAP = 16_777_216
BIG = 40_000_000
# PUSH1 0 CALLDATALOAD PUSH1 0 | loop: JUMPDEST DUP2 DUP2 LT PUSH1 body JUMPI STOP |
# body: JUMPDEST PUSH1 1 DUP2 PUSH1 1 ADD SSTORE PUSH1 1 ADD PUSH1 loop JUMP
CODE = "0x" + "".join([
    "600035", "6000",
    "5b", "81", "81", "10", "600d", "57", "00",
    "5b", "6001", "81", "6001", "01", "55", "6001", "01", "6005", "56",
])
# The same loop without the SSTORE: body is JUMPDEST PUSH1 1 ADD PUSH1 loop JUMP.
CODE_EXEC = "0x" + "".join([
    "600035", "6000",
    "5b", "81", "81", "10", "600d", "57", "00",
    "5b", "6001", "01", "6005", "56",
])
CASES = [("state", CODE, n) for n in (1, 2, 100, 200)] + [("exec", CODE_EXEC, n) for n in (100_000, 500_000)]
TARGET = "0x00000000000000000000000000000000000c0de1"
SENDER = "0x00000000000000000000000000000000000ab0c2"


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def short(res):
    if "error" in res:
        return {"ok": False, "error": str(res["error"].get("message", ""))[:160]}
    return {"ok": True, "result": res["result"] if len(str(res["result"])) < 80 else str(res["result"])[:80]}


def main():
    anvil, port, out = sys.argv[1:4]
    url = f"http://127.0.0.1:{port}"
    result = {"code_state": CODE, "code_exec": CODE_EXEC, "cap": CAP, "big": BIG, "runs": []}
    for cap_check in (False, True):
        args = [anvil, "--host", "127.0.0.1", "--port", str(port), "--hardfork", "amsterdam", "--gas-limit",
                "2000000000", "--auto-impersonate", "--quiet"] + (["--enable-tx-gas-limit"] if cap_check else [])
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    rpc(url, "eth_chainId", [])
                    break
                except Exception:  # noqa: BLE001
                    time.sleep(0.2)
            if not result.get("client"):
                result["client"] = rpc(url, "web3_clientVersion", [])["result"]
            rpc(url, "anvil_setBalance", [SENDER, hex(10**24)])
            for idx, (kind, code, n) in enumerate(CASES):
                # Fresh storage for every measurement: each call and transaction runs at its own new address.
                target = "0x" + format(int(TARGET, 16) + (idx + 1) * 16 + (8 if cap_check else 0), "040x")
                rpc(url, "anvil_setCode", [target, code])
                data = "0x" + format(n, "064x")
                row = {"cap_check": cap_check, "code": kind, "n": n}
                row["estimate"] = short(rpc(url, "eth_estimateGas", [{"from": SENDER, "to": target, "data": data}]))
                row["call_cap"] = short(rpc(url, "eth_call", [{"from": SENDER, "to": target, "data": data, "gas": hex(CAP)}, "latest"]))
                row["call_big"] = short(rpc(url, "eth_call", [{"from": SENDER, "to": target, "data": data, "gas": hex(BIG)}, "latest"]))
                for label, gas in (("tx_cap", CAP), ("tx_big", BIG)):
                    t = "0x" + format(int(target, 16) + (1 if label == "tx_big" else 2), "040x")
                    rpc(url, "anvil_setCode", [t, code])
                    res = rpc(url, "eth_sendTransaction", [{"from": SENDER, "to": t, "data": data, "gas": hex(gas)}])
                    if "error" in res:
                        row[label] = {"accepted": False, "error": str(res["error"].get("message", ""))[:160]}
                        continue
                    rcpt = None
                    for _ in range(200):
                        rcpt = rpc(url, "eth_getTransactionReceipt", [res["result"]]).get("result")
                        if rcpt:
                            break
                        time.sleep(0.05)
                    row[label] = {"accepted": True, "status": rcpt["status"] if rcpt else None,
                                  "gas_used": int(rcpt["gasUsed"], 16) if rcpt else None}
                result["runs"].append(row)
                print(json.dumps(row), flush=True)
        finally:
            proc.terminate()
            proc.wait(timeout=10)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)


if __name__ == "__main__":
    main()
