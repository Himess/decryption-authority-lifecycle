# Level 3: certificate, governance, PQ-native signer, Profile Q

**Status.** Done for the prototype, in the parts below. Every part runs locally (anvil, Foundry, Rust tests).

| Part | What exists | Evidence [M] |
|---|---|---|
| **(c) E2, the retirement certificate** | ACL v0.10.0 with `retireAccountWithSig` on main (`lifecycle/level3`) and a watchtower that relays certificates | 13 Foundry tests (TC19, TC24); the ERC's vector reproduced in Solidity and in ethers; the watchtower on three real anvil chains; gas |
| **(d) Governance profile** | A timelock owning the ACL and, through it, the executor; the guard through the timelock; an operator canary script with implementation pinning | 6 Foundry tests; the canary on anvil across five upgrades |
| **(a) E3, the KDA route** | The verifier-side route in the shared signature crate (`lifecycle/level3-verifier`, `kda` feature) | 11 tests, including the 180 Wycheproof ML-DSA-44 vectors |
| **(b) Profile Q** | A share-collection simulation (n = 13, t = 4), and the on-chain door residual | the TC16 rule, the partial-adoption cliff, 2 Foundry tests (TC22) |
| **Native PQ verification** | A rerun of deliberation agent A5's benchmark, done personally | section 5 |

**Not done at this level:**
- **E3 in the connector.** Wiring the route into kms-worker, and the oracle-level parts of TC20: retirement and revocation
  disabling KDA permits end to end. The registry side of both is Core and E1 behaviour already proven at Levels 0 and 2.
- **ACVP vectors** for ML-DSA, and Wycheproof vectors for ML-DSA-65 and -87, which are not available offline here. Those
  two parameter sets are covered by sign-and-verify round trips.
- **Profile Q as an operator policy in the connector.** That includes PQ-signed operator statements and the readiness
  KPI.
- **E2 on the v0.13 line.**

Labels:
- **[M]:** measured on M1 (AMD Ryzen 5 5600, Windows 10 Pro 19045) on 2026-10-21 with forge/anvil 1.8.5, solc 0.8.24,
  Node 22.13.0 and Rust 1.95.0.
- **[E]:** estimated.
- **[I]:** inference.

## 1. E2, the retirement certificate

### 1.1 Code

**Branch.** `lifecycle/level3` in `impl/wt-l2-main` (fhevm main), on top of Level 2:

| Commit | Change |
|---|---|
| `5cd12ed` | the ERC-165 fuzz test excludes every declared id. It was latent since E1: the fuzzer draws PUSH4 constants from the bytecode, and E2's id came up |
| `3d08580` | **ACL v0.10.0:** `retireAccountWithSig`, errors, ERC-165 `0x4b9ec076`, reinitializer 11 with `reinitializeV10()` (no new state); the v0.9.0 fixture; the upgrade matrix (U9); version pins |
| `0d02f3e` | `ACLRetirementCertificate.t.sol`, `CertificateMocks.sol` |
| `53f389d` | `ACLGovernance.t.sol`, `GovernanceMocks.sol` (section 2) |
| `f1b440e` | `ACLProfileQResidual.t.sol` (section 4) |

**The function.** The checks run in the draft's order (C4):
1. not retired;
2. `block.chainid` listed;
3. the confirmed successor, non-null;
4. the signature, code-first. No code means a 65-byte low-s ECDSA signature, checked by OpenZeppelin 5.1.0
   `SignatureChecker`. Any code, a 7702 indicator included, means ERC-1271 with no fallback.

**The domain.** The EIP-712 domain is the chain-agnostic `("DecryptionAuthorityLifecycle", "1")`. The type hash and
domain separator are the ERC's constants.

**The effects** are those of `retireAccount()`, through one shared internal `_retire`.

**What it does not do.** It is not pause-gated, and it has no nonce, no expiry and no cancellation.

### 1.2 Tests [M]

**13 tests in `ACLRetirementCertificate.t.sol`.** They pass with `FOUNDRY_ISOLATE=false` and under Foundry's default
isolation.

