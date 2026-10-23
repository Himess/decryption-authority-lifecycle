# Deliberation summary: Decryption Authority Lifecycle

**Date:** 2026-10-21. **Status:** the judge's rulings. `docs/TARGET_ARCHITECTURE.md`, the ERC draft and the Level 0–3 prototype follow this file.

**Inputs:**
- deliberations A1 (standards), A2 (clean slate), A3 (Zama engineer), A4 (red team), A5 (AA and PQ accounts), A6 (product and institutions);
- `COORDINATOR_VERIFICATION.md`;
- the judge's file `A7_judge.md`, which holds the evidence (file:line), the label for every claim, and the explicit rulings on the coordinator's seven points (§1a).

**Labels:**

| Label | Meaning |
|---|---|
| [V] | Verified in code; the judge's file names who verified it and where |
| [M] | Measured; the source is named |
| [E] | Estimate |
| [I] | Inference |
| [C] | Cited from a specification or web page, not reproduced |

**Thesis.**
> In oracle-based confidential execution, the confidentiality of past data is decided again at every decryption request. The ciphertexts can be post-quantum while the authority to ask is an ECDSA key bound to an address. This design adds the missing lifecycle step, **revocable access**:
> - an account can **retire** its authority to ask;
> - every conforming oracle then refuses every request that rests on that authority;
> - the state lives in the on-chain views the oracle already consults.

**The three limits, stated every time:**
1. **Pre-emptive, not a clawback.** Whatever the key already re-shared, published or had decrypted stays exposed.
2. **Oracle access only.** Retirement stops the oracle honouring the key. It does not stop the key acting as an account (funds, application roles).
3. **As final as the chain's governance.** Retirement is per host chain, and whoever can upgrade that chain's contracts can undo it.

**Vocabulary:** "revocable access", "retire" (TR: *emekliye ayırmak*). The two terms that brief §1 bans are not used.

---

## (a) Gate G2-design: PASS. The Core mechanism is sound

The read-side retirement bit is sound. Its four premises were re-verified in code by the judge, and independently by the coordinator:
1. **Every off-chain decider reads only gated views.**
   - Connectors: v0.13.8 (`isAllowed(h, user)` + `isAllowed(h, contract)`; delegated: `isHandleDelegatedForUserDecryption` only) and main (legacy and unified).
   - The connector's whole ACL surface is four views, called with no `from`.
   - Also the SDK precheck and Zama's cleartext mock.
2. **Every on-chain export re-enters `isAllowed` with the exporter as subject:** ACL writes, `FHE.fromExternal(h, "")`, OZ ERC-7984 handle transfers and disclosure, and the bridge `send`.
3. **The engine exemption is not an export route on Zama.** It rests on one operand choke point (`FHEVMExecutor.sol:1062-1065`) and transient grants only to `msg.sender` (`:864, :1046`).
4. **The deployed gateway performs no ACL check** (`v0.13.8:Decryption.sol:724`).

**Three specification corrections.** None of them makes the mechanism unsound; all are folded into Level 0:
- **(a) Contract gating.** Gate the contract role in both delegated views. Today a retired contract still passes on the delegated path (`ACL.sol:568`; `v0.13.8:ACL.sol:485`).
- **(b) Semantic exemption.** Define the engine exemption by call semantics. A caller-identity rule ported to Fhenix, whose TaskManager relays every ACL call, would switch retirement off.
- **(c) Release trains.** A 0.4.1 backport upgraded to 0.6.0 or 0.7.0 silently drops enforcement. Fix it with an on-chain upgrade guard (ERC-165 Core support plus the storage location).

The Extensions and Profiles carry their own residuals. The two criticals the red team found are:
- PQ-only mode is bypassable without a host-chain freeze;
- a caller-identity exemption is dangerous on relaying engines.

Both are resolved by specification. Neither touches the Core mechanism.

---

## (b) Core versus Extensions

### b.1 Terms

| Term | Meaning |
|---|---|
| **Registry** | The host-chain contract whose views decide use and decryption rights (Zama `ACL`, Fhenix `ACL`) |
| **Engine** | The fixed computation contract (Zama FHEVMExecutor; Fhenix TaskManager) |
| **Verifier** | A component whose decision gates release (connector, TEE dispatcher). SDK and relayer prechecks are advisory |
| **Oracle** | The set of nodes. With t+1 = 5 of 13 responses reconstructing (`api-p.ts:405-418`), a restriction binds only when ≥ n−t = 9 nodes enforce it |
| **Subject** | Every party a request rests on: requester, owner or delegator, delegate, contract, permit issuer, permit recipient |
| **Grant path** | A call that extends rights over a handle, publishes it, or creates a delegation or permit |
| **Deputy** | A contract acting after checking `isAllowed(h, caller)` |
| **ICS** | Implementation Conformance Statement |

### b.2 Core (MUST). Registry

- **R1. Retire.** `retireAccount()` marks `msg.sender` retired and emits `AccountRetired(account, successor)`, where `successor` is the confirmed E1 successor or `address(0)`. A second retirement reverts with `AccountAlreadyRetired(account)`.
- **R2. One-way.** No function, privileged or not, clears it.
- **R3. Unconditional.** Not gated by pause, deny list, role, fee or holdings. Works for contracts.
- **R4. Grants nothing.** Retirement creates or extends no right (E1 activates only a successor pre-committed while the key was safe).
- **R5. Immediate.** Effective for every view from the block of inclusion.
- **R6. Every role.** No retired account satisfies any authorization view in any role it plays:
  - use views (`isAllowed`, `persistAllowed`);
  - on-behalf views (delegator, delegate **and contract**);
  - permit views (issuer **and recipient**).
  - The only exception is R10. E1 amends the delegator case.
- **R7. Grant paths revert for a retired caller.** This covers `allow`, publication, transient grants outside the engine, batches and delegation creation. Implementations SHOULD revert with `SenderRetired(caller)`.
- **R8. Inbound grants never revert because the recipient is retired.** They are inert.
- **R9. Public decryption is unchanged.** Retirement never un-publishes.
- **R10. Engine exemption, defined by semantics:**
  - A registry MAY exempt exactly one class of evaluation: authorising an operand's use as input to a computation the engine performs for its caller. In that evaluation the subject is the calling contract, and every output is granted only to that contract and only for the transaction.
  - It MUST NOT apply to any evaluation that gates a grant, a publication, a delegation, a cross-chain transfer, a permit or a deputy action, nor to any answer returned to an off-chain verifier or another contract.
  - Caller-identity implementations are allowed only if the identified caller (i) uses the view for nothing else, (ii) never relays third-party requests, and (iii) grants outputs only transiently to itself or its direct caller. Relaying engines MUST use a dedicated operand-check entry point.
- **R11. Upgrades preserve state and enforcement.**
  - State SHOULD live in a dedicated ERC-7201 namespace.
  - A registry whose upgrade authorization runs registry code (UUPS) MUST refuse any new implementation that does not (a) report ERC-165 support for the Core interface **and** (b) report the same retirement storage location. Other proxy patterns SHOULD enforce the same in their admin or governance tooling.
