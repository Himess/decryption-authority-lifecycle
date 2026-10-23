#!/usr/bin/env python3
"""Decode the JSON-RPC recorder log of a real-chain run into the ACL view calls made by the connector.

usage: decode_host_rpc.py <host_rpc.jsonl> <test.log>
Selectors were computed with `cast sig` (Foundry 1.3.5). Every eth_call is attributed to a scenario through the ACL
address the scenario deployed (the `SCENARIO ...: acl=0x...` line of the test log).
"""
import json, re, sys
from collections import OrderedDict

SIGS = {
    "82027b6d": ("isAllowed", ["bytes32", "address"]),
    "c0d02943": ("isAllowedForDecryption", ["bytes32"]),
    "d09c0dee": ("isHandleDelegatedForUserDecryption", ["address", "address", "address", "bytes32"]),
    "0dff1525": ("decryptionSignatureInvalidatedBefore", ["address"]),
    "1626ba7e": ("isValidSignature", ["bytes32", "bytes"]),
    "1e2f86ba": ("persistAllowed", ["bytes32", "address"]),
    "3f462dbe": ("getUserDecryptionDelegationExpirationDate", ["address", "address", "address"]),
    "9edc01ec": ("isAccountDenied", ["address"]),
    "130743b1": ("isDelegatedForUserDecryption", ["address", "address", "address"]),
}

rpc_path, test_log = sys.argv[1], sys.argv[2]
scen = OrderedDict()   # acl address (lower) -> scenario name
names = {}             # address (lower) -> label
for line in open(test_log, errors="replace"):
    m = re.search(r"SCENARIO (\w+): acl=(0x[0-9a-fA-F]{40}) handle=(0x[0-9a-fA-F]{64}) user=(0x[0-9a-fA-F]{40}) "
                  r"delegator=(Some\((0x[0-9a-fA-F]{40})\)|None) contract=(0x[0-9a-fA-F]{40})", line)
    if m:
        scen[m.group(2).lower()] = m.group(1)
        names[m.group(7).lower()] = "C"
        names[m.group(3).lower()] = "h"
    m = re.search(r"ACCOUNTS owner=(0x\w{40}) U=(0x\w{40}) V=(0x\w{40}) D=(0x\w{40})", line)
    if m:
        for label, a in zip(["owner", "U", "V", "D"], m.groups()):
            names[a.lower()] = label
    m = re.search(r"LOCAL-KEYS Uk=(0x\w{40}) Vk=(0x\w{40}) Dk=(0x\w{40})", line)
    if m:
        for label, a in zip(["Uk", "Vk", "Dk"], m.groups()):
            names[a.lower()] = label

def label(v):
    return names.get(v.lower(), v)

def decode(types, data):
    words = [data[i:i + 64] for i in range(0, len(data), 64)]
    out = []
    for i, t in enumerate(types):
        w = words[i] if i < len(words) else ""
        if t == "address":
            out.append(label("0x" + w[24:]))
        elif t == "bytes32":
            out.append(label("0x" + w))
        else:
            out.append("<" + t + ">")
    return out

per = OrderedDict((s, []) for s in scen.values())
other = []
for line in open(rpc_path):
    rec = json.loads(line)
    reqs = rec["req"] if isinstance(rec["req"], list) else [rec["req"]]
    resps = rec["resp"] if isinstance(rec["resp"], list) else [rec["resp"]]
    for req, resp in zip(reqs, resps):
        if req.get("method") != "eth_call":
            other.append(req.get("method"))
            continue
        tx = req["params"][0]
        data = (tx.get("input") or tx.get("data") or "")[2:]
        to = (tx.get("to") or "").lower()
        sel = data[:8]
        name, types = SIGS.get(sel, ("0x" + sel, []))
        args = decode(types, data[8:])
        res = resp.get("result", resp.get("error"))
        if isinstance(res, str) and res.startswith("0x") and len(res) == 66:
            res = int(res, 16)
            if name.startswith("is"):
                res = bool(res)
        block = req["params"][1] if len(req["params"]) > 1 else "(none)"
        entry = f"{name}({', '.join(args)}) -> {res}   [to={label(to)} block={block}]"
        per.setdefault(scen.get(to, "unattributed:" + to), []).append(entry)

for s, calls in per.items():
    print(f"== {s}: {len(calls)} eth_call(s) to the ACL")
    for c in calls:
        print("   ", c)
print("== non-eth_call methods seen on the connector's host-chain endpoint:", sorted(set(other)) or "none")
