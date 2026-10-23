# P2.4: Amsterdam receipts (Local-Amsterdam)

**Proof class:** Local-Amsterdam. Transaction receipts on a local anvil that applies the Amsterdam schedule [M].
Frame gas from Foundry where a row says so [M]. Reading of the EIP texts and of revm's source [V]. Computed values [E].
**Date:** 2026-10-22. **Status:** done.
**Machine:** M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), Node 22.13.
**Raw data:** `raw/p24/`. Runs r1–r3 of the receipts are identical, apart from the ±12 gas noted in §5; the other
checks ran twice, with identical results.

## 1. The local chain

**anvil from Foundry nightly `9089a6b`** (1.8.6-nightly, built 2026-10-21; revm 43.0.3), with `--hardfork amsterdam`
(D63). The released anvil 1.8.5 does not apply Amsterdam's state-creation pricing (Phase 3, RESULTS §2.9).
Each harness also runs under `osaka` on the same binary, for comparison.

**Calibration** (`raw/p24/r1/L0_gas_anvil_main_*.json`), receipt `gasUsed` [M]:

| Transaction | Osaka | Amsterdam |
|---|---|---|
| A call with no data and no value | 21,000 | 15,000 |
| 1,000 zero bytes of calldata | 31,000 | 79,000 |
| 1,000 non-zero bytes of calldata | 61,000 | 79,000 |
| One new storage slot | 43,609 | 125,529 |
| The same value written again | 23,709 | 17,609 |

[V] These agree with the Amsterdam EIPs as they stand (texts of 2026-10-22, all Last Call):
- EIP-8037: state gas of 64 × 1,530 = 97,920 per new slot (`CPSB` 1,530), the constant revm 43.0.3 uses;
- EIP-2780: 15,000 for a call without value;
- EIP-7976: a calldata floor of 64 gas per byte;
- EIP-8038: cold account access 3,000 instead of 2,600.

**The match with Sepolia [M].** Phase 1 measured Zama's unmodified ACL v0.7.0 on Sepolia: one `allow` of a new pair
at **140,780** gas, and 119,201 per extra handle in a `multicall`. Its local Osaka anvil gave 58,348 and 31,083.

| | Sepolia (Phase 1) | Nightly, Amsterdam | Phase 1's Osaka anvil | Nightly, Osaka |
|---|---|---|---|---|
| `allow`, new pair, v0.7.0 | 140,780 | **140,780** | 58,348 | 58,360 |
| Per extra handle | 119,201 | 119,211 (n = 1→10) | 31,083 | 31,091 (n = 1→10) |

The Amsterdam-minus-Osaka difference per handle is 88,118 on Phase 1's pair and 88,120 here. The few gas between
runs come from the handles' bytes, as between Phase 1's Osaka run and this one.

**The nightly's Osaka equals Phase 3's.** Every Level 0, Level 2 and carry-tool receipt under `osaka` equals Phase 3's
number to the gas. The E2 signature transactions vary by ±12 gas between runs (§5).

## 2. `allow`, `retireAccount` and the carry: receipts [M]

Level 0's harness (`level0/anvil_gas.mjs`), unchanged: Zama's ACL v0.7.0 and the Level 0 ACL v0.8.0, production
artifacts (solc 0.8.24, 800 runs, cancun). Each step is its own transaction.

| Transaction | Osaka | **Amsterdam** | Phase 3's estimate [E] |
|---|---|---|---|
| `allow`, new pair, v0.7.0 | 58,360 | **140,780** | ≈ 146,480 |
| `allow`, new pair, v0.8.0 | 60,593 | **143,013** | — |
| `allow`, existing pair, v0.7.0 | 38,460 | **32,860** | — |
| `retireAccount`, v0.8.0 | 50,099 | **132,519** | ≈ 138,219 |
| Carry, n = 1 (v0.8.0: grants, then `retireAccount`) | 89,113 | **259,753** | ≈ 265,353 |
| Carry, n = 10 | 371,045 | **1,334,765** | ≈ 1,340,365 |
| Carry, n = 100 | 3,191,061 | **12,085,581** | ≈ 12,091,181 |
| Carry, n = 500, one transaction, no cap | 15,750,135 | **59,892,655** | ≈ 59,898,255 |
| Per handle (n = 1→500) | 31,385 | **119,505** | ≈ 119,505 |

- **Phase 3's estimates were 5,600–5,700 gas high** on every row, and exact per handle. Most of the gap is the base
  charge: the estimates kept 21,000, and the schedule charges 15,000.
- **One new slot costs +82,420 gas** in a transaction under Amsterdam: `allow` 58,360 → 140,780, `retireAccount`
  50,099 → 132,519.
