# Phase 1 verification: decryption authority in Zama fhEVM, with a Fhenix comparison

Deliverable 1 of the "Retire & Carry" design review (brief §3 and §7.1). It checks V0, the findings B1–B7 of
`docs/FHE_Yetkilendirme_PQ_Tasarim.md`, a new finding B8, and the Fhenix comparison F1.

## 0. Header

**Date:** 2026-10-21. Chain reads and Sepolia runs took place 2026-10-20 21:57–22:54 UTC (2026-10-21 local time, UTC+3). All times below are UTC.

**Repositories**

| Repo | Revision | Commit date (UTC) | Role |
|---|---|---|---|
| zama-ai/fhevm | `ed851716c9a6b799996a23399ece2858336f96db` (= `origin/main` on 2026-10-21) | 2026-10-20 17:56 | **target ("main")** |
| zama-ai/fhevm, tag `v0.13.8` | `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5` (the release/0.13.x line; no host-contract diff to that branch) | 2026-10-16 17:20 | **deployed** on Sepolia and Ethereum mainnet |
| zama-ai/fhevm, tags `v0.14.2`, `v0.15.0-0` … `v0.15.0-3` | `07b4abd6…`, `9bcd19f5…` … `3fcbc5fa…` | 2026-10-01 … 2026-10-15 | version boundaries only |
| zama-ai/kms | `c755e84ff0816b5fbc07077e248f67ab2bf485d0` (= `origin/main`) | 2026-10-20 07:07 | main |
| FhenixProtocol/cofhe-contracts | `b5c20ed487faa13976e7b1cb2c598a752be8782d` | 2026-10-19 08:39 | master (same commit as the doc) |

Other code used:
- Fhenix: teecryptor `2616344b`, cofhesdk `04a69f89`, cofhejs `637d18b5` (archived) and fhenix-docs `0dd79c80`.
- PQ verifiers: fireblocks-labs/evm-ml-dsa-verifier `cca262b5` (MIT, **unaudited**); ZKNoxHQ ETHFALCON `820da4b6` and ETHDILITHIUM `f9f4fe1d` (cloned, not run).
- npm: `@fhevm/sdk` 0.13.8, `@fhevm/solidity` 0.11.1, `@openzeppelin/confidential-contracts` 0.5.3.
- `zama-ai/tfhe-rs` (`0a43e3c` in the doc) was not re-checked. No Phase 1 verdict depends on it.

**Deployed tag.**
- Sourcify has full matches for the four Sepolia host-contract implementations. `ACL.sol`, `ACLEvents.sol`, `KMSVerifier.sol`, `ProtocolConfig.sol`, `IProtocolConfig.sol` and `Structs.sol` are byte-identical to `v0.13.8`. InputVerifier is an older build, identical to v0.9.2 and later.
- The gateway `Decryption` implementation on chain 10901 is identical to `v0.13.8` (explorer partial match).
- Mainnet runs the same versions with the same code sizes. Its Sourcify diff is still pending.

**Method.** Four Phase 1 workstreams, then this consolidation. The notes are in `results/verification/`.
1. **Host contracts, governance, V0** (`host_contracts_governance_v0.md`).
   - Code read at main and at v0.13.8.
   - Read-only `eth_call`, `eth_getStorageAt`, `eth_getCode` and `eth_getLogs` on Sepolia, Ethereum mainnet and the Zama gateway testnet (10901).
   - Verified sources from Sourcify and Blockscout; GET-only relayer probes.
2. **Off-chain components** (`offchain_connector_relayer_kms.md`): the connector, the shared signature crate, both relayers, the SDK and the KMS. Code only.
3. **Fhenix** (`fhenix_f1.md`): code, plus read-only `cast` calls on three testnets, including `eth_call` state-override probes signed with a throwaway key.
4. **Experiments E2–E5** (`experiments_status.md`; code and raw data in `experiments/`).
   - Sepolia transactions from our own accounts, and local anvil runs under Osaka rules.
   - Zama's unmodified `shared/user-decryption-signature` crate from main, linked into `experiments/udsig-harness`.
5. **Consolidation** (this file).
   - Where notes disagreed, I checked the code (Appendix C).
   - I re-read the key lines in the local clones at main and at v0.13.8. The v0.13.8 blobs were already local; lazy fetch and auto-gc were disabled for every git command.
   - I fetched the connector's `decryption.rs` at v0.14.2 and v0.15.0-0 … -3 from raw.githubusercontent.com (read-only GET).

**Legend**
- **Verdicts:** **Confirmed**, **Refuted**, **Partially true**. "n/a on deployed" means the mechanism the claim is about does not exist in v0.13.x.
- **Evidence labels:**
  - **[V]** read in code at the stated revision, or observed on-chain;
  - **[M]** measured (chain or hardware, date, and tx or commit given);
  - **[I]** inferred: reasoning, not executed;
  - **[E]** estimated;
  - **[S]** a protocol or spec constant, not measured.
- **Paths:** `main:` means fhevm @ ed851716c and `v0.13.8:` means the fhevm tag. Paths are relative to the fhevm repo unless prefixed with `kms/`, `cofhe/` (cofhe-contracts `contracts/internal/host-chain/contracts/`), `teecryptor/` or `cofhesdk/`.
- **P1/P1d/P2/P3** are the user-decryption paths defined in §1.3.
- **Local hardware** for every local [M] number: AMD Ryzen 5 5600 (6C/12T), 16 GiB, Windows 10 Pro 19045; anvil/forge 1.8.5, solc 0.8.30, Node 22.13.0, Rust 1.95.0.

---

## 1. Gate G0 (V0)

### 1.1 Result: V0 refuted, G0 tripped

Sepolia and Ethereum mainnet run the protocol 0.13 line, not main. The difference is material for B2, B5, B6 and B7/R8.

| Contract (Sepolia / mainnet proxy) | Sepolia `getVersion()` (impl) | Mainnet `getVersion()` (impl) | main |
|---|---|---|---|
| ACL `0xf0Ff…433D` / `0xcA2E…ffb6` | **ACL v0.4.0** (`0xF4f793e6…aB98`) | **ACL v0.4.0** (`0x9A017e0b…5418`) | v0.7.0 |
| KMSVerifier `0xbE0E…311A` / `0x7762…BB03` | v0.3.0 (`0xe90451e8…5ed0`) | v0.3.0 (`0x390683dE…3Fa4`) | v0.5.0 |
| InputVerifier `0xBBC1…4DA0` / `0xCe0F…8EA2` | v0.2.0 | v0.2.0 | v0.3.0 |
| ProtocolConfig `0x51f9…ee83` / `0xD823…a7C4` | v0.1.0 | v0.1.0 | v0.4.0 |
| Gateway `Decryption` `0x5D8B…7478` (chain 10901) | v0.5.0 | gateway 261131: RPC is private, pending | v0.8.0 |

[V] Host note §V0. The Sepolia values were re-measured in `experiments/common/raw/sepolia/preflight.json` (block 11958284, 2026-10-20 22:32) [M].

The repo's version map:

| Release line | ACL |
|---|---|
| release/0.13.x | 0.4.0 |
| release/0.14.x | 0.5.0 |
| release/0.15.x | 0.6.0 |
| main | 0.7.0 |

The ACL moved from 0.4 to 0.5 in `6ee4ba705` (2026-05-26, "unified user decryption w/ erc-1271 support (#2624)"). That commit added `invalidateDecryptionSignaturesBefore`. The SDK's `sepolia.ts` at main still lists the brief's addresses (lines 9–29) [V].

Behavioural probes on the Sepolia ACL [V/M]:
- **Absent:** `invalidateDecryptionSignaturesBefore(uint256)`, `decryptionSignatureInvalidatedBefore(address)`, `isDelegatedForUserDecryption(...)` and `getConfidentialBridgeAddress()`. The selectors are missing from the runtime and the calls revert.
- **Present:** `allow`, `allowForDecryption`, `allowTransient`, `multicall(bytes[])`, `delegateForUserDecryption`, `isHandleDelegatedForUserDecryption` and `blockAccount`. `WILDCARD_DELEGATION_ADDRESS()` returns `0xFFfF…FfFF`.

### 1.2 The testnet uses the legacy gateway path

| Probe | Result | Source |
|---|---|---|
| `POST /v2/user-decrypt`, `/v2/delegated-user-decrypt` and `/v2/public-decrypt` with body `{}` | 400 `missing_fields` (the routes exist) | experiments preflight, 2026-10-20 22:32 [M] |
| `POST /v3/user-decrypt` (RFC-016 unified) with body `{}` | **404** "no Route matched" | preflight and E4.7 [M] |
| `GET /v4/user-decrypt` and `/v4/public-decrypt` (relayer-http) | 404 from the edge | host workstream; GET only, no POST probe [M] |
| Access requirements | no API key, fee token, allowlist or captcha | experiments [M] |
| Gateway `userDecryptionCounter` | 1,598,345 → 1,599,922: about 1,577 user decryptions in 21 h, all host chains. About +1,920 public decryptions. 10 of 10 sampled ids done. | host workstream; aggregate counters only [M] |

The live path is therefore P1/P1d:
1. The SDK builds a V1 permit and sends it to the relayer's `/v2/…` route.
2. The relayer submits it to the gateway's `Decryption.userDecryptionRequest(CtHandleContractPair[] …)`.
3. The gateway checks the permit **on-chain with `ECDSA.recover`, EOA only**: v0.13.8 `Decryption.sol:916-925` (direct) and `:937-949` (delegated).
4. The connector reads only the ACL, then the KMS decrypts.

On this path there is **no signature invalidation, no ERC-1271 and no 250k gas cap**.

The connector's version cannot be read on-chain, but it cannot be main's [I]:
- Main's legacy path reads `decryptionSignatureInvalidatedBefore` (main `decryption.rs:221-229`).
- That read reverts on ACL v0.4.0, and the connector retries it as a network error (`rpc.rs:88-94`).
- User decryptions do succeed on Sepolia.

Two versions fit [V]:
- v0.13.8: its connector reads no invalidation. I checked this in the local blob.
- v0.14.2: it reads invalidation only on its RFC-016 path, in `inner_invalidation_check_for_user_decryption_v2`. I checked this at the tag.

`test-suite/fhevm/profiles/latest-supported.json` pins v0.14.2.

### 1.3 The four user-decryption paths in main

| Path | Entry | Who verifies the user signature | Connector checks |
|---|---|---|---|
| **P1** legacy | relayer `POST /v2/user-decrypt` → gateway `userDecryptionRequest(CtHandleContractPair[] …)` | gateway contract, `ECDSA.recover` only (main `Decryption.sol:957-968`; v0.13.8 `:916-925`) | main: invalidation and ACL (`decryption.rs:120-233`); v0.13.8: ACL only |
| **P1d** legacy delegated | `/v2/delegated-user-decrypt` → `delegatedUserDecryptionRequest` | gateway, `ECDSA.recover` against the **delegate** (main `:980-994`; v0.13.8 `:937-949`) | as P1, plus `isHandleDelegatedForUserDecryption` |
| **P2** unified via the gateway (RFC-016) | `POST /v3/user-decrypt` → `userDecryptionRequest(HandleEntry[] …)` (main `:616`). The gateway does not check the signature. | connector `verify_signature`: ecrecover first, then ERC-1271 under a gas cap (`decryption.rs:403-408`) | validity window, signature, invalidation, ownership, allowedContracts (`:314-436`) |
| **P3** unified via HTTP | relayer-http `POST /v4/user-decrypt` → connector HTTP endpoint | connector, as P2 | as P2 |

