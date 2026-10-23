# P2.2: Inco Lightning, read-only mapping

**Proof class:** Design. This is code reading only, marked [V] where read and [I] where inferred; no Inco code was run.
**Date:** 2026-10-22. **Status:** done (mapping). There was no Foundry spike; see §4.
No Inco service was contacted.

## Sources

| What | Version and check | Licence |
|---|---|---|
| `@inco/lightning`, Inco Lightning's Solidity sources (npm) | 1.1.0, published 2026-10-02. The tarball's SHA-512 equals the registry's `dist.integrity` (`sha512-qQKDybXO…ggohbQ==`); SHA-256 `01309a004a52694eb436e977dd45f2cd6395e217f2e25a7188a8b062a85beadc`; 136 files | Every source file is `SPDX-License-Identifier: BUSL-1.1` ("Copyright (c) 2026 Liquidbox Corp."). `package.json` names no licence, and the `LICENSE.md` the headers cite is not in the package |
| `@inco/js`, Inco's client SDK (npm) | 0.7.12. The tarball's SHA-512 equals the registry's. It includes the generated protocol definitions of the decryption service (`inco/kms/lite/v1`) | Apache-2.0 |
| The `Inco-fhevm` GitHub organisation | Repository list read with the GitHub API (read-only). `inco-monorepo`, which `@inco/lightning` names as its repository, is not public, and no public repository holds the decryption service's code. `lightning-rod` (`080d5c16`, 2026-06-13) is an application template | — |

Paths below are relative to the package's `src/`.

## 1. Architecture, as read [V]

- **`IncoLightning`** is one UUPS contract. It combines:
  - the ACL (`lightning-parts/AccessControl/BaseAccessControlList.sol`);
  - the engine (`EncryptedOperations`, `EList`, `TrivialEncryption`, `EncryptedInput`);
  - fees.

  Applications call it directly; nothing relays their calls.