- **R12. ERC-165.** `supportsInterface(0x556d2088)` returns true. The id is `retireAccount()` `0xe7142996` XOR `isAccountRetired(address)` `0xb279091e`.
- **R13. Batching.** The registry SHOULD offer caller-preserving batching (`multicall`), so that grants followed by `retireAccount()` are atomic.
- **R14. Raw getters.** Getters that the registry documents as liveness indicators SHOULD reflect retirement. No authorization MAY rely on raw getters (for example `allowedTransient`).

### b.3 Core (MUST). Verifier

- **V1. Release rule.**
  - No release, no forwarding for release and no share unless every applicable view returned true at decision time, for every subject, on the registry of the handle's host chain.
  - Errors, reverts and timeouts never release.
- **V2. Freshness.** Views are evaluated after the request arrives, at a block within a declared lag. No positive answer is reused across requests or blocks.
- **V3. No exemption spoofing.** Views are never evaluated with the engine as the `eth_call` sender.
- **V4. No bypass.** No signature scheme or path bypasses V1: EOA, ERC-1271, declared signer, or the legacy gateway path.
- **V5. Replicas.** Replicas apply lifecycle events, or do not authorize.
- **V6 (SHOULD; MUST in Profile H).** Re-apply V1 before serving a stored result. The ICS states the stored-result policy.
- **V7 (SHOULD; MUST in Profile H).** A denial caused by retirement is final and typed (`ACCOUNT_RETIRED`). It is never retried and never revived.

### b.4 Core (MUST). Oracle

- **O1. Conformance per deployment.** A threshold oracle conforms only if ≥ n−t nodes run conforming verifiers. A TEE oracle conforms if its node does.
- **O2. ICS.** The oracle publishes:
  - chain id and registry address; interface ids;
  - upgrade authority and timelock; engine address;
  - n and t; profiles per node; decision lag; stored-result policy;
  - reply KEM; ERC-1271 budget and caps;
  - **host-state sources** (RPC providers, own nodes or light clients), in aggregate.
- **O3 (SHOULD). Host-state diversity.** No single host-state source, or correlated set, determines the view answers of ≥ t+1 nodes. Nodes SHOULD confirm positive answers against an own node, a light client, or two independent providers that must agree.

### b.5 Extensions (OPTIONAL)

**E1. Successor.** ERC-165 `0x7dc5e209`; optional delay sub-interface `0xc61ca396`.
- **Lifecycle:** designate (by the account) → **accept (a transaction from the successor; mandatory)** → confirm (by the account, at or after `confirmableAt`) → locked.
- **D:** registry-wide D MUST be ≥ 7 days (RECOMMENDED 7). `confirmableAt` is fixed at designation. A per-account raise-only D is a MAY, capped at 365 days.
- **Locked means:** the old key can neither replace nor cancel a confirmed successor. Only the successor clears it, by resigning, at any time.
- **Frozen at retirement:** a pending designation is voided; no designation, acceptance, confirmation or cancellation afterwards. Resignation remains possible.
- **Read right after retirement only.** On-behalf views for (account, successor, contract, handle) return exactly what an active wildcard delegation would. Every other delegate gets false. Before retirement the successor has no right.
- **Decrypt-as only.** No use, grant, publication or compute. No transitivity.
- **Who can be a successor:** never a key-derived address (it cannot accept). Clients MUST NOT treat a successor as a payment address or redirect target, and MUST surface pending designations.

**E2. Retirement Certificate.** ERC-165 `0x4b9ec076`.
- **Format:** EIP-712 `RetireAccount(address account,address successor,uint256[] chainIds)`, type hash `0xf224379ad7473578295885cb7fd6795dbf8c4d718c2bd07d70c8f1e5ecaac54b`. The domain is `EIP712Domain(string name,string version)` = (`"DecryptionAuthorityLifecycle"`, `"1"`): chain-agnostic, with scope set by `chainIds`.
- **Submission:** anyone may submit `retireAccountWithSig(account, successor, chainIds, signature)`.
- **Requirements:**
  - `block.chainid ∈ chainIds`;
  - **a confirmed successor equal to `successor` (≠ 0)**, enforced by the registry;
  - a valid signature, code-first (OZ `SignatureChecker` semantics: no code → 65-byte low-s ECDSA; any code → ERC-1271; no shim).
- **Effects:** those of R1–R5. A second retirement reverts.
- **What it never does:** designate, confirm or change a successor, or grant. It has no nonce, no expiry and no cancellation by the key. Not pausable.

**E3. Declared Decryption Signer (key-derived address, KDA).**
- **Encoding:**
  - `signerBytes = verifierId(20) ‖ publicKey` (ERC-7913 layout). `verifierId` is a reserved native-scheme identifier; no contract verifiers in this version.
  - `KDA = address(uint160(uint256(keccak256("ERC-XXXX key-derived decryption signer v1" ‖ signerBytes))))`.
  - Declared by the account's own `delegateForUserDecryption(KDA, contract | WILDCARD, expiry)`.
- **Rules:**
  - The route applies only to delegated entries (`ownerAddress = account ≠ KDA`). It is never a direct owner and never a successor.
  - The request uses `userAddress = KDA` and `signature = abi.encode(signerBytes, sig)`.
  - Verification is native, with empty context, over the same EIP-712 digest. Failure rejects, with no fallback.
  - Schemes: FIPS 204 and FIPS 205 now; FN-DSA only once FIPS 206 is final.
  - Vectors: ACVP sigVer and Wycheproof.
  - A library bug must not reach t+1 nodes: either two implementations must agree, or no library runs on ≥ t+1 nodes.
  - No `WithSig` path. Retirement and revocation kill it. Finite expiry by default in wallets.
- **Profile Q:** the B_Q rule applies.
- **Scope:** main's unified path only.

### b.6 Profiles (OPTIONAL)

**H. Hygiene (verifier).** Code-first ordering, then:
- **7702 shim:** a fallback only on a *successful* ERC-1271 call with empty return data and a 65-byte signature. Never on an empty revert. Off under Q.
- **Code reads:** at the same block as the ERC-1271 call; no code caching across blocks.
- **Budget:** `gas_limit = B_exec + 21,000 + 64 × calldata bytes`, B_exec default 2,000,000.
- **Caps:** signature ≤ 64 KiB, plus caps on `publicKey` and `extraData`, checked before any RPC.
- **Attempts:** ≤ 2 for ERC-1271 negatives, the second at least one block later.
- **Retirement denials:** final (V7).
- **Legacy ECDSA path:** refuse users or delegates with regular host-chain code (the EIP-8298 case).
- **Stored results:** re-check them (V6). Dedup is keyed on signature and validity window.
- **Rollout:** shadow mode, logging only, before enforcing.

