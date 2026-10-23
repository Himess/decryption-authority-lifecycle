# Phase 5 environment

## Machines

As in Phase 4 (`results/phase4/ENV.md`): **M1** (AMD Ryzen 5 5600, Windows 10 Pro 19045, Git Bash) and the **VPS**
(Ubuntu 24.04, 4 vCPU, shared with a live service; every heavy step in the capped scope `MemoryMax=2560M`,
`CPUQuota=200%`, `nice 19`, `ionice -c3`, inside `/srv/lifecycle` only).

## Bases

The Phase 4 bases stay: fhevm `main` = `ed851716c`, tag `v0.13.8` = `fe3ca89b5`, and our branches on them.

**The latest `main`, for the contribution kit only (§6.3):** `f81d506d59b4fcd1dcb439308815e9c2cf8f1eca` (2026-10-22T19:37:13Z,
"fix(relayer): publish the relayer-http image (#4607)"), 17 commits after `ed851716c`. Fetched 2026-10-22 into
`impl/fhevm-latest` (M1, a partial clone, git-ignored) and into the VPS's `src/fhevm.git`. The kit's four branches are based
on it (`contribution/zama/`).

## Port map

Semih's own anvil on M1 port 8545 is never touched. Phase 5 uses ports from 8700 up, on M1 and on the VPS (D90).

| Port | Machine | Use |
|---|---|---|
| 8711, 8712 | VPS | P0.3 connector runs: anvil 1.3.5 and the recording proxy (127.0.0.1 only; `run_p503.sh`) |
| 55432 | VPS | the test Postgres container `lifecycle-pg` (127.0.0.1 only), inherited from Phase 4; removed after each chain |
| 8721, 8722 | M1 | P0.3 local verifiers: anvil 1.8.5 and the recording proxy (`run_p503_local.sh`) |
| 8731, 8732 | M1 | P0.3 SDK status: anvil 1.8.5 with Zama's runner flags and the recording proxy (`run_p503_sdk.sh`) |
| 8741 | M1 | one-off anvil probes (impersonated sends from an account with code) |
| 8713, 8714 | VPS | Part B connector drill: anvil 1.3.5 and the recording proxy (127.0.0.1 only; `run_pq_drill.sh`) |
| 8761, 8762 | M1 | Part B local drill: anvil (Osaka 1.8.5 or the nightly for Amsterdam) and the RPC proxy (`run_pq_drill_local.sh`) |

## Downloads and installs

