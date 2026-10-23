# Phase 1 verification: off-chain components (connector, signature crate, relayers, SDK, KMS)

Scope: findings B1 (off-chain part), B2, B4, B5, B6, B7 and the off-chain parts of design C1, C3, C4 and C5 in
`docs/FHE_Yetkilendirme_PQ_Tasarim.md`. Method: I read the code only. Nothing was built or run, no network calls
were made, and nothing was sent anywhere. Both clones were left untouched; other revisions were read with
`git show` / `git log`.

| Repo | Revision read |
|---|---|
| `zama-ai/fhevm` | `main` = `ed851716c9a6b799996a23399ece2858336f96db` (2026-10-20 17:56 UTC) |
| `zama-ai/kms` | `main` = `c755e84ff0816b5fbc07077e248f67ab2bf485d0` (2026-10-20); `origin/chore/pq-tls-handshake` = `3516d8f2a30f5cc1ad5de68d90cb8adeec3aaa0f` |

Labels used below:
- **[V]**: I read it in the code at the revision above (file:line given).
- **[I]**: inferred. This is reasoning or outside knowledge that I did not run or test.
- **[X]**: needs a runtime or Sepolia check (one of E1–E6).

All paths are relative to the repo root (`fhevm/` unless marked `kms/`).

---

## 0. The user-decryption paths (needed to read every verdict)

The design doc (§2, B4, B5) describes one path: "the connector verifies the signature with ecrecover, then
ERC-1271". The code at `ed85171` has **four** paths, and the signature check differs between them.

| Path | How it is reached | Who verifies the user signature | What the connector checks |
|---|---|---|---|
| **P1 legacy** | SDK V1 permit → legacy relayer `POST /v2/user-decrypt` (`sdk/js-sdk/src/core/modules/relayer/module/fetchUserDecryptV1.ts:72`) → gateway tx `Decryption.userDecryptionRequest(CtHandleContractPair[], …)` | **The gateway contract, on-chain, with `ECDSA.recover` only. There is no ERC-1271.** `gateway-contracts/contracts/Decryption.sol:486-491, 957-968` [V] | Invalidation and ACL only, after re-reading the gateway tx calldata: `kms-connector/crates/kms-worker/src/core/event_processor/decryption.rs:120-233`, called from `processor.rs:164-189` [V] |
| **P1d legacy delegated** | SDK V1 delegated permit → relayer `/v2/delegated-user-decrypt` → `Decryption.delegatedUserDecryptionRequest` | The gateway, with `ECDSA.recover` against the **delegate**: `Decryption.sol:571-576, 980-994` [V] | Same as P1, using `isHandleDelegatedForUserDecryption`: `decryption.rs:202-210, 235-264` [V] |
| **P2 unified via the gateway** | SDK V2 permit → legacy relayer `POST /v3/user-decrypt` (`fetchUserDecryptV2.ts:50`) → gateway tx `Decryption.userDecryptionRequest(HandleEntry[], …)`. **The gateway does not check the signature**: `Decryption.sol:616-653, 954-955` | The connector: `user_decryption_signature::verify_signature`, ecrecover first, then ERC-1271 (`decryption.rs:401-408`) [V] | Validity window, signature, invalidation, per-handle ownership and allowedContracts: `decryption.rs:314-436` [V] |
| **P3 unified via HTTP** | relayer-http `POST /v4/user-decrypt` → connector proxy/endpoint `POST /v1/user-decrypt` → same worker check as P2 | The connector, same as P2 | Same as P2. Endpoint pre-validation is in `kms-connector/crates/endpoint/src/core/validation.rs:87-130` [V] |

The SDK at this commit calls `/v2/…` and `/v3/…` only. No SDK code calls relayer-http's `/v4/user-decrypt` [V].
So the paths the SDK uses today are P1/P1d and P2. P3 is newer.

The KMS core never sees a user signature. `UserDecryptionRequest` in `kms/core/grpc/proto/kms.v1.proto` has no
signature field, and the connector does not send one (`decryption.rs:600-615`) [V]. The connector, plus the gateway
on P1/P1d, is therefore the only authority. This is consistent with R1.

Gateway requests are permissionless for anyone who pays the fee
(`gateway-contracts/contracts/shared/ProtocolPaymentUtils.sol:36-38` → `ProtocolPayment.sol:197-200`, a plain
`transferFrom` of the fee) [V]. **The relayer is therefore not a security gate on P1/P2.** On P3 the connector proxy
accepts only allow-listed senders (`kms-connector/crates/proxy/src/core/config.rs:39-40`, `FhevmSig` header), so
relayers act as a gate there. relayer-http, however, performs no authorization checks (§7c).

---

## 1. B2: invalidation is against permits, not keys

**Verdict: CONFIRMED for EOAs, and should be NARROWED.** The mechanism works as the doc says. But Zama designed it
together with smart-account key rotation, which makes "it does nothing against a leaked key" exact only for EOAs and
7702-delegated EOAs.

### 1a. The exact comparison and the equality case [V]
- `decryption.rs:520-542` (`inner_signature_invalidation_check`). At line 531, `if start_timestamp < invalidation_ts`
  produces an **irrecoverable** `UserSignatureRejected`. So a request is rejected iff
  `startTimestamp < decryptionSignatureInvalidatedBefore(user)`.
- **`startTimestamp == invalidatedBefore` passes.** This is pinned by unit tests:
  - legacy path: `#[case::direct_boundary_passes(false, InvalidationMock::EqualToStart, ExpectedOutcome::Ok)]`, `decryption.rs:1012`
  - unified path: `#[case::boundary_passes(...)]` with the comment "invalidation_ts = start → start < start is false → passes", `decryption.rs:1233, 1240`
  - e2e: `test-suite/e2e/test/decryptionSignatureInvalidation/decryptionSignatureInvalidation.ts:271-319`, with the comment "exactly AT the threshold — pins the >= boundary"
- The ACL docstring says the same thing: `timestamp` is the "Oldest timestamp that remains valid"
  (`host-contracts/contracts/ACL.sol:271`).
- Both connector paths run this check. The legacy path runs it at `decryption.rs:221-229`, the unified path at `decryption.rs:409-413`.
- Values are compared as `U256` with no truncation. The read is `rpc.rs:58-67`.
- *Deliberate.* The boundary is documented and tested.

### 1b. Who chooses `startTimestamp` [V]
- The signer does. It is a field of the signed EIP-712 struct:
  - legacy: `UserDecryptRequestVerification.startTimestamp`, `Decryption.sol:57-68, 171-173`
  - unified: `UserDecryptRequestVerification { …, uint256 startTimestamp, uint256 durationSeconds, … }`, `shared/user-decryption-signature/src/lib.rs:30-37`
- The SDK takes the value from the caller and, for V2 permits, rounds it **down** to the minute. Zama's own comment
  there explains why future starts matter: "prevents a future-dated startTimestamp from bypassing signature
  invalidation" (`sdk/js-sdk/src/core/kms/SignedDecryptionPermitV2-p.ts:321-324`).
