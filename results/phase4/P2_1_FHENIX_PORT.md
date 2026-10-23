# P2.1: Core on Fhenix CoFHE (Vendor-2)

**Proof class:** Mock (Foundry). The port runs against Fhenix's real TaskManager, and the end-to-end run uses Fhenix's
published mock stack. The verifier side is code reading [V].
**Status:** done. **Date:** 2026-10-22.
**Machine:** M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), forge 1.8.5, solc 0.8.25 (0.8.28 for the plugin-suite
comparison, D52).
**Project:** `impl/fhenix-port/`. **Raw data:** `raw/p21/`.

## 1. What was built

**Base.** `FhenixProtocol/cofhe-contracts` `b5c20ed`, the head of the default branch on 2026-10-22, vendored unmodified
in `vendor/cofhe-contracts-b5c20ed/`.
- Each file equals its git blob byte for byte (`vendor/PROVENANCE.md`).
- The build uses Fhenix's own settings (D41): solc 0.8.25, cancun, optimizer 800 runs, via-IR, no metadata hash.
- The unmodified contracts compile as they are (`raw/p21/baseline_build.log`).

**The port** is in `src/`, a copy of Fhenix's host-chain contracts. Four files change (`raw/p21/port.diff`):

| File | Change |
|---|---|
| `ACL.sol` | Core: retirement state in its own ERC-7201 namespace `cofhe.storage.ACLRetirement` (D42); `retireAccount`, `isAccountRetired`, `retirementStorageLocation`, ERC-165 for Core; the upgrade guard (R11); the views gated per role (R6); every grant path gated (R7); the operand-check entry point `isAllowedForOperand` (R10, D43). Version "ACL v0.2.0" (D48) |
| `TaskManager.sol` | The operand check calls `isAllowedForOperand` for computation ids. The reserved ids, `sealoutput` and `decrypt` take the gated `isAllowed` (D44) |
| `Permissioned.sol` | `checkPermissionValidity` becomes `virtual`, so that the ACL can add the parties' retirement |
| `ACPShareRegistry.sol` | A share's parties are the permit's: a retired issuer cannot post (R7); a share with a retired party is invalid (R6, R14); the registry asks the ACL, which the admin sets, and fails closed (D47) |

**The roles on the port:**

| Role | Function | Consults | Answer for a retired party |
|---|---|---|---|
| Use | `isAllowed`, `persistAllowed`, `allowedTransient` (D45); `TaskManager.isAllowed` relays `isAllowed` | the account | false. A public handle stays public through `globalAllowed` |
| On-behalf | `allowedOnBehalf` | the account, the delegatee, the contract | false |
| Permit | `isAllowedWithPermission` (relayed by `TaskManager.isAllowedWithPermission`, which the decryption service calls); `checkPermissionValidity` | the issuer, and the recipient if there is one | false (D46). A permit with an invalid structure still reverts first |
| Share registry | `isShareValid`, `sharesFor` | the issuer, the recipient | invalid, not listed |
| Public | `globalAllowed` (relayed as `TaskManager.isPubliclyAllowed`), `isAllowedForDecryption` | none | unchanged (R9) |
| Engine | `isAllowedForOperand`, callable by the TaskManager only, used by its operand check for computation ids | — | not consulted (R10): outputs go only to the caller, for the transaction |

**Gated grant paths (R7):**
- `allow`, `allowGlobal`, `allowForDecryption`, `allowTransient`, `batchAllowTransient` and `shareCtHash`, each on the requester or sharer the TaskManager passes;
- `delegateAccount`, on the delegator it records;
- the share registry's `share`, on the issuer.

The engine's own transient grants (requester = the TaskManager) are R10's class and are not gated. Removal-only paths
stay open: the revoker's `revokeSingle` and `revokeAllExisting`, and `removeShare`.

**Sizes** (a build of the sources alone, D55; `raw/p21/sizes_*.log`), runtime bytes [M]:

| Contract | Fhenix `b5c20ed` | Port | Change | Margin under EIP-170 (port) |
|---|---|---|---|---|
| `ACL` | 14,526 | 15,937 | +1,411 | 8,639 |
| `TaskManager` | 24,343 | 24,496 | +153 | **80** |
| `ACPShareRegistry` | 7,314 | 8,093 | +779 | 16,483 |

Fhenix's `TaskManager` already sits 233 bytes under the limit. The port's operand-check switch leaves 80 bytes, so a
later change to that contract has almost no room under these settings.

## 2. TC1–TC12 and TC6 on the port [M, Mock]

**The suites** (`impl/fhenix-port/test/`). They run on forge 1.8.5 with Foundry's default isolation. A sequence that
needs a transient right runs inside one call of a test account (`PortAccount.executeAll`, D49).