**Q. PQ-only (oracle).**
- **Trigger:** ≥ n−t operators commit, then activate together at an announced block B_Q. The signal is PQ-signed operator statements plus the ICS. An on-chain record is informational, never a trigger.
- **Preconditions:** H, E3 and legacy refusal live at ≥ n−t; a readiness KPI; a recovery path; timelock and pinning.
- **Notice:** ≥ 24 months scheduled, never later than the host chain's own ECDSA deactivation. Emergency activation only on (i) host-chain ECDSA deactivation, or (ii) credible public CRQC evidence declared by ≥ n−t operators.
- **Effects:** refuse code-less and `0xef0100` signers and the legacy path. Variants: no-root-ECDSA, or strict. The B_Q rule applies to ECDSA-rooted delegators.
- **PQ claim:** requires a FIPS 203 reply KEM (or a hybrid including one) **and** PQ input encryption.
- **Claim limit:** **no protective claim for unmigrated ECDSA accounts on a host chain that still accepts their ECDSA transactions.**
- **Disengagement** is a rights-widening change (governance rule).

**A. Applications.**
- Identity-gated grant paths (observer, operator, owner-only grants) revert for a retired account. **Clearing and revoking stay allowed.**
- Never block inbound transfers. SHOULD NOT block outbound ones. MAY refuse transfers *to* retired accounts.
- Never assert `isAllowed(h, recipient)` after granting.
- Generic-call paths SHOULD refuse lifecycle selectors.

### b.7 Informative parts

- **Governance profile:**
  - a timelock owns every authorization-path contract and pointer (`ACL.owner()` covers the host stack through `ACLOwnable`), plus the gateway owner;
  - pause is the only emergency power;
  - PQ signers;
  - ≥ n−t operator ratification of rights-widening upgrades (ProtocolConfig pattern);
  - retirement canary; implementation pinning.
- **Wallet guidance:** per-chain status, typed errors, ERC-7730 descriptors, confirmation levels, EN/TR copy, a fixed glossary.
- **Carry procedure.**

### b.8 Not standardized

- A Suspended state.
- Reason codes.
- An on-chain PQ-only flag or trigger.
- A registry-level ECDSA sunset (deferred research).
- Cross-chain propagation; an oracle "union" of retirements.
- A carry function; retirement through the deny list.
- An immutable registry as the primary store (deferred).
- Successor-issued delegations (deferred).
- An exclusive (no-downgrade) declared signer (deferred).
- A hash-commitment certificate (deferred).
- The cross-chain extension as a separate part: it is E2's chain list plus per-chain semantics.

---

## (c) Level 0 spec: exact deltas from DESIGN_REVIEW §6.2

**What changes against §6.2:**
1. contract gating in both delegated views;
2. a semantic exemption definition, with invariant tests;
3. an upgrade guard (ERC-165 + location), with the `UpgradeDropsRetirement` error and the `retirementStorageLocation()` getter;
4. ERC-165 `supportsInterface`;
5. typed `SenderRetired` on grant-path failures;
6. the delegation-expiry getter returns 0 for retired parties;
7. backport built from the `v0.13.8` tag; optional 0.14-line target;
8. mock and connector test rules.

**Unchanged from §6.2:**
- the namespace and location;
- `retireAccount()` and `isAccountRetired(address)` and their selectors;
- the event;
- the two existing errors;
- not pause-gated, no un-retire;
- `isAllowed`, `persistAllowed` and delegator/delegate gating;
- `delegateForUserDecryption` reverting for a retired sender;
- zero new RPCs.

### c.1 Targets, versions and reinitializers

| Target | ACL version | `REINITIALIZER_VERSION` | Reinitializer (empty body) | Built from | Status |
|---|---|---|---|---|---|
| main | 0.7.0 → **0.8.0** | 8 → **9** | `reinitializeV8()` | main `ed851716c` | required |
| v0.13 line | 0.4.0 → **0.4.1** | 5 → **6** | `reinitializeV5()` | **`v0.13.8` tag source** (expiry `>`); `mock/cleartext/CleartextACL` is re-pointed at it | required |
| v0.14 line | 0.5.0 → **0.5.1** | 6 → **7** | `reinitializeV6()` | `v0.14.2` tag source | optional for Level 0 green; required before any proposal that targets 0.14.x |

**Notes:**
- **CI naming** (`reinitializeV{N-1}`; a bump on any bytecode change; `ci/upgrade-check/lib.ts:144-169`) is satisfied on every line.
- **Collisions with Core-less releases** are intended and harmless: 0.4.1 ↔ 0.5.0 and 0.5.1 ↔ 0.6.0 revert with `InvalidInitialization`.
- **Skip-upgrades** (0.4.1 → 0.6.0/0.7.0) are caught by the guard (c.7).
- **Later levels** bump again per line (prototype only). Before any second production backport, fix a release plan with strictly increasing reinitializers across the lines production may cross.

### c.2 Storage (both lines; unchanged location)

```solidity
/// @custom:storage-location erc7201:fhevm.storage.ACLRetirement
struct ACLRetirementStorage {
    mapping(address account => bool isRetired) retired;
    // Level 2 appends here, in the same namespace: succession, successorDelayOf
}
/// keccak256(abi.encode(uint256(keccak256("fhevm.storage.ACLRetirement")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant ACL_RETIREMENT_STORAGE_LOCATION =
    0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200;
bytes4 private constant DAL_CORE_INTERFACE_ID = 0x556d2088;
```

The `fhevm.storage.ACL` layout is byte-identical: 4 fields on 0.4.x, 5 on 0.5.x and later.

### c.3 Functions

| Function | Selector | New or changed | Notes |
|---|---|---|---|
| `retireAccount()` | `0xe7142996` | new (as §6.2) | no `whenNotPaused`, no deny-list check; reverts `AccountAlreadyRetired(msg.sender)` if already retired; emits `AccountRetired(msg.sender, address(0))` (Level 2: the confirmed successor) |
| `isAccountRetired(address)` | `0xb279091e` | new (as §6.2) | view |
| `supportsInterface(bytes4)` | `0x01ffc9a7` | **new** | true for `0x01ffc9a7` and `0x556d2088` (later levels add `0x7dc5e209`, `0xc61ca396`, `0x4b9ec076`) |
| `retirementStorageLocation()` | `0xc89c7ccd` | **new** | `pure`; returns the location; read by the guard |
| `reinitializeV8()` / `reinitializeV5()` / `reinitializeV6()` | — | renamed per line | empty |

No new selector clashes with the 36 existing main ACL functions or the public constants (checked with `cast`).

### c.4 Events and errors

- **Event (unchanged):** `AccountRetired(address indexed account, address indexed successor)`. **No reason code.**
- **Errors:** `AccountAlreadyRetired(address account)` and `SenderRetired(address sender)` (both as §6.2), plus **new** `UpgradeDropsRetirement(address newImplementation)`.

### c.5 View checks

