# Phase 1 verification: host contracts, governance, Sepolia state (V0, B1, B3, B7-on-chain, B8, prototype facts)

Author: Claude Code subagent (Phase 1, host contracts / governance) · Written 2026-10-21 (local, UTC+3). Chain reads were taken 2026-10-20 21:57Z–22:54Z UTC.

Method: read-only only. I used `eth_call`, `eth_getStorageAt`, `eth_getCode` and `eth_getLogs` against public RPCs: Sepolia publicnode, Ethereum publicnode, and Zama gateway testnet `https://rpc.testnet.zama.org`, which the repo names as the public default in `host-contracts/tasks/utils/environments.ts:108`. I also used public GET endpoints (Sourcify, Blockscout, `explorer.testnet.zama.org`, `relayer.testnet.zama.org`) and raw.githubusercontent.com. No transactions, no POSTs, no outreach. I touched no user handles or data: only Zama protocol contracts and aggregate counters were read. Multisig and Safe members are reported as counts and types only, never addresses.

Labels: **[V]** means verified by reading code or chain. **[I]** means inferred from code reading, not executed.

## 0. Repository heads

| Repo | Local clone HEAD | `git ls-remote origin refs/heads/main` on 2026-10-21 | Doc's commit |
|---|---|---|---|
| zama-ai/fhevm | `ed851716c9a6b799996a23399ece2858336f96db` (2026-10-20 17:56Z) | same | `ed85171` ✔ |
| zama-ai/kms | `c755e84ff0816b5fbc07077e248f67ab2bf485d0` (2026-10-20 07:07Z) | same | `c755e84` ✔ |

**Incident (disclosed): auto-gc on the shared clone.** One `git grep <rev>` over the shared fhevm clone (a blob-less partial clone) triggered lazy blob fetches. Those fetches ran git's automatic `maintenance` / `gc --auto` (repack).
- I stopped my processes.
- HEAD, refs and the working tree are unchanged (`git status` is clean). No tmp or lock files were left behind.
- The pack count went from 86 to 71 (consolidation only).
- All later historical reads used `ls-tree` (trees are local) or GitHub raw, outside the clone. Other agents should pass `-c gc.auto=0 -c maintenance.auto=false` on historical reads.

---

## V0. Sepolia (and mainnet) vs main — **REFUTED: deployed ≠ main; material difference (gate G0 trips)**

### Host contracts [V]

| Contract (proxy) | Sepolia `getVersion()` | Sepolia impl (ERC-1967 slot) | Mainnet `getVersion()` | Mainnet impl | main @ ed85171 |
|---|---|---|---|---|---|
| ACL `0xf0Ff…433D` / `0xcA2E…ffb6` | **ACL v0.4.0** | `0xF4f793e6a2eF47DE60A94c0bC412292da5F7aB98` (10,137 B) | **ACL v0.4.0** | `0x9A017e0ba4c19A325D5a89f5dd2112e605E85418` (10,137 B) | ACL v0.7.0 |
| KMSVerifier `0xbE0E…311A` / `0x7762…BB03` | KMSVerifier v0.3.0 | `0xe90451e8Cc1c96faA5D59b4386ef5145F2d55ed0` | v0.3.0 | `0x390683dEa46a61786f4F0807bf3559038Cf43Fa4` | v0.5.0 |
| InputVerifier `0xBBC1…4DA0` / `0xCe0F…8EA2` | InputVerifier v0.2.0 | `0xFcb7F9B69b169678e3fA2798FB0db49534834766` | v0.2.0 | `0xc4a1a1BaE73ca6aceb2FAa62ce08BfAbCd2323b6` | v0.3.0 |
| ProtocolConfig `0x51f9…ee83` / `0xD823…a7C4` | ProtocolConfig v0.1.0 | `0xe7049e17152Fe96EDE996dB61BDB541BB97DbE79` | v0.1.0 | `0x25c76298Fb4d15bFADce4798519a7B37ac0076E7` | v0.4.0 |

