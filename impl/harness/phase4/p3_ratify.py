"""P3: operator-ratified registry upgrades with on-chain ML-DSA-44 signatures, measured as receipts on a local anvil.

Usage: python -I p3_ratify.py <anvil> <hardfork> <port> <project dir> <verifier checkout> <out.json>

- <project dir> is impl/p3-operator-ratification, built with `forge build` (artifacts in out/).
- <verifier checkout> is fireblocks-labs/evm-ml-dsa-verifier at cca262b5. Its prepare/prepare.py turns a public key
  into the verifier's blob, and impl/harness/phase4/p11_mldsa_tool.py signs with its dilithium-py (both unaudited).

The 13 operator keys are test keys derived from public labels (sha256 of "fhe-authority-lifecycle/P3/operator/<i>");
the seeds go to the signer through its environment and are never printed. anvil runs on 127.0.0.1 with
--auto-impersonate and a 2e9 block gas limit, and no transaction gas cap unless a step says so.

Steps: the Keccak helper and the 13 key blobs are placed with anvil_setCode; the verifier, a mock registry, two
implementations and the upgrader (threshold 9 of 13, delay 7 days) are deployed. Then:
1. the cost of one verify() call (eth_estimateGas of a direct call);
2. a proposal, the delay, and execute() with 9 signatures, then a second proposal executed with 13; receipts;
3. negatives, each expected to revert: execution before the delay, 8 signatures, a corrupted signature, signers out
   of order, and replaying the executed proposal's signatures after a re-proposal;
4. execute() with 9 and with 13 signatures sent with a gas limit of exactly 2^24.
"""
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.request

from Crypto.Hash import keccak
from eth_abi import encode

CAP = 2**24
HERE = os.path.dirname(os.path.abspath(__file__))


def k256(b):
    h = keccak.new(digest_bits=256)
    h.update(b)
    return h.digest()


def sel(sig):
    return k256(sig.encode())[:4]


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        res = json.loads(r.read())
    return res


def call_ok(url, method, params):
    res = rpc(url, method, params)
    if "error" in res:
        raise RuntimeError(f"{method}: {res['error']}")
    return res["result"]


def artifact(project, name):
    j = json.load(open(os.path.join(project, "out", f"{name}.sol", f"{name}.json"), encoding="utf-8"))
    return j["bytecode"]["object"]


def artifact_in(project, file, name):
    j = json.load(open(os.path.join(project, "out", file, f"{name}.json"), encoding="utf-8"))
    return j["bytecode"]["object"]


