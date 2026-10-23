# Level 0: real connector proof on the VPS (baseline, unmodified connector code)

**Status: done.** On both versions the unmodified kms-worker, checking a **real** ACL on a local Anvil chain:

- **forwards** U's user-decryption request to the (mocked) KMS;
- **rejects** V's request without ever reaching the KMS;
- does both on the direct path and on the delegated path.

Versions: v0.13.8 (`fe3ca89b5`) and main (`ed851716c`). The checkout's mocked ACL tests also pass unmodified. Every ACL view
the connector issued was captured on the wire and matches the file:line inventory in section 6.

`<live-service>` was `active` at every check. Run 2 recorded **no freeze, no prover wait and no guard event**.

Run history:

- **Run 1** (05:09–05:38Z) was stopped by the original 1 GB guard while the other tenant's groth16 prover was running.
- **Run 2** (05:47–07:04Z) followed the coordinator's decisions: a lighter build, freeze-not-kill, and a wait for the
  prover.

## 1. Measurement context

Every number in this report was measured under these conditions.

- **VPS:** Ubuntu 24.04.5 LTS, kernel 6.8.0-139-generic, 4 vCPU, 7941 MB RAM, 16 GB swap,
  systemd 255, cgroup v2, Docker 29.1.3.
- **Date**: 2026-10-21. Times are UTC; the VPS clock is UTC+2.
- **Commits** of `zama-ai/fhevm`:
  - v0.13.8 (annotated tag) → `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5`
  - main → `ed851716c9a6b799996a23399ece2858336f96db`
- **Rust toolchains**, as pinned by `kms-connector/rust-toolchain.toml`: 1.92.0 for v0.13.8 and 1.99.1 for main.
  - `RUSTUP_HOME=/srv/lifecycle/.rustup`, `CARGO_HOME=/srv/lifecycle/.cargo`, rustup 1.29.1.
- **protoc**: 26.1 for v0.13.8 (its CI uses 26.x) and 34.1 for main (pinned, sha256 verified).
- **Foundry** v1.3.5 (anvil, forge, cast). v0.13.8 pins anvil image v1.3.5.
- **ACL deployed**:
  - v0.13.8: `getVersion()` = **ACL v0.4.0**
  - main: **ACL v0.7.0**
  - Both from the repo's own `fhevm_host_bindings` bytecode.

## 2. Safety setup in run 2 and every deviation

- **Scope.** Every heavy step ran through `scripts/heavy.sh`:
  `systemd-run --scope -p MemoryMax=2560M -p MemorySwapMax=3G -p CPUQuota=200% nice -n 19 ionice -c3`. The cgroup
  confirmed it (`memory.max=2684354560`, `cpu.max=200000 100000`).
- **Build profile (coordinator decision).** This changes no code.
  - `CARGO_BUILD_JOBS=1`, `CARGO_INCREMENTAL=0`, `CARGO_PROFILE_DEV_DEBUG=0`, `CARGO_PROFILE_TEST_DEBUG=0`.
  - Only the needed targets were built: `-p kms-worker --lib --test acl`, then `--test acl_real_chain`.
- **Watchdog**, checking every 5 s:
  - `MemAvailable` < 1229 MB (1.2 GiB) → `systemctl freeze` my own scope.
  - Thaw when it stays above 2560 MB for 60 s.
  - Kill only my own scope, and only if it has been frozen for more than 45 min or `<live-service>` is not active.
  - Before each step: refuse if the STOP marker exists or `<live-service>` is not active. While the <other-service>
    `risczero/risc0-groth16-prover` container runs, poll every 120 s for at most 60 min.
  - I tested freeze and thaw once on a throwaway scope of mine.
  - The prover container was **never** running when a step started. There were **0** freezes, 0 waits and 0 kills.
- **Swap cap (my own deviation).**
  - `MemorySwapMax` was an extra cap I added; neither the coordinator nor Semih asked for it. I raised it from 1G to 3G
    after build A's memcg OOM (section 3). The RAM cap stayed at 2.5G.
  - The builds then needed up to 1.33 GB (v0.13.8) and 1.71 GB (main) of swap inside the scope.
  - Host swap use stayed between 153 and 475 MB.