- **`IncoVerifier`** is a second UUPS contract, deployed together with the first. It combines:
  - `AdvancedAccessControl`: vouchers, Inco's permits;
  - `DecryptionAttester`: it checks covalidators' signatures over decryption results and re-encryptions;
  - a TEE lifecycle (Intel DCAP quotes checked on-chain through Automata's interfaces).
- **The decryption service**: covalidators running in TEEs.
  - They sign `DecryptionAttestation(handle, value)` and per-covalidator `Reencryption` attestations.
  - **Re-encryption.** It uses X-Wing: `DecryptionAttester.sol:125` says "Each covalidator produces a different ciphertext (X-Wing encryption is randomized)" [V, comment; the encryption code itself is not public].
  - **Requests.** The SDK's protocol definitions describe three requests, each carrying an ACL proof per handle: attested decryption, attested reveal, and attested compute (a scalar operation on a handle whose result is decrypted for the user).
  - **How a request is authorized.** `types_pb.d.ts` in `@inco/js` describes two proofs [V, protocol documentation; the service code is not public, so it was not examined]:
    - a basic proof, "performed by the light client inside the TEE calling the `isAllowed` function on the BaseAccessControlList.sol contract";
    - an advanced proof, checked through `AdvancedAccessControl` (`isAllowedWithProof`).

## 2. Role mapping

| Role | Inco Lightning 1.1.0 | Notes |
|---|---|---|
| Use | `isAllowed(handle, account)` is transient ∨ persistent ∨ revealed, and false while the contract is paused (`BaseAccessControlList.sol:173`). Also `persistAllowed` and `allowedTransient` | The basic proof of the decryption service calls `isAllowed` |
| On-behalf | none: there are no delegation records | Sharing read access is done with vouchers (the permit row) |
| Permit | `IncoVerifier.isAllowedWithProof(handle, account, proof)` (`AdvancedAccessControl.sol:142`) | See the conditions and remarks below |
| Liveness getter | `getActiveVouchersSessionNonce(account)` | Every voucher signed under an older nonce is dead |
| Public | `isRevealed(handle)`, false while paused (`:184`); `reveal` is irreversible | |
| Engine | Part of the same contract. `checkInput` requires `isAllowed(input, msg.sender)` (`EncryptedOperations.sol:89`). Every output is granted with `allowTransientInternal(result, msg.sender)`, only to the caller and only for the transaction (`:104`, and in `EList` and `TrivialEncryption`) | The engine is the registry, so its operand check is an internal call |
| Grant paths | See the list below | |
| Verifier (off-chain) | Covalidators in TEEs, reading the chain through a light client. They authorize through `isAllowed` or `isAllowedWithProof`, per the protocol documentation | Code not public: not examined |
| Transport | X-Wing (ML-KEM-768 with X25519) for re-encryption, per the comment above. The SDK also carries a secp256k1 ECIES keyset | [V] comment only |

**The permit's conditions.** `isAllowedWithProof` returns true only if all of these hold:
- the sharer holds the handle (`isAllowed(handle, sharer)`);
- the sharer signed an EIP-712 `AllowanceVoucher` under its current session nonce (ERC-1271 accepted);
- the voucher's `verifyingContract.callFunction(handle, account, sharerArgData, requesterArgData)` returns Inco's magic value.

**Permit remarks.**
- The function is not a view: it makes that call.
- The parties are the sharer, the requester (`account`), and the application's policy contract.
- Revocation is the sharer rotating its session nonce.

**Grant paths.**
- `allow`, `allowTransient` and `reveal` (publication), each requiring the caller's own `isAllowed`.
- `claimHandle(handle, proof)`: a voucher turned into a persistent grant to the claimer. The grantor is the voucher's sharer.
- Input creation: `newInput` grants the user persistently (`EncryptedInput.sol:147`) and the consuming contract transiently (`:223`).

## 3. How Core would sit on Inco (feasibility, design)

**It maps without changing Core's mechanism, and more simply than on Fhenix.**
- **Retirement state and functions.** They would sit in `IncoLightning`, in their own namespace, and `retireAccount` would not be pausable (R3).
- **ERC-165.** `IncoLightning` declares no ERC-165 today (`supportsInterface` appears nowhere in the package), so a port adds it (R12).
- **R6, use role.** Gate `isAllowed`, `persistAllowed` and `allowedTransient`. `isRevealed` stays as it is (R9).
- **R10.** The engine's `checkInput` would read the stored allowances through an internal raw check, since outputs already go only to the caller for the transaction. The exemption is then defined by the internal call site, so R10.4's identity question does not arise: no engine relays a third party's request here.
- **R7.**
  - Gate `allow`, `allowTransient` and `reveal` on the caller.
  - Gate `claimHandle` on the voucher's sharer.
  - A retired claimer is an inbound grant (R8): accepted and inert.
  - Rotating a session nonce only removes rights and stays open.
- **R6, permit role.** `isAllowedWithProof` answers false when the sharer or the requester is retired. `IncoVerifier` would ask `IncoLightning`, as it already does for `isAllowed(handle, sharer)`.
- **R11.** Both contracts upgrade through an owner-only `_authorizeUpgrade` (`IncoLightning.sol:42`, `IncoVerifier.sol:28`), where the guard fits.
- **R13.** There is no `multicall`, so a carry batch is the account's own.

**Two things a port must not miss.**

1. **An existence check must not be gated.**
   - `_newInput` refuses a duplicate input with `require(!isAllowed(handle, user), HandleAlreadyExists(handle))` (`EncryptedInput.sol:212`). There a false answer allows rather than refuses.
   - If `isAllowed` answered false for a retired user, this check would pass, and the user's old input could be registered again. That registration grants the consuming contract a transient right on the old handle: an input re-use export, as TC9 lists.
   - The port has to keep the raw check there. In general, R6's gate goes on authorizations, never on a negated existence check.
   - The Fhenix port uses `isAllowed` only in the refusing direction (P2.1).
2. **Pause gates the views.**
   - `isAllowed`, `isRevealed` and `isAllowedWithProof` answer false while paused. That fails closed, but it differs from this ERC's governance profile ("Pause … never gates retirement or the views").
   - A port keeps `retireAccount` outside the pause (R3).
   - Whether the views may stay pausable is a profile question, not Core's.

**Licence.**
- The sources are BUSL-1.1, so a modified Inco Lightning can be built and tested locally but not freely published or used in production.
- Any port stays out of this project's public export.

## 4. Why no Foundry spike

**What a spike needs.** It would compile Inco Lightning's two contracts with:
- their dependencies: `@inco/shared` 0.1.0, OpenZeppelin 5.4.0, a Safe smart account pinned to a git commit, `ds-test`, and forge-std pinned to a git commit;
- the DCAP verification interfaces.

**Why not now.** That is more than an afternoon, under a licence that keeps the result private. The mapping above settles the vendor-neutrality question that matters here: Core needs no mechanism change on Inco. The conformance kit (P2.3) can add an Inco adapter later.

## 5. What this does not show

- No Inco code ran, and no Inco service was contacted.
- **The decryption service.**
  - Which views it consults is taken from the SDK's protocol documentation.
  - Its code is not public, so the verifier side is not examined: request-time consultation, the block it reads at, and its light client's freshness.
- **Re-encryption.** "X-Wing" comes from a code comment, not from the encryption code.
