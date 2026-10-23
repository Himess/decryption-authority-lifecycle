# Level 0: real-connector proof (gate G2-mock, connector part)

**Verdict: PASS.** The coordinator ran this proof personally and verified it from the raw wire records (section 10).

On both versions, the **unmodified** kms-worker checked a **real Level 0 ACL** deployed on a local anvil chain. The
versions were v0.13.8 (`fe3ca89b5`) against ACL **v0.4.1**, and main (`ed851716c`) against ACL **v0.8.0**.

- **Retired subjects are rejected before the KMS.** Every request that rests on a retired account was refused with
  **0 KMS-mock hits**, in every role tested:
  - the user and the contract on the direct path;
  - the delegator, the delegate and the contract on the delegated path;
  - at main, also on the RFC-016 unified path: the user, an `allowedContracts` member, the handle owner (delegated
    entry), the delegated user and the contract, plus one HTTP-sourced request.
- **Controls are forwarded.** Never-retired requests were forwarded to the KMS mock, before and after an unrelated
  account retired.
- **The refusing view is on the wire.** For every refused attempt, the JSON-RPC recorder shows the ACL view that
  answered `false`, and it is always the one the retirement should flip.
- **Zero new RPCs.** The connector sent only the `eth_call` kinds it already sends against the base ACL. No Level 0
  selector reached its endpoint, and no call carried a `from` (rule V3).
- **Totals.**

  | | Tests | Requests | Recorded calls |
  |---|---|---|---|
  | v0.13.8 | 9/9 passed | 96, all checked | 316 |
  | main | 17/17 passed | 222, all checked | 1,062 |

- **Retries, measured.** Under the connector's production defaults (20 attempts, 3 s polling), a retired user's
  request was re-checked 20 times over about 54 s on both versions. Every attempt was refused. The denial is not
  typed and is not final, which is the gap rule V7 / Profile H closes.
- **Latency.** This setup cannot resolve any latency effect. Its upper bound is about 0.3 ms per view (section 9).

With the mock part (`MOCK_E2E.md`, PASS: 15/15 over 3 runs), **gate G2-mock is PASS**. Level 1 may start.

Labels: every number below is **measured [M]** in the context of section 1, unless it is marked **[E]** (estimated).

## 1. Measurement context

- **Host.** The VPS: Ubuntu 24.04.5 LTS, kernel 6.8.0-139-generic, 4 vCPU, 7,941 MB RAM.
- **Shared host.** The VPS is shared with a live service (`<live-service>`, untouched). The checks ran in a capped scope:
  `MemoryMax=2560M`, `CPUQuota=200%`, `nice 19`, `ionice -c3`, with the freeze-not-kill watchdog
  (`scripts/heavy.sh`). Timing numbers carry that noise.
- **Date** 2026-10-21. Times are UTC.

| Run | Window (UTC) | Wall | Peak memory of the scope | Freezes | `<live-service>` before / after |
|---|---|---|---|---|---|
| v0.13.8 | 11:26:12 – 11:29:17 | 185 s | 369 MB | 0 | active / active |
| main | 11:29:53 – 11:35:45 | 352 s | 299 MB | 0 | active / active |

- **Builds** of the test target, earlier the same day, one job (`CARGO_BUILD_JOBS=1`):
  - v0.13.8: 66 s, cgroup peak 2,343 MB;
  - main: 56 s, cgroup peak 2,491 MB;
  - both rc 0, no freeze.
- **Connector commits** (`zama-ai/fhevm`): v0.13.8 tag → `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5`; main →
  `ed851716c9a6b799996a23399ece2858336f96db`.
- **Toolchains.**
  - Rust, as pinned by `kms-connector/rust-toolchain.toml`: 1.92.0 (v0.13.8) and 1.99.1 (main).
  - protoc 26.1 and 34.1.
- **Chain.** anvil 1.3.5 on 127.0.0.1:58545:
  - chain id 12345, hardfork **Prague** (from `anvil_nodeInfo`);
  - `--mnemonic-random --silent`, so no key is ever printed.
