# Level 0 (Core) contracts: Decryption Authority Lifecycle in Zama's host contracts

**Date:** 2026-10-21. **Scope:** contracts and Foundry tests, local only (DELIBERATION_SUMMARY §(c) c.1–c.11, Foundry parts; semantics §(b) R1–R14). **Status:** implemented on both required lines, all suites green, nothing pushed.

**Labels.** [M] measured on machine M1 (AMD Ryzen 5 5600, 6 cores, 15.9 GB RAM, Windows 10 Pro 10.0.19045; Git Bash), Foundry/forge/anvil 1.8.5 (`51a52c59`, 2026-10-05), solc 0.8.24, Node 22.13.0, on 2026-10-21 against the commits in §1.1. [E] estimate or derived number (method stated). [I] inference. [V] verified in code.

**The three limits** (unchanged by this work): retirement is (1) pre-emptive, not a clawback; (2) oracle access only; (3) as final as the chain's governance. The upgrade guard implemented here narrows limit 3 for accidental releases only, not for a lying implementation (U7).

---

## 0. Result at a glance

| | main (`fhevm-main`) | v0.13 line (`fhevm-v0.13.8`) |
|---|---|---|
| ACL version | 0.7.0 → **0.8.0**, REINITIALIZER 8 → **9**, `reinitializeV8()` | 0.4.0 → **0.4.1**, REINITIALIZER 5 → **6**, `reinitializeV5()` |
| Branch `lifecycle/level0` (from `lifecycle/base`) | `0fbe9a6` contracts, `8e2cd34` tests, `5e61f3d` Hardhat test | `61be560` contracts, `e02d3e2` tests, `06d769f` Hardhat test |
| Zama's Foundry ACL suites (`acl.t.sol` + `TestIntegrationACL.t.sol`) | **63/63** (baseline 63/63) | **53/53** (baseline 53/53) |
| Zama's full Foundry suite | **711/711** of Zama's tests, inside 791/791 | **494/494** of Zama's tests, inside 569/569 |
| New Foundry tests | **80/80** (5 files) | **75/75** (4 files) |
| Zama's Hardhat `test/acl/acl.ts` + `test/upgrades/upgrades.ts` | **11/11** | **10/10** |
| Zama CI `ci/upgrade-check` (version + reinitializer naming) | pass: ACL bytecode changed, bumps correct; FHEVMExecutor and all other contracts byte-identical | pass, same |
| Zama CI `ci/abi-compat` | pass: 8 ABI additions, 0 removals | pass, same |
| OZ upgrades-core `validate` | 0.4.0→0.4.1, 0.7.0→0.8.0, 0.4.1→0.8.0 pass; reverse direction correctly fails | 0.4.0→0.4.1 pass |
| Upgrade matrix | U0–U5, U7 pass as specified, with **one spec correction (U5, §5 D1)**; U6 (optional) not done | U1 and the in-line U3/U4/U4b/U4c/U5/U7 analogues pass |
| ACL runtime size, production settings (EIP-170 limit 24,576 B) | 10,818 → **12,480 B** | 10,124 → **11,571 B** |
| Executor gas per operand vs the spec's ±25 | **not met: +44 to +92** (§4.3, §5 D2) | **not met: +114 to +137** |

Not in this task's scope and not done: the cleartext-mock re-pointing and end-to-end mock run, the real-connector harness, coprocessor host-listener match arms, Rust binding regeneration, the optional 0.14 line (0.5.1) and U6 (§6).

---

## 1. What was implemented

### 1.1 Workspaces and commits

| Clone | `lifecycle/base` | `lifecycle/level0` (oldest first) |
|---|---|---|
| `impl/fhevm-main` | `ed851716c9a6b799996a23399ece2858336f96db` | `0fbe9a67` feat(host-contracts): ACL v0.8.0 with account retirement · `8e2cd34b` test(host-contracts): Level 0 retirement tests for ACL v0.8.0 · `5e61f3de` test(host-contracts): follow the ACL v0.8.0 version bump in the Hardhat upgrade test |
| `impl/fhevm-v0.13.8` | `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5` (tag v0.13.8) | `61be560e` feat(host-contracts): ACL v0.4.1 backport · `e02d3e28` test(host-contracts): Level 0 retirement tests for the ACL v0.4.1 backport · `06d769f2` test(host-contracts): follow the ACL v0.4.1 version bump |

The backport is built from the **v0.13.8 tag source** (delegation expiry stays `>`, ACL.sol:`_isUserDecryptionDelegationActive`), not from the SDK mock's ACL copy. Commits are local; nothing was pushed.

**Patches** (full branch diffs from `lifecycle/base`, contracts and tests): `contracts/level0/main.patch` (23 files, +8,693/−16) and `contracts/level0/backport-v0.13.8.patch` (19 files, +6,033/−16). Both were checked to apply cleanly to a fresh `git archive` of `lifecycle/base` and to reproduce `lifecycle/level0` byte for byte (CR-insensitive). Contracts only: `git diff lifecycle/base lifecycle/level0 -- host-contracts/contracts`.

### 1.2 Contract changes, file:line (main `host-contracts/contracts/ACL.sol` at `0fbe9a6`; v0.13.8 at `61be560`)

