"""P1.1 analysis: E3 (the KDA route) and K8 in the connector, TC20 oracle part, from the raw runs.

Usage: python -I analyze_p11.py <results/phase4 dir>
Reads raw/p11/runs/p11-main-l3-r{4,5,6}-*/ (Level 3 worker) and raw/p11/runs/p11-main-r*-*/ (unmodified worker):
  - the `P11-RESULT` line of every request (outcome, KMS mock hits, error counter, error code on HTTP rows);
  - the worker's verdict lines between a request's `L0-REQUEST` line and its result (`E3 KDA accepted/rejected`,
    `E3 KDA route not taken`, `E3 K8 DISAGREEMENT`, `PROFILE-H accepted/rejected`), with `sig_check_us`;
  - the host-chain recording per request label: `eth_getCode` calls and `isValidSignature` (0x1626ba7e) calls.
Writes p11/P11_TABLE.md and p11/P11_TABLE.json. Every cell must agree across the runs of its tree.
"""
import collections
import glob
import json
import os
import re
import statistics
import sys

KV = re.compile(r"(\w+)=(\S+)")
VERDICT = re.compile(r"(E3 KDA accepted|E3 KDA rejected|E3 KDA route not taken|E3 K8 DISAGREEMENT|PROFILE-H accepted|PROFILE-H rejected)(.*)")


def suffix(label):
    return re.sub(r"^p11\.r\d+\.(level3|unmodified)\.", "", label)


def verdict_summary(kind, rest):
    if kind == "E3 KDA accepted":
        m = re.search(r"scheme=(\S+) k8=(\S+)", rest)
        return f"KDA accepted ({m.group(1)}, {m.group(2)})"
    if kind == "E3 KDA rejected":
        m = re.search(r"error=KDA route: (.*?) k8=", rest)
        return f"KDA refused: {m.group(1)}"
    if kind == "E3 KDA route not taken":
        m = re.search(r"skip=(\w+)", rest)
        return f"route not taken ({m.group(1)})"
    if kind == "E3 K8 DISAGREEMENT":
        return "K8 disagreement"
    if kind == "PROFILE-H accepted":
        m = re.search(r"path=(\w+)", rest)
        return f"Profile H accepted ({m.group(1)})"
    m = re.search(r"disposition=(\w+)", rest)
    return f"Profile H refused ({m.group(1) if m else '?'})"


