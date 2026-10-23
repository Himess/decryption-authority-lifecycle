### Preamble

`requires` was 165, 712, 1271, 7913. It is now 165, 712, 1271: ERC-7913 serves only E3, which moved to the companion.

### Sections and paragraphs

| Phase 3 draft | Now |
|---|---|
| Abstract | ERC Abstract: Core, E1, E2, and one sentence naming the companion's candidates |
| Motivation, opening | ERC Motivation, condensed; the EIP-7851 finding (P0.4) moved into measured fact 4 |
| Measured facts 1–7 and their source list | ERC Measured facts 1–7, condensed; every number cites an entry of `erc/assets/erc-XXXX/EVIDENCE.md`, which gives the date, method and raw data. The Phase 3 source keys (VERIFICATION, CENSUS, G1, A5, A7, SUMMARY) appear there and in the companion |
| Why the authorization views | ERC, condensed |
| Terminology | ERC, except four terms used only by the candidates (below) |
| Conformance classes and claims | ERC for Core, E1, E2; the companion's §2 for E3 and Profiles H, Q, A |
| States, Core interface and constants, Views and roles | ERC, unchanged |
| Core registry requirements; the note on removal-only functions | ERC, unchanged |
| Core verifier requirements | ERC. V4 names "any other scheme (such as the companion document's declared signers)" instead of "declared signers (E3)". V6 and V7 lose "MUST under Profile H"; a sentence after V7 says the companion's verifier profile makes them required, as H5 and H7 do |
| Core oracle requirements | ERC. O2 now lists the ICS fields in prose |
| Implementation Conformance Statement (table) | Companion §7, unchanged; the ERC's O2 lists the same fields |
| Threshold conformance | ERC, stated without naming the profiles; companion §7 keeps the original text |
| Extension E1, Extension E2 | ERC, unchanged except S11's third bullet, which names "the companion document's declared signer, E3" |
| Extension E3, Profile H, Profile Q, Profile A | Companion §3–§6, verbatim except the edits listed below |
| Scope across host chains | ERC, unchanged |
| Informative parts: governance profile | ERC Security Considerations, Governance (the same points, the canary included) |
| Informative parts: client and wallet guidance | Companion §8, unchanged |
| Informative parts: carry procedure | Companion §8; its gas sentence now cites the Phase 4 receipts |
| Out of scope | ERC, as one paragraph, with the same items |
| Rationale: placement in the views; every role; the semantic exemption; the upgrade guard; two states; revert and inert grants; the one-key rule | ERC, condensed. The one-key rule keeps its successor and certificate points; its declared-signer point moved to the companion with E3 |
| Rationale: a key-derived address for the declared signer; Profile H details; Profile Q as operator policy | Companion §9, unchanged |
| Rationale: relation to EIP-7851 and EIP-8151 | ERC, condensed; companion §9 keeps the full text |
| Rationale: transport neutrality | Companion §9, unchanged |
| Rationale: dependencies | ERC (ERC-165, EIP-712, ERC-1271, ERC-7201); ERC-7913 and ERC-7984 go with the companion's candidates |
| Rationale: mapping to deployed registries | ERC, with shorter cells |
| Rationale: rejected and deferred alternatives | Companion §9, the full table; the ERC keeps a paragraph naming the main rejections |
| Backwards Compatibility | ERC for Core, E1 and E2, condensed; companion §10 for E3 and the profiles |
| Test vectors, threshold vector | ERC, unchanged |
| Conformance kit (added in Phase 4, P2.3) | ERC |
| Behaviours TC1–TC19, TC24 | ERC; TC20–TC23 in the companion §11 |
| Where the tests live | Companion §11, the full table; the ERC keeps a summary paragraph |
| Reference Implementation | ERC, condensed; the Level 1–3 details are in the companion's evidence table and the research repository |
| Security: the three limits; residual risks of the Core; E1 and E2 residuals; host-state sources; governance | ERC |
| Security: E3 residuals; residual risks of the profiles; unaudited libraries | Companion §12 |
| Open Questions (a section of its own) | A subsection of the ERC's Rationale, and the companion's §13 (eipw allows no extra top-level section) |
| Copyright | ERC |

### Terminology

| Term | Now |
|---|---|
| Identity-gated grant; ECDSA-disabled delegation indicator; ECDSA-rooted account; Regular code | Companion §1 |
| Every other term | ERC Terminology, unchanged |

### Open questions

| Phase 3 number | Topic | Now |
|---|---|---|
| 1 | Upgrade guard (R11) | ERC 1 |
| 2 | Successor acceptance (S2) | ERC 2 |
| 3 | Delay (S7) | ERC 3 |
| 4 | Certificates (E2) | ERC 4 |
| 5 | Profile Q notice (Q3) | Companion 1 |
| 6 | Timelock delay | ERC 5 |
| 7 | Names | ERC 6 |
| 8 | KDA identifiers (E3) | Companion 2 |
| 9 | Reply KEM (Q6) | Companion 3 |
| 10 | Host-state concentration | ERC 7 |
| 11 | Inco | ERC 8 (updated in Phase 4, P2.2) |
| 12 | Liveness getters (R14) | ERC 9 |
| 13 | Reference-implementation targets | ERC 10 |

The references inside the rules follow the new numbers: R14 now points to ERC open question 9, Q3 to companion 1, Q6
to companion 3, and the E3 library comment to companion 2.

### Edits made by the split to the ERC's test cases

- TC8: the rules column reads "R8" instead of "R8, A2"; A2 moved to the companion with Profile A. The case and the
  expected result are unchanged.
- TC17: "a KDA cannot accept" reads "a key-derived address cannot accept", because the ERC no longer defines KDA.

### Edits made by the split to text that moved to the companion

- The open-question numbers above.
- Q8: "the governance profile below" became "the governance profile in the ERC's Security Considerations".
- Profile A: the gas of the stock extension now gives the cold-registry figure, corrected in Phase 4 (P2.4 §6).
- Carry procedure: "about 500 handles per transaction under Osaka [E]" became the Phase 4 measurements (524 under
  Osaka; 137 under Amsterdam with the whole transaction gas capped; about 765 by execution gas under EIP-8037 [E]).
- "This ERC" became "ERC-XXXX" or "this document", as the sentence requires.

The script that assembled the companion lists each edit and applies it only if its text occurs exactly once:
`impl/harness/phase4/d1_assemble_companion.py`.
