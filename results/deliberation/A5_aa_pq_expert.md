# A5: account abstraction and PQ accounts (deliberation input)

**Role:** A5 of 7, the AA and PQ-accounts expert. **Date:** 2026-10-21. I worked independently and did not open any other file in `results/deliberation/`.
**Builds on:** `results/review/03_aa_pq_expert.md` (cited as [03]). I do not repeat its findings; I extend or correct them.
**Code (read-only):** fhevm `main` `ed851716c`, kms `c755e84f`, OpenZeppelin contracts 5.6.1 and confidential-contracts 0.5.3 (`experiments/node_modules`), and the Fireblocks verifier clone `cca262b`.

**Labels:**
- [V] verified in code or spec text (file:line given);
- [M] measured by me: Ryzen 5 5600, Windows 10, rustc 1.95.0, 2026-10-21 05:16–05:18 UTC. Raw output and notes are in `impl/bench-pq/a5_native_verify/`.
- [M-03] and [M-P1] were measured by earlier passes;
- [C] cited from an EIP, crates.io or a forum post, fetched on 2026-10-21;
- [E] estimate;
- [I] inference.

**The three limits apply throughout.** Retirement is:
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance.

No claim below goes beyond these limits.

**What is new compared with [03]:**
1. **A declared PQ signer needs no new contract code.** It can be a *delegation to a key-derived address*. Core retirement already kills delegations.
2. **Raising the 1271 budget to 2M gas, with at most 2 attempts, does less worst-case work than today's 20 attempts at 250k.**
3. **Native ML-DSA is not cheaper than an optimized `ecrecover`.** It is cheaper only than the k256 path Zama ships today.
4. **Cross-implementation agreement is now measured.** RustCrypto `ml-dsa` 0.1.1 matches all 180 Wycheproof ML-DSA-44 vectors.
5. **Precompile and Hegotá status has changed.** EIP-8355 (ML-DSA precompiles) was declined for Hegotá.
6. **Code-first breaks ERC-7739 wallets that sign plain typed data.**
7. **An EIP-8298 migration does not close Zama's legacy path.**
8. **Zama's cleartext mock cannot exercise Level 1 or Level 3.**

---

## 1. Recommendations

### 1.1 ERC-1271 budget

1. **Count the budget in execution gas.** Set `gas_limit = B_exec + intrinsic_max(len)`, where `intrinsic_max = 21,000 + 64 × calldata bytes`. That is an upper bound across Osaka and the Glamsterdam schedule Sepolia runs [M-03].
   - Today the 250k cap is an `eth_call` limit, so calldata counts against it (`shared/user-decryption-signature/src/lib.rs:134-137`) [V].
   - Concrete case: a FIPS-aligned hash-based verifier, SLH-DSA-SHA2-128-24, costs about 142k gas of execution [C, ethresear.ch 25165]. Its 3,856-byte signature alone makes about 269k gas of calldata on Glamsterdam [E: 15,000 + 64 × 3,972]. Today's cap therefore rejects a verifier that fits 250k of execution with room to spare.
2. **Default `B_exec = 2,000,000`, with at most 2 attempts per request.**
   - 2M admits the Fireblocks ML-DSA-44 verifier (1.23M) [M-P1], ETHFALCON (1.55M) and ZKNOX's experimental ML-DSA-65 (1.54M) [M-03/C]. It does not admit NIST Falcon (3.9M) [M-03].
   - **Worst case per request per operator:** 2 × 2M = 4M gas. Today it is 20 × 250k = 5M gas (`config.rs:228-230`; `error.rs:97-114`) [V].
   - **Retries are bounded, not removed.** This respects Zama's documented reason for retrying: wallet state can change (`error.rs:97-100`) [V]. A negative result is retried once, at least one block later.
3. **Cap the signature length before any RPC:** accept at least 32 KiB, preferably 64 KiB.
   - 64 KiB covers every FIPS 204 and 205 signature (SLH-DSA-256f is 49,856 B), PQ multisigs and ERC-7739 wrapping.
   - Cap `publicKey` and `extraData` in the same step.
4. **Configure identically in all three places:** the connector, the legacy-relayer precheck and the SDK constant (`verifyErc1271UserDecrypt-p.ts:28`) [V].
   - The SDK precheck treats a clean revert as definitive (`:136-138`), and its viem wrapper classifies any `execution reverted` reply as a clean revert (`viem/internal/ethereum.ts:100-116`) [V]. Phase 1 saw reth answer an out-of-gas `isValidSignature` exactly that way [M-P1]. On such nodes the SDK rejects a PQ account client-side, before the oracle ever sees the request.
