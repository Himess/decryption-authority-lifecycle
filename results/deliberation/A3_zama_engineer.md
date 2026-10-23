# A3 of 7: the Zama protocol engineer

**Date:** 2026-10-21. **Role:** feasibility, release trains, operator cost, acceptance order; I defend the status quo where it is right. I worked independently and read no other file in `results/deliberation/`. This file builds on `results/review/01_defender.md` and does not repeat it.

**Code (read-only, no fetches; partial-clone blobs that were absent stay unchecked):** fhevm `main` `ed851716c` and tag `v0.13.8`; kms `c755e84f`; OpenZeppelin confidential-contracts 0.5.3 (`OZ/`); `@openzeppelin/contracts` 5.6.1 (`OZc/`, under `experiments/node_modules`). `mock/` = `sdk/js-sdk/contracts/src/v0.13.0/`. Lines are on main unless marked v0.13.8.

**Labels:** **[V]** I verified it at file:line this session. [V-J], [V-01], [V-P1] and [V-03] were verified by an earlier reviewer and not re-checked. [M-P1], [M-03] and [M-04] were measured by others. [E] estimate, [I] inference, [C] cited and not reproduced.

**Thesis:** retirement gives **revocable access**, and the verb is **retire**. Three limits apply: (1) it is pre-emptive, not a clawback; (2) it covers oracle access only; (3) it is as final as the chain's governance.

---

## 1. Feasibility and acceptance order

### 1.1 Verdict per level

| Level | Deployed line (0.13.x) | Main | Zama code touched | Verdict |
|---|---|---|---|---|
| **0: Core** (read-side bit) | Yes | Yes | ACL, events, bindings, 2 coprocessor match arms | **Feasible now.** Zero connector, relayer, SDK, KMS or gateway change. Two release-train fixes are needed (F2, F3) |
| **1: signature hygiene** | **No.** The legacy gateway path is ECDSA-only on-chain | Yes (unified paths only) | `shared/user-decryption-signature`, connector config, relayer config, SDK constant | Feasible. Lands with the next unified-path connector release |
| **2: continuity and apps** | Successor yes; apps yes | Yes | ACL (successor), `library-solidity`, OZ, SDK | Feasible. Successor only with demand evidence |
| **3: PQ authority, PQ-only mode, governance** | No | Partly | connector (native PQ), registry, operator policy, governance process | Design plus prototype. Gated on an `ml-dsa` audit, a readiness KPI and governance changes |

### 1.2 New findings from code

**F1. Retirement does flow into Zama's cleartext mock, with five caveats.**
- **The flow [V].**
  - `CleartextACL is ACL` imports the base ACL (`mock/cleartext/CleartextACL.sol:4, 20`).
  - `plaintextForUserDecryption` checks `persistAllowed(h, user)` and `persistAllowed(h, contract)` (`:236, :239`).
  - `plaintextForDelegatedUserDecryption` checks `isHandleDelegatedForUserDecryption(delegator, delegate, c, h)` (`:257`).
  - `CleartextACL` overrides neither view, so a gated base ACL reaches them.
  - `CleartextKMSVerifier.userDecrypt` calls these functions and only then checks a 65-byte ECDSA signature (`mock/cleartext/CleartextKMSVerifier.sol:246, 252-256, 286, 292-297, 307-313, 339-341`).
  - The cleartext executor checks operands through `isAllowedWithCleartext` from the executor's own context (`CleartextFHEVMExecutor.sol:40-41`). The executor exemption therefore keeps mock compute working.
