# P2.3: Conformance kit (vendor-neutral)

**Proof class:** Mock (Foundry) for the registry kit. The verifier kit judges recorded Connector runs.
**Date:** 2026-10-22. **Status:** done.
**Machine:** M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045), forge 1.8.5.
**The kit:** `conformance/`, copied byte for byte into the ERC's assets, `erc/assets/erc-XXXX/conformance/`
(`conformance/install.py --check`). **Raw data:** `raw/p23/`.

## 1. The registry kit

**What it is.** `DecryptionAuthorityLifecycle.t.sol` (844 lines; SHA-256 `69436bc45afb3b89…`) is an abstract Foundry
suite. It needs `pragma ^0.8.24` and imports only forge-std. It encodes:

| Test case | What the kit checks |
|---|---|
| TC1 | One retirement event; a second retirement reverts without one; the next call in the same transaction sees it (R1, R5) |
| TC2 | Retirement under every hostile condition the registry has (pause, deny lists, access lists), as a contract, with no handles (R3) |
| TC3 | Accounts that never retire are unaffected by another account's retirement (R6) |
| TC4 | Every use view false, the public view unchanged; the engine computes for a retired account if and only if the registry takes the exemption, and the output is inert (R6, R9, R10) |
| TC5 | Every on-behalf view false when the account, the delegate or the contract is retired (R6) |
| TC6 | Every permit view false when the issuer or the recipient is retired (R6) |
| TC7 | Every grant path reverts for a retired grantor, with `SenderRetired` where the registry uses it (R7) |
| TC8 | Grants to a retired account succeed and are inert (R8) |
| TC9 | A retired account computes, then every export of the output and of its own handle reverts (R10) |
| TC10 | Grants then retirement in one atomic batch; the reverse order reverts as a whole (R13) |
| TC11 | The upgrade guard: refuses the vendor's implementation without Core, another location, the location without Core, and no code; accepts a Core implementation at the same location, keeping state and enforcement; a lying implementation passes (the asserted residual) (R11) |
| TC12 | ERC-165 (R12) |
| TC17 | E1: the read right only after retirement and nothing more; resignation; the designation rules |
| TC19 | E2: the ERC's certificate vector (wrong chain, successor mismatch, success, a second submission), and a contract account through ERC-1271 |

**How it drives a registry** (D59).
- Core, E1 and E2 go through the ERC's interfaces.
- Everything vendor-specific goes through an adapter: 20 `kit*` functions, one of them with a default. They cover:
  - a persistent and a transient right;
  - every grant path, with its grantor;
  - the use, public, on-behalf and permit views;
  - publication and the engine's operand path;
  - delegation, the registry's batch and its hostile conditions;
  - the upgrade route, a new Core implementation and the previous release without Core.
- A sequence that needs a right for one transaction runs inside one call of a `KitAccount`. Its `runAfter` puts a
  computation's output, which cannot be predicted on Zama, into the calls that follow. The kit therefore passes with
  Foundry's isolation on and off.
- A test that does not apply is reported as skipped, not passed (D60). That covers a registry without an on-behalf
  role, an on-chain permit, the engine exemption, an in-code upgrade guard, E1 or E2.

## 2. The adapters

| Registry | Project and branch | Adapter | Notes |
|---|---|---|---|
| Zama fhEVM `main`, Core + E1 + E2 (ACL v0.10.0) | `impl/wt-l2-main`, `lifecycle/level3` `83f7312a` | `host-contracts/test/conformance/ZamaMainConformance.t.sol` (209 lines) | Handles come from `trivialEncrypt` and `allow`. Grant paths: `allow`, `allowTransient`, `allowForDecryption`, `delegateForUserDecryption`, `multicall(allow)`. The engine is `FHEVMExecutor.fheAdd`. Hostile conditions: pause and the deny list. The release without Core is Zama's ACL v0.7.0 |
| Zama fhEVM v0.13 line, Core + E1 + E2 (ACL v0.4.3) | `impl/wt-l3-v0138`, `lifecycle/level3` `6467036` | `ZamaV013Conformance.t.sol` (207 lines) | The same, without the all-contract delegation view; the release without Core is v0.4.0 |
| Fhenix CoFHE port, Core (P2.1) | `impl/fhenix-port` | `test/conformance/FhenixConformance.t.sol` (371 lines) | Handles come from signed inputs. Grants, the use view, publication and the engine go through the TaskManager. The permit view takes real EIP-712 permits. On-behalf records are written into the ACL's storage (D53). Hostile conditions: the TaskManager disabled, the deny list, the access list. No batch. The release without Core is Fhenix's unmodified ACL |

