# Level 2, part (a): the E1 successor, on both lines

**Status.** This part is done for the registry and for the verifier. The rest of Level 2 is done too, in its own
reports (section 8).

The registry part is the E1 extension of the draft:
- main ACL **v0.9.0** (reinitializer 10, `reinitializeV9()`);
- v0.13 line ACL **v0.4.2** (reinitializer 7, `reinitializeV6()`).

**Where the code came from.** The E1 contract code on main was written by a delegated agent before its session ended.
The coordinator then:
- reviewed it line by line against rules S1–S11 of the draft (no change was needed);
- wrote every test, the v0.13 backport, the fixtures, the gas and size measurements and the connector proof;
- verified each result from raw data.

**Results**:

| Check | main (v0.9.0) | v0.13 line (v0.4.2) |
|---|---|---|
| Foundry, `test/acl/*` (Level 0 suite, plus 41 E1 tests, plus 4 upgrade tests) | **188/188** | **173/173** |
| Foundry, deployer utilities | 11/11 | 9/9 |
| OZ upgrades-core `validate`, layout | v0.8.0→v0.9.0 ✔, v0.7.0→v0.9.0 ✔, v0.4.1→v0.9.0 ✔; negative control ✘ (see below) | v0.4.1→v0.4.2 ✔, v0.4.0→v0.4.2 ✔; negative control ✘ |
| Zama CI `ci/upgrade-check` against `lifecycle/level0` | pass | pass |
| Real connector, unmodified kms-worker, successor path | **13/13** requests (legacy 8, RFC-016 5) | **8/8** requests |

The OZ negative control is v0.8.0 (or v0.4.1) validated against v0.9.0 (or v0.4.2) as the reference. It reports
"Deleted `succession`" and "Deleted `successorDelayOf`", so the validator does see the appended namespace fields.

Labels:
- **[M] (VPS):** the connector runs. Context as in `results/level0/CONNECTOR_PROOF.md` §1, with run windows 12:13Z
  (v0.13.8) and 12:15Z (main).
- **[M] (M1):** everything else, measured on machine M1 (AMD Ryzen 5 5600, 15.9 GB RAM, Windows 10 Pro), Foundry,
  forge and anvil 1.8.5, solc 0.8.24, Node 22.13.0, on 2026-10-21.
- **[E]:** estimated.

## 1. Code

| Line | Branch | Commits | Files |
|---|---|---|---|
| main | `lifecycle/level2` (worktree `impl/wt-l2-main`) | `50147ff` feat, `a9748a6` tests, `92a1806` Hardhat test | `ACL.sol` +343/−13, `ACLEvents.sol` +31, tests |
| v0.13 | `lifecycle/level2` (worktree `impl/wt-l2-v0138`, from `lifecycle/level0-mock`) | `70444e4` feat, `dee719f` tests, `33fef67` Hardhat test | `ACL.sol` +335/−11, `ACLEvents.sol` +31, tests |

**The backport is identical to main where it matters.** It was applied by `impl/harness/level2/backport_e1_v0138.py`.
The following are byte-identical to main's, as checked by a regex comparison:
- the 14 E1 function bodies;
- `retireAccount`;
- the `Succession` struct.

**What differs on the v0.13 line:**
- the version constants;
- the reinitializer name;
- one doc line (on this line a successor must be an ECDSA EOA, because the gateway verifies the delegate's ECDSA
  signature);
- this line has no `isDelegatedForUserDecryption` view, so there is nothing to amend there.

**Rules (draft S1–S11), as implemented:**
- **Storage.** `Succession {pending, confirmableAt, accepted | confirmed}` (two slots) and `successorDelayOf` are
  appended to `fhevm.storage.ACLRetirement`, so no new namespace is created.
- **Lifecycle.** `designateSuccessor` → `acceptSuccession` (a mandatory transaction by the successor) →
  `confirmSuccessor` at or after `confirmableAt = designation time + max(D, raised delay)`, with D = 7 days → locked.
  - `cancelSuccessorDesignation` clears a pending designation only.
  - Only the successor can clear a confirmed one, with `resignSuccession`.
