# P1.5: the 0.14 line, U6 and the release train

**Proof class:** Mock (Foundry), plus read-only public RPC for the deployed versions. **Status:** done.
**Date:** 2026-10-21/22. **Machine:** M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), forge 1.8.5, solc 0.8.24,
`FOUNDRY_ISOLATE=false`. **Raw data:** `raw/p15/`.

## 1. ACL 0.5.1 with Core on tag v0.14.4

The branch is `lifecycle/level0-v0.14`, in the worktree `impl/wt-l0-v014`, cut from tag `v0.14.4` (`ccdd1ce0d`, 2026-10-20). That tag's ACL is
0.5.0, reinitializer 6, identical to `v0.14.2`.

| Commit | Change |
|---|---|
| `a4f367bd` | ACL v0.5.1: main's Level 0 change (`0fbe9a67`) ported to 0.5.0. Same retirement namespace, views, grant gates, ERC-165 and upgrade guard. `reinitializeV6()`, reinitializer 7. ACL 0.5.0 has no `isDelegatedForUserDecryption`, so that gate is not ported; otherwise its public functions are main's |
| `a2fa91bf` | Main's Level 0 tests ported (`impl/harness/phase4/port_l0_tests_v014.py`, every edit listed there). The upgrade matrix is rewritten for this line, with U6. New fixtures: ACL v0.4.2 (with its own events) and v0.5.1 drift and attribution variants (`make_fixtures.py`). The Hardhat upgrade test expects v0.5.1 |

**Two line differences found by the port.** Neither is a defect.

- **The `isDelegatedForUserDecryption` view.** ACL 0.5.0 does not have it. The tests rebuild its answer as main computes it: false for a retired contract, else the wildcard row or the per-contract row is active.
- **Revocation during a pause.** On 0.5.0, `revokeDelegationForUserDecryption` is `whenNotPaused`; main lifted that later. A retired account therefore revokes once the ACL is unpaused, like any other account on this line.

**Suites [M], three runs each:**

| Suite | Result |
|---|---|
| Unmodified v0.14.4, the whole host-contracts Foundry suite (baseline) | **676/676** (14 suites) |
| `lifecycle/level0-v0.14`, the whole suite | **759/759** in each of three runs = Zama's 676 + our 83 |
| Our 83, by file | `ACLRetirement` 29, `ACLRetirementExemption` 24, `ACLRetirementUpgradeMatrix` 17, `ACLRetirementGas` 12, `ACLRetirementBridge` 1 |

**Build environment.** The worktree gets the same Solidity dependency copies the main clone uses, copied rather than
linked, because Foundry refuses paths outside the project root:

- `node_modules`: OpenZeppelin 5.1.0, `encrypted-types`, LayerZero, `foundry-upgrades`, `solidity-bytes-utils`;
- the generated `addresses/` folder;
- forge-std 1.11.0.

v0.14.4's `host-contracts/package.json` pins the same versions as main.

## 2. U6 and the rest of the upgrade matrix on this line [M]

Reinitializers: v0.4.0 = 5; v0.4.1 (our v0.13 Level 0) = 6; v0.4.2 (our v0.13 E1) = 7; v0.5.0 = 6; v0.5.1 = 7.

| Case | Path | Result |
|---|---|---|
| U0 = U6 | v0.5.0 → v0.5.1 with `reinitializeV6()` | state preserved; Core active; version 7; then the guard refuses a rollback to v0.5.0 |
| U6 | v0.4.0 → v0.5.1 | state preserved, version 5 → 7, Core active |
| U2 = U6 | v0.4.1 (bits set) → v0.5.1 | the guard accepts; bits and enforcement preserved, 6 → 7 |
| **U6** | **v0.4.2 (our E1) → v0.5.1** | **the upgrade call reverts with `InvalidInitialization`: both releases take reinitializer 7** |
| U6 | v0.4.2 → v0.5.1 without the call | goes through; enforcement intact; **E1 is dropped** (no successor view; its state is orphaned in the namespace) |
| U1 | v0.4.0 → v0.4.1 | as on the v0.13 line |
| U3 | guard-less v0.4.1 → v0.5.0 (no call: the numbers collide) | enforcement lapses (hazard demo) |
| U4 | v0.4.1 → v0.5.0 | `UpgradeDropsRetirement`, with or without the call |
| U4b, U4c | drifted namespace, location without Core, Core-less targets | refused by the guard; without the location check a drifted release resets retirements |
| U5 | v0.4.1 → v0.5.0 | the guard fires first; the reinitializer collision sits behind it |
| U7 | a lying v0.5.0-based implementation | passes the guard (asserted residual) |

**OpenZeppelin upgrades-core 1.44.2 `validate`** (`impl/harness/phase4/oz_validate_v014.sh`, `raw/p15/oz_validate_v014.log`):

