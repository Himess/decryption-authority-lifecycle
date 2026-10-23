---
eip: TBD
title: Decryption Authority Lifecycle
description: One-way retirement of an account's authority to have oracles decrypt confidential data, enforced in the authorization views oracles read
author: Semih Civelek (@Himess)
discussions-to: TBD
status: Draft
type: Standards Track
category: ERC
created: 2026-10-21
requires: 165, 712, 1271, 7913
---

## Abstract

This ERC specifies a lifecycle for an account's authority to have a decryption oracle release confidential data that a host chain holds as ciphertext handles. The Core adds one state transition, **retirement**. An account calls `retireAccount()`. From then on, every authorization view that oracles already consult returns false for that account in every role it can play: requester, owner, delegator, delegate, contract, permit issuer and permit recipient. Verifiers release nothing unless every applicable view returned true at decision time, and a threshold oracle conforms only if at least n−t of its nodes do.

Three optional extensions build on the Core:

- a **Successor**, designated, accepted and matured in advance, that keeps read access to a retired account's data;
- a successor-bound **Retirement Certificate** that anyone can relay to the chains it lists;
- a **Declared Decryption Signer** that lets an account authorize decryption with a post-quantum key verified natively off-chain.

Three optional profiles cover verifier signature hygiene, a scheduled post-quantum-only mode for oracles, and applications.

The result is revocable access, with three limits: it is pre-emptive, not a clawback; it covers oracle access only; and it is as final as the host chain's governance.

## Motivation

In confidential execution built on a decryption oracle, whether a threshold network or a trusted execution environment, ciphertexts sit on a public host chain, and the oracle decides at every request whether to release a plaintext. The confidentiality of past data is therefore decided again each time someone asks. The ciphertexts can be post-quantum. The authority to ask is, for almost every account today, an ECDSA key bound to an address for life, and no system we examined lets an account end that authority. A leaked key, or a future cryptographically relevant quantum computer (CRQC) that derives the key from a published public key, inherits the account's entire history. Disabling the key on the host chain itself, as the draft EIP-7851 proposes, does not reach off-chain verifiers that recover a signature before reading the account's code: in a simulation, the example's unmodified connector accepted such a disabled key on every request path [M, P0.4].

This ERC adds the missing lifecycle step, **revocable access**: an account can **retire** its authority to ask, and every conforming oracle then refuses every request that rests on that authority.

### Measured facts

Each item is measured [M] or verified in code [V] on the stated date. Estimates are marked [E] and inferences [I]. Bracketed sources are files of the research repository that accompanies the reference implementation:

- VERIFICATION = `results/VERIFICATION.md`;
- CENSUS = `results/review/04_census/aggregate.json`;
- G1 = `G1_TARTISMA_RAPORU.md`;
- A5 = `results/deliberation/A5_aa_pq_expert.md`;
- A7 = `results/deliberation/A7_judge.md`;
- SUMMARY = `results/deliberation/DELIBERATION_SUMMARY.md`.

The Motivation draws only on VERIFICATION, CENSUS and G1; the later sections also cite A5, A7 and SUMMARY.

The example system is Zama fhEVM. Its release `v0.13.8` (access-control registry `ACL` v0.4.0) runs on Sepolia and Ethereum mainnet; this was checked against Sourcify-verified sources on 2026-10-20 [V, VERIFICATION §0, §1.1]. The Sepolia runs used only the authors' own accounts and contracts (2026-10-20, 21:57–22:54 UTC).

1. **No user can retire.** Every user-callable registry function only adds rights: `allow`, `allowForDecryption`, `allowTransient`, `delegateForUserDecryption` and `multicall`. The deny list is owner-only. It is checked only against the caller of three write functions, and never by a view or an off-chain component. This holds on the deployed release and on `main` `ed851716c` [V, VERIFICATION §B1].
2. **One transaction exposes history** (Sepolia, 2026-10-20) [M, VERIFICATION §B3]:
   - `ACL.allow(balance, BOB)` (140,780 gas) let BOB decrypt ALICE's balance (21000) with his own permit, in 12.6 s;
   - `ACL.allowForDecryption([balance])` (141,493 gas) let anyone decrypt it with no permit, in 2.6 s;
   - `multicall` batched ten grants into one transaction (1,217,488 gas).

   One wildcard delegation, `delegateForUserDecryption(attacker, WILDCARD, type(uint64).max)`, covers every past and future handle at constant gas [V in code; not executed].
3. **Invalidation acts on permits, not keys.** The deployed registry has no signature invalidation, so a signed permit lives until its expiry, up to 365 days. This was tested on Sepolia on 2026-10-20. On `main`, the key holder can always sign a fresh permit that passes invalidation [M/V, VERIFICATION §B2].
4. **Upgrading the account does not retire the key.** On Sepolia on 2026-10-20, an EOA delegated through [EIP-7702](./eip-7702.md) to a wallet that rejects every signature (58,456 gas) still decrypted with its original key, in 2.8 s [M, VERIFICATION §B5].
5. **Post-quantum accounts cannot authorize at today's limits.** An ML-DSA-44 [ERC-1271](./eip-1271.md) account's `isValidSignature` cost 1,232,720 gas on Sepolia. `main`'s off-chain verifier accepted it only with a gas limit of at least 1,309,193, which is 5.24 times its 250,000 cap. The deployed path accepts only 65-byte ECDSA signatures: the 2,420-byte signature got HTTP 400 [M, 2026-10-20, VERIFICATION §B6, §5.2].
6. **The path is in use, and almost every holder is ECDSA-rooted.**
   - The testnet gateway's counters showed about 1,577 user decryptions in 21 hours, across host chains [M, 2026-10-20, VERIFICATION §1.2].
   - An aggregate census of the mainnet registry's `Allowed` events covered blocks 23,832,647–26,237,004 (2025-11-19 to 2026-10-20). It used read-only `eth_getLogs` and ran on 2026-10-20 between 23:15 and 23:55 UTC. It found 939,889 events and 12,714 end accounts, that is, addresses that received a grant and never granted, excluding 6 test-only accounts. They hold a median of 12 handles; the 99th percentile is 127 [M, CENSUS].
   - In a random sample of 1,000 of those accounts, 807 had no code, 172 were EIP-7702-delegated EOAs and 21 were contracts. **97.9% are ECDSA-rooted** [M, CENSUS].
   - Of the 403 accounts that delegated decryption, 374 delegated to the same address, and 53 delegation events set no expiry [M, CENSUS].
7. **Another design shares the gap.** Fhenix CoFHE (`cofhe-contracts` `b5c20ed`) never revokes allowances. Its permits carry revocation fields that the signer chooses, and their expiry has no upper bound [V, VERIFICATION §F1].

### Why the authorization views

In the example, every off-chain component that decides a release reads the registry's authorization views at request time, and so do the relayer, the SDK and applications [V, G1 §0]. Any 5 of the oracle's 13 node responses reconstruct a result. A rule enforced in node software therefore protects users only once at least 9 operators run it, while a rule enforced inside the views binds every verifier, of every release, from the block in which the registry is upgraded [V, G1 §0].

This ERC therefore standardizes *where* lifecycle state is enforced (inside the views the oracle already consults) and leaves the rest of each vendor's registry as it is.

The census also shapes the design. With about 98% of holders ECDSA-rooted, an oracle-side switch that refused ECDSA authority today would be an outage, not a protection [I, G1 §3]. Retirement is therefore opt-in per account, and the post-quantum-only mode is a scheduled, announced profile.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

### Terminology

