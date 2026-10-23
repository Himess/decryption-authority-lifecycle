# P0.4: consistency pass after the Part A fixes (proof class: [M] checks, M1)

Date: 2026-10-22. Each check ran twice; both runs are identical.

**Scope.** Thirteen public documents:
- the ERC, its `EVIDENCE.md` and its copy of the kit README;
- the companion; both architecture documents; the split mapping;
- the write-up and the one-pager; the export README; RESULTS;
- `conformance/README.md` and `results/phase4/CORE_TRACEABILITY.md`.

The base for "what Phase 5 changed" is `9e4e330`, the last Phase 4 commit.

| Check | Result | Raw |
|---|---|---|
| eipw 0.11.0, ethereum/ERCs configuration | 3 errors, all on the two placeholders (`eip: TBD`; `discussions-to: TBD`, which two rules flag); the new link to EIP-8298 resolves | `raw/p04/eipw_r{1,2}.log` |
| ERC constants recomputed with `cast` 1.8.5 (`impl/harness/phase4/d1_verify_constants.py`) | 52 of 52; the same table as Phase 4's | `raw/p04/constants_r{1,2}.md` |
| Rule references | 1,527 references to 103 distinct IDs; every one is defined in the ERC or the companion | `raw/p04/consistency_r{1,2}.md` §1 |
| Numbers on the lines Phase 5 added | 112 added lines, 30 with numbers. Every significant number matches RESULTS (or, for RESULTS' own new rows, the report each row cites) | §2 |
| P0.1 regression | no "only adds rights" wording | §3 |
| P0.2 regression | every TC15 mention quotes the kit's numbers (35 conform, 8 violate) or only defines TC15 | §3 |
| P0.3 regression | 10 paragraphs name EIP-7851 without EIP-8298; all 10 are reviewed below | §3 |
| Writing rules | no banned word. "Revocable access" and "retire" are in the README, the write-up, the one-pager and the ERC. The three limits are stated in those four and in RESULTS | §4 |
| One-pager PDF | 2 A4 pages (page 2 has 8 lines), two renders; `drafts/ONE_PAGER.pdf` replaced | `impl/harness/phase4/d4_render_onepager.py` |
| Write-up length | 3,317 words (`wc -w`), inside Phase 4's 2,500–3,500 | — |

## How the automated checks decide

The script is `impl/harness/phase5/p04_consistency.py`, and its docstring states every rule. In short:

- **Rule references.** An ID counts as defined when it is a `- **X<n>. ` rule of the ERC (C, O, R, S, V) or the
  companion (A, H, K, Q), a TC row of either test table, or the extensions E1–E3.
  - `A<n>` means a Profile A rule only in the ERC, the companion, `EVIDENCE.md` and the traceability table, or on a
    line that says "Profile A". Elsewhere it names a Phase 3 deliberation agent or a row of the architecture's
    disagreement table.
  - The first run, before that rule, reported 163 such `A<n>` hits; all of them were agents or table rows.
  - `E4` and above are experiments.
- **Numbers.**
  - A number is significant when it has three or more digits, a comma, a point, a percent sign or a fraction. It is
    looked up as a whole token, so "28" does not match inside "128".
  - RESULTS' own new rows are checked against the report they cite. Headings, dates, version numbers, line and section
    references, and numbers glued to a name (EIP-8298, R13, ML-DSA-44) are skipped.
  - The table in §2 lists every line with numbers, so the decision can be checked by hand. I read all 30.

## The 10 paragraphs that keep EIP-7851 alone

Each is a Phase 4 record or a historical statement, and stays as it is:

- **`TARGET_ARCHITECTURE.md`, the opening summary.** Its Phase 4 bullet says "the EIP-7851 gap was shown". Phase 5
  gets its own bullet with §12 (P2).
- **`TARGET_ARCHITECTURE.md`, "Phase 4 (§11.2, §11.4)".** A record of what Phase 4 measured.
- **`TARGET_ARCHITECTURE.md`, the Level 2 prototype status.** The list of codes `getAuthorityStatus` reports ends with
  "or other code". That already covers adopted code, which P0.3 measured as `regular`.
- **`TARGET_ARCHITECTURE.md`, "V1 was not better…".** A claim of the earlier design [C], quoted as history.
- **`HEDEF_MIMARI_TR.md`.** The same four paragraphs in Turkish.
- **`RESULTS.md` §8.1 and §8.4.** Phase 4 rows: the EIP-7851 connector result, and the census count "0 EIP-7851".
  The EIP-8298 row is in §9.1.

## Not re-checked here

- The numbers Phase 5 did not touch, already checked by Phase 4's independent verification
  (`results/phase4/INDEPENDENT_VERIFICATION.md`, sections A and B, with its fixes).
- The independent verification of Phase 5 itself, which comes in P3 (§6.4).