- **Level 0's own cost does not change:** `allow` on v0.8.0 costs 2,233 more than on v0.7.0 under both forks. The
  retirement read creates no state.
- **A 500-handle carry needs about 59.9M gas** under Amsterdam. Whether one transaction may carry it is §4.

## 3. The carry tool under Amsterdam [M]

`level2/carry_e2e.mjs`, ACL v0.9.0, with P2.4's overrides (D64): under Amsterdam the tool chunks at 130 handles.

| k | Osaka, one transaction | Amsterdam |
|---|---|---|
| 0 (retirement only) | 58,126 | 140,646 |
| 1 | 93,423 | 264,063 |
| 10 | 375,367 | 1,339,087 |
| 50 | 1,628,498 | 6,117,018 |
| 100 | 3,194,243 | 12,088,763 |
| 200 | 6,331,207 | two transactions: 15,556,874 and 8,506,120 |
| 400 | 12,610,093 | four: 15,556,982, 15,556,874, 15,556,826 and 1,339,063 |
| 500 | 15,748,385 | four: 15,555,314, 15,555,206, 15,555,314 and 13,283,339 |

- **Per handle:** 31,386 under Osaka (fit k = 100–400), **119,441** under Amsterdam (fit k = 10–100). Base: 58,126
  and 140,646.
- **The tool's behaviour is the same under both forks:**
  - the dry run plans 121 of 427 grants in chunks of 50, 50 and 21, and sends nothing;
  - it refuses a retired NEW and NEW equal to OLD;
  - a deny-listing before chunk 1 stops the run with OLD still active;
  - the rerun skips what NEW holds and retires OLD;
  - afterwards NEW holds every expected handle and no spam or stale balance, and OLD can use none.

## 4. The largest carry in one transaction

### Measured at a gas limit of exactly 2^24 [M]

The harness finds the largest k whose `eth_estimateGas` is at most 2^24, then sends k and k + 1 handles at 2^24 from
fresh accounts (D65; `raw/p24/r{1,2,3}`, diagnosis in `raw/p24/diag/`).