| Suite | Tests | Covers |
|---|---|---|
| `FhenixCoreRegistry.t.sol` | 20 | TC1, TC2, TC4, TC5, TC7, TC8, TC12; R2; the constants against the ERC |
| `FhenixCorePermit.t.sol` | 14 | TC6: the permit role and the ACP share registry |
| `FhenixCoreEngine.t.sol` | 7 | TC9 and R10, with the negative test |
| `FhenixCoreBatchUpgrade.t.sol` | 11 | TC10, TC11 |
| `FhenixCoreDifferential.t.sol` | 3 | TC3 (§3) |
| `conformance/FhenixConformance.t.sol` | 18 | the P2.3 kit: 14 pass; the TC17 and TC19 tests skip, because the port has no E1 or E2 |

**Runs.** Three runs, each 69 passed, 0 failed, 4 skipped of 73 (`raw/p21/forge_port_r{1,2,3}.log`).

**What the tests show.**
- **TC1, R5.** A second `retireAccount` reverts `AccountAlreadyRetired` and emits nothing (fuzzed over the caller).
  The next call in the same transaction already sees the retirement.
- **TC2.** An account with no handle, and a contract, retire. So does an account while the TaskManager is disabled,
  the account is on its deny list and the access list is on.
- **TC4.** Once a user retires, every persistent and transient use view answers false for it; public handles stay
  public; other accounts are unaffected. The view's answer does not depend on who calls it (fuzzed).
- **TC5.** `allowedOnBehalf` answers false when the account, the delegatee or the contract is retired. A second test
  reads the storage layout the port assumes.
- **TC6, the permit role.**
  - A self permit answers true, then false once the issuer retires. A shared permit answers false once the issuer or
    the recipient retires. An ERC-1271 issuer behaves the same.
  - Handle and contract scopes behave alike. A permit with an invalid structure still reverts first.
  - A third party's retirement changes nothing.
  - The share registry: a retired issuer cannot post; a share becomes invalid once its issuer or recipient retires;
    posting to a retired recipient is accepted and inert; removal stays open to retired parties; only the admin
    sets the link to the ACL; without an answer from the ACL the registry fails closed.
- **TC7.** A retired grantor reverts on every path the TaskManager relays (typed error first), on the batch form and on
  `delegateAccount`. The removal-only paths of the revoker stay open.
- **TC8.** Grants to a retired account succeed and are inert.
- **TC9.** A retired account still computes, and every export of the output reverts. The same sequence succeeds for an
  active account (control). The asserted residual: a fresh encrypted input still verifies for the retired account,
  and cannot leave.
- **TC10.** Grants followed by retirement run as one atomic batch of an account; retirement followed by a grant reverts
  the whole batch. Neither the ACL nor the TaskManager offers a caller-preserving `multicall`, so the batch is the
  account's own.
- **TC11 (R11).**
  - A Core implementation at another location reverts. So does an implementation without Core (Fhenix's own), one
    at the right location without Core, and one whose answers are malformed, reverting or missing.
  - A Core implementation at the same location is accepted, and keeps both the state and the enforcement.
  - The upgrade from Fhenix's unmodified ACL keeps its state, and Core is active afterwards.
  - The role check comes first (fuzzed).
  - The asserted residual: an implementation that lies about Core is accepted. The canary catches it: retirement is
    no longer reported, and the use view answers true again.
- **TC12.** ERC-165 declares Core; unknown ids answer false (fuzzed).
- **R10.**
  - Only the TaskManager may call `isAllowedForOperand` (fuzzed). For active accounts it agrees with the use view
    (fuzzed).
  - The non-computation ids take the gated view.
  - The negative test: an ACL variant that exempts the TaskManager by caller identity lets every relayed grant and
    the permit check pass for a retired account.
- **R2.** The admin setters and a Core upgrade leave retirement in place.

**Mutation check** (`raw/p21/mutations/MUTATIONS.md`; `impl/harness/phase4/p21_mutations.py`).
- Each of 17 Core gates was removed in turn: 13 in the ACL, 2 in the TaskManager, 2 in the share registry.
- Every one made the suite fail: **17 of 17 caught**.
- The check ran on the 55 port tests, before the kit adapter was added. Each source file's SHA-256 was checked after
  restoring it.

## 3. TC3: never-retired accounts see the same registry [M, Mock]

Fhenix's own test suite runs on Hardhat with a local Fhenix node, so TC3 has two analogues here (D50).

**A differential test against Fhenix's unmodified contracts** (`FhenixCoreDifferential.t.sol`).
- The port and Fhenix's `TaskManager` and `ACL` (`b5c20ed`, "ACL v0.1.0") are deployed side by side, with the same
  verifier signer.
- Random sequences of 12 steps run on both, by accounts that never retire: inputs, computations, persistent and
  transient grants, publications (`allowGlobal`, `allowForDecryption`) and shares (`shareCtHash`, `receiveCtHash`).
  Some steps are refused on both stacks, for example a grant by an account without the right. On the port a retired
  bystander exists, and takes part in nothing.
- Every step's outcome (success and return data, or the revert data) must be identical. So must every view at the end:
  the use views for four accounts, `allowedOnBehalf`, the public views and the permit view.
- **Fuzz: 256 sequences, identical on both stacks.** A fixed script does the same with real work on each step.
- **Negative control:** with one actor retired on the port only, the comparison fails, as it must.

**Fhenix's published plugin suite on its mock stack** (`e2e/vendor-baseline/` and `e2e/vendor-port/`, D51, D52).
- The plugin's own test suite (12 files, from `cofhesdk` `04a69f8`, for `@cofhe/foundry-plugin` 1.0.1) runs twice:
  against the published mocks, and with the port's `ACL` and share registry in place of the mock ACL and the
  package's registry.
- Both run with `FOUNDRY_ISOLATE=false`, as the suite was written for (the isolated logs are kept as superseded).

| Run | Fhenix's mock stack | With the port's ACL and share registry |
|---|---|---|
| r1, r2, r3 | 107 passed, 1 failed of 108 | 106 passed, 2 failed of 108 |

The failures are the same in each run (`raw/p21/e2e/vendor_plugin_{baseline,port}_r{1,2,3}.log`):
- **On both stacks:** `test_exclusionReducesReportedGas`, an assertion in the plugin's gas metering (a delta of 48,886
  where it expects more than 50,000). It does not involve the ACL.
