# Phase 4 environment

## Machines

| Name | Hardware and OS | Role |
|---|---|---|
| M1 | AMD Ryzen 5 5600 (6 cores, 12 threads), 15.9 GB RAM, Windows 10 Pro 10.0.19045, Git Bash | Foundry, anvil, SDK, crate tests, documents |
| VPS | Shared with a live service; Ubuntu 24.04.5 LTS, 4 vCPU, 7,941 MB RAM; work only under `/srv/lifecycle`, capped scope (`MemoryMax=2560M`, `CPUQuota=200%`, `nice 19`, `ionice -c3`) | kms-worker (connector) and relayer builds and runs |

## Bases

| Repository | Ref | Commit |
|---|---|---|
| zama-ai/fhevm | `main` | `ed851716c9a6b799996a23399ece2858336f96db` |
| zama-ai/fhevm | tag `v0.13.8` | `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5` |
| zama-ai/fhevm | tag `v0.14.4` | recorded in P1.5 |
| zama-ai/kms | — | `c755e84` |
| OpenZeppelin confidential-contracts | 0.5.3 | — |
| FhenixProtocol/cofhe-contracts | default branch (head on 2026-10-22, `git ls-remote`) | `b5c20ed487faa13976e7b1cb2c598a752be8782d` |
| FhenixProtocol/cofhesdk (the mock stack, its Foundry plugin, the plugin's tests) | default branch | `04a69f89807fa1916d7c5be0a372db254706c38b` |
| FhenixProtocol/teecryptor (read only) | default branch | `2616344b29e2f71f11d134e8b0f3f1f3f6d7f7d8` |
| FhenixProtocol/zee-k-verifier (read only) | default branch | `47a59438caa7390582d4c470df7a02c42fa21d85` |
| Inco Lightning (`@inco/lightning`, read only) | npm 1.1.0 | — (the source repository is not public) |

## Port map

Semih's own anvil on M1 port 8545 is never touched. Phase 4 uses ports from 8600 up on M1.

| Port | Machine | Use |
|---|---|---|
| 58545 | VPS | anvil for the connector harness (127.0.0.1), as in Phase 3 |
| 58546 | VPS | JSON-RPC recorder / fault proxy (127.0.0.1) |
| 55432 | VPS | Postgres container `lifecycle-pg` (127.0.0.1) |
| 8601, 8602 | M1 | P0.1 smoke test of `fault_proxy.py`: anvil, proxy (127.0.0.1) |
| 8611, 8612 | M1 | P0.4 local run: anvil (Osaka), `fault_proxy.py --rewrite-file` (127.0.0.1) |
| 8615 | M1 | P0.4 check that anvil executes an `anvil_setCode` `0xef0100` indicator as a delegation |
| 8621 | M1 | P1.1 latency bench: anvil (127.0.0.1) |
| 8631, 8632 | M1 | P1.6 SDK status: anvil (chain 31337, Zama's mock deploy), `fault_proxy.py --rewrite-file` (127.0.0.1) |
| 8651 | M1 | P2.5 H2 matrix: anvil 1.8.5, Osaka (127.0.0.1), started and stopped by `p25_h2_matrix.py` |
| 8661, 8662 | M1 | P2.4 probe: anvil 1.8.5 with `--hardfork amsterdam` and `--hardfork osaka` (127.0.0.1), stopped after the probe |
| 8663 | M1 | P2.4: the nightly's anvil, `--hardfork amsterdam` (127.0.0.1), for the new-slot `SSTORE` check; stopped after it |
| 8671–8678 | M1 | P2.4 receipts, `p24_amsterdam.sh`: Level 0, Level 2 E1, Level 3 E2 and the carry harness, under `amsterdam` then `osaka` (nightly anvil, 127.0.0.1; each started and stopped by its harness) |
| 8679 | M1 | P2.4 deployment probe, `p24_cap_probe.py` (nightly anvil, 127.0.0.1) |
| 8680 | M1 | P2.4 reservoir probe, `p24_reservoir_probe.py` (nightly anvil, 127.0.0.1) |
| 8681, 8682 | M1 | P2.4 carry-boundary diagnosis (`carry_e2e.mjs`, `P24_CAP_DIAG=1`; nightly anvil, 127.0.0.1) |
| 8690, 8691 | M1 | P3 ratification harness `p3_ratify.py`: anvil 1.8.5 (Osaka) and the nightly's anvil (Amsterdam), 127.0.0.1 |
| 18557, and one port the OS assigns | M1 | §8 reproduction of `level0-mock` from a fresh clone: Baseline B's anvil (`HARNESS_PORT`, Phase 3's default) and the mock run's anvil, both 127.0.0.1, stopped at the end of each script |

## Harness tools

| Tool | Where | Version or hash |
|---|---|---|
| `fault_proxy.py` v1 (faults only) | VPS `/srv/lifecycle/scripts/fault_proxy.py` (P0.1 runs) | sha256 `703245838b3bb8b8…` (full hash in each run's `provenance.txt`) |
| `fault_proxy.py` v2 (faults, `--rewrite-file`, `hold` with `--signal-dir` and abort, `--heads`) | M1 `impl/harness/phase4/fault_proxy.py`; VPS `/srv/lifecycle/scripts/fault_proxy_v2.py` (P0.2, P0.3, P0.4) | sha256 `46aa3b639ade6877794a18349339cee9fd452b2c7a5bde6a6e3049885653efa8`, the same file on both machines. Earlier v2 builds ran superseded runs only: `5f914ec9…` and `b7fc48ab…`, kept under `raw/p04/superseded-proxy-*/` |
| `udsig-h` (Level 1 crate driver) | M1 `impl/harness/phase4/udsig-h-l1`, bound to `impl/wt-l1-h9` (`lifecycle/level1` `0eec675`), target `impl/.tools/target-udsig-h-l1` | binary sha256 `cf0cf9fa5b63a6ac153875717b618b07f4e156367b5f2f2fc62b939a9e457515` |

## Downloads and installs

| What | Source | Version / commit | SHA-256 | Where |
|---|---|---|---|---|
| uv (Python package manager, static binary) | https://github.com/astral-sh/uv/releases/download/0.12.23/uv-x86_64-unknown-linux-gnu.tar.gz (published 2026-10-03) | 0.12.23 | `9167d72b3319674b6303c4cbe071854bba13ebdf3d76b1a7cbdc175471fb66d6` (checked against the release's `.sha256`) | VPS `/srv/lifecycle/bin/uv-0.12.23` |
| ML-DSA-44 signer venv (E4's `mldsa_tool.py`) | PyPI through uv; system Python 3.12.3 | pycryptodome 3.23.0, eth_abi 5.2.0 and their dependencies, as on M1 (`experiments/E4/pq/.venv`) | per-wheel URL and sha256 in VPS `/srv/lifecycle/pq/WHEELS.txt` (copied to `results/phase4/raw/env/WHEELS_vps_pq.txt`) | VPS `/srv/lifecycle/pq/venv` |
| fireblocks-labs/evm-ml-dsa-verifier (pythonref, prepare, helpers, tools/fixtures) | copied from M1 `../scratch/pq-verifiers/evm-ml-dsa-verifier` | `cca262b537a5ac2ee55efb427e5c61de0308e566` | — | VPS `/srv/lifecycle/pq/evm-ml-dsa-verifier` |
| ZKNoxHQ/NTT `assets/pythonref` (polyntt) | copied from M1 `../scratch/pq-verifiers/NTT` | `3ac5f5dc0b204e91df4f68e347ade2bd4a82bb37` | — | VPS `/srv/lifecycle/pq/NTT/assets/pythonref` |
| alloy-sol-types 1.4.1 and 1.7.1 (and their sol-macro crates) | crates.io, through cargo on M1 | 1.4.1, 1.7.1 | crates.io checksums in the check program's Cargo.lock | M1 cargo registry (P0.1 decoding check) |
| ML-DSA implementations for K8 (P1.1) | crates.io, through cargo on M1 and on the VPS | `fips204` 0.4.6; `libcrux-ml-dsa` 0.0.10 with `libcrux-sha3` 0.0.10, `libcrux-intrinsics` 0.0.8, `libcrux-platform` 0.0.3, `libcrux-macros` 0.0.3; `pqcrypto-mldsa` 0.1.2 with `pqcrypto-internals` 0.2.11, `pqcrypto-traits` 0.3.5 (`ml-dsa` 0.1.1 as in Phase 3) | crates.io checksums in `shared/user-decryption-signature/Cargo.lock` (`538dc88`): `fips204` `c9fb5a367b984693…`, `libcrux-ml-dsa` `783ebed7cb27de6d…`, `pqcrypto-mldsa` `f9f812cd126a2582…` | M1 and VPS cargo registries |
| ML-DSA test vectors (P1.1) | NIST ACVP-Server and C2SP Wycheproof, through `raw.githubusercontent.com` | ACVP `a7f283cdc87d2d6d…` (2026-07-31); Wycheproof `20b256949ea8f21a…` (2026-10-12) | per file in the crate's `tests/vectors/PROVENANCE-K8.md`: `47cdd6314c7f746d…`, `f70759c95146ff30…`, `1ca235f61928421a…`, `54adffe10f6dad79…` | `impl/wt-l1-main/shared/user-decryption-signature/tests/vectors/` |
| npm tarballs for P1.4 | registry.npmjs.org | `@openzeppelin/confidential-contracts` 0.5.3, `@openzeppelin/contracts` 5.6.1, `@openzeppelin/contracts-upgradeable` 5.6.1, `encrypted-types` 0.0.4 | SHA-512 equal to the registry's `dist.integrity`, and SHA-256, per tarball in `impl/p14-oz-stock/vendor/PROVENANCE.md` | `impl/p14-oz-stock/vendor/` |
| zama-ai/fhevm tags for P1.5 (git fetch) | https://github.com/zama-ai/fhevm.git | `v0.14.2` `07b4abd6`, `v0.14.3` `c9c72564`, `v0.14.4` `ccdd1ce0` | git object ids | tags in `impl/fhevm-main`; worktree `impl/wt-l0-v014` |
| `dilithium-py` (the independent ML-DSA signer of P1.1) | inside the `evm-ml-dsa-verifier` checkout above (`pythonref`) | `cca262b5` | — | M1 and VPS; called by `impl/harness/phase4/p11_mldsa_tool.py` |
| Rust toolchain 1.99.1 (`x86_64-pc-windows-msvc`), M1 | rustup's official channel, installed automatically by rustup on 2026-10-22 when `rustfmt` ran inside `kms-connector` (its `rust-toolchain.toml` pins 1.99.1) | 1.99.1 (58cf8f9c3 2026-10-13) | rustup's own channel signatures | M1 rustup home; used only for `rustfmt` on the kms-worker files (the VPS already ran 1.99.1) |
| EIP-7851 text (P1.2, read only) | `https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-7851.md`, 2026-10-22 | Draft, created 2024-12-27 | `92d7407d2d3c6e2d797e4f6f91e74aa0eba18f1ba82daa9b90cb981eab61de66` (6,702 bytes) | session scratchpad (not kept) |
| npm tarballs for P2.1 | registry.npmjs.org | `@openzeppelin/contracts` 5.2.0, `@openzeppelin/contracts-upgradeable` 5.2.0 (Fhenix's pin), `@cofhe/mock-contracts` 1.0.1, `@cofhe/foundry-plugin` 1.0.1, `@fhenixprotocol/cofhe-contracts` 1.0.0 | SHA-512 equal to the registry's `dist.integrity`, and SHA-256, per tarball in `impl/fhenix-port/vendor/PROVENANCE.md` | `impl/fhenix-port/vendor/` |
| Fhenix sources for P2.1 (copied from the public clones above) | github.com/FhenixProtocol | `cofhe-contracts` `b5c20ed` (24 `.sol` files, `package.json`, `LICENSE`); `cofhesdk` `04a69f8` (`test/setup/contracts`, the plugin's 12 test files) | each vendored `cofhe-contracts` file equals its git blob byte for byte; tree SHA-256 in `impl/fhenix-port/vendor/PROVENANCE.md` | `impl/fhenix-port/vendor/`, `impl/fhenix-port/e2e/vendor-*` |
| solc 0.8.28 (P2.1, the plugin-suite comparison) | installed earlier through Foundry's svm | 0.8.28 | — | M1 `%APPDATA%/svm/0.8.28` |
| npm tarballs for P2.2 (read only) | registry.npmjs.org | `@inco/lightning` 1.1.0, `@inco/js` 0.7.12 | SHA-512 equal to the registry's `dist.integrity`; `@inco/lightning` SHA-256 `01309a004a52694eb436e977dd45f2cd6395e217f2e25a7188a8b062a85beadc` | `../scratch/inco/` (outside the project; not vendored: BUSL-1.1) |
| Inco-fhevm/lightning-rod (read only) | https://github.com/Inco-fhevm/lightning-rod | `080d5c16361073e52be9945c48c9b37ceec817d6` | git object id | `../scratch/inco/lightning-rod` |
| Foundry nightly (P2.4: anvil, forge) | https://github.com/foundry-rs/foundry/releases/download/nightly-9089a6bfdca158b2ef268b3d60923bf1e0879fed/foundry_nightly_win32_amd64.zip (published 2026-10-21) | 1.8.6-nightly, commit `9089a6bfdca158b2ef268b3d60923bf1e0879fed`; revm 43.0.3 (its `Cargo.lock`) | zip `1b2762e3b2f99725350abfc65967d2bd64c240d8f2bb1d913d73d516a3b8955e`, equal to the release asset's digest; `anvil.exe` `eceb5fbdcf6a2275…`, `forge.exe` `1d0795595e14e628…` | `../scratch/foundry-nightly-9089a6b/` (outside the project; not on PATH) |
| EIP texts (P2.4, read only) | `https://raw.githubusercontent.com/ethereum/EIPs/master/EIPS/eip-{8037,7825,7928,8011,7778}.md`, 2026-10-22; EIP-8037's last change `5d012887` (2026-10-02), status Last Call, deadline 2026-11-01 | — | eip-8037.md `37abe522c5dee68a47a27db6f7b88a71da5b66c8a72ebc601c467940b577b715` | `../scratch/eips-p24/` |
| eipw (D1, the EIP linter) | crates.io, `cargo install eipw --version 0.11.0 --locked` with Rust 1.95 | 0.11.0 | `eipw.exe` `696bd00bec4f5372…` | `../scratch/eipw-0.11.0/` |
| ethereum/ERCs lint configuration (D1) | `https://raw.githubusercontent.com/ethereum/ERCs/master/config/eipw.toml`, 2026-10-22; last changed in `d0404c88` (2026-08-10) | — | `575e0cf5f4f93c924616e3e4ab0ba49b5910b0d78e95c333fad043548a7a2357` | `../scratch/eips-p24/ERCs-eipw.toml` |
| EIP and ERC texts the ERC links to (D1, for eipw's cross-checks) | `ethereum/ERCs` `ERCS/erc-N.md` (master `077adf82`) and `ethereum/EIPs` `EIPS/eip-N.md` (master `46005d74`), 2026-10-22; 21 files, saved as `eip-N.md` as the ERCs CI does | — | per file in the lint workspace | `../scratch/eipw-run/ERCS/` |
| ML-KEM crates (P3, the reply-channel note) | crates.io, through cargo on M1 | `ml-kem` 0.3.2 (feature `getrandom`), `libcrux-ml-kem` 0.0.11 | crates.io checksums in `impl/bench-pq/p3_mlkem/Cargo.lock` | M1 cargo registry |
| fireblocks-labs/evm-ml-dsa-verifier sources (P3, vendored) | copied from the public checkout `../scratch/pq-verifiers/evm-ml-dsa-verifier` | `cca262b537a5ac2ee55efb427e5c61de0308e566` (MIT, unaudited) | git object id and SHA-256 per file in `impl/p3-operator-ratification/vendor/evm-ml-dsa-verifier-cca262b5/PROVENANCE.txt` | `impl/p3-operator-ratification/vendor/` |
| revm crates (P2.4, read only: the EIP-8037 constants and the cap check) | crates.io | `revm-primitives` 42.0.0, `revm-context-interface` 43.0.2, `revm-handler` 43.0.3, `revm-interpreter` 43.0.2, `revm-context` 43.0.3 | `2ef5564c1bce219f…`, `3068385c68f6a3bd…`, `ba5102e9c02b9d27…`, `aa32f5099a266329…`, `9b06efea511a15ff…` | `../scratch/revm-43/` |
| gitleaks (§8, secret scan of the export) | https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip, checked against `gitleaks_8.30.1_checksums.txt` of the same release | 8.30.1 (published 2026-03-21) | `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` | outside the project (temporary) |
| Licence texts (§8, `export/LICENSES/`) | raw.githubusercontent.com: `LICENSE` of OpenZeppelin/openzeppelin-contracts and openzeppelin-contracts-upgradeable at v5.2.0 and v5.6.1, of openzeppelin-confidential-contracts at v0.5.3, of C2SP/wycheproof at `20b256949ea8f21a11375619b1825027ca0668bd`; `README.md` of usnistgov/ACVP-Server at `a7f283cdc87d2d6dd93c1bac59e5622c5f9f8324` ("License" section). FhenixProtocol/cofhesdk has no `LICENSE` at `04a69f8` (HTTP 404) | as listed | `8b3fddff3cff904a…` (v5.2.0, both repositories), `20aebc68b11c0631…` (v5.6.1, both, and confidential 0.5.3), `58d1e17ffe5109a7…` (Wycheproof), `d5a569884ee83bd1…` (ACVP README) | `export/LICENSES/`; hashes of the files as exported in `export/NOTICE` |
| Fresh-clone reproduction (§8) | GitHub (zama-ai/fhevm, blobless clone), the npm registry, the Soldeer registry, through `scripts/repro.py` | fhevm at `ed851716c` and `fe3ca89b5`; npm and Soldeer packages as pinned by the lock files (`package-lock.json` integrity hashes, `soldeer.lock`) | git object ids; lock-file hashes | `.stage/` (git-ignored; removed after the checks) |

Signer equivalence (2026-10-21): with E4's public local test seed, M1 and the VPS produce the same public key
(sha256 prefix `2992e30424901b18`), the same 20,545-byte pk blob (`30ea1be0e6148900`) and the same deterministic
signature of `0x…01` (`121458818406a020`, self-verified on both).
