# Level 2, part (b): Profile A (applications)

**Status.** Done for the prototype on main. TC23 (rules A1–A4) passes **15/15**. The tests use:
- ACL v0.9.0;
- OpenZeppelin ERC-7984 0.5.3 with its observer extension (vendored test-only copies);
- the new library helper `FHE.isAccountRetired`.

Each Profile A rule runs next to a variant without it.

**Two corrections to our own specification came out of the tests:**
1. **The operator gate was off by one.**
   - TARGET §3.9 and the deliberation said that `setOperator(op, until)` reverts if `until > now` and the caller is
     retired.
   - ERC-7984 operators are valid while `block.timestamp <= until`. A retired holder could still call
     `setOperator(op, now)` and get an operator for the rest of the current timestamp
     (`test_A1_OperatorUntilNowIsAGrant`).
   - The gate is now `until >= now`. It is fixed in TARGET §3.9, its Turkish twin and the ERC's A1 example.
2. **A4 must cover the registry's `multicall`.**
   - The ACL's `multicall` runs each entry by `delegatecall` and keeps the caller as `msg.sender`.
   - A generic-call path that refuses the lifecycle selectors but forwards `multicall` still retires the contract
     (`test_A4_Residual_GenericCallRetiresTheContract`).
   - The ERC's A4 now names it.

**One finding strengthens A4.**
- Through the same generic-call path, whoever controls it can designate itself as the contract's successor, accept,
  wait D, confirm and retire the contract.
- The delegated view then answers true for (contract, attacker) on the contract's handles
  (`test_A4_Residual_GenericCallHandsTheContractToASuccessor`, view level).
- Before this, A4 only guarded against the contract retiring itself.

Labels:
- **[M]:** measured on M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), forge 1.8.5, solc 0.8.24, 2026-10-21.
  - Suites run with `FOUNDRY_ISOLATE=false`, as every suite here does (`results/level0/ENV_BASELINE.md` §3.4).
  - The Profile A suite also passes 15/15 under Foundry's default `isolate = true`.
- **[E]:** estimated.

## 1. Code

**Branch.** `lifecycle/level2` in `impl/wt-l2-main`. Three commits sit on top of the E1 commits:

| Commit | Files | Change |
|---|---|---|
| `43db5ba` | `library-solidity/codegen/src/templates/{FHE,Impl}.sol-template`, `library-solidity/lib/{FHE,Impl}.sol`, `host-contracts/lib/{FHE,Impl}.sol` | `FHE.isAccountRetired(address)` → `Impl.isAccountRetired` → `IACL.isAccountRetired`, next to `isAccountDenied` |
| `02e484d` | `host-contracts/test/acl/retirement/oz-confidential-contracts-0.5.3/token/ERC7984/extensions/ERC7984ObserverAccess.sol`, `test/acl/retirement/ProfileAMocks.sol`, `test/acl/ACLRetirementProfileA.t.sol` | the Profile A token, the counter-examples, the generic-call vaults and TC23 |
| `ea4e7a7` | five Level 0 and E1 test files, `host-contracts/.prettierignore` | prettier, whitespace only (checked token by token); the vendored OpenZeppelin copy is ignored |

The v0.13 line gets the same style commit as `588e639`.

**The helper.**
- **It fails closed.** It requires an ACL with the lifecycle Core: against a registry without it, the call reverts
  (`test_Helper_RevertsAgainstARegistryWithoutCore`). A Profile A gate on an older registry therefore refuses instead
  of granting.
- **Zama's codegen was not re-run.** Its entry point checks that `__dirname` ends with
  `library-solidity/codegen/dist/_esm`, a POSIX path, and its own dependencies (commander, prettier) are not installed
  in our clone. Instead:
  - a script copied the blocks added to the two templates into the four generated files;
  - the `library-solidity` and `host-contracts` insertions are identical;
  - prettier passes on the generated files;
  - `library-solidity` compiles with its own Foundry configuration (34 files; `raw/L2_library_solidity_build.log`).
