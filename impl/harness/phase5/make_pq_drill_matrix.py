"""Builds results/phase5/PQ_DRILL_MATRIX.md (Phase 5, B6) from the two drill analyses.

Usage: python -I make_pq_drill_matrix.py <connector.json> <local.json> <out.md>

<connector.json> is analyze_pq_drill.py's output over the connector runs (VPS); <local.json> is
analyze_pq_drill_local.py's over the local runs (M1). Rows are the old key's actions and the holder's checks; columns
are the paths. A cell is the outcome every run observed, with the run count; a residual names its cause and what closes
it. A cell whose runs disagree, or that differs from the design, is marked.
"""
import json
import sys

PATHS = ["B1", "B2d", "B2c", "B3a", "B3b"]
# (row id, label, source group, action) for requests through the connector.
REQUESTS = [
    ("R1", "Old key: a new permit, RFC-016 on chain", "pre", "R1.permit.v2-direct"),
    ("R2", "Old key: a new permit, RFC-016 over HTTP", "pre", "R2.permit.v2-http"),
    ("R3", "Old key: the legacy gateway path, as user", "pre", "R3.legacy-direct"),
    ("R4", "Old key as V's delegate (V delegated to A before), RFC-016", "pre", "R4.v2-delegated.a-for-v"),
    ("R5", "Old key as V's delegate, legacy path", "pre", "R5.legacy-delegated.a-for-v"),
    ("R6", "D for A, through A's delegation made before the migration", "pre", "R6.v2-delegated.d-for-a"),
    ("E1-off", "The attacker after the old key's forged grant (T1), Profile Q off", "effect-q-off", "E1.attacker-after-forged-grant"),
    ("E1-on", "The same, Profile Q on (after B_Q)", "effect-q-on", "E1.attacker-after-forged-grant"),
    ("E2-off", "The attacker's KDA declared by the old key (T3), Profile Q off", "effect-q-off", "E2.attacker-kda"),
    ("E2-on", "The same, Profile Q on (after B_Q)", "effect-q-on", "E2.attacker-kda"),
    ("U-R6", "R6 after the holder revoked D's delegation through `execute`", "undone", "R6.v2-delegated.d-for-a"),
    ("U-E2", "E2 after the holder revoked the attacker's KDA through `execute`", "undone", "E2.attacker-kda"),
    ("P1", "Holder's post-quantum key: the whole history (3 handles, ERC-1271)", "pre", "P1.history.h0"),
    ("P1h", "Holder's post-quantum key over HTTP", "pre", "P1.history.h0.http"),
    ("P2", "Holder's own KDA (E3)", "pre", "P2.e3.kda"),
    ("P3", "A handle granted to A after the migration, read by the holder", "pre", "P3.late-grant"),
    ("Q-P1", "Profile Q after B_Q: the holder's ERC-1271 request", "q", "Q.P1.history.h0"),
    ("Q-P2", "Profile Q after B_Q: the holder's KDA", "q", "Q.P2.e3.kda"),
    ("P4", "Holder after the old key retired A (T8)", "after-t8", "P4.holder-after-retirement"),
]
TXS = [
    ("T1", "Old key: grant a handle to the attacker (`allow`)", "T1.allow"),
    ("T2", "Old key: publish a handle (`allowForDecryption`)", "T2.allowForDecryption"),
    ("T3", "Old key: delegate to the attacker's KDA", "T3.delegate-to-kda"),
    ("T4", "Old key: designate the attacker as successor", "T4.designateSuccessor"),
    ("T5", "Old key: confirm a successor", "T5.confirmSuccessor"),
    ("T6", "A new certificate naming the attacker (signed by the old key)", "T6.certificate"),
    ("T7", "Old key: invalidate the permits signed before a time", "T7.invalidateSignaturesBefore"),
    ("T8", "Old key: retire the account", "T8.retireAccount"),
]
RESIDUAL = {
    ("R6", "B3a"): "residual until revoked: a delegation A made before migrating stands (A is not retired). Closed by the holder's revocation through `execute` (U-R6)",
    ("R6", "B3b"): "residual until revoked, as B3a. Closed by revocation (U-R6)",
    ("E1-off", "B3a"): "residual: on this local chain the old key's grant (T1) is mined, and the attacker it names reads with its own valid key. Closed by a host chain enforcing EIP-7851 (the key's transactions invalid). Profile Q refuses this attacker (E1-on) only because it signs with ECDSA: a grant to an attacker's post-quantum wallet would be served (Phase 4 P1.2 §2.4, the asserted residual)",
    ("E1-off", "B3b"): "residual: as B3a; closed only by a host chain enforcing EIP-8298 (anvil does not apply EIP-3607, which makes the key's transactions invalid once the account has regular code)",
    ("E2-off", "B3a"): "residual: the old key's delegation to the attacker's KDA is mined and served. Closed by the host chain (EIP-7851), or by Profile Q after B_Q (E2-on)",
    ("E2-off", "B3b"): "residual: as B3a. Profile Q does not close it (E2-on): only the host chain (EIP-8298)",
    ("E2-on", "B3b"): "residual: the delegation was made after B_Q, but B3b's code was already regular at B_Q, so Q5 does not cut it off. On a host chain enforcing EIP-8298 the old key could not have sent it (EIP-3607); Q7 limits Profile Q's claims to such chains",
    ("T1", "B3a"): "residual: mined on this local chain (it accepts the old key's transactions). Closed by a host chain enforcing EIP-7851",
    ("T1", "B3b"): "residual: mined here (anvil does not apply EIP-3607 to the simulated adoption); closed by a host chain enforcing EIP-8298",
    ("T2", "B3a"): "residual: mined (publication is irreversible). Closed by EIP-7851 enforcement",
    ("T2", "B3b"): "residual: mined; closed by EIP-8298 enforcement",
    ("T3", "B3a"): "residual: mined; the holder can revoke it (U-E2), the old key can redo it. Closed by EIP-7851 enforcement",
    ("T3", "B3b"): "residual: mined; revocable by the holder; closed by EIP-8298 enforcement",
    ("T4", "B3a"): "residual: mined, but it must mature (D) and be accepted; the holder cancels it through `execute`. Closed by EIP-7851 enforcement",
    ("T4", "B3b"): "residual: as B3a; closed by EIP-8298 enforcement",
    ("T7", "B3a"): "residual (availability): the holder's permits signed before the time stop counting; the holder signs new ones",
    ("T7", "B3b"): "residual (availability), as B3a",
    ("T8", "B3a"): "residual (availability): the old key retires A, which ends the wallet's authority too (P4). Closed by EIP-7851 enforcement",
    ("T8", "B3b"): "residual (availability): as B3a; closed by EIP-8298 enforcement",
}
BY_DESIGN = {
    ("P2", "B2d"): "refused by design: a successor's KDA does not reach A's handles (S9; D98)",
    ("P2", "B2c"): "refused by design (S9; D98)",
    ("P3", "B1"): "not followed by design: a grant to a retired account is inert (R8); the application grants to W, or A also names W as successor",
}


