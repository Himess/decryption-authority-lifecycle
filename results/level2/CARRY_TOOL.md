# Level 2, part (c): the carry tool

**Status.** Done for the prototype.

**What it is.** `impl/carry-tool/carry.mjs` is a Node script using ethers v6 (unaudited). It runs the five steps of
TARGET §4.3 (c) end to end. The local anvil (Osaka) used the production ACL v0.9.0 artifacts (solc 0.8.24, 800 runs,
cancun). Every result below is [M].

**What it does, before an account OLD retires:**
1. **Enumerate.** It reads the `Allowed(caller, account = OLD, handle)` events; `account` is indexed. It pages
   `eth_getLogs` by block range (`--log-range`, default 10,000 blocks).
2. **Filter.**
   - It keeps a handle only if `persistAllowed(h, OLD)` holds and NEW does not hold it yet.
   - **Against spam,** with `--allow-contract` it keeps only handles granted by those callers.
   - **For tokens,** with `--balance-token` it keeps only OLD's current balance handle among the token's grants.
3. **Dry run.** `--dry-run` prints a per-caller breakdown and the exact list of handles, and sends nothing.
4. **Send.** It sends `multicall([allow(h_1, NEW), ..., allow(h_k, NEW)])` in chunks (`--chunk`, default 400). The last
   chunk ends with `retireAccount()`; `--no-retire` carries without retiring.
5. **Verify.** It checks that OLD is retired, that NEW holds `persistAllowed` on every carried handle, and that OLD
   holds none of them.

**Safety properties, each shown on anvil:**
- **OLD retires only if every chunk went through.** The retirement is the last call of the last chunk, and any failure
  stops the run before the next chunk.
- **A rerun resumes.** Handles that NEW already holds are skipped.
- **It refuses to start when the carry cannot work.**
  - the registry does not declare the lifecycle Core (ERC-165 `0x556d2088`);
  - OLD is already retired, or is on the deny list;
  - NEW is retired, equals OLD, or is the zero address.
- **Signing.** `--signer impersonate` (the default) sends from OLD on a local anvil started with `--auto-impersonate`.
  `--signer env` signs with the key in `CARRY_OLD_PRIVATE_KEY`, which is never printed. Only the first mode ran here.

Labels:
- **[M]:** anvil 1.8.5 (Osaka) on M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), Node 22.13.0, 2026-10-21.
- **[E]:** estimated.

## 1. The scenario [M]

**Setup.** Three test apps (`impl/harness/level2/carry/src/CarryMockApp.sol`) grant handles to OLD through the ACL:
- **an allowlisted app:** 120 handles, one of which NEW already holds, plus one handle that the spammer also granted;
- **a token-like app:** five successive balance handles; the first four are stale;
- **a spammer:** 300 handles.

In total, 427 grants over 426 distinct handles. The expected carry is 119 + 1 + 1 = **121 handles**.

Harness: `impl/harness/level2/carry_e2e.mjs`. Output: `raw/L2_carry_e2e_osaka.json` (SHA-256 `f27c1d72…ebb9`) and `raw/L2_carry_e2e_osaka.log`; the same
run under Prague rules is `raw/L2_carry_e2e_prague.json` (`1d747139…cd00`).