5. **Optional implementation: a deployless checker.** This is an `eth_call` with no `to`, whose initcode runs code-first plus `STATICCALL{gas: B_exec}` and returns a typed verdict.
   - **What it gives:**
     - an exact execution budget on every host chain's gas schedule;
     - a clean distinction between out-of-gas, revert and wrong magic (today the classification depends on the node [M-P1]);
     - host-EVM `ecrecover`, so EIP-8151 is inherited.
   - **Why it is feasible:** `EXTCODESIZE` returns 23 for 7702 accounts [C, EIP-7702]. The pattern is ERC-6492's deployless validator, so no state override is needed [I].
   - **Cost:** one RPC for EOAs, which code-first needs anyway.

### 1.2 Declared decryption signers: a delegation to a key-derived address (KDA)

**Encoding (recommended):**
- The signer bytes use ERC-7913's `verifier ‖ key` layout (Final; `verify(...)` returns `0x024ad318`; verifiers SHOULD be stateless and not upgradeable) [C].
- `KDA = keccak256("ERC-XXXX key-derived decryption signer v1" ‖ signerBytes)[12:]`. The domain tag keeps it distinct from EOA and EIP-7932 addresses.
- **Declaring:** the account calls the existing `ACL.delegateForUserDecryption(KDA, contract | WILDCARD, expiry)` (`ACL.sol:326-377`) [V].
- **The request:**
  - the signer is `userAddress = KDA`;
  - each handle entry has `ownerAddress = account`;
  - the signature field is `abi.encode(signerBytes, sig)`.
- **The verifier:**
  - takes the key route only if `code(KDA)` is empty, the field is not 65 bytes, it parses, and the derived KDA equals `userAddress`;
  - verifies FIPS 204 or 205 natively, with an empty context, over the 32-byte EIP-712 digest;
  - if verification fails, rejects with no fallback to `ecrecover` or 1271.
- **It is unambiguous.** Today a non-65-byte signature for a code-less address is always rejected (`lib.rs:101-107, 161-166`) [V]. The key route only adds acceptances where today's answer is a certain "no". An unmodified connector fails closed (`EoaMismatchNoCode`).
- **For a native-only scheme,** `verifier` can be a reserved scheme identifier. Today no deployed ERC-7913 verifier takes the standard FIPS key encoding: Fireblocks uses a 20,545-byte pk blob and its own interface (`IMLDSAVerifier.sol:5-31`) [V].

**Rules, and why they are safe given B3:**

| # | Rule | Why |
|---|---|---|
| K1 | Only the account declares, through a delegation; it can revoke at any time | Subordinate by construction |
| K2 | Core retirement kills it: `retired[delegator]` disables the delegated views | Retirement kills the declared signer with no extra code |
| K3 | Usable only on delegated entries (`owner ≠ KDA`), never as a direct owner | A KDA cannot transact, so it could never retire itself |
| K4 | A KDA MUST NOT be a PR-2 successor | A successor must be able to resign or retire |
| K5 | Scope and expiry are the existing per-contract or wildcard delegation fields; wallets default to finite expiries | Least privilege |
| K6 | No route switching; the scheme comes from `signerBytes`, never from a tag the relayer can rewrite | No downgrade |
| K7 | In PQ-only mode, a KDA delegation from an ECDSA-rooted delegator counts only if it was created at or before the cutoff block B_Q (§2 Q8) | A quantum attacker can mint new delegations |

**B3 argument (monotonicity) [I].** Everything a KDA can decrypt, the account's root could already grant to *any* address: a wildcard delegation is O(1) today [V-P1]. Adding a KDA therefore never makes compromise of the root key worse. It adds one surface, the KDA's own key, which is bounded by scope and expiry, revocable by the root, and killed by retirement.

It does **not** protect history against compromise of the root key. A root key can still `allow` on-chain, re-delegate or retire.

Because it dies with retirement and gives a thief nothing beyond today's wildcard delegation, it needs no maturity delay, unlike the successor.

