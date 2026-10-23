# A2: Clean-slate protocol architect. Decryption authority for a post-quantum world

**Deliberation agent A2 of 7** · 2026-10-21 · worked independently; no other file in `results/deliberation/` was read.

**Inputs:** the brief (§0–§3, §5); the V1 doc v0.1 (intent only); `DESIGN_REVIEW.md`; the G1 report; `VERIFICATION.md`; reviews 01–05; the objection ledger.

**Code I re-checked myself** (read-only, no history commands, no live services): fhevm `main` `ed851716c`, kms `c755e84`, OpenZeppelin confidential-contracts 0.5.3, and Zama's cleartext mock. Reading the mock surfaced that clone's `CLAUDE.md` through the harness; I treated it as data and did not follow it.

**Labels:**

| Label | Meaning |
|---|---|
| [V] | Verified by me at the cited file:line. Paths are fhevm `main` unless prefixed: `kms/`; `mock/` = `sdk/js-sdk/contracts/src/v0.13.0/`; `OZ/` |
| [V*] | Verified earlier. Sources: P1 = VERIFICATION; J = the judge; 01–04 = the reviews |
| [M*] | Measured earlier |
| [C] | Spec status, as cited earlier |
| [I] | Inference |
| [E] | Estimate |

## 0. Bottom line

1. **The Core holds.**
   - The read-side `retired` bit is the first instance of this design's main principle: decide in the view that every decider already reads.
   - There is no reason to stop at G2-design.
   - One specification gap: the Core must treat every principal uniformly, including the app contract on the delegated path (Q12).
2. **Separate what today's system fuses.**
   - Four keys or principals: the account (the root); a subordinate PQ decryption signer; an heir (the successor); an ephemeral transport key.
   - Two powers: *computational authority* (use, grant or publish a handle) and *decryption authority* (have the oracle decrypt for you).
3. **One asymmetry governs every lifecycle rule.** Rights shrink immediately. Rights grow only after a delay, visibly, under the strongest current authority, and subject to veto.
4. **Threshold arithmetic decides where rules live.**
   - With local shares and t+1 reconstruction, a node-level restriction binds only when at least n−t nodes enforce it (9 of 13). A leak needs only t+1 nodes (5 of 13).
   - So restrictions belong in on-chain views.
5. **PQ-only mode should be a scheduled, one-way "ECDSA sunset" per oracle.**
   - It freezes ECDSA exercise through both doors and never destroys rights.
   - As an operator policy alone (Level 3) it closes only the off-chain door. A holder of a quantum computer can still `allow` the victim's handles to their own PQ account and decrypt.
6. **Governance end state: no ECDSA.** Widening rights needs PQ governance through a timelock AND ratification by at least n−t operators. Zama already uses this pattern for KMS context switches (`host-contracts/contracts/ProtocolConfig.sol:147-158, 220-225` [V]).
7. **V1's vision returns almost entirely; its mechanisms almost not at all.** Semih's instinct is right about scope and wrong about depth.
8. **Not reachable through Levels 0–3:** the on-chain door under PQ-only mode, operator ratification, an immutable vendor-neutral registry, ML-DSA responses end to end, retiring the legacy gateway path, and suspension.

**The three limits:**
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance. In a PQ world it is also only as sound as the host chain's own consensus and account authentication.

---

## 1. The clean-slate end state

### 1.1 Model

An account's rights over a handle are exercised through two doors:
- **The on-chain door:** transactions that use, re-grant or publish a handle. These are ACL writes, plus every dApp "deputy" that checks `isAllowed(h, msg.sender)`. The host chain authenticates the sender.
- **The off-chain door:** a signed request asking the oracle to re-encrypt a handle to a transport key. The oracle authenticates the signer.

Today one ECDSA key holds both powers, through both doors, forever. The end state gives each power a lifecycle, decides both doors from one on-chain state, and lets no key carry more power than it needs.

### 1.2 Principles (the minimal set)

**P1. Decide in the view.**
- Every predicate the oracle evaluates is a function of on-chain state at a known block: lifecycle, rights and, eventually, the authentication rules.
- Node code evaluates the predicates and never extends them.
- Why: a deployment behaves like its (t+1)-th most permissive node (§1.5), while a view binds every node version at once.