```solidity
function _retired() internal pure returns (ACLRetirementStorage storage $) {
    assembly { $.slot := ACL_RETIREMENT_STORAGE_LOCATION }
}

// isAllowed (main :517-519; v0.13.8 :452-454). The engine path never reads the retirement slot.
function isAllowed(bytes32 handle, address account) public view virtual returns (bool) {
    if (msg.sender != FHEVM_EXECUTOR_ADDRESS && _retired().retired[account]) return false;
    return allowedTransient(handle, account) || _getACLStorage().persistedAllowedPairs[handle][account];
}

// persistAllowed (main :582-585; v0.13.8 :499-502)
function persistAllowed(bytes32 handle, address account) public view virtual returns (bool) {
    return _getACLStorage().persistedAllowedPairs[handle][account] && !_retired().retired[account];
}

// First statement of:
//   isHandleDelegatedForUserDecryption (main :561-574; v0.13.8 :478-491)
//   isDelegatedForUserDecryption       (main :538-547)
if (_retired().retired[delegator] || _retired().retired[delegate] || _retired().retired[contractAddress]) return false;   // NEW: contract

// First statement of getUserDecryptionDelegationExpirationDate (main :445-455; v0.13.8 :401-411)
if (_retired().retired[delegator] || _retired().retired[delegate] || _retired().retired[contractAddress]) return 0;       // NEW
```

`allowedTransient` (main `:474`) stays raw. It is the transient primitive under `isAllowed` and is documented as non-authoritative. `isAllowedForDecryption` is unchanged.

### c.6 Grant paths

- **`allow`, `allowForDecryption`, `allowTransient`** (in its non-executor, non-bridge branch). Only the failure branch changes, so byte-identical behaviour holds for every non-retired sender:

  ```solidity
  if (!isAllowed(handle, msg.sender)) {
      if (_retired().retired[msg.sender]) revert SenderRetired(msg.sender);
      revert SenderNotAllowed(msg.sender);
  }
  ```
- **`delegateForUserDecryption`** (main `:326-377`; v0.13.8 `:283-334`). First statement: `if (_retired().retired[msg.sender]) revert SenderRetired(msg.sender);`. Delegating *to* a retired delegate, or for a retired contract, does not revert; it is inert, by R8.
- **Unchanged:**
  - `multicall`;
  - `revokeDelegationForUserDecryption` (callable by retired accounts; pause-gated only on v0.13.8);
  - `invalidateDecryptionSignaturesBefore` (main);
  - `blockAccount` and `unblockAccount`: the deny list stays governance-only and never touches retirement;
  - `pause` and `unpause`: they never gate retirement or any view.

### c.7 Upgrade guard (Core MUST for UUPS registries)

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

- **Both checks are needed.** ERC-165 alone passes a Core-declaring release whose namespace drifted, which would reset every retirement. The location check alone passes a release that kept the getter but dropped Core.
- **No escape hatch.** The rollback target for a buggy Core release is a patched Core release.
- **Limit.** It stops accidents, not a lying implementation (canary and pinning, Level 3).

### c.8 Exemption: normative definition and Zama invariants

- **Normative text:** b.2 R10.
- **Zama implementation:** the constant compare `msg.sender != FHEVM_EXECUTOR_ADDRESS` in `isAllowed` only. Valid because of three invariants, each pinned by a test:
  1. the executor reads `isAllowed` only in `_consumeOperand`, with `msg.sender` as subject (`FHEVMExecutor.sol:1062-1065`);
  2. every executor `allowTransient` names `msg.sender` (`:864, :1046`);
  3. no other host contract reads the views as the executor.
- **Verifier side:** no `eth_call` sets `from` (`rpc.rs:24-67`).

### c.9 Second retirement

`retireAccount()` reverts with `AccountAlreadyRetired(msg.sender)` and emits no second event. E2 behaves the same (Level 3). Watchtowers pre-check and batch with failure-tolerant multicall.

### c.10 Off-chain and coupling

- **Zero new RPCs.** The delegated views do one more SLOAD for the contract role inside an existing `eth_call`.
- **Coprocessor host-listener:** compile-time match arms for `AccountRetired`. Old binaries skip unknown events (`ingest.rs:424-426`).
- **No change** to the connector, relayer, SDK, KMS or gateway for correctness.
- **Size:** about 75–90 Solidity lines per line, against about 55 in §6.2 [E]. Check the EIP-170 size limit in CI.

### c.11 Level 0 tests

**Foundry (`host-contracts/test/acl`, main and backport):**
1. Views per role: retired user, delegator, delegate, **contract**; both delegated views; the gated getter; `persistAllowed`; inbound grants accepted and inert.
2. Exemption, with one test per export path. A retired 7702 EOA or contract computes through the executor, then tries each of: `allow`, `allowForDecryption`, `allowTransient`, `multicall`, `delegateForUserDecryption`, `fromExternal(h, "")`, ERC-7984 handle transfers and `requestDiscloseEncryptedAmount`, bridge `send` (main). Every attempt reverts. Plus the three invariant tests (c.8).
3. Typed errors; ERC-165; second retirement reverts; retirement works while paused and while deny-listed; carry during a pause reverts; `multicall([allow…, retireAccount()])` is atomic and the reverse order reverts.
4. Upgrade matrix:
   - U1: 0.4.0 → 0.4.1 (layout; `validateUpgrade`);
   - U2: 0.4.1 → 0.8.0 (bits and enforcement preserved);
   - U3: guard-less 0.4.1 → 0.7.0 succeeds and enforcement lapses (hazard demo);
   - U4: 0.4.1 → 0.7.0 reverts `UpgradeDropsRetirement`;
   - U4b: a Core-declaring implementation with another namespace reverts;
   - U5: 0.4.1 → 0.5.0 reverts `InvalidInitialization`;
   - U6 (optional): 0.4.1 → 0.5.1 → 0.8.0;
   - U7: a lying implementation passes the guard (asserted residual).
5. Differential: never-retired accounts are byte-identical across Zama's existing ACL suites. Executor within ±25 gas per operand. **[Post-implementation note, 2026-10-21]** Not met. Measured +44–92 per operand on main and +114–137 on the v0.13 line (about 0.3–0.7% of an executor call); the bound is restated as ≤ +100 / ≤ +140. Also, U5 reverts with `UpgradeDropsRetirement` because the guard runs first; see results/level0/LEVEL0_CONTRACTS.md (D1, D2).
6. SU-1 survey: OZ ERC-7984 0.5.3 has no post-grant `isAllowed(h, recipient)` assert; survey Zama's example apps.

**Zama cleartext mock, end to end on anvil:**
- `CleartextACL` inherits the 0.4.1 backport.
- Use a **non-forge KMS signer set**, so that `CleartextKMSVerifier.userDecrypt/delegatedUserDecrypt` runs. The forge single-signer mode skips it.
- Show:
  - a never-retired user decrypts;
  - after carry and retire, NEW decrypts the history;
  - OLD is refused;
  - delegations from and to OLD are refused;
  - a retired contract is refused on both the direct and the delegated path.
- No assertion pins the exact expiry second.
- Label: "proven in mock: `persistAllowed` + delegated view + flow; plaintext is public in the mock".

