# B1–B6: the post-quantum path, end to end

Date: 2026-10-22. Proof classes: **Connector** and **Mock** [M] for everything run; **[I]** for what only a host chain
enforcing EIP-7851 or EIP-8298 would do; **Design** for the B2 question (D98).

The drill matrix is `results/phase5/PQ_DRILL_MATRIX.md`. Costs are in `B8_COSTS.md`; the test wallet in `B0_PQ_WALLET.md`;
the successor-signer question in `B2_SUCCESSOR_SIGNER.md`.

## How it was run

**Connector drill [M] (Connector).** The real kms-worker of Phase 5, on the VPS.
- **Tree.** `fhevm-main-l5`: Level 3 (Profile H with H6 and H7, E3 with K8, Profile Q) plus the Q5 fix of D99 (branch
  `lifecycle/phase5-connector`, `a4416155`), on `main` `ed851716c`.
- **Registry.** Our Level 3 ACL v0.10.0 (Core, E1, E2), built from `lifecycle/level3`
  (`results/phase5/vps-artifacts/level3_acl_main.json`, SHA-256 `f47b8087…`); anvil 1.3.5.
- **Generator.** `impl/harness/phase5/make_pq_drill_tests.py` writes the test,
  `results/phase5/harness/main-l5/crates/kms-worker/tests/acl_pq_drill.rs`.
- **Scope.** One scenario on one chain: every path, the old key's requests and transactions, Profile Q at B_Q, 13
  workers with k = 8 and k = 9 enforcing, Q5 for adopted code and for a succession.
- **Runs.** Three: `pq-drill-r{1,2,3}-*` in `raw/pq-drill/vps/`.
  - Each run: 258 request rows (102 scenario rows, 156 per-worker adoption rows) and 40 transactions. `mismatches=0`.
  - A first attempt failed on a key-declaration expiry below the chain's time after the 7-day jump. It is kept as
    `superseded-…-expiry` and replaced: the harness, not a finding.
  - Analysis: `results/phase5/pq-drill/PQ_DRILL_CONNECTOR.{md,json}` (`analyze_pq_drill.py`): **258/258 request
    rows and 40/40 transactions conform in all three runs.**

**Local drill [M] (Mock).** M1, `impl/harness/phase5/pq-drill-local/`, vitest, three runs per fork.
- **Forks.** Osaka on anvil 1.8.5; Local-Amsterdam on the Foundry nightly `9089a6b`.
- **What it runs:**
  - the real carry tool (`impl/carry-tool/carry.mjs`) and watchtower (`impl/watchtower/watchtower.mjs`);
  - the SDK (`getAuthorityStatus` and the Profile H precheck);
  - B5 with the canary;
  - the old key's transactions;
  - the B8 receipts and gas meter.
- **Result.** 9/9 tests per run. **81/81 rows conform** under each fork (`results/phase5/pq-drill/PQ_DRILL_LOCAL.md`).

Every key, wallet and contract is ours, on local chains. Our own test keys play the old key, the attacker and the
operators.

## The four properties, path by path

The brief's properties (§4.1), with the old ECDSA key assumed known to someone else:

| Property | B1 carry, retire | B2d successor, retire | B2c successor, certificate | B3a in place, EIP-7851 | B3b in place, EIP-8298 |
|---|---|---|---|---|---|
| **1. Off-chain:** nothing released on the old key | **holds** (R1–R6 refused) | **holds** | **holds** | **holds for the key's own signatures** (R1–R5 refused); A's earlier delegations stand until the holder revokes them (R6, residual) | as B3a |
| **2. On-chain:** the old key creates no right | **holds** (T1–T6 and T8 revert; T7 only narrows) | **holds** | **holds** | **does not hold on this chain** (T1–T4, T7, T8 mined); holds only where the host chain enforces EIP-7851 [I] | **does not hold on this chain**; holds only where the host chain enforces EIP-8298 [I] |
| **3. Continuity:** the holder decrypts past and future with a post-quantum signature | **holds** for the carried history (P1, P2); later grants to A are inert by design (P3) | **holds** (P1; P3 reaches W as successor) | **holds** | **holds** (P1, P2, P3) until the old key retires A (P4, residual) | as B3a |
| **4. Upgrade safety** | **holds** in the local runs (B5) for the registry under the operator-ratified owner; the limit below applies | the same | the same | the same | the same |

