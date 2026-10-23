"""P2.5, step 3: what Profile H's `enforce` would refuse today, for all real end accounts and for the active ones.

Usage: python -I p25_impact.py <raw_dir> <out_dir>
Joins, in memory, the per-address data kept outside the project (codes.json, delegate_code_by_hash.json, the census
rows) with the per-code verdicts of h2_matrix_r1.json, and writes only counts: <out_dir>/impact_aggregate.json.
Active: a real end account that received a handle in the 90 days before the census head (P1.2's definition).
"""
import importlib.util
import json
import os
import sys


def main():
    raw, out = sys.argv[1], sys.argv[2]
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("census_p4", os.path.join(here, "census_p4.py"))
    c = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(c)
    ts = json.load(open(os.path.join(raw, "block_ts.json")))
    head = ts[-1][0]
    btime = c.interp(ts)
    _, real, acct_handles, acct_last = c.end_accounts(raw, head)
    active = {a for a in real if btime(acct_last[a]) >= btime(head) - c.ACTIVE_DAYS * 86_400}
    codes = json.load(open(os.path.join(raw, "codes.json")))
    dcodes = json.load(open(os.path.join(raw, "delegate_codes.json")))
    by_hash = json.load(open(os.path.join(raw, "delegate_code_by_hash.json")))
    hash_of_code = {code: h for h, code in by_hash.items()}
    matrix = json.load(open(os.path.join(out, "h2_matrix_r1.json")))
    verdict = {r["code_hash"]: (r["verdict"], r["label"]) for r in matrix["rows"]}
    result = {"head_block": head, "real_end_accounts": len(real), "active_end_accounts": len(active)}
    for scope, accounts in (("all", real), ("active", active)):
        t = {"eoa": 0, "contract": 0, "eip7851": 0, "eoa_7702": 0,
             "erc1271_M": 0, "erc1271_E": 0, "shim_M": 0, "shim_E": 0, "refused_M": 0, "refused_E": 0,
             "handles_refused": 0, "handles_all": 0}
        for a in accounts:
            kind = c.classify(codes[a])
            t[kind] += 1
            t["handles_all"] += len(acct_handles[a])
            if kind != "eoa_7702":
                continue
            code = dcodes[codes[a][8:].lower()]
            h = hash_of_code[code] if code not in ("0x", "") else "empty"
            v, label = verdict[h]
            t[f"{v}_{label}"] += 1
            if v == "refused":
                t["handles_refused"] += len(acct_handles[a])
        result[scope] = t
    with open(os.path.join(out, "impact_aggregate.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
