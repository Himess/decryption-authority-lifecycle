# Clean re-runs of the unmodified-tree connector evidence (D120)

Date: 2026-10-23. Proof class: Connector [M] (VPS, Zama's real kms-worker against the Level 0 registry on a local
anvil, in the capped scope).

## Why

On the VPS, every `main`-line worktree (the unmodified harness tree, Levels 1, 3 and 5) was built into one Cargo
target directory. Cargo names a path package's artifacts by its path relative to the workspace and judges them fresh by
file times, so a worktree whose files are older than another worktree's build into the same directory can link that
build's crates (D120 gives the experiment and the assessment). The Level 1 series changes no Cargo manifest, so the
unmodified tree and the Level 1 tree name their crates alike. The unmodified-tree runs built after the Level 1 tree
could therefore have linked Level 1's shared crates, which keep the unmodified default path and add to it. These runs
are:

| Evidence | Phase, task | Committed runs |
|---|---|---|
| TC13: retirement under host-chain faults | Phase 4, P0.1 | `results/phase4/raw/p01/tc13-main-r{1,2,3}-*` |
| TC14: decision lag, the race, a reorg, a restart | Phase 4, P0.2 | `results/phase4/raw/p02/p02-main-r{1,2,3}-*` |
| Stored results served after retirement | Phase 4, P0.3 | `results/phase4/raw/p03/runs/p03-main-r{1,2,3}-*` |
| EIP-7851, simulated | Phase 4, P0.4 | `results/phase4/raw/p04/p04-main-r{1,2,3}-*` |
| EIP-8298, simulated | Phase 5, P0.3 | `results/phase5/raw/p503/vps/p503-main-r{1,2,3}-*` |
| Zama's kms-worker suite on the unmodified tree | Phase 4, P1.1 | `results/phase4/raw/p11/zama-suites/zama-kms-worker-harness{,-r2}.log` |

## How

- **An isolated build.** `impl/harness/phase5/vps/chain_recheck_harness.sh` builds into a new target directory
  (`KW_TARGET_DIR`, which `kw.sh` now accepts), into which only the unmodified harness tree is ever built. The five
  test files on the VPS have the hashes of the committed copies (`results/phase4/harness/main/…`,
  `results/phase5/harness/main/…`). The endpoint binary the stored-result runs start is rebuilt there too.
- **Which tree each crate came from.** The chain logs every path crate the builds and the runs compiled, with its tree:
  `ciphertext-attestation`, `connector-utils`, `endpoint`, `fhevm_gateway_bindings`, `fhevm_host_bindings`,
  `kms-connector-api`, `kms-worker` and `user-decryption-signature`, all from `fhevm-main-harness`; the runs compiled
  `kms-worker` again, from the same tree; round 3 compiled nothing.
- **Three rounds**, as the brief asks of connector harnesses (rounds 1 and 2 in that chain, round 3 in
  `chain_recheck_harness_r3.sh`), then the suite once. The raw runs are in `raw/recheck-harness/runs/` and the logs in
  `raw/recheck-harness/logs/`; both went through the raw scrub and secret scan (`SCAN_REPORT.txt`: 0 hits).
- **Row by row.** `impl/harness/phase5/compare_recheck.py` names each row by its label without the run id and compares
  every run on both sides. P0.3's analyzer (`analyze_p503.py`) is run on the re-runs too, to compare the recorded
  host-chain answers (`eth_getCode`, `isValidSignature`); `compare_zama_suites.py` compares the suite test by test.

## Results

| Evidence | Rows | Outcome in every committed run and every re-run | Other fields |
|---|---|---|---|
| TC13 (198 cases, each logging an `L0-RESULT` and a `TC13-RESULT` line) | 396 | the same, 396 of 396 | 4 rows logged an error code the committed runs did not (see below) |
| TC14 | 7 | the same, 7 of 7 | the same |
| Stored results | 4 | the same, 4 of 4 | the same |
| EIP-7851 | 20 | the same, 20 of 20 | the same |
| EIP-8298 | 18 | the same, 18 of 18 | the same |

- **The 4 TC13 rows** are two cases, each with its two lines: the `drop` and `revert-nodata` faults on the v2 HTTP path
  for an allowed subject. Some re-runs logged no error code (`-`) where every committed run logged
  `upstream_transient`; the outcome is the same. The error code a fault leaves depends on its timing. The committed
  runs already differ from each other on 14 rows (7 cases): on 12 between `-` and `upstream_transient`, on 2 between
  `-` and `acl_denied`. The re-runs differ from each other on 6 rows (3 cases), all between `-` and
  `upstream_transient`.
- **EIP-8298's host-chain answers** (`raw/recheck-harness/P503_MAIN_RECHECK.md`): the analyzer's table equals the
  committed one row for row; 9 of 9 rows conform in three runs, and the proxy rewrote no answer. Only the adopted code's
  hash differs, in the committed runs as in the re-runs: the wallet's code holds as immutables its verifier's address,
  the address of its public-key blob (random in each run) and its key's hash. Its length, 1,218 bytes, is the same in
  every run.
- **Zama's kms-worker suite** (`raw/recheck-harness/ZAMA_SUITE_HARNESS.md`): 122 passed and 40 failed, as in both
  Phase 4 runs; no test changes status. The 40 are the tests D27 explains: they start a container, and none may run
  here.

**Conclusion.** Every committed outcome of the unmodified kms-worker is reproduced by a build that contains nothing but
the unmodified tree. The claims that rest on these runs stand as written.
