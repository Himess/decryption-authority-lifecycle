# A4: red team on the Decryption Authority Lifecycle (target architecture, Levels 0–3)

**Role:** deliberation agent A4 of 7 (red team). **Date:** 2026-10-21. Written independently; no other file in `results/deliberation/` was opened.
**Inputs:** the brief (§0–§3, §5), V1 (v0.1, Turkish), DESIGN_REVIEW, the G1 report, VERIFICATION, reviews 01–05 and the objection ledger. This pass goes beyond the earlier red team (02); it does not repeat A-1…C-3.
**Code (read-only, treated as data):** fhevm `main` `ed851716c`, and `v0.13.8` through `git show` with lazy fetch and gc off; OZ confidential-contracts 0.5.3; Zama's cleartext mock; the Fhenix cofhe-contracts clone (for vendor neutrality). No transactions, no request to any live service, no agent file followed.
**Labels:** [V file:line] verified by me; [V-P1]/[V-J] verified in Phase 1 or by the earlier judge, not re-checked; [M-P1] measured in Phase 1; [I] inferred; [E] estimated; [C] cited, not reproduced. Paths are fhevm `main` unless prefixed `v0.13.8:`, `OZ/`, `mock/` (= `sdk/js-sdk/contracts/src/v0.13.0/`) or `fhenix/` (= `cofhe-contracts/contracts/internal/host-chain/contracts/`).

## 0. Bottom line

1. **G2-design is not tripped. The Core mechanism is sound.**
   - Gating is complete for every authorization path in Zama's code.
   - The executor exemption is not an export route on Zama (§1, Core verdicts).
   - The serious attacks hit the extensions, governance and ports to other oracles.
2. **Two criticals.**
   - **PQ-only mode is bypassable** on any host chain that still accepts ECDSA-authorized transactions. A forged transaction can `allow` or delegate to the attacker's PQ account, or publish the handle (C1).
   - **A Zama-style exemption keyed on `msg.sender == engine` voids retirement on proxy-style engines** such as Fhenix's TaskManager, which relays every ACL call (C2).
3. **The one-key rule.** For an ECDSA account, the owner and the thief hold the same key, so any transition that key alone can trigger is available to both. A lifecycle operation is safe only if it:
   - reduces the key's own authority; or
   - was pre-committed while the key was safe, behind a delay and in public; or
   - needs an independent authority.

   This decides Suspend, Compromised, the successor and the certificates.
4. **Revocation certificates are worth having, but not for speed.** Their real value is gasless, sweeper-resistant retirement and retirement after a lost key. They must only retire. Their PQ-safe form is a set-once hash commitment, not an ECDSA signature.
5. **Watchtowers win only slow races:** the successor-designation window and cross-chain relaying. They never win the off-chain decryption race, which needs no transaction.
6. **Successor:** use the dedicated encoding, and make acceptance by the successor mandatory. Reject SU-14.
7. **States:** no Suspended state in Core. "Compromised" is a reason code, never semantics.
8. **The three limits still bound everything:**
   1. pre-emptive, not a clawback;
   2. oracle access only;
   3. as final as the chain's governance.

## 1. Attacks, ranked by severity

**Severity scale:**
- **Critical:** voids a stated guarantee for a whole class of users.
- **High:** a bypass, or irreversible harm, for a class of users.
- **Medium:** needs a design change.
- **Low:** a test, documentation or hygiene issue.

"Port" means the attack arises when another vendor implements the ERC; "if adopted" means it applies only if a proposed variant is adopted.

