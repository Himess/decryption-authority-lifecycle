# Level 1 (Profile H, signature hygiene on main): how to reproduce

**What Level 1 is.** Profile H of the draft, as local patches to Zama's main, in the four places the brief names:
- **the shared signature crate** `shared/user-decryption-signature`: caps before any read (H1), code-first ordering at
  one block with a narrow EIP-7702 shim (H2), the execution-gas budget (H3), at most two attempts a block apart (H4),
  and shadow rollout (H8);
- **the connector** (kms-worker): the configuration, final and typed retirement denials (H5, rule V7), refusing
  regular code on the ECDSA-only legacy path (H6), and the code-first check on the RFC-016 path;
- **the relayer and the SDK** prechecks: the same caps, budget and ordering (H9).

Everything is off by default; off, each component behaves as today with zero new RPCs.

| Part | Claim | Evidence level | Report |
|---|---|---|---|
| Crate | The code-first matrix on a real EVM; the budget (the ML-DSA-44 account accepted under B_exec 2M, refused at today's 250K); caps before any RPC; the attempt bound; a top-level out-of-gas counted as an empty revert | proven in mock (anvil, real accounts) | `PROFILE_H_CRATE.md` |
| Connector | Final `account_retired` denials, even after a simulated governance lapse; H6; the 7702 root key refused under `enforce`; shadow logging; off unchanged | proven in the real connector | `PROFILE_H_CONNECTOR.md` |
| SDK | The same caps, budget and ordering, on a real EVM through Zama's ethers adapter | proven in mock (anvil, real accounts) | `H9_PRECHECKS.md` |
| Relayer | The same caps, budget and ordering in the v3 pre-check | unit tests with a mocked provider on the VPS: 59/59 targeted, 281 passed overall (1 ignored upstream); Zama's `make clippy` and rustfmt clean | `H9_PRECHECKS.md` |
| H7, stored results | — | design only | — |

Measurements: `../RESULTS.md` §3.2, §3.4–3.5. The three limits apply: pre-emptive, not a clawback; oracle access
only; as final as the chain's governance.

---

## 1. The code

All on branch `lifecycle/level1` of the main clone, on top of Level 0 (`lifecycle/level0`):

| Commit | Content | Worktree where it was made |
|---|---|---|
| `f5e9356` | `profile_h.rs` and `lib.rs` in the shared crate | `impl/wt-l1-main` |
| `4541571` | `tests/profile_h.rs`: deterministic tests | `impl/wt-l1-main` |
| `aea7d37` | fix: a top-level out-of-gas counts as an empty revert (H4) | `impl/wt-l1-main` |
| `cce53bb` | the connector (kms-worker and kms-connector-api) | `impl/wt-l1-main` |
| `5b69260` | the SDK precheck (H9) | `impl/wt-l1-h9` |
| `0eec675` | the relayer pre-check (H9) | `impl/wt-l1-h9` |

`impl/wt-l1-main` now holds `lifecycle/level3-verifier` (Level 3's KDA route, built on `cce53bb`); `impl/wt-l1-h9`
holds `lifecycle/level1`.

**Patches:** `patches/level1/main/` (`git am` on top of Level 0). The series reproduces the branch's tree exactly.

## 2. The crate (M1)

```bash
CARGO_TARGET_DIR=impl/.tools/target-l1 cargo test --offline --locked \
  --manifest-path impl/wt-l1-h9/shared/user-decryption-signature/Cargo.toml

# the real-EVM matrix: build the test wallets and the CLI driver, then run
(cd experiments/contracts && FOUNDRY_ISOLATE=false forge build)
CARGO_TARGET_DIR=impl/.tools/target-udsig-h cargo build --release --offline --manifest-path impl/harness/level1/udsig-h/Cargo.toml
node impl/harness/level1/run_profile_h_local.mjs results/level1/raw
```

**Expected:** 15 (Zama's) + 20 tests; the matrix in `raw/L1_profile_h_local.json`, every RPC in
`raw/L1_profile_h_host_rpc.jsonl`. The ML-DSA-44 account uses E4's public local test seed and the Fireblocks verifier
(research code, unaudited).

## 3. The connector (VPS)

In the capped scope of `results/level0/README.md` §5, with the Level 1 tree `/srv/lifecycle/src/fhevm-main-l1`
(Zama main with the changed files copied in; `provenance.txt` lists them with their SHA-256):

```bash
# on M1: generate the test file from the Level 0 one, then copy it and the scripts in raw/vps/scripts/ to the VPS
python -I impl/harness/level1/make_profile_h_connector_tests.py .

# on the VPS
S=/srv/lifecycle/scripts
KW_TREE=l1 $S/bg.sh build-L1-main $S/kw.sh main build --test acl_profile_h_real_chain
$S/pg_up.sh
$S/bg.sh run-L1-main $S/run_level1.sh main
python3 -I $S/analyze_level1.py <the run directory>
docker rm -f lifecycle-pg
```

**Expected:** 4/4 tests, 27/27 requests as in `PROFILE_H_CONNECTOR.md` §2. Lint: `cargo clippy --locked --keep-going
-p kms-worker -p kms-connector-api --all-targets -- -D warnings` and `cargo fmt --check` pass. Raw data:
`raw/vps/main/`.

## 4. The SDK (M1)

```bash
node impl/harness/level2/link_deps.mjs impl wt-l1-h9          # junction to the main clone's SDK node_modules
(cd impl/wt-l1-h9/sdk/js-sdk && node node_modules/vitest/vitest.mjs run --config src/vitest.config.ts)
bash impl/harness/level1/sdk-h9/run_sdk_h9.sh                  # the precheck against real accounts on anvil
```

**Expected:** 910/910 unit tests; 4/4 on the local EVM, with `raw/L1_h9_sdk_real_evm.json`.

## 5. The relayer (VPS)

`/srv/lifecycle/scripts/run_l1h9_relayer.sh` builds the relayer from `/srv/lifecycle/src/fhevm-main-l1h9` (the
relayer, `shared/` and the two binding crates, with the changed files copied in) and runs its unit tests, clippy and
rustfmt. Details and results: `H9_PRECHECKS.md` §3.

## 6. Files

| Path | Content |
|---|---|
| `PROFILE_H_CRATE.md`, `PROFILE_H_CONNECTOR.md`, `H9_PRECHECKS.md` | the reports |
| `raw/` | the crate's real-EVM run, the SDK's run, the VPS runs (`raw/vps/`) |
| `harness/main/` | the connector test file |
| `impl/harness/level1/` | the scripts: `run_profile_h_local.mjs`, `udsig-h/`, `make_profile_h_connector_tests.py`, `sdk-h9/` |