| | Osaka | Amsterdam |
|---|---|---|
| Linear fit (Phase 3's method) | 532 | 139 |
| **Largest k at 2^24** | **524** | **137** |
| k sent at 2^24 | status 1, 16,509,445 gas | status 1, 16,510,359 gas |
| k + 1 sent at 2^24 | status 0, 16,526,373 gas | status 0, 3,004,109 gas |
| k + 1 sent with ample gas | status 1, 16,541,013 gas | status 1, 16,629,798 gas |
| `eth_estimateGas` for k + 1 | 16,788,902 | 16,889,679 |

**Why the boundary sits below the fit.**
- The ACL sits behind a proxy, so the whole carry runs inside the proxy's `DELEGATECALL`. That call receives at most
  63/64 of the gas left (EIP-150).
- The k + 1 carry therefore uses less than 2^24 but needs a limit above it: under Amsterdam it uses 16,629,798 and
  needs 16,889,679.
- The traces agree. Under Osaka the implementation frame received 15,805,502 gas and ran out. Under Amsterdam it used
  16,316,610 before reverting.

**Why the failed Amsterdam transaction shows only 3.0M gas.** Its frames used 16.3M, but the receipt keeps 3,004,109.
[I] This is EIP-8037's rollback rule: state gas charged in a reverted frame is returned. The failed Osaka transaction
keeps nearly all its gas.

### Under EIP-8037's own rule [V, E]

[V] EIP-8037 (Last Call, deadline 2026-11-01) applies EIP-7825's 2^24 cap to **execution gas only**:
- state gas is drawn first from a reservoir, the part of `tx.gas` above the cap;
- `tx.gas` may reach 2^32 − 1, and must fit the block's gas limit.

revm 43.0.3, the nightly's EVM, implements this: its validation skips the `tx.gas` cap when EIP-8037 is on, and
`GasTracker` keeps the reservoir.

**The local chain does not apply it** (D66; `impl/harness/phase4/p24_reservoir_probe.py`, `raw/p24/reservoir/`, two
identical runs). anvil's transaction pool decides the cap:

| anvil setting | 40M transaction | Execution gas above 2^24 |
|---|---|---|
| `--enable-tx-gas-limit` | refused: "tx.gas_limit > resolved tx gas limit cap" | not testable |
| Without it | accepted | accepted: a loop that used 20,515,196 gas of execution succeeded |

So the 137 above is the limit when the whole `tx.gas` is capped, as under Osaka. Under EIP-8037 [E]:

- **Split per handle:** 119,441 = 97,920 state gas (one new slot) + ≈ 21,521 execution.
- **Split of the base:** 140,646 = 97,920 (the retirement's slot) + ≈ 42,726 execution.
- **Execution bound:** about 765 handles. That is 63/64 of 2^24, less the base, at 21,521 per handle.
- **Block bound:** the whole `tx.gas`, about 119,441 per handle, must fit the block's gas limit. That gives about 375
  handles at 45M, 501 at 60M and 836 at 100M.
- **The limit is the smaller of the two.**

**Contract deployment.**
- ACL deployments under Amsterdam need 16.0–26.2M gas [M]:

  | ACL | Initcode (B) | Amsterdam | Osaka |
  |---|---|---|---|
  | Zama v0.4.0 | 10,380 | 15,976,470 | — |
  | Zama v0.7.0 | 11,074 | 17,049,814 | — |
  | Level 0, v0.13 line (v0.4.1) | 11,827 | 18,214,293 | — |
  | Level 0, main (v0.8.0) | 12,736 | 19,620,041 | 2,776,681 |
  | Level 3, main (v0.10.0) | 17,004 | 26,220,448 | 3,699,844 |

- At a gas limit of 2^24 each of these but v0.4.0 fails, consuming all its gas. With the pool's cap on, 30M is
  refused (`raw/p24/cap/r{1,2}`).
- [V] Under EIP-8037 the code deposit is state gas, so these deployments are valid above 2^24, which is the EIP's
  stated aim. The local refusal is the pool's Osaka-style rule, not Amsterdam's.

**The carry tool** refuses a chunk whose estimate exceeds 2^24. Under EIP-8037 that rule is stricter than needed. It
stays correct, because a chunk that fits is valid under both rules.

## 5. E1 and E2 under Amsterdam: receipts [M]

**E1** (`level2/anvil_gas_e1.mjs`, ACL v0.9.0):

| Transaction | Osaka | Amsterdam |
|---|---|---|
| `designateSuccessor` | 62,014 | 144,434 |
| `designateSuccessor`, replacing a pending one | 44,914 | 46,514 |
| `acceptSuccession` | 40,074 | 41,674 |
| `confirmSuccessor` | 57,188 | 139,992 |
| `retireAccount`, no succession record or a confirmed successor | 54,464 | 136,884 |
| `retireAccount`, voiding a pending designation | 52,691 | 135,495 |
| `resignSuccession`, after retirement | 28,688 | 28,071 |
| `cancelSuccessorDesignation` | 30,371 | 29,417 |
| `raiseSuccessorDelay` | 52,711 | 135,131 |
| **Set-up: designate, accept, confirm** | **159,276** | **326,100** |

Views (`eth_estimateGas` of a call):

| View | Osaka | Amsterdam |
|---|---|---|
| `isAllowed`, active account | 32,202 | 26,602 |
| Delegated view, active | 44,405 | 38,805 |
| Delegated view, successor path | 41,989 | 36,389 |

**E2** (`level3/anvil_gas_e2.mjs`, ACL v0.10.0). Three runs; a range is the spread between them:

| Transaction | Osaka | Amsterdam |
|---|---|---|
| `retireAccount` | 54,514 | 136,934 |
| `retireAccountWithSig`, EOA, 1 chain | 65,572–65,584 | 148,492–148,504 |
| `retireAccountWithSig`, EOA, 2 chains | 65,742–65,754 | 148,674 |
| `retireAccountWithSig`, EOA, 5 chains | 66,277 | 149,197 |
| `retireAccountWithSig`, ERC-1271 wallet, 1 chain | 68,015 | 150,923–150,935 |

The ±12 gas spread comes from the zero bytes of the harness's random keys and signatures.

**Reading.**
- A transaction that writes one new slot rises by about 82,400 gas: exactly 82,420 for `retireAccount`, `designateSuccessor` and `raiseSuccessorDelay`, and 82,804 for `confirmSuccessor`.
- Transactions that only change existing slots move by −954 to +1,600 gas.
- Views fall by 5,600: the base charge is 6,000 lower, and the cold ACL implementation costs 400 more.
- A certificate costs about 11,600 gas more than a direct retirement under Amsterdam (11,100 under Osaka), plus about
  180 per extra listed chain.

## 6. The ERC-7984 transfer and the Profile A gates [M, frame gas]

These calls need Zama's executor stack and an ERC-7984 token, which the Level 0 and Profile A suites deploy inside
Foundry. They are measured as frame gas with the nightly's `forge --evm-version amsterdam`, which runs the same revm
schedule (`impl/harness/phase4/p24_forge.sh`, `raw/p24/forge/r{1,2}`).
- Level 0 ran on `lifecycle/level0` `5e61f3de`, Zama's production settings.
- Profile A ran on `lifecycle/level3` `f1b440e7`, default profile.
- [I] A receipt adds the same base and calldata gas to both sides of each pair, so the deltas are the receipt deltas.

| Call (frame gas; caller-side where noted) | Osaka | Amsterdam |
|---|---|---|
| ERC-7984 `confidentialTransfer`, vanilla → Level 0 | 374,771 → 381,838 (**+7,067**) | 301,271 → 308,338 (**+7,067**) |
| The same, caller-side | 379,870 → 386,937 (+7,067) | 1,090,130 → 1,097,197 (+7,067) |
| ERC-7984 `mint` | 295,344 → 299,266 (+3,922) | 230,744 → 234,666 (+3,922) |
| Profile A gate, `setOperator(op, now + 1 day)` | 27,611 → 40,415 (**+12,804**) | 116,031 → 129,635 (**+13,604**) |
| Profile A gate, `setObserver(account, X)` with a balance | 77,523 → 81,355 (+3,832) | 254,963 → 258,795 (+3,832) |

**Reading.**
- **The transfer's delta is the same under both forks (+7,067).** The retirement read creates no state.
- **The operator gate rises by 800 under Amsterdam.** It touches the ACL proxy and implementation cold, and a cold
  account costs 3,000 there instead of 2,600 (EIP-8038).
- **Under Amsterdam the frame of the transfer is smaller.** Its state gas is charged outside the frame: the caller-side
  figure shows it.

### A correction to Phase 2's operator-gate figure

**`vm.cool` differs between the two Foundry versions** (`raw/p24/vmcool/`). A call through a proxy to a cooled
contract that reads one slot costs, caller-side:

| | forge 1.8.5 | nightly |
|---|---|---|
| Warm | 1,116 | 1,116 |
| After `vm.cool` on the proxy and the contract | 3,116 | 8,116 |

- forge 1.8.5's `vm.cool` cools the storage slots but leaves the account warm.
- The nightly cools both, as a transaction's first touch would: 2,000 for the slot, plus 2,500 per account.

**Deltas between calls that touch the same accounts are unaffected.** This covers `isAllowed` (+2,266), the transfer
(+7,067), the carry, and the observer gate, whose vanilla call already touches the ACL.

**The operator gate is affected.**
- Vanilla `setOperator` never touches the ACL. The gate adds a call to the ACL proxy and its implementation, and
  under forge 1.8.5 both were warm.
- At the same commit, forge 1.8.5 gives +7,804 and the nightly **+12,804** under Osaka. The difference is two cold
  accounts.
- So Phase 2's +7,781 (`level2/PROFILE_A.md` §4) holds when the ACL is already warm in the transaction. A
  `setOperator` that touches the ACL first costs about 5,000 more: **≈ +12,800** under Osaka and +13,604 under
  Amsterdam.
- The same applies to P1.4's stock-library figures.

**The absolute frame numbers** of Phase 0–3 are low by 2,500 per cold account that a call touches beyond its target.
The deltas are unaffected, as above.

## 7. What this does not show

- **A released client.** The schedule is the nightly's, an unreleased build. It matches Sepolia on the one operation
  measured there (§1) and the EIP texts on the calibration.
- **EIP-8037's transaction rule as receipts.** The pool refuses `tx.gas` above 2^24, so §4's EIP-8037 limits are
  estimates.
- **Final parameters.** EIP-8037, EIP-8038, EIP-2780 and EIP-7976 are in Last Call; constants may still change.
- **The ERC-7984 transfer and the Profile A gates as receipts.** They are frame gas (§6).

## Evidence

- Harnesses:
  - `impl/harness/phase4/p24_amsterdam.sh`, which runs Phase 3's receipt harnesses;
  - those harnesses: `level0/anvil_gas.mjs`, `level2/anvil_gas_e1.mjs`, `level3/anvil_gas_e2.mjs` and
    `level2/carry_e2e.mjs`, with the P2.4 overrides (D64);
  - `p24_cap_probe.py`, `p24_reservoir_probe.py` and `p24_forge.sh`.
- Raw data, under `raw/p24/`:
  - `r1/`, `r2/`, `r3/`: the receipts; each holds `environment.txt`;
  - `diag/r{1,2}/`: the boundary diagnosis (`P24_CAP_DIAG=1`);
  - `cap/r{1,2}/`, `reservoir/`, `forge/r{1,2}/`, `forge/stable-1.8.5/`, `vmcool/`;
  - `superseded/r1-before-d63/`: the first run, which failed at deployment under Amsterdam.
- Versions and hashes: `ENV.md` (the nightly, the EIP texts, the revm crates; ports 8663 and 8671–8680).
