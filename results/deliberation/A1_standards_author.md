# A1: Standards author / ERC editor

**Deliberation agent A1 of 7**, 2026-10-21. I worked independently and did not open other agents' files.

- **Read:**
  - the brief (§0–§5);
  - V1 v0.1 (v0.2 is not available locally);
  - DESIGN_REVIEW and the G1 report;
  - VERIFICATION, reviews 01–05 and the objection ledger.
- **Code (read-only):**
  - fhevm `main` ed851716c, and `v0.13.8` through `git show`;
  - kms c755e84f;
  - OZ confidential-contracts 0.5.3 and contracts 5.6.1;
  - Zama's cleartext mock;
  - Fhenix cofhe-contracts b5c20ed.
- **Specs** (eips.ethereum.org, 2026-10-21): EIP-1, ERC-7913, ERC-7984.
- **Hygiene:** `cast` was used only to hash selectors. No builds, transactions or live services.

**Labels:**
- **[V]** I verified it at file:line. Paths are fhevm `main` unless prefixed:
  - `v0.13.8:` is the deployed tag;
  - `mock/` = `sdk/js-sdk/contracts/`;
  - `OZ/` = contracts 5.6.1;
  - `Fhenix/` = `contracts/internal/host-chain/contracts/`.
- **[V-prior]** verified in Phase 1 or 2; the source is cited.
- **[C]** cited from a spec.
- **[I]** inference.
- **[E]** estimate.

> **Thesis.** In oracle-based confidential execution, the confidentiality of past data is decided again at every decryption request. This ERC offers **revocable access**: an account can **retire** its authority to ask, and every conforming oracle then refuses requests that rest on it.
>
> **Limits, always stated:**
> 1. pre-emptive, not a clawback;
> 2. oracle access only;
> 3. as final as the chain's governance.

---

## 1. Key recommendations

1. **Standardize a placement rule, not Zama's ACL.** Lifecycle state MUST be enforced inside the authorization views the oracle already consults.
   - **Why.** A *granting* rule works once t+1 nodes adopt it. A *restricting* rule protects only once n−t nodes enforce it.
   - Zama's SDK accepts t+1 = 5 of 13 responses [V `sdk/js-sdk/src/core/modules/decrypt/module/api-p.ts:404-418`], so a node-side restriction needs 9 operators.
   - A restriction placed in a view binds every verifier in the upgrade block.
   - **Consequence:** Core holds only rules that live in views. Anything that needs verifier code is an optional profile.
2. **Core is small and deployable today:** two functions, one event, two errors, the view rules and ERC-165. The gated views are already what these components read:
   - the v0.13.8 connector [V `v0.13.8:kms-connector/crates/kms-worker/src/core/event_processor/decryption.rs:201, 229-230`];
   - the main connector [V `decryption.rs:244, 449, 459, 496, 553-554`];
   - the SDK prechecks [V `sdk/js-sdk/src/core/host-contracts/checkPersistAllowed.ts:79`, `checkDelegation.ts:100`];
   - Zama's cleartext mock [V `mock/src/v0.13.0/cleartext/CleartextACL.sol:236-241, 257`].

   Fhenix's permit view routes through `isAllowed(handle, issuer)` [V `Fhenix/ACL.sol:616-617`].
3. **Name view *roles*, not functions.** A registry that gated only `isAllowed` would pass the connector test but fail Zama's own mock, which decrypts through `persistAllowed` [V `CleartextACL.sol:236`].
4. **What to standardize:**
   - **Three extensions:**
     - Successor: dedicated, matured, locked;
     - Retirement Certificate: per-chain EIP-712, cannot be cancelled;
     - Declared Decryption Signer: ERC-7913, subordinate, no downgrade.
   - **Two verifier profiles:** Hygiene and PQ-only.
   - **One application profile.** It replaces V1's ERC-7984 PQ profile.
   - **Not standardized:** an on-chain PQ-only flag, and cross-chain propagation.
5. **Conformance per class:** registry, verifier, oracle (the n−t rule), application and client. Each claim is backed by an Implementation Conformance Statement (ICS).
6. **Title and requires.** "Decryption Authority Lifecycle"; requires 165, 712, 1271, 7913. ERC-7984 defines no decryption rights [C], so it is an example, not a dependency.

