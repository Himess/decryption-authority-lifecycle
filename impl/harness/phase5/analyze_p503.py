"""Builds the P0.3 connector matrix (Phase 5: EIP-8298, simulated) from the runs of run_p503.sh.

Usage: python -I analyze_p503.py <out.json> <out.md> <run_dir> [<run_dir> ...]

Each run directory holds test.log (P503-RESULT, P503-ADOPT lines) and host_rpc.jsonl (the proxy's record). For every
row label (without its run id) it reports, per run: expected and observed outcome, KMS-mock hits, attempts, error
code; and, from the wire, what eth_getCode answered for the request (prefix and length; the proxy must have rewritten
nothing) and each isValidSignature call (gas, result). A row conforms when every run observed the expected outcome
with the test's own rule (refused: no KMS hit; forwarded: at least two).
"""
import collections
import json
import pathlib
import re
import sys

RESULT = re.compile(
    r"P503-RESULT label=(?P<label>\S+) version=(?P<version>\S+) tree=(?P<tree>\S+) expected=(?P<expected>\S+) "
    r"observed=(?P<observed>\S+) kms_mock_hits=(?P<kms>\S+) error_counter=(?P<ec>\S+) error_code=(?P<code>\S+) "
    r"wall_ms=(?P<wall>\d+)"
)
ADOPT = re.compile(r"P503-ADOPT account=(?P<account>\S+) source=(?P<source>\S+) code_len=(?P<len>\d+) "
                   r"code_hash=(?P<hash>\S+)")
ACCOUNTS_V0138 = re.compile(r"P503-ACCOUNTS X=(?P<account>\S+) code_source=NoErc1271 code_len=(?P<len>\d+) "
                            r"code_hash=(?P<hash>\S+)")
ERC1271 = "0x1626ba7e"


def wire_by_label(path):
    out = collections.defaultdict(lambda: {"getCode": [], "isValidSignature": [], "calls": 0, "rewritten": 0})
    for line in open(path, encoding="utf-8"):
        r = json.loads(line)
        label = r["path"].strip("/")
        w = out[label]
        w["calls"] += 1
        w["rewritten"] += bool(r.get("rewrite"))
        req = r["req"]
        resp = r.get("resp") or {}
        if req.get("method") == "eth_getCode":
            code = (resp.get("result") if isinstance(resp, dict) else None) or ""
            w["getCode"].append({"prefix": code[:8], "len": max(0, (len(code) - 2) // 2),
                                 "rewritten": bool(r.get("rewrite"))})
        elif req.get("method") == "eth_call":
            call = req["params"][0]
            data = (call.get("input") or call.get("data") or "")
            if data[:10].lower() == ERC1271:
                res = resp.get("result") if isinstance(resp, dict) else None
                err = (resp.get("error") or {}).get("message") if isinstance(resp, dict) else None
                w["isValidSignature"].append({"gas": int(call["gas"], 16) if call.get("gas") else None,
                                              "result": (res or "")[:10] or None, "error": err})
    return out


def conforms(o):
    if o["observed"] != o["expected"]:
        return False
    if o["expected"] == "Rejected":
        return o["kms_hits"] == "0"
    return o["kms_hits"].isdigit() and int(o["kms_hits"]) >= 2


def main():
    out_json, out_md = sys.argv[1], sys.argv[2]
    cells = collections.OrderedDict()
    runs, adopted, rewritten_total = [], [], 0
    for run_dir in map(pathlib.Path, sys.argv[3:]):
        text = (run_dir / "test.log").read_text(encoding="utf-8", errors="replace")
        wire = wire_by_label(run_dir / "host_rpc.jsonl")
        rewritten_total += sum(w["rewritten"] for w in wire.values())
        runs.append(str(run_dir.name))
        for m in list(ADOPT.finditer(text)) + list(ACCOUNTS_V0138.finditer(text)):
            adopted.append({"run": run_dir.name, **m.groupdict()})
        for m in RESULT.finditer(text):
            d = m.groupdict()
            parts = d["label"].split(".")  # p503.<run>.<tree>.<rest...>
            key = (d["version"], d["tree"], ".".join(parts[3:]))
            w = wire.get(d["label"], {"getCode": [], "isValidSignature": [], "calls": 0})
            cells.setdefault(key, []).append({
                "run": parts[1], "expected": d["expected"], "observed": d["observed"], "kms_hits": d["kms"],
                "attempts": d["ec"], "error_code": d["code"], "wall_ms": int(d["wall"]), "getCode": w["getCode"],
                "isValidSignature": w["isValidSignature"], "rpc_calls": w["calls"],
            })
    rows = []
    for (version, tree, row), obs in cells.items():
        codes = sorted({f"{g['prefix']}…({g['len']} B){'*' if g['rewritten'] else ''}" for o in obs for g in o["getCode"]})
        erc = sorted({f"{c['gas']}:{c['result'] or c['error']}" for o in obs for c in o["isValidSignature"]})
        rows.append({"version": version, "tree": tree, "row": row, "runs": len(obs),
                     "run_ids": sorted({o["run"] for o in obs}), "expected": obs[0]["expected"],
                     "observed": sorted({o["observed"] for o in obs}), "kms_hits": sorted({o["kms_hits"] for o in obs}),
                     "attempts": sorted({o["attempts"] for o in obs}), "error_codes": sorted({o["error_code"] for o in obs}),
                     "getCode": codes, "isValidSignature": erc, "conforms": all(conforms(o) for o in obs),
                     "observations": obs})
    hashes = sorted({(a["len"], a["hash"]) for a in adopted})
    report = {"runs": runs, "rows": rows, "adopted_code": adopted,
              "summary": {"rows": len(rows), "conforming": sum(r["conforms"] for r in rows),
                          "rows_with_three_runs": sum(r["runs"] == 3 for r in rows),
                          "rewritten_answers": rewritten_total, "adopted_code_kinds": [list(h) for h in hashes]}}
    s = report["summary"]
    md = ["# P0.3 connector matrix (generated by impl/harness/phase5/analyze_p503.py)", "",
          f"Rows conforming: {s['conforming']}/{s['rows']}; rows with three runs: {s['rows_with_three_runs']}; "
          f"answers rewritten by the proxy: {s['rewritten_answers']}. Adopted code (length, keccak256): "
          + "; ".join(f"{n} B {h}" for n, h in hashes) + ".", "",
          "getCode: the code the worker read for the request (prefix, length). isValidSignature: gas:result of each "
          "ERC-1271 call. A refused row conforms only with no KMS hit; a forwarded row with at least two.", "",
          "| Line | Tree | Row | Runs | Expected | Observed | KMS hits | Attempts | Error code | getCode | isValidSignature | OK |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append(f"| {r['version']} | {r['tree']} | {r['row']} | {r['runs']} | {r['expected']} | "
                  f"{'/'.join(r['observed'])} | {','.join(r['kms_hits'])} | {','.join(r['attempts'])} | "
                  f"{','.join(r['error_codes'])} | {' '.join(r['getCode']) or '-'} | {' '.join(r['isValidSignature']) or '-'} | "
                  f"{'yes' if r['conforms'] else '**NO**'} |")
    pathlib.Path(out_json).write_text(json.dumps(report, indent=1), encoding="utf-8")
    pathlib.Path(out_md).write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"{s['conforming']}/{s['rows']} rows conform over {len(runs)} runs; three runs: {s['rows_with_three_runs']}; "
          f"rewritten: {s['rewritten_answers']}; adopted code kinds: {hashes}")


if __name__ == "__main__":
    main()