**The residuals, in one place** (each one's cause and closure is in the matrix's notes):
- **B3, on chain (property 2).** The old key still sends transactions on a chain that does not enforce EIP-7851 or
  EIP-8298. So it can grant, publish, delegate, designate, narrow permits and retire.
  - Closed only by a host chain that enforces the EIP [I].
  - Profile Q narrows the effects: it refuses ECDSA-rooted readers, and the old key's new delegations on B3a. It does
    not close the door.
- **B3, earlier delegations (property 1).** A delegation A made before migrating stands, because A is not retired.
  Closed by the holder's revocation through `execute` (U-R6).
- **B3, availability (property 3).** On such a chain the old key can retire A (T8), which ends the wallet's authority
  too (P4). It can also void the holder's earlier permits (T7).
- **Upgrade safety (property 4)** holds for what B5 tests: the owner contract, the guard and the canary. It stops at
  the governance handover. Moving the registry's ownership to the operator-ratified contract is a transaction of the
  current owner, an ECDSA multisig today, and until it happens that owner can upgrade freely. The guard checks that a
  new implementation declares Core's interface and the same retirement storage location: it stops an accidental release,
  not one that lies (U7). The canary checks the views it calls.

## B1: migrate out, with carry

1. **The carry.** The EOA A holds three handles and has delegated to D; V, which holds a handle of its own, has
   delegated to A. The carry tool sends one caller-preserving `multicall`: `allow(h, W)` for each kept handle, then
   `retireAccount()`.
   - It verifies the result.
   - Gas: 156,448 under Osaka, 503,316–503,328 under Local-Amsterdam (B8).
2. **W decrypts the history.**
   - **(i) As itself, through ERC-1271 under Profile H's budget:** P1 served for every carried handle, over the
     RFC-016 on-chain path and over HTTP (P1h). Three runs.
   - **(ii) Through E3:** W sends `delegateForUserDecryption(KDA, dapp, expiry)` through its own `execute`, relayed.
     The KDA's ML-DSA-44 request is verified natively, with K8 agree mode: P2 served. Three runs.
3. **The old key afterwards.**
   - Every request is refused: R1–R5; R2 typed `account_retired`.
   - R6 is refused: D read for A through A's delegation, and A is retired.
   - Every transaction reverts: `SenderRetired`, or `AccountAlreadyRetired` for T6 and T8.
   - The exception, T7 `invalidateDecryptionSignaturesBefore`, is mined. It can only narrow, and A is retired.
4. **A handle granted to A after the migration (P3) is refused.** A grant to a retired account is inert (R8). The
   application grants to W, or A names W as successor too.

## B2: migrate out, with a successor

1. A designates W (62,128 gas).
2. W accepts through its own `execute`, relayed (about 1.34M gas, B8).
3. The test advances time by D = 7 days (604,800 s).
4. A confirms (57,256 gas). Then:
   - **B2d:** A retires (`retireAccount`, 54,516 gas).
   - **B2c:** A's E2 certificate, signed while the key was safe, is relayed by the real watchtower (65,610–65,622
     gas).
5. **W reads A's handles on the successor path,** ERC-1271 under Profile H's budget: P1 and P1h served, three runs
   each, on both variants.
6. **A handle granted to A after the migration reaches W (P3 served):** the registry's delegated view answers for the
   confirmed successor (E1, S8).
7. **W's own KDA does not reach A's handles (P2 refused),** as S9 requires.

**The design question** (may a confirmed successor authorize with its own declared signer?) is **answered no**
(D98, `B2_SUCCESSOR_SIGNER.md`). The rule would let W give lasting access to A's history to third parties: the
transitivity S9 forbids and D14 rejected. What it would save is the verifier's ERC-1271 call per request. Carrying
before retiring with a successor avoids that cost for the bulk of the history.

**The old key afterwards:** as B1. Every request is refused, and every transaction reverts except T7.

## B3: migrate in place

1. **The delegation.** A sends one type-4 transaction: an EIP-7702 delegation to the B0 wallet code, plus
   `initialize(blob, keyHash)` (83,059–83,071 gas under Osaka).
