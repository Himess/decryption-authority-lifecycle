# P0.4 consistency checks, base `abd3b1f`

Result: 0 failures in the automated parts (rule references, regression searches, writing rules); the numbers listed in §2 are reviewed by hand.

## 1. Rule references

Defined in the ERC and the companion: 103 IDs (A1, A2, A3, A4, C1, C2, C3, C4, C5, C6, C7, C8, E1, E2, E3, H1, H2, H3, H4, H5, H6, H7, H8, H9, K1, K2, K3, K4, K5, K6, K7, K8, K9, K10, K11, K12, O1, O2, O3, Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, TC1, TC2, TC3, TC4, TC5, TC6, TC7, TC8, TC9, TC10, TC11, TC12, TC13, TC14, TC15, TC16, TC17, TC18, TC19, TC20, TC21, TC22, TC23, TC24, V1, V2, V3, V4, V5, V6, V7).
References found in 13 public documents: 1592 (103 distinct IDs).
Undefined: 0.

## 2. Numbers on the lines Phase 5 added

Added lines in public documents since `abd3b1f`: 35; lines with numbers: 15. A line is 'in RESULTS' when every significant number on it (three digits or more, or with a comma, point, percent or fraction) occurs in RESULTS.md as a whole token; otherwise 'in the cited report' when those occur in the report the line cites; otherwise CHECK. Every line is listed, for review by hand: 5 in RESULTS, 2 in the cited report, 8 CHECK.

| File:line | Numbers | Not in RESULTS | Status |
|---|---|---|---|
| `docs/HEDEF_MIMARI_TR.md:1528` | 35, 8 | - | in RESULTS |
| `docs/TARGET_ARCHITECTURE.md:1514` | 35 | - | in RESULTS |
| `docs/TARGET_ARCHITECTURE.md:1515` | 8 | - | in RESULTS |
| `drafts/ONE_PAGER.md:59` | 5, 1, 9 | - | in RESULTS |
| `export/README.md:88` | 13, 8, 9, 1, 5 | - | in RESULTS |
| `results/RESULTS.md:3` | 5 | 5 | CHECK |
| `results/RESULTS.md:17` | 5 | 5 | CHECK |
| `results/RESULTS.md:665` | 52, 52, 1,527, 13, 1,587, 1,592, 5, 24, 18, 6 | 1,587, 1,592, 24, 18 | CHECK |
| `results/RESULTS.md:696` | 20,545, 1,312, 4,434,297, 4,434,597, 31,917,605, 31,917,905 | 20,545, 1,312, 4,434,297, 4,434,597, 31,917,605, 31,917,905 | CHECK |
| `results/RESULTS.md:701` | 1,336,510, 1,337,751, 1,428,682, 1,430,933 | 1,336,510, 1,337,751, 1,428,682, 1,430,933 | CHECK |
| `results/RESULTS.md:760` | 11, 143, 143, 128, 128, 9, 9, 81, 81, 69, 226, 226, 17, 14, 14, 14, 15, 15 | 11, 143, 143, 128, 128, 69, 226, 226 | CHECK |
| `results/RESULTS.md:761` | 4 | 4 | CHECK |
| `results/RESULTS.md:763` | 4, 22, 323, 100, 301, 100 | 4, 22, 323, 100, 301, 100 | CHECK |
| `results/RESULTS.md:764` | 62, 46, 12, 4, 20, 17, 0, 3, 26, 21, 3, 2, 4 | - | in the cited report |
| `results/RESULTS.md:765` | 1, 396, 396, 7, 4, 20, 18, 14, 122, 40 | - | in the cited report |

CHECK lines in full:

