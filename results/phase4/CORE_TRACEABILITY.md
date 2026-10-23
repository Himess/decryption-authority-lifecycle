# Core traceability (P0.5)

Every Core requirement of the draft (R1–R14 for registries, V1–V7 for verifiers, O1–O3 for oracles) is mapped
below to its tests, its proof class and its status. Statuses are as of 2026-10-22: the five items that waited on P1.1, P1.4, P1.5 and P2.1 are done.

**Proof classes:**

- **Mock**: Foundry tests on the registry, or the vendor's cleartext mock and SDK on a local chain.
- **Connector**: the unmodified or Level 1 kms-worker against the real registry on a local chain.
- **Design**: a code reading or an argument, with the reason no test applies.
- **Vendor-2**: the Fhenix port.

The Foundry suites are listed once, below. Counts are main / v0.13 line, from `results/level0/LEVEL0_CONTRACTS.md`.

- `ACLRetirement.t.sol`: 29 / 29.
- `ACLRetirementExemption.t.sol`: 24 / 24.
- `ACLRetirementBridge.t.sol`: 1 (main only).
- `ACLRetirementUpgradeMatrix.t.sol`: 14 / 10.
- `ACLRetirementGas.t.sol`: 12 / 12.

They are all under `host-contracts/test/acl/` on branch `lifecycle/level0`. The full suites are green: 791/791
and 569/569.

## Registry (R1–R14)

| Req | What | Tests | Class | Status |
|---|---|---|---|---|
| R1 | Retire: mark, emit once; a second call reverts and emits nothing | TC1: `ACLRetirement.t.sol` (second retirement reverts `AccountAlreadyRetired`, no event; the bit at `keccak256(abi.encode(account, location))`). The connector harness checks the event and `isAccountRetired` on every retirement it makes (`verify_retirement`) | Mock; Connector | Done, both lines |
| R2 | One-way | `ACLRetirement.t.sol`: one-way under block, unblock, pause and unpause. Code reading: no function clears the bit (`ACL.sol` §1.2 of `LEVEL0_CONTRACTS.md`). A storage write outside the registry, simulating a governance lapse, does clear it (`PROFILE_H_CONNECTOR.md` §2) — limit 3 | Mock; Design | Done |
| R3 | Unconditional | TC2: retires while paused, while deny-listed, as a contract, with no handles. `retireAccount()` is non-payable, so a payment cannot be required | Mock; Design | Done, both lines |
| R4 | Grants nothing | Inbound-grant and view tests (no view turns true at retirement). The one exception, a confirmed E1 successor's read right, is TC17 (`ACLSuccession.t.sol`, 41 tests per line) | Mock | Done |
| R5 | Immediate | TC10: a carry batch of grants then `retireAccount()`; the reverse order reverts inside the same transaction. Off chain, the first evaluation after the retiring block refuses (TC14 "after N", both lines) | Mock; Connector | Done |
| R6 | Every role | TC4 and TC5: retired user, delegator, delegate and contract, per contract and wildcard; liveness getter 0. TC13: refused before the oracle on every path (v0.13.8 96/96, main 222/222). Permit role (TC6): the example has no on-chain permit view (`P0_1_TC13.md`), so TC6 runs on the Fhenix port | Mock; Connector; Vendor-2 | Done; TC6 on the Fhenix port (P2.1) |
| R7 | Grant paths revert | TC7: `SenderRetired` on `allow`, `allowForDecryption`, `allowTransient`, `delegateForUserDecryption` and `multicall`. TC9: every export of a fresh computation result reverts (12 paths, including the bridge on main) | Mock | Done, both lines |
| R8 | Inbound grants inert, never refused | TC8: `allow(h, retired)` succeeds and is inert; ERC-7984 transfers to a retired account succeed (OZ 0.5.3 vendored; unmodified OZ cross-check 7/7) | Mock | Done; also on stock OZ 0.5.3 with Profile A (P1.4) |
| R9 | Public decryption unchanged | `ACLRetirement.t.sol`: a handle published before retirement stays public | Mock | Done |
| R10 | Engine exemption by call semantics | TC9 (12 export paths) and the executor invariants (state-diff recording: every executor-to-ACL call names the direct caller; non-vacuity test). Fhenix: the dedicated operand-check entry point and the caller-identity negative test | Mock; Vendor-2 | Done on Zama and on the Fhenix port (P2.1) |
| R11 | Upgrades preserve state and enforcement | TC11: U0–U5 and U7 (asserted residual); OZ `validate` with a negative control | Mock | Done; U6 on the 0.5.1 line (P1.5) |
| R12 | ERC-165 | TC12, `test_ERC165`: true for `0x01ffc9a7` and `0x556d2088`, false for fuzzed ids; the Core id equals the XOR of the selectors. Constants re-checked with `cast` 1.8.5 | Mock | Done |
| R13 | Batching | TC10: the carry is atomic with three events; reverse order reverts; during a pause it reverts and changes nothing | Mock | Done |
| R14 | Raw getters | TC5: liveness getter returns 0 for a retired party. `allowedTransient` stays raw and is documented non-authoritative in natspec; `isAllowed` is false | Mock; Design | Done |

