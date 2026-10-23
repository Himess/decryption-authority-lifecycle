# Decryption Authority Lifecycle: target architecture

**Revocable access for oracle-based confidential execution, with Zama fhEVM as the reference system**

| | |
|---|---|
| **Owner** | Semih Civelek (Himess) |
| **Date** | 2026-10-21; Phase 4 additions 2026-10-22 (§11) |
| **Status** | Design, with a local reference prototype of Levels 0–3 on Zama's own mocks and test setups (status per level in §4; measurements in `results/RESULTS.md`). Follows the deliberation rulings. Local document: nothing has been published or sent. |
| **Companions** | `erc/ERC-XXXX-decryption-authority-lifecycle.md` (the registry-side standard: Core, E1, E2); `docs/COMPANION_EXTENSIONS_AND_PROFILES.md` (E3 and Profiles H, Q, A); `docs/HEDEF_MIMARI_TR.md` (complete Turkish version) |

**Inputs, in order of authority:**
1. The brief, `docs/CLAUDE_CODE_BRIEF_ERC_TARGET_DESIGN.md` (§0, §1, §4 B1).
2. `results/deliberation/DELIBERATION_SUMMARY.md`. Its rulings are binding. Where the inputs conflict, this document follows it, and Appendix A lists the conflicts.
3. `results/deliberation/A1…A7_*.md` and `COORDINATOR_VERIFICATION.md`, for depth and evidence.
4. Background: `results/VERIFICATION.md`, `DESIGN_REVIEW.md`, `G1_TARTISMA_RAPORU.md`, `results/review/04_census/aggregate.json`, and the original vision V1, `docs/FHE_Yetkilendirme_PQ_Tasarim.md`.

No new research went into this document. It synthesises the inputs.

---

## How to read this document

**Order.** The brief asks for the vision first, then the path, then the minimum for today:
- §1–§3: what we have in mind (problem, principles, end state);
- §4: how to get there (Levels 0–3);
- §5: what can ship today;
- §6–§10: the record (decisions, non-goals, the V1 mapping, residual risks, open questions).

**Evidence labels.** Every factual claim carries a label copied from the inputs.
- A label is never upgraded. Where two inputs label the same fact differently, the lower label is used (Appendix A).
- Design statements, such as what the architecture requires, carry no label. They are decisions, recorded in §6.

| Label | Meaning |
|---|---|
| [V-A7] | Verified in code by the judge (A7), at the file:line given in `A7_judge.md` |
| [V-CV] | Verified in code by the coordinator (`COORDINATOR_VERIFICATION.md`) |
| [V-A1] … [V-A6] | Verified by that deliberation agent; not re-checked by the judge |
| [V-P1] | Verified in Phase 1 (`results/VERIFICATION.md`), in code or by read-only chain reads |
| [V-05] | Verified by the Phase 2 judge, as reported in `DESIGN_REVIEW.md` |
| [M-…] | Measured; the sources are in the next table |
| [E] | Estimate |
| [I] | Inference |
| [C] | Cited from a specification or web page; not reproduced |

**Measurement sources.**

| Label | Source | Date (UTC) | Hardware and software |
|---|---|---|---|
| [M-P1] | Phase 1 (`results/VERIFICATION.md` §5): Sepolia transactions from our own accounts (blocks 11958285–11958369), and local anvil under Osaka rules | 2026-10-20, 22:32–22:49 | AMD Ryzen 5 5600 (6C/12T), 16 GiB, Windows 10 Pro 19045; anvil/forge 1.8.5, solc 0.8.30, Node 22.13.0, Rust 1.95.0 |
| [M-03] | Phase 2 reviewer 03 (`results/review/03_aa_pq_expert.md`) | 2026-10-20, 23:15–23:31 | AMD Ryzen 5 5600, 16 GB, Windows 10 Pro 19045; Rust 1.95.0; forge/anvil/cast 1.8.5; solc 0.8.25 |
| [M-04] | Mainnet census, aggregates only (`results/review/04_census/aggregate.json`). Read-only `eth_getLogs` on the Ethereum mainnet ACL v0.4.0, blocks 23,832,647–26,237,004 (2025-11-19 to 2026-10-20) | run 2026-10-20, 23:15–23:55 | AMD Ryzen 5 5600, Windows 10 Pro 19045; Node 22.13.0, Python 3.11.9 |
| [M-A5] | Deliberation agent A5: native PQ verification benchmarks. Raw outputs in `impl/bench-pq/a5_native_verify/` | 2026-10-21, 05:16–05:18 | AMD Ryzen 5 5600, Windows 10, rustc 1.95.0; RustCrypto crates, all unaudited |
| [M-L1] | Level 1 (`results/level1/PROFILE_H_CRATE.md`, `PROFILE_H_CONNECTOR.md`, `H9_PRECHECKS.md`): the signature crate and the SDK precheck on local anvil (Osaka), and Zama's kms-worker against a local anvil and the relayer's unit tests on the VPS | 2026-10-21 | AMD Ryzen 5 5600, Windows 10 Pro 19045, Rust 1.95.0, anvil 1.8.5; the VPS (4 vCPU), Rust 1.99.1, anvil 1.3.5 |
| [M-L2] | Level 2 (`results/level2/`): Foundry tests and anvil gas runs on the `lifecycle/level2` branches, and the connector proof on the VPS | 2026-10-21 | AMD Ryzen 5 5600, Windows 10 Pro 19045, forge/anvil 1.8.5, solc 0.8.24; VPS as for [M-L1] |
| [M-L3] | Level 3 (`results/level3/LEVEL3.md`): Foundry on `lifecycle/level3`, anvil harnesses (three chains for the watchtower), the shared crate's KDA tests, the Profile Q simulation, and the rerun of A5's benchmarks | 2026-10-21 | AMD Ryzen 5 5600, Windows 10 Pro 19045, forge/anvil 1.8.5, solc 0.8.24, Node 22.13.0, Rust 1.95.0, Python 3.11.9 |
| [M-P4] | Phase 4 (`results/phase4/`): the connector, endpoint and relayer harnesses on the VPS, the SDK and crate tests on M1, three runs per check unless stated | 2026-10-21 onwards | AMD Ryzen 5 5600, Windows 10 Pro 19045, Rust 1.95.0, anvil 1.8.5; the VPS (4 vCPU, capped scope), Rust 1.99.1, anvil 1.3.5, Postgres 17.5 |

**Vendor neutrality.**
- Principles and target requirements are vendor-neutral.
- Zama-specific facts and changes are marked **Zama:**, and Fhenix ones **Fhenix:**.
- **Path shorthands** (as in A7):
  - `main` = fhevm `ed851716c`; `v0.13.8:` = that tag;
  - `mock/` = `sdk/js-sdk/contracts/src/v0.13.0/`;
  - `OZ/` = `@openzeppelin/confidential-contracts` 0.5.3; `OZc/` = `@openzeppelin/contracts` 5.6.1;
  - `lib.rs` = `shared/user-decryption-signature/src/lib.rs`; `decryption.rs` = the kms-worker event processor.
- **"Deployed"** means Sepolia and Ethereum mainnet on release v0.13.x (ACL v0.4.0, legacy gateway path). Polygon mainnet also runs ACL v0.4.0 [M-04].

**Vocabulary.** "Revocable access" and "retire" (TR: *emekliye ayırmak*). The two terms that brief §1 bans are not used.

**Terms.**

| Term | Meaning |
|---|---|
| Registry | The host-chain contract whose views decide use and decryption rights (Zama `ACL`, Fhenix `ACL`) |
| Engine | The fixed computation contract (Zama `FHEVMExecutor`, Fhenix `TaskManager`) |
| Verifier | A component whose decision gates release (connector, TEE dispatcher). SDK and relayer prechecks are advisory |
| Oracle | The set of release nodes: n nodes, of which t+1 responses reconstruct. A restriction binds only when at least n−t nodes enforce it |
| Subject | Every party a request rests on: requester, owner or delegator, delegate, contract, permit issuer, permit recipient |
| Grant path | A call that extends rights over a handle, publishes it, or creates a delegation or permit |
| Deputy | A contract that acts for a caller after checking `isAllowed(h, caller)` |
| On-chain door | Transactions that use, re-grant or publish a handle. The host chain authenticates the sender |
| Off-chain door | Signed requests that ask the oracle to decrypt. The verifier authenticates the signer |
| T1, T2 | T1: a classical key thief (today). T2: a cryptographically relevant quantum computer that derives every exposed secp256k1 key (Q-day) |
| ICS | Implementation Conformance Statement |
| KDA | The key-derived address of a declared decryption signer (Extension E3) |
| B_Q | The cutoff block of Profile Q |

---

## At a glance

- **Problem.**
  - In oracle-based confidential execution, the confidentiality of history is decided again at every decryption request.
  - The authority behind that decision is an ECDSA key with no lifecycle.
  - On Zama's deployed system an address cannot retire its own decryption authority, and one transaction from its key re-shares or publishes its whole history [V-P1; M-P1].
- **Core idea.**
  - A one-way `retired` bit, set only by the account.
  - It is enforced inside the registry views that every verifier, SDK precheck and on-chain deputy already reads.
  - It closes both doors for every connector version at the upgrade block, with no off-chain code change [I from V-A7].
- **End state:**
  - PQ-validated accounts;
  - a vendor-neutral lifecycle in the registry views: retire, an accepted successor, a retirement certificate;
  - subordinate PQ decryption signers, verified natively;
  - code-first verifiers under an execution-gas budget;
  - a PQ-only operator profile that follows the host chain's ECDSA sunset;
  - timelocked PQ governance, ratified by operators;
  - ephemeral PQ transport.
- **Path:**
  - Level 0: the Core (deployable now);
  - Level 1: signature hygiene (main);
  - Level 2: continuity and applications;
  - Level 3: PQ-native authority, the PQ-only profile, retirement certificates and governance.
- **Today.** ACL 0.4.1 on the v0.13 line, with an on-chain upgrade guard and a release-train rule (§5).
- **Phase 4 (§11).** The standard is split into a registry-side ERC and a companion. Core also runs on a port of Fhenix CoFHE and maps onto Inco by reading. Amsterdam costs were measured, and the EIP-7851 gap was shown. A vendor-neutral conformance kit passes on three registries.
- **The three limits:**
  1. pre-emptive, not a clawback;
  2. oracle access only;
  3. as final as the chain's governance.

---

## 1. Problem and thesis

### 1.1 Oracle-mediated confidentiality

In oracle-based confidential execution, contracts compute on encrypted data. Plaintext leaves the system only when a decryption oracle agrees that the requester is entitled to it. The oracle can be:
- **a threshold network.** Zama's KMS has 13 nodes, and any 5 matching responses reconstruct [V-A7, `api-p.ts:405-418`];
- **a TEE.** Fhenix's Teecryptor `eth_call`s the registry and trusts the boolean answer [V-P1].

Three consequences follow:
1. **The decision repeats.** A ciphertext is never spent. It stays where it is, and its confidentiality is **decided again at every request**.
2. **There are two doors.**
   - The **on-chain door** carries transactions that use, re-grant or publish a handle. The host chain authenticates them.
   - The **off-chain door** carries signed requests to the oracle. The verifier authenticates them.
3. **Strong ciphertexts, weak authority.** The ciphertexts can be post-quantum: TFHE is lattice-based [C], and Zama's user reply channel is hybrid ML-KEM-512 [V-A7]. The authority to ask, however, is an ECDSA key bound permanently to an address.

Confidential history is therefore only as durable as the authority behind both doors, and today that authority has no lifecycle.

### 1.2 What is missing today (Zama as the reference)

| Finding | Deployed v0.13.x | Main `ed851716c` | Evidence |
|---|---|---|---|
| **No user-side retirement.** An account can revoke or shorten a delegation it granted, and on `main` invalidate its permits whose start time is earlier than a chosen time; it cannot end its own authority, withdraw a per-handle grant, undo a public decryption, or stop its key from signing new permits (`results/phase5/P0_1_USER_SURFACE.md`). The deny list is owner-only. It is checked only for `msg.sender`, in three write functions, and never for recipients, delegations, views or any off-chain component | same | same | [V-P1] |
| **History re-shares in one transaction.** On Sepolia, one `allow(balance, BOB)` from our test account let BOB decrypt 21000 (140,780 gas), and one `allowForDecryption` made it public (141,493 gas). A single `delegateForUserDecryption(attacker, WILDCARD, type(uint64).max)` covers every past and future handle in O(1) gas | confirmed on Sepolia | same code; dApp deputies and the bridge add more routes | [M-P1] Sepolia; [V-P1] code |
| **Invalidation acts on permits, not keys.** The signer chooses `startTimestamp`, so a key holder simply signs a fresh permit | no invalidation at all: a permit lives until it expires (≤ 365 days) | confirmed; narrowed to EOAs and 7702 EOAs | [V-P1] |
| **The off-chain check ignores host-chain account state** | the gateway runs `ECDSA.recover` on the gateway chain | `ecrecover` runs first, with zero RPC | [V-P1] |
| **A 7702-delegated EOA's original key still decrypts** | confirmed on Sepolia: an EOA delegated to a reject-all wallet still decrypted with its original key | the `ecrecover`-first ordering accepts it | [M-P1]; [V-P1] |
| **PQ accounts cannot authorise** | no ERC-1271 path: a 2,420-byte ML-DSA-44 signature gets HTTP 400 | the ERC-1271 cap is 250,000 gas including calldata; ML-DSA-44 needs a `gas_limit` of 1,309,193, 5.24× the cap | [M-P1] |
| **Governance can rewrite every layer** | the mainnet ACL owner is an Aragon DAO that either of two EOA-rooted multisigs (3-of-6; 9-of-17) can execute through, with no timelock | same upgrade surfaces (UUPS) | [V-P1], on-chain reads 2026-10-20 |

**Who is exposed.**
- In a random sample of 1,000 mainnet holder accounts, 807 are plain EOAs and 172 are 7702-delegated EOAs. About 98% are therefore ECDSA-rooted [M-04].
- 12,714 end accounts have received confidential handles: median 12 handles, p99 127 [M-04].

**Why node-side fixes do not suffice.**
- Each KMS party computes its user-decryption share locally, and t+1 = 5 of 13 responses reconstruct [V-A7].
- A restriction enforced in node code or configuration therefore protects nobody until at least n−t = 9 operators run it, while a leak needs only 5 [I from V-A7].
- A restriction placed in an on-chain view binds every verifier version from the upgrade block [I from V-A7].

### 1.3 Thesis

> In oracle-based confidential execution, the confidentiality of past data is decided again at every decryption request. The ciphertexts can be post-quantum while the authority to ask is an ECDSA key bound to an address. This design adds the missing lifecycle step, **revocable access**:
> - an account can **retire** its authority to ask;
> - every conforming oracle then refuses every request that rests on that authority;
> - the state lives in the on-chain views the oracle already consults.

The lifecycle is *modelled on* the NIST SP 800-57 key states that Zama applies to its own KMS keys [V-A7, `docs/protocol/architecture/kms.md:24, 68-77`]. It is not equivalent to them: Zama's table keeps Suspended, Deactivated and Compromised keys usable for decryption [V-A7], so the analogy supports nothing stronger.

### 1.4 The three limits

They are stated in full here and restated wherever the design is summarised.
1. **Pre-emptive, not a clawback.**
   - Retirement protects an address whose key has not yet been used against it.
   - Whatever the key already re-shared, published or had decrypted stays exposed.
   - After a compromise, retirement is a race that the attacker usually wins.
2. **Oracle access only.** Retirement stops the oracle honouring the key. It does not stop the key acting as an account: funds, asset authority and application roles such as observers and operators stay with it.
3. **As final as the chain's governance.**
   - Retirement is per host chain, and whoever can upgrade that chain's contracts can undo it.
   - In a PQ world it is also only as sound as the host chain's own consensus and account authentication.

### 1.5 Goals and scope

The goals are V1's G1–G6, all kept (§8):

| Goal | Content |
|---|---|
| G1 | A pre-emptive cut-off of a key's access to history |
| G2 | Moving to a PQ account without losing history |
| G3 | Affordable PQ authorization |
| G4 | Failing closed at Q-day. Re-scoped: this holds for the off-chain door only, unless the host chain freezes ECDSA |
| G5 | Backward compatibility |
| G6 | Minimal change: no new primitive and no new trust root |

**Out of scope,** as in V1:
- a key that is stolen before the user acts (limit 1);
- counterparties' own rights over shared handles.

---

## 2. Principles

These are the deliberation's principles (`DELIBERATION_SUMMARY.md` §(g)), each with a one-line rationale.

| # | Principle | Rationale | Applied in |
|---|---|---|---|
| P1 | **Decide in the view.** Lifecycle state lives in the on-chain views the oracle already consults. Node code may only restrict, never extend | A view binds every verifier at the upgrade block with zero code change. Otherwise a deployment behaves like its (t+1)-th most permissive node | Core R6, V1; §3.1, §3.3 |
| P2 | **Retirement only ever reduces rights** for the retiring key, and it binds every verifier at the upgrade block | A pure reduction is safe to make unconditional (no pause, role or fee gate) and cannot be turned into a grant | R3–R5 |
| P3 | **What survives retirement must mature; what retirement kills may be instant.** A successor is pre-committed while the key is safe, delayed (D ≥ 7 days), public and accepted by its beneficiary. Delegations and declared signers may be instant, because retirement kills them | A surviving right is a thief's best capture, so it must be committed while the key is safe. Rights that retirement kills add nothing a thief cannot already get from a wildcard delegation [I from V-P1] | E1 (delay, acceptance); E3 (no delay) |
| P4 | **The one-key rule.** For an ECDSA account, the owner and the thief hold the same key. Any transition that key alone can trigger must be a pure reduction. The only `WithSig` path is retirement, and it is bound to the successor | Every single-key transition is available to the thief too | E2; no `WithSig` for E3 |
| P5 | **Every authorizing party, in every role.** Exemptions are defined by what a check is for, never by who calls | A missed role is a bypass, as with a retired contract on the delegated path [V-CV] or a Fhenix permit recipient [V-A7]. A caller-identity exemption switches retirement off on a relaying engine [V-CV] | R6, R10 |
| P6 | **Threshold arithmetic.** A leak needs t+1 nodes; a restriction binds at n−t. Restrictions belong in views; node-side restrictive rules are claimed only at n−t | With local shares and t+1 = 5 of 13, nine operators must enforce a node rule before it protects anyone [I from V-A7] | O1; Profiles H and Q |
| P7 | **Monotone state that outlives every release:** namespaced storage, an upgrade guard (ERC-165 plus storage location), a canary, pinning | Today a Core-less release silently stops reading the bits: 0.4.1 → 0.6.0 or 0.7.0 would succeed [V-A7] | R11; §5.4–§5.5 |
| P8 | **Follow the host chain, never lead.** PQ-only claims for unmigrated accounts hold only where the host chain freezes ECDSA. Code-first verification inherits host-chain account changes | Only the host chain can close the on-chain door for an unmigrated EOA. An oracle policy refuses the forged permit, not the forged `allow` [V-A7 for the code; I for the impact] | Profiles Q and H |
| P9 | **No ECDSA in the end-state authority chain:** users, governance, gateway, operator responses, transport. Until then, label every claim with its ECDSA dependency | Every ECDSA link is a T2 failure point, and governance is the largest single one [I from V-P1] | §3.6–§3.8 |
| P10 | **Separate powers and keys.** Authority keys sign; transport keys receive. A successor inherits decryption authority only. A declared signer cannot act on-chain | A narrow key limits what its compromise yields | E1, E3, §3.11 |
| P11 | **Ephemeral by default:** a transport key per request, purged on retirement; a TTL on stored results; a re-check before re-serving | Retirement cannot retract released shares, whose secrecy rests on a transport key that is reusable for up to 365 days today [V-P1] | V6; §3.5, §3.11 |
| P12 | **Host-state sources are trust roots.** Declare them and diversify them | Whoever controls the host-state answers of t+1 or more nodes can make them answer "allowed" for any request, bypassing every ACL rule [I from V-A7] | O2, O3 |
| P13 | **One vendor-neutral surface:** an ERC-165 id, `isAccountRetired`, `AccountRetired(account, successor)`. Conformance is per chain, per release and per deployment (ICS) | Wallets and verifiers must detect and read one interface across vendors and releases | R12, O2 |
| P14 | **Honest limits everywhere:** pre-emptive, not a clawback; oracle access only; as final as the chain's governance | V1's "residual risk: none" was its main overclaim | every section |
| P15 | **A deployable minimum with a stated vision.** Every decision says what we do, what we deliberately do not do, and why | Minimality must not shrink the vision, and the vision must not blur what is deployable today (brief §0) | §5–§7 |

