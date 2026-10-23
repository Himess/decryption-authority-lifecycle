# Level 0 (Core): how to reproduce

**What Level 0 is.** The Core of the Decryption Authority Lifecycle in Zama's host contracts: a one-way
`retireAccount()`, enforced in the ACL's authorization views for every role, with the upgrade guard. It is built on
both lines:
- **main:** ACL v0.7.0 → **v0.8.0** (reinitializer 9);
- **v0.13 line** (the deployed line): ACL v0.4.0 → **v0.4.1** (reinitializer 6).

**What it proves, and where the evidence is.**

| Part | Claim | Evidence level | Report |
|---|---|---|---|
| Contracts | Views false for a retired account in every role; grant paths revert; the engine exemption is not an export route; the upgrade guard; never-retired accounts behave exactly as before | proven in mock (Zama's Foundry and Hardhat setups) | `LEVEL0_CONTRACTS.md` |
| Cleartext mock | Zama's own cleartext mock honours retirement end to end, through the SDK | proven in mock | `MOCK_E2E.md` |
| Real connector | The **unmodified** kms-worker (v0.13.8 and main) forwards no request that rests on a retired account | proven in the real connector | `CONNECTOR_PROOF.md` |
| Baselines | The unmodified environment, and the SU-1 survey | measured | `ENV_BASELINE.md`, `VPS_CONNECTOR_BASELINE.md` |

Measurements: `../RESULTS.md` §2–3. The three limits apply: pre-emptive, not a clawback; oracle access only; as final
as the chain's governance.

---

## 1. The code

| Line | Clone | Branch | Commits | Patches (apply with `git am`) |
|---|---|---|---|---|
| main | `impl/fhevm-main` (Zama `ed851716c`, branch `lifecycle/base`) | `lifecycle/level0` | `0fbe9a6` ACL v0.8.0, `8e2cd34` tests, `5e61f3d` Hardhat version pin | `patches/level0/main/` |
| v0.13 | `impl/fhevm-v0.13.8` (tag `v0.13.8` = `fe3ca89b5`, branch `lifecycle/base`) | `lifecycle/level0` | `61be560` ACL v0.4.1, `e02d3e2` tests, `06d769f` Hardhat version pin | `patches/level0/v0.13.8/` |
| v0.13 mock | same clone | `lifecycle/level0-mock` | `228e85f` re-points the SDK's cleartext `ACL.sol` at v0.4.1 | `patches/level0/v0.13.8-mock/` |

**Rebuilding the branches from the patches,** in a fresh clone of `zama-ai/fhevm` (here the branches already exist).
`<P>` is the absolute path of `fhe-authority-lifecycle/patches`:

```bash
git checkout -b lifecycle/level0 ed851716c9a6b799996a23399ece2858336f96db      # main
git am <P>/level0/main/*.patch

git checkout -b lifecycle/level0-v013 fe3ca89b5111ca2b4abb220bf3c78417b821ceb5  # tag v0.13.8
git am <P>/level0/v0.13.8/*.patch
git checkout -b lifecycle/level0-mock
git am <P>/level0/v0.13.8-mock/*.patch
```

Each series was checked to reproduce its branch's tree exactly (`git apply --cached` on the base, then `write-tree`
equals the branch's tree). The older single-file diffs `contracts/level0/{main,backport-v0.13.8,mock-repoint}.patch`
hold the same changes.

## 2. Prerequisites

- **M1-like machine:** Windows 10 with Git Bash, or Linux. Foundry **1.8.5**, Node 22, Python 3. On M1, Foundry and
  Rust are off the default `PATH`; `impl/harness/lib/env.sh` prepends them.
- **Clone state:** each clone's `host-contracts/node_modules`, `host-contracts/dependencies` (soldeer) and generated
  `addresses/`, as Zama's CI prepares them (`ENV_BASELINE.md` §7).
- **Always `FOUNDRY_ISOLATE=false`.** Foundry 1.8.5 changed the `isolate` default, which breaks Zama's
  transient-storage tests (`ENV_BASELINE.md` §3.4).
- **Never port 8545** (another process owns it on M1). The scripts choose free local ports.

## 3. Contracts and tests (M1)

```bash
export PATH="$USERPROFILE/.foundry/bin:$PATH"

# Zama's CI provisions the bridge address on main before forge
(cd impl/fhevm-main/host-contracts && PROVISION_BRIDGE_PROXY=true HARDHAT_NETWORK=hardhat npm run deploy:emptyProxies)

# Foundry: the full suite, then the ACL folder (Zama's suites plus the new ones)
for L in main v0.13.8; do (cd impl/fhevm-$L/host-contracts && FOUNDRY_ISOLATE=false forge test); done
for L in main v0.13.8; do (cd impl/fhevm-$L/host-contracts && FOUNDRY_ISOLATE=false forge test --match-path 'test/acl/*'); done

# Hardhat: Zama's ACL and upgrade tests (production compile, OZ hardhat-upgrades validation)
for L in main v0.13.8; do (cd impl/fhevm-$L/host-contracts && npm_config_script_shell="$(which bash)" \
  HARDHAT_NETWORK=hardhat npx hardhat test test/acl/acl.ts test/upgrades/upgrades.ts); done

# OZ upgrades-core validate (U1 and the negative control)
bash impl/harness/level0/oz_validate.sh

# Gas: Foundry at 200 and 800 runs under Prague, Osaka and Amsterdam; anvil receipts; summaries
bash impl/harness/level0/gas_run.sh all
node impl/harness/level0/gas_summary.mjs "$(cygpath -m "$PWD/results/level0/raw")" > results/level0/raw/L0_gas_summary.md
node impl/harness/level0/amsterdam_estimate.mjs "$(cygpath -m "$PWD/results/level0/raw")" > results/level0/raw/L0_gas_amsterdam_estimates.md

# The unmodified OpenZeppelin cross-check (solc 0.8.27)
(cd impl/harness/level0/oz-unmodified-crosscheck && FOUNDRY_ISOLATE=false forge test)
```

**Expected:** 791/791 (main) and 569/569 (v0.13 line) for the full suites; 143/143 and 128/128 for `test/acl/*`;
11/11 and 10/10 for Hardhat. Zama's CI checks (`ci/upgrade-check`, `ci/abi-compat`) are in `LEVEL0_CONTRACTS.md` §7.
Logs go to `results/level0/logs/`, gas to `results/level0/raw/`.

## 4. Zama's cleartext mock, end to end (M1)

```bash
git -C impl/fhevm-v0.13.8 checkout lifecycle/level0-mock
bash impl/harness/level0-mock/run_mock_e2e.sh          # MOCK_PORT=18571 for a fixed port; never 8545
cat results/level0/raw/mock/M_summary.txt
```

It starts anvil on a free local port, deploys Zama's cleartext host stack with Zama's own script, runs the five
scenarios through the SDK and checks the worktree afterwards. **Expected:** 15/15, in about a minute. The mock proves
the views and the SDK flow, not confidentiality: plaintext is public in the mock.

## 5. The real connector (VPS)

The connector is built and run on the VPS, in the capped scope Semih approved (`/srv/lifecycle` only; `heavy.sh` caps
memory at 2,560 MB and CPU at 200%, at the lowest priority; `<live-service>` checked before and after every heavy step;
Postgres and anvil on 127.0.0.1 only).

1. Bootstrap the workspace as in `VPS_CONNECTOR_BASELINE.md` §8 (clone, worktrees, toolchains, `setup_harness_sol.sh`).
2. Copy the test files `results/level0/harness/{v0.13.8,main}/crates/kms-worker/tests/acl_retirement_real_chain.rs`
   into `/srv/lifecycle/src/fhevm-<ver>-harness/kms-connector/crates/kms-worker/tests/`, and the Level 0 ACL artifacts
   into `/srv/lifecycle/harness/level0/`.
3. Run:

```bash
S=/srv/lifecycle/scripts
$S/bg.sh build-L0-v0.13.8 $S/kw.sh v0.13.8 build --test acl_retirement_real_chain     # KW_TREE=harness
$S/pg_up.sh
$S/bg.sh run-L0-v0.13.8 $S/run_level0.sh v0.13.8
$S/bg.sh run-L0-main $S/run_level0.sh main
python3 -I $S/indep_check.py /srv/lifecycle/runs/latest-level0-<ver>
docker rm -f lifecycle-pg
```

`run_level0.sh` writes `provenance.txt` (the connector's production files byte-identical to Zama's), starts anvil and
the JSON-RPC recorder on 127.0.0.1, runs the tests with `--test-threads=1`, decodes every call and tears everything
down. **Expected:** 9/9 tests and 96 requests (v0.13.8), 17/17 and 222 (main), 0 KMS hits for every retired subject.
The scripts and raw records are in `raw/vps/level0/`.

## 6. Files

| Path | Content |
|---|---|
| `LEVEL0_CONTRACTS.md` | contracts, tests, upgrade matrix, gas, size, deviations |
| `MOCK_E2E.md` | the cleartext mock run |
| `CONNECTOR_PROOF.md` | the real-connector proof |
| `ENV_BASELINE.md`, `VPS_CONNECTOR_BASELINE.md` | the unmodified baselines, the SU-1 survey |
| `logs/`, `raw/` | every log and raw measurement |
| `harness/` | the connector test files and the harness diffs |
| `impl/harness/level0/`, `impl/harness/level0-mock/` | the scripts |
