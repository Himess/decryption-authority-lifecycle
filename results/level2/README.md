# Level 2 (continuity and applications): how to reproduce

**What Level 2 is.**
- **(a) E1, the successor:** ACL **v0.9.0** on main (reinitializer 10) and ACL **v0.4.2** on the v0.13 line
  (reinitializer 7). Designate, accept, wait D (7 days), confirm; after retirement the confirmed successor reads the
  retired account's handles through the existing delegated view.
- **(b) Profile A:** `FHE.isAccountRetired` for applications, and an OpenZeppelin ERC-7984 variant whose observer and
  operator grants refuse a retired account (TC23).
- **(c) The carry tool:** `impl/carry-tool/carry.mjs` enumerates OLD's grants, filters them, dry-runs, sends chunked
  `multicall`s that end with `retireAccount()`, and verifies.
- **(d) SDK hygiene:** a typed `ACCOUNT_RETIRED` refusal, `getAuthorityStatus`, a fresh transport key per request and
  a purge on retirement, in Zama's SDK source on both lines.

| Part | Evidence level | Report |
|---|---|---|
| E1 contracts and tests (TC17, TC18) | proven in mock (Foundry) | `LEVEL2_E1.md` §1–5 |
| E1 through the **unmodified** connector | proven in the real connector | `LEVEL2_E1.md` §6 |
| Profile A (TC23) | proven in mock (Foundry) | `PROFILE_A.md` |
| Carry tool | proven in mock (anvil) | `CARRY_TOOL.md` |
| SDK hygiene and the E1 scenario in Zama's cleartext mock | proven in mock | `SDK_HYGIENE_AND_MOCK.md` |
| Stored-result TTLs | design only | TARGET §3.11 |

Measurements: `../RESULTS.md` §2.4–2.5. The three limits apply: pre-emptive, not a clawback; oracle access only; as
final as the chain's governance.

---

## 1. The code

| Line | Worktree | Branch | Commits | Patches (`git am`) |
|---|---|---|---|---|
| main | `impl/wt-l2-main` | `lifecycle/level2` (on `lifecycle/level0`) | `50147ff` ACL v0.9.0 (E1), `a9748a6` E1 tests, `92a1806` Hardhat pin, `43db5ba` `FHE.isAccountRetired`, `02e484d` Profile A, `ea4e7a7` prettier, `bbec089` SDK hygiene, `c4482ab` disposed-key guard | `patches/level2/main/` |
| v0.13 | `impl/wt-l2-v0138` | `lifecycle/level2` (on `lifecycle/level0-mock`) | `70444e4` ACL v0.4.2 (E1 backport), `dee719f` tests, `33fef67` Hardhat pin, `588e639` prettier | `patches/level2/v0.13.8/` |
| v0.13 mock and SDK | `impl/wt-l2-mock` | `lifecycle/level2-mock` (on `lifecycle/level2`) | `9a3e5b1` mock ACL → v0.4.2, `b272882` SDK hygiene, `a3e6cbf` disposed-key guard | `patches/level2/v0.13.8-mock/` |

**Rebuilding from the patches** in a fresh clone: apply Level 0 first (`results/level0/README.md` §1), then

```bash
git checkout -b lifecycle/level2 lifecycle/level0          # main
git am <P>/level2/main/*.patch
git checkout -b lifecycle/level2-v013 lifecycle/level0-mock # v0.13 line
git am <P>/level2/v0.13.8/*.patch
git checkout -b lifecycle/level2-mock
git am <P>/level2/v0.13.8-mock/*.patch
```

`<P>` is the absolute path of `fhe-authority-lifecycle/patches`. Each series reproduces its branch's tree exactly.

**The worktrees reuse the clones' dependencies** (node_modules, soldeer `dependencies/`) through junctions, and copy
the generated files they rewrite:

```bash
node impl/harness/level2/link_deps.mjs impl                 # or: ... impl wt-l2-main
```

## 2. E1 (M1, then the VPS)

