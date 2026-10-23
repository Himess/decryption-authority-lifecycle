# P1.1: E3 in the connector, K8, ACVP and Wycheproof (TC20)

**Proof class:**
- **Connector:** the kms-worker against a local EVM, on the VPS;
- **Mock:** the verifier crate and the share simulation, on M1.

**Status:** done. **Date:** 2026-10-21/22.

**Machines:**
- **M1:** AMD Ryzen 5 5600, Windows 10 Pro 19045, rustc 1.95.0, anvil 1.8.5;
- **VPS:** the capped scope (`MemoryMax=2560M`, `CPUQuota=200%`, nice 19, idle I/O class), rustc 1.99.1, anvil 1.3.5.

**Raw data:** `raw/p11/`.

## 1. What was built

| Branch (worktree) | Commit | Content |
|---|---|---|
| `lifecycle/level3-verifier` (`impl/wt-l1-main`) | `a8e1f34` | Phase 3: the E3 KDA route in the shared crate `user-decryption-signature` |
| | `538dc88` | **K8.** Three more ML-DSA implementations behind features (`kda-fips204`, `kda-libcrux`, `kda-pqclean`; `k8` for all), `K8Mode` (`single:<library>`, `agree:<a>,<b>`), `verify_with_impl`, `verify_with_kda_k8`, a test-only fault switch (`k8-fault-injection`), the vector tests |
| `lifecycle/level3-connector` (`impl/wt-l3-conn`) | `a15aaa6` | The base: Level 1 with H7 and persistent H4 (P0.3) |
| | `40a4bce`, `c222fc3` | The crate's E3 and K8 (cherry-picks) |
| | `564d7d1` | **E3 in the kms-worker** (details below) |

**E3 in the kms-worker (`564d7d1`):**
- **Settings:** `profile_h.kda_schemes`, empty by default, so E3 is off; and `profile_h.kda_k8_mode`, default `single:rustcrypto`. An invalid or absent library stops the worker at startup.
- **Route order:** `verify_user_signature` takes the route before Profile H.
- **Owners:** read from the request's handle entries.
- **Logs:** each request logs its verdict (`E3 KDA accepted`, `E3 KDA rejected`, `E3 K8 DISAGREEMENT`, `E3 KDA route not taken skip=…`) and its check time.

**How the worker decides, with E3 enabled:**
1. **Route selection (K5), at the decision block.** The KDA has no code. The signature is not 65 bytes and decodes as `abi.encode(bytes, bytes)`. The derived KDA equals the requester. Every owner differs from the requester. The scheme is enabled.
2. **The route is taken.** The worker verifies natively (K6: pure ML-DSA, empty context) under the K8 mode:
   - **Acceptance:** the request goes on to the ACL views (V1), with the KDA as the delegate.
   - **Failure:** an irrecoverable `UserSignatureRejected`, with no fallback.
   - **Disagreement** (agree mode only): an error log, then the same refusal.
3. **The route is not taken.** Profile H runs as before, and the skip reason is logged.

## 2. The libraries (K7, K8)

None of these libraries has a completed security audit for this use. The ERC lists them under "Unaudited libraries".

| Library | Version | Kind | Audit status, as published | ACVP interfaces it exposes |
|---|---|---|---|---|
| RustCrypto `ml-dsa` | 0.1.1 | pure Rust | never independently audited (its README) | external/pure, internal, internal with external mu |
| `fips204` | 0.4.6 | pure Rust | its README calls it experimental, at your own risk | external/pure, part of external/pre-hash |
| Cryspen `libcrux-ml-dsa` | 0.0.10 (portable) | Rust | field arithmetic, NTT and serialization formally verified (hax, F*); no published audit found | external/pure, internal, part of external/pre-hash |
| PQClean `clean`, via `pqcrypto-mldsa` | 0.1.2 (no AVX2) | C behind Rust bindings | no audit found | external/pure |
| `dilithium-py` | vendored in `evm-ml-dsa-verifier` `cca262b5` (`pythonref`) | pure Python | not audited | used only as an independent test signer (`impl/harness/phase4/p11_mldsa_tool.py`) |