### 1.1 ERC skeleton

```
---
eip: TBD
title: Decryption Authority Lifecycle
description: One-way retirement of an account's authority to have an oracle decrypt confidential data, enforced in authorization views
author: Semih Civelek (@Himess)
discussions-to: TBD (Ethereum Magicians thread)
status: Draft
type: Standards Track
category: ERC
created: 2026-10-21
requires: 165, 712, 1271, 7913
---
```

The title is 30 characters and the description 121, within EIP-1's limits of 44 and 140 [C].

**Sections**, in EIP-1 order. RFC 2119/8174 keywords appear only inside Specification [C].
1. **Abstract.**
2. **Motivation.** Dated, sourced measurements only, with Zama as the example:
   - the E3 one-transaction re-grant on Sepolia;
   - the census (98% of holders ECDSA-rooted);
   - the wildcard delegation;
   - 5 of 13.
3. **Specification:**
   - §1 Terminology
   - §2 States
   - §3 Core registry
   - §4 Verifiers and oracles
   - §5 Extensions
   - §6 Profiles
   - §7 Conformance and ICS
4. **Rationale.**
5. **Backwards Compatibility.**
6. **Test Cases.**
7. **Reference Implementation.** It goes in `assets/erc-XXXX/` before submission, because EIP-1 discourages external links.
8. **Security Considerations.**
9. **Copyright** (CC0).

**§1 Terminology** (abridged)

| Term | Meaning |
|---|---|
| Registry | The host-chain contract whose views decide use and decryption rights over handles (Zama and Fhenix `ACL`) |
| Oracle, node | The off-chain system that releases plaintext or re-encrypted plaintext. A node is one release unit; t+1 outputs reconstruct |
| Verifier | A component whose decision gates release: connector, gateway contract, TEE dispatcher. Prechecks are *advisory* |
| Subject | Every account a request rests on: requester; delegator and delegate; permit issuer and recipient |
| View roles | **Use** U(h,a), **on-behalf** D(a,d,c,h), **permit** P(permit,h), **public** G(h) |
| Grant path | Extends rights over a handle to another account, makes it public, or creates a delegation or permit |
| Deputy | A contract that acts for a caller after checking U(h, caller) |
| Identity-gated grant | An app grant authorised by `msg.sender == account` |
| Engine | The fixed computation contract that checks operands through U |
| Decision time | The block at which a verifier evaluates views |

**§2 States**
- **Core:** Active → Retired, one-way.
- **Successor (E1)** adds a designation: None, Pending or Confirmed. Retirement freezes it except for the successor resigning.
- **No Suspended state** (Q3).

**§3 Core registry**

```solidity
// ERC-165 id 0x556d2088
interface IDecryptionAuthorityLifecycle {
    event AccountRetired(address indexed account, address indexed successor);
    error AccountAlreadyRetired(address account);
    error SenderRetired(address sender);
    function retireAccount() external;                                        // 0xe7142996
    function isAccountRetired(address account) external view returns (bool);  // 0xb279091e
}
```

I computed the selectors and ids [V `cast sig`]. None clashes with the 39 public selectors I hashed for the main and v0.13.8 ACLs, own and inherited.

- **R1. Retire.** `retireAccount()` marks `msg.sender` retired and emits `AccountRetired(msg.sender, s)`, where `s` is the confirmed successor or 0. It reverts `AccountAlreadyRetired` if already retired.
- **R2. One-way.** No function, privileged or not, MAY clear it.
- **R3. Unconditional.** Never gated by a pause, the deny list, a role, a fee or holdings. It works for contracts and for empty accounts.
- **R4. Grants nothing.** Retirement creates or extends no right.
- **R5. Immediate.** Effective for every view from its block.
- **R6. Use views.** Every use view MUST return false for a retired subject, except as R10 allows.
- **R7. On-behalf and permit views.**
  - On-behalf views return false if the delegator or the delegate is retired (E1 amends the delegator case).
  - Permit views return false if the issuer or the recipient is retired.