| ID | Sev | Level / ext. | Attack: preconditions → impact | Fix or accepted residual |
|---|---|---|---|---|
| C1 | **Critical** | L3 PQ-only | **Preconditions:** the host chain still accepts ECDSA-authorized transactions; an attacker (T2, or T1) holds an un-retired EOA key. **Impact:** a forged transaction calls `allow(h, attackerPQ)`, `delegateForUserDecryption(attackerPQ, WILDCARD, max)` or `allowForDecryption`. The attacker then decrypts through a fully conforming PQ path, or through public decryption, which has no requester to refuse. PQ-only only ever refused the forged *permit* [V `ACL.sol:230-267, 326-377`; I] | Claim PQ-only only where the host chain rejects ECDSA-authorized transactions for that account. Operators also refuse delegated requests whose *delegator* has no code or `0xef0100` code (one `eth_getCode`). **Residual:** a forged persistent `allow` leaves no grantor or time in storage [V `ACL.sol:237-238`]. It can be found only through `Allowed` event logs, which would need a query per handle [I]. Public decryption likewise |
| C2 | **Critical** (port) | Core semantics | **Preconditions:** a vendor copies "skip the lifecycle check when `msg.sender` is the engine". **Impact:** Fhenix's TaskManager forwards every user call (`allow`, `allowGlobal`, `allowForDecryption`, `isAllowed`, `isAllowedWithPermission`), and its ACL checks the user through a `requester` argument [V `fhenix/TaskManager.sol:455-457, 947-975, 1091-1093`; `ACL.sol:160-166, 616-618`]. Every grant, every deputy check and the oracle's own permit check would be exempt [I] | **Normative semantic rule:** the exemption applies only to the engine's operand-access check for computation. It never applies to a check that gates a grant, a publication, a delegation, a bridge send or a permit, or to any answer visible to other contracts or verifiers. Add one conformance test per export path |
| H1 | High | Ext: certificate | **Q-day recovery:** a T2 attacker forges an `ecrecover`-verified `retireAccountWithSig` for every exposed EOA during a freeze. The retired bits survive any seed-proof recovery, so the owners are locked out for good. **If adopted:** a certificate that names a successor turns one phished signature into an irrevocable successor plus a lockout | Certificates only retire, never name or change a successor. Verify the EIP-712 form code-first, and refuse it once a freeze or PQ-only mode is active. **PQ form:** a set-once commitment `H(s)` registered while the key is safe; anyone holding `s` can reveal it to retire the account [I] |
| H2 | High (if adopted) | Ext: cross-chain | **Preconditions:** the ACL accepts "retire A" messages from a bridge. **Impact:** a compromise of the bridge or its DVNs (the DVN attestations are secp256k1; Phase 1 B8 inferred this, since the DVN contract is unverified) irreversibly blinds every account on the destination chain, and pressures governance to un-retire by upgrade | No propagation in the ERC. Each chain verifies the user's own certificate or preimage |
| H3 | High | L0 upgrades | **Preconditions:** an emergency `upgradeTo(previousImpl)`, a per-chain DAO vote to a release without Core, or a proxy redeployment. **Impact:** every retirement on that chain lapses at once. Retired users' requests that were denied as recoverable and are still in the retry queue then succeed [V `v0.13.8:…/decryption.rs` ACL denial → `Recoverable`] | Extend the release rule: never downgrade; keep per-chain parity; migrate the bits on redeployment. Add a monotonicity test to Zama's upgrade suite. Each operator runs a canary: a retired canary account whose handle must stay unreadable through every view, or the operator halts user decryption. **Residual:** a malicious upgrade that un-retires chosen victims and spares the canaries; only pinning catches that |
| H4 | High | L3 governance | **Timelock bypasses:** (a) on mainnet, two multisig plugins each hold EXECUTE on the DAO and either one suffices; EXECUTE amounts to root [V-P1 B8], so a timelock added as one more plugin is bypassed [I]; (b) pointer swaps outside `upgradeTo`, such as Fhenix `setACLContract`, documented as "admin-equivalent" [V `fhenix/TaskManager.sol:1062-1074`], or Zama connectors taking `acl_address` and a single RPC URL from config [V `kms-connector/config/kms-worker.toml:172-184`]; (c) the gateway `Decryption` has its own owner and a LayerZero path [V-P1] | Make a TimelockController the **owner** of every contract on the authorization path; revoke direct EXECUTE; put pointer and config changes behind the delay too. Operators pin implementations (needs ≥ 9 of 13) |
| H5 | High | L3 PQ-only | **Recovery deadlock.** **Preconditions:** the chain freezes ECDSA transactions; operators go PQ-only; the EOA never migrated. **Impact:** the owner can neither carry (needs an ECDSA transaction) nor retire to wake a dormant successor, and cannot decrypt [I] | Before activation, run code-first (L1) on ≥ 9 of 13 operators, so that an in-place chain recovery (the account gains regular code) restores access through ERC-1271. Pre-Q-day kit: a confirmed PQ successor plus a preimage commitment; revealing it retires the account with no ECDSA, and the successor reads. **Residual:** unprepared, unrecovered accounts lose access permanently (fail-closed) |
| H6 | High (port) | Core | **A second key is not gated.** A Fhenix sharing permit checks only `isAllowed(handle, acp.issuer)`; the recipient is checked only by its signature [V `fhenix/ACL.sol:616-618`; `Permissioned.sol:33-47, 63-93`]. **Impact:** a retired recipient keeps reading shared data (the A-5 analogue) | Core MUST gate every party whose key authorizes a request: issuer, recipient, delegator and delegate |
| H7 | High (if adopted) | Lifecycle states | **Preconditions:** a guardian- or governance-lifted Suspend, or a Compromised state with semantics. **Impact:** a per-user decryption cut-off outside the user's control, or a clawback against third parties (§2 Q3) | Not in Core (Q3) |
| M1 | Medium | L2 successor | **Preconditions:** designation needs no acceptance. **Impact:** anyone can publish `AccountRetired(sanctionedAddr, victim)`, which ties the victim to that address in chain-analytics clustering (taint by association) [I]. Separately, an attacker designation left unnoticed for D days survives retirement | Acceptance by the successor (a transaction or an ERC-1271 check) is MUST. D ≥ 7 days. Watchtower alert on designation, plus a pre-confirmation retire. Negative tests for both |
| M2 | Medium | L2 encoding | **SU-14, the locked wildcard delegation.** It is active *before* retirement, so the successor's key exposes the live account. Every write path (`delegate…`, `revoke…`, the one-change-per-block rule) must special-case the lock, and a release without that special case lets the old key revoke the insurance [I]. It also tells wallets the delegation is revocable when it is not | Dedicated encoding, dormant until retirement (Q5) |
| M3 | Medium | L2 app helpers | **Preconditions:** a naive OZ gate rejects retired callers in `setObserver`. **Impact:** an observer the thief installed before retirement keeps reading the current balance and all future amounts (the token re-allows the observer on every `_update`), and the retired owner can no longer clear it [V `OZ/…/ERC7984ObserverAccess.sol:26-28, 46-59`] | Asymmetric gate: a retired account may set the observer to `address(0)` but nothing else |
| M4 | Medium | L3 declared signer | **Impact:** under no-downgrade, *clearing* the signer re-enables ECDSA, so it is not a reduction. A `…WithSig` declare or clear is therefore T2-forgeable. An upgradeable verifier lets its admin forge signatures | No `WithSig` path except retirement. Store `extcodehash(verifier)` at declaration and reject on change. Native acceleration never changes semantics |
| M5 | Medium | L3 PQ-only | **Partial-adoption cliff.** With 5 ≤ k ≤ 8 operators enforcing, honest ECDSA users are still served with less redundancy, and so is T2. Availability degrades before any protection appears [V `sdk/js-sdk/src/core/modules/decrypt/module/api-p.ts:405-418`: t + 1 = 5] | Operators commit first, then activate together at an announced block once ≥ 9 have committed (Q8) |
| M6 | Medium | L1 | **7702 shim.** **Preconditions:** the shim treats "revert with no data" as "no ERC-1271 implemented". **Impact:** an under-gassed call or a delegate that reverts silently falls back to `ecrecover`, and B5 reopens. The crate already keeps the two cases apart [V `shared/user-decryption-signature/src/lib.rs:113-121, 141-147, 160-166`] | The shim applies only to a *successful* call with empty returndata (`EoaMismatchNoCode`) and a 65-byte signature. Never on `EmptyRevert` or `Transport`. Off under PQ-only |
| M7 | Medium | Ext: watchtower | **The no-transaction path.** P3 leaves no on-chain trace. P1/P2 emit `UserDecryptionRequest(…, userAddress, publicKey, …)` [V `v0.13.8:gateway-contracts/contracts/Decryption.sol:525`], but the mainnet gateway's RPC is private [V-P1]. Connectors answer in seconds, and re-run live-state checks only on poll retries [V `kms-connector/crates/kms-worker/src/core/event_processor/processor.rs:63-67`] | **Accepted residual.** Point the watchtower at designations and relaying; stop selling it as protection for V1 |
| M8 | Medium | L3 governance | **The "exit window" is not a user exit.** Users cannot withdraw ciphertext history from a malicious ACL; they can only unwrap funds | Present it as an *operator veto window*, enforced through pinning |
| M9 | Medium | L2 carry tool | **`Allowed` spam.** An attacker allows junk handles to the victim, inflating the carry at 31,083 / 119,201 gas per handle (Osaka / Sepolia) [M-P1] | Filter by a contract allowlist and current balance handles. The dry run shows a per-contract breakdown. The successor covers the rest |
| L1 | Low | L0 | **Ungated raw getters:** `getUserDecryptionDelegationExpirationDate` (whose docstring says "0 means delegation is inactive" [V `ACL.sol:443`]), `FHE.getDelegatedUserDecryptionExpirationDate` [V `library-solidity/lib/FHE.sol:8310`] and `allowedTransient` [V `ACL.sol:474`]. Zama's code never authorizes from them [V grep]; a dApp might | Return 0 / false for retired parties, which matches the docstring |
| L2 | Low | L0 tests | **The mock's scope.** The cleartext mock has no signature path. `isAllowedWithCleartext` and `plaintext` return the plaintext whatever `allowed` says [V `mock/cleartext/CleartextACL.sol:134-137, 196`]. The vendored ACL is v0.4.0 with `>=` at the expiry boundary, while the deployed line has `>` [V `mock/host-contracts/contracts/ACL.sol:600` vs `v0.13.8:host-contracts/contracts/ACL.sol:601`] | Limit "proven in mock" to the views. Put boundary vectors in the conformance suite |
| L3 | Low | L0 | **Forced self-retirement.** A contract with arbitrary-call admin or session paths can be made to call `retireAccount`, irreversibly bricking handles it holds for others | Document it; frameworks block lifecycle calls in generic-call paths. **Residual:** such contracts can already be made to exfiltrate |
| L4 | Low | L0/L2 privacy | **Linkability.** Carry (`Allowed(OLD, NEW, h)`) and the successor (`AccountRetired(OLD, S)`) publicly link the old and new identities | **Residual.** The SDK warns |