**Real connector harness:**
- The **unmodified** kms-worker at v0.13.8 and at main, against the real ACL on anvil. The `Asserter` mock is replaced by an anvil provider; Postgres 17.5 via testcontainers; gateway and KMS mocked as in `tests/acl.rs`.
- Show:
  - a retired user is rejected before the KMS;
  - a never-retired user is forwarded;
  - a retired delegator, delegate or **contract** on the delegated legacy path is rejected;
  - main unified direct and delegated entries are handled correctly.
- Label: "proven in real connector". This is the only place the `isAllowed` path is proven.

**Measurements (brief §6), each labelled with hardware, date and commit:**
- `retireAccount`;
- `isAllowed` overhead on the executor and non-executor paths;
- the ERC-7984 transfer delta;
- carry at n = 1, 10, 100, 500;
- delegated-view gas with the contract check;
- connector latency (expected unchanged).

---

## (d) Levels 1–3 as ruled

### d.1 Level 1: signature hygiene (Profile H; main unified paths; local diffs)

**Where:**
- `shared/user-decryption-signature/src/lib.rs` (`verify_signature :196-211`, `check_erc1271_signature :123-186`);
- the connector config (`config.rs:274-276`);
- the legacy relayer's required config;
- the SDK constant `ERC1271_GAS_LIMIT` (`verifyErc1271UserDecrypt-p.ts:28`).

All three places get the same values.

**Configuration (defaults):**

| Key | Default |
|---|---|
| `erc1271_execution_budget` | 2,000,000 |
| `max_user_signature_bytes` | 65,536 |
| `max_public_key_bytes` | 4,096 [E] |
| `max_extra_data_bytes` | 1,024 [E] |
| `max_erc1271_attempts` | 2 |
| `code_first_mode` | `off` → `shadow` → `enforce` |
| `refuse_regular_code_on_legacy` | false → true |

**Rules:**
1. **Caps before any RPC** (irrecoverable).
2. **Code-first** at one block B: `eth_getCode(user, B)` and the ERC-1271 call at B; no code caching across blocks.
   - Empty code: 65-byte `ecrecover` only.
   - `0xef0100 ‖ d` (exactly 23 bytes): ERC-1271 on the account. Shim to `ecrecover` **only** if the call succeeds with empty return data and the signature is 65 bytes.
   - Any other code: ERC-1271 only.
3. **Budget:** `gas_limit = B_exec + 21,000 + 64 × len(calldata)`. Worst-case *execution* work per request per operator is 2 × 2M = 4M gas, against 20 × 250k = 5M today [E].
4. **Attempts:** at most one retry for `WrongMagic`, `Rejected` and `EmptyRevert`, at least one block later. Transport errors keep the existing policy. `EoaMismatchNoCode` and `EmptySigOnEoa` stay irrecoverable.
5. **Final retirement denials:** on an ACL denial, call `isAccountRetired(subject)`; if true, the denial is irrecoverable with `ACCOUNT_RETIRED`.
6. **Legacy path:** refuse users or delegates whose host-chain code is regular (the EIP-8298 case). This needs n−t operators to bind.
7. **Shadow first:** compute both verdicts, log would-be rejections, and publish the impact. The SDK detects ERC-7739 wallets with the `0x7739…` probe and wraps their signatures.

**Tests (shared-crate harness + connector harness; not the mock):**
- An ML-DSA-44 ERC-1271 account (Fireblocks verifier, 1,232,720 gas [M-P1]) decrypts with B_exec = 2M and fails at "250k including calldata".
- Code-first matrix: empty code; 7702 with a rejecting delegate; empty success → shim; empty revert → no shim; `0xffffffff`; regular code.
- An ERC-7739 wallet signing plain typed data is logged in shadow mode and fails under enforce; its wrapped signature passes.
- The budget excludes calldata.
- The cap is enforced before any RPC.
- At most 2 attempts.
- A retired subject gets a final denial that a simulated lapse does not revive.
- The legacy regular-code refusal.
- Measured: `eth_getCode` latency.

### d.2 Level 2: continuity and applications

**E1 Successor (ACL, both lines; prototype versions main 0.9.0 / reinitializer 10, backport 0.4.2 / 7).**

Storage, appended inside `ACLRetirementStorage`:

```solidity
struct Succession { address pending; uint64 confirmableAt; bool accepted; address confirmed; } // 2 slots
mapping(address account => Succession) succession;
mapping(address account => uint64) successorDelayOf;   // raise-only; 0 = registry default
uint64 constant SUCCESSOR_DELAY = 7 days;               // registry default; MUST be >= 7 days
uint64 constant MAX_SUCCESSOR_DELAY = 365 days;
```

Functions:

| Function | Who | Pause-gated | Rules |
|---|---|---|---|
| `designateSuccessor(address s)` | account | yes | account not retired; `s ∉ {0, account}`; `s` not retired; no confirmed successor; replaces any pending designation (resets `accepted`); `confirmableAt = now + effective D` → `SuccessorDesignated(account, s, confirmableAt)` |
| `acceptSuccession(address account)` | pending successor | yes | `msg.sender == pending`; neither party retired → `SuccessionAccepted(account, s)` |
| `cancelSuccessorDesignation()` | account | no | pending only; account not retired → `SuccessorDesignationCancelled(account, s)` |
| `confirmSuccessor()` | account | yes | not retired; pending exists, accepted, `now >= confirmableAt`, successor not retired → moves pending to confirmed → `SuccessorConfirmed(account, s)` |
| `resignSuccession(address account)` | confirmed successor | no | any time, including after retirement → `SuccessionResigned(account, s)` |
| `raiseSuccessorDelay(uint64 d)` | account | no | not retired; strictly greater than the effective D; ≤ 365 days → `SuccessorDelayRaised(account, d)` |
| `successorDelay()`, `successorDelayOf(address)`, `successorOf(address)`, `pendingSuccessorOf(address) → (s, confirmableAt, accepted)` | views | — | — |

- **`retireAccount()`** voids any pending designation and emits `AccountRetired(account, confirmed)`.
- **Errors:** `SuccessorInvalid(address)`, `SuccessorAlreadyConfirmed(address)`, `NoPendingSuccessor(address)`, `NotPendingSuccessor(address)`, `SuccessionNotAccepted(address)`, `SuccessorNotYetConfirmable(address, uint64)`, `NotSuccessor(address)`, `SuccessorDelayInvalid(uint64)`.

View change in both delegated views (it replaces the delegator part of c.5):

```solidity
if (r.retired[delegate] || r.retired[contractAddress]) return false;
// isHandleDelegatedForUserDecryption only:
if (!$.persistedAllowedPairs[handle][delegator] || !$.persistedAllowedPairs[handle][contractAddress]) return false;
if (r.retired[delegator]) { address s = r.succession[delegator].confirmed; return s != address(0) && delegate == s; }
return /* existing wildcard || per-contract delegation check */;
```

