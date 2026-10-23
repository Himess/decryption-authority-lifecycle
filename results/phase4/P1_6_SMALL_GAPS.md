# P1.6: the smaller Level 1–3 gaps

**Proof class:** Mock. **Status:** done. **Date:** 2026-10-21/22.
**Machines:**
- the connector rows: VPS, capped scope;
- the SDK: M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), anvil 1.8.5, node 22.13.0.

**Raw data:**
- `raw/p11/runs/` (the connector);
- `raw/p16/local-r{1,2,3}/` (the SDK on a local chain);
- `raw/p16/sdk-unit/` (the SDK unit tests).

## 1. An ML-DSA-44 ERC-1271 request through the connector (TC21) [M]

Phase 3 ran this TC21 row through the crate only. Phase 4 runs it through the connector itself.

**Where it ran.** The P1.1 connector harness ran it on the Level 3 worker: `lifecycle/level3-connector` `564d7d1`, which is Level 1's Profile H plus E3. That gives 3 runs × 3 requests, `erc1271.mldsa44-account.direct.{1,2,3}`.

**The setup.**
- **The user** is E4's ML-DSA-44 ERC-1271 account (the Fireblocks verifier, unaudited). It has regular code.
- **The request** carries the account's 2,420-byte ML-DSA-44 signature.

**All 9 requests were forwarded.**

| Measure | Every request |
|---|---|
| Outcome | forwarded to the KMS mock (4 hits) |
| Worker verdict | `PROFILE-H accepted path=Erc1271` |
| Host calls | one `eth_getCode`, one `isValidSignature` |
| `isValidSignature` gas | **2,183,048** = `B_exec` 2,000,000 + 21,000 + 64 × 2,532 calldata bytes |
| Answer | the magic value `0x1626ba7e` |

These figures are read from the recorded wire (`host_rpc.jsonl`), and they are the same in each run.

**The same signature in P0.4.** It came from an EIP-7702 account delegated to this account, with its code rewritten to `0xef0101`:
- the Level 1 worker forwarded it, over RFC-016 direct and over HTTP;
- the unmodified worker refused it, because the call reverts at its 250,000 gas cap.

Table: `p11/P11_TABLE.md`. Raw: `raw/p11/runs/p11-main-l3-r{4,5,6}-*/`.

## 2. The SDK: `getAuthorityStatus` reports EIP-7851 accounts and E1 successor state

### The change

