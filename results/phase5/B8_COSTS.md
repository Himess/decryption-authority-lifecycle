# B8: costs of each path, and what EIP-8355 would change

Date: 2026-10-22. Proof classes: Mock (receipts on local chains, [M]) and Design (the EIP-8355 note, [E]).

**Data.**
- **Local drill**, three runs per fork (`results/phase5/pq-drill/PQ_DRILL_LOCAL.md`, `raw/pq-drill-local/`):
  - **Osaka:** anvil 1.8.5.
  - **Local-Amsterdam:** the Foundry nightly `9089a6b` of Phase 4 P2.4, `--hardfork amsterdam`.
    - Its constants are those of EIP drafts in Last Call; they may still change.
    - The local pool accepts `tx.gas` above 2^24 (Phase 4, D66). EIP-8037 itself allows that only for state gas.
- **Connector drill** (VPS, anvil 1.3.5): the worker's own verification times, §3.

Where a step's gas varied between runs, the range is given. The signature bytes, and so the verification work, differ
per key and digest.

## 1. Once per chain (shared by every account)

| Contract | Osaka | Amsterdam |
|---|---|---|
| ML-DSA-44 verifier (Fireblocks `cca262b5`, 23,991 B runtime) | 5,166,161 | 37,233,691 |
| Its Keccak-f1600 helper (data contract) | 4,716,360 | 33,632,276 |
| B0 wallet code without a key (accounts delegate to it, or adopt it) | 613,190 | 4,199,676 |

## 2. Once per account: the migration

| Step | Osaka | Amsterdam | Paths |
|---|---|---|---|
| **The holder's key blob**: 20,545 B, the verifier's prepared form of the 1,312-byte public key | 4,434,297–4,434,597 | 31,917,605–31,917,905 | all |
| The holder's wallet W (deployed with its key) | 662,183–662,195 | 4,425,109–4,425,121 | B1, B2 |
| **B1:** carry 3 handles and retire, one `multicall` (the carry tool) | 156,448 | 503,316–503,328 | B1 |
| **B2:** `designateSuccessor` | 62,128 | 144,548 | B2 |
| **B2:** W accepts through `execute` (relayed) | 1,336,510–1,337,751 | 1,428,682–1,430,933 | B2 |
| **B2:** `confirmSuccessor` (after D = 7 days) | 57,256 | 140,060 | B2 |
| **B2d:** `retireAccount` | 54,516 | 136,936 | B2d |
| **B2c:** the certificate relayed by the watchtower | 65,610–65,622 | 148,530 | B2c |
| **B3:** EIP-7702 delegation to the wallet code and the key set, one type-4 transaction | 83,059–83,071 | 284,005–284,017 | B3 |
| **B3b:** adopting the code (`SETCODEFROM`) | [E] 12,200 with a cold source, 9,300 warm: EIP-8298's own table, inside the migration transaction. Not measurable: no client implements it | same [E] | B3b |
| A KDA declared through `execute` (E3, optional) | 1,338,039–1,358,249 | 1,429,586–1,533,086 | all |

**Reading it.**
- The key blob dominates every path under Amsterdam: 31.9M gas, above 2^24, so it is valid only under EIP-8037's
  reservoir rule.
- With the blob, the post-quantum path costs about 5.3M (Osaka) to 37M gas (Amsterdam) per account before any carry.
- Per extra carried handle, Phase 4 measured 31,385 (Osaka) and 119,505 (Amsterdam).

## 3. Per request

| Measure | Osaka | Amsterdam | Source |
|---|---|---|---|
| The holder's `isValidSignature` (ML-DSA-44), measured inside the EVM with E4's gas meter | 1,231,383–1,235,715 | 1,233,983–1,238,715 | local drill, B8 rows |
| The same under the unmodified 250,000 cap | the wallet answers `0xffffffff`; refused | the same | local drill |
| Profile H's budget for it: `B_exec` + 21,000 + 64 × 2,532 calldata bytes | 2,183,048 | — | connector drill wire, Phase 4 P1.6 |
| Wall time of that `eth_call` on a local anvil (M1), median of 5 | about 15 ms | about 15 ms | local drill |
| **E3, native:** one ML-DSA-44 verification, p50 on M1 | 80 µs (RustCrypto), 86 µs (fips204) | — | Phase 4 P1.1 bench, `results/phase4/P1_1_E3_CONNECTOR.md` §8 |
| **E3, the whole KDA route** (one code read, then native verification), p50 on M1 | 242–247 µs with one library; 337–341 µs in K8 agree mode | — | the same bench |
| **ERC-1271 at `B_exec`** through the crate, ML-DSA-44 account, p50 on M1 | 2,700–2,737 µs | — | the same bench |
| The worker's whole check in the connector drill (VPS; the attempt counter, the RPC reads through the recorder, the verification), median | ERC-1271 169.5 ms; E3 with K8 94.7 ms; ecrecover under Profile H 106.2 ms | — | `results/phase5/pq-drill/SIG_CHECK_TIMES.md`, three runs. Harness time, not a latency figure: it compares the routes inside one set-up |

