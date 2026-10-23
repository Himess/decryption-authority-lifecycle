"""Per-call RPC latency of the Level 1 connector run (Profile H in the kms-worker), from the JSON-RPC recorder's wire
record. Each record holds t0 (the recorder received the connector's request) and t (anvil's answer was back), as in
the Level 0 latency analysis (results/level0/CONNECTOR_PROOF.md section 9).

Usage: python -I latency_level1.py <host_rpc.jsonl>
"""
import json
import statistics
import sys

SELECTORS = {
    "0x82027b6d": "isAllowed",
    "0xd09c0dee": "isHandleDelegatedForUserDecryption",
    "0x0dff1525": "decryptionSignatureInvalidatedBefore",
    "0xb279091e": "isAccountRetired",
    "0x1626ba7e": "isValidSignature",
}


def kind(record):
    method = record["req"]["method"]
    if method != "eth_call":
        return method
    call = record["req"]["params"][0]
    data = call.get("input") or call.get("data") or ""
    return "eth_call " + SELECTORS.get(data[:10], data[:10])


def quantile(values, p):
    values = sorted(values)
    k = (len(values) - 1) * p
    f = int(k)
    c = min(f + 1, len(values) - 1)
    return values[f] + (values[c] - values[f]) * (k - f)


def main():
    rows = [json.loads(line) for line in open(sys.argv[1], encoding="utf-8") if line.strip()]
    groups = {}
    for r in rows:
        groups.setdefault(kind(r), []).append((r["t"] - r["t0"]) * 1000)
    print(f"{len(rows)} records, {len({r['path'] for r in rows})} requests; ms from the recorder's receipt to anvil's answer")
    print(f"{'call':48s} {'n':>4s} {'median':>7s} {'p10':>6s} {'p90':>6s} {'max':>6s}")
    for name, values in sorted(groups.items(), key=lambda item: -len(item[1])):
        print(
            f"{name:48s} {len(values):4d} {statistics.median(values):7.2f} {quantile(values, 0.1):6.2f} "
            f"{quantile(values, 0.9):6.2f} {max(values):6.2f}"
        )


if __name__ == "__main__":
    main()
