"""Assemble docs/COMPANION_EXTENSIONS_AND_PROFILES.md from the verbatim parts of the pre-split draft.

Usage: python -I assemble_companion.py <parts dir> <out.md>
Every normative part is copied verbatim; the only edits are listed in EDITS and are printed when applied.
"""
import sys

parts_dir, out = sys.argv[1], sys.argv[2]


def part(name):
    return open(f"{parts_dir}/{name}.md", encoding="utf-8").read().rstrip("\n")


EDITS = [
    # Open-question numbers: this document has its own list of three.
    ("Both tags are provisional (Open question 8).", "Both tags are provisional (Open question 2)."),
    ("- **Q3. Notice.** (Open question 5.)", "- **Q3. Notice.** (Open question 1.)"),
    ("(Open question 9.)", "(Open question 3.)"),
    # The governance profile now sits in the ERC's Security Considerations.
    ("SHOULD follow the governance profile below.", "SHOULD follow the governance profile in the ERC's Security Considerations."),
    # Profile A gas, corrected in Phase 4 (P2.4 section 6).
    ("18 lines of code, adding about 7,800 and 3,800 gas to those calls [M] (`results/phase4/P1_4_PROFILE_A_STOCK.md`).",
     "18 lines of code, adding about 12,800 and 3,800 gas to those calls when the call is the transaction's first touch "
     "of the registry, and about 7,800 and 3,800 when the registry is already warm [M] "
     "(`results/phase4/P1_4_PROFILE_A_STOCK.md`, corrected in `results/phase4/P2_4_AMSTERDAM.md` §6)."),
    # "This ERC" now means ERC-XXXX or this document, depending on the sentence.
    ("It is regular code for this ERC |", "It is regular code for this document |"),
    ("This ERC defines no signature-relayed path", "ERC-XXXX and this document define no signature-relayed path"),
    ("the lifecycle functions of this ERC on the registry", "the lifecycle functions of ERC-XXXX on the registry"),
    ("so this ERC makes no general claim", "so neither ERC-XXXX nor this document makes a general claim"),
    ("This ERC therefore treats the indicator", "This document therefore treats the indicator"),
    ("Nothing in this ERC depends on either draft", "Nothing in ERC-XXXX or this document depends on either draft"),
    ("including this ERC's vector", "including ERC-XXXX's vector"),
    ("Adoption is outside this ERC's control.", "Adoption is outside this document's control."),
    ("the measurements behind this ERC rely on", "the measurements behind ERC-XXXX and this document rely on"),
    # Carry sizes, measured in Phase 4 (P2.4 section 4).
    ("That allows about 500 handles per transaction under Osaka [E].",
     "At a gas limit of exactly 2^24, a carry of at most 524 handles fits one transaction under Osaka [M]. Under "
     "Amsterdam's schedule it is 137 when the whole transaction gas is capped [M], and about 765 by execution gas "
     "under EIP-8037's rule, which caps execution gas only [E] (`results/phase4/P2_4_AMSTERDAM.md` §4)."),
]

head = """# Decryption Authority Lifecycle: companion extensions and profiles

**Status.** Candidates for later ERCs and for operator profiles. They are not part of ERC-XXXX.
- Each candidate builds on ERC-XXXX's Core (`erc/ERC-XXXX-decryption-authority-lifecycle.md`).
- Each is a separate claim. Claiming one does not imply another, or Core conformance of another class.
- The text below is the Phase 3 draft's, moved here unchanged except for the edits listed in
  `docs/ERC_SPLIT_MAPPING.md`, which also maps every rule, constant and test case to its new place.

**Sources.** Bracketed sources are files of the research repository:
- VERIFICATION = `results/VERIFICATION.md`;
- CENSUS = `results/review/04_census/aggregate.json`;
- G1 = `G1_TARTISMA_RAPORU.md` (in Turkish);
- A5 = `results/deliberation/A5_aa_pq_expert.md`;
- A7 = `results/deliberation/A7_judge.md`;
- SUMMARY = `results/deliberation/DELIBERATION_SUMMARY.md`;
- Pn.m = the Phase 4 report of that task under `results/phase4/`.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT
RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Terms added to the ERC's terminology

| Term | Definition |
|---|---|
"""

