#!/usr/bin/env python3
"""Coordinator's independent check of a Level 0 real-connector run (written separately from decode_level0.py).

usage: indep_check.py <run_dir>

Reads only the raw inputs: test.log (harness lines + the unmodified connector's own logs) and host_rpc.jsonl (every
JSON-RPC request the connector sent to its host-chain endpoint, as relayed by the recorder). For every request it
lists the ACL views the connector actually asked, with their answers, and checks:
  - forwarded requests: every view answered true; the KMS mock was hit;
  - rejected requests: the KMS mock was never hit; the expected view answered false on every attempt
    (count of false answers == error_counter for on-chain requests); no other view answered false;
  - every call is eth_call to the request's own ACL proxy, block 'latest', with no 'from' key;
  - no other JSON-RPC method and no Level 0 selector ever reached the connector's endpoint.
"""
import collections, json, re, sys

SEL = {
    "82027b6d": ("isAllowed", ["bytes32", "address"]),
    "d09c0dee": ("isHandleDelegatedForUserDecryption", ["address", "address", "address", "bytes32"]),
    "0dff1525": ("decryptionSignatureInvalidatedBefore", ["address"]),
    "1626ba7e": ("isValidSignature", ["bytes32", "bytes"]),
}
LEVEL0 = {"e7142996", "b279091e", "01ffc9a7", "c89c7ccd"}
ANSI = re.compile(r"\x1b\[[0-9;]*m")
KV = re.compile(r"(\w+)=(\"[^\"]*\"|\S+)")


def kv(s):
    return {k: v.strip('"') for k, v in KV.findall(s)}


run = sys.argv[1]
log = [ANSI.sub("", l.rstrip("\n")) for l in open(run + "/test.log", errors="replace")]
glob_names = {}
local = {}
reqs = collections.OrderedDict()
deploys, retires = [], []
for l in log:
    m = re.search(r"ACCOUNTS owner=(0x\w{40}) U=(0x\w{40}) V=(0x\w{40}) D=(0x\w{40})", l)
    if m:
        for n, a in zip(["owner", "U", "V", "D"], m.groups()):
            glob_names[a.lower()] = n
    m = re.search(r"ACCOUNTS owner=0x\w{40} U=0x\w{40} V=0x\w{40} D=0x\w{40} S=(0x\w{40})", l)
    if m:
        glob_names[m.group(1).lower()] = "S"
    m = re.search(r"LOCAL-KEYS Uk=(0x\w{40}) Vk=(0x\w{40}) Dk=(0x\w{40})", l)
    if m:
        local = {a.lower(): n for n, a in zip(["Uk", "Vk", "Dk"], m.groups())}
    m = re.search(r"LOCAL-KEYS-L2 Sk=(0x\w{40})", l)
    if m:
        local[m.group(1).lower()] = "Sk"
    if " L0-REQUEST " in l:
        d = kv(l.split(" L0-REQUEST ", 1)[1])
        names = dict(glob_names)
        names.update(local)
        names[d["contract"].lower()] = "C"
        names[d["handle"].lower()] = "h"
        d["names"] = names
        reqs[d["label"]] = d
    elif " L0-RESULT " in l:
        d = kv(l.split(" L0-RESULT ", 1)[1])
        reqs[d["label"]]["res"] = d
    elif " ACL-DEPLOY " in l:
        deploys.append(kv(l.split(" ACL-DEPLOY ", 1)[1]))
    elif " L0-RETIRE " in l:
        retires.append(kv(l.split(" L0-RETIRE ", 1)[1]))

calls = collections.defaultdict(list)
methods = collections.Counter()
shapes = collections.Counter()
level0_seen = 0
records = 0
for line in open(run + "/host_rpc.jsonl"):
    rec = json.loads(line)
    records += 1
    rq = rec["req"] if isinstance(rec["req"], list) else [rec["req"]]
    rs = rec["resp"] if isinstance(rec["resp"], list) else [rec["resp"]]
    for q, r in zip(rq, rs):
        methods[q.get("method")] += 1
        if q.get("method") != "eth_call":
            continue
        obj = q["params"][0]
        block = q["params"][1] if len(q["params"]) > 1 else None
        shapes[(tuple(sorted(obj.keys())), block)] += 1
        data = (obj.get("input") or obj.get("data") or "")[2:]
        sel = data[:8]
        if sel in LEVEL0:
            level0_seen += 1
        label = rec["path"].lstrip("/")
        calls[label].append({"sel": sel, "data": data, "to": obj.get("to", "").lower(), "from": obj.get("from"),
                             "block": block, "result": r.get("result"), "error": r.get("error")})