| Spec | Item | main | v0.13.8 |
|---|---|---|---|
| c.2 | `/// @custom:storage-location erc7201:fhevm.storage.ACLRetirement`, `struct ACLRetirementStorage { mapping(address => bool) retired; }` | 179–182 | 171–174 |
| c.2 | `ACL_RETIREMENT_STORAGE_LOCATION = 0xe6ae…6200` | 221–222 | 210–211 |
| c.2/c.3 | `ERC165_INTERFACE_ID 0x01ffc9a7`, `DAL_CORE_INTERFACE_ID 0x556d2088`, `RETIREMENT_STORAGE_LOCATION_SELECTOR 0xc89c7ccd` | 225, 229, 232 | 214, 218, 221 |
| c.1 | `MINOR_VERSION = 8` / `PATCH_VERSION = 1` | 191 | 186 |
| c.1 | `REINITIALIZER_VERSION = 9` / `6` | 215 | 204 |
| c.1 | `reinitializeV8()` / `reinitializeV5()` (empty body) | 253 | 242 |
| c.4 | errors `AccountAlreadyRetired`, `SenderRetired`, `UpgradeDropsRetirement` | 39, 139, 146 | 38, 132, 139 |
| c.4 | event `AccountRetired(address indexed account, address indexed successor)` | `ACLEvents.sol:63` | `ACLEvents.sol:58` |
| c.3, R1–R3 | `retireAccount()`: no `whenNotPaused`, no deny check; `AccountAlreadyRetired` on second call; `emit AccountRetired(msg.sender, address(0))` | 487–494 | 443–450 |
| c.3 | `isAccountRetired(address)` | 705 | 617 |
| c.5 | `isAllowed`: `if (msg.sender != FHEVM_EXECUTOR_ADDRESS && _retired().retired[account]) return false;` then `allowedTransient(...) \|\| _getACLStorage().persistedAllowedPairs[...]` (raw persisted read) | 607–612 | 542–547 |
| c.5 | `persistAllowed`: `persistedAllowedPairs[h][a] && !_retired().retired[a]` | 685–688 | 597–600 |
| c.5 | `isHandleDelegatedForUserDecryption`: first statement gates delegator, delegate **and contract** | 659–670 | 571–582 |
| c.5 | `isDelegatedForUserDecryption` (main only): same first statement | 632–641 | n/a |
| c.5 | `getUserDecryptionDelegationExpirationDate` returns 0 if any party is retired | 525–534 | 481–490 |
| c.6 | `allow` failure branch: `SenderRetired` if retired, else `SenderNotAllowed` | 280–285 | 256–261 |
| c.6 | `allowForDecryption` failure branch (inside the loop) | 310–315 | 286–291 |
| c.6 | `allowTransient` non-exempt branch (main: not executor, not bridge; v0.13.8: not executor) | 353–358 | 311–316 |
| c.6 | `delegateForUserDecryption`: first statement `if (_retired().retired[msg.sender]) revert SenderRetired(msg.sender);` | 388–390 | 345–347 |
| c.3 | `supportsInterface(bytes4)`: true for `0x01ffc9a7` and `0x556d2088` only | 789–791 | 701–703 |
| c.3 | `retirementStorageLocation()` (pure) | 798–800 | 710–712 |
| c.7 | `_authorizeUpgrade`: `onlyOwner`, then staticcall `supportsInterface(0x556d2088)` and `retirementStorageLocation()`; `UpgradeDropsRetirement(newImplementation)` unless both match | 809–824 | 721–736 |
| c.5 | `_retired()` storage accessor | 849–853 | 761–765 |

Everything else in c.6 "Unchanged" is unchanged: `multicall`, `revokeDelegationForUserDecryption` (pause-gated only on v0.13.8), `invalidateDecryptionSignaturesBefore` (main), `blockAccount`/`unblockAccount`, `pause`/`unpause`, `allowedTransient` (raw, R14), `isAllowedForDecryption` (R9). Natspec on every changed function states the retirement behaviour; `retireAccount()`'s natspec states the three limits. Selectors: `retireAccount()` `0xe7142996`, `isAccountRetired(address)` `0xb279091e` (XOR `0x556d2088`), `retirementStorageLocation()` `0xc89c7ccd`, `supportsInterface(bytes4)` `0x01ffc9a7` — each asserted in `test_ERC165`.

**Never-retired behaviour is unchanged.** Only failure branches gained code; every new read on a success path is a read of an unset retirement slot. Evidence: Zama's suites unchanged and green (§2.5); a differential fuzz (`test_Differential_NeverRetiredMatchesV070`/`…V040`, 512 runs × 6 random operations, three caller kinds) shows every view answers identically to the previous release; Zama's CI upgrade check shows FHEVMExecutor, KMSVerifier, InputVerifier, HCULimit, ProtocolConfig and KMSGeneration bytecode **unchanged**.

### 1.3 Changes to Zama's existing tests (both lines)

