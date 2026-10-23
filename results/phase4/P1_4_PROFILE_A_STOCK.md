# P1.4: Profile A on stock OpenZeppelin

**Proof class:** Mock (Foundry). **Status:** done. **Date:** 2026-10-21.
**Machine:** M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), forge 1.8.5, solc 0.8.27, `FOUNDRY_ISOLATE=false`.
**Project:** `impl/p14-oz-stock/`. **Raw logs:** `raw/p14/forge_test_r{1,2,3}.log`.

## What is tested

Phase 3 ran Profile A on a mechanically ported copy of OpenZeppelin, adapted to the host-contracts suite (pragma, the FHE
import, `require` with custom errors). This run uses the **unmodified npm package** instead:

- `@openzeppelin/confidential-contracts@0.5.3`, with its peer dependency `@openzeppelin/contracts@5.6.1`;
- each tarball checked against the registry's SHA-512 (`impl/p14-oz-stock/vendor/PROVENANCE.md`);
- compiled with solc 0.8.27, as the package requires.

The FHE library is our branch's: `library-solidity` on `lifecycle/level3` `f1b440e`, which has `FHE.isAccountRetired`.

The test environment deploys our branch's ACL with the lifecycle Core, the executor and the HCU limit, through Zama's
`HostContractsDeployerTestUtils`.

**Dependency versions.** The host contracts resolve OpenZeppelin to Zama's own 5.1.0 copies through Foundry context
remappings. The build log confirms that each side compiled against its own copy:

- 27 host-side OpenZeppelin files from 5.1.0;
- 3 OpenZeppelin files from 5.6.1, and 6 from confidential-contracts 0.5.3, on the token side.

## The extension: 37 lines, 18 of code

`impl/p14-oz-stock/src/ERC7984ProfileA.sol` is an `abstract contract ERC7984ProfileA is ERC7984ObserverAccess`. It
overrides only the two identity-gated grant functions:

| Function | Gate | Still allowed |
|---|---|---|
| `setObserver(account, X)` | reverts with `ERC7984GrantByRetiredAccount(account)` if `X != 0` and `account` is retired | clearing, by the account or by the observer |
| `setOperator(operator, until)` | reverts if `until >= block.timestamp` and the caller is retired | revoking (an expiry in the past) |

What it leaves alone:

- `_update` is untouched, so transfers to and from retired accounts go through (A2);
- nothing is asserted after a grant (A3);
- the observer and operator logic is OpenZeppelin's own.

A token adopts the profile by adding `ERC7984ProfileA` to its bases. In the test, `ProfileAStockToken` differs from
`StockObserverToken` only in that base (`test/Tokens.sol`).

## Results [M]: 14/14 in three runs, and 14/14 under `isolate = true`

Logs: `raw/p14/forge_test_r{1,2,3}.log` (isolation off). Isolation on: `raw/p14/forge_test_isolate_on_r{1,2}.log`,
two runs on 2026-10-22 on the same tree (`FOUNDRY_PROFILE=worktree`); the first isolation-on run's log was not kept.
`raw/p14/forge_test_worktree_profile_check.log` is one more isolation-off run under the `worktree` profile, 14/14, to
show that profile reproduces the original runs (same gate figures). With isolation on, each call runs as its own
transaction, so the registry starts cold: the operator gate measures **+12,798**, the cold figure that P2.4 found with
the Foundry nightly (below). The observer gate measures +3,838 there, 12 gas above the nightly's +3,826; that
difference is not analysed here.

**TC8 (R8, A2)**, on both tokens:

- A transfer to a retired account succeeds. The token keeps access, the sender keeps access to the amount, and the grant to the retired recipient is inert.
- With a fresh input, the retired account moves its funds directly, and so does an operator it set while active. This is limit 2: oracle access only.

**TC23, A1: the residual without Profile A, quantified.** The thief's observer is measured over 5 inbound transfers to
the retired holder. Each transfer creates a new balance handle and an amount handle.

| Scenario | Stock OpenZeppelin | With the extension |
|---|---|---|
| The thief adds an observer **after** retirement | allowed; it reads the current balance and **10 of 10** later handles | refused; it reads **0** |
| The thief added it before retirement; the retired owner clears it; the thief re-adds it | the re-add succeeds; it reads **10 of 10** | the re-add is refused; it reads **0** (what it read before the clear stays readable: not a clawback) |
| The thief added it before retirement and nobody clears it | it reads 10 of 10 | it still reads **10 of 10**: the extension gates grant paths only, so the owner must clear it (A1) |
| `setOperator` by the retired holder | `until == now` and `until = max` are both granted | refused; revoking stays allowed |

**Fail-closed check.** Against a registry without the lifecycle Core, both gates revert instead of granting.

**Gas [M].** These are execution gas with the token and the registry proxy cold, by an active account (the Phase 3
method):

| Call | Stock | With the extension | Gate |
|---|---|---|---|
| `setOperator(op, now + 1 day)` | 24,909 | 32,707 | **+7,798** |
| `setObserver(account, X)`, with a balance | 69,794 | 73,620 | **+3,826** |

These match Phase 3's ported copy within 20 gas (+7,781 and +3,809).

**Correction (P2.4 §6).** forge 1.8.5's `vm.cool` cools storage but leaves accounts warm, so the token and the
registry were warm here despite the `vm.cool` calls.
- With the Foundry nightly, which cools them too, the figures under Osaka are (`raw/p14/nightly-cold/`, two identical
  runs):

  | Call | Stock | With the extension | Gate |
  |---|---|---|---|
  | `setOperator(op, now + 1 day)` | 27,409 | 40,207 | **+12,798** |
  | `setObserver(account, X)`, with a balance | 77,294 | 81,120 | +3,826 |

- The operator gate's extra 5,000 is the registry's proxy and implementation, cold. Stock `setOperator` never
  touches them.
- The observer gate is unchanged: stock `setObserver` already touches the registry.

## Not covered here

- **A4, generic-call paths.** A4 is about a contract that forwards arbitrary calls. Stock ERC-7984 has no such path, so A4 is not a property of this token. Phase 3's TC23 A4 tests cover it on the registry.
- **Other identity-gated roles** in other OpenZeppelin extensions (agents, freezers).
- **Adoption by OpenZeppelin.** It is outside our control. Until a token adds the extension, the residual above holds.

## Reproduction

From a clone of the public repository: `python scripts/repro.py profile-a` (or `make profile-a`). It builds Zama's main
with the level0, level2 and level3 patch series in `impl/fhevm-main`, which `foundry.toml`'s default profile points
at, and expects 14 passed:

```bash
python scripts/repro.py profile-a
```

In the authors' layout, with the same tree as the worktree `impl/wt-l2-main`:

```bash
cd impl/p14-oz-stock && FOUNDRY_PROFILE=worktree FOUNDRY_ISOLATE=false forge test -vv
```