- `results/RESULTS.md:3` (missing 5): **Date:** 2026-10-21; Phase 5 (§9) 2026-10-23. **Scope:** every measurement of the brief's Task D (`docs/CLAUDE_CODE_BRIEF_ERC_TARGET_DESIGN.md` §6),
- `results/RESULTS.md:17` (missing 5): **Updated in Phase 5 (2026-10-23):** §9 holds Part A's corrections and Part B's post-quantum path (`phase5/`).
- `results/RESULTS.md:665` (missing 1,587, 1,592, 24, 18): | Consistency pass (P0.4) | eipw: only the two placeholders. ERC constants 52 of 52 with `cast`. Rule references: 1,527 on P0.4's versions of the 13 documents, 1,587 on their first P3 versions and 1,592 on the final ones (`phase5/raw/p3/consistency_r3.md`, `_r4.md`), all defined. Every number on the lines Phase 5 added matches RESULTS or its report. No "only adds rights" wording; every TC15 mentio
- `results/RESULTS.md:696` (missing 20,545, 1,312, 4,434,297, 4,434,597, 31,917,605, 31,917,905): | An account's key blob (20,545 B, the verifier's prepared form of the 1,312-byte key) | 4,434,297–4,434,597 | 31,917,605–31,917,905 |
- `results/RESULTS.md:701` (missing 1,336,510, 1,337,751, 1,428,682, 1,430,933): | One relayed `execute` (W accepts a succession) | 1,336,510–1,337,751 | 1,428,682–1,430,933 |
- `results/RESULTS.md:760` (missing 11, 143, 143, 128, 128, 69, 226, 226): | `make <target>` from fresh clones of the export, in any order | Two fresh clones of the last staging build ran every target, in two orders (one: `level0`, `pq-drill`, `level0` again, `conformance`, `profile-a`, `level0-mock`; the other: `pq-drill` first, then the rest). All 11 runs reproduced: `level0` 143 of 143 tests on `main` and 128 of 128 on `v0.13.8`, also after `pq-drill` in the same clon
- `results/RESULTS.md:761` (missing 4): | The export's safety checks | A deny-list sweep (public terms and the private ones by label), a byte search for every `.env` value and the keys and addresses derived from each mnemonic, gitleaks in directory and git mode, an IPv4 count, and a licence and size listing, on every staging build and on the final build. No secret value, key, mnemonic, private term, machine name or desktop path is in th
- `results/RESULTS.md:763` (missing 4, 22, 323, 100, 301, 100): | The Fhenix kit (optional in the brief) | An issue draft and one branch on Fhenix's `cofhe-contracts` `master` (`b5c20ed`): the Phase 4 port of Core, whose comments alone change (the same bytecode), the deploy and upgrade tasks it needs (the ACL is upgraded first, and the share registry is linked to it), 22 Hardhat tests and a changelog entry. Fhenix's pull-request checks pass twice on M1: Solhin

## 3. Regression searches

- P0.1, "only adds rights" wording: 0 hits
- P0.2, TC15 mentions without the kit's numbers or a definition: 0
- P0.3, paragraphs that discuss EIP-7851 without EIP-8298: 10 (listed for review; Phase 4 records and statements about the indicator itself may keep EIP-7851 alone)
  - `docs/TARGET_ARCHITECTURE.md`: - **Problem.**
  - `docs/TARGET_ARCHITECTURE.md`: Phase 4 (§11.2, §11.4): a simulated EIP-7851 indicator did not stop unmodified verifiers accepting the disabled key, and
  - `docs/TARGET_ARCHITECTURE.md`: **Prototype status: done for the prototype (2026-10-21).**
  - `docs/TARGET_ARCHITECTURE.md`: V1 was **not** better on mechanism or threat model:
  - `docs/HEDEF_MIMARI_TR.md`: - **Problem.**
  - `docs/HEDEF_MIMARI_TR.md`: Faz 4 (§11.2, §11.4): simüle edilmiş bir EIP-7851 göstergesi, değiştirilmemiş doğrulayıcıların devre dışı bırakılmış ana
  - `docs/HEDEF_MIMARI_TR.md`: **Prototip durumu: prototip için tamamlandı (2026-10-21).**
  - `docs/HEDEF_MIMARI_TR.md`: V1 mekanizma ya da tehdit modeli açısından daha iyi **değildi**:
  - `results/RESULTS.md`: | What | Result | Label | Report |
  - `results/RESULTS.md`: | What | Result | Label | Report |

## 4. Writing rules

- Banned words: 0 hits
- `export/README.md`: "revocable access" 1, "retire…" 18: ok
- `drafts/RESEARCH_WRITEUP.md`: "revocable access" 2, "retire…" 31: ok
- `drafts/ONE_PAGER.md`: "revocable access" 1, "retire…" 11: ok
- `erc/ERC-XXXX-decryption-authority-lifecycle.md`: "revocable access" 2, "retire…" 165: ok
- `export/README.md`: the three limits stated
- `drafts/RESEARCH_WRITEUP.md`: the three limits stated
- `drafts/ONE_PAGER.md`: the three limits stated
- `erc/ERC-XXXX-decryption-authority-lifecycle.md`: the three limits stated
- `results/RESULTS.md`: the three limits stated