- **Main only.** The v0.13 line's library has the same `isAccountDenied` anchor. On that line an application calls
  the registry view directly.

**The vendored observer extension.**
- `impl/harness/level0/port_oz_erc7984.py` now ports six files.
- The new file differs from OpenZeppelin by three mechanical changes: the pragma, the FHE import and
  `require(cond, Err())` → `if (!(cond)) revert Err()`.
- The five files ported at Level 0 are unchanged, byte for byte.

## 2. The Profile A token

`ERC7984ProfileAToken` (`ProfileAMocks.sol`) is OpenZeppelin's ERC-7984 with `ERC7984ObserverAccess` and two gates:

| Path | Gate | Still allowed |
|---|---|---|
| `setObserver(account, X)` | reverts with `ERC7984GrantByRetiredAccount(account)` if `X != 0` and `account` is retired | clearing (`X = 0`), by the account or by the observer itself |
| `setOperator(op, until)` | reverts if `until >= block.timestamp` and the caller is retired | revoking (`until` in the past, such as 0); operators set before retirement stay until revoked |

**What it leaves alone:**
- `_update` is unchanged, so transfers to and from retired accounts go through (A2);
- the token asserts nothing after granting (A3);
- both gates read the bit through `FHE.isAccountRetired`.

## 3. TC23 results [M]: 15/15

| Test | Rule | Shows |
|---|---|---|
| `test_A1_ThiefObserverClearedAndCannotBeReAdded` | A1 | **The thief's observer is gone for good.** A thief adds an observer, then the owner retires. The retired owner clears the observer, and neither it nor another observer can be added again. The next inbound transfer reaches no observer. What the observer read before the clear stays readable (not a clawback) |
| `test_A1_ObserverMayAbdicate_ActiveAccountUnaffected` | A1 | The observer can still abdicate, and an active account sets and replaces observers as before |
| `test_A1_Residual_VanillaObserverLeaksAfterRetirement` | asserted residual | **Without Profile A the leak continues.** After retirement the thief adds an observer, which reads the current balance and the next balance and amount. When the owner clears it, the thief adds it again |
| `test_A1_D22_NaiveGateLocksInTheThiefObserver` | D22 | A gate that refuses every call for a retired account stops the owner from clearing, so the thief's observer keeps reading every later amount |
| `test_A1_OperatorUntilNowIsAGrant` | A1 (correction 1) | On the vanilla token, a retired holder's `setOperator(op, now)` makes `op` an operator in the current block |
| `test_A1_OperatorGate` | A1 | `until` in the future, equal to now, or the maximum: refused. Revoking: allowed. An active holder: unaffected |
| `test_A2_TransferToRetiredAccountSucceeds` | A2 | Inbound transfers succeed. The grant to the retired recipient is inert, and the token and the sender keep access |
| `test_A2_TransferFromRetiredAccountSucceeds` | A2 | With a fresh input, the retired account moves funds directly, and so does an operator it set while active (limit 2: oracle access only) |
| `test_A3_PostGrantAssertionBreaksTransfersToRetiredAccounts` | A3 | A token that asserts the recipient's access after granting reverts on every transfer to a retired account. The Profile A token accepts the same transfer |
| `test_A4_Residual_GenericCallRetiresTheContract` | A4 (correction 2) | An admin generic call retires the contract, directly and through `multicall`. The contract's handles are bricked: `persistAllowed` is false, and sharing them reverts with `SenderRetired` |
| `test_A4_Residual_GenericCallHandsTheContractToASuccessor` | A4 | The generic-call path designates and confirms an attacker as successor, then retires the contract. The delegated view answers true for (contract, attacker) |
| `test_A4_ProfileARefusesLifecycleCalls` | A4 | Each of the seven lifecycle functions (Core and E1), and `multicall`, is refused with `LifecycleCallRefused(selector)`. Other registry calls still go through |
| `test_Helper_FHEIsAccountRetiredFollowsTheRegistry` | helper | The helper follows the registry bit |
| `test_Helper_RevertsAgainstARegistryWithoutCore` | helper | The helper fails closed against a registry without Core |
| `test_Gas_A1GateOverhead` | gas | Section 4 |

