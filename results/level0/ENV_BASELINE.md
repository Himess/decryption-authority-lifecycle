# Level 0 environment baseline (unmodified Zama code)

**Date:** 2026-10-21 · **Scope:** set up the implementation workspace and verify the *unmodified* baseline that Level 0 will later change. No design changes, no lifecycle code. · **Brief:** `docs/CLAUDE_CODE_BRIEF_ERC_TARGET_DESIGN.md` §1, §5 Level 0; `DESIGN_REVIEW.md` §6.

**Labels.** `[M]` = measured on machine **M1** (below) on 2026-10-21 against the commits listed in §2. `[E]` = estimate or a number printed by a tool as an estimate. Wall-clock durations vary by roughly ±30% between identical runs on M1 (for example the same Hardhat ACL run took 57 s and 80 s).

---

## 0. Result at a glance

| Item | Result |
|---|---|
| Clones | `impl/fhevm-main` at `ed851716c9a6b799996a23399ece2858336f96db`; `impl/fhevm-v0.13.8` at `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5` (tag object `8831fdf943266494fc88c1afb01549e0338905f6`). Both on branch `lifecycle/base`. Tracked files unchanged. |
| **A.** host-contracts ACL tests | **Green with one toolchain setting.** Hardhat `test/acl/acl.ts`: 3/3 on both. Foundry `test/acl/*`: **63/63** (main) and **53/53** (v0.13.8) with `FOUNDRY_ISOLATE=false`. With Foundry 1.8.5 defaults: 48/63 and 39/53. All 15 and 14 failures are transient-storage tests broken by Foundry 1.8.5's new default `isolate = true` (§3.4). Full Foundry suites with `FOUNDRY_ISOLATE=false`: 711/711 (main), 494/494 (v0.13.8). `[M]` |
| **B.** cleartext mock, end to end | **The round trip works.** The unmodified cleartext host stack was deployed on a local anvil with Zama's own deploy script. Fresh local accounts were used: Alice encrypts 424242 with the SDK, then (a) Alice user-decrypts it and (b) Bob decrypts it via Alice's delegation, both through the SDK's cleartext relayer. Two refusal controls fail closed. This was reproduced with the main clone's SDK and with the v0.13.8 clone's SDK. `[M]` |
| Does that path call `persistAllowed` / `isHandleDelegatedForUserDecryption`? | **Yes, at two layers.** (1) The SDK client precheck calls `ACL.persistAllowed` (user and contract) or `ACL.isHandleDelegatedForUserDecryption`. (2) The cleartext relayer calls the on-chain `CleartextKMSVerifier`, which calls `CleartextACL.plaintextFor[Delegated]UserDecryption`, which calls the inherited base-ACL views. File:line references are in §4.4. Both layers were also confirmed at runtime, by recording the RPC calls and running `debug_traceCall`. |
| Zama's own cleartext test suite | **Broken upstream at `ed851716c`, so it cannot run.** `fhetest-deploy.sh` → `FHETest.initFheTest` reverts because the vendored v0.13.0 `CleartextFHEVMExecutor` has no `checkHandleType`, which `library-solidity` ≥ 0.13.6 calls. All 10 `ethers-cleartext` test files fail in setup. The same failure occurs at v0.13.8. Our harness does not need `initFheTest` (§4.5). |
| **C.** connector | **Docker not running** (checked; not started). Per the coordinator's scope change, nothing was built or run locally. Requirements and a container plan are in §5. |
| **SU-1** | **OZ confidential-contracts 0.5.3:** 1 recipient-side assert, `ERC7984Utils.sol:36`. It runs only on the transfer-**AndCall** path and only for recipients that have code (contracts, EIP-7702 EOAs). There are also 2 token-provenance asserts and 16 caller-side checks. **fhevm repo apps and examples:** 0 recipient-side asserts (§6). |

---

## 1. Machine and toolchain (M1)

| | |
|---|---|
| CPU / RAM | AMD Ryzen 5 5600, 6 cores / 12 threads, max 3.5 GHz; 15.9 GB RAM |
| OS | Windows 10 Pro 10.0.19045; all commands run in Git Bash (MSYS2, bash 5.2.37) |
| Node / npm | v22.13.0 / 10.9.2 (Zama CI uses Node 20.x for host-contracts and 22.x for js-sdk) |
| Foundry | forge / anvil / cast **1.8.5** (commit `51a52c59`, built 2026-10-05), from `%USERPROFILE%\.foundry\bin` (prepended to PATH) |
| solc | 0.8.24 for host-contracts (pinned in `foundry.toml` and `hardhat.config.ts`). **0.8.35** for `sdk/js-sdk/contracts` (not pinned there, so Foundry picks the newest installed version; already present in `%APPDATA%\svm`, nothing was downloaded) |
| Hardhat | 2.27.0 (both clones) |
| JS (js-sdk) | vitest 4.1.9 (main) / 4.1.11 (v0.13.8), ethers 6.17.0, viem 2.55.19, TypeScript 6.0.3, tsx 4.23.12 |
| Rust | rustc / cargo 1.95.0 from `%USERPROFILE%\.cargo\bin`. **Not used:** the connector was not built. Its pins, 1.92.0 (v0.13.8) and 1.99.1 (main), are not installed. |
| jq | 1.7.1, downloaded from the GitHub release `jqlang/jq` into `impl/.tools/jq/` (git-ignored). SHA-256 `7451fbbf…b6d6ab` matches the release's `sha256sum.txt`. Required by Zama's deploy scripts. |
| anvil runtime | `anvil/v1.8.5`, default hardfork **`Bpo1`**, chain id 31337, block gas limit 30,000,000, base fee 1 gwei (from `anvil_nodeInfo`) `[M]` |
| Docker | Client 29.2.1. **Daemon not running** (`docker info` → "failed to connect … dockerDesktopLinuxEngine", 2026-10-21T05:01:35Z) |

Libraries the harness uses and which nobody has audited for this purpose: Zama's pre-release SDK source (`@fhevm/sdk` 0.15.0-0, run from source), ethers 6.17.0, vitest 4.x and jq 1.7.1. No cryptographic code was written.

---

## 2. Implementation clones

Both were fetched read-only from GitHub with shallow fetches (depth 1). The reference clones in `scratch/` were only read; in particular, `git hash-object` without `-w` and `git rev-parse <tag>:<path>` read tree objects only.