- **Retirement.** `retireAccount` voids a pending designation, freezes the record and emits
  `AccountRetired(account, confirmedSuccessor)`.
- **Read right.** After retirement, both delegated views answer for (account, successor) exactly as an active,
  non-expiring wildcard delegation would. Every other delegate gets false, and R6 still applies to the successor and
  the contract.
- **Pause.** Designation, acceptance and confirmation are pause-gated. Cancellation, resignation and raising the delay
  are not.
- **ERC-165.** E1 is `0x7dc5e209` and the delay sub-interface is `0xc61ca396`. Both are recomputed from the ABI in a
  test (`test_InterfaceIds_AreSelectorXor`).

## 2. Tests (TC17, TC18)

`test/acl/ACLSuccession.t.sol` holds 41 tests on main, and the same 41 on the v0.13 line. On that line the 9
assertions on the main-only view are dropped.

| Rule | Tests (examples) |
|---|---|
| S1 designate | pending set from the effective delay; reverts for a retired caller, an invalid successor (zero, self, retired) and an existing confirmed successor; a new designation replaces a pending one and clears its acceptance |
| S2 accept | only the pending successor; reverts for a retired successor; voided by the account's retirement |
| S3 cancel | removes a pending designation; reverts without one and for a retired caller; never touches a confirmed successor |
| S4 confirm | needs acceptance; `SuccessorNotYetConfirmable` at `confirmableAt − 1`, success at `confirmableAt`; refused for a retired successor or a retired caller |
| S5 locked | the old key cannot replace, cancel or resign; the successor resigns at any time, including after retirement, while paused, or when retired itself |
| S6 frozen | retirement voids a pending designation and emits the confirmed successor; afterwards only resignation works |
| S7 delay | D = 7 days; raise-only, at most 365 days; a raise does not move a pending `confirmableAt` |
| S8 read right | nothing while the account is active; after retirement it works as a wildcard delegation; other delegates are refused even with a live row; it does not expire; stragglers are readable; a retired successor or contract is refused; resignation ends the right; a voided or unaccepted designation (a key-derived address cannot accept) yields nothing |
| S9 decrypt-as only | no use, grant, publication or delegation of the account's handles; no transitivity |
| S10 pause | designate, accept and confirm are gated; cancel, raise and retire are not |
| Never-retired accounts | a fuzz test (2,560 runs): confirming a successor changes no view of an active account |
| TC18 residual | asserted: an attacker who uses the stolen key to designate, accept and confirm after D unnoticed days keeps reading after retirement. Its counterpart: a pending attacker designation is voided by retiring before `confirmableAt` |

**Upgrade matrix additions** (`ACLRetirementUpgradeMatrix.t.sol`):
- U8: v0.8.0 → v0.9.0 and v0.4.1 → v0.4.2.
  - Bits and enforcement are preserved.
  - The succession state starts empty.
  - Accounts retired before the upgrade are frozen for E1.
- Direct upgrades v0.7.0 → v0.9.0 and v0.4.0 → v0.4.2.
- `reinitializeV9` and `reinitializeV6` follow Zama's pattern: the second call reverts.
- The Level 0 steps now run against verbatim v0.8.0 and v0.4.1 fixtures, generated by `make_fixtures.py` from
  `lifecycle/level0` (blobs `a0758fb0`, `57bc6f5c`).

**Observation: a rollback to the Core-only release passes the guard.**
- The guard checks Core and the storage location only, so it accepts a rollback from v0.9.0 to v0.8.0.
- Retirement stays enforced, and the successor's read right disappears. The rollback is fail-closed: a lockout, not a
  leak.
- The record is kept in the namespace and comes back with v0.9.0 (`test_U8_RollbackToCoreOnly_FailClosed_RecordKept`).
- OZ `validate` flags exactly this direction as unsafe.
- A release process that runs OZ validation would catch it. The on-chain guard does not.