| File | Change | Why |
|---|---|---|
| `test/acl/acl.t.sol` `test_PostProxyUpgradeCheck` | `"ACL v0.7.0"` → `"ACL v0.8.0"` (v0.13.8: `v0.4.0` → `v0.4.1`) | version bump (required by Zama's CI rule) |
| `test/fhevm-foundry/TestHostContractsDeployerTestUtils.t.sol` | same version string | same |
| `test/upgrades/upgrades.ts` (Hardhat), 2 lines | same version string | same |
| `test/acl/acl.t.sol` `test_OnlyOwnerCanAuthorizeUpgrade()` | upgrade target `new EmptyUUPSProxyACL()` → `new ACL()` | **by design**: the c.7 guard refuses any Core-less implementation, including the empty proxy ("no escape hatch"). The refusal itself is pinned by the new `test_GuardRefusesEmptyProxyImplementation`. The fuzz variant (non-owner) is unchanged and still gets `OwnableUnauthorizedAccount`, because `onlyOwner` runs before the guard. |

With exactly these edits, the first full run after the contract change showed 708/711 on main (2 version strings, 1 guard) and every other Zama test untouched; afterwards 711/711 and 494/494.

---

## 2. Tests

### 2.1 Files and counts

| File (`host-contracts/test/acl/`) | main | v0.13.8 | Covers |
|---|---|---|---|
| `ACLRetirement.t.sol` | 29 | 29 | c.11 items 1, 3; differential fuzz (item 5) |
| `ACLRetirementExemption.t.sol` | 24 | 24 | c.11 item 2 (all non-bridge export paths), c.8 invariants |
| `ACLRetirementBridge.t.sol` | 1 | — | c.11 item 2, bridge `send` (main only) |
| `ACLRetirementUpgradeMatrix.t.sol` | 14 | 10 | c.11 item 4 |
| `ACLRetirementGas.t.sol` | 12 | 12 | measurements (§4) |
| `retirement/RetirementMocks.sol` | test account (contract and EIP-7702 delegate), `fromExternal` deputy, ERC-7984 token and receiver, two guard-negative ACL variants | | |
| `retirement/fixtures/*.sol` | 7 | 4 | verbatim ACL release sources (§2.6) |
| `retirement/oz-confidential-contracts-0.5.3/` | 5 | 5 | vendored OZ ERC-7984 (§2.3) |

All with `FOUNDRY_ISOLATE=false` (ENV_BASELINE §3.4). Logs: `results/level0/logs/L0_forge_*`.

### 2.2 c.11 item 1: views per role

Retired **user**: `isAllowed` false for every non-executor caller (fuzzed caller), `persistAllowed` false, executor still reads the raw pair; transient grants stay raw in `allowedTransient` (R14) and false in `isAllowed`. Retired **delegator**: `isHandleDelegatedForUserDecryption`, `isDelegatedForUserDecryption` false, getter 0, per contract and wildcard. Retired **delegate**: every delegation it holds, from every delegator, stops. Retired **contract** (it retires itself): direct views false, both delegated views false, getter 0, while delegations through the same wildcard row for *other* contracts keep working. **Inbound grants accepted and inert**: `allow(h, retired)` succeeds and emits `Allowed`, the raw pair is written (seen only by the executor path), `persistAllowed`/`isAllowed` false; executor transient grants and delegations to a retired delegate or for a retired contract are accepted and inert. R9: a handle published before retirement stays public.

### 2.3 c.11 item 2: the exemption is not an export route

Each test: a never-retired **control** computes through the real FHEVMExecutor and exports successfully; then a retired **EIP-7702 EOA** (`vm.signAndAttachDelegation`, designator length 23 asserted) and a retired **contract** each (a) compute through the executor — operand check passes under the exemption, result granted transiently (`allowedTransient` true, `isAllowed` false) — and (b) in the same transaction try the export with that fresh result. Every attempt reverts with the expected typed error:

| Export path | Expected revert | Test |
|---|---|---|
| `allow` | `SenderRetired(account)` | `test_Export_Allow` |
| `allowForDecryption` (fresh and persisted handle) | `SenderRetired(account)` | `test_Export_AllowForDecryption` |
| `allowTransient` | `SenderRetired(account)` | `test_Export_AllowTransient` |
| `multicall([allow, allowTransient])` | `SenderRetired(account)` (bubbled) | `test_Export_Multicall` |
| `delegateForUserDecryption` | `SenderRetired(account)` | `test_Export_DelegateForUserDecryption` |
| deputy `FHE.fromExternal(h, "")` (fresh and persisted handle) | `SenderNotAllowedToUseHandle(h, account)` | `test_Export_FromExternalEmptyProof` |
| ERC-7984 `confidentialTransfer(to, euint64)` | `ERC7984UnauthorizedUseOfEncryptedAmount(h, account)` | `test_Export_ERC7984_ConfidentialTransferHandle` |
| ERC-7984 `confidentialTransferFrom(from, to, euint64)` (account as operator) | same | `…ConfidentialTransferFromHandle` |
| ERC-7984 `confidentialTransferAndCall(to, euint64, data)` | same | `…ConfidentialTransferAndCallHandle` |
| ERC-7984 `confidentialTransferFromAndCall(…)` | same | `…ConfidentialTransferFromAndCallHandle` |
| ERC-7984 `requestDiscloseEncryptedAmount(euint64)` | same | `…RequestDiscloseEncryptedAmount` |
| bridge `HandlesSender.send` (main; fresh and persisted handle) | `HandleNotAllowed(h, account)` | `ACLRetirementBridge.t.sol:test_Export_BridgeSend` |

ERC-7984 tests also check the persisted balance handle directly. Additional ERC-7984 behaviour: inbound transfer to a retired EOA succeeds and is inert; `confidentialTransferAndCall` to a retired **contract** recipient reverts with `SenderRetired(receiver)` and leaves the sender's balance untouched (the SU-1 case, ENV_BASELINE §6.1; fails closed); asserted residual: a retired account still moves its funds with a fresh input proof (limit 2), `test_Residual_RetiredAccountStillTransfersWithFreshInput` (InputVerifier mocked exactly as Zama's executor tests do).

**Which OpenZeppelin code was used.** The OpenZeppelin confidential-contracts **0.5.3 source itself**, vendored test-only (`retirement/oz-confidential-contracts-0.5.3/`: `ERC7984.sol`, `ERC7984Utils.sol`, `FHESafeMath.sol`, `IERC7984.sol`, `IERC7984Receiver.sol`, from `experiments/node_modules`, sha256 in each header), with a scripted mechanical port because OZ 0.5.3 requires solc ≥ 0.8.27 and Zama pins 0.8.24: pragma `^0.8.27` → `^0.8.24`; 14 × `require(cond, Error(args))` → `if (!(cond)) revert Error(args)`; FHE import re-pointed to the host repo's own copy of the FHE library (`host-contracts/lib/FHE.sol`, identical to `library-solidity/lib/FHE.sol` on main except one import path). Nothing else changed (`impl/harness/level0/port_oz_erc7984.py`). **Cross-check:** the **unmodified** OZ 0.5.3 with its peer `@fhevm/solidity` 0.11.1, compiled with solc 0.8.27 against the Level 0 ACL/executor/HCULimit sources, gives the same results, 7/7 (`impl/harness/level0/oz-unmodified-crosscheck/`, log `L0_oz_unmodified_crosscheck.log`).

**c.8 executor invariants, pinned.** `vm.startStateDiffRecording` around a battery that calls every handle-touching FHEVMExecutor entry point (binary ops encrypted and scalar, div/rem, min/max, neg, not, shifts/rotations, comparisons, bitwise incl. bool, ifThenElse, cast, trivialEncrypt, rand, randBounded, sum, isIn, verifyInput, and fheMulDiv on main), for a retired 7702 EOA, a retired contract and a never-retired contract (9 tests per line). Asserted: (1) every executor→ACL `isAllowed` names the executor's direct caller (main `FHEVMExecutor.sol:1063`, the single `_consumeOperand` choke point; v0.13.8 has ten sites, `:738, 941, 968, 972, 1007–1009, 1042, 1067, 1070`); (2) every executor→ACL `allowTransient` names the caller, one per operation (main `:864, :1046`; v0.13.8 `:771, 798, 823, 955, 998, 1033, 1058, 1087, 1121, 1144`), and all twenty v0.13.8 sites pass `msg.sender` [V]; the executor calls no other ACL function; (3) the only DELEGATECALLs in the run are proxy-to-own-implementation hops (ACL, executor, HCULimit), and HCULimit/InputVerifier read no authorization view — so no other code reads the views *as the executor*. A non-vacuity test feeds the checker synthetic violations of each kind and expects it to fail. Static support [V]: outside `ACL.sol`, the host contracts read ACL views only in the executor and `HandlesSender.sol:351` (bridge, `isAllowed(h, msg.sender)`); the bridge grants only in `HandlesReceiver.sol:220`.

