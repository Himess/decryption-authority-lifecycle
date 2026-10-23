"""P1.2 analysis: Profile Q in the connector (TC22, the Q1 ceremony, partial adoption), from the raw runs.

Usage: python -I analyze_p12.py <results/phase4 dir>
Reads raw/p12/runs/p12-main-l3-r*-*/:
  - every `P12-RESULT` line (outcome, KMS mock hits, error counter, error code on HTTP rows);
  - the worker's Profile Q lines between a request's `L0-REQUEST` line and its result (`PROFILE-Q established`,
    `PROFILE-Q not established`, `PROFILE-Q refused path=...`, `PROFILE-Q cutoff passed/refused/not applied`), and
    `PROFILE-H accepted path=...`;
  - the host-chain recording per request label: eth_getCode (rewritten or not), isValidSignature calls and
    eth_getStorageAt reads;
  - the `P12-ADOPTION` lines, whose forwarding workers are checked against real Shamir shares (Phase 3's
    impl/harness/level3/profile_q_sim.py: n = 13, degree t = 4, GF(2^127 - 1)).
Writes p12/P12_TABLE.md and p12/P12_TABLE.json. Every cell must agree across the runs.
"""
import collections
import glob
import importlib.util
import json
import os
import random
import re
import sys

KV = re.compile(r"(\w+)=(\S+)")
Q_LINE = re.compile(r"(PROFILE-Q established|PROFILE-Q not established|PROFILE-Q refused path=\w+|"
                    r"PROFILE-Q cutoff passed|PROFILE-Q cutoff refused|PROFILE-Q cutoff not applied|"
                    r"PROFILE-H accepted|PROFILE-H rejected|E3 KDA accepted)(.*)")
ISVALIDSIG = "0x1626ba7e"


def suffix(label):
    return re.sub(r"^p12\.r\d+\.", "", label)


def q_summary(kind, rest):
    if kind == "PROFILE-Q established":
        m = re.search(r"variant=(\S+) b_q=\d+ statements=(\d+)/(\d+) threshold=(\d+)", rest)
        return f"established {m.group(1)} {m.group(2)}/{m.group(3)} (needs {m.group(4)})"
    if kind == "PROFILE-Q not established":
        m = re.search(r": (\d+) of (\d+) operators' statements verify, (\d+) needed: (.*)$", rest)
        reason = m.group(4)
        reason = "other ICS" if "binds ICS" in reason else "other chain or ACL" if "this node serves" in reason else reason
        return f"not established {m.group(1)}/{m.group(2)} ({reason})"
    if kind.startswith("PROFILE-Q refused"):
        return kind.replace("PROFILE-Q ", "Q4 ")
    if kind == "PROFILE-Q cutoff passed":
        return "Q5 passed"
    if kind == "PROFILE-Q cutoff refused":
        return "Q5 refused"
    if kind == "PROFILE-Q cutoff not applied":
        return "Q5 not applied (regular code)"
    if kind == "PROFILE-H accepted":
        m = re.search(r"path=(\w+)", rest)
        return f"accepted ({m.group(1)})"
    if kind == "PROFILE-H rejected":
        m = re.search(r"disposition=(\w+)", rest)
        return f"Profile H refused ({m.group(1) if m else '?'})"
    return "E3 accepted"