**What it buys:**
- **Cost.** About 84–89 µs per request (ML-DSA-44 including the commitment check) [M], against about 4.5–5 ms of EVM time for a 1.31M-gas 1271 path [E from M-03 throughput]. That is 50–60 times less operator work, with no budget dependency.
- **No PQ smart-account deployment.** A first ML-DSA-44 smart account costs 14.6M gas under Osaka rules and 104.9M on Sepolia [M-P1].
- **Least privilege.** A hot decryption key, while the root stays cold or multisig.
- **The only route for accounts with no EVM-callable verifier.** EIP-8288 signatures are proven only inside a block-level STARK [C].
- **A conditional EOA Q-day hedge** (§2 Q8).

**Rejected alternatives:**
- A separate ERC-7913 registry in the ACL: it duplicates delegation storage, events and kill semantics, and needs about 60 or more new lines [E].
- ERC-8231: still a draft, ROTATED keys stay valid, it has no decryption purpose, and EOA-owned entries are ECDSA-controlled [03 C4-7].
- A1 as a root identity: still rejected under B3.

**Status by deployment:**
- **Deployed v0.13.x:** impossible, because the gateway accepts only a 65-byte ECDSA signature from the delegate [V-P1].
- **Main:** a unified-path change to the connector and SDK only.

### 1.3 EIP-7702, 7851, 8151, 8298 and 8141, and what a code-first verifier does

**Status** (eips.ethereum.org, EIP-8081 Hegotá meta, read 2026-10-21) [C]:

| EIP | Effect on decryption authority | Status |
|---|---|---|
| 7702 | The root key keeps every power | Live (Pectra) |
| 7851 | Deactivation marker `0xef0101` | **Declined** for Hegotá |
| 7819 | `SETDELEGATE` instruction | **Declined** |
| 8151 | `ecRecover` returns the address only for empty code or exactly 23 bytes starting `0xef0100`; 6,100 gas cold / 3,200 warm. It does not cover application-level ECDSA, and it tells systems that need state-independent recovery to use their own secp256k1 code | **CFI** |
| 8298 | `SETCODEFROM` (0xA7): adopted regular code, so EIP-3607 rejects ECDSA transactions and 7702 re-delegation is impossible. It names PQ migration as the purpose | **CFI** |
| 8141 | Frame transactions. Code-less senders get default code that accepts **secp256k1 only**; EIP-3607 is lifted for frames; no 7702 auth list; 1271 is not mentioned | **Scheduled** (with 7805 FOCIL) |
| 8288 | leanSPHINCS dependencies proven by a block STARK. No EVM-callable verifier for the key | Draft, not listed |

**Code-first rule** (read code and run 1271 at the same block; never cache code across blocks):
1. **Empty code:** 65-byte `ecrecover`. In PQ-only mode: refuse.
2. **Exactly 23 bytes `0xef0100‖d`:** ERC-1271 on the account.
   - **Shim:** fall back to `ecrecover` only when the call *succeeds with empty returndata*. Never on a revert (including out of gas), on short data or on a wrong magic value.
   - In PQ-only mode: refuse outright with no 1271 call. Typical delegates accept the root key. OpenZeppelin's `SignerEIP7702` is `ECDSA.recover == address(this)` (`signers/SignerEIP7702.sol:18-24`) [V].
3. **Any other code** (8298-adopted code, `0xef0101`, contracts): ERC-1271 only. This is OpenZeppelin `SignatureChecker`'s rule (`SignatureChecker.sol:32-39`) [V], and Fhenix's [V-P1].

**Two new consequences:**
- **ERC-7739 wallets.** OpenZeppelin's `ERC7739.isValidSignature` accepts only nested TypedDataSign or PersonalSign envelopes (`draft-ERC7739.sol:38-48`) [V], and Zama's SDK and connector have no ERC-7739 support (grep: none) [V].
  - Under code-first, a 7702 user whose delegate composes `SignerEIP7702` with ERC-7739 and whose wallet signs plain typed data starts failing. That is a wrong magic value, so the shim does not catch it.
  - **Mitigation:** wallet-side wrapping, which the SDK can detect with the `0x7739…` probe (`:39-46`) [V], plus a shadow-mode rollout that logs would-be rejections before enforcing.