- Consequence [V+I]: whoever holds the key signs a new permit with `invalidatedBefore ≤ startTimestamp ≤ now` and
  passes. The ACL forbids a future `invalidatedBefore` (`ACL.sol:279-281`, `InvalidationTimestampInTheFuture`), so
  such a value always exists. The e2e positive case above shows exactly this succeeding. Sepolia confirmation is E2 [X].

### 1c. Is `startTimestamp ≤ now` enforced? (each layer) [V]
| Layer | Enforced? | Where | Clock |
|---|---|---|---|
| Gateway, legacy path (P1/P1d) | yes, reverts `StartTimestampInFuture` | `Decryption.sol:1274-1276` (in `_checkUserDecryptionRequestValidity`, called at 466 and 546) | gateway `block.timestamp` |
| Gateway, unified path (P2) | yes | `Decryption.sol:1298-1300` (called at 632) | gateway `block.timestamp` |
| Connector worker, unified (P2/P3) | yes; `now < start` → **recoverable** (retried) `UserSignatureRejected` | `decryption.rs:340-352` | worker wall clock `Utc::now()` |
| Connector worker, legacy (P1/P1d) | **no own check**; relies on the gateway | `decryption.rs:120-233` | — |
| Connector HTTP endpoint (P3) | range only: `startTimestamp ∈ [0, i64::MAX]` (DB storage). The time check is left to the worker | `kms-connector/crates/endpoint/src/core/validation.rs:21-22, 107-130` | — |
| Legacy relayer, v2 and v3 | yes (`TIMESTAMP_MUST_NOT_BE_IN_FUTURE`) | seen on Sepolia as HTTP 400 | relayer wall clock |
| relayer-http (P3) | yes ("must not be in the future") | `relayer-http/crates/relayer-http/src/endpoint/flows/user_decrypt.rs:104-109` | relayer wall clock |
| SDK | yes, client side only (can be bypassed) | V2: `SignedDecryptionPermitV2-p.ts:345-370`; V1: `SignedDecryptionPermitV1-p.ts:328-357` | browser clock |

### 1d. Duration limits [V]
- Gateway legacy: `MAX_USER_DECRYPT_DURATION_DAYS = 365` (`Decryption.sol:129`) and `durationDays ≥ 1` (`:1263-1269`).
- Gateway unified: `MAX_USER_DECRYPT_DURATION_SECONDS = 365 days` (`:135`) and `durationSeconds ≥ 1` (`:1292-1297`).
- Connector HTTP endpoint: `DURATION_SECONDS_RANGE = 1..=365 days` (`validation.rs:24-26`), mirroring
  `kms-connector/crates/api/src/types.rs:25-27`.
- The connector worker does **not** re-check the maximum. It checks only the window (`decryption.rs:343-361`). On P2
  the gateway enforces the maximum; on P3 the endpoint does.
- relayer-http checks only that the window has not expired. It has no maximum (`user_decrypt.rs:110-119`).
- SDK V1 enforces 365 days (`SignedDecryptionPermitV1-p.ts:28, 342-344`). SDK V2 only **warns** above 7 days in
  permissive mode, citing the risk that "a stolen signature can decrypt anything the user owns until it expires or is
  invalidated" (`SignedDecryptionPermitV2-p.ts:280-288`).

### 1e. Delegated path: whose invalidation is checked? [V]
**The delegate's**, meaning the signer and requester, never the delegator's.
- Legacy: the gateway emits `delegationAccounts.delegateAddress` in the `userAddress` slot of `UserDecryptionRequest`
  (`Decryption.sol:604-610`). The worker passes `req.userAddress` (`processor.rs:178-182`) to the invalidation check
  (`decryption.rs:223-227`). The unit test builds the delegated calldata with `delegateAddress: user_address`
  (`decryption.rs:1043-1053`).
- Unified: `inner_signature_invalidation_check(host_client, payload.userAddress, start)` (`decryption.rs:409-413`).
  Delegation is per handle, through `HandleEntry.ownerAddress != userAddress` → `isHandleDelegatedForUserDecryption(owner, user, contract, handle)`
  (`decryption.rs:441-479`). A single request may mix handles from several owners, and the invalidation check still
  runs only once, for `userAddress`.
- *Deliberate and logical.* Invalidation is keyed by `msg.sender` (`ACL.sol:283`) and concerns the signer's own
  signatures. The delegator's tool is `revokeDelegationForUserDecryption` (`ACL.sol:386-415`). The doc's conclusion in
  C1 is right: `isHandleDelegatedForUserDecryption` must return `false` for a sealed delegator, otherwise existing
  delegations survive the seal.

### 1f. Deliberate design or oversight
- Against leaked **permits**, the mechanism is deliberate and correct. The SDK comments above say so explicitly.
- Against leaked **keys**, it depends on the account type:
  - **Smart accounts:** Zama's own e2e test names "signer rotation" as *the motivating scenario* for invalidation: the
    wallet rotates its signer, then calls `invalidateDecryptionSignaturesBefore(0)` to kill pre-rotation approvals
    (`decryptionSignatureInvalidation.ts:355-413`). For smart accounts, invalidation plus rotation **does** handle a
    compromised signer key, by design.
  - **EOAs:** there is no rotation, so the doc's statement holds. A key holder can always produce a fresh permit.
  - **7702-delegated EOAs:** the root key remains a valid ECDSA authority (B5).
- So B2 is an EOA gap rather than an oversight in the mechanism. The doc should say this (§9 below).

### 1g. C1 sentinel on the off-chain side [V]
`invalidatedBefore = 2^256−1` rejects every `startTimestamp < 2^256−1` on both connector paths with no code change.
`startTimestamp == 2^256−1` cannot reach that check on either connector path:
- the gateway reverts it (`:1274`, `:1298`)
- the HTTP endpoint rejects anything above `i64::MAX`
- the worker treats it as "not yet valid" (`decryption.rs:344`)

So **the sentinel is safe off-chain** [V]. It is also irreversible through the ACL, because
`InvalidationTimestampTooLow` blocks any later non-increasing value (`ACL.sol:276-278`) [V]. Three caveats belong in
the doc (§9):
1. Invalidation is **per host-chain ACL**. The connector picks the ACL by the handle's chain id
   (`decryption.rs:375-381`, `167-174`), so sealing must be repeated on every host chain [V+I].
2. The sentinel also kills ERC-1271 and PQ permits for that address. A seal therefore forces the user onto a *new*
   address and cannot serve as "turn off ECDSA but keep this address" [I].
3. Stored results stay servable (§7b).

---

## 2. B4: the off-chain gate ignores account state

**Verdict: CONFIRMED.** The precise statement: the signature step reads no state of the claimed account (code,
nonce, a frozen or deactivated flag). The connector does read ACL state (allowances, invalidation).

- `verify_signature`, `shared/user-decryption-signature/src/lib.rs:188-211`:
  - lines 203-208: if `signature` is non-empty, `try_ecrecover` succeeds and `recovered == claimed_signer`, it returns `Ok(())` **with no RPC at all** [V].
  - `try_ecrecover` (`:99-107`) accepts only 65-byte signatures. It calls alloy `Signature::from_raw(...).recover_address_from_prehash(digest)`, which is pure local secp256k1 [V].
  - The unit test `eoa_valid_signature_zero_rpc` (`:281-294`) asserts that this path makes no RPC [V].
