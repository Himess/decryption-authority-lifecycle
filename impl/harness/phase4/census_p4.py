"""Phase 4 census refresh and Profile Q readiness indicator (P1.2 Q2, P2.5): read-only, aggregates only.

Usage: python -I census_p4.py <raw_dir> <out_dir> [--to-block N] [--skip-scan]
  raw_dir  where the per-address rows go (acl_rows.tsv, acl_other.tsv, block_ts.json, codes.json). It must be OUTSIDE
           the project: raw per-address data is never published (brief, export exclusions).
  out_dir  where the aggregate JSON goes (results/phase4/raw/census/). Nothing per-address is written there.

Method: the Phase 2 census (results/review/04_census/scripts/scan.mjs and codecheck.mjs), rewritten in Python:
  1. eth_getLogs on the mainnet ACL (v0.4.0) for Allowed, AllowedForDecryption, DelegatedForUserDecryption and
     RevokedDelegationForUserDecryption, from block 23,832,647 to the head, 10,000 blocks per call, split while a
     call returns >= 9,990 logs or a "too many results" error; the same two endpoints, alternating;
  2. block timestamps every 50,000 blocks, interpolated;
  3. Phase 2's definitions: an end account received >= 1 Allowed from some caller and never itself called allow;
     self-allows are excluded; the two operations/smoke-test callers of Phase 2 are excluded for "real" accounts;
  4. a check of the pipeline: the totals on Phase 2's window (to block 26,237,004) must equal Phase 2's;
  5. active end accounts: real end accounts that received >= 1 handle in the 90 days before the head; their code at
     the head (eth_getCode, batched): none, an EIP-7702 indicator (0xef0100), an EIP-7851 indicator (0xef0101), or
     other code;
  6. for other code, one ERC-1271 probe at the head: isValidSignature(0x00..01, 2,420 zero bytes) at Profile H's gas
     (B_exec 2,000,000 + 21,000 + 64 x calldata) and at Zama's 250,000;
  7. delegations: the latest event per (delegator, delegate, contract) decides whether it is active at the head.
Rate: at most 8 JSON-RPC calls per second, counting each call inside a batch. No transaction is ever sent.
"""
import json
import os
import sys
import time
import urllib.request

ACL = "0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6"
TOPICS = {
    "Allowed": "0xe2e1decee6e05ee246cd7c7f1337d25cdfd41dcbdcf8c57b61630be56cc7366a",
    "AFD": "0xd913ac93a959116526793ef772233273d5249597d33cddfdc34f29920541fd0a",
    "Deleg": "0x527b025d7ff06689c1ab9d32dfd7881c964cce72ce8ac5b2fe1d3be8cfda5bfc",
    "Revoke": "0x7aca80b6b7928b9038f186e3d9922a0fc5d52c398fbf144725c142c52a5277e4",
}
LOG_URLS = ["https://gateway.tenderly.co/public/mainnet", "https://rpc.mevblocker.io"]
CODE_URL = "https://ethereum-rpc.publicnode.com"
START0 = 23_832_647
PHASE2_END = 26_237_004
PHASE2 = {"allowed_events_total": 939_889, "self_allow_events": 455_183, "distinct_callers": 336,
          "accounts_receiving_allows": 12_792, "end_accounts": 12_720, "real_end_accounts": 12_714}
OPS_CALLERS = {"8073362b2467c54b242e26d62b5a66c6058f2274", "7bb8786a7054da071f9c6613662ac89827bd76a7"}
ACTIVE_DAYS = 90
B_EXEC = 2_000_000
ZAMA_CAP = 250_000
MAX_CALLS_PER_SEC = 8

_calls = [0, time.time()]
_ui = [0]