## 4. Gas [M]

**Method.** The execution gas of one call from the test contract, by an active account:
- cold state: `vm.cool` on the token, the ACL proxy and its implementation;
- no 21,000 base cost and no calldata cost;
- the two tokens get different balance handles and observers, so neither call writes a slot the other one wrote.

| Call | Vanilla | Profile A | Gate |
|---|---|---|---|
| `setOperator(op, now + 1 day)` | 25,111 | 32,892 | **+7,781** |
| `setObserver(account, X)`, with a balance | 70,067 | 73,876 | **+3,809** |

**Why the observer gate costs less.** The gate's view warms the ACL proxy and implementation, and the observer grant
that follows then uses them warm.

**Phase 4 correction** (`results/phase4/P2_4_AMSTERDAM.md` §6).
- forge 1.8.5's `vm.cool` cools storage slots but leaves accounts warm. The ACL proxy and implementation were
  therefore warm in the table above.
- With both cold, as on a transaction's first touch, the operator gate costs **+12,804** under Osaka and +13,604
  under Amsterdam [M, Foundry nightly `9089a6b`, on `lifecycle/level3` `f1b440e`]. forge 1.8.5 gives +7,804 at that
  commit.
- The observer gate is unchanged (+3,832 at that commit), because vanilla `setObserver` already touches the ACL.

## 5. Suites [M]

- **Full host-contracts Foundry suite on main: 851/851.** That is the 836 E1-level tests plus the 15 new ones
  (`raw/L2_forge_full_profileA_main.log`).
- **After the style commits:** the ACL folder passes 203/203 on main and 173/173 on the v0.13 line
  (`raw/L2_forge_acl_after_prettier_*.log`).
- **Prettier:** every lifecycle Solidity file passes on both lines.
- **Isolation:** `ACLRetirementProfileA.t.sol` passes 15/15 under Foundry's default isolation too
  (`raw/L2_forge_profileA_isolate_default.log`).

## 6. What this does not show

- **Upstream adoption.** OpenZeppelin adoption is outside our control. Without it, a thief-added observer keeps reading
  the current balance and every future amount (TC23's asserted residual).
- **Other identity-gated roles.** Only the observer and operator gates are implemented. Agents, freezers and similar
  roles in other OpenZeppelin extensions are not covered.
- **The unwrap path.** `ERC7984ERC20Wrapper.unwrap` with a fresh input publicly decrypts the burnt amount. That is
  asset authority (limit 2), not a Profile A matter.
- **A full decryption through the hijacked succession.** The A4 succession case is shown at the view level. The
  connector reads the same view; the E1 connector proof covers that path.
- **The helper on the v0.13 line** (section 1).

## 7. Reproduction (from `fhe-authority-lifecycle/`)

```bash
FOUNDRY_ISOLATE=false forge test --root impl/wt-l2-main/host-contracts --match-path test/acl/ACLRetirementProfileA.t.sol -vv
FOUNDRY_ISOLATE=false forge test --root impl/wt-l2-main/host-contracts
python -I impl/harness/level0/port_oz_erc7984.py experiments/node_modules/@openzeppelin/confidential-contracts impl/wt-l2-main/host-contracts/test/acl/retirement/oz-confidential-contracts-0.5.3
```

Raw logs are in `results/level2/raw/`:
- `L2_forge_profileA_main.log` (the committed code `ea4e7a7`, with the gas lines; SHA-256 `a4cc9c97…9ddd`);
- `L2_forge_full_profileA_main.log`;
- `L2_forge_profileA_isolate_default.log`;
- `L2_forge_acl_after_prettier_wt-l2-main.log` and `L2_forge_acl_after_prettier_wt-l2-v0138.log`;
- `L2_library_solidity_build.log`.
