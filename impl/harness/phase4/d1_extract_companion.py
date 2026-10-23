"""Extract the parts of the pre-split ERC draft that move to the companion document, verbatim, into one file per part.

Usage: python -I extract_companion.py <presplit.md> <out dir>
"""
import os
import sys

src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding="utf-8").read().split("\n")


def find(prefix, start=0):
    for i in range(start, len(lines)):
        if lines[i].startswith(prefix):
            return i
    raise SystemExit(f"not found: {prefix!r}")


def block(start_prefix, end_prefix, start_at=0):
    a = find(start_prefix, start_at)
    b = find(end_prefix, a + 1)
    return lines[a:b]


parts = {
    "e3": block("### Extension E3", "### Profile H"),
    "h": block("### Profile H", "### Profile Q"),
    "q": block("### Profile Q", "### Profile A"),
    "a": block("### Profile A", "### Scope across host chains"),
    "client": block("**Client and wallet guidance.**", "**Carry procedure.**"),
    "carry": block("**Carry procedure.**", "### Out of scope"),
    "kda": block("**A key-derived address for the declared signer.**", "**Profile H details.**"),
    "hdetails": block("**Profile H details.**", "**Profile Q as operator policy.**"),
    "qpolicy": block("**Profile Q as operator policy.**", "**Relation to EIP-7851 and EIP-8151.**"),
    "eip7851": block("**Relation to EIP-7851 and EIP-8151.**", "**Transport neutrality.**"),
    "transport": block("**Transport neutrality.**", "**Dependencies.**"),
    "rejected": block("**Rejected and deferred alternatives**", "## Backwards Compatibility"),
    "backcompat": block("- **Extensions and profiles.**", "## Test Cases"),
    "tc": [l for l in lines if l.startswith(("| TC20 ", "| TC21 ", "| TC22 ", "| TC23 "))],
    "where": block("### Where the tests live", "## Reference Implementation"),
    "res_e3": block("- **E3.**", "### Residual risks of the profiles"),
    "res_profiles": block("### Residual risks of the profiles", "### Host-state sources"),
    "unaudited": block("### Unaudited libraries", "### Governance"),
    "ics": block("#### Implementation Conformance Statement", "#### Threshold conformance"),
    "threshold": block("#### Threshold conformance", "### Extension E1"),
    "oq": [l for l in lines if l.startswith(("5. **Profile Q notice", "8. **KDA identifiers", "9. **Reply KEM"))],
    "terms": [l for l in lines if l.startswith(("| ECDSA-disabled delegation indicator", "| ECDSA-rooted account",
                                                "| Regular code", "| Identity-gated grant"))],
}
os.makedirs(out, exist_ok=True)
for k, v in parts.items():
    while v and v[-1] == "":
        v = v[:-1]
    with open(os.path.join(out, k + ".md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(v) + "\n")
    print(k, len(v))