- I found no `eth_getCode` or account-state read anywhere in the signature path. A grep of `shared/user-decryption-signature/src`, `kms-worker/src/core/event_processor` and `relayer/src/host/signature_prechecker.rs` for `get_code|getCode|nonce|balance` finds only a code comment at `signature_prechecker.rs:64` [V].
- The ERC-1271 branch issues a single `eth_call`. It does not call `eth_getCode`. It *infers* "no code" from empty returndata (`lib.rs:113-117, 161-167`) [V].
- The legacy paths verify with `ECDSA.recover` inside the gateway contract (`Decryption.sol:964, 990`) [V]. That
  precompile runs on the **gateway chain**, whose state for the user's address is unrelated to the host chain (L1). An
  L1 freeze or EIP-7851/8151 deactivation would therefore not reach P1/P1d either [I].
- *Deliberate design or oversight:* the zero-RPC EOA fast path is a deliberate optimization (docstring at
  `lib.rs:188-195`, test comment at `lib.rs:292-293` "proves the EOA fast path was used", and the SDK port's
  "EOA fast path — local, no RPC" at `verifyErc1271UserDecrypt-p.ts:92`). That it bypasses any future
  account-level PQ freeze looks unconsidered [I]. I found no mention of quantum risk, 7702 or 7851 in this code.

---

## 3. B5: ecrecover first, then ERC-1271; no EIP-7702 handling

**Verdict: CONFIRMED.** Two additions:
- The legacy paths are ECDSA-only (no ERC-1271 at all).
- C3 as written does **not** change today's behavior for 7702 accounts.

Details:
- Order [V]: ecrecover runs first (`lib.rs:203-208`). Only when the signature is empty, unparsable, not 65 bytes or a
  mismatch does it fall through to `check_erc1271_signature` (`lib.rs:210`). The docstring lists the same order
  (`:188-195`).
- There is no 7702 or 8151 handling in any decryption path [V]:
  - A repo-wide grep finds `0xef0100` only in a load-test tool. That tool caps in-flight transactions for
    7702-delegated senders (`sdk/cli-js-sdk/packages/load-test/src/pool/handles.ts:378-390, 512-521`).
  - Incidentally, that tool shows Zama's own code reading the `0xef0100…` delegation indicator through `getCode`.
  - Nothing equivalent exists in the shared crate, kms-worker, either relayer or the SDK decryption code.
- The legacy paths P1/P1d have no ERC-1271 at all: the gateway uses `ECDSA.recover` with `signer != userAddress` →
  revert (`Decryption.sol:957-968, 980-994`) [V]. An old key therefore authorizes P1 even for an account that has
  since become a smart wallet through 7702.
- The relayer precheck reuses the same function (`relayer/src/host/signature_prechecker.rs:122-128`) [V]. The SDK
  precheck is a line-by-line port that is also ecrecover-first (`sdk/js-sdk/src/core/utils-p/decrypt/verifyErc1271UserDecrypt-p.ts:92-111`) [V].
- Consequence [I]: for a 7702-delegated EOA, `ecrecover(sig_by_root_key) == address` is accepted with no RPC on P2/P3,
  and directly on P1. The 7702 delegate's code is never consulted. Runtime confirmation is E5 [X].
- **About C3 [I]:**
  - The rule "accept ecrecover only if the code is empty or is just a 7702 indicator" still **accepts** the root key of
    a 7702 account today, because its code *is* the 23-byte indicator. C3 adds protection only once a 7851-style
    deactivation marker exists, or with an explicit opt-out flag (see §8, C3/C5).
  - "Ask ERC-1271 first for 7702 accounts" would not help either. Typical 7702 wallets accept signatures by
    `address(this)`'s key in `isValidSignature`.
  - The doc already notes this in §8 ("EIP-7851 kabul edilene kadar 7702 hedef olarak güvensiz"). The C3 text should say it explicitly.
- *Deliberate design or oversight:* ERC-1271 support was added for Safe and multisig (RFC-012). The config and test
  comments reference Safe throughout (`kms-connector/config/kms-worker.toml:109-114`,
  `test-suite/e2e/test/erc1271UserDecryption/safe.ts`) [V]. 7702 and PQ were not considered [I]. "Oversight, small fix"
  is fair for the code-check part. Closing the gap for 7702 accounts today needs an additional signal (§8).

---

## 4. B6: the 250,000-gas ERC-1271 cap

**Verdict: CONFIRMED at code level, with a correction about where the cap lives.** It is enforced at **three** layers,
not one. I did not verify the PQ verifier gas figures (R12, external), and the deployed Sepolia value cannot be known
from the repo [X].

### 4a. How ERC-1271 is invoked [V]
`check_erc1271_signature` (`lib.rs:123-186`):
- It builds `TransactionRequest::default().to(addr).input(isValidSignature(digest, sig)).gas_limit(gas_limit)` and
  calls `provider.call(tx)` (`:130-139`). This is an `eth_call` with `gas = erc1271_gas_limit` and no `from`.
- In alloy-provider 2.5.0 source, `Provider::call` defaults to the **pending** block
  (`~/.cargo/registry/src/.../alloy-provider-2.5.0/src/provider/trait.rs:186-188`). The connector locks 2.2.0, which I
  assume behaves the same [I]. ACL reads through the contract instance use `BlockId::default()`
  (alloy-contract 2.5.0 `call.rs:463`) [V for 2.5.0], which is "latest" [I].
- The result is accepted iff returndata is at least 32 bytes and starts with `0x1626ba7e` (`:169-185`).
- The value comes from `HostRpcClient::verify_signature` (`kms-worker/src/core/event_processor/rpc.rs:69-86`) and
  `DecryptionProcessor.erc1271_gas_limit` (`decryption.rs:52-53, 82`).

### 4b. What happens on out-of-gas [V+I]
- **Top-level OOG.** I expect a geth-style node to return a JSON-RPC error "out of gas" with no revert data [I].
  alloy's `ErrorPayload::as_revert_data()` returns `Some` only when the message contains "revert"
  (`alloy-json-rpc-2.5.0/src/response/error.rs:355-362`) [V for 2.5.0]. The error therefore maps to
  `Erc1271Error::Transport` (`lib.rs:154-158`), then to `RequestCheckKind::Network` and `ProcessingError::transient`
  (`error.rs:107, 202-214`). It is **retried, never accepted**, until `max_decryption_attempts` (default 20,
  `config.rs:228-230`) or the validity window runs out.
- **OOG inside the wallet** (for example in its verifier sub-call). The wallet usually reverts with empty data, which
  maps to `EmptyRevert` (`lib.rs:146-148`) and then to **recoverable** `UserSignatureRejected` (`error.rs:108-112`).
  It is retried and never accepted. Zama's e2e notes this ambiguity: an under-gassed call "reverts with empty data,
  which `verify_signature` reports exactly like a forged blob" (`test-suite/e2e/test/erc1271UserDecryption/erc1271UserDecryption.ts:712-715`) [V].
- Either way, a PQ wallet whose `isValidSignature` needs more than 250k gas can never authorize. The failure shows up as
  repeated retries rather than a clean rejection.