- **Recorder.** `scripts/rpc_recorder.py` on 127.0.0.1:58546.
- **Postgres.** `postgres:17.5` in the `lifecycle-pg` container, on 127.0.0.1:55432 only. It has a fresh random
  password that is never printed.

## 2. The Level 0 ACL artifacts, and how they were checked

| Artifact | Source | Version | Compiler settings |
|---|---|---|---|
| `level0_acl_v0.13.8.json` | `impl/fhevm-v0.13.8` @ `06d769f` (`ACL.sol` blob `57bc6f5c…`, `ACLEvents.sol` blob `80c2cbc5…`) | ACL v0.4.1 | solc 0.8.24, optimizer **off**, cancun, `bytecodeHash none`, no CBOR |
| `level0_acl_main.json` | `impl/fhevm-main` @ `5e61f3d` (`ACL.sol` blob `a0758fb0…`, `ACLEvents.sol` blob `c7ebc1e4…`) | ACL v0.8.0 | solc 0.8.24, optimizer on, 200 runs, cancun, `bytecodeHash none`, no CBOR |
| `base_acl_main.json` (latency comparator only) | `impl/fhevm-main` @ `ed851716c` (`ACL.sol` blob `ff339c54…`) | ACL v0.7.0 | as above |

- **Build.** All three were compiled with forge 1.8.5, using the default Foundry profile of their ref. That is the
  profile that produced the checkout's `fhevm_host_bindings`.
- **Address constants.** They use the constants of those bindings:
  - executor `0xe3a9105a3a932253A70F126eb1E3b589C643dD24`;
  - pauser set `0x34e3eD8472e409dbF8FDf933cA996DC75e4Be126`;
  - confidential bridge `0xcC1fD31EA4CBEE42FebC00360894A13ba1A32106` (main).

**Coordinator check (byte level).**
- I compared both Level 0 artifacts with my own local forge build of the same commits.
- Creation and runtime code have the same length, and they differ in **exactly one 20-byte constant, at 3 PUSH20
  sites**:
  - main: `confidentialBridgeAdd`;
  - v0.13.8: `pauserSetAdd`.
- The reason: `host-contracts/addresses/FHEVMHostAddresses.sol` is generated and git-ignored, and my local copy holds
  other values for those two constants. **The executor constant is identical**, and it is the only constant the
  retirement logic reads (`msg.sender != FHEVM_EXECUTOR_ADDRESS`).
- The checkout's `rust_bindings/src/acl.rs` contains the artifacts' constants and never my local one.
- Conclusion: the artifacts are the committed Level 0 sources, built with the bindings' constants.

**On-chain check, at every deployment** (`ACL-DEPLOY` lines). Each test deploys a fresh ACL with Zama's own flow:
1. deploy `ERC1967Proxy(EmptyUUPSProxyACL, initialize(owner))`;
2. call `upgradeToAndCall(ACL, initializeFromEmptyProxy())`.

For each implementation:
- its runtime code equals the artifact's `deployedBytecode` once the UUPS `__self` immutable is zeroed (10/10
  deployments at v0.13.8, 19/19 at main);
- `getVersion()` is `ACL v0.4.1` or `ACL v0.8.0`;
- `supportsInterface(0x556d2088)` returns true;
- `retirementStorageLocation()` returns `0xe6ae1005…0e86200`.

These reads go straight to anvil. They are not sent through the connector's endpoint.

## 3. Setup: what is real and what is mocked

**Real:**
- **The connector code.**
  - Harness HEAD equals pristine HEAD on both versions, and the pristine worktrees are clean.
  - `diff -rq` of `kms-connector` (excluding `tests` directories) reports IDENTICAL.
  - Tree SHA-256 of `crates/kms-worker/src` and `crates/utils/src` (excluding `./tests`) is EQUAL to pristine.
  - The harness touches only test code:
    - `crates/utils/src/tests/setup/*`, which is compiled only with the `tests` feature (`utils/src/lib.rs:10-11`),
      enabled only from kms-worker's `[dev-dependencies]`;
    - the new files `crates/kms-worker/tests/acl_{real_chain,retirement_real_chain}.rs`.
