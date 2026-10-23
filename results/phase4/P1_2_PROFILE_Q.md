# P1.2: Profile Q in the connector (TC22)

**Proof class:**
- **Connector:** the kms-worker against a local EVM, on the VPS;
- **Mock:** the crate's tests on M1;
- **read-only mainnet aggregates:** the readiness number.

**Status:** done. **Date:** 2026-10-22. **Machines:** VPS (capped scope, anvil 1.3.5, rustc 1.99.1); M1 (Ryzen 5 5600).
**Raw data:** `raw/p12/`, `raw/census/`.

## 1. What was built

| Branch (worktree) | Commit | Content |
|---|---|---|
| `lifecycle/level3-verifier` (`impl/wt-l1-main`) | `719e68c1` | **Q4 in the shared signature crate.** `SignaturePolicy.profile_q` holds the variant and `B_Q`. A verification whose pinned block is at or after `B_Q` is decided by the signer's code at that block, whatever Profile H's mode |
| `lifecycle/level3-connector` (`impl/wt-l3-conn`) | `8f2483f3` | That commit, cherry-picked |
| | `e8a5a685` | **Profile Q in the kms-worker** (details below) |

**Q4 in the crate (`719e68c1`):**

| Signer's code at the pinned block | no-root-ecdsa | strict |
|---|---|---|
| None, or an EIP-7702 indicator (ECDSA-rooted) | refused, final, with no ERC-1271 call | the same |
| Other code, including an EIP-7851 `0xef0101` indicator | ERC-1271 only, with no fallback of any kind | refused, with no call |

- E3 signers pass the KDA route, which runs first, in both variants.
- H1 caps and H4 attempts still apply.
- There is a new final error, `ProfileQRefused`.
- Ten tests with a mocked provider pin the RPC sequence of each case.

**Profile Q in the kms-worker (`e8a5a685`)**, module `core/profile_q.rs`, setting `profile_q`:

- **Q1, the trigger.**
  - **What is signed.** One canonical statement: a tag, chain id, ACL, variant, `B_Q`, and the keccak256 of the ICS file.
  - **Who signs.** Each operator, with ML-DSA-65 (pure, empty context).
  - **When it engages.** At startup the worker counts distinct operators whose signature verifies, under its own K8 mode. The profile is established only if at least n − t = 9 verify, and only for a statement naming this node's chain, ACL and ICS.
  - **What cannot engage it.** The variant and `B_Q` come only from the signed bytes. No setting and no on-chain read can engage the profile (D34).
  - **Fewer than 9 never engage it.** Below the threshold, the worker logs `PROFILE-Q not established` and runs Profile H as before.
- **Q4, the paths.**
  - Profile H's check gets the profile for the chain.
  - Once the block is at or after `B_Q`, the legacy gateway path is refused outright: the gateway checks its signature by ECDSA only (D36).
- **Q5, the delegation cutoff.** It runs after the registry's delegated view answered true. At one pinned block N, the worker reads:
  - the delegator's code;
  - the block's timestamp;
  - `getVersion()`;
  - with `eth_getStorageAt`, the per-contract record and the wildcard record of `UserDecryptionDelegation` in Zama's ERC-7201 `ACLStorage` (D33, D37).

**The cutoff rule.**
- **Who it applies to.** Delegators with no code or an EIP-7702 indicator; and EIP-7851 delegators, since the block at which their key was disabled cannot be established (D35).
- **What counts.** A delegation counts only if a record is active at N and its `lastBlockDelegateOrRevoke` ≤ `B_Q`.
- **Failing closed.** Unknown ACL versions are refused. Refusals are final (`acl_denied`), because a record's last change can only move later.
- **Layout check.** The layout was checked identical in ACL v0.7.0 to v0.10.0 on `main`.