| What | Source | Version / commit | SHA-256 | Where |
|---|---|---|---|---|
| EIP-8298 text | `https://raw.githubusercontent.com/ethereum/EIPs/<commit>/EIPS/eip-8298.md`, 2026-10-22 | `f4a9f9655ee88ed923ceac6cb6271820477e11c5` (2026-10-22T18:43Z, Draft) | `9c05ea1f17f5726b793388e7d61e38a6a2af1adc7ff134f2c80de5b399214d13` (27,548 B) | `results/phase5/raw/eips/` |
| EIP-8298 text, earlier | the same path | `fa3915674078b4e79252df34ac9599d4195f11b1` (2026-10-12) | `61893e8c7a1086f71990169571fe53f01fc3e2026cdd6b77c86ee0461b48c72d` (25,064 B) | `results/phase5/raw/eips/` |
| EIP-7851 text | the same path, `eip-7851.md` | `07f3bb3626d4db1f2ac501734fec5b3d32e185c5` (2026-05-14, Draft; equal to Phase 4's copy) | `92d7407d2d3c6e2d797e4f6f91e74aa0eba18f1ba82daa9b90cb981eab61de66` (6,702 B) | `results/phase5/raw/eips/` |
| EIP-8151 text | the same path, `eip-8151.md` | `e2fad38cfe2d441614fbb3c7eaedce2f661b1886` (2026-10-18, Draft) | `191a5a2d742c38380f815d251f78bf5e315bba23e2dafc239f7197572ac748ea` (11,361 B) | `results/phase5/raw/eips/` |
| EIP-8355 text (for B8) | the same path, `eip-8355.md` | `54e1f09368557d380f08e44c3db6155355a4771c` (2026-09-01, Draft) | `01207bab5558e0692ba295b81a64e1d349f634a3b6dc127433fc3f4d31aed714` (21,148 B) | `results/phase5/raw/eips/` |
| zama-ai/fhevm, latest `main` | `https://github.com/zama-ai/fhevm.git` (partial clone) | `f81d506d59b4fcd1dcb439308815e9c2cf8f1eca` | a git commit | `impl/fhevm-latest/` (M1); VPS `src/fhevm.git`, worktrees `src/fhevm-kit-*` |
| gitleaks (export review) | `https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip` | 8.30.1 | `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` (equal to the release checksum file and to Phase 4's copy) | the session's scratch folder |
| Foundry (selectors and Rust bindings of PR 1, as Zama's integrity CI pins it) | `https://github.com/foundry-rs/foundry/releases/download/v1.7.1/foundry_v1.7.1_win32_amd64.zip` | 1.7.1 (`4072e48`) | `6d41121b4bbb809845821c903619cfee75ed364f2bdc58a6787c9b0454114537` | the session's scratch folder |
| typos (Zama's `common-typos-check` pins v1.43.0) | `https://github.com/crate-ci/typos/releases/download/v1.43.0/typos-v1.43.0-x86_64-pc-windows-msvc.zip` | 1.43.0 | `374f38bc07e01ba3e1d76029dd6cd36efdbfcdffd41ae471f7c2967f67e454dd` | the session's scratch folder |
| commitlint (as Zama's PR-lint job installs it) | npm: `@commitlint/cli@^18`, `@commitlint/config-conventional@^18`, `@commitlint/types@^18`, `conventional-changelog-conventionalcommits@^7` | cli 18.6.1 | npm lockfile in the scratch folder | the session's scratch folder |
| npm and soldeer dependencies of the kit's checks | `npm ci` in `impl/fhevm-latest` (host-contracts workspace), `impl/wt-latest-pr2/sdk/js-sdk` and the codegen worktree; `forge soldeer install` | the lockfiles of `f81d506d5` | npm's integrity fields | the clones' `node_modules/` (git-ignored) |
| fireblocks-labs/evm-ml-dsa-verifier (by `make pq-drill`, in a fresh clone of the export) | `https://github.com/fireblocks-labs/evm-ml-dsa-verifier.git` | `cca262b537a5ac2ee55efb427e5c61de0308e566` | a git commit | `<clone>/impl/.tools/evm-ml-dsa-verifier` |
| polyntt (by `make pq-drill`, pip, into a venv under `repro-out/`) | `git+https://github.com/ZKNoxHQ/NTT.git@3ac5f5dc0b204e91df4f68e347ade2bd4a82bb37#subdirectory=assets/pythonref/` | `3ac5f5dc` (the commit the verifier's `pythonref/requirements.txt` pins; equal to the local checkout E4 used) | a git commit | the fresh clone's `repro-out/pq-signer-venv` |
| CMake, portable (the kms-connector workspace builds `libz-ng-sys`, whose build script runs `cmake`; the VPS has none) | `https://github.com/Kitware/CMake/releases/download/v3.31.6/cmake-3.31.6-linux-x86_64.tar.gz` | 3.31.6 | `5a1133ff103c71eb5120e2cc3de922733e7d8a26a98ae716397e8676adb367bf` (equal to the release's `cmake-3.31.6-SHA-256.txt`) | VPS `/srv/lifecycle/bin/cmake-3.31.6-linux-x86_64/`, on `PATH` only for the kms-connector workspace checks of the contribution kit |
| Rust 1.97.1 (the relayer's `rust-toolchain.toml` at `f81d506d5` pins it; rustup installed it on first use) | rustup, `static.rust-lang.org` | `rustc 1.97.1 (8bab26f4f 2026-07-14)` | rustup's own checks | VPS `/srv/lifecycle/.rustup/toolchains/` |
| cargo-deny (Zama's kms-connector dependency analysis pins 0.18.9; relayer-http's and the coprocessor's pin 0.16.2) | `https://github.com/EmbarkStudios/cargo-deny/releases/download/<v>/cargo-deny-<v>-x86_64-unknown-linux-musl.tar.gz` | 0.18.9; 0.16.2 | `491d04e4c05d7c92582e3d40ec94126c52472a546326a6d29473a5a4e73babd2`; `1acc7db00ebbf6f9c2b63a30017acfd07f43ce687469538cc691aa6a05aa3921` (each equal to the release's `.sha256` file) | VPS `/srv/lifecycle/bin/cargo-deny-<v>/` |
| cargo-audit (as the dependency-analysis jobs pin it) | `https://github.com/rustsec/rustsec/releases/download/cargo-audit/v0.22.0/cargo-audit-x86_64-unknown-linux-musl-v0.22.0.tgz` | 0.22.0 | `0ea7a15f67d5007af5bd18f89be38a90ebd004f149dc36ebfab0aedba24cbb4f` (equal to GitHub's asset digest) | VPS `/srv/lifecycle/bin/cargo-audit-0.22.0/` |
| The RustSec advisory database (cargo-audit's first run fetches it; every kit audit reads this copy, D121) | `https://github.com/RustSec/advisory-db.git` | `c244ff02630e2e4e1eb69e01914b14a37dad7cbb` (2026-10-23) | git commit | VPS, the base kit tree's `kms-connector/.cargo/advisory-db` |
| FhenixProtocol/cofhe-contracts at `master` (the Fhenix kit, D122) | `https://github.com/FhenixProtocol/cofhe-contracts.git` | `b5c20ed487faa13976e7b1cb2c598a752be8782d` (2026-10-19, the head on 2026-10-23) | git commit | `impl/fhenix-latest` (git-ignored); worktrees at `<home>\fhx\` (outside the project, kept) |
| pnpm, as the repository's `packageManager` pins it, through corepack | npm registry | 9.12.1 | corepack's own check | corepack's cache (M1) |
| The Fhenix host-chain and registry-chain dependencies | npm registry, through `pnpm install --frozen-lockfile` | as the repository's `pnpm-lock.yaml` files pin them | the lockfiles' integrity hashes | the worktrees' `node_modules` (M1) |
| Slither (Fhenix's checks run `crytic/slither-action`) | PyPI | `slither-analyzer` 0.11.6, `crytic-compile` 0.4.2 | pip's hash checks | `<home>\fhx\slither-venv` (M1) |
| The RustSec advisory database later that day (D123: CI fetches the database of the day) | `https://github.com/RustSec/advisory-db.git`, a new clone | `f7b2f6bc663452200bbe639ebb75e0c762b3422b` (2026-10-23, "Assigned RUSTSEC-2026-0385 to ctutils") | git commit | VPS `/srv/lifecycle/tmp/advisory-db-latest` |
| Pages read for Fhenix's rules (D122), 2026-10-23 | `github.com/FhenixProtocol/cofhe-contracts` (README, `.github`), `github.com/FhenixProtocol/.github` (empty), the repository's Actions page (Checks and Tests pass on `master` at `b5c20ed`), one web search | as read that day | — | not downloaded |
| Pages read for PQClean's status (D121), 2026-10-23 | `github.com/PQClean/PQClean` (archived on 2026-08-04) and its issue 604; `github.com/rustpq/pqcrypto` (archived on 2026-09-16) and its issue 97; docs.rs for `aws-lc-rs` 1.18.2 (ML-DSA in `aws_lc_rs::signature`) and `oqs` 0.11.0 (`MlDsa44/65/87`) | as read that day | — | not downloaded |
| Bun (Zama's ABI-compat and upgrade-version jobs run their checks with `oven-sh/setup-bun`, latest) | `https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-windows-x64.zip` | 1.4.4 (2026-10-22, the latest release on 2026-10-23) | `cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5` (equal to GitHub's asset digest) | the session's scratch folder |
| zama-ai/fhevm tags `v0.14.1` (the ABI-compat baseline the workflow pins) and `v0.14.4` (the latest release, the upgrade-check baseline) | `https://github.com/zama-ai/fhevm.git` | `e7e7fecf10ea7a59c68603376caac2a308e18cca`; `ccdd1ce0dd039d863d90b2294e3b2c6be6af16d7` | git commits | `impl/fhevm-latest`; worktrees `impl/wt-ci/` (M1, git-ignored) |
| Playwright's browsers (the SDK's browser smoke test; `npx playwright install`, `@playwright/test` 1.62.1 as the SDK locks it) | `cdn.playwright.dev` | Chrome for Testing 151.0.7922.34, Firefox 153.0, WebKit 26.5 | Playwright's own checks | `%LOCALAPPDATA%\ms-playwright` (M1). Windows refuses to run the Firefox binary, so the Firefox leg could not run |

## Provenance notes

Each raw run records the SHA-256 of its inputs in its `provenance.txt`. Two inputs of the committed local runs are not
byte-identical to the files published with this repository (found by the independent verification, R8):

| File | Hash in the runs' `provenance.txt` | Hash of the file as published | The difference |
|---|---|---|---|
| `impl/harness/phase5/pq-drill-local/pq-drill-local.test.ts` | `f58af96a…` (the six committed local-drill runs) | `2023d5a1…` | Edited after the runs, for `make pq-drill` (D106): a three-line comment, and four paths read from environment variables (`PQL_MLDSA_PY`, `PQL_MLDSA_REPO`, `PQL_PYTHON`, `PQL_METER_ART`) whose defaults are the values the runs used, with their two use sites (the proxy's Python and the meter's artifact). The file as the runs used it is kept beside them: `results/phase5/raw/pq-drill-local/as-run/pq-drill-local.test.ts` (`f58af96a…`) |
| `impl/harness/phase4/fault_proxy.py` | `46aa3b63…` (the Phase 5 runs that start the proxy; Phase 4's `ENV.md` records the same hash) | `091d772b…` | The published copy omits fault modes. The Phase 5 runs start the proxy with `--rewrite-file` only (code rewriting and recording) and select no fault mode |

Runs of the published files reproduce the committed local runs: `make pq-drill` in two fresh clones of a staging
build (9 of 9 tests and 81 of 81 rows in each) and in the independent verifier's clone, whose `provenance.txt` records
the published hashes; every row's outcome and every deterministic figure equal the committed run's.