- **Caveat (a): one SDK mode skips the mock-KMS checks.** The "Option B / forge-fhevm" mode is chosen when the KMS signer set is exactly one forge test signer (`sdk/js-sdk/src/core/modules/relayer/cleartext/forgeFhevmV1.ts:17-26, 42-54`). It reads plaintexts straight from the executor. Enforcement there is only the SDK's step-7 precheck (`src/core/kms/fetchKmsSigncryptedSharesV1-p.ts:125-138`), which runs before the relayer call (`:161, :173`) and reads the gated views. Level 0 tests must also use a multi-signer deployment so that the mock KMS path runs.
- **Caveat (b): mock plaintexts are public.** `CleartextACL.plaintext()` is an unauthenticated view (`:196-206`). The mock proves the *flow*, not confidentiality.
- **Caveat (c): the mock reads a different view.** Its direct path uses `persistAllowed`, while the real v0.13.8 connector uses `isAllowed` (`v0.13.8 decryption.rs:229-230`). The mock does not replace the real-connector proof.
- **Caveat (d): the mock's ACL is not v0.13.8.** It says ACL v0.4.0 but uses `expirationDate >= block.timestamp` (`mock/host-contracts/contracts/ACL.sol:600`). Every v0.13.x tag uses `>` (`v0.13.8 ACL.sol:601`; the same holds at v0.13.0, .1, .5 and .7). Build the 0.4.1 backport from the v0.13.8 source and swap it in.
- **Caveat (e): the mock cannot host Level 1.** It has no ERC-1271 path and no validity-window check ("Missing startTimestamp / durationDays test", `CleartextKMSVerifier.sol:243, 282`). The brief's Level 1 ML-DSA test must run in the connector harness, not in this mock.

**F2. Reinitializer numbers collide across release lines (a correction to DESIGN_REVIEW §6.2).**
- **Zama's CI rules [V].**
  - Any bytecode change must bump `REINITIALIZER_VERSION` (`ci/upgrade-check/lib.ts:144-147`).
  - The reinitializer must be named `reinitializeV{N-1}` (`:163-167`).
  - The upgrade task requires and always calls a `reinitializeV*` function (`host-contracts/tasks/upgradeContracts.ts:27-29, 80-82, 144-151`).
- **The numbers in use.** Reinitializer = minor + 1 on every line: ACL 0.4.0/5 (0.13.x), 0.5.0/6 (0.14.x, `reinitializeV5`), 0.6.0/7 (0.15.x), 0.7.0/8 (main) [V].
- **How a backport collides.** A 0.4.1 backport must take reinitializer 6. OZ's `reinitializer` reverts when `_initialized >= version` (`OZc/proxy/utils/Initializable.sol:156-157`). So 0.4.1 → 0.5.0 reverts with Zama's tooling. That is accidental protection.
- **What the collision does not catch.** 0.4.1 → 0.6.0 and 0.4.1 → 0.7.0 succeed and drop Core silently.
- **Fix:** each line's Core release takes its own line number + 1. The only releases it collides with are Core-less ones, which the release rule forbids anyway. Add F4 to catch skip-upgrades.

**F3. The next production line is plausibly 0.14.x, not 0.13.x.**
- `test-suite/fhevm/profiles/latest-supported.json` pins every component, `HOST_VERSION` included, to v0.14.2 [V].
- `release/0.13.x` differs from v0.13.8 only in one test file (tree diff [V]). There is no host-contract backport precedent on that line.
- **Recommendation:** Core rides the next production ACL upgrade, whichever line that is. A 0.4.1 backport is worth a DAO vote and an audit only if production stays on 0.13.x [I].

**F4. The release rule can be enforced on-chain.**
- UUPS runs `_authorizeUpgrade` inside the *current* implementation before switching (`OZc/proxy/utils/UUPSUpgradeable.sol:88-89`). The ACL's version is empty apart from `onlyOwner` (`ACL.sol:674`).
- A Core implementation can refuse any new implementation whose `retirementStorageLocation()` does not return the namespace constant. This mirrors OZ's own `proxiableUUID` seatbelt (`:137-138`) and adds about 10 lines.
- It stops accidental lapse, not a malicious implementation that lies. It also blocks quick rollback, so pair it with a public, delayed escape hatch [I].

**F5. Retirement denials can be made terminal.**
- Every connector treats an ACL denial as Recoverable and retries it: v0.13.8 `decryption.rs:209-213, 234-242`; main `decryption.rs:253-255, 451-454, 558-568` [V]. The default is 20 attempts (`kms-worker/src/core/config.rs:228-230`) [V].
- Zama's reason to retry is mutable state (`error.rs:97-100`) [V]. Retirement is monotone, so a terminal "retired" class is consistent with that reasoning. It costs one `isAccountRetired` call, on the deny path only.

