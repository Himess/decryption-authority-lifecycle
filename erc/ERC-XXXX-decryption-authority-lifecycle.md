---
eip: TBD
title: Decryption Authority Lifecycle
description: One-way retirement of an account's authority to have oracles decrypt confidential data, enforced in the views oracles read
author: Semih Civelek (@Himess)
discussions-to: TBD
status: Draft
type: Standards Track
category: ERC
created: 2026-10-21
requires: 165, 712, 1271
---

## Abstract

This ERC specifies a lifecycle for an account's authority to have a decryption oracle release confidential data that a host chain holds as ciphertext handles. The Core adds one state transition, **retirement**. An account calls `retireAccount()`. From then on, every authorization view that oracles already consult returns false for that account in every role it can play: requester, owner, delegator, delegate, contract, permit issuer and permit recipient. Verifiers release nothing unless every applicable view returned true at decision time, and a threshold oracle conforms only if at least n−t of its nodes do.

Two optional registry extensions build on the Core:

- a **Successor** (E1), designated, accepted and matured in advance, that keeps read access to a retired account's data;
- a successor-bound **Retirement Certificate** (E2) that anyone can relay to the chains it lists.

A companion document, `docs/COMPANION_EXTENSIONS_AND_PROFILES.md` in the reference implementation's repository, describes further candidates for later standards: a declared post-quantum decryption signer (E3), and profiles for verifier signature hygiene, a scheduled post-quantum-only oracle mode and applications.

The result is revocable access, with three limits: it is pre-emptive, not a clawback; it covers oracle access only; and it is as final as the host chain's governance.

## Motivation

In confidential execution built on a decryption oracle, whether a threshold network or a trusted execution environment, ciphertexts sit on a public host chain, and the oracle decides at every request whether to release a plaintext. The confidentiality of past data is therefore decided again each time someone asks. The authority to ask is, for almost every account today, an ECDSA key bound to an address for life, and no system we examined lets an account end that authority. A leaked key, or a future cryptographically relevant quantum computer (CRQC) that derives the key from a published public key, inherits the account's entire history.

This ERC adds the missing lifecycle step, **revocable access**: an account can **retire** its authority to ask, and every conforming oracle then refuses every request that rests on that authority.

### Measured facts

Each item is measured [M] or verified in code [V]; inferences are marked [I]. The numbers in brackets are entries of `assets/erc-XXXX/EVIDENCE.md`, which gives the date, the method and the raw data of each. The example system is Zama fhEVM, whose release `v0.13.8` (registry `ACL` v0.4.0) runs on Sepolia and Ethereum mainnet.

1. **No user can retire.** An account can revoke or shorten a delegation it granted, and on the example's `main` line it can invalidate its permits whose start time is earlier than a chosen time. It cannot end its own authority: it cannot withdraw a per-handle grant, undo a public decryption, or stop its key from signing new permits. The deny list is owner-only, and no view or off-chain component reads it [V, 1].
2. **One transaction exposes history.** On Sepolia, `ACL.allow(balance, BOB)` (140,780 gas) let BOB decrypt ALICE's balance with his own permit, and `ACL.allowForDecryption([balance])` let anyone decrypt it. One wildcard delegation with no expiry covers every past and future handle at constant gas [M, V, 2].
3. **Invalidation acts on permits, not keys.** A signed permit lives until its expiry, up to 365 days, and the key holder can always sign a fresh one [M, V, 3].
4. **Upgrading the account does not retire the key.** An EOA delegated through [EIP-7702](./eip-7702.md) to a wallet that rejects every signature still decrypted with its original key [M, 4]. Disabling the key on the host chain, as the drafts [EIP-7851](./eip-7851.md) and [EIP-8298](./eip-8298.md) propose, does not reach off-chain verifiers that recover a signature before reading the account's code: in simulations of both, the example's unmodified verifier accepted the disabled key on every request path [M, 9].
5. **Post-quantum accounts cannot authorize at today's limits.** An ML-DSA-44 [ERC-1271](./eip-1271.md) account's `isValidSignature` cost 1,232,720 gas; the example's verifier accepted it only at a gas limit 5.24 times its 250,000 cap, and the deployed path accepts only 65-byte ECDSA signatures [M, 5].
6. **The path is in use, and almost every holder is ECDSA-rooted.** The testnet gateway served about 1,577 user decryptions in 21 hours [M, 6]. A mainnet census found 12,714 accounts holding handles; in a random sample of 1,000, 97.9% had no code or an EIP-7702 delegation [M, 7].
7. **Another design shares the gap.** Fhenix CoFHE never revokes allowances, and its permits' expiry has no upper bound [V, 8].

