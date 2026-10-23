# Decryption Authority Lifecycle: measurements (Phases 3 to 5)

**Date:** 2026-10-21; Phase 5 (§9) 2026-10-23. **Scope:** every measurement of the brief's Task D (`docs/CLAUDE_CODE_BRIEF_ERC_TARGET_DESIGN.md` §6),
taken locally on Zama's own code, mocks and test setups. Each number below is copied from the level report that owns
it, where the method and the raw files are described in full; this file collects them and says where each one comes
from.

**Nothing here was measured on a live service.** No request went to a Zama relayer, gateway, KMS or Sepolia contract.
The two Sepolia figures quoted for comparison (§2.9) are the Phase 1 measurements on record, not new ones.

**Updated in Phase 4 (2026-10-22).**
- The Amsterdam numbers are now receipts on a local chain that applies Amsterdam's schedule, labelled
  [M, Local-Amsterdam] (`phase4/P2_4_AMSTERDAM.md`).
- One Phase 2 frame figure is corrected: Profile A's operator gate (§2.3).
- The other Phase 4 results are in `phase4/` and in §8 at the end of this file.

**Updated in Phase 5 (2026-10-23):** §9 holds Part A's corrections and Part B's post-quantum path (`phase5/`).

**The three limits** apply to every number here. Retirement is:
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance.

---

## 0. Labels, machines and commits

**Labels.**

| Label | Meaning |
|---|---|
| [M] | Measured, on the machine and commit named for the row |
| [M, Local-Amsterdam] | Measured as receipts on a local anvil that applies Amsterdam's schedule (Foundry nightly `9089a6b`, Phase 4) |
| [E] | Estimated or derived from measured numbers; the method is stated |
| [I] | Inference |
| [C] | Cited from a specification, not reproduced |
| [V] | Verified by reading the code at the named commit (Phase 4) |

**Machines.**

| Name | Hardware and OS | Used for |
|---|---|---|
| **M1** | AMD Ryzen 5 5600 (6 cores, 12 threads), 15.9 GB RAM, Windows 10 Pro 10.0.19045, Git Bash | Foundry suites, anvil receipts, the cleartext mock, the SDK, the Rust crate tests, the native PQ benchmark |
| **VPS** | Ubuntu 24.04.5 LTS, kernel 6.8.0-139, 4 vCPU, 7,941 MB RAM. Shared with a live service, so every heavy step ran in a capped scope (`MemoryMax=2560M`, `CPUQuota=200%`, `nice 19`, `ionice -c3`) | The real kms-worker (connector) against the real ACL, and the relayer build |

**Toolchains.**
- **M1:** Foundry 1.8.5 (`51a52c59`, 2026-10-05: forge, anvil, cast); solc 0.8.24 for host-contracts and 0.8.35 for the
  SDK's contracts; Node 22.13.0; vitest 4.1.x; ethers 6.17.0; Rust 1.95.0 (the shared crate) and 1.97.1 (the relayer's
  pin, for rustfmt).
- **VPS:** Rust 1.92.0 (v0.13.8 connector) and 1.99.1 (main connector and the relayer); anvil 1.3.5 (Prague);
  Postgres 17.5 on 127.0.0.1.
- Foundry 1.8.5 defaults to `isolate = true`, which breaks Zama's transient-storage tests, so every suite ran with
  `FOUNDRY_ISOLATE=false` (`results/level0/ENV_BASELINE.md` §3.4).

**Commits.** Zama's bases are fhevm `main` = `ed851716c`, tag `v0.13.8` = `fe3ca89b5`, kms `c755e84`, and
OpenZeppelin confidential-contracts 0.5.3. Our branches (local only, nothing pushed):

| Level | main line (`impl/fhevm-main` and its worktrees) | v0.13 line (`impl/fhevm-v0.13.8` and its worktrees) |
|---|---|---|
| 0 | `lifecycle/level0`: `0fbe9a6`, `8e2cd34`, `5e61f3d` (ACL v0.8.0) | `lifecycle/level0`: `61be560`, `e02d3e2`, `06d769f` (ACL v0.4.1); `lifecycle/level0-mock`: `228e85f` |
| 1 | `lifecycle/level1`: `f5e9356`, `4541571`, `aea7d37` (crate), `cce53bb` (connector), `5b69260` (SDK, H9), `0eec675` (relayer, H9) | — |
| 2 | `lifecycle/level2`: `50147ff`, `a9748a6`, `92a1806` (E1, ACL v0.9.0), `43db5ba`, `02e484d`, `ea4e7a7` (Profile A), `bbec089`, `c4482ab` (SDK) | `lifecycle/level2`: `70444e4`, `dee719f`, `33fef67`, `588e639` (E1, ACL v0.4.2); `lifecycle/level2-mock`: `9a3e5b1`, `b272882`, `a3e6cbf` |
| 3 | `lifecycle/level3`: `5cd12ed`, `3d08580`, `0d02f3e`, `53f389d`, `f1b440e` (E2, ACL v0.10.0; governance; TC22); `lifecycle/level3-verifier`: `a8e1f34` (E3, on `cce53bb`) | — |

---

## 1. Headline numbers