The E3 verification code is unchanged since the bench's commit (`564d7d17`). The later commits add Profile Q around
the route (Q4's signer rule, Q5) and do not touch the verification (`git diff --stat 564d7d1 a4416155`).

**Reading the per-request numbers.**
- On M1, the ML-DSA-44 KDA route is about a tenth of the ERC-1271 check at `B_exec`.
- In the connector drill, I/O dominates every route. Even ecrecover, whose cryptography takes microseconds, needs
  about 100 ms. The ERC-1271 route's median is about 63 ms above it (169.5 against 106.2 ms); E3's is no higher
  (94.7 ms).
- Neither route costs the user gas. The ERC-1271 route costs the verifier's node an `eth_call` of about 1.23M gas per
  request.

## 4. Sizes

| Item | Bytes |
|---|---|
| ML-DSA-44 public key (FIPS 204) | 1,312 |
| Its prepared blob for the Solidity verifier | 20,545 |
| ML-DSA-44 signature | 2,420 |
| `isValidSignature(hash, signature)` calldata | 2,532 |
| An E3 signature field for ML-DSA-44: `abi.encode(signerBytes, sig)`, with signerBytes = 20-byte scheme id + 1,312-byte key | 3,904 (32 × 2 offsets + two length words + 1,332 and 2,420 padded to 32) |

## 5. B5: an operator-ratified upgrade with 9 ML-DSA-44 signatures

| Step | Osaka | Amsterdam |
|---|---|---|
| Each of the 13 operators' key blobs (once, when the upgrader is set up) | 4,434,357–4,434,621 | 31,917,665–31,917,929 |
| `execute` with 9 signatures, a Core release: the guard passes | 11,453,066 | 11,557,470 |
| `execute` with 9 signatures, a release without Core: reverts at the guard | 11,427,962 | 11,451,062 |
| `execute` with 8 signatures: reverts `NotEnoughSignatures` before verifying anything (mostly calldata) | 802,540 | 1,323,928 |
| `propose` (starts the 7-day delay) | 49,678 | 131,698 |

## 6. EIP-8355 (Draft, at `54e1f093`): a design note, not an implementation [E]

**What EIP-8355 specifies [V].**
- `VERIFY_MLDSA44` at `0x12`: input pk (1,312) ‖ signature (2,420) ‖ message.
- Gas `6,500 + 6 × ceil(len(message) / 32)`.
- It returns a 32-byte word, 1 or 0, never reverting on an invalid signature.
- It uses the empty context, as the B0 wallet does, so the same signatures would verify.

**Our numbers if the wallet called it [E]**, from the EIP's gas table and the EVM's access and memory costs:

| Use | Now (Fireblocks verifier) | With EIP-8355 [E] | How the estimate is made |
|---|---|---|---|
| `isValidSignature` | about 1.23M | about 13,000–15,000 | 6,506 for the precompile; the public key read from a 1,312-byte data contract with `EXTCODECOPY` (2,600 cold + 3 per word + memory, about 3,000); the wallet's storage read (2,100 cold), the copies and the memory for a 3,764-byte input (about 400); the call (100, precompiles are warm) |
| One `execute` | about 1.34M | about 60,000–80,000 in total | the verification above, plus the call it makes, the 21,000 base and its calldata (about 2,500 B) |
| Registering a key | 4.43M Osaka, 31.9M Amsterdam (the 20,545 B blob) | about 0.3M Osaka (the 1,312-byte key as a data contract); Amsterdam about 2–3M [E, by scaling the blob's measured cost per byte] | the precompile takes the plain key: no prepared blob |
| 9 operator signatures (B5) | about 11.5M | about 0.1M of verification, plus the calldata of 9 × 2,420 B: about 0.35M under Osaka's 16 per byte, about 1.4M under EIP-7976's floor of 64 per byte | — |

**What it would change for the design.**
- **The 250,000 cap stops mattering.** An ML-DSA-44 ERC-1271 wallet would fit the unmodified verifier's cap, so
  Zama's verifier would accept such a wallet without Profile H's budget.
  - The code-first ordering (H2) is still needed: it is what refuses the old key.
  - The budget H3 could be stated much lower on a chain with EIP-8355.
- **E3's advantage narrows** to latency and to the RPC round trip. The work becomes a native verification either way;
  E3's is off-chain and costs no node an `eth_call`.
- **Registration and the B5 ratification become cheap.** Calldata, not verification, then dominates.

These are estimates. EIP-8355 is a Draft, and nothing here depends on its adoption.