def parse_run(d):
    rows = {}
    cur = None
    with open(os.path.join(d, "test.log"), encoding="utf-8", errors="replace") as f:
        for line in f:
            if "L0-REQUEST label=" in line:
                cur = re.search(r"L0-REQUEST label=(\S+)", line).group(1)
                rows.setdefault(cur, {"verdicts": [], "sig_check_us": []})
                continue
            m = VERDICT.search(line)
            if m and cur:
                rows[cur]["verdicts"].append(verdict_summary(m.group(1), m.group(2)))
                us = re.search(r"sig_check_us=(\d+)", m.group(2))
                if us:
                    rows[cur]["sig_check_us"].append((verdict_summary(m.group(1), m.group(2)), int(us.group(1))))
                continue
            if "P11-RESULT label=" in line:
                d2 = dict(KV.findall(line[line.index("P11-RESULT"):]))
                rows.setdefault(d2["label"], {"verdicts": [], "sig_check_us": []}).update(d2)
    wire = collections.defaultdict(lambda: collections.Counter())
    with open(os.path.join(d, "host_rpc.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            label = r.get("path", "").lstrip("/")
            req = r.get("req") or {}
            reqs = req if isinstance(req, list) else [req]
            for q in reqs:
                m = q.get("method")
                if m == "eth_getCode":
                    wire[label]["getCode"] += 1
                elif m == "eth_call":
                    inp = (q.get("params") or [{}])[0].get("input") or (q.get("params") or [{}])[0].get("data") or ""
                    wire[label]["isValidSignature" if inp.startswith("0x1626ba7e") else "eth_call"] += 1
                else:
                    wire[label][m] += 1
    return rows, wire


def main():
    root = sys.argv[1]
    out = {"trees": {}, "disagreements": [], "latency_connector": {}}
    for tree, pattern in (("level3", "p11-main-l3-r[456]-*"), ("unmodified", "p11-main-r[1-6]-*")):
        runs = sorted(glob.glob(os.path.join(root, "raw", "p11", "runs", pattern)))
        table = collections.OrderedDict()
        lat = collections.defaultdict(list)
        for d in runs:
            rows, wire = parse_run(d)
            for label, r in rows.items():
                if "observed" not in r:
                    continue
                s = suffix(label)
                cell = table.setdefault(s, {"runs": 0, "expected": r["expected"], "observed": set(), "kms": set(),
                                            "error_counter": set(), "error_code": set(), "verdicts": set(),
                                            "getCode": set(), "isValidSignature": set(), "k8": r.get("k8", "-")})
                cell["runs"] += 1
                cell["observed"].add(r["observed"])
                cell["kms"].add(r["kms_mock_hits"])
                cell["error_counter"].add(r["error_counter"])
                cell["error_code"].add(r["error_code"])
                cell["verdicts"].add(" / ".join(sorted(set(r["verdicts"]))) or "-")
                w = wire.get(label, {})
                cell["getCode"].add(w.get("getCode", 0))
                cell["isValidSignature"].add(w.get("isValidSignature", 0))
                for kind, us in r["sig_check_us"]:
                    lat[kind].append(us)
        for s, c in table.items():
            if len(c["observed"]) != 1:
                out["disagreements"].append(f"{tree} {s}: observed {sorted(c['observed'])}")
            c["matches"] = c["observed"] == {c["expected"]}
            for k in ("observed", "kms", "error_counter", "error_code", "verdicts", "getCode", "isValidSignature"):
                c[k] = sorted(c[k], key=str)
        out["trees"][tree] = {"runs": len(runs), "rows": table}
        out["latency_connector"][tree] = {k: {"n": len(v), "median_us": int(statistics.median(v)), "min_us": min(v)}
                                          for k, v in sorted(lat.items())}
    os.makedirs(os.path.join(root, "p11"), exist_ok=True)
    with open(os.path.join(root, "p11", "P11_TABLE.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1, default=list)
    md = ["# P1.1 table (generated by impl/harness/phase4/analyze_p11.py from raw/p11)", ""]
    for tree, t in out["trees"].items():
        md += [f"## {tree} worker ({t['runs']} runs)", "",
               "| Row | K8 | Expected | Observed | KMS hits | Error counter | Error code (HTTP) | Worker verdict | getCode | isValidSignature |",
               "|---|---|---|---|---|---|---|---|---|---|"]
        for s, c in t["rows"].items():
            md.append(f"| `{s}` | {c['k8']} | {c['expected']} | {','.join(c['observed'])}{'' if c['matches'] else ' ✗'} | "
                      f"{','.join(c['kms'])} | {','.join(c['error_counter'])} | {','.join(c['error_code'])} | "
                      f"{'; '.join(c['verdicts'])} | {','.join(map(str, c['getCode']))} | {','.join(map(str, c['isValidSignature']))} |")
        md.append("")
    md += ["## Signature-check time inside the connector harness (`sig_check_us`, all runs)", "",
           "Wall time of `verify_user_signature` in the worker, with every RPC through the recording proxy and the ACL views",
           "running alongside: harness conditions, not production. The crate-level bench is the latency measure.", "",
           "| Tree | Verdict | n | median (µs) | min (µs) |", "|---|---|---|---|---|"]
    for tree, lat in out["latency_connector"].items():
        for k, v in lat.items():
            md.append(f"| {tree} | {k} | {v['n']} | {v['median_us']} | {v['min_us']} |")
    md += ["", f"Disagreements across runs: {len(out['disagreements'])}"] + [f"- {d}" for d in out["disagreements"]]
    with open(os.path.join(root, "p11", "P11_TABLE.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(md) + "\n")
    print("\n".join(md))


if __name__ == "__main__":
    main()
