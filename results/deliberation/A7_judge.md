# A7: Judge. Rulings on the Decryption Authority Lifecycle deliberation

**Role:** deliberation agent A7 of 7 (judge, runs last). **Date:** 2026-10-21.

**Inputs, read in full:**
- the brief `docs/CLAUDE_CODE_BRIEF_ERC_TARGET_DESIGN.md` (§0–§8);
- `DESIGN_REVIEW.md` (G1-approved v2, PR-1 spec §6.2), `G1_TARTISMA_RAPORU.md` (§5–§10), `results/review/05_judge.md`, `results/review/objection_ledger.md` (§3–§5);
- V1, `docs/FHE_Yetkilendirme_PQ_Tasarim.md` (v0.1; read for intent);
- the six deliberations A1–A6 in `results/deliberation/`, and A5's raw measurements in `impl/bench-pq/a5_native_verify/` (`MEASUREMENT_NOTES.txt`, `bench_run1.txt`, `bench_run2.txt`, `wycheproof_run.txt`);
- the coordinator's hand verification `results/deliberation/COORDINATOR_VERIFICATION.md`, which arrived during my pass. I rule on it explicitly in §1a.

**Code I re-checked myself (read-only):**
- `zama-ai/fhevm` main `ed851716c9a6b799996a23399ece2858336f96db`, plus tags `v0.13.8`, `v0.14.0`, `v0.14.2`, `v0.14.3`, `v0.14.4-0`, `v0.15.0-0` and `v0.15.0-3`, read through `git show <tag>:<path>` with `GIT_NO_LAZY_FETCH=1 -c gc.auto=0 -c maintenance.auto=false`. Extracted copies are in my scratchpad only.
- Zama's cleartext mock: `sdk/js-sdk/contracts/src/v0.13.0/` and the SDK cleartext relayer `sdk/js-sdk/src/core/modules/relayer/cleartext/`.
- `zama-ai/kms` `c755e84f`.
- Fhenix `cofhe-contracts` `b5c20ed` and `cofhejs`.
- OpenZeppelin `@openzeppelin/contracts` 5.6.1 and `@openzeppelin/confidential-contracts` 0.5.3 (`experiments/node_modules`).
- `cast` 1.8.5, used only to hash selectors, interface ids, EIP-712 type hashes and the ERC-7201 location.

**Labels:**

| Label | Meaning |
|---|---|
| **[V-A7]** | Verified by me in this session at the cited file:line |
| [V-A1] … [V-A6] | Verified by that agent; I did not re-check it |
| [V-prior] | Verified in Phase 1 or by the G1 judge (05); not re-checked |
| [M-…] | Measured; the source is named (A5 = Ryzen 5 5600, Windows 10, rustc 1.95.0, 2026-10-21 05:16–05:18 UTC; P1 = Phase 1 Sepolia/anvil; 03/04 = Phase 2 reviewers) |
| [E] | Estimate |
| [I] | My inference |
| [C] | Cited from a specification or web page, not reproduced |

**Path prefixes:** fhevm `main` unless marked. `v0.13.8:` = that tag. `mock/` = `sdk/js-sdk/contracts/src/v0.13.0/`. `OZc/` = `@openzeppelin/contracts` 5.6.1. `OZ/` = `@openzeppelin/confidential-contracts` 0.5.3. `fhenix/` = `cofhe-contracts/contracts/internal/host-chain/contracts/`. `kms/` = `zama-ai/kms`. `lib.rs` = `shared/user-decryption-signature/src/lib.rs`. `decryption.rs` = `kms-connector/crates/kms-worker/src/core/event_processor/decryption.rs`.

**Vocabulary and limits.** This file says "revocable access" and "retire". Wherever the design is summarised, the three limits apply:
1. **pre-emptive, not a clawback;**
2. **oracle access only;**
3. **as final as the chain's governance.**

---

## 0. The rulings on one page

**Gate G2-design: PASS. The Core mechanism, a one-way retirement bit enforced inside the registry's read views, is sound.** I re-verified the four facts it rests on:
1. Every off-chain decider reads only views that Core gates. These are the v0.13.8 connector (direct path `isAllowed(h, user)` and `isAllowed(h, contract)`, `v0.13.8:decryption.rs:229-230`; delegated path only `isHandleDelegatedForUserDecryption`, `:201-207`), the main connector (legacy `decryption.rs:243-250, 551-555`; unified `:449, 458-465, 496`), the SDK precheck (`fetchKmsSigncryptedSharesV1-p.ts:125-139`) and Zama's mock (`mock/cleartext/CleartextACL.sol:236, 239, 257`). The connector's entire ACL surface is four views, and no `eth_call` sets `from` (`rpc.rs:24-67`). [V-A7]
2. Every on-chain export re-enters `isAllowed` with the exporting account as subject. This covers the ACL writes (`ACL.sol:234, 261, 301`), `FHE.fromExternal(h, "")` (`library-solidity/lib/FHE.sol:7038`), OZ ERC-7984 handle paths and disclosure (`OZ/token/ERC7984/ERC7984.sol:122, 141, 164, 187, 199-201`) and the bridge `send` (`bridge/HandlesSender.sol:351`). [V-A7]
3. On Zama, the engine exemption is not an export route:
   - the executor reads `isAllowed` at exactly one choke point, with the calling contract as subject (`FHEVMExecutor.sol:1062-1065`);
   - it grants transient access only to `msg.sender` (`:864, :1046`);
   - no other host contract reads the views as the executor (grep). [V-A7]
4. The deployed gateway performs no ACL check: "ACL checks are performed by the KMS" (`v0.13.8:gateway-contracts/contracts/Decryption.sol:724`). [V-A7]

**Three specification corrections.** None of them makes the mechanism unsound; all three are folded into Level 0:
- **(a) Contract role (A2).** Gate the contract role in both delegated views. Today a retired contract blocks direct decryption but not delegated decryption.
- **(b) Engine exemption (A4 C2).** Define it by call semantics, not by caller identity. Zama's caller-identity implementation is valid only under three invariants, which the tests must pin.
- **(c) Release trains (A3 F2/F4).** The backport's reinitializer collides with release lines that lack Core. An on-chain upgrade guard turns that silent lapse into a revert. The guard is Core MUST for UUPS registries and checks ERC-165 Core support and the retirement storage location; the coordinator independently recommended an ERC-165 guard (§1a).

**Key rulings:**