| Clone | Pinned to | Commit (= `lifecycle/base`) | Notes |
|---|---|---|---|
| `impl/fhevm-main` | `ed851716c` (full hash taken from `scratch/zama/fhevm`) | `ed851716c9a6b799996a23399ece2858336f96db`, "fix(coprocessor): stop a deployment rename…" (#4191), 2026-10-20 | host-contracts package 0.15.0; **ACL v0.7.0** (REINITIALIZER 8); FHEVMExecutor v0.7.0 |
| `impl/fhevm-v0.13.8` | tag `v0.13.8` | `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5` (annotated tag object `8831fdf9…`, which `git ls-remote` confirms), "fix(coprocessor): hotfix TFHE max-degree handling on v0.13" (#4511), 2026-10-16 | host-contracts package 0.10.0; **ACL v0.4.0** (REINITIALIZER 5); FHEVMExecutor v0.5.0 |

How the clones were made:

```bash
git init; git config core.autocrlf false; git config core.longpaths true; git config lfs.fetchexclude '*'
git remote add origin https://github.com/zama-ai/fhevm.git
GIT_LFS_SKIP_SMUDGE=1 git fetch --depth 1 --no-tags origin <full-sha>   # or refs/tags/v0.13.8:refs/tags/v0.13.8
GIT_LFS_SKIP_SMUDGE=1 git checkout -b lifecycle/base <full-sha | 'refs/tags/v0.13.8^{commit}'>
```

- **The `core.autocrlf false` override is local to each clone.** The machine's system config has `autocrlf=true`, which would check files out with CRLF. That changes Solidity source hashes and breaks shell scripts.
- **LFS is skipped.** Only the coprocessor FHE key files use LFS, and Level 0 does not need them; they remain pointer files.
- **Fetch time and size, measured `[M]`:**
  - about 8 s for the fetch and about 5 s for the checkout, for each clone;
  - `.git` is 38 MB (main) and 39 MB (v0.13.8).
- **Agent files in the clones were not used.** The clones contain:
  - `sdk/js-sdk/CLAUDE.md`, `sdk/cli-js-sdk/{CLAUDE,AGENTS}.md`, `listener/…/{CLAUDE,AGENTS}.md`, and in main `relayer-http/CLAUDE.md`;
  - `gateway-contracts/.husky/*` hooks.

  None was opened as an instruction or run, and no agent session was started inside a clone. `--ignore-scripts` keeps husky from installing hooks, and neither clone has a `.claude/settings.json`.
- **Untracked artifacts after all runs** (`git status`, nothing tracked was modified):
  - `sdk/js-sdk/contracts/remappings.txt`, which `forge soldeer install` writes, as it also does in Zama's CI;
  - git-ignored build outputs: `node_modules/`, `dependencies/`, `out/`, `cache*/`, `broadcast/`, `addresses/`, `host-contracts/.env`, `sdk/js-sdk/test/.env.localcleartext`.

---

## 3. Baseline A: host-contracts ACL tests

### 3.1 How Zama runs them

`.github/workflows/host-contracts-hardhat-forge-tests.yml` runs Foundry "stable" (`:47`) and Node 20.x (`:38`), in this order:

| Step | main | v0.13.8 |
|---|---|---|
| env | `cp ./host-contracts/.env.example ./host-contracts/.env` (`:59`) | same (`:52`) |
| install | `npm --workspace=host-contracts ci --include=optional` (`:60`) | same (`:53`) |
| Hardhat | `npm --workspace=host-contracts run test` (`:62`) | same (`:55`) |
| Foundry | `PROVISION_BRIDGE_PROXY=true HARDHAT_NETWORK=hardhat npm run deploy:emptyProxies && forge soldeer install && forge test` (`:64`) | `forge soldeer install && forge test` (`:57`) |

- **The Hardhat `test` task is overridden** (`host-contracts/hardhat.config.ts:89-99` on main, `:83` on v0.13.8). It first deploys the full host stack on the in-process Hardhat network (`task:deployAllHostContracts`). That writes the git-ignored `addresses/` directory, which the Foundry tests import (`addresses/FHEVMHostAddresses.sol`).
- **ACL suites:**
  - Hardhat: `test/acl/acl.ts`, 3 tests, identical in both clones;
  - Foundry: `test/acl/acl.t.sol` (60 tests on main, 50 on v0.13.8) and `test/acl/TestIntegrationACL.t.sol` (3 tests).

### 3.2 What we ran

Script `impl/harness/baselineA_host_contracts.sh <main|v0.13.8> [acl|full]` follows the CI order. Its three deviations are all toolchain-side; Zama's code is untouched:

1. **`npm ci … --ignore-scripts`, then only `npm rebuild sqlite3`.**
   - **Why the binding is needed:** `test/coprocessorUtils.ts:9,21` opens an in-memory SQLite database at import time, so the Hardhat suite needs sqlite3's native binding.
   - **Without it:** `Error: Could not locate the bindings file. Tried: …node_sqlite3.node` (log: `A_fhevm-main_hardhat_test_acl_noscripts.log`).
   - **What the rebuild does:** `prebuild-install -r napi` downloads `sqlite3-v5.1.7-napi-v6-win32-x64.tar.gz` from `github.com/TryGhost/node-sqlite3/releases` (HTTP 200, log `A_fhevm-main_npm_rebuild_sqlite3.log`).
   - **Other skipped install scripts are harmless.** bigint-buffer, keccak and secp256k1 fall back to pure JS ("bigint: Failed to load bindings, pure JS will be used").
2. **`soldeer.lock` is restored after `forge soldeer install`.** Foundry 1.8.5's soldeer rewrites the file to its v2 format, adding only `version = 2`. Checksums and integrity values are unchanged, so the downloaded zip matched Zama's pins. The zip comes from the Soldeer registry (`soldeer-revisions.s3.amazonaws.com`), as in Zama's CI. **Flag:** this is a package registry, but not one of the three sources the brief names (npm, crates.io, GitHub).
3. **`forge test` runs twice:** once with Foundry 1.8.5 defaults and once with `FOUNDRY_ISOLATE=false` (§3.4).

Selected tests: `npx hardhat test test/acl/acl.ts` and `forge test --match-path 'test/acl/*'`.

### 3.3 Results `[M]`

Script runs at 2026-10-21 05:42Z (main) and 05:45Z (v0.13.8):

| | main `ed851716c` | v0.13.8 `fe3ca89b` |
|---|---|---|
| `npm ci` (host-contracts workspace, `--ignore-scripts`) | 958 packages, 154 s | 951 packages, 220 s |
| Hardhat `test/acl/acl.ts` (includes the stack deploy) | **3 passing**, 117 ms mocha time; 80 s wall | **3 passing**, 100 ms; 69 s wall |
| `deploy:emptyProxies` (main only, `PROVISION_BRIDGE_PROXY=true`) | 15 s (108 s on a cold cache) | n/a |
| `forge build` (cold) | 206 files, solc 0.8.24, 70.2 s | 102 files, 7.6 s |
| Foundry ACL, **Foundry 1.8.5 defaults** (`isolate=true`) | 48 passed / **15 failed** / 63; 20 s | 39 passed / **14 failed** / 53; 30 s |
| Foundry ACL, **`FOUNDRY_ISOLATE=false`** | **63/63 passed**; 31 s | **53/53 passed**; 41 s |
| Foundry full suite, `FOUNDRY_ISOLATE=false` (extra) | 711/711 in 16 suites, 53.0 s | 494/494 in 11 suites, 65.4 s |

Fuzz seeds were not fixed; Zama's CI does not fix them either. Logs: `logs/A_*`.

### 3.4 Finding: Foundry 1.8.5 changed the `isolate` default

- **The setting.** `forge config` in an empty directory reports `isolate = true` under Foundry 1.8.5. Zama's `host-contracts/foundry.toml` does not set it.
- **What isolation does.** Each top-level call in a test becomes its own transaction, so EIP-1153 transient storage is cleared between `vm.prank(executor); acl.allowTransient(h, a)` and the next call.
- **Example.** `test_CanAllowTransientIfFhevmExecutor` (`acl.t.sol:255-260`) asserts `allowedTransient(h, a)` right after `allowTransient` and fails. So does every test that uses `_allowHandle` (`acl.t.sol:32-38`) or the `SenderNotAllowed` paths.
- **The failing set** (15 on main; v0.13.8 has the same set minus `test_CanRevokeDelegationForUserDecryptionIfPaused`):
  - `test_AfterRevokeWildcardSpecificDelegationStillValid`, `test_CanAllow`, `test_CanAllowForDecryptionIfSenderIsApprovedToUseHandle`, `test_CanAllowTransientIfFhevmExecutor`;
  - `test_CanDelegateForUserDecryptionAndIsHandleDelegatedForUserDecryptionOnlyIfBothContractAndSenderAreAllowed`, `test_CanRevokeDelegationForUserDecryptionIfPaused`;
  - `test_CannotAllowForDecryptionIfSenderIsNotAllowedToUseOneOfTheHandles`, `test_CannotDelegateForUserDecryptionInSameBlockTwice`;
  - `test_DeniedAccountCannotAllow`, `test_DeniedAccountCannotAllowForDecryption`, `test_DeniedAccountCannotAllowTransient`;
  - `test_RevokeWildcardRemovesDelegationWhenNoSpecificRow`, `test_WildcardDelegationExpiresAtTimestamp`, `test_WildcardDelegationSatisfiesIsHandleDelegatedWithoutPerContractRow`, `test_WildcardDelegationStillRequiresContractAllowedOnHandle`.
- **The fix.** Run with `FOUNDRY_ISOLATE=false` (environment only, no repo change), or pin Foundry to Zama's other pinned version, v1.7.1 (`host-contracts-integrity-checks.yml:71`). With the setting, 100% of the ACL tests pass on both clones. **Level 0 must use `FOUNDRY_ISOLATE=false`**; otherwise these 15 pre-existing failures would hide regressions.

---

## 4. Baseline B: Zama's cleartext mock, end to end

### 4.1 What is deployed

Everything comes from `sdk/js-sdk/contracts`, Foundry profile `v13`.

**The cleartext contracts.** `src/v0.13.0/cleartext/` holds `CleartextACL is ACL`, `CleartextFHEVMExecutor`, `CleartextKMSVerifier`, `CleartextInputVerifier` and others.

**The vendored host contracts** sit in `src/v0.13.0/host-contracts/contracts/`.

- **Provenance.** By blob hash, the vendored `ACL.sol` equals `host-contracts/contracts/ACL.sol` at tags **`v0.13.0-0` … `v0.13.0-3`**. It is *not* the v0.13.8 file.
- **Difference from v0.13.8's ACL** (`diff`): one functional line plus comments. The delegation-expiry check reads `expirationDate >= block.timestamp` (vendored) versus `> block.timestamp` (v0.13.8, `ACL.sol:601`).
- **Versions.** Both are "ACL v0.4.0". The vendored FHEVMExecutor is v0.4.0; v0.13.8's is v0.5.0.
- **Same in both clones.** `sdk/js-sdk/contracts` is identical in the two clones, apart from two shell scripts.

**FHETest** (`src/FHETest.sol`) is Zama's test application, compiled against the clone's own `library-solidity`: 0.15.0 on main, 0.13.6 on v0.13.8.

**Deployed state.** Deterministic addresses, the same as the committed ones:

- ACL `0x50157CFf…755D` reports "ACL v0.4.0";
- KMSVerifier `0x901F8942…B030` has 4 KMS signers;
- FHEVMExecutor `0xe3a9105a…dD24` reports "FHEVMExecutor v0.4.0";
- FHETest `0x61a8e950…D4a0`;
- gateway chain id 654321.

**Size limit.** `CleartextFHEVMExecutor` is 26,573 bytes, above EIP-170's 24,576 (solc 0.8.35, 800 optimizer runs) `[M]`. It deploys only because Zama's runner starts anvil with `--disable-code-size-limit`, and the harness does the same.

### 4.2 The harness

**Entry point:** `impl/harness/baselineB_cleartext.sh [main|v0.13.8] [--zama-suite] [--keep-anvil]`. It runs these steps:

1. **anvil** on `HARNESS_PORT` (default **18557**; the script refuses 8545), with Zama's runner flags `--chain-id 31337 --disable-code-size-limit`. Anvil's startup output lists its default dev keys, so it goes to `$TMPDIR` and never to `results/`.
2. **`sdk/js-sdk/test/.env.localcleartext`** with our `RPC_URL`. Zama's runner writes the same git-ignored file (`localcleartext-run-tests.sh:219`), and Zama's scripts read it *before* the `RPC_URL` environment variable (`lib-common.sh:118-134`).
3. **Zama's deploy, unmodified:** `FOUNDRY_PROFILE=v13 bash scripts/fhevm-deploy.sh --chain localcleartext`, with Zama's default deployer mnemonic. This produces the committed addresses.
4. **Zama's FHETest deploy, unmodified:** `bash scripts/fhetest-deploy.sh --chain localcleartext`. Its last step fails (§4.5). The harness records the failure and continues only if FHETest's code and coprocessor config are on chain; both happen before the failing step.
5. **Our round trip:** `impl/harness/cleartext-roundtrip/roundtrip.test.ts`, run by vitest against the clone's SDK **source**.
   - **How it resolves Zama's code.** The aliases are the same as in Zama's `test/fheTest/vitest.config.ts`. `node_modules` is a junction to the clone's `sdk/js-sdk/node_modules`, so the SDK and the test share one ethers.
   - **Accounts.** Fresh local test accounts come from `impl/harness/.env`, created by `node impl/harness/new_test_mnemonic.mjs`, which prints addresses only. That file is git-ignored by `**/.env` and is used only on local anvil. The accounts are Alice `0x0BaE…13F8`, Bob `0x87c4…6A62` and Carol `0xBa6a…a12A`; anvil funds them with `anvil_setBalance`.
   - **The chain object** copies the deployed addresses but sets `relayerUrl` to `http://127.0.0.1:9`. The cleartext relayer module never makes HTTP requests (`src/core/modules/relayer/cleartext/mock.ts:22-64`), and Zama's `test/chains/localcleartext.ts` points `relayerUrl` at `localhost:8545`, so this is belt and braces.
6. **Optional (`--zama-suite`):** Zama's own runner `test/scripts/localcleartext-run-tests.sh --foundry-profile=v13 --ethlib ethers` against the same node, with `MNEMONIC` set to our fresh mnemonic.

**No live service is contacted.** All RPC traffic goes to `127.0.0.1:<port>`.

### 4.3 Results `[M]`

Main ran three times with the same outcome: 05:36Z (manual), 05:38Z and 05:57Z. The saved logs are from the 05:57Z run. v0.13.8 ran at 05:40Z.

| Step | main clone | v0.13.8 clone |
|---|---|---|
| `fhevm-deploy.sh` (114 files, solc 0.8.35) | rc 0; 25 s and 28 s in the two scripted runs | rc 0, 33 s |
| `fhetest-deploy.sh` | **rc 1** at `initFheTest(true)` (§4.5); FHETest deployed, 12,323 B | **rc 1**, same cause; FHETest 12,475 B |
| Round trip `roundtrip.test.ts` | **5/5 passed**; vitest 3.96-5.18 s, about 1.3 s of it in tests | **5/5 passed**, 4.70 s |
| Zama `ethers-cleartext` vitest suite (`--zama-suite`) | **10/10 files fail in setup, 0 tests run**: "Failed to initialize FHETest handles for 0x0BaE… (initFheTest reverts)"; 19-28 s | not run (same contracts, same cause) |

The five round-trip tests, identical on both clones (from `logs/B_fhevm-*_roundtrip_result.json`):

| # | Test | Outcome | RPC calls the SDK made (recorded) | Relayer call trace (`debug_traceCall`, callTracer) |
|---|---|---|---|---|
| 1 | Alice encrypts uint64 **424242** with `createFhevmCleartextEncryptClient`, then calls `FHETest.setEuint64(handle, proof, …)` | handle stored; `persistAllowed(h, Alice) = true`, `(h, FHETest) = true`, `(h, Bob) = false`, `(h, Carol) = false`; `setEuint64` used 281,405-281,417 gas (main build) / 284,520 (v0.13.8 build) `[M]` | | |
| 2 | **(a) user decryption** by Alice (legacy permit, `UserDecryptRequestVerification`) | **424242** | `ACL.persistAllowed` ×2, then `KMSVerifier.userDecrypt` | KMSVerifier proxy → impl → **STATICCALL ACL `plaintextForUserDecryption`** → impl; ProtocolConfig reads; ecrecover (0x01) |
| 3 | **(b) delegated decryption**: Alice calls `ACL.delegateForUserDecryption(Bob, FHETest, now+1d)` (55,660 gas `[M]`); Bob signs a `DelegatedUserDecryptRequestVerification` permit | **424242** | `ACL.isHandleDelegatedForUserDecryption`, then `KMSVerifier.delegatedUserDecrypt` | … **STATICCALL ACL `plaintextForDelegatedUserDecryption`** … |
| 4 | control: Carol (no grant) tries a user decryption | SDK: `User 0xBa6a… is not authorized to decrypt handle …`; direct `eth_call` to `KMSVerifier.userDecrypt` with Carol's valid signature: revert **`UserNotAuthorizedForDecrypt(h, Carol)`** | | |
| 5 | control: Carol as an undelegated delegate of Alice | SDK: `Delegate 0xBa6a… is not delegated by 0x0BaE…`; direct `eth_call` to `KMSVerifier.delegatedUserDecrypt`: revert **`HandleNotDelegatedForUserDecryption(h, FHETest, Alice, Carol)`** | | |

The relayer took the **on-chain** path because the stack has 4 KMS signers (§4.4, `forgeFhevmV1.ts:42-54`).

The gas figures are incidental: anvil 1.8.5, hardfork Bpo1, FHETest built with solc 0.8.35. They are not the Level 0 measurements.

### 4.4 Code path, with file:line

All references are in `impl/fhevm-main/sdk/js-sdk/` unless stated otherwise. The v0.13.8 SDK has the same cleartext relayer files and showed the same RPC trace.

**Layer 1: SDK client precheck.** This runs for every relayer, real or cleartext.

- `src/core/kms/decryptValuesFromPairs.ts:59` → `fetchKmsSigncryptedSharesV1`.
- `src/core/kms/fetchKmsSigncryptedSharesV1-p.ts:125-139`, step 7 "Check: ACL permissions":
  - for a delegated permit (`:126`), `checkDelegation(...)` (`:127`);
  - otherwise `checkPersistAllowed(...)` (`:134`).
- `src/core/host-contracts/checkPersistAllowed.ts:53-82` builds the `(handle, user)` and `(handle, contract)` pairs and calls `persistAllowed`. `src/core/host-contracts/persistAllowed.ts:56-61` sends `eth_call ACL.persistAllowed(handle, account)`. A user or contract without the grant gets `AclUserDecryptionError` (`:96-110`).
- `src/core/host-contracts/checkDelegation.ts:100-105`, then `isHandleDelegatedForUserDecryption-p.ts:65-70`, sends `eth_call ACL.isHandleDelegatedForUserDecryption(delegator, delegate, contract, handle)`. A missing delegation throws at `:119-127`.

**Layer 2: cleartext relayer, then on-chain mock view.**

- `src/core/modules/relayer/cleartext/fetchUserDecrypt.ts:13` → `fetchUserDecryptV1.ts:188-195` picks the path with `isForgeFhevmV1`. The on-chain path (`:120-161`) sends `eth_call KMSVerifier.userDecrypt(pairs, user, publicKey, contracts, start, days, sig)` (`:132-148`).
- `fetchDelegatedUserDecryptV1.ts:194-200` → on-chain `KMSVerifier.delegatedUserDecrypt(...)` (`:137-153`).
- `contracts/src/v0.13.0/cleartext/CleartextKMSVerifier.sol`:
  - `userDecrypt` (`:225`) calls `CleartextACL(aclAdd).plaintextForUserDecryption(pairs, userAddress)` at **`:246`**;
  - `delegatedUserDecrypt` (`:263`) calls `plaintextForDelegatedUserDecryption(pairs, delegator, delegate)` at **`:286`**;
  - the signature check comes *after* the ACL read (ecrecover only, `:309`), followed by `_requireAllPairsAuthorized` (`:257`, `:299`).
- `contracts/src/v0.13.0/cleartext/CleartextACL.sol`:
  - `plaintextForUserDecryption` (`:222`) runs **`if (!persistAllowed(h, userAddress)) revert UserNotAuthorizedForDecrypt`** (`:236`) and **`if (!persistAllowed(h, c)) revert ContractNotAuthorizedForDecrypt`** (`:239`);
  - `plaintextForDelegatedUserDecryption` (`:246`) runs **`if (!isHandleDelegatedForUserDecryption(delegator, delegate, c, h)) revert HandleNotDelegatedForUserDecryption`** (`:257`).

  These are *internal* calls to the inherited, `public view virtual` base-ACL functions. So a retirement gate added to the base ACL's `persistAllowed` and `isHandleDelegatedForUserDecryption` reaches both the mock view and the SDK precheck.
- Base ACL (vendored v0.4.0, `src/v0.13.0/host-contracts/contracts/ACL.sol`):
  - `persistAllowed` (`:498-501`) reads `persistedAllowedPairs`;
  - `isAllowed` (`:451-453`) = `allowedTransient || persistAllowed`;
  - **`isHandleDelegatedForUserDecryption` (`:477-490`) reads `persistedAllowedPairs[handle][delegator]` directly (`:484`), not through `persistAllowed()`.**

  The same holds in v0.13.8 (`host-contracts/contracts/ACL.sol:478`, `:485`) and main (`:561`, `:568`). A gate only in `persistAllowed` would therefore *not* reach delegated decryption. That confirms DESIGN_REVIEW §6.2's explicit `retired[delegator] || retired[delegate]` edit to the delegated view(s).

**The off-chain "forge-fhevm v1" path does not consult the ACL on chain.**

- **What it does.** `forgeFhevmV1.ts:97-115` reads `CleartextFHEVMExecutor.plaintexts(handle)` with no on-chain ACL check. The comment at `:92-95` says the ACL is enforced by the decrypt caller, so on this path only Layer 1 applies.
- **When it is used.** Only when the KMS signer set is exactly the single forge-fhevm v1 signer (`forgeFhevmV1.ts:42-54`, `signers.ts:35-37`).
- **Consequence for Level 0.** Keep the 4-signer deploy. Otherwise only the SDK precheck is tested.

**Executor checks in the mock.** `CleartextFHEVMExecutor` checks operand access through `acl.isAllowedWithCleartext(ct, msg.sender)`, for example at `CleartextFHEVMExecutor.sol:40-41` and `:161-170`. That function calls `isAllowed` internally with `msg.sender` = executor (`CleartextACL.sol:134-137`), so the Core executor exemption *is* on the mock's compute path.

**The Hardhat mock in host-contracts (main-line ACL).**

- `host-contracts/test/fhevmjsMocked.ts:186-187` also gates user decryption on `acl.persistAllowed(handle, user)` and `(handle, contract)`.
- It has no delegated variant.
- It is the only Zama mock that uses the *main-line* ACL (v0.7.0). The SDK cleartext stack only vendors v0.12.0 and v0.13.0 host contracts at this commit; `foundry.toml` mentions `src/latest/` but no such directory exists.

### 4.5 Finding: Zama's FHETest init is broken on the v13 cleartext stack

**Symptom.**

- `fhetest-deploy.sh:165` (`cast send … "initFheTest(bool)" true`) fails with `Error: Failed to estimate gas: … execution reverted, data: "0x"`.
- This happens in both clones, and also with Zama's own unmodified runner: `B_zama_localcleartext_v13_runner.log`, rc 1 after 32 s, using Zama's default port and mnemonic logic on port 18558.

**Cause, from the trace in `logs/B_initFheTest_revert_trace.log`.**

1. `initFheTest` (`FHETest.sol:525`) → `_zeroEuint8` (`:212-218`) → `FHE.randEuint8()`, then FHE ops.
2. The library validates every handle through `Impl.checkHandleType` → `IFHEVMExecutor.checkHandleType(handle, type)`. This is in `library-solidity/lib/Impl.sol:788-791` (main) and `:707-710` (v0.13.8), called from `FHE._getValidatedFheValue`, for example `FHE.sol:171-177`.
3. The vendored v0.13.0 `CleartextFHEVMExecutor` (FHEVMExecutor v0.4.0) has **no `checkHandleType`**. A direct `cast call` to it reverts with empty data. v0.13.8's real FHEVMExecutor v0.5.0 has the function (`host-contracts/contracts/FHEVMExecutor.sol:833`), and so does main's v0.7.0 (`:874`).

**Why Zama's CI misses it.** `.github/workflows/js-sdk-tests.yml:114` runs `npm run dod`, and `test/scripts/dod.mjs:31-43` does not include `test:localcleartext:*`.

**Impact on us.** Zama's own cleartext vitest suites cannot run at either pin: `setupCommon.ts:547` → `runPreliminaryFheTestSetup` → `initFheTest`.

**How our harness avoids it.** It uses SDK-encrypted inputs and `FHETest.setEuint64(…, proof, …)`. `FHE.fromExternal` with a non-empty proof takes `Impl.verify` and never calls `checkHandleType`.

**What would fix it.** This is Zama's change to make; we did not patch it.

- re-sync `src/v0.13.0/host-contracts` to v0.13.8 with Zama's `scripts/SyncHostContracts.s.sol`, which brings FHEVMExecutor v0.5.0 with `checkHandleType`; or
- add `checkHandleType` to `CleartextFHEVMExecutor`.

### 4.6 Notes for Level 0 reuse

The harness takes the clone as a parameter and reads addresses and constants from the clone's own files (`FHEVMHostAddresses.sol`, `fhevm-deploy.sh`, `chain-defaults.json`).

- **Where to put the modified ACL.** `CleartextACL` imports its parent by *relative path* (`CleartextACL.sol:4`: `../host-contracts/contracts/ACL.sol`). A remapping cannot redirect it, so a Level 0 branch must replace `sdk/js-sdk/contracts/src/v0.13.0/host-contracts/contracts/ACL.sol` with the 0.4.1 backport.
  - Base the backport on **v0.13.8's** `ACL.sol`, then mind the one-line expiry difference from §4.1.
  - Storage namespaces do not collide: `fhevm.storage.CleartextACL` (`0x824fadfb…2400`) versus the planned `fhevm.storage.ACLRetirement` (`0xe6ae1005…6200`).
- **Testing the main-line Core (ACL v0.8.0).** The SDK cleartext mock cannot test it at this commit, because no "latest" profile exists. Two candidate paths: the Hardhat mock flow in `host-contracts/test` (`fhevmjsMocked.ts:186-187`), or a new vendored set produced with Zama's sync script. *I don't know yet* which one the deliberation prefers.
- **Pin solc if gas or bytecode size matter.** Pass `FOUNDRY_SOLC_VERSION=<x>` when running `fhevm-deploy.sh`: `sdk/js-sdk/contracts` does not pin solc, and this machine used 0.8.35.
- **Extend `roundtrip.test.ts`** with the Level 0 cases: carry, then retire; NEW decrypts; OLD is refused; delegations from or to OLD are refused. The RPC recorder and the trace helper already show *which* view refused, client precheck or on-chain mock.

---

## 5. Baseline C: connector (documented, not run)

**Docker.** The daemon is not running (§1). It was not started, because Docker Desktop may ask for licence acceptance. The coordinator then moved the real-connector work to Semih's VPS, so locally nothing was built, run or pulled.

### 5.1 What the unmodified ACL tests are

| | v0.13.8 (`kms-connector/`) | main (`kms-connector/`) |
|---|---|---|
| Rust pin (`rust-toolchain.toml`) | **1.92.0** | **1.99.1** + rustfmt, clippy |
| Host-ACL mock | `crates/utils/src/tests/setup/host.rs:11-30`: alloy `Asserter` pre-loaded with ABI-encoded `bool` replies, wrapped in `ACL::new(Address::default(), mocked provider)`. It returns canned answers and never runs a real ACL | `host.rs:22-41`: same `Asserter` approach, but takes raw ABI bytes (so it can mix `bool`, `uint256` and the ERC-1271 magic value, `:13-17`) |
| ACL calls in the worker | `crates/kms-worker/src/core/event_processor/decryption.rs`: `isAllowedForDecryption` `:99`; `isHandleDelegatedForUserDecryption` `:201`; **`isAllowed(handle, user)` and `isAllowed(handle, contract)` `:229-230`** (not `persistAllowed`) | `crates/kms-worker/src/core/event_processor/rpc.rs`: `isAllowedForDecryption` `:24-30`, `isAllowed` `:32-42`, `isHandleDelegatedForUserDecryption` `:44-56`, `decryptionSignatureInvalidatedBefore` `:58-67`, ERC-1271 `verify_signature` `:69-` |
| `tests/acl.rs` | `crates/kms-worker/tests/acl.rs`: `test_decryption_acl_failure`, 2 cases (public, user), 60 s timeout. ACL mock returns `false` (`:62-68`); the gateway is an `Asserter` that returns a mock tx; the KMS is a `mocktail` gRPC `MockServer` with no expectations, because the request must fail before reaching the KMS | `crates/kms-worker/tests/acl.rs`: 6 cases (public, user, user_v2, each also with `already_sent`) |
| DB | `DbInstance::setup()`: **testcontainers `GenericImage::new("postgres","17.5")`** (`setup/db.rs:18`), so **Docker is required** | **`DbInstance::setup_external()`** (`tests/acl.rs:51`): an already-running Postgres at `DATABASE_URL`, default `postgresql://postgres:postgres@localhost:5432/postgres` (`setup/db.rs:13`). Zama runs it from `connector-db/docker-compose.yml` (`postgres:17.5`) via `make test-ci`. `setup_container()` still exists for other tests |
| Positive-path template | `tests/integration_tests.rs:40-58`, `test_processing_request` (ACL mock `vec![true, true]` `:91-94`, KMS mocktail mocks `:105`) | same file and pattern |
| Worker constructor that takes the ACL map | `tests/common/mod.rs:20-29`: `init_kms_worker(config, gateway_provider, acl_contracts: HashMap<u64, ACLInstance<HP>>, db)`, generic over `HP: Provider` | same pattern |
| Other test containers (not needed for `acl.rs`) | anvil container `ghcr.io/foundry-rs/foundry:v1.3.5` (`setup/blockchain.rs:182`); `quay.io/minio/minio:latest` (`s3.rs:29`); Zama KMS images `ghcr.io/zama-ai/kms/core-service`, `core-client` (`kms.rs:35,95`) | anvil as a local **binary** via `alloy::node_bindings::Anvil` (`setup/blockchain.rs:186-201`) |
| Zama CI | `kms-connector-tests.yml`: Rust "stable", `arduino/setup-protoc` 26.x, Docker, Foundry; `cargo test` | `make test-ci` = compose Postgres up → `cargo nextest run` (`SQLX_OFFLINE=true`) → down; **protoc 34.1** with pinned SHA-256 `af27ea66…6904` (`.github/actions/setup-rust-and-protoc/action.yml`); `cargo-nextest` |

**Build-time requirements, the same for both clones unless noted.**

- **protoc.** `kms-grpc` is a git dependency (v0.13.8: `zama-ai/kms` tag `v0.13.20-0`; main: rev `511ac7e0…`). Its `core/grpc/build.rs` calls `tonic_prost_build::compile_protos`, and the build-dependency is only `tonic-prost-build`, so a system `protoc` is needed (read from GitHub raw at both refs).
- **A C toolchain** (gcc or clang, make, perl). `Cargo.lock` has `aws-lc-sys` (0.39.0 / 0.45.0, `cmake` crate present: install `cmake` too), `ring` 0.17.14 and `libsqlite3-sys` 0.30.1.
- **main only:** `openssl-sys` 0.9.117, which needs `pkg-config` and `libssl-dev`.
- **Zama's own build image.** `golden-container-images/rust-glibc/Dockerfile` installs `gcc build-base openssl-dev protoc protobuf perl make git postgresql-client`.
- **Offline SQL checks.** `.sqlx/` caches are committed (47 / 82 queries), so compile-time SQL checks need no database (`SQLX_OFFLINE=true`).
- **Binding paths.** `fhevm_host_bindings` and `fhevm_gateway_bindings` are *path* dependencies on the committed `host-contracts/rust_bindings` and `gateway-contracts/rust_bindings`. The worker calls only existing ACL views, so a Core ACL with new functions needs **no binding change** for the connector.
- **Windows-native builds are not viable** without extra work (protoc, NASM/cmake for aws-lc on MSVC, OpenSSL through vcpkg), and testcontainers needs Docker anyway. Hence the Linux plan below.

### 5.2 Plan for the real-connector proof (Linux container or VPS)

1. **Base image.** `rust:<pin>-bookworm` (1.92.0 for v0.13.8, 1.99.1 for main) plus `apt-get install protobuf-compiler cmake clang pkg-config libssl-dev git`. Pin protoc to Zama's CI version (26.x for v0.13.8; 34.1 with the SHA-256 above for main). Mount the clone read-write at `/src` and use a separate `CARGO_TARGET_DIR` volume. Expect tens of GB of target output and a long first build `[E]`.
2. **Postgres.**
   - v0.13.8: testcontainers needs the host Docker socket. Run `docker run --network host -v /var/run/docker.sock:/var/run/docker.sock …` on a Linux host. Without host networking, set `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal`, because testcontainers maps container ports on the host.
   - main: start `postgres:17.5` (`docker compose -f connector-db/docker-compose.yml up -d --wait kms-connector-db`) and export `DATABASE_URL=postgresql://postgres:postgres@<host>:5432/postgres`.
3. **Unmodified baseline first.**
   - v0.13.8: `cargo test -p kms-worker --test acl -- --nocapture`;
   - main: `SQLX_OFFLINE=true cargo nextest run -p kms-worker --test acl`, or `cargo test -p kms-worker --test acl`.

   Record the pass count. The expectation from the code is 2/2 and 6/6, not measured.
4. **Real ACL in place of the `Asserter`. No connector production code changes.**
   - Add a *new* test file that builds the ACL map as `ACL::new(acl_address, ProviderBuilder::new().connect_http(anvil_url))` and passes it to `init_kms_worker` (`tests/common/mod.rs:20`).
   - The map is keyed by the chain id embedded in the handle, so it must be 31337 for handles minted on anvil.
   - Deploy the real host ACL on anvil first, then mint handles and grants.
   - Mock the gateway (the `Asserter` returning a request tx carrying the *real* handle, user and contract) and the KMS (`mocktail`) exactly as `tests/acl.rs` and `tests/integration_tests.rs` do.
   - The v0.13.8 worker's `eth_call`s carry no `from`, so the ACL sees a non-executor caller.
5. **Assertions for Level 0.**
   - retired user → request marked failed and never reaches the KMS mock;
   - never-retired user → forwarded;
   - delegated with a retired delegator or delegate → failed.

---

## 6. SU-1 compatibility survey: post-grant `isAllowed(h, recipient)` asserts

**The question.** Is there code that asserts `FHE.isAllowed(h, X)` or `ACL.isAllowed(h, X)` for an `X` that has just been *granted* access (a transfer recipient), and would therefore revert once `isAllowed(h, retired) == false` for non-executor callers?

**Sources searched.** All `.sol` files in OZ confidential-contracts 0.5.3 (`experiments/node_modules/@openzeppelin/confidential-contracts`). All tracked `.sol` files and `.md` docs in both fhevm clones: host-contracts, library-solidity, test-suite/e2e, protocol-contracts, gateway-contracts, `sdk/js-sdk/contracts`. I also searched `persistAllowed`, `isHandleDelegatedForUserDecryption`, `isUserDecryptable` and `isAllowedForDecryption` in app code.

### 6.1 OZ confidential-contracts 0.5.3 (19 `FHE.isAllowed` call sites)

| Class | Location | What it asserts | Impact once Core lands |
|---|---|---|---|
| **HIT: recipient-side** | `token/ERC7984/utils/ERC7984Utils.sol:36`, inside `checkOnTransferReceived` (`:24-52`), executed only if `to.code.length > 0` (`:31`) | `!FHE.isInitialized(retval) \|\| FHE.isAllowed(retval, to)`: the `ebool` returned by the recipient's `onConfidentialTransferReceived` must be ACL-held by the recipient `to` | It is reached from `ERC7984._transferAndCall` (`ERC7984.sol:268-284`, call at `:278`), which serves `confidentialTransferAndCall` (`:149`, `:159`), `confidentialTransferFromAndCall` (`:169`, `:181`) and the Omnibus `…AndCallOmnibus` variants (via `ERC7984Omnibus.sol:200`). For a **retired recipient with code** (a contract or an **EIP-7702 EOA**), the whole AndCall transfer **reverts**: either here with `ERC7984UtilsUnauthorizedUseOfEncryptedAmount`, or earlier when the recipient's own `FHE.allowTransient(retval, token)` (an ACL write by a retired account) reverts and the try/catch at `:40-47` bubbles it up. This fails closed: the sender's balance is untouched. **Unaffected:** plain `confidentialTransfer` / `confidentialTransferFrom` and EOAs without code. `_update` grants to `to` (`ERC7984.sol:315`, `:320`) with no post-grant check, so for those, inbound transfers stay "accepted and inert". **Severity: low**, but it is an exception to "transfers to OLD succeed" (DESIGN_REVIEW §6.4 test 8) for the AndCall variants. It also refines DESIGN_REVIEW Appendix A, SU-1 ("OZ itself doesn't do this"). |
| Token provenance (not the recipient) | `finance/VestingWalletConfidential.sol:149` (`_checkTokenHandleAccess`, called after `confidentialTransfer(owner(), …)` at `:86` and at `:102`) | `isAllowed(handle, token)` | Reverts only if the **token contract itself** is retired, which bricks it anyway. A retired beneficiary `owner()` is fine: `FHE.allow(newReleasedAmount, owner())` (`:90`) is a write *by the wallet*, so it is accepted and inert. |
| Token provenance | `token/ERC7984/utils/ERC7984HookModule.sol:128` (`_accessHandle`) | `isAllowed(handle, token)` | Same: only a retired token is affected. |
| Caller-side (intended) | `ERC7984.sol:122, 141, 164, 187, 201`; `ERC7984HookModule.sol:24, 35` (`msg.sender` = token); `extensions/ERC7984Rwa.sol:113, 133, 155, 218`; `extensions/ERC7984ERC20Wrapper.sol:95`; `extensions/ERC7984Omnibus.sol:92, 93, 156, 157` | `isAllowed(x, msg.sender)` before using a caller-supplied handle | Intended Core behaviour: a retired caller cannot spend, disclose or unwrap with its handles (DESIGN_REVIEW §6.4 test 3). |

Also checked; no assert after granting:

- `ERC7984ObserverAccess` (`FHE.allow` to observers at `:33`, `:53-59`);
- `HandleAccessManager`, `BatcherConfidential`, `ERC7984Freezable`, `ERC7984Restricted`, `VotesConfidential`;
- OZ makes no `persistAllowed`, `isUserDecryptable` or delegation-view calls.

### 6.2 fhevm repo (main `ed851716c`; v0.13.8 checked too)

**No recipient-side post-grant asserts in apps or examples.** Every `isAllowed` / `isSenderAllowed` use is caller-side or a self-check:

- `FHE.isSenderAllowed(amount)`:
  - `host-contracts/examples/EncryptedERC20.sol:89, 120, 155` (v0.13.8: `:89, 122, 159`);
  - `library-solidity/examples/EncryptedERC20.sol:88, 119, 154` (v0.13.8: `:88, 121, 158`);
  - `test-suite/e2e/contracts/EncryptedERC20.sol:87, 118, 153` (v0.13.8: `:87, 120, 157`).
- `host-contracts/examples/bridge/ConfidentialOFT.sol:72` (`isSenderAllowed`, send side).
- Bridge `send`: `host-contracts/contracts/bridge/HandlesSender.sol:351` checks `isAllowed(handle, msg.sender = srcApp)`. A retired source app cannot bridge; this is intended (DESIGN_REVIEW §6.4 test 3).
- Bridge receive: `HandlesReceiver.sol:220` *grants* `allowTransient(dstHandle, dstApp)`. Neither destination app (`ConfidentialOFT`, `ConfidentialMultiChainToken`) re-asserts it afterwards.
- `sdk/js-sdk/contracts/src/FHETest.sol:57`: `Impl.isAllowed(handle, address(this))`, a self-check.
- Library internals: `FHE.fromExternal(h, "")` checks `Impl.isAllowed(h, msg.sender)` (for example `library-solidity/lib/FHE.sol:7190`), caller-side. `FHE.isUserDecryptable` / `isDelegatedForUserDecryption` (`FHE.sol:8173-8193`) are helpers with no in-repo app callers.
- Comment-only mentions: `HandlesListConfidentialOApp.sol:30,101,242`, `ConfidentialOFT.sol:80`, `ConfidentialMultiChainToken.sol:77`, `ConfidentialMultiChainRandomGenerator.sol:71`, `test-suite/e2e/contracts/erc1271/*.sol`.
- **Docs.** `docs/solidity-guides/acl/acl_examples.md:93-134` and `functions.md:377-403` recommend only `isSenderAllowed` and self `isAllowed(r, address(this))`.

**Test-only post-grant recipient asserts.** They do not revert in production. They remain true for never-retired accounts and are the natural places for Level 0's retired-recipient negatives:

- `library-solidity/test/bridge/ConfidentialMultiChainToken.t.sol:247-248, 308-310, 370-371` ("recipient must be allowed on new balance");
- `host-contracts/test/bridge/HandlesListConfidentialOApp.t.sol:314-316, 362-363`.

### 6.3 Related observations: not SU-1, but relevant to Core

- **The connector checks `isAllowed`, not `persistAllowed`.** In v0.13.8 the kms-worker checks `isAllowed(handle, user / contract)` (`decryption.rs:229-230`), whereas the SDK precheck and the cleartext mock use `persistAllowed`. Core gates both views, so this does not matter for correctness, but the two components use different functions.
- **`isAllowed` changes meaning for every non-executor `eth_call`er.** That includes indexers, which DESIGN_REVIEW already notes (D17).

---

## 7. Reproduce from scratch

Use Git Bash on Windows, or bash on Linux. Run from `fhe-authority-lifecycle/`.

```bash
# 0. toolchains: Foundry 1.8.5 and Rust are off PATH on M1; lib/env.sh prepends them and impl/.tools/jq.
#    jq (Windows): put jq-windows-amd64.exe from github.com/jqlang/jq/releases/tag/jq-1.7.1 at impl/.tools/jq/jq.exe

# 1. clones (see §2 for the exact git commands; both end on branch lifecycle/base)

# 2. Baseline A (CI order; writes results/level0/logs/A_*):
bash impl/harness/baselineA_host_contracts.sh main acl
bash impl/harness/baselineA_host_contracts.sh v0.13.8 acl
#    full Foundry suites instead of only test/acl/*:   ... <clone> full   (also runs the full Hardhat suite)

# 3. Baseline B (fresh mnemonic created on first run in impl/harness/.env; addresses printed, never the phrase):
node impl/harness/new_test_mnemonic.mjs            # optional, the script does it if .env is missing
HARNESS_PORT=18557 bash impl/harness/baselineB_cleartext.sh main --zama-suite
HARNESS_PORT=18559 bash impl/harness/baselineB_cleartext.sh v0.13.8
#    result JSON: results/level0/logs/B_fhevm-<clone>_roundtrip_result.json
#    keep the node for manual poking: add --keep-anvil (then stop it yourself)

# 4. Manual pieces, if needed:
#    FOUNDRY_ISOLATE=false forge test --match-path 'test/acl/*'      (in <clone>/host-contracts)
#    RPC_URL=http://127.0.0.1:<port> FOUNDRY_PROFILE=v13 bash scripts/fhevm-deploy.sh --chain localcleartext   (in sdk/js-sdk/contracts)
```

The scripts are idempotent: they skip `npm ci` and soldeer when `node_modules/` and `dependencies/` already exist.

---

## 8. Deviations, caveats and things I don't know

1. **Not Zama's CI toolchain.** These runs used Windows, Git Bash, Node 22 and Foundry 1.8.5; Zama's CI uses Linux, Node 20 and Foundry "stable". The isolate default (§3.4) is the only behavioural difference found.
2. **`npm --ignore-scripts`, then exactly one install script** (sqlite3's prebuilt binary from GitHub). Soldeer downloads came from the Soldeer registry's S3 bucket, as Zama's CI does. This registry is not in the brief's list of allowed sources.
3. **npm runs package scripts with Git Bash** (`npm_config_script_shell`), because Zama's scripts assume a POSIX shell, for example `--contract 'contracts/immutable'`.
4. **Baseline B depends on two git-ignored files the harness writes into the clone,** exactly as Zama's runner does: `sdk/js-sdk/test/.env.localcleartext` and the deploy `broadcast/` and `cache/` directories. The `cache/` directory holds forge's "sensitive values" file for Zama's public test deployer keys; it stays inside the clone and is never copied to `results/`.
5. **Port 8545 was never used.** The harness refuses it, and the cleartext relayer does no HTTP.
6. **Docker was not started,** so the connector is unverified locally. The §5 expectations (2/2, 6/6) come from reading the code; nothing was run.
7. **I don't know** whether Zama intends `sdk/js-sdk/contracts/src/v0.13.0` to stay pinned to a `v0.13.0-x` pre-release. If it is re-synced to v0.13.8, the FHETest break (§4.5) disappears and the vendored ACL picks up the `>` expiry semantics.
8. **I don't know** which main-line mock path Level 0 should use for ACL v0.8.0 (§4.6).

---

## 9. Files

- `results/level0/ENV_BASELINE.md`: this file.
- `results/level0/logs/`: raw outputs.
  - `A_fhevm-<clone>_summary.txt`: per-run summaries, including `hardhat_test_acl`, `forge_test_acl_isolate-default` and `forge_test_acl_isolate-false`.
  - `A_fhevm-<clone>_forge_test_full_isolate-false.log` and `A_forge_full_summary.txt`.
  - `A_fhevm-main_hardhat_test_acl_noscripts.log`: the sqlite3 failure.
  - `B_fhevm-<clone>_summary.txt`, `B_fhevm-<clone>_roundtrip_result.json`, `B_fhevm-main_zama_vitest_ethers_cleartext.log`.
  - `B_zama_localcleartext_v13_runner.log` and `B_initFheTest_revert_trace.log`.
- `impl/harness/`:
  - `lib/env.sh`: PATH and port setup.
  - `baselineA_host_contracts.sh`.
  - `baselineB_cleartext.sh`.
  - `new_test_mnemonic.mjs`.
  - `cleartext-roundtrip/vitest.config.mts` and `cleartext-roundtrip/roundtrip.test.ts`.
  - `.gitignore`.
  - `.env`: git-ignored; the fresh local test mnemonic.
- `impl/.tools/jq/`: git-ignored; jq 1.7.1 and its checksum file.