- **On the port only:** `testDeployMocks_contractsExist` calls `exists()` on the ACL. That function exists only on the
  mock ACL, which the port replaces.

Every other test of the plugin's suite passes unchanged with the port in place, so accounts that never retire see
the same behaviour.

## 4. End to end on Fhenix's published mock stack [M, Mock]

**The stack** (`e2e/`, D51). It is the stack `@cofhe/foundry-plugin` 1.0.1 deploys: the mock TaskManager, ZK verifier
and threshold network (`@cofhe/mock-contracts` 1.0.1). `CofheTestPort.deployMocksWithPortACL()` swaps in two pieces
behind proxies:
- the port's `ACL`, in place of the mock ACL;
- the port's `ACPShareRegistry`, in place of the package's.

The mock TaskManager and threshold network then call the port.
- Users encrypt through the plugin's client; the mock ZK verifier signs the inputs.
- A vault built on FHE.sol holds and adds balances (`e2e/src/E2EVault.sol`).
- Decryption goes through the mock threshold network, which asks the ACL's permit view or its public view, as
  Fhenix's decryption service does.

**Six tests, three runs, 6 of 6 each** (`e2e/test/FhenixE2E.t.sol`; `raw/p21/e2e/fhenix_e2e_r{1,2,3}.log`). Each
test call runs as its own transaction (Foundry's isolation).

| Test | What it shows |
|---|---|
| Permit decryption | Alice decrypts her balance with a self permit, for view and for a transaction. After she retires, both are refused (`NotAllowed`), and the vault keeps its own right |
| Shared permit | Bob decrypts Alice's handle with a permit she shared. It is refused once Bob retires (Alice's own permit still works) and, separately, once Alice retires |
| Public decryption | A balance Alice disclosed stays publicly decryptable after she retires, and its result can be published |
| The vault | A retired Alice cannot move or disclose her balance. Carol's payment to her is accepted and added by the engine, and is inert for Alice (R8) |
| The share registry | After Alice retires, her share to Bob is no longer valid or listed, and she cannot post another |
| The mock engine | The mock TaskManager checks operands with the gated use view, so a retired account cannot compute there. That is stricter than R10 requires; the port's own TaskManager takes the exemption through its dedicated entry (§2) |

## 5. The verifier side (off-chain) [V]

**Fhenix's decryption service, `teecryptor`** (`2616344b`, public), consults the registry at request time.
- **Which view it calls.**
  - A request that carries a permit (ACP) is checked with `TaskManager.isAllowedWithPermission(permission, handle)`: `verify_via_taskmanager`, `src/permit.rs:593-632`.
  - A request without a permit is checked with `TaskManager.isPubliclyAllowed(handle)`: `verify_publicly_allowed`, `:634-670`.
  - The dispatch between the two is `enforce_acp`, `src/http.rs:1048-1100`.