- **Postgres.** Container `lifecycle-pg` (`postgres:17.5`), published on `-p 127.0.0.1:55432:5432`, capped with
  `--memory=1g --memory-swap=1g --cpus=1`.
  - A new random password was created for run 2. It was passed through the CLI environment and stored only in
    `/srv/lifecycle/secrets` (mode 600).
  - Tests get it through `PGPASSFILE`; sqlx 0.8.6 honours it. The DB URLs in the logs contain no password.
  - I grepped every copied log, run and script for the password: 0 hits.
- **DB harness, a deviation from "testcontainers".**
  - v0.13.8: `crates/utils/src/tests/setup/db.rs` uses `LIFECYCLE_PG_ADMIN_URL` when set, creating one fresh database
    per test. `instance.rs` gets a one-line accessor change.
  - main: no change. It already uses `DbInstance::setup_external()` with `DATABASE_URL`.
  - Proof that no testcontainers Postgres ran: the per-test databases (`kms_connector_test_<pid>_<n>`) appeared in
    `lifecycle-pg`.
- **Network bindings.**
  - The unmodified `tests/acl.rs` binds its `mocktail` KMS mock to **0.0.0.0** (mocktail's default) while it runs:
    about 3 s at v0.13.8 and 13 s at main. The coordinator accepted this.
  - **I did not run `ufw status`.** The original rules forbade reading ufw, and that check was optional.
  - Everything I control was bound to 127.0.0.1: anvil (`--host 127.0.0.1`), the JSON-RPC recorder, and the harness
    mocktail servers (`listen_addr: 127.0.0.1`).
- **Untouched.** Nothing under `<live-service-dir>`, caddy, ufw or iptables, the Docker daemon config, foreign units or
  `<other-service>` processes. No `.env` was read. No apt.
- **No live Zama service contacted.** Network use: GitHub (clones, releases, git dependencies), crates.io,
  static.rust-lang.org, binaries.soliditylang.org (solc 0.8.24) and Docker Hub (`postgres:17.5`).
- **Repo content** was treated as data only. No agent-instruction files or hooks were run.
- **Separate worktrees.** Harness changes live in `fhevm-<ver>-harness`; the pristine worktrees are byte-identical to
  the tags.
  - The target dirs are kept (`/srv/lifecycle/target/{v0.13.8,main}`) for the retirement proof.
  - `target/v0.13.8` still holds about 2.7 GB of run-1 artifacts built with the old `debug=2` profile. They are unused
    by the new profile and were not deleted.

## 3. Builds (run 2, light profile)

| Step | Targets | Wall | Result | Scope RAM peak | Scope swap peak | Largest process RSS |
|---|---|---|---|---|---|---|
| v0.13.8 build A | `-p kms-worker --lib --test acl` | 1320 s | **memcg OOM inside my own scope** | 2560 MB (cap) | 1024 MB (= old swap cap) | – |
| v0.13.8 build A2 | same (resumed) | 735 s | ok: 52 more units, `tfhe 1.6.1` alone took 468 s | 2560 MB (cap) | 1330 MB | 2.67 GB |
| v0.13.8 build B | `--test acl_real_chain` (incremental) | 51 s | ok | 969 MB | 0 | 1.03 GB |
| main build A | `-p kms-worker --lib --test acl` | 1768 s | ok: 738 units; slowest `tfhe 1.8.1` 550 s, `fhevm_host_bindings` 109 s, `aws-lc-sys` build script 97 s | 2560 MB (cap) | 1710 MB | 2.62 GB |
| main build B | `--test acl_real_chain` | 56 s | ok | 841 MB | 0 | 1.25 GB |
| main build B2 | + RFC-016 V2 cases | 26 s | ok | 593 MB | 0 | 1.25 GB |

Notes:

- **What the OOM was.** At 06:09:43Z the kernel killed rustc pid 138599 (anon-rss 2.57 GB) under constraint
  `CONSTRAINT_MEMCG` of `lifecycle-build-A-v0.13.8-…scope`. Only my scope was affected; host `MemAvailable` stayed
  above 6.7 GB. systemd then stopped the scope (rc 143).
- **Which crate.** The killed rustc was `tfhe 1.6.1`. tfhe had started and never finished in A; A2 had to compile it
  again, while `bollard` was not recompiled.
  - My `health.log` note at the time said "bollard". That was wrong; it was tfhe.
  - Even with `CARGO_BUILD_JOBS=1`, other crates kept compiling while tfhe's codegen ran.
- **Bottom line.** At this profile the build needs more than 3.5 GB of RAM + swap. It fits in 2.5 GB RAM + up to
  1.7 GB swap.
- **Cargo timing reports** are in `raw/vps/run2/cargo-timings/`.
- **Every step:**
  - `<live-service>=active`
  - `MemAvailable` ≥ 6.9 GB at every before/after check
  - lowest value in my spot checks: 4864 MB at 06:45:48Z (main build A)
  - 1-minute load average between 0.4 and 2.1 (the prover was idle)

## 4. Unmodified mocked ACL tests

| Test | Version | Result | Wall |
|---|---|---|---|
| `kms-worker --lib event_processor::decryption::tests` (Asserter-mocked ACL) | v0.13.8 | **13 passed**: 11 ACL cases (public 3, user 5, delegated 3) + 2 extra-data | 5 s |
| `tests/acl.rs` (mocked gateway, ACL and KMS; lifecycle-pg) | v0.13.8 | **2 passed** (`public_decryption`, `user_decryption`) | 5 s |
| same unit filter | main | **40 passed** (incl. invalidation, RFC-016 ownership / allowedContracts / signature / validity cases) | 5 s |
| `tests/acl.rs` | main | **6 passed** (public, user, user_v2, each also `already_sent`) | 21 s |

## 5. Real-chain harness: U allowed, V rejected, direct and delegated

### Setup per scenario

- **Chain.** Anvil runs on 127.0.0.1 with chain id 12345 and `--mnemonic-random --silent`; no key is ever printed.
- **Accounts.** Owner `a0`, U `a1`, V `a2`, D `a3`. Addresses are logged in `test.log` (`ACCOUNTS ...`).
- **ACL deployment**, as in Zama's own `HostContractsDeployerTestUtils._deployACL`:
  1. Deploy `ERC1967Proxy(EmptyUUPSProxyACL, initialize(owner))`.
  2. Call `upgradeToAndCall(ACL, initializeFromEmptyProxy())`.
  - `EmptyUUPSProxyACL` and `ACL` bytecode come from the checkout's `fhevm_host_bindings`.
  - The proxy is the unmodified OpenZeppelin v5.1.0 `ERC1967Proxy`.
- **Grant.** A test-only `ExecutorStub` is placed with `anvil_setCode` at `ACL.getFHEVMExecutorAddress()`.
  - It calls the real `allowTransient(h, C)`. dApp `C` then calls the real `allow(h, C)` and `allow(h, U)`.
  - So every allowance is written by the real ACL's own code.
- **Delegations.** U and V each call the real `delegateForUserDecryption(D, C, now+1d)`.
- **Handle `h`.** Random, encoding chain id 12345 and type `euint64`.
- **Sanity check.** Before every scenario, the ACL state is read back directly from Anvil and asserted (`ACL-STATE`
  lines).
- **Connector inputs.**
  - The gateway, KMS and ciphertext storage are mocked, as `tests/acl.rs` does. The KMS and storage mocks are
    `mocktail` servers on 127.0.0.1.
  - The connector's host provider is `init_host_chains_acl_contracts_anvil`. It has the same `ACLInstance<RootProvider>`
    type as the Asserter mock, but reaches Anvil through a 127.0.0.1 JSON-RPC recorder (`scripts/rpc_recorder.py`).
- **Forwarded** means a response row was stored, after both `UserDecrypt` and `GetUserDecryptionResult` were served by
  the KMS mock. **Rejected** means the request ended `failed` after `max_decryption_attempts=3`, with **0 KMS-mock
  hits**.

### Results

| Scenario (request) | v0.13.8 (`ACL v0.4.0`) | main (`ACL v0.7.0`) |
|---|---|---|
| direct, user **U** (allowed) | **Forwarded**, KMS 4 / S3 1 | **Forwarded**, KMS 4 / S3 2 |
| direct, user **V** (no allowance) | **Rejected**, KMS 0 / S3 0 | **Rejected**, KMS 0 / S3 6 |
| delegated, delegator U → delegate D | **Forwarded**, KMS 4 / S3 1 | **Forwarded**, KMS 4 / S3 2 |
| delegated, delegator **V** (not allowed, but delegated to D) | **Rejected**, KMS 0 / S3 0 | **Rejected**, KMS 0 / S3 6 |
| delegated, delegator U, delegate **V** (never delegated) | **Rejected**, KMS 0 / S3 0 | **Rejected**, KMS 0 / S3 6 |
| main RFC-016 "V2", direct, user Uk (allowed) | – | **Forwarded**, KMS 4 / S3 2 |
| V2, direct, user Vk (no allowance) | – | **Rejected**, KMS 0 / S3 5 |
| V2, delegated, owner U → user Dk | – | **Forwarded**, KMS 4 / S3 2 |
| V2, delegated, owner **V** → user Dk | – | **Rejected**, KMS 0 / S3 5 |
| V2, delegated, owner U, user **Vk** (no delegation) | – | **Rejected**, KMS 0 / S3 6 |

Run totals: v0.13.8 5/5 passed in 15.5 s; main legacy 5/5 passed; main legacy + V2 10/10 passed in 36.3 s.

**Rejection logs (unmodified connector), v0.13.8:**

- `"<V> is not allowed to decrypt <h>!"`
- `"<D> is not a delegate of <V> for contract <C> and handle <h>!"`
- Both end with `Maximum number of decryption attempts reached: 3`.
- main logs the same text through its own error type.

**How the V2 harness is built:**

- The repo helper inserts the row. The test then sets the user, owner and contract, and adds an EIP-712 signature by
  the user.
  - The digest comes from the repo's `user_decryption_signature::compute_user_decrypt_digest`.
  - The signing keys are ephemeral local keys. Only their addresses are logged.
- Signatures are recovered by ecrecover, so `isValidSignature` was never called. The ERC-1271 branch needs a
  contract-account user and is not covered.

**S3 hits differ between the versions:**

- At main, `processor.rs:71-76` prepares the gRPC request concurrently with the checks. That is why a rejected request
  still fetches ciphertexts (HEAD+GET, 5–6 hits over 3 attempts) but never reaches the KMS.
- At v0.13.8 the checks run first, so a rejected request makes 0 S3 hits.

### ACL views actually issued, from the JSON-RPC recorder (`raw/vps/run2/runs/*/acl_calls.txt`)

Every call was an `eth_call` to the ACL at block `latest`. No other method was ever sent to the connector's host
endpoint: no `eth_chainId`, no `eth_getCode`.

| Scenario | v0.13.8 calls (per attempt; ×3 when rejected) | main calls (per attempt; ×3 when rejected) |
|---|---|---|
| direct U | `isAllowed(h,U)=true`, `isAllowed(h,C)=true` | `decryptionSignatureInvalidatedBefore(U)=0`, `isAllowed(h,U)=true`, `isAllowed(h,C)=true` |
| direct V | `isAllowed(h,V)=false`, `isAllowed(h,C)=true` | `decryptionSignatureInvalidatedBefore(V)=0`, `isAllowed(h,V)=false`, `isAllowed(h,C)=true` |
| delegated U→D | `isHandleDelegatedForUserDecryption(U,D,C,h)=true` | `decryptionSignatureInvalidatedBefore(D)=0`, `isHandleDelegatedForUserDecryption(U,D,C,h)=true` |
| delegated V→D | `isHandleDelegatedForUserDecryption(V,D,C,h)=false` | invalidation(D) + `isHandleDelegatedForUserDecryption(V,D,C,h)=false` |
| delegated U→V | `isHandleDelegatedForUserDecryption(U,V,C,h)=false` | invalidation(V) + `isHandleDelegatedForUserDecryption(U,V,C,h)=false` |
| V2 direct Uk / Vk | – | `decryptionSignatureInvalidatedBefore(Uk|Vk)=0`, `isAllowed(h,Uk)=true` / `isAllowed(h,Vk)=false` (no contract check: `allowedContracts` empty) |
| V2 delegated | – | `decryptionSignatureInvalidatedBefore(Dk|Vk)=0`, `isHandleDelegatedForUserDecryption(owner,user,C,h)` |

Recorded totals:

- v0.13.8: 15 calls (2+6+1+3+3)
- main first run: 26 calls
- main legacy + V2 run: 48 calls

All three totals equal exactly what the code predicts.

Observations for the retirement proof:

- The direct path always asks `isAllowed(h,C)` too, even when `isAllowed(h,user)` is false.
- The delegated paths never call `isAllowed`. `isHandleDelegatedForUserDecryption` checks the delegator's and the
  contract's persisted allowances inside the ACL.
- At main, `try_join!` drops sibling calls once one check fails. In the first main run, 3 recorded calls were
  abandoned by the client (BrokenPipe in `recorder.out`). They were still issued on the wire.

## 6. ACL view calls per path, file:line

Read from the source, then **confirmed on the wire** (section 5). `DP/` =
`kms-connector/crates/kms-worker/src/core/event_processor/`.

### v0.13.8 (`fe3ca89b5`)

| Path | Call | Where |
|---|---|---|
| Public decryption | `isAllowedForDecryption(h)` | `DP/decryption.rs:98-102` (fn :80), from `DP/processor.rs:120-123` |
| User, direct (`userDecryptionRequest` calldata) | `isAllowed(h,user)` + `isAllowed(h,contract)`, `tokio::try_join!` | `DP/decryption.rs:229-234` (fn :221) |
| User, delegated (`delegatedUserDecryptionRequest` calldata) | `isHandleDelegatedForUserDecryption(delegator, user, contract, h)` | `DP/decryption.rs:200-209` (fn :191) |

- **Calldata.** Re-read from the gateway tx on every attempt: `fetch_calldata` (`DP/decryption.rs:343-356`), called at
  `DP/processor.rs:143`.
- **Path choice.** Decoding tries the delegated call first (`DP/decryption.rs:127-145`). The contract is taken per handle
  from `ctHandleContractPairs` (:147-165). The host chain comes from the handle's bytes 22..30.
- **Order.** The checks (`DP/processor.rs:144-150`) run **before** the S3 fetch and the KMS send (:151-161, :191-196).
- **Retries.** A denial is `Recoverable` and is retried until `error_counter ≥ max_decryption_attempts`, then marked
  `failed` (`DP/processor.rs:67-82`).
- **Production wiring.** One `ACL` per configured host chain: `kms_worker.rs:126-131`.

### main (`ed851716c`)

`HostRpcClient` (`DP/rpc.rs`):

| Wrapper | Lines | Call |
|---|---|---|
| `is_allowed_for_decryption` | :24-30 | `isAllowedForDecryption(h)` |
| `is_allowed` | :32-42 | `isAllowed(h, account)` |
| `is_handle_delegated_for_user_decryption` | :44-56 | `isHandleDelegatedForUserDecryption(delegator, delegate, contract, h)` |
| `decryption_signature_invalidated_before` | :58-67 | `decryptionSignatureInvalidatedBefore(account)` |
| `verify_signature` | :70-86 | → `shared/user-decryption-signature/src/lib.rs:196-211` |

`verify_signature` does ecrecover first (:203-208). Only on a mismatch does it make an `eth_call`
`isValidSignature(digest, sig)` to the user's account, with a gas cap (fn :123-185, the call at :139).

| Path | Calls | Where |
|---|---|---|
| Public | `isAllowedForDecryption(h)` | `DP/decryption.rs:105` (fn :87) |
| Legacy user, direct | `decryptionSignatureInvalidatedBefore(user)` + `isAllowed(h,user)` + `isAllowed(h,contract)` | invalidation :221-229 → :522-542 (call :528-530; `startTimestamp < invalidatedBefore` is **Irrecoverable**). ACL :211-219 → :544-573 (calls :551-555) |
| Legacy user, delegated | `decryptionSignatureInvalidatedBefore(user)` + `isHandleDelegatedForUserDecryption(delegator,user,contract,h)` | :202-210 → :235-264 (call :243-250) |
| RFC-016 V2, owner == user | `isValidSignature` only if ecrecover ≠ user; `decryptionSignatureInvalidatedBefore(user)`; `isAllowed(h,user)`; `isAllowed(h,c)` for each `c ∈ allowedContracts` (first true wins; empty list → no call) | `DP/decryption.rs:401-429`; ownership :441-456 (call :449); allowedContracts :484-518 (call :496) |
| RFC-016 V2, owner ≠ user | as above, with `isHandleDelegatedForUserDecryption(owner,user,contract,h)` instead of `isAllowed(h,user)` | :457-476 (call :458-465) |

- **Legacy decoding** is at `DP/decryption.rs:129-158`. `fetch_calldata` also requires `tx.to == Decryption`
  (:637-666).
- **Re-checks.** All checks live in `check_request` (`DP/processor.rs:149-216`) and are re-run on every attempt,
  including the poll-only retry of an already-sent request (:64-68).
- **Concurrency.** A first attempt runs `check_request` concurrently with `prepare_grpc_request` (:71-76). The KMS
  send (:78) happens only if both succeed.
- **Production wiring.** `kms_worker.rs:291-293`.

## 7. Harness location and how to reuse it

- **Files:** `results/level0/harness/{v0.13.8,main}/...`, plus `harness/v0.13.8-test-harness.patch` and
  `harness/main-test-harness.patch` (`git diff` of the harness worktrees).
- **On the VPS:** the files are already applied in `/srv/lifecycle/src/fhevm-{v0.13.8,main}-harness`.
- **Changed paths:**
  - `crates/utils/src/tests/setup/{host.rs, db.rs*, instance.rs*}` (*v0.13.8 only)
  - new `crates/kms-worker/tests/acl_real_chain.rs`
  - no production file touched
- **Entry points for the retirement proof:**
  - `AnvilAcl::{deploy, grant, delegate, instance}` and `init_host_chains_acl_contracts_anvil`, both in
    `setup/host.rs`.
  - `scripts/run_real_chain.sh <ver>`: anvil + recorder + test + decoded `acl_calls.txt`.
- **Helper contracts:** `raw/vps/harness_sol/`, built with forge into `/srv/lifecycle/harness/sol/out`.

## 8. Exact reproduction commands (run 2)

Workspace bootstrap is unchanged from run 1. The scripts are in `raw/vps/scripts/`; copy them to
`/srv/lifecycle/scripts/` and use atomic `mv` replacement only. Steps that ran before run 2 (clone, worktrees,
`setup_tools.sh`, `fetch-v0.13.8`, `setup_harness_sol.sh`) are listed in section 10.

```bash
S=/srv/lifecycle/scripts; P=/srv/lifecycle/harness/patches
rm -f /srv/lifecycle/STOP
git -C /srv/lifecycle/src/fhevm.git worktree add --detach /srv/lifecycle/src/fhevm-v0.13.8-harness v0.13.8
git -C /srv/lifecycle/src/fhevm.git worktree add --detach /srv/lifecycle/src/fhevm-main-harness ed851716c9a6b799996a23399ece2858336f96db
# v0.13.8: DB deviation, build, unmodified mocked tests
cp $P/patch-v0.13.8/crates/utils/src/tests/setup/{db.rs,instance.rs} /srv/lifecycle/src/fhevm-v0.13.8-harness/kms-connector/crates/utils/src/tests/setup/
KW_TREE=harness $S/bg.sh build-A2-v0.13.8 $S/kw.sh v0.13.8 build --lib --test acl
KW_TREE=harness $S/heavy.sh test-unit-v0.13.8 $S/kw.sh v0.13.8 test --lib -- event_processor::decryption::tests
# lifecycle-pg: same docker run as run 1 (new random password, 127.0.0.1:55432, --memory=1g --memory-swap=1g --cpus=1)
KW_TREE=harness KW_DB=1 $S/heavy.sh test-acl-v0.13.8 $S/kw.sh v0.13.8 test --test acl -- --test-threads=1
# v0.13.8: real chain
cp $P/patch-v0.13.8/crates/utils/src/tests/setup/host.rs   /srv/lifecycle/src/fhevm-v0.13.8-harness/kms-connector/crates/utils/src/tests/setup/
cp $P/patch-v0.13.8/crates/kms-worker/tests/acl_real_chain.rs /srv/lifecycle/src/fhevm-v0.13.8-harness/kms-connector/crates/kms-worker/tests/
KW_TREE=harness $S/heavy.sh build-B-v0.13.8 $S/kw.sh v0.13.8 build --test acl_real_chain
$S/heavy.sh real-v0.13.8 $S/run_real_chain.sh v0.13.8
# main (no DB change needed)
KW_TREE=harness $S/heavy.sh fetch-main $S/kw.sh main fetch
KW_TREE=harness $S/bg.sh build-A-main $S/kw.sh main build --lib --test acl
KW_TREE=harness $S/heavy.sh test-unit-main $S/kw.sh main test --lib -- event_processor::decryption::tests
KW_TREE=harness KW_DB=1 $S/heavy.sh test-acl-main $S/kw.sh main test --test acl -- --test-threads=1
cp $P/patch-main/crates/utils/src/tests/setup/host.rs   /srv/lifecycle/src/fhevm-main-harness/kms-connector/crates/utils/src/tests/setup/
cp $P/patch-main/crates/kms-worker/tests/acl_real_chain.rs /srv/lifecycle/src/fhevm-main-harness/kms-connector/crates/kms-worker/tests/
KW_TREE=harness $S/heavy.sh build-B2-main $S/kw.sh main build --test acl_real_chain
$S/heavy.sh real2-main $S/run_real_chain.sh main
# cleanup
docker stop lifecycle-pg && docker rm lifecycle-pg
```

## 9. Cleanup state and disk use (2026-10-21T07:04Z)

- **Stopped and removed:**
  - `lifecycle-pg`, stopped and removed. No `lifecycle-*` container, unit or process remains.
  - Ports 55432, 58545 and 58546 are closed.
  - The failed (OOM) scope record was cleared with `systemctl reset-failed`.
  - A leftover `tail -F` from my log monitor was killed.
- **Host:** `<live-service>` active; `MemAvailable` 7215 MB; load 0.42; no STOP marker.
- **Left in place:**
  - `/srv/lifecycle`: **12 GB** total
    - `target/v0.13.8` 5.3 GB, incl. about 2.7 GB of unused run-1 artifacts
    - `target/main` 3.3 GB
    - `.rustup` 1.2 GB
    - `.cargo` 1.0 GB
    - `src` 520 MB
    - `bin` 184 MB
    - `dl` 94 MB
    - `harness` 16 MB
    - `home` (solc) 15 MB
    - `runs` 376 KB
    - `logs` 584 KB
  - Root filesystem: 40 GB used of 96 GB (42%).
  - Outside `/srv/lifecycle`: the `postgres:17.5` image, 647 MB, in Docker storage.
  - `/srv/lifecycle/secrets` (mode 600) holds the last, now unused, Postgres password.

Raw material in `raw/vps/`:

- `logs/`:
  - `health.log`: every before/after/guard line plus the OOM note
  - one log per step: `build-*`, `test-*`, `real-*`, `fetch-*`
  - `final_state*.txt`
- `run2/runs/<ver>-<ts>/`:
  - `test.log`: full connector logs, ANSI-coloured
  - `host_rpc.jsonl`: raw recorder log
  - `acl_calls.txt`: decoded
  - `recorder.out`
- `run2/cargo-timings/`: cargo timing reports
- `run2/diffs/`: the harness patches
- `scripts/` and `harness_sol/`

## 10. Run 1 (05:09–05:38Z): stopped by the original guard

- **Setup:** `MemoryMax=3G`, `MemorySwapMax=1G`, `CARGO_BUILD_JOBS=2`, default debug info. These steps succeeded:
  - blobless clone (5 s)
  - toolchain install (52 s)
  - `cargo fetch` (26 s)
  - helper contracts (5 s)
- **What happened:**
  - The v0.13.8 test build compiled 513 crates in 772 s.
  - Then the other tenant's prover started `risczero/risc0-groth16-prover`, which reached 5.1 GB RSS.
  - At 05:37:15Z `MemAvailable` fell to 812 MB. My watchdog killed my scope; `<live-service>` stayed active.
  - Per the rules I stopped, removed `lifecycle-pg`, and reported.
- **Near-miss, no effect:** during run 1 I replaced `kw.sh` in place while it was running. The running bash was
  already at EOF, so nothing happened. Since then scripts are replaced only by atomic `mv`.
