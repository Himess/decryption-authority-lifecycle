# Decryption Authority Lifecycle: conformance kit

Two parts. The registry kit is a Foundry suite, run against any registry through an adapter. The verifier kit is a
set of language-neutral JSON fixtures, with a checker for runs of the Zama worker harness. Licence: CC0, as the ERC.

## Registry kit (`DecryptionAuthorityLifecycle.t.sol`)

**What it tests.** An abstract Foundry suite (`pragma ^0.8.24`; it imports only forge-std):

| Test case | Kit test | Requirement |
|---|---|---|
| TC1 | `test_kit_TC1_*` | R1, R5: one event, a second retirement reverts without one; the next call in the same transaction already sees it |
| TC2 | `test_kit_TC2_*` | R3: retirement under every hostile condition the registry has (pause, deny lists, access lists), as a contract, with no handles |
| TC3 | `test_kit_TC3_*` | R6: accounts that never retire are unaffected by another account's retirement |
| TC4 | `test_kit_TC4_*` | R6, R9, R10: every use view false, the public view unchanged; the engine computes for a retired account if and only if the registry takes the exemption, and the output is inert |
| TC5 | `test_kit_TC5_*` | R6: every on-behalf view false when the account, the delegate or the contract is retired (skipped without an on-behalf role) |
| TC6 | `test_kit_TC6_*` | R6: every permit view false when the issuer or the recipient is retired (skipped without an on-chain permit) |
| TC7 | `test_kit_TC7_*` | R7: every grant path reverts for a retired grantor, with `SenderRetired` if the registry uses it |
| TC8 | `test_kit_TC8_*` | R8: grants to a retired account succeed and are inert |
| TC9 | `test_kit_TC9_*` | R10: a retired account computes, then every export of the output and of its own handle reverts |
| TC10 | `test_kit_TC10_*` | R13: grants then retirement in one atomic batch; the reverse order reverts as a whole. The registry's own batching if it has one, the account's otherwise |
| TC11 | `test_kit_TC11_*` | R11: the upgrade guard refuses the vendor's implementation without Core, another location, the location without Core, and no code; it accepts a Core implementation at the same location, keeping state and enforcement; a lying implementation passes (the asserted residual) |
| TC12 | `test_kit_TC12_*` | R12: ERC-165 |
| TC17 | `test_kit_TC17_*` | E1 (skipped without E1): the read right only after retirement and nothing more (S8, S9), resignation (S5), the designation rules (S1, S4, S6, S7) |
| TC19 | `test_kit_TC19_*` | E2 (skipped without E2): the ERC's certificate vector (wrong chain, successor mismatch, success, a second submission), and a contract account through ERC-1271 |

**How it drives the registry.**
- **Through the ERC's interfaces:** Core, E1 and E2.
- **Through the adapter:** grants, views, the engine, delegation, permits and upgrades.
- **One transaction.** A sequence that needs a right living for one transaction runs inside one call of a `KitAccount`. Its `runAfter` puts a computation's output into the calls that follow. The kit therefore passes with Foundry's isolation on or off.

**Writing an adapter.** An adapter is a test contract in the registry's project. It inherits
`DecryptionAuthorityLifecycleConformance` and implements its `kit*` functions with the registry's own deployment and
paths. Three adapters exist:

| Registry | Project | Adapter |
|---|---|---|
| Zama fhEVM `main`, Core + E1 + E2 | `impl/fhevm-main` with the level0, level2 and level3 main series, as `scripts/repro.py conformance` builds it (the authors' worktree `impl/wt-l2-main`, branch `lifecycle/level3`) | `host-contracts/test/conformance/ZamaMainConformance.t.sol` |
| Zama fhEVM v0.13 line, Core + E1 + E2 | `impl/fhevm-v0.13.8` with the v0.13 series through `level3/v0.13.8` applied by hand (the authors' worktree `impl/wt-l3-v0138`, branch `lifecycle/level3`) | `host-contracts/test/conformance/ZamaV013Conformance.t.sol` |
| Fhenix CoFHE port, Core | `impl/fhenix-port` | `test/conformance/FhenixConformance.t.sol` |

**Running it.**

1. `python -I conformance/install.py .` copies the kit next to each adapter. `--check` verifies that every copy equals this file byte for byte.
2. In a project, run:
   - `forge test --match-path "test/conformance/*"`. The Zama projects run from `host-contracts/` and set `FOUNDRY_ISOLATE=false`, as their own suites need.
   - With `FOUNDRY_ISOLATE=true` as well, to show that the kit itself does not depend on it.

Results are in `results/phase4/P2_3_CONFORMANCE_KIT.md`.

## Verifier kit (`verifier/`)

**The fixtures.** `verifier/make_fixtures.py` writes the three fixtures in `verifier/fixtures/`. Each row states:
- the request;
- the chain state;
- the rule, and the outcome the rule requires (`not-forwarded`, `forwarded`, `any`, `final-denial`, `typed-denial`, `served`, `not-served`);
- the harness line that reports it.

| Fixture | Rule | Rows |
|---|---|---|
| `tc13.json` | V1, when a view call fails: 11 fault kinds on every view of every request path, allowed and retired subjects | 242 |
| `tc14.json` | Freshness and V5: retirement before, during and after a request; a reorganisation; a restart; an already-sent request | 14 |
| `tc15.json` | V7 (final, typed denials; no revival after a governance lapse) with Profile H off and on; V6 (a stored result after retirement), unmodified and with H7 | 25 |

**Running the harness.** The rows reproduce the matrices of the Zama worker harness used in Phase 4. The harness is
generated and run on a host with the capped scope:

| Fixture | Generator | Run script |
|---|---|---|
| TC13 | `impl/harness/phase4/make_tc13_tests.py` | `impl/harness/phase4/vps/run_tc13.sh` |
| TC14 | `impl/harness/phase4/make_p02_tests.py` | `run_p02.sh` |
| TC15, V6 | `impl/harness/phase4/make_p03_tests.py` | `run_p03.sh` |
| TC15, V7 | `impl/harness/level1/make_profile_h_connector_tests.py` | `impl/harness/level1/vps/run_level1.sh` |

On the recorded Phase 4 runs, the TC15 fixture finds 35 conforming cells and 8 violations, all the unmodified verifier's: it serves a stored result
again after retirement and retries a retirement denial. With Profile H and H7 every row conforms
(`results/phase4/P2_3_CONFORMANCE_KIT.md`).

**Checking a run.** `python -I conformance/verifier/check_zama_worker.py <fixture> <run dirs…> [--line main|v0.13.8]`
judges every row in every run and writes a table (`--out`).
- A violation describes the verifier under test.
- The script fails only if a row has no result line in any run.
