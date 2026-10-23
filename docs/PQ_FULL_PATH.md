# The full post-quantum path for decryption authority

Status: research result, 2026-10-22. Part B of Phase 5. Evidence: `results/phase5/` (labels [M] measured, [V] read in
code, [I] inferred, [E] estimated; proof classes Mock, Connector, Local-Amsterdam, Design). Turkish version:
`docs/PQ_TAM_YOL_TR.md`.

This document says what it takes for an account on Zama's fhEVM to move its decryption authority from an ECDSA key to a
post-quantum signature, what each party must do, in which order, at what cost, and what stays open. It describes
properties under stated assumptions. It does not claim that any configuration is safe against every attack.

## 1. The target

Assume the account's old ECDSA key is known to someone else. An account has **completed the post-quantum path** when
all four of these properties hold:

1. **Off-chain.** No verifier releases anything on the strength of the old key: no request, permit or delegation
   signed by it.
2. **On-chain.** The old key cannot create or extend any right: no grant, delegation, publication, succession change
   or certificate beyond the handover planned in advance.
3. **Continuity.** The account's data, past and future, stays decryptable by its holder through a post-quantum
   signature only.
4. **Upgrade safety.** The registry cannot be upgraded to undo properties 1–3 without post-quantum authorization:
   operator ratification with ML-DSA signatures, plus the upgrade guard and the canary.

**Out of scope:**
- the confidentiality of the ciphertexts themselves (TFHE);
- the transport and reply encryption (ML-KEM).

The gap map (§8) records both.

## 2. The building blocks

All of these exist as code in this project and were run [M]. None of them is in a Zama release.