- **R8. Grant paths.** Every grant path reverts for a retired caller, including transient grants outside the engine and batches.
- **R9. Inbound grants.** A grant MUST NOT revert because its recipient is retired; R6 and R7 make it inert.
- **R10. Engine exemption.**
  - The operand-check view MAY skip the retirement check only when `msg.sender` is the fixed engine address.
  - It is allowed only if every export path evaluates a non-exempt view.
  - No other caller is exempt.
- **R11. Public view.** Unchanged; retirement never un-publishes.
- **R12. Upgrades.** An upgrade MUST preserve the state and its enforcement. The state SHOULD live in a dedicated ERC-7201 namespace.
- **R13. ERC-165** for Core and for every implemented extension.
- **R14. Batching.** The registry SHOULD offer caller-preserving batching, so that grants followed by `retireAccount()` are atomic.

**§4 Verifiers and oracles (Core)**
- **V1. Release rule.**
  - No release, no forwarding for release and no share unless the applicable view returned true at decision time, for every subject, on the registry of the handle's host chain.
  - Errors, reverts and timeouts never release.
- **V2. Freshness.**
  - Views are evaluated after the request arrives, at a block within the documented lag.
  - No positive answer is reused for another request.
- **V3. No exemption spoofing.**
  - Views MUST NOT be evaluated with the engine as `eth_call` `from`.
  - Zama's ACL reads set no `from` [V `kms-connector/crates/kms-worker/src/core/event_processor/rpc.rs:24-56`].
- **V4. No bypass.** No signature scheme or path bypasses V1: EOA, ERC-1271, declared signer or the legacy gateway path.
- **V5. Replicas.** Verifiers that authorise from replicas apply lifecycle events, or do not authorise.
- **V6. Stored results.** The verifier SHOULD re-apply V1 before serving a stored result; otherwise the ICS says results stay retrievable, as on Zama's HTTP path [V `kms-connector/docs/architecture.md:91-94`].
- **O1. Oracle conformance.**
  - A threshold oracle conforms if and only if at least n−t nodes run conforming verifiers.
  - A TEE oracle conforms if and only if its node does.
- **O2.** The oracle publishes an ICS.

**§5 Extensions (OPTIONAL)**

*E1, Successor*

```solidity
// ERC-165 id 0x689e3376
interface IDecryptionAuthoritySuccession {
    event SuccessorDesignated(address indexed account, address indexed successor, uint64 confirmableAt);
    event SuccessorDesignationCancelled(address indexed account, address indexed successor);
    event SuccessorConfirmed(address indexed account, address indexed successor);
    event SuccessionResigned(address indexed account, address indexed successor);
    function successorDelay() external view returns (uint64);
    function designateSuccessor(address successor) external;
    function cancelSuccessorDesignation() external;      // pending only
    function confirmSuccessor() external;
    function resignSuccession(address account) external; // successor only
    function successorOf(address account) external view returns (address);
    function pendingSuccessorOf(address account) external view returns (address successor, uint64 confirmableAt);
}
```

- **S1. Designate.**
  - Reverts if the caller is retired, if `s ∈ {0, caller}`, if `s` is retired, or if a confirmed successor exists.
  - It replaces a pending designation and starts the clock again.
- **S2. Confirm.** By the account only, once D has passed, while not retired. Confirmation locks the designation.
- **S3. Locked.** The old key cannot replace or cancel a confirmed successor. Only the successor clears it, by resigning, at any time.
- **S4. Read right after retirement.**
  - On-behalf views for (account, successor, c, h) return exactly what an active wildcard delegation would.
  - Every other delegate gets false.
  - Before retirement the successor has no right.
- **S5. Decrypt-as only.** The successor never passes the account's use views: no grant, no publication, no compute. No transitivity.
- **S6. Frozen after retirement:** no designation, cancellation or confirmation.
- **S7. The delay D** is fixed per registry; RECOMMENDED 7 days.
- **S8. Clients** MUST NOT use `successorOf` as a payment destination, and MUST surface pending designations.