### Why the authorization views

In the example, every off-chain component that decides a release reads the registry's authorization views at request time [V, 10]. Any 5 of the oracle's 13 node responses reconstruct a result. A rule enforced in node software therefore protects users only once at least 9 operators run it, while a rule enforced inside the views binds every verifier, of every release, from the block in which the registry is upgraded.

This ERC therefore standardizes *where* lifecycle state is enforced, inside the views the oracle already consults, and leaves the rest of each vendor's registry as it is. With about 98% of holders ECDSA-rooted, an oracle-side switch that refused ECDSA authority today would be an outage, not a protection [I]; retirement is therefore opt-in per account.

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
| Decision block | The block at which a verifier evaluates views |
| Decision lag (L) | The largest distance, in blocks, that a verifier allows between the decision block and the latest block it knows |
| Delegation indicator | Account code of exactly 23 bytes: `0xef0100` followed by an address (EIP-7702) |
| Host-state source | The means by which a node reads host-chain state: an RPC provider, its own node or a light client |
| ICS | Implementation Conformance Statement: an oracle's published declaration of how it conforms |

### Conformance classes and claims

| Class | Core requirements | Optional claims | How a claim is made |
|---|---|---|---|
| Registry | R1–R14 | E1 (S1–S11), E2 (C1–C8) | [ERC-165](./eip-165.md) |
| Verifier | V1–V5 (MUST); V6, V7 (SHOULD) | Those of the companion document | ICS |
| Oracle | O1, O2 (MUST); O3 (SHOULD) | Those of the companion document | ICS |
| Application | R14 (no authorization from raw getters) | Those of the companion document | The application's documentation |
| Client (wallet, SDK) | none | The client rules of E1 (S11) | — |

Each extension is a separate claim. Claiming one does not imply Core conformance of another class.

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
- **R14. Raw getters.** Liveness getters SHOULD return the inactive value whenever a party is retired (Open question 9). A raw getter that does not reflect retirement, such as a getter of transient grants, MUST be documented as non-authoritative. Verifiers, deputies and applications MUST NOT base an authorization decision on it.

Note (non-normative): functions that only remove rights, such as revoking a delegation, are not grant paths. R7 does not make them revert, and the reference implementation keeps them callable by retired accounts.

### Core verifier requirements