**Checks on M1 and the VPS:**
- the crate suite, 62/62 (Profile Q 10/10), with clippy (`-D warnings`) and rustfmt clean;
- the kms-worker unit tests for `profile_q`, 4/4: the slot against `cast index`, the record layout, the cutoff rule and the statement bytes;
- the kms-worker, clippy `--all-targets -D warnings` and rustfmt clean, with this project's generated harness files held out;
- Zama's own kms-worker suite on this tree, twice (the library and its eight test targets, with Docker unreachable for the tests, D27): 126 passed and 40 failed, both times.
  - The 40 failures are the same set as on the unmodified tree, which gives 122 passed and 40 failed (P1.1). All 40 stop at "Socket not found", the unreachable Docker.
  - The 4 extra passes are the `profile_q` unit tests above.

## 2. The connector runs [Connector]

**The test file.** `impl/harness/phase4/make_p12_tests.py` generates `results/phase4/harness/main-l3/crates/kms-worker/tests/acl_p12_profile_q.rs` from the Level 1 harness, with P0.4's and P1.1's helpers. Its `RequestHarness` passes a `profile_q` setting to every worker it starts. `impl/harness/phase4/vps/run_p12.sh` runs it.

**The test environment.** The Level 3 worker runs against a local anvil:
- the lifecycle ACL (main Level 0, v0.8.0);
- every RPC through the recording proxy;
- `eth_getCode` rewritten to `0xef0101` for the EIP-7851 rows;
- the connector endpoint for the HTTP rows.

**The ceremony runs inside the test.**
1. 13 operator ML-DSA-65 keys are generated from public test seeds (dilithium-py).
2. Each operator signs one statement per variant, for `B_Q` = 5 blocks after the setup.
3. The test checks its own encoding of the statement against the worker's.

The files are kept in each run directory: public keys, signatures and the ICS.

**Runs:** three, 151 rows each, every row as expected in every run. Table: `p12/P12_TABLE.md` (generated by `analyze_p12.py`).

### 2.1 Before `B_Q`

Established but not engaged: an ECDSA request and a legacy request are both served.

### 2.2 TC22: Q4, the refusals per path

| Request | no-root-ecdsa | strict | On the wire |
|---|---|---|---|
| A code-less ECDSA signer (Uk), event and HTTP | refused, final; HTTP `user_signature_rejected` | refused | one `eth_getCode`, no `isValidSignature` |
| An EIP-7702 account (X, `0xef0100`), its root key | refused, final | refused | no `isValidSignature` |
| The same account, its delegate's ML-DSA-44 signature | **refused** (ECDSA-rooted), final | refused | no `isValidSignature`; Profile H alone forwards this (P0.4) |
| X read as EIP-7851 (`0xef0101`), ML-DSA-44 | **forwarded** through ERC-1271 | refused, final | rewritten `eth_getCode`; one `isValidSignature` in no-root-ecdsa, none in strict |
| X read as EIP-7851, its (disabled) root key | refused (ERC-1271 negatives, retried) | refused, final | no fallback |
| E4's ML-DSA-44 ERC-1271 account (regular code) | **forwarded** | refused | one `isValidSignature` / none |
| A KDA request (E3), delegation before `B_Q` | **forwarded** | **forwarded** | the route's code read, then the cutoff's reads |
| The legacy gateway path, direct and delegated | refused, final (`PROFILE-Q refused path=legacy`) | refused | no host read beyond the block number |

### 2.3 TC22: Q5, the delegation cutoff

`B_Q` = block 25 in run 1. The delegations were made in blocks 18–20 (before) and 26–29 (after). The worker decodes each record's `lastBlockDelegateOrRevoke` from storage, and the decoded values equal the blocks of the delegation transactions.