## Verifier (V1–V7)

| Req | What | Tests | Class | Status |
|---|---|---|---|---|
| V1 | Release rule; failures count as false | TC13 retirement part (above). TC13 failure part: errors, HTTP errors, dropped connections, timeouts, malformed JSON, empty or truncated results, reverts and intermittent failures on every view call; V1 cells main 110/110, v0.13.8 44/44, three runs each (`P0_1_TC13.md`) | Connector | Done, both lines. The claim for malformed answers holds only with strict decoding, as V1 now defines it |
| V2 | Freshness: evaluate after the request, no reuse across requests or decision blocks | TC14: every view at `latest` (wire); every attempt, restart and already-sent request evaluates again; L = 0 (`P0_2_TC14.md`) | Connector | Done, both lines |
| V3 | No exemption spoofing (`from`) | Wire evidence: none of the 4,579 `eth_call`s recorded in the P0.1, P0.2 and P0.4 runs carries a `from` field. Code: `HostRpcClient` builds plain calls (`rpc.rs:24-66`) | Connector | Done |
| V4 | No bypass across paths and schemes | TC13: legacy direct and delegated, RFC-016 direct and delegated, RFC-016 over HTTP; ERC-1271 and EIP-7702 accounts (P0.4: a retired account is refused by every verifier on every path). E3 route: P1.1 | Connector | Done, the E3 route included (P1.1) |
| V5 | Replicas | TC14 / P0.2 §V5: no decision path authorizes from a replica, index or cache on either line (connector, gateway, coprocessor, relayer, SDK); MultichainACL (v0.11) is not on any path | Design (code reading at both bases); Connector (live calls on the wire) | Done |
| V6 | Stored results (SHOULD; MUST under H) | TC15 V6 part (`P0_3_STORED_RESULTS.md`, three runs each). Unmodified: the main connector endpoint re-serves a stored result after retirement, and the relayer re-serves it to the same and to an equivalent request. With H7: both refuse. Shares already published on the gateway chain stay readable (limit 1). The verifier kit's TC15 fixture (P2.3): 35 conforming cells and 8 violations, all the unmodified verifier's | Connector | Done: unmodified does not meet the SHOULD on main; Level 1 meets the MUST |
| V7 | Final retirement denials (SHOULD; MUST under H) | TC15 V7 part: with Profile H a retirement denial is final and typed `account_retired`, and a simulated governance lapse does not revive it; the unmodified verifier retries it untyped and the lapse revives it (`PROFILE_H_CONNECTOR.md` §2). The verifier kit's TC15 fixture (P2.3): 35 conforming cells and 8 violations, all the unmodified verifier's | Connector | Done (unmodified does not meet the SHOULD; Level 1 meets the MUST) |

## Oracle (O1–O3)

| Req | What | Tests | Class | Status |
|---|---|---|---|---|
| O1 | Conformance per deployment: at least n−t nodes | TC16: share-collection simulation on real Shamir shares, n = 13, t = 4: a restriction binds iff k ≥ 9 (`results/level3/LEVEL3.md` §4). The reference deployment is n = 1 (ICS) | Mock (simulation); Design | Done as a simulation; no threshold deployment examined |
| O2 | ICS | The example ICS for the reference deployment, `ICS_REFERENCE_DEPLOYMENT.md` (moves to `assets/` in D1) | Design | Done (example) |
| O3 | Host-state diversity (SHOULD) | Not testable on the reference deployment, which reads one local node; the fault matrix (TC13) shows what a single source can do to answers | Design | Not met by the reference deployment, by construction; reason documented. A production ICS states its sources |

## Requirements without a test, and why

- **R2 "no function clears retirement"** and **R14's documentation clause** are statements about the absence of code. They are checked by reading the registry, and backed by the tests above.
- **R3 "no payment"** follows from `retireAccount()` being non-payable.
- **O3** needs several independent host-state sources per node, which the local deployment does not have.