- All proxies are the same 170-byte OZ v5 `ERC1967Proxy` (code keccak `0x864c…36a6`). The ERC-1967 admin slot is 0, so these are UUPS, not Transparent proxies. Sepolia blocks 11958138–11958266; mainnet blocks 26236667–26236786.
- **Source identity [V].** Sourcify has full creation and runtime matches for all four Sepolia implementations.
  - Verified `contracts/ACL.sol`, `ACLEvents.sol`, `KMSVerifier.sol`, `ProtocolConfig.sol`, `IProtocolConfig.sol` and `Structs.sol` are **byte-identical to tag `v0.13.8`** (= branch `release/0.13.x`, no host-contract diff between them). They differ from main (ACL.sol: 99 diff lines).
  - InputVerifier is an older build: its source equals the InputVerifier.sol of tags v0.9.2 and later.
  - Deployer `0x49F193FC5A8761EaCE87926606827D493e42d513`. ACL impl deployed at Sepolia block 11094985, verified 2026-08-17.
  - Mainnet versions and code sizes are identical. Code hashes differ only because of the per-chain address constants. I did not run the Sourcify diff for mainnet: **pending** (low risk).
- Version map from the repo [V]:

  | Ref | ACL | KMSVerifier | InputVerifier | ProtocolConfig |
  |---|---|---|---|---|
  | release/0.13.x, v0.13.8 | 0.4.0 | 0.3.0 | 0.2.0 | 0.1.0 |
  | release/0.14.x | 0.5.0 | 0.4.0 | 0.2.0 | 0.2.0 |
  | release/0.15.x | 0.6.0 | 0.5.0 | 0.3.0 | 0.3.0 |
  | main | 0.7.0 | 0.5.0 | 0.3.0 | 0.4.0 |

  The ACL went 0.4→0.5 in `6ee4ba705` (2026-05-26), "unified user decryption w/ erc-1271 support (#2624)". That commit added `invalidateDecryptionSignaturesBefore`.
- **Behavioural probes on the Sepolia ACL** (`eth_call`) [V]:
  - Main-only views revert with empty data: `decryptionSignatureInvalidatedBefore(address)`, `isDelegatedForUserDecryption(...)`, `getConfidentialBridgeAddress()`.
  - These exist: `isHandleDelegatedForUserDecryption(0,0,0,0)` returns false; `WILDCARD_DELEGATION_ADDRESS()` returns `0xFFfF…FfFF`; `UPGRADE_INTERFACE_VERSION()` returns "5.0.0"; `proxiableUUID()` via the proxy reverts with `UUPSUnauthorizedCallContext`.