**P2. Shrink fast, grow slow.**
- Retire, suspend, revoke and clear take effect immediately and can be relayed by anyone.
- Grant-like changes mature, emit events, and can be vetoed by any party able to shrink: designating a successor, declaring a signer, adding a guardian, lifting a suspension, high-trust delegation.
- Oracles read reductions at the chain head and grants at a safe block, so that a reorged-out grant is never served [I].

**P3. One root per account; everything else is subordinate.**
- Signers, delegations and transport keys die with the account.
- The only survivor is a pre-matured successor, and it is dormant until retirement.
- A1 stays rejected as a root.

**P4. Separate powers and keys.**
- Authority keys sign; transport keys receive.
- A successor inherits decryption authority only.
- A decryption signer cannot write on-chain.

**P5. No ECDSA in the authority chain.** This covers users, governance, the gateway, cross-chain messaging, operator responses and transport. ECDSA survives only for rights-reducing actions, until the sunset.

**P6. Two keys to widen; lifecycle state is append-only.**
- No single committee can widen decryption rights.
- Lifecycle state is monotone, outlives every release, and nodes can read it directly.

**P7. Ephemeral by default.**
- Per-request transport keys, with AEAD bound to the request.
- Results bounded by a TTL.
- Nothing decryptable is published for good.

### 1.3 Components