**Core verdicts behind the table.**
- **View-gating completeness [V].**
  - Only two host contracts read ACL views: `bridge/HandlesSender.sol:351` and `FHEVMExecutor.sol:1063`.
  - Every off-chain reader uses the gated set:
    - the SDK prechecks (`checkPersistAllowed.ts:79`, `checkDelegation.ts:100`);
    - both connector lines (main `rpc.rs:24-67`; v0.13.8 direct `isAllowed` and delegated `isHandleDelegatedForUserDecryption`);
    - the mock (`CleartextACL.sol:222-262`).
  - Main has no gateway-side ACL mirror. The transaction-sender's ops are `add_ciphertext` and `verify_proof`. The coprocessor stores delegation events (`tfhe_event_propagate.rs:1889-1910`), but I found nothing that authorizes from them [I].
  - What remains open is the identity-gated app authority (limit 2) and L1.
- **The executor exemption [V].**
  - The executor grants transient access only to `msg.sender` (`FHEVMExecutor.sol:864, 1046`) and checks operands only at `:1063`.
  - Every export path re-enters `isAllowed` with the retired account as `msg.sender`, because the ACL's internal call keeps the external caller (`ACL.sol:234, 261, 301`).
  - So a retired contract can compute but cannot export. This holds while three conditions do:
    - the executor never grants to a third address;
    - nothing authorizes from `allowedTransient`;
    - the exemption stays tied to the operand check (see C2).

