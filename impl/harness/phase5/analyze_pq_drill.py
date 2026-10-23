"""Builds the Part B drill results (Phase 5) from the runs of run_pq_drill.sh.

Usage: python -I analyze_pq_drill.py <abi.json> [<abi.json> ...] -- <out.json> <out.md> <run_dir> [<run_dir> ...]

The ABI files (the Level 3 ACL artifact, the PQWallet artifact) name the custom errors, so a reverted transaction's
4-byte selector reads as its error. Each run directory holds test.log, with:
  PQ-RESULT  one request through the worker (group, path, action, expected, observed, KMS hits, attempts, error code);
  PQ-TX      one transaction of the drill (path, action, expected, observed, revert data, gas);
  PQ-ADOPTION one request through one of the 13 workers of a partial-adoption run (k enforcing).
A row conforms when every run observed what the test expected (a refused request reached no KMS mock; a forwarded
one at least two). A partial-adoption request is released when at least t + 1 = 5 of the 13 workers forwarded it.
"""
import collections
import json
import pathlib
import re
import sys

from Crypto.Hash import keccak

RESULT = re.compile(
    r"PQ-RESULT label=(?P<label>\S+) version=\S+ group=(?P<group>\S+) path=(?P<path>\S+) action=(?P<action>\S+) "
    r"expected=(?P<expected>\S+) observed=(?P<observed>\S+) kms_mock_hits=(?P<kms>\S+) error_counter=(?P<ec>\S+) "
    r"error_code=(?P<code>\S+) expected_code=(?P<xcode>\S+) http=(?P<http>\S+) wall_ms=(?P<wall>\d+)"
)
TX = re.compile(
    r"PQ-TX label=(?P<label>\S+) version=\S+ path=(?P<path>\S+) action=(?P<action>\S+) sender=\S+ to=\S+ "
    r"expected=(?P<expected>\S+) observed=(?P<observed>\S+) revert=(?P<revert>\S+) gas_used=(?P<gas>\d+)"
)
ADOPTION = re.compile(
    r"PQ-ADOPTION k=(?P<k>\d+) worker=(?P<w>\d+) enforcing=(?P<enf>\S+) request=(?P<req>\S+) observed=(?P<obs>\S+) "
    r"kms_mock_hits=(?P<kms>\S+)"
)
SETUP = re.compile(r"PQ-SETUP (?P<rest>.*)")
EXECUTE = re.compile(r"PQ-EXECUTE what=\"(?P<what>[^\"]+)\" .* status=(?P<status>\S+) gas_used=(?P<gas>\d+)")
THRESHOLD_RELEASE = 5  # t + 1, t = 4 of n = 13


def k256(b):
    h = keccak.new(digest_bits=256)
    h.update(b)
    return h.digest()


def error_names(abi_paths):
    names = {}
    for p in abi_paths:
        art = json.load(open(p, encoding="utf-8"))
        for e in art.get("abi", []):
            if e.get("type") == "error":
                sig = f"{e['name']}({','.join(i['type'] for i in e.get('inputs', []))})"
                names["0x" + k256(sig.encode())[:4].hex()] = e["name"]
    names["0x08c379a0"] = "Error(string)"
    return names


