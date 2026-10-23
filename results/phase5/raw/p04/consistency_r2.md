# P0.4 consistency checks, base `9e4e330`

Result: 0 failures in the automated parts (rule references, regression searches, writing rules); the numbers listed in §2 are reviewed by hand.

## 1. Rule references

Defined in the ERC and the companion: 103 IDs (A1, A2, A3, A4, C1, C2, C3, C4, C5, C6, C7, C8, E1, E2, E3, H1, H2, H3, H4, H5, H6, H7, H8, H9, K1, K2, K3, K4, K5, K6, K7, K8, K9, K10, K11, K12, O1, O2, O3, Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, TC1, TC2, TC3, TC4, TC5, TC6, TC7, TC8, TC9, TC10, TC11, TC12, TC13, TC14, TC15, TC16, TC17, TC18, TC19, TC20, TC21, TC22, TC23, TC24, V1, V2, V3, V4, V5, V6, V7).
References found in 13 public documents: 1527 (103 distinct IDs).
Undefined: 0.

## 2. Numbers on the lines Phase 5 added

Added lines in public documents since `9e4e330`: 112; lines with numbers: 30. A line is 'in RESULTS' when every significant number on it (three digits or more, or with a comma, point, percent or fraction) occurs in RESULTS.md as a whole token; otherwise 'in the cited report' when those occur in the report the line cites; otherwise CHECK. Every line is listed, for review by hand: 28 in RESULTS, 2 in the cited report, 0 CHECK.

| File:line | Numbers | Not in RESULTS | Status |
|---|---|---|---|
| `conformance/README.md:75` | 4, 35, 8 | - | in RESULTS |
| `docs/COMPANION_EXTENSIONS_AND_PROFILES.md:260` | 5 | - | in RESULTS |
| `docs/COMPANION_EXTENSIONS_AND_PROFILES.md:320` | 35, 8 | - | in RESULTS |
| `docs/COMPANION_EXTENSIONS_AND_PROFILES.md:327` | 2,000,000 | - | in RESULTS |
| `docs/ERC_SPLIT_MAPPING.md:208` | 5 | - | in RESULTS |
| `docs/HEDEF_MIMARI_TR.md:1384` | 5 | - | in RESULTS |
| `docs/HEDEF_MIMARI_TR.md:1418` | 35, 8 | - | in RESULTS |
| `docs/HEDEF_MIMARI_TR.md:1486` | 1, 35, 8 | - | in RESULTS |
| `docs/TARGET_ARCHITECTURE.md:1374` | 5 | - | in RESULTS |
| `docs/TARGET_ARCHITECTURE.md:1404` | 35 | - | in RESULTS |
| `docs/TARGET_ARCHITECTURE.md:1405` | 8 | - | in RESULTS |
| `docs/TARGET_ARCHITECTURE.md:1472` | 1, 35, 8 | - | in RESULTS |
| `drafts/ONE_PAGER.md:35` | 35, 8 | - | in RESULTS |
| `drafts/RESEARCH_WRITEUP.md:92` | 35 | - | in RESULTS |
| `drafts/RESEARCH_WRITEUP.md:93` | 8 | - | in RESULTS |
| `drafts/RESEARCH_WRITEUP.md:149` | 35, 8 | - | in RESULTS |
| `erc/ERC-XXXX-decryption-authority-lifecycle.md:37` | 1, 1 | - | in RESULTS |
| `erc/ERC-XXXX-decryption-authority-lifecycle.md:40` | 4, 4, 9 | - | in RESULTS |
| `erc/ERC-XXXX-decryption-authority-lifecycle.md:446` | 9 | - | in RESULTS |
| `erc/ERC-XXXX-decryption-authority-lifecycle.md:482` | 19, 19 | - | in RESULTS |
| `erc/ERC-XXXX-decryption-authority-lifecycle.md:557` | 35, 8, 13 | - | in RESULTS |
| `erc/assets/erc-XXXX/EVIDENCE.md:24` | 1 | - | in RESULTS |
| `erc/assets/erc-XXXX/EVIDENCE.md:32` | 9 | - | in RESULTS |
| `erc/assets/erc-XXXX/EVIDENCE.md:42` | 19, 35, 8 | - | in RESULTS |
| `erc/assets/erc-XXXX/conformance/README.md:75` | 4, 35, 8 | - | in RESULTS |
| `export/README.md:51` | 35, 8 | - | in RESULTS |
| `results/RESULTS.md:661` | 35, 8 | - | in the cited report |
| `results/RESULTS.md:662` | 2,183,048, 28/28, 20 | - | in the cited report |
| `results/phase4/CORE_TRACEABILITY.md:52` | 1, 35, 8, 1 | - | in RESULTS |
| `results/phase4/CORE_TRACEABILITY.md:53` | 35, 8, 1 | - | in RESULTS |

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
- `export/README.md`: "revocable access" 1, "retire…" 12: ok
- `drafts/RESEARCH_WRITEUP.md`: "revocable access" 2, "retire…" 31: ok
- `drafts/ONE_PAGER.md`: "revocable access" 1, "retire…" 8: ok
- `erc/ERC-XXXX-decryption-authority-lifecycle.md`: "revocable access" 2, "retire…" 165: ok
- `export/README.md`: the three limits stated
- `drafts/RESEARCH_WRITEUP.md`: the three limits stated
- `drafts/ONE_PAGER.md`: the three limits stated
- `erc/ERC-XXXX-decryption-authority-lifecycle.md`: the three limits stated
- `results/RESULTS.md`: the three limits stated