Constraints:
- On the deployed P1d path the successor must be an ECDSA EOA (the gateway verifies the delegate's ECDSA). On main, recommend a smart-account successor, which rotates its owners internally.

Tests:
- **Foundry:** the full state machine; locked against the old key; no transitivity; a retired successor fails; the successor cannot `allow`, publish or compute; an unaccepted designation cannot be confirmed; a designation voided by retirement yields nothing; a KDA cannot be a successor (it cannot accept).
- **Asserted residual:** an attacker designation, accepted by the attacker and confirmed after D unnoticed, survives retirement.
- **Mock:** `plaintextForDelegatedUserDecryption(OLD, S)` reads past and straggler handles.
- **Connector harness:** the v0.13.8 legacy delegated path with an ECDSA-EOA successor; main's unified path.
- **Measured:** gas for designate, accept, confirm and retire-with-successor.

**Applications:**
- `FHE.isAccountRetired(address)`, placed next to `FHE.isAccountDenied` (`library-solidity/lib/FHE.sol:8164`), through `Impl` and `IACL`.
- A local OZ ERC-7984 variant (Profile A):
  - `setObserver(account, X)` reverts if `X != 0` and the account is retired; clearing is always allowed;
  - `setOperator(op, until)` reverts if `until > now` and `msg.sender` is retired; revoking is always allowed;
  - `_update` is unchanged.
- Tests:
  - a thief-added observer is cleared by the retired account and cannot be re-added;
  - transfers to and from a retired account succeed;
  - the vanilla variant leaks the current balance and future amounts (asserted residual).

**Carry tool (script or CLI):**
1. Enumerate `Allowed(caller, account, handle)` per chain; `account` is indexed (`ACLEvents.sol:10`).
2. Keep handles where `persistAllowed(h, OLD)` holds. Filter spam with a contract allowlist and the current balance handles.
3. `--dry-run` prints a per-contract breakdown and the exact list.
4. Chunked `multicall([allow(h_i, NEW)…])`. The last chunk ends with `retireAccount()`. About 500 handles per transaction under Osaka [E: ~538; 31,083 gas per handle under Osaka, 119,201 on Sepolia, M-P1].
5. Verify: `isAccountRetired(OLD)`, and NEW holds `persistAllowed` on every carried handle.

**SDK hygiene prototype:**
- a fresh transport key per request; purge transport keys and permits on retirement;
- a typed `ACCOUNT_RETIRED` error; `getAuthorityStatus(address, chains)`.
- Stored-result TTLs remain a design note.

### d.3 Level 3: PQ-native authority, Q-day and governance (prototypes)

**E3 KDA (connector harness + shared crate; main unified path):**
- Encoding as in b.5. `verifierId` is provisional: `address(uint160(uint256(keccak256("ERC-XXXX native scheme:" ‖ name))))` for each name (for example "ML-DSA-44").
- The route is inserted before the ERC-1271 fallback in `verify_signature`. It applies only if:
  - `code(KDA)` is empty at the decision block;
  - the signature is not 65 bytes and parses as `abi.encode(signerBytes, sig)`;
  - the derived KDA equals `userAddress`;
  - every entry has `ownerAddress ≠ userAddress`.
- Verification: native FIPS 204, empty context, over the EIP-712 digest. On failure: reject, irrecoverable, no fallback.
- Library: RustCrypto `ml-dsa` 0.1.1, **unaudited**.
- Vectors: Wycheproof ML-DSA-44, 180/180 agree [M-A5]; ACVP sigVer to be added.
- Compare against the ERC-1271 path:
  - KDA verification: 84–89 µs; cold ML-DSA-44 verify: 82–85 µs [M-A5: Ryzen 5 5600, Windows 10, rustc 1.95.0, 2026-10-21];
  - ERC-1271 on-chain: 1,232,720 gas, about 4.5–5 ms of EVM time [E].
- Optional ACL getter for B_Q: `getUserDecryptionDelegationLastBlock(address,address,address)` (`0x19259f72`, no clash); otherwise use delegation events.

**Profile Q (connector harness):**
- Configuration: `pq_only = off | committed(B_Q) | active(B_Q)`; `variant = no_root_ecdsa | strict`.
- Share-collection simulation: with k of 13 enforcing and t = 4, reconstruction succeeds if and only if 13 − k ≥ 5, that is k ≤ 8.
- **C1 negative test:** on anvil, which accepts ECDSA transactions, a forged `allow(h, attackerPQ)` from the victim EOA followed by the attacker's PQ request **decrypts under Profile Q**. This documents the on-chain-door residual.
- Optional design note: A2's registry-level sunset (deferred).

**E2 Retirement Certificate (Foundry, two anvil chains):**
- `retireAccountWithSig(address account, address successor, uint256[] calldata chainIds, bytes calldata signature)`.
- Check order:
  1. not retired (`AccountAlreadyRetired`);
  2. `block.chainid ∈ chainIds` (`CertificateWrongChain(uint256)`);
  3. `successor != 0 && successorOf(account) == successor` (`CertificateSuccessorMismatch(address, address)`);
  4. `SignatureChecker.isValidSignatureNow(account, digest, signature)` (`InvalidRetirementCertificate(address)`).
- Then: the effects of `retireAccount` for `account`, and `AccountRetired(account, successor)`.
- Domain separator: `keccak256(abi.encode(0xb03948446334eb9b2196d5eb166f69b9d49403eb4a12f36de8d3f9f3cb8e15c3, keccak256("DecryptionAuthorityLifecycle"), keccak256("1")))`.
- **Watchtower script:** on a trigger (unexpected `Allowed` by the account, a wildcard or non-expiring delegation, an observer change, or a manual button), relay the certificate to both chains.
- **Tests:**
  - wrong chain; successor mismatch; no successor;
  - ERC-1271 account; works while paused; second submission reverts;
  - a forged or leaked certificate results only in the planned handover.
- **Written analysis:** private order flow does not help either side decisively, and off-chain permit decryption leaves no transaction to watch.
- **Measured:** `retireAccountWithSig` gas (EOA and ERC-1271); certificate size (about 200–300 bytes for one or two chains [E]).

**Governance demo (Foundry or anvil):**
- An OZ `TimelockController` owns a local ACL proxy (min delay 7 days in the demo). Show that it controls the executor, KMSVerifier and ProtocolConfig through `ACLOwnable`.
- The guard blocks a Core-less upgrade even when it goes through the timelock.
- **Canary script:**
  - checks `isAccountRetired`, `isAllowed`, `persistAllowed` and the delegated view for a canary on every `Upgraded` event;
  - halts on mismatch;
  - is shown passing a lying upgrade that spares the canary (residual, so pinning is needed).
- **Design note:**
  - PQ multisig signers (about 1.23M gas per ML-DSA approval [M-P1]);
  - ≥ n−t operator ratification of rights-widening upgrades (`ProtocolConfig.sol:147-158, 220-226` pattern);
  - why the immutable registry is deferred.

---

## (e) V1 → final mapping

| V1 item | V1 content | Final form | Level | Verdict | Why |
|---|---|---|---|---|---|
| **C1** | `sealAccount()`; `notSealed` write guards; `invalidatedBefore = 2^256−1` sentinel | Core R1–R14: `retireAccount()`, a one-way bit enforced in the read views for every role (contract included). Grant paths fail through `isAllowed`; no sentinel; no write guards | L0 | **Goal returns; mechanism replaced** | The sentinel is inert on the deployed path (no slot; the v0.13.8 connector never reads invalidation) and redundant on main. Write guards miss deputies that authorize through the views |
| **C2** | `allowMany`, `carryAndSeal` | Carry = the existing `ACL.multicall([allow(h_i, NEW)…, retireAccount()])`, grants first, chunked. L2 carry tool with a dry run and spam filter. E1 successor for O(1) continuity and stragglers | L0 (mechanism), L2 (tool, E1) | **UX returns; functions dropped** | `multicall` exists. A fused grant-and-retire call turns one phished transaction into an irrevocable grant plus a lockout. Carry is a snapshot |
| **C3** | The connector applies the EIP-8151 rule; 7702 is "not a safe destination" | Profile H: code-first ordering with a narrow 7702 shim (successful empty return only); same-block code reads; the legacy path refuses regular-code subjects. Wallet copy: "a 7702 upgrade does not protect confidential history" | L1 | **Concept returns; rule dropped** | The 8151 rule accepts 7702 root keys (`SignerEIP7702` does). Node rules bind only at ≥ n−t operators |
| **C4(a)** | Code-hash allowlist with a higher gas cap | Dropped. Replaced by the execution-gas budget (2M + intrinsic), a 64 KiB cap and ≤ 2 attempts | L1 | **Dropped** | Proxies and modules defeat code hashes. Three configuration layers. ×20 retry DoS amplification |
| **C4(b)** | Scheme-hinted native verification through `pqAuthKey()` | E3 Declared Decryption Signer as a KDA delegation (ERC-7913 layout, native FIPS 204/205, reserved scheme ids) | L3 | **Returns** | 84–89 µs natively against 1.23M EVM gas [M]. Zero ACL change. Subordinate and killed by retirement |
| **C4(c)** | EIP-8051/8052 precompiles | Inherited automatically under the execution budget; no ERC dependency | L1+ | **Returns as "inherit"** | Calldata alone is 71% of 250k for ML-DSA-44 [M-03]. EIP-8355 was declined for Hegotá [C] |
| **C5** | Governance flips `ecdsaDecryptionAuthorityDisabled` at Q-day | Profile Q: operator policy at ≥ n−t, commit-then-activate, ≥ 24 months notice, B_Q cutoff, PQ-signed signal; claims only with a host-chain ECDSA freeze. Pre-emptive retirement to a PQ successor is the real protection | L3 | **Flag dropped; intent returns** | Flipped today it is an outage for about 98% of holders. The ECDSA flipper falls first under T2. The on-chain door stays open without a host freeze |
| **ERC-7984 PQ profile** | `IConfidentialAuthorityLifecycle` (`sealAccount`, `isSealed`, `allowMany`, `carryAndSeal`, `AccountSealed`) plus rules R1–R4 | A vendor-neutral ERC, "Decryption Authority Lifecycle": Core + E1–E3 + Profiles H/Q/A. ERC-7984 keeps only Profile A | L0–L3 | **Returns at the right layer** | ERC-7984 defines no decryption rights. The scope is wider than tokens. "PQ" in the name overclaims the deployed phase |
| **R1** | No permit is accepted for a sealed account | Core V1 + V4 (release only on true views for every subject; no bypass) | L0 | **Returns (Core)** | Enforced in views, so it binds verifiers without code change |
| **R2** | Reject `ecrecover` if the declared address has code other than the 7702 indicator | Profile H code-first (any code → ERC-1271; 7702 → ERC-1271 plus the narrow shim) | L1 | **Returns, corrected** | V1's 8151-equivalence still accepted 7702 root keys |
| **R3** | Refuse the ECDSA path while fail-closed is on | Profile Q refusals (code-less, `0xef0100`, legacy path) | L3 | **Returns, re-founded** | An operator policy, not a flag |
| **R4** | Optional native verification for `pqAuthKey()` accounts | E3 KDA route | L3 | **Returns** | ERC-7913 bytes replace `pqAuthKey()` |
| **G1** | Pre-emptively and permanently cut a compromised or future-compromised key's access to V1 | Core (+ E2 for multi-chain and lost keys) | L0 | **Kept, qualified** | "Pre-emptive, not a clawback"; permanence is bounded by limit 3 |
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

**Semih's instinct, tested.** V1's **vision** was broader than PR-1. All six goals, all four verifier rules and the "both doors, one decision" principle return. V1 was **not** better on mechanism or threat model:
- none of the five mechanisms survives as written;
- its threat model missed deputies, the deployed line, threshold placement, governance, stored results, multiple chains, application roles and lockout;
- it held three vision-level claims that do not hold:
  - an off-chain switch protects history at Q-day;
  - everyone should move to a pure PQ smart account (14.6M–104.9M gas [M-P1]);
  - EIP-7851 would close the 7702 gap.

**The final design is V1's scope, built with v2's enforcement theory, the review's threat model and the three limits.**

---

## (f) Alternatives, ranked

| Rank | Alternative | Source | Verdict | Reason |
|---|---|---|---|---|
| 1 | **This design:** Core (every role, semantic exemption, ERC-165 + location guard) + E1 accepted dedicated successor + E2 successor-bound certificate + E3 KDA signer + Profiles H/Q/A + the governance profile | A7 | **Adopt** | Binds every verifier at the upgrade block; every extension passes the one-key rule |
| 2 | Ethereum-native: EIP-8298 code adoption (+3607, +8151) with a code-first verifier | A5, prior | Complement (through Profile H) | Nothing for plain EOAs until a host freeze; the legacy path cannot see host code |
| 3 | Host-chain ECDSA freeze plus host recovery (seed proof) | A1, A4, A6 | Complement; the precondition for Profile Q claims | Only the host chain can close the on-chain door for unmigrated EOAs |
| 4 | PQ governance plus ≥ n−t operator ratification of rights-widening upgrades | A2 | Adopt as the end-state governance profile (L3 design) | The pattern already exists in ProtocolConfig; required before any T2 durability claim |
| 5 | Exclusive (no-downgrade) declared signer in registry state, with matured declare and clear | A1, A2, A6 | Deferred | Redundant once Q engages; needs registry state, +1 RPC per request and n−t enforcement |
| 6 | Registry-level ECDSA sunset (an exercise rule in `isAllowed`) | A2 | Deferred research | Needs a PQ-safe trigger (PQ governance); only for hosts that will not freeze |
| 7 | Immutable, vendor-neutral lifecycle registry as the state of record | A2 | Deferred end-state option | Protects the bits, not the views; +CALL or +RPC; valuable only with multi-vendor adoption |
| 8 | Hash-commitment retirement (set-once `H(s)`) | A4 | Deferred | Needed only for successor-less pre-arranged retirement, or if hosts change `ecrecover` for frozen EOAs |
| 9 | Successor-issued, time-boxed auditor delegations | A2, A6 | Deferred | Exposure-neutral but reintroduces transitivity. If adopted: ≤ 90 days, per contract, non-re-delegable, dies with the successor |
| 10 | Succession transfer by the successor | A2, A6 | Deferred | Smart-account successors rotate owners internally; deployed-path institutions carry |
| 11 | Deployless ERC-1271 checker (initcode `eth_call`) | A5 | Optional implementation of Profile H | Exact budgets on every schedule; not normative |
| 12 | A guardian-lifted Suspended state | A2 | Rejected now | A new per-user cut-off authority; breaks monotonicity; blocks carry; covered by account-level suspension and retire-with-successor |
| 13 | A reason code in the Core event | A4, A5 | Rejected | Self-declared by a possibly hostile key; a public breach notice; invites semantics |
| 14 | Chain-agnostic certificate valid on present **and future** chains | A2, A4, A5 | Rejected | A bearer instrument with unbounded scope; an explicit chain list instead |
| 15 | Certificate without a confirmed successor | A1, A6 (default only) | Rejected | Leak or phishing = lockout bomb; a T2 forgery after a freeze = permanent lockout of unprepared owners |
| 16 | SU-14: the successor as a locked wildcard delegation | SU-14 | Rejected | Live before retirement; special cases in revoke, the one-change-per-block rule and the retirement gate; misleads wallets |
| 17 | An instant successor, in `retire(successor)` or inside a certificate | prior | Rejected | One phished signature = irrevocable capture plus lockout |
| 18 | Oracle "union" of EOA retirements across chains | A2 | Rejected | Restrictive (n−t), an RPC per chain, surprises single-chain retirements, unsafe for contracts |
| 19 | Bridge or LayerZero propagation of retirement | — | Rejected | A bridge compromise could mass-retire accounts with no in-protocol undo |
| 20 | Terminal ERC-1271 failures | prior 03 | Rejected | Contradicts the wallet-state rationale (`error.rs:97-100`); bounded to 2 attempts instead |
| 21 | Storing the flag inside the deny-list word to save gas | A3 | Rejected | Couples user state to a governance-written word |
| 22 | "Numbering as a guard" (very high reinitializers) | considered | Rejected | Breaks Zama's CI naming; the guard does the job |
| 23 | Gating the raw `allowedTransient` getter | A4 L1 | Rejected | It is the primitive under `isAllowed`; documented as non-authoritative |
| 24 | Guard by ERC-165 only, or by storage location only | coordinator; A3 | Rejected as sole checks | Each misses a failure mode the other catches |
| 25 | V1 C5: a governance-flipped fail-closed flag | V1 | Rejected | Outage today; the ECDSA flipper is the first T2 target |
| 26 | V1 C1–C5 as written | V1 | Strictly dominated | Inert on the deployed path, bypassed by deputies, more code |

---

## (g) Principles for TARGET_ARCHITECTURE

1. **Decide in the view.** Lifecycle state lives in the on-chain views the oracle already consults. Node code may only restrict, never extend.
2. **Retirement only ever reduces rights** for the retiring key, and it binds every verifier at the upgrade block.
3. **What survives retirement must mature; what retirement kills may be instant.**
   - A successor is pre-committed while the key is safe, delayed (D ≥ 7 days), public, and accepted by its beneficiary.
   - Delegations and declared signers may be instant, because retirement kills them.
4. **The one-key rule.** For an ECDSA account, the owner and the thief hold the same key. Any transition that key alone can trigger must be a pure reduction. The only `WithSig` path is retirement, and it is successor-bound.
5. **Every authorizing party, in every role.** Exemptions are defined by what a check is for, never by who calls.
6. **Threshold arithmetic.** A leak needs t+1 nodes; a restriction binds at n−t. Restrictions belong in views; node-side restrictive rules are claimed only at n−t.
7. **Monotone state that outlives every release.** Namespaced storage, an upgrade guard (ERC-165 + location), a canary, pinning.
8. **Follow the host chain, never lead.** PQ-only claims for unmigrated accounts hold only where the host chain freezes ECDSA. Code-first verification inherits host-chain account changes.
9. **No ECDSA in the end-state authority chain:** users, governance, gateway, operator responses, transport. Until then, label every claim with its ECDSA dependency.
10. **Separate powers and keys.** Authority keys sign; transport keys receive. A successor inherits decryption authority only. A declared signer cannot act on-chain.
11. **Ephemeral by default.** A transport key per request, purged on retirement; a TTL on stored results; re-check before re-serving.
12. **Host-state sources are trust roots.** Declare them and diversify them.
13. **One vendor-neutral surface:** ERC-165 id, `isAccountRetired`, `AccountRetired(account, successor)`. Conformance is per chain, per release and per deployment (ICS).
14. **Honest limits everywhere:** pre-emptive, not a clawback; oracle access only; as final as the chain's governance.
15. **A deployable minimum with a stated vision.** Every decision says what we do, what we deliberately do not do, and why.

---

## (h) Open questions for Semih

1. **Production line.** Which line should the Zama proposal target: the v0.13 backport (0.4.1), the 0.14 line (0.5.1), or main first? This depends on Zama's production plan; `latest-supported.json` points at v0.14.2.
2. **Upgrade guard.** Keep it inside PR-1 (the ruling: Core MUST for UUPS registries), or offer it as a separable commit if Zama resists? It blocks quick rollbacks to pre-Core implementations by design.
3. **Successor acceptance.** Mandatory acceptance overrules the G1 judge's "could". Confirm. It also implies that a cold recovery key must sign one transaction at setup.
4. **D.** A floor of 7 days, default 7, with a per-account raise-only option up to 365 days in the prototype. Accept?
5. **Certificates.** Certificates require and bind a confirmed successor, with an explicit chain list. Accept that users without a successor cannot use certificates (they retire directly), and that the hash-commitment form is deferred?
6. **Profile Q notice.** 24 months scheduled, plus the two emergency triggers. Accept, or prefer a date aligned with NIST IR 8547 (2030/2035 [C])?
7. **Timelock delay.** 7 days for the Level 3 demo and the ask; 14 days recommended for rights-widening changes in the end state?
8. **Names.** ERC title "Decryption Authority Lifecycle". Extension name "Retirement Certificate" (or "Revocation Certificate", as in the brief)?
9. **KDA identifiers.** The domain tag and scheme identifiers are provisional. Align them with EIP-7932 ALG_TYPE, or keep hash-derived ids?
10. **Reply KEM.** Recommend ML-KEM-768 or higher (SHOULD) for replies published on-chain, while Core stays transport-neutral?
11. **RPC concentration.** The ruling keeps it in Security Considerations in general terms (a property of every threshold oracle). Do you also want it raised privately with Zama before any publication? Nothing is sent in this phase.
12. **Inco.** No Inco code was available. Fetch and read it before the ERC claims a three-vendor fit, or keep Inco as "not examined"?
13. **Getter change.** `getUserDecryptionDelegationExpirationDate` returns 0 for retired parties (it changes a getter's semantics, consistent with its docstring). Keep it in Level 0?
14. **The 0.14-line target (0.5.1)** as an optional third Level 0 target, built only if time permits?

---

**Three limits (repeated, as required):**
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance.