### 4c. Where the cap is set (config key, env var, deployment) [V]
| Layer | Key / constant | Default / example | Env var |
|---|---|---|---|
| Connector kms-worker (authoritative) | `erc1271_gas_limit` (`config.rs:138-141`, default `:274-276`) | `250_000` | `KMS_CONNECTOR_ERC1271_GAS_LIMIT` (`kms-connector/config/kms-worker.toml:109-114`) |
| Legacy relayer precheck | `user_decrypt_signature_check.erc1271_gas_limit`. **Required, no default** (`relayer/src/config/settings.rs:734-738, 811-812`) | `250000` in every example: `relayer/config/local{,.testnet,.mainnet}.yaml.example:34-35/39-40`, `relayer/tests/relayer-test-config.yaml:24`, `test-suite/fhevm/templates/config/relayer.yaml:13-18`, `ci/preview-env/relayer/values-relayer-e2e.yaml:147-152` | `APP_USER_DECRYPT_SIGNATURE_CHECK__ERC1271_GAS_LIMIT` (prefix `APP`, separator `__`, `settings.rs:849-851`) |
| SDK precheck | `ERC1271_GAS_LIMIT = 250_000n`, **hard-coded** (`sdk/js-sdk/src/core/utils-p/decrypt/verifyErc1271UserDecrypt-p.ts:22-28`) | `250_000` | none (a release is needed to change it) |
| e2e harness | `ERC1271_GAS_LIMIT` (`test-suite/e2e/test/erc1271UserDecryption/safe.ts:93`) | `250_000` | `ERC1271_GAS_LIMIT` |

- Helm: `charts/kms-connector/templates/kms-connector-kms-worker-deployment.yaml:54-93` sets no ERC-1271 variable. An
  operator can add one through `kmsConnectorKmsWorker.env` or `commonConfig.env` (`charts/kms-connector/values.yaml`).
  Neither the chart nor `ci/preview-env/kms-connector/values-kms-connector-e2e.yaml` overrides the default.
  **The repo therefore implies 250k everywhere. The live Sepolia operators' values are not in the repo** [X].
  Suggestion for E4: deploy our own wallet whose `isValidSignature` burns a configurable amount of gas, then bisect
  using only our own accounts.
- The template comment says all three layers must stay equal: "Keep equal to the KMS connector default and the js-sdk
  ERC1271_GAS_LIMIT" (`test-suite/fhevm/templates/config/relayer.yaml:14-17`) [V].

### 4d. Does the relayer verify signatures itself? [V]
- **Legacy relayer (`relayer/`): yes, on v3 (unified) only.** `UserDecryptSignaturePreChecker::verify`
  (`relayer/src/host/signature_prechecker.rs:79-171`) recomputes the digest and calls the same shared
  `verify_signature` with its own cap.
  - `Transport` and `EmptyRevert` are retried.
  - A persistent `EmptyRevert` returns 400 (invalid signature).
  - A persistent `Transport` returns 500 (`:121-170`).
  - Legacy v2 variants skip it (`:83-95`); the gateway verifies those.
  - It runs before dedup (`relayer/src/http/endpoints/v3/handlers/user_decrypt.rs:198-231`).
  - **A PQ wallet above 250k is therefore rejected at the relayer before it reaches the connector.**
- **relayer-http: no.** "Verified by the connector, not here" (`relayer-http/crates/relayer-http/src/endpoint/flows/user_decrypt.rs:33`).

### 4e. Deliberate design or oversight
The cap is a deliberate DoS bound, sized for a nested Safe at about 91k gas plus headroom (`kms-worker.toml:110-112`).
Excluding PQ wallets is most likely an unconsidered side effect [I]. **The doc should state that C4(a) has to change
three places** (§9).

---

## 5. B7: KMS PQ signatures do not reach users end to end

**Verdict: CONFIRMED.** One doc reference is wrong (R9 for the SDK), and the branch summary should be narrowed.

### 5a. The connector requests and keeps ECDSA only [V]
- It requests only ECDSA: `signing_schemes: vec![SigningSchemeType::Ecdsa256k1 as i32]` for user decryption
  (`decryption.rs:613-614`) and for public decryption (`:627-628`). The comment there says the value is "Currently
  hardcoded to Ecdsa256k1 as it is the only scheme used for Ethereum".
- It also **drops** any non-ECDSA signature the KMS returns. `ecdsa_signature()` picks the `Ecdsa256k1` entry or the
  legacy `external_signature` (`kms-connector/crates/utils/src/types/kms_response.rs:243-256`), and it is used for
  every response type, including user decryption at `:441`.

### 5b. The 65-byte requirements [V]
- relayer-http: `check_signature` rejects any KMS share signature that is not 65 bytes, citing that "The SDK rejects any
  share whose signature is not 65 bytes" (`relayer-http/crates/relayer-http/src/kms_aggregator/flows/mod.rs:13-15, 50-62`).
  It checks length and duplicates only, not the signer.
- SDK:
  - **The doc's reference `sdk/js-sdk/src/core/base/sign.ts:15` is the wrong place.** Line 15 checks the length of
    the SDK's *own* `sign()` output.
  - The 65-byte requirement on KMS share signatures is in
    `sdk/js-sdk/src/core/modules/relayer/module/guards/RelayerUserDecryptSucceeded.ts:66-70`
    (`assertRecordBytesHexNo0xProperty(item, 'signature', …, { byteLength: 65 })`).
  - Signature recovery also requires 65 bytes: `sign.ts:43-63` (line 46).
  - The tkms WASM call notes that it "accepts only a strict 65-byte ECDSA signature" for the permit and identifies KMS
    signers by address (`sdk/js-sdk/src/core/modules/decrypt/module/api-p.ts:378-396`).
  - The KMS WASM client defaults to `signing_schemes: [Ecdsa256k1]` (`kms/core/service/src/client/client_wasm.rs:93`).
- Also ECDSA-only and not listed in the doc: the gateway verifies KMS response signatures with `ECDSA.recover`
  (`Decryption.sol:925`), and the OZ v5 implementation reverts on lengths other than 65 [I]. `KMSVerifier` uses a fixed
  `1 + 65·n` proof layout (`host-contracts/contracts/KMSVerifier.sol:152-166`) and `ECDSA.recover`
  (`:411-417`). Both confirm R2.

### 5c. KMS ML-DSA code [V]
- `kms/core/service/src/cryptography/signing/mldsa.rs` implements ML-DSA, generic over FIPS-204 parameter sets
  `MlDsa44/65/87` (`:135-148`).
  - `sign` signs `dsep || msg` with `try_sign` (`:29-39`, concatenation at line 34).
  - `verify` checks `dsep || msg` (`:41-52`).
  - That is, **an 8-byte domain separator is prepended to the message.** This matters for C4(b) (§8).
- The scheme enum is `Ecdsa256k1, Ed25519, MlDsa44, MlDsa65, MlDsa87` (`signing/mod.rs:143-149`). An empty request list
  resolves to ECDSA (`:188-198`).