```bash
# Foundry, both lines (always FOUNDRY_ISOLATE=false)
(cd impl/wt-l2-main/host-contracts && FOUNDRY_ISOLATE=false forge test --match-path 'test/acl/*')
(cd impl/wt-l2-v0138/host-contracts && FOUNDRY_ISOLATE=false forge test --match-path 'test/acl/*')

# Gas: production artifacts (solc 0.8.24, 800 runs, cancun), then anvil receipts
FOUNDRY_OPTIMIZER_RUNS=800 FOUNDRY_ISOLATE=false forge build --root impl/wt-l2-main/host-contracts \
  --out impl/.tools/build/main-l2-runs800 --cache-path impl/.tools/build/main-l2-runs800-cache
node impl/harness/level2/anvil_gas_e1.mjs impl/wt-l2-main/host-contracts impl/.tools/build/main-l2-runs800 prague 18631 results/level2/raw/L2_gas_anvil_main_prague.json

# The connector artifacts and test files for the VPS
bash impl/harness/level2/build_vps_acl_artifacts.sh
python -I impl/harness/level2/make_successor_tests.py .
```

**Expected:** 188/188 (main) and 173/173 (v0.13 line). OZ `validate` and Zama's CI upgrade check: the commands are in
`raw/L2_oz_validate_*.log` and `raw/L2_upgrade_version_check_*.log`.

**The connector (VPS),** with the Level 0 harness and the same capped scope (`results/level0/README.md` §5): copy
the generated `harness/{v0.13.8,main}/crates/kms-worker/tests/acl_successor_real_chain.rs` and the ACL artifacts
to the VPS, then

```bash
S=/srv/lifecycle/scripts
$S/bg.sh build-L2-<ver> $S/kw.sh <ver> build --test acl_successor_real_chain       # KW_TREE=harness
$S/pg_up.sh
$S/bg.sh run-L2-<ver> $S/run_level2.sh <ver>
python3 -I $S/indep_check_l2.py /srv/lifecycle/runs/latest-level2-<ver>
```

**Expected:** 8/8 requests on v0.13.8 and 13/13 on main; the connector's production files byte-identical to Zama's.

## 3. Profile A (M1)

```bash
(cd impl/wt-l2-main/host-contracts && FOUNDRY_ISOLATE=false forge test --match-path test/acl/ACLRetirementProfileA.t.sol -vv)
```

**Expected:** 15/15, also under Foundry's default isolation. The vendored OpenZeppelin files are generated by
`impl/harness/level0/port_oz_erc7984.py` (the observer extension included).

## 4. The carry tool (M1)

```bash
forge build --root impl/harness/level2/carry
node impl/harness/level2/carry_e2e.mjs impl/.tools/build/main-l2-runs800 impl/harness/level2/carry/out osaka 18671 results/level2/raw/L2_carry_e2e_osaka.json
```

`impl/.tools/build/main-l2-runs800` is the production ACL build of `LEVEL2_E1.md` §7. The run covers the dry run,
the refusals, an injected failure with a resume, and the gas table for k = 0 … 500. The tool itself:

```bash
node impl/carry-tool/carry.mjs --help
```

## 5. SDK hygiene and the E1 scenario in Zama's cleartext mock (M1)

```bash
bash impl/harness/level2-mock/run_mock_e2e_l2.sh
(cd impl/wt-l2-mock/sdk/js-sdk && node node_modules/vitest/vitest.mjs run --config src/vitest.config.ts)
(cd impl/wt-l2-main/sdk/js-sdk && node node_modules/vitest/vitest.mjs run --config src/vitest.config.ts)
```

**Expected:** 7/7 scenario tests; 914/914 (v0.13 line) and 918/918 (main) SDK unit tests.

## 6. Files

| Path | Content |
|---|---|
| `LEVEL2_E1.md`, `PROFILE_A.md`, `CARRY_TOOL.md`, `SDK_HYGIENE_AND_MOCK.md` | the reports |
| `raw/` | logs, gas JSON, the carry runs, the mock runs (`raw/mock/`), the VPS runs (`raw/vps/`) |
| `harness/` | the connector test files |
| `impl/harness/level2/`, `impl/harness/level2-mock/`, `impl/carry-tool/` | the scripts and the tool |