- **V1. Release rule.** A verifier MUST NOT release, MUST NOT forward a request for release, and MUST NOT produce or return a share unless every applicable view returned true at decision time. This holds for every subject of the request, on the registry of the host chain of every handle in the request. An error, a revert, a timeout or a malformed answer counts as false. A malformed answer is any return data other than exactly one ABI-encoded `bool`: 32 bytes holding 0 or 1.
- **V2. Freshness.** Views MUST be evaluated after the request is received, at a decision block no more than L blocks behind the latest block the verifier knows. L is stated in the ICS. A positive answer MUST NOT be reused for another request or another decision block.
- **V3. No exemption spoofing.** A verifier MUST NOT evaluate any view with the engine, or any other address that R10 exempts, as the caller (`from`).
- **V4. No bypass.** V1 MUST apply to every request path the verifier serves and to every signature scheme it accepts: ECDSA, ERC-1271, any other scheme (such as the companion document's declared signers) and any legacy path.
- **V5. Replicas.** A verifier that evaluates views against a replica, index or cache of host-chain state MUST first apply every `AccountRetired` event, and every other state change the views depend on, up to the decision block. Otherwise it MUST NOT authorize from that replica.
- **V6. Stored results (SHOULD).** Before serving a result produced earlier, whether stored, cached or keyed to an equivalent request, the verifier SHOULD apply V1 again at a fresh decision block. The ICS MUST state the stored-result policy.
- **V7. Final retirement denials (SHOULD).** When a request is denied, the verifier SHOULD call `isAccountRetired` for each subject. If any subject is retired, the denial SHOULD be final: typed `ACCOUNT_RETIRED`, never retried, never revived.

The companion document's verifier profile makes V6 and V7 required.

### Core oracle requirements

- **O1. Conformance per deployment.** A threshold oracle conforms to Core only if at least n−t of its n nodes run Core-conforming verifiers. An oracle with a single release unit, such as one trusted execution environment, conforms only if that unit does. Conformance is stated per host chain, per registry release and per deployment.
- **O2. ICS.** An oracle that claims conformance MUST publish an ICS and MUST update it before any change to the listed values takes effect. The ICS states at least: the registry (chain id and address per host chain), the ERC-165 ids it reports, its governance (upgrade authority of every contract on the release path, timelock delay, engine address), n and t, L per host chain, the stored-result policy (V6), the reply KEM and transport-key policy, the host-state sources in aggregate, the successor delay D if the registry implements E1, and every claim of the companion document with its parameters.
- **O3. Host-state diversity (SHOULD).**
  - A deployment SHOULD ensure that no single host-state source, and no correlated set of sources, determines the view answers of t+1 or more nodes.
  - A node SHOULD confirm each positive answer against its own node, a light client, or two independent providers that must agree.
  - A node SHOULD fail closed when they disagree.

**Threshold conformance.** Restrictive requirements, V1–V7 and any refusal a companion profile adds, bind an oracle only when at least n−t nodes enforce them. An oracle MUST NOT claim a restrictive requirement for fewer enforcing nodes. Additive capabilities are available only where at least t+1 nodes support them, and the ICS states the count.

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
  - Clients MUST NOT designate a key-derived address (the companion document's declared signer, E3) as a successor. Such an address cannot accept (S2).

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

### Scope across host chains

Retirement is a property of an account on one registry on one host chain. A verifier evaluates the registry of each handle's host chain (V1). A handle moved to another chain is a new handle there, and retirement on the source chain does not cover it. E2 lets one signature list several chains. This ERC defines no propagation of retirement between chains.

### Out of scope

This ERC does not standardize a Suspended state or reason codes; an on-chain post-quantum-only flag or a registry-level ECDSA sunset; propagation of retirement between chains, or an oracle "union" of retirements; a carry function, or retirement through a deny list; an immutable registry as the primary store; successor-issued delegations or succession transfer; or a hash-commitment certificate. The verifier, oracle and application profiles, and the declared signer, are candidates in the companion document.

## Rationale

**Placement in the views.** A restriction in node software binds only once n−t nodes run it, while a grant needs only t+1. A restriction in the authorization views binds every verifier in the upgrade block, with no verifier change. In the example, every off-chain decider reads only views that Core gates, and the verifier sets no `from` on its view calls [V, EVIDENCE 10]. That is why this ERC holds only rules that live in views or that verifiers can meet unchanged, and why everything that needs new verifier code is a companion candidate.

**Every role, including the contract.** One rule, "no retired account satisfies any authorization view in any role", is easier to test than a list of exceptions, and it costs one storage read inside a view that verifiers already call. In the example, a retired contract was refused on the direct path but still passed the delegated path, because the delegated view read the contract's raw rights [V, EVIDENCE 11]; R6 closes that.

**An exemption defined by semantics.** The engine exemption keeps the computation path unchanged, so retirement adds no cost to computation and cannot break an application mid-flow. It is safe only because every output can leave through a gated evaluation alone. In the example, the engine reads the use view at one operand choke point, with its caller as subject, and grants outputs only transiently to that caller [V, EVIDENCE 12]. Fhenix CoFHE's engine instead relays grants, the public use view and the oracle's permit check to its registry, always as itself. On a port of that registry, a "skip when the caller is the engine" rule passed every relayed grant and the decryption service's permit check for a retired account, while a dedicated operand-check entry kept each one gated [M, EVIDENCE 13]. R10 therefore defines the exemption by what a check is for, and V3 closes the remaining off-chain spoof.

**An upgrade guard with two checks.** In the reference implementation, a backport of Core to an older release line (registry 0.4.1) can be upgraded to a later line without Core (0.6.0 or 0.7.0), which then silently stops reading retirement [V, M, EVIDENCE 14]. The guard turns that lapse into a revert. An ERC-165 check alone would pass a release that declares Core but reads a renamed namespace, resetting every retirement; a location check alone would pass a release that kept the getter but dropped Core. The guard stops accidents, not an implementation that lies; canaries and pinning cover that ([Governance](#governance)).

**Two states, no reason code.** NIST SP 800-57 defines Deactivated and Compromised key states. For an authority whose only use is to ask for decryption, both mean "refuse", which is Retired. A Suspended state that someone can lift is a target: if the key can lift it, a thief can; if a guardian can, the guardian becomes a new per-user censor. Suspension would also gate the account's own writes, so "suspend, then carry" is impossible, and it breaks the monotonicity that makes final denials and canaries safe. A reason code chosen by a possibly hostile key is not evidence, and a public "compromised" flag is a breach notice.

**Revert on a second retirement; inert inbound grants.** A deterministic failure is easier to handle than a silent success. Inbound grants must not revert: a confidential token grants the recipient its new balance handle on every transfer, so refusing grants would break transfers to every retired account.

**The one-key rule.** For an ECDSA account, the owner and a thief hold the same key. Any transition that this key alone can trigger must therefore be a pure reduction, unless it was committed while the key was safe. What survives retirement must mature; what retirement disables may be instant.

- **Successor.** It survives retirement, so it is designated in advance, delayed (D ≥ 7 days), public, and accepted by its beneficiary. Acceptance proves the successor can transact: a typo, a burn address or a key-derived address cannot accept. A dedicated record was chosen over a locked wildcard delegation, which is live before retirement and shows wallets a revoke button that cannot work.
- **Certificate.** The only signature-relayed transition. Because it is bound to a confirmed successor, a leaked or forged certificate can trigger only the handover the holder committed in advance; without that binding it is a lockout. A nonce, an expiry or cancellation by the key adds nothing against a thief who holds the same key. The explicit chain list lets one offline ceremony cover several chains without becoming a bearer instrument for chains added later.

**Relation to EIP-7851, EIP-8298 and [EIP-8151](./eip-8151.md).** These drafts change the host chain, not off-chain verifiers. An account can leave ECDSA by migrating in place, delegating to a post-quantum wallet and then disabling its key (EIP-7851) or adopting the wallet's code (EIP-8298), or by migrating out: retiring, with a successor or after carrying its rights to a new account. The second needs no host-chain change. Off-chain verifiers recover signatures in their own code, so none of these drafts reaches them [M, EVIDENCE 9]; the companion document's verifier profile reads the account's code first for that reason. E2 already does so on chain (C5). An account that migrates in place keeps its rights and can act, and so retire, only through its code. Nothing in this ERC depends on any of these drafts being adopted.

**Dependencies.** ERC-165 gives discovery, EIP-712 the certificate format, and ERC-1271 contract accounts in E2. ERC-7201 is recommended (R11), not required.

**Mapping to deployed registries (informative).**

| Role | Zama fhEVM `ACL` (`main` `ed851716c`; `v0.13.8`) | Fhenix CoFHE `ACL` (`b5c20ed`) |
|---|---|---|
| Use | `isAllowed`, `persistAllowed` | `isAllowed` (relayed as `TaskManager.isAllowed`), `persistAllowed`, `allowedTransient` |
| On-behalf | `isHandleDelegatedForUserDecryption`; `isDelegatedForUserDecryption` (`main` only) | `allowedOnBehalf` |
| Permit | none on-chain | `isAllowedWithPermission` (relayed as `TaskManager.isAllowedWithPermission`, which the decryption service calls); it consults the issuer and the recipient |
| Liveness getter | `getUserDecryptionDelegationExpirationDate` | `checkPermissionValidity`; the ACP share registry's `isShareValid` and `sharesFor` |
| Public | `isAllowedForDecryption` | `globalAllowed` (relayed as `TaskManager.isPubliclyAllowed`); `isAllowedForDecryption` |
| Engine | `FHEVMExecutor`: caller identity is valid under three tested invariants | `TaskManager`: relays grants, the use view and the permit check as itself, so it needs a dedicated operand-check entry |
| Grant paths | `allow`, `allowForDecryption`, `allowTransient` (non-engine branch), `multicall`, `delegateForUserDecryption` | `allow`, `allowGlobal`, `allowForDecryption`, `allowTransient`, `batchAllowTransient`, `shareCtHash` (relayed with the user as requester or sharer); `delegateAccount`; the share registry's `share` |

The Zama column was verified on both release lines and the Fhenix column against `b5c20ed` and its decryption service `teecryptor` (`2616344`). A third registry, Inco Lightning, was read but not run (Open question 8).

**Rejected alternatives.** Write-side guards with a permit-invalidation sentinel are inert where verifiers never read invalidation. A fused "grant and retire" function turns one phished transaction into an irrevocable grant plus a lockout. An instant successor, or a certificate without a confirmed successor, means capture plus lockout. Propagating retirement through bridges lets a bridge compromise mass-retire accounts. Retirement kept in a governance-written deny list couples user state to governance writes. The companion document gives the full table, with the deferred alternatives.

**Open questions.** The text uses the default stated for each; each awaits review.

1. **Upgrade guard (R11).** Required for UUPS registries and kept in the Core, even though it blocks quick rollbacks to implementations without Core.
2. **Successor acceptance (S2).** Mandatory; a cold recovery key must therefore sign one transaction at setup.
3. **Delay (S7).** A floor of 7 days, default 7, and an optional per-account raise of up to 365 days.
4. **Certificates (E2).** They require and bind a confirmed successor and carry an explicit chain list. Accounts without a successor retire directly.
5. **Timelock delay.** At least 7 days now; 14 days recommended for rights-widening changes ([Governance](#governance)).
6. **Names.** The title "Decryption Authority Lifecycle", and "Retirement Certificate" rather than "Revocation Certificate".
7. **Host-state concentration.** Stated in general terms, as a property of every threshold oracle (O3).
8. **Inco.** Inco Lightning's contracts (1.1.0) were read: Core maps onto its registry without a change of mechanism, and the engine exemption is an internal call site, because the engine is the registry. Its decryption service is not public. This ERC claims no tested fit for Inco.
9. **Liveness getters (R14).** A recommendation, not a requirement. The reference implementation's delegation-expiry getter returns 0 for retired parties.
10. **Reference-implementation targets.** Which release line a production proposal targets does not affect the normative text.

## Backwards Compatibility

- **Active accounts.** Core changes no answer for an account that never retires. The reference implementation checks this by running the registry's existing test suites differentially (TC3).
- **Existing verifiers.** Verifiers that already read the gated views inherit Core's required verifier rules, V1–V5, with no code change. The example's verifier meets them unchanged at both release lines, on every request path, including when a view call fails [M, EVIDENCE 19]. The claim is conditional on the verifier decoding view answers strictly, as V1 defines a malformed answer; a deployment must check this in its own client. The same verifier does not meet the recommendations V6 and V7: on `main` it serves a stored result again after retirement, and it retries a retirement denial instead of making it final [M, EVIDENCE 19].
- **Applications.** Inbound grants still succeed (R8). An application that asserts U(h, recipient) right after granting would revert on transfers to retired accounts; OpenZeppelin's [ERC-7984](./eip-7984.md) implementation makes no such assertion in its transfer path [V, EVIDENCE 15]. A contract that retires itself disables the handles it governs on every path.
- **Getters.** A liveness getter that follows R14 returns the inactive value, for example an expiry of 0, when a party is retired.
- **Upgrades.** The guard (R11) deliberately refuses rollbacks to implementations without Core; the rollback target for a faulty Core release is a patched Core release. Where a vendor maintains several release lines, Core needs one release per line, with strictly increasing reinitializers.
- **Events.** Indexers that do not know `AccountRetired` ignore it [V, EVIDENCE 15].

## Test Cases

### Test vectors

Every constant in the Specification was computed with Foundry `cast` and cross-checked against `type(I).interfaceId` and `.selector` of the interfaces above; the interfaces compile with solc 0.8.4 and later. A conforming implementation reproduces them exactly. The interface identifiers are XORs of the selectors of each interface's own functions:

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

### Conformance kit

`assets/erc-XXXX/conformance/` holds a vendor-neutral kit:

- **Registry kit.** `DecryptionAuthorityLifecycle.t.sol` is an abstract Foundry suite that encodes TC1–TC12, TC17 and TC19. It drives a registry through this ERC's interfaces, and through an adapter for the registry's own paths: grants, delegation, permits, publication, the engine's operand check and upgrades. A test that does not apply is reported as skipped: no on-behalf role, no on-chain permit, no E1 or no E2.
- **Verifier kit.** `verifier/fixtures/tc13.json`, `tc14.json` and `tc15.json` hold language-neutral rows: the request, the chain state, the rule and the outcome it requires. A checker judges one verifier harness's recorded runs against them.

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
| TC8 | R8 | Grants and token transfers to a retired account; transfers from it | Succeed; the grants are inert |
| TC9 | R10 | A retired account computes through the engine, then tries every export: grant, publication, transient grant, batch, delegation, deputy transfer and disclosure, input re-use, cross-chain send | Each reverts; tests also pin the identified-caller conditions of R10 |
| TC10 | R13 | Batch of [grants…, `retireAccount()`]; batch of [`retireAccount()`, grant] | The first is atomic; the second reverts |
| TC11 | R11 | Upgrade to: a Core implementation with the same location; an implementation without Core; a Core implementation with another location; an implementation that lies on both checks | Accepted; reverts `UpgradeDropsRetirement`; reverts `UpgradeDropsRetirement`; accepted (asserted residual, caught only by a canary) |
| TC12 | R12 | `supportsInterface` probes | True for `0x01ffc9a7`, `0x556d2088` and each implemented extension; false for `0xffffffff` |
| TC13 | V1, V3, V4 | A verifier, unmodified where possible, receives a request with a retired requester, owner, delegator, delegate, contract or permit recipient, on every path; a never-retired request; a view that reverts or times out | Refused before any share; forwarded; refused |
| TC14 | V2, V5 | A request received after the retiring block, within the decision lag; a replica without lifecycle events | Refused; no authorization from the replica |
| TC15 | V6, V7 | A stored result re-served after retirement; a retirement denial followed by a simulated governance lapse | Refused; final `ACCOUNT_RETIRED`, not revived |
| TC16 | O1 | Share-collection simulation, n = 13, t = 4 | Reconstruction if and only if k ≤ 8 |
| TC17 | S1–S11 | Successor state machine | No right before retirement; read right after it, including handles granted later; locked against the old key; resignation; no transitivity; a retired successor fails; the successor cannot use, grant, publish or compute; an unaccepted designation cannot be confirmed; a designation voided by retirement yields nothing; a key-derived address cannot accept |
| TC18 | S1–S4 | Asserted residual: an attacker designates its own address, accepts, and confirms after D unnoticed | Survives retirement |
| TC19 | C1–C8 | Certificates | The vector above; wrong chain; successor mismatch; no successor; ERC-1271 account; delegation-indicator account (ERC-1271 only); works while paused; a second submission reverts; a leaked certificate yields only the planned handover |
| TC24 | Scope | Retire on chain A only; a certificate listing chains A and B | Chain B is unaffected; both chains retire |

TC20–TC23 belong to the companion document. Expiry-boundary tests do not pin the exact expiry second, because implementations differ on whether expiry is inclusive.

### Where the tests live

Every behaviour above has passed in the reference implementation's repository: TC1–TC12 on both release lines of the example (except TC6, the permit role, which does not apply there: the example has no on-chain permit) and on a port to Fhenix CoFHE, where TC6 runs, also through the conformance kit; TC13 and TC14 with the example's unmodified verifier against the real registry on a local chain, including injected view-call failures; TC15 only with the companion's hygiene profile (H5, H7), because the unmodified verifier serves a stored result again after retirement on `main` and retries a retirement denial instead of making it final (the conformance kit's TC15 fixture judges the recorded runs at 35 conforming cells and 8 violations, all the unmodified verifier's); TC16 on Shamir shares and on 13 real verifier instances; TC17–TC19 and TC24 on both release lines. The companion document lists the location and the counts of each.

## Reference Implementation

The reference implementation is a local prototype on Zama fhEVM. It is not deployed on any network and has not been audited.

- **Lines:** fhEVM `main` at `ed851716c` (registry 0.7.0 → 0.8.0 with Core, 0.9.0 with E1, 0.10.0 with E2) and tag `v0.13.8` at `fe3ca89b5`, the release deployed on Sepolia and Ethereum mainnet (0.4.0 → 0.4.1 with Core, 0.4.2 with E1, 0.4.3 with E2).
- **Retirement state** lives in the ERC-7201 namespace `fhevm.storage.ACLRetirement`, at location `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200`. `retirementStorageLocation()` returns this value.
- **The R10 exemption** is a constant comparison against the engine address in `isAllowed` only. It is valid under three invariants, each pinned by a test: the engine reads `isAllowed` only at its operand check, with its caller as subject; every transient grant by the engine names its caller; no other host contract reads the views as the engine.
- **A second registry:** a port of Core to Fhenix CoFHE's host-chain contracts, with a dedicated operand-check entry (R10.4).
- **Gas** (receipts, production compiler settings): `retireAccount()` costs 50,099 gas under Osaka and 132,519 under a local chain that applies Amsterdam's schedule; one grant inside a carry batch costs 31,385 and 119,505 [M].

## Security Considerations

### The three limits

1. **Pre-emptive, not a clawback.** Retirement protects an account whose key has not yet been used against it. After a compromise it is a race that the attacker usually wins. Whatever the key already re-shared, published or had decrypted stays exposed.
2. **Oracle access only.** Retirement stops the oracle honouring the key. It does not stop the key acting as an account: moving funds, or holding application roles such as observers and operators.
3. **As final as the chain's governance.** Retirement is per host chain, and whoever can upgrade that chain's contracts can undo it.

### Residual risks of the Core

- **Post-compromise exposure (limit 1).** Grants to third parties, public handles and plaintexts already released stay exposed. Off-chain permits need no transaction, so there is nothing to front-run or watch.
- **Identity-gated application roles (limit 2)** stay open until applications gate them (the companion's application profile).
- **Governance, or a request contract on another chain (limit 3),** can undo or bypass retirement. See [Governance](#governance).
- **Stored results and reusable transport keys.** In the example, results are served from storage and a transport key can be reused under a permit valid for up to 365 days [V, M, EVIDENCE 17]. V6 and per-request transport keys address this.
- **Per-chain coverage.** An account must retire on every host chain; the same registry release also runs on Polygon [M, EVIDENCE 7].
- **Contract self-retirement** disables every handle the contract governs. A contract with a generic-call path can be made to retire itself, or to confirm a successor chosen by whoever controls that path and then retire.
- **Lockout.** An account retired without a successor, whether by its holder, a thief or a phished signature, leaves its data readable by no one.
- **Linkability.** Carry grants and successor designations publicly link the old and the new account.
- **Reorganizations and lag.** A retirement included in a block that is reorganized away is not in effect. A verifier that evaluates at a deep decision lag honours retirement correspondingly later.
- **Delegate concentration.** One delegate address served 374 of 403 delegators on mainnet [M, EVIDENCE 7]. Retiring that address, or any delegate, disables every delegation to it at once, by design.

### Residual risks of the extensions

- **E1.** An attacker who holds the key can designate and accept its own address; if that goes unnoticed for D, it confirms, and the attacker successor survives retirement (TC18). A thief can keep replacing pending designations; the safe response is to carry and retire at once, which voids the pending designation. Where another component verifies the delegate's ECDSA signature, the successor must be an ECDSA account: losing its key is final, and the key is itself exposed to a CRQC. There is no transitivity; auditors rely on carrying rights explicitly.
- **E2.** A leaked certificate triggers an early, but planned, handover. A certificate does not protect the past after a theft. A quantum forgery of an ECDSA certificate is bounded by the successor binding.

### Host-state sources

Each node reads the views through a host-state source. In the example, each operator reads every view through one configured RPC endpoint per host chain [V, EVIDENCE 16]. Whoever controls the host-state source of t+1 nodes can make them answer "allowed" for any request. That bypasses every authorization rule, not only retirement. The risk exists before this ERC and applies to every threshold oracle. O2 requires the sources to be disclosed in aggregate, and O3 recommends diversity and confirmation of positive answers (Open question 7).

### Governance

Whoever can upgrade the registry can make the views ignore retirement (limit 3).

- **Example** (read on-chain on 2026-10-20). The Ethereum mainnet registry of the example deployment is owned by a DAO. Either of two ECDSA multisig plugins (3-of-6 and 9-of-17) executes for it, with no timelock [V, EVIDENCE 18].
- **What the guard does.** The guard (R11) stops accidental lapses, such as a rollback, a release line without Core or a skipped upgrade. It does not stop an implementation that lies.
- **Recommended governance profile.** A timelock owns every contract on the authorization and release path, and every pointer between them, including any request contract on another chain; paths that bypass the delay are removed. The delay is at least 7 days now, and 14 days is recommended for rights-widening changes (Open question 5). Pause is the only emergency power, and it never gates retirement or the views. The exit window serves operators, who review, refuse or pin; users cannot withdraw ciphertext history.
- **Retirement canary.** Operators keep a known retired account and a known handle. On every upgrade event, and periodically, they check that `isAccountRetired` is true, that the use views are false, and that the on-behalf view is false for a delegation created before retirement. On a mismatch they halt user decryption for that chain. Operators also pin registry implementations. These controls catch an implementation that lies, but only at n−t operators.
- **Durability.** Post-quantum governance signers, plus ratification of rights-widening upgrades by at least n−t operators, are the precondition for any durability claim against a CRQC.
- **Exemption.** Misapplying R10 (caller identity on a relaying engine) would switch retirement off entirely.

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).
