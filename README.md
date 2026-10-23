# Decryption Authority Lifecycle

**Revocable access for oracle-based confidential execution.** A draft ERC that lets an account retire its authority
to have a decryption oracle release its data (Part A), the full path from an ECDSA key to a post-quantum signature for
that authority (Part B), and a local reference implementation that tests both.

Status: research prototype and draft standard. Not deployed, not audited, not endorsed by any vendor.

## Part A: retiring decryption authority

### The problem

In FHE and TEE systems on Ethereum, data sits on a public host chain as ciphertext handles. A decryption oracle
releases a plaintext to whoever the host chain's access registry says may ask. The confidentiality of past data is
therefore decided again at every request.

The authority to ask is, for almost every account, an ECDSA key bound to an address for life, and no system we
examined lets an account end it. A leaked key, or a future quantum computer that derives the key from a public key,
inherits the account's whole history.

On Zama fhEVM, the reference system here:
- one `allow` (140,780 gas on Sepolia) let another account decrypt a balance;
- one `allowForDecryption` made it public;
- delegating an account through EIP-7702 to a new wallet did not stop its old key.

In a sample of mainnet holders, 97.9% are ECDSA-rooted.

### The idea

- **Retirement.** An account calls `retireAccount()`. From then on, every authorization view that the oracle already
  reads returns false for it, in every role: requester, owner, delegator, delegate, contract, permit issuer and
  recipient. There is no reverse transition.
- **Enforced in the views.** In a threshold oracle (13 nodes, any 5 responses reconstruct), a rule in node software
  binds only once 9 operators run it. A rule in the registry's views binds every verifier of every release from the
  upgrade block, with no verifier change.
- **The one-key rule.** The owner and a thief hold the same key. Anything the key alone can trigger must therefore
  only remove authority, unless it was committed while the key was safe. Hence two extensions:
  - a **successor** that keeps read access only if it was designated, accepted and matured beforehand;
  - a **retirement certificate** that anyone can relay, bound to that successor.

The draft standard is `erc/ERC-XXXX-decryption-authority-lifecycle.md` (Core, successor, certificate).
`docs/COMPANION_EXTENSIONS_AND_PROFILES.md` holds the candidates for later standards: a declared post-quantum
decryption signer, verifier signature hygiene, a scheduled post-quantum-only oracle mode, and an application profile.

### Evidence

Measured locally, on our own testnet accounts, or as read-only mainnet aggregates; three runs per check unless the
linked report says otherwise. `results/RESULTS.md` collects every number, with its method, machine and date.

| What | Result | Where |
|---|---|---|
| Core on Zama fhEVM `main` and the deployed v0.13 line | Registry suites pass on both lines; `retireAccount()` 50,099 gas | `results/level0/` |
| The unmodified verifier against the real registry | A retired account is refused on every request path, also under injected view-call failures (rule V1: an answer that is not exactly one ABI-encoded `bool` counts as false). Stored results and final denials (TC15) need the hygiene profile: unmodified, the verifier serves a stored result again after retirement and retries a retirement denial (the kit's TC15 fixture: 35 cells conform, 8 violate, all the unmodified verifier's) | `results/level0/CONNECTOR_PROOF.md`, `results/phase4/P0_1_TC13.md`, `results/phase4/P0_3_STORED_RESULTS.md` |
| Successor and certificate on both lines | 41 successor tests per line; the ERC's certificate vector reproduces | `results/level2/`, `results/level3/`, `results/phase4/P1_3_E2_V013.md` |
| A second vendor | Core ported to Fhenix CoFHE without a change of mechanism (69 tests; 17 of 17 gate mutations caught); Inco mapped by reading | `results/phase4/P2_1_FHENIX_PORT.md`, `INCO_MAPPING.md` |
| Vendor-neutral conformance kit | Passes on Zama `main`, the v0.13 line and the Fhenix port | `conformance/`, `results/phase4/P2_3_CONFORMANCE_KIT.md` |
| Host-chain key disable (EIP-7851, EIP-8298) | Does not reach off-chain verifiers; a code-first verifier profile closes the gap | `results/phase4/P0_4_EIP7851.md`, `results/phase5/P0_3_EIP8298.md` |
| Amsterdam pricing | `retireAccount()` 132,519 gas; 119,505 per carried handle; at most 137 handles in one transaction under a 2^24 cap on the whole transaction | `results/phase4/P2_4_AMSTERDAM.md` |
| Real-world cost of strict signature checks | They would refuse root-key signatures from 5.3% of mainnet end accounts, so a shadow mode comes first | `results/phase4/SHADOW_IMPACT.md` |