| # | Dispute | Ruling |
|---|---|---|
| 1 | Q3 states | **Active → Retired only.** No Suspended state. **No reason code** in the Core event |
| 2 | Q5 successor | **Dedicated encoding** (SU-14 rejected). **Acceptance by the successor is mandatory.** D ≥ 7 days (default 7). A per-account raise-only D is allowed (MAY). Successor-issued auditor delegations are deferred |
| 3 | Q4 declared signer | A **delegation to a key-derived address** (A5's KDA), with zero ACL change. It is subordinate, killed by retirement, usable only on delegated entries, never a successor, has no `WithSig` path, verifies FIPS-final schemes natively and has no contract verifier (so there is nothing to un-pin). Exclusivity (no-downgrade) is deferred |
| 4 | Q6 certificate | It survives as an Extension: **retire-only**, non-cancellable by the key, **requires a confirmed successor and binds to it**, verified code-first, carries an **explicit chain list**, and a **second retirement reverts** |
| 5 | Q8 PQ-only | An **operator profile** for the off-chain door, engaged one-way by ≥ n−t operators at an announced block. Its protective claim for unmigrated accounts holds **only with a host-chain ECDSA freeze**. Scheduled notice ≥ 24 months; B_Q cutoff for delegations. A registry-level sunset is deferred |
| 6 | Q9 governance | A timelock as `ACL.owner()` (and as the gateway owner), with direct execution paths removed. Release rule = CI test + **on-chain upgrade guard** (Core MUST for UUPS registries; it checks ERC-165 Core support **and** the retirement storage location) + operator **retirement canary** + pinning. No immutable registry now. PQ signers plus n−t operator ratification is the end-state profile |
| 7 | Level 0 targets | main → ACL **0.8.0** / reinitializer **9**; v0.13 backport → **0.4.1** / **6**, built from the `v0.13.8` source, with the guard; optional 0.14 line → **0.5.1** / **7** |
| 8 | Verifier hygiene (L1) | The 7702 shim triggers only on a *successful* empty return with a 65-byte signature. Code-first ships in shadow mode first. B_exec = 2M + intrinsic calldata; ≤ 2 attempts; 64 KiB cap. Retirement denials are final. The legacy path refuses subjects with regular code |
| 9 | App profile | **Asymmetric** observer gate: a retired account may clear an observer but not set one. Fhenix ports **must gate the permit recipient** |
| 10 | Test placement | Mock: views and flow only. Connector harness: `isAllowed`, unmodified-connector proof, Profile Q. Shared-crate harness: Level 1 and the KDA route |
| 11 | RPC concentration | Host-state sources are trust roots. Disclose them in the ICS; SHOULD avoid any single source serving ≥ t+1 nodes |
| 12 | Q10 vendors | Core is transport-neutral. Any PQ claim needs FIPS 203 on both the reply and the input channel; Fhenix (X25519) and Inco (ECIES, not verified) can meet Core but not Profile Q |

---

## 1. What I re-verified in code

| # | Claim (who) | Finding | Evidence [V-A7] unless marked |
|---|---|---|---|
| 1 | The delegated view does not gate a retired contract; the direct path does (A2) | **Confirmed** on both lines and in the mock. Both delegated views read `persistedAllowedPairs[h][contract]` raw. On main's unified path the contract is checked only through `allowedContracts` (any one suffices) and **not at all** in permissive mode (empty list) | `ACL.sol:561-574` (raw read `:568`); `v0.13.8:ACL.sol:478-491` (`:485`); `v0.13.8:decryption.rs:229-230` vs `:201-207`; main `decryption.rs:551-555` vs `:243-250`; unified `:484-496` (no-op `:490-492`); `mock/cleartext/CleartextACL.sol:236-239` vs `:257` |
| 2 | On Fhenix, a "skip when the caller is the engine" exemption switches retirement off, because the TaskManager relays everything (A4 C2) | **Confirmed.** The ACL write paths accept only the TaskManager as caller and receive the user as `requester`. The operand check, the relayed `isAllowed` and the permit check all reach the ACL with `msg.sender` = TaskManager | `fhenix/ACL.sol:160-166, 179-185, 197-200, 224-229` (writes); `:447-449` (`isAllowed`); `:616-618` (permit); `fhenix/TaskManager.sol:455-457` (operand check), `:947-975` (relays), `:1091-1093` (permit relay) |
| 3 | Zama's caller-identity exemption is safe (A4 Core verdict) | **Confirmed, under three invariants:** one operand choke point; transient grants only to `msg.sender`; no host contract authorizes from views as the executor | `FHEVMExecutor.sol:864, 1046, 1062-1065`; grep of `host-contracts/contracts` finds view readers only at `FHEVMExecutor.sol:1063` and `HandlesSender.sol:351` |
| 4 | Verifiers never evaluate views with `from` = engine (A1 V3) | **Confirmed** for the connector: plain `.call()`, no `from` | `rpc.rs:24-67` |
| 5 | Mock limits (A1, A3, A4, A5) | **Confirmed, with one correction:** the mock *does* verify a 65-byte ECDSA signature. A1's "commented out" and A4's "no signature path" refer to a dead duplicate inside `CleartextACL` | Direct path uses `persistAllowed`: `CleartextACL.sol:236, 239`. Plaintext is public: `:134-137, 196-206`. 65-byte `ecrecover` only: `CleartextKMSVerifier.sol:252-256, 291-297, 307-313, 339-355`. No validity window: `:243, 282`. Dead code: `CleartextACL.sol:~300-420`. The only functional difference between the vendored ACL and the tag is `>=` (`mock/host-contracts/contracts/ACL.sol:600`) vs `>` (`v0.13.8:ACL.sol:601`) (diff with CR and whitespace stripped). The forge single-signer mode bypasses the mock KMS: `relayer/cleartext/forgeFhevmV1.ts:42-54`, `fetchUserDecryptV1.ts:188`, `fetchDelegatedUserDecryptV1.ts:194`. The unified V2 cleartext path is unimplemented: `fetchUserDecryptV2.ts:10` |
| 6 | Reinitializer collision across lines (A3 F2) | **Confirmed.** ACL version / reinitializer per tag: v0.13.8 0.4.0/5 (`reinitializeV4`); v0.14.0–v0.14.4-0 0.5.0/6 (`reinitializeV5`); v0.15.0-0 0.5.0/6; v0.15.0-3 0.6.0/7; main 0.7.0/8. `reinitializer` reverts when `_initialized >= version` | `git show <tag>:host-contracts/contracts/ACL.sol`; `OZc/proxy/utils/Initializable.sol:156-157`; CI rules `ci/upgrade-check/lib.ts:144-169`; the upgrade task always calls `reinitializeV*` (`host-contracts/tasks/upgradeContracts.ts:78-91`) |
| 7 | The next production line is plausibly 0.14.x (A3 F3) | **Confirmed** as a signal: the `latest-supported` profile pins every component to v0.14.2 | `test-suite/fhevm/profiles/latest-supported.json` |
| 8 | An upgrade hook can enforce the release rule (A3 F4) | **Confirmed:** `_authorizeUpgrade` runs in the *current* implementation before the switch | `OZc/proxy/utils/UUPSUpgradeable.sol:88-89, 137-141`; `ACL.sol:674` |
| 9 | One owner for the whole host stack (A3 F7) | **Confirmed:** `onlyACLOwner` resolves to `ACL.owner()`. It is used by the executor, KMSVerifier, InputVerifier, HCULimit, KMSGeneration, ProtocolConfig(+Replica), the bridge contracts, EmptyUUPSProxy and PauserSet | `shared/ACLOwnable.sol:20-30` |
| 10 | ProtocolConfig n−t confirmation pattern (A2) | **Confirmed:** governance defines a context; it is Created only after every new node and ≥ n−t previous nodes confirm | `ProtocolConfig.sol:131-136, 147-158, 192, 220-226` |
| 11 | The 7702 shim must never trigger on an empty revert (A4 M6, A5) | **Confirmed:** the crate already separates `EmptyRevert` (`:146-147`) from a successful empty return (`EoaMismatchNoCode`/`EmptySigOnEoa`, `:161-166`). The `eth_call` carries `gas_limit` (`:137`), so intrinsic and calldata gas count against it. Ordering is `ecrecover`-first (`verify_signature`, `:196-211`; the accept is at `:202-208`) | `lib.rs` |
| 12 | Code-first breaks ERC-7739 wallets (A5) | **Confirmed:** ERC-7739 accepts only nested envelopes, otherwise it returns `0xffffffff` (a wrong magic value, which no shim catches). `SignerEIP7702` accepts the root key. OZ's own ordering is code-first | `OZc/utils/cryptography/signers/draft-ERC7739.sol:38-48`; `SignerEIP7702.sol:18-24`; `SignatureChecker.sol:32-39` |
| 13 | An 8298-migrated account's old key still decrypts on the legacy path (A5) | **Confirmed by code reading:** the gateway uses `ECDSA.recover` on the gateway chain; the v0.13.8 connector verifies no signature; main's unified path is `ecrecover`-first | `v0.13.8:Decryption.sol:923, 947`; `v0.13.8:decryption.rs:191-247`; `lib.rs:202-208` [I for the 8298 consequence] |
| 14 | 250k cap including calldata; 20 attempts; retry rationale | **Confirmed** | `lib.rs:137`; `kms-worker/src/core/config.rs:228-230, 274-276`; `error.rs:97-114` |
| 15 | ACL denials are recoverable and retried (A3 F5) | **Confirmed;** main re-runs live checks on poll-only retries | `v0.13.8:decryption.rs:212, 237, 242`; main `decryption.rs:253-260, 557-570`; `processor.rs:64-68` |
| 16 | `setObserver` is identity-gated; the observer is re-allowed on every transfer (A4 M3) | **Confirmed** | `OZ/token/ERC7984/extensions/ERC7984ObserverAccess.sol:26-39, 46-62` |
| 17 | Fhenix sharing permits never check the recipient through a view (A4 H6) | **Confirmed:** only the issuer is checked through `isAllowed`; the recipient is checked only by signature | `fhenix/ACL.sol:616-618`; `fhenix/Permissioned.sol:162-184` |
| 18 | One RPC URL per host chain per operator (A4) | **Confirmed** | `kms-connector/config/kms-worker.toml:172-184` |
| 19 | t+1 = 5 of 13 responses reconstruct (A1, A2) | **Confirmed** | `sdk/js-sdk/src/core/modules/decrypt/module/api-p.ts:405-418` |
| 20 | Per-party user-decryption shares are local in the default mode | **Confirmed** | `kms/core/service/src/engine/threshold/service/user_decryptor.rs:229-232`; `kms/core/threshold-execution/src/endpoints/decryption.rs:15-19` |
| 21 | Reply channels | **Zama:** the user-decryption client key is parsed as hybrid ML-KEM-512. **Fhenix:** `tweetnacl` `box` (X25519) | `user_decryptor.rs:507-508`; `fhenix/cofhejs/src/core/sdk/sealing.ts:9, 81-82, 113-115` |
| 22 | Inco uses ECIES inputs (brief) | **Not verifiable:** no Inco code exists on this machine | — |
| 23 | Zama's SP 800-57 table keeps Suspended, Deactivated and Compromised keys usable for decryption | **Confirmed** | `docs/protocol/architecture/kms.md:24, 68-77` |
| 24 | Namespace, selectors, interface ids | **Recomputed:** `fhevm.storage.ACLRetirement` = `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200` (the method reproduces `fhevm.storage.ACL` = `0xa688…bc00`, `ACL.sol:188`); `retireAccount()` `0xe7142996`; `isAccountRetired(address)` `0xb279091e`; Core interface id `0x556d2088` | `cast index-erc7201`, `cast sig` |
| 25 | New selectors clash with none of the existing ones | **Checked** against the 36 main ACL functions in the Rust bindings plus the public constants | `host-contracts/rust_bindings/src/acl.rs` |
| 26 | Revoke is pause-gated on v0.13.8 but not on main; one change per block | **Confirmed** | `v0.13.8:ACL.sol:342`; `ACL.sol:386, 337-339` |
| 27 | `lastBlockDelegateOrRevoke` is stored but has no getter (A5) | **Confirmed** | `ACL.sol:133-140` |
| 28 | A5's native PQ timings and the Wycheproof agreement | **Raw outputs checked** | `impl/bench-pq/a5_native_verify/*.txt` |
| 29 | Old host-listener binaries skip unknown events | **Confirmed** (`if let Ok(...)`) | `coprocessor/fhevm-engine/host-listener/src/database/ingest.rs:424-426` |
| 30 | OZ ERC-7984 never asserts `isAllowed(h, recipient)` after granting (SU-1) | **Confirmed** for `_update` | `OZ/token/ERC7984/ERC7984.sol:290-321` |

### 1a. Rulings on the coordinator's verification (`COORDINATOR_VERIFICATION.md`)

The coordinator re-verified seven claims by hand, while my own pass was running. I rule on each explicitly.
- **No disagreement on substance:** all seven agree with my evidence.
- **Added detail on five:** #1, #2, #4, #5, #7.
- **One line correction in the coordinator's file:** #5.
- **One correction to my own first draft:** #6.

| # | Coordinator's claim | My ruling | Evidence and notes [V-A7] |
|---|---|---|---|
| 1 | A2's Core gap: the delegated view reads the raw `persistedAllowedPairs` for the contract, so Level 0 must also gate `retired[contractAddress]` | **Agree; adopted** (§2.1). Applied to **both** delegated views (`isHandleDelegatedForUserDecryption` and main's `isDelegatedForUserDecryption`). I also gate the raw getter `getUserDecryptionDelegationExpirationDate` (returns 0 for any retired party), which matches its own docstring "0 means delegation is inactive" (`ACL.sol:443`) | `ACL.sol:568`; `v0.13.8:ACL.sol:485`. One nuance the coordinator did not state: on main's unified path the direct entry checks a contract only through `allowedContracts`, and not at all when that list is empty (`decryption.rs:490-492`). That is documented as an RFC016 property, not a Core gap |
| 2 | The cleartext mock honours base-ACL gating only if `persistAllowed` and the delegated view are gated | **Agree** | `mock/cleartext/CleartextACL.sol:20, 236, 239, 257`; neither view is overridden. Two additions for test placement (§2.12): (a) the mock never calls `isAllowed`, so the `isAllowed` path is proven only in the connector harness; (b) the tests must use a non-forge KMS signer set. Otherwise the SDK's single-signer "Option B" reads plaintexts straight from the executor and skips `CleartextKMSVerifier` and its ACL checks (`relayer/cleartext/forgeFhevmV1.ts:42-54`; `fetchUserDecryptV1.ts:188`) |
| 3 | The mock's ACL copy uses `>=` against v0.13.8's `>`; build the backport from the tag and point `CleartextACL` at it | **Agree** | `mock/host-contracts/contracts/ACL.sol:600` vs `v0.13.8:ACL.sol:601`. My CR- and whitespace-stripped diff shows this is the **only** functional difference; the other two hunks are comments. Conformance vectors must not pin the exact expiry second |
| 4 | The executor grants only to its caller, so the exemption is no export route | **Agree, under three invariants that Level 0 tests must pin:** (i) `isAllowed` is read only at the operand choke point, with the caller as subject; (ii) transient grants go only to `msg.sender`; (iii) no other host contract reads the views as the executor | `FHEVMExecutor.sol:864, 1046, 1062-1065`; grep of `host-contracts/contracts`. Plus the verifier side: no `eth_call` sets `from` = executor (`rpc.rs:24-67`) |
| 5 | On Fhenix the TaskManager relays `isAllowed` and the oracle's `isAllowedWithPermission`, so the exemption MUST be defined by call semantics | **Agree; adopted as normative Core text** (§2.2). **Line correction:** the `isAllowed` relay is `fhenix/TaskManager.sol:973-975`, not `:972-974` (line 972 is blank); `isAllowedWithPermission` is `:1091-1093` (`:1090` is its comment). **Scope is wider than reads:** the grant relays (`:947-971`) reach ACL write paths that accept only the TaskManager as caller and take the user as `requester` (`fhenix/ACL.sol:160-229`). A caller-identity exemption would therefore also exempt every grant. The permit *recipient* must be gated too (§2.11) | as cited |
| 6 | `lib.rs` separates an empty revert from an empty success, so the 7702 fallback can be limited to the empty-success case | **Agree; adopted as a MUST of Profile H** (§2.10). Two further conditions: the signature is exactly 65 bytes, and the shim is off under Profile Q. **Correction to my own first draft:** `verify_signature` is `lib.rs:196-211` (accept at `:202-208`) and `gas_limit` is set at `:137`, as the coordinator states | `lib.rs:137, 146-147, 161-166, 196-211` |
| 7 | Reinitializers by tag: v0.13.8 = 5, v0.14.2 = 6, v0.15.0-3 = 7, main = 8; add an ERC-165 upgrade-hook guard in Core | **Agree on the numbers**, which I extended to v0.14.0, v0.14.3, v0.14.4-0 (0.5.0/6) and v0.15.0-0 (still 0.5.0/6). **I verified the CI rule the coordinator left open:** a bytecode change requires a reinitializer bump and a semantic-version bump, and the reinitializer must be named `reinitializeV{N-1}` (`ci/upgrade-check/lib.ts:144-169`); the upgrade task always calls it (`host-contracts/tasks/upgradeContracts.ts:78-91`). **Guard: agree that it belongs in Core** (MUST for registries whose upgrade authorization runs registry code, i.e. UUPS; SHOULD otherwise). **Refinement:** it checks ERC-165 Core support **and** the retirement storage location, because ERC-165 alone passes a Core-declaring release whose namespace drifted, which would silently reset every retirement (§2.8 (c)) | `OZc/proxy/utils/UUPSUpgradeable.sol:88-89`; `ACL.sol:674`; `OZc/proxy/utils/Initializable.sol:156-157` |