| Test | Shows |
|---|---|
| `test_TC19_ErcVector` | **The ERC's published vector:** account and successor from the public test mnemonic, chains `[1, 11155111]`. The digest matches; it is refused on 31337 with `CertificateWrongChain(31337)` and accepted on 11155111, emitting `AccountRetired(account, successor)` |
| `test_TC19_SupportsInterface` | `0x4b9ec076` declared; the selector and the three error selectors match the ERC |
| `test_TC19_WrongChain` | an unlisted chain, and an empty list, revert |
| `test_TC19_SuccessorMismatch` | naming another address reverts with `(confirmed, certified)` |
| `test_TC19_NoSuccessor` | **Accounts without a successor retire directly.** A null successor reverts, and so does a pending, accepted designation |
| `test_TC19_InvalidSignatures` | another key; 64-byte EIP-2098; high-s (the malleated twin); signed over another chain list. All revert `InvalidRetirementCertificate`; the valid one works |
| `test_TC19_Erc1271Account` | a wallet whose owner signs. A wrong key is refused; the owner's signature works |
| `test_TC19_DelegationIndicatorAccount_NoEcdsaFallback` | **No ECDSA fallback.** A 7702 account whose delegate refuses everything refuses the root key's valid ECDSA signature. With a root-key delegate it works |
| `test_TC19_WorksWhilePaused` | the certificate works while the registry is paused |
| `test_TC19_SecondSubmissionReverts_SubmitterIrrelevant` | a retired relayer relays successfully; a second submission reverts and emits nothing |
| `test_TC19_LeakedCertificate_OnlyPlannedHandover` | **A thief who relays a leaked certificate gets nothing.** Only the confirmed successor reads, and the account can no longer designate |
| `test_TC24_RetireOnOneChainOnly_OtherChainUnaffected` | two chains as two states of one registry (a snapshot restored). A retirement on A leaves B untouched |
| `test_TC24_OneCertificateRetiresOnEveryListedChain` | one certificate retires on both listed chains and reverts on an unlisted third |

**The upgrade (U9) [M].**
- `test_U9_v090_to_v0100_SuccessionStatePreserved_CertificateWorks`: E1 state written under v0.9.0 is intact after the
  upgrade (a confirmed successor, a pending designation with its `confirmableAt`, a raised delay). A certificate works
  right after it.
- `test_reinitializeV10SucceedsOnUpgradePath`: 10 → 11, and a second call reverts.

**Suites [M]:**
- **Full host-contracts suite: 874/874** (`raw/L3_forge_full_main.log`), with `FOUNDRY_ISOLATE=false` as everywhere
  here.
- **OpenZeppelin `validate`:** v0.10.0 is upgrade-safe from v0.9.0, v0.8.0 and v0.7.0. The reverse direction fails, as a
  negative control (`raw/L3_oz_validate_main.log`).
- **Zama's CI upgrade check** with `lifecycle/level2` as the baseline: "ACL: bytecode CHANGED … All contracts passed
  upgrade version checks" (`raw/L3_upgrade_version_check_main.log`).
- **Prettier** passes on every lifecycle Solidity file.

### 1.3 Gas and size [M]

Receipts on anvil with the production artifacts (solc 0.8.24, 800 runs, cancun), 21,000 and calldata included
(`raw/L3_gas_anvil_e2_{prague,osaka}.json`):

| Transaction | Prague | Osaka | Calldata |
|---|---|---|---|
| `retireAccount()` (v0.10.0) | 54,514 | 54,514 | 4 B |
| `retireAccountWithSig`, EOA, 1 chain | 65,560 | 65,584 | 324 B |
| `retireAccountWithSig`, EOA, 2 chains | 65,742 | 65,754 | 356 B |
| `retireAccountWithSig`, EOA, 5 chains | 66,277 | 66,277 | 452 B |
| `retireAccountWithSig`, ERC-1271 wallet, 1 chain | 68,015 | 68,015 | 324 B |

**What the numbers say:**
- **`retireAccount` costs 50 gas more than at v0.9.0** (54,464, `LEVEL2_E1.md`). That is the shared internal `_retire`.
- **A certificate costs about 11,000 gas more than a direct retirement,** plus about 180 gas per extra listed chain.
- **The certificate is 65 bytes of signature plus its fields.** A transaction carrying it is 324–452 bytes of calldata
  for 1–5 chains. The ERC estimates 200–300 bytes [E], which is the certificate itself, without the call's ABI framing.

### 1.4 The watchtower [M]

**The tool.** `impl/watchtower/watchtower.mjs` holds an account's pre-signed certificate.
- **`relay`** sends it to every listed chain where the account is not retired.
- **`watch`** polls for compromise signals and then relays:
  - a grant by the account;
  - a wildcard or non-expiring delegation by the account;
  - an observer change on a watched token.
- **It never needs the account's key.** Any funded relayer works.

**The harness** (`impl/harness/level3/watchtower_e2e.mjs`, `raw/L3_watchtower_e2e.json`) runs three real anvil chains,
31337, 31338 and 31339, with ACL v0.10.0 on each. The account confirms the same successor on all three, then signs one
certificate for 31337 and 31338.