**F6. Connector rules come in two kinds with different thresholds.**
- A *positive* rule (accepting a new signature type) works once t+1 = 5 operators run it.
- A *negative* rule (refusing ECDSA, "no downgrade", PQ-only mode) protects only once n − t = 9 run it, because shares are computed locally and published per party [V-J].
- This decides where each Level 1 and Level 3 rule can live.

**F7. One timelock covers the whole host stack.**
- `onlyACLOwner` resolves to `ACL.owner()` (`host-contracts/contracts/shared/ACLOwnable.sol:20-30`) for the executor, KMSVerifier, InputVerifier, HCULimit, KMSGeneration and ProtocolConfig [V].
- Zama's governance sender already expects a "DAO with timelock" caller (`protocol-contracts/contracts/governance/contracts/GovernanceOAppSender.sol:144`) [V].

### 1.3 Acceptance order (what Zama would take, first to last)

1. **Docs, zero risk.** Fix the deny-list over-claim (`docs/solidity-guides/acl/README.md:65` [V-01]) and add a page on address lifecycle and key compromise.
2. **Core on main (ACL 0.8.0, reinitializer 9).** It comes with a differential suite, a release-rule CI test and an executor gas benchmark. The F4 guard is offered as optional.
3. **Core in the line production adopts next** (F3), in the same namespace, with reinitializer = line + 1 (F2). It needs one DAO vote per host chain (Ethereum, Polygon) plus the testnets.
4. **Operator track, with no fhevm release coupling:** implementation pinning, a retirement canary (§3, Q9), terminal "retired" classification (F5) and a legacy-path `user ∉ contracts` check [V-J].
5. **Governance timelock** as `ACL.owner()` and as the gateway owner (F7).
6. **Level 1** in the shared crate:
   - an execution-gas budget and a signature-length cap;
   - retries bounded by total gas (Zama will reject "terminal 1271 failures", because `error.rs:97-100` argues the opposite);
   - code-first ordering with the 7702 shim.
7. **Level 2:** `FHE.isAccountRetired`, OpenZeppelin gating and the SDK carry tool. The successor comes after named integrators ask for it.
8. **Level 3:** the declared PQ signer after an audit, PQ-only mode after readiness, the certificate if wallets ask, and PQ governance.

### 1.4 Operator cost

| | L0 | L1 | L2 | L3 |
|---|---|---|---|---|
| **New RPCs per request** | **0** (the views are unchanged) [V] | +1 concurrent `eth_getCode` for code-less signers [V-03] | 0 | +1 concurrent registry read |
| **Gas** | `retireAccount` ≈45–55K under Osaka rules [E]; executor ≈+20 per operand [E]; ERC-7984 transfer +2.1–2.8K, 0.7–0.9% [E] | none | carry 31,083 per handle (Osaka) and 119,201 (Sepolia) [M-P1]; successor ≈2 slots [E] | certificate ≈50–60K for an EOA [E]; a PQ 1271 account ≥1.31M [M-P1] |
| **CPU and latency** | unchanged | ≤ budget (ML-DSA-44 ≈1.23M gas ≈4.5 ms [E-03]), concurrent | unchanged | native ML-DSA-44 35–82 µs, against 172–178 µs for `ecrecover` [M-03] |
| **DoS** | No new surface. Retired requests are ordinary ACL denials. F5 removes their retries | Today's worst case is 20 × 250k = 5M gas per request [E-03]. A budget of 1.6M bounded at 2× budget gives ≈3.2M, *lower* than today [E] | none | Restrict SLH-DSA to SHA2 (SHAKE-128s takes 1.4 ms [M-03]) |

If Zama objects to the +2.1K per transfer: `allow` already reads `denyList[msg.sender]` cold (`ACL.sol:231`) [V]. Storing the flag in byte 1 of that word would cut the delta to about 100 gas. `denyList` is index 3 on both lines [V]. The cost is coupling user state to a word governance writes. Untested [I]; the dedicated namespace stays the default.

### 1.5 Where the status quo is right (keep it)