def parse_run(d):
    rows, cur, adoption = {}, None, []
    est_pending = []
    with open(os.path.join(d, "test.log"), encoding="utf-8", errors="replace") as f:
        for line in f:
            if "L0-REQUEST label=" in line:
                cur = re.search(r"L0-REQUEST label=(\S+)", line).group(1)
                rows.setdefault(cur, {"q": [], "cutoff_rows": []})
                for e in est_pending:  # the worker's startup line comes before the request line
                    rows[cur]["q"].append(e)
                est_pending = []
                continue
            m = Q_LINE.search(line)
            if m:
                s = q_summary(m.group(1), m.group(2))
                if m.group(1) in ("PROFILE-Q established", "PROFILE-Q not established"):
                    est_pending.append(s)
                elif cur:
                    rows[cur]["q"].append(s)
                    c = re.search(r"contract\(exp=(\d+),last=(\d+)\) wildcard\(exp=(\d+),last=(\d+)\)", line)
                    if c:
                        rows[cur]["cutoff_rows"].append(tuple(int(x) for x in c.groups()))
                continue
            if "P12-RESULT label=" in line:
                d2 = dict(KV.findall(line[line.index("P12-RESULT"):]))
                rows.setdefault(d2["label"], {"q": [], "cutoff_rows": []}).update(d2)
            if "P12-ADOPTION " in line:
                adoption.append(dict(KV.findall(line[line.index("P12-ADOPTION"):])))
            if "P12-ACCOUNTS " in line or "P12-AFTER-BQ " in line:
                rows.setdefault("_blocks", {}).update(dict(KV.findall(line)))
    wire = collections.defaultdict(collections.Counter)
    with open(os.path.join(d, "host_rpc.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            label = r.get("path", "").lstrip("/")
            req = r.get("req") or {}
            for q in req if isinstance(req, list) else [req]:
                meth = q.get("method")
                if meth == "eth_getCode":
                    wire[label]["getCode (rewritten)" if r.get("rewrite") else "getCode"] += 1
                elif meth == "eth_call":
                    p0 = (q.get("params") or [{}])[0]
                    inp = p0.get("input") or p0.get("data") or ""
                    if inp.startswith(ISVALIDSIG):
                        wire[label]["isValidSignature"] += 1
                elif meth == "eth_getStorageAt":
                    wire[label]["getStorageAt"] += 1
    return rows, wire, adoption


def load_sim(root):
    path = os.path.join(root, "..", "..", "impl", "harness", "level3", "profile_q_sim.py")
    spec = importlib.util.spec_from_file_location("profile_q_sim", os.path.normpath(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    root = sys.argv[1]
    sim = load_sim(root)
    runs = sorted(glob.glob(os.path.join(root, "raw", "p12", "runs", "p12-main-l3-r*-*")))
    table = collections.OrderedDict()
    adoption = collections.defaultdict(lambda: {"runs": 0, "forwarding": set(), "per_run": []})
    blocks = []
    for d in runs:
        rows, wire, adopt = parse_run(d)
        blocks.append(rows.get("_blocks", {}))
        for label, r in rows.items():
            if label == "_blocks" or "observed" not in r:
                continue
            s = suffix(label)
            if s.startswith("adoption."):
                continue
            c = table.setdefault(s, {"runs": 0, "group": r["group"], "variant": r["variant"], "expected": r["expected"],
                                     "observed": set(), "kms": set(), "error_counter": set(), "error_code": set(),
                                     "q": set(), "getCode": set(), "isValidSignature": set(), "getStorageAt": set(),
                                     "cutoff_rows": []})
            c["runs"] += 1
            c["observed"].add(r["observed"])
            c["kms"].add(r["kms_mock_hits"])
            c["error_counter"].add(r["error_counter"])
            c["error_code"].add(r["error_code"] if r.get("http") == "true" else "-")
            c["q"].add(" / ".join(dict.fromkeys(r["q"])) or "-")
            w = wire.get(label, {})
            c["getCode"].add(f"{w.get('getCode', 0)}+{w.get('getCode (rewritten)', 0)}r" if w.get("getCode (rewritten)") else str(w.get("getCode", 0)))
            c["isValidSignature"].add(w.get("isValidSignature", 0))
            c["getStorageAt"].add(w.get("getStorageAt", 0))
            c["cutoff_rows"].extend(r["cutoff_rows"])
        per_run = collections.defaultdict(list)
        for a in adopt:
            per_run[(int(a["k"]), a["request"])].append(a)
        for key, entries in per_run.items():
            fwd = tuple(sorted(int(e["worker"]) for e in entries if e["observed"] == "Forwarded"))
            cell = adoption[key]
            cell["runs"] += 1
            cell["forwarding"].add(fwd)
            cell["per_run"].append(entries)
    disagreements = [f"{s}: observed {sorted(c['observed'])}" for s, c in table.items() if len(c["observed"]) != 1]
    for s, c in table.items():
        c["matches"] = c["observed"] == {c["expected"]}
        for k in ("observed", "kms", "error_counter", "error_code", "q", "getCode", "isValidSignature", "getStorageAt"):
            c[k] = sorted(c[k], key=str)
    # Partial adoption: real Shamir shares, one per forwarding worker (worker i holds share x = i + 1).
    rng = random.Random(20261022)
    secret = rng.randrange(1, sim.P)
    shares = sim.share(secret, rng)  # {x: y} for x = 1..13, degree 4
    adoption_out = {}
    for (k, req), cell in sorted(adoption.items()):
        fwd_sets = sorted(cell["forwarding"])
        f = list(fwd_sets[0]) if fwd_sets else []
        released = sim.reconstruct({i + 1: shares[i + 1] for i in f}) == secret
        model = (req == "kda") or (13 - k >= 5)
        adoption_out[f"k{k:02d}.{req}"] = {"k": k, "request": req, "runs": cell["runs"], "forwarding_workers": f,
                                          "same_in_every_run": len(fwd_sets) == 1, "shares": len(f),
                                          "released": released, "model_release": model, "agrees": released == model}
    out = {"runs": [os.path.basename(d) for d in runs], "rows": table, "disagreements": disagreements,
           "adoption": adoption_out, "blocks": blocks}
    os.makedirs(os.path.join(root, "p12"), exist_ok=True)
    with open(os.path.join(root, "p12", "P12_TABLE.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1, default=list)
    md = ["# P1.2 table (generated by impl/harness/phase4/analyze_p12.py from raw/p12)", "",
          f"Runs: {len(runs)}. Every row's outcome is the same in every run unless listed under disagreements.", "",
          "| Row | Variant | Expected | Observed | KMS hits | Error counter | Error code (HTTP) | Worker (Profile Q) | getCode (r: rewritten) | isValidSignature | getStorageAt |",
          "|---|---|---|---|---|---|---|---|---|---|---|"]
    for s, c in table.items():
        md.append(f"| `{s}` | {c['variant']} | {c['expected']} | {','.join(c['observed'])}{'' if c['matches'] else ' ✗'} | "
                  f"{','.join(c['kms'])} | {','.join(c['error_counter'])} | {','.join(c['error_code'])} | "
                  f"{'; '.join(c['q'])} | {','.join(map(str, c['getCode']))} | {','.join(map(str, c['isValidSignature']))} | "
                  f"{','.join(map(str, c['getStorageAt']))} |")
    md += ["", "## Partial adoption (k of 13 workers enforce; shares checked with real Shamir sharing, t = 4)", "",
           "| k | Request | Runs | Forwarding workers | Shares | Released | Model (13 - k >= 5, or PQ) | Same in every run |",
           "|---|---|---|---|---|---|---|---|"]
    for key, a in adoption_out.items():
        md.append(f"| {a['k']} | {a['request']} | {a['runs']} | {len(a['forwarding_workers'])} of 13 | {a['shares']} | "
                  f"{'yes' if a['released'] else 'no'} | {'yes' if a['model_release'] else 'no'}{'' if a['agrees'] else ' ✗'} | "
                  f"{'yes' if a['same_in_every_run'] else 'NO'} |")
    md += ["", f"Disagreements across runs: {len(disagreements)}"] + [f"- {x}" for x in disagreements]
    with open(os.path.join(root, "p12", "P12_TABLE.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(md) + "\n")
    print("\n".join(md))


if __name__ == "__main__":
    main()