- **8298 and the legacy path.** The gateway verifies legacy permits with `ECDSA.recover` on the gateway chain, which cannot see host-chain code [V-P1]. An 8298-migrated account's *old key* therefore still decrypts through P1/P1d.
  - A conforming verifier that still serves an ECDSA-only path MUST refuse a user or delegate with regular host-chain code. This is SU-5, made a MUST.
  - It is a restrictive rule, so it protects only once at least 9 of 13 operators run it.
  - On the deployed path, only retirement (with a successor) protects a migrated user.

**What 8141 gives:** PQ accounts can call `retireAccount` and `delegateForUserDecryption` natively. Nothing changes for off-chain permits.

### 1.4 Native FIPS 204, 205 and 206 verification, and precompiles

**Crates (crates.io and READMEs, 2026-10-21) [C], all unaudited:**

| Crate | Version (date) | Assurance | Advisories |
|---|---|---|---|
| `ml-dsa` (RustCrypto) | 0.1.1 (2026-06-05) | README says it was never independently audited; the KMS pins and flags it [V-P1] | RUSTSEC-2025-0144 (signing timing, fixed ≥ rc.3); CVE-2026-24850 (duplicate hint indices accepted, fixed rc.4) |
| `slh-dsa` (RustCrypto) | 0.2.0-rc.5 (2026-04-28); last stable 0.1.0 | Pre-release, unaudited | — |
| `fn-dsa` (Pornin) | 0.4.0 (2026-07-22) | README: a best guess at the coming draft, not final FN-DSA; no compatibility promise before 1.0 | FIPS 206 not final (a May 2026 IETF draft calls it forthcoming) |
| `libcrux-ml-dsa` (Cryspen) | 0.0.11 (2026-10-07) | Formally verified field arithmetic, NTT and serialization; no audit stated | 2026: a norm-check bug **accepted oversized responses** (GHSA-cp57-fq8g-qh6v); AVX2 `use_hint` edge case (GHSA-fhvh-vw7h-9xf3) |
| `fips204` (integritychain) | 0.4.6 (2024-12-22) | ACVP and Wycheproof in its tests; no audit stated | — |

**Semantics match:**
- the Fireblocks verifier is FIPS 204 Algorithm 3 with `M' = 0x00‖0x00‖M`, empty context (`IMLDSAVerifier.sol:6-9`; `MLDSA44Verifier.sol:128-129`) [V];
- RustCrypto `verify_with_context(M, &[], σ)` is the same algorithm (`verifying.rs:130-150`) [V];
- EIP-8355 says the same [C];
- the KMS signing wrapper (`dsep‖msg`) MUST NOT be reused [V-P1].

**Cross-check [M].** RustCrypto `ml-dsa` 0.1.1 agrees with all 180 Wycheproof ML-DSA-44 verify vectors (77 valid, 103 invalid, including tcId 18, the CVE case). Fireblocks' Solidity suite asserts the same verdicts with an empty context (`SEC2_Wycheproof.t.sol`) [V, not run].

**Requirements:**
- Enabled parameter sets MUST pass ACVP sigVer and Wycheproof vectors.
- Verifiers SHOULD accept only if two independent implementations both accept, at about 2 × 85 µs.
- Operators MAY diversify libraries: a forgery bug confined to at most 4 of 13 operators cannot reach 5 shares [I].

**Precompiles [C]:**
- **EIP-8051:** 4,500 gas, ML-DSA-44 only, with a 20,512-byte *expanded* key. Draft, not listed.
- **EIP-8052:** Falcon-512, 3,000 gas in total. Draft, not listed.
- **EIP-8355:** ML-DSA-44/65/87 with *compressed* keys, 6,500 / 9,000 / 13,500 gas. **Declined for Hegotá.**
- **SLH-DSA:** no precompile EIP found. The direction is EVM-native: about 94–142k gas for SPHINCS- variants (SLH-DSA-SHA2-128-24 is FIPS-aligned only through the draft SP 800-230).

**How precompiles combine with the cap [E]:**
- **ML-DSA-44 through 8355:** about 177k of calldata plus about 20–30k of execution, roughly 200k. It fits today's cap, barely.
- **ML-DSA-65:** about 234k + 9k + overhead, roughly 255–265k. It fails today's cap.
- **ML-DSA-87:** 318k of calldata alone. It fails today's cap.
- **Conclusion:** precompiles fix B6 only together with §1.1. With it, all three fit even a 250k budget.

### 1.5 Numbers