**Where I go beyond the coordinator's list:**
- Mandatory successor acceptance (§2.6).
- Successor-bound certificates with an explicit chain list (§2.4).
- The KDA encoding for the declared signer (§2.7).
- Profile Q's claim condition: a host-chain freeze (§2.3).
- RPC-source disclosure (§2.13).

The coordinator's list does not cover these items, so they are not in conflict with it.

---

## 2. Rulings on the disputes

### 2.1 The delegated view and a retired contract (A2's "Core gap")

**Evidence.** §1 row 1. The asymmetry is real on every path that consults a contract:
- **Legacy direct path:** the contract is checked through the gated `isAllowed(h, c)`.
- **Legacy delegated path, both lines:** the contract is checked only through the raw `persistedAllowedPairs[h][c]` inside `isHandleDelegatedForUserDecryption`.
- **Mock:** the direct path checks the contract through the gated `persistAllowed(h, c)`; the delegated path does not.

**Ruling: yes. Core gates every role a view consults, including the contract.**
- Both `isHandleDelegatedForUserDecryption` and `isDelegatedForUserDecryption` start with `if (retired[delegator] || retired[delegate] || retired[contractAddress]) return false;`.
- E1 (Level 2) later amends only the delegator case.

**Why:**
1. **One uniform, testable rule.** "No retired account satisfies any authorization view in any role." It is the rule A2 (uniform principal rule) and A4 (H6, "gate every authorizing party") both reached independently.
2. **The documented semantics of contract self-retirement.** "A contract that retires itself disables the handles it governs" (DESIGN_REVIEW §6.4 t8) is true today only on the direct path. With the gate it is true on both.
3. **Cost.** One more SLOAD inside a view the connector already calls; zero new RPCs.
4. **No new harm.** Only the contract itself can retire it, or an E2 certificate, which needs both ERC-1271 *and* a confirmed successor. Forced retirement through an arbitrary-call admin path is an existing admin power (A4 L3) [I].

**What the gate does not do.**
- The user-protection property concerns the requester, owner, delegator and delegate roles, which are gated on every path. The contract role is about consistency, not about protecting the retired contract's users.
- On main's unified path in permissive mode no contract is consulted at all (`decryption.rs:490-492`). Contract retirement is therefore not a decryption kill switch there. This is documented, and it is an RFC016 design choice, not a gap in Core.

### 2.2 The engine exemption: by call semantics, not by caller identity (A4 C2)

**Evidence.** §1 rows 2–4.
- On Zama, caller identity coincides with call semantics only because the executor:
  - uses `isAllowed` solely for operand checks on its caller;
  - never relays a third party's call;
  - grants transient access only back to `msg.sender`.
- On Fhenix, the TaskManager relays grants (`allow`, `allowGlobal`, `allowForDecryption`, `allowTransient`, share/receive), the public `isAllowed`, and the oracle's `isAllowedWithPermission`, all with itself as `msg.sender`. A port that copied "skip when `msg.sender` is the engine" would exempt every grant and the oracle's own permit check [I from V-A7].

**Ruling, normative ERC text (Core R10):**
> A registry MAY exempt from the retirement check exactly one class of evaluation: authorising the use of an operand as an input to a computation the engine performs for its caller. In that evaluation, the subject is the calling contract, and every output of the computation is granted only to that same contract and only for the current transaction. The exemption MUST NOT apply to any evaluation that gates a grant, a publication, a delegation, a transfer of rights to another chain, a permit, or a deputy action. It also MUST NOT apply to any answer returned to an off-chain verifier or to another contract.
>
> An implementation MAY identify the exempt evaluation by its caller only if that caller (i) evaluates the view for no other purpose, (ii) never relays a third party's request, and (iii) grants computation outputs only to itself or to its direct caller, transiently. An engine that relays grants or permit checks MUST NOT be exempted by caller identity; it MUST use a dedicated operand-check entry point.
>
> Verifiers MUST NOT evaluate views with the engine as the `eth_call` sender.

**Zama implementation (Level 0).**
- Keep the constant-address compare in `isAllowed` only. Nothing in `persistAllowed`, the delegated views or any other function is exempt.
- Add tests that pin the three invariants:
  - the executor calls `isAllowed` only from `_consumeOperand`, with `msg.sender` as subject;
  - every `allowTransient` from the executor names `msg.sender`;
  - an `eth_call` audit of the connector shows no `from`.
- Add one export test per path: `allow`, `allowForDecryption`, `allowTransient`, `multicall`, `delegateForUserDecryption`, `fromExternal(h, "")`, ERC-7984 handle transfers and disclosure, and bridge `send`. Each uses a retired account that has just computed through the executor.

**Fhenix port (informative).**
- The TaskManager's `checkAllowed` would call a dedicated `isAllowedForCompute(ctHash, caller)`.
- The ACL's grant paths gate `requester`.
- `isAllowedWithPermission` gates the issuer **and** the recipient (§2.11).

### 2.3 PQ-only mode and the on-chain door (A4 C1, A2, A5, A6)