| Block | What it does | Where it runs |
|---|---|---|
| **Core** | `retireAccount()` ends an account's decryption authority for good: its grants, delegations and permits stop counting, and its later grant calls revert. An upgrade guard refuses an implementation without Core | the ACL (registry) |
| **E1, the successor** | An account designates a successor, the successor accepts, a delay D passes (7 days in the tests), the account confirms. After it retires, the successor reads its handles | the ACL |
| **E2, the certificate** | A retirement signed in advance, which anyone (a watchtower) can relay later | the ACL, the watchtower |
| **Profile H** | Verifier rules for contract accounts. Read the signer's code first, and use ERC-1271 for any account with code, never recovering its old key (H2). Give the ERC-1271 call a budget large enough for an ML-DSA wallet (H3: 2,000,000 gas of execution). Refuse accounts with code on the ECDSA-only legacy path (H6). Re-check stored results (H7) | the decryption oracle's verifiers (Zama's kms-connector) |
| **E3, declared signers** | An account delegates to the address of a post-quantum key (a key-derived address, KDA). The verifier checks that key's ML-DSA signature natively, off chain. With K8 it uses two implementations that must agree | the verifiers |
| **Profile Q** | From an activation block B_Q, the operators refuse every request rooted in an ECDSA key (Q4), and ignore ECDSA-rooted delegations and successions changed after B_Q (Q5). Established by n − t = 9 of 13 operators' ML-DSA-65 statements (Q1) | the verifiers |
| **Operator-ratified upgrades** | The registry's owner is a contract that upgrades only with 9 of 13 operators' ML-DSA-44 signatures, after a 7-day delay | the registry's governance |
| **The canary** | A check, before and after an upgrade, that retirement still works through the views | off chain |
| **A post-quantum wallet** | A contract wallet whose only key is ML-DSA-44: ERC-1271 for requests, and `execute` for transactions, relayable by anyone. Test fixture, unaudited (`impl/pq-wallet/`) | the account |
| **The carry tool, `getAuthorityStatus`** | The tool grants a list of handles to the new wallet and retires the old account in one transaction (in chunks for a long list, the retirement in the last). The SDK call reports an account's code kind and retirement | the user's side |

## 3. The three paths, and when to use each

### B1: move out, carrying the history

**Steps:**
- The old account A grants its handles to the new wallet W.
- In the same transaction, A retires: one caller-preserving `multicall` sent by the carry tool.
- W then decrypts as itself, through ERC-1271, or through its own declared signer (E3).

**Use it when:**
- the account can change address;
- the history is small enough to carry: 31,385 gas per handle under Osaka, 119,505 under Local-Amsterdam (Phase 4).

**Know that:**
- **A handle granted to A after the carry is inert.** A grant to a retired account counts for nobody, so applications
  must grant to W.
- **W can use E3 for its own handles,** the cheapest verification there is: a native check, and no `eth_call` per
  request.

### B2: move out, naming a successor

**Steps:**
1. A designates W, and W accepts through its own `execute`.
2. After D, A confirms.
3. A retires: directly, or later through a certificate a watchtower relays.
4. W reads A's handles on the successor path.

**Use it when:**
- applications will keep granting to A's address;
- or the history is too large to carry.

**Know that:**
- W authenticates through ERC-1271 on every request for A's handles. The verifier pays an `eth_call` of about 1.23M
  gas each time; the user pays nothing.
- W's own declared signer does **not** reach A's handles. A rule that let it would let W pass lasting access to third
  parties, which the design forbids (S9; decision D98).
- **Carrying first, then retiring with a successor, combines B1 and B2.** The carried history uses E3; only later
  grants need the successor path.

### B3: stay at the same address

**Steps:**
1. A delegates through EIP-7702 to the wallet code and sets its ML-DSA-44 key, in one transaction.
2. The host chain then disables the old key:
   - **EIP-7851:** the delegation indicator becomes `0xef0101 ‖ wallet`;
   - **or EIP-8298:** A adopts the wallet's code as its own regular code.

**Use it when:** the address must stay, for example because it holds positions or roles elsewhere.

**Know that:**
- **Both EIPs are Drafts, and no chain enforces them.** Until a host chain does, the old key still signs valid
  transactions. It can then:
  - grant;
  - publish;
  - delegate;
  - designate a successor;
  - void the holder's earlier permits;
  - retire the account.

  Verifiers refuse the old key's off-chain signatures (Profile H), but the on-chain door stays open (§6).
- **B3 cannot be combined with Core retirement.** Retirement ends the account's authority, and in place the new wallet
  is the account. An account that wants both a post-quantum key and retirement moves out (B1 or B2).

## 4. Who must do what

| Party | What it must do | For which property | Evidence |
|---|---|---|---|
| **Zama ACL** (host contracts) | Ship Core with the upgrade guard, plus E1 and E2. A getter for a delegation's last-change block would let verifiers apply Q5 without reading storage | 1, 2, 3; 4 with governance | `results/level0/`, `results/level2/`; drill rows T1–T8 |
| **Zama verifiers and operators** (kms-connector, relayer) | Profile H: code-first ordering, the ERC-1271 budget, H6, H7. Optionally E3 behind a flag. Profile Q, with at least 9 of 13 operators enforcing, at a scheduled B_Q or on evidence of a quantum attack | 1, 3 | drill rows R1–R6, P1, P2, Q-P1, the k = 8 and 9 runs |
| **Zama governance** | Move the registry's ownership to the operator-ratified contract (ML-DSA-44, 9 of 13, 7-day delay); keep the guard and the canary in every release | 4 | B5, local drill |
| **Zama KMS and coprocessors** | Outside the path: their own ECDSA signatures and pairing-based input proofs (§8) | — | `results/phase5/PQ_GAP_MAP.md` |
| **Wallets and the SDK** | Offer an ML-DSA-44 contract wallet with ERC-1271 and a relayable `execute`. Show `getAuthorityStatus` and the typed `ACCOUNT_RETIRED`. Run the carry tool and the watchtower | 3 | B0; local drill (SDK, tools) |
| **Ethereum** | EIP-7851 or EIP-8298 for accounts that stay in place. EIP-8141 (frame transactions) would let adopted code send and pay for its own transactions; until then it needs a relay path, such as the wallet's `execute`. EIP-8355, an ML-DSA precompile, would make the ERC-1271 check cheap | 2 for B3 | the B3 rows; `B8_COSTS.md` §6 |
| **The account holder** | Complete a path **before** the key is used against them | all | the three limits (§9) |

## 5. The order in which it can happen

1. **Today, on the live line (`v0.13.8`).**
   - **What works:** Core needs a registry upgrade only, and the gateway, connector and SDK stay as they are. Accounts
     can then retire, name an ECDSA successor and carry.
   - **What does not:** decrypting with a post-quantum key. The gateway checks user and delegate signatures with ECDSA
     only, and has no ERC-1271 path (`Decryption.sol:923, 947`; B9).
2. **The next Zama release, on `main`'s RFC-016 path.** With Profile H in the verifiers, a post-quantum contract wallet
   can decrypt. B1 and B2 then complete properties 1 and 3. E3 can follow behind a flag.
3. **Governance.** With operator-ratified ownership, property 4 holds for the upgrade path. That handover is a
   transaction of today's ECDSA owner, and it must happen while that key is safe.
4. **Profile Q.** Once enough accounts have migrated, the operators schedule B_Q. After it, ECDSA-rooted requests are
   refused. It needs at least 9 of 13 enforcing.
5. **Ethereum.** If EIP-7851 or EIP-8298 ships, B3 completes property 2 for accounts that stay in place. EIP-8355
   would remove the ERC-1271 budget question.

Steps 2–4 do not depend on Ethereum. Step 5 matters only for accounts that must keep their address.

## 6. What the drill shows

Our own test key played the old key after each path. Every cell comes from three runs:
- the real Phase 5 kms-worker on the VPS;
- local chains on M1, under Osaka and Local-Amsterdam.

The full matrix is `results/phase5/PQ_DRILL_MATRIX.md`.

| The old key tries | B1 | B2 (both variants) | B3a (EIP-7851) | B3b (EIP-8298) |
|---|---|---|---|---|
| Requests, as user or delegate, on every path | refused | refused | refused | refused |
| A delegate it named before the migration reads for it | refused | refused | served until the holder revokes it | the same |
| Grant, publish, delegate, designate a successor | revert | revert | **mined on this chain** | **mined on this chain** |
| Confirm a successor, a new certificate | revert | revert | revert | revert |
| Void earlier permits | mined, harmless (A is retired) | the same | mined: the holder signs new ones | the same |
| Retire the account | revert | revert | **mined: ends the wallet's authority too** | the same |

**The holder's side:**
- **The whole history is served on every path,** through ERC-1271, and through E3 on B1 and B3. This also holds
  under Profile Q.
- **A handle granted to A later** reaches W on B2 and B3, and is inert on B1, as designed.

**Profile Q in the same scenario:**
- After B_Q it refuses every ECDSA-rooted reader, including the attacker the old key named on B3. An attacker
  reading through a post-quantum wallet would be served (Phase 4 P1.2 §2.4).
- It also refuses the old key's later delegation on B3a.
- It does not refuse that delegation on B3b: B3b's code was already regular at B_Q, so the verifier cannot tell it
  from a contract's. On a chain enforcing EIP-8298 the key could not have sent it.
- **With 13 workers, the threshold is sharp.** At 8 enforcing, the other five still release an ECDSA request; at 9,
  only four do, and it is withheld.

**Upgrade safety (local):**
- 8 operator signatures revert.
- 9 signatures on a Core release pass the guard, and the canary stays green.
- 9 signatures on a release without Core revert at the guard.

## 7. Costs

Gas on local chains [M]. Local-Amsterdam uses EIP drafts in Last Call, so its constants may change. Verification times
are Phase 4's bench on M1 [M]. Details: `results/phase5/B8_COSTS.md`.

| Item | Osaka | Local-Amsterdam |
|---|---|---|
| ML-DSA-44 verifier and its helper, once per chain | 5.17M + 4.72M | 37.2M + 33.6M |
| An account's key (the verifier's 20,545-byte prepared form) | 4.43M | 31.9M (valid only under EIP-8037's reservoir rule) |
| B1: carry 3 handles and retire | 156,448 | 503,316 |
| B2: designate, accept (`execute`), confirm, retire | 62,128 + 1.34M + 57,256 + 54,516 | 144,548 + 1.43M + 140,060 + 136,936 |
| B3: delegation and key in one type-4 transaction | 83,059 | 284,005 |

**Per request, off chain:**

| Route | Cost |
|---|---|
| ERC-1271 with an ML-DSA-44 wallet | about 1.23M gas of `eth_call` for the verifier's node; 2.7 ms through the crate on M1. The unmodified 250,000 cap refuses it |
| E3 | 80–86 µs of native verification; 242–247 µs for the whole route; 337–341 µs with two agreeing libraries |

**With EIP-8355 [E]:**
- `isValidSignature` would cost about 13,000–15,000 gas, within the unmodified cap.
- Registering a key would cost about 0.3M gas instead of 4.4M.

## 8. What stays open

**Residuals of the path itself** (each with its cause and closure in the matrix):
- **B3 on a chain without EIP-7851 or EIP-8298:** the old key's transactions. Closed only by the host chain.
- **B3:** delegations made before the migration stand until the holder revokes them through `execute`.
- **Property 4 stops at the governance handover.** The guard stops an accidental release, not an implementation that
  lies about its interface.
- **Profile Q protects only with at least 9 of 13 enforcing.** On a chain that still accepts an unretired account's
  old key, a grant that key forges to an attacker's post-quantum wallet is served under Q (Phase 4 P1.2 §2.4). A
  retired account's grants revert.

**The gap map** (`results/phase5/PQ_GAP_MAP.md`, 18 primitives read in code [V]):
- **Already post-quantum:**
  - the ciphertexts (TFHE);
  - the reply encryption (ML-KEM-512, category 1).
- **Classical, outside the path:**
  - the KMS's reply signature and its decryption-result signatures;
  - the coprocessors' input signatures;
  - the input proofs (pairing-based);
  - component attestations;
  - gateway-chain senders;
  - governance until it moves.
- **Not checked:** whether internal TLS negotiates a hybrid key exchange [I].
- **A quantum attacker who forges those** attacks integrity, and through inputs possibly confidentiality [I]. No
  account-level step closes them.

**Unaudited libraries used here:**
- the Fireblocks `evm-ml-dsa-verifier` at `cca262b5`, behind the test wallet and the B5 owner;
- RustCrypto `ml-dsa` 0.1.1 and `fips204` 0.4.6, for E3 in agree mode;
- `dilithium-py`, the verifier repository's test signer.

The wallet and the owner contract are test fixtures.

## 9. The three limits

1. **Pre-emptive, not a clawback.** The path protects an account that completes it before its key is used against
   it. Data a key already shared, published or had decrypted stays exposed.
2. **Oracle access only.** It governs decryption. The old key can still move funds and hold application roles, unless
   applications check retirement too. On B3 it also keeps acting on the registry until the host chain disables it.
3. **As final as the chain's governance.** Whoever can upgrade the registry can undo it. Operator-ratified upgrades
   with post-quantum signatures narrow this. Today's owner is an ECDSA multisig with no timelock.