## Part B: the post-quantum path

### The target

With the account's old ECDSA key assumed known to an attacker, the account has completed the post-quantum path when:
1. no verifier releases anything on that key;
2. that key creates or extends no right on chain;
3. the holder still decrypts past and future data, with a post-quantum signature only;
4. no registry upgrade undoes this without post-quantum authorization.

`docs/PQ_FULL_PATH.md` (Turkish: `docs/PQ_TAM_YOL_TR.md`) states the whole path: who must do what, in which order,
at what cost, and what stays open.

### The three paths, attacked with the old key

| Path | What happens | Result |
|---|---|---|
| **B1**, carry, then retire | The account grants its handles to an ML-DSA-44 wallet and retires, in one transaction | All four properties hold in the runs. Later grants to the old address are inert: applications grant to the wallet |
| **B2**, successor | The wallet is designated, accepts, waits 7 days and is confirmed; the account retires, or a watchtower relays its certificate | All four hold. The wallet reads the old account's handles, including later ones, through ERC-1271 |
| **B3**, in place | EIP-7702 to the wallet code, then EIP-7851 or EIP-8298, simulated | Off-chain holds for the old key's own signatures; delegations it made before the move still serve their delegates until the holder revokes them. On chain, the old key still grants, delegates and can retire the account until a host chain enforces those drafts; so B3 does not combine with retirement |

### Evidence

| What | Result | Where |
|---|---|---|
| The drill, through the real verifier | The kms-worker with Profile H, E3 and Profile Q against the registry on a local chain: 258 request rows and 40 transactions per run, every row as designed, three runs | `results/phase5/PQ_DRILL_MATRIX.md`, `results/phase5/B1_B6_PATHS.md` |
| The drill, on local chains | The real carry tool, watchtower, SDK and canary: 81 of 81 rows under Osaka and under Amsterdam's draft pricing, three runs each | `results/phase5/pq-drill/PQ_DRILL_LOCAL.md` |
| The operators' post-quantum-only mode | With 13 workers, an ECDSA request is still released when 8 enforce the mode, and withheld when 9 do (counted: released when at least t + 1 = 5 workers forward it; the KMS is a mock) | `results/phase5/B1_B6_PATHS.md` (B4) |
| Upgrade safety | Under an owner that needs 9 of 13 ML-DSA-44 signatures: 8 revert; 9 pass the upgrade guard for a release with Core, with the canary green; a release without Core reverts at the guard | `results/phase5/B1_B6_PATHS.md` (B5) |
| Costs | An ML-DSA-44 `isValidSignature` costs the verifier's node about 1.23M gas, five times today's 250,000 cap; a native declared signer about 245 µs; an account's on-chain key 4.43M gas once (Osaka). With EIP-8355 (Draft), about 15,000 gas per check [estimate] | `results/phase5/B8_COSTS.md` |
| The live line `v0.13.8` | Retirement, successors (ECDSA) and carrying work; decrypting with a post-quantum key does not (ECDSA-only gateway checks, no ERC-1271 path) | `results/phase5/B9_LIVE_LINE.md` |
| What stays classical | The KMS's and coprocessors' signatures, the input proofs and governance (18 primitives mapped) | `results/phase5/PQ_GAP_MAP.md` |