def render(c, names):
    name, types = SEL.get(c["sel"], ("0x" + c["sel"], []))
    words = [c["data"][8 + 64 * i: 8 + 64 * (i + 1)] for i in range(len(types))]
    args = []
    for t, w in zip(types, words):
        v = "0x" + (w[24:] if t == "address" else w)
        args.append(names.get(v.lower(), v[:10] + ".." if t != "address" else v))
    res = c["result"]
    if isinstance(res, str) and len(res) == 66:
        iv = int(res, 16)
        res = bool(iv) if name.startswith("is") else iv
    elif c["error"] is not None:
        res = "ERROR:" + json.dumps(c["error"])[:80]
    return "%s(%s)" % (name, ",".join(args)), res


problems = []
print("run:", run)
print("records=%d methods=%s level0_selectors_seen=%d" % (records, dict(methods), level0_seen))
print("eth_call shapes (keys, block):", dict(shapes))
for k in shapes:
    if "from" in k[0]:
        problems.append("an eth_call carried a 'from' key: %s" % (k,))
    if k[1] != "latest":
        problems.append("an eth_call used block %s" % (k[1],))
if set(methods) - {"eth_call"}:
    problems.append("non-eth_call methods: %s" % dict(methods))
if level0_seen:
    problems.append("Level 0 selectors reached the connector endpoint")
for d in deploys:
    print("deploy kind=%s version=%s matches_reference=%s proxy=%s" % (
        d.get("kind"), d.get("version"), d.get("runtime_matches_reference"), d.get("proxy")))
    if d.get("runtime_matches_reference") != "true":
        problems.append("ACL deploy without reference match: %s" % d)
for r in retires:
    print("retire case=%s role=%s event=%s isAccountRetired=%s gas_used=%s" % (
        r.get("case"), r.get("role"), r.get("account_retired_event"), r.get("isAccountRetired"), r.get("gas_used")))
    if r.get("account_retired_event") != "true" or r.get("isAccountRetired") != "true":
        problems.append("ineffective retirement: %s" % r)

summary = collections.Counter()
for label, d in reqs.items():
    res = d.get("res", {})
    cs = calls.get(label, [])
    rendered = [render(c, d["names"]) for c in cs]
    tally = collections.Counter("%s=%s" % x for x in rendered)
    wrong_to = sum(1 for c in cs if c["to"] != d["acl"].lower())
    exp, obs = d["expected"], res.get("observed")
    kms = int(res.get("kms_mock_hits", -1))
    ec = res.get("error_counter")
    false_views = collections.Counter(v for v, r in rendered if r is False)
    ok = obs == exp and wrong_to == 0
    want = d.get("expect_false", "-")
    if exp == "Forwarded":
        ok = ok and kms >= 2 and not false_views
    else:
        ok = ok and kms == 0 and set(false_views) == {want}
        if d.get("source", "onchain") == "onchain":
            ok = ok and str(false_views[want]) == ec
        else:
            ok = ok and false_views[want] >= 1
    summary["ok" if ok else "FAIL"] += 1
    if not ok:
        problems.append("request %s failed the check" % label)
    if not label.startswith("lat."):
        print("%s %-52s %-5s %-9s obs=%-9s kms=%-2s err_ctr=%-3s calls=%-3d %s" % (
            "OK  " if ok else "FAIL", label, d.get("path"), exp, obs, kms, ec, len(cs),
            "; ".join("%s x%d" % (k, n) for k, n in sorted(tally.items()))))
unattributed = [l for l in calls if l not in reqs]
if unattributed:
    problems.append("calls on labels with no request: %s" % unattributed)
lat = collections.defaultdict(collections.Counter)
for label, d in reqs.items():
    if label.startswith("lat."):
        p = label.split(".")
        lat[(p[1], p[2], p[3])]["ok"] += 1
print("latency-loop requests checked:", sum(c["ok"] for c in lat.values()), "groups:", len(lat))
print("requests: %s" % dict(summary))
print("PROBLEMS: %s" % (problems if problems else "none"))