- The KMS always emits the deprecated ECDSA `external_signature`, "part of the released wire contract until it goes
  away in 0.16" (`kms/core/service/src/engine/base.rs:494-520`).
- Library: `ml-dsa = "=0.1.1"` (RustCrypto). Zama's own `Cargo.toml` note says "MEDIUM RISK: … but no security audit"
  (`kms/Cargo.toml:175`).
- Version history:
  - `mldsa.rs` is present in tags `v0.15.0-0` (tagged 2026-09-14) and `v0.15.0-1` (2026-10-03), and absent from `v0.14.2`.
  - Composite (multi-scheme) signcryption arrived in `f80efb55` (2026-10-02, tag `v0.15.0-1` only).
  - "KMS v0.15" is accurate as "the 0.15 pre-releases".

### 5d. `chore/pq-tls-handshake` [V]
- It is a single commit, `3516d8f2`, "chore: enforce hybrid PQ key exchange in mTLS handshakes" (Nikita Frolov,
  2026-10-05). It sits on merge-base `c35e9cc2` and is **not in `main`** (`git merge-base --is-ancestor` → false).
- It adds `threshold_networking::tls::build_p2p_tls_config`. That function forces TLS 1.3 and an AWS-LC provider whose
  `kx_groups` are exactly `[X25519MLKEM768, SECP256R1MLKEM768]` (X25519 first). Both server and client reject
  classical-only and pure-ML-KEM peers. `kms-server.rs` is switched over to it.
- Scope: the **KMS core-to-core P2P (MPC) mTLS only.** Certificates stay classical: "Certificate authentication uses
  classical signatures" (added in `ai-docs/ARCHITECTURE.md`, `docs/explanations/network_doc.md` and
  `docs/explanations/trust_model.md`).
- It does not touch the connector↔core gRPC, relayer↔connector HTTP or user-facing paths.

### 5e. Deliberate design or oversight
Deliberate and on the roadmap (dual signing, deprecation date for `external_signature`, PQ TLS). The doc's "this is
Zama's active roadmap, out of scope" holds.

---

## 6. B1 (off-chain part): `blockAccount` / the deny list in the decryption path

**Verdict: CONFIRMED.** No off-chain component consults the deny list.

- Connector: the checks call only `isAllowed`, `isAllowedForDecryption`, `isHandleDelegatedForUserDecryption` and
  `decryptionSignatureInvalidatedBefore` (`kms-worker/src/core/event_processor/rpc.rs:24-67`). There is no
  `isAccountDenied` [V].
- On-chain, these view functions ignore the deny list. `isAllowed` is `ACL.sol:517-519`;
  `isHandleDelegatedForUserDecryption` is `:561-574` [V].
- Legacy relayer: its host ACL multicall checks only `isAllowed`, `isHandleDelegatedForUserDecryption` and
  `isAllowedForDecryption` (`relayer/src/host/acl_checker.rs:117-474`) [V].
- relayer-http: it does no ACL checks at all (`relayer-http/CLAUDE.md:13-14`) [V].
- SDK: its client-side checks are `checkPersistAllowed` and `checkDelegation` (`fetchKmsSigncryptedSharesV2-p.ts:123-152`) [V].
- Coprocessor: `BlockedAccount` and `UnblockedAccount` events are only logged as "unhandled"
  (`coprocessor/fhevm-engine/host-listener/src/database/tfhe_event_propagate.rs:1960-1971, 2858-2860`) [V].
- A repo-wide grep for `isAccountDenied|denyList|blockAccount|BlockedAccount` outside contracts, docs and tests finds
  only that coprocessor match [V].
- Two on-chain details for the B1 agent [V]:
  - `blockAccount` is `onlyOwner` (`ACL.sol:601-608`). `allow` checks the deny list for `msg.sender` only, not for
    `account` (`:230-240`).
  - `delegateForUserDecryption` has **no** deny-list check (`:326-377`). A blocked account can still receive
    allowances, user-decrypt and delegate.
  - Zama's ACL guide says denied accounts "cannot grant or receive new permissions"
    (`docs/solidity-guides/acl/README.md:65`). The "receive" part does not match `ACL.sol:230-240`.
- *Deliberate design or oversight:* the deny list is documented as a governance tool against propagating permissions
  (`allow*`), not as a decryption control. Not checking it off-chain is consistent with that purpose [I]. The doc's B1
  conclusion stands: no user-callable way exists to retire an address.

---

## 7. Other checks

### 7a. ML-KEM parameter set and AEAD: CONFIRMED "ML-KEM-512 + AES-256-GCM" [V]
- `kms/core/service/src/cryptography/hybrid_ml_kem.rs:1-10, 98-122` builds hybrid PKE from an ML-KEM KEM and an
  `Aes256Gcm` DEM:
  - the AES key is the first 32 bytes of the KEM shared secret (no separate KDF)
  - the nonce is a random 12 bytes
  - there is no associated data
- For user decryption, `UnifiedPublicEncKey::MlKem512` encrypts with `hybrid_ml_kem::enc::<MlKem512>`
  (`encryption.rs:33-47, 76-84`). Legacy `MlKem1024` is rejected with `MlKem1024Unsupported` (`:81`).
  `MlKem1024P384` is used for custodian backup only.
- The gRPC proto says `enc_key` "must be a bincode (v.1) encoded ML-KEM 512 key" (`kms/core/grpc/proto/kms.v1.proto:475-476`).
- The SDK types are `PublicEncKeyMlKem512` and `PrivateEncKeyMlKem512` (`sdk/js-sdk/src/core/modules/decrypt/module/api-p.ts:2-3, 95-180`).
- Shares are signcrypted (sign then encrypt). The server's signature inside is ECDSA, plus optional composite schemes
  (`kms/core/service/src/cryptography/signcryption/mod.rs:1-9`).
- Library note: `ml-kem = "=0.3.2"`, which Zama's note marks "MEDIUM RISK … without a completed KMS-specific security audit" (`kms/Cargo.toml:176`).
- Doc nuance for §2, step 1: the transport key pair is not one-time in practice. The SDK lets you persist it across
  sessions (`serializeTransportKeyPair`) and only *recommends* a fresh pair per session
  (`sdk/js-sdk/docs/security.md:131-153`). It is reused for every decryption under a permit that may be valid for up to 365 days.

### 7b. Are stored results served indefinitely, and to whom? CONFIRMED, with additions [V]
- Connector, HTTP path (P3):
  - "Successful public and user decryption results are served indefinitely, including after the user-signed validity
    interval expires. Stored results are returned without rechecking ACL access, delegation, signature invalidation, or
    ERC-1271 account state" (`kms-connector/docs/architecture.md:92-94`). Rows are kept permanently (`:30, 36, 108-110`).
  - The code is `kms-connector/crates/endpoint/src/core/http/decrypt.rs:108-153`.
  - **Who can get them:** a caller authenticated by the proxy's `FhevmSig` header, which only `allowed_senders`
    (relayers) can produce (`proxy/src/core/config.rs:39-40`), *and* who submits a byte-identical body. The
    `decryption_id` is the EIP-712 hash of the whole body: attestationType, payload, signature and ML-KEM public key
    (`kms-connector/crates/api/src/types.rs:79-91`).
