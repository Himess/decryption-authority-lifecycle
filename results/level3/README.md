# Level 3 (PQ-native authority, Q-day, certificate, governance): how to reproduce

**What Level 3 is** (prototypes, as the brief allows):
- **E2, the retirement certificate:** ACL **v0.10.0** on main with `retireAccountWithSig` (reinitializer 11), and a
  watchtower that relays a pre-signed certificate when it sees a compromise signal.
- **The governance profile:** an OpenZeppelin `TimelockController` owning the ACL (and through it the executor), the
  upgrade guard through the timelock, and an operator canary with implementation pinning.
- **E3, the declared decryption signer:** the KDA route in Zama's shared signature crate (native ML-DSA, behind the
  off-by-default `kda` feature).
- **Profile Q:** a share-collection simulation (n = 13, t = 4), and the on-chain door as an asserted residual (TC22).
- **Native PQ verification:** the deliberation agent A5's benchmark, rerun.

| Part | Evidence level | Report |
|---|---|---|
| E2 (TC19, TC24), U9 | proven in mock (Foundry) | `LEVEL3.md` §1.1–1.3 |
| Watchtower on three chains | proven in mock (three anvil chains) | `LEVEL3.md` §1.4 |
| Governance (timelock, guard, canary, pinning) | proven in mock (Foundry, anvil) | `LEVEL3.md` §2 |
| E3 route (crate) | proven in mock (crate tests, Wycheproof) | `LEVEL3.md` §3 |
| E3 in the connector; the oracle-level parts of TC20 | design only | — |
| Profile Q rule and cliff (TC16); the on-chain door (TC22) | proven in mock (simulation; Foundry) | `LEVEL3.md` §4 |
| Profile Q as a connector policy; PQ-signed operator statements; the readiness KPI | design only | — |
| PQ governance | design only | TARGET §4.4 (d) |

Measurements: `../RESULTS.md` §2.6, §3.3, §3.6–3.7 and §4. The three limits apply: pre-emptive, not a clawback;
oracle access only; as final as the chain's governance.

---

## 1. The code

| Part | Worktree | Branch | Commits | Patches (`git am`) |
|---|---|---|---|---|
| Contracts (main) | `impl/wt-l2-main` | `lifecycle/level3` (on `lifecycle/level2`) | `5cd12ed` ERC-165 fuzz exclusions, `3d08580` ACL v0.10.0 (E2), `0d02f3e` certificate tests, `53f389d` governance tests, `f1b440e` TC22 | `patches/level3/main/` |
| Verifier (main) | `impl/wt-l1-main` | `lifecycle/level3-verifier` (on `cce53bb`, the Level 1 connector commit) | `a8e1f34` the KDA route and its tests | `patches/level3/verifier/` |

Rebuilding in a fresh clone: apply Level 0 and Level 2 first for the contracts, and Level 0 plus the first four Level 1
patches (up to `cce53bb`) for the verifier; then `git am <P>/level3/main/*.patch` or `<P>/level3/verifier/*.patch`.
Each series reproduces its branch's tree exactly.

**Our own tools** (in this project, not in Zama's code): `impl/watchtower/watchtower.mjs`, `impl/canary/canary.mjs`,
`impl/bench-pq/a5_native_verify/`, and the harnesses in `impl/harness/level3/`.

## 2. Foundry: E2, governance, TC22 (M1)

```bash
FOUNDRY_ISOLATE=false forge test --root impl/wt-l2-main/host-contracts
```

**Expected:** 874/874, including 13 certificate tests, 6 governance tests, 2 TC22 tests and the U9 upgrade step.

**Release checks and the production build** (OZ `validate`, Zama's CI upgrade check against `lifecycle/level2`, the
800-run build the anvil harnesses use):

```bash
bash impl/harness/level3/release_checks.sh
```

The anvil harnesses need artifacts built from inside `host-contracts`; a build through `--root` from another directory
can miss new files.

## 3. anvil harnesses (M1)

```bash
node impl/harness/level3/watchtower_e2e.mjs impl/.tools/build/main-l3-runs800 18681 results/level3/raw/L3_watchtower_e2e.json
node impl/harness/level3/anvil_gas_e2.mjs impl/.tools/build/main-l3-runs800 prague 18691 results/level3/raw/L3_gas_anvil_e2_prague.json
node impl/harness/level3/anvil_gas_e2.mjs impl/.tools/build/main-l3-runs800 osaka 18693 results/level3/raw/L3_gas_anvil_e2_osaka.json
node impl/harness/level3/canary_e2e.mjs impl/.tools/build/main-l3-runs800 18695 results/level3/raw/L3_canary_e2e.json
```

- **Watchtower:** three anvil chains (31337, 31338, 31339); the ERC's vector reproduced in ethers; a thief's wildcard
  delegation detected and the certificate relayed to the two listed chains.
- **Gas:** `retireAccount` and `retireAccountWithSig` for 1, 2 and 5 chains, and for an ERC-1271 wallet.
- **Canary:** five upgrades; pinning by deployed implementation (address and code hash).

## 4. The KDA route (M1)

```bash
CARGO_TARGET_DIR=impl/.tools/target-l3 cargo test --offline --locked --features kda \
  --manifest-path impl/wt-l1-main/shared/user-decryption-signature/Cargo.toml
```

**Expected:** 15 + 11 + 20 tests, including all 180 Wycheproof ML-DSA-44 vectors (the C2SP file, LF line endings, its
SHA-256 and keccak pinned in `tests/vectors/wycheproof/PROVENANCE.md`). RustCrypto `ml-dsa` 0.1.1 is unaudited.

## 5. Profile Q (M1)

```bash
python -I impl/harness/level3/profile_q_sim.py results/level3/raw/L3_profile_q_sim.json 20000
```

**Expected:** "rule (k <= 8 iff reconstruction): True" and Monte Carlo within 4 standard errors of the exact values.

## 6. The native PQ benchmark (M1)

```bash
cargo run --release --offline --manifest-path impl/bench-pq/a5_native_verify/Cargo.toml > results/level3/raw/L3_pq_bench_run1.txt
cargo run --release --offline --manifest-path impl/bench-pq/a5_native_verify/Cargo.toml -- wycheproof \
  impl/wt-l1-main/shared/user-decryption-signature/tests/vectors/wycheproof/mldsa_44_verify_test.json > results/level3/raw/L3_pq_wycheproof.txt
```

Medians vary by a few percent between runs; the order of the schemes does not. RustCrypto `ml-dsa` 0.1.1,
`slh-dsa` 0.2.0-rc.5 and `fn-dsa` 0.4.0 are unaudited.

## 7. Files

| Path | Content |
|---|---|
| `LEVEL3.md` | the report |
| `raw/` | Foundry logs, OZ validate, the CI check, the anvil JSON, the crate checks, the simulation, the benchmark runs |
| `impl/harness/level3/`, `impl/watchtower/`, `impl/canary/`, `impl/bench-pq/` | the scripts and tools |