Every version is pinned exactly (`=`) in the crate's `Cargo.toml`, and the lockfile is committed. `libcrux-ml-dsa` 0.0.10 was chosen over 0.0.11 for its age (D20).

## 3. Vectors (K7) [M]

**Sources** (`shared/user-decryption-signature/tests/vectors/PROVENANCE-K8.md`; the tests check each SHA-256):

| File | Commit | SHA-256 |
|---|---|---|
| NIST ACVP-Server `ML-DSA-sigVer-FIPS204/internalProjection.json` (180 tests) | `a7f283cd` (2026-07-31) | `47cdd6314c7f746d…` |
| C2SP Wycheproof `mldsa_44_verify_test.json` (180) | `20b25694` (2026-10-12) | `f70759c95146ff30…` |
| `mldsa_65_verify_test.json` (210) | same | `1ca235f61928421a…` |
| `mldsa_87_verify_test.json` (241) | same | `54adffe10f6dad79…` |

**Method.** Each implementation runs every vector whose interface it exposes (D21). There are no failures. "Not exposed" means the library has no entry point for that interface.

The pass counts below were identical in three runs (`raw/p11/crate/r{1,2,3}.txt`, `538dc88`). Cells are pass/run over all three parameter sets; the not-exposed count is in brackets.

| Interface | RustCrypto | fips204 | libcrux | PQClean |
|---|---|---|---|---|
| ACVP external/pure (the route's interface) | **45/45** | **45/45** | **45/45** | **45/45** |
| ACVP external/pre-hash | 0/0 (45) | 11/11 (34) | 3/3 (42) | 0/0 (45) |
| ACVP internal | 45/45 | 0/0 (45) | 45/45 | 0/0 (45) |
| ACVP internal, external mu | 45/45 | 0/0 (45) | 0/0 (45) | 0/0 (45) |
| **ACVP total** | **135/135** | **56/56** | **93/93** | **45/45** |
| **Wycheproof** (pure; 8 per file with a context) | **631/631** | **631/631** | **631/631** | **631/631** |

**Cross-check with an independent signer.** For each of ML-DSA-44, -65 and -87, `dilithium-py` signed a test message (`raw/p11/xcheck/xcheck_M1.txt`, `538dc88`):
- all four libraries accept the signature;
- all four refuse it against the same message with one bit flipped.

That is 12/12 and 12/12, with 0 failures.

**The crate's whole suite: 52/52, three runs** (`impl/harness/phase4/run_p11_crate.sh`, all features, clean `538dc88`):

| Tests | Count |
|---|---|
| Library unit tests | 15 |
| K8 | 5 |
| Vectors | 1 |
| KDA route | 11 |
| Profile H | 20 |

## 4. K8, implementation diversity [M]

**The agree mode.** A fault is injected into one library: a switch makes it accept every well-sized key and signature. Every pair that includes that library refuses the forgery as a disagreement, and the error names the library that accepted. That is 36/36 cases (4 faulty libraries × 3 pairs × 3 parameter sets). Without a fault, every mode gives the same verdicts.

**The single mode.** The faulty library accepts the forgery and the other three refuse it. K8 must therefore bound how many nodes use one library.

**13 nodes, t = 4.** The crate's test assigns libraries to 13 nodes and records which nodes accept the forgery. `impl/harness/phase4/k8_sim.py` then checks whether those nodes' shares reconstruct the secret, using real Shamir shares over GF(2^127 − 1) with Phase 3's `profile_q_sim.py`.

Results, run on the clean crate run (`raw/p11/crate/k8_sim_r1.json`), identical to the earlier run:

| Assignment | K8 rule met | Most nodes accepting a forgery | Forgeries that decrypt (of 12) |
|---|---|---|---|
| One library per node, 4-3-3-3 | yes | 4 | **0** |
| 5-3-3-2 (rule broken) | no | 5 | **3** (the 5-node library faulty, each parameter set) |
| Agree mode, rotating pairs | — | 0 | **0** |

With n = 13 and t = 4, the one-library-per-node mode needs at least ⌈13/4⌉ = 4 libraries (`k8_min_implementations`). That is why four were integrated (D19).

## 5. TC20 in the connector [Connector]

**Setup.** The P1.1 harness tests are generated by `impl/harness/phase4/make_p11_tests.py`:
- `results/phase4/harness/main-l3/crates/kms-worker/tests/acl_p11_e3_h.rs`, on the Level 3 worker;
- `results/phase4/harness/main/crates/kms-worker/tests/acl_p11_e3.rs`, on the unmodified worker (`ed851716c`).

**The test environment.** Each worker runs against a local anvil on the VPS:
- the lifecycle ACL (main Level 0, `ACL v0.8.0`), so that retirement exists;
- every RPC through the recording proxy;
- the connector endpoint as its own process, for HTTP rows;
- a KMS mock: 4 hits mean the request was forwarded.

**The signers.** ML-DSA keys come from public test seeds through `dilithium-py`; ECDSA keys are test keys.

**Runs:**
- **Level 3:** 3 runs × 35 rows (r4–r6). Runs r1–r3 failed only on the HTTP error-code check and are kept as superseded (D25).
- **Unmodified:** 6 runs × 4 rows.

**Every row has the same outcome in every run.** Table: `p11/P11_TABLE.md` (generated by `analyze_p11.py`).

| Brief item | Rows | Result |
|---|---|---|
| KDA requests, each scheme | `kda44.valid`, `kda44.valid.http`, `kda65.valid`, `kda87.valid` | forwarded; `E3 KDA accepted`; one `eth_getCode`, no `isValidSignature` |
| Both K8 modes | `single-rustcrypto`, `single-fips204`, `single-libcrux`, `single-pqclean`, `agree-libcrux-pqclean`, and the default `agree:rustcrypto,fips204` | forwarded |
| Retiring the account disables KDA requests | `kda65.retired`, `kda87.retired.http` | refused, final at the first attempt; HTTP `account_retired` |
| Revoking the KDA delegation disables them | `kda44.revoked` | the signature verifies, the delegated view refuses; retried to the limit like any ACL denial |
| A KDA is refused as a direct owner | `kda44.direct-owner`, `.http` | route not taken (`DirectEntry`); Profile H refuses; HTTP `user_signature_rejected` |
| No fallback when the PQ signature fails | `kda44.other-digest`, `kda87.other-digest`, `kda44.other-digest.http` | refused (`signature does not verify`); **no `isValidSignature` call** |
| The unmodified worker fails closed | unmodified `kda44.valid`, `.http`, `kda65.valid` | refused; it recovers no ECDSA signer, then calls `isValidSignature` on an address without code, which returns nothing. An ordinary ECDSA request is forwarded |
| K5: a KDA with code | `kda44-with-code` | route not taken (`RequesterHasCode`); Profile H's ERC-1271 path refuses it. One `isValidSignature` call: H4's second attempt needs a later block, and the request ended after the worker's three attempts |
| K5: a 65-byte signature | `kda44.ecdsa-65` | refused (Profile H, final); no `isValidSignature` |
| K5: a mismatched KDA | `kda44-signer.kda65-requester` | route not taken (`OtherRequester`); refused |
| K5: an owner equal to the requester | `kda44.direct-owner` | as above |
| K5: a disabled scheme | `kda65.scheme-disabled` | route not taken (`SchemeNotEnabled`); refused |
| E3 off, and Profile H off | `kda44.route-off`, `kda44.profile-h-off` | refused |
| K8 with a fault in `fips204` | `k8-fault-fips204.kda44.forged.{single-fips204, agree-rustcrypto-fips204, single-rustcrypto}` | forwarded in `single:fips204` (what K8's assignment must bound); **refused as a disagreement** in `agree:rustcrypto,fips204`; refused in `single:rustcrypto` |
| The ML-DSA-44 ERC-1271 account (TC21, P1.6) | `erc1271.mldsa44-account.direct.{1,2,3}` | forwarded; `isValidSignature` at gas 2,183,048 |

**One harness note.** In unmodified run r4, the HTTP row's error code reads "-": the harness read the row before the code was written. The outcome (refused, 0 KMS hits) matches the other five runs, which all read `user_signature_rejected`.

## 6. K12: no signature-relayed delegation path [code reading]

I read the ACL source at four refs: unmodified `main` (`ed851716c`), `lifecycle/level0`, `lifecycle/level3-connector` and `lifecycle/level3`.

**The delegation store is written only by the delegator's own transaction:**

| Function (unmodified `main`, `ACL.sol`) | Lines | Key |
|---|---|---|
| `delegateForUserDecryption` | 326, 332 | `msg.sender` |
| `revokeDelegationForUserDecryption` | 386, 388 | `msg.sender` |

**What none of the four refs has:**
- no other write;
- no ERC-2771 context or trusted forwarder;
- no `_msgSender` override;
- no signature check in the unmodified ACL.

`decryptionSignatureInvalidatedBefore` is only a timestamp that the caller sets for itself.

**Our Level 3 branch** (`lifecycle/level3`, E2) adds the only relayed signature: `retireAccountWithSig`, the E2 certificate.
- It retires the account. That disables every KDA signer at once (K3, R6).
- It writes no delegation, and it designates, confirms and grants nothing.

**K12 holds on `main`.** The ERC's K12 now says this exactly. It used to say that the ERC defines no signature-relayed path for "clearing" a signer, but the E2 certificate does clear every signer, through retirement.

## 7. Zama's own kms-worker suite on Levels 1 and 3 [Connector]

**What ran.** The library and its eight test targets, `--no-fail-fast`, one thread, through `heavy.sh`. Docker is unreachable for the tests (D27).

| Tree | Pass 1 (2026-10-21) | Pass 2 (2026-10-21) |
|---|---|---|
| Unmodified harness tree (baseline) | 122 passed, 40 failed, 0 ignored (352 s) | 122 passed, 40 failed, 0 ignored (252 s) |
| Level 1 (`lifecycle/level1`) | 122 passed, 40 failed (498 s) | 122 passed, 40 failed (471 s) |
| Level 3 (`lifecycle/level3-connector`) | 122 passed, 40 failed (446 s) | 122 passed, 40 failed (467 s) |

**The failures are the environment's.** The 40 failing tests are the same on every tree and in both passes, and each fails with "Socket not found". They are the tests that start a testcontainers S3 server, whose image is in a private registry. No test fails only on our trees.

**The live service** (`<live-service>`) was active before and after every step. No step was frozen or killed, and no container was left behind (`raw/p11/zama-suites/`).

## 8. Latency [M]

**The bench.** `impl/harness/phase4/p11-latency` (D26) calls the crate's entry points directly against a local anvil:
- 200 iterations after 3 warm-up calls, three runs per machine;
- the same source on both machines, built against `lifecycle/level3-connector` `564d7d1`; the crate files are byte-identical on M1, in git and on the VPS;
- "RPCs" counts the host reads in each check.

Cells are p50 in µs, run 1 / run 2 / run 3.

| Check | RPCs | M1 | VPS (capped scope) |
|---|---|---|---|
| ECDSA, unmodified ordering (ecrecover only) | 0 | 180 / 180 / 187 | 372 / 379 / 350 |
| ECDSA, Profile H `enforce` (code read, then ecrecover) | 2 | 466 / 467 / 480 | 3,560 / 3,434 / 3,349 |
| ERC-1271, ML-DSA-44 account, unmodified 250,000 gas (refused) | 1 | 631 / 633 / 631 | 3,247 / 3,685 / 2,846 |
| ERC-1271, ML-DSA-44 account, Profile H `B_exec` 2,000,000 | 3 | 2,737 / 2,737 / 2,700 | 10,885 / 12,517 / 10,516 |
| **KDA ML-DSA-44, `single:rustcrypto`** | 1 | **242 / 245 / 247** | 2,202 / 2,712 / 1,781 |
| **KDA ML-DSA-44, `agree:rustcrypto,fips204`** | 1 | **337 / 341 / 340** | 2,662 / 2,038 / 1,740 |
| KDA ML-DSA-65, single / agree | 1 | 294–300 / 449–450 | 1,838–2,287 / 2,615–3,360 |
| KDA ML-DSA-87, single / agree | 1 | 380–420 / 633–641 | 1,609–3,509 / 3,021–4,122 |

**Native verification alone** (p50, µs, the same in each of three runs within a few µs on M1):

| Parameter set | RustCrypto | fips204 | libcrux | PQClean |
|---|---|---|---|---|
| ML-DSA-44, M1 | 80 | 86 | 31 | 85 |
| ML-DSA-65, M1 | 124 | 142 | 54 | 138 |
| ML-DSA-87, M1 | 203 | 235 | 86 | 232 |
| ML-DSA-44, VPS | 161–177 | 150–180 | 61–69 | 141–176 |

**Reading the numbers:**
- **On M1, the ML-DSA-44 KDA route took about half the time of ECDSA under Profile H, and about a tenth of the ERC-1271 path.** The route reads the requester's code once and then verifies natively; Profile H's ECDSA path makes two reads. The agree mode adds one more native verification, about 95 µs at ML-DSA-44. At ML-DSA-87 the agree mode (about 635 µs) takes longer than ECDSA under Profile H.
- **On the VPS, every RPC costs milliseconds, with a wide spread.** The bench and its anvil share the capped, low-priority scope (two CPUs at nice 19, next to the live service). Native verification is about twice M1's time. For ML-DSA-44 the ordering is the same on both machines: native verification < KDA route < ECDSA under Profile H < ERC-1271 at `B_exec`.
- **Production adds the RPC distance.** Each read on these paths is one round trip to the host-chain node. The KDA route needs one; Profile H's ECDSA path needs two.
- **The connector's own `sig_check_us` is not a latency figure.** It is harness time, with every RPC through the Python recorder (D26; `p11/P11_TABLE.md`).

Raw: `raw/p11/latency/{M1,VPS}_r{1,2,3}.{json,txt}`, and `VPS_build_and_runs.log`.

## 9. What this does not show

- **No library is audited** (section 2). K8 bounds a bug in one library: with the agree mode, or with no library on more than t nodes. It does not bound a mistake that every library shares; the vectors are the check for that.
- **The fault switch is crude.** It accepts every well-sized signature in one library. A real bug might be narrower, but it is bounded the same way.
- **One worker ran, not 13.** The 13-node figures come from the crate's assignment test and the share simulation.
- **K11 still applies.** E3 applies only where the verifier checks the request signature itself. The paths where another component checks an ECDSA signature are out of scope.
- **Not tested:** SLH-DSA (not enabled anywhere) and FN-DSA (not final).

## Evidence

| What | Where |
|---|---|
| Crate runs (52 tests, vectors, K8 lines) | `raw/p11/crate/r{1,2,3}.txt`; share check `raw/p11/crate/k8_sim_r1.json` |
| Earlier crate run (uncommitted K8 tree, superseded by the above, same counts) | `raw/p11/k8_crate_M1.txt`, `raw/p11/k8_sim.json` |
| Cross-check with dilithium-py | `raw/p11/xcheck/` |
| Connector runs | `raw/p11/runs/p11-main-l3-r{4,5,6}-*`, `raw/p11/runs/p11-main-r{1..6}-*`; logs `raw/p11/logs/`; superseded `raw/p11/superseded-error-code-check/` |
| Table | `p11/P11_TABLE.md`, `.json` |
| Zama's suite | `raw/p11/zama-suites/` |
| Latency | `raw/p11/latency/` |

## Reproduction (from `fhe-authority-lifecycle/`)

```bash
bash impl/harness/phase4/run_p11_crate.sh r1
python -I impl/harness/phase4/k8_sim.py results/phase4/raw/p11/crate/r1.txt results/phase4/raw/p11/crate/k8_sim_r1.json
python -I impl/harness/phase4/analyze_p11.py results/phase4
```

On the VPS:
- `scripts/chain_p11b.sh` (connector runs);
- `scripts/chain_zama_suites.sh` (Zama's suite);
- `scripts/heavy.sh p11-latency scripts/run_p11_latency.sh`.