---

## 3. The ideal end state

### 3.0 The end state in brief

This is the state targeted for two to three years from now (the A7 ruling on Q1).
- **Authority:**
  - the account's own validation, evaluated code-first under an execution-gas budget;
  - optionally, a subordinate PQ decryption signer, verified natively.
- **Accounts.** PQ-validated accounts are the norm: ERC-1271 smart accounts, accounts with EIP-8298-adopted code, frame-transaction accounts. EOAs are legacy, and their exit is retire-with-successor.
- **Registry.** Lifecycle state lives in each vendor's registry views and is uniform over roles. The registry sits behind a timelock with PQ signers and operator ratification.
- **Verifiers:**
  - decide only from those views;
  - pin implementations and watch a canary;
  - diversify their host-state sources;
  - follow the host chain's ECDSA sunset with a PQ-only profile.
- **Transport** is ephemeral and PQ on both the input and the reply channel.

The three limits still bound the end state:
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance, and only as sound as the host chain's consensus and account authentication.

```
 HOST CHAIN  (authenticates transactions; freezes ECDSA at its own sunset; offers recovery)
 +-----------------------------------------------------------------------------------+
 |  account --tx--> REGISTRY (ACL)  <--operand check (exempt)--  ENGINE (executor)   |
 |                    lifecycle: Active -> Retired; successor (E1); cert. (E2)       |
 |                    views: use | on-behalf | permit   -- every role gated          |
 |  deputies (apps, bridge) --isAllowed(h, caller)--> views   (closes on-chain door) |
 +--------------------------------------+--------------------------------------------+
                                        | eth_call, no `from`, fresh, every subject
 request --> RELAYER --> VERIFIER (connector / TEE) --release iff all views true--> ORACLE NODES
            (advisory)    code-first, budget, KDA route,                           replies: FIPS 203 KEM,
                          canary, pinning, Profile Q                              ephemeral transport key
 GOVERNANCE: timelock owns every authorization-path contract; PQ signers; >= n-t operator ratification
```

| Component | Role in the end state (vendor-neutral) | First level |
|---|---|---|
| Registry | Holds and enforces lifecycle state in every view, for every role | L0 |
| Engine | Computes for its caller; the only exempt evaluation, defined by purpose | L0 (tests only) |
| Verifiers | Release only on fresh, true views for every subject; code-first; native PQ; operator duties | L0 (no change), L1, L3 |
| Relayer | Untrusted transport; advisory prechecks that mirror the verifier | L1, L2 |
| SDK | Lifecycle client: status, carry, successor, certificates, transport hygiene | L1–L3 |
| Oracle and KMS | Conformance at ≥ n−t nodes; ICS; PQ response signatures; PQ reply KEM | L0 (ICS), L3 |
| Gateway | Ordering and fees only; legacy ECDSA path retired | L3 |
| Governance | A timelock over every authorization-path contract; PQ signers; operator ratification | now (separate ask), L3 |
| Applications | Identity-gated grant paths honour retirement (Profile A) | L2 |
| Wallets and custody | Per-chain authority panel, clear signing, custody runbooks | L2–L3 |
| Transport | Ephemeral keys; PQ on both channels; TTLs; re-checks | L2, L3 |

### 3.1 Registry (Zama: `ACL`)

| | |
|---|---|
| **Target** | (a) **Lifecycle** per account, per host chain: Active → Retired, one-way (Core R1–R14, §4.1). (b) **Enforced in every authorization view, for every role.** The roles are use (`isAllowed`, `persistAllowed`), on-behalf (delegator, delegate, contract) and permit (issuer, recipient). Grant paths revert for a retired caller. Inbound grants are accepted and inert. Public decryption is unchanged. (c) **One semantic engine exemption** (R10, §3.2). (d) **State that survives releases:** a dedicated ERC-7201 namespace, an ERC-165 Core id, and an upgrade guard that refuses implementations that drop Core or move its storage. (e) **Caller-preserving batching,** so that carry-then-retire is atomic. (f) **Extensions:** the accepted, matured successor (E1) and the successor-bound retirement certificate (E2). The declared signer (E3) needs no registry state. (g) **Ownership:** a timelock with PQ signers; rights-widening upgrades ratified by at least n−t operators |
| **Zama today** | No lifecycle (§1.2). The views the connector reads exist on both lines [V-A7]. The delegated views read the contract's right raw (`persistedAllowedPairs[h][contract]`; main `ACL.sol:568`, `v0.13.8:485`), so under the earlier specification a retired contract would still pass there [V-CV]. `_authorizeUpgrade` is an empty `onlyOwner` hook (main `:674`, `v0.13.8:591`) [V-CV]. `multicall` exists and preserves `msg.sender` [V-P1]. The ACL has no EIP-712 domain [V-A3]. `lastBlockDelegateOrRevoke` is stored but has no getter [V-A7] |
| **Zama change** | **L0:** Core on main (ACL 0.8.0) and on the v0.13 line (0.4.1); optionally on the v0.14 line (0.5.1). About 75–90 Solidity lines per line [E]. **L2:** E1, appended in the same namespace; `FHE.isAccountRetired` in the Solidity library. **L3:** E2 (`retireAccountWithSig`, with constant-field EIP-712 hashing); an optional getter `getUserDecryptionDelegationLastBlock(address,address,address)` (`0x19259f72`) for Profile Q's B_Q; a timelock as `owner()` |
| **Why** | The views are what every decider already reads. The connector's entire ACL surface is four views, called with no `from` [V-A7, V-CV]. The SDK precheck and Zama's cleartext mock also read gated views [V-A7, V-CV]. The deployed gateway does no ACL check [V-A7]. Every on-chain export re-enters `isAllowed` with the exporter as subject [V-A7]. So one bit in the views closes both doors for every connector version, with zero new RPCs. The namespace avoids the storage-index collision between v0.4.x and main [V-05]. The guard exists because a backport upgraded to a Core-less line silently stops enforcing (§5.4) [V-A7] |

### 3.2 Engine (Zama: `FHEVMExecutor`)

| | |
|---|---|
| **Target** | The engine computes for its caller. Its operand check is the **only exempt evaluation, defined by semantics** (R10). A registry MAY skip the retirement check only when it authorises an operand's use as input to a computation the engine performs for its caller. In that evaluation, the subject is the calling contract, and every output is granted only to that contract and only for the transaction. The exemption never applies to a grant, a publication, a delegation, a cross-chain transfer, a permit or a deputy action. It never applies to an answer returned to a verifier or another contract either. Engines that relay third-party calls use a dedicated operand-check entry point |
| **Zama today** | The executor reads `isAllowed` only at its operand choke point, with the calling contract as subject (`FHEVMExecutor.sol:1062-1065`). It grants transient access only to `msg.sender` (`:864, :1046`). No other host contract reads the views as the executor [V-A7, V-CV] |
| **Zama change** | None. The constant compare `msg.sender != FHEVM_EXECUTOR_ADDRESS` stays in `isAllowed` only. It is valid under three invariants, each pinned by a test: one operand choke point; transient grants only to `msg.sender`; no other contract reads the views as the executor. The original test tolerance of ±25 gas per operand was not met. Measured: +44 to +92 per operand on main and +114 to +137 on the v0.13 line (the compare itself is about +48; the rest is selector dispatch for the four new external functions), about 0.3–0.7% of an executor call [M-L0]. The bound is restated as ≤ +100 (main) and ≤ +140 (v0.13 line) |
| **Fhenix (informative)** | The `TaskManager` relays grants, the public `isAllowed` and the oracle's `isAllowedWithPermission`, all with itself as `msg.sender` [V-A7, V-CV]. A caller-identity exemption ported there would exempt every grant and the oracle's own permit check [I from V-A7]. A port needs: an `isAllowedForCompute(ctHash, caller)` entry point; `requester`-based gating on the write paths; issuer and recipient gating in `isAllowedWithPermission`; and events on `allow`, which emits none today [V-A7] |
| **Why** | A retired contract must keep computing, because its users' balances live there. It must never export, and every export path re-enters `isAllowed` with the exporter as subject [V-A7]. Defining the exemption by purpose keeps the rule correct on engines that relay |

### 3.3 Verifiers (Zama: kms-connector and the shared signature crate)

| | |
|---|---|
| **Target** | **Core (V1–V7, §4.1):** release only if every applicable view returned true at decision time, for every subject, on the registry of the handle's host chain; fresh evaluation; no `from` = engine; no bypass by any signature scheme or path; replicas apply lifecycle events. Stored results are re-checked before they are served, and retirement denials are final and typed `ACCOUNT_RETIRED`: SHOULD in Core, MUST in Profile H. **Profile H (§4.2):** code-first verification at one block, a narrow 7702 shim, an execution-gas budget, caps before any RPC, at most 2 attempts, and refusal of regular-code subjects on any ECDSA-only path. **E3 route (§4.4):** native FIPS 204/205 verification of declared signers, vector-tested, with library diversity. **Profile Q (§4.4)** at the host chain's ECDSA sunset. **Operator duties:** a retirement canary, implementation pinning, a halt on unratified implementations, and declared, diverse host-state sources |
| **Zama today** | **v0.13.8 connector:** the direct path checks `isAllowed(h, user)` and `isAllowed(h, contract)`; the delegated path checks only `isHandleDelegatedForUserDecryption`; it verifies no user signature, because the gateway does [V-A7]. **Main connector:** legacy and unified paths. The unified path tries `ecrecover` first, then ERC-1271 with a 250,000 `gas_limit` set on the `eth_call`, so calldata counts against the cap (`lib.rs:137, 196-211`) [V-A7, V-CV]. ACL denials and ERC-1271 negatives are recoverable and retried, up to 20 attempts by default [V-A7]. **Both:** one RPC URL per host chain per operator (`kms-worker.toml:172-184`) [V-A7]. Both connectors are expected to conform to Core unchanged [I]; Level 0 must show it |
| **Zama change** | **L0:** none for correctness. **Operator track,** with no fhevm release coupling: a canary; pinning; final retirement denials (one `isAccountRetired` call per subject, on the deny path only); a legacy-path check that the user is not one of the contracts; diverse host-state sources. **L1:** Profile H in the shared crate and the connector configuration. **L3:** the KDA route and the Profile Q configuration |
| **Why** | The views do the deciding (P1). Hygiene closes the 7702 root-key gap on main and admits PQ accounts. Native verification costs microseconds instead of 1.23M gas (§4.4). Operator duties are the only defence against a registry release that lies |

### 3.4 Relayer

| | |
|---|---|
| **Target** | Untrusted transport with advisory prechecks: the same caps and budget as the verifier; dedup keyed on the signature and the validity window; no cached positive authorization; a re-check (or refusal) before re-serving a result; an advisory `account_retired` code; legacy routes removed; PQ permit sizes accepted on unified routes |
| **Zama today** | The legacy relayer's precheck reads the gated views [V-A3]. relayer-http does no ACL or signature check [V-P1]. Fee-paying callers can submit to the gateway directly, so relayer checks are advisory [V-P1]. The legacy relayer caches results in Postgres with the expiry worker off by default, and its dedup key excludes `signature` and `request_validity` [V-P1]. `erc1271_gas_limit` is required configuration, 250,000 in every example [V-P1] |
| **Zama change** | **L0:** none. **L1:** budget semantics and caps, with the same values as the connector. **L2:** the advisory code; the dedup key; a re-check before serving a duplicate, since dedup runs before any ACL check today [V-A3]. **L3:** remove the legacy routes |
| **Why** | The relayer is not a security gate. But its caches must not re-serve results to retired requesters without a re-check, and its prechecks must not reject PQ accounts before the oracle ever sees them |

### 3.5 SDK

| | |
|---|---|
| **Target** | A lifecycle client: `getAuthorityStatus(address, chains)`; a typed `ACCOUNT_RETIRED` error; a carry planner with dry run, spam filter, chunking and verification; `retireEverywhere()`; successor "decrypt as"; a fresh transport key per request, purged together with permits on retirement; a code-first precheck with the verifier's budget and caps; ERC-7739 detection and wrapping; KDA request building; certificate creation |
| **Zama today** | The prechecks read `persistAllowed` and `isHandleDelegatedForUserDecryption` (`checkPersistAllowed.ts:79`, `checkDelegation.ts:100`) [V-A7], so retirement reaches them with no change. A failed precheck throws a generic `AclUserDecryptionError` [V-A6]. `ERC1271_GAS_LIMIT = 250_000n` is hard-coded [V-P1]. Its viem wrapper classifies any "execution reverted" reply as a clean revert, so on some nodes an out-of-gas PQ account is rejected client-side [V-A5]; Phase 1 observed that reply shape on Sepolia [M-P1]. Apps may persist transport key pairs; a fresh pair per session is only recommended [V-P1]. There is no ERC-7739 support [V-A5] |
| **Zama change** | **L0:** none for correctness. **L1:** the constant becomes a budget (this needs an SDK release). **L2:** status, typed error, the carry tool and transport hygiene. **L3:** KDA permits and certificates |
| **Why** | Wallets need one status call and a distinguishable reason. Carry is the user's continuity tool. Without hygiene, transport keys outlive retirement |

### 3.6 Oracle and KMS