- **The ACL.** It is the real one, on anvil, behind the real proxy flow (section 2). Every write goes through the real
  ACL code:
  - `allow(h, C)` and `allow(h, U)` are called by the dApp contract C;
  - `delegateForUserDecryption(D, C, now+1d)` is called by each delegator;
  - `retireAccount()` is called by each retiring account itself.
  - Anvil EOAs (U, V, D) send their own transactions.
  - The RFC-016 signers (Uk, Dk) are ephemeral local keys. They sign their own `retireAccount()` after
    `anvil_setBalance`.
  - The contract C retires through its own code, `DappStub.retireSelf(acl)`, so the ACL sees `msg.sender == C`.
- **Retirement is checked** after each retirement, by direct reads that are not recorded: the `AccountRetired(account,
  0)` event from the proxy, and `isAccountRetired(account) == true`.

**Stand-ins and mocks:**
- **Executor.** A test-only `ExecutorStub` is placed with `anvil_setCode` at `getFHEVMExecutorAddress()`. Its only job
  is the initial `allowTransient(h, C)`.
- **Gateway.** The in-process alloy `Asserter` serves the gateway transaction that carries the request calldata
  (legacy path) and the coprocessor/S3 configuration.
  - It is **neutral**: it queues enough answers for a forward *and* for every attempt of a rejection, so only the
    connector's own checks can stop a request.
- **KMS Core and ciphertext storage.** These are `mocktail` servers on 127.0.0.1.
  - The KMS mock **accepts anything**, so a rejected request has to fail before it.
  - At main, S3 serves an attested ciphertext (HEAD carries the attestation header), as the repo's own tests do.
- **The request.** It is inserted into the connector's database with the repo's `insert_rand_request`. Then:
  - the user address is set (the requester; on the delegated path, the delegate);
  - for RFC-016, the EIP-712 signature by the local key over the repo's own `compute_user_decrypt_digest`, the handle
    owner, the contract and `allowedContracts` are set too.

**Per request:**
- A fresh kms-worker runs, with a fresh gateway mock and KMS mock. The ACL and the database persist across the
  requests of a test, so the same request can be sent **before** and **after** a retirement.
- The worker's host-chain URL is `http://127.0.0.1:58546/<label>`. The recorder therefore attributes every JSON-RPC
  call to the request that made it.
- **Configuration.** The harness uses `max_decryption_attempts=3`, `db_fast_event_polling=500 ms`, as Zama's
  `tests/acl.rs` does. One test per version uses the connector's own defaults instead.

**What counts as an outcome:**
- **Forwarded:** a response row was stored after the KMS mock served `UserDecrypt` and `GetUserDecryptionResult`
  (4 hits).
- **Rejected:**
  - 0 KMS-mock hits;
  - for on-chain requests, status `failed` with `error_counter == max_decryption_attempts`;
  - for HTTP-sourced requests, an error response row.
  - At v0.13.8 the test also asserts 0 ciphertext fetches.

## 4. Results, v0.13.8 (ACL v0.4.1)

Each case is one fresh ACL. Every "before" request was **Forwarded** (KMS 4, S3 1).

