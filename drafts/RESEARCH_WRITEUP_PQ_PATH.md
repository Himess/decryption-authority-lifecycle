# What it takes to make decryption authority post-quantum, end to end

*Draft for later publication. Not published. Semih Civelek (Himess), 2026-10-22.*

Labels: [M] measured, [V] verified in code, [E] estimated, [I] inferred. Everything below ran on local chains with our
own test keys, wallets and contracts; nothing was deployed, and no vendor service was contacted. The companion write-up,
"Retiring decryption authority", explains why an account needs a way to end its decryption authority at all. This one
asks what it would take for that authority to move from an ECDSA key to a post-quantum signature, and stay there.

## 1. The question

On an oracle-based confidential execution system, a plaintext leaves the decryption oracle when an access-control
registry says the requester may have it. On Zama's fhEVM, the system we used as the reference, almost every requester
is an account whose authority rests on one ECDSA key. The ciphertexts are lattice-based. The reply to the requester is
encrypted with ML-KEM. But a quantum computer able to derive an ECDSA key from its public key would inherit, through
the registry, the whole decryptable history of every account whose key it breaks.

Moving that authority to a post-quantum signature is not one change. It touches:
- the registry;
- the oracle's verifiers;
- the operators;
- governance;
- wallets;
- Ethereum itself.

We wanted to know which of those changes are needed, which are enough, and which can be shown to work today on local
chains. So we stated a target as four testable properties, built three migration paths, and attacked each path with the
old key.

## 2. The target

Assume the account's old ECDSA key is known to an attacker. An account has completed the post-quantum path when:

1. **Off-chain:** no verifier releases anything on the strength of the old key: no request, permit or delegation.
2. **On-chain:** the old key cannot create or extend any right: no grant, delegation, publication, succession change or
   certificate beyond the handover planned in advance.
3. **Continuity:** the account's data, past and future, stays decryptable by its holder through a post-quantum
   signature only.
4. **Upgrade safety:** the registry cannot be upgraded to undo the first three without post-quantum authorization.

The confidentiality of the ciphertexts and the transport encryption are outside this target. Section 8 maps them.

## 3. The parts we used

Everything here was built in earlier phases of this work and is described in the standard draft and its companion.
- **Core** adds `retireAccount()` to the registry. It ends an account's decryption authority for good: its grants,
  delegations and permits stop counting, and its later grant calls revert. An upgrade guard refuses any new
  implementation that lacks Core.
- **E1** lets a retiring account name a successor through a two-sided handshake with a delay: designate, accept, wait,
  confirm.
- **E2** lets the account sign its retirement in advance, as a certificate that anyone can relay later.
- **Profile H** is a set of verifier rules for contract accounts:
  - read the signer's code first, and for any account with code use ERC-1271, never recovering the old key;
  - give that call a budget large enough for a post-quantum wallet;
  - refuse accounts with code on the ECDSA-only legacy path;
  - re-check stored results before serving them.
- **E3** lets an account declare a post-quantum key as a delegate, by its key-derived address. The verifier checks that
  key's ML-DSA signature natively, optionally with two libraries that must agree.
- **Profile Q** is an operator policy: from an activation block B_Q, refuse every request rooted in an ECDSA key, and
  ignore ECDSA-rooted delegations and successions changed after B_Q.

For Phase 5 we added a test wallet:
- its only key is ML-DSA-44;
- it answers ERC-1271 for requests;
- it sends transactions through an `execute` call that anyone can relay;
- it works as a deployed contract and as an EIP-7702 delegate;
- it keeps its key in fixed (ERC-7201) storage, so an account that later adopts its code keeps the key.

It calls the Fireblocks ML-DSA-44 verifier at `cca262b5`, unaudited research code, as is the wallet. Its tests pass
21 of 21, three times [M].

## 4. Three paths

**B1: carry, then retire.**
- The old account A grants its handles to the new wallet W and retires, in one caller-preserving `multicall` sent by
  the carry tool: 156,448 gas for three handles under Osaka [M].
- W then decrypts as itself, through ERC-1271, or through its own declared signer.
- The catch: a handle granted to A later is inert, because a grant to a retired account counts for nobody.
  Applications must grant to W.

**B2: name a successor.**
- A designates W; W accepts through its own `execute`; seven days pass; A confirms; A retires. The retirement is direct,
  or comes through a certificate relayed by a watchtower.
- W reads A's handles on the successor path, including handles granted to A later.
- The catch: W authenticates through ERC-1271 on every such request.