| Step | Result |
|---|---|
| The ERC vector in ethers | the digest and the **signature match the ERC's published values byte for byte** (deterministic RFC 6979, public test key) |
| A quiet pass | no signal, nothing relayed |
| **The thief**, holding the key, makes a wildcard, non-expiring delegation to itself on 31338 | detected at the next pass ("wildcard delegation", block 9). Relayed to 31337 (65,754 gas) and 31338 (65,867 gas); 31339 skipped as not listed. **Detection plus relaying took 376 ms** |
| After the relays | 31337 and 31338: retired, the **successor reads, the thief's delegation reads nothing**, and the account is unusable. 31339: untouched |
| Relaying again | "already retired" on both: idempotent |
| The command line on a second account | exit 0; retired on 31337 and 31338, not on 31339 |

**The window [M] [I].**
- Between the thief's transaction and the relays, the thief's delegation was live for one block: the harness confirmed
  it before relaying.
- A certificate does not protect what a thief decrypts in that window. That is the "protecting the past" limit of
  TARGET §4.4 (c): off-chain permits need no transaction, and a decryption completes in seconds.

## 2. Governance profile [M]

**Foundry, 6 tests in `ACLGovernance.t.sol`** (`raw/L3_forge_governance.log`). They pass in both isolation modes.

**Setup.** An OpenZeppelin `TimelockController` with a 7-day minimum delay takes ownership of the ACL. Ownable2Step's
`acceptOwnership` runs through the timelock itself.

| Test | Shows |
|---|---|
| `test_Gov_TimelockOwnsTheACL_DelayEnforced` | the old owner's upgrade reverts; a scheduled upgrade cannot execute one second early, and executes at 7 days |
| `test_Gov_ExecutorFollowsTheACLOwner` | through `ACLOwnable`, the FHEVMExecutor's upgrade also needs the timelock |
| `test_Gov_GuardBlocksACorelessUpgradeThroughTheTimelock` | **the guard holds through the timelock:** a Core-less v0.7.0 implementation reverts `UpgradeDropsRetirement` at execution |
| `test_Gov_Canary_HonestUpgrade` | a ratified release: the canary passes, and so does pinning |
| `test_Gov_Canary_CatchesTheLyingUpgrade` | **a liar that passes the guard** (v0.7.0 code claiming Core and the location) stops enforcing retirement. The canary catches it |
| `test_Gov_Canary_MissesTheBackdoor_PinningCatchesIt` | **a backdoored release that spares the canary:** every canary view passes while the backdoor reads the canary's handle. Only pinning catches it |

**The canary script** (`impl/canary/canary.mjs`) runs on anvil (`impl/harness/level3/canary_e2e.mjs`,
`raw/L3_canary_e2e.json`). The canary is a retired account with a handle and a pre-retirement delegation.

| Upgrade | Canary views | Pinning | Verdict |
|---|---|---|---|
| none | pass | pass | OK |
| an honest redeploy, not yet ratified | pass | **fail** | HALT |
| the same release, after the operators ratify it | pass | pass | OK |
| the Core-less liar | **all four fail** | fail | HALT |
| the ratified release again | pass | pass | OK |
| a backdoored release (the backdoor reads) | pass | **fail** | HALT |

**Cost [M]:** 6 RPC calls per run: the 4 views, plus `eth_getStorageAt` and `eth_getCode` for pinning. The draft
estimated about 4 `eth_call`s per upgrade [E].