| Case | Retired account | After: outcome | KMS hits | S3 hits | Attempts | View that answered `false` (per attempt) | Other views |
|---|---|---|---|---|---|---|---|
| direct, control | V (no part in the request) | **Forwarded** | 4 | 1 | 1 | — | `isAllowed(h,U)`, `isAllowed(h,C)` true |
| direct, user | U | **Rejected** | 0 | 0 | 3 | `isAllowed(h,U)` ×3 | `isAllowed(h,C)` true ×3 |
| direct, contract | C (self) | **Rejected** | 0 | 0 | 3 | `isAllowed(h,C)` ×3 | `isAllowed(h,U)` true ×3 |
| delegated, control | V | **Forwarded** | 4 | 1 | 1 | — | `isHandleDelegatedForUserDecryption(U,D,C,h)` true |
| delegated, delegator | U | **Rejected** | 0 | 0 | 3 | `isHandleDelegatedForUserDecryption(U,D,C,h)` ×3 | — |
| delegated, delegate | D | **Rejected** | 0 | 0 | 3 | same view ×3 | — |
| delegated, contract | C (self) | **Rejected** | 0 | 0 | 3 | same view ×3 | — |
| direct, user, **production defaults** | U | **Rejected** | 0 | 0 | **20** | `isAllowed(h,U)` ×20 | `isAllowed(h,C)` true ×20 |

**Latency loop.** 80 more requests, every one correct:
- U forwarded ×10 on the direct path and ×10 on the delegated path, against the base ACL v0.4.0 and the Level 0 ACL,
  interleaved;
- the ordinary no-allowance rejection ×5 per path on both ACLs;
- U retired on the Level 0 ACL ×5 per path, next to base-ACL rejections as time-adjacent comparators.

**The connector's own words** (identical to an ordinary denial):
- `0x…U is not allowed to decrypt <h>!`
- `0x…C is not allowed to decrypt <h>!` (contract retired)
- `0x…D is not a delegate of 0x…U for contract 0x…C and handle <h>!`

Each ends with `Maximum number of decryption attempts reached: 3` (or 20).

## 5. Results, main (ACL v0.8.0)

Every "before" request was **Forwarded** (KMS 4, S3 2).

**Legacy gateway-transaction path:**

| Case | Retired | After | KMS | S3 | Attempts | `false` view (per attempt) | Other views per attempt |
|---|---|---|---|---|---|---|---|
| direct, control | V | **Forwarded** | 4 | 2 | 1 | — | `decryptionSignatureInvalidatedBefore(U)=0`, `isAllowed(h,U)`, `isAllowed(h,C)` true |
| direct, user | U | **Rejected** | 0 | 6 | 3 | `isAllowed(h,U)` | invalidation(U)=0, `isAllowed(h,C)` true |
| direct, contract | C | **Rejected** | 0 | 6 | 3 | `isAllowed(h,C)` | invalidation(U)=0, `isAllowed(h,U)` true |
| delegated, control | V | **Forwarded** | 4 | 2 | 1 | — | invalidation(D)=0, `isHandleDelegatedForUserDecryption(U,D,C,h)` true |
| delegated, delegator | U | **Rejected** | 0 | 6 | 3 | `isHandleDelegatedForUserDecryption(U,D,C,h)` | invalidation(D)=0 |
| delegated, delegate | D | **Rejected** | 0 | 6 | 3 | same | invalidation(D)=0 |
| delegated, contract | C | **Rejected** | 0 | 6 | 3 | same | invalidation(D)=0 |
| direct, user, **production defaults** | U | **Rejected** | 0 | 38 | **20** | `isAllowed(h,U)` ×20 | invalidation(U)=0, `isAllowed(h,C)` true |

**RFC-016 unified path** (one handle entry `(h, owner, C)`, signed by a local key; Uk holds `h`; U and V delegate to
Dk for C):