## 3. Results [M]

| Adapter | Isolation off | Isolation on | Skipped |
|---|---|---|---|
| Zama `main` | 17 passed, 1 skipped; three runs | 17 passed, 1 skipped | TC6 (no on-chain permit) |
| Zama v0.13 line | 17 passed, 1 skipped; three runs | 17 passed, 1 skipped | TC6 |
| Fhenix port | 14 passed, 4 skipped; one run | 14 passed, 4 skipped; three runs, within the port's suite (P2.1) | TC17 (two tests), TC19 (two tests): no E1, no E2 |

The Zama adapters were committed after these runs; one more run on each committed tree gave the same result
(`raw/p23/kit_*_committed.log`).

**The negative control** (D62; `raw/p23/kit-mutations/KIT_MUTATIONS.md`, `impl/harness/phase4/p23_kit_mutations.py`).
One gate at a time was removed from Zama `main`'s lifecycle ACL, and the kit was run each time. All six were caught:

| Id | Gate removed | Kit tests that fail |
|---|---|---|
| K1 | `isAllowed` ignores retirement | 8 |
| K2 | `persistAllowed` ignores retirement | 3 |
| K3 | `delegateForUserDecryption` without the delegator gate | 2 |
| K4 | no engine exemption (the executor's operand check gated too) | 2 |
| K5 | the handle-level on-behalf view ignores a retired delegate or contract | 1 |
| K6 | the same view ignores a retired delegator (no successor rule) | 2 |

## 4. The verifier kit

**Fixtures** (`conformance/verifier/fixtures/`, written by `make_fixtures.py`; D61). They are language-neutral rows:
the request, the chain state, the rule, the outcome the rule requires, and the harness line that reports it.

| Fixture | Rule | Rows |
|---|---|---|
| `tc13.json` | V1, when a view call fails: 11 fault kinds on every view of every request path, for allowed and retired subjects | 242 |
| `tc14.json` | Freshness and V5: retirement before, during and after a request; a reorganisation; a restart; an already-sent request | 14 |
| `tc15.json` | V7 with Profile H off and on; V6, unmodified and with H7 | 25 |

**The checker** (`check_zama_worker.py`) judged the recorded Phase 4 runs of the Zama worker harness
(`raw/p23/verifier-recorded/`):

| Fixture | Line | Cells | Result |
|---|---|---|---|
| TC13 | `main` | 198 rows × 3 runs | 594 conform |
| TC13 | v0.13.8 | 44 rows × 3 runs | 132 conform |
| TC14 | `main`, v0.13.8 | 7 rows × 3 runs each | 21 conform on each line |
| TC15 | `main` | 25 rows over 7 runs (each run covers its own rows) | 35 conform, **8 violate** |

The 8 violations are the unmodified verifier's, as P0.3 and Level 1 recorded:
- retirement denials retried, not final;
- an untyped denial;
- the request revived after a simulated governance lapse;
- a stored result served again after retirement (V6).

With Profile H and H7 every row conforms. No fixture row is missing from every run.

## 5. What this does not show

- **An Inco adapter.** There was no Inco spike (P2.2), so there is none.
- **TC6 on Zama.** The example has no on-chain permit; the test is skipped there, and runs on the Fhenix port.
- **The verifier kit on another verifier.** The checker reads the Zama harness's result lines. Another verifier needs
  its own harness that emits them.
- **New verifier runs.** The fixtures were checked against the recorded runs; no new connector run was made (D61).