**Finding: pinning must be by deployed implementation, not by bytecode.**
- A UUPS implementation embeds its own address in its runtime code (OpenZeppelin's `__self` immutable). Two deployments
  of the same source therefore have different runtime code hashes: measured, `sameSourceDifferentCodeHash: true`.
- So operators pin the announced implementation, by address and code hash, during the timelock delay before it
  executes.
- The alternative is to compare bytecode with the immutables masked.
- TARGET §4.4 (d) now says so.

## 3. E3, the declared decryption signer (KDA route)

**Code.**
- **Where.** `lifecycle/level3-verifier` in `impl/wt-l1-main`, commit `a8e1f34`, on top of Level 1. The crate is
  `shared/user-decryption-signature`, behind the off-by-default `kda` feature. RustCrypto `ml-dsa` 0.1.1 is unaudited.
- **K1 and K2.** `scheme_id` and `key_derived_address` with the draft's provisional tags; `signerBytes = verifierId ‖
  publicKey`.
- **K5, `select_route`.** It takes the route only when all of these hold:
  - the signature is not 65 bytes and decodes as `abi.encode(bytes, bytes)`;
  - its KDA is the requester;
  - the requester has no code;
  - no entry names the requester as owner;
  - the scheme is enabled.

  Otherwise Profile H decides. Profile H refuses every KDA-shaped request, because a code-less requester with a
  non-65-byte signature never verifies there.
- **K6.** Pure ML-DSA-44, -65 or -87, with an empty context, over the 32-byte EIP-712 digest. A failure is final.
- **`verify_with_kda`.** It puts the route in front of `verify_user_decryption_signature` without changing either
  existing API.

**Tests [M]: 11 in `tests/kda.rs`.**
- **The crate:** 15 + 20 tests (default features), 15 + 11 + 20 (`kda`). Clippy `-D warnings` passes for both feature
  sets, and so does rustfmt (`raw/L3_kda_crate_checks.log`).

| Test | Shows |
|---|---|
| `scheme_ids_and_kda_match_independent_values` | the scheme ids equal values computed independently with ethers; the KDA formula |
| `wycheproof_mldsa44_all_vectors_agree` | **180 of 180 Wycheproof ML-DSA-44 vectors agree** (C2SP upstream file; its SHA-256 and keccak are pinned). The 172 with an empty context go through the route's own verifier; the 8 with a context go to the library directly |
| `route_accepts_each_scheme_reading_only_the_requester_code` | ML-DSA-44, -65 and -87 are each accepted with exactly one RPC, `eth_getCode` |
| `failed_signature_is_final_with_no_fallback` | **a wrong digest is a final rejection** after the code read, with no other call (the mock fails any extra one); a malformed signature is final |
| `direct_entry_is_refused` | **a KDA named as owner is never a root:** the route is skipped and Profile H refuses, with the exact RPC sequence |
| `scheme_not_enabled_is_refused`, `another_requester_is_refused_without_the_route_read` | skipped, then refused |
| `requester_with_code_does_not_take_the_route` | K5 |
| `ordinary_ecdsa_request_is_unaffected` | **an EOA's 65-byte signature still verifies with zero RPC** |
| `disabled_route_leaves_profile_h_alone` | with no scheme enabled, the route is off |
| `unmodified_verifier_fails_closed` | **Zama's RFC-012 `verify_signature` refuses a KDA request** |

## 4. Profile Q [M]

### 4.1 The share-collection simulation (TC16, O1)

**Method.** `impl/harness/level3/profile_q_sim.py` (`raw/L3_profile_q_sim.json`) uses real Shamir sharing over GF(2^127
− 1): a degree-4 polynomial, one share per operator, Lagrange at 0. A model of the threshold rule only; it stands in for
the KMS's threshold decryption.
- n = 13, t = 4.
- k operators refuse an ECDSA-rooted request.
- Each operator is down with probability q.

| k refusing | answering | release, q = 0 | release, q = 1% | release, q = 5% |
|---|---|---|---|---|
| 0–4 | 13–9 | yes | 1.000000 | ≥ 0.999967 |
| 5 | 8 | yes | 0.999999 | 0.999628 |
| 6 | 7 | yes | 0.999966 | 0.996243 |
| 7 | 6 | yes | 0.998540 | 0.967226 |
| **8** | **5** | **yes** | **0.950990** | **0.773781** |
| **9–13** | 4–0 | **no** | 0 | 0 |

The release columns are exact values. 20,000 Monte Carlo trials per cell agree within 4 standard errors.

**What it shows:**
- **TC16's rule:** reconstruction succeeds if and only if k ≤ 8. A restriction binds only at k ≥ n − t = 9 operators.
- **The partial-adoption cliff, quantified.**
  - With 5–8 enforcing operators, unmigrated users still decrypt: no protection.
  - Their availability already falls, to 77% at k = 8 with 5% outages.
  - Degradation therefore comes before protection.

### 4.2 The on-chain door (TC22, asserted residual Q7)

`ACLProfileQResidual.t.sol` has 2 tests, passing in both isolation modes.

**The residual.** On a host that accepts ECDSA, forged transactions from an unprepared victim do two things:
- grant the victim's handle to the attacker's post-quantum account;
- delegate to the attacker's KDA.

The registry accepts both, so an oracle under Profile Q would serve the attacker.

**The counter-case.** A retirement made beforehand closes both paths (`SenderRetired`).

**The limit [I].** Profile Q closes the off-chain door. The on-chain door closes only with a host-chain ECDSA freeze, or
with preparation done before it.

## 5. Native PQ verification: A5's benchmark, rerun [M]

The deliberation's native-verification numbers ([M-A5], TARGET §4.4 (a)) were measured by an agent. I rebuilt its
benchmark offline from the same source (`impl/bench-pq/a5_native_verify`, `src/main.rs` SHA-256 `68cd6259…cedc`, release
build, thin LTO) and ran it twice myself on M1. Raw output: `raw/L3_pq_bench_run{1,2}.txt` and
`raw/L3_pq_wycheproof.txt`.

**Median µs per verification of a 32-byte digest:**

| Verification | Run 1 | Run 2 | A5's two runs |
|---|---|---|---|
| `ecrecover`, k256 0.13.4 (Zama's current path) | 175.6 | 174.7 | 177–213 |
| `ecrecover`, libsecp256k1 | 52.1 | 52.0 | 53–55 |
| ML-DSA-44, decode and verify (cold) | 79.5 | 79.4 | 82–85 |
| ML-DSA-44, declared-signer path (keccak check + cold) | 82.4 | 82.7 | 84.2, 89.2 |
| ML-DSA-65, declared-signer path | 131.3 | 139.9 | 133.3, 142.0 |
| ML-DSA-87, declared-signer path | 215.8 | 209.9 | 263.7, 221.1 |
| SLH-DSA-SHA2-128s | 141.1 | 141.8 | 150–157 |
| SLH-DSA-SHA2-128f | 388.4 | 389.3 | 402–411 |
| SLH-DSA-SHAKE-128f | 4,219 | 4,251 | 4,500–4,700 |
| FN-DSA-512 (fn-dsa 0.4.0, pre-standard) | 11.3 | 11.3 | not in TARGET |

**Wycheproof.** The ML-DSA-44 vectors give 180/180 agree (77 valid accepted, 103 invalid rejected) on this binary, and
180/180 again through the crate's own route (section 3).

**What the rerun confirms:**
- **A5's conclusions hold.** Native ML-DSA-44 verification is cheaper than the k256 `ecrecover` Zama uses today, and
  slower than libsecp256k1.
- **The order of the schemes is the same.**
- **My medians are 2–10% lower** than A5's, consistent with a less loaded machine. A5's notes say other agents may have
  been running.
- **Every library here is unaudited:** RustCrypto `ml-dsa` 0.1.1 and `slh-dsa` 0.2.0-rc.5, and `fn-dsa` 0.4.0
  (pre-standard).

## 6. Corrections and findings for the documents

1. **Pinning is per deployed implementation** (address and code hash), ratified during the timelock delay, or uses
   bytecode with the immutables masked. TARGET §4.4 (d) is updated.
2. **The canary costs 6 RPCs per run** [M]: 4 views plus 2 reads for pinning. The draft estimated 4.
3. **Certificate calldata is 324–452 bytes for 1–5 chains** [M]. The draft's 200–300 bytes [E] is the certificate alone.
4. **The ERC's E2 vector is correct.** It was reproduced independently in Solidity and in ethers.
5. **The ERC-165 fuzz test** must exclude every declared extension id. It was latent since E1.
6. **The partial-adoption cliff of Profile Q** is quantified (section 4.1).

## 7. Reproduction (from `fhe-authority-lifecycle/`)

**Foundry (main, `lifecycle/level3`).**

```bash
FOUNDRY_ISOLATE=false forge test --root impl/wt-l2-main/host-contracts
```

**Release checks and the production build.**

```bash
bash impl/harness/level3/release_checks.sh
```

**anvil harnesses** (the artifacts must come from a build run inside `host-contracts`):

```bash
node impl/harness/level3/watchtower_e2e.mjs impl/.tools/build/main-l3-runs800 18681 results/level3/raw/L3_watchtower_e2e.json
node impl/harness/level3/anvil_gas_e2.mjs impl/.tools/build/main-l3-runs800 prague 18691 results/level3/raw/L3_gas_anvil_e2_prague.json
node impl/harness/level3/canary_e2e.mjs impl/.tools/build/main-l3-runs800 18695 results/level3/raw/L3_canary_e2e.json
```

**The KDA route.**

```bash
CARGO_TARGET_DIR=impl/.tools/target-l3 cargo test --offline --locked --features kda --manifest-path impl/wt-l1-main/shared/user-decryption-signature/Cargo.toml
```

**Profile Q.**

```bash
python -I impl/harness/level3/profile_q_sim.py results/level3/raw/L3_profile_q_sim.json 20000
```

**The v0.9.0 fixture**, regenerated with the Level 0 tool:

```bash
python -I impl/harness/level0/make_fixtures.py <fixtures dir> "ACL_v0_9_0=<git show lifecycle/level2:host-contracts/contracts/ACL.sol>|<label>"
```