Two more facts matter for reading the verdicts [V]:
- Anyone who pays the fee can submit a gateway request, so relayer checks are advisory on P1 and P2.
- The KMS core never sees the user signature: `UserDecryptionRequest` in `kms/core/grpc/proto/kms.v1.proto` has no signature field.

### 1.4 Decision

G0 tripped and was reported. **Semih chose to continue with main as the design target and to record deployed-version behaviour separately.** Every finding below therefore has a deployed column and a main column.

The second G0 condition was not met: none of B2, B3 or B5 is refuted.
- B3 and B5 were confirmed on Sepolia.
- B2 is confirmed in main's code but cannot be exercised on Sepolia.

Consequences:
- E2 cannot run on Sepolia, because there is no invalidation there.
- On Sepolia, E4 and E5 exercise the legacy ECDSA path. Main's behaviour was tested by running Zama's crate against the same live accounts.
- B2, B6 and R8 describe code from main or from v0.14/v0.15 onward.

---

## 2. Version matrix

| ID | Deployed v0.13.x (Sepolia, mainnet) | main @ ed851716c | Verdict | Evidence | Deliberate vs oversight |
|---|---|---|---|---|---|
| **B1** No user revocation; `blockAccount` is owner-only and outside the decryption path | Same as main, minus signature invalidation | No user revocation. `blockAccount` is `onlyOwner`. The deny list is checked only for `msg.sender` in 3 write functions, and not by delegation, the views or any off-chain component. | **Confirmed, stronger than stated** | main `ACL.sol:231, 254, 297, 601-621`; v0.13.8 `:207, 230, 255, 518, 531`; `kms-worker/.../rpc.rs:24-67`; `docs/solidity-guides/acl/README.md:65` [V] | Permanence is deliberate (documented). No self-retirement is an oversight. The README's "receive" claim is a doc bug. |
| **B2** Invalidation acts on permits; a fresh permit passes | **n/a**: no invalidation function or getter. A permit lives until expiry (≤ 365 d). E2 not testable. | Rejects iff `start < invalidatedBefore`. The signer picks `start`; equality passes; a future invalidation reverts. | **Confirmed on main, narrowed** to EOAs and 7702 EOAs | main `decryption.rs:520-542` (`<` at 531), tests `:1012, :1240`; `ACL.sol:273-285`; E2 records [V/M] | Deliberately scoped to permits (smart accounts rotate their signer). The gap is no key retirement for EOAs. |
| **B3** A holder re-grants or publishes history in one tx | **Confirmed on Sepolia (E3)**: `allow` → BOB decrypted; `allowForDecryption` → public decrypt; `multicall` batches the grants | Same code, plus wildcard delegation and dApp deputies | **Confirmed, broader** | `0x6c8153…2863` (140,780 gas), `0x9253b9…1cea` (141,493), `0x2ece7d…6795` (×10, 1,217,488); main `ACL.sol:230-267, 326-377, 561-574`; OZ `ERC7984.sol:199-207` [M/V] | Transitivity is deliberate (documented). The missing lifecycle is an oversight. |
| **B4** The off-chain check ignores on-chain account state | `ECDSA.recover` on the gateway chain (v0.13.8 `Decryption.sol:916-925`), which cannot see host-chain account state [I] | Local Rust ecrecover with zero RPC (`lib.rs:203-208`); nothing in the signature path reads account state | **Confirmed** (code) | test `lib.rs:281-294`; E5.6: accepted in 0.26 ms with no RPC [V/M] | The fast path is deliberate. Bypassing a future account-level PQ freeze was not considered. |
| **B5** A 7702 EOA's original key still authorizes | **Confirmed on Sepolia (E5)**: the original key decrypted after 7702 delegation to a reject-all wallet. The path is ECDSA-only. | ecrecover first, ERC-1271 only on a mismatch. Main's crate accepts the live delegated account's key. | **Confirmed** | `0x69cad7…87ea` (58,456 gas); `lib.rs:203-210`; `E5/raw/sepolia/zama-verify-check.json` [M/V] | ERC-1271 was added for Safe (RFC-012). 7702 and PQ were not considered. |
| **B6** No PQ verifier fits under the 250k ERC-1271 cap | **n/a, gap wider**: no ERC-1271 at all; the relayer rejects any non-65-byte signature (E4.6, HTTP 400) | 250k cap at three layers. ML-DSA-44 needs a 1.31M `gas_limit`. At 250k it fails (`EmptyRevert`/`Transport`) and is retried, never accepted. | **Confirmed on main**; the live cap value can't be observed | `config.rs:274-276`; relayer `settings.rs:734-738`; SDK `verifyErc1271UserDecrypt-p.ts:28`; E4 [V/M] | The cap is a deliberate DoS bound, sized for a nested Safe. Excluding PQ accounts was not considered. |
| **B7** KMS ML-DSA signatures are not consumed end to end | KMSVerifier v0.3.0 and the gateway verify ECDSA only. The connector has no `signing_schemes` field, so the KMS defaults to ECDSA. | The connector requests `[Ecdsa256k1]` and drops other schemes. relayer-http and the SDK require 65-byte shares. | **Confirmed**; refs R8 and R9 need fixing | main `decryption.rs:613-614, 627-628`; `kms_response.rs:243-256`; `kms_aggregator/flows/mod.rs:50-62`; `RelayerUserDecryptSucceeded.ts:66-70`; `KMSVerifier.sol:416-419` (v0.13.8 `:411-412`) [V] | Deliberate; on Zama's roadmap |
| **B8** (new) Governance can rewrite every authorization layer, with all-ECDSA links and no timelock | ACL owners: on Sepolia a DAO run by a 3-of-5 EOA multisig; on mainnet a DAO run by a 3-of-6 or a 9-of-17 multisig. Gateway testnet: a 3-of-5 Safe plus a LayerZero path. No timelock. A gateway upgrade alone could drop the user-signature check [I]. | Same upgrade surfaces (UUPS) | **Confirmed** (new) | `ACL.sol:674` (v0.13.8 `:591`); v0.13.8 `Decryption.sol:906`; host note §B8 on-chain reads [V] | The governance design is deliberate. Leaving it out of the doc's threat model is the doc's oversight. |
| **F1** Fhenix shares B1/B3 and a B2 variant; check its 1271 cap | Fhenix testnets run master's logic | cofhe-contracts @ b5c20ed | **Partially true**: B1, B3 and a stronger B2 variant are confirmed; B5 as worded is refuted; B6 does not carry over | `cofhe/ACL.sol:160-213, 364-366`; `TaskManager.sol:947-971`; `Permissioned.sol:57-61, 164-194`; probes A–F and D1/D2 [V/M] | Deliberate and documented; the key-compromise lifecycle is not addressed |

---

## 3. Findings in detail

### B1. No user-callable revocation; deny list owner-only and outside the decryption path

**Verdict: Confirmed, and stronger than stated. Deployed and main behave the same.** [V]

Every user-callable ACL function only adds rights: `allow`, `allowForDecryption`, `allowTransient`, `delegateForUserDecryption` and `multicall`. None clears `persistedAllowedPairs[h][self]` or puts the caller on the deny list.

*Note (Phase 5, P0.1, 2026-10-22): "only adds rights" is too strong; the two exceptions follow below. The current
statement of what an account can and cannot remove is `results/phase5/P0_1_USER_SURFACE.md`.*

A user can revoke only two things:
- `revokeDelegationForUserDecryption`, which removes a delegation the user granted;
- on main only, `invalidateDecryptionSignaturesBefore`, which acts on permits, not on the key (B2).

`blockAccount` and `unblockAccount` are `onlyOwner` (main `ACL.sol:601-621`; v0.13.8 `:518`, `:531`).

**Where the deny list is checked.** Both main and v0.13.8 were searched repo-wide.
- It is checked only in `allow`, `allowForDecryption` and `allowTransient`, and only against `msg.sender`: main `:231, :254, :297`; v0.13.8 `:207, :230, :255`.
- It is not checked for:
  - the recipient `account` of `allow`;
  - `delegateForUserDecryption` (main `:326-377`);
  - `isAllowed` (`:517-519`) or `isHandleDelegatedForUserDecryption` (`:561-574`);
  - the connector, which reads only `isAllowed`, `isAllowedForDecryption`, `isHandleDelegatedForUserDecryption` and `decryptionSignatureInvalidatedBefore` (`kms-connector/crates/kms-worker/src/core/event_processor/rpc.rs:24-67`);
  - the legacy relayer (`relayer/src/host/acl_checker.rs`);
  - relayer-http, which does no ACL checks (`relayer-http/CLAUDE.md:13`);
  - the gateway and the SDK.
- The coprocessor logs `BlockedAccount` and `UnblockedAccount` as unhandled events (`coprocessor/fhevm-engine/host-listener/src/database/tfhe_event_propagate.rs:1960-1969`).
- `FHE.isAccountDenied` is an opt-in helper for dApps (`library-solidity/lib/FHE.sol:8164`).

So a deny-listed account can still receive `allow`, delegate and user-decrypt.

**Docs/code mismatch.** `docs/solidity-guides/acl/README.md:65` says denied accounts cannot grant **or receive** new permissions. The code never checks the recipient.

**Deliberate vs oversight.**
- Permanent allowances are documented (`acl/README.md:20-32`) and apps need them: deliberate.
- No way to retire an address, and a deny list that covers only propagation: lifecycle oversights.
- The README sentence: a documentation bug.

Not executed on Sepolia, because `blockAccount` is governance-only.

### B2. Invalidation works against permits, not keys

**Verdict: Confirmed on main, in code and by Zama's own tests. The consequence should be narrowed to EOAs and 7702-delegated EOAs. n/a on deployed: no invalidation exists there, so E2 could not test it.**

**Main** [V]:
- `inner_signature_invalidation_check` (`kms-connector/crates/kms-worker/src/core/event_processor/decryption.rs:520-542`) rejects irrecoverably iff `start_timestamp < invalidation_ts` (line 531).
  - It runs on the legacy path (`:221-229`) and the unified path (`:409-413`).
  - Values are compared as U256 (`rpc.rs:58-67`).
- `startTimestamp` is a field of the signed EIP-712 struct (legacy main `Decryption.sol:57-68`; unified `shared/user-decryption-signature/src/lib.rs:30-37`).
  - The SDK rounds V2 starts down to the minute.
  - Its comment names a future-dated start as a way to bypass invalidation (`sdk/js-sdk/src/core/kms/SignedDecryptionPermitV2-p.ts:321-324`).
- `invalidateDecryptionSignaturesBefore` (`host-contracts/contracts/ACL.sol:273-285`):
  - a value of 0 resolves to `block.timestamp`;
  - it reverts `InvalidationTimestampTooLow` unless the value strictly increases (`:276-278`);
  - it reverts `InvalidationTimestampInTheFuture` for future values (`:279-281`).
- So a key holder can always sign a permit with `invalidatedBefore ≤ start ≤ now`. Zama's e2e test "accepts a request signed at/after the invalidation timestamp" shows exactly that (`test-suite/e2e/test/decryptionSignatureInvalidation/decryptionSignatureInvalidation.ts:271-319`).