## 3. Gas, transaction level [M] (M1)

**Method:**
- Anvil 1.8.5 receipts, one transaction per step (`impl/harness/level2/anvil_gas_e1.mjs`).
- Artifacts built with Zama's production settings: solc 0.8.24, optimizer on, 800 runs, cancun.
- Prague and Osaka give identical numbers (raw: `raw/L2_gas_anvil_main_{prague,osaka}.json`).
- Receipts include the 21,000 intrinsic gas and calldata.
- `view_*` rows are `eth_estimateGas` of a call to the view.

| Step | Gas |
|---|---|
| `retireAccount`, ACL v0.8.0 (Level 0, same harness; matches `LEVEL0_CONTRACTS.md`) | 50,099 |
| `retireAccount`, v0.9.0, no succession record | 54,464 (**+4,365**: two cold reads of the succession record) |
| `retireAccount`, v0.9.0, with a confirmed successor | 54,464 |
| `retireAccount`, v0.9.0, voiding a pending designation | 52,691 (the cleared slot earns a refund) |
| `designateSuccessor` | 62,014 |
| `designateSuccessor`, replacing a pending one | 44,914 |
| `acceptSuccession` | 40,074 |
| `confirmSuccessor` | 57,188 |
| `resignSuccession` (after retirement) | 28,688 |
| `cancelSuccessorDesignation` | 30,371 |
| `raiseSuccessorDelay` | 52,711 |
| `isHandleDelegatedForUserDecryption`, active delegator: v0.8.0 → v0.9.0 | 44,373 → 44,405 (+32) |
| same, active delegator with a confirmed successor | 44,405 |
| same, successor path (retired delegator) | 41,989 |
| `isAllowed`, v0.8.0 → v0.9.0 | 32,225 → 32,202 (−23) |

- **Setting up a successor** costs about 159K gas in total: designate, then accept, then confirm.
- **Under Amsterdam** the one-slot writes (designate, confirm, `successorDelayOf`) would each add roughly the
  98K state-creation charge measured in `LEVEL0_CONTRACTS.md`. That is an estimate [E], not measured here.

**Not used as a gas source: Foundry in-test frame gas.** `ACLSuccession.t.sol` `test_Gas_E1Lifecycle` logs frame gas
with `vm.cool`. That number understates multi-step flows, because slots written earlier in the same test transaction
are repriced as dirty. Example: `acceptSuccession` shows 13,397 in-test against 40,074 as its own transaction. The
anvil receipts above are the numbers of record.

## 4. Code size [M] (M1)