| Case | Entry | Retired | After | KMS | S3 | Attempts | `false` view (per attempt) |
|---|---|---|---|---|---|---|---|
| control | direct, owner = user = Uk | V | **Forwarded** | 4 | 2 | 1 | — |
| user | direct, Uk | Uk (own key) | **Rejected** | 0 | 6 | 3 | `isAllowed(h,Uk)` |
| allowed contract | direct, Uk, `allowedContracts=[C]` | C | **Rejected** | 0 | 6 | 3 | `isAllowed(h,C)`: "No contract in allowedContracts is allowed to decrypt" |
| control | delegated, owner U → user Dk | V | **Forwarded** | 4 | 2 | 1 | — |
| owner | delegated, U → Dk | U | **Rejected** | 0 | 6 | 3 | `isHandleDelegatedForUserDecryption(U,Dk,C,h)` |
| user | delegated, U → Dk | Dk (own key) | **Rejected** | 0 | 6 | 3 | same |
| contract | delegated, U → Dk | C | **Rejected** | 0 | 6 | 3 | same |
| HTTP-sourced user | direct, Uk, `source=http` | Uk | **Rejected**, error response `acl_denied` | 0 | 2 | 1 | `isAllowed(h,Uk)` |

On every RFC-016 attempt the connector also asked `decryptionSignatureInvalidatedBefore(signer)`, which returned 0.
Level 0 does not change that getter (section 8).

**Latency loop.** 190 more requests, every one correct. The loop is three-way:
- the base ACL v0.7.0 from the bindings;
- the same v0.7.0 source compiled exactly like the Level 0 artifact (`base_acl_main.json`);
- the Level 0 ACL v0.8.0.

It covers the legacy and RFC-016 paths, forwards, no-allowance rejections and, on the Level 0 ACL, U and Uk retired.

**S3 hits differ by design.**
- At main, the first attempt runs `check_request` concurrently with `prepare_grpc_request` (`processor.rs:71-76`), so
  a rejected request still fetches the ciphertext (HEAD + GET). The KMS send (`:78`) happens only if both succeed.
- At v0.13.8 the checks run first: 0 fetches.
- This behaviour exists without Level 0 (same counts in `VPS_CONNECTOR_BASELINE.md`).
- In the default-retry case, 38 hits rather than 40: twice, a fetch was cancelled when the failing check won the
  `try_join!`.

## 6. Which view said no, on the wire

The recorder logs every JSON-RPC request and response between the connector and anvil. For each refused request, the
same view answered `false` on **every** attempt. That is `error_counter` times: 3, or 20 under the defaults. No other
view ever answered `false`.

| Retired role | Path | View the connector asked | Why it turned false |
|---|---|---|---|
| user | direct (legacy, RFC-016) | `isAllowed(h, user)` | `retired[user]` |
| contract | direct | `isAllowed(h, C)` | `retired[C]` |
| `allowedContracts` member | RFC-016 direct | `isAllowed(h, C)` | `retired[C]` |
| delegator / owner | delegated (legacy, RFC-016) | `isHandleDelegatedForUserDecryption(delegator, delegate, C, h)` | `retired[delegator]` |
| delegate / signing user | delegated | same | `retired[delegate]` |
| contract | delegated | same | `retired[C]` |

**ACL state cross-check.** After each retirement, the harness read the ACL directly (`ACL-STATE[...after-retire]`).
Only the views that involve the retired account had flipped. For example, after C retired:
- `isAllowed(h,U)=true`;
- `isAllowed(h,C)=false`;
- `isHandleDelegatedForUserDecryption(U,D,C,h)=false`;
- `isAccountRetired(C)=true`, while U, V and D stayed false.

## 7. Zero new RPCs

| | v0.13.8 run | main run |
|---|---|---|
| JSON-RPC records on the connector's endpoint | 316 | 1,062 |
| Methods | `eth_call` only | `eth_call` only |
| Call object | `{input, to}`, **no `from`**, block `latest`, every call | same |
| Functions | `isAllowed`, `isHandleDelegatedForUserDecryption` | the same, plus `decryptionSignatureInvalidatedBefore` |
| Kinds not in the baseline run (base ACL, same harness) | none | none |
| Level 0 selectors (`retireAccount` `0xe7142996`, `isAccountRetired` `0xb279091e`, `supportsInterface`, `retirementStorageLocation`) | none | none |
| Calls to anything but the request's own ACL proxy | 0 | 0 |