**Edge cases** [V unless marked]

- **`startTimestamp == invalidatedBefore` passes.** This is deliberate and pinned in several places:
  - unit test `direct_boundary_passes` (`decryption.rs:1012`);
  - unit test `boundary_passes` (`:1233-1240`);
  - the e2e case that signs exactly at the threshold (`decryptionSignatureInvalidation.ts:298`);
  - the ACL docstring, which calls the value the oldest timestamp that remains valid (`ACL.sol:271`).
- **Where `startTimestamp ≤ now` is enforced:**

  | Layer | Enforced? | Where |
  |---|---|---|
  | Gateway, legacy (P1/P1d) | yes, reverts `StartTimestampInFuture` | main `Decryption.sol:1275`; v0.13.8 `:1184` |
  | Gateway, unified (P2) | yes | main `:1299` |
  | Connector worker, unified (P2/P3) | yes, but as a **recoverable** error, retried until the window opens | `decryption.rs:344-352` |
  | Connector worker, legacy | no check of its own; relies on the gateway | `decryption.rs:120-233` |
  | Connector HTTP endpoint (P3) | range only, `[0, i64::MAX]` | `kms-connector/crates/endpoint/src/core/validation.rs:21-22, 107-130` |
  | Legacy relayer (v2, v3) | yes | Seen on Sepolia: HTTP 400 "Timestamp must not be in the future" (E2.7b) [M] |
  | relayer-http (P3) | yes | `relayer-http/crates/relayer-http/src/endpoint/flows/user_decrypt.rs:107` |
  | SDK | yes, client side only | `SignedDecryptionPermitV2-p.ts:345-370`. Seen: the SDK refused locally (E2.7a) [M] |

- **Delegated requests.** The invalidation read uses the delegate's address (the signer), never the delegator's.
  - Unified: `decryption.rs:409-413`.
  - Legacy: the gateway puts the delegate in the `userAddress` field (main `Decryption.sol:604-610`).
  - The delegator's own tool is `revokeDelegationForUserDecryption`.
- **Duration limits.**
  - Gateway: ≤ 365 days (main `Decryption.sol:129, 135`; v0.13.8 `:127`, checked at `:1176`).
  - Connector HTTP endpoint: ≤ 365 days (`validation.rs:24-26`).
  - Connector worker: does not re-check the maximum.
  - relayer-http: no maximum.
  - SDK V2: only warns above 7 days (`SignedDecryptionPermitV2-p.ts:280-288`).
- **The C1 sentinel `2^256−1`** rejects every start on both of main's connector paths with no code change.
  - A start equal to `2^256−1` cannot reach the check on any enforcing path:
    - the gateway reverts it;
    - the HTTP endpoint caps starts at `i64::MAX`;
    - the worker treats it as not yet valid.
  - The ACL's monotonic rule makes the sentinel irreversible through the ACL.
  - Caveats:
    - invalidation is per host-chain ACL;
    - the sentinel also kills ERC-1271 and PQ permits for that address;
    - **deployed-era connectors never read invalidation** (v0.13.8, and the v0.14.2 legacy path), so the sentinel would have no effect on today's live path.

**Deployed: E2 on Sepolia** (2026-10-20 22:36, ALICE, our token) [M]

| Step | Result |
|---|---|
| E2.2: ALICE's permit P1 decrypts her balance | 21000 in 7.8 s |
| E2.3: does the ACL have `invalidateDecryptionSignaturesBefore`? | No. Selector `0x9718b695` is absent; `staticCall`, `estimateGas` and the getter all revert. No transaction was sent. |
| E2.5: a later permit P2 | 21000 in 2.5 s |
| E2.7: start = now + 3600 | Refused by the SDK. Sent raw, the relayer answered HTTP 400. |
| E2.8: P1 again at the end | 21000 in 2.5 s |

On Sepolia a user cannot revoke a signed permit before it expires. That is weaker than what B2 assumes.

**Deliberate vs oversight.**
- Against leaked permits, the mechanism is deliberate and correct.
- Against a leaked key, the outcome depends on the account type:
  - **Smart accounts** rotate their signer and then invalidate. Zama's e2e names this rotation as the scenario that motivates the mechanism (`decryptionSignatureInvalidation.ts:92`; test at `:355-413`).
  - **EOAs** cannot rotate their key.
  - **7702 EOAs** keep their root key (B5).
- The doc's "oversight" label should become "deliberately scoped to permits; there is no key-retirement path for EOAs".

**Pending:** an end-to-end B2 run on a local main stack (E6).

### B3. A holder can re-grant or publish history in one transaction

**Verdict: Confirmed on Sepolia and in code, on both deployed and main. Broader than stated.**

**Sepolia, E3** (2026-10-20 22:37–22:38) [M]. Token `0x1F32d758A0bB5F92D90fe35BF5D3E29756D06086`; ALICE's balance handle `0xad6959c5…0500`.

| Step | Tx (block) | Gas | Result |
|---|---|---|---|
| Before | — | — | `persistAllowed`: BOB false, ALICE true, token true |
| ALICE `ACL.allow(balance, BOB)` | `0x6c815311a408fb0fff2d9558368a09bbde40d80d231cb521d0f9a3309ec12863` (11958309) | 140,780 | BOB, with his own permit, user-decrypted **21000** (12.6 s) |
| ALICE `ACL.multicall` of 2, 5 and 10 `allow`s | `0x924990fb…9b22`, `0xb4cb23b4…763c`, `0x2ece7d92…6795` | 263,879; 621,483; 1,217,488 | The grants took effect: `msg.sender` is preserved |
| ALICE `ACL.allowForDecryption([balance])` | `0x9253b97b8f754b60bf202e2c3fc75bf6353798c3a8d3b7653a5b02bba9be1cea` (11958316) | 141,493 | Anyone public-decrypted **21000** with no permit (2.6 s) |

No grantee consent was needed, and the token contract played no part.

**Code** [V]:
- `allow` requires that `msg.sender` is not denied, that `isAllowed(h, msg.sender)` holds, and `whenNotPaused` (main `ACL.sol:230-240`; v0.13.8 `:206-215`).
- `allowForDecryption(bytes32[])` is batched natively (main `:248-267`; v0.13.8 `:224-243`).
- **Batching already exists.** The ACL inherits `MulticallUpgradeable` (main `:5, :27`; v0.13.8 `:5, :26`). `multicall` delegatecalls the ACL itself, so `msg.sender` is preserved. C2's `allowMany` therefore exists in practice, for a user and for a key thief alike.
- **Wildcard delegation, the cheapest path (not in the doc).**
  - One call does it: `delegateForUserDecryption(attacker, WILDCARD_DELEGATION_ADDRESS, type(uint64).max)`.
  - It costs O(1) gas, has no deny-list check and has no maximum expiry (main `:326-377`). The library's `FHE.delegateUserDecryptionWithoutExpiration` uses `type(uint64).max` (`library-solidity/lib/FHE.sol:8244-8245`).
  - It covers all past and future handles on which both the delegator and the app contract are persistently allowed (`isHandleDelegatedForUserDecryption`: main `:561-574`; v0.13.8 `:478-490`).
  - The delegate then signs with its own key, and the gateway checks only the delegate's signature (v0.13.8 `Decryption.sol:937-949`).
  - The victim can revoke, but the same stolen key can re-delegate to fresh addresses. The ACL allows one change per (delegator, delegate, contract) per block (main `:337-339`; v0.13.8 `:294-296`).
  - The wildcard exists on the deployed ACL (V0 probe). Not executed on Sepolia.