The 7702 tests also pass under explicit Prague rules (`--evm-version prague`): main 25/25, v0.13.8 24/24.

### 2.4 c.11 item 3: typed errors and lifecycle edges

`SenderRetired` on all four grant paths; precedence unchanged (`SenderNotAllowed` for never-retired, `SenderDenied` before `SenderRetired`, `EnforcedPause` before both); ERC-165 (`0x01ffc9a7`, `0x556d2088` true; fuzzed other ids false; Core id = XOR of selectors); storage location = ERC-7201 formula computed in-test; the bit lands at `keccak256(abi.encode(account, location))`; second retirement reverts `AccountAlreadyRetired` and emits nothing; retirement works while paused and while deny-listed; a contract retires itself; one-way under block/unblock/pause/unpause; carry `multicall([allow, allow, retireAccount()])` is atomic with three events; reverse order reverts `SenderRetired` and rolls back the retirement; carry during a pause reverts `EnforcedPause` and changes nothing, then succeeds after unpause; a retired account can still revoke (main: also while paused; v0.13.8: pause-gated, unchanged) and invalidate signatures (main); the guard refuses `EmptyUUPSProxyACL`; `onlyOwner` runs before the guard.

### 2.5 c.11 item 5: differential

| Check | main | v0.13.8 | Log |
|---|---|---|---|
| Zama Foundry ACL suites | 63/63 (60 + 3) | 53/53 (50 + 3) | `L0_forge_zama_acl_*.log` |
| `forge test --match-path 'test/acl/*'` | 143/143 | 128/128 | `L0_forge_acl_dir_*.log` |
| Full Foundry suite | 791/791 (711 Zama + 80 new) | 569/569 (494 + 75) | `L0_forge_full_*.log` |
| Hardhat `test/acl/acl.ts` + `test/upgrades/upgrades.ts` (production compile, OZ hardhat-upgrades validation, guard accepts `ACLUpgradedExample`) | 11/11 | 10/10 | `L0_hardhat_*.log` |
| Differential fuzz vs previous release, never-retired | pass (512 runs) | pass (512 runs) | in `ACLRetirement.t.sol` |
| Zama `ci/upgrade-check` (bytecode/version/reinitializer naming) | pass | pass | `L0_upgrade_version_check_*.log` |
| Zama `ci/abi-compat` | pass, +8 entries | pass, +8 entries | `L0_abi_compat_*.log` |
| Executor gas within ±25 per operand | **no** (§4.3) | **no** | `raw/L0_gas_*` |

### 2.6 Fixtures (test-only)

`retirement/fixtures/` holds verbatim ACL release sources, generated by `impl/harness/level0/make_fixtures.py` (driven by `regen_fixtures.sh`); every header records the source and its git blob hash, and the only edits are import paths (re-pointed to the same files, relative to the fixture directory) plus, for the named variants, one listed edit: `_noguard` (empty `_authorizeUpgrade`, U3), `_drift` (namespace `fhevm.storage.ACLRetirementDrift`, location `0x5df21c0a…7100`, U4b), `_attribution` (exemption compare removed, gas attribution only). Sources: v0.4.0 = tag v0.13.8 (`748d5409`); v0.4.1 = `lifecycle/level0`; v0.7.0 = main `ed851716c` (`ff339c54`); **v0.5.0 = tag v0.14.2 `host-contracts/contracts/ACL.sol`, blob `a73fcbcb…`, fetched read-only from `raw.githubusercontent.com/zama-ai/fhevm/v0.14.2/…`** because `scratch/` was off limits (§5 D6). Fixtures compile against the line's own shared files; the only difference this makes is that `ACLEvents` also declares `AccountRetired` (ABI only, no bytecode effect for releases that never emit it). OpenZeppelin upgradeable is 5.1.0 on both lines.

---

## 3. Upgrade matrix (c.11 item 4)

Zama's own setup throughout: `EmptyUUPSProxyACL` behind an ERC1967 proxy at the canonical `aclAdd` (`deployCodeTo`, as `HostContractsDeployerTestUtils._deployACL`), then `upgradeToAndCall(impl, initializeFromEmptyProxy())`, and upgrades as `upgradeToAndCall(newImpl, reinitializeV{N-1}())` (Zama `tasks/upgradeContracts.ts`). Seeded state: persisted pairs, delegations (one with a retired delegator, one for a retired contract), a public handle, a deny-list entry, invalidation (main). "Retired three" = a user, a delegator and a contract.

