# Level 2, part (d) and the E1 mock scenario: SDK hygiene in Zama's cleartext mock

**Status.** Done for the prototype.
- **SDK hygiene** is in Zama's SDK source on both lines:
  - a typed `ACCOUNT_RETIRED` refusal;
  - `getAuthorityStatus`;
  - one transport key per request, zero-filled once released and purged with the account's permits on retirement.
- **E1 runs end to end in Zama's own cleartext mock,** through the SDK: 7/7 scenario tests in three consecutive
  runs on the final commit `a3e6cbf`.

Labels:
- **[M]:** measured on M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045) on 2026-10-21, with anvil 1.8.5 (hardfork Bpo1,
  chain id 31337), solc 0.8.35 (the SDK's `v13` profile), Node 22.13.0 and vitest 4.1.11.
- **[E]:** estimated.

**The mock's limit applies unchanged.** It proves the views and the SDK flow, not confidentiality: plaintext is public
in the mock (`results/level0/MOCK_E2E.md` §2.6). The real connector reads the same views; `LEVEL2_E1.md` §5 has that
proof for E1.

## 1. The SDK change

**Commits.**

| Line | Branch (worktree) | Commits |
|---|---|---|
| v0.13 (the SDK the mock runs) | `lifecycle/level2-mock` (`impl/wt-l2-mock`) | `9a3e5b1` (mock ACL → v0.4.2), `b272882` (hygiene), `a3e6cbf` (disposed-key guard) |
| main | `lifecycle/level2` (`impl/wt-l2-main`) | `bbec089` (hygiene, the same patch), `c4482ab` (disposed-key guard) |

The files the change touches are byte-identical on both lines, except `kms/TransportKeyPair-p.ts`, where the same patch
applies at an offset.

| Piece | What it does |
|---|---|
| `errors/AclError.ts` | `AclAccountRetiredError` extends `AclUserDecryptionError`, with `code = 'ACCOUNT_RETIRED'` and `accounts`, the retired subjects. The SDK exports no error classes, so applications check `error.code`. Existing handlers still catch the refusal |
| `host-contracts/isAccountRetired.ts` | `isAccountRetired` (batched reads) and `findRetiredAccounts`. The latter returns nothing on an ACL without the lifecycle Core |
| `host-contracts/checkPersistAllowed.ts`, `checkDelegation.ts` | After a refusal, the precheck asks `isAccountRetired` for the subjects: user; app contract; or delegator, delegate and contract. If one is retired, it throws the typed error. An allowed request makes no extra call |
| `actions/host/getAuthorityStatus.ts` | `getAuthorityStatus(client, { address })` returns `lifecycle` (ERC-165 Core), `retired`, and the E1 `successor` and `pendingSuccessor`. The E1 fields are `undefined` without E1. `getAuthorityStatusOnChains` takes one client per chain |
| `kms/TransportKeyPair-p.ts` | `disposeTransportKeyPair` zero-fills the private key bytes. Decrypting or serializing with the pair then throws |
| `kms/TransportKeyRing.ts`, `actions/decrypt/purgeIfRetired.ts` | `createTransportKeyRing(generate)`: `issue(account)` gives one fresh pair per request, `release` zero-fills it, `keepPermit` and `purge(account)` handle permits. `purgeIfRetired` purges once `getAuthorityStatus` reports the account retired |
| `kms/decryptValuesFromPairs.ts` (`a3e6cbf`, `c4482ab`) | A disposed pair is refused **before** any share request. Before this commit, the mock showed the relayer called with a released key's public key and the failure coming only at local decryption |

**What it cannot do.**
- The purge zero-fills only the key bytes the SDK holds.
- Copies an application made, for example from `serializeTransportKeyPair`, are out of its reach.
- The WASM private key the SDK deserializes for each decryption is already freed after use.

**Not done:**
- **The HTTP mapping.** The relayer's `account_retired` reply (Level 1, H5 over HTTP) is not yet mapped to the typed
  error; the v0.13 SDK talks to the cleartext relayer module.
- **Stored-result TTLs** remain a design note (TARGET §3.11).

## 2. Unit tests and lint [M]

- **19 new tests,** with a mocked provider on a real core client, in three files:
  - `host-contracts/isAccountRetired.test.ts`: typed and generic refusals, no extra call when allowed, and an ACL
    without Core;
  - `kms/TransportKeyRing.test.ts`: dispose, issue, release, purge;
  - `actions/host/getAuthorityStatus.test.ts`: status shapes, per chain, and `purgeIfRetired`.
- **Full SDK unit suites:** 914/914 on the v0.13 line (`a3e6cbf`) and 918/918 on main (`c4482ab`), with no type
  errors.
- **Lint:** `tsc` (ESM build config), ESLint (the SDK's config) and prettier pass on every touched file, on both lines.

## 3. The mock scenario [M]

**Setup.**
- The worktree `impl/wt-l2-mock` makes the vendored v0.13.0 host stack's `ACL.sol` and `ACLEvents.sol` byte-identical
  copies of ACL v0.4.2: the v0.13-line backport with Core and E1. `CleartextACL` inherits it unchanged.
- Zama's deploy scripts ran unmodified. The known `initFheTest` revert (ENV_BASELINE §4.5) leaves FHETest deployed and
  configured.
- Harness: `impl/harness/level2-mock/` (`run_mock_e2e_l2.sh`, `mock-e2e-l2.test.ts`). Fresh random wallets, local anvil
  only, never port 8545.

| Test | What runs | Result |
|---|---|---|
| setup | the deployed ACL | `ACL v0.4.2`; Core and E1 declared; D = 604,800 s |
| E1, before retirement | OLD stores two handles and delegates normally to DOLD. It then designates S; S accepts; confirming early reverts with `SuccessorNotYetConfirmable`; the harness waits D and OLD confirms. `getAuthorityStatus` reports each step | **The confirmed successor has no right while OLD is active:** S's delegated request is refused with the generic error, before the relayer. DOLD and OLD still decrypt |
| E1, after retirement | OLD retires (54,459 gas; event `AccountRetired(OLD, S)`) | **S decrypts OLD's two handles** (`5001`, `61`) through the SDK's delegated flow and the on-chain mock. DOLD and OLD get `AclAccountRetiredError` (`ACCOUNT_RETIRED`, accounts `[OLD]`), before the relayer |
| E1, straggler | after the retirement, X grants a handle to OLD | `persistAllowed(h, OLD)` is false, and the delegated view for (OLD, S) is true. **S decrypts `777`;** OLD gets the typed refusal |
| E1, pending designation | OLD2 designates S2, S2 accepts, OLD2 retires before confirming | status: retired, no successor and no pending designation. S2 gets the typed refusal |
| an ordinary refusal | NEW asks for a handle it was never granted | the generic `AclUserDecryptionError`, not the typed one |
| transport hygiene | U decrypts twice, each time with a fresh pair from the ring, released after use | **Each request has its own public key** and both decrypt `9090`. Reusing a released pair fails with "TransportKeyPair is disposed", **before any relayer call** (on the final commit). A kept session (a pair and its permit) survives `purgeIfRetired` while U is active; after U retires it is purged (`keys: 1, permits: 1`) and the pair is disposed |

**Runs:**
- On the final commit `a3e6cbf`: 14:59:02Z, 14:59:49Z and 15:00:35Z, 7/7 each. Each run deploys a fresh stack on a
  fresh anvil.
- On `b272882`, before the guard: three runs, 7/7 each, kept in `raw/mock/b272882/`.

**The worktree after every run.** Tracked files are unchanged, and the secret scan of `raw/mock/` finds nothing.

## 4. Reproduction (from `fhe-authority-lifecycle/`)

```bash
node impl/harness/level2/link_deps.mjs impl
bash impl/harness/level2-mock/run_mock_e2e_l2.sh
```

SDK unit tests, on either line:

```bash
cd impl/wt-l2-mock/sdk/js-sdk
node node_modules/vitest/vitest.mjs run --config src/vitest.config.ts
```

Raw data in `results/level2/raw/`:
- `mock/L2M_summary_run{1,2,3}.txt`, `L2M_result_run{1,2,3}.json` and `L2M_vitest_run{1,2,3}.log`;
- the deploy logs `mock/L2M_fhevm_deploy.log` and `L2M_fhetest_deploy.log`;
- `L2_sdk_unit_wt-l2-mock.log` and `L2_sdk_unit_wt-l2-main.log`;
- `L2_sdk_checks_main.log`.