## 2. Answers to Q1–Q12

**Q1. Ideal end state.** Component by component, under the red-team invariant: *every rights increase for any party is pre-committed while the key is safe, delayed and public; every `…WithSig` path is a pure reduction.*
- **ACL:** a one-way lifecycle state (Active → Retired, plus a reason code) inside the authorization views; a dedicated, accepted successor; a set-once retirement commitment; no switch that any ECDSA key can flip.
- **Verifier:** code-first account authority with an execution-gas budget; an optional subordinate PQ signer verified natively; a canary; implementation pinning; fail-closed on RPC errors.
- **SDK:** a fresh transport key per request, purged on retire; per-chain coverage reporting; designation alerts.
- **KMS:** PQ response signatures (B7) and an ML-KEM reply channel.
- **Governance:** a timelock that owns every contract and pointer on the path; operator veto through pinning; PQ signers before any T2 claim.
- **Host chain:** it alone can close the on-chain door for unmigrated ECDSA accounts on Q-day. The ERC follows it rather than replacing it.

**Q2.** See §3.

**Q3. Lifecycle states.**
- **Recommendation:** Core has two states, Active → Retired (one-way), and the event carries `reason ∈ {Superseded, Compromised, Unspecified}`.
- **Who could lift a Suspend:**
  - **The key alone:** the thief lifts it, so it is useless.
  - **Governance:** rejected, for the same reason the deny list was rejected: it hands ECDSA governance a per-user cut-off, and governance is the first target under T2.
  - **A guardian alone:** a new per-user cut-off authority, i.e. a lever for censorship and lockout.
  - **Expiry:** the thief simply waits.
  - **The key plus a delay:** workable, because the owner can retire during the delay.
