# Decryption Authority Lifecycle: companion extensions and profiles

**Status.** Candidates for later ERCs and for operator profiles. They are not part of ERC-XXXX.
- Each candidate builds on ERC-XXXX's Core (`erc/ERC-XXXX-decryption-authority-lifecycle.md`).
- Each is a separate claim. Claiming one does not imply another, or Core conformance of another class.
- The text below is the Phase 3 draft's, moved here unchanged except for the edits listed in
  `docs/ERC_SPLIT_MAPPING.md`, which also maps every rule, constant and test case to its new place. Three later
  corrections are the only changes since: the measured k values in TC16's row, the full list of unaudited libraries
  (§12) and the Limits paragraph below.

**Limits.** Every candidate here inherits ERC-XXXX's three limits. Retirement is pre-emptive, not a clawback: whatever
the key already re-shared, published or had decrypted stays exposed. It covers oracle access only: it does not stop
the key moving funds or holding application roles. It is as final as the chain's governance: whoever can upgrade the
registry can undo it.

**Sources.** Bracketed sources are files of the research repository:
- VERIFICATION = `results/VERIFICATION.md`;
- CENSUS = `results/review/04_census/aggregate.json`;
- G1 = `G1_TARTISMA_RAPORU.md` (in Turkish);
- A5 = `results/deliberation/A5_aa_pq_expert.md`;
- A7 = `results/deliberation/A7_judge.md`;
- SUMMARY = `results/deliberation/DELIBERATION_SUMMARY.md`;
- Pn.m = the Phase 4 report of that task under `results/phase4/`.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT
RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

## 1. Terms added to the ERC's terminology

| Term | Definition |
|---|---|
| Identity-gated grant | An application grant authorized by the caller's identity or role, not by a use view (for example, setting an observer) |
| ECDSA-disabled delegation indicator | Account code of exactly 23 bytes: `0xef0101` followed by an address (EIP-7851, Draft). The account's ECDSA key no longer authorizes it on the host chain; calls still run the delegate. It is regular code for this document |
| Adopted code | Regular code that an EOA installed on itself from a deployed contract (EIP-8298 `SETCODEFROM`, Draft). The host chain then refuses the account's ECDSA transactions (EIP-3607) and EIP-7702 cannot redelegate it; the account acts through the adopted code. Reading the code cannot tell it from a contract's |
| ECDSA-rooted account | An account whose code is empty or a delegation indicator |
| Regular code | Account code that is neither empty nor a delegation indicator. This includes an ECDSA-disabled delegation indicator and adopted code |

## 2. Claims

| Class | Optional claims | How a claim is made |
|---|---|---|
| Verifier | E3 (K1–K12), Profile H (H1–H9) | ICS |
| Oracle | E3, Profile H, Profile Q (Q1–Q8) | ICS |
| Application | Profile A (A1–A4) | The application's documentation |
| Client (wallet, SDK) | The client rule of E3 (K10) | — |

**Evidence so far** (all local; nothing here is deployed):

| Candidate | What ran | Reports |
|---|---|---|
| E3 | The route in the example's verifier with four ML-DSA libraries (K8): vectors, negatives, fault injection; the unmodified verifier fails closed (TC20) | `results/phase4/P1_1_E3_CONNECTOR.md`, `results/level3/LEVEL3.md` |
| Profile H | The signature library and the verifier (TC21); the EIP-7851 and EIP-8298 gaps; the ML-DSA-44 account through the verifier; the real-world impact of `enforce` on mainnet's delegated accounts, measured on each delegate's code | `results/level1/`, `results/phase4/P0_4_EIP7851.md`, `results/phase5/P0_3_EIP8298.md`, `results/phase4/P1_6_SMALL_GAPS.md`, `results/phase4/SHADOW_IMPACT.md` |
| Profile Q | The verifier with Q1, Q4 and Q5 (TC22); partial adoption with 13 real verifiers; the readiness indicator | `results/phase4/P1_2_PROFILE_Q.md` |
| Profile A | A ported token and stock OpenZeppelin 0.5.3 with an 18-line extension (TC23) | `results/level2/PROFILE_A.md`, `results/phase4/P1_4_PROFILE_A_STOCK.md` |

## 3. Extension E3: Declared Decryption Signer

E3 lets an account authorize decryption with a separate, subordinate key, such as a post-quantum key that a verifier checks natively. The signer is a delegation to a key-derived address (KDA). E3 adds no registry function and has no ERC-165 identifier; it is a verifier and oracle claim stated in the ICS.