| What | Value | Label | Section |
|---|---|---|---|
| `retireAccount()`, one transaction (main, ACL v0.8.0) | **50,099** gas | [M] M1 | 2.1 |
| `isAllowed`, non-executor caller | **+2,266** gas (one cold SLOAD) | [M] M1 | 2.2 |
| `isAllowed`, executor caller | **+37** (persisted) / **+81** (transient) gas | [M] M1 | 2.2 |
| ERC-7984 `confidentialTransfer` | **+7,067** gas (+2.0%) | [M] M1 | 2.3 |
| Carry, per handle | **31,385** gas (Level 0 multicall), **31,386** (carry tool, v0.9.0); at most **524** handles in a transaction whose gas limit is exactly 2^24 (Phase 4; the linear fit's 532 is [E]), **137** under Amsterdam | [M] M1; [M, Local-Amsterdam] | 2.4 |
| Carry, 500 handles in one transaction | **15,750,135** (Level 0) / **15,748,385** (carry tool) gas | [M] M1 | 2.4 |
| E1 successor set-up (designate, accept, confirm) | about **159K** gas | [M] M1 | 2.5 |
| `retireAccountWithSig`, EOA, one chain | **65,560** gas (Prague) | [M] M1 | 2.6 |
| One `allow`, Prague/Osaka vs Amsterdam | **58,360** vs **140,780** gas (Sepolia: 140,780) | [M] / [M, Local-Amsterdam] | 2.9 |
| Connector latency added by Level 0 | not resolvable; upper bound **≈ 0.3 ms per view** | [M] VPS | 3.1 |
| `eth_getCode` added by Profile H | one round trip: median **4.73 ms** in the connector run (VPS), 1.0 ms on local anvil (M1) | [M] | 3.2 |
| Native ML-DSA-44 verification vs `ecrecover` | **79.5 µs** vs **175.6 µs** (k256, Zama's path) and 52.1 µs (libsecp256k1) | [M] M1 | 3.3 |
| ML-DSA-44 ERC-1271 account | refused at today's 250,000 cap; accepted from **B_exec ≈ 1,125,976** | [M] M1 | 3.4 |
| Certificate transaction | **324–452** bytes of calldata for 1–5 chains | [M] M1 | 4 |

---

## 2. Gas

**Method, unless a row says otherwise.**
- **Transaction gas:** `gasUsed` from anvil 1.8.5 receipts. It includes the 21,000 intrinsic gas and calldata.
- **Frame gas:** Foundry's `vm.lastCallGas().gasTotalUsed` for the called frame, after `vm.cool` on every touched
  account. It excludes intrinsic and calldata gas.
  - Phase 4 found that forge 1.8.5's `vm.cool` cools storage slots but not accounts.
  - A frame number here is therefore low by 2,500 per account it touches that a first touch would find cold.
  - Deltas between calls that touch the same accounts are unaffected; §2.3 gives the one delta that is affected.
- **Production profile:** Zama's Hardhat settings (solc 0.8.24, optimizer on, 800 runs, `cancun`, `bytecodeHash none`).
- **Prague and Osaka give identical numbers** for every ACL measurement here.

### 2.1 `retireAccount`

| Build | Measurement | Gas | Label | Source |
|---|---|---|---|---|
| main, ACL v0.8.0 (Level 0) | transaction | **50,099** | [M] M1, `5e61f3d` | `level0/LEVEL0_CONTRACTS.md` §4.2 |
| main, ACL v0.8.0 | frame, first call, cold | 26,535 | [M] M1 | same |
| main, ACL v0.8.0 | second call (reverts `AccountAlreadyRetired`), frame | 4,889 | [M] M1 | same |
| v0.13 line, ACL v0.4.1 | frame, first call | 26,535 | [M] M1, `06d769f` | same |
| main, ACL v0.9.0 (E1) | transaction, no succession record or a confirmed successor | 54,464 (+4,365: two cold reads of the succession record) | [M] M1 | `level2/LEVEL2_E1.md` §3 |
| main, ACL v0.9.0 | transaction, voiding a pending designation | 52,691 (the cleared slot earns a refund) | [M] M1 | same |
| main, ACL v0.10.0 (E2) | transaction | 54,514 (+50: the shared internal `_retire`) | [M] M1, `3d08580` | `level3/LEVEL3.md` §1.3 |
| Zama cleartext mock, v0.13.0 stack with ACL v0.4.1 | transaction, an EOA | 50,116 | [M] M1, `228e85f` | `level0/MOCK_E2E.md` §5 |
| same | a contract retiring through its own helper | 53,148 | [M] M1 | same |
| Connector harness (by-product; not the gas of record) | transaction, main 200-run profile / v0.13.8 unoptimized | 50,143 / 50,258 | [M] VPS | `level0/CONNECTOR_PROOF.md` §11 |
| main, ACL v0.8.0, **Amsterdam** | transaction | **132,519** (Phase 3's estimate: ≈ 138,219) | [M, Local-Amsterdam] | §2.9; `phase4/P2_4_AMSTERDAM.md` §2 |

### 2.2 `isAllowed` and the other views

Frame gas, production profile, Level 0 against the previous release (main: v0.7.0 → v0.8.0; v0.13 line: v0.4.0 →
v0.4.1) [M] M1 (`level0/LEVEL0_CONTRACTS.md` §4.2–4.3).

| View or operation | main | v0.13 line |
|---|---|---|
| `isAllowed`, non-executor caller | 5,552 → 7,818 (**+2,266**) | 5,497 → 7,818 (+2,321) |
| `isAllowed`, executor caller, persisted pair | 5,552 → 5,589 (**+37**) | 5,497 → 5,589 (+92) |
| `isAllowed`, executor caller, transient grant | 3,214 → 3,295 (**+81**) | 3,191 → 3,295 (+104) |
| `persistAllowed` | 5,143 → 7,409 (+2,266) | 5,155 → 7,431 (+2,276) |
| executor `fheAdd`, 2 persisted operands | 31,625 → 31,721 (+96 = **+48 per operand**) | 30,840 → 31,090 (+250 = +125 per operand) |
| executor `fheAdd`, 2 transient operands | 26,945 → 27,129 (+184 = **+92 per operand**) | 26,224 → 26,498 (+274 = +137 per operand) |
| executor `fheIfThenElse`, 3 persisted operands | 36,016 → 36,149 (+133 = +44 per operand) | 34,994 → 35,336 (+342 = +114 per operand) |
| `allow` (new pair), frame | 34,012 → 36,245 (+2,233) | 33,970 → 36,268 (+2,298) |
| `isHandleDelegatedForUserDecryption` (true, with the contract check) | 12,434 → 19,064 (+6,630) | 12,358 → 19,108 (+6,750) |
| `isDelegatedForUserDecryption` (true) | 7,846 → 14,471 (+6,625) | n/a |
| `getUserDecryptionDelegationExpirationDate` | 5,377 → 12,054 (+6,677) | 5,370 → 12,059 (+6,689) |

**Reading.**
- **The non-executor overhead is one cold `SLOAD`** (2,100) plus about 166 gas of code. Verifiers pay it inside an
  `eth_call` they already make: no fee and no new RPC.
- **The delegated views pay three cold reads** (delegator, delegate, contract). The contract check that the
  deliberation added is one of them.
- **The executor path is not within the spec's ±25 gas per operand.** The exemption compare alone costs +48; the rest
  is the solc dispatcher (main −11 to +33 per `isAllowed`; v0.13 line +44 to +56), which no selector-preserving change
  avoids. In context: +96 to +184 gas on a 27–32K-gas executor call (0.3–0.7%) on main. Proposed restatement:
  ≤ +100 per operand on main and ≤ +140 on the v0.13 line, under Zama's production settings (deviation D2).
- **E1 changes the views by a few gas:** `isAllowed` 32,225 → 32,202 (−23) and the delegated view 44,373 → 44,405
  (+32), as `eth_estimateGas` of a call [M] (`level2/LEVEL2_E1.md` §3).

### 2.3 The ERC-7984 transfer delta

OpenZeppelin confidential-contracts 0.5.3, frame gas, production profile [M] M1 (`level0/LEVEL0_CONTRACTS.md` §4.2).

| Call | main | v0.13 line | Amsterdam (main) |
|---|---|---|---|
| `confidentialTransfer(to, euint64)` by the holder | 359,771 → 366,838 (**+7,067, +2.0%**) | 354,469 → 362,598 (**+8,129**) | frame 301,271 → 308,338 (+7,067); caller-side 1,090,130 → 1,097,197 [M, Foundry nightly] |
| `mint` | 280,344 → 284,266 (+3,922) | 277,142 → 281,608 (+4,466) | +3,922 [M, Foundry nightly] |

The Amsterdam column was remeasured in Phase 4 with the Foundry nightly whose schedule matches Sepolia's
(`phase4/P2_4_AMSTERDAM.md` §6). Its `vm.cool` also cools accounts (see below), so its absolute frame gas is not
comparable with the other columns. The deltas are.

Profile A adds its gates on top, frame gas from a test contract by an active account [M] M1 (`level2/PROFILE_A.md`
§4): `setOperator(op, now + 1 day)` 25,111 → 32,892 (**+7,781**) and `setObserver(account, X)` 70,067 → 73,876
(**+3,809**).

**Phase 4 correction (`phase4/P2_4_AMSTERDAM.md` §6).**
- forge 1.8.5's `vm.cool` cools storage slots but leaves accounts warm. The operator gate's call to the ACL, which
  vanilla `setOperator` never touches, was therefore measured with the ACL proxy and implementation warm.
- With both cold, as on a transaction's first touch, the operator gate costs **+12,804** under Osaka and +13,604
  under Amsterdam [M, Foundry nightly, `lifecycle/level3` `f1b440e`]. forge 1.8.5 gives +7,804 at that commit.
- The observer gate is unchanged (+3,832), because the vanilla call already touches the ACL.
- The other deltas in §2 compare calls that touch the same accounts, and are unaffected. The absolute frame numbers
  in §2.2–2.3 are low by 2,500 per cold account a call touches inside its frame.

### 2.4 Carry, per handle (n = 1, 10, 100, 500)

**Level 0, `multicall([allow(h_i, NEW) ×n, retireAccount()])`,** transaction gas, main, production profile [M] M1
(`level0/LEVEL0_CONTRACTS.md` §4.4):

| n | v0.7.0, grants only | v0.8.0, grants plus `retireAccount()` | Calldata (B) | Amsterdam, v0.8.0 [M, Local-Amsterdam] |
|---|---|---|---|---|
| 1 | 62,192 | **89,113** | 324 | 259,753 |
| 10 | 342,013 | **371,045** | 1,764 | 1,334,765 |
| 100 | 3,140,457 | **3,191,061** | 16,164 | 12,085,581 |
| 500 | 15,603,846 | **15,750,135** | 80,164 | 59,892,655 (sent without a gas cap; see below) |

Phase 3 estimated the Amsterdam column at 265,353, 1,340,365, 12,091,181 and 59,898,255 [E]: 5,600 high on each row
(`phase4/P2_4_AMSTERDAM.md` §2).

- **Per handle: 31,146 (v0.7.0) → 31,385 (v0.8.0), +239.** That is one warm retirement read per `allow`, plus
  dispatch. The fixed part is about 57.7K: intrinsic gas, `multicall` overhead and `retireAccount`.
- **Under the EIP-7825 transaction cap (2^24 = 16,777,216), at most about 532 handles per transaction** [E from M].
  The deliberation estimated about 538.
  - Measured in Phase 4 at a gas limit of exactly 2^24: **524** [M] (`phase4/P2_4_AMSTERDAM.md` §4).
  - The fit ignores the 1/64 of the gas that the proxy keeps when it forwards the call (EIP-150).
- **Under Amsterdam: 119,505 gas per handle** [M, Local-Amsterdam] (Phase 3's estimate was the same).
  - With the whole `tx.gas` capped at 2^24, as the local chain's pool does, at most **137** handles fit one
    transaction [M], and a 500-handle carry needs four.
  - [V] EIP-8037 (Last Call) caps execution gas only. Under that rule about 765 handles fit by execution gas, fewer if
    the block's gas limit binds: about 501 at 60M [E] (P2.4 §4).

**Level 2, the carry tool** (`impl/carry-tool/carry.mjs`) on ACL v0.9.0, one transaction carrying k fresh handles and
retiring, Osaka = Prague [M] M1 (`level2/CARRY_TOOL.md` §2):

| k | `gasUsed` | Calldata (B) | Plan (ms) | Execute (ms) |
|---|---|---|---|---|
| 0 (retirement only) | 58,126 | 164 | 95 | 342 |
| 1 | 93,423 | 324 | 109 | 372 |
| 10 | 375,367 | 1,764 | 126 | 355 |
| 50 | 1,628,498 | 8,164 | 137 | 348 |
| 100 | 3,194,243 | 16,164 | 131 | 421 |
| 200 | 6,331,207 | 32,164 | 210 | 492 |
| 400 | 12,610,093 | 64,164 | 448 | 690 |
| 500 | **15,748,385** | 80,164 | 461 | 841 |

- **31,386 gas and 160 bytes of calldata per handle** (fit from k = 100 to 400). The k = 500 transaction fits under
  the 2^24 cap.
- **In Zama's cleartext mock** the per-handle figure is about 33,308 [E from M]: `CleartextACL.allow` reads one more
  cold slot before `ACL.allow` (`level0/MOCK_E2E.md` §5: n = 1, 5 and 10 cost 90,980, 224,200 and 390,759).
- **Carry against E1 [E]:** carrying costs 58,126 + 31,386 × k, and E1 plus retirement costs a fixed 213,740, so
  carrying is cheaper below about 5 handles. Carrying is immediate; E1 needs the successor's acceptance and 7 days.

### 2.5 Each successor (E1) operation

ACL v0.9.0 on main, production artifacts, anvil receipts, Prague = Osaka [M] M1 (`level2/LEVEL2_E1.md` §3).

| Operation | Gas |
|---|---|
| `designateSuccessor` | 62,014 |
| `designateSuccessor`, replacing a pending one | 44,914 |
| `acceptSuccession` | 40,074 |
| `confirmSuccessor` | 57,188 |
| `retireAccount`, with a confirmed successor | 54,464 |
| `resignSuccession` (after retirement) | 28,688 |
| `cancelSuccessorDesignation` | 30,371 |
| `raiseSuccessorDelay` | 52,711 |
| Delegated view, successor path (retired delegator), `eth_estimateGas` | 41,989 |

**Set-up total** (designate, accept, confirm) ≈ **159K** gas.

**Under Amsterdam** [M, Local-Amsterdam] (`phase4/P2_4_AMSTERDAM.md` §5):
- the set-up costs **326,100**: designate 144,434, accept 41,674, confirm 139,992;
- `retireAccount` costs 136,884 and `raiseSuccessorDelay` 135,131;
- operations that only change existing slots move by −954 to +1,600 gas.

### 2.6 `retireAccountWithSig` (E2)

ACL v0.10.0 on main, production artifacts, anvil receipts [M] M1, `3d08580` (`level3/LEVEL3.md` §1.3).

| Transaction | Prague | Osaka | Calldata |
|---|---|---|---|
| `retireAccount()` | 54,514 | 54,514 | 4 B |
| `retireAccountWithSig`, EOA, 1 chain | **65,560** | 65,584 | 324 B |
| `retireAccountWithSig`, EOA, 2 chains | 65,742 | 65,754 | 356 B |
| `retireAccountWithSig`, EOA, 5 chains | 66,277 | 66,277 | 452 B |
| `retireAccountWithSig`, ERC-1271 wallet, 1 chain | 68,015 | 68,015 | 324 B |
| Watchtower relays on two anvil chains (2-chain certificate) | 65,754 and 65,867 | — | — |

A certificate costs about **11,000 gas more** than a direct retirement, plus about 180 gas per extra listed chain. The
watchtower's relays are in `level3/LEVEL3.md` §1.4.

**Under Amsterdam** [M, Local-Amsterdam], three runs (`phase4/P2_4_AMSTERDAM.md` §5):

| Transaction | Gas |
|---|---|
| `retireAccount()` | 136,934 |
| `retireAccountWithSig`, EOA, 1 chain | 148,492–148,504 |
| `retireAccountWithSig`, EOA, 2 chains | 148,674 |
| `retireAccountWithSig`, EOA, 5 chains | 149,197 |
| `retireAccountWithSig`, ERC-1271 wallet, 1 chain | 150,923–150,935 |

The spread is ±12 gas, from the zero bytes of random keys and signatures. [I] The same noise explains the Prague/Osaka
differences in the table above.

### 2.7 Other operations measured on the way

| Operation | Gas | Label and source |
|---|---|---|
| Reverse-order `multicall([retireAccount(), allow(h, NEW)])` (reverts, status 0) | 63,565 | [M] M1, `level0/MOCK_E2E.md` §5 |
| Refused writes by a retired account: `delegateForUserDecryption`, `allow`, second `retireAccount` | 31,838; 36,358; 28,470 | same |
| `delegateForUserDecryption` (first) / re-delegation to a retired account (accepted, inert) | 57,904 / 40,792 | same |

### 2.8 Code size (EIP-170, limit 24,576 B)

| Build | Before | Level 0 | Level 2 (E1) | Label and source |
|---|---|---|---|---|
| main, production settings | 10,818 B (v0.7.0) | 12,480 B | **15,178 B** (margin 9,398) | [M] M1, `level0/LEVEL0_CONTRACTS.md` §4.6, `level2/LEVEL2_E1.md` §4 |
| v0.13 line, production settings | 10,124 B (v0.4.0) | 11,571 B | 14,290 B (margin 10,286) | same |
| v0.13 line, **default Foundry profile (unoptimized)** | — | 19,602 B | **25,236 B: 660 B over the limit** | same (§4: the Foundry tests pass; anvil refuses the deployment) |

The Level 0 Solidity delta is **+81/−6 code lines** on main and +77/−6 on the v0.13 line [M], inside the spec's
75–90 estimate.

### 2.9 Osaka/Prague, Amsterdam, and Sepolia's "140K vs 58K"

- **Osaka and Prague give identical gas** for every measurement in §2.1–2.6 [M].
- **Sepolia now runs the Glamsterdam schedule.** Phase 1 measured one `ACL.allow` at **140,780** on Sepolia against
  **58,348** on a local Osaka anvil, and 119,201 against 31,083 per extra handle inside a `multicall` [M, Phase 1,
  `G1_TARTISMA_RAPORU.md` §5].
- **Can anvil 1.8.5 reproduce it? No.** `anvil --hardfork amsterdam` (1.8.5) does not apply the state-creation
  charge: a new-slot `SSTORE` costs 43,609 [M] under Prague, Osaka and Amsterdam at every block gas limit tried
  (`level0/raw/L0_gas_anvil_sstore_probe_*.json`).
- **forge 1.8.5 does, in part.** Under `forge test --evm-version amsterdam`, a new slot costs 12,591 frame gas
  (−10,000 against Prague), while the caller-side cost rises from 23,257 to **111,280 (+88,023)**. About **98.2K of
  state-creation gas is charged outside the frame** [M] (`level0/raw/L0_forge_hardfork_primitives.log`).
- **Phase 3's estimates.** `allow` writes exactly one new slot. Its Prague/Osaka receipt **58,360** [M] plus forge's
  Amsterdam caller-side difference gave **≈ 146,480** [E]. The same method gave **119,266** per carried handle [E].
  The estimates were built by `impl/harness/level0/amsterdam_estimate.mjs`.
- **Phase 4 measured it** (`phase4/P2_4_AMSTERDAM.md`). anvil from the Foundry nightly `9089a6b` (revm 43.0.3)
  applies the schedule [M, Local-Amsterdam]:
  - one `allow` of a new pair on Zama's unmodified ACL v0.7.0 costs **140,780**, exactly Sepolia's figure;
  - an extra handle costs 119,211 (n = 1→10), against Sepolia's 119,201;
  - its Osaka receipts equal Phase 3's.
- **Phase 3's estimates were 5,600–5,700 gas high** per transaction, and exact per handle. Most of the gap is the base
  charge, which Amsterdam lowers from 21,000 to 15,000 (EIP-2780).
- [V] The schedule is EIP-8037's: 97,920 gas of state gas per new slot (64 bytes × `CPSB` 1,530). EIP-8037 also
  applies the 2^24 transaction cap to execution gas only. The local chain's pool does not implement that part, so the
  single-transaction carry limit under it is [E] (§2.4).
- **Level 0's own delta does not change under Amsterdam:** +2,233 per `allow` under every fork, because the
  retirement read is not state creation. `retireAccount` itself is one new slot: **132,519** under Amsterdam
  [M, Local-Amsterdam] against 50,099 [M].

---

## 3. Off-chain

### 3.1 Connector latency at Level 0 (expected: unchanged)

The **unmodified** kms-worker against the real Level 0 ACL on anvil, through a JSON-RPC recorder [M] VPS, 2026-10-21
(`level0/CONNECTOR_PROOF.md` §9). Median ms per ACL view, recorder arrival to anvil's answer, (p10–p90):

| View | v0.13.8, base v0.4.0 | v0.13.8, Level 0 v0.4.1 | main, base v0.7.0 (bindings) | main, base v0.7.0 (same profile) | main, Level 0 v0.8.0 |
|---|---|---|---|---|---|
| `isAllowed` | 3.34 (1.83–6.97) | 3.62 (1.81–8.01) | 4.69 (1.89–13.69) | 4.25 (1.89–15.31) | 4.48 (2.02–11.90) |
| `isHandleDelegatedForUserDecryption` | 2.76 (1.93–6.55) | 3.05 (1.77–7.75) | 4.20 (1.91–12.58) | 4.14 (1.68–18.54) | 3.31 (1.73–12.38) |
| `decryptionSignatureInvalidatedBefore` | — | — | 4.56 (1.89–11.60) | 4.51 (2.07–12.23) | 4.33 (1.82–13.77) |

- **The connector's own check time** (first attempt, median ms): v0.13.8 direct 10.0 (base) vs 15.4 (Level 0), delegated
  7.5 vs 12.4; main direct 20.2 / 25.0 (bases) vs 24.7, delegated 20.0 / 20.5 vs 20.8. Every gap is inside p10–p90.
- **Reading:** the Level 0 cost is one or two warm `SLOAD`s inside an existing `eth_call`. This setup resolves **no
  latency effect**; the upper bound it supports is **about 0.3 ms per view** [M]. It is not evidence about a production
  node.
- **Zero new RPCs:** 316 (v0.13.8) and 1,062 (main) recorded calls, `eth_call` only, no `from`, no Level 0 selector
  [M] VPS (§7 of the same file).
- **Retries of a retirement denial today:** 20 attempts over **53,916 ms** (v0.13.8) and **54,233 ms** (main), every
  one refused, 0 KMS hits [M] VPS (§8). Profile H makes the first denial final (§3.2).

### 3.2 Level 1: Profile H (`eth_getCode`, attempts, final denials)

- **Latency of the reads Profile H adds, in the connector run** [M] VPS, the same recorder and method as Level 0 (ms from
  the recorder's receipt of the connector's request to anvil's answer; `impl/harness/level1/latency_level1.py` on
  `level1/raw/vps/main/host_rpc.jsonl`, output `level1/raw/L1_connector_rpc_latency.txt`):

  | Call | n | Median | p10–p90 |
  |---|---|---|---|
  | `eth_getCode` | 8 | **4.73** | 1.30–6.05 |
  | `eth_blockNumber` | 8 | 5.43 | 1.35–13.76 |
  | `isAccountRetired` (H5, only after a denial) | 21 | 3.62 | 1.97–12.88 |
  | `isValidSignature` | 2 | 3.03 | 2.20–3.85 |
  | `isAllowed` (for comparison) | 46 | 4.80 | 2.12–13.80 |

  Each added read costs about what an existing ACL view costs in this setup. Under `enforce` an EOA's request adds two
  sequential reads (`eth_blockNumber`, then `eth_getCode`): about 10 ms here [E from M]. It is a shared, CPU-capped VPS
  behind a Python recorder, not a production node.
- **`eth_getCode` on a local anvil (M1):** 38 reads per run, median 1.0 ms (min 0, max 15) on the final run and 13.3 ms
  on the first [M] (`level1/PROFILE_H_CRATE.md` §6).
- **RPCs per request in the connector**, Profile H off → on [M] VPS (`level1/PROFILE_H_CONNECTOR.md` §2):

  | Request | Off | On |
  |---|---|---|
  | Legacy direct, retired user | 9 RPCs, 3 attempts, retried | **4 RPCs, 1 attempt, final** (`isAccountRetired(U) = true`) |
  | RFC-016 direct, retired user | 6, retried | **3, final** |
  | RFC-016 over HTTP, retired user | 2, `acl_denied` | 3, **`account_retired`** |
  | Ordinary denial, legacy direct | 9, retried | 15, retried (two extra `isAccountRetired` reads per attempt) |
  | 7702 account, reject-all delegate, root key | 2 RPCs, **forwarded** | `enforce`: 13 RPCs over 3 attempts, **refused**, at most 1 `isValidSignature` |
  | EOA (control) | 2 | 4 (`eth_blockNumber`, `eth_getCode`) |

- **Totals of the reported run:** 27 requests, 139 recorded RPCs; with Profile H off, only the three ACL views today's
  connector already sends.
- **An allowed request pays nothing for H5:** `isAccountRetired` is asked only after a denial.

### 3.3 Native post-quantum verification against `ecrecover`

Median µs to verify one signature over a 32-byte digest, release build, two runs [M] M1 (`level3/LEVEL3.md` §5,
`level3/raw/L3_pq_bench_run{1,2}.txt`; benchmark source `impl/bench-pq/a5_native_verify`):

| Verification | Run 1 | Run 2 |
|---|---|---|
| `ecrecover`, k256 0.13.4 (the path Zama's crate uses today) | **175.6** | 174.7 |
| `ecrecover`, libsecp256k1 0.30.0 | 52.1 | 52.0 |
| ML-DSA-44, decode and verify (cold) | **79.5** | 79.4 |
| ML-DSA-44, declared-signer path (keccak of the key, then verify) | 82.4 | 82.7 |
| ML-DSA-65, declared-signer path | 131.3 | 139.9 |
| ML-DSA-87, declared-signer path | 215.8 | 209.9 |
| SLH-DSA-SHA2-128s | 141.1 | 141.8 |
| SLH-DSA-SHA2-128f | 388.4 | 389.3 |
| SLH-DSA-SHAKE-128f | 4,219 | 4,251 |
| FN-DSA-512 (fn-dsa 0.4.0, pre-standard) | 11.3 | 11.3 |

- **Native ML-DSA-44 is cheaper than the k256 `ecrecover` Zama uses today,** and slower than libsecp256k1. The
  deliberation agent A5's earlier numbers are 2–10% higher and in the same order.
- **On the EVM the same verification is expensive:** the Fireblocks ML-DSA-44 `isValidSignature` uses 1,227,872 gas
  inside the call [M] (`level1/PROFILE_H_CRATE.md` §5); Phase 1 measured ETHFALCON at 1,547,336 and NIST Falcon at
  3,910,833 gas.
- **Correctness:** 180/180 Wycheproof ML-DSA-44 vectors agree (77 valid accepted, 103 invalid rejected), on the
  benchmark binary and through the E3 route [M].
- **Every library here is unaudited:** RustCrypto `ml-dsa` 0.1.1, `slh-dsa` 0.2.0-rc.5 and `fn-dsa` 0.4.0.

**E3 against the ERC-1271 path, for one ML-DSA-44 request** (the brief's Level 3 comparison):

| | E3, the KDA route (native) | ERC-1271 (a PQ smart account) |
|---|---|---|
| Verification cost | **82.4 µs** native, plus one `eth_getCode` [M] | `isValidSignature` uses **1,227,872 gas** inside an `eth_call` [M]; about 4.5–5 ms of EVM time [E, TARGET §4.4 (a)] |
| What the request carries | `abi.encode(signerBytes, sig)`: 3,904 B [E] | the 2,420-byte signature in a 2,532-byte call [M] |
| What the verifier needs | the `kda` feature with ML-DSA enabled; no gas budget | Profile H's budget: B_exec ≥ 1,125,976 [M]; today's 250,000 cap refuses it [M] |
| Trust | an unaudited native library on every node that enables it; no fallback; the KDA is subordinate and dies with retirement or revocation | the account's own code (account-asserted: a contract with ECDSA owners also passes) and an on-chain verifier (research code) |
| Deployed path (v0.13) | impossible: the gateway verifies the delegate's 65-byte ECDSA | impossible: no ERC-1271 path |

### 3.4 Profile H budget: what the ERC-1271 call needs

[M] M1, anvil Osaka, the Level 1 crate (`level1/PROFILE_H_CRATE.md` §5):

| Probe | Gas limit of the call | Result |
|---|---|---|
| ML-DSA-44 `isValidSignature`, gas used inside the call | — | 1,227,872 (`eth_estimateGas` of a direct call: 1,308,731) |
| ML-DSA-44, today's `verify_signature`, cap 250,000 including calldata | 250,000 | **refused** (empty revert: out of gas) |
| ML-DSA-44, Profile H, B_exec 1,000,000 | 1,183,048 | refused |
| ML-DSA-44, Profile H, B_exec 1,200,000 … **2,000,000** | 1,383,048 … **2,183,048** | **accepted** |
| ML-DSA-44, smallest accepting B_exec (1K resolution) | — | **1,125,976** |
| Gas burner, 32-byte signature, burns 2.1M under B_exec 2M | 2,029,448 | refused (empty revert) |
| Gas burner, **60,000-byte** signature, burns 4.5M under B_exec 2M | 5,867,400 | **accepted**: the calldata allowance (64 per byte) leaves about 4.9M for execution |
| 60,000-byte signature under a 250,000 or 2,021,000 cap | — | refused before execution ("intrinsic gas too high"; its EIP-7623 floor is 2,422,300) |

- **The 60 KB row is the measured form of the draft's calldata residual** (formerly [E], about 4.2M extra for 64 KiB).
  The H1 cap and the H4 attempt bound limit it.
- **The same budget in the SDK precheck (H9):** 2,183,048 gas for the ML-DSA-44 account's 2,532-byte call, and
  2,033,544 for a 65-byte signature's 196-byte call [M] M1 (§3.5).

### 3.5 Level 1, rule H9: the relayer and the SDK prechecks

**SDK** (branch `lifecycle/level1`, commit `5b69260`), Zama's ethers adapter against real accounts on a local anvil
(Osaka) [M] M1 (`level1/H9_PRECHECKS.md`, `level1/raw/L1_h9_sdk_real_evm.json`):

| Account and signature | No policy (today: 250,000, ecrecover first) | Profile H `off` | `shadow` | `enforce` |
|---|---|---|---|---|
| ML-DSA-44 ERC-1271 account, 2,420-byte signature | **refused** (gas 250,000) | **accepted** (gas 2,183,048) | — | **accepted** (one code read; call pinned to the code's block) |
| 7702 account, reject-all delegate, root-key ECDSA | **accepted** (no RPC) | accepted | accepted, **would-reject logged** | **refused** (`Erc1271WrongMagicError`, `0xffffffff`) |
| 7702 account, delegate without `isValidSignature` | — | — | — | accepted (narrow shim); **refused** with the shim off |
| EOA, own key | — | accepted, no RPC | — | accepted after one code read, no call |
| Regular-code wallet, owner key | — | — | — | accepted (ERC-1271) |

- **Unit tests:** the SDK's full unit suite passes **910/910** (35 files), including 11 new Profile H tests; ESLint,
  prettier and `tsc -b` pass [M] M1.

**Relayer** (commit `0eec675`), built on the VPS with Rust 1.99.1 in the capped scope (the test profile in 28 min 55 s,
one job) [M] VPS: **59/59** unit tests pass, the 12 of the signature pre-check (7 new: caps before any RPC, `off`
with no RPC, `enforce` against a 7702 root key and an EOA, an empty revert retried only at a later block, wrong magic
answered at once, the settings) and Zama's 47 configuration tests; every lib unit test of the relayer: **281 passed, 1
ignored** (Zama's own `#[ignore]`), 0 failed. Zama's `make clippy` (`--workspace --all-targets --all-features -- -D
warnings`) passes, and rustfmt with the pinned 1.97.1 is clean (`level1/H9_PRECHECKS.md` §3).

### 3.6 Level 2 and 3 tools

| Tool | Measurement | Value | Label and source |
|---|---|---|---|
| Carry tool | plan / execute, k = 0 … 500 | 95–461 ms / 342–841 ms | [M] M1, §2.4 |
| Watchtower | detect a thief's wildcard delegation and relay a certificate to two chains | **376 ms** | [M] M1, `level3/LEVEL3.md` §1.4 |
| Operator canary | RPCs per run (4 views, plus `eth_getStorageAt` and `eth_getCode` for pinning) | **6** (the draft estimated about 4 `eth_call`s) | [M] M1, same §2 |

### 3.7 Profile Q: share collection (n = 13, t = 4)

Real Shamir sharing over GF(2^127 − 1); k operators refuse an ECDSA-rooted request, each operator is down with
probability q. Exact release probabilities; 20,000 Monte Carlo trials per cell agree within 4 standard errors [M] M1
(`level3/LEVEL3.md` §4.1, `level3/raw/L3_profile_q_sim.json`):

| k refusing | answering | release, q = 0 | q = 1% | q = 5% |
|---|---|---|---|---|
| 0–4 | 13–9 | yes | 1.000000 | ≥ 0.999967 |
| 5 | 8 | yes | 0.999999 | 0.999628 |
| 6 | 7 | yes | 0.999966 | 0.996243 |
| 7 | 6 | yes | 0.998540 | 0.967226 |
| **8** | **5** | **yes** | **0.950990** | **0.773781** |
| 9–13 | 4–0 | **no** | 0 | 0 |

Reconstruction succeeds **if and only if k ≤ 8**: a restriction binds only at k ≥ n − t = 9 operators. Between 5 and 8
enforcing operators, unmigrated users still decrypt while availability already falls (77% at k = 8 with 5% outages).

---

## 4. Sizes

**Signatures and keys** [M] M1, as reported by the libraries in the benchmark (`level3/raw/L3_pq_bench_run1.txt`):

| Scheme | Signature | Public key | Notes |
|---|---|---|---|
| secp256k1 ECDSA | 65 B | — (recovered) | today's permits |
| ML-DSA-44 | 2,420 B | 1,312 B | key plus signature: 3,732 B |
| ML-DSA-65 | 3,309 B | 1,952 B | 5,261 B |
| ML-DSA-87 | 4,627 B | 2,592 B | 7,219 B |
| SLH-DSA-SHA2-128s | 7,856 B | 32 B | |
| SLH-DSA-SHA2/SHAKE-128f | 17,088 B | 32 B | |
| FN-DSA-512 (pre-standard) | 666 B | 897 B | |

**Permits and requests.**

| Item | Size | Label |
|---|---|---|
| ERC-1271 `isValidSignature` calldata, 65-byte signature | 196 B | [M] M1 (SDK run, §3.5) |
| ERC-1271 calldata, ML-DSA-44 signature (2,420 B, padded to 2,432) | 2,532 B | [M] M1 (SDK run and crate run) |
| E3 (KDA) signature field `abi.encode(signerBytes, sig)`, `signerBytes` = 20-byte id + key: ML-DSA-44 / -65 / -87 | 3,904 / 5,440 / 7,392 B | [E] (ABI arithmetic: 64 B of offsets, then each field's 32-byte length and its data padded to 32 bytes) |
| Profile H1 caps (draft defaults) | signature 65,536 B; transport public key 4,096 B; extra data 1,024 B | design values [E] |
| The transport public key the test permits carried | 800 B | test value, as in the Level 1 harness |

**Certificates (E2).** A certificate is the account, the successor, the chain list and one signature (65 bytes for an
EOA). The transaction that carries it is **324, 356 and 452 bytes** of calldata for 1, 2 and 5 chains [M] M1
(`level3/LEVEL3.md` §1.3). The draft's 200–300 bytes [E] counted the certificate without the call's ABI framing.

**Contracts.** §2.8.

---

## 5. Test counts (all [M], all green)

| Level | Suite | Result |
|---|---|---|
| 0 | Zama's Foundry ACL suites, main / v0.13 line | 63/63 / 53/53 |
| 0 | Full Foundry suite (Zama's plus new), main / v0.13 line | 791/791 / 569/569 |
| 0 | New Foundry tests, main / v0.13 line | 80/80 / 75/75 |
| 0 | Zama's Hardhat ACL and upgrade tests, main / v0.13 line | 11/11 / 10/10 |
| 0 | Zama's cleartext mock, scenarios | 15/15, three consecutive runs |
| 0 | Real connector, unmodified, v0.13.8 / main | 9/9 tests, 96 requests / 17/17 tests, 222 requests |
| 1 | Shared crate, Zama's tests plus Profile H | 15 + 20 |
| 1 | Real connector with Profile H (main) | 4/4 tests, 27/27 requests |
| 1 | Connector unit tests (`kms-connector-api`, `kms-worker`) | 11/11, 53/53 |
| 1 | SDK unit suite with H9 (main) | 910/910 |
| 1 | SDK precheck on a local EVM (H9) | 4/4 |
| 1 | Relayer unit tests: signature pre-check and settings (H9) / every lib unit test | 59/59 / 281 passed, 1 ignored |
| 2 | Foundry `test/acl/*` with E1, main / v0.13 line | 188/188 / 173/173 |
| 2 | Real connector, unmodified, E1 successor path, main / v0.13.8 | 13/13 / 8/8 requests |
| 2 | Profile A (TC23) / full Foundry suite on main | 15/15 / 851/851 |
| 2 | SDK unit suites with hygiene, v0.13 line / main | 914/914 / 918/918 |
| 2 | Cleartext mock, E1 and SDK hygiene | 7/7, three consecutive runs |
| 3 | Full Foundry suite on main (E2, governance, TC22) | 874/874 |
| 3 | E2 certificate tests / governance tests / TC22 | 13 / 6 / 2 |
| 3 | Shared crate with the `kda` feature | 15 + 11 + 20 |
| 3 | Wycheproof ML-DSA-44 | 180/180 |

---

## 6. What was not measured

Phase 3's list, with what Phase 4 has since measured marked in place (details in §8).

- **Amsterdam, two parts** (measured in Phase 4 otherwise, §2.9):
  - EIP-8037's transaction rule as receipts. The local pool caps the whole `tx.gas`, so the carry limit under that
    rule is [E] (§2.4).
  - The ERC-7984 transfer and the Profile A gates are frame gas (§2.3).
- **Latency on a production node.** The VPS figures come from a shared, CPU-capped machine behind a Python recorder.
- **A live network** for the carry tool, the watchtower and the canary; the carry tool's `env` signer.
- **E3 and Profile Q inside the connector,** and therefore the oracle-level parts of TC20. *Measured in Phase 4
  (§8.1).*
- **ACVP vectors** for ML-DSA, and Wycheproof vectors for ML-DSA-65 and -87 (round trips only). *ACVP sigVer vectors,
  and Wycheproof vectors for ML-DSA-44, -65 and -87, measured in Phase 4 (§8.1).*
- **E2 on the v0.13 line;** the optional 0.14 line (ACL 0.5.1) and the U6 upgrade step. *Measured in Phase 4
  (§8.2).*
- **H7** (re-checking stored results in the connector). *Measured in Phase 4 (§8.1).*
- **Profile A against the unmodified OpenZeppelin 0.5.3 build.** Level 0 cross-checked the vanilla token that way
  (7/7); Profile A ran on the mechanically ported copy only. *Measured in Phase 4 (§8.2).*

## 7. Where the raw data is

| Level | Report | Raw data |
|---|---|---|
| 0 | `level0/LEVEL0_CONTRACTS.md`, `MOCK_E2E.md`, `CONNECTOR_PROOF.md`, `ENV_BASELINE.md`, `VPS_CONNECTOR_BASELINE.md` | `level0/raw/`, `level0/logs/`, `level0/raw/vps/` |
| 1 | `level1/PROFILE_H_CRATE.md`, `PROFILE_H_CONNECTOR.md`, `H9_PRECHECKS.md` | `level1/raw/`, `level1/raw/vps/` |
| 2 | `level2/LEVEL2_E1.md`, `PROFILE_A.md`, `CARRY_TOOL.md`, `SDK_HYGIENE_AND_MOCK.md` | `level2/raw/` |
| 3 | `level3/LEVEL3.md` | `level3/raw/` |
| Phase 4 | `phase4/STATUS.md` (one line per task), then `phase4/P*.md`, `SHADOW_IMPACT.md`, `INCO_MAPPING.md`, `CORE_TRACEABILITY.md`, `ICS_REFERENCE_DEPLOYMENT.md` | `phase4/raw/`, with the generated tables in `phase4/p01/` to `phase4/p12/` |

How to reproduce each level: `results/level{0,1,2,3}/README.md`; Phase 4: each report's "To reproduce" part.

---

## 8. Phase 4 (2026-10-21 and 2026-10-22)

Machines and toolchains as in §0, plus the Foundry nightly `9089a6b` (anvil and forge, revm 43.0.3) for the
Local-Amsterdam receipts. Connector rows ran the real kms-worker against the real ACL on a local chain on the VPS,
in the capped scope; M1 rows are local. Every row names the report that holds its method, runs and raw data.

### 8.1 Verifier side

| What | Result | Label | Report |
|---|---|---|---|
| V1 under failing view calls (TC13), unmodified kms-worker | main 110/110 and v0.13.8 44/44 V1 cells conform, three runs each, on every request path; no refused request reached the KMS mock | [M] VPS | `phase4/P0_1_TC13.md` |
| Decision lag (TC14) | L = 0 on both lines (every view read at `latest`); 7/7 cases per line, three runs; no replica decides on either line (V5) | [M] VPS | `phase4/P0_2_TC14.md` |
| Stored results (V6) and H7 | Unmodified, main's connector endpoint and the relayer re-serve a stored result after retirement; with H7 both refuse. H4 state in the database: 2 ERC-1271 calls across a restart, against 3 in memory. Three runs | [M] VPS | `phase4/P0_3_STORED_RESULTS.md` |
| EIP-7851 (host-chain key disable) | On main, unmodified verifiers accept the disabled root key on every path; Profile H `enforce` refuses it and accepts the account's ML-DSA-44 signature at `B_exec` 2,000,000; a retired account is refused everywhere. Three runs | [M] VPS | `phase4/P0_4_EIP7851.md` |
| E3 in the connector (TC20, oracle part) | 35 rows on the Level 3 worker and 4 on the unmodified one, every row identical across runs (3 and 6 runs) | [M] VPS | `phase4/P1_1_E3_CONNECTOR.md` |
| K8, four ML-DSA libraries | Each passes 631/631 Wycheproof vectors (ML-DSA-44, -65 and -87: 180, 210 and 241) and 45/45 ACVP sigVer vectors on the route's pure interface; crate 52/52 three times; agree mode refuses an injected fault in 36/36 cases | [M] M1 | `phase4/P1_1_E3_CONNECTOR.md` |
| Verification latency, local anvil | ML-DSA-44 route p50 about 245 µs (one library) and 340 µs (agree mode), against 470 µs for ECDSA under Profile H and 2.7 ms for ERC-1271 at `B_exec` | [M] M1 | `phase4/P1_1_E3_CONNECTOR.md` |
| Profile Q in the connector (TC22) | 151 rows, three runs, every row as expected. The ceremony establishes the profile with 13 or 9 valid statements, never with 8. Partial adoption with 13 workers: an ECDSA request was released at k = 0, 4, 5 and 8 enforcing workers and refused at k = 9 and 13, and post-quantum requests were served at k = 0 and 13; the other k follow the threshold rule [I] | [M] VPS | `phase4/P1_2_PROFILE_Q.md` |
| Profile Q readiness (Q2), mainnet 2026-10-21 | 0 of 1,713 active decryptors have a proven post-quantum-capable route; upper bound 8 contracts (0.47%) | [M] read-only aggregates | `phase4/P1_2_PROFILE_Q.md` |
| An ML-DSA-44 ERC-1271 account through the connector (TC21) | 9 requests on the Level 3 worker, three runs, all forwarded; `isValidSignature` gets a gas budget of 2,183,048 (`B_exec` 2,000,000 + 21,000 + 64 × 2,532 calldata bytes) | [M] VPS | `phase4/P1_6_SMALL_GAPS.md` |
| Zama's kms-worker suite on our trees | 122 passed on the baseline, Level 1 and Level 3 trees, 126 on the Profile Q tree; the same 40 failures everywhere (tests that need containers) | [M] VPS | `phase4/P1_1_E3_CONNECTOR.md`, `phase4/P1_2_PROFILE_Q.md` |

### 8.2 Registry side, lines and vendors

| What | Result | Label | Report |
|---|---|---|---|
| E2 on the v0.13 line (ACL v0.4.3) | Whole suite 629/629 three times; the ERC's certificate vector reproduces; ACL 15,861 B with the line's optimizer settings (8,715 B under EIP-170) | [M] M1 | `phase4/P1_3_E2_V013.md` |
| Core on v0.14.4 (ACL 0.5.1) | Whole suite 759/759 three times (Zama's 676, also 676/676 on the unmodified tag, plus our 83). U6: 0.4.0, 0.4.1 and 0.5.0 upgrade to 0.5.1 keeping state. Release-train check: 3 violations against Zama's projected releases today, 0 under the proposed numbering | [M] M1 | `phase4/P1_5_V014_RELEASE_TRAIN.md` |
| Profile A on stock OpenZeppelin 0.5.3 | TC8 and the token parts of TC23, 14/14, three runs. Without it a thief's observer reads 10 of 10 handles over 5 transfers; with it, 0. Operator gate +12,798 gas with the registry cold (§2.3's note) | [M] M1 | `phase4/P1_4_PROFILE_A_STOCK.md` |
| SDK `getAuthorityStatus` with the account's code | Unit tests 9/9 three times; Zama's SDK suite 933/933 twice; on a local chain both adapters report every case, 16/16 reads, three runs | [M] M1 | `phase4/P1_6_SMALL_GAPS.md` |
| Core on Fhenix CoFHE (port) | 69 passed, 4 skipped (no E1 or E2), three runs; 17 of 17 gate mutations caught; a differential fuzz (256 × 12 steps) against Fhenix's unmodified contracts, identical; Fhenix's plugin suite 106/108 with the port against 107/108 without (both differences explained); end to end on Fhenix's mock stack 6/6, three runs. TaskManager 24,496 B (80 B under EIP-170), ACL 15,937 B | [M] M1 | `phase4/P2_1_FHENIX_PORT.md` |
| Inco Lightning | Mapped by reading only (BUSL-1.1): Core maps without a mechanism change | [V] | `phase4/INCO_MAPPING.md` |
| Conformance kit | Zama `main` and the v0.13 line: 17 passed, 1 skipped (TC6), three runs with isolation off and one with it on; the Fhenix port: 14 passed, 4 skipped; six gates removed in turn from `main`, 6 of 6 caught. Verifier kit on the recorded runs: TC13 594 + 132 cells and TC14 21 per line conform; TC15 35 conform and 8 violate (the unmodified verifier, as recorded) | [M] M1 | `phase4/P2_3_CONFORMANCE_KIT.md` |

### 8.3 Amsterdam

The receipts are in §2 and in `phase4/P2_4_AMSTERDAM.md`. In short, all [M, Local-Amsterdam] unless marked: one
`allow` on Zama's unmodified ACL v0.7.0 costs exactly Sepolia's 140,780; `retireAccount` 132,519 (v0.8.0); carry
119,505 per handle, and at most 137 handles at a gas limit of exactly 2^24 (Osaka: 524 [M]). The proxy's 63/64
forwarding, traced, is why the linear fits (139 and 532 [E]) are high. Under EIP-8037's rule, which caps execution
gas only, the limit is about 765 handles by execution gas [E].

### 8.4 Census and Profile H's shadow impact (read-only mainnet aggregates)

| What | Result | Label | Report |
|---|---|---|---|
| Census refresh to block 26,243,993 (2026-10-21) | 12,730 real end accounts, 1,713 active in the last 90 days. Code at the head: 10,291 none, 2,220 EIP-7702-delegated (64 delegate codes), 0 EIP-7851, 219 other contracts | [M] | `phase4/SHADOW_IMPACT.md` |
| What `enforce` would refuse | 680 of 12,730 end accounts (5.3%; 507 [M], 173 [E]), holding 2.6% of the handles; 103 of 1,713 active ones (6.0%; 68 [M], 35 [E]) | [M] / [E] | `phase4/SHADOW_IMPACT.md` |

No address is published; the counts come from aggregates (`review/04_census/aggregate.json` in its counts-only form
and `phase4/raw/p25/`).

### 8.5 Prototypes

| What | Result | Label | Report |
|---|---|---|---|
| Operator-ratified upgrade, ML-DSA-44 on chain (Fireblocks verifier `cca262b5`, unaudited) | 9 signatures: 11,468,811 gas (Osaka) and 11,660,335 (Amsterdam); all 13 fit under 2^24 with 295,816 and 260,332 to spare; early execution, 8 signatures, a corrupted signature, wrong order and a replay all revert. Two runs per fork | [M] M1 / [M, Local-Amsterdam] | `phase4/P3_PROTOTYPES.md` |
| ML-KEM for the reply channel | Two implementations interoperate both ways; tens of microseconds per operation, so size, not time, is the on-chain cost | [M] M1 | `phase4/P3_PROTOTYPES.md` |

### 8.6 The standard

The split ERC passes eipw 0.11.0 (the ethereum/ERCs configuration) except its two placeholders, and every constant
in it was recomputed with `cast` 1.8.5: 52 of 52, two runs [M] M1 (`phase4/raw/d1/`).

### 8.7 Still not measured after Phase 4

- **Connector throughput.** Parked: the load would risk the shared VPS's live service (`phase4/parked/`).
- **Fhenix's threshold network.** Its dispatcher is not public; only `teecryptor`'s side was read [V].
- **Inco,** beyond reading.
- **EIP-8037's transaction rule as receipts,** and latency on a production node (§6).

## 9. Phase 5 (from 2026-10-22)

Part A corrects the standard's documents; Part B builds the post-quantum path. Brief:
`docs/CLAUDE_CODE_BRIEF_PHASE5.md`; status: `phase5/STATUS.md`.

### 9.1 Part A: corrections and EIP-8298

| What | Result | Label | Report |
|---|---|---|---|
| What an account can remove (P0.1) | An account can revoke or shorten a delegation it granted, and on `main` invalidate its permits whose start time is earlier than a chosen time. It cannot end its own authority, withdraw a per-handle grant, undo a public decryption, or stop its key from signing new permits; the deny list is owner-only. The sentence was corrected in six documents | [V] | `phase5/P0_1_USER_SURFACE.md` |
| TC15 and the unmodified verifier (P0.2) | TC13 and TC14 pass with the unmodified verifier; TC15 needs the hygiene profile (H5, H7): 35 conforming cells and 8 violations, all the unmodified verifier's. The verifier meets Core's required rules V1–V5, not the recommendations V6 and V7 | Design, from recorded [M] runs | `phase5/P0_2_TC15.md` |
| EIP-8298 (an EOA adopts a wallet's regular code), simulated (P0.3) | On `main`, unmodified verifiers accept the old root key on every path (RFC-016 direct and over HTTP, legacy), and so do `v0.13.8`'s legacy paths. Profile H `enforce` refuses it and accepts the adopted wallet's ML-DSA-44 signature (call gas 2,183,048); H6 refuses the legacy path; a retired account is refused everywhere. Connector: 28/28 rows, three runs per tree. Local verifiers and SDK precheck: 20 rows, three runs. `getAuthorityStatus` reports `regular`, three runs | [M] VPS, [M] M1 | `phase5/P0_3_EIP8298.md` |
| Consistency pass (P0.4) | eipw: only the two placeholders. ERC constants 52 of 52 with `cast`. Rule references: 1,527 on P0.4's versions of the 13 documents, 1,587 on their first P3 versions and 1,592 on the final ones (`phase5/raw/p3/consistency_r3.md`, `_r4.md`), all defined. Every number on the lines Phase 5 added matches RESULTS or its report. No "only adds rights" wording; every TC15 mention quotes the kit's numbers or only defines TC15 (24 mentions: 18 and 6); no banned word. Two identical runs each | [M] M1 | `phase5/P0_4_CONSISTENCY.md`; the P3 count `phase5/raw/p3/` |

### 9.2 Part B: the post-quantum path, end to end

Paths: B1 carry, then retire; B2 successor, then A retires (B2d) or its certificate is relayed (B2c); B3 in place,
EIP-7702 to an ML-DSA-44 wallet, then EIP-7851 (B3a) or EIP-8298 (B3b) simulated. The test wallet (B0) and the
Fireblocks verifier it calls (`cca262b5`) are unaudited test fixtures.

| What | Result | Label | Report |
|---|---|---|---|
| B0, the test wallet | `PQWallet`: ERC-1271 and a relayable `execute`, both ML-DSA-44; usable deployed and as an EIP-7702 delegate. Foundry 21/21, three runs; one `execute` uses 1,369,296 execution gas | [M] M1 | `phase5/B0_PQ_WALLET.md` |
| The connector drill (B1–B4, B6) | The real Phase 5 kms-worker on the VPS. Each of three runs: 258 request rows (102 scenario rows and 156 per-worker adoption rows) and 40 transactions. All conform in every run; `mismatches=0` | [M] VPS | `phase5/B1_B6_PATHS.md`, `phase5/pq-drill/PQ_DRILL_CONNECTOR.md` |
| The local drill (B1–B3, B5, B6, B8) | The real carry tool, watchtower and canary, the SDK, the old key's transactions and the B5 upgrades. 81/81 rows conform under Osaka and under Local-Amsterdam, three runs each | [M] M1 | `phase5/pq-drill/PQ_DRILL_LOCAL.md` |
| B1 and B2: the old key afterwards | All five off-chain request rows refused (R2 typed `account_retired`), and R6 (a delegate reading for A) refused. Every transaction reverts (`SenderRetired`, `AccountAlreadyRetired`), except `invalidateDecryptionSignaturesBefore`, which only narrows | [M] VPS, M1 | `phase5/PQ_DRILL_MATRIX.md` |
| B1 and B2: the holder | The whole history served to the post-quantum key through ERC-1271, RFC-016 on chain and over HTTP. On B1 also through E3. On B2, W's E3 signer does not reach A's handles (S9) and a later grant to A reaches W; on B1 a later grant to A is inert (R8) | [M] VPS | the same |
| B3: off chain | Profile H refuses the old key on every path. Delegations the old key made before the move still serve their delegates until the holder revokes them (R6, residual; refused after revocation). The wallet's ML-DSA-44 signature is accepted through ERC-1271 and E3. The SDK reports `eip7851` or `regular`, and its precheck refuses the old key | [M] VPS, M1 | the same |
| B3: on chain (residual) | On the local chain the old key's grant, publication, delegation, designation, permit cut-off and retirement are mined (confirmation and a new certificate revert). Only a host chain enforcing EIP-7851 or EIP-8298 closes this [I]. Its retirement of A ends the wallet's authority too, which is why B3 does not combine with Core retirement | [M] VPS, M1; [I] | the same |
| B4, Profile Q in the scenario | After B_Q, ECDSA-rooted requests are refused and every path's post-quantum request is served. Q5 refuses the old key's later delegation on B3a and adopted code's post-B_Q changes. It does not refuse B3b's delegation: B3b's code was already regular at B_Q (closed by EIP-8298 itself). 13 workers: the ECDSA request is released by 5 of 13 at k = 8 and withheld (4 of 13) at k = 9, in every run | [M] VPS | `phase5/B1_B6_PATHS.md` |
| Q5 at B_Q (D99) | A finding in our own worker, fixed (`a4416155`). A succession counts only if confirmed at B_Q; adopted code gets the cutoff. Unit tests 6/6; in the drill, a successor named after B_Q is refused under Q and served with Q off | [M] VPS | `phase5/DECISIONS_LOG.md` D99 |
| B5, post-quantum upgrade safety | Registry owned by the operator-ratified contract (13 ML-DSA-44 operators, 9 of 13, 7 days). 8 signatures revert `NotEnoughSignatures`. 9 signatures on a Core release pass the guard (11,453,066 gas Osaka, 11,557,470 Amsterdam). 9 on a release without Core revert `UpgradeDropsRetirement`. The canary is OK before and after both. Three runs per fork | [M] M1 | `phase5/B1_B6_PATHS.md` |
| B2's design question | A successor's own declared signer: not adopted, not prototyped. It would reintroduce the transitivity S9 forbids (D98) | Design | `phase5/B2_SUCCESSOR_SIGNER.md` |
| Zama's kms-worker suite on the Phase 5 tree | 128 passed and 40 failed, twice. The Phase 4 tree today: 126 and 40, as in Phase 4. The only differences are our two new Q5 unit tests, which pass; the 40 failures are the same container tests on every tree | [M] VPS | `phase5/ZAMA_SUITES_P5.md` |

### 9.3 Part B: costs (B8)

All [M] on local chains, Osaka / Local-Amsterdam (EIP drafts in Last Call; constants may change).

| What | Osaka | Local-Amsterdam |
|---|---|---|
| ML-DSA-44 verifier, once per chain | 5,166,161 | 37,233,691 |
| Its Keccak helper, once per chain | 4,716,360 | 33,632,276 |
| An account's key blob (20,545 B, the verifier's prepared form of the 1,312-byte key) | 4,434,297–4,434,597 | 31,917,605–31,917,905 |
| B1, carry 3 handles and retire, one transaction | 156,448 | 503,316–503,328 |
| B2, designate / confirm / retire | 62,128 / 57,256 / 54,516 | 144,548 / 140,060 / 136,936 |
| B2c, the certificate relayed | 65,610–65,622 | 148,530 |
| B3, the type-4 delegation with the key set | 83,059–83,071 | 284,005–284,017 |
| One relayed `execute` (W accepts a succession) | 1,336,510–1,337,751 | 1,428,682–1,430,933 |
| `isValidSignature`, ML-DSA-44, inside the EVM (E4's meter) | 1,231,383–1,235,715 | 1,233,983–1,238,715 |
| The same under the unmodified 250,000 cap | `0xffffffff`, refused | the same |

Per request, off chain:
- **Native ML-DSA-44 verification:** 80 µs (RustCrypto) and 86 µs (fips204) p50 on M1.
- **The KDA route:** 242–247 µs with one library, 337–341 µs in agree mode.
- **ERC-1271 at `B_exec` through the crate:** 2.7 ms.

All three are Phase 4's bench, on unchanged verification code. The connector drill's whole-check harness times are in
`phase5/pq-drill/SIG_CHECK_TIMES.md`.

**EIP-8355 (Draft, a design note, [E]).** With `VERIFY_MLDSA44` at `0x12` (6,500 + 6 per message word):
- **`isValidSignature`** would cost about 13,000–15,000 gas instead of about 1.23M. It would then fit the unmodified
  verifier's 250,000 cap, so Profile H's budget would no longer be needed for such wallets. Code-first ordering still
  would: it is what refuses the old key.
- **Registering a key** would cost about 0.3M gas instead of 4.4M (Osaka): no prepared blob.
- **The nine B5 ratifications** would cost about 0.1M of verification plus their calldata.

Details: `phase5/B8_COSTS.md` §6.

### 9.4 Part B: the gap map and the live line (B7, B9)

**The gap map (B7).** 18 primitives on the decryption path, read at `main` `ed851716c`, `v0.13.8` `fe3ca89b5` and KMS
`c755e84f` [V].
- **Already post-quantum:**
  - the ciphertexts (TFHE, out of scope);
  - the reply encryption (ML-KEM-512 with AES-256-GCM, category 1).
- **Classical, and left as found:**
  - the KMS's reply signature (ECDSA in the deployed envelope; an ML-DSA backend exists, not deployed);
  - KMS result and coprocessor input signatures checked on chain;
  - the input proofs (pairing-based);
  - component attestations;
  - gateway-chain senders;
  - governance (ECDSA multisigs, and the bridge).
- **Not checked:** whether internal TLS negotiates a hybrid key exchange [I].
- **What Part B migrates:** account authorization only, rows 1–5.

Report: `phase5/PQ_GAP_MAP.md`.

**The live line `v0.13.8` (B9).**
- **What works there:**
  - Core;
  - E1 for an ECDSA successor;
  - E2;
  - B1's carry and retirement (`multicall`).
- **What does not:** decrypting with a post-quantum key.
  - The gateway checks user and delegate signatures with ECDSA only (`Decryption.sol:923, 947`).
  - There is no ERC-1271 path; the only three mentions, all comments, say it is not supported.
- **What it needs:** `main`'s RFC-016 path with Profile H's budget, or E3, in a newer release and a verifier update.

Report: `phase5/B9_LIVE_LINE.md`.

### 9.5 P2 and P3: documents, the export and the contribution kit

| What | Result | Label | Report |
|---|---|---|---|
| The post-quantum path documents | `docs/PQ_FULL_PATH.md` and `docs/PQ_TAM_YOL_TR.md`; the companion (K3, the Q5 succession clause, the rejected successor-signer rule); `drafts/RESEARCH_WRITEUP_PQ_PATH.md`; the one-pager in two parts, 2 A4 pages; §12 of both architecture documents. Consistency checks over the new documents: 0 failures, two identical runs | [M] M1 checks | `phase5/STATUS.md`, `phase5/raw/p2/` |
| `make pq-drill` from a fresh clone of the export | Part B's local drill under Osaka: 9 of 9 tests, 81 of 81 rows as designed. The first fresh-clone run found that the test signer needs `polyntt` (the NTT package the verifier's Python reference imports); it is now installed from the commit the verifier's own requirements pin | [M] M1 | `phase5/DECISIONS_LOG.md` D106 |
| `make <target>` from fresh clones of the export, in any order | Two fresh clones of the last staging build ran every target, in two orders (one: `level0`, `pq-drill`, `level0` again, `conformance`, `profile-a`, `level0-mock`; the other: `pq-drill` first, then the rest). All 11 runs reproduced: `level0` 143 of 143 tests on `main` and 128 of 128 on `v0.13.8`, also after `pq-drill` in the same clone; `pq-drill` 9 of 9 tests and 81 of 81 rows; `conformance` (the Fhenix port's suite 69 tests, Zama `main` 226 of 226, the kit 17 tests on Zama `main` and 14 on the Fhenix port, every copy of the kit identical); `profile-a` 14 of 14; `level0-mock` 15 of 15. No tracked file changed in either clone. The final build differs from that staging build only in records under `results/` | [M] M1 | `phase5/DECISIONS_LOG.md` D106, D119 |
| The export's safety checks | A deny-list sweep (public terms and the private ones by label), a byte search for every `.env` value and the keys and addresses derived from each mnemonic, gitleaks in directory and git mode, an IPv4 count, and a licence and size listing, on every staging build and on the final build. No secret value, key, mnemonic, private term, machine name or desktop path is in the export. What the checks do find: local addresses (`127.0.0.1`), addresses of local test keys and test contracts in logs, one Sepolia test account (recorded since Phase 4), identifier names, the scan reports' own labels, and Edge's version string in the one-pager PDF's metadata | [M] M1 | local review (not exported) |
| The contribution kit | An issue draft and four branches on Zama's latest `main` (`f81d506d5`): host-contracts (Core, and one match arm in the coprocessor's host listener), sdk (status and the typed error), kms-connector (Profile H, off by default; and relayer-http's list of connector codes), kms-connector (E3 behind a `kda` Cargo feature, on Profile H). The CI jobs each PR starts are computed from Zama's workflow filters (D118); two of them the PRs as first prepared would have failed (D115, D116). The dependency jobs pass; for E3, cargo-audit lists four crates RustSec flags as unmaintained, three of them PQClean's (archived on 2026-08-04), and the PR says so (D121). E3 also locks `ctutils` 0.4.4: RUSTSEC-2026-0385, published on 2026-10-23, affects 0.4.3, which RustCrypto `ml-dsa` brings in (D123). Kept locally, not in the export, and not submitted; each job's result is in the kit's README | [M] M1 and VPS checks | `contribution/zama/README.md` (local) |
| The Fhenix kit (optional in the brief) | An issue draft and one branch on Fhenix's `cofhe-contracts` `master` (`b5c20ed`): the Phase 4 port of Core, whose comments alone change (the same bytecode), the deploy and upgrade tasks it needs (the ACL is upgraded first, and the share registry is linked to it), 22 Hardhat tests and a changelog entry. Fhenix's pull-request checks pass twice on M1: Solhint, the storage-layout and size checks, Slither with no finding, 323 host-chain and 100 registry-chain tests (301 and 100 on `master`). Kept locally, not in the export, and not submitted (D122) | [M] M1 | `contribution/fhenix/README.md` (local) |
| Independent verification | A fresh agent worked from a staging build of the export, RESULTS and the Turkish report: 62 checks, 46 pass, 12 fail, 4 not verifiable; no failure changes a conclusion. Every finding was re-checked from raw data and fixed (D119). The same agent then re-checked the next staging build from a fresh clone: 20 items, 17 pass, 0 fail, 3 not verifiable (the kit, the VPS commands and the local safety review are outside the export). A second fresh agent checked the session's later claims (D120's re-runs, D121, the Fhenix kit): 26 checks, 21 pass, 3 fail, 2 not verifiable; the fails were a vulnerability advisory published that day against a crate PR 4 brings in (fixed, D123), one sentence (corrected) and kit results then still pending (filled) | [M] M1 | `phase5/INDEPENDENT_VERIFICATION.md` (local) |
| Clean re-runs of the unmodified-tree connector evidence (D120) | Worktrees of the VPS shared one Cargo target directory, so a build could link another worktree's crates. The unmodified-tree runs built after the Level 1 tree were repeated three times in a target directory only the unmodified tree is built into. Every committed outcome is reproduced: TC13 396 of 396 rows, TC14 7, stored results 4, EIP-7851 20, EIP-8298 18. The values that differ are of kinds that already vary between the committed runs: a fault's error code (the re-runs logged `-` on four TC13 rows where every committed run logged `upstream_transient`; the committed runs differ among themselves on 14 other rows) and the adopted code's hash. Zama's kms-worker suite gives the same 122 passed and 40 failed, test for test | [M] VPS | `phase5/RECHECK_D120.md`, `phase5/raw/recheck-harness/` |