| Delegator (code) → delegate | Made at | no-root-ecdsa | strict |
|---|---|---|---|
| U (none) → its KDA | before | forwarded | forwarded |
| U (none) → another KDA | after | **refused**, final; HTTP `acl_denied` | refused |
| U (none) → the ERC-1271 account | before | forwarded | refused by Q4 (the delegate is not E3) |
| V (none) → the ERC-1271 account | after | **refused** by Q5 | refused by Q4 |
| X (EIP-7851) → a KDA | before | forwarded | forwarded |
| X (EIP-7851) → a KDA | after | **refused** (every change counts) | refused |
| W (regular code) → a KDA | after | **forwarded**: not ECDSA-rooted, no cutoff | forwarded |

**The control.** With Profile Q off, the same ECDSA request is served.

### 2.4 The asserted on-chain residual (Q7)

After `B_Q`, a victim EOA R, which holds a handle, sends `allow(handle, attacker)`. The attacker is E4's ML-DSA-44 ERC-1271 account. On a host that accepts R's ECDSA, a forged transaction looks exactly like this one.

**The attacker's request is forwarded and would decrypt in no-root-ecdsa.** The worker sees a direct grant to a regular-code signer, and nothing in Q4 or Q5 applies to a grant. Phase 3's Foundry test showed the registry accepts the forgery; this run shows the oracle then serves it.

In strict, the same grant would need a contract account of the attacker's that delegates to its own KDA. Not run.

**What a host-chain EIP-7851 would close [I].**
- **For an account that disabled its key first, the door closes.** EIP-7851 (Draft; Specification) makes such a transaction one that "is invalid and must not be included in a block". Forging the grant or the delegation is then impossible.
- **For an unprepared EOA like R, nothing changes.** A key nobody disabled still signs. The on-chain door then closes only with a chain-wide ECDSA freeze, or with a retirement made beforehand (Phase 3).
- **P0.4's gap stays separate.** That is the off-chain verifier that recovers before reading code. Q4 closes it under Profile Q, and Profile H's `enforce` already closes it.

### 2.5 Q1: the ceremony

| Statement file | Counted | Established | The ECDSA request after `B_Q` |
|---|---|---|---|
| 13 signatures | 13/13 | yes | refused |
| 9 signatures | 9/13 | yes | refused |
| 8 signatures | 8/13 | **no** | served |
| 8 + one corrupted signature | 8/13 | no | served |
| 8 + an intruder's key under operator 8's index | 8/13 | no | served |
| 8 + a duplicate of operator 0 | 8/13 | no | served |
| 9 signatures over another `B_Q` | 0/13 | no | served |
| 13 signatures, the worker's ICS different | 0/13 | no (ICS) | served |
| 13 signatures, another ACL named | 0/13 | no (ACL) | served |

### 2.6 Partial adoption: k of 13 workers enforce

All 13 workers run for real, one database each on the shared Postgres (D38). The first k enforce Profile Q (no-root-ecdsa); the others run Profile H without it. The forwarding workers' shares are checked with Phase 3's Shamir code: n = 13, degree t = 4, GF(2^127 − 1).

| k | ECDSA request: forwarding workers | Released | KDA request | Phase 3's rule (release iff 13 − k ≥ 5) |
|---|---|---|---|---|
| 0 | 13 | yes | 13, released | agrees |
| 4 | 9 | yes | — | agrees |
| 5 | 8 | yes | — | agrees |
| 8 | 5 | **yes** | — | agrees |
| 9 | 4 | **no** | — | agrees |
| 13 | 0 | no | 13, released | agrees |

**What this shows.**
- **Up to k = 8, unmigrated users still decrypt.** Profile Q protects only from n − t = 9 enforcing operators. Measured
  at k = 0, 4, 5 and 8 (released) and k = 9 and 13 (refused) [M]; the other k values follow the threshold rule
  13 − k ≥ 5 [I].
- **Below that, partial adoption only removes availability.** Phase 3's simulation quantified that cliff.
- **Post-quantum requests were served at both measured ends, k = 0 and k = 13 [M].** At the other k values this follows
  from Q4, which passes E3 requests whatever k is [I].