| Term | Definition |
|---|---|
| Handle | A host-chain identifier of a ciphertext |
| Host chain | The chain whose registry governs a handle |
| Registry | The host-chain contract whose views decide use and decryption rights over handles |
| Authorization view | A registry view whose answer a verifier or a contract uses to grant, export or release (roles in [Views and roles](#views-and-roles)) |
| Engine | The fixed contract that performs computations on handles for its callers |
| Oracle, node | The system that releases plaintexts. A node is one release unit. In a threshold oracle of n nodes, the outputs of any t+1 nodes suffice to release |
| Release | Returning a plaintext, a re-encryption of it or a share of either; or forwarding a request to a component that will |
| Verifier | A component whose decision gates a node's release. Prechecks in clients and relayers are advisory and are not verifiers |
| Subject | Every account a request rests on: the requester, the owner or delegator, the delegate, the contract, the permit issuer and the permit recipient |
| Grant path | A registry function that extends a right over a handle to another account, makes a handle publicly decryptable, or creates or extends a delegation or a permit |
| Grantor | The account whose rights a grant path exercises: the caller, or the requester that a relaying engine passes to the registry |
| Inbound grant | A grant in which the account in question is the recipient, the delegate or the contract |
| Deputy | A contract that acts for its caller after checking a use view for that caller |
| Identity-gated grant | An application grant authorized by the caller's identity or role, not by a use view (for example, setting an observer) |
| Decision block | The block at which a verifier evaluates views |
| Decision lag (L) | The largest distance, in blocks, that a verifier allows between the decision block and the latest block it knows |
| Delegation indicator | Account code of exactly 23 bytes: `0xef0100` followed by an address (EIP-7702) |
| ECDSA-disabled delegation indicator | Account code of exactly 23 bytes: `0xef0101` followed by an address (EIP-7851, Draft). The account's ECDSA key no longer authorizes it on the host chain; calls still run the delegate. It is regular code for this ERC |
| ECDSA-rooted account | An account whose code is empty or a delegation indicator |
| Regular code | Account code that is neither empty nor a delegation indicator. This includes an ECDSA-disabled delegation indicator |
| Host-state source | The means by which a node reads host-chain state: an RPC provider, its own node or a light client |
| ICS | Implementation Conformance Statement: an oracle's published declaration of how it conforms |

### Conformance classes and claims

| Class | Core requirements | Optional claims | How a claim is made |
|---|---|---|---|
| Registry | R1–R14 | E1 (S1–S11), E2 (C1–C8) | [ERC-165](./eip-165.md) |
| Verifier | V1–V5 (MUST); V6, V7 (SHOULD) | E3 (K1–K12), Profile H (H1–H9) | ICS |
| Oracle | O1, O2 (MUST); O3 (SHOULD) | E3, Profile H, Profile Q (Q1–Q8) | ICS |
| Application | R14 (no authorization from raw getters) | Profile A (A1–A4) | The application's documentation |
| Client (wallet, SDK) | none | The client rules of E1 (S11) and E3 (K10) | — |

Each extension and each profile is a separate claim. Claiming one does not imply Core conformance of another class.

### States

An account on a registry is either **active** or **retired**. The only transition is active → retired. This ERC defines no other lifecycle state and no reverse transition. Extension E1 adds a succession record to each account, which retirement freezes except for the successor's resignation.

### Core interface

```solidity
// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

/// @title Decryption Authority Lifecycle: Core
/// @dev ERC-165 interface id 0x556d2088 = 0xe7142996 ^ 0xb279091e.
interface IDecryptionAuthorityLifecycle {
    /// @notice Emitted once per account, when the account is retired.
    /// @param successor The account's confirmed E1 successor, or address(0).
    event AccountRetired(address indexed account, address indexed successor);

    /// @notice The account is already retired.
    error AccountAlreadyRetired(address account);

    /// @notice A grant path was called on the authority of a retired account.
    error SenderRetired(address sender);

    /// @notice Retires msg.sender. Selector 0xe7142996.
    function retireAccount() external;

    /// @notice Whether `account` is retired. Selector 0xb279091e.
    function isAccountRetired(address account) external view returns (bool);
}

/// @title Decryption Authority Lifecycle: retirement storage location
/// @dev Not an ERC-165 interface. The upgrade guard (R11) calls it on a proposed implementation.
interface IDecryptionAuthorityLifecycleStorage {
    /// @notice A proposed implementation does not declare Core, or reads another location.
    error UpgradeDropsRetirement(address newImplementation);

    /// @notice The storage location of the retirement state. Selector 0xc89c7ccd.
    function retirementStorageLocation() external pure returns (bytes32);
}
```

Core constants:

| Kind | Signature | Value |
|---|---|---|
| Function | `retireAccount()` | `0xe7142996` |
| Function | `isAccountRetired(address)` | `0xb279091e` |
| Function | `retirementStorageLocation()` | `0xc89c7ccd` |
| Function | `supportsInterface(bytes4)` (ERC-165) | `0x01ffc9a7` |
| Interface id | Core (`IDecryptionAuthorityLifecycle`) | `0x556d2088` |
| Event topic | `AccountRetired(address,address)` | `0xb78e4ea3a4535888e05cd4dd5c1b469a528e4f3e743356314e71ca2b340fa0eb` |
| Error | `AccountAlreadyRetired(address)` | `0x9c0fa00d` |
| Error | `SenderRetired(address)` | `0xb9e76275` |
| Error | `UpgradeDropsRetirement(address)` | `0x61b57965` |

### Views and roles

A registry's authorization views fall into the roles below. The notation is used throughout this ERC.

| Role | View | Parties the view consults | Required answer when a consulted party is retired |
|---|---|---|---|
| Use | U(h, a): may account `a` use handle `h`, in persistent or transient form | `a` | false, except in the one evaluation that R10 exempts |
| On-behalf | D(a, d, c, h): may `d` decrypt `h` as `a`, for contract `c`; a form without `h` is also an on-behalf view | `a` (owner or delegator), `d` (delegate), `c` (contract) | false, except as E1 specifies for a confirmed successor (S8) |
| Permit | P(π, h): does permit π authorize its recipient on `h` | the issuer and the recipient of π | false |
| Liveness getter | A getter that the registry documents as telling whether a right or delegation is live, such as an expiry | the parties of that right | the inactive value (R14) |
| Public | G(h): is `h` publicly decryptable | none | unchanged (R9) |

A registry MUST document which of its functions implement each role. The **applicable views** of a request are the views the registry documents for that request type. Together they MUST consult every subject of the request.

### Core registry requirements

- **R1. Retire.** `retireAccount()` MUST mark `msg.sender` retired and MUST emit `AccountRetired(msg.sender, s)` exactly once. `s` is the account's confirmed successor under E1, or `address(0)` if there is none or the registry does not implement E1. If `msg.sender` is already retired, the call MUST revert with `AccountAlreadyRetired(msg.sender)` and MUST NOT emit an event.
- **R2. One-way.** The registry MUST NOT offer any function, privileged or not, that clears an account's retirement.
- **R3. Unconditional.** For any active caller, `retireAccount()` MUST succeed regardless of pause state, deny lists, roles, fees, balances or holdings. It MUST succeed when the caller is a contract and when the caller holds no handle. It MUST NOT require a payment.
- **R4. Grants nothing.** Retirement MUST NOT create or extend any right of any account. The only right that takes effect at retirement is the read right of a successor confirmed beforehand under E1 (S8).
- **R5. Immediate.** Retirement MUST take effect for every evaluation that runs after the retiring call, including later calls in the same transaction and every later block.
- **R6. Every role.** Every authorization view MUST give the answer that [Views and roles](#views-and-roles) requires whenever a party it consults is retired:
  - use views return false for a retired account, except as R10 allows;
  - on-behalf views return false when the owner or delegator, the delegate or the contract is retired, except as E1 S8 specifies;
  - permit views return false when the issuer or the recipient is retired.
- **R7. Grant paths revert.** Every grant path MUST revert when its grantor is retired. This covers:
  - grants of use rights to another account;
  - publication for public decryption;
  - transient grants made outside the evaluation that R10 exempts;
  - the creation or extension of delegations and permits;
  - every batched form of these.

  The revert SHOULD use `SenderRetired(grantor)`.
- **R8. Inbound grants are inert, never refused.** A grant MUST NOT revert because its recipient, delegate or contract is retired. R6 makes such a grant inert.
- **R9. Public decryption is unchanged.** Retirement MUST NOT change G(h) for any handle. A handle that is public stays public.
- **R10. Engine exemption, defined by call semantics.**
  1. A registry MAY exempt from retirement exactly one class of evaluation: authorizing the use of an operand as an input to a computation that the engine performs for its caller. In that evaluation the subject is the calling contract, and every output of the computation is granted only to that contract and only for the current transaction.
  2. The exemption MUST NOT apply to any evaluation that gates a grant, a publication, a delegation, a transfer of rights to another chain, a permit or a deputy action. It MUST NOT apply to any answer returned to an off-chain verifier or to another contract.
  3. Only the use view that the engine evaluates for operand checks MAY carry the exemption.
  4. A registry MAY identify the exempt evaluation by its caller only if that caller:
     - evaluates the view for no other purpose;
     - never relays a third party's request to the registry;
     - grants computation outputs only to itself or to its direct caller, and only for the transaction.

     An engine that relays grants or permit checks MUST NOT be exempted by caller identity. The registry MUST give such an engine a dedicated operand-check entry point instead.
- **R11. Upgrades preserve state and enforcement.**
  1. An upgrade MUST NOT clear, move or reinterpret retirement state, and the upgraded registry MUST satisfy R1–R14.
  2. Retirement state SHOULD live in a dedicated [ERC-7201](./eip-7201.md) namespace.
  3. Every implementation of an upgradeable registry MUST implement `retirementStorageLocation()`, returning the location of its retirement state. For an ERC-7201 namespace, that is the namespace's location.
  4. A registry whose upgrade authorization runs in registry code, such as [ERC-1822](./eip-1822.md) UUPS, MUST call the proposed implementation directly during that authorization. It MUST revert with `UpgradeDropsRetirement(newImplementation)` unless both of these hold:
     - `supportsInterface(0x556d2088)` returns true;
     - `retirementStorageLocation()` returns the same value as in the current implementation.

     A call that reverts, or returns data of the wrong length, counts as failure.
  5. There MUST be no path that upgrades the registry without the check in item 4.
  6. A registry upgraded through another pattern, such as a proxy with an external admin, SHOULD enforce the check in item 4 in its admin or governance tooling.

  (Open question 1.)
- **R12. ERC-165.** `supportsInterface` MUST return true for `0x01ffc9a7` and `0x556d2088`, and for the identifier of each extension the registry implements: E1 `0x7dc5e209`, E1 delay `0xc61ca396`, E2 `0x4b9ec076`. It MUST return false for `0xffffffff`.
- **R13. Batching.** The registry SHOULD offer caller-preserving batching, for example a `multicall` that runs each call with the original caller as `msg.sender`. Grants followed by `retireAccount()` then execute atomically.
- **R14. Raw getters.** Liveness getters SHOULD return the inactive value whenever a party is retired (Open question 12). A raw getter that does not reflect retirement, such as a getter of transient grants, MUST be documented as non-authoritative. Verifiers, deputies and applications MUST NOT base an authorization decision on it.

Note (non-normative): functions that only remove rights, such as revoking a delegation, are not grant paths. R7 does not make them revert, and the reference implementation keeps them callable by retired accounts.

### Core verifier requirements

- **V1. Release rule.** A verifier MUST NOT release, MUST NOT forward a request for release, and MUST NOT produce or return a share unless every applicable view returned true at decision time. This holds for every subject of the request, on the registry of the host chain of every handle in the request. An error, a revert, a timeout or a malformed answer counts as false. A malformed answer is any return data other than exactly one ABI-encoded `bool`: 32 bytes holding 0 or 1.
- **V2. Freshness.** Views MUST be evaluated after the request is received, at a decision block no more than L blocks behind the latest block the verifier knows. L is stated in the ICS. A positive answer MUST NOT be reused for another request or another decision block.
- **V3. No exemption spoofing.** A verifier MUST NOT evaluate any view with the engine, or any other address that R10 exempts, as the caller (`from`).
- **V4. No bypass.** V1 MUST apply to every request path the verifier serves and to every signature scheme it accepts: ECDSA, ERC-1271, declared signers (E3) and any legacy path.
- **V5. Replicas.** A verifier that evaluates views against a replica, index or cache of host-chain state MUST first apply every `AccountRetired` event, and every other state change the views depend on, up to the decision block. Otherwise it MUST NOT authorize from that replica.
- **V6. Stored results (SHOULD; MUST under Profile H).** Before serving a result produced earlier, whether stored, cached or keyed to an equivalent request, the verifier SHOULD apply V1 again at a fresh decision block. The ICS MUST state the stored-result policy.
- **V7. Final retirement denials (SHOULD; MUST under Profile H).** When a request is denied, the verifier SHOULD call `isAccountRetired` for each subject. If any subject is retired, the denial SHOULD be final: typed `ACCOUNT_RETIRED`, never retried, never revived.

### Core oracle requirements

- **O1. Conformance per deployment.** A threshold oracle conforms to Core only if at least n−t of its n nodes run Core-conforming verifiers. An oracle with a single release unit, such as one trusted execution environment, conforms only if that unit does. Conformance is stated per host chain, per registry release and per deployment.
- **O2. ICS.** An oracle that claims conformance MUST publish an ICS and MUST update it before any change to the listed values takes effect.
- **O3. Host-state diversity (SHOULD).**
  - A deployment SHOULD ensure that no single host-state source, and no correlated set of sources, determines the view answers of t+1 or more nodes.
  - A node SHOULD confirm each positive answer against its own node, a light client, or two independent providers that must agree.
  - A node SHOULD fail closed when they disagree.

#### Implementation Conformance Statement

| Field | Content |
|---|---|
| Registry | Host chain id and registry address, for each host chain served |
| Interface ids | The ERC-165 ids the registry reports |
| Governance | Upgrade authority of the registry and of every contract on the release path, timelock delay, engine address |
| Threshold | n and t; for each extension and profile, the number of nodes that run it |
| Decision lag | L, per host chain |
| Stored results | The policy under V6 |
| Transport | The reply KEM and the transport-key policy |
| Signatures | ERC-1271 execution budget, signature and field caps, attempt limit (Profile H) |
| E3 | Enabled schemes; libraries; the diversity mode chosen under K8 |
| Profile Q | Variant, B_Q, operator commitments |
| Host-state sources | In aggregate: own nodes, light clients, providers, and how many nodes use each |
| Succession | The registry's delay D, if it implements E1 |

#### Threshold conformance

- Restrictive requirements bind an oracle only when at least n−t nodes enforce them. These are V1–V7, the refusals of Profile H and Profile Q. An oracle MUST NOT claim a restrictive requirement for fewer enforcing nodes.
- Additive capabilities are available only where at least t+1 nodes support them. These are the Profile H budget and the E3 route. The ICS states the count.

### Extension E1: Successor

E1 lets an account pre-commit, while its key is safe, the one account that may keep reading its data after retirement.

```solidity
// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

/// @title Decryption Authority Lifecycle: E1 Successor
/// @dev ERC-165 interface id 0x7dc5e209.
interface IDecryptionAuthoritySuccession {
    event SuccessorDesignated(address indexed account, address indexed successor, uint64 confirmableAt);
    event SuccessionAccepted(address indexed account, address indexed successor);
    event SuccessorDesignationCancelled(address indexed account, address indexed successor);
    event SuccessorConfirmed(address indexed account, address indexed successor);
    event SuccessionResigned(address indexed account, address indexed successor);

    error SuccessorInvalid(address successor);
    error SuccessorAlreadyConfirmed(address successor);
    error NoPendingSuccessor(address account);
    error NotPendingSuccessor(address caller);
    error SuccessionNotAccepted(address successor);
    error SuccessorNotYetConfirmable(address successor, uint64 confirmableAt);
    error NotSuccessor(address caller);

    function designateSuccessor(address successor) external;                // 0x3f44910b
    function acceptSuccession(address account) external;                    // 0x155bd17f
    function cancelSuccessorDesignation() external;                         // 0x72536881
    function confirmSuccessor() external;                                   // 0x50028ed1
    function resignSuccession(address account) external;                    // 0x3767579e
    function successorDelay() external view returns (uint64);               // 0x36979a21
    function successorOf(address account) external view returns (address); // 0x5adbc9c7
    function pendingSuccessorOf(address account)                            // 0x2ea04055
        external
        view
        returns (address successor, uint64 confirmableAt, bool accepted);
}

/// @title Decryption Authority Lifecycle: E1 per-account delay
/// @dev ERC-165 interface id 0xc61ca396. A registry implementing it MUST implement E1.
interface IDecryptionAuthoritySuccessionDelay {
    event SuccessorDelayRaised(address indexed account, uint64 delay);

    error SuccessorDelayInvalid(uint64 delay);

    function raiseSuccessorDelay(uint64 delay) external;                        // 0x0e92c10c
    function successorDelayOf(address account) external view returns (uint64); // 0xc88e629a
}
```

E1 constants:

| Kind | Signature | Value |
|---|---|---|
| Event topic | `SuccessorDesignated(address,address,uint64)` | `0x52c3e9f82052eb6b4fbe29b0b48bf718c35b2558f0c45c667b14287a3e51f807` |
| Event topic | `SuccessionAccepted(address,address)` | `0x038d2b057a5c8f360473e6c2a5c1b001dd0367ecbeeb660fb7fde23df6252afb` |
| Event topic | `SuccessorDesignationCancelled(address,address)` | `0xb83db6f1374970f6129184222c9120a283b1b920e4307ce2dd2db53f1b0c79be` |
| Event topic | `SuccessorConfirmed(address,address)` | `0x0bbdbb8ccff8e10c1bcb0e3746b6cdd863fbe0295656b864bb983783818e167f` |
| Event topic | `SuccessionResigned(address,address)` | `0xec5735ad8a8bc1941be7a96a8fb2cf4dc0812a609c3975be6436a90018683273` |
| Event topic | `SuccessorDelayRaised(address,uint64)` | `0x49529b4ae3a76543375e1fa78debf59fd8bd835f6acf21ad1a23f69a9b811a39` |
| Error | `SuccessorInvalid(address)` | `0xc6b4b14a` |
| Error | `SuccessorAlreadyConfirmed(address)` | `0xb09b5136` |
| Error | `NoPendingSuccessor(address)` | `0xfca6ea78` |
| Error | `NotPendingSuccessor(address)` | `0x7051e7e2` |
| Error | `SuccessionNotAccepted(address)` | `0x9eb4e345` |
| Error | `SuccessorNotYetConfirmable(address,uint64)` | `0xbfde6be2` |
| Error | `NotSuccessor(address)` | `0xa10eaf88` |
| Error | `SuccessorDelayInvalid(uint64)` | `0x0304d853` |

The lifecycle is: designate (by the account) → accept (by the successor) → confirm (by the account, at or after `confirmableAt`) → locked. Each rule names the error to use. When several conditions fail at once, any one of the applicable errors MAY be used.

- **S1. Designate.** `designateSuccessor(s)` MUST revert:
  - with `SenderRetired` if the caller is retired;
  - with `SuccessorAlreadyConfirmed` if the caller already has a confirmed successor;
  - with `SuccessorInvalid` if `s` is `address(0)`, the caller itself, or retired.

  Otherwise it MUST replace any pending designation and clear its acceptance. It MUST set `confirmableAt` to `block.timestamp` plus the caller's effective delay (S7), and emit `SuccessorDesignated(caller, s, confirmableAt)`.
- **S2. Accept (mandatory).** `acceptSuccession(account)` MUST revert:
  - with `NotPendingSuccessor` unless `msg.sender` is the pending successor of `account`;
  - with `AccountAlreadyRetired` if `account` is retired;
  - with `SenderRetired` if `msg.sender` is retired.

  Otherwise it MUST record the acceptance and emit `SuccessionAccepted(account, msg.sender)`. Acceptance is a transaction from the successor; the registry verifies no signature for it. (Open question 2.)
- **S3. Cancel.** `cancelSuccessorDesignation()` MUST revert:
  - with `SenderRetired` if the caller is retired;
  - with `NoPendingSuccessor` if the caller has no pending designation.

  Otherwise it MUST remove the pending designation and emit `SuccessorDesignationCancelled(caller, s)`. It MUST NOT affect a confirmed successor.
- **S4. Confirm.** `confirmSuccessor()` MUST revert:
  - with `SenderRetired` if the caller is retired;
  - with `NoPendingSuccessor` if no designation is pending;
  - with `SuccessionNotAccepted` if the designation has not been accepted;
  - with `SuccessorNotYetConfirmable` if `block.timestamp < confirmableAt`;
  - with `SuccessorInvalid` if the pending successor is retired.

  Otherwise it MUST make the pending successor the confirmed successor, clear the pending designation and emit `SuccessorConfirmed(caller, s)`.
- **S5. Locked.**
  - Once confirmed, a successor MUST NOT be replaced, cancelled or cleared by any function other than `resignSuccession`.
  - `resignSuccession(account)` MUST revert with `NotSuccessor` unless `msg.sender` is the confirmed successor of `account`.
  - It MUST succeed at any time, including after the account's retirement. It MUST clear the successor and emit `SuccessionResigned(account, msg.sender)`.
- **S6. Frozen at retirement.** Retirement (R1, or C6 under E2) MUST void any pending designation. After retirement, designation, acceptance, confirmation, cancellation and raising the delay MUST revert; resignation remains available.
- **S7. Delay.** (Open question 3.)
  - `successorDelay()` returns the registry-wide delay D, in seconds. D MUST be at least 7 days (604,800 seconds); 7 days is RECOMMENDED.
  - `confirmableAt` is fixed at designation from the account's effective delay. A later change of delay MUST NOT alter a pending `confirmableAt`.
  - A registry MAY implement the per-account delay interface:
    - `raiseSuccessorDelay(d)` MUST revert with `SenderRetired` if the caller is retired.
    - It MUST revert with `SuccessorDelayInvalid(d)` unless `d` is greater than the caller's effective delay and at most 365 days.
    - On success it MUST emit `SuccessorDelayRaised(caller, d)`.
    - `successorDelayOf(account)` returns the account's effective delay: the larger of D and any value the account has raised it to.
  - Without that interface, every account's effective delay is D.
- **S8. Read right after retirement only.** Let A be a retired account whose confirmed successor is S.
  - For every contract `c` and handle `h`, D(A, S, c, h) MUST return the value the registry would return if A were active and had an active, non-expiring delegation to S covering every contract. R6 still applies to S and `c`.
  - D(A, d, c, h) MUST return false for every `d` other than S.
  - While A is active, the succession MUST NOT change any view's answer.
- **S9. Decrypt-as only, no transitivity.** The succession MUST NOT make S satisfy any use view on A's handles, and MUST NOT let S grant, publish, compute on or delegate them. A successor of S gains no right over A's handles.
- **S10. Pause.** A registry MAY make designation, acceptance and confirmation unavailable while it is paused. Cancellation, resignation and raising the delay MUST remain available while it is paused.
- **S11. Clients.**
  - Clients MUST NOT treat a successor as a payment address or a redirect target.
  - Clients MUST show pending designations, with their `confirmableAt`, to the account's holder.
  - Clients MUST NOT designate a key-derived address (E3) as a successor. Such an address cannot accept (S2).

### Extension E2: Retirement Certificate

E2 lets anyone relay an account's signed retirement to the chains it lists. A certificate can only trigger the handover to the successor the account confirmed beforehand.

```solidity
// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

/// @title Decryption Authority Lifecycle: E2 Retirement Certificate
/// @dev ERC-165 interface id 0x4b9ec076. A registry implementing it MUST implement E1.
interface IDecryptionAuthorityRetirementCertificate {
    error CertificateWrongChain(uint256 chainId);
    error CertificateSuccessorMismatch(address confirmed, address certified);
    error InvalidRetirementCertificate(address account);

    /// @notice Retires `account` on the strength of its signed certificate. Selector 0x4b9ec076.
    function retireAccountWithSig(
        address account,
        address successor,
        uint256[] calldata chainIds,
        bytes calldata signature
    ) external;
}
```

The typed data ([EIP-712](./eip-712.md)):

```text
EIP712Domain(string name,string version)
    name    = "DecryptionAuthorityLifecycle"
    version = "1"
RetireAccount(address account,address successor,uint256[] chainIds)

DOMAIN_TYPEHASH  = keccak256("EIP712Domain(string name,string version)")
                 = 0xb03948446334eb9b2196d5eb166f69b9d49403eb4a12f36de8d3f9f3cb8e15c3
RETIRE_TYPEHASH  = keccak256("RetireAccount(address account,address successor,uint256[] chainIds)")
                 = 0xf224379ad7473578295885cb7fd6795dbf8c4d718c2bd07d70c8f1e5ecaac54b
DOMAIN_SEPARATOR = keccak256(abi.encode(DOMAIN_TYPEHASH,
                       keccak256("DecryptionAuthorityLifecycle"), keccak256("1")))
                 = 0xe16ad8114bca96b9be6acfdb949a5dad1eb876411203b58a5898f27f3cc4d10b
structHash       = keccak256(abi.encode(RETIRE_TYPEHASH, account, successor,
                       keccak256(abi.encodePacked(chainIds))))
digest           = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

E2 error selectors: `CertificateWrongChain(uint256)` `0x904dd953`, `CertificateSuccessorMismatch(address,address)` `0x99155e67`, `InvalidRetirementCertificate(address)` `0xce6e5c6a`.

- **C1. Dependency.** A registry that implements E2 MUST implement E1.
- **C2. Domain.** The domain MUST be exactly `EIP712Domain(string name,string version)` with the name and version above, and nothing else. It has no chain id and no verifying contract; the scope comes from `chainIds`.
- **C3. Submission.** Anyone MAY call `retireAccountWithSig`. The submitter's own state, retired or not, MUST NOT affect the outcome.
- **C4. Checks.** The registry MUST perform these checks in this order, and revert with the first failing check's error:
  1. `account` is not retired, else `AccountAlreadyRetired(account)`;
  2. `block.chainid` is an element of `chainIds`, else `CertificateWrongChain(block.chainid)`;
  3. `successor != address(0)` and `successorOf(account) == successor`, else `CertificateSuccessorMismatch(successorOf(account), successor)`;
  4. `signature` is valid under C5, else `InvalidRetirementCertificate(account)`.
- **C5. Signature, code-first.**
  - If `account` has no code, `signature` MUST be exactly 65 bytes (r ‖ s ‖ v) with `v` 27 or 28 and `s` in the lower half of the curve order ([EIP-2](./eip-2.md)), and it MUST recover `account` from `digest`.
  - If `account` has any code, including a delegation indicator, the ERC-1271 call `isValidSignature(digest, signature)` on `account` MUST return `0x1626ba7e`.
  - There MUST be no fallback from ERC-1271 to ECDSA.
- **C6. Effects.** On success the effects MUST be exactly those of `retireAccount()` called by `account` (R1–R5, S6), including the event `AccountRetired(account, successor)`.
- **C7. Limits.**
  - A certificate MUST NOT designate, accept, confirm, cancel or change a successor, and MUST NOT grant any right.
  - It has no nonce, no expiry and no cancellation by the key.
  - `retireAccountWithSig` MUST NOT be gated by pause or by any condition that R3 forbids.
- **C8. Scope.** A certificate is valid on every conforming registry of every chain in `chainIds`, including the registries of different implementers on the same chain, and on no other chain. (Open question 4.)

### Extension E3: Declared Decryption Signer

E3 lets an account authorize decryption with a separate, subordinate key, such as a post-quantum key that a verifier checks natively. The signer is a delegation to a key-derived address (KDA). E3 adds no registry function and has no ERC-165 identifier; it is a verifier and oracle claim stated in the ICS.

```solidity
// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

/// @title Decryption Authority Lifecycle: E3 Declared Decryption Signer encoding
/// @dev Normative encoding. Both tags are provisional (Open question 8). Each tag is a constant
///      prefix, so the packed encodings below are injective.
library DeclaredDecryptionSigner {
    bytes internal constant KDA_TAG = "ERC-XXXX key-derived decryption signer v1";
    bytes internal constant SCHEME_TAG = "ERC-XXXX native scheme:";

    /// @notice The reserved verifierId of a native scheme, for example "ML-DSA-44".
    function schemeId(string memory name) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(SCHEME_TAG, name)))));
    }

    /// @notice signerBytes = verifierId (20 bytes) || publicKey, in the ERC-7913 layout.
    function signerBytes(address verifierId, bytes memory publicKey) internal pure returns (bytes memory) {
        return abi.encodePacked(verifierId, publicKey);
    }

    /// @notice The key-derived address to which the account delegates.
    function keyDerivedAddress(bytes memory signer) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(KDA_TAG, signer)))));
    }

    /// @notice The signature field of a request signed by the declared signer.
    function requestSignature(bytes memory signer, bytes memory sig) internal pure returns (bytes memory) {
        return abi.encode(signer, sig);
    }
}
```

- **K1. Encoding.** `signerBytes` is `verifierId` (20 bytes) followed by the public key, as in [ERC-7913](./eip-7913.md). In this version `verifierId` MUST be a reserved native-scheme identifier (`schemeId`), never a contract. A verifier MUST take the scheme from `signerBytes` only, never from any other request field.
- **K2. Key-derived address.** KDA = `keyDerivedAddress(signerBytes)`.
- **K3. Declaration.** The account declares the signer by creating, in its own transaction, a delegation in the registry whose delegate is the KDA, for one contract or for every contract, with an expiry. Revoking that delegation revokes the signer. Retiring the account disables it (R6).
- **K4. Request.**
  - The requester field is the KDA.
  - Every handle entry names the account as owner.
  - The signature field is `requestSignature(signerBytes, sig)`.
- **K5. Route selection.** A verifier MUST take the KDA route only if all of these hold at the decision block:
  - the KDA has no code;
  - the signature field is not 65 bytes long and decodes as `abi.encode(bytes, bytes)`;
  - the KDA derived from it equals the requester;
  - every handle entry names an owner other than the requester;
  - `verifierId` names a scheme the verifier enables (ICS).
- **K6. Verification.**
  - The verifier MUST verify `sig` natively, with the pure (not pre-hash) algorithm and an empty context string, over the same 32-byte typed-data digest it checks for other signers.
  - On failure it MUST reject irrecoverably, with no fallback to ECDSA or ERC-1271.
  - V1 then applies, with the KDA as the delegate.
- **K7. Schemes and vectors.**
  - The enabled schemes MUST be parameter sets of FIPS 204 (ML-DSA-44, ML-DSA-65, ML-DSA-87) or FIPS 205 (SLH-DSA). FN-DSA MAY be enabled only once FIPS 206 is final.
  - Each enabled parameter set MUST pass the ACVP sigVer and Wycheproof vectors for that set before activation.
- **K8. Implementation diversity.** An oracle that claims E3 MUST ensure that a verification bug in one library cannot reach t+1 nodes. Either each node requires two independent implementations to agree, or no single implementation is used by t+1 or more nodes. The ICS states which. The second option needs at least ⌈n/t⌉ implementations, four for n = 13 and t = 4; with t = 0 only the first is possible.
- **K9. Never a root.** A KDA MUST NOT be accepted as a direct owner (K5) and cannot become a successor, because it cannot transact (S2).
- **K10. Clients.** Clients SHOULD default to a finite expiry for KDA delegations. Under Profile Q, Q5 applies.
- **K11. Scope.** The route applies only where the verifier itself verifies the request signature. It does not apply on paths where another component verifies an ECDSA signature.
- **K12. Claim.** A verifier MUST NOT claim E3 against a registry that lets delegations be created by a relayed signature. This ERC defines no signature-relayed path for declaring a signer or revoking one. Its only relayed signature, the E2 certificate, retires the account, which disables every signer at once (K3) and creates nothing.

### Profile H: Hygiene

Profile H is a verifier profile. Its refusals bind an oracle only at n−t enforcing nodes; its budget is available only where t+1 nodes support it.

- **H1. Caps before any read.** Before any host-state read, a verifier MUST irrecoverably reject a request:
  - whose signature exceeds 65,536 bytes; or
  - whose other variable-length fields passed to signature verification exceed the caps stated in the ICS. RECOMMENDED caps are 4,096 bytes for a public key and 1,024 bytes for extra data [E].
- **H2. Code-first ordering.** For each signer address `a`, the verifier MUST read `a`'s code at one block B:
  - **Empty code:** accept only a 65-byte ECDSA signature that recovers `a`.
  - **Delegation indicator:** call ERC-1271 `isValidSignature` on `a` at B and accept only the magic value. It MAY fall back to ECDSA recovery of `a` only if the call succeeded with empty return data and the signature is exactly 65 bytes. It MUST NOT fall back on a revert (including an empty revert), a wrong magic value, short return data or a transport error. The fallback is off under Profile Q.
  - **Regular code**, including an ECDSA-disabled delegation indicator: ERC-1271 only, with no fallback.

  The code read and the ERC-1271 call MUST use the same block. Code MUST NOT be cached across blocks.
- **H3. Budget.** The gas limit of the ERC-1271 call MUST be `B_exec + 21,000 + 64 × len(calldata)`. `B_exec` is stated in the ICS; 2,000,000 is RECOMMENDED.
- **H4. Attempts.** ERC-1271 negatives (wrong magic value, explicit rejection, empty revert) MUST be attempted at most twice, the second attempt at least one block after the first. An out-of-gas call is an empty revert, whatever shape the node reports it in (a top-level out-of-gas `eth_call` typically comes back as an error without revert data). Transport errors follow the verifier's own policy.
- **H5. Final retirement denials.** V7 is REQUIRED.
- **H6. ECDSA-only paths.** A verifier that serves a path where the subject's signature is verified only by ECDSA, by itself or by another component, MUST refuse a request whose requester or delegate has regular code on the host chain.
- **H7. Stored results.** V6 is REQUIRED. Deduplication of requests MUST be keyed on the signature and the validity window.
- **H8. Rollout.** Before enforcing H2 and H6, a verifier SHOULD run them in shadow mode: compute both verdicts, serve the old one, log would-be rejections and publish their impact. The ICS states the mode.
- **H9. Consistency.** Advisory prechecks SHOULD use the same caps, budget and ordering as the verifier.

### Profile Q: PQ-only

Profile Q is an oracle profile: a scheduled, one-way operator policy for the off-chain request path. It is never an on-chain flag.

- **Q1. Trigger.** The profile engages only when at least n−t operators have committed to it and then activate it together at an announced block B_Q.
  - The signal is a set of operator statements signed with FIPS 204 or FIPS 205 keys, plus the ICS.
  - An on-chain record MAY exist but MUST NOT act as a trigger.
  - An ECDSA-authorized governance action MUST NOT trigger the profile.
- **Q2. Preconditions.** Operators MUST NOT activate unless all of these hold:
  - Profile H, E3 and the refusal of ECDSA-only paths are live on at least n−t nodes;
  - a readiness indicator is published, with its threshold fixed in advance: the share of active decryptors, and of value, that has a post-quantum-capable route, per chain;
  - a recovery path is stated;
  - the registry's timelock and the operators' implementation pinning are in place.
- **Q3. Notice.** (Open question 5.)
  - A scheduled activation MUST be announced at least 24 months before B_Q. It MUST NOT be later than the host chain's own deactivation of ECDSA; if the host chain deactivates first, operators follow at the chain's date.
  - Emergency activation without notice is allowed only on host-chain ECDSA deactivation, or on credible public evidence of a CRQC against secp256k1, declared by at least n−t operators in post-quantum-signed statements.
- **Q4. Effects.** A verifier MUST refuse every request whose signer is authenticated by ECDSA:
  - a code-less signer outside the E3 route;
  - a signer whose code is a delegation indicator (no ERC-1271 call; the H2 fallback is off);
  - every ECDSA-only path.

  In the **no-root-ECDSA** variant, it accepts signers with regular code through ERC-1271, and E3 signers. In the **strict** variant, it accepts only E3 signers. The ICS states the variant.

  An account whose code is an ECDSA-disabled delegation indicator is migrated: it is not ECDSA-rooted, and it is authenticated through ERC-1271.
- **Q5. Delegation cutoff.** A delegation from an ECDSA-rooted delegator, including a KDA delegation, counts only if its last change is at or before B_Q. B_Q is the activation block in scheduled mode, and the last block before the trigger evidence in emergency mode. Delegates and successors must themselves qualify.
  - For a delegator whose code is an ECDSA-disabled delegation indicator, the cutoff applies only to changes made before its ECDSA authority was disabled. A verifier that cannot establish that block applies the cutoff to every change.
- **Q6. Post-quantum claims.** An oracle MUST NOT describe its decryption service as post-quantum unless:
  - its reply channel uses a FIPS 203 KEM, or a hybrid that includes one; and
  - its input encryption is post-quantum.

  Replies published on-chain SHOULD use ML-KEM-768 or stronger, and the reply encryption SHOULD bind the request context. (Open question 9.)
- **Q7. Claim limit.** An oracle MUST NOT claim that Profile Q protects unmigrated ECDSA accounts on a host chain that still accepts those accounts' ECDSA transactions. An account whose ECDSA authority the host chain has disabled (EIP-7851) is migrated for this rule.
- **Q8. One-way.** Disengaging the profile widens rights. It MUST follow the same procedure as Q1 (commitment by at least n−t operators) and SHOULD follow the governance profile below.

### Profile A: Applications

Profile A is an application profile.

- **A1. Identity-gated grants.** A grant path authorized by identity or role MUST revert when the account on whose behalf it grants is retired. Examples are setting an observer, setting an operator whose expiry has not passed, and owner-only grants. Clearing and revoking MUST remain allowed. (An ERC-7984 operator is valid while `block.timestamp <= until`, so an expiry equal to the current timestamp is a grant.)
- **A2. Transfers.**
  - An application MUST NOT let a transfer to a retired account fail because the grant to it is inert (R8).
  - It MAY refuse transfers to retired accounts as an explicit, documented policy.
  - It SHOULD NOT block transfers from retired accounts.
- **A3. No post-grant assertion.** An application MUST NOT assert U(h, recipient) after granting `h` to a recipient.
- **A4. Generic calls.** Contracts with generic-call paths SHOULD refuse calls to the lifecycle functions of this ERC on the registry, and to any registry entry point that runs calls with the caller kept as `msg.sender`, such as `multicall`.

An existing token can meet A1 without a fork: an extension that inherits the unmodified token and overrides only its identity-gated grant functions. For OpenZeppelin's ERC-7984 0.5.3 with its observer extension, that is `setOperator` and `setObserver`: 18 lines of code, adding about 7,800 and 3,800 gas to those calls [M] (`results/phase4/P1_4_PROFILE_A_STOCK.md`).

### Scope across host chains

Retirement is a property of an account on one registry on one host chain. A verifier evaluates the registry of each handle's host chain (V1). A handle moved to another chain is a new handle there, and retirement on the source chain does not cover it. E2 lets one signature list several chains. This ERC defines no propagation of retirement between chains.

### Informative parts

**Governance profile.**

- A timelock owns every contract on the authorization and release path, and every pointer between them, including any request contract on another chain. Direct execution paths that bypass the delay are removed.
- The delay is at least 7 days now; 14 days is recommended for rights-widening changes in the end state (Open question 6).
- Pause is the only emergency power, and it never gates retirement or the views.
- The exit window serves operators, who review, refuse or pin; users cannot withdraw ciphertext history.
- In the end state:
  - governance signers use post-quantum keys;
  - at least n−t operators ratify on-chain any upgrade that can widen decryption rights;
  - operators halt user decryption on an unratified implementation.
- Operators run a **retirement canary**: a known retired account and a known handle. On every upgrade event, and periodically, they check that:
  - `isAccountRetired` is true;
  - the use views are false;
  - the on-behalf view is false for a delegation created before retirement.

  On a mismatch they halt user decryption for that chain. Operators also pin registry implementations.

**Client and wallet guidance.**

- Show retirement status per chain, and a partial-retirement warning when an account is retired on some chains only.
- Map denials to a typed `ACCOUNT_RETIRED` error.
- Publish [ERC-7730](./eip-7730.md) descriptors for the lifecycle calls, the permit and the certificate.
- Confirmation levels:
  - strongest for one-way or granting actions: retire, carry, publish, wildcard or non-expiring delegation, certificate;
  - elevated for actions that add authority later: designate, confirm, observers, long permits.
- Treat lifecycle calls as wallet-native: block those originated by an application by default.
- Never offer "send to successor".
- State that no service can restore a retired address.
- Use one fixed glossary ("Retire address", "Successor", "Retirement certificate") in every language.
- On retirement, purge transport keys and permits, and use a fresh transport key per request.

**Carry procedure.**

1. Inventory and export.
2. Exit applications: clear observers, revoke operators.
3. Move assets.
4. Carry: enumerate the account's grant events on each chain, and keep the handles where the account still holds a persistent use right. Filter spam with a contract allowlist and print a dry run. Then send chunked, caller-preserving batches of grants to the new account; the last batch ends with `retireAccount()` (R13).
5. Retire, with a successor, on every host chain.
6. Verify: `isAccountRetired` is true, and the new account holds every carried right.

In the reference implementation's example, one grant inside a batch cost 31,083 gas under the Osaka schedule and 119,201 gas under the schedule Sepolia ran on 2026-10-20 [M, VERIFICATION §5.1]. That allows about 500 handles per transaction under Osaka [E]. On Ethereum mainnet, 12,673 of 12,714 holders (99.7%) hold at most 539 handles [M, CENSUS].

### Out of scope

This ERC does not standardize:

- a Suspended state, or reason codes;
- an on-chain post-quantum-only flag or trigger, or a registry-level ECDSA sunset (deferred research);
- propagation of retirement between chains, or an oracle "union" of retirements;
- a carry function, or retirement through a deny list;
- an immutable registry as the primary store (deferred);
- successor-issued delegations, or succession transfer (deferred);
- an exclusive, no-downgrade declared signer (deferred);
- a hash-commitment certificate (deferred).

## Rationale

**Placement in the views.** A restriction in node software binds only once n−t nodes run it, while a grant needs only t+1. A restriction in the authorization views binds every verifier in the upgrade block, with no verifier change. In the reference implementation's example, every off-chain decider reads only views that Core gates, and the verifier sets no `from` on its `eth_call`s [V, A7 §0, §1 row 4]. That is why Core holds only rules that live in views, and why everything that needs verifier code (Profiles H and Q, E3) is optional.

**Every role, including the contract.** One rule, "no retired account satisfies any authorization view in any role", is easier to test than a list of exceptions. It costs one more storage read inside a view that verifiers already call. In the example, a retired contract was refused on the direct path but still passed the delegated path, because the delegated view read the contract's raw rights [V, A7 §2.1]; R6 closes that. The user-protection property rests on the requester, owner, delegator and delegate roles. The contract role makes "a contract that retires itself disables its handles" hold on every path.

**An exemption defined by semantics.** The engine exemption keeps the computation path unchanged. Retirement then adds no cost to computation and cannot break an application mid-flow. It is safe only because every output can leave through a gated evaluation alone. In the example, the engine reads the use view at one operand choke point, with its caller as subject, and grants outputs only transiently to that caller [V, A7 §1 row 3]. Another design's engine, Fhenix CoFHE's `TaskManager`, relays grants, the public use view and the oracle's permit check to its registry, always as itself [V, A7 §1 row 2]. A "skip when the caller is the engine" rule copied there would exempt every grant and the oracle's own check. On a port of that registry it does: every relayed grant and the decryption service's permit check pass for a retired account, while a dedicated operand-check entry keeps every one gated [M, P2.1]. R10 therefore defines the exemption by what a check is for, and V3 closes the remaining off-chain spoof.

**An upgrade guard with two checks.** In the reference implementation, a backport of Core to an older release line (registry 0.4.1) takes reinitializer 6. An upgrade from it to a later line without Core (0.6.0 or 0.7.0) succeeds and silently stops reading retirement; only 0.5.0 happens to revert [V, A7 §2.9]. The guard turns the silent lapse into a revert. An ERC-165 check alone would pass a release that declares Core but reads a renamed namespace, resetting every retirement. A location check alone would pass a release that kept the getter but dropped Core. The guard stops accidents, not an implementation that lies; canaries and pinning cover that (Security Considerations).

**Two states, no reason code.** NIST SP 800-57 defines Deactivated and Compromised key states. For an authority whose only use is to ask for decryption, both mean "refuse", which is Retired. A Suspended state that someone can lift is a target: if the key can lift it, a thief can; if a guardian can, the guardian becomes a new per-user censor. Suspension also gates the account's own writes, so "suspend, then carry" is impossible, and it breaks the monotonicity that makes final denials and canaries safe. Accounts that need suspension have it in their own validation (ERC-1271), which Profile H honours. A reason code chosen by a possibly hostile key is not evidence, and a public "compromised" flag is a breach notice.

**Revert on a second retirement; inert inbound grants.** A deterministic failure is easier to handle than a silent success; relayers check `isAccountRetired` first and use failure-tolerant batching. Inbound grants must not revert: a confidential token grants the recipient its new balance handle on every transfer, so refusing grants would break transfers to every retired account.

**The one-key rule.** For an ECDSA account, the owner and a thief hold the same key. Any transition that this key alone can trigger must therefore be a pure reduction, unless it was committed while the key was safe. What survives retirement must mature; what retirement disables may be instant.

- **Successor.** It survives retirement, so it is designated in advance, delayed (D ≥ 7 days), public, and accepted by its beneficiary.
  - Acceptance proves the successor can transact: a typo, a burn address or a key-derived address cannot accept. It also prevents unilateral public association with a victim, and it costs one transaction validated by the successor's own account.
  - A dedicated record was chosen over a locked wildcard delegation. Such a delegation is live before retirement, needs special cases in revocation and per-block limits, and shows wallets a revoke button that cannot work.
- **Declared signers.** These are delegations, which retirement disables, so they can be instant.
- **Certificate.** The only signature-relayed transition. Because it is bound to a confirmed successor, a leaked or forged certificate can trigger only the handover the holder committed in advance.
  - Without that binding, a leaked certificate is a lockout. A quantum forgery after a host-chain ECDSA freeze would then lock out, permanently, holders who would otherwise recover through the host chain.
  - A nonce, an expiry or cancellation by the key adds nothing against a thief who holds the same key.
  - The explicit chain list lets one offline ceremony cover several chains without becoming a bearer instrument for chains added later.

**A key-derived address for the declared signer.** It needs no registry change, because retirement already disables delegations. It is monotone: an ECDSA root can already grant everything a KDA can read, at constant gas. It fails closed on verifiers that do not implement it: an unmodified verifier rejects a non-65-byte signature for an address without code [V, A7 §2.7]. ML-DSA-44 verification on the route measured 84–89 µs (82–85 µs cold) on an AMD Ryzen 5 5600 with rustc 1.95.0 on 2026-10-21 [M, A7 §2.7]. A whole route check, with the code read from a local node, took about 245 µs at the median with one library and 340 µs with two that must agree (K8). On the same machine, ECDSA under Profile H took 470 µs and the ERC-1271 path at `B_exec` 2,000,000 took 2.7 ms [M, P1.1]. The same scheme through an ERC-1271 contract cost 1,232,720 gas on Sepolia [M, VERIFICATION §5.2]. Native ML-DSA-44 was faster than one ECDSA-recovery implementation measured (177–213 µs) and slower than another (53–55 µs) [M, A7 §4 K4], so this ERC makes no general claim that post-quantum verification is cheaper than ECDSA. Library diversity (K8) exists because the library used in the prototype is unaudited.

**Profile H details.**

- **Shim.** The 7702 fallback fires only on a successful call with empty return data, because an out-of-gas call and a decoding failure both revert with empty data [V, A7 §1 row 11].
- **Budget.** It counts execution, because the calldata of one ML-DSA-44 signature consumed 71% of a 250,000 cap (177,048 gas) under Sepolia's schedule [M, G1 §5]. 64 gas per byte bounds the intrinsic calldata charge under both the Osaka schedule and the schedule Sepolia ran [M, A5 §1.1].
- **Attempts.** Two attempts bound the worst case at 2 × 2,000,000 gas of execution, against 20 × 250,000 in the example today [E]. They still allow for wallet state that changes between blocks.
- **Shadow mode.** It comes first because [ERC-7739](./eip-7739.md) wallets return a wrong magic value for plain typed data [V, A7 §1 row 12].

**Profile Q as operator policy.** An on-chain "ECDSA off" flag would be set by governance whose keys are ECDSA, the first target of a CRQC; flipped today, it would refuse about 98% of holders. A host chain that still accepts an unmigrated account's ECDSA transactions leaves the on-chain door open. A forged grant to an attacker's post-quantum key, followed by a fully conforming request, decrypts [I, A7 §2.3]. Profile Q therefore claims nothing for such accounts (Q7): the oracle follows the host chain and never leads it.

**Relation to EIP-7851 and EIP-8151.** Both drafts change the host chain, not off-chain verifiers. An account can leave ECDSA in two ways.

- **Migrate in place.** The account delegates (EIP-7702) to a post-quantum wallet, then disables its ECDSA key (EIP-7851), and is served by Profile H verifiers.
  - EIP-7851 keeps the account's address. Its code becomes `0xef0101 ‖ delegate`, and the chain refuses the key's transactions and authorizations.
  - The EIP itself notes that contracts that verify ECDSA directly "will not automatically reject signatures from an ECDSA-disabled authority".
  - EIP-8151 makes the `ecrecover` precompile return nothing for accounts whose code is neither empty nor an EIP-7702 indicator. That covers such accounts on chain.
  - Off-chain verifiers recover signatures in their own code, so neither draft reaches them. In a simulation of the indicator, the example's unmodified connector accepted the disabled root key on every request path; only H2's code-first ordering refused it [M, P0.4].
  - This ERC therefore treats the indicator as regular code (H2) and such accounts as migrated (Q4, Q5, Q7).
  - With EIP-8151, a delegate that checks the root key through the precompile also stops accepting it; one that recovers in its own code does not [I, from the EIP texts].
- **Migrate out.** The account retires, with a successor (E1) or after carrying its rights to a new account. It needs no host-chain change.

Nothing in this ERC depends on either draft being adopted.

**Transport neutrality.** Authority and transport are orthogonal, so Core is transport-neutral. A post-quantum claim (Q6) needs a FIPS 203 KEM on the reply channel and post-quantum input encryption, because classically encrypted inputs stored on-chain can be decrypted without the oracle. Zama's reply channel is hybrid ML-KEM-512; Fhenix's is X25519 [V, A7 §1 row 21]. Both can conform to Core, but an X25519 reply channel cannot meet Q6. Inco's decryption service re-encrypts with X-Wing (ML-KEM-768 with X25519), according to a comment in its contracts; the encryption code itself is not public [V, comment only; Phase 4 INCO_MAPPING]. Its registry was read but not run (Open question 11).

**Dependencies.**

- ERC-165 gives discovery.
- EIP-712 gives the certificate format.
- ERC-1271 covers contract accounts in E2 and Profile H.
- ERC-7913 gives the E3 signer layout.
- ERC-7201 is recommended (R11), not required.
- [ERC-7984](./eip-7984.md) defines no decryption rights, so it is an example for Profile A, not a dependency.

**Mapping to deployed registries (informative).**

| Role | Zama fhEVM `ACL` (`main` `ed851716c`; `v0.13.8`) | Fhenix CoFHE `ACL` (`b5c20ed`) |
|---|---|---|
| Use | `isAllowed`, `persistAllowed` | `isAllowed` (relayed as `TaskManager.isAllowed`, which FHE.sol's `isAllowed` calls), `persistAllowed`, `allowedTransient` |
| On-behalf | `isHandleDelegatedForUserDecryption`; `isDelegatedForUserDecryption` (`main` only) | `allowedOnBehalf` |
| Permit | none on-chain | `isAllowedWithPermission` (relayed as `TaskManager.isAllowedWithPermission`, which the decryption service calls); it consults the issuer and the recipient, and a port adds the recipient to the gate |
| Liveness getter | `getUserDecryptionDelegationExpirationDate` | The permit's validity probe `checkPermissionValidity`; the ACP share registry's `isShareValid` and `sharesFor` |
| Public | `isAllowedForDecryption` | `globalAllowed` (relayed as `TaskManager.isPubliclyAllowed`, which the decryption service calls for a request without a permit); `isAllowedForDecryption` is a second flag, set by `allowForDecryption` |
| Engine | `FHEVMExecutor`: caller identity is valid under three tested invariants | `TaskManager`: relays grants, the use view and the permit check, always as itself, so it needs a dedicated operand-check entry point |
| Grant paths | `allow`, `allowForDecryption`, `allowTransient` (non-engine branch), `multicall`, `delegateForUserDecryption` | `allow`, `allowGlobal`, `allowForDecryption`, `allowTransient`, `batchAllowTransient` and `shareCtHash`, relayed by `TaskManager` with the user passed as requester or sharer; `delegateAccount`; the ACP share registry's `share`. A port gates each. The engine's own transient grants (requester = `TaskManager`) are R10's class |

Sources: A7 §1, §2.2, §2.11; SUMMARY §(c). The Fhenix column was checked again against the code at `b5c20ed`, including the decryption service `teecryptor` (`2616344`), in Phase 4 (P2.1).

**Rejected and deferred alternatives** (SUMMARY §(f)):

| Alternative | Verdict | Reason |
|---|---|---|
| Write-side guards on grant functions, plus a permit-invalidation sentinel | Rejected | Inert where verifiers never read invalidation; bypassed by deputies that authorize through views |
| A fused "grant and retire" function | Rejected | One phished transaction becomes an irrevocable grant plus a lockout; batching suffices |
| A guardian-lifted Suspended state; a reason code | Rejected | See "Two states, no reason code" |
| An instant successor, in `retire(successor)` or in a certificate | Rejected | One phished signature means capture plus lockout |
| A successor encoded as a locked wildcard delegation | Rejected | Live before retirement; special cases; misleading in wallets |
| A certificate without a confirmed successor, or valid on future chains | Rejected | A lockout bomb; a bearer instrument with unbounded scope |
| Propagating retirement through bridges; an oracle "union" across chains | Rejected | A bridge compromise could mass-retire accounts; restrictive at n−t, a read per chain, unsafe for contracts |
| A governance-flipped ECDSA-off flag | Rejected | An outage for about 98% of holders today; its flipper is ECDSA governance |
| A code-hash allowlist with a higher ERC-1271 cap; terminal ERC-1271 failures | Rejected | Proxies defeat code hashes; wallet state can change between attempts |
| Retirement stored in a governance-written deny list | Rejected | Couples user state to governance writes |
| A guard that checks only ERC-165, or only the location; gating the raw transient getter | Rejected | Each check misses a failure the other catches; the getter is the primitive under the use view |
| An exclusive declared signer; a registry-level ECDSA sunset; an immutable registry; a hash-commitment certificate; successor-issued delegations | Deferred | Need registry state, PQ governance, multi-vendor adoption or named demand; see Out of scope |

## Backwards Compatibility

- **Active accounts.** Core changes no answer for an account that never retires. The reference implementation checks this by running the registry's existing test suites differentially (TC3).
- **Existing verifiers.** Verifiers that already read the gated views inherit Core with no code change. The example's connector conforms unchanged at both release lines, on every request path [M, TC13: three runs per line].
  - A retired account's request is refused when a view call returns a JSON-RPC error, an HTTP error, a dropped connection, a timeout, malformed JSON, an empty or truncated result, a revert, or an intermittent failure.
  - Nothing reaches the KMS.
  - The claim is conditional on the verifier decoding view answers strictly, as V1 defines a malformed answer. A deployment must check this in its own client.
- **Applications.**
  - Inbound grants still succeed (R8).
  - An application that asserts U(h, recipient) right after granting would revert on transfers to retired accounts; Profile A forbids that. The ERC-7984 implementation in OpenZeppelin confidential-contracts 0.5.3 makes no such assertion in its transfer path [V, A7 §1 row 30].
  - A contract that retires itself now disables the handles it governs on the delegated path as well as the direct one.
- **Getters.** A liveness getter that follows R14 returns the inactive value, for example an expiry of 0, when a party is retired. This matches the example's own documentation of that value.
- **Upgrades.**
  - The guard (R11) deliberately refuses rollbacks to implementations without Core. The rollback target for a faulty Core release is a patched Core release.
  - Where a vendor maintains several release lines, Core needs one release per line, and a production plan with strictly increasing reinitializers.
- **Events.** Indexers that do not know `AccountRetired` ignore it; in the example, older event listeners skip unknown events [V, A7 §1 row 29].
- **Extensions and profiles.**
  - E3 requests fail closed on verifiers without the route.
  - Profile H's code-first ordering can reject requests that pass today's ECDSA-first ordering: ERC-7739 wallets signing plain typed data, and 7702 delegates without `isValidSignature`. Hence H8's shadow mode.
  - Profile Q refuses ECDSA-rooted accounts after its notice period.

## Test Cases

### Test vectors

Every constant in the Specification was computed with Foundry `cast` 1.8.5 on 2026-10-21. The values were cross-checked against `type(I).interfaceId` and `.selector` of the interfaces above, compiled with solc 0.8.30; the interfaces also compile with solc 0.8.4. A conforming implementation reproduces them exactly. The interface identifiers are XORs of the selectors of each interface's own functions:

| Interface | Functions | Identifier |
|---|---|---|
| Core | `retireAccount()` `0xe7142996` ⊕ `isAccountRetired(address)` `0xb279091e` | `0x556d2088` |
| E1 | `designateSuccessor(address)` `0x3f44910b` ⊕ `acceptSuccession(address)` `0x155bd17f` ⊕ `cancelSuccessorDesignation()` `0x72536881` ⊕ `confirmSuccessor()` `0x50028ed1` ⊕ `resignSuccession(address)` `0x3767579e` ⊕ `successorDelay()` `0x36979a21` ⊕ `successorOf(address)` `0x5adbc9c7` ⊕ `pendingSuccessorOf(address)` `0x2ea04055` | `0x7dc5e209` |
| E1 delay | `raiseSuccessorDelay(uint64)` `0x0e92c10c` ⊕ `successorDelayOf(address)` `0xc88e629a` | `0xc61ca396` |
| E2 | `retireAccountWithSig(address,address,uint256[],bytes)` `0x4b9ec076` | `0x4b9ec076` |

A Retirement Certificate (E2). The signer is index 0 of the public test mnemonic `test test test test test test test test test test test junk`; the successor is index 1.

```text
account    = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
successor  = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
chainIds   = [1, 11155111]

