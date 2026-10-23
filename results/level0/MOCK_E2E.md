# Level 0 Core in Zama's cleartext mock, end to end (gate G2-mock, part 1)

**Date:** 2026-10-21. **Scope:** DELIBERATION_SUMMARY §(c) c.11, "Zama cleartext mock". The Level 0 Core runs end to end in Zama's own cleartext mock (`sdk/js-sdk/contracts`, v0.13.0 stack), locally on anvil, with `CleartextACL` re-pointed at the ACL v0.4.1 backport. **Status:** done; 15/15 scenario tests pass in three consecutive full runs. Committed locally, nothing pushed.

> **Label: proven in mock: `persistAllowed` + delegated view + flow; plaintext is public in the mock.**

This proves that the mock's decryption views and the SDK flow honour retirement. It does **not** prove confidentiality: any caller can read the cleartext from the mock's public getters (§2.6). It does **not** prove the connector's `isAllowed` path either; that belongs to the real-connector harness.

**Labels.**

| Label | Meaning |
|---|---|
| [M] | Measured on machine M1 on 2026-10-21; final run 08:49Z UTC |
| [E] | Derived from measured numbers; the method is stated |
| [V] | Verified in code or in compiled output |
| [I] | Inference |

The configuration for every [M] figure:

| Item | Value |
|---|---|
| Machine (M1) | AMD Ryzen 5 5600, 12 logical CPUs, 15.9 GiB RAM, Windows 10 Pro 10.0.19045, Git Bash |
| Clone | `impl/fhevm-v0.13.8`, branch `lifecycle/level0-mock`, commit `228e85f` (parent `06d769f` = `lifecycle/level0`) |
| Chain | anvil 1.8.5, hardfork Bpo1, chain id 31337, block gas limit 30M, base fee 1 gwei |
| Compiler | solc 0.8.35, optimizer on with 800 runs, no via-IR, `evmVersion` osaka (the SDK's `v13` profile) |
| JS toolchain | Node 22.13.0, vitest 4.1.11, ethers 6.17.0 |
| SDK | `@fhevm/sdk` 0.13.2-0, the clone's own source, unmodified |

**The three limits** apply unchanged:
1. Pre-emptive, not a clawback.
2. Oracle access only.
3. As final as the chain's governance.

---

## 0. Result at a glance

**Gate G2-mock (mock part): PASS.** The mock honours retirement as specified. No workaround was needed, and no SDK or mock-contract change beyond the ACL re-pointing.

| # | Scenario | Outcome [M] | Who refused (§2.5) |
|---|---|---|---|
| 1 | Never-retired U decrypts its own handle (control) | `424242` | n/a: both layers allow; the trace passes the gate at `ACL.sol:599` |
| 1 | Delegated decryption U → D (control) | `424242` | n/a: the trace passes the gate at `ACL.sol:578`, then the pair and expiry checks |
| 2 | OLD carries five handles to NEW and retires in **one** `ACL.multicall([allow(h_i, NEW) ×5, retireAccount()])` | Five `Allowed` events, then `AccountRetired(OLD, 0x0)`. `isAccountRetired(OLD)` is true. | n/a |
| 2 | NEW user-decrypts the carried history | `1001, 1002, 77, 42, true` (euint64 ×2, euint32, euint8, ebool) | n/a |
| 2 | OLD user-decrypts its own history | **refused** | All four layers. On chain: `UserNotAuthorizedForDecrypt` at `CleartextACL.sol:237` (check at `:236`) |
| 2 | Reverse order `multicall([retireAccount(), allow(h, NEW)])` | **Reverts** with `SenderRetired(OLD)`; the mined tx has status 0. Afterwards OLD is not retired and NEW has no grant. | on-chain ACL |
| 3 | Delegation **from** OLD (OLD as delegator, created before retirement) | **refused** | All four layers. `HandleNotDelegatedForUserDecryption` at `:258` (check at `:257`) |
| 3 | Delegation **to** OLD (OLD as delegate of X, created before retirement) | **refused** | All four layers, same site |
| 3 | Delegation to OLD renewed by X **after** the retirement | Accepted and inert (R8): the tx succeeds, the request is still **refused** | All four layers, same site |
| 3 | OLD creates a new delegation | **Reverts** with `SenderRetired(OLD)`; mined status 0; nothing is stored | on-chain ACL |
| 4 | A contract that holds handles (`RetirableVault`) retires through its helper `retire()` | `AccountRetired(vault, 0x0)` | n/a |
| 4 | Its handle, direct path, contract role | **refused** | All four layers. `ContractNotAuthorizedForDecrypt` at `:240` (check at `:239`) |
| 4 | Its handle, delegated path, contract role (delegator and delegate not retired) | **refused** | All four layers. `HandleNotDelegatedForUserDecryption` at `:258`, through the **contract** gate at `ACL.sol:578` |
| 5 | Every read refusal, attributed per layer | 6 of 6 refused by **each** of L1, L2, L3a and L3b | see §2.5 |

**The four layers:**

| Layer | What it is |
|---|---|
| L1 | The SDK precheck |
| L2 | The SDK's own cleartext relayer, called with the precheck skipped |
| L3a | `CleartextKMSVerifier`, called directly |
| L3b | `CleartextACL`, called directly |

**Answers to the brief:**
- **Call path, re-confirmed:** see §3.
- **SDK-side changes needed: none** (§4).
- **Gas [M]:**
  - `retireAccount()` costs **50,116** gas as a transaction, or 53,148 when a contract calls it through its helper.
  - The carry multicall costs **224,200** at n = 5, 90,980 at n = 1 and 390,759 at n = 10. That is ≈ 33,308 per handle plus ≈ 57,672 fixed [E] (§5).

---

## 1. What was run

### 1.1 Re-pointing `CleartextACL` at ACL v0.4.1 (branch `lifecycle/level0-mock`)

**Why replace files rather than change the import:**
- `CleartextACL` imports its parent by relative path (`CleartextACL.sol:4`), so a remapping cannot redirect it.
- Re-pointing that import at `../../../../../../host-contracts/contracts/ACL.sol` would make the backport's `../addresses/FHEVMHostAddresses.sol` resolve to `host-contracts/addresses/`. That directory is generated, git-ignored and holds other addresses, so the executor constant, and with it the exemption, would point at the wrong contract.

**The change.** Commit `228e85f` replaces the two vendored files with **byte-identical** copies of the backport:

| Vendored file | Replaced with | Blob |
|---|---|---|
| `sdk/js-sdk/contracts/src/v0.13.0/host-contracts/contracts/ACL.sol` | `host-contracts/contracts/ACL.sol` @ `61be560` | `57bc6f5c…` |
| `sdk/js-sdk/contracts/src/v0.13.0/host-contracts/contracts/ACLEvents.sol` | `host-contracts/contracts/ACLEvents.sol` @ `61be560` | `80c2cbc5…` |

Everything else the backport imports is already identical in the vendored tree: `shared/UUPSUpgradeableEmptyProxy.sol`, `interfaces/IPauserSet.sol`, `emptyProxyACL/EmptyUUPSProxyACL.sol` and OpenZeppelin 5.1.0 [V]. `CleartextACL.sol` is unchanged.

**The patch.**
- File: `contracts/level0/mock-repoint.patch` (`git diff lifecycle/level0 lifecycle/level0-mock`). It touches 2 files, +174/−14.
- It applies cleanly to a fresh `git archive` of `lifecycle/level0` and reproduces both blobs exactly.
- **Starting point.** The vendored file was ACL v0.4.0 from the `v0.13.0-x` pre-release, with delegation expiry `>=`. The patch therefore also carries the v0.13.8 expiry semantics (`>`), as c.1 prescribes. No test pins an expiry second.

**Compiles [M].**
- With profile `v13` and `--skip test`, the build succeeds (`raw/mock/M_forge_build_v13.log`).
- Runtime sizes:

  | Contract | Before (vendored v0.4.0) | After (backport) |
  |---|---|---|
  | `CleartextACL` | 12,874 B | **14,377 B** |
  | Vendored `ACL` | 9,995 B | 11,558 B |

  The "before" control build is `M_forge_build_v13_base.log`.
- The only EIP-170 overrun is the pre-existing `CleartextFHEVMExecutor` at 26,573 B, the same as in the baseline. anvil runs with `--disable-code-size-limit`, as Zama's runner does.

**No override [V].** The compiled AST lists the functions `CleartextACL` defines itself (`raw/mock/M_static_checks.log` §1):
- Only `allow`, `allowTransient` and `allowForDecryption` override the base. All three call `super`, so the backport's grant-path checks apply.
- `CleartextACL` defines none of these: `persistAllowed`, `isHandleDelegatedForUserDecryption`, `isAllowed`, `getUserDecryptionDelegationExpirationDate`, `delegateForUserDecryption`, `retireAccount`, `isAccountRetired`, `supportsInterface`, `retirementStorageLocation`, `_authorizeUpgrade`, `_retired`.
- Each resolves to the re-pointed `src/v0.13.0/host-contracts/contracts/ACL.sol`, for example `persistAllowed` at `:597` and `isHandleDelegatedForUserDecryption` at `:571`.

### 1.2 Deployment, signers and identity checks [M]

**Deployment.** Zama's own scripts ran unmodified, as in Baseline B:
- `scripts/fhevm-deploy.sh --chain localcleartext` (profile `v13`, which runs `DeployCleartextFHEVMHost.s.sol`);
- then `scripts/fhetest-deploy.sh`.

**Known `initFheTest` failure.** The FHETest script's last step, `initFheTest`, reverts as documented in ENV_BASELINE §4.5. FHETest is deployed and configured before that step: `0x61a8…D4a0`, 12,475 B, coprocessor config pointing at the stack.

**What the run checked before any scenario:**
- **ACL version.** `ACL v0.4.1` is on chain; `supportsInterface(0x556d2088)` returns true; `retirementStorageLocation()` returns `0xe6ae…6200`.
- **The deployed mock is this build.** Both runtime codes equal the analysis build (immutables masked):
  - the ACL proxy's implementation, `0x6933…ba1e`;
  - the KMSVerifier's implementation, `0xc8d8…2f3f`.
- **A non-forge signer set.** `getKmsSigners()` returns **4** signers with threshold 1, and the forge-fhevm v1 signer is absent. `forgeFhevmV1.ts:53` therefore selects the on-chain path.
- **The on-chain path is taken.** Every positive control's recorded RPC calls end in `KMSVerifier.userDecrypt` or `delegatedUserDecrypt`. Its call trace contains the `CleartextACL.plaintextFor[Delegated]UserDecryption` frame.

**Accounts.**
- **Fresh random wallets** are created in memory for every run: U, D, OLD, NEW, DOLD, X, Z, VOWNER, WU, WD, R, OLD1 and OLD10. Each gets 100 test ETH with `anvil_setBalance`.
- Only their addresses are recorded, in `M_result.json`.
- anvil runs `--quiet` on an OS-assigned local port (port 8545 is refused), so it prints no dev keys.
- A key scan of `raw/mock/` finds none of the anvil or Zama test keys, and no 32-byte hex string in the deploy and build logs.

### 1.3 Scenario 4's app contract

`impl/harness/level0-mock/contracts/src/RetirableVault.sol` is test-only, local only and 2,135 B. It is compiled against the clone's own `library-solidity` (FHE 0.13.6) with the same compiler settings.

**How it holds handles:**
1. `deposit` takes an SDK-encrypted input through `FHE.fromExternal`.
2. It grants the handle to itself and to the depositor.
3. So the contract is persistently allowed on every handle it stores.

**How it retires.** `retire()` (owner only) calls `ACL.retireAccount()`, so `msg.sender` is the contract.

**Why `Impl.allow`.** The grants use `Impl.allow`, exactly as Zama's FHETest does. `FHE.allow` first calls `checkHandleType`, which the vendored v0.13.0 `CleartextFHEVMExecutor` lacks (ENV_BASELINE §4.5).

---

## 2. Scenarios

### 2.1 S1: controls

- **U's handle.** U encrypts `424242` (euint64) with the SDK and stores it in FHETest with `setEuint64` (287,276 gas [M]).
- **Direct decryption.** U user-decrypts it: `424242`. The SDK precheck reads `ACL.persistAllowed` twice, then the relayer calls `KMSVerifier.userDecrypt`.
- **Delegated decryption.** U calls `delegateForUserDecryption(D, FHETest, now + 1 day)` (57,904 gas [M]). D then decrypts `424242` through `isHandleDelegatedForUserDecryption`, then `KMSVerifier.delegatedUserDecrypt`.

**The gate in a never-retired control.** The opcode-level line paths (§3.3) show the gate being evaluated and passed:
- user path: `CleartextACL.sol:236 → ACL.sol:597 → :599`;
- delegated path: `CleartextACL.sol:257 → ACL.sol:571 → :578 → :581-582` (pair checks) `→ :745-746` (expiry) `→ :586-587`.

### 2.2 S2: carry and retire

**OLD's history.** OLD stores five handles in Zama's FHETest:

| Type | Value |
|---|---|
| euint64 | 1001 |
| euint64 | 1002 (a later value; the first handle keeps its grants) |
| euint32 | 77 |
| euint8 | 42 |
| ebool | true |

**Positive controls before retirement:**
- OLD decrypts all five handles;
- DOLD decrypts OLD's handle by delegation;
- OLD decrypts X's handle by delegation;
- NEW is refused (no grant yet).

**Reverse order first.** OLD sends `multicall([retireAccount(), allow(h0, NEW)])`:

| Check | Result |
|---|---|
| Static call | `SenderRetired(OLD)` |
| Mined with an explicit gas limit | **status 0**, 63,565 gas |
| `isAccountRetired(OLD)` afterwards | false |
| `persistAllowed(h0, NEW)` afterwards | false |
| `persistAllowed(h0, OLD)` afterwards | true |

The retirement rolled back with the failed grant: the batch is atomic.

**Carry.** OLD sends `multicall([allow(h_i, NEW) ×5, retireAccount()])`:
- status 1, **224,200 gas**;
- events: `Allowed(OLD, NEW, h_i)` ×5, then `AccountRetired(OLD, 0x0)`;
- afterwards `isAccountRetired(OLD)` is true, `persistAllowed(h_i, NEW)` is `[true ×5]` and `persistAllowed(h_i, OLD)` is `[false ×5]`.

**NEW decrypts the carried history** through the SDK in one request: `1001, 1002, 77, 42, true`.

**OLD is refused** at every layer (§2.5, R1). The raw storage shows why:
- the grant pair `persistedAllowedPairs[h0][OLD]` still holds `1`;
- OLD's retirement bit holds `1`.

So the refusal comes from the retirement gate at `ACL.sol:599`, not from a missing grant.

### 2.3 S3: delegations

Both delegations were created **before** the retirement.

**From OLD (R2).** OLD is the delegator; DOLD requests.
- Refused at every layer.
- The trace exits the delegated view at `ACL.sol:578 → :579` (`return false`) and never reaches the pair or expiry checks (`:581-587`).
- `getUserDecryptionDelegationExpirationDate(OLD, DOLD, FHETest)` returns 0 (the gated getter).
- The raw delegation still holds an expiry in the future, and the raw pairs for OLD and FHETest are still `1`.
- **The delegation was never revoked; only the retirement gate refuses.**

**To OLD (R3).** OLD is the delegate of X; OLD requests X's handle.
- Refused at every layer, same exit at `:578 → :579`.
- X itself still decrypts its handle (control).

**Renewed after retirement (R3b).** X calls `delegateForUserDecryption(OLD, FHETest, now + 2 days)`. The tx succeeds (40,792 gas): it is accepted and inert, per R8. OLD's request is still refused at every layer.

**OLD's grant paths are closed** (mined, each status 0):

| Call by OLD | Error | State afterwards |
|---|---|---|
| `delegateForUserDecryption(Z, FHETest, …)` | `SenderRetired(OLD)` | getter 0, raw slot 0 |
| `allow(h0, Z)` | `SenderRetired(OLD)` | raw pair `(h0, Z)` is 0 |
| `retireAccount()` again | `AccountAlreadyRetired(OLD)` | — |

### 2.4 S4: a retired contract

**Setup and controls before retirement:**
- VOWNER deploys `RetirableVault`.
- WU deposits an SDK-encrypted `5000` (263,931 gas [M]), so the vault holds handle h.
- WU delegates to WD for the vault.
- Both controls pass: WU decrypts h with contract = vault (`5000`), and WD decrypts h by delegation (`5000`).

**Retirement.** VOWNER calls `vault.retire()`:
- status 1, 53,148 gas;
- event `AccountRetired(vault, 0x0)`;
- `isAccountRetired(vault)` is true.

**Refusals:**
- **Direct path, contract role (R4).** WU requests h with contract = vault and is refused at every layer: `ContractNotAuthorizedForDecrypt(h, vault)`, revert statement `CleartextACL.sol:240`, after the user check at `:236` **passed**. `persistAllowed(h, WU)` is still true and `persistAllowed(h, vault)` is false, while the raw pair `(h, vault)` is still `1`.
- **Delegated path, contract role (R5).** WD requests h (delegator WU, contract vault) and is refused at every layer: `HandleNotDelegatedForUserDecryption`, statement `:258`. **Neither WU nor WD is retired**, so the refusal comes from the **contract** gate in the delegated view (`ACL.sol:578`, `$r.retired[contractAddress]`). That gate is spec correction (a), new in Level 0. The getter returns 0 while the raw delegation expiry is still in the future.

**The contract's own grant path is closed.** `vault.shareBalance(Z)`, an `ACL.allow` called by the vault, reverts with `SenderRetired(vault)` (mined, status 0).

**Control.** WU's own FHETest handle (`777`) still decrypts: only the contract's role is affected.

### 2.5 S5: refusals per layer

For each refusal the harness runs four layers. Each request uses a **valid** permit signed by the requester, so the ACL is the only failing check. The mock reads the ACL before checking the signature: `CleartextKMSVerifier.sol:246` and `:286` run before `:252` and `:292`.

| Layer | What runs | How "refused" is decided |
|---|---|---|
| **L1** SDK precheck | `client.decryptValues(…)` | It throws `AclUserDecryptionError` (an `instanceof` check against the SDK's own class) with the message pinned at `checkPersistAllowed.ts:102`/`:111` or `checkDelegation.ts:125`. The RPC recorder shows only `persistAllowed` or `isHandleDelegatedForUserDecryption` calls, **never** `userDecrypt` or `delegatedUserDecrypt`: the relayer was never reached |
| **L2** SDK cleartext relayer, precheck skipped | The SDK's own `runtime.relayer.fetchUserDecrypt` or `fetchDelegatedUserDecrypt` (`mock.ts:50-51`), called directly with the same permit | The SDK relayer sends `KMSVerifier.userDecrypt` or `delegatedUserDecrypt`, and the on-chain mock reverts with the typed error |
| **L3a** `CleartextKMSVerifier`, direct | `eth_call` of `userDecrypt` or `delegatedUserDecrypt` | It reverts with the typed error. The call trace shows the error rising through `KMSVerifier` proxy → implementation → `ACL` proxy (`plaintextFor…`) → `CleartextACL` implementation |
| **L3b** `CleartextACL`, direct | `eth_call` of `plaintextForUserDecryption` or `plaintextForDelegatedUserDecryption` | It reverts with the typed error |

The revert site is tied to source in two independent ways (§3.3):
- the last `CleartextACL.sol` statement executed in the ACL frame before `REVERT`, from the opcode trace and the build's source map;
- the error's unique `revert` statement in the compiled AST.

They agree in every case.

| Id | Retired subject, role | L1 | L2 | L3a | L3b | Typed error; revert statement (check) | Raw state at refusal |
|---|---|---|---|---|---|---|---|
| R1 | OLD, user (direct) | refused | refused | refused | refused | `UserNotAuthorizedForDecrypt`; `CleartextACL.sol:237` (`:236`) | pair (h, OLD) = 1, retired bit = 1 |
| R2 | OLD, delegator | refused | refused | refused | refused | `HandleNotDelegatedForUserDecryption`; `:258` (`:257`); exits at `ACL.sol:578→579` | pairs = 1, raw expiry in the future, getter 0 |
| R3 | OLD, delegate | refused | refused | refused | refused | same; `:258` (`:257`) | same |
| R3b | OLD, delegate; renewed after retirement | refused | refused | refused | refused | same; `:258` (`:257`) | same |
| R4 | vault, contract (direct) | refused | refused | refused | refused | `ContractNotAuthorizedForDecrypt`; `:240` (`:239`) | pair (h, vault) = 1, retired bit = 1 |
| R5 | vault, contract (delegated) | refused | refused | refused | refused | `HandleNotDelegatedForUserDecryption`; `:258` (`:257`); exits at `ACL.sol:578→579` | pairs = 1, raw expiry in the future, getter 0 |

Write paths have no SDK precheck: transactions go straight to the chain, and the **on-chain ACL** refuses them. They appear in §2.2–2.4: the reverse multicall, `delegateForUserDecryption`, `allow`, a second `retireAccount`, and the vault's `shareBalance`.

### 2.6 What the mock does not prove

`CleartextACL.plaintext(bytes32)` and `CleartextFHEVMExecutor.plaintexts(bytes32)` are public views with no ACL check. After OLD's retirement, an unrelated caller still reads `1001` from OLD's first handle through both [M]. So the mock proves:
- the ACL views (`persistAllowed` and the delegated view);
- the SDK and relayer **flow** that consults them.

It proves no confidentiality. It also does not exercise the connector's `isAllowed` path (ENV_BASELINE §6.3); "proven in real connector" is a separate gate.

---

## 3. Call path, SDK → cleartext relayer → `CleartextACL.sol:236/239/257`, re-confirmed on the re-pointed build

**Where these references point.** All paths below are in `impl/fhevm-v0.13.8` at `228e85f`. The SDK lines are this clone's SDK; they differ from the main-clone references in ENV_BASELINE §4.4. The analyser pins every line in the build it just made, and all pins pass (`raw/mock/M_static_checks.log` §2 and §2b).

### 3.1 SDK side (`sdk/js-sdk/src/…`)

1. `core/actions/decrypt/decryptValues.ts:49` (or `decryptValue.ts:47`) calls `decryptValuesFromPairs`.
2. `core/kms/decryptValuesFromPairs.ts:65` calls `fetchKmsSigncryptedSharesV1`.
3. `core/kms/fetchKmsSigncryptedSharesV1-p.ts:125` is step 7, "ACL permissions" (**L1, the SDK precheck**):
   - **user permit** (`:134`): `checkPersistAllowed`
     - `core/host-contracts/checkPersistAllowed.ts:79` calls `persistAllowed.ts:56`, which sends `eth_call ACL.persistAllowed(h, user)` and `(h, contract)`;
     - it throws `AclUserDecryptionError` at `:100-103` (user) or `:109-112` (contract);
   - **delegated permit** (`:127`): `checkDelegation`
     - `core/host-contracts/checkDelegation.ts:100` calls `isHandleDelegatedForUserDecryption-p.ts:65`, which sends `eth_call ACL.isHandleDelegatedForUserDecryption(delegator, delegate, contract, h)`;
     - it throws at `:123-126`.
4. `fetchKmsSigncryptedSharesV1-p.ts:173` (user) or `:161` (delegated) calls `context.runtime.relayer.fetch[Delegated]UserDecrypt`. The runtime wires in the cleartext relayer at `ethers/internal/runtime-ct.ts:20`, from `core/modules/relayer/cleartext/mock.ts:50-51`.
5. **Cleartext relayer (L2 calls this layer directly):**
   - user: `cleartext/fetchUserDecrypt.ts:14` calls `fetchUserDecryptV1.ts:188` (`isForgeFhevmV1`, false for 4 signers per `forgeFhevmV1.ts:53`), then `:194` `runUserDecryptOnChain`, then `:132-148` `eth_call KMSVerifier.userDecrypt(...)` (address at `:134`);
   - delegated: `cleartext/fetchDelegatedUserDecryptV1.ts:194`, then `:200`, then `:137-153` `eth_call KMSVerifier.delegatedUserDecrypt(...)` (`:139`).

### 3.2 Contract side (`sdk/js-sdk/contracts/src/v0.13.0/…`)

6. `cleartext/CleartextKMSVerifier.sol`:
   - `:225` `userDecrypt` calls **`:246`** `CleartextACL(aclAdd).plaintextForUserDecryption(pairs, userAddress)`;
   - `:263` `delegatedUserDecrypt` calls **`:285-286`** `plaintextForDelegatedUserDecryption(pairs, delegator, delegate)`;
   - the signature check comes afterwards (`:252-256`, `:292-298`).
7. `cleartext/CleartextACL.sol`:
   - `:222` `plaintextForUserDecryption`:
     - **`:236`** `if (!persistAllowed(h, userAddress))`, then `:237` `revert UserNotAuthorizedForDecrypt`;
     - **`:239`** `if (!persistAllowed(h, c))`, then `:240` `revert ContractNotAuthorizedForDecrypt`;
   - `:246` `plaintextForDelegatedUserDecryption`: **`:257`** `if (!isHandleDelegatedForUserDecryption(delegator, delegate, c, h))`, then `:258` `revert HandleNotDelegatedForUserDecryption`.

   These are internal calls to inherited `public view virtual` functions; the AST check confirms that `CleartextACL` overrides none of them.
8. Re-pointed `host-contracts/contracts/ACL.sol` (= the backport, blob `57bc6f5c`):
   - `persistAllowed` at `:597-600`: retirement gate `&& !_retired().retired[account]` at **`:599`**;
   - `isHandleDelegatedForUserDecryption` at `:571-588`: retirement gate at **`:577-580`**. The delegator, delegate **and contract** are all checked at `:578`, before the pair checks (`:582-584`) and the expiry checks (`:585-587`).

### 3.3 Re-confirmation at runtime [M]

**Frames.** For every refusal, `debug_traceCall` (callTracer) of the L3a call shows four frames, each carrying the same typed error:

| Depth | Call | Function |
|---|---|---|
| 0 | `CALL` to the `KMSVerifier` proxy `0x901F…B030` | `userDecrypt` |
| 1 | `DELEGATECALL` to the implementation `0xc8d8…2f3f` | `userDecrypt` |
| 2 | `STATICCALL` to the `ACL` proxy `0x5015…755D` | `plaintextForUserDecryption` |
| 3 | `DELEGATECALL` to the `CleartextACL` implementation `0x6933…ba1e` | `plaintextForUserDecryption` |

The delegated variant is analogous.

**Line paths.** An opcode trace of the same call is mapped to source lines through the analysis build's deployed source map; that build is byte-identical to the deployed implementations (§1.2). Excerpts from the final run (`M_result.json`, `onchainLinePath`):

Each path starts at the `KMSVerifier` → ACL handoff. "…" stands for the argument-decoding lines `CleartextACL.sol:225-233` and the dispatcher entry `ACL.sol:481`.

```
R1 OLD, user:        CleartextKMSVerifier.sol:246 > CleartextACL.sol:222 > … > CleartextACL.sol:236 > ACL.sol:597 > ACL.sol:599 > ACL.sol:597
                     > CleartextACL.sol:236 > CleartextACL.sol:237 > ACL.sol:346 (shared revert tail) > CleartextKMSVerifier.sol:246
R4 vault, contract:  CleartextKMSVerifier.sol:246 > CleartextACL.sol:222 > … > CleartextACL.sol:236 > ACL.sol:597 > ACL.sol:599 > ACL.sol:597
                     > CleartextACL.sol:236 > CleartextACL.sol:239 > ACL.sol:597 > ACL.sol:599 > ACL.sol:597 > CleartextACL.sol:239
                     > CleartextACL.sol:240 > ACL.sol:346 (shared revert tail) > CleartextKMSVerifier.sol:246
R2 OLD, delegator:   CleartextKMSVerifier.sol:286 > CleartextACL.sol:246 > … > CleartextACL.sol:257 > ACL.sol:571 > ACL.sol:578 > ACL.sol:576
                     > ACL.sol:578 > ACL.sol:579 > ACL.sol:599 > ACL.sol:597 (shared return block) > CleartextACL.sol:257
                     > CleartextACL.sol:258 > ACL.sol:346 (shared revert tail) > CleartextKMSVerifier.sol:286
S1 control (deleg.): CleartextKMSVerifier.sol:286 > CleartextACL.sol:246 > … > CleartextACL.sol:257 > ACL.sol:571 > ACL.sol:578 > ACL.sol:576
                     > ACL.sol:578 > ACL.sol:581 > ACL.sol:582 > ACL.sol:746 > ACL.sol:745 > ACL.sol:746 > ACL.sol:586 > ACL.sol:746
                     > ACL.sol:745 > ACL.sol:746 > ACL.sol:587 > ACL.sol:585 > ACL.sol:571 > CleartextACL.sol:257 > CleartextACL.sol:260
```

R3, R3b and R5 follow R2's path exactly; the `ACL.sol` lines visited are identical (`aclSolLinesVisited` in `M_result.json`).

**Why some entries are not real calls.** With the optimizer on, three kinds of entry come from shared code:
- the dispatcher, mapped to `ACL.sol:481`;
- the deduplicated revert tail, which the source map attributes to `ACL.sol:346`;
- the shared "return false" block after `:579`, attributed to `ACL.sol:599/597` even though `isHandleDelegatedForUserDecryption` never calls `persistAllowed`.

**How the revert site is found.** The final `REVERT` opcode lies in that shared tail, so the harness does not read the site from it. It takes the last `CleartextACL.sol` statement executed before the `REVERT`. It then requires that statement to equal the error's single `revert` statement in the compiled AST: `:237`, `:240` and `:258`, each the only site for its error (`M_static_checks.log`).

---

## 4. SDK-side changes: none

**The SDK is unmodified.**
- The harness runs the clone's SDK source as-is, through the same aliases as Zama's own vitest config.
- `git status` of the clone after every run shows only the untracked `sdk/js-sdk/contracts/remappings.txt`, which soldeer writes (as in the baseline).

**Internal imports (test-only).** The test imports three SDK internals to build layers L1 and L2, from the same module instances the client uses:
- `toFhevmHandle` and `initPublicAction`, to call the cleartext relayer module with the precheck skipped;
- the `AclUserDecryptionError` class.

**Observation, not a change.** `FhevmErrorBase` (`core/errors/FhevmErrorBase.ts:42-45`) overwrites `name` with `"FhevmErrorBase"` for every SDK error. A wallet can therefore tell `AclUserDecryptionError` apart only with `instanceof` or by the message. This bears on the Level 2 "typed `ACCOUNT_RETIRED`" item. A retirement refusal is currently indistinguishable by type from any other ACL refusal; the SDK has no `isAccountRetired` call.

---

## 5. Gas [M]

All values are transaction `gasUsed` from anvil receipts. They include intrinsic and calldata gas, under the configuration in the header (commit `228e85f`).

| Operation | gasUsed |
|---|---|
| `retireAccount()` by a fresh EOA (R) | **50,116** |
| `retireAccount()` by a contract through its helper (`vault.retire()`, called by its owner) | **53,148** |
| Carry `multicall([allow(h_i, NEW) ×n, retireAccount()])`, n = 1 (OLD1) | 90,980 |
| Carry, n = 5 (scenario 2, OLD) | **224,200** |
| Carry, n = 10 (OLD10) | 390,759 |
| Carry, derived per handle, (n10 − n1) / 9 [E] | ≈ 33,308 |
| Carry, derived fixed part [E] | ≈ 57,672 (check: 57,672 + 5 × 33,308 = 224,212 against 224,200 measured) |

**For reference:**

| Operation | gasUsed |
|---|---|
| Reverse-order multicall (fails, status 0) | 63,565 |
| `delegateForUserDecryption` (first) | 57,904 |
| Re-delegation to the retired OLD | 40,792 |
| `setEuint64` | 287,276 |
| `vault.deposit` | 263,931 |

The refused writes (status 0) cost:

| Refused write | gasUsed |
|---|---|
| `delegateForUserDecryption` by OLD | 31,838 |
| `allow` by OLD | 36,358 |
| Second `retireAccount` | 28,470 |
| `vault.shareBalance` | 43,435 |

**Repeatability.** The final run equals the earlier passing run (`M_result_runA.json`) in every figure except carry n = 10, which is +12 gas. That comes from calldata zero-byte variance: the accounts and handles are random.

**Context, from a different setup.** LEVEL0_CONTRACTS §4 measured, on main's production profile (solc 0.8.24, host-contracts ACL v0.8.0, anvil Prague):

| Measurement | LEVEL0_CONTRACTS | This mock | Difference |
|---|---|---|---|
| `retireAccount` transaction | 50,099 | 50,116 | +17 |
| Carry, per handle | 31,385 | ≈ 33,308 | ≈ +1,923 |

[I] The difference per handle matches `CleartextACL.allow` reading `handleSaved[handle]` (one cold SLOAD, 2,100) before `ACL.allow`. These are mock figures, not production figures.

---

## 6. Deviations, caveats and things to know

1. **solc pinned by environment.** `FOUNDRY_SOLC_VERSION=0.8.35` is set for every forge call, including Zama's deploy scripts. The SDK's `v13` profile leaves solc unpinned; 0.8.35 is the version it resolved to in Baseline B. No file changed.
2. **The whole-project build fails, before and after the re-pointing.** A plain `forge build` of `sdk/js-sdk/contracts` fails because Zama's own `test/FHETest*.t.sol` import `forge-std-1.11.0/Script.sol` and `Test.sol`, which the soldeer remapping does not resolve. It fails identically on the unmodified vendored ACL (`M_forge_build_v13_base.log`). The compile check and the analysis build therefore use `--skip test`. Zama's deploy uses `forge script`, which is unaffected.
3. **Upstream issues, handled as in Baseline B:**
   - `initFheTest` reverts (FHETest is still deployed and configured);
   - `CleartextFHEVMExecutor` exceeds EIP-170 (anvil runs with `--disable-code-size-limit`).
4. **Accounts.** They are fresh random in-memory wallets per run, not the `impl/harness/.env` mnemonic, so addresses differ between runs. Each run records its own addresses.
5. **The harness was corrected twice, without relaxing any expectation about the mock.** The first two full runs failed 5 of 15 tests on harness assertions. In both, every layer refused as expected, with the same typed errors and SDK messages as in §2.5. I inspected those outcomes before changing the harness; the later runs overwrote those two runs' logs.
   - (a) The test expected the SDK error's `name` to read `AclUserDecryptionError`. The SDK sets `name` to `FhevmErrorBase` for every error (§4). The test now checks `instanceof`, the class name and the pinned message.
   - (b) The first revert-site check read the location of the `REVERT` opcode, which lies in the optimizer-shared tail (`ACL.sol:346`). A selector-push cross-check then failed: solc's constant optimiser does not emit the `UserNotAuthorizedForDecrypt` and `ContractNotAuthorizedForDecrypt` selectors as PUSH immediates at all; the selectors are absent from the bytecode. The site is now the last `CleartextACL.sol` statement executed before `REVERT`, and it must equal the unique AST revert statement (§3.3). Selector pushes are still recorded, as information only.
6. **Additions beyond the brief, not deviations:**
   - L2, the SDK relayer with the precheck skipped;
   - raw-storage evidence that only the retirement bit changed;
   - a delegation to the retired OLD renewed after its retirement (R8);
   - the retired accounts' grant paths (OLD's and the vault's) reverting with `SenderRetired`;
   - deployed-bytecode identity;
   - the "plaintext is public" demonstration.
7. **Out of scope here:**
   - the real-connector proof ("proven in real connector", the only place the `isAllowed` path is proven);
   - the main-line Core (ACL v0.8.0), which this SDK mock cannot host: no "latest" profile exists (ENV_BASELINE §4.6);
   - Level 1–3 items.
8. **Local only.** Every RPC went to `127.0.0.1` on an ephemeral port. The cleartext relayer performs no HTTP; the chain's `relayerUrl` is `http://127.0.0.1:9`. No Zama service was contacted, `scratch/` was not touched, the commit stays local and nothing was pushed.

---

## 7. Reproduce

Prerequisites:
- the v0.13.8 clone on `lifecycle/level0-mock`;
- the clone's `sdk/js-sdk/node_modules` and `sdk/js-sdk/contracts/dependencies`, as left by `impl/harness/baselineB_cleartext.sh v0.13.8`;
- Foundry 1.8.5, Node 22, Git Bash.

From `fhe-authority-lifecycle/`:

```bash
# 0. the re-pointed branch (already committed; to rebuild it from the patch instead):
git -C impl/fhevm-v0.13.8 checkout lifecycle/level0-mock
#    git -C impl/fhevm-v0.13.8 checkout -b lifecycle/level0-mock lifecycle/level0 && \
#    git -C impl/fhevm-v0.13.8 apply "$PWD/contracts/level0/mock-repoint.patch"

# 1. everything (anvil on a free local port, Zama's deploy, static checks, scenarios, gas):
bash impl/harness/level0-mock/run_mock_e2e.sh            # add --keep-anvil to poke the node afterwards
#    fixed port instead of an OS-assigned one (never 8545):
MOCK_PORT=18571 bash impl/harness/level0-mock/run_mock_e2e.sh

# 2. results
cat results/level0/raw/mock/M_summary.txt                 # steps, toolchain, test list, git status, key scan
less results/level0/raw/mock/M_result.json                # every layer, trace, view, raw slot and gas figure

# 3. the patch
git -C impl/fhevm-v0.13.8 diff lifecycle/level0 lifecycle/level0-mock > contracts/level0/mock-repoint.patch

# 4. compile checks alone (from impl/fhevm-v0.13.8/sdk/js-sdk/contracts)
FOUNDRY_PROFILE=v13 FOUNDRY_SOLC_VERSION=0.8.35 forge build --skip test --sizes   # exit 1 only from the known CleartextFHEVMExecutor EIP-170 overrun
```

A full run takes about 1 minute on M1: deploy ≈ 22 s, scenarios ≈ 17 s.

## 8. Files

**Code:**
- `impl/fhevm-v0.13.8`, branch `lifecycle/level0-mock`, commit `228e85f`;
- the patch, `contracts/level0/mock-repoint.patch`.

**Harness** (`impl/harness/level0-mock/`):

| File | Role |
|---|---|
| `run_mock_e2e.sh` | Driver |
| `mock-e2e.test.ts` | Scenarios 1–5 and gas |
| `vitest.config.mts` | Test config |
| `analyze_build.mjs` | AST override check, line pins, unique raise sites, source-map bundle |
| `contracts/src/RetirableVault.sol`, `contracts/foundry.toml` | Scenario 4's app contract |

`.build/`, `node_modules` and `.vite-cache/` are git-ignored.

**Raw outputs** (`results/level0/raw/mock/`):

| File | Contents |
|---|---|
| `M_summary.txt` | Final run |
| `M_result.json` | Final run, machine-readable |
| `M_vitest.log` | Test output |
| `M_static_checks.log` | Static checks |
| `M_fhevm_deploy.log`, `M_fhetest_deploy.log` | Zama's deploy |
| `M_analysis_build.log`, `M_vault_build.log` | Builds |
| `M_forge_build_v13.log` | Re-pointed compile; attempt 1 shows the pre-existing `test/` import failure |
| `M_forge_build_v13_base.log` | Control build on the unmodified vendored ACL |
| `M_result_runA.json`, `M_summary_runA.txt` | Earlier passing run, kept for repeatability |