- **Permanent, monotone grants.** Retirement removes the retired key's reads and exports, not anyone's grants.
- **No ACL check on the gateway.** "ACL checks are performed by the KMS" (`v0.13.8 Decryption.sol:724`) [V]. Do not add one.
- **The KMS never sees user signatures.** Authority stays in the connector and the views.
- **The executor checks the calling contract.** The exemption belongs there.
- **The 250k cap is a legitimate DoS bound.** Its unit, which includes calldata, is the bug.
- **Retrying 1271 failures** is right for wallet state, though not for retirement.
- **Leave the legacy ECDSA path alone:** do not extend it; deprecate it (main already marks it, `Decryption.sol:443, 523`) [V].
- **Stored results are encrypted to the requester's transport key.** Re-serving them reveals nothing new (`kms-connector/docs/architecture.md:88-94`) [V].
- **The deny list stays a governance tool.** Never reuse it for self-retirement.

---

## 2. Q11: what changes per component

Sizes are estimates [E] in lines of code (LoC), tests excluded unless stated.

| Component | L0 (Core) | L1 | L2 | L3 / target | Size | Order |
|---|---|---|---|---|---|---|
| **ACL** | `retireAccount`, `isAccountRetired`, event and errors in the `fhevm.storage.ACLRetirement` namespace. Gate `isAllowed` (non-executor callers, reading the raw mapping), `persistAllowed`, `isHandleDelegated…` (both roles) and `isDelegated…` (main). `delegateFor…` reverts. Not pause-gated. Optional F4 guard. On v0.13.8 the four views have the same shape as on main (`:452-454, 478-491, 499-502`) [V], so one patch serves both | — | Successor branch in the delegation views; two storage slots appended *inside* the namespace struct | `retireAccountWithSig` (the ACL has no EIP-712 domain today [V]; add constant-field hashing). Owned by a timelock | L0 ≈50 + F4 ≈10, tests 300–500; L2 ≈60–80; L3 ≈50 | 2 → 3 → 7 → 8 |
| **Executor** | **None.** The exemption lives in the ACL; benchmark ±25 gas per operand | none | none | none | 0 | — |
| **Connector** | **None** for correctness. It calls only the four views (`rpc.rs:24-67`) [V]; main re-checks state on poll retries (`processor.rs:64-66`) [V] (not checked at v0.13.8: blob absent). Optional: F5, pinning, canary, legacy `user ∉ contracts` | Shared crate: budget = execution + intrinsic(calldata), length cap, total-gas-bounded retries, code-first with shim, same block tag for code and 1271 | none | Native FIPS 204/205 verification for declared signers (`ml-dsa` 0.1.1 is unaudited, `kms/Cargo.toml:175` [V]); PQ-only operator flag | optional ≈150; L1 ≈50 [V-03]; L3 ≈200–300 plus audit | 4 → 6 → 8 |
| **Relayer** | **None.** The legacy precheck reads the gated views (`relayer/src/host/acl_checker.rs:191-232, 291-320, 380-416`) [V]; relayer-http checks nothing. Optional: advisory `account_retired`; re-check before serving `DuplicateCompleted` (dedup runs before any ACL check, `v2/handlers/user_decrypt.rs:230, 299-310`) [V] | `erc1271_gas_limit` (required, no default [V-P1]) takes budget semantics, plus a length cap | none | Accept PQ permit sizes on unified routes; remove the legacy routes | ≈20–50 each | 4 → 6 |
| **SDK** | **None** for correctness. The precheck already reads `persistAllowed` and `isHandleDelegated…` (`checkPersistAllowed.ts:79`, `checkDelegation.ts:100`) [V]. UX: status read, typed error, purge permits and transport keys on retire | `ERC1271_GAS_LIMIT` (`verifyErc1271UserDecrypt-p.ts:28`) [V] becomes a budget; needs a release | Carry planner (`Allowed` indexes `account`, `ACLEvents.sol:10` [V]), `retireEverywhere`, successor "decrypt as", a fresh transport key per request | PQ permit signing through the declared signer | L0 UX 300–600; L2 500–1000 | 6 → 7 |
| **KMS** | **None.** It never sees a signature or the ACL | none | none | Consume ML-DSA response signatures end to end (B7, roadmap). Today the user reply channel accepts only ML-KEM-512 (`kms/core/service/src/engine/threshold/service/user_decryptor.rs:507`) [V], although signcryption already supports ML-KEM-1024+P-384 (`…/signcryption/common.rs:13-18`) [V]. Small change to raise it | medium (Zama roadmap) | independent |
| **Gateway** | **None, and it should stay so** (`v0.13.8 Decryption.sol:724`) [V]. Main's gateway has no ACL mirror, and the coprocessor's delegation table has no authorizing consumer (`transaction-sender/src/ops/` holds only `add_ciphertext` and `verify_proof`) [V] | — | — | Remove the legacy path: it is ECDSA-on-chain (`v0.13.8 :923, :947`) [V] and a gateway upgrade alone can bypass it [V-P1] | Zama roadmap | 8 |
| **Governance** | Release rule; CI test per line; F2 numbering; F4 guard | — | — | Timelock as `ACL.owner()` and gateway owner (F7). PQ-capable proposer and canceller. Operators pin implementations | small code, large process | 5 → 8 |
| **OpenZeppelin ERC-7984** | **None.** Handle paths check `FHE.isAllowed(amount, msg.sender)` (`OZ/token/ERC7984/ERC7984.sol:122, 141, 164, 187, 199-206`) [V]. `_update` grants to `to` without reverting (`:315, :320`; `ACL.allow` checks only the sender, `ACL.sol:234`) [V] | — | Gate `setObserver` (`ERC7984ObserverAccess.sol:28`) and `setOperator` (`ERC7984.sol:107`) on `FHE.isAccountRetired`. Document that `ERC7984ERC20Wrapper.unwrap` with a fresh input publicly decrypts the burnt amount (`:104-110, 217-218`) [V], which leaks the *current* balance (limit 2) | ERC-7984 retirement profile | ≈10–20 per extension | 7 |
| *Coprocessor* (not on the brief's list) | Two compile-time arms (`tfhe_event_propagate.rs:1960-1977, 2846-2860`). Old binaries skip unknown events (`ingest.rs:425-426`) [V] | — | — | — | ≈10 | with 2 |
| *library-solidity* | **None.** `FHE.isUserDecryptable` and `FHE.isDelegatedForUserDecryption` already read the gated views (`FHE.sol:8173-8177, 8187`) [V] | — | `FHE.isAccountRetired` (Impl/IACL) | — | ≈10 | 7 |

---

## 3. Answers to Q1–Q12

**Q1. End state in 2–3 years.**
- **Authority.** The account's own validation, evaluated code-first. On top of it:
  - a one-way lifecycle overlay in the registry views (Active → Retired, plus an optional matured successor);
  - an optional *subordinate* declared PQ decryption signer.
- **PQ-only mode.** No code-less or `0xef0100` signer is accepted anywhere.
- **Per component** (detail in §2):
  - the ACL holds the bit and the guard, under a timelocked owner;
  - the executor is unchanged;
  - connectors read views, verify natively, pin implementations and run a canary;
  - relayers are advisory, with the legacy routes gone;
  - the SDK does lifecycle and uses ephemeral transport keys;
  - the KMS signs responses with ML-DSA end to end and uses a stronger ML-KEM reply channel;
  - the gateway carries the unified path only;
  - governance is timelocked with PQ signers;
  - ERC-7984 extensions honour retirement.
- **Assumption:** the host chain and the gateway chain are themselves PQ-safe. That is Ethereum's roadmap, not ours.
- **Limits:** pre-emptive, not a clawback; oracle access only; as final as the chain's governance.

**Q2.** See §4.

**Q3. Lifecycle states.**
- **Active and Retired are enough on-chain.**
- **SP 800-57 is about key *material*.** Zama's own table keeps Suspended, Deactivated and Compromised keys usable for decryption (`docs/protocol/architecture/kms.md:68-77`) [V]. Retirement denies *authority*, which is closer to certificate revocation. The CA/Browser Forum bans the reversible `certificateHold` for TLS [C].
- **A guardian-lifted suspend is unsound as a protocol state**, for four reasons:
  - if the key can lift it, the thief lifts it;
  - if a guardian lifts it, that is a new trust root;
  - suspension blocks the account's own `allow`, so the user must lift it to carry, which re-exposes the history;
  - it breaks the monotonicity that makes F5 and caching safe.
- **Retire plus successor covers the "freeze" use case.** Compromised versus planned can be an optional event reason code: informational, self-declared, outside Core.

**Q4. Identity versus authority.**
- **Yes, as a subordinate declared signer (Level 3). It is never a root:** B3 holds, because the transaction key can re-grant on-chain.
- **Rules:**
  - it is set by `msg.sender` on the same host chain, and the account can clear it;
  - retirement kills it for free, because the views fail before any signature matters;
  - native verification only for FIPS-final schemes, and any other scheme goes through ERC-7913 `verify` under the execution budget;
  - "no downgrade once declared" is a *negative* rule, so it is a safety property only at ≥9/13 operators (F6), though it serves liveness at ≥5.
- **Storage:** an immutable registry is fine *here*. The connector must read it anyway, and deputies never need it.

**Q5. Continuity.**
- **Both.** Carry (`multicall`, grants first) is Level 0 and the default. A matured, dedicated successor is Level 2 lockout insurance and the straggler path.
- **Encoding: dedicated, not a locked wildcard delegation (SU-14).**
  - It is least privilege: the successor reads only after retirement.
  - A locked wildcard would need special cases in revoke (pause-gated on v0.13.8 `:342`, ungated on main `:386`) [V], in the one-per-block rule (`ACL.sol:337-338`) [V] and in the retirement gate. That means more edits to live paths, not fewer.
  - "No indexer change" buys little, because no consumer of the coprocessor's delegation table authorizes anything [V], and wallets need new UI anyway.

**Q6. Revocation certificate.**
- **As an Extension, for three uses:** lost keys, forgotten chains and custody runbooks.
- **Not as incident response:**
  - a thief bundles exfiltration privately;
  - off-chain permit decryption needs no transaction at all (the HTTP path is invisible);
  - front-running is harmless, because the call is idempotent and the owner signed it;
  - griefing equals the lockout residual, which the successor mitigates;
  - a CRQC forging an ECDSA certificate only *retires* the address, the mildest thing it can do with that key.
- **Cost:** about 50 LoC, ≈50–60K gas for an EOA and ≥1.31M for an ML-DSA 1271 account [E/M-P1]. Priority comes after the successor.

**Q7. Cross-chain.**
- **Per host chain.** The connector selects the ACL by the handle's chain id (`v0.13.8 decryption.rs:90-92, 153-155`) [V].
- **Tooling:** SDK `retireEverywhere`, a chain-agnostic certificate relayed by watchtowers, and re-retiring on destination chains after bridging.
- **Reject LayerZero propagation.** DVN attestations are ECDSA, and the governance OApp is owner-only.
- **Reject a connector "union" rule.** It is a negative rule, costs RPCs per chain, and is unsafe for contract addresses whose controllers differ across chains.

**Q8. Q-day and PQ-only mode.**
- **Who flips it:** operators, at ≥9/13, as connector config. Never ECDSA governance.
- **Preconditions:**
  - the legacy path is removed;
  - Level 1 and an audited Level 3 are live;
  - a readiness KPI is published;
  - notice is given (≥6 months [E]);
  - a recovery path exists: a PQ signer declared before Q-day, or Ethereum's own recovery.
- **Effect per path:**
  - legacy P1/P1d is refused;
  - unified paths refuse code-less and `0xef0100` signers, turn the shim off, and accept regular-code 1271 under the budget and declared PQ signers;
  - a delegated path's delegate must pass the same rule;
  - public decryption and stored results are unaffected;
  - the on-chain door stays Ethereum's to freeze.
- **On-chain signal:** an engage-only signal is informational, never the trigger.

**Q9. Governance.**
- **(a) Timelock.**
  - Make `ACL.owner()` a timelock, which covers the whole host stack (F7), and do the same for the gateway owner.
  - Pausing stays fast through PauserSet. Retirement is not pause-gated, so pausing cannot touch it.
  - The exit window does not help a user: a malicious ACL can grant anything. It serves *operators*: with pinning and the canary, "governance alone" becomes "governance plus ≥5 operators".
  - Proposers and cancellers should be PQ-capable smart-account multisigs (≈1.23M gas per ML-DSA check [M-P1]; acceptable for rare actions).
- **(b) Survival across releases.** Use the release rule with three locks:
  1. a CI test on every line (Core selectors, plus a negative upgrade test);
  2. the F4 guard;
  3. an operator **retirement canary**: a known retired address with a known allowed handle, for which `isAllowed` must stay false, or the operator halts. It costs one RPC per `Upgraded` event.
- **No immutable registry as the primary store.**
  - It protects the bits, not the enforcement: a Core-less ACL simply would not read it.
  - Connector reads would cost +1 RPC, need 9/13 adoption, and miss deputies.
  - It helps only for an ACL *redeployment* at a new address, which Zama's stable proxies avoid.
- **(c) Numbering:** F2.

**Q10. Vendor neutrality.** Any oracle MUST:
1. decide user decryption by reading the registry views, with no node-only MUST rule;
2. bound its freshness lag;
3. issue no *new* decryption material for a retired authority, directly or through delegation;
4. re-check requests in flight longer than the lag (SHOULD; Zama main does [V], v0.13.8 is unchecked).

A separate **PQ profile** requires a reply-channel KEM that includes ML-KEM (FIPS 203) and SHOULDs per-request transport keys. Vendors:
- **Zama** passes Core with zero change; its reply channel is ML-KEM-512 [V].
- **Fhenix** can pass Core through its ACL (Teecryptor reads it [V-P1]), but not the PQ profile (X25519).
- **Inco:** I did not check its ECIES inputs. Input encryption should be a separate clause.

**Q11.** See §2.

**Q12. Conformance.** Core and Extensions are in §5.
- **Off-chain verifier.** It conforms iff every *positive* user-decryption decision for account A is conditioned on registry views evaluated within the lag, and it releases no new material when they fail.
- **Threshold systems.** Conformance is per node. Because Core lives in the views, any node that reads them conforms with **no code change**. That is the reason Core belongs in the views.
- **Zama status:**
  - the v0.13.8 and main connectors conform [V];
  - the relayer and SDK are advisory prechecks (gateway callers pay fees and can bypass them [V-P1]), so they SHOULD conform;
  - re-serving stored ciphertext to the same transport key is not "new material".
- **Testable Core statements:**
  - after inclusion, `isAllowed(h, A)` is false for every non-compute caller, and `persistAllowed(h, A)` is false;
  - both delegation views are false with A in either role;
  - `delegateFor…` from A reverts;
  - `allow(h, A)` by an allowed sender succeeds;
  - `retireAccount` succeeds while paused;
  - no path un-retires;
  - a retired A can compute but cannot export.

---

## 4. V1 ideas

| V1 idea | Verdict | Final form | Level | Why |
|---|---|---|---|---|
| **C1 sealing** | **Returns** | Read-side `retired` bit in the views; no sentinel, no write-side guards | 0 | The sentinel is inert on deployed and redundant on main; deputies bypass write guards |
| **C2 carry-and-seal UX** | **Returns as UX only** | SDK wizard over `multicall([allow…, retireAccount()])`, grants first and chunked | 0 (tool at 2) | `multicall` already does it. A sanctioned `carryAndSeal` adds no capability; phishing risk is the same either way, so wallets must decode the grants |
| **C3 connector-side rules** | **Transformed** | Code-first ordering plus the 7702 shim; "7702 is not a safe destination" becomes wallet guidance | 1 | The EIP-8151 rule accepts 7702 root keys; code-first inherits 8298/8151 |
| **C4(a) code-hash allowlist** | **Does not return** | Execution-gas budget plus length cap | 1 | Proxies defeat it, it spans three layers, and it amplifies DoS |
| **C4(b) native PQ (`pqAuthKey`)** | **Returns** | ERC-7913 declared decryption signer, subordinate, FIPS-final, after audit | 3 | Cheaper than `ecrecover` [M-03]; ERC-7913 is final |
| **C4(c) precompiles** | **Inherited** | Used automatically under the budget | 1+ | Calldata is 71% of 250k for ML-DSA-44 [M-03] |
| **C5 fail-closed** | **Returns as operator policy** | PQ-only mode at ≥9/13 with preconditions; no governance flag | 3 | Today it is an outage, and the ECDSA flipper falls first |
| **ERC-7984 PQ profile** | **Returns, reshaped** | Vendor-neutral ERC: Core plus Extensions. V1's R1 → Core; R2 → oracle guidance (L1); R3 → PQ-only mode; R4 → declared signer. New: identity-gated grant paths honour retirement | 0–3 | V1's normative split was right; its interface (`allowMany`, `carryAndSeal`) was not |

**Semih's instinct, tested.**
- **Broader: yes.** V1 had the right skeleton:
  - lifecycle, not cryptography, is the problem;
  - both doors close on one decision (principle 2), and the read-side bit is the literal version of that;
  - there is a PQ destination, a Q-day posture, and a standard.
  - The v2 review shrank all of this to "PR-1" for mergeability. This phase restores it as Levels 1–3.
- **Better: only in ambition.** V1 also carried a wrong theory of control: that one governance switch protects everyone at Q-day. B8 shows the switch-holder falls first, and F6 shows that any node rule needs 9/13 operators.
- **Narrower in threat coverage.** V1 missed the deputies, the deployed line, stored results, multiple chains, app roles and governance, and it claimed no residual risk.
- **Verdict:** restore V1's *scope*; keep v2's *theory of enforcement* and its three limits.

---

## 5. Core versus Extensions

| Item | Status | Zama component |
|---|---|---|
| `retireAccount()`, `isAccountRetired`, `AccountRetired(account, successor)`; gated views; no new delegations; inbound grants inert; not pausable; no un-retire; compute exemption without export | **Core, MUST** | ACL |
| Upgrade guard for upgradeable registries (F4) | **Core, SHOULD** | ACL / governance |
| Oracle conformance (Q12); terminal "retired" denials | **Core MUST** / MAY | connector |
| Signature hygiene (code-first, execution budget) | **Oracle guidance, SHOULD**, not an Extension | shared crate |
| Successor (dedicated, matured) | **Extension** | ACL |
| Declared Decryption Signer (ERC-7913, PQ) | **Extension** | registry, connector, SDK |
| Revocation Certificate, including a chain-agnostic variant (this *is* the cross-chain extension; no separate one) | **Extension** | ACL, SDK |
| PQ-only Mode signalling (operator policy; on-chain signal informational) | **Extension** | connector, operators |
| ERC-7984 profile: identity-gated grants honour retirement | **Application profile, SHOULD** | OpenZeppelin |
| Suspend; reason codes in Core; LayerZero propagation; immutable registry as primary store | **Rejected** | — |

---

## 6. Expected disagreements

- **A2 (clean slate)** will want authority separate from identity as the *root*, PQ-only by default, and a non-upgradeable registry. My reply: B3 forces subordination, deputies need the views, and an external registry only moves the release-rule problem.
- **A4 (red team)** will attack the F4 guard (lying implementations), the executor exemption and the unnoticed attacker successor. I accept them as stated residuals; none is worse than the status quo.
- **A5 (accounts)** will push terminal 1271 failures and native verification *now*. My reply: Zama documented the opposite rationale, so propose total-gas bounds; native verification waits for an audit.
- **A6 (product)** will want suspend, reason codes, a one-click successor and certificates early. Suspend is unsound (Q3), and instant successors were rejected at G1.
- **A1 (ERC editor)** may resist naming a compute exemption in normative text. I would phrase it abstractly: "compute-only callers that cannot export".
- **Most agents may assume a 0.13.x backport.** F2 and F3 argue for "the next production line".

## 7. Open questions

1. Which ACL line will production adopt next, and when (F3)?
2. Would Zama accept the F4 guard, and what escape hatch?
3. v0.13.8 connector checks I could not make locally (blobs absent): the attempt default, the in-flight re-check and the test harness files. The real-connector proof needs a separate checkout of the tag.
4. Is the mock ACL's `>=` drift intentional (F1 caveat d)?
5. Polygon's deployed ACL owner and timelock status.
6. The production per-context user-decryption threshold (t).
7. Demand evidence for the successor (named integrators).
8. Cross-vectors between `ml-dsa` 0.1.1 and the Fireblocks verifier; audit timeline.
9. The deprecation date of the legacy gateway path, which decides when Level 1 reaches mainnet users.