| Step | Result |
|---|---|
| CLI dry run, with the allowlist and the token | exit 0; "427 grants to OLD, 426 distinct handles, 121 to carry in 3 transaction(s), the last one retiring OLD"; 121 handles listed; nothing sent (OLD's nonce unchanged, not retired) |
| Per-caller breakdown | app: 121 grants, 120 kept, 1 "NEW already holds it"; spammer: 301 grants, 1 kept (the shared handle), 300 "caller not allowlisted"; token: 5 grants, 1 kept, 4 "stale balance handle" |
| The kept set | exactly the 121 expected handles |
| Dry run without an allowlist | **425 handles**: all 300 spam handles would be carried at about 31,400 gas each (section 2) |
| CLI refusal, NEW retired | exit 2, "REFUSED: NEW is retired: grants to it would be inert" |
| Refusal, NEW equal to OLD | "NEW equals OLD" |
| **Injected failure** | chunk 0 went through (50 handles). Before chunk 1, the registry owner deny-lists OLD. Chunk 1 fails with `SenderDenied(OLD)` and the run stops. **OLD is not retired;** NEW holds chunk 0's handles |
| **Resume**, after the owner lifts the deny-listing | the plan skips the 51 handles NEW holds and carries 71 in 2 transactions (1,599,456 and 719,912 gas, the second one retiring). Verified: OLD retired, NEW holds 71/71, OLD usable on 0 |
| After retirement | NEW holds all 121 expected handles; no spam handle and no stale balance handle; OLD can use none of them; a further run is refused ("OLD is already retired") |

## 2. Gas and size [M]

**Method.** One transaction carries k fresh handles and retires a fresh account. The figure is the receipt's
`gasUsed`, including 21,000 and calldata. Osaka and Prague give identical values; the timings are from the Osaka run.

| Handles k | `gasUsed` | Calldata (B) | Plan (ms) | Execute (ms) |
|---|---|---|---|---|
| 0 (retirement only) | 58,126 | 164 | 95 | 342 |
| 1 | 93,423 | 324 | 109 | 372 |
| 10 | 375,367 | 1,764 | 126 | 355 |
| 50 | 1,628,498 | 8,164 | 137 | 348 |
| 100 | 3,194,243 | 16,164 | 131 | 421 |
| 200 | 6,331,207 | 32,164 | 210 | 492 |
| 400 | 12,610,093 | 64,164 | 448 | 690 |
| 500 | 15,748,385 | 80,164 | 461 | 841 |

**The fit:**
- **31,386 gas and 160 B of calldata per handle**, from k = 100 to 400.
- **Per handle,** that is one cold deny-list read, one cold persisted-pair read, one retirement read, one new pair
  written and one event.
- **At most 532 handles per transaction** under Osaka's 2^24 transaction gas cap (EIP-7825). The measured k = 500
  transaction (15,748,385 gas) fits.

**Against E1 [E]:**
- **E1's cost is fixed.** Designate, accept, confirm, then retire costs 62,014 + 40,074 + 57,188 + 54,464 = 213,740 gas
  (`LEVEL2_E1.md`), however many handles the account holds.
- **Carrying costs 58,126 + 31,386 × k.** It is cheaper below about **5 handles**.
- **Carrying is immediate;** E1 needs the successor's acceptance and the 7-day delay.
- **What each moves.** Carrying moves real grants. E1 moves only the right to read through the delegated views.

## 3. Limits

- **OLD pays the gas.** The harness funds it. If a thief drains OLD's ether first, the carry cannot run.
  - E2 (`retireAccountWithSig`, Level 3) lets a relayer pay for the retirement, but not for the grants.
  - An account at risk therefore benefits from E1 set up in advance [I].
- **Persisted grants only.** Delegations, public decryptions and transient grants are not carried.
- **One chain per run.** Handles on other host chains need one run each.
- **The token filter is a policy.** For a `--balance-token`, every grant except the current balance is dropped as
  stale. That includes transfer amounts the token granted to OLD. Carrying them needs `--allow-contract` instead.
- **Enumeration depends on the node.** Providers cap `eth_getLogs` ranges and result counts; `--log-range` pages by
  block range only.
- **Not exercised here:** a live network, and the `env` signer.

## 4. Reproduction (from `fhe-authority-lifecycle/`)

```bash
forge build --root impl/harness/level2/carry
node impl/harness/level2/carry_e2e.mjs impl/.tools/build/main-l2-runs800 impl/harness/level2/carry/out osaka 18671 results/level2/raw/L2_carry_e2e_osaka.json
```

**Artifacts.** `impl/.tools/build/main-l2-runs800` holds the production ACL build of `LEVEL2_E1.md` §7. Its
`ACL.sol` and `ACLEvents.sol` source hashes match the current branch (checked from the artifact metadata).

**ethers.** The tool resolves ethers from `CARRY_ETHERS_FROM`, a `package.json` path, or else from the Zama clone next
to it.