| Item | Signature / key (B) | Native verify | EVM verification (execution gas) | Calldata on Glamsterdam |
|---|---|---|---|---|
| ECDSA, k256 (the connector today) | 65 / — | **177–213 µs** [M] | ~3k (precompile) | 27,544 f |
| ECDSA, libsecp256k1 | 65 / — | **53–55 µs** [M] | — | — |
| ML-DSA-44 (cold; KDA path) | 2,420 / 1,312; KDA request 3,732 | **82–85; 84–89 µs** [M] | 1.23M (Fireblocks) [M-P1]; 6.5k (8355) [C] | 177,048 [M-03] |
| ML-DSA-65 | 3,309 / 1,952; 5,261 | **135–136; 133–142 µs** [M] | 1.54M (ZKNOX, experimental) [C] | 234,392 f |
| ML-DSA-87 | 4,627 / 2,592; 7,219 | **217–218; 221–264 µs** [M] | 13.5k (8355) [C] | 318,360 [M-03] |
| FN-DSA-512 (pre-standard) | 666 / 897 | **12–13 µs** [M] | ETHFALCON 1.55M; NIST Falcon 3.91M [M-03] | 64,408 [M-03] |
| SLH-DSA-SHA2-128s / 128f | 7,856 / 17,088; key 32 | **150–157 / 402–411 µs** [M] | — | 525,208 f / 1,115,032 f |
| SLH-DSA-SHAKE-128s / 128f | same | 1.39–1.51 ms [M-03] / **4.5–4.7 ms** [M] | — | same |
| SLH-DSA-SHA2-128-24 (SP 800-230 draft) | 3,856 | not measured | ~142k [C] | ~269k [E] |

"f" marks [03]'s fitted formula, `15,000 + 64 × calldata bytes`, which was exact at every size it measured. The other calldata values were measured [M-03].

**Reading the table:**
- Native ML-DSA-44 costs about 0.4–0.5 times the shipped k256 `ecrecover`, and about 1.5–1.6 times libsecp256k1 [M].
- That is negligible next to 4.5–5 ms for an EVM 1271 call.
- Prefer SHA2 SLH-DSA parameter sets: the SHAKE sets are 10 times slower in this crate [M].

---

## 2. Answers to Q1–Q12

**Q1. Ideal end state (2–3 years), from the accounts side.**
1. **Accounts and authority.**
   - Accounts are PQ-validated: frame-transaction accounts, 8298-migrated EOAs or 4337 accounts. Plain EOAs are legacy.
   - Authority is the account's own validation, evaluated code-first with an execution budget.
   - Subordinate key delegations (KDAs) add cheap, natively verified PQ permits.