## The three limits

1. **Pre-emptive, not a clawback.** Retirement, and the post-quantum path, protect an account whose key has not yet
   been used against it. Whatever the key already re-shared, published or had decrypted stays exposed.
2. **Oracle access only.** It stops the oracle honouring the key. It does not stop the key moving funds or holding
   application roles, unless applications check retirement too.
3. **As final as the chain's governance.** Retirement is per host chain, and whoever can upgrade the registry can undo
   it.

## How to reproduce

Requirements: Git, Foundry 1.8.5, Node 22 with npm, Python 3.11, `jq` for `level0-mock`, and Rust 1.95 for the
verifier parts. Zama's code is not copied here: the targets fetch `zama-ai/fhevm` at the pinned commits and apply the
patches in `patches/`. On Windows, run the targets from a Git Bash shell (`python scripts/repro.py <target>` if `make`
is not installed). Each target checks its result against the documented counts and stops with a message otherwise.

```bash
make level0          # Core: Zama's host-contracts suites on main and v0.13.8 with the Level 0 patches
make level0-mock     # The vendor's cleartext mock, end to end through its SDK, with the Core (15 scenarios)
make conformance     # The conformance kit on the Fhenix port, and on Zama main with its adapter
make profile-a       # Profile A on stock OpenZeppelin confidential contracts (TC8 and TC23's token parts)
make pq-drill        # Part B's local drill under Osaka (9 tests, 81 rows); prints the Amsterdam and verifier steps
make amsterdam       # Prints the steps of the Amsterdam receipts (they need the Foundry nightly named in results/phase4/ENV.md)
make connector-proof # Prints the steps of the real-verifier proof (a Linux host with Rust and a local Postgres)
```

`make pq-drill` also fetches `fireblocks-labs/evm-ml-dsa-verifier` at `cca262b5`, whose Python reference signs the
drill's messages, and installs that signer's pinned Python packages, including `polyntt` from `ZKNoxHQ/NTT` at
`3ac5f5dc`, in a virtual environment under `repro-out/`. The connector drill's analyzer
(`impl/harness/phase5/analyze_pq_drill.py`) imports pycryptodome: run it with that environment's Python
(`repro-out/pq-signer-venv`), after `make pq-drill` has also built the test wallet it reads.

The verifier-side runs (Levels 1–3, Phase 4's connector tasks and Part B's connector drill) need that Linux host too.
Their reports give the steps, and their generated tables regenerate from the committed raw runs with the committed
analyzers. Each level's report gives the exact commands and the expected counts: `results/level0/README.md` to
`results/level3/README.md`, and the Phase 4 and Phase 5 reports. Zama's Foundry suites must run with
`FOUNDRY_ISOLATE=false`.

## Licences

- **Our code** is under the MIT licence (`LICENSE`), except files with their own SPDX header (see `NOTICE`).
- **The draft standard and the conformance kit** (`erc/`, `conformance/`) are dedicated to the public domain under
  CC0-1.0.
- **The Zama-derived parts** are under Zama's BSD 3-Clause Clear licence, © ZAMA:
  - the patch series in `patches/`;
  - the harness files built on Zama's test code;
  - the build artifacts of Zama's ACL with our changes.

  Zama's FAQ (the fhevm README at `ed851716c`, "Is Zama's technology free to use?") says its libraries are free to
  use under that licence "only for development, research, prototyping, and experimentation purposes". The same FAQ
  says that any commercial use requires Zama's commercial patent licence. This repository is research; anyone who
  builds on the Zama-derived parts commercially needs that licence from Zama.
- **Inco's code is under BUSL-1.1, so nothing from Inco is included.** Inco was read, not copied or run
  (`results/phase4/INCO_MAPPING.md`).
- **Other third-party code** (Fhenix, OpenZeppelin, the ML-DSA verifier, test vectors) keeps its own licence. `NOTICE`
  lists every file, and `LICENSES/` holds the texts.