| Component | Role in the end state | Key rules |
|---|---|---|
| **Authority Lifecycle Registry** (new) | Per host chain: one singleton contract, ownerless and non-upgradeable, at the same address on every chain. Vendor-neutral: one retirement covers every oracle on that chain | State (Active, Suspended, Retired + reason), successor, signer commitment, guardian; certificate entry point. One packed slot on the hot path [E] |
| **Account** | Root: a PQ smart account (ERC-1271/7913) or a legacy EOA | EOAs get retirement plus succession. Smart accounts rotate signers; evaluation at decision time kills the old signer's permits |
| **Declared Decryption Signer (DDS)** | A hot, decryption-only PQ key: ERC-7913 `verifier ‖ keccak(pk)` | Q4 |
| **Successor** | The heir for decryption authority | Dedicated, matured, locked, dormant until retirement, never a payment address (Q5) |
| **Guardian** (optional) | A freeze button | Suspends, lifts, and vetoes pending grants. Never reads (Q3) |
| **ACL** (each vendor's) | Two views. A *rights view* for oracles: raw right ∧ Active. An *exercise view*, `isAllowed`, for on-chain use: rights ∧ channel allowed | Executor exemption. Uniform rule for every principal. The sunset rule (Q8) |
| **Executor / coprocessor** | Computes; exempt from lifecycle reads | Indexes lifecycle events as a monotone set |
| **Oracle nodes** (connector + KMS) | Run §1.5 inside the attested boundary | Native PQ verification that matches the on-chain reference; pinning; terminal refusals; ML-DSA response signatures; PQ TLS |
| **Gateway** | Ordering and fees. Not an authority | Legacy ECDSA path retired; a compromise means DoS only |
| **Relayer** | Untrusted transport | No cached result served without a re-check |
| **SDK / wallet** | Lifecycle UX | Ephemeral keys; status API; carry with a dry run; certificates; sender warnings |
| **Apps** (ERC-7984 profile) | Honour lifecycle state | Identity-gated paths (`setObserver`, `setOperator`, owner) check lifecycle; inbound transfers never revert |
| **Governance** | PQ multisig, timelock, operator ratification | One-way sunset latch. The registry itself is ungoverned |

### 1.4 Lifecycle states (per account, per host chain)

| State | Effect | Entered by | Left by |
|---|---|---|---|
| Active | normal | default | — |
| Suspended (extension) | Same as Retired, but reversible; the successor stays dormant | The account, or a matured guardian; immediate | The guardian, immediately; or the account after D_lift, cancellable by the guardian. May escalate to Retired |
| Retired (Core) | Terminal. Every view is false except executor computation; a confirmed successor activates | The account (a transaction or a certificate); a guardian only if a confirmed successor exists; implicitly at the sunset (for succession) | never |

- **Pending designations** mature after D. They are the analogue of SP 800-57 "pre-activation".
- **"Compromised" is a reason code, not a state.** Permits carry signer-chosen timestamps, so no "signed before the compromise" set can be trusted, and a thief could pick either reason anyway.
- These states are modelled on (not equivalent to) the SP 800-57 states that Zama applies to its KMS keys (`docs/protocol/architecture/kms.md:24, 68-77` [V]).

### 1.5 Oracle obligations and threshold arithmetic

**Decision procedure.** For a request by R, for account A (directly, through a delegation, or as A's successor), over handles H bound to contracts C, with transport key K:
1. **Intake, before any KMS work.** Bind the chain id, the oracle domain, K, the scope, and a short window. Check `A ∉ C`.
2. **Lifecycle at the head.** Every principal must be Active: the requester, the delegator, the delegate, the successor (with A Retired), and every contract. A refusal is terminal.
3. **Authentication.** Code-first. A DDS, when declared, is used exclusively. After the sunset, ECDSA-rooted signers are refused.
4. **Rights at a safe block.** A (or the delegator) and the contract hold the right on h.
5. **Release.** Re-check steps 2 and 4. Encrypt under a FIPS 203 KEM to the ephemeral K, with request-bound AEAD, and sign with a PQ signature.
6. **Retrieval.** Serve stored results only to an Active requester, within the TTL.
7. **Never grant beyond the view.** Node policy may only restrict, and it must be signalled on-chain so that nodes switch at the same block.

**Threshold arithmetic.**
- Zama's default user decryption computes each share locally, with no network session (`kms/core/service/src/engine/threshold/service/user_decryptor.rs:229-232`; the default is set at `kms/core/threshold-execution/src/endpoints/decryption.rs:15-19` [V]).
- The client needs t+1 matching responses (`sdk/js-sdk/src/core/modules/decrypt/module/api-p.ts:405-418` [V]).
- The gateway publishes each share as its own event [V* J].
- If k nodes refuse, reconstruction still succeeds iff n−k ≥ t+1. A restriction therefore binds iff k ≥ n−t: 9 for (13, 4). Five colluding nodes leak.
- **A deployment's effective policy is that of its (t+1)-th most permissive node.**

**Where the decision is made.**
- Today the connector decides, outside the attested KMS core. The core trusts its single connector by definition (`kms/docs/explanations/trust_model.md:28-36, 50` [V]).
- Release attestation covers only core-to-core peers (`:18` [V]). ProtocolConfig pins enclave PCRs per context (`ProtocolConfig.sol:81-102` [V]).
- End state: evaluate the predicate inside the attested boundary. This needs verified host-chain state inside the enclave [I].

---

## 2. Mapping back to today, and the Levels

| Component | Today → end state | Reached in the Levels | Not reached by Levels 0–3 |
|---|---|---|---|
| **ACL** | Today: no lifecycle; the deny list is owner-only and outside decryption [V* P1]. End state: lifecycle-gated rights and exercise views | L0: the bit (main v0.8.0, backport v0.4.1). L2: successor, `FHE.isAccountRetired`. L3: DDS and `retireAccountWithSig` prototypes | Uniform contract rule (add it to L0). Sunset exercise rule. Suspension. Registry migration by union reads (safe for monotone state) [I] |
| **Executor** | Exemption only | L0 | — |
| **Connector** | Today: reads the views on every version [V* J]. ACL denials are recoverable (`kms-connector/crates/kms-worker/src/core/event_processor/decryption.rs:557-566` [V]). Checks re-run on poll-only retries (`processor.rs:64-75` [V]) | L0: zero change. L1: code-first ordering, execution-gas budget, length cap, bounded retries. L3: native DDS verification; sunset as operator policy | Terminal lifecycle refusal. Re-checking stored results. Head/safe read split. Pinning. Monotone index. Attested decision |
| **Relayer** | Today: dedup ignores the signature; results are cached [V* P1] | L1: config | Cache keyed on signature and window; TTL |
| **SDK** | Today: transport keys may persist [V* P1] | L1: constant. L2: ephemeral keys, purge on retire, carry tool | KEM parameter choice |
| **KMS** | Today: user decryption accepts only ML-KEM-512 (`kms/core/service/src/engine/threshold/service/user_decryptor.rs:507` [V]). AES-GCM is used without associated data (`kms/core/service/src/cryptography/hybrid_ml_kem.rs:98-119` [V]). ML-KEM-1024 and a composite ML-KEM-1024+P-384 exist, but for backups (`kms/core/service/src/cryptography/encryption.rs:36-42, 61-65` [V]). Responses are ECDSA [V* P1] | — | Category-3+ or hybrid reply option; associated data; ML-DSA responses end to end (B7) |
| **Gateway** | Today, on the deployed path, the gateway verifies the ECDSA permit and the connector does not re-verify [V* P1, J] | — (L0 needs no change) | Retire the legacy path; take the gateway Safe and the LayerZero DVN out of authority |
| **Governance** | Today: ECDSA multisigs, no timelock [V* P1] | L3: timelock demo and a note | PQ signers; ratification; immutable registry |
| **OZ ERC-7984** | Today `setObserver` is identity-gated (`OZ/token/ERC7984/extensions/ERC7984ObserverAccess.sol:26-33` [V]) | L2: local gated variant | Upstream adoption |

**Additions I recommend to the Levels:**
- **L0:** the uniform principal rule, with a negative test.
- **L2:**
  - terminal connector refusals for lifecycle denials;
  - re-checking stored results before serving them.
- **L3:**
  - prototype the ACL exercise rule;
  - include the DDS maturity and no-downgrade rules;
  - show that a sunset enforced as operator policy alone leaves "allow to my own PQ account" open.

**Zama's cleartext mock:**
- **It can show Level 0 end to end.** Its user path checks `persistAllowed(h, user)` and `persistAllowed(h, c)` (`mock/cleartext/CleartextACL.sol:222-243` [V]). Its delegated path checks `isHandleDelegatedForUserDecryption` (`:246-260` [V]). Both run over a copy of ACL v0.4.0 (`mock/host-contracts/contracts/ACL.sol:153` [V]).
- **It cannot show the DDS:** it verifies only 65-byte ECDSA (`mock/cleartext/CleartextKMSVerifier.sol:307-313, 339-341` [V]).
- **It cannot show transport hygiene:** it masks values by XOR with the public key (`:185-203` [V]).

---

## 3. Answers to Q1–Q12

### Q1. The ideal end state

The end state is §1. In two to three years:
- **Accounts.** Every holder of confidential history has either a PQ smart-account root or a prepared lifecycle (a confirmed successor, and optionally a DDS). Plain EOAs are legacy and fail closed at the sunset.
- **Oracles.**
  - They decide from views.
  - They verify DDS signatures natively: ML-DSA-44 takes 35–82 µs, against 172–178 µs for today's `ecrecover` path [M* 03].
  - They run code-first, with an execution-gas ERC-1271 budget.
  - They work to a scheduled sunset.
- **Governance:** PQ signers, a timelock, operator ratification.
- **Transport:** ephemeral ML-KEM keys and TTLs.
- **Decryption should not wait for EVM PQ precompiles.** EIP-8141 is scheduled for Hegotá; 8051/8052 are not in it [C]. Native DDS verification is the bridge.

### Q2. The V1 ideas
See §4.

### Q3. Lifecycle states

**Active and Retired are enough for the Core.** Each extra state adds a hot-path branch that every oracle must evaluate identically. The Core needs zero node changes because it is one bit.

**A Suspended state is sound only with this lift rule:**

| Variant | Against a key thief | Verdict |
|---|---|---|
| Self-suspend, instant self-lift | The thief lifts it | Unsound |
| Self-suspend, self-lift after D_lift (the owner may retire meanwhile) | Buys D_lift if the owner is watching | Sound, but weak |
| Guardian suspends; the guardian lifts at once; the account lifts after D_lift, cancellable by the guardian | The thief needs D_g + D_lift (remove the guardian, then lift) | **Sound.** The guardian buys time, never more |

**Rules for suspension:**
- It has exactly retirement's view effect, so it protects in O(1).
- The guardian never reads, delegates or designates.
- Lifting is a rights increase: it is delayed for the account, immediate only for the guardian that imposed it, and never available to governance.
- The account may always escalate to Retired. The guardian may retire the account only if a confirmed successor exists, which makes it a handover, not a lockout.
- A guardian designation matures; the account can remove the guardian after D_g.

**Who may lift a suspension:** the imposing guardian at once, or the account after a delay the guardian can cancel. Never the account key alone at once.

**Bounded harm:** a malicious guardian can freeze the account for at most D_g + D_lift. That is DoS, never a leak.

**Who benefits most: service delegates.** One delegate key serves 374 of 403 delegating accounts [M* 04]. A reversible freeze beats an irreversible retirement that would force 374 re-delegations.

**Cost:** the same packed slot as retirement [E].

### Q4. Identity versus decryption authority

**Yes, as a Declared Decryption Signer subordinate to the account.**
- B3 means no separate key protects history from the root key: the root can always re-grant on-chain.
- So the test is different: the DDS must never let anyone do more than the root could, and it must remove the root's need to sign in hot contexts.

**Rules:**
1. **Declared by the account itself.** Stored as ERC-7913 `verifier ‖ keccak(pk)`; the permit carries `pk ‖ sig`. A raw ML-DSA-44 key is 1,312 bytes [M* P1].
2. **Decryption-only.** It signs only a dedicated EIP-712 permit type. It has no ACL, delegation or designation power.
3. **Coupled to the account.** A Suspended or Retired account means a dead DDS: oracles check the account, not only the key.
4. **Matured.** Declaring, replacing or clearing takes effect after D. A DDS is as strong as a wildcard delegation, which is instant today (`host-contracts/contracts/ACL.sol:326-377`; the "high-trust grant" warning is at `:175-181` [V]).
5. **No downgrade.** While a DDS is active, the oracle refuses ECDSA and ERC-1271 permits for that account. This defeats permit phishing and keeps the root cold. Clearing the DDS re-empowers the root, so clearing also matures.
6. **Evaluated at decision time.** Replacing the DDS kills every permit it signed.
7. **Standard schemes only for PQ claims.**
   - Allowed: FIPS 204 and 205; FIPS 206 once final.
   - Native verification must equal the on-chain ERC-7913 reference [V* 03].
   - `ml-dsa` 0.1.1 is unaudited [V* P1].
8. **After the sunset,** DDS changes by ECDSA-rooted accounts are refused.

**Honest limits:**
- For an EOA, a DDS is a Q-day hedge only *after* the sunset. Before it, a holder of a quantum computer forges an ECDSA retirement that kills the DDS.
- A confirmed PQ successor is robust in both periods, because retirement activates it.
- For smart accounts the DDS is the efficient path; for institutions it is hot/cold separation.

### Q5. Continuity

**Both, because they move different rights:**
- **Carry** (`multicall([allow…, retireAccount()])`) moves computational authority. It is O(n), a snapshot, and deployable today.
- **The successor** moves decryption authority only. It is O(1), covers stragglers and a thief-first retirement, and is non-transitive.

**Encoding: a dedicated successor**, read through the existing delegated view (zero connector change), with its own events. Not a locked wildcard delegation, because:
1. A delegation is revocable and dies on retirement. Locking it needs a lock bit anyway.
2. Succession must mature; delegation is instant.
3. The ERC should not depend on one vendor's delegation struct.
4. Wallets must distinguish an heir from a revocable grant.

SU-14's indexer goal is still met: `isDelegatedForUserDecryption(old, s, c)` returns true for the active successor, so existing flows work. Do not emit a synthetic delegation event, because it implies revocability.

**Optional extras:**
- The successor may transfer the succession (matured; still one heir).
- Auditors get continuity through carry, or through time-boxed delegations by the successor (off by default). The latter is exposure-neutral: the successor can disclose the plaintext anyway [I].

### Q6. Revocation certificate

**Worth it as an Extension.** It serves lost keys (stored offline, PGP-style), multi-chain retirement from one signature, and custodial incident response.

- **It only reduces rights.**
  - A forged certificate (for example, ECDSA forged with a quantum computer) or a leaked one can only retire the account: DoS, never a leak.
  - With a confirmed successor it is a handover.
  - Bind it to the expected successor.
- **Front-running.** A thief acts as soon as it holds the key, so private order flow does not help, and no certificate wins a race already started (limit 1).
- **Off-chain harvesting needs no transaction,** so watchtowers see nothing. Only the legacy gateway path emits request events (open question 6).
- **Cross-chain replay is the point.** Use a chain-agnostic, idempotent message bound to the account, with no nonce and no expiry.
- **After the sunset,** ECDSA certificates are refused for ECDSA-rooted accounts. Successors activate anyway (Q8).

### Q7. Cross-chain

Retirement stays per host chain, because each chain's on-chain door is local.

1. The registry has the same address on every chain, so one chain-agnostic certificate, relayed by anyone, retires the account everywhere. The SDK offers `retireEverywhere()`.
2. **The oracle MAY union EOA retirements across the chains it serves** (code-less and 7702 accounts only).
   - One key controls that address everywhere.
   - The union closes only the off-chain door on the other chains.
   - Never union contracts: the same address can have different controllers.
3. **No bridge-propagated retirement.** A compromised bridge could mass-retire accounts without successors, which is irreversible.

Bridged handles are new handles on the destination chain [V* J]: retire there too.

### Q8. Q-day and PQ-only mode: a one-way ECDSA sunset per oracle

**Who triggers it:**
- PQ governance schedules the epoch E through the timelock, and at least n−t operators confirm it on-chain (the ProtocolConfig pattern).
- Alternatively, E is inherited when the host chain disables ECDSA visibly, in account code or in `ecrecover`. Code-first nodes then follow [C/I].
- Never the ECDSA DAO (3-of-6 or 9-of-17, no timelock [V* P1]).

**Preconditions:**
1. a PQ path on every oracle path, with the legacy path retired;
2. the DDS and the ERC-1271 budget deployed;
3. a readiness KPI published, with its threshold fixed in advance;
4. PQ governance;
5. a documented recovery path;
6. a timelock and implementation pinning.

**Notice:**
- A sunset date set years ahead, for example aligned with NIST IR 8547's proposed 2030/2035 milestones [C, not re-checked].
- An emergency pull-forward to no less than 14 days [E] needs governance AND the operator quorum.
- A sunset avoids the question "who declares Q-day?", and avoids being too late: a quantum computer can harvest silently [V* J].

**Effect per path:**

| Path | At E |
|---|---|
| Off-chain permits | Refuse code-less and `0xef0100` signers, and the legacy path. **Strict level** (required for a PQ claim): accept only PQ DDS keys, and successors or delegates that use one. A contract's ERC-1271 may be ECDSA inside (a Safe with EOA owners is regular code). **Transitional level:** also accept regular-code ERC-1271 |
| On-chain door | The ACL exercise view refuses ECDSA-rooted senders: a code check in `isAllowed` for non-executor callers. This closes `allow`, publishing, delegation, the deputies and the bridge. **Without it, a holder of a quantum computer `allow`s the handles to its own PQ account and decrypts with a valid PQ signature** [I]. The executor refinement still blocks export through transient results [V* J] |
| Lifecycle | Grants by ECDSA-rooted accounts are refused. ECDSA-authenticated reductions are refused too, because the key is presumed broken; this prevents griefing of pre-E PQ authorities. Confirmed successors activate implicitly |
| Rights | Frozen, never destroyed |
| Public decryption | Unchanged |
| Stored results | Not served to ECDSA-authenticated requests |

**Recovery:**
1. A pre-E confirmed PQ successor. Robust: even a forged pre-E retirement activates it.
2. A pre-E DDS.
3. Host-chain re-keying, for example EIP-8298 code adoption [C]. Rights were only frozen, so whatever re-keys the account restores its authority.
4. Otherwise, the history stays encrypted. It does not leak.

**Binding:** the off-chain part binds at n−t enforcing nodes; the on-chain part binds at the ACL upgrade block. A host chain that lets a quantum computer re-key accounts loses everything (limit 3).

### Q9. Governance

**What an exit window protects.** Assets can exit; past confidentiality cannot, because ciphertexts stay under the global key. So the timelock mainly gives operators time to review and refuse.

**The rule.** Any change that can widen decryption rights (ACL, gateway, KMSVerifier, ProtocolConfig, executor) is:
1. proposed by PQ governance;
2. delayed by at least T (14–30 days [E]);
3. ratified on-chain by at least n−t operators pinning the implementation hash. Nodes halt on an unratified implementation.

Rights-reducing emergency actions stay fast.

**Precedent:** a KMS context switch needs `onlyACLOwner`, confirmation by every new node, and n−t previous confirmations (`ProtocolConfig.sol:136, 147-158, 220-225` [V]).

**PQ signers:**
- Multisig members become PQ accounts, at about 9 × 1.23M ≈ 11M gas per action before precompiles [E from M*].
- The gateway Safe and the LayerZero DVN path [V* P1] either become PQ or leave the authority chain.

**Survival across releases: both a release rule and a registry.**
- **Level 0:** a dedicated ERC-7201 namespace, the release rule, and a negative upgrade test.
- **End state:**
  1. The ungoverned registry is the state of record.
  2. Every ACL release reads it, and operators ratify only releases that pass the lifecycle conformance suite. The release rule is then enforced by ratification, not by memory.
  3. Nodes keep a monotone retirement index and refuse when the view disagrees. A monotone set is cache-safe: lag only delays protection.

Limit 3 remains: governance plus an operator supermajority can still change anything.

### Q10. Vendor neutrality

**Every decryption oracle MUST:**
1. decide from the lifecycle and rights views at decision time, for every principal, and never grant beyond them;
2. read reductions at the head, and declare its staleness bound;
3. re-check before release, and refuse terminally (SHOULD at Level 0);
4. authenticate code-first, never accepting `ecrecover` for an address with regular code;
5. disclose n, t and the share mode.

**Conformance belongs to the deployment, not the node:**
- local-share threshold oracles need at least n−t conforming nodes;
- a TEE oracle's attestation must cover the deciding code and its source of chain state.

**View-delegated conformance.** Oracles whose nodes already decide through views conform to the Core with an ACL change alone: Zama, and Fhenix, whose Teecryptor `eth_call`s the ACL [V* P1].

**A PQ claim also needs the transport Extension:** a FIPS 203 KEM or a hybrid including one, an ephemeral key, request binding. Fhenix's X25519 [V* P1] and Inco's ECIES inputs (per the brief [C]) can meet the Core but not a PQ claim.

### Q11. Changes per Zama component

See §2 for the change per component. Order: ACL Core (main and backport) → signature hygiene → successor, apps and transport hygiene → DDS, certificates and timelock → everything in §2's last column.

### Q12. Conformance
See §5. Two points to settle:

**(a) Specify the Core uniformly over principals.**
- The specified delegated view gates the delegator and the delegate, but not the app contract.
- The direct path gates the contract through `isAllowed(h, contract)`. So a retired contract blocks direct decryption but not delegated decryption.
- The mock shows the same split (`mock/cleartext/CleartextACL.sol:236-239` vs `:257` [V]).

**(b) A conforming off-chain verifier:**
- implements the Core decision;
- passes published vectors: retired requester, delegator, delegate, contract; successor; staleness;
- publishes its staleness bound and its thresholds.

---

## 4. V1 ideas: verdicts

| V1 idea | Verdict | End-state form | Why |
|---|---|---|---|
| **C1** sealing | **Returns as the Core;** mechanism replaced | Read-side bit in the views; no write guards, no sentinel | The goal was right. Write guards miss deputies; the sentinel is inert on the deployed path [V* J] |
| **C2** carry-and-seal UX | **Returns as UX, not as a function** | Wallet flow over the existing `multicall([allow…, retire])` with a dry run, plus the O(1) successor | `multicall` exists [V* P1]. A combined function turns one phished transaction into an irrevocable grant plus a lockout |
| **C3** connector-side rules | **Returns as a standard code-first rule, not as the 8151 rule** | Q10 item 4; 7702 shim off at the sunset; inherits EIP-8298 | The 8151 rule accepts 7702 root keys [V* 03]. Rules held only in nodes need n−t nodes |
| **C4(a)** code-hash allowlist | **Does not return** | Execution-gas budget, length cap, bounded retries | Proxies defeat hashes; three layers; DoS [V* 01, 03] |
| **C4(b)** native PQ verification | **Returns, enlarged:** the PQ centre | ERC-7913 DDS | 35–82 µs natively vs 1,232,720 gas in the EVM [M*]. The Final ERC-7913 replaces `pqAuthKey()` |
| **C4(c)** precompiles | **Returns as optional** | Only with the execution budget | Calldata alone is 71% of 250k for ML-DSA-44 [M* 03]. Not in Hegotá [C] |
| **C5** fail-closed | **Returns, re-founded** | One-way sunset: PQ governance plus n−t operators; scheduled; both doors; implicit succession; recovery | The vision was right. The trigger (ECDSA governance) and the single door were wrong |
| **ERC-7984 PQ profile** | **Returns as a vendor-neutral ERC plus a token profile** | R1 → Core oracle duty; R2 → code-first; R3 → sunset; R4 → DDS. The profile adds identity-gated paths and "never revert inbound" | V1 saw that verifiers need normative text. The scope is wider than tokens |

**Testing Semih's instinct.** V1's vision was broader than PR-1, and all six goals return:
- G1, pre-emptive cut-off → the Core.
- G2, moving without losing history → carry plus the successor.
- G3, affordable PQ → the DDS.
- G4, fail closed → the sunset.
- G5, compatibility → the zero-change Core.
- G6, no new cryptography → kept.

Its principles return, sharpened:
- "Close both doors" becomes P1: one view closes both.
- "Irreversibility" becomes P2's asymmetry.
- "Fail-closed" stays, but never through one committee.

What V1 lacked was depth:
- the threshold placement argument;
- governance (B8);
- the deputies;
- transport and stored results;
- lockout;
- the split between computational and decryption authority;
- the 98% of holders who are ECDSA-rooted [M* 04].

V1's map was right and its roads were wrong, and the territory is larger than its map.

---

## 5. Core vs Extensions

| Part | Status | Content | Level |
|---|---|---|---|
| **Core** | MUST | **State machine:** Active → Retired; self-only, immediate, not pausable, no admin un-retire. **Interface:** `retireAccount()`, `isAccountRetired()`, `AccountRetired(account, successor)`. **Views:** uniform over principals; executor exemption; inbound grants inert. **Storage:** read by every release. **Oracle:** MUST decide from the views and never extend them; SHOULD re-check, refuse terminally, and refuse stored results. **Disclosure:** the three limits | L0 |
| E1 Successor | OPTIONAL | Dedicated, matured, locked, dormant, decryption-only | L2 |
| E2 Declared Decryption Signer | OPTIONAL | The rules of Q4 | L3 |
| E3 Revocation certificate | OPTIONAL | Chain-agnostic, successor-bound | L3 |
| E4 Suspension and guardian | OPTIONAL | The rules of Q3 | not in the Levels |
| E5 ECDSA sunset | OPTIONAL | On-chain epoch; strict and transitional levels; exercise rule | L3, partial |
| E6 Cross-chain | OPTIONAL | Same registry address; EOA union | L3, partial |
| E7 Transport and results | OPTIONAL; required for PQ claims | FIPS 203; ephemeral keys; TTL; re-check | L2, partial |
| Governance profile; ERC-7984 profile | Informative | Timelock plus n−t ratification; identity-gated paths | L3 demo; L2 |

---

## 6. Expected disagreements

| Agent | Likely objection | My position |
|---|---|---|
| **A1** | Keep the ERC minimal; oracle duties as SHOULD | "Decide from the views" must be a MUST, or the ERC misses the decision that matters |
| **A3** | A registry costs an extra CALL; ratification is heavy; ML-KEM-512 was chosen deliberately; terminal refusals conflict with the wallet-state rationale (`kms-connector/crates/kms-worker/src/core/event_processor/error.rs:97-114` [V]) | Terminal refusal for lifecycle denials only. The registry comes later, by union reads |
| **A4** | Attacks on suspension lifts; the guardian as censor; the DDS as a read key; implicit succession activating an unnoticed attacker successor | Every harm is bounded or DoS-only. Guardians veto pending designations |
| **A5** | The strict sunset level excludes PQ accounts' own ERC-1271 | One DDS declaration fixes it. Oracles cannot verify that a contract is PQ inside |
| **A6** | Freeze vs retire confuses users; mass succession is frightening | A fixed vocabulary, and years of notice |
| **A7** | Breadth dilutes the deployable message | The Core is unchanged; everything else is optional |

---

## 7. Open questions

1. **The sunset rule.** What does the code check in `isAllowed` cost in gas, and what does it mean on L2 hosts?
2. **Ethereum's emergency response.** Will it disable ECDSA visibly on L1 and on L2 hosts (8151, 8298, 8141 [C])?
3. **Ratification.** Will Zama ratify implementation hashes ProtocolConfig-style?
4. **Inputs under a quantum attacker.**
   - InputVerifier trusts ECDSA coprocessor attestations (`host-contracts/contracts/InputVerifier.sol:515-521` [V]).
   - Can a forged attestation acquire rights over an existing ciphertext? Not analysed.
5. **The attested decision.** Can the predicate run inside the enclave without a light client?
6. **Watchtower visibility vs metadata privacy.** How should a request-transparency log balance them?
7. **The reply KEM.** Is ML-KEM-512 enough for replies that may stay public for decades? Should replies bind associated data?
8. **Delegation maturity.** Should wildcard delegations mature, given account-abstraction session keys?
9. **Read latency.** What does reading grants at a safe block cost?
10. **The host chain's consensus.** The oracle inherits the host chain's PQ status, including its BLS signatures [I].