**No `from`.** The `eth_call` is evaluated with the zero address as sender, never the executor. That is rule V3 on the
wire. It confirms the static reading of `rpc.rs:24-67` from round 2 of the coordinator's verification.

**BrokenPipe lines.** The main `recorder.out` holds 12 `BrokenPipe` tracebacks. They come from sibling calls that the
connector abandoned when another check failed first inside `try_join!`, as in the baseline. The recorder writes each
record before it answers, so those calls are still in `host_rpc.jsonl`.

## 8. Retries, and what a retirement denial looks like

**The connector cannot tell a retirement denial from an ordinary one.**
- The view simply answers `false`, so the message is the ordinary one ("is not allowed to decrypt", "is not a
  delegate of", "No contract in allowedContracts…").
- On-chain requests are retried as recoverable until `max_decryption_attempts`:
  - v0.13.8: `processor.rs:67-82`;
  - main: the status is restored to `pending` after each failure.
- HTTP-sourced requests get an `acl_denied` error response at once.

**Production defaults.** These are `default_max_decryption_attempts() = 20` and
`default_db_fast_event_polling() = 3 s`:
- v0.13.8: `config.rs:140-142`, `:156-158`;
- main: `config.rs:212-214`, `:228-230`.

| | v0.13.8 | main |
|---|---|---|
| Attempts before `failed` | 20 | 20 |
| Time from first attempt to `failed` | 53,916 ms | 54,233 ms |
| Mean spacing | 2.84 s | 2.85 s |
| ACL `eth_call`s spent | 40 | 60 |
| KMS hits | 0 | 0 |

With the harness configuration (3 attempts, 500 ms polling), a refused request reached `failed` in 0.34–1.65 s.

**What this means for the design:**
1. **V1 holds at Level 0 with no connector change.** No attempt of a retired account's request reached the KMS.
2. **V7 is not met by the unmodified connector**, as expected: V7 is a SHOULD at Level 0 and a MUST under Profile H.
   - The denial is untyped (`acl_denied` / free text, not `ACCOUNT_RETIRED`).
   - It is retried as if the condition could clear.
   - Retries cost only `eth_call`s, and each one is refused again. So this is a cost and a reporting gap, not a
     release.
   - The dangerous case is a governance lapse that un-retires the account while retries are still queued. Final
     denials (Profile H rule 5) remove it.
   - This is the deviation "A9 retries" for the Phase 3 report.
3. **Observation for Level 1:** `decryptionSignatureInvalidatedBefore(retired)` returns 0 under Level 0. Main's
   connector already treats `startTimestamp < invalidatedBefore` as **irrecoverable**, so a registry that reported
   `type(uint256).max` for retired accounts would make main's denials final with no connector change.
   - This would cover the signer only, not the contract or the delegator, and it overloads a getter with a different
     meaning.
   - It is recorded as an option, **not adopted**. Profile H's explicit `isAccountRetired(subject)` check stays the
     design.

## 9. Latency

Per ACL view, as seen by the recorder: arrival of the connector's request → anvil's answer. Latency-loop requests only;
base and Level 0 interleaved. Values are median ms, with (p10–p90) in brackets.

| View | v0.13.8 base v0.4.0 | v0.13.8 Level 0 v0.4.1 | main base v0.7.0 (bindings) | main base v0.7.0 (same profile) | main Level 0 v0.8.0 |
|---|---|---|---|---|---|
| `isAllowed` | 3.34 (1.83–6.97), n=80 | 3.62 (1.81–8.01), n=80 | 4.69 (1.89–13.69), n=115 | 4.25 (1.89–15.31), n=70 | 4.48 (2.02–11.90), n=115 |
| `isHandleDelegatedForUserDecryption` | 2.76 (1.93–6.55), n=40 | 3.05 (1.77–7.75), n=40 | 4.20 (1.91–12.58), n=75 | 4.14 (1.68–18.54), n=75 | 3.31 (1.73–12.38), n=75 |
| `decryptionSignatureInvalidatedBefore` | — | — | 4.56 (1.89–11.60), n=150 | 4.51 (2.07–12.23), n=90 | 4.33 (1.82–13.77), n=150 |

**Connector check time.** This is the connector's own log, "Starting ACL check" → pass/fail, first attempt, in median
ms:
- v0.13.8: direct forward 10.0 base vs 15.4 Level 0; delegated forward 7.5 vs 12.4.
- main: direct forward 20.2 / 25.0 base vs 24.7 Level 0; delegated forward 20.0 / 20.5 vs 20.8.
- For both, p10–p90 spans several times the difference. The full tables are in `raw/vps/level0/*/latency.txt`.

**Reading.**
- The Level 0 cost is one or two warm `SLOAD`s inside an existing `eth_call`. On anvil that is microseconds [E].
- **At main** the Level 0 medians fall between or below the two base variants for every view.
- **At v0.13.8** the Level 0 medians are higher in every group:
  - +0.3 ms per view at the recorder;
  - +2–5 ms in the connector's check time.
- The interleaving order was fixed: the base ACL ran just before the Level 0 ACL in each iteration. So an order effect
  cannot be excluded.
- The check-time gap is also ten times the per-view gap, so it cannot come from the ACL. It is connector-side
  scheduling noise or an order effect.
- Every difference is well inside the p10–p90 spread of a shared, CPU-capped VPS behind a Python recorder.
- Reading: **no latency effect that this setup can resolve**. The upper bound it supports is about 0.3 ms per view
  [M]. It is not evidence about a production node.

## 10. How the result was verified (coordinator)

The harness and its decoder (`decode_level0.py`) were written by a delegated agent. I did not take its verdict on
trust:
1. **I read the test files in full** (`acl_retirement_real_chain.rs`, 1,202 lines at v0.13.8 and 1,729 at main) and
   the recorder, the decoder and the launch scripts.
   - The tests assert outcomes, not views. Views are verified only from the wire, and the decoder requires the
     expected `false` view on every attempt.
   - The local copies are byte-identical to what ran (SHA-256 `1233142c…` and `a2df8554…`, also logged in each run's
     `provenance.txt`).
2. **I checked the artifacts myself** (section 2): byte comparison with my own build, git blobs, and the constants in
   the bindings.
3. **I wrote a separate checker, `indep_check.py`.** It reads only the raw `test.log` and `host_rpc.jsonl`. It shares
   no code with the decoder.
   - It re-derives every request's calls and answers and checks the rules above.
   - Result: **v0.13.8 96/96 OK, main 222/222 OK, no problem found.** Its output is in sections 4–7.
4. **I opened raw records by hand.** Example: `direct.contract-retired.after` at v0.13.8.
   - The connector sent `isAllowed(h, 0x464645…)` (C), and anvil answered `0x…00`.
   - It sent `isAllowed(h, 0xE322fE…)` (U), and anvil answered `0x…01`.
   - The handle's bytes 22..30 are `0x3039` = 12345, and byte 30 is type 5.
5. **I scanned the run directories for secrets** before copying them: no Postgres password, no mnemonic, no private
   key.

## 11. What this proof does not show

- **It is a connector gate, not a KMS property.** The KMS mock accepts everything. What is proven is that the
  connector never forwards (V1). The threshold KMS's own behaviour is not exercised.
- **Not a production chain.** Anvil runs Prague with chain id 12345. Requests enter through the connector's database,
  as in Zama's own tests, not through the gateway listener. The gateway transaction and configuration are mocked.
- **The executor is a stand-in** for the one initial `allowTransient`. Every other ACL write is the real code.
- **No ERC-1271 request.** All signatures were recovered by ecrecover. That branch, and code-first, are Level 1
  (Profile H).
- **One host chain**, and no replica or lagging-RPC scenario (V2 and V5 are not exercised).
- **Ciphertexts at main.** The connector downloads the ciphertext of a refused request. This is pre-existing
  behaviour, and no plaintext or KMS is involved.
- **Gas.** The `retireAccount` gas below is a by-product, not the gas measurement of record. That is
  `LEVEL0_CONTRACTS.md`: 50,099 at main with the 800-run production profile.
  - These runs, transaction `gas_used` on anvil Prague including the 21,000 intrinsic:
    - main (200-run profile): 50,143, or 53,640 when the contract C retires itself through `DappStub`;
    - v0.13.8 (unoptimized): 50,258, or 53,755 for C.

## 12. Reproduction

On the VPS, after the workspace bootstrap described in `VPS_CONNECTOR_BASELINE.md` §8:

```bash
# test-only files (copies in results/level0/harness/{v0.13.8,main}/crates/kms-worker/tests/)
#   -> /srv/lifecycle/src/fhevm-<ver>-harness/kms-connector/crates/kms-worker/tests/acl_retirement_real_chain.rs
# Level 0 artifacts -> /srv/lifecycle/harness/level0/; DappStub.sol -> /srv/lifecycle/harness/sol/src/ (forge build)
/srv/lifecycle/scripts/bg.sh build-L0-v0.13.8 /srv/lifecycle/scripts/kw.sh v0.13.8 build --test acl_retirement_real_chain   # KW_TREE=harness
/srv/lifecycle/scripts/pg_up.sh
/srv/lifecycle/scripts/bg.sh run-L0-v0.13.8 /srv/lifecycle/scripts/run_level0.sh v0.13.8
/srv/lifecycle/scripts/bg.sh run-L0-main /srv/lifecycle/scripts/run_level0.sh main
python3 -I /srv/lifecycle/scripts/indep_check.py /srv/lifecycle/runs/latest-level0-<ver>
docker rm -f lifecycle-pg
```

`run_level0.sh` does the rest:
- it writes `provenance.txt` (connector byte-identity) and starts anvil and the recorder on 127.0.0.1;
- it runs the test with `--test-threads=1`, decodes the results, and tears everything down on exit.

## 13. Files

| Path | Content |
|---|---|
| `raw/vps/level0/v0.13.8/`, `raw/vps/level0/main/` | per run: `test.log`, `host_rpc.jsonl`, `provenance.txt`, the decoder's `acl_calls.txt`, `requests.tsv`, `latency.txt`, `rpc_kinds.txt`, `verdict.txt`, `decode.out`, and `recorder.out` |
| `raw/vps/level0/logs/` | the build and run logs of the capped scopes (`*.log`, `*.outer`) |
| `raw/vps/level0/scripts/` | `run_level0.sh`, `rpc_recorder.py`, `decode_level0.py`, the coordinator's `indep_check.py` and `bc_hash.py`, `pg_up.sh`, `heavy.sh`, `bg.sh`, `kw.sh`, `env.sh`, `health.sh`, `inscope.sh` |
| `harness/{v0.13.8,main}/crates/kms-worker/tests/acl_retirement_real_chain.rs` | the test files |

SHA-256 of the raw wire records and logs:

| File | SHA-256 |
|---|---|
| v0.13.8 `host_rpc.jsonl` | `0f6a4a73…985c` |
| v0.13.8 `test.log` | `016c3f5b…38d2` |
| main `host_rpc.jsonl` | `df81feae…7bf7` |
| main `test.log` | `e0b4ccf4…07d1` |

## 14. VPS state after the runs (2026-10-21T11:40Z)

**Removed:**
- the `lifecycle-pg` container;
- its credential files (`secrets/pg_l0.env`, `secrets/pgpass`), and a stale `secrets/pg_password` from the baseline
  runs.

**Confirmed clean:**
- No lifecycle container, scope, anvil, recorder or test process.
- Ports 58545, 58546 and 55432 are free.
- No STOP marker.
- `<live-service>` is active.

**Kept for Levels 1 and 2:** `/srv/lifecycle` (12 GB: toolchains, source trees, build targets, runs). The disk is 42%
used.
