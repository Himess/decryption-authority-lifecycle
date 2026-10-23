#!/usr/bin/env python3
"""Coordinator's analysis of a Level 1 (Profile H) real-connector run.

usage: analyze_level1.py <run_dir>

Reads only test.log and host_rpc.jsonl. For every request: its Profile H setting, outcome, attempts, error code and the
exact host-chain RPC sequence the connector sent (method, function, decoded arguments, answer). Then checks:
  - Profile H off: only the ACL views the connector already sends (eth_call isAllowed /
    isHandleDelegatedForUserDecryption / decryptionSignatureInvalidatedBefore); no eth_getCode, no eth_blockNumber,
    no isAccountRetired, no isValidSignature (zero new RPC);
  - Profile H on, H5: isAccountRetired is asked only after a denying view, and a request whose subject answered true
    is final (one attempt, or account_retired over HTTP);
  - Profile H on, H6 (label contains "h6.on"): eth_getCode of the user precedes the ACL views on the legacy path;
  - Profile H on, code-first (label contains ".h2.enforce."): eth_getCode and isValidSignature read at one block.
"""
import collections, json, re, sys

SEL = {
    "82027b6d": ("isAllowed", ["bytes32", "address"]),
    "d09c0dee": ("isHandleDelegatedForUserDecryption", ["address", "address", "address", "bytes32"]),
    "0dff1525": ("decryptionSignatureInvalidatedBefore", ["address"]),
    "b279091e": ("isAccountRetired", ["address"]),
    "1626ba7e": ("isValidSignature", ["bytes32", "bytes"]),
}
OLD_VIEWS = {"isAllowed", "isHandleDelegatedForUserDecryption", "decryptionSignatureInvalidatedBefore"}
ANSI = re.compile(r"\x1b\[[0-9;]*m")
KV = re.compile(r"(\w+)=(\"[^\"]*\"|\S+)")


def kv(text):
    return {k: v.strip('"') for k, v in KV.findall(text)}


run = sys.argv[1]
names, local, reqs = {}, {}, collections.OrderedDict()
markers = []
for line in open(run + "/test.log", errors="replace"):
    l = ANSI.sub("", line.rstrip("\n"))
    m = re.search(r"ACCOUNTS owner=(0x\w{40}) U=(0x\w{40}) V=(0x\w{40}) D=(0x\w{40})", l)
    if m:
        for n, a in zip(["owner", "U", "V", "D"], m.groups()):
            names[a.lower()] = n
    m = re.search(r"LOCAL-KEYS Uk=(0x\w{40}) Vk=(0x\w{40}) Dk=(0x\w{40})", l)
    if m:
        local = {a.lower(): n for n, a in zip(["Uk", "Vk", "Dk"], m.groups())}
    m = re.search(r"LOCAL-KEYS-L1 Kx=(0x\w{40})", l)
    if m:
        local[m.group(1).lower()] = "Kx"
    if " L0-REQUEST " in l:
        d = kv(l.split(" L0-REQUEST ", 1)[1])
        nm = dict(names)
        nm.update(local)
        nm[d["contract"].lower()] = "C"
        nm[d["handle"].lower()] = "h"
        d["names"] = nm
        reqs[d["label"]] = d
    elif " L0-RESULT " in l:
        d = kv(l.split(" L0-RESULT ", 1)[1])
        if d["label"] in reqs:
            reqs[d["label"]]["res"] = d
    elif "L1-LAPSE" in l or "PROFILE-H" in l or "L1-H" in l:
        markers.append(l[l.find("L1-") if "L1-" in l else l.find("PROFILE-H"):][:260])

calls = collections.defaultdict(list)
for line in open(run + "/host_rpc.jsonl"):
    r = json.loads(line)
    label = (r.get("path") or "/").lstrip("/")
    q, resp = r["req"], r["resp"]
    item = {"method": q["method"], "t0": r.get("t0", r["t"])}
    if q["method"] == "eth_call":
        obj = q["params"][0]
        data = (obj.get("input") or obj.get("data") or "")[2:]
        item.update(sel=data[:8], data=data, to=(obj.get("to") or "").lower(), block=q["params"][1] if len(q["params"]) > 1 else None,
                    gas=obj.get("gas"), result=resp.get("result"), error=resp.get("error"), keys=sorted(obj.keys()))
    elif q["method"] == "eth_getCode":
        item.update(addr=q["params"][0].lower(), block=q["params"][1], result=resp.get("result"))
    elif q["method"] == "eth_blockNumber":
        item.update(result=resp.get("result"))
    calls[label].append(item)