def main():
    anvil, fork, port, project, checkout, out_path = sys.argv[1:7]
    url = f"http://127.0.0.1:{port}"
    signer_tool = os.path.join(HERE, "p11_mldsa_tool.py")
    keys = []
    for i in range(13):
        seed = hashlib.sha256(f"fhe-authority-lifecycle/P3/operator/{i}".encode()).hexdigest()
        env = dict(os.environ, MLDSA_SEED_HEX=seed)
        pk = json.loads(subprocess.run([sys.executable, "-I", signer_tool, "--repo", checkout, "pubkey", "--scheme",
                                        "ML-DSA-44"], env=env, capture_output=True, text=True, check=True).stdout)["pk"]
        blob = subprocess.run([sys.executable, "-I", os.path.join(checkout, "prepare", "prepare.py")], input=pk,
                              capture_output=True, text=True, check=True).stdout.strip()
        keys.append({"seed": seed, "pk": pk, "blob": blob})

    def sign(i, msg_hex):
        env = dict(os.environ, MLDSA_SEED_HEX=keys[i]["seed"])
        r = json.loads(subprocess.run([sys.executable, "-I", signer_tool, "--repo", checkout, "sign", "--scheme",
                                       "ML-DSA-44", "--msg", msg_hex], env=env, capture_output=True, text=True,
                                      check=True).stdout)
        assert r["self_verified"], "the signer's own verification failed"
        return bytes.fromhex(r["sig"])

    proc = subprocess.Popen([anvil, "--host", "127.0.0.1", "--port", str(port), "--hardfork", fork, "--gas-limit",
                             "2000000000", "--auto-impersonate", "--quiet"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = {"hardfork": fork, "threshold": 9, "operators": 13, "steps": {}}
    try:
        for _ in range(100):
            try:
                rpc(url, "eth_chainId", [])
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.2)
        out["client"] = call_ok(url, "web3_clientVersion", [])
        deployer = "0x00000000000000000000000000000000000d0e01"
        proposer = "0x00000000000000000000000000000000000d0e02"
        anyone = "0x00000000000000000000000000000000000d0e03"
        for a in (deployer, proposer, anyone):
            call_ok(url, "anvil_setBalance", [a, hex(10**24)])

        def send(frm, to, data, gas=40_000_000):
            tx = {"from": frm, "data": "0x" + data.hex(), "gas": hex(gas)}
            if to:
                tx["to"] = to
            res = rpc(url, "eth_sendTransaction", [tx])
            if "error" in res:
                return {"accepted": False, "error": str(res["error"].get("message", ""))[:200]}
            r = None
            for _ in range(600):
                r = rpc(url, "eth_getTransactionReceipt", [res["result"]]).get("result")
                if r:
                    break
                time.sleep(0.05)
            return {"accepted": True, "status": int(r["status"], 16), "gasUsed": int(r["gasUsed"], 16),
                    "contractAddress": r.get("contractAddress"), "calldataBytes": len(data)}

        def deploy(code_hex, args=b""):
            r = send(deployer, None, bytes.fromhex(code_hex[2:]) + args)
            assert r["status"] == 1, r
            return r["contractAddress"]

        def view(to, data):
            return bytes.fromhex(call_ok(url, "eth_call", [{"to": to, "data": "0x" + data.hex()}, "latest"])[2:])

        helper_runtime = "0x" + open(os.path.join(project, "vendor", "evm-ml-dsa-verifier-cca262b5", "helpers",
                                                  "f1600_170.hex"), encoding="utf-8").read().strip()
        helper = "0x00000000000000000000000000000000000f1600"
        call_ok(url, "anvil_setCode", [helper, helper_runtime])
        blobs = []
        for i, k in enumerate(keys):
            addr = "0x" + format(0xb10b00 + i, "040x")
            call_ok(url, "anvil_setCode", [addr, "0x" + k["blob"]])
            blobs.append(addr)
        verifier = deploy(artifact_in(project, "MLDSA44Verifier.sol", "MLDSA44Verifier"), encode(["address"], [helper]))
        v1 = deploy(artifact_in(project, "MockRegistry.sol", "RegistryImplementationV1"))
        v2 = deploy(artifact_in(project, "MockRegistry.sol", "RegistryImplementationV2"))
        v3 = deploy(artifact_in(project, "MockRegistry.sol", "RegistryImplementationV1"))
        registry = deploy(artifact(project, "MockRegistry"), encode(["address"], [v1]))
        delay = 7 * 86_400
        upgrader = deploy(artifact(project, "OperatorRatifiedUpgrader"),
                          encode(["address", "address", "address", "address[]", "uint256", "uint256"],
                                 [verifier, registry, proposer, blobs, 9, delay]))
        r = send(deployer, registry, sel("transferOwnership(address)") + encode(["address"], [upgrader]))
        assert r["status"] == 1

        def proposal_id(impl):
            return view(upgrader, sel("proposalId(address,bytes)") + encode(["address", "bytes"], [impl, b""]))

        def execute_data(impl, signers, sigs):
            return sel("execute(address,bytes,uint256[],bytes[])") + encode(
                ["address", "bytes", "uint256[]", "bytes[]"], [impl, b"", signers, sigs])

        def warp():
            call_ok(url, "evm_increaseTime", [delay])
            call_ok(url, "evm_mine", [])

        steps = out["steps"]
        # 1. One verify() call.
        msg = b"\x11" * 32
        sig0 = sign(0, "0x" + msg.hex())
        vdata = sel("verify(address,bytes,bytes)") + encode(["address", "bytes", "bytes"], [blobs[0], msg, sig0])
        steps["verify_true"] = view(verifier, vdata)[-1] == 1
        steps["verify_estimateGas"] = int(call_ok(url, "eth_estimateGas", [{"from": anyone, "to": verifier,
                                                                               "data": "0x" + vdata.hex()}]), 16)
        steps["verify_wrong_message_false"] = view(verifier, sel("verify(address,bytes,bytes)") + encode(
            ["address", "bytes", "bytes"], [blobs[0], b"\x12" * 32, sig0]))[-1] == 0
        # 2. Propose, wait, execute with 9.
        steps["propose_v2"] = send(proposer, upgrader, sel("propose(address,bytes)") + encode(["address", "bytes"], [v2, b""]))
        pid = proposal_id(v2)
        sigs = [sign(i, "0x" + pid.hex()) for i in range(13)]
        steps["execute_before_delay_9"] = send(anyone, upgrader, execute_data(v2, list(range(9)), sigs[:9]))
        warp()
        steps["execute_8_signatures"] = send(anyone, upgrader, execute_data(v2, list(range(8)), sigs[:8]))
        bad = list(sigs[:9])
        bad[4] = bad[4][:100] + bytes([bad[4][100] ^ 1]) + bad[4][101:]
        steps["execute_9_one_corrupted"] = send(anyone, upgrader, execute_data(v2, list(range(9)), bad))
        steps["execute_9_out_of_order"] = send(anyone, upgrader, execute_data(v2, [1, 0, 2, 3, 4, 5, 6, 7, 8],
                                                                              [sigs[1], sigs[0]] + sigs[2:9]))
        d9 = execute_data(v2, list(range(9)), sigs[:9])
        steps["execute_9_estimateGas"] = int(call_ok(url, "eth_estimateGas", [{"from": anyone, "to": upgrader,
                                                                                  "data": "0x" + d9.hex()}]), 16)
        steps["execute_9"] = send(anyone, upgrader, d9)
        steps["registry_after_9"] = "0x" + view(registry, sel("implementation()"))[-20:].hex()
        steps["registry_expected_v2"] = v2.lower()
        # 3. Replay: re-propose the same upgrade, then try the old signatures (the nonce changed the id).
        steps["repropose_v2"] = send(proposer, upgrader, sel("propose(address,bytes)") + encode(["address", "bytes"], [v2, b""]))
        warp()
        steps["replay_old_9"] = send(anyone, upgrader, d9)
        # 4. Execute with 13: a new proposal to v3.
        steps["propose_v3"] = send(proposer, upgrader, sel("propose(address,bytes)") + encode(["address", "bytes"], [v3, b""]))
        pid3 = proposal_id(v3)
        sigs3 = [sign(i, "0x" + pid3.hex()) for i in range(13)]
        warp()
        d13 = execute_data(v3, list(range(13)), sigs3)
        steps["execute_13_estimateGas"] = int(call_ok(url, "eth_estimateGas", [{"from": anyone, "to": upgrader,
                                                                                   "data": "0x" + d13.hex()}]), 16)
        snap = call_ok(url, "evm_snapshot", [])
        steps["execute_13_at_2^24"] = send(anyone, upgrader, d13, gas=CAP)
        call_ok(url, "evm_revert", [snap])
        snap = call_ok(url, "evm_snapshot", [])
        d9b = execute_data(v3, list(range(9)), sigs3[:9])
        steps["execute_9_at_2^24"] = send(anyone, upgrader, d9b, gas=CAP)
        call_ok(url, "evm_revert", [snap])
        steps["execute_13"] = send(anyone, upgrader, d13)
        steps["registry_after_13"] = "0x" + view(registry, sel("implementation()"))[-20:].hex()
        steps["registry_expected_v3"] = v3.lower()
        out["calldata_bytes"] = {"execute_9": len(d9), "execute_13": len(d13), "signature": len(sigs[0])}
    finally:
        proc.terminate()
        proc.wait(timeout=10)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1)
    s = out["steps"]
    print(json.dumps({k: (v if not isinstance(v, dict) else {kk: vv for kk, vv in v.items() if kk != "contractAddress"})
                      for k, v in s.items()}, indent=0))


if __name__ == "__main__":
    main()