| | |
|---|---|
| **Target** | **O1:** a threshold oracle conforms only if at least n−t nodes run conforming verifiers; a TEE oracle conforms if its node does. **O2:** the oracle publishes an ICS covering: chain id and registry address; interface ids; upgrade authority and timelock; engine address; n and t; profiles per node; decision lag; stored-result policy; reply KEM; ERC-1271 budget and caps; and host-state sources (in aggregate). **O3 (SHOULD):** no single host-state source, or correlated set, determines the view answers of t+1 or more nodes; positive answers are confirmed against an own node, a light client, or two independent providers that must agree. **Claims:** restrictive profiles (H's refusals, Q) only at ≥ n−t enforcing nodes; additive ones (budget, KDA) need ≥ t+1 supporting nodes for liveness. **KMS:** ML-DSA response signatures end to end, and a FIPS 203 reply KEM with context binding |
| **Zama today** | The KMS core never sees user signatures or the ACL: `UserDecryptionRequest` has no signature field [V-P1]. Shares are computed locally [V-A7]. Responses are ECDSA end to end: the main connector requests only `Ecdsa256k1`, and KMSVerifier and the gateway verify ECDSA [V-P1]. The KMS can sign with ML-DSA from kms v0.15.0-0 [V-P1]. The reply channel is hybrid ML-KEM-512 with AES-256-GCM and no associated data [V-A7; V-P1]. `kms/Cargo.toml:175` flags `ml-dsa =0.1.1` as unaudited [V-A7] |
| **Zama change** | **L0–L2:** none. **L3 and Zama's roadmap:** consume ML-DSA responses end to end (B7); offer a stronger reply-KEM option with AEAD context binding (§3.11) |
| **Why** | Authority belongs in the views and the verifiers; the KMS should keep not seeing signatures. A PQ claim needs PQ responses and PQ channels. Restrictions bind only at n−t |

**What every oracle MUST do (Core, any vendor):**
1. release only if the applicable views returned true at decision time for every subject, on the registry of the handle's host chain. Errors, reverts and timeouts never release;
2. declare a freshness bound and reuse no positive answer across requests;
3. honour the semantic exemption and never call views as the engine;
4. let no signature scheme or legacy path bypass the views;
5. use replicas that apply lifecycle events, or not authorize from replicas;
6. publish an ICS that includes n, t, the profiles per node and the host-state trust roots.

**Vendor fit.**

| | Zama | Fhenix | Inco |
|---|---|---|---|
| Who decides | kms-connector reads the registry views; threshold KMS, 13 nodes, t+1 = 5 [V-A7] | Teecryptor (TEE) `eth_call`s `isAllowedWithPermission` or `isPubliclyAllowed` and trusts the answer [V-P1] | not examined: no Inco code was available [V-A7] |
| Use view | `isAllowed`, `persistAllowed` [V-A7] | `isAllowed`, `persistAllowed` [V-A1] | not examined |
| On-behalf view | `isHandleDelegatedForUserDecryption`; also `isDelegatedForUserDecryption` on main [V-A7] | `allowedOnBehalf` [V-A1] | not examined |
| Permit view | none | `isAllowedWithPermission`: the issuer is gated through `isAllowed`; the recipient is checked only by its signature [V-A7] | not examined |
| Engine | executor, operand checks only [V-A7] | `TaskManager` relays every ACL call [V-A7, V-CV] | not examined |
| Reply channel | hybrid ML-KEM-512 [V-A7] | X25519 (`tweetnacl` box) [V-A7] | ECIES inputs, per the brief (unverified) |
| Core fit | an ACL change only; connectors expected to conform unchanged [I] | an ACL port: compute-only entry point, `requester` gating, issuer and recipient gating, events on `allow` | unknown |
| PQ claim (Profile Q) | possible once responses (B7) and channels are PQ | not without a FIPS 203 reply channel | not without FIPS 203 channels |

### 3.7 Gateway

| | |
|---|---|
| **Target** | Ordering and fees only: no authority and no ACL mirror; the unified path only; the legacy ECDSA path retired; the owner behind the same timelock. A gateway compromise is then at worst a denial of service |
| **Zama today** | On the deployed path the gateway verifies the permit with `ECDSA.recover` on the gateway chain (`v0.13.8:Decryption.sol:916-925` direct, `:937-949` delegated; the delegate's 65-byte ECDSA at `:947`) [V-P1, V-A7]. "ACL checks are performed by the KMS" (`v0.13.8:Decryption.sol:724`) [V-A7]. On the gateway testnet the owner is a 3-of-5 Safe plus a LayerZero path, with no timelock [V-P1]; the mainnet gateway's RPC is private [V-P1]. On the deployed path, an upgrade of `Decryption` alone could drop the user-signature check [I, from V-P1]. A compromised gateway can name the token contract as the user and pass `isAllowed(h, token)`, even for a retired user [V-05] |
| **Zama change** | **L0:** none. Do not add an ACL check. **Governance:** the timelock becomes the gateway owner. **Operator side:** the legacy-path check that the user is not one of the contracts narrows the "contract as user" trick. **L3:** retire the legacy path; main already marks it deprecated [V-A3] |
| **Why** | The gateway cannot see host-chain state. On the legacy path it cannot run code-first verification and cannot host E3 or PQ accounts |

### 3.8 Governance

| | |
|---|---|
| **Target** | A `TimelockController` owns every authorization-path contract and pointer, plus the gateway owner. Every direct execution path that bypasses the delay is removed. **Pause** is the only emergency power, and it never gates retirement or the views. **Delay:** at least 7 days; 14 days RECOMMENDED for rights-widening changes (open question 7, §10). **End-state profile:** PQ signers, and on-chain ratification by at least n−t operators of every change that can widen decryption rights (registry, KMSVerifier, gateway `Decryption`, ProtocolConfig, executor). Operators halt user decryption on an unratified implementation. **Release survival:** release rule, upgrade guard, canary, pinning (§5.4–§5.5). Disengaging Profile Q counts as rights-widening. The exit window serves operators (review, refuse, pin), not users, because users cannot withdraw ciphertext history |
| **Zama today** | The mainnet ACL owner is an Aragon OSx DAO with two Multisig plugins, either of which suffices: 3-of-6 EOAs, or 9-of-17 (12 EOAs, 4 Safes with EOA owners, 1 Aragon DAO). There is no timelock [V-P1, read on-chain 2026-10-20]. Sepolia: 3-of-5 EOAs [V-P1]. Gateway testnet: a 3-of-5 Safe plus LayerZero [V-P1]. `onlyACLOwner` resolves to `ACL.owner()` for the executor, KMSVerifier, InputVerifier, HCULimit, KMSGeneration, ProtocolConfig, the bridge contracts and PauserSet, so one owner covers the whole host stack [V-A7]. On main, ProtocolConfig creates a KMS context only after every new node and at least n−t previous nodes confirm [V-A7] |
| **Zama change** | **Now, as a separate ask:** a timelock as `ACL.owner()` and as the gateway owner. **L0:** the upgrade guard and the release rule. **L3:** canary scripts, PQ signers (about 1.23M gas per ML-DSA approval [M-P1]) and ratification modelled on ProtocolConfig |
| **Why** | Limit 3. Every governance key has an exposed public key, so governance is the largest single Q-day target [I from V-P1]. The pattern needed for ratification already exists in Zama's code [V-A7]. A timelock added as one more plugin would be bypassed by the existing EXECUTE holders [I from V-P1] |

### 3.9 Applications (OpenZeppelin ERC-7984)

| | |
|---|---|
| **Target (Profile A)** | Identity-gated grant paths (observer, operator, owner-only grants) revert for a retired account; **clearing and revoking stay allowed.** Inbound transfers are never blocked; outbound transfers SHOULD NOT be. A token MAY refuse transfers *to* retired accounts. Apps never assert `isAllowed(h, recipient)` after granting. Generic-call paths SHOULD refuse the lifecycle selectors. `FHE.isAccountRetired(address)` is the app-facing helper |
| **Zama and OZ today** | ERC-7984 handle transfers and disclosure check `FHE.isAllowed(h, msg.sender)`, so Core closes them with no app change [V-A7]. `_update` grants to `to` and never asserts afterwards [V-A7]. `setObserver` is identity-gated, and the observer is re-allowed on every transfer [V-A7]. `ERC7984ERC20Wrapper.unwrap` with a fresh input publicly decrypts the burnt amount, which reveals the current balance [V-A3] |
| **Zama and OZ change** | **L2:** `FHE.isAccountRetired` placed next to `FHE.isAccountDenied` (`library-solidity/lib/FHE.sol:8164`), through `Impl` and `IACL`. A local OZ variant: `setObserver(account, X)` reverts if `X != 0` and the account is retired; `setOperator(op, until)` reverts if `until >= now` and the caller is retired (ERC-7984 operators are valid while `now <= until`, so `until == now` is a grant; the deliberation's `until > now` missed it [M-L2]); `_update` is unchanged. Generic-call paths refuse the lifecycle functions and the registry's `multicall`, which keeps the caller as `msg.sender` [M-L2]. Upstream adoption is outside our control |
| **Why** | Identity-gated authority (`msg.sender == account`) is the one door the bit cannot close (limit 2). The gate is asymmetric: a naive gate would leave a thief-added observer reading every future amount, with the retired owner unable to clear it [V-A7] |

### 3.10 Wallets and custody

| | |
|---|---|
| **Target** | **Accounts:** PQ-validated; EOAs exit by retire-with-successor. **A per-chain authority panel:** status, successor, declared signer and scheme, expiring delegations, and "who else can see this". **Onboarding** sets a successor; institutions escrow a certificate. **ERC-7730 clear-signing descriptors** for the lifecycle calls, the permit and the certificate. **Confirmation levels:** red for one-way or granting actions, amber for authority added later. Lifecycle calls are wallet-native; dApp-originated ones are blocked by default. **Never** offer "send to successor", and never style retirement as a freeze or a sanction. Every retire screen states the three limits in plain words. **The user flow:** inventory and export → exit apps (observers, operators) → move assets → carry → retire, with a successor, on every host chain |
| **Zama ecosystem today** | Nothing exists to display. About 98% of holders are ECDSA-rooted [M-04]. 19 delegates serve 403 delegators, one of them 374; there are 53 non-expiring delegation events [M-04]. Dfns and Bron are Zama integrations [C, checked by reviewer 04]. Dfns wallets are EOAs, and the custodian policy engines checked document no function-selector or EIP-712-field rules [C, fetched by A6 on 2026-10-21; not re-verified by the coordinator] |
| **Change (wallets, custodians, Zama SDK)** | **L2:** wallet guidance (informative), the successor UX, the carry wizard. **L3:** certificate UX and custody runbooks |
| **Why** | Lockout fear is the main adoption blocker. A phished lifecycle transaction is the main T1 risk. A key ceremony is the moment the key is known to be safe |

**Custody defaults (A6, informative):**
- P-1: retire only with a confirmed successor, or in the same transaction as a carry.
- P-2: require a quorum for lifecycle calls, wildcard or non-expiring delegations, any ACL grant, `setObserver`/`setOperator`, and certificate signing.
- P-3: permits of at most 7 days, over listed contracts, with a fresh transport key per session.
- P-4: keep the successor in another security domain.
- P-5: decommissioning means retiring everywhere.
- P-6: a suspected compromise means carry and retire now.
- P-7: alert on ACL events that no workflow produced.

**Service delegates and auditors:**
- one delegate key per client, with expiring delegations;
- rotation is a self-retirement, followed by re-delegation;
- auditors get time-boxed delegations (default ≤ 90 days);
- observers should be smart accounts that read through short-lived delegated keys.

**Fixed glossary**, the same in every product:

| EN | TR |
|---|---|
| Forget on this device | Bu cihazda unut |
| Revoke delegation | Yetki devrini geri al |
| Retire address | Adresi emekliye ayır |
| Successor | Halef |
| Retirement certificate | Emeklilik sertifikası |

Help pages add: "There is no restore service for retired addresses; any such offer is a scam."

### 3.11 Transport

| | |
|---|---|
| **Target** | A fresh transport key per request, purged on retirement. For any PQ claim: a FIPS 203 KEM, or a hybrid that includes one, on **both** the reply channel and the input-encryption channel. AEAD bound to the request context. A TTL on stored results, and a re-check before re-serving. Core stays transport-neutral. Replies published on-chain SHOULD use ML-KEM-768 or higher (open question 10) |
| **Zama today** | Hybrid ML-KEM-512 + AES-256-GCM: the AES key is the first 32 bytes of the KEM secret, the 12-byte nonce is random, and there is no associated data [V-P1]. Apps may persist transport keys and reuse one for up to 365 days [V-P1]. On the HTTP path, successful results are served indefinitely and are not re-checked; on the gateway paths, shares are emitted in public on-chain events [V-P1]. **Fhenix:** X25519 [V-A7]. **Inco:** ECIES inputs, per the brief (not examined) |
| **Zama change** | **L2:** the SDK prototype (a fresh key per request, purge on retirement); stored-result TTLs as a design note. **L3 and roadmap:** the KEM parameter and context binding |
| **Why** | Retirement cannot retract shares already released; their secrecy rests on the transport key. Under T2, inputs encrypted with classical schemes and stored on-chain decrypt without any oracle, so a PQ claim needs both channels [I] |

### 3.12 What the target assumes from the host chain

The host chain is not ours to change, but the end state depends on it (P8).
- **ECDSA freeze.** Only the host chain can stop forged ECDSA transactions from an unmigrated EOA, that is, close the on-chain door.
  - Profile Q's protective claim for unmigrated accounts holds only where that freeze exists.
- **Recovery.** In-place recovery that installs regular code at the same address (EIP-8298 `SETCODEFROM`, or a seed-proof recovery [C]) restores decryption through ERC-1271, once Profile H is live on at least n−t operators [I]. On a local chain, with EIP-8298 simulated, Profile H `enforce` accepted the adopted wallet's ML-DSA-44 signature and refused the old key [M-P5].
- **EIP status [C], as read by A5 on 2026-10-21:**

  | EIP | Status |
  |---|---|
  | 7702 | live |
  | 7851 | declined for Hegotá |
  | 8151 | considered for inclusion |
  | 8298 | considered for inclusion |
  | 8141 (frame transactions) | scheduled |
  | 8355 (ML-DSA precompiles) | declined for Hegotá |
  | 8051, 8052 | drafts, unlisted |

Phase 4 (§11.2, §11.4): a simulated EIP-7851 indicator did not stop unmodified verifiers accepting the disabled key, and Amsterdam's state-creation pricing was measured on a local chain.

The three limits apply to the host chain as well:
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance, and only as sound as the chain's consensus and account authentication.

---

## 4. The staged path, Level 0 → Level 3

| Level | Adds | Main components | Where it can run | Binding threshold | Protects | Leaves open (main items) |
|---|---|---|---|---|---|---|
| **L0 Core** | Retirement in the views; verifier and oracle Core; carry through `multicall` | ACL; tests; release rule | deployed v0.13.x and main | the upgrade block (views) | B1; B2 and B4 for retired accounts; every ACL and deputy export; delegations | un-retired 7702 keys, PQ accounts, app roles, lockout without a successor, governance |
| **L1 Profile H** | Code-first ordering, budget, caps, bounded attempts, final denials, legacy refusal | shared crate; connector; relayer; SDK | main unified paths | restrictive parts ≥ n−t; additive ≥ t+1 | the 7702 root key (where the delegate refuses it); PQ ERC-1271 accounts; 8298 accounts on the legacy path | 7702 delegates that accept the root key; ERC-7739 compatibility |
| **L2 Continuity and apps** | E1 successor; Profile A; carry tool; SDK hygiene | ACL; library; OZ; SDK | both lines (E1); apps anywhere | views (E1); adoption (apps) | lockout; stragglers; thief-added observers; transport-key reuse | unnoticed attacker designations; OZ adoption |
| **L3 PQ-native, Q, certificates, governance** | E3 KDA; Profile Q; E2; the governance profile | connector; SDK; ACL; operators; governance; KMS; gateway | main (E3, Q); E2 wherever E1 exists | Q at ≥ n−t; governance at ratification | PQ authority at native cost; the off-chain door at the ECDSA sunset; multi-chain retirement; T2-durable governance | the on-chain door without a host freeze; unaudited libraries |

### 4.1 Level 0: the deployable Core

**What it adds.** Core is three rule sets plus carry.

*Registry (R1–R14):*

| Rule | Content |
|---|---|
| R1 Retire | `retireAccount()` marks `msg.sender` retired and emits `AccountRetired(account, successor)`. The successor is the confirmed E1 successor, or `address(0)`. A second retirement reverts with `AccountAlreadyRetired(account)` |
| R2 One-way | No function, privileged or not, clears it |
| R3 Unconditional | Not gated by pause, deny list, role, fee or holdings. Works for contracts |
| R4 Grants nothing | Retirement creates or extends no right. E1 only activates a successor pre-committed while the key was safe |
| R5 Immediate | Effective for every view from the block of inclusion |
| R6 Every role | No retired account satisfies any authorization view, in any role: use; on-behalf (delegator, delegate, **contract**); permit (issuer, **recipient**). The only exception is R10, and E1 amends the delegator case |
| R7 Grant paths revert | `allow`, publication, transient grants outside the engine, batches and delegation creation revert for a retired caller, SHOULD with `SenderRetired(caller)` |
| R8 Inbound grants inert | A grant never reverts because its recipient is retired |
| R9 Public decryption unchanged | Retirement never un-publishes |
| R10 Semantic engine exemption | As defined in §3.2 |
| R11 Upgrades preserve state and enforcement | A dedicated ERC-7201 namespace (SHOULD). A UUPS registry MUST refuse any new implementation that does not report both ERC-165 Core support and the same retirement storage location. Other proxy patterns SHOULD enforce the same in their tooling |
| R12 ERC-165 | `supportsInterface(0x556d2088)` returns true. The id is `retireAccount()` `0xe7142996` XOR `isAccountRetired(address)` `0xb279091e` [V-CV] |
| R13 Batching | Caller-preserving `multicall` (SHOULD), so that grants followed by `retireAccount()` are atomic |
| R14 Raw getters | Getters documented as liveness indicators SHOULD reflect retirement. No authorization relies on raw getters |

*Verifier (V1–V7):*

| Rule | Content |
|---|---|
| V1 Release | No release, no forwarding for release and no share unless every applicable view returned true at decision time, for every subject, on the handle's host-chain registry. Errors, reverts and timeouts never release |
| V2 Freshness | Views are evaluated after the request arrives, at a block within a declared lag. No positive answer is reused |
| V3 No exemption spoofing | Views are never evaluated with the engine as the `eth_call` sender |
| V4 No bypass | No signature scheme or path bypasses V1: EOA, ERC-1271, declared signer or the legacy gateway path |
| V5 Replicas | Replicas apply lifecycle events, or do not authorize |
| V6 Stored results (SHOULD; MUST in H) | Re-apply V1 before serving a stored result. The ICS states the policy |
| V7 Final denials (SHOULD; MUST in H) | A retirement denial is final and typed `ACCOUNT_RETIRED`, never retried or revived |

*Oracle (O1–O3):* see §3.6.

*Carry:* the existing `ACL.multicall([allow(h_i, NEW)…, retireAccount()])`, grants first and chunked. No new function.

**What it needs, per component.**

| Component | Level 0 change |
|---|---|
| Registry | **Zama:** Core on main (0.7.0 → **0.8.0**, reinitializer 8 → 9, empty `reinitializeV8()`); on the v0.13 line (0.4.0 → **0.4.1**, 5 → 6, `reinitializeV5()`), built from the `v0.13.8` tag source; optionally on the v0.14 line (0.5.0 → **0.5.1**, 6 → 7, `reinitializeV6()`), built from `v0.14.2`. §5.1 has the full package |
| Engine | None. Three invariant tests |
| Verifiers | None for correctness. Expected to conform unchanged [I]; Level 0 must show it |
| Relayer, SDK, KMS, gateway | None |
| Coprocessor host-listener | Compile-time match arms for `AccountRetired` at the next rebuild. Old binaries skip unknown events [V-A7] |
| Governance | The release rule, CI tests per line, and the upgrade guard (§5.4–§5.5) |
| OpenZeppelin ERC-7984 | None: there is no post-grant `isAllowed(h, recipient)` assert in `_update` [V-A7]. Zama's example apps still need to be surveyed for such asserts |

**Deltas against the earlier PR-1 specification** (`DESIGN_REVIEW.md` §6.2):
1. the contract role is gated in both delegated views;
2. the exemption is defined by semantics, with invariant tests;
3. an upgrade guard (ERC-165 plus storage location), with `UpgradeDropsRetirement` and the `retirementStorageLocation()` getter;
4. ERC-165 `supportsInterface`;
5. a typed `SenderRetired` on grant-path failures;
6. the delegation-expiry getter returns 0 for retired parties;
7. the backport is built from the `v0.13.8` tag, with an optional 0.14-line target;
8. rules for the mock and connector tests.

Unchanged from §6.2: the namespace and its location, the two original functions and their selectors, the event, the two original errors, no pause gate, no un-retire, and zero new RPCs.

**What it protects** (on both lines, from the Core block on):

| Door or finding | Effect |
|---|---|
| B1: a user cannot retire | **Closed:** the account can retire itself, one-way |
| Off-chain door (B2, B4), for a retired account | **Closed** for every request that rests on the retired key, whatever its signature: a fresh permit, an ERC-1271 answer, or a later T2-forged ECDSA signature. This is the pre-emptive protection against T2 for accounts that retire before Q-day [I from V-A7] |
| On-chain door (B3): ACL writes, `multicall`, `fromExternal(h, "")`, ERC-7984 handle transfers and disclosure, bridge `send` (main) | **Closed** for the retired account: every export re-enters `isAllowed` with it as subject [V-A7] |
| Delegations from or to the retired account | **Closed** in both delegated views; the retired account cannot create new ones |
| The contract role | A retired contract is refused on the direct and the delegated path |
| Delegations during a pause on v0.13.8 | Revocation is pause-gated on this line [V-P1]. Retirement is not, so it still kills delegations during a pause [I] |

**What it leaves open:**
- an un-retired 7702 account's root key (L1);
- PQ accounts (L1, and the deployed path has no ERC-1271 at all);
- identity-gated app roles (L2);
- lockout when an account retires without a successor (L2);
- stored results and reusable transport keys (L2);
- governance and gateway compromise (L3);
- the post-compromise race (limit 1);
- per-chain coverage.

**Costs:**

| Item | Value |
|---|---|
| `retireAccount` | about 45–55K gas under Osaka rules; 120–140K on Sepolia's current schedule [E] |
| ERC-7984 transfer | about +2.1–2.8K gas, 0.7–0.9% [E] |
| Executor | ≤ +100 gas per operand on main, ≤ +140 on the v0.13 line. Measured +44–92 and +114–137 [M-L0]; the original ±25 target was not met (see §3.2) |
| New RPCs | 0. The delegated views do one more SLOAD inside an existing `eth_call` |
| Carry | 31,083 gas per handle under Osaka rules and 119,201 on Sepolia [M-P1]; about 500 handles per transaction [E: ~538 under Osaka] |

**Planned evidence.**

| Venue | What it shows | Claim label |
|---|---|---|
| Foundry, in Zama's `host-contracts/test/acl` | views per role; one export test per path; the invariants; the deputies; inbound grants inert; typed errors; ERC-165; pause and deny-list independence; atomic carry order; the upgrade matrix U1–U7 (§5.4); never-retired accounts byte-identical; gas | — |
| Zama's cleartext mock on anvil | the flow through `persistAllowed` and the delegated view: a never-retired user decrypts; NEW decrypts the history after carry and retire; OLD is refused; delegations from and to OLD are refused; a retired contract is refused on both paths. Rules: `CleartextACL` inherits the 0.4.1 backport; a non-forge KMS signer set is used; no assertion pins the exact expiry second | "proven in mock: views and flow; plaintext is public in the mock" |
| Real connector harness: the unmodified kms-worker at v0.13.8 and at main, against the real ACL on anvil | a retired user, delegator, delegate or contract is rejected before the KMS; a never-retired user is forwarded; main's unified entries are handled correctly | "proven in real connector". This is the only place the `isAllowed` path is proven |

**Prototype status: done; gate G2-mock PASS (2026-10-21).**
- **Foundry:** main 143/143 and v0.13.8 128/128 ACL tests. Gas and the upgrade matrix are in
  `results/level0/LEVEL0_CONTRACTS.md`.
- **Cleartext mock:** 15/15 over 3 runs (`results/level0/MOCK_E2E.md`).
- **Real connector:** the unmodified kms-worker against the real Level 0 ACL on anvil (`results/level0/CONNECTOR_PROOF.md`):
  - v0.13.8: 96/96 requests;
  - main: 222/222 requests, legacy and RFC-016;
  - every retired user, owner, delegator, delegate and contract is refused with 0 KMS hits;
  - the refusing view is recorded on the wire for every attempt;
  - zero new RPCs, and no `eth_call` carries a `from`.

Deviations recorded:
- the U5 error (D1);
- the executor bound (D2);
- V7 is not met by the unmodified connector, as expected at Level 0. It refuses a retired account's request again on
  every retry: 20 attempts over about 54 s under its defaults, untyped, with 0 KMS hits [M-L0].

**Limits at this level:**
1. **Pre-emptive, not a clawback.** Third-party grants, public handles and plaintext already decrypted stay exposed.
2. **Oracle access only.** Asset authority and identity-gated app roles stay with the key.
3. **As final as the chain's governance.** Retirement is per chain. The guard stops accidental lapses only; a lying implementation passes it.

### 4.2 Level 1: main signature hygiene (Profile H)

**What it adds.** Profile H, a verifier profile for main's unified paths. Its configuration defaults:

| Key | Default |
|---|---|
| `erc1271_execution_budget` (B_exec) | 2,000,000 |
| `max_user_signature_bytes` | 65,536 |
| `max_public_key_bytes` | 4,096 [E] |
| `max_extra_data_bytes` | 1,024 [E] |
| `max_erc1271_attempts` | 2 |
| `code_first_mode` | `off` → `shadow` → `enforce` |
| `refuse_regular_code_on_legacy` | false → true |

**Rules:**
1. **Caps before any RPC.** A cap failure is irrecoverable. 64 KiB covers every FIPS 204 and 205 signature (SLH-DSA-256f is 49,856 bytes) [C].
2. **Code-first, at one block B.** `eth_getCode(user, B)` and the ERC-1271 call both run at B, and code is never cached across blocks.
   - Empty code: 65-byte `ecrecover` only.
   - Exactly 23 bytes `0xef0100 ‖ d` (EIP-7702): ERC-1271 on the account. Fall back to `ecrecover` **only** if the call *succeeds with empty return data* and the signature is 65 bytes. Never on an empty revert, because out-of-gas also reverts empty. The shim is off under Profile Q.
   - Any other code: ERC-1271 only.
3. **Budget:** `gas_limit = B_exec + 21,000 + 64 × len(calldata)`.
4. **Attempts:** at most one retry for `WrongMagic`, `Rejected` and `EmptyRevert`, at least one block later. A top-level out-of-gas is an `EmptyRevert`, even though nodes report it as an error without revert data; otherwise it would escape the bound [M-L1]. Transport errors keep the existing policy.
5. **Final retirement denials:** on an ACL denial, call `isAccountRetired(subject)`; if it is true, the denial is irrecoverable with `ACCOUNT_RETIRED`.
6. **Legacy path:** refuse users or delegates whose host-chain code is regular, the EIP-8298 case.
7. **Shadow first:** compute both verdicts, log would-be rejections and publish the impact before enforcing. The SDK detects ERC-7739 wallets with the `0x7739…` probe and wraps their signatures.

**What it needs, per component.**

| Component | Change |
|---|---|
| Shared signature crate | `verify_signature` (`lib.rs:196-211`) and `check_erc1271_signature` (`:123-186`) [V-A7] |
| Connector | configuration (`config.rs:274-276`) |
| Relayer | the legacy relayer's required configuration |
| SDK | the constant `ERC1271_GAS_LIMIT` (`verifyErc1271UserDecrypt-p.ts:28`) |
| All three | the same values in the connector, the relayer and the SDK |
| Registry, KMS, gateway | none |

**Where it runs.** Main's unified paths (P2/P3). The deployed gateway path is ECDSA-only on-chain, so Profile H cannot reach it [V-A3].

**What it protects:**
- **PQ ERC-1271 accounts up to B_exec.** The 2M budget admits:
  - Fireblocks ML-DSA-44, at 1,232,720 gas [M-P1];
  - ETHFALCON, at 1,547,336 gas [M-03];
  - ZKNOX ML-DSA-65, at about 1.54M gas [C].

  It does not admit NIST Falcon, at 3,910,833 gas [M-03]. Today calldata alone uses 71% of the 250k cap for ML-DSA-44: 177,048 gas on Sepolia's schedule [M-03].
- **The 7702 root key** of accounts whose delegate refuses it in ERC-1271 [I].
- **EIP-8298-migrated accounts on the legacy path,** once at least n−t operators refuse regular-code subjects.
- **Retry DoS.** Worst-case *execution* work per request per operator falls from 20 × 250k = 5M to 2 × 2M = 4M gas [E].
- **Revival after a lapse.** Final denials stop queued retries from reviving after a governance lapse.

**What it leaves open:**
- **Typical 7702 accounts.** Their delegates accept the root key; OpenZeppelin's `SignerEIP7702` does [V-A7]. Code-first retires nothing for them, so their protection is retirement (L0).
- **ERC-7739 wallets that sign plain typed data.** They return a wrong magic value, which no shim catches [V-A7]. Shadow mode and SDK wrapping exist for this case.
- **The legacy path** stays ECDSA until it is refused.
- **Restrictive parts** bind only at n−t operators.
- **Calldata accounting** can push `gas_limit` per attempt well above B_exec, up to about 4.2M extra for a 64 KiB signature, without matching computation [E].
- **Contract accounts** are taken at their word. A Safe with ECDSA owners passes ERC-1271; a verifier cannot see inside a contract.

**Planned evidence.** Level 1 does not run in the mock, which has no ERC-1271 path and leaves V2 unimplemented [V-A7]. It runs in the shared-crate and connector harnesses:
- an ML-DSA-44 ERC-1271 account (Fireblocks verifier) decrypts with B_exec = 2M and fails at "250k including calldata";
- the code-first matrix: empty code; 7702 with a rejecting delegate; empty success → shim; empty revert → no shim; `0xffffffff`; regular code;
- ERC-7739 in shadow mode and under enforce;
- the cap enforced before any RPC; the budget excludes calldata; at most 2 attempts; a final retirement denial that a simulated lapse cannot revive; the legacy regular-code refusal;
- `eth_getCode` latency, measured.

**Prototype status: done for the prototype (2026-10-21); H7 open.**
- **Part 1: H1–H4 and H8 in the shared signature crate** (`results/level1/PROFILE_H_CRATE.md`; branch `lifecycle/level1`).
  - 20 deterministic tests pin the RPC sequence of every rule.
  - On a real EVM (anvil, Osaka) the matrix behaves as specified:
    - under `enforce`, a 7702 account whose delegate refuses (reject-all, empty revert) is refused, although today's
      verifier and `off` accept its root key;
    - root-key-accepting delegates and empty-success delegates (through the shim) keep working;
    - shadow lists exactly the newly refused accounts;
    - ERC-7739 plain typed data is refused everywhere (the residual).
  - The ML-DSA-44 ERC-1271 account is refused at today's 250K cap and accepted under B_exec = 2M. Its smallest
    accepting B_exec is 1,125,976 [M].
- **Found on the real EVM and fixed.** A top-level out-of-gas `isValidSignature` came back as a data-less node error,
  which counted as transport and escaped H4. It now counts as an empty revert. H4 should say so explicitly.
- **Measured: the calldata allowance residual.** With a 60 KB signature, about 4.9M of gas is available for execution
  under B_exec 2M.
- **Part 2: the connector** (`results/level1/PROFILE_H_CONNECTOR.md`; commit `cce53bb`). Off by default, with zero
  new RPC. On the VPS against the Level 0 ACL, 27 requests [M]:
  - **H5 / V7:** a denial that rests on a retired account is final at its first attempt on every path and typed
    `account_retired`. A simulated governance lapse revived a retired user's queued request with Profile H off,
    and revived nothing with it on;
  - **H6** refuses a regular-code user on the legacy path; a 7702 delegate stays accepted;
  - **code-first:** `enforce` refuses the reject-all 7702 root key before the KMS, and `shadow` logs it.
  - clippy (`-D warnings`) and rustfmt pass.
- **Part 3: H9, the relayer and SDK prechecks** (`results/level1/H9_PRECHECKS.md`; commits `5b69260` SDK, `0eec675`
  relayer). Both take the verifier's policy, off by default:
  - the SDK, on a real EVM through Zama's ethers adapter: the ML-DSA-44 account is refused at today's 250K cap and
    accepted under the policy (call gas 2,183,048); under `enforce` the reject-all 7702 root key is refused, and
    `shadow` logs it [M];
  - the relayer: the shared crate's Profile H verification in its v3 pre-check, with its own retry rule kept; on the
    VPS 59/59 pre-check and settings tests, 281 of its unit tests passed (1 ignored upstream), and Zama's
    `make clippy` (`-D warnings`) and rustfmt pass [M].
- **Open:** H7 (re-checking stored results).

**Limits at this level:**
1. **Pre-emptive, not a clawback.** Hygiene changes who may ask from now on, not what was released.
2. **Oracle access only.** A 7702 account's root key still acts on-chain.
3. **As final as the chain's governance.** These are node rules, so they bind at n−t operators, and only for as long as the operators keep them.

### 4.3 Level 2: continuity and applications

**What it adds.**

**(a) E1, the successor.** Optional; ERC-165 `0x7dc5e209`, with an optional delay sub-interface `0xc61ca396`.
- **Lifecycle:** the account designates → the successor accepts, by a transaction of its own (**mandatory**) → the account confirms at or after `confirmableAt` → the designation is locked.
- **D:** registry-wide, at least 7 days (RECOMMENDED 7). `confirmableAt` is fixed at designation. A per-account, raise-only D is allowed (MAY), capped at 365 days.
- **Locked** means the old key can neither replace nor cancel a confirmed successor. Only the successor clears it, by resigning, at any time.
- **Frozen at retirement:** a pending designation is voided. No designation, acceptance, confirmation or cancellation is possible afterwards; resignation still is.
- **Read right, after retirement only:** the on-behalf views for (account, successor, contract, handle) answer exactly as an active wildcard delegation would. Every other delegate gets false.
- **Decrypt-as only:** no use, grant, publication or compute, and no transitivity.
- **Never a key-derived address,** because a KDA cannot accept. Clients MUST NOT treat a successor as a payment address or redirect target, and MUST surface pending designations.

| Function | Caller | Pause-gated | Effect |
|---|---|---|---|
| `designateSuccessor(s)` | account | yes | replaces any pending designation; `confirmableAt = now + effective D` |
| `acceptSuccession(account)` | pending successor | yes | marks it accepted; neither party may be retired |
| `cancelSuccessorDesignation()` | account | no | pending designations only |
| `confirmSuccessor()` | account | yes | requires acceptance, `now ≥ confirmableAt` and a non-retired successor; locks it |
| `resignSuccession(account)` | confirmed successor | no | any time, including after retirement |
| `raiseSuccessorDelay(d)` | account | no | strictly raises the effective D; at most 365 days |

**(b) Profile A:** `FHE.isAccountRetired`, plus a local OZ ERC-7984 variant with the asymmetric observer and operator gates (§3.9).

**(c) The carry tool:**
1. enumerate `Allowed(caller, account, handle)` per chain; `account` is indexed in the event [V-A3];
2. keep handles where `persistAllowed(h, OLD)` holds, filtering spam with a contract allowlist and the current balance handles;
3. `--dry-run` prints a per-contract breakdown and the exact list;
4. send a chunked `multicall([allow(h_i, NEW)…])` whose last chunk ends with `retireAccount()`;
5. verify `isAccountRetired(OLD)`, and that NEW holds `persistAllowed` on every carried handle.

**(d) SDK hygiene:**
- a fresh transport key per request;
- a purge of transport keys and permits on retirement;
- a typed `ACCOUNT_RETIRED` error and `getAuthorityStatus(address, chains)`;
- stored-result TTLs, as a design note only.

**What it needs, per component.**

| Component | Change |
|---|---|
| Registry | E1 storage appended inside `ACLRetirementStorage` (a two-slot `Succession` struct and `successorDelayOf`); the delegator case of both delegated views is amended for the successor; `retireAccount()` voids any pending designation and emits `AccountRetired(account, confirmed)`. Prototype versions: main 0.9.0, reinitializer 10; backport 0.4.2, reinitializer 7. A release plan with strictly increasing reinitializers is required before any second production backport |
| Solidity library | `FHE.isAccountRetired` |
| OpenZeppelin | the Profile A gates (local variant) |
| SDK | the carry tool, transport hygiene, status and errors, successor "decrypt as" |
| Verifiers | none: the successor reads through the delegated views |
| Constraint | On the deployed P1d path the successor must be an ECDSA EOA, because the gateway verifies the delegate's ECDSA signature [V-A7]. On main, a smart-account successor is recommended, since it rotates its own owners |

**What it protects:**
- **Lockout** after a thief-first or phished retirement, for prepared accounts.
- **Stragglers:** handles that arrive after retirement.
- **Delegate-key rotation.** One delegate key serves 374 of 403 delegating accounts on mainnet [M-04].
- **Thief-added observers,** which the retired account can clear and nobody can re-add.
- **Continuity:** an O(n) snapshot by carry, plus O(1) by the successor.
- **Transport-key reuse.**

**Cost:**
- A median carry is about 0.40M gas [E] (median holder: 12 handles [M-04]).
- Carry fits in one transaction for more than 99.9% of ECDSA-rooted holders [E].
- Of the 41 accounts over the per-transaction limit, 33 are contracts and 8 are ECDSA-rooted [M-04].

**What it leaves open:**
- an attacker designation, accepted by the attacker and confirmed after D unnoticed days, survives retirement;
- a thief can keep replacing *pending* designations; the safe response is carry plus retire now;
- losing an ECDSA-EOA successor on the deployed path is final;
- no transitivity, so auditors rely on carry;
- OZ adoption is outside our control;
- `Allowed(OLD, NEW, h)` and `AccountRetired(OLD, S)` publicly link the identities.

**Planned evidence:**
- **Foundry:** the full state machine; locked against the old key; no transitivity; a retired successor fails; the successor cannot `allow`, publish or compute; an unaccepted designation cannot be confirmed; a designation voided by retirement yields nothing; a KDA cannot be a successor. The asserted residual: an unnoticed attacker designation survives retirement.
- **Mock:** `plaintextForDelegatedUserDecryption(OLD, S)` reads past and straggler handles.
- **Connector harness:** the legacy delegated path with an ECDSA-EOA successor; main's unified path.
- **Applications:** a thief-added observer is cleared by the retired account and cannot be re-added; transfers to and from a retired account succeed; the vanilla variant still leaks the current balance and future amounts (asserted residual).
- **Gas,** measured for designate, accept, confirm and retire-with-successor.

**Prototype status: done for the prototype (2026-10-21).**
- **(a) E1 is done on both lines** (`results/level2/LEVEL2_E1.md`): main ACL v0.9.0 and v0.13-line ACL v0.4.2.
  - Foundry: 188/188 and 173/173 tests, including 41 E1 tests (TC17) and the asserted TC18 residual.
  - OZ layout validation and Zama's CI version check pass.
- **The real connector needs no change.** It reads the successor through the unmodified delegated path: 8/8
  requests at v0.13.8 and 13/13 at main, including the RFC-016 delegated entry and a straggler handle. Every other
  delegate stays refused.
- **Gas [M]:** designate 62,014; accept 40,074; confirm 57,188; `retireAccount` +4,365 (54,464).
- **Size finding.** The v0.13 line's unoptimized default Foundry profile no longer fits EIP-170: 25,236 B, 660 B over
  the limit. Production settings give 14,290 B.
- **(b) Profile A is done on main** (`results/level2/PROFILE_A.md`): `FHE.isAccountRetired` in the library, and a
  local OpenZeppelin ERC-7984 variant. TC23 passes 15/15, next to the variants without Profile A.
  - **Correction:** the operator gate is `until >= now`, because ERC-7984 operators are valid while `now <= until`.
  - **Correction:** A4 must also refuse the registry's caller-preserving `multicall`.
  - **Found:** a generic-call path can also hand its contract to a successor of its choice.
  - **Gas [M]:** the gates cost 7,781 (`setOperator`) and 3,809 (`setObserver`) with the registry warm.
  - **Phase 4 correction:** with the registry cold, as on a transaction's first touch, the `setOperator` gate costs
    +12,804 under Osaka. forge 1.8.5's `vm.cool` had left the accounts warm (`results/phase4/P2_4_AMSTERDAM.md` §6).
- **(c) The carry tool is done** (`results/level2/CARRY_TOOL.md`; `impl/carry-tool/carry.mjs`). On anvil it
  carried exactly the 121 expected handles out of 426, skipping spam and stale balances. After an injected failure
  in the middle it left OLD active, and a rerun resumed. Gas [M]: 31,386 per handle, at most 532 handles per
  transaction under Osaka's cap.
- **(d) SDK hygiene is done** (`results/level2/SDK_HYGIENE_AND_MOCK.md`) in Zama's SDK source on both lines:
  - a typed `ACCOUNT_RETIRED` refusal;
  - `getAuthorityStatus`. Since Phase 4 it also reports the account's code: none, an EIP-7702 delegation, an
    EIP-7851 ECDSA-disabled delegation, or other code [M-P4];
  - one transport key per request, zero-filled on release and purged with the account's permits on retirement.
  - 19 new unit tests; the full SDK suites pass (914/914 and 918/918).
- **E1 runs end to end in Zama's cleartext mock** through the SDK: 7/7 scenario tests, three runs. The successor
  reads after retirement, including a straggler. Before retirement it is refused. Every other party gets the
  typed refusal before the relayer.

**Limits at this level:**
1. **Pre-emptive, not a clawback.** A successor inherits what the account could decrypt; it recovers nothing that leaked.
2. **Oracle access only.** The successor reads; assets and app roles still move by ordinary transfers and app calls.
3. **As final as the chain's governance.** The successor lives in the same upgradeable registry, per chain.

### 4.4 Level 3: PQ-native authority, PQ-only profile, retirement certificate, governance

**What it adds:** E3, Profile Q, E2 and the governance profile, described in (a)–(d) below.

**(a) E3, the declared decryption signer (KDA).**

*Encoding:*
- `signerBytes = verifierId (20 bytes) ‖ publicKey`, in the ERC-7913 layout (ERC-7913 is Final [C]).
- `KDA = address(uint160(uint256(keccak256("ERC-XXXX key-derived decryption signer v1" ‖ signerBytes))))`. The tag is provisional.
- `verifierId` is a reserved identifier for a native scheme, also provisional: `address(uint160(uint256(keccak256("ERC-XXXX native scheme:" ‖ name))))`, for example for "ML-DSA-44".

*Declaring and using it:*
- The account declares the signer with its own `delegateForUserDecryption(KDA, contract | WILDCARD, expiry)`.
- A request uses `userAddress = KDA`, `ownerAddress = account` on every entry, and `signature = abi.encode(signerBytes, sig)`.
- The verifier takes the route only if:
  - `code(KDA)` is empty at the decision block;
  - the signature is not 65 bytes and parses;
  - the derived KDA equals `userAddress`;
  - every entry has `ownerAddress ≠ userAddress`.

*Verification:*
- Native, with empty context, over the same EIP-712 digest. Failure rejects irrecoverably, with no fallback to `ecrecover` or ERC-1271.
- Schemes: FIPS 204 ML-DSA-44/65/87 and FIPS 205 SLH-DSA, with the SHA2 sets preferred. FN-DSA is allowed only once FIPS 206 is final.
- Vectors: ACVP sigVer and Wycheproof.
- A library bug must not reach t+1 nodes: either two independent implementations must agree, or no implementation runs on t+1 or more nodes.

*Rules:*
- subordinate: only the account creates it;
- killed by retirement and by revocation;
- delegated entries only; never a direct owner and never a successor;
- no `WithSig` path; no contract verifiers, so nothing to pin;
- a finite expiry by default in wallets;
- the B_Q rule under Profile Q;
- main's unified path only. It is impossible on the deployed path, where the gateway verifies the delegate's 65-byte ECDSA [V-A7].

*Numbers [M-A5]:*

| Item | Time |
|---|---|
| ML-DSA-44 on the KDA path, including the derivation check | 84–89 µs |
| ML-DSA-44, cold | 82–85 µs |
| `ecrecover`, k256 path (Zama's current implementation) | 177–213 µs |
| `ecrecover`, libsecp256k1 | 53–55 µs |
| ML-DSA-65 / ML-DSA-87 (KDA path) | 133–142 µs / 221–264 µs |
| SLH-DSA-SHA2-128s / -128f | 150–157 µs / 402–411 µs |
| SLH-DSA-SHAKE-128f (10× slower than SHA2) | 4.5–4.7 ms |
| RustCrypto `ml-dsa` 0.1.1 vs Wycheproof ML-DSA-44 | agrees on 180 of 180 vectors |

The ERC-1271 path takes about 4.5–5 ms of EVM time [E]. Separately, the timing table above shows that native PQ verification is cheaper than Zama's k256 `ecrecover` path but not cheaper than an optimised ECDSA (libsecp256k1) in general [M-A5].

**(b) Profile Q, the PQ-only operator profile.**
- **Trigger.** At least n−t operators commit, then activate together at an announced block B_Q. The signal is PQ-signed operator statements plus the ICS. An on-chain record is informational, never a trigger, and never ECDSA governance.
- **Preconditions,** all of them:
  1. Profile H, the E3 route (with conformance evidence and an audited library) and refusal of the legacy path, live on at least n−t operators;
  2. a published readiness KPI with a threshold fixed in advance;
  3. a stated recovery path;
  4. a timelock and implementation pinning in place;
  5. the commit-then-activate procedure.
- **Notice:**
  - Scheduled: at least 24 months, and never later than the host chain's own ECDSA deactivation.
  - Emergency activation only on (i) host-chain ECDSA deactivation, or (ii) credible public evidence of a CRQC against secp256k1, declared by at least n−t operators in PQ-signed statements.
- **PQ claim.** It requires a FIPS 203 reply KEM, or a hybrid that includes one, **and** PQ input encryption.
- **Claim limit.** No protective claim for unmigrated ECDSA accounts on a host chain that still accepts their ECDSA transactions.
- **Disengagement** widens rights, so it follows the governance rule.
- **Recovery:**
  1. prepared before B_Q: retire to a confirmed PQ successor; hold a KDA delegation made before B_Q; or carry to a PQ account;
  2. host-chain recovery that installs regular code, through ERC-1271, which needs Profile H before activation;
  3. a pre-signed E2 certificate relayed after a freeze. Its `ecrecover` is a precompile call, not a transaction, so the dormant successor wakes without any ECDSA transaction [I];
  4. otherwise no access and no leak (fail-closed). There is no support-desk unfreeze and no vendor-only recovery: either would be a backdoor.

| Path or signer | Under Profile Q |
|---|---|
| Legacy ECDSA gateway path (P1/P1d) | refused outright |
| Code-less signer | refused |
| `0xef0100 ‖ d` (7702) signer | refused; no ERC-1271 call; shim off |
| Regular-code ERC-1271 account (including 8298-adopted code) | accepted in the "no-root-ECDSA" variant (account-asserted: a Safe with ECDSA owners passes); refused in the "strict" variant |
| KDA of a regular-code delegator | accepted |
| KDA of an ECDSA-rooted delegator | accepted only if last written at or before B_Q (the claim is conditional on a host freeze) |
| Delegated requests | the delegate must itself qualify; the B_Q rule applies to ECDSA-rooted delegators |
| Confirmed successor of a retired account | must itself qualify |
| Retired subject (any route) | refused (Core) |
| Public decryption | unchanged; KMS response signatures are still ECDSA (B7) |
| On-chain door (`allow`, delegation, publication) by forged ECDSA transactions | **open until the host chain freezes ECDSA** |

**(c) E2, the retirement certificate.** Optional; ERC-165 `0x4b9ec076`.
- **Format.** EIP-712 `RetireAccount(address account,address successor,uint256[] chainIds)`, with type hash `0xf224379ad7473578295885cb7fd6795dbf8c4d718c2bd07d70c8f1e5ecaac54b` [V-CV]. The domain is `EIP712Domain(string name,string version)` = ("DecryptionAuthorityLifecycle", "1"): chain-agnostic, with the scope set by `chainIds`.
- **Entry point.** Anyone may submit `retireAccountWithSig(account, successor, chainIds, signature)`. The checks run in this order:
  1. not retired (`AccountAlreadyRetired`);
  2. `block.chainid ∈ chainIds` (`CertificateWrongChain`);
  3. `successor != 0 && successorOf(account) == successor` (`CertificateSuccessorMismatch`);
  4. `SignatureChecker.isValidSignatureNow` (`InvalidRetirementCertificate`). This is code-first: no code means a 65-byte low-s ECDSA signature; any code means ERC-1271, with no shim.
- **Effects:** those of `retireAccount`.
- **What it never does:** designate, confirm or change a successor, or grant anything. It has no nonce, no expiry and no cancellation by the key, and it is not pausable.
- **Size:** about 200–300 bytes for one or two chains [E].
- **Where it helps:**
  - multi-chain retirement from one ceremony;
  - a lost key;
  - vendor-independent custody runbooks;
  - relaying after a freeze;
  - turning on-chain compromise signals into the planned handover. The signals are an unexpected `Allowed` by the account, a wildcard or non-expiring delegation, or an observer change;
  - watching for protocol regressions.
- **Where it does not help:**
  - protecting the past after a theft: off-chain permits need no transaction, and a decryption completes in seconds (2.5–12.6 s on Sepolia [M-P1]);
  - mempool races, because both sides can use private order flow;
  - a "quantum watchtower", because a CRQC harvests silently.

**(d) Governance profile.**
- **Demo:** an OZ `TimelockController` owns a local ACL proxy, with a minimum delay of 7 days in the demo. Through `ACLOwnable` it then controls the executor, KMSVerifier and ProtocolConfig.
- **Guard:** it blocks a Core-less upgrade even when the upgrade goes through the timelock.
- **Canary:** on every `Upgraded` event, and periodically, each operator checks a known retired account and a known allowed handle:
  - `isAccountRetired` is true;
  - `isAllowed` and `persistAllowed` are false;
  - the delegated view is false for a delegation created before retirement.

  On a mismatch, the operator halts user decryption for that chain. The cost is 6 RPC calls per run: the 4 views, plus 2 reads for pinning [M-L3]. Because the rule is restrictive, it is effective at n−t operators.
- **Pinning** catches what the canary cannot: a malicious upgrade that spares the canaries. It is per **deployed implementation** (address and runtime code hash), ratified during the timelock delay. Pinning by bytecode alone fails: a UUPS implementation embeds its own address (`__self`), so every deployment of the same source has a different code hash [M-L3]. Masking the immutables is the alternative.
- **End-state note:** PQ signers, at about 1.23M gas per ML-DSA approval [M-P1]; n−t ratification in the ProtocolConfig pattern; why an immutable registry is deferred (§6, D7).

**What Level 3 needs, per component.**

| Component | Change |
|---|---|
| Shared crate and connector | the KDA route, inserted before the ERC-1271 fallback in `verify_signature`; Profile Q configuration: `pq_only = off \| committed(B_Q) \| active(B_Q)` and `variant = no_root_ecdsa \| strict`; pinning |
| SDK | KDA request building; certificate creation; `retireEverywhere()` |
| Registry | E2; optionally the B_Q getter; a timelock as owner |
| Operators | PQ-signed commitment statements; the readiness KPI; the canary; ratification |
| KMS | ML-DSA responses consumed end to end; a reply-KEM option (Zama's roadmap) |
| Gateway | the legacy path retired; a timelocked owner |
| Watchtower | a reference script that relays certificates to the listed chains |

**What it protects:**
- **E3:** PQ authority for an existing address at native cost, without deploying a PQ smart account. The first ML-DSA-44 smart account costs 14.6M gas under Osaka rules and 104.9M on Sepolia [M-P1]. E3 also gives least privilege: a hot decryption key and a cold root.
- **Profile Q:** closes the off-chain door to ECDSA-rooted signers at n−t operators. It protects unmigrated accounts only together with a host freeze.
- **E2:** retirement across chains and after key loss, including the planned handover after a freeze.
- **Governance:** with PQ signers and ratification, T2-durability claims become possible at all.

**What it leaves open:**
- **KDA:**
  - unaudited libraries and verification bugs (hence the diversity rule);
  - no exclusivity, so ECDSA permits stay valid until Profile Q;
  - impossible on the deployed path;
  - rotating a smart account's owners does not revoke its KDAs.
- **Profile Q:**
  - the on-chain door stays open without a host freeze;
  - a partial-adoption cliff: with 5 to 8 enforcing operators, service degrades before protection appears;
  - ECDSA KMS response signatures; public decryption unchanged;
  - unprepared accounts lose access (fail-closed);
  - an ECDSA successor is weak under T2.
- **Certificates:** a leaked certificate triggers an early but planned handover.
- **Governance:** PQ signers and ratification are not deployed anywhere today.

**Planned evidence:**
- **Connector harness:**
  - the KDA route;
  - Profile Q, plus a share-collection simulation. With k of 13 operators enforcing and t = 4, reconstruction succeeds if and only if 13 − k ≥ 5, that is k ≤ 8 [I from V-A7];
  - the on-chain-door negative test: on anvil, which accepts ECDSA transactions, a forged `allow(h, attackerPQ)` from the victim EOA, followed by the attacker's PQ request, decrypts under Profile Q.
- **Shared crate:** KDA verification vectors.
- **Foundry, on two anvil chains:** the certificate (wrong chain, successor mismatch, no successor, an ERC-1271 account, works while paused, a second submission reverts, a forged or leaked certificate yields only the planned handover); the timelock; the guard; the canary.

**Prototype status: done for the prototype, except the connector parts (2026-10-21; `results/level3/LEVEL3.md`).**
- **E2 on main:** ACL v0.10.0, `retireAccountWithSig` (`lifecycle/level3`).
  - 13 tests (TC19, TC24), including the ERC's vector, reproduced in Solidity and in ethers.
  - The upgrade from v0.9.0 preserves E1 state.
  - OZ validation and Zama's CI check pass.
  - Gas [M]: 65,560 (EOA, 1 chain) to 68,015 (ERC-1271).
  - **The watchtower** on three real anvil chains detected a thief's wildcard delegation and relayed the certificate to
    both listed chains in 376 ms. The successor reads, and the thief's delegation reads nothing.
- **Governance:**
  - a 7-day timelock owns the ACL and the executor;
  - the guard holds through it;
  - the canary catches a Core-less liar;
  - pinning catches a backdoor that spares the canary (6 Foundry tests, plus the canary script on anvil).
- **E3 KDA route in the shared crate** (`lifecycle/level3-verifier`, feature `kda`): 180/180 Wycheproof ML-DSA-44
  vectors, all three parameter sets, no fallback, fail-closed on an unmodified verifier.
- **Profile Q:**
  - the TC16 rule (reconstruction iff k ≤ 8) on real Shamir shares;
  - the partial-adoption cliff: 77% of releases still succeed at k = 8 with 5% outages;
  - the on-chain door residual (TC22).
- **A5's native benchmarks** rerun personally; A5's conclusions hold.
- **Open:** the KDA route and Profile Q in the connector; ACVP vectors; E2 on the v0.13 line.

**Limits at this level:**
1. **Pre-emptive, not a clawback.** Profile Q and certificates act from activation or submission onward; what a CRQC harvested earlier is not recovered.
2. **Oracle access only.** Profile Q closes the off-chain door; the on-chain door belongs to the host chain.
3. **As final as the chain's governance.** Only PQ governance with operator ratification makes the registry durable under T2, and even then governance plus an operator supermajority can change anything.

---

## 5. Minimal today: what ships on v0.13.x now

This section is the Level 0 Core as a backport to the deployed v0.13 line. Its evidence plan and prototype status are in §4.1.

### 5.1 The package

| Item | v0.13 line backport |
|---|---|
| **Built from** | The `v0.13.8` tag source, where delegation expiry uses `>`. Not the mock's vendored copy, which uses `>=` [V-CV]. Zama's `mock/cleartext/CleartextACL` is re-pointed at it for tests |
| **Version** | ACL 0.4.0 → **0.4.1**; `REINITIALIZER_VERSION` 5 → **6**; an empty `reinitializeV5()`. This satisfies Zama's CI rule: any bytecode change bumps both versions, and the reinitializer is named `reinitializeV{N-1}` (`ci/upgrade-check/lib.ts:144-169`) [V-A7, V-CV] |
| **Storage** | ERC-7201 namespace `fhevm.storage.ACLRetirement` at `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200` [V-CV], holding `mapping(address => bool) retired`. The `fhevm.storage.ACL` layout stays byte-identical (4 fields on 0.4.x) |
| **New functions** | `retireAccount()` `0xe7142996`; `isAccountRetired(address)` `0xb279091e`; `supportsInterface(bytes4)` `0x01ffc9a7`, true for `0x01ffc9a7` and `0x556d2088`; `retirementStorageLocation()` `0xc89c7ccd`, `pure` [V-CV]. None clashes with the existing selectors [V-A7] |
| **Event** | `AccountRetired(address indexed account, address indexed successor)`, with `successor = address(0)` at this level. No reason code |
| **Errors** | `AccountAlreadyRetired(address)`, `SenderRetired(address)`, `UpgradeDropsRetirement(address)` |
| **Views** | `isAllowed` (`:452-454`): false for a retired account unless `msg.sender` is the executor. `persistAllowed` (`:499-502`): `&& !retired[account]`. `isHandleDelegatedForUserDecryption` (`:478-491`): its first statement returns false if the delegator, the delegate **or the contract** is retired. `getUserDecryptionDelegationExpirationDate` (`:401-411`): returns 0 if any party is retired. `isDelegatedForUserDecryption` does not exist on this line [V-P1] |
| **Grant paths** | `allow`, `allowForDecryption`, and `allowTransient` in its non-executor branch (on this line the exempt branch covers only the executor [V-CV]). Only the failure branch changes: `SenderRetired` if the sender is retired, otherwise the existing `SenderNotAllowed`, so behaviour is byte-identical for every non-retired sender. `delegateForUserDecryption` (`:283-334`): its first statement reverts `SenderRetired` for a retired sender. Delegating *to* a retired delegate, or for a retired contract, does not revert; it is inert (R8) |
| **Unchanged** | `multicall`; `revokeDelegationForUserDecryption` (callable by retired accounts; pause-gated on this line); `blockAccount` and `unblockAccount` (the deny list stays governance-only and never touches retirement); `pause` and `unpause` (they never gate retirement or any view); `isAllowedForDecryption`; the raw `allowedTransient` |
| **Upgrade guard** | In `_authorizeUpgrade` (`:591`); see §5.4 |
| **Size** | About 75–90 Solidity lines [E]; the EIP-170 code-size limit is checked in CI |
| **Off-chain** | No change for correctness in the connector, relayer, SDK, KMS or gateway. The coprocessor host-listener gets compile-time match arms at its next rebuild; old binaries skip unknown events [V-A7] |
| **Process** | One DAO vote per host chain (Ethereum and Polygon, both on ACL v0.4.0 [M-04]) plus the testnets, ideally in one release window. Until both are done, wallets show per-chain status |

**Also deliverable now, with no protocol risk:**
- **Docs:** fix the deny-list over-claim in `docs/solidity-guides/acl/README.md:65`, which says denied accounts cannot receive permissions while the code never checks the recipient [V-P1]. Add an address-lifecycle page.
- **Operator track (optional; effective at n−t):** the canary, pinning, final retirement denials, the legacy-path check that the user is not one of the contracts, and host-state diversity. Final denials are a connector code change; the rest is configuration and scripts.
- **Governance (separate ask):** a timelock as `ACL.owner()` and as the gateway owner.

**How a user uses it today.**
1. Inventory and export records.
2. Clear observers and operators while the account is still active.
3. Move assets.
4. Carry the handles to the new account with `multicall([allow(h_i, NEW)…, retireAccount()])`. Grants go first; the reverse order reverts. Each transaction holds about 500 handles [E].
5. Retire on every host chain.

There is no successor at this level. An account that retires without carrying accepts that later arrivals stay unreadable, and the wallet says so.

### 5.2 Why it is safe on its own

1. **Restrictive only.** Retirement creates or extends no right (R4). Only the retiring account's own authority shrinks, and Core adds no key and no trust root [I].
2. **It binds every decider at the upgrade block with zero code change:**
   - the connector's whole ACL surface is four views, called with no `from` [V-A7, V-CV];
   - the SDK precheck reads gated views [V-A7];
   - the deployed gateway performs no ACL check [V-A7];
   - Zama's cleartext mock honours the base ACL's `persistAllowed` and delegated view [V-CV].
3. **One bit closes both doors.** Every on-chain export re-enters `isAllowed` with the exporter as subject [V-A7]. On v0.13.x that covers the ACL writes, `fromExternal(h, "")`, and ERC-7984 handle transfers and disclosure.
4. **The engine exemption is not an export route.** The three invariants hold [V-A7, V-CV], and tests pin them.
5. **Byte-identical for never-retired accounts.** Only the failure branches and the gated reads change. Level 0's differential tests against Zama's existing suites must show it (G5); the prototype is pending.
6. **Transfers keep working.** Inbound grants are accepted and inert, so ERC-7984 transfers in both directions are unaffected [V-05; V-A7].
7. **It is independent of the governance tools.** It is not pause-gated and not deny-list-gated, it works for contracts, and nothing un-retires. The deny list is untouched.
8. **Lapses become reverts.** The guard turns a silent loss of enforcement into a revert, and collisions with the Core-less 0.5.0 revert anyway (§5.4).
9. **It is cheap:** zero new RPCs, one more SLOAD in the delegated view, about 45–55K gas to retire [E], and about +2.1–2.8K gas per ERC-7984 transfer [E].
10. **Its harms are bounded and stated:**
    - lockout without a successor, mitigated by carrying first and by the wallet copy;
    - a contract that retires itself bricks its own handles, which is equivalent to an existing admin power;
    - linkability through carry events;
    - lapses through a lying implementation, which the guard cannot catch (§9).

### 5.3 What it does not give on v0.13.x

- **No PQ destination.** The deployed path has no ERC-1271 route, and the relayer accepts only 65-byte signatures [M-P1]. So the deployed phase offers retirement and rotation only; PQ destinations arrive with main's verifier paths (Levels 1 and 3).
- **No successor yet.** E1 is Level 2, but it is deployable on this line later; on P1d the successor must be an ECDSA EOA [V-A7].
- **No signature hygiene and no declared signer:** these are main only.
- **No recall** of anything released before retirement (limit 1).

### 5.4 The upgrade guard (Core MUST for UUPS registries)

```solidity
// _authorizeUpgrade (main :674; v0.13.8 :591). Runs in the CURRENT implementation before the switch.
function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {
    (bool ok1, bytes memory r1) = newImplementation.staticcall(
        abi.encodeWithSelector(0x01ffc9a7, DAL_CORE_INTERFACE_ID));   // supportsInterface(Core)
    (bool ok2, bytes memory r2) = newImplementation.staticcall(
        abi.encodeWithSelector(0xc89c7ccd));                          // retirementStorageLocation()
    bool declaresCore = ok1 && r1.length == 32 && uint256(bytes32(r1)) == 1;
    bool sameState    = ok2 && r2.length == 32 && bytes32(r2) == ACL_RETIREMENT_STORAGE_LOCATION;
    if (!declaresCore || !sameState) revert UpgradeDropsRetirement(newImplementation);
}
```

- **Where it runs.** UUPS runs `_authorizeUpgrade` inside the current implementation, before the switch [V-A7].
- **Both checks are needed.**
  - ERC-165 alone passes a Core-declaring release whose namespace drifted, which would silently reset every retirement.
  - The location check alone passes a release that kept the getter but dropped Core.
- **No escape hatch.** The rollback target for a buggy Core release is a patched Core release.
- **Limit.** It stops accidents, not an implementation that lies. Canaries and pinning (Level 3) cover that.

| ID | Upgrade | Expected result |
|---|---|---|
| U1 | 0.4.0 → 0.4.1 | layout preserved; OZ `validateUpgrade` passes |
| U2 | 0.4.1 → 0.8.0 | bits and enforcement preserved |
| U3 (hazard demo) | guard-less 0.4.1 → 0.7.0 | succeeds, and enforcement lapses |
| U4 | 0.4.1 → 0.7.0 | reverts `UpgradeDropsRetirement` |
| U4b | 0.8.0 → a Core-declaring implementation with another namespace | reverts `UpgradeDropsRetirement` |
| U5 | 0.4.1 → 0.5.0 | reverts. With the guard, `UpgradeDropsRetirement`, because the guard runs first in `upgradeToAndCall`. The reinitializer collision (`InvalidInitialization`) shows on a guard-less build [M-L0] |
| U6 (optional) | 0.4.1 → 0.5.1 → 0.8.0 | succeeds |
| U7 | 0.8.0 → an implementation that declares Core and returns the location but does not gate | passes the guard; the canary must catch it (residual) |

### 5.5 The release-train rule

**Evidence.**
- ACL version and reinitializer per tag: v0.13.8 = 0.4.0/5; v0.14.0–v0.14.4-0 = 0.5.0/6; v0.15.0-0 = 0.5.0/6; v0.15.0-3 = 0.6.0/7; main = 0.7.0/8 [V-A7, V-CV].
- OZ's `reinitializer` reverts when `_initialized >= version` [V-A7].
- `test-suite/fhevm/profiles/latest-supported.json` pins every component to v0.14.2, so the next production line is plausibly 0.14.x [V-A7].

**The rule:**
1. **Main first.** Core lands on main first (0.8.0, reinitializer 9).
2. **Every line production may move to carries Core before production moves.**
   - The v0.13 line: 0.4.1/6, required.
   - The v0.14 line: 0.5.1/7. Optional for Level 0 green; required before any proposal that targets 0.14.x.
3. **Never upgrade a production registry to a release without Core.** The on-chain guard enforces this, and CI enforces it on every line with a Core-selector test plus a negative upgrade test.
4. **Numbering.** Each line's Core release takes its line's reinitializer + 1, with `reinitializeV{N-1}` naming.
   - Collisions with Core-less releases (0.4.1 ↔ 0.5.0, and 0.5.1 ↔ 0.6.0) are intended and revert with `InvalidInitialization`.
   - Skip-upgrades (0.4.1 → 0.6.0 or 0.7.0) succeed today and drop Core silently [V-A7]. The guard catches them.
   - "Numbering as a guard" (very high reinitializers) is rejected.
5. **Plan before the second backport.** Before any second production backport, fix a release plan with strictly increasing reinitializers across every line production may cross. Later levels bump again per line.
6. **One vote per chain.** One DAO vote per host chain, with both host chains upgraded in one release window, and per-chain status until both are done.

Open questions 1, 2 and 14 (§10) cover the target line and whether the guard ships inside the first proposal.

**Phase 4 amendment (§11.5).** Item 4's numbering is replaced by a proposal: lifecycle releases numbered from 1000 upward, never an upgrade to a lower lifecycle level, and a CI check over every upgrade path (open question 15).

### 5.6 The three limits, for what ships today

1. **Pre-emptive, not a clawback.** It protects accounts that retire before their key is used against them.
2. **Oracle access only.** The retired key still moves funds and holds app roles.
3. **As final as the chain's governance.** It holds per host chain, and today that governance is EOA-rooted multisigs with no timelock [V-P1].

---

## 6. Decisions log

The "Ref." column points to `DELIBERATION_SUMMARY.md`: (f) n is rank n of the ranked alternatives, and (h) n is open question n.

| # | Decision | Chosen | Alternatives considered (source) | Why | Ref. |
|---|---|---|---|---|---|
| D1 | Where lifecycle is enforced | A one-way bit read inside the registry views (Core) | V1 C1: write-side `notSealed` guards plus the `invalidatedBefore = 2^256−1` sentinel; a seal flag read by connectors (DESIGN_REVIEW); an immutable registry as the primary store (A2); the governance deny list | Views bind every verifier and every deputy at the upgrade block. The sentinel is inert on the deployed line, which has no slot and whose connector never reads invalidation [V-P1]. Write guards miss deputies [V-P1]. A connector flag needs n−t operators and +1 RPC. The deny list hands governance a per-user cut-off | (f) 1, 7, 21, 26 |
| D2 | Lifecycle states | Active → Retired only | NIST-like Active / Suspended / Retired / Compromised; a guardian-lifted Suspended extension (A2) | Whoever can lift a suspension becomes the attacker's target. Suspension also blocks the account's own carry and breaks monotonicity. The need is covered by account-level suspension and retire-with-successor | (f) 12 |
| D3 | Reason code | None: `AccountRetired(account, successor)`, parameterless `retireAccount()` | `reason ∈ {Superseded, Compromised, Unspecified}` (A4, A5); optional outside Core (A3) | A reason chosen by a possibly hostile key is not evidence. A public "compromised" flag is a breach notice, and a field with no semantics invites relying parties to give it some | (f) 13 |
| D4 | Roles gated | Every role in every view: the contract role in both delegated views, and the permit recipient for permit-based vendors | Delegator and delegate only (DESIGN_REVIEW §6.2) | A retired contract still passed on the delegated path [V-CV]. One uniform rule is testable, and it costs one SLOAD and zero RPCs | (a), b.2 R6 |
| D5 | Engine exemption | Defined by call semantics (R10). Caller identity is allowed only under three invariants | "Skip when `msg.sender` is the engine" (A1 draft, DESIGN_REVIEW) | On a relaying engine (Fhenix) a caller-identity rule would exempt every grant and the oracle's permit check [V-CV] | (a), b.2 R10 |
| D6 | Raw getters | The delegation-expiry getter returns 0 for retired parties; `allowedTransient` stays raw and documented as non-authoritative | Also gate `allowedTransient` (A4); leave the getter unchanged | The change matches the getter's own docstring ("0 means delegation is inactive") [V-A7]. `allowedTransient` is the primitive under `isAllowed` | (f) 23; (h) 13 |
| D7 | Survival across releases | Namespace + on-chain guard checking ERC-165 Core **and** the storage location (Core MUST for UUPS) + CI tests + canary + pinning; no escape hatch; no immutable registry now | ERC-165-only guard (coordinator); location-only guard and a delayed escape hatch (A3); numbering as a guard; an immutable registry as the state of record (A2) | Each single check misses a failure mode the other catches. An escape hatch is a rollback to a Core-less implementation. Numbering breaks Zama's CI convention. An immutable registry protects the bits, not the views; it costs a CALL or an RPC; it pays off only with multi-vendor adoption | (f) 7, 22, 24; (h) 2 |
| D8 | Storage location | A dedicated ERC-7201 namespace | Appending to `ACLStorage`, which collides at index 4 between v0.4.x and main [V-05]; a byte of the deny-list word, about 100 gas cheaper (A3) | Avoids the collision, and does not couple user state to a word that governance writes | (f) 21 |
| D9 | Second retirement | Reverts `AccountAlreadyRetired` in both entry points | Idempotent success (A1) | Deterministic failure beats silent success. Watchtowers pre-check and batch with failure-tolerant multicall | (c) c.9 |
| D10 | Continuity | Both: carry through the existing `multicall` (grants first), and a dedicated successor (E1) | V1's `allowMany` and `carryAndSeal`; carry only; successor only; SU-14, the successor as a locked wildcard delegation | `multicall` already exists [V-P1]. A fused grant-and-retire call turns one phished transaction into an irrevocable grant plus a lockout. Carry is a snapshot; the successor covers stragglers and lockout. SU-14 is live before retirement, needs special cases in revoke and in the one-change-per-block rule, and shows wallets a revoke button that reverts | (f) 16; (e) C2 |
| D11 | Successor acceptance | Mandatory, as a transaction from the successor | Optional (the G1 judge's "could"); an ERC-1271 check inside the registry (A4) | It proves control: a KDA, a typo or a burn address cannot accept. It stops unilateral association with, say, a sanctioned address. It needs no 1.23M-gas on-chain ML-DSA check | (h) 3 |
| D12 | Maturity delay D | Registry-wide ≥ 7 days (default 7); per-account raise-only up to 365 days (MAY); `confirmableAt` fixed at designation | A recommendation only, or a 1-day minimum (A1) | A floor makes the safety property testable. Raise-only makes institutional policy enforceable on-chain, cheaply | (h) 4 |
| D13 | An instant successor | Rejected | `retire(successor)`; a successor named inside a certificate | One phished signature = irrevocable capture plus lockout | (f) 17 |
| D14 | Successor powers | Decrypt-as only, after retirement only, no transitivity. Successor-issued delegations and succession transfer are deferred | Successor-issued, time-boxed auditor delegations (A2, A6); succession transfer by the successor (A2, A6) | Least privilege. Transitivity was the most-objected property. Smart-account successors rotate their owners internally | (f) 9, 10 |
| D15 | Declared decryption signer | E3: a delegation to a KDA, with zero ACL change. Subordinate; killed by retirement; delegated entries only; never a successor; no `WithSig`; native FIPS 204/205; no contract verifiers; no maturity delay | A registry-state signer with no-downgrade and matured declare and clear (A1, A2, A6); a separate decryption identity as root (V1 A1); ERC-8231 (rejected by A5) | Monotone: it grants nothing a wildcard delegation cannot already grant. It needs no new RPC. It fails closed on unmodified verifiers [V-A7]. Exclusivity needs registry state, +1 RPC per request and n−t enforcement, and it is redundant once Profile Q engages | (f) 5; (e) C4(b) |
| D16 | Retirement certificate | E2: retire-only; requires and binds a confirmed successor; explicit chain list; chain-agnostic EIP-712 domain; code-first; no nonce, expiry or cancellation; not pausable | A per-registry domain (A1); validity on present **and future** chains (A2, A4, A5); a certificate without a successor (A1; A6 as an off-switchable flag); cancellable certificates (custody); a hash-commitment `H(s)` form (A4) | Without a successor, a leaked certificate or a T2 forgery is a lockout bomb, and after a host freeze a permanent one. A cancellable certificate can be cancelled by the thief. Unbounded scope makes it a bearer instrument | (f) 8, 14, 15; (h) 5 |
| D17 | Cross-chain | Per registry, per host chain; one signature through E2's chain list; `retireEverywhere()` in the SDK | An oracle-side "union" of EOA retirements (A2); bridge or LayerZero propagation; a separate cross-chain extension | A union is a restrictive rule (n−t), costs RPCs per chain, surprises single-chain retirements and is unsafe for contracts. A bridge compromise could mass-retire accounts with no in-protocol undo | (f) 18, 19 |
| D18 | Q-day posture | Profile Q: operator policy at n−t; commit-then-activate at B_Q; ≥ 24 months scheduled notice; two emergency triggers; PQ-signed signal; claims only with a host freeze | V1 C5, a governance-flipped flag; an on-chain trigger; a registry-level ECDSA sunset (A2); notice of ≥ 180 days (A1, A5) or ≥ 6 months (A3) | Flipped today, a flag is an outage for about 98% of holders [M-04], and its ECDSA flipper falls first under T2. Only the host chain closes the on-chain door. A sunset in the registry needs a PQ-safe trigger, hence PQ governance first | (f) 3, 6, 25; (h) 6 |
| D19 | Verifier hygiene | Profile H: code-first, narrow shim, B_exec 2M plus intrinsic gas, 64 KiB cap, ≤ 2 attempts, shadow mode first | V1 C3 (the EIP-8151 rule); V1 C4(a) (a code-hash allowlist); terminal ERC-1271 failures; keeping `ecrecover` first; a deployless checker (A5) | The 8151 rule still accepts 7702 root keys. Proxies and modules defeat code hashes. Terminal failures contradict Zama's documented wallet-state rationale (`error.rs:97-100`) [V-A7]. Worst-case work becomes 4M instead of 5M gas [E]. The deployless checker stays an optional implementation, not a norm | (f) 11, 20; (e) C3, C4(a) |
| D20 | Retirement denials | Final and typed `ACCOUNT_RETIRED` (V7) | Recoverable and retried, as today [V-A7] | Retirement is monotone, so a retry cannot succeed legitimately. It also stops queued retries reviving after a governance lapse | b.3 V7 |
| D21 | Governance | A timelock owns every authorization-path contract and pointer and the gateway; pause is the only emergency power; end state: PQ signers plus n−t ratification | A timelock added as one more plugin; the status quo | A plugin is bypassed by the existing EXECUTE holders [I from V-P1]. Zama's ProtocolConfig already uses the n−t pattern [V-A7] | (f) 4; (h) 7 |
| D22 | Applications | Profile A: asymmetric observer gate, operator gate, no inbound blocking, no post-grant asserts | A naive gate that rejects every `setObserver` call from a retired account | A naive gate locks in a thief-added observer, who keeps reading every future amount [V-A7] | b.6 A |
| D23 | Transport and PQ claims | Core is transport-neutral; any PQ claim needs FIPS 203 on both the reply and the input channel | A PQ reply KEM required in Core | Core must hold for X25519 and ECIES vendors too. Under T2, classically encrypted inputs leak without the oracle [I] | (h) 10 |
| D24 | Host-state sources | Declared trust roots in the ICS; SHOULD avoid any source serving t+1 or more nodes | Leave them implicit | Controlling the answers of t+1 nodes bypasses every ACL rule [I] | (h) 11 |
| D25 | Level 0 targets | main 0.8.0/9; the v0.13 line 0.4.1/6, built from the `v0.13.8` tag; optionally the v0.14 line 0.5.1/7 | Backport only; the next production line only (A3) | The deployed-connector proof and the mock need 0.4.1, and production plausibly moves to 0.14.x [V-A7] | (h) 1, 14 |
| D26 | Standard layering | A vendor-neutral ERC, "Decryption Authority Lifecycle"; ERC-7984 keeps only Profile A | V1's ERC-7984 PQ profile | ERC-7984 defines no decryption rights [C]. The scope is wider than tokens, and "PQ" in the name overclaims the deployed phase | (e) |
| D27 | Test placement | Mock: views and flow. Connector harness: the `isAllowed` path, the unmodified-connector proof, Profile Q. Shared-crate harness: Level 1 and the KDA route | The brief's Level 1 ML-DSA test "in the mock" | The mock never calls `isAllowed`, has no ERC-1271 path, and leaves the unified V2 path unimplemented [V-A7] | A7 §2.12 |
| D28 | Complements | The Ethereum-native route (EIP-8298 + 3607 + 8151), inherited through Profile H; the host-chain freeze and recovery as the precondition for Profile Q claims | Treat either as a substitute | They do nothing for plain EOAs until a freeze, and the legacy path cannot see host-chain code | (f) 2, 3 |

---

## 7. What we deliberately do not do, and why

**(a) Not standardized** (`DELIBERATION_SUMMARY.md` b.8):

| We do not | Why | Status |
|---|---|---|
| Add a Suspended state | No safe party can lift it. It blocks carry, breaks monotonicity, and its need is met elsewhere (D2) | rejected |
| Put a reason code in the event | Self-declared by a possibly hostile key; a public breach notice (D3) | rejected |
| Use an on-chain PQ-only flag or trigger | Its trigger is either ECDSA governance, unsafe, or operators, who must opt in anyway. A record may exist but is informational | rejected |
| Add a registry-level ECDSA sunset | The only design that closes the on-chain door on a host chain that never freezes, but its trigger must be PQ-safe (PQ governance, n−t ratification, ≥ 24 months notice) | deferred research |
| Propagate retirement across chains, or union retirements in the oracle | Bridge trust for a rare action; mass-retirement risk; restrictive rules at n−t; unsafe for contracts (D17) | rejected |
| Add a carry function, or retire through the deny list | `multicall` exists; a fused call is a phishing primitive; the deny list is governance's tool (D1, D10) | rejected |
| Make an immutable registry the primary store | It protects bits, not views; it costs a CALL or an RPC; it pays off only with multi-vendor adoption (D7) | deferred end-state option |
| Let a successor issue delegations | Exposure-neutral but reintroduces transitivity. If ever adopted: ≤ 90 days, per contract, non-re-delegable, dying with the successor | deferred |
| Make the declared signer exclusive (no downgrade) | Needs registry state, +1 RPC per request and n−t enforcement; redundant once Profile Q engages (D15) | deferred |
| Use a hash-commitment certificate | Needed only for successor-less pre-arranged retirement, or if hosts change `ecrecover` for frozen EOAs | deferred |
| Make cross-chain a separate extension | It is E2's chain list plus per-chain semantics | folded into E2 |

**(b) Rejected alternatives** (`DELIBERATION_SUMMARY.md` §(f), ranks 12–26, beyond those above):

| We do not | Why |
|---|---|
| Accept certificates valid on present and future chains (rank 14) | A bearer instrument with unbounded scope |
| Accept certificates without a confirmed successor (rank 15) | A leak or phishing turns them into lockout bombs; a T2 forgery after a freeze locks out unprepared owners for good |
| Encode the successor as a locked wildcard delegation, SU-14 (rank 16) | Live before retirement; special cases in revoke and per-block rules; a revoke button that reverts |
| Allow an instant successor (rank 17) | One phished signature means capture plus lockout |
| Make ERC-1271 failures terminal (rank 20) | Contradicts Zama's wallet-state rationale; bounded to 2 attempts instead |
| Store the flag in the deny-list word (rank 21) | Couples user state to a word governance writes |
| Use numbering as a guard (rank 22) | Breaks Zama's CI convention; the guard does the job |
| Gate the raw `allowedTransient` getter (rank 23) | It is the primitive under `isAllowed` and documented as non-authoritative |
| Guard by ERC-165 only, or by storage location only (rank 24) | Each misses a failure mode the other catches |
| Keep V1 C5, a governance-flipped fail-closed flag (rank 25) | An outage today; the ECDSA flipper is the first T2 target |
| Keep V1 C1–C5 as written (rank 26) | Strictly dominated: inert on the deployed path, bypassed by deputies, more code |
| Use V1's other rejected alternatives: FHE key rotation or re-encryption; time-limited ACL permissions; relying on Ethereum alone; a separate decryption identity as root | They do not touch access control; break ERC-7984 semantics; leave the off-chain door open; or fail against B3, since the root key re-grants on-chain |

**(c) Claims we do not make:**
- **"PQ verification is cheaper than ECDSA."** Native ML-DSA-44 beats Zama's k256 `ecrecover` but not libsecp256k1 [M-A5].
- **"A KDA protects an EOA against Q-day."** It is a conditional hedge only, valid where the host chain freezes the EOA's ECDSA transactions.
- **"Profile Q protects unmigrated ECDSA accounts"** on a host chain that still accepts their ECDSA transactions.
- **"Watchtowers protect history after a theft."** Off-chain decryption leaves nothing to watch.
- **"A timelock's exit window protects users."** Users cannot withdraw ciphertext history; the window serves operators.
- **"Contract retirement is a decryption kill switch everywhere."** On main's unified path in permissive mode no contract is consulted at all (`decryption.rs:490-492`) [V-A7].
- **"Residual risk: none."** §9 lists them.

**(d) Operational non-goals:**
- **No ACL check in the gateway.** The status quo is right there [V-A7].
- **No blocking of inbound grants or transfers to retired accounts by default.**
- **No support-desk unfreeze and no vendor-only recovery.** Either would be a backdoor.
- **No "send to successor" UX.**
- **No pause gate on retirement.**
- **No extension of the legacy ECDSA path.**
- **No outreach or publication in this phase** (brief §0).

---

## 8. The V1 → final mapping

This is `DELIBERATION_SUMMARY.md` §(e), unchanged in substance.

| V1 item | V1 content | Final form | Level | Verdict | Why |
|---|---|---|---|---|---|
| **C1** | `sealAccount()`; `notSealed` write guards; `invalidatedBefore = 2^256−1` sentinel | Core R1–R14: `retireAccount()`, a one-way bit enforced in the read views for every role (contract included). Grant paths fail through `isAllowed`; no sentinel; no write guards | L0 | **Goal returns; mechanism replaced** | The sentinel is inert on the deployed path (no slot; the v0.13.8 connector never reads invalidation) and redundant on main. Write guards miss deputies that authorize through the views |
| **C2** | `allowMany`, `carryAndSeal` | Carry = the existing `ACL.multicall([allow(h_i, NEW)…, retireAccount()])`, grants first, chunked. L2 carry tool with a dry run and spam filter. E1 successor for O(1) continuity and stragglers | L0 (mechanism), L2 (tool, E1) | **UX returns; functions dropped** | `multicall` exists. A fused grant-and-retire call turns one phished transaction into an irrevocable grant plus a lockout. Carry is a snapshot |
| **C3** | The connector applies the EIP-8151 rule; 7702 is "not a safe destination" | Profile H: code-first ordering with a narrow 7702 shim (successful empty return only); same-block code reads; the legacy path refuses regular-code subjects. Wallet copy: "a 7702 upgrade does not protect confidential history" | L1 | **Concept returns; rule dropped** | The 8151 rule accepts 7702 root keys (`SignerEIP7702` does). Node rules bind only at ≥ n−t operators |
| **C4(a)** | Code-hash allowlist with a higher gas cap | Dropped. Replaced by the execution-gas budget (2M + intrinsic), a 64 KiB cap and ≤ 2 attempts | L1 | **Dropped** | Proxies and modules defeat code hashes. Three configuration layers. ×20 retry DoS amplification |
| **C4(b)** | Scheme-hinted native verification through `pqAuthKey()` | E3 Declared Decryption Signer as a KDA delegation (ERC-7913 layout, native FIPS 204/205, reserved scheme ids) | L3 | **Returns** | 84–89 µs natively [M-A5] against 1.23M EVM gas [M-P1]. Zero ACL change. Subordinate and killed by retirement |
| **C4(c)** | EIP-8051/8052 precompiles | Inherited automatically under the execution budget; no ERC dependency | L1+ | **Returns as "inherit"** | Calldata alone is 71% of 250k for ML-DSA-44 [M-03]. EIP-8355 was declined for Hegotá [C] |
| **C5** | Governance flips `ecdsaDecryptionAuthorityDisabled` at Q-day | Profile Q: operator policy at ≥ n−t, commit-then-activate, ≥ 24 months notice, B_Q cutoff, PQ-signed signal; claims only with a host-chain ECDSA freeze. Pre-emptive retirement to a PQ successor is the real protection | L3 | **Flag dropped; intent returns** | Flipped today it is an outage for about 98% of holders. The ECDSA flipper falls first under T2. The on-chain door stays open without a host freeze |
| **ERC-7984 PQ profile** | `IConfidentialAuthorityLifecycle` (`sealAccount`, `isSealed`, `allowMany`, `carryAndSeal`, `AccountSealed`) plus rules R1–R4 | A vendor-neutral ERC, "Decryption Authority Lifecycle": Core + E1–E3 + Profiles H/Q/A. ERC-7984 keeps only Profile A | L0–L3 | **Returns at the right layer** | ERC-7984 defines no decryption rights. The scope is wider than tokens. "PQ" in the name overclaims the deployed phase |
| **R1** | No permit is accepted for a sealed account | Core V1 + V4 (release only on true views for every subject; no bypass) | L0 | **Returns (Core)** | Enforced in views, so it binds verifiers without code change |
| **R2** | Reject `ecrecover` if the declared address has code other than the 7702 indicator | Profile H code-first (any code → ERC-1271; 7702 → ERC-1271 plus the narrow shim) | L1 | **Returns, corrected** | V1's 8151-equivalence still accepted 7702 root keys |
| **R3** | Refuse the ECDSA path while fail-closed is on | Profile Q refusals (code-less, `0xef0100`, legacy path) | L3 | **Returns, re-founded** | An operator policy, not a flag |
| **R4** | Optional native verification for `pqAuthKey()` accounts | E3 KDA route | L3 | **Returns** | ERC-7913 bytes replace `pqAuthKey()` |
| **G1** | Pre-emptively and permanently cut a compromised or future-compromised key's access to past history (the original doc's protected asset "V1": the plaintexts of past handles) | Core (+ E2 for multi-chain and lost keys) | L0 | **Kept, qualified** | "Pre-emptive, not a clawback"; permanence is bounded by limit 3 |
| **G2** | Move to a PQ account without losing history | Carry + E1 successor + E3 (a PQ route that keeps the address) | L0/L2/L3 | **Kept** | PQ destinations exist only on main; the deployed path has no ERC-1271 |
| **G3** | PQ accounts authorize at reasonable cost | Profile H budget + E3 native verification | L1/L3 | **Kept** | — |
| **G4** | The protocol fails closed at Q-day | Profile Q + host-chain freeze + pre-emptive retirement | L3 | **Kept, re-scoped** | It fails closed on the off-chain door only, unless the host chain freezes |
| **G5** | Backward compatibility | Core is byte-identical for never-retired accounts; inbound grants are accepted | L0 | **Kept** | Differential tests |
| **G6** | Minimal change; no new primitive; no new trust assumption | Core ≈ 75–90 lines in one contract; standard primitives; Extensions add no trust root beyond operators and governance, which are already trusted | L0 | **Kept** | E3 adds an unaudited-library dependency, stated as such |
| Principle 1 | Do not invent; add the missing piece | Kept: the views, `multicall`, delegations and ERC-7913 are reused | all | **Kept** | — |
| Principle 2 | Close both doors | Kept and better achieved: one read-side bit closes both | L0 | **Kept** | V1 locked the wrong side of each door |
| Principle 3 | Irreversibility | Kept (R2), qualified by limit 3 and the upgrade guard | L0 | **Kept, qualified** | — |
| Principle 4 | Backward compatibility | = G5 | L0 | **Kept** | — |
| Principle 5 | Fail-closed | Kept for errors and timeouts (V1) and for Profile Q; never through one committee | L0/L3 | **Kept, re-founded** | — |
| §7.1 user flow | PQ account → `carryAndSeal` → move assets → decrypt with PQ | Inventory and export → exit apps (observers, operators) → move assets → carry → retire (with a successor) on every host chain | client | **Corrected** | V1's order left app roles active |
| A1 (alternative) | A separate decryption identity as root | Rejected as root; returns as the subordinate E3 | L3 | **Transformed** | B3: the root key re-grants on-chain |
| A2–A6 (alternatives) | Key rotation; time-limited ACL; rely on Ethereum; smart accounts only; PQ KMS signatures | Verdicts unchanged: rejected; rejected; rejected; necessary but insufficient; orthogonal (Zama roadmap B7) | — | **Unchanged** | — |
| §8 "residual risk: none" | — | Replaced by per-level residual risks and the three limits | — | **Dropped** | Overclaim |

**Semih's instinct, tested.** V1's **vision** was broader than the first minimal PR. All six goals, all four verifier rules and the "both doors, one decision" principle return.

V1 was **not** better on mechanism or threat model:
- none of the five mechanisms survives as written;
- its threat model missed deputies, the deployed line, threshold placement, governance, stored results, multiple chains, application roles and lockout;
- it held three vision-level claims that do not hold:
  - an off-chain switch protects history at Q-day;
  - everyone should move to a pure PQ smart account, which costs 14.6M–104.9M gas [M-P1];
  - EIP-7851 would close the 7702 gap; it was declined for Hegotá [C].

**The final design is V1's scope, built with v2's enforcement theory, the review's threat model and the three limits.**

---

## 9. Residual risks, by level

What the design must not claim away. Phase 4 adds the residuals in §11.7.

**Level 0 (Core).**

| Residual | Why it remains | What narrows it |
|---|---|---|
| Post-compromise race | Limit 1. Third-party grants, public handles and decrypted plaintext stay exposed. A thief's off-chain permit needs no transaction, and a decryption takes seconds (2.5–12.6 s on Sepolia [M-P1]) | pre-emptive retirement; custody monitoring |
| Identity-gated app roles | Limit 2. Observers, operators and owner roles key on `msg.sender`; asset authority stays with the key | Profile A (L2) |
| Governance or gateway compromise | Limit 3. This includes the "contract as user" trick on the legacy path [V-05]. The guard stops only accidental lapses | timelock now; canary and pinning (n−t); PQ governance (L3) |
| A lying implementation (U7) | It passes the guard by design | canary and pinning |
| Stored results and transport keys | Released shares stay decryptable by whoever holds the transport key; keys are reusable for up to 365 days today [V-P1]. Shares published on the gateway chain stay there. Unmodified, the main connector endpoint re-serves a stored result after retirement, and the relayer re-serves it to the same and to an equivalent request [M-P4] | SDK hygiene (L2); H7 in Profile H: with it both refuse after retirement, and the H4 attempt state survives a restart [M-P4] |
| Per-chain coverage | Each host chain has its own registry; Ethereum and Polygon both run ACL v0.4.0 [M-04]. Bridged handles are new destination handles [V-05] | `retireEverywhere()`; E2 chain lists; per-chain status |
| Lockout without a successor | A thief-first or phished retirement locks the owner out of later arrivals | E1 (L2); wallets treat retirement as a red action |
| Contract self-retirement | It bricks the contract's handles on both paths, equivalent to an existing admin power. Arbitrary-call admin paths can force it, directly or through the registry's `multicall`, and can also hand the contract to a successor of their choice [M-L2] | documentation; generic-call paths refuse lifecycle selectors (Profile A) |
| Carry blocked during a pause | `allow` is pause-gated [V-P1], while retirement is not | retire with a successor (E1) |
| Linkability | Carry events link the old and new accounts | SDK warning |
| Host-state source concentration | Pre-existing: whoever controls the RPC answers of ≥ t+1 nodes bypasses every ACL rule; one RPC URL per host chain per operator [V-A7]. Extent in production unknown; potentially High [I] | O2 disclosure; O3 diversity |
| Unprepared ECDSA holders under T2 | Core protects only those who retire first | Levels 2–3; the host chain's freeze and recovery |

**Level 1 (Profile H).**

| Residual | Why it remains | What narrows it |
|---|---|---|
| Typical 7702 accounts keep their root key | Their delegates accept it in ERC-1271 [V-A7] | retirement (L0); host-chain 8298 migration |
| Compatibility breakage | ERC-7739 wallets signing plain typed data, and delegates without `isValidSignature`, fail under code-first | shadow mode; SDK wrapping |
| Legacy path stays ECDSA | The gateway verifies on the gateway chain | legacy refusal; retiring the path (L3) |
| Partial adoption | Restrictive parts bind only at ≥ n−t operators | operator commitments |
| Calldata accounting | `gas_limit` per attempt can exceed B_exec by about 4.2M for a 64 KiB signature, without matching computation [E] | the cap; the attempt bound |
| Account-asserted ERC-1271 | A contract with ECDSA owners passes | Profile Q "strict" variant (L3) |

**Level 2 (continuity and applications).**

| Residual | Why it remains | What narrows it |
|---|---|---|
| Unnoticed attacker designation | Accepted by the attacker and confirmed after D, it survives retirement (asserted in tests) | alerts on designation; designate at setup; D ≥ 7 days; carry plus retire on any surprise |
| Replaced pending designations | A thief can keep replacing them | carry plus retire now |
| Lost ECDSA-EOA successor (deployed path) | Final: no replacement after confirmation | institutions also carry; smart-account successors on main |
| No transitivity | The successor cannot re-share, so auditors rely on carry | carry |
| OZ adoption | Outside our control; the vanilla observer leak remains until adopted | Profile A upstream |
| Carry spam | Junk `Allowed` grants inflate carry cost | allowlist filter; dry run; successor covers the rest |

**Level 3 (PQ-native authority, Profile Q, certificates, governance).**

| Residual | Why it remains | What narrows it |
|---|---|---|
| Unaudited PQ libraries | RustCrypto `ml-dsa` 0.1.1 and others are unaudited [V-A7, C] | audit; vectors; library diversity |
| Verification bugs | A bug on t+1 or more nodes would accept forgeries | two-implementation agreement or library diversity |
| No exclusivity | ECDSA permits stay valid alongside a KDA until Profile Q | Profile Q; the deferred exclusive variant |
| KDA scope | Impossible on the deployed path; owner rotation in a smart account does not revoke KDAs | wallets list and revoke KDAs |
| On-chain door under Profile Q | Forged ECDSA transactions can `allow`, delegate or publish until the host chain freezes ECDSA | host-chain freeze; pre-emptive retirement |
| Partial-adoption cliff | With 5–8 enforcing operators, service degrades before protection appears | commit-then-activate at B_Q |
| ECDSA KMS responses | Public-decryption results stay ECDSA-signed (B7) | Zama's ML-DSA roadmap |
| Fail-closed lockout | Unprepared accounts lose access at B_Q | notice, KPI, recovery paths |
| ECDSA successor under T2 | A successor that is itself ECDSA-rooted is weak at Q-day | PQ successors |
| Leaked certificate | Triggers an early but planned handover | offline storage |
| Governance not yet PQ | PQ signers and ratification are not deployed | the governance profile |

**Across levels:**
- **The host chain's consensus and account authentication** bound everything (limit 3).
- **Inco** was not examined, so no claim of fit is made for it.
- **Fhenix** can meet Core only through an ACL port that also gates the permit recipient.

---

## 10. Open questions for Semih

These are `DELIBERATION_SUMMARY.md` §(h), with the default this document assumes until you decide.

| # | Question | Default assumed here |
|---|---|---|
| 1 | **Production line.** Should the Zama proposal target the v0.13 backport (0.4.1), the 0.14 line (0.5.1), or main first? `latest-supported.json` points at v0.14.2 [V-A7] | Main first; 0.4.1 required for Level 0; 0.5.1 before any 0.14.x proposal |
| 2 | **Upgrade guard.** Keep it inside the first proposal (the ruling: Core MUST for UUPS registries), or offer it as a separable commit if Zama resists? It blocks quick rollbacks to pre-Core implementations by design | Inside, as Core MUST |
| 3 | **Successor acceptance.** Mandatory acceptance overrules the G1 judge's "could". It implies that a cold recovery key signs one transaction at setup. Confirm? | Mandatory |
| 4 | **D.** A floor of 7 days, default 7, with a per-account raise-only option up to 365 days. Accept? | Yes |
| 5 | **Certificates.** They require and bind a confirmed successor, with an explicit chain list. Users without a successor cannot use certificates (they retire directly), and the hash-commitment form is deferred. Accept? | Yes |
| 6 | **Profile Q notice.** 24 months scheduled plus the two emergency triggers, or a date aligned with NIST IR 8547 (2030/2035 [C])? | 24 months |
| 7 | **Timelock delay.** 7 days for the Level 3 demo and the ask; 14 days recommended for rights-widening changes in the end state? | 7 now, 14 end state |
| 8 | **Names.** ERC title "Decryption Authority Lifecycle". Extension name "Retirement Certificate", or "Revocation Certificate" as in the brief? | "Retirement Certificate" |
| 9 | **KDA identifiers.** The domain tag and scheme ids are provisional. Align them with EIP-7932 ALG_TYPE, or keep hash-derived ids? | Hash-derived, provisional |
| 10 | **Reply KEM.** Recommend ML-KEM-768 or higher (SHOULD) for replies published on-chain, while Core stays transport-neutral? | Yes, as SHOULD |
| 11 | **RPC concentration.** The ruling keeps it in Security Considerations in general terms. Do you also want it raised privately with Zama before any publication? Nothing is sent in this phase | General terms only |
| 12 | **Inco.** Fetch and read its code before the ERC claims a three-vendor fit, or keep Inco as "not examined"? | "Not examined" |
| 13 | **Getter change.** `getUserDecryptionDelegationExpirationDate` returns 0 for retired parties, which changes a getter's semantics in line with its docstring. Keep it in Level 0? | Keep |
| 14 | **The 0.14 line (0.5.1)** as an optional third Level 0 target, built only if time permits? | Optional |

---

## 11. Phase 4: what changed (2026-10-21 to 2026-10-22)

Phase 4 tested the design further, on local chains and on the capped VPS, without publishing anything or contacting
any vendor service. Every task's report is in `results/phase4/`, with its status in `results/phase4/STATUS.md` and
its decisions in `DECISIONS_LOG.md`. This section records what that changes in the architecture.

### 11.1 The standard is split

- **`erc/ERC-XXXX-decryption-authority-lifecycle.md`** is now the registry-side standard: Core (R, V and O rules), E1
  and E2. The Motivation's facts cite `erc/assets/erc-XXXX/EVIDENCE.md`, and the conformance kit sits in the assets.
- **`docs/COMPANION_EXTENSIONS_AND_PROFILES.md`** holds E3 and Profiles H, Q and A, in full normative style, as
  candidates for later ERCs and operator profiles.
- `docs/ERC_SPLIT_MAPPING.md` places every rule, test case and constant of the Phase 3 draft. The ERC lints clean
  except its two placeholders, and its constants were recomputed with `cast` (D1).

### 11.2 EIP-7851 and EIP-8298: a host-chain key disable does not reach the verifier

- **The gap [M-P4].** With a simulated EIP-7851 indicator (`0xef0101` followed by the delegate), Zama's unmodified
  verifiers accepted the disabled root key on every request path, on `main` and v0.13.8 (P0.4). They recover the
  signature before they read the account's code.
- **What closes it.** Profile H's code-first ordering (H2): the indicator is regular code, so only ERC-1271 counts.
  Under `enforce` the root key is refused and an ML-DSA-44 signature is accepted at `B_exec` 2,000,000; H6 refuses
  the legacy path; the SDK precheck agrees.
- **The text.** The ERC and the companion treat the indicator as regular code and such accounts as migrated (Q4, Q5,
  Q7). The SDK's `getAuthorityStatus` reports the account's code: `empty`, `eip7702`, `eip7851` or `regular` (P1.6).
- **EIP-8151** would stop `ecrecover` accepting such keys on chain; off-chain verifiers recover in their own code, so
  it does not reach them either [I, from the EIP texts].
- **EIP-8298 (Phase 5, P0.3) [M-P5].** An EOA that adopts a wallet's regular code (simulated with `anvil_setCode`;
  nothing rewritten) is the same case. The unmodified verifiers accepted its old root key on every path; `enforce`
  refused it and accepted the wallet's ML-DSA-44 signature; `getAuthorityStatus` reports `regular`. Adopted code cannot
  be told from a contract's code, so Q5 now reads a regular-code delegator's code at B_Q
  (`results/phase5/P0_3_EIP8298.md`).

### 11.3 Fhenix and Inco: Core is vendor-neutral

- **Fhenix CoFHE, ported [M-P4] (P2.1).** Core runs on Fhenix's host-chain contracts (`cofhe-contracts` `b5c20ed`)
  without a change of mechanism:
  - every view role is gated, including the permit role and the ACP share registry;
  - every grant path that the `TaskManager` relays is gated on the requester it passes;
  - the upgrade guard is in place.
  - **The one Fhenix-specific choice is R10's.** The `TaskManager` relays grants, the use view and the oracle's permit
    check, always as itself. A caller-identity exemption there passes all of them for a retired account, as the
    negative test shows, so the port gives the engine a dedicated operand-check entry.
  - TC1–TC12 and TC6: 69 passed, 4 skipped (no E1, no E2), three runs; 17 of 17 gate mutations caught.
  - TC3 holds two ways: a differential fuzz against Fhenix's unmodified contracts, and Fhenix's own plugin suite.
  - End to end on Fhenix's published mock stack: 6/6.
  - **Decryption service [V].** Fhenix's `teecryptor` consults the permit view and the public view through the
    `TaskManager` at `latest`. The threshold network's dispatcher is not public.
  - **A constraint to remember.** Fhenix's `TaskManager` sits 233 bytes under EIP-170, and the port leaves 80.
- **Inco Lightning, read [V] (P2.2).** Core maps onto it without a change of mechanism, and more simply: the registry
  and the engine are one contract, so the exemption is an internal call site.
  - Two cautions for a port. A negated existence check (`require(!isAllowed(...))`, which refuses duplicate inputs)
    must stay raw: gating it would allow an input re-use export. Inco's pause also gates the views, unlike the
    governance profile.
  - The sources are BUSL-1.1, so nothing was vendored and any port stays private. Its decryption service is not
    public. No Inco code ran.
- **A vendor-neutral conformance kit (P2.3).** It is an abstract Foundry suite for TC1–TC12, TC17 and TC19, driven
  through adapters, plus JSON fixtures for TC13–TC15 with a checker. On the recorded runs, TC15's fixture finds 35
  conforming cells and 8 violations, all the unmodified verifier's (it serves stored results again and retries
  retirement denials).
  - Zama `main` and the v0.13 line pass, 17 passed and 1 skipped (no on-chain permit). The Fhenix port passes, 14
    passed and 4 skipped.
  - Removing any of six gates from Zama's registry makes the kit fail.
  - The kit is in the ERC's assets.

### 11.4 Amsterdam: measured, and what it means for carrying and deployment

- **The schedule [M-P4] (P2.4).** A Foundry nightly's anvil applies Amsterdam's state-creation pricing. One `allow`
  of a new pair on Zama's unmodified ACL v0.7.0 costs 140,780 gas there, exactly Sepolia's figure, against 58,360
  under Osaka. A transaction that creates one storage slot costs about 82,400 more (82,420 for `allow`, `retireAccount`, `designateSuccessor` and `raiseSuccessorDelay`).
- **Lifecycle costs.**

  | Operation | Osaka | Amsterdam |
  |---|---|---|
  | `retireAccount()` | 50,099 | 132,519 |
  | One handle in a carry batch | 31,385 | 119,505 |
  | E1 set-up (designate, accept, confirm) | 159,276 | 326,100 |

  Phase 3's estimates were 5,600–5,700 gas high per transaction.
- **The largest carry in one transaction.** At a gas limit of exactly 2^24 it is 524 handles under Osaka and 137
  under Amsterdam [M]. The proxy forwards only 63/64 of the gas, which a linear fit misses.
- **EIP-8037 changes the transaction rule** (Last Call). The 2^24 cap applies to execution gas only, and state gas
  comes from `tx.gas` above it. Under that rule about 765 handles fit by execution gas, fewer if the block's gas limit
  binds [E]. The local chain's pool still caps the whole `tx.gas`, so this part is not a receipt.
- **Deployment.** The ACL releases with Core need 18–26M gas to deploy under Amsterdam (Zama's own v0.7.0 needs 17M). That is valid only under
  EIP-8037's rule, which puts the code deposit in state gas. A chain that kept the Osaka-style cap on the whole
  transaction could not deploy them in one transaction.
- **A method correction.** forge 1.8.5's `vm.cool` cools storage slots but not accounts. Profile A's operator gate
  therefore costs +12,804 gas with the registry cold, not +7,781; other deltas are unaffected (D68).

### 11.4b End-state prototypes (P3)

- **Operator ratification is affordable on chain.** A prototype timelock executes a registry upgrade only with
  ML-DSA-44 signatures of at least 9 of 13 operators, verified on chain. That costs 11.5M gas under Osaka and
  11.7M under Amsterdam's schedule; all 13 still fit one transaction under 2^24 [M, Local]. The verifier is
  unaudited, and publishing each operator key is a 20,545-byte contract.
- **The reply-channel KEM costs bytes, not time.** ML-KEM-768 operations take tens of microseconds. Each published
  reply grows by 320 bytes over ML-KEM-512, so Q6's recommendation stands.
- **Connector throughput** is parked: a thousand concurrent requests on the shared VPS needs approval or a
  dedicated host.

### 11.5 The release train

- **ACL 0.5.1 with Core on v0.14.4 (P1.5).** The whole suite passes, 759/759, three times. U6: 0.4.0, 0.4.1 and
  0.5.0 upgrade to it with state and enforcement kept. Our 0.4.2 (E1) collides on reinitializer 7 and would drop E1;
  OpenZeppelin's validator agrees.
- **E2 on the v0.13 line (P1.3).** ACL 0.4.3 passes 629/629, and the ERC's certificate vector reproduces.
- **The check.** `scripts/check_reinitializer_order.py` reads every release from git and requires reinitializers to
  grow along every plausible upgrade path. Today it finds 3 violations against Zama's projected next releases, and 0
  under the proposal.
- **The proposal** amends §5.5's numbering rule:
  - number lifecycle releases from 1000 upward (`1000 + 100 × line + 10 × (level + 1)`), leaving Zama's own releases
    about 990 numbers of room;
  - never upgrade to a lower lifecycle level;
  - run the check in CI.

  It replaces item 4 of §5.5. Nothing was renumbered yet; that is open question 15.
- **Deployed** (read-only, 2026-10-22): mainnet and Sepolia still run ACL v0.4.0.

### 11.6 Verifier and oracle evidence added

| What | Result | Task |
|---|---|---|
| V1 when view calls fail (TC13) | Unmodified verifiers refuse a retired subject on every path, on both lines (3 runs each), under JSON-RPC and HTTP errors, dropped connections, timeouts, malformed JSON, empty or truncated results, reverts and intermittent failures. The claim is conditional on decoding view answers strictly, as V1 now defines a malformed answer | P0.1 |
| Decision lag (TC14) | L = 0 on both lines (every view at `latest`); after the retiring block, refused; a restart or an already-sent request re-checks; no decision from a replica | P0.2 |
| Stored results and final denials (V6, V7, TC15) | Unmodified, the `main` connector endpoint and the relayer serve a stored result again after retirement, and a retirement denial is retried, untyped. H7 and H5 (Level 1) refuse, final. The kit's TC15 fixture: 35 cells conform, 8 violate, all the unmodified verifier's | P0.3, P2.3 |
| E3 in the verifier with K8 (TC20) | Four ML-DSA libraries each pass 631/631 Wycheproof vectors and every ACVP sigVer vector they expose. Agree mode refuses an injected fault. With one library per node, no forgery reaches t + 1 | P1.1 |
| Profile Q in the verifier (TC22) | Q1 from 13 operators' ML-DSA-65 statements, threshold 9. Q4 refusals per path, and the Q5 cutoff. With 13 real verifiers an ECDSA request was still released at k = 0, 4, 5 and 8 enforcing and refused at k = 9 and 13; the threshold rule gives the other k | P1.2 |
| Readiness (Q2) | 0 of 1,713 active decryptors on mainnet have a proven post-quantum-capable route | P1.2 |
| Profile H `enforce`, real-world impact | Of the 2,220 EIP-7702-delegated end accounts, 680 (5.3% of all 12,730 end accounts; 6.0% of the active ones) would be refused for a root-key signature | P2.5 |

### 11.7 New residual risks

| Residual | Why it remains | What narrows it |
|---|---|---|
| Old key of an EIP-7851 or EIP-8298 account accepted by unmodified verifiers | Verifiers recover the signature before reading code | Profile H (H2, H6) at n−t operators |
| Malformed view answers | The verifier inherits Core only if it decodes view answers strictly (V1's definition) | Strict decoding in each verifier client |
| Stored results served again | Unmodified components re-serve after retirement | V6, H7 |
| `enforce` refuses about 5–6% of delegated accounts' root-key signatures | Their delegates do not answer ERC-1271 for the root key, or answer only for their own envelope | H8's shadow mode first, with the impact published |
| Profile Q's partial-adoption cliff | With 8 or fewer enforcing operators an ECDSA request is still released | Q1's commit-then-activate procedure |
| Amsterdam costs | Retirement and succession set-up cost about 2–2.7× more, and carrying about 3.8× more; one transaction carries about 137 handles where the whole transaction gas is capped | Chunked carries; EIP-8037's transaction rule |
| Release-train collisions | Projected next vendor releases collide with lifecycle reinitializers | The numbering proposal and the CI check |
| Port constraints | Fhenix's `TaskManager` has 80 bytes left; on Inco an existence check must stay raw and pause gates the views | Per-vendor review of every negated or paused check |

Open question added:

| # | Question | Default assumed here |
|---|---|---|
| 15 | **Renumbering.** Adopt the 1000-based lifecycle reinitializers, which needs every fixture and upgrade test rewritten, before any proposal? | Adopt before the first proposal; not done yet |

Open question 12 (Inco) is answered for the registry: read, maps without a change of mechanism (P2.2).

## 12. Phase 5 (2026-10-22)

Phase 5 corrected three statements in the documents (Part A) and built the post-quantum path end to end (Part B).
As before, it ran on local chains and on the capped VPS, published nothing and contacted no vendor service. Reports:
`results/phase5/`; status `STATUS.md`; decisions from D90 on in `DECISIONS_LOG.md`.

### 12.1 Part A: three corrections

- **What an account can remove (P0.1).** An account can:
  - revoke or shorten a delegation it granted;
  - on `main`, invalidate its permits whose start time is earlier than a chosen time.

  It cannot end its own authority, withdraw a per-handle grant, undo a public decryption, or stop its key from
  signing new permits. Every document now says so.
- **TC15 (P0.2).** The unmodified verifier meets Core's required rules V1–V5. It does not meet the recommendations V6
  and V7, which need the hygiene profile (H5, H7). Every mention of TC15 now quotes the kit's numbers, 35 cells
  conform and 8 violate (all the unmodified verifier's), or only defines the test case.
- **EIP-8298 next to EIP-7851 (P0.3).** An EOA that adopts a wallet's regular code is the same case for verifiers as a
  disabled indicator:
  - unmodified verifiers accepted its old root key on every path;
  - Profile H's code-first ordering refused it;
  - `getAuthorityStatus` reports `regular`.

  Connector 28/28 rows, local 20 rows, three runs each (§11.2).

### 12.2 Part B: the target, as four properties

With the old ECDSA key assumed known to an attacker, an account has completed the post-quantum path when:
1. no verifier releases anything on that key;
2. that key creates or extends no right on chain;
3. the holder decrypts past and future data through a post-quantum signature only;
4. no upgrade undoes this without post-quantum authorization.

`docs/PQ_FULL_PATH.md` (Turkish: `docs/PQ_TAM_YOL_TR.md`) states the whole path.

### 12.3 Part B: what was run

**The parts:**
- an ML-DSA-44 test wallet (ERC-1271, and a relayable `execute`; deployed or as an EIP-7702 delegate);
- the Level 3 registry;
- the Phase 5 kms-worker (Level 3 plus Q5 at B_Q);
- the carry tool, the watchtower, the SDK and the canary.

**The two drills,** three runs each:
- the connector drill on the VPS: 258 request rows and 40 transactions per run;
- the local drill on M1, under Osaka and Local-Amsterdam: 81 rows per fork.

Every row matched the design in every run [M].

| Path | Off-chain (1) | On-chain (2) | Continuity (3) |
|---|---|---|---|
| **B1** carry, then retire | holds | holds | holds; later grants to the old address are inert |
| **B2** successor, then retire or certificate | holds | holds | holds; later grants reach the successor |
| **B3** EIP-7702 to the wallet, then EIP-7851 or EIP-8298 (simulated) | holds for the key's own signatures; earlier delegations stand until revoked | **does not hold** on a chain that accepts the key's transactions | holds until the old key retires the account |

**Upgrade safety (4)** held in the local drill with the registry under an operator-ratified owner (9 of 13 ML-DSA-44,
7 days):
- 8 signatures reverted;
- 9 on a Core release passed the guard, with the canary green;
- 9 on a release without Core reverted at the guard.

The matrix is `results/phase5/PQ_DRILL_MATRIX.md`; the path report `results/phase5/B1_B6_PATHS.md`.

### 12.4 What Part B changes in the architecture

- **B3 does not combine with Core retirement.** Retirement ends the account's authority, and in place the wallet is the
  account: after the old key retired a B3 account, the holder's requests were refused.
  - An account that wants a post-quantum key and retirement moves out (B1, B2).
  - An account that stays in place depends on the host chain to stop its old key.
- **Carry, then retire with a successor** is the recommended route. The carried history is the wallet's own, so a
  declared signer (E3) works for it; later grants reach the wallet through the successor path.
- **A successor's own declared signer does not reach its predecessor's handles** (D98). The candidate rule would
  reintroduce the transitivity S9 forbids. The companion records it as rejected (K3, Rationale).
- **Q5 reads the state at B_Q** (D99, branch `lifecycle/phase5-connector` `a4416155`).
  - A succession counts only if the same successor was confirmed at B_Q.
  - A delegator whose code is regular now but was empty or an indicator at B_Q gets the cutoff.
  - Both fail closed. The earlier worker refused successors under Q altogether: an availability gap, not a hole.
- **Profile Q's cliff holds on the full scenario.** At 8 of 13 enforcing, an ECDSA request was released by the other
  5; at 9 it was withheld, in every run.
- **The live line (`v0.13.8`) can retire, succeed (ECDSA successors) and carry, but not decrypt with a post-quantum
  key.** Its gateway checks user and delegate signatures with ECDSA only, and has no ERC-1271 path (B9).
- **Costs (B8).**
  - Once per chain: an on-chain ML-DSA-44 verifier, 5.17M gas (Osaka).
  - Once per account: the key, 4.43M (31.9M under Local-Amsterdam).
  - Per request: an ERC-1271 check costs the verifier's node about 1.23M gas; E3 costs about 245 µs.
  - EIP-8355 would bring the check to about 13,000–15,000 gas [E].
- **The gap map (B7)** leaves the KMS's, coprocessors' and components' own signatures, the input proofs and governance
  classical. No account-level step closes them.

### 12.5 New residual risks

| Residual | Why it remains | What narrows it |
|---|---|---|
| The old key acts on chain after an in-place migration | The host chain accepts its transactions until EIP-7851 or EIP-8298 is enforced | Moving out (B1, B2); the host chain; Profile Q narrows the effects for ECDSA-rooted readers |
| A delegation the old key makes after B_Q, for an account that adopted its code before B_Q | The code at B_Q is already regular, so Q5 cannot tell it from a contract's | EIP-8298 enforcement, under which the key cannot send it (Q7) |
| Adopted code's own declarations after B_Q are refused under Q | The verifier cannot establish the adoption block, so Q5 fails closed | A registry getter, or an indexed adoption block |
| The governance handover is an ECDSA transaction | Today's owner must hand ownership to the operator-ratified contract | Doing it while today's keys are safe |
| The upgrade guard checks declarations | It stops an accidental release, not one that lies (U7) | Review of every release; the canary |

Open question added:

| # | Question | Default assumed here |
|---|---|---|
| 16 | **Delegation history getter.** Ask the registry for a view that returns a delegation's last-change block and an account's successor at a given block, so that Q5 needs no storage reads or historical state? | Propose it with Profile Q, not with Core |

---

## Appendix A. Conflicts between the inputs, and how they were resolved

The rule: where the inputs conflict, this document follows `DELIBERATION_SUMMARY.md`. Where two inputs label the same fact differently, the lower label is used.

| # | Topic | One input says | Another says | Followed here |
|---|---|---|---|---|
| A1 | Version of V1 | The brief (§2) calls the design doc v0.2 | The only local copy is v0.1 (frontmatter "Taslak v0.1"); A1 and A7 read v0.1 | v0.1, as read |
| A2 | Contract role in the delegated views | DESIGN_REVIEW §6.2 gates only the delegator and the delegate | A2, the coordinator and A7: the contract role must be gated too | Gated (D4) |
| A3 | Successor acceptance | The G1 judge: optional ("could"); DESIGN_REVIEW R3 has no acceptance step | A4 and A7: mandatory | Mandatory, as a transaction (D11); open question 3 |
| A4 | Upgrade guard | A3: a Core SHOULD, optional in the proposal, checking the storage location, with a delayed escape hatch. The coordinator: an ERC-165 check | A7: Core MUST for UUPS, both checks, no escape hatch | A7 (D7); open question 2 |
| A5 | Native ML-DSA vs `ecrecover` | DESIGN_REVIEW and the G1 report: ML-DSA-44 takes 35–82 µs and is "cheaper than" the connector's 172–178 µs `ecrecover`; A1 and A2 repeat 35–82 µs | A5 and A7 (K4): 82–85 µs cold and 84–89 µs on the KDA path, against 177–213 µs (k256) and 53–55 µs (libsecp256k1) | A5's numbers; no general "cheaper than ECDSA" claim (§7c) |
| A6 | Label of the ML-DSA-65 calldata figure | The G1 report lists 234,392 gas as measured | A5: it comes from reviewer 03's fitted formula (`15,000 + 64 × bytes`), not a measurement | Treated as [E]; not used in the body |
| A7 | Core size | ~55 lines (DESIGN_REVIEW, G1 report, A6) | ~75–90 lines per line (DELIBERATION_SUMMARY), after adding the contract gate, guard, ERC-165, typed errors and the getter | 75–90 lines [E] |
| A8 | ERC-1271 budget default | DESIGN_REVIEW R5: an execution budget defaulting to 250k (its test 1b uses ≥ 1.4M); A3: 1.6M | A5 and DELIBERATION_SUMMARY: B_exec = 2,000,000 | 2,000,000 |
| A9 | Retry bound | Brief, DESIGN_REVIEW, A1: retries "bounded by total gas" | DELIBERATION_SUMMARY: at most 2 attempts, the second at least one block later | ≤ 2 attempts (it implements the bound) |
| A10 | Profile Q notice | A1 and A5: ≥ 180 days; A3: ≥ 6 months; A2: years ahead, aligned with NIST IR 8547, with an emergency pull-forward of ≥ 14 days | A6 and DELIBERATION_SUMMARY: ≥ 24 months, plus two emergency triggers | ≥ 24 months; open question 6 |
| A11 | Declared signer | A1: registry state, no-downgrade, ERC-165 `0x39bfd16c`. A2 and A6: matured declare and clear, no-downgrade | A5 and A7: a KDA delegation, no registry state, no maturity, exclusivity deferred | KDA (D15) |
| A12 | Certificate design | A1: per-registry domain, `RetireAccount(address account)`, ERC-165 `0x8239e188`. A2, A4, A5: valid on present and future chains. A4: a PQ hash-commitment form; certificates never name a successor. A6: a `requireSuccessor` flag on by default | A7: successor required **and enforced by the registry**, explicit chain list, chain-agnostic domain, ERC-165 `0x4b9ec076` | A7 (D16). The certificate names the successor only to bind to the one already confirmed; it never designates one |
| A13 | Extension numbering and ids | A1: E1 `0x689e3376` (no acceptance function). A2 numbers the declared signer E2 and the certificate E3 | DELIBERATION_SUMMARY: E1 `0x7dc5e209` (+ `0xc61ca396`), E2 = certificate `0x4b9ec076`, E3 = KDA | DELIBERATION_SUMMARY |
| A14 | Suspended state | A2: an optional guardian extension | A1, A3–A7: none | None (D2) |
| A15 | Reason code | A4 and A5: in the event; A3: optional, outside Core | A6 and A7: none | None (D3) |
| A16 | Cross-chain union; immutable registry; registry-level sunset | A2 recommends all three as end-state parts | A7: union rejected; immutable registry and sunset deferred | Rejected / deferred (§7) |
| A17 | Raw getters | A4: gate the expiry getter, the library wrapper `FHE.getDelegatedUserDecryptionExpirationDate` and `allowedTransient` | A7: gate the ACL expiry getter; keep `allowedTransient` raw. **Resolved by the coordinator [V-CV]:** the library wrapper needs no separate change, because `FHE.getDelegatedUserDecryptionExpirationDate` (`library-solidity/lib/FHE.sol:8310-8316`) calls `Impl.getUserDecryptionDelegationExpirationDate`, which calls the ACL getter (`Impl.sol:1012-1018`). Gating the ACL getter therefore gates the wrapper | A7 (D6); open question 13 (getter semantics only) |
| A18 | Timelock delay | A1: ≥ 7 days; A2: 14–30 days | DELIBERATION_SUMMARY: 7 days for the demo and the ask, 14 RECOMMENDED for rights-widening changes | DELIBERATION_SUMMARY; open question 7 |
| A19 | The mock's signature path | A1: the signature check is "commented out"; A4: "no signature path" | A7 (K1): the commented block is a dead duplicate; the live path verifies 65-byte ECDSA only | A7. The consequence is unchanged: the mock cannot test ERC-1271, validity windows or code-first |
| A20 | Where Level 1 is tested | The brief: the ML-DSA-44 ERC-1271 account decrypts "in the mock" | A7 (K7): impossible in the mock; use the shared-crate and connector harnesses | A7 (D27) |
| A21 | Level 0 target line | The brief and DESIGN_REVIEW: the 0.4.1 backport | A3: Core should ride the next production line, plausibly 0.14.x | 0.4.1 required plus 0.5.1 optional (D25); open questions 1 and 14 |
| A22 | Versions on the 0.15 line | A3: "0.6.0/7 (0.15.x)" | A7 (K5): v0.15.0-0 still has 0.5.0/6; 0.6.0/7 appears at v0.15.0-3 (a pre-release) | A7 |
| A23 | `TaskManager` line numbers | The coordinator: `isAllowed` relay at `:972-974`, permit relay at `:1090-1093` | A7: `:973-975` and `:1091-1093` | A7 |
| A24 | Higher-category KEMs in the KMS | A2: ML-KEM-1024 and a composite with P-384 exist, but for backups (`encryption.rs`) | A3: signcryption already supports ML-KEM-1024+P-384 (`signcryption/common.rs`) | Not re-verified by the judge, and no ruling depends on it. This document states only that the user reply channel is ML-KEM-512 [V-A7] |
| A25 | Watchtower trigger on designation | A4 and A6: the watchtower retires on an unexpected designation | A7 (K9): with a confirmed successor, designation reverts; without one, E2 cannot execute | E2 triggers exclude designation; an unexpected designation prompts the owner to carry and retire directly |
| A26 | Verifier rule V6 | A1: SHOULD in Core, MUST in H; A4: MUST for every verifier | DELIBERATION_SUMMARY: SHOULD in Core, MUST in Profile H | DELIBERATION_SUMMARY |
| A27 | Grant-path code | DESIGN_REVIEW §6.2: `allow`, `allowForDecryption` and `allowTransient` stay unchanged | DELIBERATION_SUMMARY c.6: only their failure branch changes, to revert with a typed `SenderRetired` | DELIBERATION_SUMMARY |
| A28 | Successor function name | DESIGN_REVIEW: `resignSuccessor(account)` | DELIBERATION_SUMMARY: `resignSuccession(address account)` | DELIBERATION_SUMMARY |
| A29 | Census medians | DESIGN_REVIEW and the G1 report: median 12, p99 127 | `aggregate.json` also reports median 11, p99 129 | Not a conflict: 12/127 cover the 12,714 "real" end accounts; 11/129 cover all 12,720, including 6 ops and test accounts. This document uses 12/127 |

---

**The three limits, once more:**
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance.
