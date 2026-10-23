#!/usr/bin/env python3
"""Decode a real-connector run (Level 0 run, or a baseline run of acl_real_chain.rs).

usage: decode_level0.py <run_dir> [baseline host_rpc.jsonl ...]

Inputs in <run_dir>: test.log (harness + unmodified connector logs) and host_rpc.jsonl (every JSON-RPC call the
connector sent to its host-chain endpoint, through the recorder). Level 0 runs tag every call with the request
label (URL path); baseline runs are attributed by ACL address, as decode_host_rpc.py does.

Writes into <run_dir>: requests.tsv, acl_calls.txt, latency.txt, rpc_kinds.txt, verdict.txt; prints a summary.
Selectors were computed with `cast sig` (Foundry 1.8.5) and match the ACL artifacts' methodIdentifiers.
"""
import json, os, re, statistics, sys
from collections import OrderedDict, defaultdict
from datetime import datetime

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
    # Level 0 additions: must never appear on the connector's endpoint (zero new RPCs).
    "e7142996": ("retireAccount", []),
    "b279091e": ("isAccountRetired", ["address"]),
    "01ffc9a7": ("supportsInterface", ["bytes4"]),
    "c89c7ccd": ("retirementStorageLocation", []),
}
LEVEL0_SELECTORS = {"e7142996", "b279091e", "01ffc9a7", "c89c7ccd"}
ANSI = re.compile(r"\x1b\[[0-9;]*m")
LINE = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+)Z\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+(.*)$")
SPAN_ID = re.compile(r"handle_event\{event=\w+ #(0x[0-9a-fA-F]+|\d+)\}")
KV = re.compile(r"(\w+)=(\"[^\"]*\"|\S+)")


def ts(s):
    return datetime.fromisoformat(s + "+00:00").timestamp()