## 3. The readiness indicator (Q2) [M, read-only mainnet aggregates]

**The method** (`impl/harness/phase4/census_p4.py`, my own Python rewrite of the Phase 2 census):
1. **Events.** `eth_getLogs` on the mainnet ACL (v0.4.0) for `Allowed`, `AllowedForDecryption`, `DelegatedForUserDecryption` and `RevokedDelegationForUserDecryption`, from block 23,832,647 to the head, with the same two endpoints and the same splitting.
2. **Definitions.** Phase 2's: end accounts, excluding self-allows and the two operations callers.
3. **Active.** A real end account that received a handle in the 90 days before the head.
4. **Code.** Each active account's code at the head, from `eth_getCode`.
5. **ERC-1271 probe.** Each contract gets one probe: `isValidSignature` with a 2,420-byte signature (the ML-DSA-44 size) at Profile H's gas (2,183,048) and at Zama's 250,000.

**Limits of the run:**
- at most 8 calls a second;
- no transaction;
- raw rows kept outside the project, and only aggregates in `raw/census/census_p4_aggregate.json`.

**The pipeline reproduces Phase 2 exactly.** On Phase 2's block range (to 26,237,004) it finds the same 939,889 events, 455,183 self-allows, 336 callers, 12,792 receiving accounts, 12,720 end accounts and 12,714 real ones.

**The head:** block 26,243,993, 2026-10-21 22:33 UTC; 945,966 events and 12,730 real end accounts.

| Active end accounts (90 days) | Count | Share | Their handles |
|---|---|---|---|
| No code (ECDSA) | 1,216 | 71.0% | 123,028 |
| EIP-7702 delegated (ECDSA-rooted) | 414 | 24.2% | 13,771 |
| EIP-7851 (ECDSA disabled) | **0** | 0% | 0 |
| Contracts | 83 | 4.8% | 14,264 |
| **All** | **1,713** | | 151,063 |

**The ERC-1271 probe on the 83 contracts.** 75 revert with no data, 7 revert with data, and 1 returns a word. The results are the same at both gas levels: the 8 that answer do so cheaply, without running a post-quantum verification.

**The readiness indicator, mainnet, 2026-10-21:**

| Measure | Value |
|---|---|
| Active decryptors with a **proven** post-quantum-capable route | **0 (0.0%)**: no EIP-7851 account; no KDA declaration can be identified (E3 is deployed nowhere, and a KDA cannot be told from an EOA by its address); no contract is known to verify a post-quantum signature |
| Upper bound: contracts whose ERC-1271 answers a post-quantum-sized signature within `B_exec` | 8 accounts, **0.47%** of active accounts and **0.03%** of their handles |
| Active delegation records at the head | 695 |

**Verdict.** Q2's precondition is far from met on mainnet today. Only mainnet was counted; other host chains are not.

## 4. What this does not show

- **One host chain and one oracle node per worker.** The 13 workers are in-process instances run one after another, and the KMS's share combination is simulated.
- **EIP-7851 is simulated at the proxy**, as in P0.4. The host chain's own refusal of a disabled key's transactions is not run.
- **The strict variant's residual (Q7) is not run.** It needs an attacker contract that delegates to its own KDA.
- **The cutoff reads storage, not a getter.** That works for the layouts checked. A future ACL with another layout is refused until it is added (D33).
- **Q2's other preconditions are operator facts, not code:** the notice period, the recovery path, timelocks.

## Evidence

| What | Where |
|---|---|
| Table | `p12/P12_TABLE.md`, `.json` |
| Connector runs | `raw/p12/runs/p12-main-l3-r{1,2,3}-*/` (test.log, host_rpc.jsonl, provenance, the ceremony's files) |
| Builds, unit tests, clippy, rustfmt | `raw/p12/logs/` |
| Zama's kms-worker suite on this tree | `raw/p12/zama-suites/` |
| Census | `raw/census/census_p4_aggregate.json` |