2. **The simulated disabling:**
   - **(a) EIP-7851:** the RPC recorder of Phase 4 P0.4 returns `0xef0101 ‖ wallet` for A's code (`rewrite.json`: 43–44
     rewritten reads per run).
   - **(b) EIP-8298:** `anvil_setCode` gives A the wallet's runtime as regular code. The key written through the
     delegation stays in the wallet's ERC-7201 slot: the holder's signature verifies after the adoption (P1 served on
     B3b).
3. **Off-chain:**
   - **Profile H refuses the old key** on every path (R1–R5). A has code, so the verifier asks the wallet through
     ERC-1271, which rejects an ECDSA signature, and never recovers the key (H2). R2 is typed `user_signature_rejected`.
     On the legacy path (R3, R5) H6 refuses an account with code.
   - **The wallet's ML-DSA-44 signature is accepted** through ERC-1271 (P1, P1h), and **E3 works too** (P2).
   - **The SDK:**
     - `getAuthorityStatus` reports `eip7851` (B3a) and `regular` (B3b), not retired (until T8).
     - The precheck refuses the old key's signature (`Erc1271WrongMagicError`) and accepts the holder's.
4. **On chain** (the old key's transactions, run once per run with our own test key, three runs):
   - **Mined:** T1 `allow`, T2 `allowForDecryption`, T3 a delegation, T4 a designation, T7, and T8 `retireAccount`.
   - **Reverted:** T5 (`SuccessionNotAccepted`: the attacker never accepted) and T6 (`CertificateSuccessorMismatch`).
   - The local chain implements neither EIP's transaction rule, so it accepts them. Anvil does not apply EIP-3607
     either (P0.3).
   - **Only the host chain closes this door [I]:**
     - EIP-7851 (Draft, `07f3bb36`): "An ECDSA-authenticated transaction whose recovered sender has code that is exactly
       23 bytes long and starts with `0xef0101` in the current state is invalid and must not be included in a block."
     - EIP-8298 (Draft, `f4a9f965`): "Once it adopts regular code, EIP-3607 makes them invalid, including those already
       pending".
     - EIP-7851 itself notes that contracts which verify ECDSA directly do not reject such signatures automatically.
       Profile H's code-first ordering is the off-chain verifier's counterpart.
5. **Undo.** The holder, through `execute`, revoked D's earlier delegation (U-R6 refused afterwards) and the attacker's
   KDA (U-E2 refused afterwards). In the local runs it also cancelled the pending designation (`pendingSuccessor` zero).
   - The old key could redo each of these on this chain.
6. **Why B3 cannot be combined with Core retirement.**
   - Retirement ends the *account's* authority, and in place the wallet *is* the account. A retired account's wallet
     is refused like its old key.
   - **P4:** after T8, the holder's ERC-1271 request is refused `account_retired`, three runs, on both variants. In the
     local runs, the wallet's own `execute` of a registry change reverts (`CallFailed`).
   - So an account that wants both a post-quantum key and retirement migrates *out* (B1 or B2).
   - An account that migrates in place depends on the host chain to stop its old key.

## B4: Profile Q inside the scenario

**Setup.** 13 operators sign the no-root-ECDSA statement for B_Q with ML-DSA-65 (threshold 9). The test mines to B_Q.
After B_Q the old key sends T1–T7.

**After B_Q (three runs):**
- **ECDSA-rooted requests are refused:** a plain EOA, the legacy path, and the attacker named by the old key's forged
  grant (E1-on). The last one is refused on every path, B3 included.
- **The post-quantum requests of every path are served:**
  - the holder's ERC-1271 request (Q-P1) on B1, B2d, B2c, B3a and B3b;
  - the holder's KDA (Q-P2) on B1, B3a and B3b. B2's KDA is refused by design, as before.
- **Q5 on the old key's delegation to the attacker's KDA (E2-on):**
  - **B3a:** refused. A reads as an EIP-7851 indicator, so the cutoff applies, and the delegation changed after B_Q.
  - **B3b:** **served** (residual 7). B3b's code was already regular at B_Q, so the verifier cannot tell it from a
    contract's.
  - On a host chain that enforces EIP-8298 the old key could not have sent that delegation. Q7 limits Profile Q's
    claims to such chains.
- **Q5 for adopted code (A6).** After B_Q the old key declares a KDA; then A delegates to the wallet code, sets its key
  and adopts the code.
  - Its code was empty at B_Q, so the cutoff applies. The forged KDA is refused under Q and served with Q off.
  - The wallet's own KDA, declared after the adoption, is refused too. This node cannot establish the adoption block,
    so it fails closed: an availability cost.
  - The wallet's ERC-1271 request is served.
- **Q5 for a succession (A7).** After B_Q the old key designates the attacker's post-quantum wallet X7. X7 accepts, D
  passes, and the old key confirms and retires A7.
  - With Q off, X7 reads A7's handle.
  - Under Q it is refused: X7 was not A7's successor at B_Q (D99).
  - W2, confirmed before B_Q, is served.

**The threshold cliff (13 workers; a request is released when at least t + 1 = 5 forward it):**

| Enforcing workers k | The ECDSA EOA's request | Each path's post-quantum request |
|---|---|---|
| 8 | forwarded by 5 of 13 in every run: **released** | forwarded by 13 of 13: released |
| 9 | forwarded by 4 of 13 in every run: **withheld** | forwarded by 13 of 13: released |

Profile Q protects only when at least n − t = 9 of 13 workers enforce it. At 8, the non-enforcing five still release an
ECDSA request.

## B5: post-quantum upgrade safety (local drill, both forks, three runs each)

**Setup:**
- The scenario's registry is owned by `OperatorRatifiedRegistryOwner`: Phase 4 P3's operator-ratified upgrader (13
  operators, ML-DSA-44, 9 of 13, 7-day delay), plus `acceptRegistryOwnership()` to accept a pending ownership
  transfer.
- The registry's owner transfers ownership, and the contract accepts it.

| Step | Outcome (Osaka / Amsterdam gas) |
|---|---|
| Canary, before any upgrade | OK |
| A Core-preserving release with 8 signatures | reverts `NotEnoughSignatures` (802,540 / 1,323,928) |
| The same release with 9 signatures | mined: the guard passes (11,453,066 / 11,557,470) |
| Canary, after it | OK |
| A release without Core, with 9 signatures | reverts `UpgradeDropsRetirement` at the guard (11,427,962 / 11,451,062) |
| Canary, after the refused release | OK |
| The retired B1 account's `allow` after the upgrade | reverts `SenderRetired` |

**Limits:**
- These are local runs (Mock). The connector drill uses an ECDSA owner, because the worker does not read the owner.
- The handover itself is the current owner's ECDSA transaction (see the four properties above).

## B6: the compromised-key drill

The matrix (`PQ_DRILL_MATRIX.md`) gives, per path, the old key's:
- off-chain requests: R1–R5, as user and as delegate, on the RFC-016, HTTP and legacy paths;
- transactions: T1 grant, T2 publication, T3 delegation, T4 and T5 succession changes, T6 a new certificate, T7
  permits, T8 retirement;
- effects, with Profile Q off and on: E1, E2.

It also gives the holder's reads (P1–P4) and the undo rows.

**Coverage beyond the drill.** The drill sends `allow`, `allowForDecryption` and `delegateForUserDecryption`.
`allowTransient` and `multicall` with a grant are the remaining grant paths. Core's Foundry tests revert both for a
retired sender (`SenderRetired`; `results/level0/LEVEL0_CONTRACTS.md`, `test_Export_AllowTransient`,
`test_Export_Multicall`).

**Outcome:** every cell comes from three runs and matches the design.
- **B1 and B2:** everything the old key tries is refused or reverts. T7 is mined but only narrows a retired account's
  permits.
- **B3:** the residuals listed above.

## What Part B does not cover

These are left as found. The gap map (`PQ_GAP_MAP.md`, B7) records each one:
- the confidentiality of the ciphertexts (TFHE);
- the transport and reply KEM (ML-KEM-512 in the SDK and KMS today);
- the KMS's, coprocessors' and components' own ECDSA signatures;
- the input proofs;
- the internal TLS.

## The three limits

1. **Pre-emptive, not a clawback.** The path protects an account that completes it before its key is used against
   it. Data a key already shared, published or had decrypted stays exposed.
2. **Oracle access only.** The old key can still move funds and hold application roles, unless applications check
   retirement too. On B3 it also keeps acting on the registry until the host chain disables it.
3. **As final as the chain's governance.** Whoever can upgrade the registry can undo it. B5 shows the operator-ratified
   alternative; today's owner is an ECDSA multisig with no timelock.