*E2, Retirement Certificate* (the brief's "revocation certificate")

```solidity
// ERC-165 id 0x8239e188. EIP-712 domain {name:"DecryptionAuthorityLifecycle", version:"1", chainId, verifyingContract}
// RetireAccount(address account)   typehash 0x184afe02…1cbea4
interface IDecryptionAuthorityRetirementCertificate {
    function retireAccountWithSig(address account, bytes calldata signature) external;
}
```

- **C1. Anyone may submit.** The effects are those of R1–R5.
- **C2. Code-first verification** [V `OZ/utils/cryptography/SignatureChecker.sol:32-33`]:
  - no code: ECDSA, 65 bytes, low-s;
  - otherwise: ERC-1271.
- **C3. One registry only.** The domain binds `chainId` and `verifyingContract`, so a certificate is valid on one registry on one chain.
- **C4. No nonce, expiry or cancellation.** A cancellable certificate can be cancelled by the thief.
- **C5.** A certificate never designates or confirms a successor.
- **C6.** Not pausable.

*E3, Declared Decryption Signer*

```solidity
// ERC-165 id 0x39bfd16c. `signer` is an ERC-7913 signer: verifier (20 bytes) || key
interface IDecryptionSignerDeclaration {
    event DecryptionSignerDeclared(address indexed account, bytes signer, uint64 expiry);
    event DecryptionSignerRevoked(address indexed account);
    function declareDecryptionSigner(bytes calldata signer, uint64 expiry) external;
    function revokeDecryptionSigner() external;
    function decryptionSignerOf(address account) external view returns (bytes memory signer, uint64 expiry);
}
```

- **D1. Account only.** Only `msg.sender` declares or revokes. Declaring reverts if the account is retired.
- **D2.** `decryptionSignerOf` returns empty for a retired account or after expiry.
- **D3. No downgrade.**
  - If a signer is declared and unexpired at decision time, an implementing verifier verifies the permit digest against it per ERC-7913.
  - It then accepts nothing else for that subject.
- **D4. Native verification** MAY replace `verify` only if its results equal the verifier contract's. The scheme is identified by code hash in a published set: FIPS 204/205 first, FN-DSA once FIPS 206 is final.
- **D5.** R6 and R7 are applied first.
- **D6. Decryption only.** It never authorises on-chain operations.
- **D7. Partial adoption.** D3 is a restriction, so the oracle-wide guarantee needs at least n−t implementing nodes. The ICS says how many do.

**§6 Profiles (OPTIONAL)**
- **H, Hygiene:**
  - code-first ordering, with a `0xef0100` shim that falls back only on empty return data;
  - an ERC-1271 budget counted in execution gas plus the intrinsic calldata cost, with a signature-length cap;
  - retries bounded by total gas;
  - code read at the same block as the 1271 call;
  - a terminal denial when the subject is retired;
  - V6 becomes a MUST.
- **Q, PQ-only:**
  - refuse code-less subjects, and subjects whose code is exactly 23 bytes beginning `0xef0100`;
  - refuse any path that verifies authority only by ECDSA;
  - variants (the ICS states which):
    - *strict* accepts only declared signers with PQ verifiers;
    - *no-root-ECDSA* also accepts regular-code ERC-1271 accounts;
  - PQ or hybrid reply KEM;
  - public notice (Q8);
  - takes effect only once at least n−t nodes have engaged.
- **A, Applications:**
  - identity-gated grant paths revert for a retired `account`;
  - never assume `isAllowed(h, recipient)` after granting;
  - MAY refuse transfers to retired accounts; SHOULD NOT block transfers out of them.

**§7 Conformance and ICS**
- **Core claims:**
  - a registry with R1–R14;
  - a verifier with V1–V5, plus V6 documented;
  - an oracle with O1–O2.
- **Extensions and profiles** are separate claims, made by ERC-165 id or in the ICS.
- **The ICS lists:**
  - chain id and registry;
  - interface ids;
  - upgrade authority and timelock;
  - the engine address;
  - D;
  - n and t;
  - the profiles each node runs;
  - the decision lag;
  - the stored-result policy;
  - the reply KEM and transport-key policy;
  - the 1271 budget and signature cap.

**Test Cases:**

| ID | Case |
|---|---|
| TC1–2 | Retire emits the event; retiring twice reverts. Retiring works while paused and while deny-listed |
| TC3 | Differential: never-retired accounts behave identically |
| TC4–5 | Every use view is false for a retired subject, including the mock's decryption. On-behalf views (per-contract and wildcard) are false for a retired delegator or delegate |
| TC6–7 | Grant paths and deputies revert: `fromExternal(h,"")`, ERC-7984 disclose and handle transfers, bridge `send`. Transfers to and from a retired account succeed; inbound handles are inert |
| TC8 | The engine computes for a retired 7702 account; nothing can be exported |
| TC9–10 | Grants followed by retirement are atomic; the reverse order reverts. Upgrades preserve the state; a release without Core is the negative case |
| TC11–12 | An unmodified verifier refuses a retired requester, delegator or delegate on every path. With views that revert when called by the engine, it still refuses |
| TC13 | E1: no right before confirmation; straggler read; locked; no transitivity. Asserted residual: an unnoticed attacker designation survives |
| TC14 | E2: wrong chain or registry rejected; ERC-1271; works while paused; reuse reverts |
| TC15 | E3: no downgrade; rotation kills permits of the old signer; native and on-chain verification agree on ACVP vectors plus mutations |
| TC16–17 | H and Q cut-offs; fewer than n−t enforcing nodes do not stop reconstruction. Retiring on chain A leaves chain B unaffected |

**Two caveats on Zama's mock:**
- **It tests the registry only.** Its user-decryption signature check is commented out [V `CleartextACL.sol:329-401`], so it cannot test verifier conformance.
- **Its vendored ACL v0.4.0 differs from the tag.** The delegation-expiry comparison is `>=` in the mock [V `mock/src/v0.13.0/host-contracts/contracts/ACL.sol:600`] and `>` at the tag [V `v0.13.8:host-contracts/contracts/ACL.sol:601`]. Tests must not pin the exact expiry second.

**Security Considerations:**
- **The three limits.**
- **Residuals:**
  - the post-compromise race;
  - public handles;
  - identity-gated apps;
  - governance or gateway compromise;
  - stored results and reusable transport keys;
  - coverage on each chain;
  - an unnoticed successor designation;
  - partial adoption of PQ-only, and the on-chain door;
  - certificate griefing, and certificate forgery under T2 (denial of service only);
  - a contract that retires itself disables every handle it governs;
  - the verifier's RPC as a trust root;
  - reorgs before finality.

---

## 2. Answers to Q1–Q12

**Q1. Ideal end state.** No ECDSA link remains between a user's request and the oracle's release. Retirement is the backstop for accounts that never make that journey.

| Component | Target |
|---|---|
| Accounts | PQ-capable smart accounts (ERC-1271, or code adopted through EIP-8298). EOAs are legacy and retire |
| Decryption authority | The account's own validation, checked code-first, or a declared ERC-7913 PQ signer verified natively (ML-DSA-44: 35–82 µs, measured in 03 §3.1) |
| Registry | Core + E1 + E2 + E3, namespaced, ERC-165 |
| Verifiers | Core + H + E3. Q engages when the host chain deactivates ECDSA, or on a schedule |
| Oracle | n−t published. KMS response signatures in ML-DSA (Zama's roadmap, B7) |
| Reply channel | ML-KEM or hybrid; a transport key per request; a TTL on stored results |
| Clients | Status per chain; certificates and watchtowers; successor UX |
| Apps | Profile A |
| Governance | Timelock with an exit window; PQ-signed upgrade authority; operators pin implementations |

**Q2. The V1 ideas.** The verdicts are in §3.
- **Semih's instinct is partly right.** V1's *document architecture* is this ERC: §7.2 already paired an interface with normative verifier rules R1–R4 and an optional PQ extension.
  - All 6 of V1's goals return.
  - All 4 verifier rules return, re-founded.
  - None of its 5 mechanisms survives as specified.
- **Where the review is broader than V1:**
  - lockout and the successor;
  - the delegate role;
  - deputies;
  - governance;
  - stored results;
  - multiple chains;
  - identity-gated roles.
- **Synthesis:** V1's vision with v2's mechanism. V1 was broader than PR-1, but not broader than v2 plus its roadmap.

**Q3. Lifecycle states.** Active and Retired are enough, plus E1's designation states.

Zama applies NIST SP 800-57 to its KMS keys [V `docs/protocol/architecture/kms.md:24, 68-77`]. There, Suspended, Deactivated and Compromised all still allow *decryption*. For an authority whose only function is to ask for decryption, Deactivated and Compromised both mean *refuse*, which is Retired.

**A guardian-lifted suspend is unsound in the registry:**
- If the key can lift it, a thief lifts it.
- If a guardian can lift it, the guardian becomes a new censor of that user.

Suspension belongs to the account layer. A smart account can refuse ERC-1271 while suspended, and verifiers already honour that answer.

**Q4. Identity versus decryption authority.** Yes, as E3. It is safe given B3 because it is:
- subordinate and dies on retirement (D1, D2, D5);
- decryption-only (D6);
- never a downgrade (D3);
- verified natively only with results identical to the on-chain verifier (D4).

**What it buys:**
- PQ authority at microsecond cost;
- least privilege (hot decryption key, cold transaction key);
- instant rotation: the old signer's permits die, a better answer to B2 than timestamps.

**What it does not do:**
- It never protects against compromise of the transaction key, which can declare a new signer.
- For EOAs it hedges Q-day only if L1 freezes ECDSA transactions.
- A1 is rejected as a root and accepted as a subordinate.

**Q5. Continuity.** Both, with a dedicated successor.
- **Carry** suits institutions that must re-grant to auditors; a successor has no transitivity (SU-9).
- **The successor** gives O(1) continuity, covers stragglers, and insures against lockout.
- **I reject SU-14's locked wildcard delegation as the *standard* encoding:**
  - existing indexers would read its events as revocable;
  - delegations carry expiry and per-block limits;
  - Core kills delegations at retirement, so a surviving delegation is a hidden special case;
  - registries without delegation cannot port it.
- An implementation MAY still serve S4 through its on-behalf view, which is Zama's PR-2 path.

**Q6. Revocation certificate.** Worth standardizing as E2.
- **Front-running** cannot be prevented: exfiltration is O(1), and grants already made are not recalled.
- **Private order flow** hides the retirement transaction, but cannot stop forged permits that need no transaction, or decryptions already done.
- **Griefing** can only retire, which grants nothing; with E1 the cost is a forced migration.
- **Quantum forgery of ECDSA certificates** is denial of service only. Without an L1 freeze it adds nothing beyond sending `retireAccount()` directly.
- **Its real value is C5's protective intent, made opt-in for each user:**
  1. Users with a matured PQ successor give certificates to watchtowers.
  2. On a Q-day signal, the watchtowers batch-retire them.

  A CRQC needing minutes per key [V-prior 04 §4] would likely lose that race for most opted-in users [I], unless it is used in secret (limit 1).

**Q7. Cross-chain.**
- **Scope:** per registry, per chain.
- **No replay:** permits are bound to a chain [V-prior 02 B-1].
- **Certificates** are per chain (C3); one offline session signs them all.
- **No messaging-based propagation.** It would add a bridge's ECDSA governance and gain nothing over certificates.
- **Bridged handles** must be retired on the destination [V-prior 05 §1.1].
- **Clients** show status per chain.

**Q8. Q-day and PQ-only mode.** There are three levers, none of them global:
1. **Retirement by each user or a watchtower** (E2).
2. **Profile Q at operators** (at least n−t nodes).
   - **Preconditions:**
     - a deployed PQ path (H plus E3);
     - a published readiness KPI;
     - a recovery path: a confirmed PQ successor, or L1's EOA recovery, which code-first verifiers inherit.
   - **Notice:**
     - at least 180 days when scheduled [E: a policy choice];
     - immediate only when the host chain itself deactivates ECDSA. *The oracle follows L1; it never leads.*
3. **L1 freezes**, which code-first verifiers inherit.

**Effect per path** (Q strict):

| Path | Effect |
|---|---|
| EOA or 7702 requester; legacy ECDSA gateway path | refused |
| ERC-1271 account | refused (strict); accepted (no-root-ECDSA) |
| Declared PQ signer | accepted |
| Delegate; successor | each must qualify itself |
| Public decryption | unchanged |
| On-chain grants through ECDSA transactions | **open until L1 freezes them** |

**Q9. Governance.**
- **Release rule:** R12 (MUST), tested by TC10.
- **Timelock with an exit window:** SHOULD, at least 7 days [E], requested now as a separate track.
- **Operator pinning:** SHOULD. It is a restriction, so it is effective only at n−t.
- **PQ-signed upgrade authority** is required before any T2 durability claim in the ICS.
- **Immutable registry:** MAY. It protects only the bit; governance can still change the views.

**Q10. Vendor neutrality.** What any oracle must do:
- release is a function of on-chain views at decision time, for every subject (V1, V2);
- every view role is gated (R6, R7), including the permit recipient;
- the n−t rule (O1); for a TEE, its RPC is a declared trust root;
- replicas apply lifecycle events (V5);
- an ICS.

**Reply channels:**
- Core is neutral: authority is orthogonal to transport.
- Profile Q requires PQ or hybrid replies.
- X25519 and ECIES systems can conform to Core, but cannot claim Q.

| | Zama | Fhenix | Inco |
|---|---|---|---|
| Use view | `isAllowed`, `persistAllowed` [V] | `isAllowed`, `persistAllowed` [V `Fhenix/ACL.sol:447, 467`] | not examined |
| On-behalf view | `isHandleDelegatedForUserDecryption`, `isDelegatedForUserDecryption` [V] | `allowedOnBehalf` [V `:403-413`] | not examined |
| Permit view | — | `isAllowedWithPermission`: the issuer is gated through `isAllowed`; the recipient must be added [V `:616-617`] | not examined |
| Reply channel | ML-KEM-512 [V-prior N6] | X25519 [V-prior N4] | ECIES inputs, per the brief [unverified] |

**Q11. Zama components.**

| Component | L0 | L1 | L2 | L3 |
|---|---|---|---|---|
| ACL | Core + ERC-165, namespace, main and backport | — | E1 | E2; E3 storage |
| Executor | none (the exemption lives in the ACL) | — | — | — |
| Connector | none | H | none | E3 native; Q; pinning |
| Relayer | none | budget config | — | — |
| SDK | status helper | budget, code-first precheck | carry tool, successor UX, transport-key purge | certificate and E3 permits |
| KMS | — | — | — | PQ response signatures |
| Gateway | — | — | — | retire, or refuse, the ECDSA-only path |
| Governance | release rule; timelock requested now | — | — | PQ governance |
| OZ ERC-7984 | — | — | profile A (`setObserver`, `setOperator`) | — |

**Why this order:**
- L0 is the only restriction that binds every verifier at once.
- L1 changes verifier code (n−t).
- E3 waits for an audit of `ml-dsa`.

**Q12. Conformance.**
- **Core (MUST):** R1–R14, V1–V5 (with V6 documented) and O1–O2.
- **Everything else is OPTIONAL** and claimed separately.
- **"Conforming" for an off-chain verifier** means its release decisions satisfy V1–V5 against a conforming registry. Black-box tests TC11–TC12 show it, together with a configuration audit for V3 and V5.
- **Zama's existing connectors** are expected to conform unchanged [I; Level 0 must show it].

---

## 3. V1-idea verdicts

| V1 idea | Verdict | Returns as | Why |
|---|---|---|---|
| Thesis: "who the oracle says yes to" | **Returns, sharpened** | Motivation, plus the placement rule | It is the ERC's founding principle |
| Goals G1–G6 | **All return** | Targets for each level | The goals were right |
| "Close both doors" | **Returns, better achieved** | R6–R8 | One read-side bit closes both doors; V1 locked the wrong side of each |
| Irreversibility; fail-closed | **Return** | R2; V1 | Qualified by limit 3 |
| **C1** sealing (`notSealed` + sentinel) | **Mechanism dropped; goal is Core** | `retireAccount` with view gating | Inert on the deployed path; bypassed by deputies on main [V-prior 05 §1.1] |
| **C2** carry-and-seal UX | **UX returns; functions do not** | R14 batching, E1, client carry tool | `multicall` exists; carry is a snapshot; one phished "migrate" call would grant and lock out at once |
| **C3** connector-side rules | **Concept returns as H; the rule is dropped** | Code-first in H | The EIP-8151 rule still accepts 7702 root keys [V-prior 03 C3-1]; node rules need n−t |
| **C4(a)** code-hash allowlist | **Does not return** | The budget in H | Proxies and modules defeat it; three layers; amplifies DoS |
| **C4(b)** scheme-hinted native verification | **Returns** | E3 (ERC-7913) | A Final standard; subordinate; no downgrade |
| **C4(c)** precompiles | **Not an ERC concern** | Note: the budget must exclude calldata | Calldata alone is 71% of 250k for ML-DSA-44 [V-prior 03 §3.2] |
| **C5** fail-closed flag | **Flag dropped; intent returns three ways** | V1; Q at n−t; per-user E2 with watchtowers | Today it is an outage for about 98% of holders, and its ECDSA flipper is the first T2 target |
| ERC-7984 PQ profile | **Returns at the right layer** | This ERC plus profile A | ERC-7984 defines no decryption rights [C] |
| §7.2 rules R1–R4 | **All return** | R1 → V1; R2 → H; R3 → Q; R4 → E3 | The same rules, re-founded |
| A1 parallel identity | **As root: no. As subordinate: yes** | E3 | B3 holds against a root |
| §7.1 user flow | **Corrected** | Client guidance | Export → exit apps → carry → retire on every chain |

---

## 4. Core versus Extensions

| Item | Class | Status | Deployable on v0.13.x? | Verifier change? |
|---|---|---|---|---|
| R1–R14 | Registry | **Core, MUST** | yes (backport, namespace) | no |
| V1–V5 (+V6 documented) | Verifier | **Core, MUST** | yes; expected to hold already [I] | no |
| O1–O2 | Oracle | **Core, MUST** | yes | no |
| E1 Successor | Registry and client | OPTIONAL (SHOULD for institutions) | yes; on P1d the successor must be an ECDSA EOA [V-prior] | no |
| E2 Certificate | Registry and client | OPTIONAL | yes | no |
| E3 Declared Signer | Registry and verifier | OPTIONAL | main only | yes |
| H, Q | Verifier and oracle | OPTIONAL | main unified paths | yes |
| A | Applications | OPTIONAL | yes | no |

**Not standardized:**
- an on-chain PQ-only flag;
- cross-chain propagation;
- Suspended;
- a carry function;
- retirement through the deny list.

---

## 5. Expected disagreements and my responses

1. **"ERC-165 bloats PR-1"** (Zama engineer). It is about 10 lines, and wallets need detection across vendors. If it is deferred, the bit ships first and the Core claim comes later.
2. **"Put the successor in Core"** (product). No.
   - Core must be the minimal restriction.
   - An instant successor gives a thief a capture plus a lockout.
   - E1 is a SHOULD for registries that serve institutions.
3. **"Code-first and no-downgrade belong in Core"** (AA/PQ). No. They change verifier code, so they need n−t. Core must hold on the day the registry is upgraded.
4. **"A dedicated immutable registry"** (clean-slate). Any storage is allowed, provided the views consult it in the same call. Immutability protects the bit, not the views.
5. **"The engine exemption is a hole"** (red team). R10 limits it to the fixed address and requires every export path to evaluate a non-exempt view. V3 closes the `eth_call` spoof. TC8 and TC12 test both.
6. **"Certificates must be cancellable"** (custody). A cancellable certificate is cancellable by the thief. A misused one costs a forced migration to the successor, never data.
7. **"Standardize an on-chain Q-day latch"** (red team, product). Its trigger is either governance, which is unsafe, or operators, who must opt in anyway. It stays research.
8. **"Make V6 a MUST"** (red team). That breaks the zero-change Core. V6 is a MUST in H, and results already released fall under limit 2.

---

## 6. Open questions

1. **Second retirement:** revert (as here), or idempotent so that watchtower batches never revert?
2. **The delay D:** a normative minimum (for example 1 day), or only a recommendation?
3. **Certificates in v1:** one per chain only, or an explicit list of chains so one signature can retire everywhere?
4. **Placement of E3:** inside the registry, or in an immutable contract (SU-7)?
5. **Profile Q:** require PQ reply channels, or only forbid PQ claims without them?
6. **Inco:** its authorization path was not examined. A code read is needed before claiming a fit with three vendors.
7. **Names:** "Decryption Authority Lifecycle" or "Retirable Decryption Authority"; "Retirement" or "Revocation" Certificate?
8. **A machine-readable ICS** (a JSON schema in `assets/`) so that wallets can check oracle claims?