The branch is `lifecycle/phase4-sdk-status`, in the worktree `impl/wt-sdk-status` (main's SDK).

| Commit | Change |
|---|---|
| `7a497ab2` | Level 1's SDK commit (`5b69260`), cherry-picked onto `lifecycle/level2` (`c4482aba`). It adds the optional `getCode` and `getBlockNumber` to the Ethereum module and to both adapters |
| `dbb28903` | `getAuthorityStatus` also reports `accountCode`, read with `eth_getCode`. The type `AccountCode` is exported |

`accountCode` takes one of these values:

| `kind` | Code | What it means |
|---|---|---|
| `empty` | none | The account's ECDSA key signs for it |
| `eip7702` (with `delegate`) | `0xef0100 ‖ delegate` | The ECDSA key still signs for it |
| `eip7851` (with `delegate`) | `0xef0101 ‖ delegate` (EIP-7851, a draft) | The key no longer authorizes the account. Under Profile H, verifiers accept only ERC-1271 signatures from it |
| `regular` | any other code | For example, a contract account |
| `undefined` | | The client's Ethereum module cannot read code |

**How the code is classified.** The rule is H2's, as in the crate and in the SDK precheck: only an exact 23-byte indicator with a known prefix counts as a delegation.

**When it is read.** Every status call reads the code, also on an ACL without the lifecycle Core.

**Errors.** Transport errors are thrown, like the ACL reads.

### Unit tests [M]

- **`getAuthorityStatus.test.ts`: 9/9, three runs, type check clean.** The 4 new tests cover:
  - the four kinds, and look-alikes: prefix `0xef0102`, 24 bytes, 22 bytes;
  - an EIP-7851 account that is retired with a successor, and one with a pending designation;
  - the read of the checksummed account, including on an ACL without Core;
  - a module without `getCode` gives `undefined`, and a transport error is thrown.
- **Zama's whole SDK unit suite on the branch: 933/933 in 38 files, twice, no type errors.**
- **Zama's lint steps on the changed files:**
  - `prettier --check`: clean;
  - `eslint`: 0 errors;
  - `tsc -b`: clean.

### On a local chain [M], three runs

`impl/harness/phase4/p16-sdk/run_p16_sdk.sh` runs the check, with `p16-sdk-status.test.ts`.

**The chain.**
- anvil 1.8.5 on 127.0.0.1:8631: hard fork Bpo1, chain 31337.
- Zama's own `fhevm-deploy.sh` deploys Zama's cleartext mock, unmodified, from `impl/wt-l2-mock` (`lifecycle/level2-mock` `a3e6cbf`).
- Its ACL is the lifecycle ACL v0.4.2, with Core and E1. The successor delay is 604,800 s.

**The SDK.**
- Main's SDK at `dbb28903` reads that chain through its public entry points: `createFhevmBaseClient` of `@fhevm/sdk/ethers` (ethers 6.17.0) and of `@fhevm/sdk/viem` (viem 2.55.19), then `getAuthorityStatus`.
- The client runs its normal init, which reads `getVersion()` of the ACL, the InputVerifier and the KMSVerifier.
- The v0.13 mock is read by main's SDK: the status uses only the ERC-165 ids and the lifecycle views, which are the same on both lines.

**The EIP-7851 simulation** is P0.4's:
- `fault_proxy.py --rewrite-file` on 127.0.0.1:8632 answers `eth_getCode` for chosen accounts with `0xef0101 ‖ delegate`;
- anvil keeps their real EIP-7702 delegation, set by a type-4 transaction.

**The rows.** Each row was read through both adapters, each through the proxy under its own label.

| Row | Account | Node's code | Code the SDK saw | `accountCode` | Lifecycle state |
|---|---|---|---|---|---|
| `E.eoa` | a plain EOA | `0x` | the same | `empty` | active |
| `D.contract` | a one-byte contract (`STOP`) | `0x00` | the same | `regular` | active |
| `X.7702` | delegated to D by a type-4 transaction | `0xef0100 ‖ D` | the same | `eip7702`, D | active |
| `X.7702-retired` | after: designate S, S accepts, 7 days, confirm, retire | `0xef0100 ‖ D` | the same | `eip7702`, D | retired, successor S |
| `X.7851-retired` | then disables its key (simulated) | `0xef0100 ‖ D` | `0xef0101 ‖ D` | `eip7851`, D | retired, successor S |
| `W.7702-pending` | delegated to D; designated S2, S2 accepted | `0xef0100 ‖ D` | the same | `eip7702`, D | active; pending S2, accepted, `confirmableAt` = the designation's block time + 604,800 s |
| `W.7851-pending` | then disables its key (simulated) | `0xef0100 ‖ D` | `0xef0101 ‖ D` | `eip7851`, D | the same pending designation |
| `E.eoa-after` | the EOA again | `0x` | the same | `empty` | active |

**Results:**
- **Every run passes 4/4 tests with 16 status reads.** Both adapters agree on every row, and the three runs are identical after addresses are mapped to roles.
- **The wire, per status read:**
  - one `eth_getCode`, rewritten on the two EIP-7851 rows only;
  - two `supportsInterface` reads (Core, E1);
  - `isAccountRetired`, `successorOf` and `pendingSuccessorOf`.
- **The init's `getVersion` reads** appear once per adapter, because the SDK caches host-contract versions across clients.
- **The rewrite is the proxy's alone.** Read directly, the node still answers `0xef0100 ‖ D` for X and W.

### What this does not show

- **EIP-7851 is a draft, and no client implements it.** The code is rewritten at the JSON-RPC proxy. The status therefore shows what a reader of `eth_getCode` would see.
- **A disabled key's on-chain effect is not simulated.** EIP-7851 would refuse transactions signed by that key. X designated its successor and retired with its own key, before the simulated switch. That is the order a migration out of an EIP-7702 account would follow: designate, confirm, retire, then disable the key.
- **The status is a display aid, not an authorization check.** It reads each field once, at the latest block. Verifiers pin their reads to one block under H2.

## Evidence

| What | Where |
|---|---|
| Connector rows (TC21) | `p11/P11_TABLE.md`; `raw/p11/runs/p11-main-l3-r{4,5,6}-*/` |
| SDK change | `impl/wt-sdk-status` `dbb28903` (`sdk/js-sdk/src/core/actions/host/getAuthorityStatus.ts`, `.test.ts`, `index.ts`) |
| Unit runs | `raw/p16/sdk-unit/getAuthorityStatus_r{1,2,3}.log`, `sdk_full_suite_r{1,2}.log` |
| Local chain runs | `raw/p16/local-r{1,2,3}/`: `P16_result.json` (rows, wire per label), `P16_host_rpc.jsonl`, `deploy.log`, `vitest.log`, `provenance.txt`, `SCAN_REPORT.txt` (0 hits) |
| Harness | `impl/harness/phase4/p16-sdk/` (runner, vitest config, test) |

## Reproduction (from `fhe-authority-lifecycle/`)

```bash
node impl/harness/level2/link_deps.mjs impl wt-sdk-status
cd impl/wt-sdk-status/sdk/js-sdk && node node_modules/vitest/vitest.mjs run --config src/vitest.config.ts
bash impl/harness/phase4/p16-sdk/run_p16_sdk.sh r1
```
