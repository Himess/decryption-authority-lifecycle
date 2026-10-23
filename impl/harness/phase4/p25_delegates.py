"""P2.5, step 1: the EIP-7702 delegates of mainnet end accounts, by code hash (read-only, aggregates only).

Usage: python -I p25_delegates.py <raw_dir> <out_dir>
  raw_dir  the P1.2 census directory (outside the project): acl_rows.tsv, block_ts.json, codes.json. Per-address data
           written here stays here: codes.json (extended to every real end account), delegate_codes.json.
  out_dir  results/phase4/raw/p25/: delegates_aggregate.json, only counts per code hash, with each delegate
           implementation's code hash, size and Sourcify name. No end account appears there.

Method, at the census head (the last block of block_ts.json, the P1.2 refresh):
  1. every real end account's code (eth_getCode, batched; codes already fetched in P1.2 are reused);
  2. accounts with an EIP-7702 indicator (0xef0100 || delegate) are grouped by delegate;
  3. each delegate's code at the head; delegates are grouped by keccak256 of their runtime code;
  4. Sourcify (v2 API, read-only) names each delegate address where it is verified.
Uses census_p4.py's RPC helpers and rate limit (at most 8 JSON-RPC calls a second, batches counted per call). Codes are
read at the census head from the census's two log endpoints, alternating (tenderly and mevblocker): on 2026-10-22 the
code endpoint P1.2 used (publicnode) started to require a personal token for archive reads.
"""
import collections
import hashlib
import importlib.util
import json
import os
import sys
import urllib.request


def load_census():
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("census_p4", os.path.join(here, "census_p4.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def keccak_hex(code_hex):
    # Keccak-256 (Ethereum's), not SHA3-256; pycryptodome's implementation (installed in M1's base Python).
    from Crypto.Hash import keccak  # noqa: PLC0415
    k = keccak.new(digest_bits=256)
    k.update(bytes.fromhex(code_hex[2:] if code_hex.startswith("0x") else code_hex))
    return "0x" + k.hexdigest()


def sourcify_name(address, chain_id=1):
    url = f"https://sourcify.dev/server/v2/contract/{chain_id}/{address}?fields=compilation"
    try:
        req = urllib.request.Request(url, headers={"user-agent": "lifecycle-readonly"})
        with urllib.request.urlopen(req, timeout=30) as r:
            j = json.loads(r.read())
        comp = j.get("compilation") or {}
        return comp.get("name"), j.get("match") or j.get("runtimeMatch")
    except Exception:  # noqa: BLE001  (404: not verified)
        return None, None


BATCH = 10


def codes_at(c, addrs, block, which):
    """eth_getCode for up to BATCH addresses at `block`, alternating the census endpoints; failed calls are retried on
    the other endpoint. The tenderly gateway refuses batches above 10 calls (HTTP 429), so BATCH is 10."""
    urls = c.LOG_URLS
    res = c.batch([("eth_getCode", ["0x" + a, hex(block)]) for a in addrs], url=urls[which % len(urls)])
    got = {}
    for a, r in zip(addrs, res):
        if "error" in r:
            rr = c.batch([("eth_getCode", ["0x" + a, hex(block)])], url=urls[(which + 1) % len(urls)])[0]
            if "error" in rr:
                raise RuntimeError(f"getCode error: {rr['error']}")
            r = rr
        got[a] = r["result"]
    return got


def main():
    raw, out = sys.argv[1], sys.argv[2]
    proj = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    if os.path.abspath(raw).startswith(proj):
        sys.exit("p25_delegates: raw_dir must be outside the project")
    os.makedirs(out, exist_ok=True)
    c = load_census()
    ts = json.load(open(os.path.join(raw, "block_ts.json")))
    head = ts[-1][0]
    totals, real, _, _ = c.end_accounts(raw, head)

    codes_path = os.path.join(raw, "codes.json")
    codes = json.load(open(codes_path)) if os.path.exists(codes_path) else {}
    todo = [a for a in real if a not in codes]
    print(f"head {head}: {len(real)} real end accounts, {len(todo)} codes to fetch", flush=True)
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        codes.update(codes_at(c, chunk, head, i // BATCH))
        if i % 1000 == 0:
            json.dump(codes, open(codes_path, "w"))
            print(f"codes {i}/{len(todo)}", flush=True)
    json.dump(codes, open(codes_path, "w"))

    kinds = collections.Counter(c.classify(codes[a]) for a in real)
    by_delegate = collections.Counter()
    for a in real:
        code = codes[a]
        if c.classify(code) == "eoa_7702":
            by_delegate[code[8:].lower()] += 1  # the 20-byte delegate after 0xef0100

    dpath = os.path.join(raw, "delegate_codes.json")
    dcodes = json.load(open(dpath)) if os.path.exists(dpath) else {}
    dtodo = [d for d in by_delegate if d not in dcodes]
    for i in range(0, len(dtodo), BATCH):
        chunk = dtodo[i:i + BATCH]
        dcodes.update(codes_at(c, chunk, head, i // BATCH))
    json.dump(dcodes, open(dpath, "w"))

    groups = {}
    for d, n in by_delegate.items():
        code = dcodes[d]
        h = keccak_hex(code) if code not in ("0x", "") else "empty"
        g = groups.setdefault(h, {"code_hash": h, "code_bytes": (len(code) - 2) // 2, "accounts": 0,
                                  "delegates": 0, "names": set(), "delegate_kind": c.classify(code)})
        g["accounts"] += n
        g["delegates"] += 1
    for d in by_delegate:
        code = dcodes[d]
        h = keccak_hex(code) if code not in ("0x", "") else "empty"
        name, match = sourcify_name("0x" + d)
        if name:
            groups[h]["names"].add(f"{name} ({match})")
    rows = sorted(groups.values(), key=lambda g: -g["accounts"])
    for g in rows:
        g["names"] = sorted(g["names"])
    result = {
        "meta": {"what": "P2.5: EIP-7702 delegates of mainnet real end accounts, grouped by delegate code hash "
                         "(read-only eth_getCode at the census head; Sourcify names); aggregates only",
                 "head_block": head, "census_totals": totals},
        "end_accounts_by_code_kind": dict(kinds),
        "eip7702_accounts": sum(by_delegate.values()),
        "distinct_delegates": len(by_delegate),
        "distinct_delegate_codes": len(rows),
        "groups": rows,
    }
    with open(os.path.join(out, "delegates_aggregate.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, indent=1)
    # The bytecode of each delegate implementation (public contract code) for the local matrix; kept with the raw data.
    with open(os.path.join(raw, "delegate_code_by_hash.json"), "w") as f:
        json.dump({(keccak_hex(dcodes[d]) if dcodes[d] not in ("0x", "") else "empty"): dcodes[d] for d in by_delegate}, f)
    print(json.dumps({k: result[k] for k in ("end_accounts_by_code_kind", "eip7702_accounts", "distinct_delegates",
                                             "distinct_delegate_codes")}, indent=1))


if __name__ == "__main__":
    main()