def main():
    sep = sys.argv.index("--")
    abis, rest = sys.argv[1:sep], sys.argv[sep + 1:]
    out_json, out_md, run_dirs = rest[0], rest[1], [pathlib.Path(r) for r in rest[2:]]
    errs = error_names(abis)
    rows = collections.OrderedDict()
    txs = collections.OrderedDict()
    adoption = collections.defaultdict(lambda: collections.defaultdict(list))
    setup = collections.defaultdict(list)
    runs = []
    for run_dir in run_dirs:
        text = (run_dir / "test.log").read_text(encoding="utf-8", errors="replace")
        run = run_dir.name
        runs.append(run)
        for m in RESULT.finditer(text):
            d = m.groupdict()
            key = (d["group"], d["path"], d["action"])
            ok = d["observed"] == d["expected"] and (
                (d["expected"] == "Rejected" and d["kms"] == "0") or (d["expected"] == "Forwarded" and d["kms"].isdigit() and int(d["kms"]) >= 2))
            if ok and d["expected"] == "Rejected" and d["xcode"] != "-" and d["http"] == "true":
                ok = d["code"] == d["xcode"]
            rows.setdefault(key, []).append({"run": run, **d, "conforms": ok})
        for m in TX.finditer(text):
            d = m.groupdict()
            sel = d["revert"][:10] if d["revert"].startswith("0x") else d["revert"]
            d["error"] = errs.get(sel, sel) if d["revert"] != "-" else "-"
            txs.setdefault((d["path"], d["action"]), []).append({"run": run, **d, "conforms": d["observed"] == d["expected"]})
        for m in ADOPTION.finditer(text):
            d = m.groupdict()
            fwd = d["obs"] == "Forwarded" and d["kms"].isdigit() and int(d["kms"]) >= 2
            req = re.sub(r"\.w\d+$", "", d["req"])
            adoption[(int(d["k"]), req)][run].append((int(d["w"]), d["enf"] == "true", fwd))
        for m in SETUP.finditer(text):
            setup[run].append(m.group("rest"))
        for m in EXECUTE.finditer(text):
            setup[run].append(f"execute \"{m.group('what')}\" status={m.group('status')} gas_used={m.group('gas')}")

    out_rows = []
    for (group, path, action), obs in rows.items():
        out_rows.append({
            "group": group, "path": path, "action": action, "runs": len(obs), "expected": obs[0]["expected"],
            "observed": sorted({o["observed"] for o in obs}), "error_codes": sorted({o["code"] for o in obs}),
            "attempts": sorted({o["ec"] for o in obs}), "conforms": all(o["conforms"] for o in obs),
        })
    out_txs = []
    for (path, action), obs in txs.items():
        out_txs.append({
            "path": path, "action": action, "runs": len(obs), "expected": obs[0]["expected"],
            "observed": sorted({o["observed"] for o in obs}), "errors": sorted({o["error"] for o in obs}),
            "gas_used": sorted({int(o["gas"]) for o in obs}), "conforms": all(o["conforms"] for o in obs),
        })
    out_adoption = []
    for (k, req), per_run in sorted(adoption.items()):
        released = {}
        for run, ws in per_run.items():
            n_fwd = sum(1 for _, _, f in ws if f)
            released[run] = {"workers": len(ws), "forwarded": n_fwd, "released": n_fwd >= THRESHOLD_RELEASE}
        out_adoption.append({"k": k, "request": req, "per_run": released,
                             "released": sorted({v["released"] for v in released.values()})})
    report = {
        "runs": runs, "rows": out_rows, "transactions": out_txs, "adoption": out_adoption, "setup": setup,
        "summary": {
            "request_rows": len(out_rows), "request_rows_conforming": sum(r["conforms"] for r in out_rows),
            "request_rows_three_runs": sum(r["runs"] == len(runs) for r in out_rows),
            "tx_rows": len(out_txs), "tx_rows_conforming": sum(t["conforms"] for t in out_txs),
            "tx_rows_three_runs": sum(t["runs"] == len(runs) for t in out_txs),
        },
    }
    s = report["summary"]
    md = ["# Part B connector drill (generated by impl/harness/phase5/analyze_pq_drill.py)", "",
          f"Runs: {len(runs)} ({', '.join(runs)}). Requests: {s['request_rows_conforming']}/{s['request_rows']} rows conform "
          f"({s['request_rows_three_runs']} with every run). Transactions: {s['tx_rows_conforming']}/{s['tx_rows']} rows "
          f"conform ({s['tx_rows_three_runs']} with every run).", "",
          "## Requests through the worker", "",
          "| Group | Path | Action | Runs | Expected | Observed | Error code | Attempts | OK |", "|---|---|---|---|---|---|---|---|---|"]
    for r in out_rows:
        md.append(f"| {r['group']} | {r['path']} | {r['action']} | {r['runs']} | {r['expected']} | {'/'.join(r['observed'])} | "
                  f"{','.join(r['error_codes'])} | {','.join(r['attempts'])} | {'yes' if r['conforms'] else '**NO**'} |")
    md += ["", "## Transactions", "", "| Path | Action | Runs | Expected | Observed | Revert | Gas used | OK |", "|---|---|---|---|---|---|---|---|"]
    for t in out_txs:
        md.append(f"| {t['path']} | {t['action']} | {t['runs']} | {t['expected']} | {'/'.join(t['observed'])} | "
                  f"{','.join(t['errors'])} | {','.join(str(g) for g in t['gas_used'])} | {'yes' if t['conforms'] else '**NO**'} |")
    md += ["", "## Partial adoption (13 workers, k enforcing; released when at least 5 forward)", "",
           "| k | Request | Forwarded by (per run) | Released |", "|---|---|---|---|"]
    for a in out_adoption:
        per = ", ".join(f"{v['forwarded']}/{v['workers']}" for v in a["per_run"].values())
        md.append(f"| {a['k']} | {a['request']} | {per} | {'/'.join(str(x).lower() for x in a['released'])} |")
    pathlib.Path(out_json).write_text(json.dumps(report, indent=1), encoding="utf-8")
    pathlib.Path(out_md).write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"requests {s['request_rows_conforming']}/{s['request_rows']} conform; transactions {s['tx_rows_conforming']}/{s['tx_rows']}; "
          f"adoption rows {len(out_adoption)}")


if __name__ == "__main__":
    main()