| Id | Step | Expected (c.11) | Result | Test (main unless noted) |
|---|---|---|---|---|
| U0 | v0.7.0 → v0.8.0 (main production path) | — | **pass**: state and raw `fhevm.storage.ACL` slots preserved, `_initialized` 8 → 9, retire then works; afterwards rollback to v0.7.0 reverts `UpgradeDropsRetirement` | `test_U0_v070_to_v080_StatePreserved_CoreActive`, `test_reinitializeV8SucceedsOnUpgradePath` |
| U1 | v0.4.0 → v0.4.1 (layout; validateUpgrade) | layout preserved | **pass**: state preserved, `_initialized` 5 → 6, retirement namespace starts empty; OZ `validate` ✔ on both lines | `test_U1_v040_to_v041_LayoutAndStatePreserved` (both lines), `test_reinitializeV5SucceedsOnUpgradePath` (v0.13.8); `L0_oz_validate_*.log` |
| U2 | v0.4.1 → v0.8.0 | bits and enforcement preserved | **pass**: guard in v0.4.1 accepts v0.8.0; `_initialized` 6 → 9; bits (raw slot), every gated view, typed errors, executor exemption preserved; new `isDelegatedForUserDecryption` gated too | `test_U2_v041_to_v080_BitsAndEnforcementPreserved` |
| U3 | guard-less v0.4.1 → v0.7.0 | succeeds, enforcement lapses (hazard) | **pass (hazard shown)**: bits still in storage, but `isAllowed`/`persistAllowed`/delegated view answer true for the retired parties and the retired key can `allow` again | `test_U3_GuardlessV041_to_v070_EnforcementLapses`; v0.13.8 analogue: guard-less rollback to v0.4.0 |
| U4 | v0.4.1 → v0.7.0 | reverts `UpgradeDropsRetirement` | **pass**, with and without the reinitializer call; implementation slot unchanged | `test_U4_v041_to_v070_RevertsUpgradeDropsRetirement`; v0.13.8: `test_U4_CoreLessTargetsRevert` (v0.4.0 rollback, empty proxy, EOA) |
| U4b | Core-declaring, other namespace | reverts | **pass**: storage-level drift fixture and a report-level variant both revert, from v0.4.1 and from v0.8.0; plus *why*: without the guard the drifted release silently resets every retirement (old bits orphaned) | `test_U4b_CoreDeclaringOtherNamespace_Reverts`, `test_U4b_WithoutLocationCheckDriftResetsRetirements` (both lines) |
| U4c (added) | right location getter, no Core | reverts | **pass** (also EOA target and empty proxy) | `test_U4c_LocationWithoutCore_Reverts` (both lines) |
| U5 | v0.4.1 → v0.5.0 | reverts `InvalidInitialization` | **reverts, but with `UpgradeDropsRetirement`**: the guard runs first. The `InvalidInitialization` collision (both releases take reinitializer 6) is real and shown on the guard-less build. **Spec correction, §5 D1** | `test_U5_v041_to_v050_GuardFiresFirst_CollisionBehindIt`, `test_U5_v041_to_v050_ReinitializerCollision`; v0.13.8 analogue `test_U5_GuardlessRollbackReinitializerCollision` |
| U6 | v0.4.1 → v0.5.1 → v0.8.0 | optional | **not done** (needs the optional 0.14-line build) | — |
| U7 | lying implementation | passes the guard (asserted residual) | **pass (residual asserted)**: v0.7.0 (or v0.4.0) code answering both guard questions like Core is accepted from v0.8.0 and from v0.4.1; enforcement lapses | `test_U7_LyingImplementationPassesGuard_AssertedResidual`, `test_U7_LyingImplementationFromV041_AssertedResidual` (v0.13.8: `ACLLyingV040`) |
| — | legitimate successors | accepted | **pass**: redeploy of the same release and Zama's `ACLUpgradedExample` (inherits ACL) | `test_GuardAcceptsCoreSuccessors` (both lines) |

OZ upgrades-core 1.44.2 `validate` (the engine behind hardhat-upgrades) on Foundry build-info: 0.4.0→0.4.1 ✔ (both lines), 0.7.0→0.8.0 ✔, 0.4.1→0.8.0 ✔; negative control 0.8.0→0.4.0 ✘ ("Deleted `decryptionSignatureInvalidatedBefore`", "Deleted namespace `erc7201:fhevm.storage.ACLRetirement`"), so the validator is not vacuous — and it would itself flag a release that drops the namespace if run against the right reference.

---

## 4. Gas

### 4.1 Method

- **Foundry suite** `ACLRetirementGas.t.sol`: each measurement deploys Zama's stack twice at the canonical addresses (baseline = previous release fixture, Level 0 = branch), from the same state snapshot; all touched accounts are cooled (`vm.cool`) before the measured call. Metric **frame** = `vm.lastCallGas().gasTotalUsed` (execution of the called frame; no intrinsic or calldata gas). For state-creating operations also **caller-side** = `gasleft()` delta in the caller (frame + CALL overhead + gas charged outside the frame).
- **anvil receipts** (main): transaction-level `gasUsed` with `--auto-impersonate` (no private keys used), deploys via Zama's empty-proxy flow, setup pairs written with `anvil_setStorageAt`.
- **Compile profiles:** **production = Zama's Hardhat settings** (solc 0.8.24, optimizer on, 800 runs, cancun target, `bytecodeHash none`; numbers below unless noted). Also 200 runs (= Zama's Foundry test profile on main; v0.13.8's Foundry profile is unoptimized and is not used for gas). Raw: `results/level0/raw/L0_gas_{main,v0.13.8}_runs{200,800}_{prague,osaka,amsterdam}.log`, `L0_gas_anvil_main_*.json`, tables `L0_gas_summary.md`, `L0_gas_amsterdam_estimates.md`, environment `L0_gas_environment_*.txt`.
- All [M] on M1, 2026-10-21 (main run 08:03Z, v0.13.8 07:39Z UTC), commits main `ed851716c` vs `lifecycle/level0` `5e61f3d` (ACL source = `0fbe9a6`), v0.13.8 `fe3ca89b` vs `06d769f` (ACL source = `61be560`). **Prague and Osaka give identical numbers** for every ACL measurement here.

### 4.2 Main table (production profile)

