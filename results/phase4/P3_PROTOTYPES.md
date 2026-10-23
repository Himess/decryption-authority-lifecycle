# P3: optional end-state prototypes

**Date:** 2026-10-22. **Machine:** M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045).
**Status:** two of three done; connector throughput parked (`parked/P3_connector_throughput.md`).
**Raw data:** `raw/p3/`.

## 1. Operator-ratified upgrades with post-quantum signatures [M, Local]

**What it is.** The governance profile's end state is that at least n−t operators ratify every upgrade that can
widen decryption rights, with post-quantum keys. `impl/p3-operator-ratification/src/OperatorRatifiedUpgrader.sol`
is a prototype of that rule, on chain:
- A proposer, for example the existing governance, proposes an upgrade; a delay starts (7 days in the runs).
- After the delay, anyone may execute it with ML-DSA-44 (FIPS 204) signatures of at least 9 of the 13 registered
  operators. Every signature passed must verify on chain, through the verifier.
- Operators sign a 32-byte proposal id. It binds a domain tag, the chain, the upgrader, the registry, the new
  implementation, the call data and a nonce that every execution advances, so signatures cannot be replayed.
- Operator keys are prepared public-key blobs, in the verifier's format.

**What it uses.**
- The verifier is `fireblocks-labs/evm-ml-dsa-verifier` at `cca262b5`, **unaudited research code** (MIT). It is
  vendored byte for byte (`vendor/evm-ml-dsa-verifier-cca262b5/PROVENANCE.txt`) and compiled with its repository's
  own settings: solc 0.8.30, via-IR, 10,000 runs, osaka.
- The registry is a stand-in (`MockRegistry`) that records the installed implementation, so that the measurement
  isolates the ratification.
- The 13 operator keys are test keys derived from public labels. They sign through dilithium-py (pure Python FIPS
  204, unaudited), using the P1.1 tool.

**The harness** (`impl/harness/phase4/p3_ratify.py`). Real transactions on a local anvil, with receipts; two runs
under Osaka (anvil 1.8.5) and two under Amsterdam's schedule (Foundry nightly `9089a6b`). The runs are identical,
because ML-DSA signing here is deterministic. To rerun it you need, besides anvil: a full checkout of
`fireblocks-labs/evm-ml-dsa-verifier` at `cca262b5` (its `prepare/prepare.py` turns a public key into the verifier's
blob, and its `pythonref/` holds dilithium-py; only the Solidity part is vendored here), and the Python packages
`pycryptodome` and `eth-abi`. The project itself has no Foundry tests: the measurement is the harness's receipts.

| Transaction | Osaka | Amsterdam |
|---|---|---|
| One `verify()` call (`eth_estimateGas`, with base and calldata) | 1,288,639 | 1,284,439 |
| `execute` with **9** signatures (22,980 bytes of calldata) | **11,468,811** | **11,660,335** |
| `execute` with **13** signatures (33,092 bytes of calldata) | **16,481,400** | **16,516,884** |
| `execute` with 13, sent with a gas limit of exactly 2^24 | status 1 | status 1 |
| `propose` (one new storage slot) | 49,656 | 131,676 |

- **Both fit one transaction under the 2^24 cap.** With 9 signatures there are 5.1–5.3M gas to spare. With all 13,
  the margin is 295,816 gas (Osaka) and 260,332 (Amsterdam); a fourteenth signature would not fit.
- **Each further signature costs about 1.25M gas under Osaka and 1.21M under Amsterdam:** the verifier's work plus
  2,420 bytes of calldata.
- **Every negative reverts** (status 0, in every run):
  - execution before the delay;
  - only 8 signatures;
  - one corrupted signature among 9;
  - signers out of order;
  - the executed proposal's signatures replayed after a re-proposal (the nonce changed the id).
- The registry holds the new implementation after each successful execution.

**What it does not show.**
- **The verifier is unaudited,** and it supports ML-DSA-44 only. A larger parameter set costs more per signature; 13
  of them may not fit 2^24.
- **Publishing an operator key is separate.** Its blob is a 20,545-byte data contract. The verifier's README puts
  that at about 4.11M gas under Osaka [C]. Under Amsterdam the code deposit alone is 20,545 × 1,530 ≈ 31.4M gas of
  state gas [E]. That is valid only under EIP-8037's transaction rule (P2.4 §4); the runs placed the blobs with
  `anvil_setCode`.
- **The rest of the governance profile is not here:** rotating the operator set, the upgrader's own upgrade path,
  and how operators decide what to sign. The registry is a stand-in.

## 2. Reply-channel KEM sizes and times, for Q6 [M, Local]

**Why.** Profile Q's post-quantum claim (Q6) needs a FIPS 203 KEM on the reply channel. Q6 recommends ML-KEM-768 or
stronger for replies published on chain. The example's reply channel uses ML-KEM-512 [V]. This is a design note:
sizes and local times, no protocol change.

**The measurement** (`impl/bench-pq/p3_mlkem`, Rust 1.95.0, release build; `raw/p3/mlkem/mlkem_r{1,2}.jsonl`).
- Two implementations, neither with a completed audit for this use: RustCrypto `ml-kem` 0.3.2, the crate the
  example's reply channel uses, and Cryspen's `libcrux-ml-kem` 0.0.11.
- For each parameter set: a round trip in each implementation, and across them in both directions (one
  encapsulates to the other's key and the other decapsulates). Every check passed.
- Then 2,000 timed operations each, one at a time. The table gives run 1's medians; every run 2 median is within
  1 µs of it.

| Parameter set | Category | Encapsulation key | Decapsulation key (expanded / seed) | Ciphertext | Shared secret |
|---|---|---|---|---|---|
| ML-KEM-512 | 1 | 800 B | 1,632 B / 64 B | 768 B | 32 B |
| ML-KEM-768 | 3 | 1,184 B | 2,400 B / 64 B | 1,088 B | 32 B |
| ML-KEM-1024 | 5 | 1,568 B | 3,168 B / 64 B | 1,568 B | 32 B |

| Median, µs | RustCrypto keygen / encaps / decaps | libcrux keygen / encaps / decaps |
|---|---|---|
| ML-KEM-512 | 19.4 / 17.9 / 23.2 | 11.2 / 11.5 / 12.1 |
| ML-KEM-768 | 34.2 / 29.6 / 37.2 | 14.5 / 15.4 / 16.2 |
| ML-KEM-1024 | 54.6 / 48.3 / 58.3 | 19.3 / 20.9 / 22.4 |

**Reading.**
- **Time is not the constraint.** Every operation takes tens of microseconds. That is below the per-request
  signature checks P1.1 measured (hundreds of microseconds) and far below a block.
- **Size is the cost that matters on chain.** Moving from ML-KEM-512 to -768 adds 320 bytes to each ciphertext. For
  a reply published as calldata, that is about 5,100 gas more per reply at 16 gas per byte, mostly non-zero; 20,480
  more if a transaction pays EIP-7976's 64-gas-per-byte floor [E]. A threshold oracle publishes one reply per node.
- **The decapsulation key can be kept as its 64-byte seed** in both implementations; the expanded form is derived.
- **Q6 stands as written:** ML-KEM-768 or stronger for replies published on chain, with the reply encryption bound
  to the request context. Nothing measured here argues for ML-KEM-512 on chain.

## 3. Connector throughput

Parked, not started: `parked/P3_connector_throughput.md`. A thousand concurrent requests on the shared VPS is a load
the brief asks to stop for; it needs Semih's approval or a dedicated host, and a new load generator.