- **Two further facts:**
  - Suspension gates `isAllowed`, and that same predicate gates the account's own writes. So "freeze, then carry" is impossible.
  - Zama's own table defines Suspended as "temporarily replaced during rotation; still usable for decryption" [V `docs/protocol/architecture/kms.md:68-77`]. The analogy does not support an emergency brake.
- **So:** no Suspended state in Core. At most a deferred Extension: *self*-suspension, resumable only after a delay, always overridable by retirement, and never triggered by a guardian or by governance.
- **"Compromised" with semantics fails both ways:**
  - **As a clawback:** voiding grants made after T_c would let a grantor claw back an auditor's or counterparty's access. It also needs grantor and time provenance on every `allow`, which storage does not have.
  - **As a symmetric weapon:** the thief declares T_c = 0 and voids the owner's successor.
- **So "Compromised" is a label only.** Relying parties may distrust the account's other signatures dated after T_c.

**Q4. Identity versus decryption authority.**
- **Verdict:** yes, as an L3 Extension. Against a key thief it adds no power beyond B3: declaring an attacker signer equals today's `delegate(attacker, WILDCARD)` [V-J], and retirement kills both.
- **Rules:**
  1. The signer is subordinate and scoped to `msg.sender`. It is stored in the lifecycle's trust domain: the ACL namespace, or an immutable registry the operators pin.
  2. It is evaluated only as a permit *of the account*, after the account-level views pass. Retirement then kills it in the views, not in a separate check.
  3. It authorizes off-chain permits only. It never grants, delegates, designates or re-declares; it may sign a pure retirement.
  4. There is no `WithSig` for declaring or clearing a signer (M4).
  5. The verifier's code hash is pinned (M4).
  6. A distinct permit context, and preferably a separate key from the transaction key.
  7. Bounded expiry, with events.
  8. No-downgrade is opt-in. It is a PQ hedge only if the chain also stops the account's ECDSA transactions; otherwise the thief re-points the declaration on-chain.
- **Does retirement really kill it?**
  - On Zama, yes, as long as the ownership check stays on `user_address` [V `decryption.rs:441-470`].
  - On Fhenix-style permits, only once the recipient is gated as well (H6).
  - Results already produced stay exposed (limit 2).