def render(c, nm):
    if c["method"] == "eth_blockNumber":
        return "eth_blockNumber -> %s" % c.get("result")
    if c["method"] == "eth_getCode":
        code = c.get("result") or "0x"
        kind = "empty" if code in ("0x", "") else ("7702" if code.lower().startswith("0xef0100") and len(code) == 48 else "regular")
        return "eth_getCode(%s, %s) -> %s" % (nm.get(c["addr"], c["addr"]), c["block"], kind)
    name, types = SEL.get(c["sel"], ("0x" + c["sel"], []))
    words = [c["data"][8 + 64 * i: 8 + 64 * (i + 1)] for i in range(len(types))]
    args = []
    for t, w in zip(types, words):
        if t == "address":
            v = "0x" + w[24:]
            args.append(nm.get(v.lower(), v))
        elif t == "bytes32":
            v = "0x" + w
            args.append(nm.get(v.lower(), "digest" if name == "isValidSignature" else v[:10]))
        else:
            args.append("<%s>" % t)
    res = c.get("result")
    if c.get("error") is not None:
        res = "ERR(%s)" % (c["error"].get("message", "") if isinstance(c["error"], dict) else c["error"])[:60]
    elif isinstance(res, str) and len(res) == 66 and name.startswith("is") and name != "isValidSignature":
        res = bool(int(res, 16))
    elif name == "isValidSignature" and isinstance(res, str):
        res = res[:10]
    extra = " @%s" % c.get("block") if c.get("block") not in (None, "latest") else ""
    return "%s(%s) -> %s%s" % (name, ",".join(args), res, extra)


problems = []
print("run:", run)
for label, d in reqs.items():
    res = d.get("res", {})
    cs = calls.get(label, [])
    ph = d.get("profile_h", "?")
    seq = [render(c, d["names"]) for c in cs]
    print("\n== %s  [profile_h=%s path=%s source=%s] expected=%s observed=%s kms=%s error_counter=%s error_code=%s calls=%d" % (
        label, ph, d.get("path"), d.get("source"), d.get("expected"), res.get("observed"), res.get("kms_mock_hits"),
        res.get("error_counter"), res.get("error_code"), len(cs)))
    for x in seq:
        print("     " + x)
    methods = {c["method"] for c in cs}
    funcs = {SEL.get(c.get("sel", ""), ("?",))[0] for c in cs if c["method"] == "eth_call"}
    if any("from" in c.get("keys", []) for c in cs):
        problems.append("%s: an eth_call carried a from" % label)
    if ph == "off":
        if methods - {"eth_call"} or funcs - OLD_VIEWS:
            problems.append("%s: Profile H off but new RPC kinds %s %s" % (label, sorted(methods), sorted(funcs)))
    else:
        # H5: isAccountRetired only after a denying view, and a true answer makes the denial final.
        saw_false = False
        for c in cs:
            if c["method"] != "eth_call":
                continue
            name = SEL.get(c["sel"], ("?",))[0]
            r = c.get("result")
            val = isinstance(r, str) and len(r) == 66 and int(r, 16) != 0
            if name in ("isAllowed", "isHandleDelegatedForUserDecryption") and isinstance(r, str) and len(r) == 66 and not val:
                saw_false = True
            if name == "isAccountRetired" and not saw_false:
                problems.append("%s: isAccountRetired asked before any denying view" % label)
            if name == "isAccountRetired" and val:
                http = d.get("source") == "http"
                final_ok = (res.get("error_code") == "account_retired") if http else (res.get("error_counter") == "1")
                if res.get("observed") != "Rejected" or not final_ok:
                    problems.append("%s: a subject answered retired but the denial was not final" % label)
        if "h6.on" in label and d.get("source") == "onchain":
            gc = [i for i, c in enumerate(cs) if c["method"] == "eth_getCode"]
            views = [i for i, c in enumerate(cs) if c["method"] == "eth_call"]
            if not gc or (views and gc[0] > views[0]):
                problems.append("%s: H6 code read missing or after the ACL views" % label)
        if ".h2.enforce." in label:
            blocks = {}
            for c in cs:
                if c["method"] in ("eth_getCode",) or (c["method"] == "eth_call" and c.get("sel") == "1626ba7e"):
                    blocks.setdefault(c["method"] + c.get("sel", ""), set()).add(c.get("block"))
            if not cs:
                problems.append("%s: no calls" % label)
    if not res:
        problems.append("%s: no result line" % label)
print("\nmarkers:")
for m in markers:
    print("  ", m)
unattributed = [l for l in calls if l not in reqs]
if unattributed:
    problems.append("calls on labels with no request: %s" % unattributed)
print("\nrequests=%d PROBLEMS: %s" % (len(reqs), problems if problems else "none"))