**Evidence.** Assume a host chain that still accepts ECDSA-authorized transactions from an un-retired EOA. A forged transaction then reaches any of three writes:
- `allow(h, attackerPQ)`: the ACL checks only `isAllowed(h, msg.sender)`, and storage records neither the grantor nor the time (`ACL.sol:230-240`);
- `delegateForUserDecryption(attackerPQ, WILDCARD, max)` (`:326-377`);
- `allowForDecryption` (`:248-267`).

The attacker then decrypts through a fully conforming PQ path, or through public decryption, which has no requester to refuse. An off-chain policy refuses only the forged *permit*. [V-A7 code; I impact]

**Ruling: PQ-only mode is an oracle-side profile (Profile Q), a scheduled, one-way operator policy for the off-chain door.**
- Its protective claim for unmigrated ECDSA accounts is **only meaningful where the host chain rejects those accounts' ECDSA transactions** (a host-chain freeze).
- It is not an on-chain flag and not a trigger. This ERC does not standardize a registry-level sunset.
- Principle: the oracle follows the host chain; it never leads.

**Trigger:**
- At least n−t operators (9 of 13), as policy, **commit first and then activate together** at an announced block B_Q. This avoids the partial-adoption cliff (A4 M5).
- The signal is PQ-signed operator statements plus the ICS. An on-chain record MAY exist, but it is informational, never a trigger.
- Never ECDSA governance.

**Preconditions (all of them):**
1. On ≥ n−t operators: Profile H (code-first, budget, caps), the E3 route (with conformance evidence and an audited library) and refusal of the legacy ECDSA path.
2. A published readiness KPI (the share of active decryptors, and of value, with a PQ-capable route, per chain), with its threshold fixed in advance.
3. A stated recovery path (below).
4. Timelock and implementation pinning in place, so that an ACL swap cannot route around the policy.
5. The commit-then-activate procedure above.

**Notice:**
- **Scheduled:** ≥ 24 months (A6), never later than the host chain's own ECDSA deactivation. If the host chain deactivates first, operators follow at the chain's date.
- **Emergency (no notice):** only on (i) host-chain ECDSA deactivation, or (ii) public, credible evidence of a CRQC against secp256k1, declared by ≥ n−t operators in PQ-signed statements.
- The possibility of an emergency is announced in advance, so the KPI and the "prepare now" prompts serve as the notice.