```solidity
// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

/// @title Decryption Authority Lifecycle: E3 Declared Decryption Signer encoding
/// @dev Normative encoding. Both tags are provisional (Open question 2). Each tag is a constant
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
- **K3. Declaration.** The account declares the signer by creating, in its own transaction, a delegation in the registry whose delegate is the KDA, for one contract or for every contract, with an expiry. Revoking that delegation revokes the signer. Retiring the account disables it (R6). A successor's declared signer reaches only the successor's own handles, never its predecessor's (S9; Phase 5 decision D98).
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
- **K12. Claim.** A verifier MUST NOT claim E3 against a registry that lets delegations be created by a relayed signature. ERC-XXXX and this document define no signature-relayed path for declaring a signer or revoking one. Its only relayed signature, the E2 certificate, retires the account, which disables every signer at once (K3) and creates nothing.

## 4. Profile H: Hygiene

Profile H is a verifier profile. Its refusals bind an oracle only at n−t enforcing nodes; its budget is available only where t+1 nodes support it.

- **H1. Caps before any read.** Before any host-state read, a verifier MUST irrecoverably reject a request:
  - whose signature exceeds 65,536 bytes; or
  - whose other variable-length fields passed to signature verification exceed the caps stated in the ICS. RECOMMENDED caps are 4,096 bytes for a public key and 1,024 bytes for extra data [E].
- **H2. Code-first ordering.** For each signer address `a`, the verifier MUST read `a`'s code at one block B:
  - **Empty code:** accept only a 65-byte ECDSA signature that recovers `a`.
  - **Delegation indicator:** call ERC-1271 `isValidSignature` on `a` at B and accept only the magic value. It MAY fall back to ECDSA recovery of `a` only if the call succeeded with empty return data and the signature is exactly 65 bytes. It MUST NOT fall back on a revert (including an empty revert), a wrong magic value, short return data or a transport error. The fallback is off under Profile Q.
  - **Regular code**, including an ECDSA-disabled delegation indicator and adopted code: ERC-1271 only, with no fallback.

  The code read and the ERC-1271 call MUST use the same block. Code MUST NOT be cached across blocks.
- **H3. Budget.** The gas limit of the ERC-1271 call MUST be `B_exec + 21,000 + 64 × len(calldata)`. `B_exec` is stated in the ICS; 2,000,000 is RECOMMENDED.
- **H4. Attempts.** ERC-1271 negatives (wrong magic value, explicit rejection, empty revert) MUST be attempted at most twice, the second attempt at least one block after the first. An out-of-gas call is an empty revert, whatever shape the node reports it in (a top-level out-of-gas `eth_call` typically comes back as an error without revert data). Transport errors follow the verifier's own policy.
- **H5. Final retirement denials.** V7 is REQUIRED.
- **H6. ECDSA-only paths.** A verifier that serves a path where the subject's signature is verified only by ECDSA, by itself or by another component, MUST refuse a request whose requester or delegate has regular code on the host chain.
- **H7. Stored results.** V6 is REQUIRED. Deduplication of requests MUST be keyed on the signature and the validity window.
- **H8. Rollout.** Before enforcing H2 and H6, a verifier SHOULD run them in shadow mode: compute both verdicts, serve the old one, log would-be rejections and publish their impact. The ICS states the mode.
- **H9. Consistency.** Advisory prechecks SHOULD use the same caps, budget and ordering as the verifier.

## 5. Profile Q: PQ-only

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
- **Q3. Notice.** (Open question 1.)
  - A scheduled activation MUST be announced at least 24 months before B_Q. It MUST NOT be later than the host chain's own deactivation of ECDSA; if the host chain deactivates first, operators follow at the chain's date.
  - Emergency activation without notice is allowed only on host-chain ECDSA deactivation, or on credible public evidence of a CRQC against secp256k1, declared by at least n−t operators in post-quantum-signed statements.
- **Q4. Effects.** A verifier MUST refuse every request whose signer is authenticated by ECDSA:
  - a code-less signer outside the E3 route;
  - a signer whose code is a delegation indicator (no ERC-1271 call; the H2 fallback is off);
  - every ECDSA-only path.

  In the **no-root-ECDSA** variant, it accepts signers with regular code through ERC-1271, and E3 signers. In the **strict** variant, it accepts only E3 signers. The ICS states the variant.

  An account whose code is an ECDSA-disabled delegation indicator, or adopted code, is migrated: it is not ECDSA-rooted, and it is authenticated through ERC-1271.
- **Q5. Delegation cutoff.** A delegation from an ECDSA-rooted delegator, including a KDA delegation, counts only if its last change is at or before B_Q. B_Q is the activation block in scheduled mode, and the last block before the trigger evidence in emergency mode. Delegates and successors must themselves qualify.
  - For a delegator whose code is an ECDSA-disabled delegation indicator, the cutoff applies only to changes made before its ECDSA authority was disabled. A verifier that cannot establish that block applies the cutoff to every change.
  - A delegator whose code is regular now but was empty or a delegation indicator at B_Q adopted that code after B_Q (adopted code). Reading today's code cannot tell adopted code from a contract's, so the verifier reads the delegator's code at B_Q. The cutoff then applies as for an ECDSA-disabled indicator: to the changes made before the adoption, or to every change if the verifier cannot establish the adoption block. A verifier that cannot read the host chain's state at B_Q applies the cutoff to every change of a regular-code delegator. Failing closed has an availability cost: such an account's own declarations made after B_Q are refused, while its ERC-1271 requests are served (Phase 5 drill, the adopted-code case of B4).
  - A succession counts like a delegation fixed at its confirmation. The confirmed successor of a retired ECDSA-rooted account counts only if it was already that account's confirmed successor at B_Q: a key still accepted after B_Q could designate and confirm one. The verifier reads `successorOf` at B_Q; one that cannot, refuses.
- **Q6. Post-quantum claims.** An oracle MUST NOT describe its decryption service as post-quantum unless:
  - its reply channel uses a FIPS 203 KEM, or a hybrid that includes one; and
  - its input encryption is post-quantum.

  Replies published on-chain SHOULD use ML-KEM-768 or stronger, and the reply encryption SHOULD bind the request context. (Open question 3.)
- **Q7. Claim limit.** An oracle MUST NOT claim that Profile Q protects unmigrated ECDSA accounts on a host chain that still accepts those accounts' ECDSA transactions. An account whose ECDSA authority the host chain has disabled (EIP-7851, or adopted code under EIP-8298) is migrated for this rule.
- **Q8. One-way.** Disengaging the profile widens rights. It MUST follow the same procedure as Q1 (commitment by at least n−t operators) and SHOULD follow the governance profile in the ERC's Security Considerations.

## 6. Profile A: Applications

Profile A is an application profile.

- **A1. Identity-gated grants.** A grant path authorized by identity or role MUST revert when the account on whose behalf it grants is retired. Examples are setting an observer, setting an operator whose expiry has not passed, and owner-only grants. Clearing and revoking MUST remain allowed. (An ERC-7984 operator is valid while `block.timestamp <= until`, so an expiry equal to the current timestamp is a grant.)
- **A2. Transfers.**
  - An application MUST NOT let a transfer to a retired account fail because the grant to it is inert (R8).
  - It MAY refuse transfers to retired accounts as an explicit, documented policy.
  - It SHOULD NOT block transfers from retired accounts.
- **A3. No post-grant assertion.** An application MUST NOT assert U(h, recipient) after granting `h` to a recipient.
- **A4. Generic calls.** Contracts with generic-call paths SHOULD refuse calls to the lifecycle functions of ERC-XXXX on the registry, and to any registry entry point that runs calls with the caller kept as `msg.sender`, such as `multicall`.

An existing token can meet A1 without a fork: an extension that inherits the unmodified token and overrides only its identity-gated grant functions. For OpenZeppelin's ERC-7984 0.5.3 with its observer extension, that is `setOperator` and `setObserver`: 18 lines of code, adding about 12,800 and 3,800 gas to those calls when the call is the transaction's first touch of the registry, and about 7,800 and 3,800 when the registry is already warm [M] (`results/phase4/P1_4_PROFILE_A_STOCK.md`, corrected in `results/phase4/P2_4_AMSTERDAM.md` §6).

## 7. The ICS and threshold conformance

**ICS fields.** ERC-XXXX's O2 lists the fields in prose. In full, with this document's claims:

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

**Threshold conformance**, with this document's claims:

- Restrictive requirements bind an oracle only when at least n−t nodes enforce them. These are V1–V7, the refusals of Profile H and Profile Q. An oracle MUST NOT claim a restrictive requirement for fewer enforcing nodes.
- Additive capabilities are available only where at least t+1 nodes support them. These are the Profile H budget and the E3 route. The ICS states the count.

## 8. Informative: clients and carrying

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

**Choosing a path to a post-quantum wallet** (Phase 5, `docs/PQ_FULL_PATH.md`).

- Carry first, then retire with the new wallet as confirmed successor. The carried history is the wallet's own, so its declared signer (E3) works for it; handles granted to the old address later reach the wallet through the successor path (ERC-1271).
- Migrating in place (EIP-7702, then EIP-7851 or EIP-8298) keeps the address but does not combine with retirement, and leaves the old key's transactions open until the host chain enforces one of those drafts.

**Carry procedure.**

1. Inventory and export.
2. Exit applications: clear observers, revoke operators.
3. Move assets.
4. Carry: enumerate the account's grant events on each chain, and keep the handles where the account still holds a persistent use right. Filter spam with a contract allowlist and print a dry run. Then send chunked, caller-preserving batches of grants to the new account; the last batch ends with `retireAccount()` (R13).
5. Retire, with a successor, on every host chain.
6. Verify: `isAccountRetired` is true, and the new account holds every carried right.

In the reference implementation's example, one grant inside a batch cost 31,083 gas under the Osaka schedule and 119,201 gas under the schedule Sepolia ran on 2026-10-20 [M, VERIFICATION §5.1]. At a gas limit of exactly 2^24, a carry of at most 524 handles fits one transaction under Osaka [M]. Under Amsterdam's schedule it is 137 when the whole transaction gas is capped [M], and about 765 by execution gas under EIP-8037's rule, which caps execution gas only [E] (`results/phase4/P2_4_AMSTERDAM.md` §4). On Ethereum mainnet, 12,673 of 12,714 holders (99.7%) hold at most 539 handles [M, CENSUS].

## 9. Rationale

**A key-derived address for the declared signer.** It needs no registry change, because retirement already disables delegations. It is monotone: an ECDSA root can already grant everything a KDA can read, at constant gas. It fails closed on verifiers that do not implement it: an unmodified verifier rejects a non-65-byte signature for an address without code [V, A7 §2.7]. ML-DSA-44 verification on the route measured 84–89 µs (82–85 µs cold) on an AMD Ryzen 5 5600 with rustc 1.95.0 on 2026-10-21 [M, A7 §2.7]. A whole route check, with the code read from a local node, took about 245 µs at the median with one library and 340 µs with two that must agree (K8). On the same machine, ECDSA under Profile H took 470 µs and the ERC-1271 path at `B_exec` 2,000,000 took 2.7 ms [M, P1.1]. The same scheme through an ERC-1271 contract cost 1,232,720 gas on Sepolia [M, VERIFICATION §5.2]. Native ML-DSA-44 was faster than one ECDSA-recovery implementation measured (177–213 µs) and slower than another (53–55 µs) [M, A7 §4 K4], so neither ERC-XXXX nor this document makes a general claim that post-quantum verification is cheaper than ECDSA. Library diversity (K8) exists because the library used in the prototype is unaudited.

**Profile H details.**

- **Shim.** The 7702 fallback fires only on a successful call with empty return data, because an out-of-gas call and a decoding failure both revert with empty data [V, A7 §1 row 11].
- **Budget.** It counts execution, because the calldata of one ML-DSA-44 signature consumed 71% of a 250,000 cap (177,048 gas) under Sepolia's schedule [M, G1 §5]. 64 gas per byte bounds the intrinsic calldata charge under both the Osaka schedule and the schedule Sepolia ran [M, A5 §1.1].
- **Attempts.** Two attempts bound the worst case at 2 × 2,000,000 gas of execution, against 20 × 250,000 in the example today [E]. They still allow for wallet state that changes between blocks.
- **Shadow mode.** It comes first because [ERC-7739](./eip-7739.md) wallets return a wrong magic value for plain typed data [V, A7 §1 row 12].

**Profile Q as operator policy.** An on-chain "ECDSA off" flag would be set by governance whose keys are ECDSA, the first target of a CRQC; flipped today, it would refuse about 98% of holders. A host chain that still accepts an unmigrated account's ECDSA transactions leaves the on-chain door open. A forged grant to an attacker's post-quantum key, followed by a fully conforming request, decrypts [I, A7 §2.3]. Profile Q therefore claims nothing for such accounts (Q7): the oracle follows the host chain and never leads it.

**Relation to EIP-7851, EIP-8298 and EIP-8151.** These drafts change the host chain, not off-chain verifiers. An account can leave ECDSA in two ways.

- **Migrate in place.** The account delegates (EIP-7702) to a post-quantum wallet, then disables its ECDSA key (EIP-7851) or adopts the wallet's code (EIP-8298), and is served by Profile H verifiers.
  - EIP-7851 keeps the account's address. Its code becomes `0xef0101 ‖ delegate`, and the chain refuses the key's transactions and authorizations.
  - EIP-8298 (`SETCODEFROM`) also keeps the address. Code run through the delegation stores the wallet's state, then adopts a deployed wallet's code. The account now has regular code, so EIP-3607 makes the key's transactions invalid and EIP-7702 cannot redelegate it. The adoption cannot be undone. In the EIP's words: "This retires the account's key, not the account".
  - Both EIPs note that contracts that verify ECDSA directly still recover the old key. EIP-7851: they "will not automatically reject signatures from an ECDSA-disabled authority"; EIP-8298 points to EIP-8151.
  - EIP-8151 makes the `ecrecover` precompile return nothing for accounts whose code is neither empty nor an EIP-7702 indicator. That covers both kinds of account on chain.
  - Off-chain verifiers recover signatures in their own code, so none of these drafts reaches them. In simulations of both, the example's unmodified connector accepted the disabled root key on every request path; only H2's code-first ordering refused it [M, P0.4 and Phase 5 P0.3].
  - This document therefore treats both as regular code (H2) and such accounts as migrated (Q4, Q5, Q7).
  - With EIP-8151, a delegate that checks the root key through the precompile also stops accepting it; one that recovers in its own code does not [I, from the EIP texts].
  - An account that migrated in place acts only through its code, so it can retire only through its code. A wallet that offers no call path of its own, on a chain without EIP-8141, is stranded, as EIP-8298's Security Considerations note. A post-quantum wallet for this path SHOULD expose a call authorized by its post-quantum key that anyone can submit.
- **Migrate out.** The account retires, with a successor (E1) or after carrying its rights to a new account. It needs no host-chain change.

Nothing in ERC-XXXX or this document depends on any of these drafts being adopted.

**Transport neutrality.** Authority and transport are orthogonal, so Core is transport-neutral. A post-quantum claim (Q6) needs a FIPS 203 KEM on the reply channel and post-quantum input encryption, because classically encrypted inputs stored on-chain can be decrypted without the oracle. Zama's reply channel is hybrid ML-KEM-512; Fhenix's is X25519 [V, A7 §1 row 21]. Both can conform to Core, but an X25519 reply channel cannot meet Q6. Inco's decryption service re-encrypts with X-Wing (ML-KEM-768 with X25519), according to a comment in its contracts; the encryption code itself is not public [V, comment only; Phase 4 INCO_MAPPING]. Its registry was read but not run (Open question 11).

**Rejected and deferred alternatives** (SUMMARY §(f)):

| Alternative | Verdict | Reason |
|---|---|---|
| A confirmed successor authorizing its predecessor's handles with its own declared signer | Rejected (Phase 5, D98) | A KDA can be any key's, so the successor could give lasting access to the predecessor's history to third parties: the transitivity S9 forbids. Carrying before retiring with a successor removes most of the per-request cost it would save |
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

## 10. Backwards compatibility

ERC-XXXX's Backwards Compatibility covers the Core, E1 and E2. For this document's candidates:

- **Extensions and profiles.**
  - E3 requests fail closed on verifiers without the route.
  - Profile H's code-first ordering can reject requests that pass today's ECDSA-first ordering: ERC-7739 wallets signing plain typed data, and 7702 delegates without `isValidSignature`. Hence H8's shadow mode.
  - Profile Q refuses ECDSA-rooted accounts after its notice period.

## 11. Test cases

Behaviours, numbered as in the Phase 3 draft (ERC-XXXX keeps TC1–TC19 and TC24):

| ID | Rules | Case | Expected |
|---|---|---|---|
| TC20 | K1–K12 | KDA route: ACVP and Wycheproof vectors for every enabled parameter set and implementation; the K5 negatives (a KDA with code, a 65-byte signature, a mismatched KDA, an owner equal to the requester, a disabled scheme); a fault injected into one implementation | Vectors pass; an unmodified verifier fails closed; retirement and revocation disable KDA permits; refused on direct entries; no fallback; the faulty acceptance is refused where two implementations must agree, and reaches at most t nodes where each implementation serves at most t |
| TC21 | H1–H9 | Code-first matrix: empty code; a delegate that rejects; empty success (shim); empty revert (no shim); wrong magic; regular code. Also: ERC-7739 plain typed data; budget; caps before any read; at most two attempts; ECDSA-only path with regular code; an ML-DSA-44 ERC-1271 account | As in H1–H9. The ML-DSA-44 account passes with `B_exec` = 2,000,000 and fails under a 250,000 cap that includes calldata |
| TC22 | Q1–Q8 | Refusals per path; the delegation cutoff; on a host that accepts ECDSA, a forged grant from a victim EOA followed by the attacker's post-quantum request | Refusals as specified; the last case decrypts (asserted residual, Q7) |
| TC23 | A1–A4 | A thief-added observer; transfers to and from a retired account; the variant without Profile A | The retired account clears the observer and it cannot be re-added; transfers succeed; the variant leaks the current balance and future amounts (asserted residual) |

**Where the tests live**, for every test case of ERC-XXXX and of this document.

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
| TC15 | Same harness | **V7 part done** with Profile H (branch `lifecycle/level1`, `cce53bb`): a retirement denial is final at its first attempt and typed `account_retired`; after a simulated governance lapse the request is not revived, while the unmodified verifier revives it (`results/level1/PROFILE_H_CONNECTOR.md` §2). Measured before that: the unmodified verifier retries a retirement denial, untyped, up to its attempt limit (`CONNECTOR_PROOF.md` §8). **V6 part done** (`results/phase4/P0_3_STORED_RESULTS.md`, three runs each). Unmodified, on `main`: the connector endpoint serves a stored result again after retirement, and the relayer serves the stored job to the same request and to an equivalent one, because its deduplication key ignores the signature and the validity window. With H7 (`lifecycle/level1`, `a15aaa6` and `256306b`): both refuse, final `account_retired` in the connector The verifier kit's TC15 fixture judges the recorded runs at 35 conforming cells and 8 violations, all the unmodified verifier's |
| TC16 | Share-collection simulation | `impl/harness/level3/profile_q_sim.py`. Done: on real Shamir shares (n = 13, t = 4), reconstruction if and only if k ≤ 8. With 5% outages, 77% of releases still succeed at k = 8, the partial-adoption cliff (`results/level3/LEVEL3.md` §4). With 13 real verifier instances, k of them enforcing Profile Q, the same rule holds for k = 0, 4, 5, 8, 9 and 13, and a post-quantum request is served at both measured ends, k = 0 and 13 (`results/phase4/P1_2_PROFILE_Q.md`) |
| TC21, signature-library part (H1–H4, H8) | Signature library: mocked-provider tests and a local EVM | Branch `lifecycle/level1`, `shared/user-decryption-signature/tests/profile_h.rs` (20 tests), and `impl/harness/level1/` on anvil (Osaka). Done: the code-first matrix, ERC-7739 plain typed data, caps before any read, the budget, at most two attempts a block apart, and the ML-DSA-44 account (accepted at B_exec 2,000,000, refused at the 250,000 cap) (`results/level1/PROFILE_H_CRATE.md`). Found: a top-level out-of-gas must count as an empty revert under H4 |
| TC21, verifier part (H5, H6, H8, ECDSA-only path) | Verifier harness: Zama's kms-worker against a local EVM | Branch `lifecycle/level1` (`cce53bb`) and `results/level1/harness/` (4 tests, 27 requests). Done: final, typed retirement denials on every path, including after a simulated governance lapse; refusal of regular code on the ECDSA-only path; code-first refusal under `enforce` and logging under `shadow` (`results/level1/PROFILE_H_CONNECTOR.md`). The ML-DSA-44 account through the verifier itself: forwarded with `isValidSignature` at gas 2,183,048, 9 requests over three runs (`results/phase4/P1_6_SMALL_GAPS.md`) |
| TC21, H9 (advisory prechecks) | The SDK's precheck on a local EVM; the relayer's pre-check with a mocked provider | Branch `lifecycle/level1` (`5b69260` SDK, `0eec675` relayer). Done: the same caps, budget and ordering as the verifier. The SDK refuses the ML-DSA-44 account at the 250,000 cap and accepts it under the policy (call gas 2,183,048); under `enforce` it refuses a 7702 root key the delegate rejects, and `shadow` logs it (4/4 on anvil; 910/910 SDK unit tests). The relayer: 59/59 pre-check and settings tests, 281 unit tests passed, lint clean (`results/level1/H9_PRECHECKS.md`) |
| TC21, H7 | Verifier harness: the connector endpoint as its own process with the kms-worker; the relayer with its in-process mocks | `results/phase4/P0_3_STORED_RESULTS.md`. Done: a stored result is revalidated at a fresh decision block before it is served, and deduplication is keyed on the signature and the validity window. The H4 attempt state survives a worker restart (2 ERC-1271 calls in total, against 3 when kept in memory) |
| TC21, EIP-7851 part (H2, H6, H9) | A JSON-RPC proxy that answers `eth_getCode` with `0xef0101 ‖ delegate` while anvil keeps the EIP-7702 delegation; the verifier library, the SDK and the verifier harness | `results/phase4/P0_4_EIP7851.md`. Done: unmodified verifiers accept the disabled root key on every path (main and v0.13.8); under `enforce` the root key is refused and the ML-DSA-44 signature accepted at `B_exec` 2,000,000; H6 refuses the legacy path; a retired account is refused by every verifier; the SDK precheck agrees (three runs each). The SDK's `getAuthorityStatus` reports such an account as `eip7851`, with its retirement and successor state (`results/phase4/P1_6_SMALL_GAPS.md`) |
| TC21, EIP-8298 part (H2, H6, H9) | The account holds an ML-DSA-44 wallet's regular code, set with `anvil_setCode`; nothing is rewritten. The verifier library, the SDK and the verifier harness | `results/phase5/P0_3_EIP8298.md`. Done: unmodified verifiers accept the root key on every path (main and v0.13.8); under `enforce` the root key is refused and the wallet's ML-DSA-44 signature accepted at `B_exec` 2,000,000; H6 refuses the legacy path, which stays open without it; a retired account is refused by every verifier; the SDK precheck agrees, and `getAuthorityStatus` reports the account as `regular` (three runs each) |
| TC17, TC18 | Foundry; verifier harness | Branch `lifecycle/level2` of both clones, `host-contracts/test/acl/ACLSuccession.t.sol`. Done: 41 tests per line (main 188/188, v0.13 line 173/173 in `test/acl/*`). The unmodified verifier serves the successor and refuses every other delegate: v0.13.8 8/8, main 13/13 requests (`results/level2/LEVEL2_E1.md`). In the vendor's cleartext mock, through its SDK: 7/7 over 3 runs (`results/level2/SDK_HYGIENE_AND_MOCK.md`) |
| TC23 | Foundry | Branch `lifecycle/level2` (main), `host-contracts/test/acl/ACLRetirementProfileA.t.sol`: 15 tests (`results/level2/PROFILE_A.md`). Found: the operator gate must refuse an expiry equal to the current timestamp, and A4 must cover the registry's `multicall`. On stock OpenZeppelin 0.5.3 (npm package, unmodified, solc 0.8.27): TC8 and the token parts of TC23, with and without the Profile A extension, 14 tests, three runs (`results/phase4/P1_4_PROFILE_A_STOCK.md`) |
| TC19, TC24 | Foundry; three anvil chains | Branch `lifecycle/level3` (main), `host-contracts/test/acl/ACLRetirementCertificate.t.sol`: 13 tests, including ERC-XXXX's vector; the watchtower relays a certificate across real chains (`results/level3/LEVEL3.md` §1) |
| TC20, signature-library part | Signature library | Branch `lifecycle/level3-verifier` (`538dc88`), `shared/user-decryption-signature/tests/{kda,k8,k8_vectors}.rs`. Done: ML-DSA-44/65/87, no fallback, refused on direct entries, an unmodified verifier fails closed. Four implementations each pass 631/631 Wycheproof vectors and every ACVP sigVer vector of the interfaces they expose (45/45 each on the route's pure interface). K8 in both modes with an injected fault; 52/52 tests, three runs (`results/phase4/P1_1_E3_CONNECTOR.md`) |
| TC20, verifier part | Verifier harness: the kms-worker with the E3 route and K8 against a local EVM | Branch `lifecycle/level3-connector` (`564d7d1`). Done: KDA requests for ML-DSA-44/65/87 are forwarded under each K8 mode; the K5 negatives and a signature over another digest are refused. A failed ML-DSA check makes no ERC-1271 call (no fallback); a KDA with code is not routed and is refused on Profile H's ordinary path; revocation and retirement refuse KDA requests; an injected fault in one library passes in its single mode and is refused as a disagreement where two must agree; the unmodified verifier fails closed. 35 rows, three runs (`results/phase4/P1_1_E3_CONNECTOR.md`) |
| TC22, on-chain door | Foundry | `host-contracts/test/acl/ACLProfileQResidual.t.sol`: the asserted residual, and its closure by a prior retirement |
| TC22, verifier part, and Q1 | Verifier harness: the kms-worker with Profile Q against a local EVM | Branch `lifecycle/level3-connector` (`e8a5a685`). Done, in both variants: Q4 refusals per path (a code-less ECDSA signer, an EIP-7702 account with its root key or its delegate's signature, the ECDSA-only legacy path), with no ERC-1271 call for an ECDSA-rooted signer; EIP-7851 and contract signers through ERC-1271 in no-root-ecdsa only; E3 in both. Q5: delegations from ECDSA-rooted and EIP-7851 delegators count only if unchanged since `B_Q`; a regular-code delegator is not cut off. The example registry has no getter for a delegation's last-change block, so the verifier reads it from the registry's storage, for known layouts only. Q1: 13 or 9 ML-DSA-65 operator statements establish the profile; 8, an invalid, an intruder's or a duplicate signature, another `B_Q`, ICS or registry do not. The asserted residual: a forged grant from a victim EOA lets the attacker's ML-DSA-44 account decrypt. 151 rows, three runs (`results/phase4/P1_2_PROFILE_Q.md`). Q5's reads at B_Q (branch `lifecycle/phase5-connector`, `a4416155`): a delegator with code adopted after B_Q gets the cutoff, and a succession counts only if confirmed at B_Q; both fail closed (`results/phase5/B1_B6_PATHS.md`, B4) |
| The post-quantum path end to end (B1–B6) | The Phase 5 kms-worker against the Level 3 registry on a local EVM; local chains with the carry tool, watchtower, SDK and canary | `results/phase5/PQ_DRILL_MATRIX.md`. Done: every path (carry, successor with retirement or certificate, in place under EIP-7851 or EIP-8298) and the old key's every action, three runs; Profile Q with k = 8 and 9 of 13; operator-ratified upgrades with the guard and the canary |

## 12. Security considerations

**Residual risks of E3.**

  - Implementations of ML-DSA and SLH-DSA are young (see [Unaudited libraries](#unaudited-libraries)), and a verification bug could accept forged permits; hence K7 and K8.
  - Without an exclusive variant, ECDSA permits for the same account stay valid until Profile Q engages.
  - The route is impossible on paths where another component verifies ECDSA.

**Residual risks of the profiles.**

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
- **Profile A.** Adoption is outside this document's control. Without Profile A, a thief-added observer keeps reading the current balance and every future amount.

**Unaudited libraries.** The prototype and the measurements behind ERC-XXXX and this document rely on libraries that have no completed security audit for this use:

- the RustCrypto `ml-dsa` crate 0.1.1, used by the E3 route; the example's own dependency manifest flags it as having no security audit;
- the `ml-kem` crate 0.3.2, in the example's reply channel; it is flagged as medium risk, without a completed audit for that use;
- the Fireblocks `evm-ml-dsa-verifier` at `cca262b5` (MIT, unaudited), used for the ERC-1271 measurements and the Profile H test account;
- the further ML-DSA implementations used for K8: `fips204` 0.4.6, which its README calls experimental; Cryspen's `libcrux-ml-dsa` 0.0.10, whose field arithmetic, NTT and serialization are formally verified, with no published audit found; and PQClean's `clean` implementation through `pqcrypto-mldsa` 0.1.2, unmaintained since PQClean was archived on 2026-08-04 (RUSTSEC-2026-0166);
- `dilithium-py`, a pure-Python implementation vendored in that verifier repository, used only as an independent test signer;
- in the measurements only: `slh-dsa` 0.2.0-rc.5 and `fn-dsa` 0.4.0 (the native verification benchmark), and `libcrux-ml-kem` 0.0.11 (the reply-channel note, next to `ml-kem`).

The ZKNOX verifiers (ETHFALCON, ETHDILITHIUM) are cited, not run [V, VERIFICATION §0, §B7, §4 (N6); A7 §6]. No conformance claim for E3 should rest on a single unaudited library (K8).

## 13. Open questions

The text above uses the default stated for each.

1. **Profile Q notice (Q3).** 24 months scheduled, plus the two emergency triggers. The alternative is a date aligned with NIST IR 8547.
2. **KDA identifiers (E3).** The domain tags and the hash-derived scheme ids are provisional. The alternative is alignment with [EIP-7932](./eip-7932.md) algorithm types.
3. **Reply KEM (Q6).** The Core stays transport-neutral; replies published on-chain are recommended to use ML-KEM-768 or stronger.