| Measurement | Prague/Osaka: v0.7.0 → v0.8.0 (Δ) [M] | Amsterdam (forge `amsterdam`) [M]/[E] | v0.13.8 Prague/Osaka: v0.4.0 → v0.4.1 (Δ) [M] |
|---|---|---|---|
| `retireAccount`, first, cold — frame | 26,535 | frame 16,635; caller-side 115,067 | 26,535 |
| `retireAccount` — **transaction** (anvil receipt) | **50,099** | **≈138,219 [E]** | — |
| `retireAccount`, second (reverts) — frame | 4,889 | 4,889 | 4,889 |
| `isAllowed`, non-executor caller | 5,552 → 7,818 (**+2,266**: one cold SLOAD) | same | 5,497 → 7,818 (+2,321) |
| `isAllowed`, executor caller, persisted pair | 5,552 → 5,589 (**+37**) | same | 5,497 → 5,589 (+92) |
| `isAllowed`, executor caller, transient grant | 3,214 → 3,295 (**+81**) | same | 3,191 → 3,295 (+104) |
| `persistAllowed` | 5,143 → 7,409 (+2,266) | same | 5,155 → 7,431 (+2,276) |
| executor `fheAdd`, 2 persisted operands | 31,625 → 31,721 (**+96 = +48/operand**) | +96 | 30,840 → 31,090 (+250 = +125/operand) |
| executor `fheAdd`, 2 transient operands | 26,945 → 27,129 (**+184 = +92/operand**) | +184 | 26,224 → 26,498 (+274 = +137/operand) |
| executor `fheIfThenElse`, 3 persisted operands | 36,016 → 36,149 (**+133 = +44/operand**) | +133 | 34,994 → 35,336 (+342 = +114/operand) |
| `allow` (new pair) — frame | 34,012 → 36,245 (+2,233) | 24,112 → 26,345 | 33,970 → 36,268 (+2,298) |
| `allow` (new pair) — **transaction** (anvil) | **58,360 → 60,593** (+2,233) | **≈146,480 → 148,713 [E]** | — |
| `isHandleDelegatedForUserDecryption` (true, with the contract check) | 12,434 → 19,064 (**+6,630**) | same | 12,358 → 19,108 (+6,750) |
| `isDelegatedForUserDecryption` (true) | 7,846 → 14,471 (+6,625) | same | n/a |
| `getUserDecryptionDelegationExpirationDate` | 5,377 → 12,054 (+6,677) | same | 5,370 → 12,059 (+6,689) |
| OZ ERC-7984 `confidentialTransfer(to, euint64)` by holder — frame | 359,771 → 366,838 (**+7,067**, +2.0%) | 283,871 → 290,938 (+7,067); caller-side 1,069,830 → 1,076,897 | 354,469 → 362,598 (**+8,129**) |
| OZ ERC-7984 `mint` | 280,344 → 284,266 (+3,922) | +3,922 | 277,142 → 281,608 (+4,466) |

The delegated views pay three cold SLOADs (delegator, delegate, contract); the **contract check** added by the deliberation is one of them: one cold SLOAD (2,100) plus ~20 gas of the measured +6,630, inside an `eth_call` that verifiers already make (no new RPC, c.10). Off-chain verifiers pay no fee for it.

### 4.3 Executor per operand: the ±25 expectation is not met

Measured (production profile): main **+44 to +92 per operand** (persisted/transient), v0.13.8 **+114 to +137**. Attribution with a measurement-only fixture (v0.8.0 / v0.4.1 with just the exemption compare removed):

| Component, per `isAllowed` call by the executor | main | v0.13.8 |
|---|---|---|
| The exemption compare itself (`msg.sender != FHEVM_EXECUTOR_ADDRESS && …`), spec c.5 shape | **+48** (both profiles, both paths) | **+48** |
| Dispatcher/codegen layout (four new external functions shift the selector search; persisted read inlined) | −11 to +33 per `isAllowed`; per op 0 to +88 | +44 to +56 per `isAllowed`; per op +154 to +178 (the result's `allowTransient` dispatch changes too) |

So the compare alone already exceeds 25 gas, and the rest is the solc dispatcher, which no selector-preserving change can avoid. In context: +96 to +184 on a ~27–32K-gas executor call (~0.3–0.7%) on main. No functional effect. See §5 D2.

### 4.4 Carry (`multicall([allow(h_i, NEW)…, retireAccount()])`) at n = 1, 10, 100, 500

Transaction-level, anvil receipts, main, production profile [M] (Prague = Osaka), and Amsterdam estimates [E]:

| n | v0.7.0 grants only | v0.8.0 grants + `retireAccount()` | Calldata (B) | Amsterdam v0.8.0 [E] |
|---|---|---|---|---|
| 1 | 62,192 | **89,113** | 324 | ≈265,353 |
| 10 | 342,013 | **371,045** | 1,764 | ≈1,340,365 |
| 100 | 3,140,457 | **3,191,061** | 16,164 | ≈12,091,181 |
| 500 | 15,603,846 | **15,750,135** | 80,164 | ≈59,898,255 (does not fit one transaction) |

Per handle: **31,146 (v0.7.0) → 31,385 (v0.8.0), +239** (one warm retirement read per `allow` plus dispatch); fixed part of the Level 0 carry ≈ 57.7K (intrinsic gas, multicall overhead and `retireAccount`). **Under the EIP-7825 transaction cap (2^24 = 16,777,216): at most ~532 handles per transaction (v0.8.0, Prague/Osaka) [E from M]**, matching the deliberation's "~538" estimate within 1%. **Under Amsterdam: ~119,505 gas per handle and at most ~139 handles per transaction [E]**, so a 500-handle carry needs four transactions with the last one ending in `retireAccount()`.

### 4.5 Amsterdam: what differs and why (Sepolia ~140K vs ~58K for one `allow`)

- **Foundry 1.8.5 offers it:** `forge test --evm-version amsterdam` (and `vm.setEvmVersion`) and `anvil --hardfork amsterdam` both exist; there is no `glamsterdam` name.
- **Mechanism, measured in forge** (`L0_forge_hardfork_primitives.log`): a new storage slot (`SSTORE` 0 → 1) costs 22,591 frame gas under Prague and **12,591 under Amsterdam (−10,000)**, while the caller-side cost rises from 23,257 to **111,280 (+88,023)**: about **98.2K of state-creation gas is charged outside the frame** [M]. 100 new slots: +87,921 per slot. Creating a 1-slot contract: 45,658 → 291,733 caller-side. Writes to existing slots and reads are unchanged (±100). [I] This matches the Glamsterdam state-creation repricing (EIP-8037-style); I did not read revm's source to confirm the parameters.
- **Why `allow` goes from ~58K to ~140K:** `allow` writes exactly one new slot (`persistedAllowedPairs[h][account]`). Prague/Osaka receipt **58,360** [M]; Amsterdam estimate **146,480** [E] = 58,360 + (124,624 − 36,504) caller-side difference. Sepolia's "~140K" is consistent with this (within ~5%; Sepolia's exact parameters may differ). Per carried handle the Amsterdam figure is **119,266 (v0.7.0)** [E], **within 65 gas of the Sepolia measurement on record (119,201, M-P1)**. Level 0 adds the same +2,233 per `allow` under every fork: the retirement read is not state creation.
- **Consequence for Level 0:** retirement itself is one new slot (≈138K [E] under Amsterdam vs 50,099 [M]); carry becomes ~3.8× more expensive per handle and the 2^24 cap allows ~139 handles per transaction instead of ~532. Every ERC-7984 transfer becomes ~3× more expensive under Amsterdam (≈1.07M caller-side) because each ACL grant creates a slot; the Level 0 delta stays +7,067.
- **Phase 4 receipts** (`results/phase4/P2_4_AMSTERDAM.md`): on a local chain that applies Amsterdam's schedule
  (Foundry nightly `9089a6b`), `retireAccount` costs **132,519** [M, Local-Amsterdam] (the ≈138,219 above was 5,700
  high) and `allow` **140,780** (the estimate was 146,480). At a gas limit of exactly 2^24 a carry fits **137** handles,
  and **524** under Osaka [M]; the ~139 and ~532 above are linear fits [E], high because the proxy keeps 1/64 of the
  gas it forwards.