- **Which block.** Both calls use alloy's `call()` with no block set, so they read at `latest`.
- **How denials map.**
  - `false` becomes `acp_denied` (401) or `not_publicly_allowed` (403).
  - Decoded `PermissionInvalid_*` reverts map to 401, and any other revert to 502.
  - The port answers `false` for a retired party, so the request is refused as `acp_denied`.
- **The switch.** The check runs only when the service's ACL enforcement is on (`REQUIRE_PERMIT`, `src/main.rs:114-136`). Every environment the code bakes in sets it to true; with it off, no view is consulted.
- **Why the engine needs its own operand entry.** The service calls the views through the TaskManager. An exemption by caller identity would exempt exactly this call (§2, R10 negative test).

**The rest of the verifier side.**
- **The threshold network's dispatcher.** `teecryptor`'s comments say it calls the same view the same way. Its repository (`FhenixProtocol/threshold-network`) is not public, so it is **not examined**.
- **`zee-k-verifier`** (`47a59438`). It verifies and signs encrypted inputs, and consults no authorization view.

## 6. The ERC's Fhenix mapping row, checked against the code

The Fhenix column of the ERC's mapping table (Rationale) was re-read against `b5c20ed` and `teecryptor` `2616344`.
Five rows changed:

| Row | Before | After |
|---|---|---|
| Use | `isAllowed`, `persistAllowed` | adds `allowedTransient`, and that FHE.sol reaches `isAllowed` through `TaskManager.isAllowed` |
| Permit | `isAllowedWithPermission` | relayed as `TaskManager.isAllowedWithPermission`, which the decryption service calls; it consults the issuer and the recipient |
| Liveness getter | none | the permit's validity probe `checkPermissionValidity`; the share registry's `isShareValid` and `sharesFor` |
| Public | `isPubliclyAllowed` | `globalAllowed`, relayed as `TaskManager.isPubliclyAllowed`, which the service calls for a request without a permit; `isAllowedForDecryption` is a second flag |
| Grant paths | the relayed grants and "the share paths" | adds `batchAllowTransient`, `shareCtHash`, `delegateAccount` and the registry's `share`; the engine's own transient grants are R10's class |

**Other ERC changes.**
- The Engine row now says the TaskManager relays "grants, the use view and the permit check, always as itself".
- The Rationale's engine paragraph gains one measured sentence, from the R10 negative test (§2): on a port of this
  registry, a caller-identity exemption passes every relayed grant and the decryption service's permit check for a
  retired account [M, P2.1].
- The sources line names the Phase 4 re-check.
- "Where the tests live" gains a row for this port.

## 7. What this does not show

- **A Fhenix chain.** Everything ran in Foundry: the port beside Fhenix's unmodified contracts, and Fhenix's published
  mock stack. No Fhenix node, threshold network or decryption service ran, and none was contacted.
- **Fhenix's own Hardhat suite.** It needs a local Fhenix node. TC3 stands on the differential test and on the plugin
  suite instead (§3).
- **The threshold network's dispatcher.** Its repository is not public, so the verifier side is examined only in
  `teecryptor`.
- **Whether production runs with `REQUIRE_PERMIT` on.** Every environment baked into the code sets it, but deployment
  configuration was not seen.
- **Room in the TaskManager.** The port leaves 80 bytes under EIP-170 with Fhenix's settings (§1). A different
  operand-check design, or a change to Fhenix's build, may be needed for a production port.
- **Two plugin-suite failures** are explained, not fixed (§4).

## Evidence

- Code:
  - the port and its project: `impl/fhenix-port/` (`foundry.toml` profiles `default`, `baseline`, `e2e`,
    `e2e-vendor-baseline` and `e2e-vendor-port`);
  - the vendored sources and their hashes: `impl/fhenix-port/vendor/PROVENANCE.md`.
- Harness scripts: `impl/harness/phase4/p21_mutations.py` and `make_p21_vendor_tests.py`.
- Raw data, under `raw/p21/`:
  - `port.diff`; `baseline_build.log`; `sizes_port.log`, `sizes_port_r2.log`, `sizes_port_with_tests.log`,
    `sizes_baseline.log`;
  - `forge_port_r{1,2,3}.log`; `mutations/` (`MUTATIONS.md` and one log per mutation). `first-run-16of17/` keeps the
    first run: it missed M10, the ERC-165 half of the upgrade guard, until a TC11 case for it was added;
  - `e2e/`: `fhenix_e2e_r{1,2,3}.log` and `vendor_plugin_{baseline,port}_r{1,2,3}.log`, with the isolated runs kept
    in `superseded-isolated/`;
  - `superseded-before-kit/`: the port suite's runs before the kit adapter was added;
  - `SCAN_REPORT.txt`: no secret-class hit.
- Decisions D41–D55 and D67. The scan exempts forge's fuzz-seed line.