| Upgrade | Result |
|---|---|
| 0.5.0 → 0.5.1 | ✔ |
| 0.4.1 → 0.5.1 | ✔ |
| 0.4.0 → 0.5.1 | ✔ |
| 0.4.2 → 0.5.1 | ✘ "Deleted `succession`", "Deleted `successorDelayOf`" (expected: E1 dropped) |
| Negative control, 0.4.0 with 0.5.1 as its reference | ✘, so the validator is not vacuous |

## 3. The release train

**The problem.** A UUPS upgrade runs the new release's `reinitializeV*()` through OpenZeppelin's `reinitializer(N)`,
which reverts unless N exceeds the proxy's current version. Zama's CI checks that the version changes, not that it
grows (Phase 3 deviation 12). Zama numbers its releases 5 (0.4.0), 6 (0.5.0) and 8 (0.7.0). Each of our lifecycle
releases took the next integer, the one Zama's own next release on that line will take.

**The check.** `scripts/check_reinitializer_order.py` reads every release from git: version, reinitializer, Core, E1
and E2. It builds every plausible upgrade path and requires the reinitializer to grow along each:

- lines move forward;
- versions grow within a line;
- a Core release only goes to a Core release of the same or a higher lifecycle level;
- for each line, a projected next Zama release can go to every lifecycle release on that line or a later one.

The check was run twice, against all our branches and Zama's three bases (`raw/p15/release_train_*.{txt,json}`):

| Releases | Paths | Violations |
|---|---|---|
| As built today | 42 | **3**: Zama's projected next release on each line (6, 7, 9) meets our lifecycle release with the same number (v0.13 L0 = 6, v0.14 L0 = 7, main L0 = 9) |
| With the proposal below | 42 | **0** |

Without the projected releases, today's branches have no violation. The two known collisions sit on paths the rules
exclude:

- **0.4.1 → 0.5.0.** The guard refuses this path.
- **0.4.2 → 0.5.1.** This path would drop E1, and U6 and the validator show it.

**The proposal.**

1. **Number lifecycle releases from 1000 upward**, ordered by line, then by level: `1000 + 100 × line + 10 × (level + 1)`. That gives:
   - the v0.13 line: L0 1010, E1 1020, E2 1030;
   - the v0.14 line: 1110, 1120, 1130;
   - main: 1210, 1220, 1230.

   Zama's own releases keep their numbers and have about 990 numbers of room below.
2. **Never upgrade to a lower lifecycle level.** The guard does not catch a dropped extension; the validator does. Run it in CI against the deployed release.
3. **Run the check in CI on every release branch.** That is Phase 3 decision #17, which defaults to proposing it before a second production backport.
4. **If Zama ships Core in its own releases,** those releases need numbers above every lifecycle release that can precede them. That needs coordination, and we do not control it.

The proposal is a numbering rule only. No branch was renumbered in this phase: renumbering would change every
fixture and upgrade test, and it is Semih's call (listed in the report's decisions).

## 4. Deployed versions, re-checked read-only [M]

`impl/harness/phase4/deployed_versions.py` (`raw/p15/deployed_versions.json`), on 2026-10-22 (UTC):

- the EIP-1967 implementation slot (`eth_getStorageAt`) and `getVersion()` through the proxy (`eth_call`), both at the head block;
- the implementation's code hash (`eth_getCode`) and Sourcify's record.

There were no transactions, and at most five requests per chain.

| Chain | Block | ACL proxy | Implementation | `getVersion()` | Sourcify |
|---|---|---|---|---|---|
| Ethereum mainnet | 26,243,565 | `0xcA2E…ffb6` | `0x9a01…5418` | **ACL v0.4.0** | verified (`match`), solc 0.8.24 |
| Sepolia | 11,964,983 | `0xf0Ff…433D` | `0xf4f7…ab98` | **ACL v0.4.0** | verified (`match`), solc 0.8.24 |

Both networks still run the v0.13 line's ACL. The baseline is unchanged; nothing to update. Sourcify's v2 API
answers `match` for both implementations: the bytecode matches the verified `contracts/ACL.sol:ACL`, without an exact
metadata match (that would read `exact_match`).

Endpoints: mainnet used the public endpoint the Phase 2 census used. Sepolia used the project's configured
`SEPOLIA_RPC_URL`, read from `.env` and never printed. Neither is a Zama endpoint.

## 5. Reproduction (from `fhe-authority-lifecycle/`)

```bash
cd impl/wt-l0-v014/host-contracts && FOUNDRY_ISOLATE=false forge test
bash impl/harness/phase4/oz_validate_v014.sh
python -I scripts/check_reinitializer_order.py
python -I scripts/check_reinitializer_order.py --proposal
python -I impl/harness/phase4/deployed_versions.py . results/phase4/raw/p15/deployed_versions.json
```