- **anvil caveat:** `anvil --hardfork amsterdam` (1.8.5) does **not** apply the state-creation charge: a new-slot `SSTORE` costs 43,609 [M] under Prague, Osaka and Amsterdam at block gas limits 30M, 60M, 100M and 2e9 (`L0_gas_anvil_sstore_probe_*.json`); its only visible change is +100 per multicall item. Its Amsterdam receipts are therefore not representative of Sepolia, and the Amsterdam transaction numbers above are estimates built from anvil Prague receipts plus forge's Amsterdam caller-side differences (`impl/harness/level0/amsterdam_estimate.mjs`).
- Under forge `amsterdam`, deploying the full stack 15 times in one test exhausts a contract-creation frame (state gas on ~24 KB of executor code), so `test_Gas_ExecutorOverheadAttribution` skips itself on Amsterdam; that attribution is code-level, and the executor deltas are identical across forks (§4.2).

### 4.6 Size (c.10, EIP-170)

Production settings [M]: main ACL 10,818 → 12,480 B (margin 12,096); v0.13.8 10,124 → 11,571 B (margin 13,005). Hardhat artifacts (with CBOR metadata): 12,351 B (main) and 11,583 B (v0.13.8). Spec estimate "75–90 Solidity lines per line" [E]: the code-only delta (non-blank, non-comment lines of `ACL.sol` + `ACLEvents.sol`) is +81/−6 on main and +77/−6 on v0.13.8 [M], within the estimate.

---

## 5. Deviations from the spec, with evidence

- **D1. U5 expected error (spec c.11 item 4 and the c.1 note "0.4.1 ↔ 0.5.0 revert with `InvalidInitialization`") is wrong in detail.** With the c.7 guard in v0.4.1, `UUPSUpgradeable.upgradeToAndCall` calls `_authorizeUpgrade(newImplementation)` before `_upgradeToAndCallUUPS` (OZ 5.1.0), and v0.5.0 does not declare Core, so the observed revert is `UpgradeDropsRetirement(v0.5.0)`, not `InvalidInitialization`. The reinitializer collision exists and is shown on the guard-less build (`InvalidInitialization`). Both are reverts, so the c.1 conclusion ("collisions are harmless") stands; only the expected error changes. Tests assert both.
- **D2. "Executor within ±25 gas per operand" (c.11 item 5) does not hold.** The c.5 code shape costs +48 per evaluation by itself; the dispatcher adds 0 to +44 per operand on main and up to ~+89 on v0.13.8 (§4.3). Not changed: meeting ±25 would need a different `isAllowed` shape (for example assembly) than c.5 prescribes, for a ~0.5% effect. Recommend restating the bound, under Zama's production compile settings, as "≤ +100 gas per operand (main), ≤ +140 (v0.13 line)" (under the 200-runs test profile main measures up to +137).
- **D3. Two kinds of edits to Zama's existing tests** (§1.3): four version strings (required by the bump) and one owner-upgrade test retargeted because the guard refuses the empty proxy by design.
- **D4. ERC-7984 is the OZ 0.5.3 source, mechanically ported to solc 0.8.24**, not unmodified OZ and not a minimal reproduction (§2.3). Unmodified OZ + `@fhevm/solidity` 0.11.1 cross-checked out of tree, 7/7. OZ's ERC165 comes from OpenZeppelin contracts 5.1.0 (Zama's pin) instead of OZ confidential's peer ^5.6.1; ERC165 is unchanged between them for this use.
- **D5. Where the matrix lives.** The cross-line steps (U2, U3, U4, U5) need v0.4.x, v0.5.0, v0.7.0 and v0.8.0 sources compiled together, so they run in the main clone with verbatim fixtures; v0.13.8 runs U1 and in-line analogues. Added beyond c.11: U0 (main production path), U4c, guard acceptance of legitimate successors, and reinitializer upgrade-path tests in Zama's own pattern.
- **D6. v0.14.2 `ACL.sol` was fetched from GitHub** (`raw.githubusercontent.com`, public source, read-only, blob `a73fcbcb…`, stored git-ignored in `impl/.tools/v0.14.2-src/`) because `scratch/` was off limits; no other network access was used for this work.
- **D7. Invariant 3 restated in observable terms.** Foundry records a DELEGATECALL's `accessor` as the frame's `msg.sender`, so "the executor never delegatecalls elsewhere" is checked as "the only DELEGATECALLs are proxy-to-own-implementation hops" (§2.3).
- **D8. Measurement metrics.** Frame gas excludes Amsterdam state-creation gas; Amsterdam transaction numbers are therefore [E] (§4.5). Caller-side base-vs-Level-0 deltas at large n include the test contract's own memory-expansion cost (the larger v0.8.0 initcode raises its memory high-water mark), so deltas are taken from frame gas and anvil receipts.