| Build | Level 0 | Level 2 | EIP-170 margin, Level 2 |
|---|---|---|---|
| main, production settings (800 runs) | 12,480 B | **15,178 B** | 9,398 B |
| main, default Foundry profile (200 runs, the bindings' profile) | — | 14,439 B | 10,137 B |
| v0.13 line, production settings (800 runs) | 11,571 B | **14,290 B** | 10,286 B |
| v0.13 line, default Foundry profile (**unoptimized**) | 19,602 B | **25,236 B** | **−660 B** |

**Finding: the v0.13 line's default Foundry profile no longer fits.**
- That profile compiles without the optimizer, and with E1 the ACL is 660 B over the EIP-170 limit
  (`forge build --sizes` fails).
- The Foundry tests still pass, because Foundry does not enforce the limit in tests. Anvil does: the unoptimized
  artifact cannot be deployed there.
- Production deployment is unaffected (14,290 B under Zama's Hardhat settings).
- Before regenerating that line's Rust bindings from the default profile, the profile would need the optimizer on, or
  E1 would need trimming.
- The connector harness on this line therefore uses an artifact built with the production settings (section 6).

## 5. Release-rule observation

**What the CI check enforces.** Zama's `ci/upgrade-check` (`lib.ts:78-184`, the same on both lines) requires three
things when bytecode changes:
- a changed `REINITIALIZER_VERSION`;
- a changed semantic version;
- a function named `reinitializeV{N−1}`.

**What it does not enforce.** It does not check that versions increase.
- Running it in reverse (Level 2 as the baseline, Level 0 as the target) also passes.
- The draft's release-train rule asks for strictly increasing reinitializers across lines before a second production
  backport (`TARGET_ARCHITECTURE.md` §4.3, §5.5). That ordering is not enforced by Zama's CI today, so it would need
  its own check.

**Reinitializers.**
- On main, 10 for v0.9.0.
- On the v0.13 line, 7 for v0.4.2. That is the same number as the optional v0.14-line Core target 0.5.1
  (`TARGET_ARCHITECTURE.md` §4.1).
- This is the known hazard U5 (a reinitializer collision across lines), one step later.
- It matters only if both ship. It is another reason the release plan needs strictly increasing reinitializers
  before any second production backport.

## 6. Real connector: the successor reads through the unmodified verifier [M] (VPS)

**Setup.** Same harness, recorder, provenance check and independent checker as the Level 0 proof
(`results/level0/CONNECTOR_PROOF.md`).
- Tests: `results/level2/harness/{v0.13.8,main}/crates/kms-worker/tests/acl_successor_real_chain.rs`. They are generated
  from the Level 0 file by `impl/harness/level2/make_successor_tests.py`, which changes only the test section.
- Scripts: `run_level2.sh`, plus `decode_level2.py` and `indep_check_l2.py`, which know the names S and Sk.
- **Unmodified connector.** On both versions the `kms-connector` diff is IDENTICAL and the production-tree hashes are
  EQUAL, as in Level 0.
- **ACL artifacts.** They come from the committed Level 2 sources (`build_vps_acl_artifacts.sh`), with the bindings'
  address constants:
  - main uses its default profile;
  - the v0.13 line uses the production profile (section 4);
  - on chain, each runtime equals its artifact (`matches_reference=true`), and `supportsInterface(0x7dc5e209)` is true.
- **E1 setup on anvil.**
  - U designates S, S accepts, `evm_increaseTime` adds 7 days, U confirms.
  - S is an anvil EOA. On main a second test uses a local-key successor Sk, which accepts with its own key.
  - D (or Dk) holds a live 30-day delegation from U, as the control.

**v0.13.8, ACL v0.4.2: 8/8 requests**

| Request | Outcome | KMS hits | View on the wire (per attempt) |
|---|---|---|---|
| delegated U→D, U active (control) | Forwarded | 4 | `isHandleDelegatedForUserDecryption(U,D,C,h)` = true |
| delegated U→S, U active | **Rejected** ×3 | 0 | `(U,S,C,h)` = false: no right before retirement |
| delegated U→S, U retired | **Forwarded** | 4 | `(U,S,C,h)` = **true**: the read right |
| delegated U→D, U retired | **Rejected** ×3 | 0 | `(U,D,C,h)` = false: every other delegate refused |
| direct S on h, U retired | **Rejected** ×3 | 0 | `isAllowed(h,S)` = false: decrypt-as only |
| direct V on h2 (prepares the harness) | Forwarded | 4 | — |
| delegated U→S on h2, a straggler granted to U after retirement | **Forwarded** | 4 | `(U,S,C,h2)` = true |
| delegated U→S after S resigned | **Rejected** ×3 | 0 | `(U,S,C,h)` = false |

**main, ACL v0.9.0: 13/13 requests**
- The legacy path gives the same 8 results. On every attempt the connector also asked
  `decryptionSignatureInvalidatedBefore(signer)`, which returned 0.
- The RFC-016 delegated entry (owner U, signer Sk) gave:
  - refused while U is active;
  - **forwarded** after U retired;
  - Dk refused after U retired;
  - Sk's own direct entry on U's handle refused (`isAllowed(h,Sk)` = false).

**Calls on the wire:**
- 20 `eth_call`s at v0.13.8 and 58 at main.
- Every call is `{input, to}` at `latest`, with no `from`.
- No call kind is new compared with the baseline run, and no Level 0 or E1 selector reached the connector's endpoint.

**Verification.**
- The agent-derived decoder, patched for S and Sk, and the coordinator's independent checker agree: all OK, no
  problem.
- The run directories were scanned for secrets before copying (none found).
- The VPS was left clean: no container, scope or open port, and `<live-service>` active before and after every step.

**What this shows.** The claim "verifiers need no change for E1" holds on both lines' unmodified connectors.
- The successor reads through the existing delegated path.
- Everything else stays refused.

**What it does not show:**
- The gateway's check of the delegate's signature is mocked here. It is ECDSA-only on the deployed path
  (`Decryption.sol:531-581` at v0.13.8 verifies only the delegate's EIP-712 signature and reads no delegation state),
  so a successor must be an ECDSA EOA there.
- Mocks, anvil and one chain, as in Level 0.

**Raw data:** `raw/vps/{v0.13.8,main}/` (`test.log`, `host_rpc.jsonl`, `provenance.txt`, `indep_check.out`,
decoder outputs), `raw/vps/logs/` and `raw/vps/scripts/`. SHA-256:

| File | SHA-256 |
|---|---|
| v0.13.8 `host_rpc.jsonl` | `9171b489…2620` |
| v0.13.8 `test.log` | `e3a8e7d0…29e6` |
| main `host_rpc.jsonl` | `d7511232…4773` |
| main `test.log` | `e7090d94…dece` |

## 7. Reproduction (from `fhe-authority-lifecycle/`)

```bash
# Foundry (both lines)
FOUNDRY_ISOLATE=false forge test --root impl/wt-l2-main/host-contracts --match-path 'test/acl/*'
FOUNDRY_ISOLATE=false forge test --root impl/wt-l2-v0138/host-contracts --match-path 'test/acl/*'
# Gas: production artifacts, then anvil receipts
FOUNDRY_OPTIMIZER_RUNS=800 FOUNDRY_ISOLATE=false forge build --root impl/wt-l2-main/host-contracts --out impl/.tools/build/main-l2-runs800 --cache-path impl/.tools/build/main-l2-runs800-cache
node impl/harness/level2/anvil_gas_e1.mjs impl/wt-l2-main/host-contracts impl/.tools/build/main-l2-runs800 prague 18631 results/level2/raw/L2_gas_anvil_main_prague.json
# OZ validate and Zama CI: commands in results/level2/raw/L2_oz_validate_*.log and L2_upgrade_version_check_*.log
# VPS artifacts and connector tests
bash impl/harness/level2/build_vps_acl_artifacts.sh
python -I impl/harness/level2/make_successor_tests.py .
# on the VPS: bg.sh build-L2-<ver> kw.sh <ver> build --test acl_successor_real_chain (KW_TREE=harness); pg_up.sh; bg.sh run-L2-<ver> run_level2.sh <ver>
```

## 8. The rest of Level 2

| Item | Status |
|---|---|
| (a) E1 registry, verifier proof | **done** (this file) |
| E1 in the cleartext mock (`plaintextForDelegatedUserDecryption(OLD, S)`: past and straggler handles) | **done**, through the SDK: `SDK_HYGIENE_AND_MOCK.md` §3 |
| (b) Profile A: `FHE.isAccountRetired`, plus the OZ ERC-7984 variant with observer and operator gates (TC23) | **done**: `PROFILE_A.md` |
| (c) Carry tool (enumerate `Allowed`, dry run, chunked `multicall`, verify) | **done**: `CARRY_TOOL.md` |
| (d) SDK hygiene (fresh transport key, purge on retirement, `ACCOUNT_RETIRED`, `getAuthorityStatus`) | **done**: `SDK_HYGIENE_AND_MOCK.md` |
| The "OZ unmodified" cross-check for Level 2 (Profile A's vanilla rows against the unmodified OpenZeppelin 0.5.3 build, as Level 0 did for the token) | **not done.** Profile A runs on the mechanically ported copy (`PROFILE_A.md`); Level 0's cross-check (7/7) covers the vanilla token only |

How to reproduce the whole level: `README.md`.