claims = """
## 2. Claims

| Class | Optional claims | How a claim is made |
|---|---|---|
| Verifier | E3 (K1–K12), Profile H (H1–H9) | ICS |
| Oracle | E3, Profile H, Profile Q (Q1–Q8) | ICS |
| Application | Profile A (A1–A4) | The application's documentation |
| Client (wallet, SDK) | The client rule of E3 (K10) | — |

**Evidence so far** (all local; nothing here is deployed):

| Candidate | What ran | Reports |
|---|---|---|
| E3 | The route in the example's verifier with four ML-DSA libraries (K8): vectors, negatives, fault injection; the unmodified verifier fails closed (TC20) | `results/phase4/P1_1_E3_CONNECTOR.md`, `results/level3/LEVEL3.md` |
| Profile H | The signature library and the verifier (TC21); the EIP-7851 gap; the ML-DSA-44 account through the verifier; the real-world impact of `enforce` on mainnet's delegated accounts, measured on each delegate's code | `results/level1/`, `results/phase4/P0_4_EIP7851.md`, `results/phase4/P1_6_SMALL_GAPS.md`, `results/phase4/SHADOW_IMPACT.md` |
| Profile Q | The verifier with Q1, Q4 and Q5 (TC22); partial adoption with 13 real verifiers; the readiness indicator | `results/phase4/P1_2_PROFILE_Q.md` |
| Profile A | A ported token and stock OpenZeppelin 0.5.3 with an 18-line extension (TC23) | `results/level2/PROFILE_A.md`, `results/phase4/P1_4_PROFILE_A_STOCK.md` |
"""


def sec(title, body):
    return f"\n## {title}\n\n{body}\n"


def demote(text, old_heading, new_title):
    lines = text.split("\n")
    assert lines[0] == old_heading, (lines[0], old_heading)
    return "\n".join(lines[1:]).lstrip("\n"), new_title


doc = head + part("terms") + "\n" + claims
for name, heading, title in [
    ("e3", "### Extension E3: Declared Decryption Signer", "3. Extension E3: Declared Decryption Signer"),
    ("h", "### Profile H: Hygiene", "4. Profile H: Hygiene"),
    ("q", "### Profile Q: PQ-only", "5. Profile Q: PQ-only"),
    ("a", "### Profile A: Applications", "6. Profile A: Applications"),
]:
    body, t = demote(part(name), heading, title)
    doc += sec(t, body)

ics_body, _ = demote(part("ics"), "#### Implementation Conformance Statement", "")
thr_body, _ = demote(part("threshold"), "#### Threshold conformance", "")
doc += sec("7. The ICS and threshold conformance",
           "**ICS fields.** ERC-XXXX's O2 lists the fields in prose. In full, with this document's claims:\n\n" + ics_body
           + "\n\n**Threshold conformance**, with this document's claims:\n\n" + thr_body)
doc += sec("8. Informative: clients and carrying", part("client") + "\n\n" + part("carry"))
rationale = "\n\n".join([part("kda"), part("hdetails"), part("qpolicy"), part("eip7851"), part("transport"),
                          part("rejected")])
doc += sec("9. Rationale", rationale)
doc += sec("10. Backwards compatibility",
           "ERC-XXXX's Backwards Compatibility covers the Core, E1 and E2. For this document's candidates:\n\n"
           + part("backcompat"))
tc_rows = part("tc").split("\n")[:4]
doc += sec("11. Test cases",
           "Behaviours, numbered as in the Phase 3 draft (ERC-XXXX keeps TC1–TC19 and TC24):\n\n"
           "| ID | Rules | Case | Expected |\n|---|---|---|---|\n" + "\n".join(tc_rows)
           + "\n\n" + part("where").replace("### Where the tests live", "**Where the tests live**, for every test case of ERC-XXXX and of this document.", 1))
res_profiles, _ = demote(part("res_profiles"), "### Residual risks of the profiles", "")
unaudited, _ = demote(part("unaudited"), "### Unaudited libraries", "")
doc += sec("12. Security considerations",
           "**Residual risks of E3.**\n\n" + part("res_e3").replace("- **E3.**\n", "", 1)
           + "\n\n**Residual risks of the profiles.**\n\n" + res_profiles
           + "\n\n**Unaudited libraries.** " + unaudited)
oq = part("oq").split("\n")
oq = [o.replace("5. ", "1. ", 1) if o.startswith("5. ") else o for o in oq]
oq = [o.replace("8. ", "2. ", 1) if o.startswith("8. ") else o for o in oq]
oq = [o.replace("9. ", "3. ", 1) if o.startswith("9. ") else o for o in oq]
doc += sec("13. Open questions", "The text above uses the default stated for each.\n\n" + "\n".join(oq))

for old, new in EDITS:
    n = doc.count(old)
    assert n == 1, (old[:60], n)
    doc = doc.replace(old, new)
    print("edit applied:", old[:70])
with open(out, "w", encoding="utf-8", newline="\n") as f:
    f.write(doc.rstrip("\n") + "\n")
print("lines", doc.count("\n") + 1)