def kv(text):
    return {k: v.strip('"') for k, v in KV.findall(text)}


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p / 100.0
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def stats(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return "n=0"
    return "n=%d median=%.2f p10=%.2f p90=%.2f min=%.2f max=%.2f" % (
        len(xs), statistics.median(xs), pct(xs, 10), pct(xs, 90), min(xs), max(xs))


class Run:
    def __init__(self, run_dir):
        self.dir = run_dir
        self.names = {}          # address/handle (lower) -> label
        self.acls = set()        # ACL proxy addresses (lower)
        self.requests = OrderedDict()   # label -> info
        self.by_id = {}          # decryption id (int) -> label
        self.events = defaultdict(list)  # label -> [(t, kind, msg)]
        self.calls = defaultdict(list)   # label -> [call]
        self.retirements = []
        self.deploys = []
        self.mode = "level0"
        self.parse_log()
        self.parse_rpc()

    # ------------------------------------------------------------------ test.log
    def parse_log(self):
        lines = [ANSI.sub("", l.rstrip("\n")) for l in open(os.path.join(self.dir, "test.log"), errors="replace")]
        has_l0 = any("L0-REQUEST " in l for l in lines)
        self.mode = "level0" if has_l0 else "baseline"
        for l in lines:
            m = re.search(r"ACCOUNTS owner=(0x\w{40}) U=(0x\w{40}) V=(0x\w{40}) D=(0x\w{40})", l)
            if m:
                for label, a in zip(["owner", "U", "V", "D"], m.groups()):
                    self.names[a.lower()] = label
            m = re.search(r"ACCOUNTS owner=0x\w{40} U=0x\w{40} V=0x\w{40} D=0x\w{40} S=(0x\w{40})", l)
            if m:
                self.names[m.group(1).lower()] = "S"
            m = re.search(r"LOCAL-KEYS-L2 Sk=(0x\w{40})", l)
            if m:
                self.names[m.group(1).lower()] = "Sk"
            m = re.search(r"LOCAL-KEYS Uk=(0x\w{40}) Vk=(0x\w{40}) Dk=(0x\w{40})", l)
            if m:
                for label, a in zip(["Uk", "Vk", "Dk"], m.groups()):
                    self.names[a.lower()] = label
            if "L0-REQUEST " in l:
                d = kv(l.split("L0-REQUEST ", 1)[1])
                d["t_logged"] = ts(LINE.match(l).group(1))
                self.requests[d["label"]] = d
                self.by_id[int(d["decryption_id"])] = d["label"]
                self.names[d["contract"].lower()] = "C"
                self.names[d["handle"].lower()] = "h"
                self.acls.add(d["acl"].lower())
            elif "L0-RESULT " in l:
                d = kv(l.split("L0-RESULT ", 1)[1])
                if d["label"] in self.requests:
                    self.requests[d["label"]]["result"] = d
            elif "L0-RETIRE " in l:
                self.retirements.append(kv(l.split("L0-RETIRE ", 1)[1]))
            elif "ACL-DEPLOY " in l:
                self.deploys.append(kv(l.split("ACL-DEPLOY ", 1)[1]))
            elif not has_l0:
                m = re.search(r"SCENARIO (\w+): acl=(0x[0-9a-fA-F]{40}) handle=(0x[0-9a-fA-F]{64}) user=(0x[0-9a-fA-F]{40}) "
                              r"delegator=(Some\((0x[0-9a-fA-F]{40})\)|None) contract=(0x[0-9a-fA-F]{40}) decryption_id=(\d+)", l)
                if m:
                    label = m.group(1)
                    self.requests[label] = {"label": label, "acl": m.group(2).lower(), "path": "delegated" if m.group(6) else "direct",
                                            "expected": "?", "expect_false": "-", "decryption_id": m.group(8)}
                    self.by_id[int(m.group(8))] = label
                    self.names[m.group(7).lower()] = "C"
                    self.names[m.group(3).lower()] = "h"
                    self.acls.add(m.group(2).lower())
                m = re.search(r"RESULT scenario=(\w+) .*expected=(\w+) observed=(\w+) kms_mock_hits=(\d+) s3_mock_hits=(\d+)", l)
                if m and m.group(1) in self.requests:
                    self.requests[m.group(1)]["expected"] = m.group(2)
                    self.requests[m.group(1)]["result"] = {"observed": m.group(3), "kms_mock_hits": m.group(4), "s3_mock_hits": m.group(5)}
        # connector events, per request
        for l in lines:
            m = LINE.match(l)
            if not m:
                continue
            sid = SPAN_ID.search(m.group(3))
            if not sid:
                continue
            x = sid.group(1)
            did = int(x, 16) if x.startswith("0x") else int(x)
            label = self.by_id.get(did)
            if label is None:
                continue
            t, level, msg = ts(m.group(1)), m.group(2), m.group(3)
            kind = None
            if "Starting to process" in msg:
                kind = "start"
            elif "Starting ACL check for" in msg or "Starting RFC016 check for" in msg:
                kind = "check_start"
            elif "ACL check passed for" in msg:
                kind = "check_pass"
            elif level == "ERROR" and "Processing failed" in msg:
                kind = "fail"
            elif "Event successfully processed!" in msg:
                kind = "success"
            elif "Successfully stored response in DB!" in msg:
                kind = "stored"
            elif "Successfully updated event in DB!" in msg:
                kind = "db_updated"
            elif level == "ERROR":
                kind = "error"
            if kind:
                self.events[label].append((t, kind, msg))

    # ------------------------------------------------------------------ host_rpc.jsonl
    def label_of(self, v):
        return self.names.get(v.lower(), v)

    def decode_args(self, types, data):
        words = [data[i:i + 64] for i in range(0, len(data), 64)]
        out = []
        for i, t in enumerate(types):
            w = words[i] if i < len(words) else ""
            if t == "address":
                out.append(self.label_of("0x" + w[24:]))
            elif t == "bytes32":
                out.append(self.label_of("0x" + w))
            elif t == "bytes4":
                out.append("0x" + w[:8])
            else:
                out.append("<" + t + ">")
        return out

    def parse_rpc(self):
        self.other_methods = []
        self.kinds = set()
        self.to_outside_acl = 0
        path = os.path.join(self.dir, "host_rpc.jsonl")
        self.total_records = 0
        for line in open(path):
            rec = json.loads(line)
            self.total_records += 1
            reqs = rec["req"] if isinstance(rec["req"], list) else [rec["req"]]
            resps = rec["resp"] if isinstance(rec["resp"], list) else [rec["resp"]]
            for req, resp in zip(reqs, resps):
                method = req.get("method")
                if method != "eth_call":
                    self.other_methods.append(method)
                    self.kinds.add((method, "-", "-", "-"))
                    continue
                tx = req["params"][0]
                data = (tx.get("input") or tx.get("data") or "")[2:]
                to = (tx.get("to") or "").lower()
                sel = data[:8]
                name, types = SIGS.get(sel, ("0x" + sel, []))
                block = req["params"][1] if len(req["params"]) > 1 else "(none)"
                self.kinds.add(("eth_call", name, ",".join(sorted(tx.keys())), str(block)))
                if self.acls and to not in self.acls:
                    self.to_outside_acl += 1
                res = resp.get("result", resp.get("error"))
                if isinstance(res, str) and res.startswith("0x") and len(res) == 66:
                    res = int(res, 16)
                    if name.startswith("is"):
                        res = bool(res)
                call = {"t0": rec.get("t0", rec["t"]), "t1": rec["t"], "name": name, "sel": sel,
                        "args": self.decode_args(types, data[8:]), "result": res, "to": to, "block": block}
                call["canon"] = "%s(%s)" % (name, ",".join(call["args"]))
                if self.mode == "level0":
                    label = rec.get("path", "/").lstrip("/") or "(untagged)"
                else:
                    label = next((l for l, r in self.requests.items() if r["acl"] == to), "unattributed:" + to)
                self.calls[label].append(call)

    # ------------------------------------------------------------------ per request
    def analyse(self, label):
        r = self.requests.get(label, {"label": label})
        ev = sorted(self.events.get(label, []))
        starts = [t for t, k, _ in ev if k == "start"]
        attempts = []
        for i, s in enumerate(starts):
            end_window = starts[i + 1] if i + 1 < len(starts) else float("inf")
            a = {"start": s, "check_start": None, "check_end": None, "end": None, "outcome": None, "msg": None}
            for t, k, msg in ev:
                if not (s <= t < end_window):
                    continue
                if k == "check_start" and a["check_start"] is None:
                    a["check_start"] = t
                elif k == "check_pass" and a["check_end"] is None:
                    a["check_end"] = t
                elif k == "fail" and a["end"] is None:
                    a["end"], a["outcome"], a["msg"] = t, "fail", msg
                    if a["check_end"] is None and a["check_start"] is not None:
                        a["check_end"] = t
                elif k == "success" and a["end"] is None:
                    a["end"], a["outcome"] = t, "success"
            a["calls"] = [c for c in self.calls.get(label, []) if s <= c["t0"] < end_window]
            attempts.append(a)
        stored = [t for t, k, _ in ev if k == "stored"]
        dbupd = [t for t, k, _ in ev if k == "db_updated"]
        done = None
        if stored:
            done = stored[-1]
        elif dbupd:
            done = dbupd[-1]
        elif attempts and attempts[-1]["end"]:
            done = attempts[-1]["end"]
        calls_all = self.calls.get(label, [])
        out = {
            "label": label,
            "path": r.get("path", "?"),
            "kind": r.get("acl_kind", "?"),
            "source": r.get("source", "onchain"),
            "expected": r.get("expected", "?"),
            "observed": r.get("result", {}).get("observed", "?"),
            "kms": r.get("result", {}).get("kms_mock_hits", "?"),
            "s3": r.get("result", {}).get("s3_mock_hits", "?"),
            "error_counter": r.get("result", {}).get("error_counter", "?"),
            "error_code": r.get("result", {}).get("error_code", "-"),
            "expect_false": r.get("expect_false", "-"),
            "attempts": attempts,
            "n_attempts": len(attempts),
            "calls": calls_all,
            "request_ms": (done - starts[0]) * 1000 if (done and starts) else None,
            "fail_msgs": sorted(set(re.sub(r".*Processing failed( with irrecoverable error)?\s*:?\s*", "", a["msg"]).split(". Maximum")[0]
                                    for a in attempts if a["msg"])),
        }
        # expect_false verification and the false-returning views
        want = out["expect_false"].replace(" ", "")
        verified = 0
        false_views = set()
        for a in attempts:
            for c in a["calls"]:
                if c["result"] is False:
                    false_views.add(c["canon"])
            if want != "-":
                if any(c["canon"] == want and c["result"] is False for c in a["calls"]):
                    verified += 1
            elif any(c["result"] is False for c in a["calls"]):
                # baseline runs carry no expect_false: any ACL view returning false in the attempt
                verified += 1
        for c in calls_all:
            if c["result"] is False:
                false_views.add(c["canon"])
        out["false_views"] = sorted(false_views)
        out["verified_attempts"] = verified
        out["calls_per_attempt"] = sorted(set(len(a["calls"]) for a in attempts))
        out["unassigned_calls"] = len(calls_all) - sum(len(a["calls"]) for a in attempts)
        return out


def fmt_res(v):
    return str(v)


def main():
    run_dir = sys.argv[1]
    baselines = sys.argv[2:]
    run = Run(run_dir)
    rows = [run.analyse(l) for l in run.requests]
    # ---------------------------------------------------------------- acl_calls.txt
    with open(os.path.join(run_dir, "acl_calls.txt"), "w") as f:
        f.write("# mode=%s records=%d requests=%d\n" % (run.mode, run.total_records, len(rows)))
        for r in rows:
            f.write("== %s [%s %s %s] expected=%s observed=%s kms=%s attempts=%d calls=%d expect_false=%s verified=%d/%d\n" % (
                r["label"], r["kind"], r["path"], r["source"], r["expected"], r["observed"], r["kms"], r["n_attempts"],
                len(r["calls"]), r["expect_false"], r["verified_attempts"], r["n_attempts"]))
            for i, a in enumerate(r["attempts"], 1):
                cm = (a["check_end"] - a["check_start"]) * 1000 if (a["check_start"] and a["check_end"]) else None
                f.write("   attempt %d outcome=%s check_ms=%s\n" % (i, a["outcome"], "%.2f" % cm if cm is not None else "-"))
                for c in a["calls"]:
                    f.write("      %s -> %s   [rpc_ms=%.2f block=%s]\n" % (c["canon"], fmt_res(c["result"]), (c["t1"] - c["t0"]) * 1000, c["block"]))
            if r["unassigned_calls"]:
                f.write("   (%d call(s) outside attempt windows)\n" % r["unassigned_calls"])
            for m in r["fail_msgs"]:
                f.write("   connector: %s\n" % m)
        untagged = [l for l in run.calls if l not in run.requests]
        for l in untagged:
            f.write("== UNATTRIBUTED %s: %d call(s)\n" % (l, len(run.calls[l])))
    # ---------------------------------------------------------------- requests.tsv
    with open(os.path.join(run_dir, "requests.tsv"), "w") as f:
        f.write("label\tacl_kind\tpath\tsource\texpected\tobserved\tkms_hits\ts3_hits\terror_counter\terror_code\tattempts\tcalls_per_attempt\t"
                "false_views\texpect_false\tverified_attempts\tcheck_ms_attempt1\tattempt_ms_attempt1\trequest_ms\n")
        for r in rows:
            a1 = r["attempts"][0] if r["attempts"] else None
            cm = (a1["check_end"] - a1["check_start"]) * 1000 if (a1 and a1["check_start"] and a1["check_end"]) else None
            am = (a1["end"] - a1["start"]) * 1000 if (a1 and a1["end"]) else None
            f.write("\t".join(str(x) for x in [
                r["label"], r["kind"], r["path"], r["source"], r["expected"], r["observed"], r["kms"], r["s3"], r["error_counter"],
                r["error_code"], r["n_attempts"], "/".join(map(str, r["calls_per_attempt"])), " ".join(r["false_views"]) or "-",
                r["expect_false"], r["verified_attempts"], "%.2f" % cm if cm is not None else "-", "%.2f" % am if am is not None else "-",
                "%.2f" % r["request_ms"] if r["request_ms"] is not None else "-"]) + "\n")
    # ---------------------------------------------------------------- latency.txt
    groups = defaultdict(list)
    for r in rows:
        parts = r["label"].split(".")
        if parts[0] == "lat" and len(parts) >= 5:
            key = "%s %s %s" % (parts[1], parts[2], parts[3])
        else:
            key = "scenario %s %s %s" % (r["kind"], r["path"], r["expected"])
        groups[key].append(r)
    with open(os.path.join(run_dir, "latency.txt"), "w") as f:
        f.write("# Times from the unmodified connector's own log timestamps (us resolution) and the recorder (time.time()).\n"
                "# check_ms   : 'Starting ACL check'/'Starting RFC016 check' -> 'ACL check passed' or the attempt's ERROR line\n"
                "# attempt_ms : 'Starting to process' -> 'Event successfully processed!' or the ERROR line\n"
                "# request_ms : first 'Starting to process' -> 'Successfully stored response in DB!' (forwarded) or the last\n"
                "#              'Successfully updated event in DB!' (rejected: status failed / restored)\n"
                "# rpc_ms     : per ACL eth_call, recorder arrival -> upstream (anvil) answer\n"
                "# gap_ms     : retry spacing, start of attempt k -> start of attempt k+1 (rejected requests)\n")
        for key in sorted(groups):
            rs = groups[key]
            check, attempt, req, rpc, gaps, att, cpa = [], [], [], [], [], [], []
            for r in rs:
                att.append(r["n_attempts"])
                for i, a in enumerate(r["attempts"]):
                    if a["check_start"] and a["check_end"]:
                        check.append((a["check_end"] - a["check_start"]) * 1000)
                    if a["end"]:
                        attempt.append((a["end"] - a["start"]) * 1000)
                    cpa.append(len(a["calls"]))
                    if i + 1 < len(r["attempts"]):
                        gaps.append((r["attempts"][i + 1]["start"] - a["start"]) * 1000)
                if r["request_ms"] is not None:
                    req.append(r["request_ms"])
                rpc += [(c["t1"] - c["t0"]) * 1000 for c in r["calls"]]
            f.write("[%s] requests=%d attempts/request=%s calls/attempt=%s\n" % (key, len(rs), sorted(set(att)), sorted(set(cpa))))
            f.write("   check_ms    %s\n" % stats(check))
            f.write("   attempt_ms  %s\n" % stats(attempt))
            f.write("   request_ms  %s\n" % stats(req))
            f.write("   rpc_ms      %s\n" % stats(rpc))
            if gaps:
                f.write("   gap_ms      %s\n" % stats(gaps))
    # ---------------------------------------------------------------- rpc_kinds.txt
    base_kinds, base_records = set(), 0
    for b in baselines:
        for line in open(b):
            rec = json.loads(line)
            base_records += 1
            reqs = rec["req"] if isinstance(rec["req"], list) else [rec["req"]]
            for req in reqs:
                if req.get("method") != "eth_call":
                    base_kinds.add((req.get("method"), "-", "-", "-"))
                    continue
                tx = req["params"][0]
                data = (tx.get("input") or tx.get("data") or "")[2:]
                name = SIGS.get(data[:8], ("0x" + data[:8], []))[0]
                block = req["params"][1] if len(req["params"]) > 1 else "(none)"
                base_kinds.add(("eth_call", name, ",".join(sorted(tx.keys())), str(block)))
    new_kinds = sorted(run.kinds - base_kinds) if baselines else None
    l0_sel_seen = sorted({c["name"] for cs in run.calls.values() for c in cs if c["sel"] in LEVEL0_SELECTORS})
    with open(os.path.join(run_dir, "rpc_kinds.txt"), "w") as f:
        f.write("# (method, function, call-object keys, block) seen on the connector's host-chain endpoint\n")
        f.write("run: %d record(s), %d kind(s)\n" % (run.total_records, len(run.kinds)))
        for k in sorted(run.kinds):
            f.write("   %s\n" % (k,))
        f.write("baseline: %d file(s), %d record(s), %d kind(s)\n" % (len(baselines), base_records, len(base_kinds)))
        for k in sorted(base_kinds):
            f.write("   %s\n" % (k,))
        f.write("kinds in this run but not in the baseline: %s\n" % (new_kinds if new_kinds is not None else "(no baseline given)"))
        f.write("non-eth_call methods in this run: %s\n" % (sorted(set(run.other_methods)) or "none"))
        f.write("Level 0 selectors (retireAccount, isAccountRetired, supportsInterface, retirementStorageLocation) seen: %s\n"
                % (l0_sel_seen or "none"))
        f.write("eth_calls whose `to` is not one of the run's ACL proxies: %d\n" % run.to_outside_acl)
    # ---------------------------------------------------------------- verdict.txt
    lines = []
    ok_all = True
    for r in rows:
        if r["expected"] == "Rejected":
            ok = (r["observed"] == "Rejected" and str(r["kms"]) == "0" and r["n_attempts"] >= 1
                  and r["verified_attempts"] == r["n_attempts"] and r["unassigned_calls"] == 0)
        elif r["expected"] == "Forwarded":
            ok = r["observed"] == "Forwarded" and not r["false_views"]
        else:
            ok = True
        ok_all &= ok
        lines.append("%s %s expected=%s observed=%s kms=%s attempts=%d verified=%d false_views=%s" % (
            "OK  " if ok else "FAIL", r["label"], r["expected"], r["observed"], r["kms"], r["n_attempts"], r["verified_attempts"],
            ",".join(r["false_views"]) or "-"))
    rpc_ok = (new_kinds == [] if new_kinds is not None else True) and not l0_sel_seen and not run.other_methods \
        and run.to_outside_acl == 0 and not [l for l in run.calls if l not in run.requests]
    with open(os.path.join(run_dir, "verdict.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")
        f.write("REQUESTS %s (%d requests)\n" % ("ALL OK" if ok_all else "FAILURES", len(rows)))
        f.write("ZERO-NEW-RPC %s\n" % ("OK" if rpc_ok else "FAIL"))
    # ---------------------------------------------------------------- summary
    print("mode=%s requests=%d records=%d" % (run.mode, len(rows), run.total_records))
    for d in run.deploys:
        print("deploy", d)
    for d in run.retirements:
        print("retire", d)
    print(open(os.path.join(run_dir, "rpc_kinds.txt")).read())
    for r in rows:
        if not r["label"].startswith("lat."):
            print("%-58s %-9s obs=%-9s kms=%-2s att=%-2s cpa=%-5s false=%s verified=%d/%d %s" % (
                r["label"], r["expected"], r["observed"], r["kms"], r["n_attempts"], "/".join(map(str, r["calls_per_attempt"])),
                ",".join(r["false_views"]) or "-", r["verified_attempts"], r["n_attempts"], "; ".join(r["fail_msgs"])[:160]))
    print(open(os.path.join(run_dir, "latency.txt")).read())
    print(open(os.path.join(run_dir, "verdict.txt")).read().splitlines()[-2])
    print(open(os.path.join(run_dir, "verdict.txt")).read().splitlines()[-1])


if __name__ == "__main__":
    main()