**Q5. Continuity.**
- **Both.** Carry (`multicall`, grants first) is the default for anything that must stay actionable. The successor is insurance: against lockout, for stragglers, and for delegate keys.
- **Encoding: dedicated.** The flow is:
  1. designate;
  2. the successor accepts;
  3. confirm after D, which locks the designation.

  After that, only the successor can resign. It is dormant until retirement; there is no transitivity; it is never a payment address. Designation reverts while a confirmed successor exists, and retirement voids a pending designation (the earlier judge's PR-2 spec, not code).
- **SU-14 is rejected (M2).** Its claimed benefit is small: indexers must learn retirement anyway, and nothing on main authorizes from delegation events.
- **The unnoticed-attacker-designation residual** is inherent to one-key accounts. Its marginal harm:
  - stragglers that arrive after retirement;
  - lockout of the owner;
  - retirement stops being a full kill switch.
- **Its best defence** is the one race a watchtower *can* win, because it lasts D days rather than seconds: on an unexpected `SuccessorDesignated`, retire before confirmation using the user's pre-signed certificate. This trades a lockout for denying the attacker.
- **Required tests:**
  - an unnoticed attacker designation that is then confirmed survives retirement (asserted);
  - a designation retired against before D yields no successor;
  - an unaccepted designation cannot be confirmed.

**Q6. Revocation certificate plus watchtower.**
- **Verdict:** worth it, in a narrow form.
  - **Real value (T1):** a plain `retireAccount()` from a compromised EOA can be replaced by the thief (same nonce, higher fee), or starved by a sweeper bot that drains the EOA's ETH [I]. A certificate relayed by a third party has no nonce and no gas cost for the victim, and it also serves a lost key.
  - **The certificate must:**
    - only retire;
    - be used only together with a confirmed successor, because without one a leaked or phished certificate is a lockout bomb;
    - in the PQ era, be the hash-commitment form (H1).
- **Front-running:** nobody can block a nonce-free certificate. A sleeper thief who sees the reveal front-runs it with exfiltration: `allow` to a fresh EOA, `allowForDecryption`, or `setObserver`.
- **Private order flow:** it hides the reveal from that sleeper, but gives up the censorship resistance of inclusion lists. The thief can use private order flow too, which blinds mempool watchtowers.
- **Griefing:** a watchtower holding many certificates is a custodian of kill switches, so its compromise means a systemic lockout. Hence successor-only certificates.
- **Quantum forgery:** pre-freeze, a forged certificate adds nothing to T2, who can already forge transactions. Post-freeze it destroys recovery (H1).
- **Cross-chain replay:**
  - A domain with `chainId` and `verifyingContract` does not replay, but cannot cover new chains.
  - A domain with `name` and `version` only is valid on every conforming ACL, present and future, including other vendors' ACLs.
  - That is safe for EOAs (the same key everywhere) and for contracts, provided each chain verifies through its own code via ERC-1271. A Safe address that collides across chains gains the attacker nothing [I].
  - "Retire everywhere" must be explicit and irrevocable.
- **The no-transaction path** cannot be raced (M7).
- **"Retirement only reduces rights"** is true for the retiring key. It is false system-wide once a successor exists: retirement *activates* S, so a certificate inherits the successor's risk.

**Q7. Cross-chain.**
- **Per-chain bit in Core.** The Extension is user-authorized certificates relayed per chain: a global-domain EIP-712 certificate before Q-day, or a preimage commitment registered on each chain.
- **No bridge propagation (H2).**
- **Coverage:**
  - the SDK lists chains that are not covered, including chains running a release without Core, chains added later and chains with private RPCs, and treats each one as unprotected;
  - L2 sequencers can delay a retire until forced inclusion.
- **Bridged handles:**
  - A retired source account cannot `send` [V `bridge/HandlesSender.sol:348-351`].
  - Destination ciphertexts need a matched pair of source and destination events [V comment `bridge/HandlesReceiver.sol:150-158`; I].
  - Handles bridged earlier are separate principals on the destination.
- **The shared gateway** (Ethereum and Polygon) matches chain ids per request [V-P1], so retiring on one chain never covers the other.

**Q8. Q-day / PQ-only mode.**
- **Who flips it:** at least 9 of 13 operators, as policy. They commit in advance and flip atomically at an announced block (M5). The trigger is an *observable host-chain emergency rule* (follow the chain), a published readiness KPI and operator commitments. Never a DAO vote.
- **Notice:** at least the host chain's own.
- **Abuse:**
  - 9 or more operators can already refuse service; PQ-only gives them a pretext, not a new power.
  - Fewer than 9 can block nothing.
  - Governance cannot flip it at all.
- **Effect per path:**
  - legacy P1/P1d: refuse entirely;
  - P2/P3: refuse code-less and `0xef0100` signers, with the shim off;
  - delegated: also refuse code-less and `0xef0100` *delegators* (C1);
  - public decryption: unchanged (a residual);
  - KMS response signatures stay ECDSA, so T2 can forge public-decryption results (B7, adjacent).
- **Recovery:**
  - (a) In-place chain recovery plus code-first, which must be deployed before activation.
  - (b) A pre-Q-day kit: a PQ successor plus a preimage commitment.
  - (c) A declared PQ signer with no-downgrade, and only on a chain that freezes the account.
  - Once a freeze or PQ-only mode is active, refuse every ECDSA-verified `…WithSig` lifecycle operation (H1).
- **Never advertise PQ-only on host chains that keep accepting ECDSA transactions (C1).**
- **A side effect [I]:** the D-day designation window makes a silent CRQC that wants persistence *noisy*. It would emit `SuccessorDesignated` events en masse, and indexers can alarm on that.

**Q9. Governance.**
- **Timelock:** as in H4: it owns the ACL, executor, ProtocolConfig, pauser management, bridge and gateway, and covers pointers too.
- **Emergency powers:** pause only. Today any pauser pauses immediately and only the owner unpauses [V `ACL.sol:422-436`; `immutable/PauserSet.sol:26-42`]. Pause never gates retirement, and there is no emergency upgrade path.
- **Note:** pause halts carry and computation but *not* decryption, because the views are not pause-gated. Operators are the only global brake.
- **PQ signers:** required before any T2 claim. The cheapest PQ check today is off-chain operator pinning; an on-chain quorum of ML-DSA verifications would cost about 11M gas [E-J].
- **Release survival, using all of:**
  - the bit in its own namespace;
  - the extended release rule (H3);
  - a monotonicity test;
  - canaries;
  - pinning.
- **Immutable registry:** not as the primary store. It protects only the bit, adds a read, needs ≥ 9 of 13 operators, and freezes the semantics.

**Q10. Vendor neutrality. Requirements for any oracle:**
1. The lifecycle predicate sits inside the authorization predicate for every decryption path *and* for every on-chain view that contracts use: both doors.
2. Gate every authorizing party (H6).
3. Exemptions are semantic (C2).
4. Off-chain permits are evaluated against the current lifecycle state at use, whatever their expiry or signer-chosen revoker (Fhenix [V-P1]).
5. Evaluate at fulfilment, against host state the oracle can vouch for. TEE oracles must name their RPC or light-client trust root.
6. Never serve a stored result whose fresh evaluation fails, or bound its TTL. No deduplication that ignores the signature.
7. Grants emit events (Fhenix `allow` emits none [V-P1 N13]).
8. **PQ class:** both the input and the reply channel must be PQ.
   - Fhenix's X25519 reply [V-P1] and Inco's ECIES inputs (from the brief; not verified by me) conform for Core, which has T1 value.
   - Under T2, though, classically encrypted inputs on-chain can be decrypted without any oracle. Retirement then protects nothing [I].

**Q11. What changes per component, in order:**
1. **ACL:** Core, including the L1 getters; the reason code; the monotonicity test.
2. **Connector:** canary and pinning, then L1 (code-first, budget, the M6 shim rule, optionally terminal denials for retired accounts), then later PQ-only policy and native declared-signer verification.
3. **Governance:** timelock ownership (H4).
4. **Relayer:** a deduplication key that includes the signature and validity window; no caching of positive authorization.
5. **SDK:** status API, transport-key purge, per-chain coverage, carry filters (M9), designation alerts.
6. **OZ ERC-7984:** the asymmetric observer gate; no post-grant `isAllowed(recipient)` asserts (SU-1).
7. **ACL:** successor with acceptance; retirement commitments.
8. **KMS:** PQ response signatures.
9. **Gateway:** retire the legacy path; a connector-side `user ∉ contracts` check.
10. **Executor:** nothing, beyond a test pinning "grants only to `msg.sender`".

**Q12. Conformance.**
- **Core MUST:**
  - one-way, self-only retirement, not pause-gated, with no un-retire through any non-upgrade path;
  - every authorization view and every oracle path returns false for a retired issuer, recipient, delegator or delegate;
  - semantic exemptions only;
  - an event.
- **An off-chain verifier conforms iff it:**
  - evaluates the predicate at fulfilment against trusted host state;
  - does not cache positive results across blocks;
  - fails closed on RPC errors;
  - never serves a stored result that a fresh evaluation fails;
  - passes the public vectors, including boundary cases (L2) and an attempt at every export path.
- **Extensions:**
  - Successor (with acceptance);
  - Declared Signer;
  - Certificate (retire-only);
  - Cross-chain (certificates only);
  - PQ-only *signalling*, which is non-normative policy.
- **PQ claims** additionally require PQ input and reply channels.

## 3. V1 ideas: verdicts

| V1 idea | Verdict | Form, and the red-team caveat |
|---|---|---|
| C1 sealing | **Returns** | As the read-side Core bit. The intent is kept intact; the mechanism (write guards plus the sentinel) does not return |
| C2 carry-and-seal UX | **Returns as UX** | `multicall`, grants first, then retire; the successor covers stragglers. No `carryAndSeal` in the ACL. Wallets must render "grant N handles to X, then retire", because it has the shape of a phishing transaction |
| C3 connector-side rules | **Returns transformed** | As L1 code-first plus the budget, which needs ≥ 9 of 13 operators, and as the ERC's verifier requirements. V1's "two doors, one decision" returns as a principle. The EIP-8151 rule does not return |
| C4(a) code-hash allowlist | **Does not return** | Proxies defeat it; DoS |
| C4(b) scheme-hinted native verification | **Returns** (L3) | As an ERC-7913 declared signer under the Q4 rules, after an audit |
| C4(c) precompiles | **Returns later** | Only with the execution-gas budget |
| C5 fail-closed | **Returns, halved** | As an operator PQ-only policy that follows the chain. It covers the off-chain door only (C1). Its *principle* returns more broadly as canary and pinning halts |
| ERC-7984 PQ profile | **Returns enlarged** | As the vendor-neutral ERC plus an app profile (identity-gated paths honour retirement; M3) |

**Semih's instinct, tested.**
- **Partly right.** V1's *goal set* (G1–G6, both doors, a Q-day story, a standard) was broader than the minimal PR, and the target architecture re-adopts nearly all of it.
- **But V1 was not "better" on safety reasoning.** It treated a governance-held switch as a safety feature, claimed "residual risk: none" for B4, and missed deputies, governance, operators and the no-transaction path.
- **Its mechanism failed because its threat model was too narrow, not because its ambition was wrong.** The final design is V1's vision with the threat model widened.

## 4. Core versus Extensions, from a safety view

- **Core is safe on its own.**
  - It removes only the retiring key's authority, binds every connector version at the upgrade block, and adds no key and no trust root.
  - Its harms are bounded and stated: lockout, contract bricking (L3), linkability (L4) and release lapses (H3).
- **Every Extension adds a surface that grants or redirects rights:**
  - the Successor grants rights to S;
  - the Declared Signer adds a key;
  - the Certificate adds a bearer kill switch that wakes S;
  - Cross-chain adds relays;
  - PQ-only adds an outage lever.
- **Safety order:** successor with acceptance > retire-only certificate > declared signer > cross-chain certificates > PQ-only signalling.
- **Admission rule for any Extension:** it must pass the one-key rule. No single-key rights increase without a delay and public visibility, and no `…WithSig` path except retirement.
- **The three limits apply at every level:**
  1. pre-emptive, not a clawback;
  2. oracle access only;
  3. as final as the chain's governance.

## 5. Expected disagreements

- **A3 (Zama):** will resist successor acceptance (it costs a PQ verification or transaction), operator canary halts (a liveness risk), changing getter semantics, and terminal denials. They may want PQ-only left unspecified.
  - My position: acceptance is non-negotiable (framing, M1). Canary halts are the cheapest enforcement of the release rule.
- **A6 (product):** will want the certificate and watchtower as a headline feature and a certificate that carries a successor.
  - My position: no to both (H1, M7).
- **A2 (clean slate):** may propose a separate PQ decryption identity as root, or the full SP 800-57 state set.
  - My position: A1 stays rejected as a root, and only a subordinate signer is acceptable; Q3 on the states.
- **A5 (AA/PQ):** may push no-downgrade declared signers as a near-term EOA Q-day hedge.
  - My position: only with a chain freeze and no `WithSig` (M4).
- **A1 (ERC editor):** may make PQ-only or propagation normative.
  - My position: PQ-only is signalling only; cross-chain is certificates only.
- **The judge:** SU-14 against the dedicated encoding (M2), and the value of D.

## 6. Open questions

1. **RPC as a hidden trust root.** Each operator reads every ACL view through one configured RPC URL [V `kms-worker.toml:172-184`]. If 5 or more operators share a provider, the 5-of-13 threshold collapses to that provider for *every* ACL decision, not only retirement. Unknown; possibly High.
2. Will Ethereum's emergency plan change `ecrecover`, or the validity of off-chain signatures from frozen EOAs? This decides H1 and C1.
3. Will Zama's mainnet gateway RPC become public, which watchtower visibility on P1/P2 depends on?
4. Can 9 or more of the 13 operators, several of them custodians whose customers use ECDSA, credibly commit to an activation block?
5. Does the coprocessor's bridge matching re-check the source ACL at the source block? (Inferred, not verified.)
6. Inco's ACL internals: not available to me.
7. Which delegation-expiry boundary (`>` or `>=`) should the ERC fix (L2)?
8. Is the gas or UserOp cost of successor acceptance acceptable for PQ smart accounts (about 1.23M gas for one ML-DSA-44 ERC-1271 check [M-P1])?