- Gateway paths (P1, P1d, P2): the shares are emitted on-chain in `UserDecryptionResponse` events
  (`Decryption.sol:748-754`). They are public permanently.
- Legacy relayer:
  - Results are stored in Postgres. The expiry worker is **disabled by default** (`relayer/README.md`, "Data Retention Policy").
  - The dedup key **excludes `signature` and `requestValidity`** (`relayer/src/core/user_decrypt_request.rs:27-63`).
    An identical request (same handles, user, public key, contracts and extraData) with a fresh signature is served the
    cached result without new connector checks. Zama's e2e comments on this at `decryptionSignatureInvalidation.ts:369-374`.
- In-flight requests are re-checked: a poll-only retry re-runs every live check before reading the KMS result
  (`processor.rs:64-68`; test rationale at `kms-worker/tests/acl.rs:34-36`). A seal or invalidation that lands before
  completion therefore blocks publication [V].
- Assessment: every stored payload is encrypted to the requester's ML-KEM-512 key, so the doc's "no extra risk" holds
  with three caveats [I]:
  1. Whoever holds that ML-KEM private key at *any* later time can decrypt every stored or on-chain share for it, and
     keys may be persisted and reused (7a).
  2. Sealing cannot retract results already produced. This is consistent with the doc's out-of-scope statement.
  3. Results an attacker obtained before a seal stay retrievable by that attacker, though they gain nothing new.

### 7c. Do relayers check ACL or signatures before forwarding? PARTIAL
- **Legacy relayer** [V]:
  - Host ACL precheck for every user-decrypt variant, always on (`relayer/src/readiness/checker.rs:119-172`,
    `readiness/user_decrypt_processor.rs:66-87`, `config/settings.rs:264-276`).
  - Signature precheck on v3 only (4d).
  - Checks `start ≤ now` and expiry (1c).
  - It does **not** check invalidation, the deny list, 7702 or code.
  - These checks are advisory, because the gateway is permissionless (§0).
- **relayer-http** [V]: no ACL, signature or invalidation checks. "Minimal first version … No ACL check"
  (`relayer-http/CLAUDE.md:13-14`). It does structural validation and `start ≤ now` (`endpoint/flows/user_decrypt.rs:81-121`).
  It aggregates KMS shares by length and duplicates (5b). On P3 the connector is the only authority.
- **SDK** [V]: client-side ACL checks, expiry check and an ERC-1271 precheck (`fetchKmsSigncryptedSharesV2-p.ts:120-152`;
  `verifyErc1271UserDecrypt-p.ts`). All precautionary.

---

## 8. Prototype facts for C3, C4(a), C4(b) and C5 (sketches, not compiled)

### Where the logic lives
- One function serves both authoritative and advisory callers: `shared/user-decryption-signature/src/lib.rs::verify_signature`.
  - Used by the kms-worker (`rpc.rs:70-86` ← `decryption.rs:403-408`).
  - Used by the legacy relayer precheck (`relayer/src/host/signature_prechecker.rs:122-128`; path dependency at `relayer/Cargo.toml:66`).
  - relayer-http does not depend on it.
  - The SDK has its own TS port (`verifyErc1271UserDecrypt-p.ts`).
- The legacy path (P1/P1d) never reaches `verify_signature`; the gateway verifies ECDSA there. **Each change below
  needs a separate legacy-path hook** in `decryption.rs:120-233`.

### C3: code check before accepting ecrecover (EIP-8151-like semantics off-chain)
```rust
// shared/user-decryption-signature/src/lib.rs  (SKETCH)
const EIP7702_PREFIX: [u8; 3] = [0xef, 0x01, 0x00];      // indicator = 0xef0100 || 20-byte delegate (23 bytes)

/// Whether the claimed signer's code still lets its ECDSA key authorize.
fn ecdsa_allowed_for_code(code: &[u8]) -> bool {
    code.is_empty()                                           // plain EOA
        || (code.len() == 23 && code[..3] == EIP7702_PREFIX)  // 7702 EOA; a 7851-style "deactivated" marker would return false here
}

#[derive(Clone, Copy, Debug, Default)]
pub struct VerifyPolicy { pub code_check: bool, pub ecdsa_disabled: bool /* C5 */ }

pub async fn verify_signature<P: Provider>(provider: &P, claimed_signer: Address, digest: B256,
        signature: &[u8], gas_limit: u64, policy: VerifyPolicy) -> Result<(), Erc1271Error> {
    if !policy.ecdsa_disabled
        && !signature.is_empty()
        && let Some(recovered) = try_ecrecover(&digest, signature)
        && recovered == claimed_signer
    {
        if !policy.code_check { return Ok(()); }
        let code = provider.get_code_at(claimed_signer).await              // 1 extra RPC per EOA request
            .map_err(|e| Erc1271Error::Transport(e.to_string()))?;
        if ecdsa_allowed_for_code(&code) { return Ok(()); }
        // contract code at claimed_signer: refuse the ECDSA path, fall through to ERC-1271
    }
    check_erc1271_signature(provider, claimed_signer, digest, signature, gas_limit).await
}
```
- Config: in `kms-worker/src/core/config.rs`, add `#[serde(default)] ecdsa_code_check: bool` (env
  `KMS_CONNECTOR_ECDSA_CODE_CHECK`). Carry it in `DecryptionProcessor` (`decryption.rs:37-54, 61-84`), pass it at
  `decryption.rs:403-408`, and thread it through `rpc.rs:70-86`. The relayer passes `VerifyPolicy::default()` or a
  mirrored config.
- Tests:
  - `eoa_valid_signature_zero_rpc` (`lib.rs:281-294`) still passes when the default is `code_check=false`.
  - New unit tests: empty code accepted; 23-byte indicator accepted; contract code falls through to ERC-1271; `get_code` transport error gives `Transport`.
  - **Pitfall:** the v2 tests in `decryption.rs` (`:1158-1495`) feed a FIFO `Asserter` in a fixed order using
    `biased;`. With `code_check=true` every case needs one extra queued response, which reorders the mocks. Keep the
    flag default-off, or re-sequence those tests.
- Use `eth_getCode` at the same block tag as the ERC-1271 call (4a: `call` uses pending, contract reads use latest) [I].
- Limitation [I]: as noted in §3, this rule does not exclude 7702 root keys today. To protect a 7702 user who wants to
  keep the same address, the connector needs an explicit opt-out signal. One option is an ACL mapping
  `ecdsaDecryptionDisabled[account]` read next to `decryptionSignatureInvalidatedBefore`. That serves both C3 and
  per-account C5, and it is an input to review question Q1.

### C4(a): higher gas cap for allow-listed code hashes
- Config: in `config.rs`, add `erc1271_gas_overrides: Vec<{ code_hash: B256, gas_limit: u64 }>`. Read it from a JSON
  env var such as `KMS_CONNECTOR_ERC1271_GAS_OVERRIDES`, following the `KMS_CONNECTOR_HOST_CHAINS` pattern at `config.rs:175-191`.
- In `lib.rs`, before the `eth_call` (`:130-139`): reuse the C3 `get_code_at`. If the code is a 7702 indicator, fetch
  the delegate's code. Then `gas = overrides.get(&keccak256(code)).unwrap_or(default)`.