- **Paused ACL, deployed only.** On v0.13.8, `revokeDelegationForUserDecryption` is `whenNotPaused` (`:342`), but the delegation views are not pause-gated. During a pause, existing delegations keep working and cannot be revoked. Main allows revocation while paused (#4377, 2026-10-09; main `:386`).
- `delegateForUserDecryption` reverts when:
  - the delegate or the contract is the sender;
  - the delegate is the wildcard;
  - the delegate equals the contract;
  - the expiry is ≤ now or unchanged;
  - the same triple already changed in this block (main `:337-361`).

  It does not check the deny list, whether the delegate is a contract, or whether the delegator holds any handle.
- **`allowTransient`** grants nothing for decryption: the connector's `isAllowed` `eth_call` sees empty transient storage. It is a same-transaction stepping stone and adds nothing beyond `allow` (main `:295-314`).
- **Confused deputy (not in the doc).** dApps grant access using their own ACL rights after checking `FHE.isAllowed(h, msg.sender)`.
  - OpenZeppelin's `ERC7984.requestDiscloseEncryptedAmount` checks only that, then calls `FHE.makePubliclyDecryptable`.
    - It is at `ERC7984.sol:199-207` in `@openzeppelin/confidential-contracts` 0.5.3, which our Sepolia token inherits.
    - It is at `:202-209` on OZ master `23ba154023`.
  - `confidentialTransfer(to, amount)` also accepts any handle the sender is allowed on (0.5.3 `:121-122`).
  - So the old key can publish any amount handle it can read through the token, without ever calling the ACL.
  - Not executed on Sepolia. [V for the code; I for deny-listed callers]
- **Consequence for C1** [I]. A seal implemented as `notSealed` on the ACL's write functions does not close the on-chain door. The seal must make `isAllowed`/`persistAllowed` return false for the sealed account. That also blocks the deputies and the connector's direct checks on every version. Delegation also needs explicit checks.

**Deliberate vs oversight.** Transitive `allow` is deliberate and documented. The missing user-side lifecycle, and dApp deputies acting on users' ACL rights, look like oversights.

### B4. The off-chain check ignores on-chain account state

**Verdict: Confirmed, from code.** There is nothing to freeze on Sepolia, so this is argued, not run.

**Main, unified paths** [V]:
- `verify_signature` (`shared/user-decryption-signature/src/lib.rs:188-211`) returns Ok when a 65-byte signature recovers the claimed signer (`:203-208`).
- Recovery is alloy's local `recover_address_from_prehash` (`:99-107`), with no RPC.
- The unit test `eoa_valid_signature_zero_rpc` (`:281-294`) asserts that no RPC is made.
- No code, nonce or other account-state read exists anywhere in the signature path: the shared crate, the kms-worker event processor and the relayer precheck.
- The ERC-1271 branch infers "no code" from empty returndata (`:113-117, :161-167`).

**Measured** (E5.6, 2026-10-20 22:42) [M]: against the live 7702-delegated EVE7702 account, main's crate accepted the original-key permit in 0.26 ms with no RPC call.

**Deployed, P1/P1d** [V]:
- The check is `ECDSA.recover` inside the gateway contract (v0.13.8 `Decryption.sol:916-925, 937-949`; main legacy `:957-968, :980-994`).
- That precompile runs on gateway chain 10901, whose state for the user's address is unrelated to the host chain.
- An L1 freeze, or an EIP-7851/8151 key deactivation, would not reach it [I].

**Doc nuance.** "Rust ecrecover in the connector" describes the unified path only. On the live path the check is an EVM `ECDSA.recover` on the gateway chain. Both ignore host-chain account state.

**Deliberate vs oversight.**
- The zero-RPC EOA fast path is a deliberate optimization: see the docstring at `lib.rs:188-195` and the SDK port at `verifyErc1271UserDecrypt-p.ts:92`.
- That it bypasses any future account-level PQ freeze looks unconsidered: nothing in this code mentions quantum risk, 7702 or 7851 [I].

### B5. A 7702-delegated EOA's original key still authorizes decryption

**Verdict: Confirmed on Sepolia (deployed path), and against main's code with a live account.**

**Sepolia, E5** (2026-10-20 22:38) [M]

| Step | Evidence | Result |
|---|---|---|
| Mint 7702 FALT to EVE7702 `0x40ac0b2E205dB6a27B5A2170E1584408c144Fee5` | `0x9945aab2b4981ca9c641f7de389f9954e564046f866f64a977ff0e8705a61b62`, 872,232 gas | — |
| E5.1: EVE, still a plain EOA, user-decrypts | relayer `/v2/user-decrypt` | **7702** (7.0 s) |
| E5.2: self-sponsored type-4 tx delegating to `RejectAll1271Wallet` `0xb01bAD1A68f29A844d5785AdB6bD829E70FCe564` | `0x69cad73edb11c3039259ed773ee19ae5119611954342b6c560e8609b269c87ea` (block 11958318), **58,456 gas**; account code becomes `0xef0100b01bad…e564` | delegated |
| E5.3: the account's own `isValidSignature(digest, EVE's ECDSA signature)` | `eth_call` | `0xffffffff` (reject) |
| E5.4: EVE signs a new permit with her original key | relayer `/v2/user-decrypt` | **7702** (2.8 s). B5 holds on Sepolia. |
| E5.5: empty signature, i.e. the ERC-1271 path | raw POST | HTTP 400 "Must be 130 characters long". The live path accepts only 65-byte ECDSA. |
| E5.6: main's `verify_signature` against the live account | `udsig-harness` | Original key: accepted in 0.26 ms, no RPC. Empty or unrelated-key signature: `WrongMagic(0xffffffff)`. |

A local anvil replica under Osaka rules gave the same verdicts; its delegation tx cost 37,160 gas (`E5/raw/local/summary.json`).

**Code** [V]:
- ecrecover runs first (`lib.rs:203-208`). ERC-1271 runs only for an empty, unparsable, non-65-byte or mismatching signature (`:210`).
- No decryption path handles 7702 or 8151. The only `0xef0100` match in the repo is a load-test tool (`sdk/cli-js-sdk/packages/load-test/src/pool/handles.ts:378-390`).
- The relayer precheck and the SDK precheck are also ecrecover-first (`relayer/src/host/signature_prechecker.rs:122-128`; `verifyErc1271UserDecrypt-p.ts:92-111`).
- The deployed path has no ERC-1271 at all: the gateway calls `ECDSA.recover` and reverts when `signer != userAddress`.

**Edge cases** [I]:
- **C3 as written would not change this today.** A 7702 account's code is exactly the 23-byte delegation indicator, so the rule "accept ecrecover only if the code is empty or a 7702 indicator" still accepts the root key. The rule bites only with a 7851-style deactivation marker or an explicit per-account opt-out. Asking ERC-1271 first does not help either: typical 7702 wallets accept the EOA's own key in `isValidSignature`.
- **Fhenix contrast.** Fhenix checks code first (OZ ≥ 5.1 `SignatureChecker`), so B5 as worded is refuted there (F1). The key can still re-delegate or clear the delegation.

**Deliberate vs oversight.**
- ERC-1271 support was added for Safe and multisig accounts (RFC-012); the config and tests reference Safe throughout.
- 7702 and PQ were not considered: an oversight.
- "Small fix" holds for a code check, but closing the gap for 7702 users needs an extra signal.

EVE7702 remains delegated to `RejectAll1271Wallet` on Sepolia.

### B6. PQ smart accounts and the 250,000-gas ERC-1271 cap

**Verdict: Confirmed on main, in code and by measurement.**
- **On deployed the gap is wider.** There is no ERC-1271 path, and the relayer rejects any non-65-byte signature. A PQ account cannot authorize at any gas.
- **The cap configured on Sepolia's connector cannot be observed.**

**The cap lives in three places, all 250,000** [V]

| Layer | Setting | Default | Override |
|---|---|---|---|
| kms-connector kms-worker (authoritative on P2/P3) | `erc1271_gas_limit` (`kms-worker/src/core/config.rs:138-141`; default `:274-276`) | 250,000 | env `KMS_CONNECTOR_ERC1271_GAS_LIMIT` (`kms-connector/config/kms-worker.toml:109-114`) |
| Legacy relayer precheck (v3 only) | `user_decrypt_signature_check.erc1271_gas_limit` (`relayer/src/config/settings.rs:734-738`). **Required, no default.** | 250,000 in every example config | env `APP_USER_DECRYPT_SIGNATURE_CHECK__ERC1271_GAS_LIMIT` |
| SDK precheck | `ERC1271_GAS_LIMIT = 250_000n` (`sdk/js-sdk/src/core/utils-p/decrypt/verifyErc1271UserDecrypt-p.ts:28`). **Hard-coded.** | 250,000 | needs an SDK release |

Other copies and settings:
- The e2e harness has a fourth copy (`test-suite/e2e/test/erc1271UserDecryption/safe.ts:93`).
- The relayer template asks to keep all the layers equal (`test-suite/fhevm/templates/config/relayer.yaml:14-18`).
- The Helm chart sets no override.
- relayer-http does no signature check.

**How the cap applies** [V]. `check_erc1271_signature` (`lib.rs:123-186`) sends an `eth_call` with `gas = erc1271_gas_limit`. The cap therefore covers intrinsic gas, calldata and execution. The call is accepted iff the returndata starts with `0x1626ba7e`.

**Out of gas is retried, never accepted** [V for the code; M for the behaviour]
- On anvil, the failed call returns empty revert data. That maps to `Erc1271Error::EmptyRevert`, a recoverable `UserSignatureRejected`.
- On live Sepolia, the node returns `{"code":3,"message":"execution reverted"}` with no `data` field. That maps to `Transport`, a transient network error (`kms-worker/.../error.rs:101-114`). The node is reth/v2.7.0 behind publicnode; this was observed by E4 `rpc-error-shape` at 2026-10-20 22:43.
- Both are retried up to `max_decryption_attempts` (default 20, `config.rs:228-230`) or until the validity window ends.
- On v3, the legacy relayer rejects first: a persistent `EmptyRevert` becomes HTTP 400 and a persistent `Transport` HTTP 500 (`signature_prechecker.rs:79-171`).

**E4 setup** [M]
- Verifier: Fireblocks ML-DSA-44, unaudited.
- Account: `MLDSA44Account1271`, which has no ECDSA owner.
- Signatures: real, over real permit digests. The local digest is the RFC-016 digest computed by Zama's own `compute_user_decrypt_digest`.

**E4 results** (full table in §5.2) [M]
- `isValidSignature` itself costs about 1.23M gas.
- The smallest `gas_limit` that Zama's unmodified verifier accepts is 1,309,193 on live Sepolia (5.24× the cap) and 1,311,669–1,313,408 locally.
- At 250,000 it fails: `Transport` on Sepolia, `EmptyRevert` locally. At 5,000,000 it passes.

**Deployed, E4.6** [M]
- A raw `POST /v2/user-decrypt` for the PQ account with its 2,420-byte signature returned HTTP 400 `validation_failed`, field `signature`, "Must be 130 characters long" (request id `122ae62e-9b0b-4355-b02c-a3394979a2fc`).
- `/v3/user-decrypt` returned 404.
- The only way for a contract account on the live path is to delegate to an ECDSA EOA, which brings ECDSA back [I].

**Not shown**
- Sepolia's configured connector cap: no testnet path reaches it.
- An end-to-end PQ decryption.
- A second verifier: ETHFALCON and ETHDILITHIUM were cloned but not run.
- The doc's other verifier figures (0.65–3.9M) remain published figures, not measured here.

**Deliberate vs oversight.** The cap is a deliberate DoS bound, sized for a nested Safe (about 91k gas) plus headroom (`kms-worker.toml:110-112`). Excluding PQ wallets is most likely an unconsidered side effect [I].

### B7. KMS ML-DSA signatures are not consumed end to end

**Verdict: Confirmed.** Two references in the doc need fixing (§6).

**Connector, main** [V]
- It requests only ECDSA: `signing_schemes: vec![SigningSchemeType::Ecdsa256k1 as i32]` for user and public decryption (`decryption.rs:613-614, 627-628`).
- `ecdsa_signature()` keeps only the ECDSA entry, or the legacy `external_signature` (`kms-connector/crates/utils/src/types/kms_response.rs:243-256`).
- **The `signing_schemes` field exists only in fhevm v0.15.0-0 … v0.15.0-3 and main.** It is absent in v0.13.8 (local blob) and v0.14.2 (fetched at the tag).
- On those older versions the KMS resolves an empty scheme list to ECDSA (`kms/core/service/src/cryptography/signing/mod.rs:188-198`).

**relayer-http** [V]: `check_signature` rejects KMS share signatures that are not 65 bytes. It checks only length and duplicates (`relayer-http/crates/relayer-http/src/kms_aggregator/flows/mod.rs:50-62`).

**SDK** [V]
- The 65-byte requirement on KMS shares is in `sdk/js-sdk/src/core/modules/relayer/module/guards/RelayerUserDecryptSucceeded.ts:66-70`.
- Signature recovery also requires 65 bytes (`src/core/base/sign.ts:46`).
- `sign.ts:15`, the doc's R9 reference, checks the SDK's own `sign()` output instead.

**On-chain** [V]
- `KMSVerifier._recoverSigner` is `ECDSA.recover` (main `:416-419`; deployed v0.3.0 `:411-412`), with a fixed `1 + 65·n` proof layout.
- The gateway verifies KMS responses with `ECDSA.recover` (main `Decryption.sol:925`; v0.13.8 `:888`).
- No `isValidSignature` call or PQ verifier exists in the host or gateway contracts at main.

**KMS** [V]
- `kms/core/service/src/cryptography/signing/mldsa.rs` implements ML-DSA-44/65/87.
  - It signs `dsep || msg`, with an 8-byte domain separator.
  - It is present at kms tags v0.15.0-0 (2026-09-14), v0.15.0-1 (2026-10-03) and main, and absent at v0.14.2.
- The crate is `ml-dsa =0.1.1`. Zama's own `kms/Cargo.toml:175` flags it as medium risk with no security audit.
- The KMS still emits the deprecated ECDSA `external_signature` until 0.16 (`kms/core/service/src/engine/base.rs:494-520`).

**The `chore/pq-tls-handshake` branch** [V]
- It is a single commit, `3516d8f2` (2026-10-05), not in kms main (`merge-base --is-ancestor` returns false).
- It forces a hybrid `X25519MLKEM768` / `SECP256R1MLKEM768` key exchange for KMS core-to-core (MPC) mTLS only. Certificates stay classical.
- It does not touch connector↔core, relayer↔connector or any user path.

**Deliberate vs oversight.** Deliberate, and on Zama's roadmap (dual signing, retiring `external_signature`, PQ TLS). It is out of scope for Retire & Carry, as the doc says.

### B8 (new). Governance can rewrite every authorization layer

**Claim:** every authorization layer (host ACL, KMSVerifier, ProtocolConfig, gateway Decryption) can be upgraded by ECDSA-rooted governance with no timelock. Governance can therefore override any per-user seal (C1) or flag (C5).

**Verdict: Confirmed.** [V for code and on-chain reads, from host note §B8; I where marked]

**Who can upgrade** [V]
- ACL: UUPS with `_authorizeUpgrade … onlyOwner` (main `ACL.sol:674`; v0.13.8 `:591`), plus `Ownable2Step`.
- KMSVerifier, InputVerifier, ProtocolConfig, FHEVMExecutor, HCULimit and KMSGeneration: `onlyACLOwner`, meaning `msg.sender == ACL.owner()` (`ACLOwnable.sol:20-29`).
- Deployed ProtocolConfig v0.1.0: `defineNewKmsContext` is `onlyACLOwner` with no committee confirmation (`:139-142`). Main adds quorums from the previous and the new committee (`:131-232`).
- Gateway contracts: `onlyGatewayOwner`, i.e. `GatewayConfig.owner()`. `Decryption._authorizeUpgrade` is at v0.13.8 `:906`.
- The intended process: the DAO executes the printed `upgradeToAndCall` payload (`host-contracts/README.md:190`).

**Who holds that power** (read 2026-10-20) [V, on-chain]

| Chain | Owner | Who executes | Timelock |
|---|---|---|---|
| Sepolia ACL (`owner()` `0x08e8…4f52`) | Aragon OSx DAO 1.4.0 | One Multisig plugin `0x6d5521b3…6f9a`: **3-of-5**, all EOAs, unconditional `EXECUTE_PERMISSION` | none |
| Mainnet ACL (`owner()` `0xB6D6…1Ef3`) | Aragon OSx DAO 1.4.0 | Two Multisig plugins, **either suffices**: `0xbc860b6a…a38f`, **3-of-6** EOAs; `0xe43c73aa…e66f`, **9-of-17** (12 EOAs, 4 Safes with EOA owners, 1 Aragon DAO) | none |
| Gateway testnet 10901 (`GatewayConfig.owner()`) | Safe v1.4.1 `0x3241…D9c9`: **3-of-5** EOAs, no guard | The Safe directly, or LayerZero: the Sepolia DAO's `GovernanceOAppSender` → `GovernanceOAppReceiver` → `AdminModule` (1 required DVN, quorum 2 of 3) | none |
| Mainnet gateway 261131 | pending: private RPC | | |

Aragon's `Multisig.sol` executes on the final approval, and `startDate = 0` means "now" (`:322-326, :441-445, :597-617`). Three ECDSA keys can therefore upgrade the mainnet ACL in about one block [V/I]. Every link is ECDSA: EOA approvals, Safe EOA owners, and secp256k1 DVN attestations [I for the DVN's scheme; its contract is unverified].

**Consequences** [I]
- An ACL upgrade can clear or ignore `sealed[x]` and `decryptionSignatureInvalidatedBefore[x]`, or simply make `isAllowed(h, anyone)` true.
- A C5 flag stored in the ACL or ProtocolConfig is set and unset by the same governance.
- No per-user seal survives a governance compromise.
- **On the deployed path the gateway alone suffices.**
  - The v0.13.8 connector does not re-verify the user signature; it reads only `isAllowed` and `isHandleDelegatedForUserDecryption` (verified in the local blob).
  - The KMS core validates only the request structure (`kms/core/service/src/engine/validation_non_wasm.rs:222-225`).
  - So whoever can upgrade `Decryption` can drop the check at v0.13.8 `:916-925`.
  - On main's RFC-016 path the connector re-verifies, so a host ACL upgrade would also be needed.
- Under T2, every governance key has an exposed public key, because each one sent approval transactions. Governance is the largest single Q-day target.

**Mitigation ideas recorded for Phase 2** (host note §B8)
- An immutable seal registry, read by connectors at an operator-pinned address.
- Connector-side implementation pinning: an allowlist of ERC-1967 implementation slots or code hashes, failing closed on unannounced upgrades.
- An upgrade timelock with an exit window.
- C5 as a one-way latch in a non-upgradeable contract.
- PQ governance before Q-day.

**Fhenix analog** (F1)
- TaskManager, ACL, PlaintextsStorage and ACPShareRegistry are UUPS behind `UPGRADER_ROLE`. CoFHEAddressBook is `onlyOwner`. There is no upgrade timelock.
- On all three testnets, one EOA (`0x6578…53DB`) holds every admin and upgrader role, and `defaultAdminDelay` is 1 s [M].
- Mainnet: a Safe, according to the runbook [I; not read on-chain].

**Deliberate vs oversight.** The governance design is deliberate. Its absence from the doc's threat model is an oversight in the doc.

### F1. Fhenix CoFHE

**Brief claim:** Fhenix shares B1/B3 and a variant of B2; check its gas cap for EIP-1271 permits.

**Verdict: Partially true.**
- B1, B3 and a stronger B2 variant are confirmed.
- B5 as worded is refuted.
- B6 does not carry over.
- E7 was not run; it was assessed as cheap and safe.

Code is at cofhe-contracts `b5c20ed`. Deployed state [M]:
- The Sepolia ACL's verified source matches master's logic. It differs only in how the TaskManager address is stored.
- The TaskManager and ACL bytecode is identical across Ethereum, Arbitrum and Base Sepolia once the UUPS `__self` immutable is masked.

| Item | Verdict | Evidence |
|---|---|---|
| B3 analog: any holder can `allow` to anyone | **Confirmed** [V] | `TaskManager.sol:947-949`: no modifier, not gated by the kill switch or the access list; `cofhe/ACL.sol:160-171`; Fhenix test `ACLGranting.ts:181-187`; docs `acl.mdx:23`; `CHANGELOG.md:87` |
| B3 analog: making a handle public | **Confirmed, with the verb corrected to `allowGlobal`** (`FHE.allowPublic`; `TaskManager.sol:951-953`; `ACL.sol:179-191`). `allowForDecryption` (`TaskManager.sol:967-971`; `ACL.sol:197-213`) can be called but is **inert**: nothing on the decryption path reads its flag. | teecryptor `src/permit.rs:633-665`, `src/http.rs:1060-1069` [V] |
| "One transaction" | There is no batch `allow`, so an EOA needs one transaction per handle; 7702 batching is possible [I]. But a key holder does not need the chain: a global or sharing ACP decrypts everything off-chain. | — |
| B1 analog: allowances are never revoked | **Confirmed.** The comment is at `cofhe/ACL.sol:364-366` (in `receiveCtHash`), not in `TaskManager.sol:947-971` or `ACL.sol:160-211`. `isAllowed` = transient OR persistent OR global (`:447-449`). Nothing clears them. | grep [V] |
| B2 variant | **Confirmed, and stronger.** The revoker fields are optional and chosen by the signer (`Permissioned.sol:57-61, 186-194`; signed structs `:216-255`). The default `ACPTimestampRevoker.revokeAllExisting` only looks backwards (`:55-63`). **Expiry has no upper bound** (`:164-165`); cofhejs defaulted to about the year 33,658. **Sharing ACPs** let the issuer authorize any recipient with no transaction (`:33-47, 176-184`). | [V] |
| User retirement or global deny | **None.** `TaskManager.setDenyList` blocks task intake only. It is not checked on `allow*`, `isAllowedWithPermission` or `isPubliclyAllowed`. | `TaskManager.sol:368-393, 435-443, 977-979, 1091-1093` [V] |
| B4 analog | **Partially true.** A code-less EOA's ACP is checked by ecrecover inside an `eth_call`, so a transaction freeze does not close it. EVM-level changes (an EIP-8151 ecrecover, code on EOAs) would propagate once the RPC node runs them [I]. | `Permissioned.sol:168-175` [V] |
| B5 analog | **Refuted as worded.** OZ ≥ 5.1 `SignatureChecker` tries ECDSA only if `signer.code.length == 0`; otherwise it uses ERC-1271 only. See the probe list below the table. The risk remains: typical delegates accept the EOA's key, the key can re-delegate or clear the delegation, and the on-chain `allow` door stays open. | [M] Fhenix note §4 |
| B6 analog | **Does not carry over.** OZ `isValidERC1271SignatureNow` staticcalls with all available gas. Teecryptor's `eth_call` sets no `gas` (alloy 1.8.3), so the limit is the operator RPC's `eth_call` cap (not public) plus a 5 s timeout. An `isValidSignature` burning about 4.0M gas was accepted through the public Sepolia RPC with default gas, and rejected when the call was capped at 3,000,000. | [M] probes D1/D2; [E] burn size |
| Who decides | Teecryptor (Intel TDX; the FHE key is rebuilt from 3-of-6 Shamir shares) `eth_call`s `isAllowedWithPermission` or `isPubliclyAllowed` and trusts the boolean answer. `verify_local` is used only in tests. The `threshold-network` dispatcher is not public. | teecryptor `src/permit.rs:13-20, 593-665`; docs `teecryptor.mdx` [V] |

The B5 probes ran against the Sepolia ACL `0x5ACD…1b84` (`checkPermissionValidity`, 2026-10-20 22:09) [M]:
- The signer was a throwaway key, never funded. Account code was injected through state overrides.
- Plain EOA with a valid signature: accepted.
- Reverting code with a valid ECDSA signature: rejected, so ECDSA was not tried.
- `0xef0100‖D`, where D rejects everything: a valid EOA signature is rejected.
- `0xef0100‖D`, where D accepts everything: a garbage signature is accepted.

**Deliberate vs oversight.**
- The ACL transitivity and the revoker design are deliberate and documented in tests, docs, the CHANGELOG and `ACPTimestampRevoker.sol:28-31`.
- The unbounded expiry is undocumented.
- Key compromise and PQ retirement are not addressed: an oversight relative to our threat model.

The E7 plan (not run) is in `fhenix_f1.md` §6: three fresh EOAs on Arbitrum Sepolia, our own contract, and about 15–25 testnet transactions [E].

---

## 4. New findings beyond the design doc

**N1. B1 is stronger than the doc says.**
- The deny list is checked only for `msg.sender`, and only in three ACL write functions.
- It is not checked for recipients, delegation, the views, the connector, the relayers, the gateway or the SDK. The coprocessor ignores the deny-list events.
- A denied account can still receive allowances, delegate and user-decrypt.
- Zama's ACL guide (`docs/solidity-guides/acl/README.md:65`) says denied accounts cannot receive new permissions, but the code never checks the recipient. Details in §B1.

**N2. B3 is broader than the doc says.**
- `ACL.multicall` already batches re-grants into one transaction (measured).
- Wildcard delegation exposes all past and future handles with one O(1) call.
- dApp deputies publish or move values using the token's own ACL rights (OZ ERC-7984 `requestDiscloseEncryptedAmount` and `confidentialTransfer`).
- On the deployed ACL, delegations cannot be revoked while the ACL is paused.
- Consequence: `notSealed` on the ACL's write functions is not enough. Details in §B3.

**N3. B8, governance.**
- ECDSA-rooted multisig governance can upgrade every authorization layer, with no timelock:
  - 3-of-5 on Sepolia;
  - 3-of-6 or 9-of-17 on mainnet;
  - a 3-of-5 Safe plus LayerZero on the gateway testnet.
- On the deployed path, a gateway upgrade alone could remove the user-signature check. Details in §B8.

**N4. Fhenix's user-decryption channel is not post-quantum.**
- Sealoutput uses NaCl `crypto_box` (X25519 + XSalsa20-Poly1305), not ML-KEM (`teecryptor/src/seal.rs:1-7`; `cofhesdk/.../acps/sealing.ts`) [V].
- Fhenix's result and input signatures are secp256k1 (`TaskManager.sol:825-848, 1004-1029`).
- So Fhenix's sealed outputs are exposed to harvest-now-decrypt-later wherever they are recorded [I].
- The brief's premise that "the user-decryption channel is post-quantum" holds for Zama only.
- Fhenix decryption runs in a TEE (Teecryptor), not in a threshold network.

**N5. Stored results are served indefinitely.** [V]
- **Connector HTTP path (P3).**
  - Successful results are served indefinitely, including after the permit's window. They are not rechecked against the ACL, delegation, invalidation or ERC-1271 (`kms-connector/docs/architecture.md:92-94`; `crates/endpoint/src/core/http/decrypt.rs:108-153`).
  - They are available to allow-listed relayers (`crates/proxy/src/core/config.rs:39-40`) that present a byte-identical body. The request id is the EIP-712 hash of the whole body (`crates/api/src/types.rs:79-91`).
- **Gateway paths (P1, P1d, P2).** Shares are emitted in public on-chain `UserDecryptionResponse` events (main `Decryption.sol:748-754`).
- **Legacy relayer.**
  - Results are cached in Postgres, and the expiry worker is disabled by default (`relayer/README.md:203-211`).
  - The dedup key excludes `signature` and `request_validity` (`relayer/src/core/user_decrypt_request.rs:27-63`). An identical request with a fresh signature therefore gets the cached result with no new connector checks. Zama's e2e comments on this (`decryptionSignatureInvalidation.ts:369-372`).
- In-flight requests are re-checked before publication (`processor.rs:64-68`).
- **Implication:** a seal cannot retract shares already produced. Their secrecy rests on the requester's ML-KEM key (N6).

**N6. The ML-KEM transport key is reusable.**
- The SDK lets apps persist the key pair (`serializeTransportKeyPair`) and only *recommends* a fresh pair per session (`sdk/js-sdk/docs/security.md:131-153`).
- One key serves every decryption under a permit that can be valid for up to 365 days.
- Whoever later holds that private key can open every stored or on-chain share made for it.
- The scheme is ML-KEM-512 + AES-256-GCM (`kms/core/service/src/cryptography/hybrid_ml_kem.rs:1-10, 98-122`):
  - the AES key is the first 32 bytes of the KEM shared secret;
  - the nonce is a random 12 bytes;
  - there is no associated data.
- Zama flags `ml-kem =0.3.2` as medium risk, without a completed KMS-specific audit (`kms/Cargo.toml:176`).
- The doc's "one-time ML-KEM key" (§2) is not something the SDK enforces.

**N7. The connector chart's `protocolConfig` points at the KMSVerifier address.** This is an unverified side observation.
- `charts/kms-connector/configs/contracts-testnet.yaml:7` sets `ethereum.protocolConfig` to `0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A`, which is the Sepolia KMSVerifier.
- `contracts-mainnet.yaml:7` sets it to `0x77627828a55156b04Ac0DC0eb30467f1a552BB03`, which is the mainnet KMSVerifier.
- Neither is the ProtocolConfig proxy (`0x51f9…ee83` on Sepolia, `0xD823…a7C4` on mainnet).
- It may be intentional or a bug. I did not investigate.

**Smaller observations**
- **N8.** An over-cap ERC-1271 failure is retried, not rejected (§B6). Operators pay for repeated 250k-gas `eth_call`s, and users get no clean error.
- **N9.** The connector discards non-ECDSA KMS signatures, and the gateway checks KMS responses with ECDSA (§B7).
- **N10.** Relayers are not a security gate on the gateway paths, because fee-paying callers can submit directly. relayer-http does no ACL or signature check (`relayer-http/CLAUDE.md:13-14`). The connector, plus the gateway on P1/P1d, is the only authority.
- **N11.** Reads use different block tags: ACL reads use `latest`, while the ERC-1271 `eth_call` uses `pending` (alloy's default) [V for alloy 2.5.0 source; I for the locked 2.2.0].
- **N12.** Sepolia's live gas schedule (Amsterdam-era, reth/v2.7.0) reprices state creation [M]:
  - about 119K gas per new ACL entry;
  - 204,600 gas for an ETH transfer to a fresh account;
  - about 1,559 gas per byte of deployed code.

  This multiplies C2 carry costs and PQ verifier deployment costs (§5).
- **N13.** Fhenix's `allow` and `allowGlobal` emit no event, so a user's handles cannot be listed from logs. A carry would need traces.

---

## 5. Measured numbers

### 5.1 Gas: Sepolia (live) vs Osaka rules (local)

- **Sepolia:** blocks 11958285–11958369, 2026-10-20 22:32–22:49, gas price about 0.001 gwei, our own accounts.
- **Osaka rules:** an anvil 1.8.5 fork of Sepolia (E3 and setup, 22:44) or local anvil (E4 and E5, 22:32–22:45), on the AMD Ryzen 5 5600.

All values are [M] unless labelled.

| Operation | Sepolia (tx) | Osaka rules | Doc |
|---|---|---|---|
| `ACL.allow`, single tx | **140,780** (`0x6c8153…2863`; execution ≈118,908) | 58,348 (fork; execution ≈36,488) | — |
| `ACL.multicall` of 2 / 5 / 10 `allow`s | 263,879 / 621,483 / 1,217,488 (`0x924990…9b22`, `0xb4cb23…763c`, `0x2ece7d…6795`) | 93,215 / 186,411 / 341,876 (fork) | — |
| `allow`, marginal cost per handle inside `multicall` (2 → 10) | **119,201** | **31,083** | 22–27K [E] |
| `allow`, average per handle over 10 | 121,749 | 34,188 | — |
| `ACL.allowForDecryption`, 1 handle | **141,493** (`0x9253b9…1cea`) | 59,073 (fork) | — |
| EIP-7702 delegation tx (1 authorization, self-sponsored) | **58,456** (`0x69cad7…87ea`) | 37,160 (local anvil) | — |
| ERC-7984 token: deploy / first mint / later mint | 14,734,825 / 929,713 / 766,634 | 2,158,639 / 308,273 / 306,634 (fork) | — |
| `RejectAll1271Wallet` deploy | 1,060,519 | 171,651 (fork) | — |
| PQ stack deploy: Keccak helper / ML-DSA-44 verifier / pk blob / account / gas meter | 33,632,238 / 37,233,691 / 31,917,713 / 2,091,761 / 1,429,908 | 4,716,322 / 5,166,161 / 4,434,717 / 317,011 / 223,128 (local) | — |
| Code deposit, gas per byte | 1,558.7 (slope of `eth_estimateGas` over 4/8/12 KiB, block 11958369) | 200 [S] | — |
| ETH transfer to a fresh account | 204,600 (3 funding txs) | 21,000 [S] | — |

"Execution" means `gasUsed − (21,000 + calldata cost)`.

**What changes on Sepolia** [M]
- Block headers carry `blockAccessListHash` and `slotNumber`, transfers emit EIP-7708 logs, the client is reth/v2.7.0, and Osaka is active (the CLZ probe returns 255).
- anvil's `amsterdam` option does not reproduce this state-creation pricing: E4 under that option gave the same deployment gas as Osaka.
- Deployments of 33.6M and 37.2M gas were accepted, so the 2^24 per-transaction cap did not bind them.

**Per-key cost of a PQ account** (computed from the measured rows). The helper and the verifier are shared between keys.
- First ML-DSA-44 account, including its shared helper and verifier: about 104.9M gas on Sepolia, about 14.6M under Osaka rules.
- Each further key, i.e. a pk blob plus an account: about 34.0M on Sepolia, about 4.75M under Osaka rules.

### 5.2 ML-DSA-44 `isValidSignature`, and the cap at which Zama's verifier accepts

- **Verifier:** fireblocks-labs/evm-ml-dsa-verifier `cca262b5` (ML-DSA-44, FIPS 204, MIT, unaudited), compiled unmodified with solc 0.8.30, via-IR, 10,000 runs, evm osaka.
- **Zama check:** `shared/user-decryption-signature` at fhevm `ed851716c`, unmodified, linked into `experiments/udsig-harness` with Zama's `Cargo.lock` (alloy 2.2.0).

All values [M].

| Run (UTC) | `isValidSignature` gas, inner STATICCALL (meter) | Top-level `eth_estimateGas` | Meter at 250,000 | Zama `verify_signature` at 250,000 | At 5,000,000 | Smallest accepted `gas_limit` |
|---|---|---|---|---|---|---|
| Sepolia, live account `0xeAA97EaE…5eB6` (2026-10-20 22:40–22:43) | **1,232,720** | 1,326,329 | out of gas (249,253 used) | rejected, `Transport` (node error code 3, no data) | accepted | **1,309,193** (5.24× the cap) |
| anvil fork of Sepolia, Osaka (22:44) | 1,230,457 | 1,311,669 | out of gas (248,847) | rejected, `EmptyRevert` | accepted | 1,311,669 |
| local anvil, Osaka, run 1 (22:32) | 1,232,110 | 1,313,408 | out of gas (248,847) | rejected, `EmptyRevert` | accepted | 1,313,408 |
| local anvil, Osaka, run 2 (22:45) | 1,231,852 | 1,313,170 | out of gas (248,847) | rejected, `EmptyRevert` | accepted | 1,313,170 |
| local anvil, `amsterdam` option (22:38) | 1,231,424 | 1,312,639 | out of gas (248,847) | rejected, `EmptyRevert` | accepted | 1,312,639 |

- **Two different ratios.** The inner verification, about 1.23M gas, is 4.93× the cap. The `gas_limit` the connector must pass (intrinsic gas, 2,532 calldata bytes and execution) is 1.309–1.313M, which is 5.24–5.25× the cap.
- **Smallest accepted value vs `eth_estimateGas`.** Locally the two are equal. On Sepolia the smallest accepted value is 17,136 gas below `eth_estimateGas`; I did not investigate why.
- **Negative controls:** a tampered digest gives `WrongMagic(0xffffffff)`, and so does an empty signature [M].
- **The doc's published figures**, not measured here:
  - ML-DSA-44 (Fireblocks) about 1.23M: matches the measurement.
  - Falcon (NIST) about 3.9M; ETHFALCON about 1.5M.
  - Best experimental Falcon about 0.65M: still 2.6× the cap.
  - EIP-8051 precompile about 4,500.

### 5.3 Sizes and latencies [M]

| Item | Value |
|---|---|
| ML-DSA-44 signature / public key / prepared pk blob | 2,420 B / 1,312 B / 20,545 B |
| `isValidSignature(bytes32,bytes)` calldata with an ML-DSA-44 signature | 2,532 B |
| ECDSA permit signature accepted by the testnet relayer | exactly 65 B (130 hex characters) |
| Deployed code: Keccak-f1600 helper / ML-DSA-44 verifier | 21,622 B / 23,991 B |
| User decryption via the testnet relayer, SDK end to end | first request per account 7.0–12.6 s; later requests 2.5–2.8 s |
| Public decryption via the testnet relayer | 2.6 s |
| Zama `verify_signature`, EOA fast path (no RPC) | 0.22 ms (local) / 0.26 ms (live account) |
| Zama `verify_signature`, ERC-1271 path against live Sepolia via publicnode | 332–1,382 ms per check. This is dominated by RPC round trips from the workstation and does not represent a connector co-located with its node. |

### 5.4 Estimates (not measured)

- **Carrying 1,000 handles with `multicall`:** about 119M gas under Sepolia's schedule, or about 31M under Osaka rules [E: linear extrapolation of the 2→10 marginal]. Whether that fits in one transaction depends on how the per-transaction cap treats state gas; no large multicall was tried.
- **EIP-7825 cap:** if the 2^24 cap applied to state-creation gas, about 10.6 KB of code could be deployed per transaction on Sepolia [E]. The observed 33–37M-gas deployments show it does not apply that way.
- **`sealAccount`:** the doc's 45–50K gas is still an estimate; E6 will measure it.
- **Campaign cost:** about 0.000132 Sepolia ETH of gas in total [M, from balances].

---

## 6. Corrections to the design doc found in Phase 1

This is a factual list with locations. The full list of doc changes, with suggested text, comes later.

### 6.1 Wrong or version-dependent references

| Doc location | Issue | Correct reference |
|---|---|---|
| §1.3, §11.1, and the Appendix A heading ("main") | Every reference is to main, but Sepolia and mainnet run v0.13.8 (ACL v0.4.0). | Give both the main and the v0.13.8 lines. |
| R2, `ACL.sol` 230 / 248 / 273 / 326 / 561 / 601 | Correct for main. **Line 273, `invalidateDecryptionSignaturesBefore`, does not exist on the deployed ACL.** | Deployed v0.13.8: `allow` 206, `allowForDecryption` 224, `allowTransient` 253, `delegateForUserDecryption` 283, `isHandleDelegatedForUserDecryption` 478, `blockAccount` 518 |
| R2, `KMSVerifier.sol:416` | Correct for main. | Deployed v0.3.0: `:411` |
| R2, `Decryption.sol:129` (365 days) | Correct for main. | v0.13.8 `:127` (checked at `:1176`); main's unified path `:135` |
| R3, "~522" | That is the function header. | The comparison is at `decryption.rs:531` (function `:520-542`). |
| R8, `decryption.rs:614` | The line is right on main, but the field exists only from fhevm v0.15.0-0. It is absent in deployed v0.13.8 and in v0.14.2. | main `:613-614, 627-628` |
| R9, `sdk/js-sdk/src/core/base/sign.ts:15` | That line checks the SDK's own `sign()` output. | `sdk/js-sdk/src/core/modules/relayer/module/guards/RelayerUserDecryptSucceeded.ts:66-70`; for recovery, `sign.ts:46` |
| R6, `config.rs:274` | Correct, but incomplete: the cap also lives in the relayer config and in the SDK. | the table in §B6 |
| R15, `ACL.sol: 160–211` | `allowForDecryption` ends at 213. The "never revoked" comment the doc quotes is at `ACL.sol:364-366`, which is outside this range and not in `TaskManager.sol:947-971`. | `cofhe/ACL.sol:160-213, 364-366, 447-449` |
| R16, `Permissioned.sol` (no lines given) | Missing line numbers. | `Permissioned.sol:57-61, 164-165, 168-194, 216-255`; `ACPTimestampRevoker.sol:55-63` |
| R7, "KMS v0.15" | "v0.15" means the 0.15 pre-releases: kms v0.15.0-0 (2026-09-14) and v0.15.0-1 (2026-10-03). The PQ-TLS branch is one unmerged commit, `3516d8f2`. | — |

### 6.2 Claims to narrow or correct

1. **§2 step 3, B4 and B5 describe a single path.** On the live path, the gateway chain verifies the user signature with `ECDSA.recover`, and there is no ERC-1271. "ecrecover then ERC-1271 in the connector" is true only for main's unified path. B5's "an off-chain library, not the EVM precompile" should read "an off-chain library, or an EVM precompile on the gateway chain; neither sees host-chain account state".
2. **§2 step 1.** The ML-KEM transport key is not one-time: the SDK allows persisting and reusing it (N6).
3. **B1.** Add that the deny list covers no recipients, no delegation, no views and no off-chain component, and that Zama's ACL guide over-claims (N1).
4. **B2.**
   - Narrow it to EOAs and 7702 EOAs. Smart accounts rotate their signer, which is Zama's designed remedy.
   - Add that equality passes, and list where `start ≤ now` is enforced.
   - Replace "oversight" with "deliberately scoped to permits".
   - State that the deployed ACL has no invalidation at all.
5. **B3.** Add `multicall`, wildcard delegation and dApp deputies. The one-transaction claim holds even without `allowMany`.
6. **B6.** The cap sits at three layers. Out of gas is retried, not rejected. The deployed path has no ERC-1271. Sepolia's configured value cannot be observed.
7. **B7.** Add that the connector discards non-ECDSA signatures and that the gateway checks KMS responses with ECDSA.
8. **§4.2, Fhenix.**
   - The publishing verb is `allowGlobal`; `allowForDecryption` is inert.
   - Revocation is opt-in, and expiry is unbounded.
   - Sharing ACPs exist.
   - B5 is refuted, because verification is code-first.
   - There is no fixed 1271 cap: an isValidSignature costing more than 3M gas was accepted through a public RPC.
   - Decryption runs in a TEE.
   - The channel is X25519, not post-quantum.
9. **Summary (Özet), §1.1 and brief §0.** "The user-decryption channel is post-quantum" holds for Zama only.
10. **§3, threat model.** Governance and operator keys are missing (B8).
11. **§7 C1.**
    - "No connector change" holds for main's connector paths, including the equality edge. It does not hold for deployed-era connectors (v0.13.8, and the v0.14.2 legacy path), which never read invalidation.
    - Sealing is per host chain.
    - The sentinel also blocks ERC-1271 and PQ permits for that address.
    - `notSealed` on ACL writes does not stop dApp deputies (B3).
12. **§7 C2.** Batching already exists (`multicall`). The measured cost per handle is 119,201 gas on Sepolia and 31,083 under Osaka rules, not 22–27K.
13. **§7 C3.** The "empty code or 7702 indicator" rule still accepts a 7702 root key today.
14. **§9, cost table.** Replace the `allowMany` and PQ `isValidSignature` estimates with the measurements in §5.
15. **§11 item 7.** Say who can retrieve stored results, and that the legacy relayer's cache ignores the signature and the validity window (N5).

---

## 7. Prompt-injection observations

These agent-directed files are in the clones. All were treated as data, none were followed, and no session was ever rooted in a clone.

| File | Content (paraphrased) | Seen by |
|---|---|---|
| `zama/kms/CLAUDE.md`, `zama/kms/AGENTS.md` | Rules for coding agents, e.g. read AGENTS.md in full before any change | off-chain workstream |
| `zama/fhevm/relayer-http/CLAUDE.md` | Development rules; calls itself a living file that agents should update | host and off-chain workstreams |
| `zama/fhevm/sdk/js-sdk/CLAUDE.md` | `@`-includes of the contributor style docs and `.claude/*.md` | off-chain workstream, experiments |
| `fhenix/teecryptor/CLAUDE.md`, `AGENTS.md` | A pointer to AGENTS.md; writing-style guidance for agents | Fhenix workstream. The harness auto-loaded CLAUDE.md when the directory was read. |
| `fhenix/teecryptor/.claude/settings.json` | A **`SessionStart` hook** that runs `python3 .claude/check-plugins.py`. It also enables three plugins from a third-party marketplace (`FhenixProtocol/claude-marketplace`, `autoUpdate: true`). | Fhenix workstream. Re-read as data during consolidation. Never executed. |
| `fhenix/cofhesdk/.memory/*.md`, `skills/`, `.claude/skills/`, `.cursor/`, `.github/copilot-instructions.md`; `CLAUDE.md` and `AGENTS.md` in `fhenix-docs` and `zee-k-verifier`; one file of the `fhenix-toolkit` plugin | Agent memory, skills and developer guidance | Fhenix workstream. Only `testing.md` and the one toolkit file were read. |
| `fhevm/listener/crates/listener_core/{CLAUDE,AGENTS}.md`, `fhevm/sdk/cli-js-sdk/{CLAUDE,AGENTS}.md` | Not read | filename scan only |
| `scratch/zkvm-spike/refs/sp1-v6.9.0/.claude/` (`CLAUDE.md`, `commands/`, `skills/`, and a `settings.json` whose Bash allowlist includes `cargo run:*`, `git fetch:*` and `git checkout:*`); `sp1-gpu/.claude/CLAUDE.md`; `refs/leanVM/AGENTS.md` | Agent configuration from the 2026-10-19 zkVM study, in the same scratch tree. Not used in Phase 1. | filename scan; earlier session |
| `starkware-libs/stwo-cairo` README (fetched from GitHub, not cloned) | Contributor and agent instructions that point to an `AGENTS.md` | Earlier session: `RESEARCH.md:1071`; `research_notes/…/layer2_zkvm_feasibility.md:304` |

None of these files tried to redirect this task.

**Recommendation:** never open a Claude Code session with a scratch clone as the project root. Both the teecryptor hook and the SP1 permission allowlist would load.

---

## 8. Guardrails and hygiene

**Own accounts and contracts only.**
- Sepolia transactions came only from our accounts: FUNDER `0xd996…E8D2`, ALICE `0x71eD…4FF5`, BOB `0xcae5…c215` and EVE7702 `0x40ac…Fee5`.
- They targeted only our own contracts (Appendix A).
- Zama's ACL, verifiers and executor, and its testnet relayer, were used only as an ordinary user would use them.
- Every handle that was read, granted or decrypted belongs to our own token.
- The Fhenix probes were `eth_call`s signed with a throwaway key that was never printed, stored or funded.
- Governance and gateway reads were read-only and used aggregate counters only. Multisig members are reported as counts.

**Testnet only.**
- No mainnet transactions were sent.
- Mainnet access was read-only: `getVersion`, implementation slots and governance.
- The mainnet relayer answered 403 to GET probes and was not used further.
- The whole campaign cost about 0.000132 Sepolia ETH in gas.

**No keys printed.**
- Keys live in `.env`, which is git-ignored.
- `experiments/lib/env.mjs` redacts keys, seeds and the RPC URL, and collapses any hex blob of 64 bytes or more. Records keep only digests and `keccak256` hashes of signatures.
- The E4 ML-DSA seed was appended to `.env` as `E4_MLDSA44_SEED` and never printed.
- `node experiments/lib/secret-scan.mjs` was run on 2026-10-21 after this file was written. It scanned 71 files (the experiments folder and `results/`, including this file) for the 5 `.env` secrets, the RPC URL path and hex blobs of 65 bytes or more, and found nothing [M].

**No publishing or outreach.** No issues, PRs, posts or contact of any kind.

**Clones unmodified.**
- On 2026-10-21 (02:11 local time), `git status --porcelain` was empty for all twelve clones: fhevm, kms, cofhe-contracts, teecryptor, cofhesdk, cofhejs, fhenix-docs, zee-k-verifier, evm-ml-dsa-verifier, ETHFALCON, ETHDILITHIUM and NTT.
- `git status --ignored` was also empty for fhevm, evm-ml-dsa-verifier and NTT.
- The fhevm clone's HEAD is `ed851716c` on `main`.
- These checks ran with `GIT_OPTIONAL_LOCKS=0`, so they did not write the index.

**Auto-repack incident on the fhevm clone.**
- One `git grep <rev>` on the blob-less partial clone triggered lazy blob fetches. Those fetches ran git's automatic maintenance (`gc --auto`, a repack).
- The agent stopped its processes.
- HEAD, refs and the working tree were unchanged and `git status` was clean. No tmp or lock files were left behind.
- The pack count went from 86 to 71 (consolidation only).
- The clone now has 72 packs. The newest is a promisor pack written at 2026-10-20 22:49:53, consistent with one later lazy blob fetch.
- Later historical reads used `ls-tree`, GitHub raw, or `-c gc.auto=0 -c maintenance.auto=false` with `GIT_NO_LAZY_FETCH=1`. Every git read in this consolidation used the latter.

**State left on Sepolia.** EVE7702 remains 7702-delegated to `RejectAll1271Wallet`. All deployed contracts remain.

---

## 9. Open items

- B2 end to end on a local main stack (E6). If Sepolia's ACL gains invalidation, `E2/e2.mjs` runs the full sequence by itself.
- The ERC-1271 cap configured on Sepolia's connector. Measuring it needs `/v3/user-decrypt`; a gas-burner account can then bisect it.
- Measuring a second PQ verifier (ETHFALCON or ETHDILITHIUM).
- E7 on Fhenix (cheap and safe, not run), including the Teecryptor-side gas cap (E7-d).
- Mainnet:
  - the Sourcify diff of the implementations;
  - the relayer routes (an API key is needed);
  - gateway 261131 governance (its RPC is private);
  - the DVN's identity on the gateway testnet.
- `/v4/user-decrypt` was checked by GET only.
- N7 (`protocolConfig` set to the KMSVerifier address) was not investigated.

---

## Appendix A. Sepolia transactions (all ours)

| Step | Action | Tx hash | Gas used | Block |
|---|---|---|---|---|
| fund | FUNDER → ALICE, 0.05 ETH | `0xcd02654e72190d847aa95270a87bb8544f6aa276991384acaf8a5f45175188fe` | 204,600 | 11958285 |
| fund | FUNDER → BOB, 0.02 ETH | `0x29ef11ac6249474a876400d37e872dac0b28d3f24470bf11634321e517688f53` | 204,600 | 11958286 |
| fund | FUNDER → EVE7702, 0.02 ETH | `0x119b060261fe3b5c08ee0a114007f3f3f9c43f343bd57ec6201388a27abb9c45` | 204,600 | 11958287 |
| setup | deploy TestConfidentialToken `0x1F32d758…6086` | `0x5cacfec5b5310e66eec9e06984ebd6752a214326d310fbbaf44afa13604d4d19` | 14,734,825 | 11958288 |
| setup | deploy RejectAll1271Wallet `0xb01bAD1A…e564` | `0xa977596338e3ea02eb73b82f2b0645bacd530ca052dc0f707351e4ab6cc986b8` | 1,060,519 | 11958289 |
| setup | mint 1000 → ALICE | `0xeea0ae96a4a26446563cba2049447e424884ed4cdc06a016028c5c88ae8f6228` | 929,713 | 11958290 |
| setup | mint 2000 → ALICE | `0xc853ad86e41d412d78a542ff460bb6b68cf943bc5b322b3783443a4d9bdb1d6b` | 766,634 | 11958291 |
| setup | mint 3000 → ALICE | `0xfdc19d07776cb020cc36b594b18af00f05745523c88925db755e115f6f1b366a` | 766,634 | 11958292 |
| setup | mint 4000 → ALICE | `0xd01aeeb567006b3119896164ac22c9ce8b7047f7d32e2d165cd659a5fb9c34c2` | 766,634 | 11958293 |
| setup | mint 5000 → ALICE | `0x0d7a2ea73de2ec6bd0c32f1a0a0750962ed41412f26a79879791db067737d654` | 766,634 | 11958294 |
| setup | mint 6000 → ALICE | `0x102c9ffe8fb8e955e9f11deb6433095665d83f9e3035b0b374608fbac21a4f50` | 766,634 | 11958296 |
| setup | mint 7702 → EVE7702 | `0x9945aab2b4981ca9c641f7de389f9954e564046f866f64a977ff0e8705a61b62` | 872,232 | 11958303 |
| E3.2 | ALICE `ACL.allow(balance, BOB)` | `0x6c815311a408fb0fff2d9558368a09bbde40d80d231cb521d0f9a3309ec12863` | 140,780 | 11958309 |
| E3.4 | ALICE `ACL.allow(amount1, BOB)` | `0x376c4b3f4fc1d6f7ef20f75e232a29f532bff8189dde6de61dfbe500facd335c` | 140,780 | 11958311 |
| E3.4 | ALICE `ACL.allow(amount2, BOB)` | `0xb49356820f2a7acf9750b6ddca0415e0e52ae136bfc7b7e6652d48a2c190d376` | 140,780 | 11958312 |
| E3.4 | ALICE `ACL.multicall`, 2 allows → BOB | `0x924990fbc27392b1816e02254fbe29d9987de5d18dae2f327ea380d419849b22` | 263,879 | 11958313 |
| E3.4 | ALICE `ACL.multicall`, 5 allows → BOB | `0xb4cb23b476a84dd6e3c8939485a5395abc0f2d74981c9f35aa93a9f8865f763c` | 621,483 | 11958314 |
| E3.4 | ALICE `ACL.multicall`, 10 allows → EVE7702 | `0x2ece7d920c0f471cd617d761b462491820882e0a1497cb228d17140397686795` | 1,217,488 | 11958315 |
| E3.5 | ALICE `ACL.allowForDecryption([balance])` | `0x9253b97b8f754b60bf202e2c3fc75bf6353798c3a8d3b7653a5b02bba9be1cea` | 141,493 | 11958316 |
| E5.2 | EVE7702 EIP-7702 delegation → RejectAll1271Wallet | `0x69cad73edb11c3039259ed773ee19ae5119611954342b6c560e8609b269c87ea` | 58,456 | 11958318 |
| E4.1 | deploy Keccak-f1600 helper `0x3446A1A0…E05b` | `0x06807b672df883dfdac958d80ce13cfa9e08b45786f10ce8db55aa7d4b4705aa` | 33,632,238 | 11958319 |
| E4.1 | deploy MLDSA44Verifier `0x00425424…861d` | `0xf88f7c6f2aeff592a1bb441b110a5066124dcf5a38581b32e62815e590259ce0` | 37,233,691 | 11958320 |
| E4.1 | deploy ML-DSA-44 pk blob `0x015724EC…1415` | `0xedb37023b8a7965fd5daa7a569704fb332a08362c9270f0f5e8a37bf86a36c73` | 31,917,713 | 11958321 |
| E4.1 | deploy MLDSA44Account1271 `0xeAA97EaE…5eB6` | `0x0596a20de2c9aa0b635cde201d13eb7f6aa8bc47f5ca9928ca2fb93b76355830` | 2,091,761 | 11958322 |
| E4.1 | deploy Erc1271GasMeter `0xE53Aadce…81DC` | `0x382fbb82319604a7f76aa32e5e08ab45903c51c2b3adefe3592bfdf8c28d912f` | 1,429,908 | 11958323 |
| E4.2 | mint 4242 → PQ account | `0xb42e62f0dc5e1be864f6b8f9aa7eab1d31dc8dac7eace1861bd45f1fae36c542` | 872,232 | 11958326 |

## Appendix B. Sepolia relayer requests (no transactions)

| Step | Requester | Route | Result |
|---|---|---|---|
| E2.2 | ALICE, permit P1 | SDK → `POST /v2/user-decrypt` | success, 21000 (7.8 s) |
| E2.5 | ALICE, permit P2 | SDK | success, 21000 (2.5 s) |
| E2.7a | ALICE, start = now + 3600 | SDK local check | refused locally, no request sent |
| E2.7b | the same permit | raw `POST /v2/user-decrypt` | HTTP 400 `validation_failed` (requestValidity: timestamp in the future) |
| E2.8 | ALICE, P1 again | SDK | success, 21000 (2.5 s) |
| E3.3 | BOB, on ALICE's handle | SDK | success, 21000 (12.6 s) |
| E3.6 | anyone | SDK → `POST /v2/public-decrypt` | success, 21000 (2.6 s) |
| E5.1 | EVE7702, plain EOA | SDK | success, 7702 (7.0 s) |
| E5.4 | EVE7702, 7702-delegated, original key | SDK | **success, 7702** (2.8 s) |
| E5.5 | EVE7702, empty signature | raw POST | HTTP 400 (signature must be 130 characters) |
| E4.6 | PQ account, 2,420-byte ML-DSA-44 signature | raw POST | HTTP 400 (signature must be 130 characters); request id `122ae62e-9b0b-4355-b02c-a3394979a2fc` |

## Appendix C. Conflicts between the Phase 1 notes, and how they were resolved

1. **First version with `signing_schemes` (R8).**
   - The host note says the field exists "only from v0.15.0-3 onward".
   - Fetching the connector file at the tags shows it in **v0.15.0-0, -1, -2 and -3**, where the file is identical, and in main. It is absent in v0.13.8 and v0.14.2.
   - This report uses "from v0.15.0-0".
2. **Multiple of the cap.**
   - The experiments status note pairs "about 1.23M gas" with "5.2× the cap".
   - In the raw data, 1.23M is the inner verification, which is 4.93× the cap. The 5.24–5.25× figure is the smallest `gas_limit` that is accepted.
   - Both are reported separately (§5.2).
3. **Osaka column labels.**
   - The experiments' gas table lists the 21,000-gas plain transfer under "measured".
   - No local or fork transfer was recorded, so it is labelled [S] here, like the 200 gas per byte code deposit.
4. **`/v4/user-decrypt` absence.**
   - The experiments notes say both v3 and v4 return 404.
   - The experiments' raw data has a POST probe for v3 only.
   - v4 rests on the host workstream's GET probe. The experiments' POST probe also settles the host note's caveat that a POST-only v3 route could not be excluded with GETs.
5. **Line ranges that differ by one or two lines between notes.** Examples: `decryption.rs:520-541` vs `520-542`; `342-362` vs `340-352`; relayer-http `user_decrypt.rs:104-109` vs `105-110`; `ACL.sol:273-286` vs `273-285`. I re-read these at main, and this report uses the verified ranges.
6. **Gateway `Decryption.sol` lines** `916-925` / `937-949` (host note) vs `957-968` / `980-994` (off-chain note). This is not a conflict: the first pair is at v0.13.8 and the second at main. Both were verified. Main `:925` is the KMS-response check; v0.13.8 `:916-925` is the user-permit check.
7. **"E2, E4 and E5 cannot run on Sepolia as designed"** (host note) vs "E4 and E5 confirmed on Sepolia" (experiments).
   - Both hold. On Sepolia, E4 and E5 exercise the legacy ECDSA path.
   - The ERC-1271 behaviour of main was shown by running Zama's crate against the live Sepolia accounts. That is not an end-to-end ERC-1271 decryption on Sepolia.
8. **fhevm pack count.** The host note recorded 71 after the repack; there are now 72. This is a state observation, not a content conflict (§8).
9. **Dates.** The experiments notes give local runs the local date (2026-10-21). In UTC they ran on 2026-10-20 between 22:32 and 22:49, and this report uses UTC.