**Recovery path:**
1. **Prepared before B_Q:** retire to a confirmed PQ successor; or hold a pre-B_Q KDA delegation; or carry to a PQ account.
2. **Host-chain recovery:** an in-place recovery that installs regular code at the same address (EIP-8298 or a seed-proof recovery [C]) restores decryption automatically through ERC-1271. This requires Profile H on ≥ n−t operators *before* activation (A4 H5).
3. **Pre-signed E2 certificate:** a successor-bound certificate can still be relayed after a freeze. Its `ecrecover` is a precompile call, not a transaction, so the dormant successor wakes without any ECDSA transaction (this resolves A4's H5 deadlock for prepared users) [I].
4. **Otherwise:** no access and no leak (fail-closed). No support-desk unfreeze and no vendor-only recovery, since either would be a backdoor (A6).
5. A4 wants ECDSA-verified `…WithSig` lifecycle calls refused after a freeze. Operators cannot enforce that, because it is an on-chain call, and the registry cannot observe a freeze. The ERC therefore keeps exactly one `WithSig` path, E2. Its successor binding confines a forged certificate to the handover the owner pre-committed (§2.4), so no freeze signal is needed.

**Delegation cutoff (A5 K7), adopted.**
- A delegation, KDA delegations included, from an ECDSA-rooted delegator (code-less or `0xef0100`) counts only if its last write is at or before B_Q.
- B_Q is the activation block (scheduled mode) or the last block before the trigger evidence (emergency mode).
- Reading B_Q needs either the stored `lastBlockDelegateOrRevoke` (`ACL.sol:133-140`) through a new getter (an optional Level 3 ACL addition) or the delegation events.

**Effect per path:**

| Path or signer | Under Profile Q |
|---|---|
| Legacy ECDSA gateway path (P1/P1d) | refused outright |
| Code-less signer | refused |
| `0xef0100‖d` (7702) signer | refused; no ERC-1271 call; shim off |
| Regular-code ERC-1271 account (including 8298-adopted code) | accepted in the "no-root-ECDSA" variant (account-asserted: a Safe with ECDSA owners passes, a residual); refused in the "strict" variant |
| KDA of a regular-code delegator | accepted |
| KDA of an ECDSA-rooted delegator | accepted only if last written ≤ B_Q (claim conditional on a host freeze) |
| Delegated requests | the delegate must itself qualify; the B_Q rule applies to ECDSA-rooted delegators |
| Confirmed successor of a retired account | must itself qualify |
| Retired subject (any route) | refused (Core) |
| Public decryption | unchanged (residual; KMS response signatures are still ECDSA, B7) |
| On-chain door (`allow`, delegate, publish) by forged ECDSA transactions | **open until the host chain freezes ECDSA** (stated residual) |

**One-way.** Disengaging Profile Q re-widens rights, so it falls under the governance rule for rights-widening changes (§2.8): a timelock plus n−t ratification.

**A2's registry-level sunset** (an exercise rule in `isAllowed` that refuses ECDSA-rooted subjects after epoch E) is recorded as a **deferred end-state option**.
- It is the only design that closes the on-chain door on a host chain that will not freeze ECDSA.
- Its trigger must be PQ-safe. Today's ECDSA governance falls first under T2 and could simply upgrade the ACL anyway (limit 3).
- Preconditions: PQ governance, n−t ratification, ≥ 24 months notice, and a host chain without a freeze commitment.

### 2.4 Retirement certificates and Q-day forgery (A4 H1)

**The threat, by period:**

| Period | Can a T2 attacker already send a direct `retireAccount()`? | What a forged ECDSA certificate adds | Harm from an unconstrained certificate |
|---|---|---|---|
| Before any freeze | yes | nothing | lockout (DoS), the same as direct |
| After a host-chain ECDSA freeze | no (transactions refused) | **the only remaining way to retire victims** | **permanent lockout of unprepared owners who would recover through the host chain:** the retired bit survives the recovery |
| Leaked or phished honest certificate (T1) | — | a bearer kill switch | lockout without a successor |

**Ruling: certificates survive as Extension E2 (Level 3), with these constraints:**
1. **Retire-only.** A certificate never designates, confirms, replaces or resigns a successor, and never grants.
2. **Successor-required and successor-bound, enforced by the registry** (not a signed flag, which a forger would set):
   - the call reverts unless `successor != address(0) && successorOf(account) == successor`;
   - a forged or leaked certificate can therefore only trigger the handover the owner pre-committed while the key was safe;
   - unprepared accounts cannot be retired by certificate at all, which closes H1.
3. **Non-cancellable by the key; no nonce; no expiry field.** A cancellable certificate is cancellable by the thief, and a signed expiry does not stop a forger. The certificate dies naturally only when the successor changes, which needs the successor's key (to resign) plus the account and D (to re-designate). That makes it two-key.
4. **Code-first verification with OZ `SignatureChecker` semantics** (`OZc/utils/cryptography/SignatureChecker.sol:32-39`):
   - no code: 65-byte low-s ECDSA;
   - any code, including `0xef0100`: ERC-1271 on the account, with no shim. A shim adds nothing here, because the root key can retire directly.
   - A host chain's EIP-8151-style `ecrecover` changes are inherited for migrated accounts.
5. **Chain scope:** an explicit `uint256[] chainIds` list under one signature (A6), with a chain-agnostic EIP-712 domain `{name: "DecryptionAuthorityLifecycle", version: "1"}`.
   - A registry accepts only if `block.chainid ∈ chainIds`.
   - Every conforming registry on a listed chain accepts it, other vendors' registries on the same chain included. That is intended, because retirement is a statement about the address's authority on that chain.
   - Rejected: per-chain domains (one signature per chain; A1 said they cannot cover chains added later) and open-ended chain-agnostic certificates covering future chains (a bearer instrument with unbounded scope; A2/A4/A5).
6. **A second retirement reverts** with `AccountAlreadyRetired`, in both entry points. Watchtowers pre-check `isAccountRetired` and batch with failure-tolerant multicall. Deterministic failure beats silent success, and the relayer pays.
7. **Not pausable**, like `retireAccount`.

**Where certificates and watchtowers help:**
- multi-chain retirement from one ceremony;
- vendor-independent custody runbooks;
- relaying after a freeze;
- reacting to on-chain compromise signals (unexpected `Allowed`, wildcard or non-expiring delegations, observer changes, drains) by triggering the planned handover;
- the protocol-regression watch (§2.8).

**Where they do not help:**
- protecting the past after a theft: off-chain permits need no transaction, the HTTP path is invisible, and decryption completes in seconds [V-prior P1];
- mempool races: both sides can use private order flow;
- a "quantum watchtower": a CRQC harvests silently.

**Deferred:** A4's set-once hash-commitment form. It is PQ-safe and successor-less. It is needed only if wallets want successor-less pre-arranged retirement, or if a host chain changes `ecrecover` for frozen EOAs.

### 2.5 Lifecycle states and the reason code (Q3)

**Positions:**
- A1, A3, A4, A5, A6: Active and Retired, no Suspended.
- A2: Suspended as an optional guardian extension.
- On reason codes: A4 and A5 want one in the event; A3 wants it optional and outside Core; A6 says no.

**Ruling: Core has exactly two states, Active → Retired, one-way. No Suspended state in Core or in any extension of this ERC.**

Why no Suspended state:
1. Whoever can lift a suspension is the attacker's target. If the key can lift it, a thief does. If a guardian can, it is a new per-user cut-off authority.
2. Suspension gates `isAllowed`, and the same predicate gates the account's own writes. "Freeze, then carry" is therefore impossible (A4).
3. It breaks monotonicity, the property that makes caching, final denials and canaries safe (A3).
4. The need is covered elsewhere: account-level suspension inside ERC-1271 (honoured once Profile H's code-first ordering is live), retire-with-successor, and custodian policy engines.
5. Zama's own SP 800-57 table defines Suspended as "still usable for decryption" (`kms.md:68-77`). The analogy supports "modelled on", not an emergency brake.

**No reason code in the Core event.** `AccountRetired(address indexed account, address indexed successor)` is unchanged, and `retireAccount()` stays parameterless (selector `0xe7142996`). Why:
1. A reason chosen by a possibly hostile key is not evidence; a thief picks "Superseded".
2. A public "compromised" flag is a breach notice (A6).
3. A zero-semantics field in a normative event invites relying parties to give it semantics. A4 itself shows that a "Compromised" state with semantics fails in both directions.
4. Institutions keep the reason in their own audit log. `AccountRetired` is the on-chain SP 800-57 deactivation evidence.

### 2.6 Successor (Q5)

**Encoding: dedicated (unanimous). SU-14's locked wildcard delegation is rejected.**
- A locked wildcard delegation is live before retirement, so two keys can read for the account's whole life.
- It would need special cases in revoke (pause-gated on v0.13.8 `:342`, ungated on main `:386`), in the one-change-per-block rule (`ACL.sol:337-339`) and in the retirement gate. A release without those cases would let the old key revoke the insurance.
- Wallets would show a revoke button that reverts.
- Its "no indexer change" benefit is small: nothing on main authorizes from delegation events, and old host-listeners skip unknown events (`ingest.rs:424-426`). [V-A7]

**Acceptance by the successor: MANDATORY (A4).** This overrules the G1 judge's "could" (05 §1.4).
- Acceptance is a transaction from the successor address (`msg.sender == pending`). No signature is verified in the registry, so there is no 1.23M-gas on-chain ML-DSA check; the successor's own account validation pays once.
- Why:
  1. It proves the successor is controlled and can act. A KDA, a typo or a burn address cannot accept, which enforces A5's K4 ("a successor must be a transacting account") for free.
  2. It stops unilateral association: without it, anyone can publish an on-chain link from a sanctioned address to a victim.
  3. It catches more mistakes than D alone.
- It does not help against an attacker who designates and accepts their own address. That residual stays and is asserted in tests.

**D:**
- Registry-wide, MUST be ≥ 7 days, RECOMMENDED exactly 7 days.
- `confirmableAt` is fixed at designation time, from the account's effective D.
- A per-account, raise-only D (A6) is a MAY, capped at 365 days. Because of the snapshot semantics, raising D never touches an existing pending designation. The Level 2 prototype includes it, since it is cheap and makes institutional policy enforceable on-chain.

**Other rules:**
- **Lifecycle:** designate → accept → confirm (account, after D) → locked. Only the successor can resign, at any time.
- **Freeze at retirement:** a pending designation is voided at retirement, and nothing can be designated, accepted, confirmed or cancelled after it. Resignation remains possible.
- **Read right:** after retirement only, through the on-behalf views, exactly as an active wildcard delegation would read: decrypt-as only, no transitivity, no use, grant, publication or compute.
- **Clients** MUST NOT use the successor as a payment address or redirect target.

**Successor-issued, time-boxed auditor delegations (A6, SU-9): deferred.**
- They are exposure-neutral, because the successor can disclose plaintext anyway.
- But they reintroduce transitivity, the property most objected to, and add a second grant path inside the hot view.
- Carry covers handles that must stay re-shareable. Adopt only on named institutional demand, with ≤ 90 days, per-contract scope, no re-delegation, and death with the successor.

**No succession transfer** (A2, A6 open question 1).
- On main, a smart-account successor rotates its owners internally.
- On the deployed P1d path the successor must be an ECDSA EOA (`v0.13.8:Decryption.sol:947`), so losing it is final. Institutions should also carry.

### 2.7 Declared decryption signer (Q4)

**Encoding: a delegation to a key-derived address (KDA; A5), not registry state (A1, A2).**
- `signerBytes = verifierId (20 bytes) ‖ publicKey`, using the ERC-7913 layout.
- `KDA = address(uint160(uint256(keccak256("ERC-XXXX key-derived decryption signer v1" ‖ signerBytes))))`, the last 20 bytes as in A5's `[12:]` and in Ethereum address derivation. The exact tag is provisional.
- Declaring is the account's own `delegateForUserDecryption(KDA, contract | WILDCARD, expiry)`.
- The request uses `userAddress = KDA`, `ownerAddress = account` on every entry, and `signature = abi.encode(signerBytes, sig)`.

Why KDA wins:
- **Zero ACL change.** Retirement kills it through `retired[delegator]`, which Core already enforces.
- **Monotone.** It grants nothing a root key cannot already grant with an instant wildcard delegation (`ACL.sol:326-377`).
- **No new RPC.** The delegated view is already read.
- **Fails closed on old verifiers.** An unmodified verifier rejects it: a non-65-byte signature for a code-less address ends in `EoaMismatchNoCode` (`lib.rs:101-107, 160-166`). [V-A7]

**Constraints (all MUST):**
1. **Subordinate.** Only the account creates it, by its own transaction. Never a root (V1's A1 stays rejected as a root under B3).
2. **Killed by retirement** (Core), and revocable by the account at any time. The account's `invalidateDecryptionSignaturesBefore` does not reach KDA permits; revoking the delegation kills them all.
3. **Delegated entries only.** The route is refused when any entry has `ownerAddress == userAddress` (K3). A KDA cannot transact, so as a direct owner it would be an account that can never retire.
4. **Never a successor.** This is enforced by mandatory acceptance (§2.6).
5. **No `WithSig` path** for declaring or clearing (A4 M4). The only `WithSig` entry point in the ERC is E2 retirement.
6. **No contract verifiers.** `verifierId` is a reserved identifier for a native scheme, so there is no upgradeable verifier to pin. Allowed schemes are FIPS 204 ML-DSA-44/65/87 and FIPS 205 SLH-DSA (SHA2 sets preferred; SHAKE-128f is ~10× slower [M-A5]). FN-DSA is allowed only once FIPS 206 is final. If a later version admits contract verifiers, the KDA MUST commit to the verifier's code hash, and the verifier MUST check it at decision time (A4 M4).
7. **Verification:**
   - native, with empty context, over the same 32-byte EIP-712 digest the verifier would otherwise check;
   - on failure, reject with no fallback to `ecrecover` or ERC-1271;
   - enabled parameter sets pass ACVP sigVer and Wycheproof vectors;
   - a verification bug in a single library must not reach t+1 nodes: each node requires two independent implementations to agree, or no implementation is used by ≥ t+1 nodes (A5, generalised).
8. **Decryption-only, with a finite expiry by default** in wallets, and the B_Q rule under Profile Q.

**No maturity delay for this non-exclusive form.** Anything retirement kills may be instant; only what survives retirement must mature (§ principle P3).

**Exclusivity ("no downgrade once declared"; A1, A2, A6) is deferred to a later "exclusive" variant.**
- It needs registry state, a delay on both declare and clear (clearing re-empowers ECDSA), +1 RPC per request for every account, and ≥ n−t enforcement to be a safety property (A3 F6).
- Once Profile Q engages, it is redundant.
- Before that, it protects only against permit phishing (T1), while the root key can still re-point it on-chain.

**Scope:** main's unified path only. It is impossible on the deployed path, where the gateway verifies the delegate's 65-byte ECDSA (`v0.13.8:Decryption.sol:947`). [V-A7]

**What it buys** [M-A5]:
- ML-DSA-44 verification takes 84–89 µs on the KDA path (82–85 µs cold), against a 1,232,720-gas ERC-1271 call [M-P1, Sepolia].
- Native ML-DSA-44 is cheaper than the k256 `ecrecover` Zama ships (177–213 µs), but not cheaper than libsecp256k1 (53–55 µs). The ERC must not claim "PQ verification is cheaper than ECDSA" in general.

### 2.8 Governance (Q9)

**(a) Timelock (A3 F7, A4 H4). Ruling:**
- A `TimelockController` becomes `ACL.owner()`. This covers the whole host stack, through `ACLOwnable` (§1 row 9). It also becomes the owner of the gateway `Decryption` contract.
- Every direct execution path that bypasses the delay is removed. A4 reports two multisig plugins holding EXECUTE on mainnet [V-A4 from P1].
- Every authorization-path pointer goes behind the same delay.
- The delay is ≥ 7 days for the Level 3 demo and for the ask; RECOMMENDED 14 days for rights-widening changes in the end state.
- The only emergency power is pause. Pause never gates retirement or the views.
- The exit window serves **operators** (review, refuse, pin), not users: users cannot withdraw ciphertext history (A4 M8, A6).

**(b) PQ governance plus n−t ratification (A2). Ruling: adopted as the end-state governance profile** (informative in the ERC, disclosed in the ICS; a Level 3 design note).
- Any change that can widen decryption rights (ACL, KMSVerifier, gateway `Decryption`, ProtocolConfig, executor) is proposed by PQ signers through the timelock and **ratified on-chain by ≥ n−t operators**.
- Operators halt user decryption on an unratified implementation.
- The pattern exists already in Zama's code (§1 row 10). PQ multisig members cost about 1.23M gas per ML-DSA approval [M-P1], acceptable for rare actions.
- This is required before any claim about T2 durability.

**(c) Survival across releases. Ruling: the release rule plus four locks, and no immutable registry now:**
1. **CI:** a Core-selector test plus a negative upgrade test on every release line.
2. **On-chain upgrade guard (A3 F4; the coordinator recommends ERC-165): Core MUST** for registries whose upgrade authorization runs registry code (UUPS, as Zama's ACL: `ACL.sol:674`; `OZc/proxy/utils/UUPSUpgradeable.sol:88-89`). SHOULD for other proxy patterns, enforced in the proxy admin or the governance tooling.
   - The Core `_authorizeUpgrade` makes two low-level `staticcall`s to the new implementation and reverts with `UpgradeDropsRetirement(newImplementation)` unless both succeed:
     - `supportsInterface(0x556d2088)` returns true. This is the ERC-165 check the coordinator proposed, and it proves the new code *declares* Core.
     - `retirementStorageLocation()` returns `0xe6ae1005…0e86200`. This proves the new code reads the *same* state.
   - **Why both.** ERC-165 alone misses namespace drift: a refactored release that declares Core but reads a renamed namespace would reset every retirement while passing the check. The location check alone misses an implementation that kept the getter but dropped the interface.
   - It catches accidental lapses: a rollback to a pre-Core implementation, a Core-less line, a 0.4.1 → 0.6.0/0.7.0 skip.
   - It does not stop a malicious implementation that lies.
   - There is no escape hatch. The rollback target for a buggy Core release is a patched Core release.
3. **Operator retirement canary (A3, A4, A6):**
   - A known retired account and a known allowed handle.
   - On every `Upgraded` event, and periodically, each operator checks: `isAccountRetired` = true; `isAllowed` = `persistAllowed` = false; and the delegated view is false for a delegation created before retirement.
   - On any mismatch, it halts user decryption for that chain.
   - Restrictive, so effective at ≥ n−t operators. Cost: about 4 `eth_call`s per upgrade.
4. **Implementation pinning (B8)** catches what the canary cannot: a malicious upgrade that spares the canaries.

**Immutable registry:** deferred to the end state (§ alternatives).
- It protects the bits, not the enforcement, because a Core-less ACL simply would not read it.
- It costs an external CALL on every non-engine check, or an extra connector RPC.
- Its real benefit, one retirement covering every vendor on a chain, needs cross-vendor adoption first.

### 2.9 Release trains, Level 0 targets and numbering (A3 F2/F3)

**Evidence:** §1 rows 6–8.
- A 0.4.1 backport with reinitializer 6 makes 0.4.1 → 0.5.0 (0.14.x) revert. That is accidental protection.
- 0.4.1 → 0.6.0 and 0.4.1 → 0.7.0 succeed and drop Core silently.
- Production's next line is plausibly 0.14.x.

**Ruling:**

| Target | ACL version | Reinitializer | Function | Built from | Status |
|---|---|---|---|---|---|
| main | 0.7.0 → **0.8.0** | 8 → **9** | `reinitializeV8()` (empty) | main `ed851716c` | **Required** |
| v0.13 line (deployed connector proof, cleartext mock) | 0.4.0 → **0.4.1** | 5 → **6** | `reinitializeV5()` (empty) | `v0.13.8` source (expiry `>`), **not** the mock's vendored copy (`>=`) | **Required**; carries the guard |
| v0.14 line (plausible production target) | 0.5.0 → **0.5.1** | 6 → **7** | `reinitializeV6()` (empty) | `v0.14.2` source | **Optional** for Level 0 green; required before any proposal that targets 0.14.x |

- CI naming is satisfied on every line (`reinitializeV{N-1}`).
- Collisions with Core-less releases (0.4.1 ↔ 0.5.0; 0.5.1 ↔ 0.6.0) are harmless: those upgrades revert, and the release rule forbids them anyway.
- Rejected: "numbering as a guard" (very high reinitializer numbers). It breaks Zama's CI convention, and the guard does the job.

**Upgrade test matrix (Level 0):**

| ID | Upgrade | Expected result |
|---|---|---|
| U1 | 0.4.0 → 0.4.1 | layout preserved; OZ `validateUpgrade` passes |
| U2 | 0.4.1 → 0.8.0 | bits and enforcement preserved |
| U3 (hazard demo) | guard-less 0.4.1 → 0.7.0 | succeeds, and enforcement lapses |
| U4 | 0.4.1 → 0.7.0 | reverts with `UpgradeDropsRetirement` (no ERC-165, no location getter) |
| U4b | 0.8.0 → a Core-declaring implementation with a different namespace | reverts with `UpgradeDropsRetirement` (location mismatch) |
| U5 | 0.4.1 → 0.5.0 | reverts with `InvalidInitialization` |
| U6 (optional) | 0.4.1 → 0.5.1 → 0.8.0 | succeeds |
| U7 | 0.8.0 → an implementation that declares Core and returns the location but does not gate | passes the guard; the canary catches it (residual) |

### 2.10 Verifier details (Level 1, Profile H)

1. **7702 shim.**
   - Fall back to `ecrecover` only when the ERC-1271 `STATICCALL` **succeeds with empty return data** *and* the signature is exactly 65 bytes.
   - Never on `EmptyRevert`, `Rejected`, `WrongMagic`, short return data or `Transport`.
   - Off under Profile Q.
   - Why: `abi.decode` failures and out-of-gas both revert with empty data. A PQ delegate that decodes signatures would otherwise let the root key back in (B5) [I]. A delegate without `isValidSignature` and without a non-reverting fallback is therefore rejected. That is the measured compatibility cost.
2. **Code-first rollout in shadow mode (A5).**
   - The connector computes both verdicts, serves the old one and logs would-be rejections.
   - The SDK detects ERC-7739 with the `0x7739…` probe (it returns `0x77390001`; `draft-ERC7739.sol:39-46`) and wraps signatures.
   - Enforcement starts only after a published shadow period. Code and the ERC-1271 call are read at the same block, and code is never cached across blocks (SU-6).
3. **8298 on the legacy path.** A verifier that still serves an ECDSA-only path MUST refuse a user or delegate whose host-chain code is regular (neither empty nor `0xef0100`). Restrictive (n−t); one `eth_getCode` per legacy request. On the deployed path, only retirement protects a migrated user.
4. **Budget.**
   - `gas_limit = B_exec + 21,000 + 64 × len(calldata)`, with `B_exec` = 2,000,000 by default (A5; configurable and disclosed in the ICS).
   - 2M admits Fireblocks ML-DSA-44 at 1,232,720 gas [M-P1], ETHFALCON at 1,547,336 [M-03] and ZKNOX ML-DSA-65 at about 1.54M [C]. It does not admit NIST Falcon at 3,910,833 [M-03].
   - Worst-case *execution* work per request per operator is 2 × 2M = 4M gas, against 20 × 250k = 5M today [E]. Calldata intrinsic gas is accounting, not computation.
5. **Attempts.** ERC-1271 negatives (`WrongMagic`, `Rejected`, `EmptyRevert`) are retried at most once, at least one block later (≤ 2 attempts). This respects `error.rs:97-100`. Transport errors keep the existing policy; terminal 1271 failures are rejected.
6. **Caps before any RPC:** signature ≤ 65,536 bytes (this covers SLH-DSA-256f at 49,856 B and PQ multisig wrapping), plus caps on `publicKey` and `extraData`.
7. **Retirement denials are final (A3 F5).**
   - On an ACL denial, make one `isAccountRetired` call per subject. If a subject is retired, the denial is irrecoverable with a typed `ACCOUNT_RETIRED` code, and no more retries follow.
   - MUST in Profile H; SHOULD for any Core verifier.
   - It also prevents queued retries from reviving after a governance lapse (A4 H3).
8. **The same configuration in all three places:** the connector, the legacy relayer's required config and the SDK constant (`verifyErc1271UserDecrypt-p.ts:28` [V-prior]).

### 2.11 Application profile and Fhenix permits

**OZ ERC-7984 (Profile A):**
- **Observers.** `setObserver(account, X)` reverts if `X != address(0) && FHE.isAccountRetired(account)`. **Clearing (`X == 0`) is always allowed** (A4 M3). Otherwise a thief-added observer keeps reading the current balance and every future amount through the re-allow in `_update` (`ERC7984ObserverAccess.sol:46-62`), and the retired owner cannot remove it.
- **Operators.** `setOperator(op, until)` reverts if `until > block.timestamp && FHE.isAccountRetired(msg.sender)`; revoking is always allowed. This is for consistency only: operators and transfers are asset authority (limit 2), and `confidentialTransferFrom` already gives the operator a transient handle (`ERC7984.sol:135, 144`).
- **Transfers.** `_update` never blocks inbound transfers and SHOULD NOT block outbound ones. A token MAY opt in to refuse transfers *to* retired accounts.
- **No asserts.** Apps MUST NOT assert `isAllowed(h, recipient)` after granting (SU-1).
- **Generic-call paths.** Contracts with arbitrary-call paths SHOULD refuse the lifecycle selectors.
- **Wallet flow.** It lists observers and operators and offers to clear them before retiring (M10).

**Fhenix and every permit-based vendor:** Core MUST gate the permit **recipient** as well as the issuer, and Fhenix's `allowedOnBehalf` must gate the account, the delegatee and the contract (§1 row 17; A4 H6). Combined with §2.2, a Fhenix port needs:
- a compute-only entry point;
- `requester`-based gating on the write paths;
- issuer + recipient gating in `isAllowedWithPermission`;
- event emission on `allow`, because Fhenix's `allow` emits none (`fhenix/ACL.sol:160-171`) and carry otherwise needs traces.

### 2.12 Mock limits and test placement

Confirmed limits: §1 row 5. A1's and A4's statement that the mock has "no signature path" is corrected: it verifies 65-byte `ecrecover` and nothing else.

| Level | Mock (cleartext stack on anvil) | Connector harness (unmodified kms-worker against the real ACL on anvil) | Shared-crate harness (`shared/user-decryption-signature` against anvil) | Foundry |
|---|---|---|---|---|
| **L0** | Flow through `persistAllowed` and the delegated view: never-retired decrypts; carry + retire, then NEW decrypts history; OLD refused; delegations from/to OLD refused; a retired contract refused on both paths. **Rules:** `CleartextACL` inherits the 0.4.1 backport; a non-forge KMS signer set (not the single-signer mode) so that `CleartextKMSVerifier.userDecrypt` runs; no exact-second expiry assertions. Labelled "proven in mock (views and flow only; plaintext public)" | **`isAllowed` path and the zero-change proof:** v0.13.8 and main connectors reject a retired user, delegator, delegate or contract before the KMS, and forward a never-retired user. Labelled "proven in real connector" | — | registry conformance, views per role, exemption per export path, deputies, upgrade matrix, gas |
| **L1** | **No** (no ERC-1271, no validity window; V2 unimplemented) | budget, attempts, final denials, shadow logging, legacy refusal of regular code | code-first matrix, shim cases, caps, calldata-excluded budget, ML-DSA-44 Fireblocks account | 7702 and ERC-7739 test accounts |
| **L2** | successor "decrypt as" through `plaintextForDelegatedUserDecryption(OLD, S)` | legacy delegated path with an ECDSA-EOA successor; main unified path | — | successor state machine, OZ variant, carry tool |
| **L3** | **No** | KDA route, Profile Q policy plus share-collection simulation, the C1 on-chain-door negative test | KDA verification vectors | certificate (EIP-712), timelock, guard and canary |

### 2.13 Operator RPC-provider concentration (A4 open question 1)

**Evidence.** Each operator reads every ACL view through one configured RPC URL per host chain (`kms-worker.toml:172-184`), and t+1 = 5 responses reconstruct (§1 row 19). Whoever controls the host-state source of ≥ 5 operators can make them answer "allowed" for any request. That bypasses every ACL rule, not only retirement [I]. This is a pre-existing systemic property, and its production extent is unknown.

**Ruling.**
- **ERC (oracle conformance):**
  - each node's host-state source (RPC provider, own node, light client) is a declared trust root;
  - the ICS MUST disclose source diversity (in aggregate);
  - a deployment SHOULD ensure that no single source, or correlated set of sources, determines the view answers of ≥ t+1 nodes;
  - a node SHOULD verify positive answers against its own node, a light client, or two independent providers that must agree, and SHOULD fail closed on disagreement.
- **Operator guidance:** run an own node per host chain, or a provider quorum.
- **Security Considerations:** name it.
- It is not a Level 0 blocker. Severity: potentially High, unknown in production.

### 2.14 Vendor neutrality and reply channels (Q10)

**Every oracle MUST (Core):**
1. release only if the applicable views returned true at decision time for **every subject** (requester, owner or delegator, delegate, contract, permit issuer and recipient), on the registry of the handle's host chain; errors, reverts and timeouts never release;
2. declare a freshness bound and reuse no positive answer across requests;
3. honour the semantic exemption (§2.2) and never call views as the engine;
4. let no signature scheme or legacy path bypass the views;
5. have replicas that apply lifecycle events, or do not authorize from replicas;
6. publish an ICS that includes n, t, profiles per node and host-state trust roots.

A threshold oracle conforms only when ≥ n−t nodes conform.

**Transport and PQ claims:**
- Core is transport-neutral.
- A PQ claim (Profile Q) additionally requires a FIPS 203 KEM, or a hybrid that includes one, on **both** the reply channel and the input-encryption channel. Under T2, classically encrypted inputs stored on-chain can be decrypted without the oracle, so retirement protects nothing there (A4) [I].
- Zama's reply channel is ML-KEM-512 (FIPS 203, category 1) [V-A7]. Replies published on-chain (legacy gateway events) SHOULD use ML-KEM-768 or higher, and the AEAD SHOULD bind the request context [V-A2: `hybrid_ml_kem.rs` AES-GCM without associated data].
- Fhenix (X25519 [V-A7]) and Inco (ECIES, unverified) can conform to Core but cannot claim Profile Q.

---

## 3. Rulings on Q1–Q12

**Q1. Ideal end state (2–3 years).**
- **Accounts.** PQ-validated accounts are the authority: ERC-1271 smart accounts, EIP-8298-adopted code, frame-transaction accounts. EOAs are legacy; their exit is retire-with-successor.
- **Decryption authority:**
  - the account's own validation, evaluated code-first under an execution-gas budget;
  - an optional subordinate KDA signer verified natively (FIPS 204/205, audited library, vector-tested, library diversity).
- **Registry (each vendor's ACL):**
  - Core in the views, uniform over roles, with the semantic exemption, namespaced storage, an upgrade guard and ERC-165;
  - E1 successor; E2 certificate;
  - owned by a timelock with PQ signers; rights-widening upgrades ratified by n−t operators.
- **Executor:** unchanged; invariants pinned by tests.
- **Verifiers:** Core + Profile H; pinning, canary and host-state diversity; native PQ verification; Profile Q at the host chain's ECDSA sunset.
- **Relayer:** untrusted transport; dedup keyed on signature and window; no cached positive authorization; legacy routes removed.
- **SDK and wallets:** per-chain status; typed errors; carry wizard with dry run; successor UX; certificates; a fresh transport key per request, purged on retirement; ERC-7730 clear-signing.
- **KMS:** ML-DSA response signatures end to end (B7, Zama's roadmap); a FIPS 203 reply KEM with context binding.
- **Gateway:** unified path only, no ACL authority, legacy ECDSA path retired, owner timelocked.
- **Applications:** Profile A.
- **Host chain:** its own ECDSA freeze and recovery. The oracle follows them, and it is only as sound as that chain's consensus and account authentication (an extension of limit 3).

**Q2. V1 ideas.** The full table is `DELIBERATION_SUMMARY.md` (e).
- **Semih's instinct, tested.** It is **right about scope**. V1 had the whole lifecycle: retire, carry, a PQ destination, a Q-day posture, normative verifier rules shaped like an ERC, and "both doors, one decision". All six goals and all four verifier rules return.
- It is **wrong about "better"**, for three reasons:
  1. none of the five mechanisms survives as written;
  2. V1's threat model missed deputies, the deployed line, threshold placement, governance, stored results, multiple chains, application roles and lockout;
  3. V1 made vision-level claims that are false: that an off-chain switch protects history at Q-day (C1), that everyone should move to a pure PQ smart account (14.6M–104.9M gas [M-P1]), that EIP-7851 would close the 7702 gap (declined [C]), and that no residual risk remains.
- **Synthesis:** V1's scope, v2's enforcement theory, the review's threat model and the three limits.

**Q3.** §2.5. **Q4.** §2.7. **Q5.** §2.6. **Q6.** §2.4.

**Q7. Cross-chain.**
- Retirement is per registry, per host chain. Permits are bound to the host chain id [V-prior].
- One signature covers many chains through E2's explicit chain list, relayed per chain. The SDK offers `retireEverywhere()`. Wallets show per-chain status.
- There is no bridge propagation: a compromised bridge could mass-retire accounts with no in-protocol undo (A4 H2).
- There is no oracle-side "union" of EOA retirements (A2). It is a restrictive rule (n−t), costs RPCs per chain, surprises users who retire on one chain only, and is unsafe for contracts.
- Bridged handles are new destination handles: retire there too.

**Q8.** §2.3. **Q9.** §2.8. **Q10.** §2.14.

**Q11. Changes per Zama component, in order:**
1. **Docs:** the deny-list over-claim and an address-lifecycle page.
2. **ACL Core on main** (0.8.0): contract gating, typed errors, gated getter, ERC-165, guard.
3. **Core on the next production line**, with the guard (0.4.1 or 0.5.1). One DAO vote per host chain.
4. **Operator track:** canary, pinning, final retirement denials, legacy `user ∉ contracts`, host-state diversity.
5. **Governance:** a timelock as `ACL.owner()` and as the gateway owner.
6. **Level 1:** Profile H in the shared crate, connector, relayer config and SDK constant (shadow first).
7. **Level 2:** `FHE.isAccountRetired`; the OZ Profile A gates; the SDK carry tool and transport hygiene; E1 (offered with wallet and integrator evidence).
8. **Level 3:**
   - E3 KDA route, after an audit;
   - E2 certificate;
   - Profile Q, with notice;
   - PQ governance and ratification;
   - KMS: ML-DSA responses and a reply-KEM option;
   - gateway: retire the legacy path.

The executor needs no change, only invariant tests. The KMS and the gateway need nothing for Levels 0–2.

**Q12. Conformance.**
- **Core = registry rules + verifier rules + oracle rules** (`DELIBERATION_SUMMARY.md` (b)).
- **"Conforming" for an off-chain verifier:** its release decisions satisfy those rules against a conforming registry. This is shown by:
  - black-box vectors: a retired requester, owner, delegator, delegate, contract and permit recipient; a successor; staleness; expiry boundaries without pinning the exact second;
  - a configuration audit: no `from` = engine, no replicas without lifecycle events, host-state sources declared.
- Extensions and profiles are separate claims.
- Restrictive profiles (H's refusals, Q, exclusivity) may be claimed for an oracle only at ≥ n−t enforcing nodes; additive ones (budget, KDA) need ≥ t+1 supporting nodes for liveness.
- Zama's unmodified connectors are expected to conform for Core [I]. Level 0 must show it.

---

## 4. Corrections to the agents' claims

| # | Claim | Correction | Evidence |
|---|---|---|---|
| K1 | A1: the mock's "user-decryption signature check is commented out (`CleartextACL.sol:329-401`)"; A4 L2: "the mock has no signature path" | The commented block is a dead duplicate. The live path (`CleartextKMSVerifier.userDecrypt/delegatedUserDecrypt`) verifies a 65-byte ECDSA signature. The conclusion stands: the mock cannot test ERC-1271, validity windows, invalidation or code-first | `CleartextKMSVerifier.sol:252-256, 291-297, 307-313, 339-355` [V-A7] |
| K2 | DESIGN_REVIEW §6.2: delegated views gate only the delegator and the delegate | Incomplete. Gate the contract too (§2.1) | §1 row 1 |
| K3 | DESIGN_REVIEW §6.2: backport reinitializer 5→6, with no further measure | Correct number, but it collides with Core-less lines. The guard is required (§2.9) | §1 row 6 |
| K4 | [03] / DESIGN_REVIEW: native ML-DSA-44 is "*cheaper* than `ecrecover`" (35–82 µs) | True only against the k256 path Zama ships. libsecp256k1 takes 53–55 µs; ML-DSA-44 takes 82–85 µs cold, decode included | [M-A5] `bench_run1.txt`, `bench_run2.txt` |
| K5 | A3 F2: "0.6.0/7 (0.15.x)" | Precision: v0.15.0-0 still had 0.5.0/6; 0.6.0/7 appears at v0.15.0-3 (pre-release) | §1 row 6 |
| K6 | 05 §1.4: successor acceptance optional ("could") | Overruled: mandatory, as a transaction from the successor (§2.6) | — |
| K7 | Brief Level 1: "an ML-DSA-44 ERC-1271 account … decrypts **in the mock**" | Not possible in the mock: no ERC-1271 path, V2 unimplemented. Moved to the shared-crate and connector harnesses (§2.12) | `fetchUserDecryptV2.ts:10`; `CleartextKMSVerifier.sol:339-341` |
| K8 | A5: the worst case of 2 × 2M = 4M gas is lower than today's 5M | Holds for **execution** work. Intrinsic calldata accounting can push `gas_limit` per attempt above B_exec (up to ~4.2M extra for a 64 KiB signature) without matching computation | §2.10 [E] |
| K9 | A6 and A4: the watchtower retires on an unexpected designation | With a confirmed successor, designation reverts, so the signal does not arise. Without one, E2 cannot execute (§2.4). For successor-less accounts the owner retires directly; the commitment form that would allow it is deferred | §2.4 |

---

## 5. Residual risks by level (what the design must not claim away)

**Level 0 (Core):**
- **Post-compromise race (limit 1).** Third-party grants, public handles and plaintext already decrypted stay exposed.
- **Identity-gated application roles until apps adopt Profile A (limit 2).** Asset authority stays with the key.
- **Governance or gateway compromise (limit 3).** Includes the "contract as user" trick on the legacy path. The guard stops only *accidental* lapses; canary and pinning are operator-side (n−t).
- **Stored results and transport keys reused for up to 365 days** [V-prior].
- **Per-chain coverage.**
- **Contract self-retirement** now bricks its handles on both paths. It is an existing admin power.
- **Lockout** after a retirement with no successor (thief-first or phished).
- **Linkability** through carry events.
- **Host-state source concentration** (pre-existing; §2.13).

**Level 1:**
- Code-first compatibility: ERC-7739 wallets signing plain typed data, and delegates without `isValidSignature` (hence shadow mode).
- Code-first retires nothing for 7702 users: typical delegates accept the root key (`SignerEIP7702.sol:18-24`).
- The legacy path stays ECDSA until it is refused.
- Restrictive parts bind only at ≥ n−t operators.

**Level 2:**
- An attacker designation that is accepted (by the attacker) and confirmed after D unnoticed days survives retirement.
- A thief can keep replacing *pending* designations; the safe response is carry plus retire now.
- Losing an ECDSA-EOA successor on the deployed path is final.
- No transitivity: auditors rely on carry.
- OZ adoption is outside our control.

**Level 3:**
- **KDA:** unaudited libraries; verification bugs (hence diversity); no exclusivity, so ECDSA permits stay valid until Profile Q; impossible on the deployed path.
- **Profile Q:** the on-chain door stays open without a host freeze; partial-adoption cliff; ECDSA KMS response signatures (B7); public decryption unchanged; unprepared accounts lose access (fail-closed); an ECDSA successor is T2-weak.
- **Certificates:** a leaked certificate triggers an early but planned handover.
- **Governance:** PQ signers and ratification are not deployed.

---

## 6. Evidence index (verified by me, [V-A7])

| Topic | Location |
|---|---|
| ACL views, main | `ACL.sol:517-519` (`isAllowed`), `:538-547`, `:561-574` (raw read `:568`), `:582-585`, getter `:445-455` |
| ACL views, v0.13.8 | `v0.13.8:ACL.sol:452-454, 478-491` (`:485`), `:499-502`, getter `:401-411`, expiry `:601` |
| ACL writes (internal `isAllowed`) | main `:230-240` (`:234`), `:248-267` (`:261`), `:295-314` (`:301`), delegate `:326-377`, revoke `:386` (not pause-gated); v0.13.8 revoke `:342` (pause-gated) |
| Versions and reinitializers | main `:161, 185, 209`; `v0.13.8:153, 174, 198`; tags v0.14.x / v0.15.0-x as in §1 row 6 |
| Upgrade hook | `ACL.sol:674`; `OZc/proxy/utils/UUPSUpgradeable.sol:88-89, 137-141`; `OZc/proxy/utils/Initializable.sol:156-157`; `ci/upgrade-check/lib.ts:144-169`; `host-contracts/tasks/upgradeContracts.ts:78-91` |
| Executor | `FHEVMExecutor.sol:864, 1046, 1062-1065` |
| Deputies | `library-solidity/lib/FHE.sol:7038`; `bridge/HandlesSender.sol:351`; `OZ/token/ERC7984/ERC7984.sol:107, 122, 135, 141, 144, 164, 187, 199-201, 290-321` |
| Connector v0.13.8 | `v0.13.8:decryption.rs:191-219` (delegated), `:221-247` (direct) |
| Connector main | `decryption.rs:121-233, 243-264, 327-436, 441-479, 484-518, 544-573`; `rpc.rs:24-67`; `processor.rs:64-68`; `error.rs:97-114`; `config.rs:228-230, 274-276`; `kms-connector/config/kms-worker.toml:172-184` |
| Signature crate | `lib.rs:101-107` (`try_ecrecover`), `:123-186` (`check_erc1271_signature`; `gas_limit` `:137`; `EmptyRevert` `:147`; empty success `:161-166`), `:196-211` (`verify_signature`) |
| Gateway v0.13.8 | `v0.13.8:gateway-contracts/contracts/Decryption.sol:441, 465, 531, 553-556, 691, 724, 888, 923, 947` |
| SDK | `api-p.ts:405-418`; `fetchKmsSigncryptedSharesV1-p.ts:125-139`; `checkDelegation.ts:100`; `checkPersistAllowed.ts:79`; cleartext relayer `forgeFhevmV1.ts:42-54`, `fetchUserDecryptV1.ts:132-147, 188`, `fetchDelegatedUserDecryptV1.ts:137-153, 194`, `fetchUserDecryptV2.ts:10` |
| Mock | `mock/cleartext/CleartextACL.sol:4, 20, 134-137, 196-206, 222-262`; `CleartextKMSVerifier.sol:225-357`; `CleartextFHEVMExecutor.sol:40-41`; `mock/host-contracts/contracts/ACL.sol:600` |
| Governance | `shared/ACLOwnable.sol:20-30`; `ProtocolConfig.sol:131-136, 147-158, 192, 220-226` |
| KMS | `kms/core/service/src/engine/threshold/service/user_decryptor.rs:229-232, 507-508`; `kms/core/threshold-execution/src/endpoints/decryption.rs:15-19`; `kms/Cargo.toml:175` (`ml-dsa =0.1.1`, "no security audit") |
| Fhenix | `fhenix/ACL.sol:160-229, 378-413, 447-449, 616-638`; `fhenix/TaskManager.sol:455-457, 947-979, 1062-1074, 1091-1093`; `fhenix/Permissioned.sol:162-184`; `cofhejs/src/core/sdk/sealing.ts:9, 81-82, 113-115` |
| OZ signatures | `OZc/utils/cryptography/SignatureChecker.sol:32-39`; `signers/draft-ERC7739.sol:38-48`; `signers/SignerEIP7702.sol:18-24` |
| Observer | `OZ/token/ERC7984/extensions/ERC7984ObserverAccess.sol:26-39, 46-62` |
| SP 800-57 language | `docs/protocol/architecture/kms.md:24, 68-77` |
| Coprocessor | `coprocessor/fhevm-engine/host-listener/src/database/ingest.rs:424-426`; `database/tfhe_event_propagate.rs:1820-1942` |
| Release profile | `test-suite/fhevm/profiles/latest-supported.json` |
| Hashes | `cast` 1.8.5: location `0xe6ae1005…0e86200`; Core `0x556d2088`; E1 `0x7dc5e209`; E1-delay `0xc61ca396`; E2 `0x4b9ec076`; `retirementStorageLocation()` `0xc89c7ccd`; `RetireAccount(address account,address successor,uint256[] chainIds)` type hash `0xf224379ad7473578295885cb7fd6795dbf8c4d718c2bd07d70c8f1e5ecaac54b` |

---

## 7. Hygiene

- **Read-only.** No transactions, no RPC to any live service, no outreach.
- **Git on the shared clones:**
  - `rev-parse` and `tag -l` (no history walk);
  - one `git status --porcelain` on the fhevm clone, which reported a clean tree. It may refresh the index's stat cache; HEAD, refs and the working tree are unchanged;
  - `git show <tag>:<path>` with lazy fetch, gc and maintenance off.
- **Temporary files:** two transient selector lists written under the shell's `/tmp` were deleted immediately. Everything else went to my scratchpad.
- **Agent files.** I opened no agent-instruction files in the clones and followed none. Every file and web page was treated as data.
- **Possible prompt injection:** none encountered.
- Only this file and `DELIBERATION_SUMMARY.md` were written to the project.