keccak256(abi.encodePacked(chainIds))
           = 0x540231bc41c99331df1a62dea2893a5c70bdddd52347550f17df570e8b719eab
structHash = 0x1f81322eb97a9a429855c11d0e6138b920dfdd04f5d30da9f1a831b2234cec55
digest     = 0xca933c116695438e119a68f3f457dac8b4b9050e77210d19cdaa2be05106e98a
signature  = 0x2f2daa5d31e68624bed89cefce723bc9f21b880ea92b4f49f50d80ca00af1152
               53f9db3981e50d97405d417aaf1992826d1e4d65cfe26881c2550ca600a55c37
               1c
```

This certificate retires `account` on a registry on chain 1 or 11155111 whose `successorOf(account)` is `successor`. On chain 31337 it reverts with `CertificateWrongChain(31337)`. With any other confirmed successor it reverts with `CertificateSuccessorMismatch`.

Threshold vector (O1): with n = 13 and t = 4, a restriction enforced by k nodes stops a release if and only if k ≥ 9. Reconstruction still succeeds whenever 13 − k ≥ 5.

### Behaviours

| ID | Rules | Case | Expected |
|---|---|---|---|
| TC1 | R1, R5 | An active account retires, then retires again | `AccountRetired(a, 0)` once and `isAccountRetired(a)` true; the second call reverts with `AccountAlreadyRetired(a)` and emits nothing |
| TC2 | R3 | Retire while paused, while deny-listed, as a contract, with no handles | Each succeeds |
| TC3 | R6 | Never-retired accounts across the registry's existing suites | Identical results |
| TC4 | R6, R10 | A retired account: every use view, persistent and transient | False, except the engine's operand evaluation |
| TC5 | R6, R14 | A retired delegator, delegate or contract; per-contract and all-contract delegations; liveness getter | False; the getter returns the inactive value |
| TC6 | R6 | A permit registry with a retired issuer or recipient | False |
| TC7 | R7 | A retired grantor calls every grant path and every batched form | Reverts, `SenderRetired` recommended |
| TC8 | R8, A2 | Grants and token transfers to a retired account; transfers from it | Succeed; the grants are inert |
| TC9 | R10 | A retired account computes through the engine, then tries every export: grant, publication, transient grant, batch, delegation, deputy transfer and disclosure, input re-use, cross-chain send | Each reverts; tests also pin the identified-caller conditions of R10 |
| TC10 | R13 | Batch of [grants…, `retireAccount()`]; batch of [`retireAccount()`, grant] | The first is atomic; the second reverts |
| TC11 | R11 | Upgrade to: a Core implementation with the same location; an implementation without Core; a Core implementation with another location; an implementation that lies on both checks | Accepted; reverts `UpgradeDropsRetirement`; reverts `UpgradeDropsRetirement`; accepted (asserted residual, caught only by a canary) |
| TC12 | R12 | `supportsInterface` probes | True for `0x01ffc9a7`, `0x556d2088` and each implemented extension; false for `0xffffffff` |
| TC13 | V1, V3, V4 | A verifier, unmodified where possible, receives a request with a retired requester, owner, delegator, delegate, contract or permit recipient, on every path; a never-retired request; a view that reverts or times out | Refused before any share; forwarded; refused |
| TC14 | V2, V5 | A request received after the retiring block, within the decision lag; a replica without lifecycle events | Refused; no authorization from the replica |
| TC15 | V6, V7 | A stored result re-served after retirement; a retirement denial followed by a simulated governance lapse | Refused; final `ACCOUNT_RETIRED`, not revived |
| TC16 | O1 | Share-collection simulation, n = 13, t = 4 | Reconstruction if and only if k ≤ 8 |
| TC17 | S1–S11 | Successor state machine | No right before retirement; read right after it, including handles granted later; locked against the old key; resignation; no transitivity; a retired successor fails; the successor cannot use, grant, publish or compute; an unaccepted designation cannot be confirmed; a designation voided by retirement yields nothing; a KDA cannot accept |
| TC18 | S1–S4 | Asserted residual: an attacker designates its own address, accepts, and confirms after D unnoticed | Survives retirement |
| TC19 | C1–C8 | Certificates | The vector above; wrong chain; successor mismatch; no successor; ERC-1271 account; delegation-indicator account (ERC-1271 only); works while paused; a second submission reverts; a leaked certificate yields only the planned handover |
| TC20 | K1–K12 | KDA route: ACVP and Wycheproof vectors for every enabled parameter set and implementation; the K5 negatives (a KDA with code, a 65-byte signature, a mismatched KDA, an owner equal to the requester, a disabled scheme); a fault injected into one implementation | Vectors pass; an unmodified verifier fails closed; retirement and revocation disable KDA permits; refused on direct entries; no fallback; the faulty acceptance is refused where two implementations must agree, and reaches at most t nodes where each implementation serves at most t |
| TC21 | H1–H9 | Code-first matrix: empty code; a delegate that rejects; empty success (shim); empty revert (no shim); wrong magic; regular code. Also: ERC-7739 plain typed data; budget; caps before any read; at most two attempts; ECDSA-only path with regular code; an ML-DSA-44 ERC-1271 account | As in H1–H9. The ML-DSA-44 account passes with `B_exec` = 2,000,000 and fails under a 250,000 cap that includes calldata |
| TC22 | Q1–Q8 | Refusals per path; the delegation cutoff; on a host that accepts ECDSA, a forged grant from a victim EOA followed by the attacker's post-quantum request | Refusals as specified; the last case decrypts (asserted residual, Q7) |
| TC23 | A1–A4 | A thief-added observer; transfers to and from a retired account; the variant without Profile A | The retired account clears the observer and it cannot be re-added; transfers succeed; the variant leaks the current balance and future amounts (asserted residual) |
| TC24 | Scope | Retire on chain A only; a certificate listing chains A and B | Chain B is unaffected; both chains retire |

Expiry-boundary tests do not pin the exact expiry second, because implementations differ on whether expiry is inclusive.

### Conformance kit

`assets/erc-XXXX/conformance/` holds a vendor-neutral kit:
- **Registry kit.** `DecryptionAuthorityLifecycle.t.sol` is an abstract Foundry suite that encodes TC1–TC12, TC17 and TC19.
  - It drives a registry through this ERC's interfaces, and through an adapter for the registry's own paths: grants, delegation, permits, publication, the engine's operand check and upgrades.
  - A test that does not apply is reported as skipped: no on-behalf role, no on-chain permit, no E1 or no E2.
- **Verifier kit.** `verifier/fixtures/tc13.json`, `tc14.json` and `tc15.json` hold language-neutral rows: the request, the chain state, the rule and the outcome it requires. A checker judges one verifier harness's recorded runs against them.

### Where the tests live

Results exist for every level (status as of 2026-10-22).

| Tests | Harness | Location and status |
|---|---|---|
| TC1–TC12, Core gas | Registry tests (Foundry) | `impl/fhevm-main` (`5e61f3d`) and `impl/fhevm-v0.13.8` (`06d769f`), branch `lifecycle/level0`, under `host-contracts/test/acl/`. Done: main 143/143, v0.13.8 128/128 (`results/level0/LEVEL0_CONTRACTS.md`) |
| TC1–TC12, TC17 and TC19 through the conformance kit; TC13–TC15 as fixtures | The kit above, with one adapter per registry | Done (`results/phase4/P2_3_CONFORMANCE_KIT.md`). Zama `main` and the v0.13 line: 17 passed, 1 skipped (no on-chain permit), three runs with Foundry's isolation off and one with it on. The Fhenix port: 14 passed, 4 skipped (no E1, no E2). Removing any one of six gates from the reference registry makes the kit fail. The fixtures judge the recorded runs: TC13 594 and 132 cells conform, TC14 21 per line; TC15 35 conform, and the 8 violations are the unmodified verifier's, as expected |
| TC1–TC12 and TC6 on a second registry; the R10 negative test | Foundry, on a port of Fhenix CoFHE's host-chain contracts (`cofhe-contracts` `b5c20ed`), with Fhenix's unmodified `TaskManager` and contracts alongside | `impl/fhenix-port/`. Done: 55 tests plus the conformance kit's adapter, 69 passed and 4 skipped (no E1, no E2), three runs. Every one of 17 gates removed in turn fails the suite. TC3: a differential fuzz against Fhenix's unmodified contracts, and Fhenix's own plugin suite on its published mock stack. TC6 includes the ACP share registry. The R10 negative test: a caller-identity exemption on this registry passes every relayed grant and the oracle's permit check for a retired account (`results/phase4/P2_1_FHENIX_PORT.md`) |
| TC4, TC5 and the end-to-end flow (views and flow only) | The vendor's cleartext mock on a local anvil chain | `impl/harness/level0-mock/` against branch `lifecycle/level0-mock` of the v0.13.8 clone. Done: 15/15 over 3 runs (`results/level0/MOCK_E2E.md`) |
| TC13, retirement part | Unmodified verifier against the real registry on a local anvil chain | `results/level0/harness/{v0.13.8,main}/crates/kms-worker/tests/acl_retirement_real_chain.rs`. Done: a retired requester, handle owner, delegator, delegate or contract is refused before the oracle on every path; never-retired requests are forwarded; v0.13.8 96/96, main 222/222 (`results/level0/CONNECTOR_PROOF.md`). A permit recipient does not exist on the example (no request field names one; `results/phase4/P0_1_TC13.md`) |
| TC13, failure part | Unmodified verifier, with a fault-injecting JSON-RPC proxy between it and the chain | `results/phase4/harness/{v0.13.8,main}/crates/kms-worker/tests/acl_tc13_faults.rs`, `impl/harness/phase4/fault_proxy.py`. Done: errors, HTTP errors, dropped connections, timeouts, malformed JSON, empty or truncated results, reverts and intermittent failures on every view call; V1 cells main 110/110, v0.13.8 44/44, three runs each (`results/phase4/P0_1_TC13.md`) |
| TC14 | Same harness, with a JSON-RPC proxy that records the head block of every view call and can hold an answer | `results/phase4/harness/{v0.13.8,main}/crates/kms-worker/tests/acl_p02_decision_lag.rs`. Done: L = 0 on both lines (every view at `latest`); a request after the retiring block is refused; one decided before it is served (the race, with timing); a rolled-back retirement no longer refuses; a restarted verifier and an already-sent request re-check; no decision path authorizes from a replica (7/7 cases per line, three runs each; `results/phase4/P0_2_TC14.md`) |
| TC15 | Same harness | **V7 part done** with Profile H (branch `lifecycle/level1`, `cce53bb`): a retirement denial is final at its first attempt and typed `account_retired`; after a simulated governance lapse the request is not revived, while the unmodified verifier revives it (`results/level1/PROFILE_H_CONNECTOR.md` §2). Measured before that: the unmodified verifier retries a retirement denial, untyped, up to its attempt limit (`CONNECTOR_PROOF.md` §8). **V6 part done** (`results/phase4/P0_3_STORED_RESULTS.md`, three runs each). Unmodified, on `main`: the connector endpoint serves a stored result again after retirement, and the relayer serves the stored job to the same request and to an equivalent one, because its deduplication key ignores the signature and the validity window. With H7 (`lifecycle/level1`, `a15aaa6` and `256306b`): both refuse, final `account_retired` in the connector |
| TC16 | Share-collection simulation | `impl/harness/level3/profile_q_sim.py`. Done: on real Shamir shares (n = 13, t = 4), reconstruction if and only if k ≤ 8. With 5% outages, 77% of releases still succeed at k = 8, the partial-adoption cliff (`results/level3/LEVEL3.md` §4). With 13 real verifier instances, k of them enforcing Profile Q, the same rule holds for k = 0, 4, 5, 8, 9 and 13, and a post-quantum request is served at every k (`results/phase4/P1_2_PROFILE_Q.md`) |
| TC21, signature-library part (H1–H4, H8) | Signature library: mocked-provider tests and a local EVM | Branch `lifecycle/level1`, `shared/user-decryption-signature/tests/profile_h.rs` (20 tests), and `impl/harness/level1/` on anvil (Osaka). Done: the code-first matrix, ERC-7739 plain typed data, caps before any read, the budget, at most two attempts a block apart, and the ML-DSA-44 account (accepted at B_exec 2,000,000, refused at the 250,000 cap) (`results/level1/PROFILE_H_CRATE.md`). Found: a top-level out-of-gas must count as an empty revert under H4 |
| TC21, verifier part (H5, H6, H8, ECDSA-only path) | Verifier harness: Zama's kms-worker against a local EVM | Branch `lifecycle/level1` (`cce53bb`) and `results/level1/harness/` (4 tests, 27 requests). Done: final, typed retirement denials on every path, including after a simulated governance lapse; refusal of regular code on the ECDSA-only path; code-first refusal under `enforce` and logging under `shadow` (`results/level1/PROFILE_H_CONNECTOR.md`). The ML-DSA-44 account through the verifier itself: forwarded with `isValidSignature` at gas 2,183,048, 9 requests over three runs (`results/phase4/P1_6_SMALL_GAPS.md`) |
| TC21, H9 (advisory prechecks) | The SDK's precheck on a local EVM; the relayer's pre-check with a mocked provider | Branch `lifecycle/level1` (`5b69260` SDK, `0eec675` relayer). Done: the same caps, budget and ordering as the verifier. The SDK refuses the ML-DSA-44 account at the 250,000 cap and accepts it under the policy (call gas 2,183,048); under `enforce` it refuses a 7702 root key the delegate rejects, and `shadow` logs it (4/4 on anvil; 910/910 SDK unit tests). The relayer: 59/59 pre-check and settings tests, 281 unit tests passed, lint clean (`results/level1/H9_PRECHECKS.md`) |
| TC21, H7 | Verifier harness: the connector endpoint as its own process with the kms-worker; the relayer with its in-process mocks | `results/phase4/P0_3_STORED_RESULTS.md`. Done: a stored result is revalidated at a fresh decision block before it is served, and deduplication is keyed on the signature and the validity window. The H4 attempt state survives a worker restart (2 ERC-1271 calls in total, against 3 when kept in memory) |
| TC21, EIP-7851 part (H2, H6, H9) | A JSON-RPC proxy that answers `eth_getCode` with `0xef0101 ‖ delegate` while anvil keeps the EIP-7702 delegation; the verifier library, the SDK and the verifier harness | `results/phase4/P0_4_EIP7851.md`. Done: unmodified verifiers accept the disabled root key on every path (main and v0.13.8); under `enforce` the root key is refused and the ML-DSA-44 signature accepted at `B_exec` 2,000,000; H6 refuses the legacy path; a retired account is refused by every verifier; the SDK precheck agrees (three runs each). The SDK's `getAuthorityStatus` reports such an account as `eip7851`, with its retirement and successor state (`results/phase4/P1_6_SMALL_GAPS.md`) |
| TC17, TC18 | Foundry; verifier harness | Branch `lifecycle/level2` of both clones, `host-contracts/test/acl/ACLSuccession.t.sol`. Done: 41 tests per line (main 188/188, v0.13 line 173/173 in `test/acl/*`). The unmodified verifier serves the successor and refuses every other delegate: v0.13.8 8/8, main 13/13 requests (`results/level2/LEVEL2_E1.md`). In the vendor's cleartext mock, through its SDK: 7/7 over 3 runs (`results/level2/SDK_HYGIENE_AND_MOCK.md`) |
| TC23 | Foundry | Branch `lifecycle/level2` (main), `host-contracts/test/acl/ACLRetirementProfileA.t.sol`: 15 tests (`results/level2/PROFILE_A.md`). Found: the operator gate must refuse an expiry equal to the current timestamp, and A4 must cover the registry's `multicall`. On stock OpenZeppelin 0.5.3 (npm package, unmodified, solc 0.8.27): TC8 and the token parts of TC23, with and without the Profile A extension, 14 tests, three runs (`results/phase4/P1_4_PROFILE_A_STOCK.md`) |
| TC19, TC24 | Foundry; three anvil chains | Branch `lifecycle/level3` (main), `host-contracts/test/acl/ACLRetirementCertificate.t.sol`: 13 tests, including this ERC's vector; the watchtower relays a certificate across real chains (`results/level3/LEVEL3.md` §1) |
| TC20, signature-library part | Signature library | Branch `lifecycle/level3-verifier` (`538dc88`), `shared/user-decryption-signature/tests/{kda,k8,k8_vectors}.rs`. Done: ML-DSA-44/65/87, no fallback, refused on direct entries, an unmodified verifier fails closed. Four implementations each pass 631/631 Wycheproof vectors and every ACVP sigVer vector of the interfaces they expose (45/45 each on the route's pure interface). K8 in both modes with an injected fault; 52/52 tests, three runs (`results/phase4/P1_1_E3_CONNECTOR.md`) |
| TC20, verifier part | Verifier harness: the kms-worker with the E3 route and K8 against a local EVM | Branch `lifecycle/level3-connector` (`564d7d1`). Done: KDA requests for ML-DSA-44/65/87 are forwarded under each K8 mode; the K5 negatives and a signature over another digest are refused. A failed ML-DSA check makes no ERC-1271 call (no fallback); a KDA with code is not routed and is refused on Profile H's ordinary path; revocation and retirement refuse KDA requests; an injected fault in one library passes in its single mode and is refused as a disagreement where two must agree; the unmodified verifier fails closed. 35 rows, three runs (`results/phase4/P1_1_E3_CONNECTOR.md`) |
| TC22, on-chain door | Foundry | `host-contracts/test/acl/ACLProfileQResidual.t.sol`: the asserted residual, and its closure by a prior retirement |
| TC22, verifier part, and Q1 | Verifier harness: the kms-worker with Profile Q against a local EVM | Branch `lifecycle/level3-connector` (`e8a5a685`). Done, in both variants: Q4 refusals per path (a code-less ECDSA signer, an EIP-7702 account with its root key or its delegate's signature, the ECDSA-only legacy path), with no ERC-1271 call for an ECDSA-rooted signer; EIP-7851 and contract signers through ERC-1271 in no-root-ecdsa only; E3 in both. Q5: delegations from ECDSA-rooted and EIP-7851 delegators count only if unchanged since `B_Q`; a regular-code delegator is not cut off. The example registry has no getter for a delegation's last-change block, so the verifier reads it from the registry's storage, for known layouts only. Q1: 13 or 9 ML-DSA-65 operator statements establish the profile; 8, an invalid, an intruder's or a duplicate signature, another `B_Q`, ICS or registry do not. The asserted residual: a forged grant from a victim EOA lets the attacker's ML-DSA-44 account decrypt. 151 rows, three runs (`results/phase4/P1_2_PROFILE_Q.md`) |

## Reference Implementation

The reference implementation is a **local prototype on Zama fhEVM**. It is not deployed on any network and has not been audited. Before submission it would move to `assets/erc-XXXX/`.

- **Clones**, both starting from the branch `lifecycle/base`:
  - `impl/fhevm-main`: fhEVM `main` at `ed851716c`;
  - `impl/fhevm-v0.13.8`: tag `v0.13.8` at `fe3ca89b5`, the release deployed on Sepolia and Ethereum mainnet.
- **Level 0 (Core)**, branch `lifecycle/level0`, in `host-contracts/contracts/ACL.sol`:
  - the `main` registry moves from 0.7.0 to 0.8.0 (reinitializer 8 → 9, `reinitializeV8()`);
  - the `v0.13.8` backport moves from 0.4.0 to 0.4.1 (reinitializer 5 → 6, `reinitializeV5()`); the vendor's cleartext mock is re-pointed at it;
  - an optional 0.14-line target, 0.5.1 (reinitializer 7), is built only if time permits.
- **Retirement state** lives in the ERC-7201 namespace `fhevm.storage.ACLRetirement`, at location `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200`. `retirementStorageLocation()` returns this value.
- **The R10 exemption** is a constant comparison against the engine (`FHEVMExecutor`) address in `isAllowed` only. It is valid under three invariants, each pinned by a test:
  1. the engine reads `isAllowed` only at its operand check, with its caller as subject;
  2. every transient grant by the engine names its caller;
  3. no other host contract reads the views as the engine.
- **Later levels** (branches `lifecycle/level1` to `lifecycle/level3`, created by the implementation):
  - Level 1: Profile H in the shared signature crate, the verifier configuration, the relayer configuration and the SDK constant;
  - Level 2: E1, an `isAccountRetired` helper for applications, a Profile A variant of an ERC-7984 token, a carry tool and SDK transport hygiene;
  - Level 3: E2, the E3 route in the verifier (`kms-worker`) with K8 across four ML-DSA implementations, Profile Q as an operator policy, and a governance demonstration.
- **Harnesses** are in `impl/harness/`; results and logs in `results/level0/` to `results/level3/`.

## Security Considerations

### The three limits

1. **Pre-emptive, not a clawback.** Retirement protects an account whose key has not yet been used against it. After a compromise it is a race that the attacker usually wins. Whatever the key already re-shared, published or had decrypted stays exposed.
2. **Oracle access only.** Retirement stops the oracle honouring the key. It does not stop the key acting as an account: moving funds, or holding application roles such as observers and operators.
3. **As final as the chain's governance.** Retirement is per host chain, and whoever can upgrade that chain's contracts can undo it.

### Residual risks of the Core

- **Post-compromise exposure (limit 1).** Grants to third parties, public handles and plaintexts already released stay exposed.
  - Off-chain permits need no transaction, so there is nothing to front-run or watch.
  - Private order flow helps neither side decisively.
- **Identity-gated application roles (limit 2)** stay open until applications adopt Profile A.
- **Governance, or a request contract on another chain (limit 3),** can undo or bypass retirement. See [Governance](#governance).
- **Stored results and reusable transport keys.** In the example, results are served from storage and a transport key can be reused under a permit valid for up to 365 days [V, VERIFICATION §4 (N5, N6)]. V6 (required under Profile H) and per-request transport keys address this.
- **Per-chain coverage.** An account must retire on every host chain; the same registry release also runs on Polygon [M, CENSUS].
- **Contract self-retirement** disables every handle the contract governs. A contract with a generic-call path can be made to retire itself, or to confirm a successor chosen by whoever controls that path and then retire (A4).
- **Lockout.** An account retired without a successor, whether by its holder, a thief or a phished signature, leaves its data readable by no one.
- **Linkability.** Carry grants and successor designations publicly link the old and the new account.
- **Reorganizations and lag.** A retirement included in a block that is reorganized away is not in effect. A verifier that evaluates at a deep decision lag honours retirement correspondingly later. Clients should show confirmation levels.
- **Delegate concentration.** One delegate address served 374 of 403 delegators on mainnet [M, CENSUS]. Retiring that address, or any delegate, disables every delegation to it at once, by design.

### Residual risks of the extensions

- **E1.**
  - An attacker who holds the key can designate and accept its own address. If that goes unnoticed for D, it confirms, and the attacker successor survives retirement.
  - A thief can keep replacing pending designations. The safe response is to carry and retire at once, which voids the pending designation.
  - Where another component verifies the delegate's ECDSA signature, the successor must be an ECDSA account, and losing its key is final.
  - There is no transitivity: auditors rely on carry.
- **E2.**
  - A leaked certificate triggers an early, but planned, handover.
  - A certificate does not protect the past after a theft.
  - A quantum forgery of an ECDSA certificate is bounded by the successor binding.
- **E3.**
  - Implementations of ML-DSA and SLH-DSA are young (see [Unaudited libraries](#unaudited-libraries)), and a verification bug could accept forged permits; hence K7 and K8.
  - Without an exclusive variant, ECDSA permits for the same account stay valid until Profile Q engages.
  - The route is impossible on paths where another component verifies ECDSA.

### Residual risks of the profiles

- **Profile H.**
  - Code-first ordering retires nothing for 7702 accounts whose delegate accepts the root key.
  - ECDSA-only paths stay ECDSA until they are refused.
  - The refusals bind only at n−t operators.
- **Profile Q.**
  - The on-chain door stays open without a host-chain freeze (Q7).
  - Activation by fewer than n−t operators protects nothing; the commit-then-activate procedure exists to avoid that cliff.
  - In the example, oracle response signatures are still ECDSA [V, VERIFICATION §B7].
  - Public decryption is unchanged.
  - Accounts that did not prepare lose access; this is fail-closed by design.
  - An ECDSA successor is itself exposed to a CRQC.
- **Profile A.** Adoption is outside this ERC's control. Without Profile A, a thief-added observer keeps reading the current balance and every future amount.

### Host-state sources

Each node reads the views through a host-state source. In the example, each operator reads every view through one configured RPC endpoint per host chain [V, A7 §2.13]. Whoever controls the host-state source of t+1 nodes can make them answer "allowed" for any request. That bypasses every authorization rule, not only retirement. The risk exists before this ERC and applies to every threshold oracle. O2 requires the sources to be disclosed in aggregate, and O3 recommends diversity and confirmation of positive answers (Open question 10).

### Unaudited libraries

The prototype and the measurements behind this ERC rely on libraries that have no completed security audit for this use:

- the RustCrypto `ml-dsa` crate 0.1.1, used by the E3 route; the example's own dependency manifest flags it as having no security audit;
- the `ml-kem` crate 0.3.2, in the example's reply channel; it is flagged as medium risk, without a completed audit for that use;
- the Fireblocks `evm-ml-dsa-verifier` at `cca262b5` (MIT, unaudited), used for the ERC-1271 measurements and the Profile H test account;
- the further ML-DSA implementations used for K8: `fips204` 0.4.6, which its README calls experimental; Cryspen's `libcrux-ml-dsa` 0.0.10, whose field arithmetic, NTT and serialization are formally verified, with no published audit found; and PQClean's `clean` implementation through `pqcrypto-mldsa` 0.1.2;
- `dilithium-py`, a pure-Python implementation vendored in that verifier repository, used only as an independent test signer.

The ZKNOX verifiers (ETHFALCON, ETHDILITHIUM) are cited, not run [V, VERIFICATION §0, §B7, §4 (N6); A7 §6]. No conformance claim for E3 should rest on a single unaudited library (K8).

### Governance

Whoever can upgrade the registry can make the views ignore retirement (limit 3).

- **Example** (read on-chain on 2026-10-20). The Ethereum mainnet registry of the example deployment is owned by a DAO. Either of two ECDSA multisig plugins (3-of-6 and 9-of-17) executes for it, with no timelock [V, VERIFICATION §B8].
- **What the guard does.** The guard (R11) stops accidental lapses, such as a rollback, a release line without Core or a skipped upgrade. It does not stop an implementation that lies.
- **Operator controls.** The retirement canary and implementation pinning catch such an implementation, but only at n−t operators.
- **Timelock.** A timelock with an exit window gives operators time to review, refuse or pin.
- **Durability.** Post-quantum governance signers, plus ratification of rights-widening upgrades by at least n−t operators, are the precondition for any durability claim against a CRQC.
- **Exemption.** Misapplying R10 (caller identity on a relaying engine) would switch retirement off entirely.

## Open Questions

The text above uses the default stated for each question. Each question awaits the author's decision.

1. **Upgrade guard (R11).** Required for UUPS registries and kept in the Core, even though it blocks quick rollbacks to implementations without Core.
2. **Successor acceptance (S2).** Mandatory; a cold recovery key must therefore sign one transaction at setup.
3. **Delay (S7).** A floor of 7 days, default 7, and an optional per-account raise of up to 365 days.
4. **Certificates (E2).** They require and bind a confirmed successor and carry an explicit chain list. Accounts without a successor retire directly; the hash-commitment form is deferred.
5. **Profile Q notice (Q3).** 24 months scheduled, plus the two emergency triggers. The alternative is a date aligned with NIST IR 8547.
6. **Timelock delay (governance profile).** At least 7 days now; 14 days recommended for rights-widening changes.
7. **Names.** The title "Decryption Authority Lifecycle", and "Retirement Certificate" rather than "Revocation Certificate".
8. **KDA identifiers (E3).** The domain tags and the hash-derived scheme ids are provisional. The alternative is alignment with [EIP-7932](./eip-7932.md) algorithm types.
9. **Reply KEM (Q6).** The Core stays transport-neutral; replies published on-chain are recommended to use ML-KEM-768 or stronger.
10. **Host-state concentration.** Stated in general terms, as a property of every threshold oracle (O3, Security Considerations).
11. **Inco.** Inco Lightning's contracts (1.1.0) were read. Core maps onto its registry without a change of mechanism, and the engine exemption is an internal call site, because the engine is the registry. Its decryption service is not public, so the verifier side is not examined, and no port was run (Phase 4 INCO_MAPPING). This ERC claims no tested fit for Inco.
12. **Liveness getters (R14).** A recommendation, not a requirement. The reference implementation's delegation-expiry getter returns 0 for retired parties.
13. **Reference-implementation targets.** These do not affect the normative text: which release line a production proposal targets, and whether the optional 0.14-line build is made.

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).