- Mirror the change in the relayer's `UserDecryptSignatureCheckConfig` (`relayer/src/config/settings.rs:734-738`) and in
  the SDK's `ERC1271_GAS_LIMIT` (`verifyErc1271UserDecrypt-p.ts:28`). Otherwise those layers reject or flag the request first (4c, 4d).
- Design caveats [I]:
  1. Most smart accounts are proxies (ERC-1967, Safe). A proxy's code hash does not pin its implementation (that lives
     in storage) or an external verifier contract.
  2. Anyone can deploy allow-listed bytecode, so the per-request DoS bound rises for everyone using it. "Config only" understates the operator cost.

### C4(b): scheme-hinted native verification (reusing the KMS ML-DSA library)
- Smallest change (shared crate only, and it works on P2 and P3): add a branch in `verify_signature` *before* ERC-1271
  for a tagged signature blob, for example `magic ‖ scheme ‖ pk ‖ sig`.
  1. One cheap `eth_call` to `IPqAuth(claimed_signer).pqAuthKey() → (uint8 scheme, bytes32 pkHash)`. ERC-8231 is an alternative.
  2. Require `scheme` to match and `keccak256(pk) == pkHash`.
  3. Verify natively.
- Use the **`ml-dsa` crate directly** (`=0.1.1`, the same as the KMS; unaudited per `kms/Cargo.toml:175`) with
  FIPS-204 verification over the 32-byte digest. Do not call `kms` `MlDsa::<P>::verify`: it prepends an 8-byte
  `DomainSep` (`mldsa.rs:34, 49`) and depending on `kms-service` would pull in tfhe and the threshold crates.
- Sizes: ML-DSA-44 is about 1.3 kB pk and 2.4 kB signature (FIPS 204) [I]. Both fit the 1 MiB body limits
  (`kms-connector/crates/endpoint/src/core/config.rs:94-96`, `relayer-http/config/config.yaml:10`) [V].
- Must also change: the SDK precheck. It would send such a blob to `isValidSignature` and could raise a definitive
  rejection (`verifyErc1271UserDecrypt-p.ts:113-139`). The legacy relayer gets the change automatically through the shared crate.
- Existing extension point, though heavier to use:
  - The connector's HTTP API already has a scheme discriminant, `AttestationType` (`kms-connector/crates/api/src/attestation.rs:5-12`, one variant today).
  - The legacy relayer's allowlist comment says "Future signature schemes (e.g. Solana ed25519) plug in by widening
    this allowlist" (`relayer/src/http/utils/validations.rs:285-308`).
  - **But** `attestationType` is not stored in the connector DB (`endpoint/src/core/db.rs:140-146`) and so never
    reaches the worker. relayer-http hard-codes it (`endpoint/flows/user_decrypt.rs:19, 83-87`). The gateway unified
    event has no scheme field. That route therefore needs a DB migration, worker type changes and relayer changes, and
    it would not cover P2.
- Falcon, ETHFALCON and SLH-DSA would need other crates. ETHFALCON (Keccak variant) has no standard Rust verifier [I]. Check this against the "no new crypto" rule.

### C5: where a fail-closed flag would be read
- Unified paths: add `ecdsa_disabled` to `VerifyPolicy` (sketch above). It skips the ecrecover accept branch, so only
  ERC-1271 or PQ can authorize. Pass it at `decryption.rs:403-408`.
- Legacy paths: P1/P1d are ECDSA-only, so reject them wholesale at the top of
  `check_ciphertexts_allowed_for_user_decryption` (`decryption.rs:121-128`) as irrecoverable `UserSignatureRejected`.
- Source of the flag:
  - Option A, an operator-local config field in `config.rs` (env such as `KMS_CONNECTOR_ECDSA_USER_DECRYPTION_DISABLED`).
    This only works if enough operators flip it that fewer than the user-decryption threshold of shares can be produced [I].
  - **Option B (better), an on-chain flag read by every connector.** It could be a view on the host ACL (per host
    chain, read through `HostRpcClient`, `rpc.rs`) or on `ProtocolConfig` on Ethereum (already configured,
    `config.rs:67-69`).
  - Read it concurrently with the invalidation read (`decryption.rs:409-413, 223-227`). A new ACL view needs
    regenerated `fhevm_host_bindings` or an inline `sol!` interface.
  - Treat RPC errors as recoverable, never as "flag off".
- No change is needed in the KMS core (it never sees user signatures) or in relayer-http (it has no checks). The SDK and
  legacy relayer would need it only for UX.

### Build and test needs (nothing was built) [V unless marked]
- **Toolchains installed** (`rustup toolchain list`): stable 1.95.0 (default), plus 1.91.1, 1.93.x, 1.94.1, 1.97.1,
  **1.99.0** and nightly. The brief listed only 1.95.
  - `kms-connector/rust-toolchain.toml` pins **1.99.1** (not installed). rustup will try to download it. Offline,
    `cargo +1.99.0` or `RUSTUP_TOOLCHAIN=1.99.0` should work [I].
  - `relayer/` and `relayer-http/` pin 1.97.1 (installed).
  - `shared/user-decryption-signature` has no pin, so it uses 1.95.0. Its edition-2024 let-chains need Rust ≥ 1.88 [I].
- **Shared crate** (cheapest prototype target for C3, C4 and C5): the dependencies are
  - `alloy =2.2.0` (features k256, providers, rpc-types, sol-types)
  - `fhevm_gateway_bindings` (path `../../gateway-contracts/rust_bindings`, alloy contract and sol-types)
  - `thiserror`
  - dev-dependencies: alloy json-rpc and signer-local, `serde_json`, `tokio`

  It needs no Docker, protoc or tfhe. Tests mock RPC with alloy `Asserter`. Network is needed: the local registry has
  alloy 2.5.0 crates but the lock pins 2.2.0. Since the clone is read-only, **copy the crate and
  `gateway-contracts/rust_bindings` into `connector-patch/`** and run `cargo test` there.
- **kms-worker unit tests** (`decryption.rs` `mod tests`, mocked, no DB):
  - Command: `SQLX_OFFLINE=true cargo test -p kms-worker --lib` (the offline sqlx cache `kms-connector/.sqlx/` exists; the Makefile also sets `RUST_BACKTRACE=full`). Requirements:
  - **`protoc`**: `kms-grpc` builds its protos with `tonic_prost_build` (`kms/core/grpc/build.rs`). It is not on PATH.
  - **Git fetches** of `zama-ai/kms` at `511ac7e0` for `kms-grpc` and `bc2wrap` (`kms-connector/Cargo.toml`). That commit exists in the local kms clone (tag `v0.15.0-1`). To build offline, export it with `git -C kms archive 511ac7e0` into a scratch directory and point a `[patch]` at it. Do not add a worktree, which would modify the clone.
  - Heavy compilation: `tfhe =1.8.1`, the aws-sdk crates, and `rustls`/`aws-lc-rs`. aws-lc-sys needs a C toolchain; aws-lc-sys 0.45.0 is already in the cargo cache [I: it built here once].
  - Not needed for `-p kms-worker`: `pingora`/openssl, which only the `proxy` crate uses.