2. **Lifecycle state** lives in the ACL views the oracle already reads: retirement, the matured successor, delegations including KDAs. There is no Zama "ECDSA disabled" flag.
3. **Verifier parity.** An oracle's verdict equals the host EVM's verdict at the same block (code-first, 8151-consistent). Native PQ verification is FIPS-only, vector-tested and dual-implementation.
4. **PQ-only mode** is a published operator policy with a cutoff block. Signalling uses operator ML-DSA attestations (the KMS can already sign with ML-DSA [V-P1]), not an ECDSA DAO flag.
5. **The reply channel** is a PQ KEM (Zama's ML-KEM). Governance signers are PQ accounts.

**Q2. V1 ideas:** see §3. The verdict on Semih's instinct is at the end of §3.

**Q3. Lifecycle states.**
- **Core:** Active and Retired.
- **Retired-with-successor:** an Extension sub-state (PR-2).
- **No reversible "Suspended" in Core.**
  - For smart accounts it already exists in their own validation (guardians, 7579 hooks), and code-first 1271 honours it.
  - For EOAs it needs a guardian. Whoever can lift the suspension becomes the attacker's target, and it reproduces retirement plus recovery.
  - **Caveat:** account-level suspension does not pause delegations or KDAs. Revoke them, or retire.
- **"Compromised"** = Retired with a reason code in the event, for forensics only.
- **A guardian-initiated *one-way* retirement is acceptable** (it only reduces rights; lockout is mitigated by a successor). It is a generalisation of Q6.

**Q4. Identity versus decryption authority (depth).**
- **Yes, as subordinate key delegations (§1.2), never as a root.**
- **Safe under B3 because:**
  - it is monotone: it grants nothing the root could not already grant;
  - it cannot re-share: a KDA can neither transact nor delegate onward;
  - retirement kills it (K2);
  - it is decrypt-only, scoped and expiring;
  - it is unusable as a direct owner or a successor (K3, K4).
- **Rotating a smart account's owner does not revoke its KDAs.** Wallets must list and revoke them.
- **The account's `invalidateDecryptionSignaturesBefore` does not reach KDA permits,** because their `userAddress` is the KDA. Revoking the delegation kills them all at once.
- **Role split:**
  - 1271, code-first with the budget, stays the primary route for smart accounts;
  - a KDA is the cost and least-privilege route;
  - an EOA KDA is only the conditional hedge in Q8.
- **Level 3 test location:** Zama's cleartext mock checks the user signature with a 65-byte EVM `ecrecover` only (`CleartextKMSVerifier.sol:225-261, 307-313`) [V], and its unified V2 path throws a not-implemented error (`sdk/js-sdk/src/core/modules/relayer/cleartext/fetchUserDecryptV2.ts`) [V]. Level 1 (the 1271 budget) and Level 3 (the KDA route) must therefore run in the connector or shared-crate harness, as Phase 1's E4 did.

**Q5. Continuity.**
- **Both carry and successor.** Carry (`multicall [allow…, retire]`) for auditor continuity: the successor has no transitivity (SU-9).
- **Encoding: a dedicated successor, not a locked wildcard delegation (SU-14).**
  - A locked wildcard is indistinguishable from KDAs and ordinary delegations, which retirement must kill.
  - Indexers must change in either case to treat one delegation as surviving.
- **The successor must be a transacting account** (K4).
- **Prefer a regular-code or PQ successor.** A 7702 successor carries B5.
- **On deployed P1d,** the successor must be an ECDSA EOA [V-P1].

**Q6. Revocation certificate.**
- **Worth it as an Extension.** Verify it code-first (OpenZeppelin `SignatureChecker`).
  - Host `ecrecover` inherits 8151 for migrated accounts.
  - A 1271 PQ certificate costs 1.2–8.4M gas, paid once by the watchtower [M-P1/C].
- **Domain:** sign a chain-agnostic domain so one certificate retires the account on every host chain. This is acceptable only because retirement reduces rights.
- **Quantum forgery** of an ECDSA certificate means a forced retirement: lockout, which a successor removes. It never grants access.
- **Limits:** private order flow does not help against permit decryption, which needs no transaction (limit 1). ERC-7739 accounts must sign the certificate in their own envelope.

**Q7. Cross-chain.**
- **Account state is per chain:**
  - 7702 authorizations can be chain-specific;
  - 8298 adoption is per chain;
  - KDA delegations are per ACL.
- **Verifier rule:** evaluate code and views on the handle's host chain, using the chain id from the handle (connector `decryption.rs:336`) [V].
- **Tools:** use the chain-agnostic certificate and `retireEverywhere()`. There is no propagation protocol.

**Q8. Q-day / PQ-only mode (depth).**
- **What it is:** "no-root-ECDSA" mode. It cannot certify that a contract's 1271 is PQ: a Safe with ECDSA owners passes. That residual stays with the account.
- **Who flips it:** each operator, per host chain, by configuration.
  - It protects only at **9 of 13 or more** (n − t). Additive routes need only 5 or more for liveness [I from V].
  - Adoption is signalled by operator-signed ML-DSA statements, not an ECDSA DAO vote (B8).
- **Preconditions:**
  1. on at least 9 operators: the 1271 execution budget, the KDA route with conformance evidence, and the legacy-path refusal;
  2. a published readiness KPI: the share of active decryptors with a PQ route;
  3. a stated recovery path.
- **Notice and cutoff B_Q:**
  - **Planned:** at least 180 days' notice, with B_Q = the activation block, so users have time to delegate to KDAs.
  - **Emergency** (credible evidence of a quantum computer): immediate, with B_Q = the last block before the evidence. Some legitimate late delegations are lost.
  - Reading B_Q needs the stored `lastBlockDelegateOrRevoke` (`ACL.sol:133-140`) [V] through a one-line getter, or from events.
- **Effect per path:**

| Path or signer | Effect |
|---|---|
| Legacy P1/P1d | refused |
| Code-less root | refused |
| `0xef0100` root | refused, no shim |
| Regular-code 1271 (incl. 8298) | accepted (account-asserted) |
| KDA from a regular-code delegator | accepted |
| KDA from an ECDSA-rooted delegator | accepted only if created ≤ B_Q |
| Retired account (any route) | refused (Core) |

- **Recovery:**
  - Ethereum-level recovery that installs PQ code at the same address restores decryption automatically through code-first, with no Zama state.
  - Pre-cutoff KDAs keep working, and successors read.
  - Everyone else is locked out, but nothing leaks through the oracle.
- **The EOA hedge** (a KDA delegated before B_Q) protects history only if the chain also freezes that EOA's ECDSA transactions. Otherwise the quantum attacker uses the on-chain door (B3).

**Q9. Governance (accounts side).**
- **PQ multisig owners.** OpenZeppelin `MultiSignerERC7913` exists [V]; at about 1.2–8M gas per approval [M-P1/C] it is affordable for rare operations.
- **Timelock with an exit window.** It works only because retirement is not pause-gated. 8141 lets PQ accounts react inside the window.
- **Release rule:** as the judge set it.

**Q10. Vendor neutrality.** Every oracle MUST:
1. read lifecycle in the on-chain views;
2. match the host EVM's signature verdict, or document its subset;
3. publish its budgets and caps;
4. for the PQ profile, use a PQ reply KEM. Fhenix's X25519 [V-P1] and Inco's ECIES (per the brief) do not qualify.

Fhenix already meets point 2 (OpenZeppelin code-first, no fixed cap) [V-P1].

**Q11. Changes per component, in order.**

| Component | Change |
|---|---|
| ACL | Core first. A KDA needs **no** ACL change. Optionally a getter for `lastBlockDelegateOrRevoke` |
| Executor | None |
| Connector | Level 1: code-first, shim, `B_exec`, caps, bounded attempts, legacy refusal of regular code. Then the KDA route (vectors, dual implementation), then the PQ-only configuration |
| Relayer and SDK | Mirror the caps and the budget. SDK: code-first precheck, KDA request building, ERC-7739 awareness, transport-key purge on retire |
| KMS | None for user authority; it never sees user signatures [V-P1] |
| Gateway | None; deprecate the legacy path |
| Governance | PQ signers and a timelock |
| OpenZeppelin ERC-7984 | Gate `setObserver` and `setOperator` |

**Q12. Conformance (depth).**
- **Core-conforming verifier:**
  1. it refuses unless the direct or delegated view is true for every handle;
  2. all reads for one decision use one block, and code and lifecycle are never cached across blocks;
  3. it re-checks before publishing results and before re-serving a stored result;
  4. it returns a typed `ACCOUNT_RETIRED`.
- **Core-conforming oracle:** every share-producing node conforms. This is automatic, because Core lives in views the nodes already read.
- **Extension conformance:**
  - A *restrictive* Extension (code-first's 7702 rejection, legacy refusal, PQ-only) may be claimed only at n − t or more enforcing nodes.
  - An *additive* Extension (budget, KDA) needs t + 1 or more supporting nodes, each passing the vectors.
- **Normative tests:**
  - code-first cases (empty; `0xef0100` accept, reject or empty; regular code);
  - budget excludes calldata;
  - cap enforced before any RPC;
  - at most 2 attempts;
  - KDA positive and negative, including the Wycheproof vectors;
  - retirement kills KDAs and delegations.

---

## 3. V1-idea verdicts

| V1 idea | Verdict | Form | Reason |
|---|---|---|---|
| C1 sealing | **Returns** | Core read-side retirement bit | The intent (a user-owned, one-way decryption retirement) is right. Write-side guards and the sentinel failed [V-P1] |
| C2 carry-and-seal UX | **Returns as UX** | SDK `multicall` plus a matured successor; no `carryAndSeal` | Fusing grant and seal turns one phished transaction into an irrevocable grant |
| C3 connector rules | **Vision returns** | Code-first plus the legacy refusal of regular code | The EIP-8151 rule still accepts 7702 root keys. The rule that verifiers honour account state is right |
| C4(a) allowlist | **Not at all** | Execution budget | Proxies and modules defeat it, and it requires a curator |
| C4(b) native PQ | **Returns** | KDA delegation, ERC-7913 bytes, FIPS-only | `pqAuthKey()` and the in-band tag are replaced. It needs no ACL change |
| C4(c) precompiles | **Later** | Only with the execution budget | 8355 declined; 8051/8052 unlisted; calldata is the binding cost |
| C5 fail-closed | **Returns, re-scoped** | PQ-only operator policy with cutoff, notice and recovery | An ECDSA governance flag is a T2 target, and "protects history" overclaimed (B3) |
| ERC-7984 PQ profile | **Returns, re-scoped** | A vendor-neutral lifecycle ERC; ERC-7984 keeps only "identity-gated grants MUST honour retirement" | V1's R1 becomes Core; R2 code-first; R3 PQ-only; R4 KDA |
| "Pure PQ smart account as the destination" | **Narrowed** | One option among 8298, successor and KDA | It costs 14.6M–104.9M gas [M-P1] and has no deployed-path support |

**Testing Semih's instinct.** It is largely right on *scope*. V1 saw the whole lifecycle: retire, carry, cheap PQ verification, a Q-day backstop, and both doors. Every V1 goal (G1–G6) maps to a component of the target, and the target adds successor, apps, governance and transport hygiene.

It is wrong on **three vision-level claims**, not only on mechanism:
1. that an off-chain switch protects history at Q-day (B3 says it does not unless the chain also freezes EOAs);
2. that everyone should move to a pure PQ smart account (too costly; the KDA is a cheaper PQ destination for authority);
3. that 7851 would close the 7702 gap (it was declined, and 8151 keeps 7702 root keys by design).

---

## 4. Core versus Extensions

| Part | Normative content (accounts view) | Needs |
|---|---|---|
| **Core (MUST)** | Retirement in views; the Q12 verifier rules | ACL only |
| Ext. Signature hygiene (Level 1) | Code-first and shim, `B_exec ≥ 2M` (SHOULD), cap ≥ 32 KiB, at most 2 attempts, legacy refusal of regular code | Connector, relayer, SDK |
| Ext. Successor | Dedicated and matured; transacting accounts only | ACL |
| Ext. Key-derived decryption signer | §1.2: KDA derivation, K1–K7, FIPS 204/205, vectors, dual implementation SHOULD | Connector, SDK |
| Ext. Revocation certificate | Code-first verification, chain-agnostic domain | ACL |
| Ext. PQ-only signalling | Operator ML-DSA attestations, B_Q rule, per-path table | Operators |
| Ext. Cross-chain | Certificate plus `retireEverywhere`; per-chain evaluation | SDK |

---

## 5. Expected disagreements

1. **A3 (Zama):** code-first breaks 7702 users on ERC-7739 delegates or wallets that sign plain typed data. *Mine:* code-first with the shim and shadow mode first. Keep ecrecover-first only as a time-boxed fallback.
2. **A3:** "2M is a DoS increase." *Mine:* 4M worst case against today's 5M.
3. **A4 (red team):** the KDA is new forgery surface (libcrux shipped a norm-check bug). *Mine:* gate it on vectors, two implementations and diversity, and prototype it now.
4. **A2 (clean slate):** a separate PQ decryption identity or registry. *Mine:* a KDA delegation is the subordinate form, with zero ACL code.
5. **A6 (product):** marketing the KDA as "PQ protection for EOAs." *Mine:* it is a conditional hedge only.
6. **Successor encoding (SU-14):** I choose a dedicated successor (K4 and kill semantics).
7. **The judge's earlier "C4(b) later":** I would move the KDA prototype into Level 3 now. Production stays gated on conformance evidence.

---

## 6. Open questions

1. Which `ml-dsa` implementation would Zama accept (RustCrypto, libcrux, aws-lc-rs), and with what audit? I could not confirm aws-lc-rs's ML-DSA API or FIPS coverage.
2. Which delegates do the 17.2% of 7702 holders use, and do they need ERC-7739? This decides the cost of code-first.
3. Do operators' nodes all support deployless `eth_call`? I did not test this.
4. The exact KDA domain tag and scheme identifiers, and whether to align with EIP-7932's ALG_TYPE numbering.
5. The final Hegotá scope for 8151 and 8298, and adoption on L2 hosts (Polygon).
6. FIPS 206 finalisation. Native crates for SP 800-230 limited-signature SLH-DSA.
7. Wycheproof and ACVP agreement for ML-DSA-65/87 and SLH-DSA. Only ML-DSA-44 is measured.
8. Do operators accept the B_Q emergency rule, which retroactively voids late delegations?

**Reproduce:** `impl/bench-pq/a5_native_verify/` (see `MEASUREMENT_NOTES.txt`; it builds offline; all crates are unaudited).