## Unaudited libraries

The post-quantum parts rely on libraries without a completed security audit for this use:
- the on-chain ML-DSA verifier `fireblocks-labs/evm-ml-dsa-verifier` (`cca262b5`, vendored), behind the test wallet in
  `impl/pq-wallet/` and the operator-ratified owner;
- RustCrypto `ml-dsa` 0.1.1, `fips204` 0.4.6, Cryspen `libcrux-ml-dsa` 0.0.10 and PQClean's `clean` through
  `pqcrypto-mldsa` 0.1.2: the four libraries of the K8 route in the patch series. PQClean was archived on 2026-08-04,
  and RustSec flags `pqcrypto-mldsa` and its two companion crates as unmaintained (RUSTSEC-2026-0166, -0163, -0162),
  as it does `proc-macro-error2` (RUSTSEC-2026-0173), which `libcrux-ml-dsa` uses at build time;
- `slh-dsa` 0.2.0-rc.5 and `fn-dsa` 0.4.0 (benchmarks);
- `ml-kem` 0.3.2 and `libcrux-ml-kem` 0.0.11 (the reply-channel note);
- `dilithium-py` with `polyntt`, used only as an independent test signer.

The test wallet and the owner contract are test fixtures.

## Layout

| Path | Contents | Licence |
|---|---|---|
| `erc/` | The draft ERC, its assets (evidence, conformance kit) and archived drafts | CC0 |
| `docs/` | Target architecture (English and Turkish), the companion, the post-quantum path (English and Turkish), the split mapping, an earlier design note (Turkish, with PDF) | MIT |
| `drafts/` | The two research write-ups and the one-pager | MIT |
| `patches/` | Patch series against `zama-ai/fhevm` at pinned commits | BSD 3-Clause Clear, © ZAMA |
| `conformance/` | The conformance kit | CC0 |
| `impl/fhenix-port/` | The Core port of Fhenix CoFHE's host-chain contracts, with vendored dependencies | see `NOTICE` |
| `impl/harness/`, `impl/carry-tool/`, `impl/watchtower/`, `impl/canary/`, `scripts/` | Harnesses and tools | MIT, except files with their own SPDX header (see `NOTICE`) |
| `impl/pq-wallet/` | The ML-DSA-44 test wallet of Part B (ERC-1271 and a relayable `execute`); test only, unaudited | MIT |
| `impl/p14-oz-stock/` | Profile A on stock OpenZeppelin confidential contracts, with vendored dependencies; Zama's library comes from the tree `make profile-a` builds | see `NOTICE` |
| `impl/p3-operator-ratification/`, `impl/bench-pq/` | Prototypes and benchmarks of post-quantum building blocks; the ML-DSA verifier is vendored and unaudited | see `NOTICE` |
| `experiments/` | Two files of earlier experiments that the local drill runs: the ML-DSA-44 test signer and an ERC-1271 gas meter | MIT; the meter carries its own SPDX header |
| `results/` | Reports and raw data; per-address data and machine identifiers removed | MIT, except files with their own SPDX header and the Zama-derived files `NOTICE` lists |
| `G1_TARTISMA_RAPORU.md` | An early design discussion (Turkish) | MIT |

**References to unpublished files.** Reports written on the authors' machine cite its internal briefs
(`docs/CLAUDE_CODE_BRIEF_*.md`), a design review (`DESIGN_REVIEW.md`), its worktrees (`impl/wt-*`) and its server's
trees; none of these is published. `scripts/repro.py` builds two of those Zama trees from the patch series:
`impl/fhevm-main` with the level0, level2, level3 main and SDK series, and `impl/fhevm-v0.13.8` with the level0 and mock
series. The other trees (the v0.13 line's level3, the connector branches of Phase 4 and Phase 5) are the remaining
series in `patches/`, applied by hand as `patches/README.md` describes. `export/` in those reports is this repository's
root.