No deviation in the contract semantics: everything in c.2–c.7 is implemented as written (§1.2), including the getter returning 0 for retired parties (open question 13 is Semih's to settle; the code follows c.5).

## 6. Not done, follow-ups, residuals

- **Out of this task's scope:** cleartext mock (`CleartextACL` re-pointed at v0.4.1, non-forge KMS signer set, end-to-end on anvil); the real-connector harness; coprocessor host-listener match arms for `AccountRetired` (c.10); Rust bindings (`host-contracts/rust_bindings/src/acl.rs` now lacks the new ABI). Zama's bindings consistency check (`forge bind … --hh`, as `ci/contracts_bindings_update.py` runs it) fails on this machine **for the unmodified base too** (`L0_bindings_check_main_base.log`), so it gives no signal here; regenerate with Zama's pinned toolchain before any PR. The connector needs no binding change for correctness.
- **Optional, not done:** the 0.14 line (0.5.1, reinitializer 7, `reinitializeV6()`) and U6.
- **Asserted residuals (tests pass by showing the residual):** a lying implementation passes the guard (U7, canary and pinning are Level 3); a retired account still moves funds with fresh inputs (limit 2); already-granted, published or decrypted data stays exposed (limit 1, `test_PublicDecryptionUnchanged`).
- **SU-1 behaviour, not a Core change:** `confidentialTransferAndCall` to a retired recipient with code reverts (fails closed).

---

## 7. Reproduce (README)

Prerequisites: the two clones on `lifecycle/level0` (ENV_BASELINE §2, §7), Foundry 1.8.5, Node 22, Python 3, Git Bash. From `fhe-authority-lifecycle/`:

```bash
export PATH="$USERPROFILE/.foundry/bin:$PATH"

# 0. Clone state (Zama CI order): host-contracts/node_modules, dependencies/ (forge soldeer install),
#    addresses/ generated. On main, Zama's CI provisions the bridge address before forge:
(cd impl/fhevm-main/host-contracts && PROVISION_BRIDGE_PROXY=true HARDHAT_NETWORK=hardhat npm run deploy:emptyProxies)

# 1. Foundry suites (always FOUNDRY_ISOLATE=false)
for L in main v0.13.8; do (cd impl/fhevm-$L/host-contracts && FOUNDRY_ISOLATE=false forge test); done
for L in main v0.13.8; do (cd impl/fhevm-$L/host-contracts && FOUNDRY_ISOLATE=false forge test --match-path 'test/acl/*'); done
#    Zama's own ACL suites only: --match-path test/acl/acl.t.sol and test/acl/TestIntegrationACL.t.sol
#    7702 paths under Prague rules: add --evm-version prague (use a separate --out/--cache-path)

# 2. Hardhat (re-generates addresses/ without the bridge: re-run step 0 afterwards on main)
for L in main v0.13.8; do (cd impl/fhevm-$L/host-contracts && npm_config_script_shell="$(which bash)" \
  HARDHAT_NETWORK=hardhat npx hardhat test test/acl/acl.ts test/upgrades/upgrades.ts); done

# 3. Zama CI checks against lifecycle/base (baseline = git archive copy with node_modules junction, addresses, dependencies)
#    node sdk/js-sdk/node_modules/tsx/dist/cli.mjs ci/upgrade-check/check.ts <baseline>/host-contracts host-contracts --changed-contracts ACL
#    node sdk/js-sdk/node_modules/tsx/dist/cli.mjs ci/abi-compat/check.ts <baseline>/host-contracts host-contracts host-contracts

# 4. OZ upgrades-core validate (U1 and friends)
bash impl/harness/level0/oz_validate.sh

# 5. Gas (Foundry x {runs 200, 800} x {prague, osaka, amsterdam}; anvil receipts; summaries)
bash impl/harness/level0/gas_run.sh all
node impl/harness/level0/gas_summary.mjs "$(cygpath -m "$PWD/results/level0/raw")" > results/level0/raw/L0_gas_summary.md
node impl/harness/level0/amsterdam_estimate.mjs "$(cygpath -m "$PWD/results/level0/raw")" > results/level0/raw/L0_gas_amsterdam_estimates.md
(cd impl/harness/level0/forge-hardfork-probe && for e in prague osaka amsterdam; do FOUNDRY_ISOLATE=false forge test --evm-version $e -vv; done)

# 6. Unmodified OpenZeppelin cross-check (solc 0.8.27)
(cd impl/harness/level0/oz-unmodified-crosscheck && FOUNDRY_ISOLATE=false forge test)

# 7. Regenerate fixtures and the OZ port after any ACL change (then re-run 1)
bash impl/harness/level0/regen_fixtures.sh

# 8. Patches
git -C impl/fhevm-main diff lifecycle/base lifecycle/level0 > contracts/level0/main.patch
git -C impl/fhevm-v0.13.8 diff lifecycle/base lifecycle/level0 > contracts/level0/backport-v0.13.8.patch
```

anvil is started by the scripts with `--auto-impersonate` and its output discarded (it lists default dev keys); no private key is used or printed. Nothing contacts a Zama service; nothing is pushed.

## 8. File index

- Code: `impl/fhevm-main` and `impl/fhevm-v0.13.8`, branch `lifecycle/level0`; patches `contracts/level0/main.patch`, `contracts/level0/backport-v0.13.8.patch`.
- Harness (`impl/harness/level0/`): `make_fixtures.py`, `regen_fixtures.sh`, `port_oz_erc7984.py`, `oz_validate.sh`, `gas_run.sh`, `anvil_gas.mjs`, `anvil_sstore_probe.mjs`, `gas_summary.mjs`, `amsterdam_estimate.mjs`, `forge-hardfork-probe/`, `oz-unmodified-crosscheck/`.
- Logs (`results/level0/logs/L0_*`): Foundry (`forge_zama_acl`, `forge_acl_dir`, `forge_full`), Hardhat, `upgrade_version_check`, `abi_compat`, `oz_validate`, `oz_unmodified_crosscheck`, `bindings_check`, `main_deploy_emptyProxies`.
- Raw gas (`results/level0/raw/`): `L0_gas_*` logs and JSON, `L0_gas_summary.md`, `L0_gas_amsterdam_estimates.md`, `L0_forge_hardfork_primitives.log`, `L0_gas_environment_*.txt`.