def throttle(n):
    _calls[0] += n
    elapsed = time.time() - _calls[1]
    need = _calls[0] / MAX_CALLS_PER_SEC
    if need > elapsed:
        time.sleep(need - elapsed)


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", "user-agent": "lifecycle-readonly"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def rpc(method, params, url=None):
    for attempt in range(8):
        u = url or LOG_URLS[_ui[0] % len(LOG_URLS)]
        _ui[0] += 1
        throttle(1)
        try:
            j = post(u, {"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
            if "error" in j:
                msg = json.dumps(j["error"])
                if method == "eth_getLogs" and any(s in msg.lower() for s in ("more than", "too many", "range")):
                    return {"tooMany": True}
                raise RuntimeError(msg[:200])
            return j["result"]
        except Exception as e:  # noqa: BLE001
            sys.stderr.write(f"retry {attempt} {method} {str(e)[:160]}\n")
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"rpc failed: {method}")


def batch(calls, url=CODE_URL):
    for attempt in range(6):
        throttle(len(calls))
        try:
            j = post(url, [{"jsonrpc": "2.0", "id": i, "method": m, "params": p} for i, (m, p) in enumerate(calls)])
            if not isinstance(j, list):
                raise RuntimeError("not a batch reply")
            by_id = {x["id"]: x for x in j}
            return [by_id[i] for i in range(len(calls))]
        except Exception as e:  # noqa: BLE001
            sys.stderr.write(f"batch retry {attempt} {str(e)[:160]}\n")
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("batch failed")


def scan(raw, start, end, append):
    rows = open(os.path.join(raw, "acl_rows.tsv"), "a" if append else "w", encoding="utf-8")
    other = open(os.path.join(raw, "acl_other.tsv"), "a" if append else "w", encoding="utf-8")
    total = [0]

    def get_range(a, b):
        logs = rpc("eth_getLogs", [{"address": ACL, "fromBlock": hex(a), "toBlock": hex(b),
                                    "topics": [list(TOPICS.values())]}])
        too_many = isinstance(logs, dict) and logs.get("tooMany")
        if (too_many or len(logs) >= 9990) and b > a:
            m = (a + b) // 2
            get_range(a, m)
            get_range(m + 1, b)
            return
        if too_many:
            raise RuntimeError(f"single block too many logs {a}")
        for log in logs:
            bn = int(log["blockNumber"], 16)
            t0 = log["topics"][0]
            if t0 == TOPICS["Allowed"]:
                rows.write(f"{bn}\t{log['topics'][1][26:]}\t{log['topics'][2][26:]}\t{log['data'][2:66]}\n")
                total[0] += 1
            elif t0 == TOPICS["AFD"]:
                n = int(log["data"][2 + 64:2 + 128], 16)
                other.write(f"AFD\t{bn}\t{log['topics'][1][26:]}\t{n}\n")
            elif t0 == TOPICS["Deleg"]:
                contract = "0x" + log["data"][2 + 24:2 + 64]
                w = log["data"][2:]
                new_exp = int(w[64 * 3:64 * 4] or "0", 16)
                other.write(f"DEL\t{bn}\t{log['topics'][1][26:]}\t{log['topics'][2][26:]}\t{contract}\t{new_exp}\n")
            elif t0 == TOPICS["Revoke"]:
                contract = "0x" + log["data"][2 + 24:2 + 64]
                other.write(f"REV\t{bn}\t{log['topics'][1][26:]}\t{log['topics'][2][26:]}\t{contract}\n")

    t = time.time()
    step = 10_000
    for i, a in enumerate(range(start, end + 1, step)):
        get_range(a, min(end, a + step - 1))
        if i % 20 == 0:
            print(f"scan block {a} allowed_rows={total[0]} elapsed={time.time() - t:.0f}s", flush=True)
    rows.close()
    other.close()
    ts = []
    n = START0
    while True:
        bn = min(n, end)
        blk = rpc("eth_getBlockByNumber", [hex(bn), False])
        ts.append([bn, int(blk["timestamp"], 16)])
        if bn == end:
            break
        n += 50_000
    json.dump(ts, open(os.path.join(raw, "block_ts.json"), "w"))
    return total[0]


def interp(ts):
    tb = [t[0] for t in ts]
    tt = [t[1] for t in ts]

    def btime(b):
        for i in range(1, len(tb)):
            if b <= tb[i]:
                return tt[i - 1] + (tt[i] - tt[i - 1]) * (b - tb[i - 1]) / max(1, tb[i] - tb[i - 1])
        return tt[-1] + (b - tb[-1]) * 12
    return btime


def end_accounts(raw, to_block):
    callers, acct_handles, acct_last, self_rows, total = set(), {}, {}, 0, 0
    with open(os.path.join(raw, "acl_rows.tsv"), encoding="utf-8") as f:
        for line in f:
            b, c, a, h = line.rstrip("\n").split("\t")
            b = int(b)
            if b > to_block:
                continue
            total += 1
            callers.add(c)
            if a == c:
                self_rows += 1
                continue
            acct_handles.setdefault(a, {}).setdefault(int(h[:16], 16), c)
            if b > acct_last.get(a, -1):
                acct_last[a] = b
    end = [a for a in acct_handles if a not in callers]
    real = [a for a in end if any(c not in OPS_CALLERS for c in acct_handles[a].values())]
    return {"allowed_events_total": total, "self_allow_events": self_rows, "distinct_callers": len(callers),
            "accounts_receiving_allows": len(acct_handles), "end_accounts": len(end), "real_end_accounts": len(real)}, \
        real, acct_handles, acct_last


def classify(code):
    if not code or code == "0x":
        return "eoa"
    n = (len(code) - 2) // 2
    if n == 23 and code.startswith("0xef0100"):
        return "eoa_7702"
    if n == 23 and code.startswith("0xef0101"):
        return "eip7851"
    return "contract"


def probe_calldata():
    # isValidSignature(bytes32 hash, bytes signature) with a 2,420-byte zero signature (ML-DSA-44 size).
    sel = "1626ba7e"
    h = "00" * 31 + "01"
    off = f"{64:064x}"
    sig_len = 2420
    padded = (sig_len + 31) // 32 * 32
    return "0x" + sel + h + off + f"{sig_len:064x}" + "00" * padded, 4 + 32 + 32 + 32 + padded


def main():
    raw, out = sys.argv[1], sys.argv[2]
    to_block = None
    if "--to-block" in sys.argv:
        to_block = int(sys.argv[sys.argv.index("--to-block") + 1])
    proj = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    if os.path.abspath(raw).startswith(proj):
        sys.exit("census_p4: raw_dir must be outside the project")
    os.makedirs(raw, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    head = int(rpc("eth_blockNumber", [], url=CODE_URL), 16)
    end = to_block or head
    if "--skip-scan" not in sys.argv:
        scan(raw, START0, end, append=False)
    ts = json.load(open(os.path.join(raw, "block_ts.json")))
    end = ts[-1][0]
    btime = interp(ts)

    p2_totals, _, _, _ = end_accounts(raw, PHASE2_END)
    reproduces = {k: (p2_totals[k], PHASE2[k], p2_totals[k] == PHASE2[k]) for k in PHASE2}
    totals, real, acct_handles, acct_last = end_accounts(raw, end)

    head_ts = btime(end)
    active_cut = head_ts - ACTIVE_DAYS * 86_400
    active = [a for a in real if btime(acct_last[a]) >= active_cut]

    codes_path = os.path.join(raw, "codes.json")
    codes = json.load(open(codes_path)) if os.path.exists(codes_path) else {}
    todo = [a for a in active if a not in codes]
    for i in range(0, len(todo), 25):
        chunk = todo[i:i + 25]
        res = batch([("eth_getCode", ["0x" + a, hex(end)]) for a in chunk])
        for a, r in zip(chunk, res):
            if "error" in r:
                raise RuntimeError("getCode error")
            codes[a] = r["result"]
        if i % 500 == 0:
            json.dump(codes, open(codes_path, "w"))
            print(f"codes {i}/{len(todo)}", flush=True)
    json.dump(codes, open(codes_path, "w"))

    kinds = {"eoa": [], "eoa_7702": [], "eip7851": [], "contract": []}
    for a in active:
        kinds[classify(codes[a])].append(a)
    data, calldata_len = probe_calldata()
    gas_h = B_EXEC + 21_000 + 64 * calldata_len
    probes = {}
    for a in kinds["contract"]:
        res = batch([("eth_call", [{"to": "0x" + a, "data": data, "gas": hex(g)}, hex(end)]) for g in (gas_h, ZAMA_CAP)])
        out_h = []
        for r in res:
            if "error" in r:
                msg = json.dumps(r["error"]).lower()
                has_data = isinstance(r["error"].get("data"), str) and len(r["error"]["data"]) > 2
                out_h.append("out_of_gas" if "gas" in msg and not has_data else "revert_with_data" if has_data
                             else "empty_revert")
            else:
                v = r["result"]
                out_h.append("magic" if v[:10] == "0x1626ba7e" else "returned_32+" if len(v) >= 66
                             else "empty_return" if v == "0x" else "short_return")
        probes[a] = out_h

    def count(vals):
        c = {}
        for v in vals:
            c[v] = c.get(v, 0) + 1
        return dict(sorted(c.items()))

    handles = {a: len(acct_handles[a]) for a in active}
    all_handles = sum(handles.values())
    completes = [a for a in kinds["contract"] if probes[a][0] in ("returned_32+", "magic", "revert_with_data")]
    # The latest event per (delegator, delegate, contract) decides: a delegation sets the expiry, a revocation clears it.
    deleg = {}
    for line in open(os.path.join(raw, "acl_other.tsv"), encoding="utf-8"):
        f = line.rstrip("\n").split("\t")
        if f[0] not in ("DEL", "REV") or int(f[1]) > end:
            continue
        key = (f[2], f[3], f[4].lower())
        exp = int(f[5]) if f[0] == "DEL" else 0
        if int(f[1]) >= deleg.get(key, (-1, 0))[0]:
            deleg[key] = (int(f[1]), exp)
    active_deleg = [k for k, v in deleg.items() if v[1] > head_ts]
    result = {
        "meta": {"what": "Phase 4 census refresh (read-only eth_getLogs, eth_getCode, eth_call); aggregates only",
                 "acl": f"{ACL} (ACL v0.4.0)", "blocks": [START0, end], "head_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(head_ts)),
                 "run_started_utc": started, "run_finished_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                 "endpoints": LOG_URLS + [CODE_URL], "active_days": ACTIVE_DAYS, "max_calls_per_sec": MAX_CALLS_PER_SEC,
                 "probe": {"signature_bytes": 2420, "calldata_bytes": calldata_len, "gas_profile_h": gas_h, "gas_zama": ZAMA_CAP}},
        "reproduces_phase2_window": reproduces,
        "totals_to_head": totals,
        "active_end_accounts": len(active),
        "active_by_code": {k: len(v) for k, v in kinds.items()},
        "active_handles_by_code": {k: sum(handles[a] for a in v) for k, v in kinds.items()},
        "contract_probe_profile_h_gas": count(probes[a][0] for a in kinds["contract"]),
        "contract_probe_zama_gas": count(probes[a][1] for a in kinds["contract"]),
        "delegations_active_at_head": len(active_deleg),
        "readiness": {
            "population": "real end accounts active in the last 90 days (Phase 2 definitions)",
            "proven_pq_capable_accounts": len(kinds["eip7851"]),
            "kda_declarations_identifiable": 0,
            "candidates_contracts_completing_erc1271_within_b_exec": len(completes),
            "share_accounts_proven": round(len(kinds["eip7851"]) / max(1, len(active)), 5),
            "share_accounts_upper_bound": round((len(kinds["eip7851"]) + len(completes)) / max(1, len(active)), 5),
            "share_handles_upper_bound": round(sum(handles[a] for a in completes + kinds["eip7851"]) / max(1, all_handles), 5),
        },
    }
    with open(os.path.join(out, "census_p4_aggregate.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