- **Deployed ACL v0.4.0 vs main v0.7.0** (diff v0.13.8..main) [V].
  - Missing on the deployed ACL:
    - `invalidateDecryptionSignaturesBefore`
    - storage field `decryptionSignatureInvalidatedBefore` and its getter
    - `isDelegatedForUserDecryption`
    - the ConfidentialBridge exemption in `allowTransient`, and `acceptOwnership` re-sync
  - `revokeDelegationForUserDecryption` is `whenNotPaused` on the deployed ACL (v0.13.8:342); main allows it while paused (#4377, 2026-10-09).
  - Present on both: `allow`, `allowForDecryption`, `allowTransient`, `delegateForUserDecryption` (with wildcard), `isHandleDelegatedForUserDecryption`, `blockAccount`, `MulticallUpgradeable`.
- `sdk/js-sdk/src/core/chains/definitions/sepolia.ts` still lists exactly the brief's addresses (ACL, InputVerifier, KMSVerifier, ProtocolConfig, relayer, gateway 10901, Decryption `0x5D8B…7478`) [V]. Mainnet (`mainnet.ts`) uses ACL `0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6` and gateway 261131.

### Gateway testnet, chain 10901 (block 35,365,558) [V]

- Versions: Decryption `0x5D8B…7478` is v0.5.0 (impl `0xebc0366892bdfb6ef97fa460bd9c8d366212c2e7`). GatewayConfig `0x9415…E332` is v0.7.0. KMSGeneration is v0.5.0. InputVerification is v0.5.0. All match v0.13.8; main has Decryption v0.8.0 and GatewayConfig v0.8.0.
- `explorer.testnet.zama.org` has verified source for the Decryption impl (partial match, 2026-10-08). `contracts/Decryption.sol`, `shared/Structs.sol` and `interfaces/IDecryption.sol` are **identical to v0.13.8**.
- On this deployed path the user's EIP-712 permit is checked **only on-chain on the gateway, with `ECDSA.recover`, EOA only**: `Decryption.sol:916-925` (direct) and `:937-949` (delegated). There is no ERC-1271. Durations are capped at 365 days (`:127`, `:1176`).
- `userDecryptionRequest` (`:441-525`) is callable by anyone: `whenNotPaused`, registered host chain, fee collection.

### Which user-decryption path the testnet uses today: **the legacy gateway path** [V]

Main has three paths:
1. **Legacy.** Relayer `POST /v2/user-decrypt` → gateway `userDecryptionRequest(CtHandleContractPair[] …)`, ECDSA checked on-chain → connector does ACL reads.
2. **RFC-016 unified EIP-712.** Relayer `POST /v3/user-decrypt` (added 2026-06-01, #2544) → gateway `userDecryptionRequest(HandleEntry[] …)`, with "signature validation performed off-chain by the KMS Connector" (main `IDecryption.sol:60`) → connector runs ecrecover→ERC-1271 (250k gas), the invalidation check and ACL.
3. **`relayer-http` `/v4/user-decrypt`.** Added 2026-09-25 (#3975). It "replaces the gateway-chain decryption path" by fanning out to connector HTTP endpoints (`relayer-http/CLAUDE.md`).

Evidence that the testnet uses path 1:
- **Relayer edge (GET only).** `relayer.testnet.zama.org`:
  - `/v2/user-decrypt`, `/v2/delegated-user-decrypt` and `/v2/public-decrypt` return **405** from upstream (route exists, POST-only).
  - `/v2/keyurl` returns 200.
  - `/v3/user-decrypt`, `/v4/user-decrypt`, `/v4/public-decrypt`, `/version`, `/healthz` and `/docs` return the edge's own 404, "no Route matched with those values".
  - Caveat: a POST-only edge route for `/v3` cannot be excluded with GETs alone. I did not send the SDK's empty-POST probe (`fetchFeatures.ts:33-75`) because of the GET-only rule. This agrees with the coordinator's Sepolia finding that v3 returns 404.
- **Gateway activity (aggregate counters only).**
  - Decryption storage `userDecryptionCounter` (slot `0x6811…e708`): 1,598,345 at 2026-10-20 01:33Z, 1,599,922 at 22:32Z. That is about 1,577 user-decryption requests in 21 h, across all host chains on this gateway.
  - Public decryptions: about +1,920 in the same window.
  - `isDecryptionDone(id)` = true for 10 of 10 sampled IDs between counter−50 and counter−1500.
- **Compatibility.** The RFC-016 connector path reads `decryptionSignatureInvalidatedBefore`, which reverts on ACL v0.4.0. The connector maps that revert to a retried network error (`rpc.rs:88-94`), so path 2 cannot work against the deployed ACL.
  - The v0.14.2 connector's legacy path does *not* read invalidation, so off-chain components could be v0.13.x or v0.14.x. On-chain data can't tell which.
  - The repo's `test-suite/fhevm/profiles/latest-supported.json` pins v0.14.2.
  - Either way the live path is path 1 with **no invalidation, no ERC-1271 and no 250k cap**. [I for off-chain version]
- **Mainnet.** It has the same on-chain versions, so it is inferred to use the same legacy path. Its relayer requires an API key (403 on every route), so routes are unverified: **pending**.

**Consequences for the doc:** B2, B5-as-written, B6 and B7/R8 describe main or ≥v0.14/v0.15 code that is **not deployed** on Sepolia or mainnet. E2, E4 and E5 cannot run on Sepolia as designed (see §7).

---

## B1. No user-callable revocation; `blockAccount` owner-only and absent from the decryption path — **CONFIRMED (stronger than stated)** [V]

**Owner-only blocking.** `blockAccount` / `unblockAccount` are `onlyOwner`: main `ACL.sol:601-621`; deployed v0.13.8 `:518-531`. Every user-callable ACL function only *adds* rights: `allow`, `allowForDecryption`, `allowTransient`, `delegateForUserDecryption`, `multicall`. None clears `persistedAllowedPairs[h][self]` or adds the caller to the deny list.

The only revocations available to a user:
- `revokeDelegationForUserDecryption`, which removes a delegation the user granted;
- on main only, `invalidateDecryptionSignaturesBefore`, which works on signatures, not the key. It is **not deployed**.

**Deny-list reach**, searched across the whole repo at main and at v0.13.8. For v0.13.8, all 329 non-test source files that differ from main were fetched from GitHub raw.
- It is checked only in ACL `allow`, `allowForDecryption` and `allowTransient`, and only against `msg.sender`.
- It is **not** checked in:
  - `delegateForUserDecryption`;
  - `isHandleDelegatedForUserDecryption`;
  - `isAllowed`;
  - the connector (`decryption.rs` at v0.13.8 :116-248, main :121-573);
  - the relayer (`host/acl_checker.rs` uses only `isAllowed` / `isAllowedForDecryption`);
  - the gateway contracts and the SDK.
- The coprocessor host-listener logs `BlockedAccount` / `UnblockedAccount` as "unhandled": `tfhe_event_propagate.rs:1960-1969, 2858-2859` (main) and `:946-955, 1269-1270` (v0.13.8).
- `library-solidity` `FHE.isAccountDenied` is an opt-in helper for dApps (`FHE.sol:8164`).

**Docs/code mismatch.** `docs/solidity-guides/acl/README.md:65` says denied accounts "cannot grant or receive new permissions". The code never checks the recipient, so a denied account can still receive `allow` and can still delegate.

**Assessment.** Permanent permissions are deliberate: they are documented (README.md:21-33) and needed by apps. The missing user retirement and the narrow deny-list reach look like an oversight in lifecycle design. The README/code mismatch on "receive" is a documentation bug.

## B3. Holder can re-grant or publish history in one transaction — **CONFIRMED, and broader than stated** [V code; on-chain run by the coordinator's E3]

- **`allow(h, X)`.** Requires `!denied(msg.sender)`, `isAllowed(h, msg.sender)` and `whenNotPaused` (main :230-240; deployed :206-215). Batching in one tx needs no new function: the ACL inherits **`MulticallUpgradeable`** (main :5, :27; deployed :5, :26). `multicall([allow(h1,X), …])` delegatecalls itself and keeps `msg.sender`.
- **`allowForDecryption(bytes32[])`** is natively batched. Any holder can make every listed handle public (main :248-267; deployed :224-243).
- **Cheapest path: wildcard delegation (new, not in the doc).** The victim key sends one call: `delegateForUserDecryption(attacker, WILDCARD_DELEGATION_ADDRESS, type(uint64).max)`.
  - Gas is O(1), there is no deny-list check, and no maximum expiry.
  - The library's `delegateUserDecryptionWithoutExpiration` uses `type(uint64).max` (`FHE.sol:8244-8245`).
  - It covers **all past and future** handles where the victim and the app contract are persistently allowed (`isHandleDelegatedForUserDecryption` main :561-574 / deployed :478-490).
  - The attacker then signs delegated requests with their own key; the gateway checks only the *delegate's* ECDSA signature (Decryption :937-949).
  - The wildcard exists on the deployed v0.4.0 (probe above).
  - The victim can revoke, but the attacker holds the same key and re-delegates to fresh addresses. There is a one-change-per-block rule per (delegator, delegate, contract), at main :337-339 and deployed :294-296.
- **`allowTransient` semantics.**
  - Anyone allowed on `h` (except denied senders) can set a per-tx allowance. The FHEVMExecutor, plus the ConfidentialBridge on main, are exempt from checks (main :295-314; deployed :253-272).
  - It grants nothing for decryption, because the connector's `isAllowed` `eth_call` sees empty transient storage.
  - It is a same-tx stepping stone: the recipient contract can call `allow` because `isAllowed` includes transient. So it adds no capability beyond `allow`.
  - `cleanTransientStorage()` is public and harmless.
- **Delegation edge cases.**
  - `delegateForUserDecryption` reverts when:
    - the delegate or contract is the sender;
    - the delegate is the wildcard;
    - the delegate equals the contract;
    - expiry ≤ now;
    - expiry equals the stored value;
    - the same triple was already changed in this block.
  - It does not check the deny list, whether the delegate is a contract, or whether the delegator holds any handle.
  - `isHandleDelegatedForUserDecryption` requires the delegator *and* `contractAddress` to be **persistently** allowed; transient allowances do not count.
  - On the deployed v0.4.0, while the ACL is paused, existing delegations keep working (the views are not pause-gated) but the victim **cannot revoke** them.
- **Confused-deputy path (new; matters for C1).** dApps grant using *their own* ACL rights after checking `FHE.isAllowed(h, msg.sender)`.
  - Example: OpenZeppelin `ERC7984.requestDiscloseEncryptedAmount` (master `23ba154023`, 2026-09-10, `ERC7984.sol:202-209`) requires only `FHE.isAllowed(amount, msg.sender)`, then calls `FHE.makePubliclyDecryptable(amount)`.
  - So the old key can publish any amount handle it can read through the token contract, without ever calling the ACL itself.
  - `confidentialTransfer(to, amount)` (`:124-125`) also accepts any handle the sender is allowed on.
  - [I] The same holds for deny-listed accounts.
- **Assessment.** Transitivity of `allow` is a deliberate, documented feature. The missing user-side lifecycle, and the fact that dApp deputies inherit ACL reads, look like an oversight. **A seal implemented as `notSealed` on ACL write functions does NOT close the on-chain door.**

## B7 (on-chain). KMSVerifier verifies only ECDSA — **CONFIRMED** [V]

- main `KMSVerifier.sol:416-419`: `_recoverSigner` is `ECDSA.recover`. The proof format hard-codes 65-byte slots (`:152-167`).
- Deployed v0.3.0 (Sourcify source): the same logic at `:411-412` and `:154-165`. InputVerifier does the same (deployed `:519-520`).
- No `isValidSignature`, ML-DSA or other PQ verifier exists anywhere in `host-contracts/contracts` or `gateway-contracts/contracts` at main.
- Correction to R8: `signing_schemes: [Ecdsa256k1]` exists only from v0.15.0-3 onward (main `decryption.rs:614, 628`). The deployed-era connectors (v0.13.8, v0.14.2) have no such field.
- Assessment: deliberate. It sits on the KMS PQ roadmap.

---

## B8 (new). Governance and upgradeability — **CONFIRMED: every authorization layer is upgradeable by ECDSA-rooted governance with no timelock** [V unless marked]

### Who can upgrade [V]
- **ACL.** `UUPSUpgradeableEmptyProxy` (OZ `UUPSUpgradeable`). `_authorizeUpgrade … onlyOwner` (main :674; deployed :591). `Ownable2Step`.
- **KMSVerifier, InputVerifier, ProtocolConfig, FHEVMExecutor, HCULimit, KMSGeneration, EmptyUUPSProxy.** `_authorizeUpgrade … onlyACLOwner`, where `ACLOwnable.sol:20-29` means `msg.sender == ACL.owner()`. PauserSet is immutable, but its pauser management is `onlyACLOwner`.
- **ProtocolConfig.** On the deployed v0.1.0, `defineNewKmsContext` is `onlyACLOwner` with **no committee confirmation** (:139-142). Main adds previous and new committee quorums (:131-232).
- **Gateway contracts.** `onlyGatewayOwner`, which is `GatewayConfig.owner()` (v0.13.8 `GatewayOwnable`). Decryption `_authorizeUpgrade … onlyGatewayOwner` (:906).
- **Intended process.** The README states that on testnet and mainnet the "DAO executes the printed `upgradeToAndCall` payload" (`host-contracts/README.md:190`).

### Governance chain, host side

**Sepolia** (ACL `owner()` = `0x08e8a84c3c8c7cba165B1adcf67Ae4639eF84f52`, `pendingOwner` = 0):
- The owner is an **Aragon OSx DAO**: ERC1967Proxy → `src/core/dao/DAO.sol`, impl `0x824d…44f8`, `protocolVersion` 1.4.0, Sourcify/Blockscout verified.
- The fallback error `UnknownCallback` is Aragon's.
- Holder of `EXECUTE_PERMISSION` on the DAO (reconstructed from `Granted`/`Revoked` events and confirmed with `hasPermission`): one **Aragon Multisig** plugin, `0x6d5521b3…6f9a`.
  - **3-of-5**, all 5 members plain EOAs.
  - Target is the DAO, operation Call.
  - The grant is unconditional (`ALLOW_FLAG`).
- The DAO holds ROOT, UPGRADE_DAO and similar permissions on itself, so EXECUTE effectively means root.
- An Aragon `Admin` plugin clone (`0xdb58…7cd5`) driven by an EOA **no longer** has EXECUTE (`hasPermission` = false).

**Mainnet** (ACL `owner()` = `0xB6D69D5F334d8B97B194617B53c6aB62f8681Ef3`, `pendingOwner` = 0):
- An Aragon OSx v1.4.0 DAO (impl `0x58c1…1d29`).
- **Two** Multisig plugins hold EXECUTE independently, and **either suffices**:

  | Plugin | Threshold | Members |
  |---|---|---|
  | `0xbc860b6a…a38f` | **3-of-6** | 6 EOAs |
  | `0xe43c73aa…e66f` | **9-of-17** | 12 EOAs; 4 Safes (4/11, 2/5, 2/4, 3/6; all owners EOAs; 0 modules); 1 other Aragon DAO with no current EXECUTE holder among its past grantees |

- The Admin plugin `0x01e2…6a6b` has no EXECUTE.

**Timelock: none.** The verified Aragon `Multisig.sol`:
- lets `startDate = 0` mean now (:322-326);
- treats `_canExecute` as approvals ≥ min within [start, end] (:597-617);
- executes on the final `approve(…, tryExecution)` (:441-445).

Execution targets the DAO directly. So **3 ECDSA keys can upgrade the mainnet ACL in about one block**.

### Governance chain, gateway testnet side [V]
- `GatewayConfig.owner()` is a **Safe v1.4.1** `0x3241…D9c9`: **3-of-5**, 5 EOAs, no guard, no fallback handler.
- Its one module is `AdminModule` `0x53dB…83bB`, whose `ADMIN_ACCOUNT` is **GovernanceOAppReceiver** `0x998E…6fF0`. The receiver is owned by that Safe and uses the LZ endpoint `0x3aCA…Fe32`.
- The receiver's only peer is eid 40161 (Sepolia), `0x9096…4932`. On Sepolia that address is the Blockscout-verified **GovernanceOAppSender**, owned by the **Sepolia Aragon DAO**, with `DESTINATION_EID` 40424.
- LZ receive config: a non-default library `0xd682…Ae21`. ULN config: 15 confirmations, **1 required DVN** (`0xa78A…eC2`, `quorum()` = 2 of `signerSize()` = 3), 0 optional.
- So the gateway can be upgraded by either:
  - (a) the 5-EOA Safe directly; or
  - (b) the Sepolia DAO (3-of-5) through LayerZero, provided the 2-of-3 DVN attests.
- Mainnet gateway (261131) governance is **pending**: its RPC is private, per `environments.ts`.

### Is every link ECDSA? **Yes** [V for members; I for DVN signing scheme]
- Multisig approvals are EOA transactions or Safe signatures from EOA owners.
- The Safe uses EOA owners.
- LZ DVN attestations are secp256k1 multisig. This is standard for LayerZero DVNs; the DVN contract is unverified on the gateway explorer.
- I found no PQ link anywhere.

### Can governance undo a seal (C1) or flip the fail-closed flag (C5)? **Yes, trivially** [I from code]
- An ACL upgrade (`upgradeToAndCall`) can:
  - clear `sealed[x]` and `decryptionSignatureInvalidatedBefore[x]`, or ignore them;
  - more simply, make `isAllowed(h, attacker)` true for every handle or set `allowedForDecryption`.
- Per-user seals cannot protect against governance, because governance never needs the victim's key.
- A C5 flag stored in the ACL or ProtocolConfig is set and unset by the same governance.
- **On the deployed path the gateway alone suffices.** The v0.13.8 connector does **not** re-verify the user signature; it only reads `isAllowed` / `isHandleDelegated`.
  - The KMS core validates only the request structure (`kms/core/service/src/engine/validation_non_wasm.rs:222-225`; `docs/guides/entry_points.md:38`).
  - So whoever can upgrade the gateway `Decryption` contract can drop the ECDSA check at :916-925 and obtain re-encryption of any handle readable by any address, to their own ML-KEM key.
  - On main's RFC-016 path the connector re-verifies, so it would also need a host ACL upgrade.
- **Under T2** (CRQC), all governance EOAs have exposed public keys (they sent approvals). Governance is the single largest Q-day target, ahead of any individual user.

### Making a seal (and C5) robust: suggestions

1. **Immutable `SealRegistry`.** No owner, no proxy. `seal()` is one-way. The connector reads it at an operator-pinned address in its config (`charts/kms-connector/configs/contracts-*.yaml`).
   - *Protects:* the seal bit against ACL upgrades, migrations and admin functions. Revival of the old key needs connector-operator cooperation, not just governance.
   - *Does not protect:* governance granting access to *other* addresses through an ACL upgrade; a gateway upgrade on the deployed path; connector code or config changes by a threshold of operators; KMS collusion.
2. **Connector-side implementation pinning (cheap, high value).** Each operator's connector checks the ERC-1967 implementation slot (or its code hash) of the ACL, the gateway Decryption contract and the seal/flag contract against an operator-local allowlist before serving. An unannounced upgrade then halts decryption (fail-closed) instead of leaking. This turns "governance" into "governance AND ≥t operators". The same idea applies to the C5 flag contract.
3. **Upgrade timelock with exit window.** For example a TimelockController or Aragon delay between the multisig and the DAO, so users and operators can react. Today there is none.
4. **C5 as a one-way latch.** It should be engage-only, live in a non-upgradeable contract, and be read by connectors at a pinned address. Note the cost: engaging it permanently disables ECDSA users, so it needs a governance-abuse analysis (Q5).
5. **PQ governance before Q-day.** Multisig members should be PQ smart accounts, or a PQ veto path should exist. Without this, C1, C4 and C5 are moot against T2.

Assessment: the governance design (DAO multisig, no timelock, UUPS everywhere, cross-chain via LayerZero) is deliberate. Its absence from the doc's threat model is an oversight in the doc, not in Zama's code.

---

## 6. Facts for the prototype [V]

- **ACL storage.** ERC-7201 namespace `fhevm.storage.ACL` at `0xa688f31953c2015baaf8c0a488ee1ee22eb0e05273cc1fd31ea4cbee42febc00`. I recomputed this value, and it matches `ACL.sol:188`.
  - Struct order: 0 `persistedAllowedPairs`, 1 `allowedForDecryption`, 2 `userDecryptionDelegations` (`{uint64 expirationDate, uint64 lastBlockDelegateOrRevoke, uint64 delegationCounter}`), 3 `denyList`, 4 `decryptionSignatureInvalidatedBefore` (v0.5.0+ only).
  - **Append** new fields after slot 4.
  - The OZ parents (Ownable2Step, Pausable, Initializable) use their own ERC-7201 namespaces. The implementation pointer is in the ERC-1967 slot.
- **`invalidateDecryptionSignaturesBefore(ts)`** (main :273-285).
  - `resolved = ts == 0 ? block.timestamp : ts`.
  - It reverts `InvalidationTimestampTooLow` if `resolved ≤ stored`, so the value is monotonic. It reverts `InvalidationTimestampInTheFuture` if `resolved > block.timestamp`.
  - It then stores the value and emits `DecryptionSignaturesInvalidated`. It is not pausable and has no deny-list check.
  - The connector rejects when `startTimestamp < invalidatedBefore` (strict; `decryption.rs:522-542`). Equality passes, as the test at :1233 shows.
  - The connector is the only consumer (`rpc.rs:58-67`), compares U256 values, and has no overflow risk with `2^256-1`. A later `invalidate…` call can never lower the value.
  - **Caveat:** in v0.14.2 the legacy path does not read invalidation at all; main's legacy path does (:221-229). So the sentinel's effect depends on the connector version.
- **`isHandleDelegatedForUserDecryption(delegator, delegate, contract, h)`** (main :561-574) returns:
  `persisted[h][delegator] && persisted[h][contract] && (exp(delegator, delegate, WILDCARD) > now || exp(delegator, delegate, contract) > now)`.
  It reads storage directly, not through `isAllowed`.
- **Versioning and upgrades.**
  - `MAJOR/MINOR/PATCH` constants and `getVersion()`.
  - `REINITIALIZER_VERSION` (currently 8) is shared by `initializeFromEmptyProxy()` (`onlyFromEmptyProxy` must precede `reinitializer`) and `reinitializeV7()`.
  - For a new version: MINOR 7→8, REINITIALIZER 8→9, `reinitializeV7`→`reinitializeV8`.
  - Tasks: `task:upgradeACL` for devnet and `task:prepareUpgradeACL` for a DAO payload (`tasks/upgradeContracts.ts:263, 338`). `upgrade-manifest.json` lists the upgradable contracts. Example upgrades are in `examples/ACLUpgradedExample*.sol`.
  - CI conformance: `make check-selectors` (`docs/contract_selectors.txt`) and `make check-bindings` (`rust_bindings`).
- **Tests.**
  - Hardhat: `npm test` or `make test` (`hardhat test --network hardhat`).
    - Mock mode is `createInstanceMocked` (`test/instance.ts:38-51`), with `test/fhevmjsMocked.ts` doing ECDSA `verifyTypedData` (:151-179) plus ACL reads (:182+), and `coprocessorUtils.getClearText`.
    - It does **not** exercise connector logic (invalidation, ERC-1271, sentinel).
  - Foundry: `npm run forge:soldeer && npm run test:forge`, or `make forge-test`. That target runs `ensure-addresses`: Hardhat deploys the empty proxies and PauserSet, generating `addresses/FHEVMHostAddresses.sol`. ACL tests: `test/acl/{acl.t.sol, TestIntegrationACL.t.sol, acl.ts}`.
  - Full stack: `test-suite/fhevm/fhevm-cli up --target latest-main` then `./fhevm-cli test user-decryption`. This is Docker-based; `latest-main` and network targets need `gh` with `read:packages`. `latest-supported` is v0.14.2.
- **Least-diff placement.**
  - ACL.sol: storage field appended; `sealAccount()` next to `invalidateDecryptionSignaturesBefore`, deliberately *without* `whenNotPaused`; errors in ACL.sol; events in `ACLEvents.sol`.
  - Seal enforcement: preferably inside `isAllowed`/`persistAllowed`, which automatically blocks `allow` / `allowForDecryption` / `allowTransient` (they check `isAllowed(h, msg.sender)`), the connector's direct checks (all versions), and dApp deputies. Add explicit checks in `delegateForUserDecryption` and `isHandleDelegatedForUserDecryption`.
  - Connector: `kms-worker/src/core/event_processor/rpc.rs` (new view) and `decryption.rs` (legacy :121-233, RFC-016 :327-436), after regenerating `fhevm_host_bindings` (path dependency `host-contracts/rust_bindings`).
  - C5: an ACL view read by the same host client, or a separate latch contract configured in `contracts-*.yaml`.
- Observation: `charts/kms-connector/configs/contracts-{testnet,mainnet}.yaml` set `ethereum.protocolConfig` to the **KMSVerifier** address (`0xbE0E…`, `0x7762…`), not ProtocolConfig. That may be intentional (KMSVerifier proxies ProtocolConfig reads) or a bug. I did not investigate (**pending**, low priority).

## 7. What should change in the design doc

1. **§1.3, §11.1, Appendix A.** Sepolia **and mainnet** run release 0.13.x (ACL v0.4.0, KMSVerifier v0.3.0, gateway Decryption v0.5.0); they do not run main. Split every finding into "deployed (v0.13.x)" and "main (v0.7.0)" and give both line numbers.
2. **B2.** On deployed contracts there is **no** invalidation at all, which is even weaker. B2 is valid for main/v0.14+ only. E2 must run on a local v0.14+/main stack.
3. **B5/B6.** On the deployed path the gateway checks user signatures with `ECDSA.recover` only. There is no ERC-1271 and no 250k cap. Smart or PQ accounts can only delegate to an ECDSA EOA. A 7702 EOA is still an EOA, so B5 holds trivially. B6 applies only to main/v0.14+. E4 and E5 need a local stack.
4. **B7/R8.** `signing_schemes` exists only in v0.15+ and main.
5. **B1.** Add: the deny list does not cover delegation, recipients, decryption or dApp-mediated disclosure, and the docs (README.md:65) over-claim.
6. **B3.** Add wildcard delegation (one O(1) tx exposes past and future handles) and `multicall` batching. Add the **confused-deputy** problem (ERC7984 `requestDiscloseEncryptedAmount`), and draw the consequence for C1: `notSealed` on ACL writes is insufficient. Sealing should make `isAllowed`/`persistAllowed` return false for the sealed account, plus explicit checks on delegation. This also closes the off-chain direct path for every connector version without relying on the sentinel.
7. **C2.** `allowMany` is largely redundant with `multicall`. `multicall([allow…, sealAccount()])` already gives atomic carry-and-seal once `sealAccount` exists in the ACL. That is the smallest change (Q7).
8. **New B8 and threat model.** Add governance and operator keys under T1/T2. Add mitigations: implementation pinning in the connector, an immutable seal registry, a one-way C5 latch, an upgrade timelock, and PQ governance. State plainly that no per-user seal survives a governance compromise.
9. **Gate G0 has tripped.** Report to Semih before building, per the brief §3/§8.

## Pending
- Mainnet: Sourcify diff of the implementations, relayer routes (API key needed), and gateway 261131 governance (private RPC).
- DVN identity on the gateway testnet (contract unverified).
- The `protocolConfig` address observation above.

## Possible prompt injection
None followed. The fhevm repo contains AI-agent-directed files, for example `relayer-http/CLAUDE.md`. Quote, under 15 words: "This file is living: add a rule or change a description here…". I treated these as data. I edited nothing.