- **kms-worker integration tests** (`crates/kms-worker/tests/*.rs`) need:
  - Postgres: `make db-up` → `connector-db/docker-compose.yml` (`postgres:17.5`, `localhost:5432`, DB URL from `DATABASE_URL` or the default in `crates/utils/src/tests/setup/db.rs:12-13`)
  - Foundry `forge`/`anvil` (present in `~/.foundry/bin`)
  - `cargo nextest` (not installed; `cargo test` should do)
  - **POSIX `kill -STOP/-CONT`** on anvil (`crates/utils/src/tests/setup/blockchain.rs:203-210`)

  So run them on **Linux (WSL2 or a container)**, with Docker Desktop started.
- **End-to-end runs**: the `test-suite/fhevm` CLI. Use `./fhevm-cli up --target latest-main --build`, or a local image
  through `CONNECTOR_KMS_WORKER_VERSION` (README "Version Override via Environment Variables"). Existing suites are
  `./fhevm-cli test erc1271-user-decryption | unified-user-decryption | decryption-signature-invalidation | connector-http`
  (the command list around `test-suite/fhevm/README.md:344-357`). These are the natural hosts for the E2, E4 and E5 analogues and for C3/C5
  tests. They need Docker (Linux containers).

---

## 9. Suggested changes to the design doc

1. **§2 step 3, B4, B5:** describe both families of paths.
   - On the legacy paths (SDK V1 permits → relayer `/v2`), the *gateway contract* verifies the user signature with
     `ECDSA.recover` only; the connector checks only invalidation and ACL.
   - On the unified paths (relayer `/v3` → gateway event, or `/v4` → connector HTTP), the connector runs ecrecover then ERC-1271.
   - ERC-1271 exists only on the unified paths.
   - B5's sentence "EVM'deki precompile'ı değil, zincir dışındaki bir kütüphaneyi kullandığı için" should read:
     "the off-chain library, or an ecrecover on the gateway chain. Neither sees host-chain account state, so EIP-8151
     on L1 would not carry over."
2. **B2:**
   - Narrow it to EOAs and 7702 EOAs. For smart accounts, invalidation plus signer rotation is Zama's designed remedy
     (their e2e calls it "the motivating scenario").
   - Add that `startTimestamp == invalidatedBefore` is accepted (deliberate).
   - Add that `startTimestamp ≤ now` is enforced by the gateway, the connector worker (unified), both relayers and the SDK.
   - Reword "Gözden kaçan durum" to "deliberately scoped to permits; there is no key-retirement path for EOAs."
3. **B6:**
   - The cap exists at three layers: the connector (`KMS_CONNECTOR_ERC1271_GAS_LIMIT`, default 250k), the legacy
     relayer (required `user_decrypt_signature_check.erc1271_gas_limit`, env
     `APP_USER_DECRYPT_SIGNATURE_CHECK__ERC1271_GAS_LIMIT`) and the SDK (hard-coded `250_000n`).
   - Out-of-gas is never accepted; it is retried as transient or recoverable until attempts run out.
   - The deployed Sepolia value cannot be read from the repo.
4. **B7 and R9:**
   - Replace `sdk/js-sdk/src/core/base/sign.ts:15` with `sdk/js-sdk/src/core/modules/relayer/module/guards/RelayerUserDecryptSucceeded.ts:66-70`.
     Optionally also cite `sign.ts:43-63` for recovery.
   - Add: the connector discards non-ECDSA KMS signatures (`kms_response.rs:243-256`), and the gateway verifies KMS
     responses with `ECDSA.recover` (`Decryption.sol:925`).
   - PQ-TLS branch: one commit `3516d8f2`, KMS core-to-core P2P mTLS only, hybrid X25519MLKEM768/secp256r1MLKEM768, classical certificates, not merged.
   - ML-DSA ships in the v0.15.0-0 and v0.15.0-1 pre-releases.
5. **§2 step 1:** change "tek seferlik ML-KEM açık anahtarı" to "a per-permit ML-KEM-512 transport key; it may be
   persisted and reused (the SDK only recommends per-session keys)."
6. **§11 item 7:** say to whom results go.
   - HTTP-path results go to allow-listed relayer senders that present an identical body.
   - Gateway-path shares are public on-chain events.
   - The legacy relayer caches results with expiry off by default, and its dedup key ignores signature and startTimestamp.
   - All are encrypted to the requester's ML-KEM key, and a seal cannot retract them.
7. **C1:**
   - "No connector change" is verified, including the `2^256−1` equality edge.
   - Add that sealing is per host chain (one ACL per chain).
   - Add that the sentinel also blocks ERC-1271 and PQ permits for that address, so a seal always means moving to a new
     address. It cannot be used by a 7702 user who wants to keep the address.
8. **C3:** state that the "empty or 7702-indicator" rule still accepts 7702 root keys today. It only bites with a
   7851-style deactivation marker or an explicit per-account opt-out. It must also be applied to the legacy path or tied
   to its deprecation (Zama marks it deprecated, `Decryption.sol:443-444, 522-524`).
9. **C4:**
   - (a) has to change three layers, does not pin proxy implementations, and raises the DoS bound for anyone who deploys allow-listed code.
   - (b) the existing hooks are `attestationType` (HTTP API and relayer allowlist), but it is not persisted and not on the
     gateway path, so the in-band tagged-blob design is smaller.
   - Reuse the `ml-dsa` crate, not the KMS wrapper (domain-separator prefix). It is unaudited per Zama's own note.
10. **C5:** say where the flag lives. Use one on-chain flag read by all connectors, not a per-operator config. The
    legacy paths must be refused outright, because they are ECDSA-only. Relayer checks are not a security boundary,
    because the gateway is permissionless and relayer-http checks nothing.
11. **B1 (off-chain):** confirmed as written. Optionally add that denied accounts can still *receive* allowances and
    `delegateForUserDecryption`, which contradicts `docs/solidity-guides/acl/README.md:65`. That is for the on-chain agent.

---

## 10. Incidental observations (outside the B-items; not reported anywhere)
- Unified path state reads use different block tags: ACL reads use latest, the ERC-1271 `eth_call` uses pending (4a).
  This is minor, but C3 and C5 should pick one tag.
- The relayer to connector authentication (`FhevmSig`, an EIP-712 header signed by allow-listed relayer addresses) is
  also secp256k1. It is another classical dependency, outside this design's scope.
- After an invalidation, the SDK's rounding of `startTimestamp` down to the minute (`SignedDecryptionPermitV2-p.ts:324`)
  can produce a fresh permit that is still below the threshold during the same minute. This is UX, not security.

## Possible prompt injection
I found no text that tried to redirect this task. These repo files address AI coding agents. I read them as data and
did not act on them:
- `kms/CLAUDE.md`, `kms/AGENTS.md`. Example: "Read AGENTS.md in full before making any code, configuration, or documentation change".
- `fhevm/relayer-http/CLAUDE.md`: development rules for that repo.
- `fhevm/sdk/js-sdk/CLAUDE.md`: includes `.claude/*.md`.

All three are benign development guides.