def word(observed):
    o = "/".join(observed)
    return {"Rejected": "refused", "Forwarded": "served", "reverted": "reverted", "mined": "mined"}.get(o, o)


def main():
    conn = json.load(open(sys.argv[1], encoding="utf-8"))
    local = json.load(open(sys.argv[2], encoding="utf-8"))
    out = sys.argv[3]
    reqs = {(r["group"], r["path"], r["action"]): r for r in conn["rows"]}
    txs = {(t["path"], t["action"]): t for t in conn["transactions"]}
    md = ["# PQ drill matrix (B6): the old key after each path", "",
          f"Generated by `impl/harness/phase5/make_pq_drill_matrix.py` from the connector runs ({', '.join(conn['runs'])}; "
          "the real Phase 5 kms-worker on the VPS) and the local runs (M1). A cell is what every run observed; `×n` is the "
          "number of runs; **!** marks a cell whose runs disagree or that differs from the design. Our own test keys play the "
          "old key and the attacker.", "",
          "Paths: **B1** carry then retire; **B2d** successor, A retires; **B2c** successor, certificate relayed; **B3a** in "
          "place, EIP-7851 simulated; **B3b** in place, EIP-8298 simulated.", "",
          "Order on the one chain: every path completes; the old key's off-chain requests and the holder's requests run; "
          "13 operators sign Profile Q for B_Q; after B_Q the old key sends T1–T7, and its effects are read with Profile Q "
          "off and on; then B4 (Q, and k = 8 and 9 of 13); then Q5 for adopted code and for a succession; T8 last.", "",
          "## Requests through the worker [M] (Connector)", "",
          "| Row | Action | " + " | ".join(PATHS) + " |", "|---|---|" + "---|" * len(PATHS)]
    notes = []
    for rid, label, group, action in REQUESTS:
        cells = []
        for p in PATHS:
            r = reqs.get((group, p, action))
            if r is None:
                cells.append("—")
                continue
            ok = r["conforms"] and r["runs"] == len(conn["runs"])
            text = f"{word(r['observed'])} ×{r['runs']}"
            codes = [c for c in r["error_codes"] if c != "-"]
            if codes:
                text += f" (`{','.join(codes)}`)"
            if (rid, p) in RESIDUAL:
                text += f" ⚠{len(notes) + 1}"
                notes.append(f"{len(notes) + 1}. **{rid}, {p}:** {RESIDUAL[(rid, p)]}.")
            elif (rid, p) in BY_DESIGN:
                text += f" †{len(notes) + 1}"
                notes.append(f"{len(notes) + 1}. **{rid}, {p}:** {BY_DESIGN[(rid, p)]}.")
            cells.append(text + ("" if ok else " **!**"))
        md.append(f"| {rid} | {label} | " + " | ".join(cells) + " |")
    md += ["", "## Transactions sent with the old key [M] (Connector; the local runs agree, below)", "",
           "| Row | Action | " + " | ".join(PATHS) + " |", "|---|---|" + "---|" * len(PATHS)]
    for rid, label, action in TXS:
        cells = []
        for p in PATHS:
            t = txs.get((p, action))
            if t is None:
                cells.append("—")
                continue
            ok = t["conforms"] and t["runs"] == len(conn["runs"])
            errs = [e for e in t["errors"] if e != "-"]
            text = f"{word(t['observed'])} ×{t['runs']}" + (f" (`{','.join(errs)}`)" if errs else "")
            if (rid, p) in RESIDUAL:
                text += f" ⚠{len(notes) + 1}"
                notes.append(f"{len(notes) + 1}. **{rid}, {p}:** {RESIDUAL[(rid, p)]}.")
            elif rid == "T7" and p in ("B1", "B2d", "B2c"):
                text += " (harmless: A is retired)"
            cells.append(text + ("" if ok else " **!**"))
        md.append(f"| {rid} | {label} | " + " | ".join(cells) + " |")
    md += ["", "## Notes", ""] + notes
    # The local runs: the same transactions, the SDK, B5.
    for hf, v in local["hardforks"].items():
        s = v["summary"]
        md += ["", f"## Local runs, {hf} [M] (Mock): {s['conforming']}/{s['rows']} rows conform over {len(local['runs'][hf])} runs", "",
               "| Kind | Path | What | Runs | Observed | OK |", "|---|---|---|---|---|---|"]
        for x in v["rows"]:
            if x["kind"] in ("tx", "sdk-status", "sdk-precheck", "b5", "canary", "undo"):
                md.append(f"| {x['kind']} | {x['path']} | {x['what']} | {x['runs']} | {' / '.join(x['observed'])[:160]} | {'yes' if x['conforms'] else '**NO**'} |")
    open(out, "w", encoding="utf-8", newline="\n").write("\n".join(md) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