**B3: stay at the same address.**
- A delegates through EIP-7702 to the wallet code and sets its key, in one transaction: 83,059 gas [M].
- Then the host chain would disable the old key: by EIP-7851 (the delegation indicator becomes `0xef0101`), or by
  EIP-8298 (A adopts the wallet's code as its own).
- Neither draft is live, so we simulated each by its end state:
  - a recording JSON-RPC proxy that answers the indicator;
  - a local chain that sets the wallet's runtime as A's code.

One design question came up on the way. On B2, W pays an ERC-1271 call per request because the design forbids
successors from passing access on. Could a confirmed successor authorize with its own declared signer instead?
- It is safe against the old key, and it exposes nothing W could not already read.
- But a declared signer can be anyone's key. So the rule would let W give lasting access to A's history to third
  parties, which is exactly the transitivity the design rules out.

We rejected it. Carrying first and then retiring with a successor gets most of the saving without the risk: the carried
history is W's own.

## 5. Attacking each path with the old key

After each path completed, our own test key played the stolen key and tried everything it could:
- requests as user and as delegate, on the on-chain request path, over HTTP and on the legacy path;
- grants and publication;
- delegation to an attacker's declared signer;
- designating and confirming a successor;
- a new certificate;
- cutting off the holder's earlier permits;
- retiring the account.

The off-chain half ran through the real kms-worker of our Phase 5 tree, against the real registry, on a local chain.
Each run had 258 request rows and 40 transactions. The on-chain half ran there and again on local chains, under the
Osaka schedule and under a local build of the Amsterdam drafts, with the real carry tool, watchtower, SDK and canary.
Three runs each; every row matched the design in every run [M].

**B1 and B2 hold all four properties in these runs.**
- Every request the old key signed was refused, typed `account_retired` where the verifier reports a reason.
- Every grant, publication, delegation, designation, confirmation, certificate and second retirement reverted.
- The one call the old key could still make, cutting off permits signed before a time, only narrows a retired
  account.
- The holder's post-quantum key read the whole history over every path.

**B3 holds the off-chain property for the old key's own signatures, and not the on-chain one.**
- Profile H refused the old key's signatures everywhere: the account has code, so the verifier asks the wallet, which
  rejects ECDSA. The wallet's ML-DSA-44 signature and its declared signer were served.
- A delegation the old key had made before the move still served its delegate, until the holder revoked it; then it
  was refused.
- On chain, the old key granted, published, delegated, designated a successor, cut off the holder's permits and
  retired the account. All of it was mined, because the local chain enforces neither draft.
  - EIP-7851 makes such a transaction one that "is invalid and must not be included in a block".
  - EIP-8298 relies on EIP-3607 once the account has regular code.
  - Only a host chain that enforces one of them closes this door [I].
- The holder can undo most of it through `execute`: revoke the attacker's delegation, cancel the designation. The old
  key can redo it.

The retirement case explains why B3 cannot be combined with Core. Retirement ends the account's authority, and in
place the new wallet is the account. After the old key retired the B3 accounts, the holder's own post-quantum requests
were refused, three runs out of three [M]. An account that wants both a post-quantum key and retirement must move out.

## 6. The operators' part: Profile Q, and a sharp threshold

The oracle in the reference system is a threshold network: 13 nodes, any 5 of which release a decryption share set
(t = 4). In the same scenario:
- 13 operators signed a statement for B_Q with ML-DSA-65;
- after B_Q, every ECDSA-rooted request was refused, and every path's post-quantum request was still served [M].

Two details matter.

**First, the threshold is a cliff, not a slope.** With 13 worker identities, each a real kms-worker instance with its own
database and Profile Q setting (the KMS is a mock, so a release is counted: at least t + 1 = 5 forwards):
- at 8 enforcing, the other 5 still forwarded an ECDSA request, enough to release it;
- at 9, only 4 forwarded it, and it was withheld.

Every run agreed [M]. Profile Q protects only when at least n − t = 9 of 13 operators enforce it.

**Second, reading the present is not enough.** Our own worker had an availability gap here, which we fixed.
- **What we found.** It applied the delegation cutoff to delegation records only, and a retired account has no
  delegation record for its successor. So a successor's requests were refused under Q: safe, but the post-quantum
  successor path went unserved. And the rule as written said nothing about a succession made after B_Q, which a key
  still accepted after B_Q could create.
- **The fix.** The worker now reads the state at B_Q:
  - a succession counts only if the same successor was confirmed then;
  - an account whose code is regular now but was empty at B_Q adopted that code later, and gets the cutoff.
- **It fails closed.** In the drill, a successor named by the old key after B_Q was refused under Q and served
  without it.

One limit could not be removed off chain. For an account that adopted its code before B_Q, a delegation the old key
made afterwards was still served: its code reads like any contract's. On a chain enforcing EIP-8298 the key could not
have made it. Profile Q's claims are therefore limited to such chains.

The same is true more broadly. On a chain that still accepts an unmigrated account's key, a forged grant to an
attacker's post-quantum wallet is served under Q. Q can only refuse signatures; it cannot tell a forged grant from a
real one.

## 7. Governance: who can undo it

All of this is as final as the registry's upgrade path. Today that path is an ECDSA multisig with no timelock [V].

We put the scenario's registry under an operator-ratified owner. An upgrade needs 9 of 13 operators' ML-DSA-44
signatures and a 7-day delay, and the upgrade guard and the canary stay in place. Three runs per schedule [M]:
- 8 signatures reverted before any verification;
- 9 signatures on a release with Core passed the guard (11.45M gas under Osaka), and the canary stayed green;
- 9 signatures on a release without Core reverted at the guard.

Two limits remain.
- **The handover.** Moving ownership to such a contract is itself a transaction of today's ECDSA owner, and must happen
  while that key is safe.
- **What the guard checks.** It checks that a new implementation declares Core's interface and storage location. That
  stops an accidental release, not one that lies.

## 8. What the account-level path does not touch

We read the decryption path's cryptography at Zama's current `main`, at the live tag `v0.13.8` and in the KMS
repository [V]. Eighteen primitives:

**Already post-quantum:**
- the ciphertexts (TFHE);
- the reply encryption, hybrid ML-KEM-512 with AES-256-GCM at category 1.

**Classical:**
- the KMS's reply signature: ECDSA in the deployed envelope, although an ML-DSA backend exists in the code;
- the KMS's signatures on public decryption results, checked on chain;
- the coprocessors' signatures on inputs;
- the zero-knowledge input proofs (pairing-based);
- the attestations between components;
- the gateway chain's transaction senders;
- governance.

**Not checked:** whether the components' internal TLS negotiates a hybrid key exchange [I].

An attacker who can forge those attacks the integrity of results and inputs, and through inputs possibly
confidentiality [I]. No step an account takes can close them. They are for Zama's KMS, coprocessors and governance.

## 9. What it costs

Gas on local chains [M]. The Amsterdam figures use drafts in Last Call, so they may change.

**Once per chain:**
- an on-chain ML-DSA-44 verifier: 5.17M gas under Osaka, 37.2M under local Amsterdam;
- its Keccak helper: 4.72M, and 33.6M.

**Once per account:**
- the key itself, in the verifier's 20,545-byte prepared form: 4.43M under Osaka, 31.9M under local Amsterdam. The
  Amsterdam figure is above 2^24, so it is valid only under EIP-8037's rule for state gas.
- the migration on top:
  - B1: 156,448 gas for three handles;
  - B2: about 1.5M, mostly the successor's acceptance through the wallet;
  - B3: 83,059.

**Per request, on the oracle's side.** None of it costs the user gas.
- **ERC-1271:** an ML-DSA-44 wallet's `isValidSignature` used about 1.23M gas. That is five times the 250,000 cap Zama's
  verifier applies today, so it is refused without Profile H's budget. Through the verifier library on a local node,
  the check took 2.7 ms.
- **E3:** the declared signer's route took about 245 µs, of which 80–86 µs is the ML-DSA-44 verification itself
  (Phase 4's bench, unchanged code).

**With an ML-DSA precompile.** EIP-8355 (Draft) would change the ERC-1271 numbers most [E]:
- `isValidSignature` would drop to about 13,000–15,000 gas, inside today's cap;
- registering a key would drop from 4.43M to about 0.3M gas.

Code-first ordering would still be needed: it is what refuses the old key.

## 10. What works today, and the order of the rest

**On the live line, `v0.13.8`:**
- **Works:** Core needs only a registry upgrade. Accounts could then retire, name an ECDSA successor and carry.
- **Does not:** decrypting with a post-quantum key. The gateway checks user and delegate signatures with ECDSA
  recovery, and the only three mentions of ERC-1271 in the code say it is not supported [V].

So the order is:
1. **Core in the registry.** It works on the deployed line now.
2. **Profile H in the verifiers,** on `main`'s request path. Post-quantum wallets can then decrypt; B1 and B2 complete.
   E3 can follow behind a flag.
3. **Operator-ratified governance,** handed over while today's keys are safe.
4. **Profile Q,** scheduled once enough accounts have moved, with at least 9 of 13 enforcing.
5. **EIP-7851 or EIP-8298 on Ethereum,** only for accounts that must keep their address. EIP-8355 would make the
   whole thing cheaper.

Nothing in the first four depends on Ethereum.

## 11. What this does not do

Three limits apply to every part of it.
1. **Pre-emptive, not a clawback.** It protects an account that completes the path before its key is used against
   it. What a key already shared, published or had decrypted stays exposed.
2. **Oracle access only.** It governs decryption. The old key can still move funds and hold roles in applications
   that do not check retirement, and, for an account that stayed in place, act on the registry until the host chain
   disables it.
3. **As final as the chain's governance.** Whoever controls upgrades can undo it.

The libraries involved are young:
- the on-chain ML-DSA verifier;
- the Rust ML-DSA crates behind the declared-signer route (RustCrypto `ml-dsa` 0.1.1 and `fips204` 0.4.6, run in a mode
  where both must agree);
- the Python signer used in the tests.

None of them has a completed security audit for this use.

What the work shows is narrower than "post-quantum decryption". The four properties can be stated, tested and met on
local chains for accounts that move out. Each remaining gap has a named owner: the host chain, the operators, the KMS
or governance.
