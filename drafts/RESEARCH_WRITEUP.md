# Retiring decryption authority: revocable access for oracle-based confidential execution

*Draft for later publication. Not published. Semih Civelek (Himess), 2026-10-22.*

Labels: [M] measured, [V] verified in code, [E] estimated, [I] inferred. Every number comes with its date and the
place it was measured. Everything below ran locally or on our own testnet accounts; nothing was deployed, and no
vendor service was contacted for this work beyond public testnet use with our own accounts in its initial phase.

## 1. The problem

Confidential execution on Ethereum increasingly works like this. Data sits on a public host chain as ciphertext
handles. Contracts compute on the handles through a fixed engine. When someone wants a plaintext, a decryption oracle
releases it: a threshold network of key-holding nodes, or a trusted execution environment. Before it releases
anything, the oracle reads an access-control registry on the host chain: may this account use this handle, has it
delegated decryption to that one, does this permit still hold?

That design has a property that is easy to miss. **The confidentiality of past data is decided again at every
request.** The ciphertexts can be strong, even post-quantum. What protects them in the end is whoever the registry
says may ask. For almost every account today, that is an ECDSA key bound to an address for life.

No system we examined lets an account end that authority. On Zama fhEVM, the system we used as the reference, an
account can revoke or shorten a delegation it granted, and on the `main` line invalidate its permits whose start time is
earlier than a chosen time. It cannot end its own authority, withdraw a per-handle grant, undo a public decryption, or stop its key from
signing new permits [V]. On Sepolia, on 2026-10-20, with our own accounts:

- one `allow` (140,780 gas) let a second account decrypt the holder's balance with its own permit, in 12.6 s;
- one `allowForDecryption` (141,493 gas) made it decryptable by anyone, in 2.6 s;
- `multicall` batched ten such grants into one transaction [M].

One wildcard delegation with no expiry covers every past and future handle at constant gas [V].

Upgrading the account does not help either. An EOA that delegated through EIP-7702 to a wallet rejecting every
signature still decrypted with its original key [M, Sepolia, 2026-10-20]. A post-quantum ERC-1271 account cannot step
in: an ML-DSA-44 `isValidSignature` cost 1,232,720 gas, Zama's verifier accepted it only at a gas limit 5.24 times
its 250,000 cap, and the deployed path accepts only 65-byte ECDSA signatures [M].

So a leaked key inherits the account's entire history. So does a future cryptographically relevant quantum computer
(CRQC) that derives the key from a published public key. Nearly everyone is exposed. A read-only census of the
mainnet registry up to block 26,237,004 found 12,714 end accounts, which received grants and never granted; in a
random sample of 1,000 of them,
97.9% had no code or an EIP-7702 delegation, that is, an ECDSA root [M, 2026-10-20].

Fhenix CoFHE shares the gap: its registry never revokes allowances, and its permits' expiry has no upper bound [V].

## 2. Retirement, and why it lives in the views

The proposal adds one state transition: **retirement**. An account calls `retireAccount()`. From then on, every
authorization view that the oracle already reads returns false for that account, in every role it can play:
requester, owner, delegator, delegate, contract, permit issuer, permit recipient. There is no reverse transition. The
draft standard calls the result revocable access: an account can end the authority behind its data, and every
conforming oracle then refuses every request that rests on it.

The interesting part is not the bit; it is **where it is enforced**.

A threshold oracle of n nodes releases when t+1 of them respond. In Zama's deployment, n = 13 and t = 4, so any 5
responses reconstruct a result. A restriction enforced in node software therefore binds only once n−t = 9 operators
run it; with 8, a request still collects 5 shares. A grant needs only t+1. Restrictions and grants are not
symmetric.

We measured that cliff with 13 real instances of Zama's verifier, each with its own database. With k of them
enforcing a refusal, an ECDSA request was still released at k = 0, 4, 5 and 8, and refused at k = 9 and 13 [M].

A rule enforced **inside the registry's views** has no such cliff. Every verifier of every release reads those views
at request time [V]. The registry upgrade therefore binds all of them in the same block, with no verifier change. So
the draft standard puts its Core rules in the views and keeps everything that needs new verifier code optional.

Three details make that work.

- **Every role, including the contract.** In an early design, a retired contract was refused on the direct path but
  still passed the delegated one, because the delegated view read the contract's raw rights [V]. The rule became
  "no retired account satisfies any authorization view in any role".
- **An engine exemption defined by semantics.** Computation must not break when an account retires, so a registry
  may exempt exactly one evaluation: the engine's check that an operand may be used in a computation for its caller,
  whose outputs go only to that caller and only for the transaction. Every way out of the transaction is gated
  again. On Zama the engine can be recognized by its address, under three invariants that tests pin. On Fhenix it
  cannot (§6).
- **An upgrade guard.** Whoever upgrades the registry can drop retirement by accident: a backport of Core to an older
  release line upgrades to a later line without Core and silently stops reading retirement [V, M]. The guard checks,
  inside the upgrade itself, that the new implementation declares the interface and reads the same storage location.

The verifier rules ask little of today's verifiers. They must release nothing unless every applicable view returned
true at decision time, treating an error, a revert, a timeout or a malformed answer as false. They must evaluate at
a fresh block, never impersonate the exempt engine, and never authorize from a stale replica.

Zama's unmodified verifier meets them on both release lines, on every request path. It also refuses when we
injected failures between it and the chain: JSON-RPC errors, HTTP errors, dropped connections, timeouts, malformed
JSON, empty or truncated results, reverts and intermittent faults [M, three runs per line]. The claim holds on one condition:
that the verifier decodes view answers strictly, as the rule now defines a malformed answer.

It does not meet the two recommendations on stored results and final denials. On `main` it serves a stored result
again after retirement, and it retries a retirement denial instead of making it final. The hygiene profile makes
both required, and with it every recorded case conforms; the conformance kit's fixture for them (TC15) finds 35
conforming cells and 8 violations, all the unmodified verifier's [M].

## 3. The one-key rule

Retirement is easy to define and hard to make safe, because of one fact: **for an ECDSA account, the owner and a
thief hold the same key.** Anything the key alone can trigger, a thief can trigger too. Hence the rule we design by:
any transition that the key alone can trigger must be a pure reduction, unless it was committed while the key was
safe. What survives retirement must mature; what retirement disables may be instant.

That rule shaped the two registry extensions.

- **A successor.** It is the one account that may keep reading a retired account's data. It survives retirement, so
  it must have been set up in advance: designated, publicly visible, accepted by the successor itself in its own
  transaction, and confirmable only after a delay of at least seven days. Acceptance proves the successor can
  transact; a typo or a burn address cannot accept. A thief who designates its own successor has to stay unnoticed
  for the whole delay. The draft states this as a residual, not as solved.
- **A retirement certificate.** It is a signed message that anyone can relay to the chains it lists. It is the only
  signature-relayed transition, so it is bound to the successor confirmed beforehand. A leaked or forged certificate
  can trigger only the handover the holder planned. Without that binding, a leaked certificate would lock its
  owner out; with a CRQC, it would be a lockout anyone could forge.

The same rule rules out things one might want.
- **A Suspended state.** If the key can lift it, so can a thief; if a guardian can, the guardian becomes a new
  censor. NIST SP 800-57's Deactivated and Compromised states both mean "refuse" here, which is retirement.
- **A fused "grant everything to my new account and retire" call.** One phished signature would become an
  irrevocable grant plus a lockout. Batching existing calls does the same job without a new primitive.

## 4. What we measured

The reference implementation is a local prototype on Zama fhEVM's two current lines, `main` and the release deployed
on mainnet and Sepolia (v0.13.8). It has four levels: the Core; verifier signature hygiene; the successor and
applications; the certificate, a declared post-quantum signer and a post-quantum-only operator mode. It is not
deployed and has not been audited. A selection of results:

- **Gas** (receipts, Zama's production compiler settings, local chain):

  | Operation | Osaka | Amsterdam |
  |---|---|---|
  | `retireAccount()` | 50,099 | 132,519 |
  | One handle carried to a new account in a batch | 31,385 | 119,505 |
  | Successor set-up (designate, accept, confirm) | 159,276 | 326,100 |

  The Amsterdam numbers come from a local chain that applies the state-creation pricing. Its `allow` of a new pair
  on Zama's unmodified registry costs exactly the 140,780 gas measured on Sepolia [M, 2026-10-22].
- **View cost.** The use view for a non-engine caller costs one more cold storage read, +2,266 gas, inside calls
  verifiers already make [M].
- **The largest carry in one transaction.** It is 524 handles under Osaka and 137 under Amsterdam, measured at a gas
  limit of exactly 2^24 [M]. EIP-8037, in Last Call, would apply the cap to execution gas only, which raises the
  second to about 765 by execution gas, or less if the block's gas limit binds [E]. On mainnet, 99.7% of holders
  hold at most 539 handles [M].
- **Verifier behaviour** (local chains, Zama's unmodified verifier):
  - a retired subject is refused on every path, including under injected view-call failures;
  - the decision lag is zero blocks (every view at `latest`);
  - nothing is authorized from a replica [M].
  - Two gaps remain without our verifier changes. On `main`, a stored result can be served again after retirement,
    by the verifier's endpoint and by the relayer; and a retirement denial is retried as an ordinary denial, which a
    simulated governance lapse revives. The hygiene profile closes both (TC15: 35 cells conform, 8 violate, all the
    unmodified verifier's) [M].
- **A vendor-neutral conformance kit** (an abstract Foundry suite with adapters) passes on both Zama lines and on a
  port to Fhenix. Removing any one of six gates from the reference registry makes it fail [M].

## 5. The host-chain gap: EIP-7851 and EIP-8298

A natural objection: why not let the host chain retire the key? Two drafts would. EIP-7851 lets a delegated EOA
disable its ECDSA key: the account's code becomes `0xef0101` followed by its delegate, and the chain refuses the key's
transactions and authorizations. EIP-8298 lets an EOA adopt the regular code of a deployed wallet: the chain then
refuses its ECDSA transactions, and the adoption cannot be undone. EIP-8151, also a draft, makes the `ecrecover`
precompile stop accepting such keys.

None of them reaches an off-chain verifier. The verifier recovers the request signature in its own code, before or
without reading the account's code. We simulated the EIP-7851 indicator with a JSON-RPC proxy in front of a local
chain, and an EIP-8298 adoption by giving the account an ML-DSA-44 wallet's code on a local chain. In both cases
Zama's unmodified verifiers accepted the old root key on every request path, on both release lines [M, 2026-10-21 and
2026-10-22].

What does close it is a verifier profile that reads the account's code before the signature: empty code means ECDSA,
any other code means ERC-1271 only. Under that profile the old key was refused, and an ML-DSA-44 signature through the
account's wallet was accepted [M].

Migrating in place has one more condition. The account then acts only through its code, so a wallet that cannot
call the registry can never retire. EIP-8298 notes the same for a chain without frame transactions (EIP-8141): code
with no relay path of its own is stranded. A post-quantum wallet for this path therefore needs a call that its
post-quantum key authorizes and anyone can submit.

Enforcing code-first ordering has a cost: some EIP-7702 wallets do not answer ERC-1271 for their own root key. We
measured the cost on mainnet, ran each of the 64 delegate codes behind the 2,220 delegated end accounts locally, and
signed with our own key. Code-first enforcement would refuse a root-key signature from 680 accounts: 5.3% of all
12,730 end accounts in the census refreshed on 2026-10-21, and 6.0% of the active ones [M, 2026-10-22; part of the count is an estimate where a delegate
reads its own storage]. That is why the profile asks for a shadow mode first.

So host-chain key disabling is welcome, but it is not a substitute for retiring decryption authority. Accounts can
leave ECDSA either by migrating in place, through a post-quantum wallet behind a code-first verifier, or by migrating
out: retiring, with a successor or after carrying their rights.

## 6. The Fhenix engine case

The engine exemption is where a vendor-neutral standard could have gone wrong.

On Zama, the engine reads the use view at one operand check, with its caller as the subject, and grants outputs only
transiently to that caller [V]. "Skip the retirement check when the caller is the engine" is therefore safe there,
under three invariants that tests pin.

Fhenix CoFHE's engine, its `TaskManager`, works differently. It relays to the registry, always as itself:
- grants;
- the public use view;
- the decryption service's permit check.

We ported Core to Fhenix's contracts (`cofhe-contracts` `b5c20ed`) and wrote the negative test. With a caller-identity
exemption, every relayed grant and the permit check passed for a retired account [M]. With a dedicated operand-check
entry, which the `TaskManager` calls only for computation inputs, everything stayed gated.

That is why the draft defines the exemption by what a check is for, not by who calls it. It also forbids the
caller-identity shortcut for any engine that relays third-party requests.

The port passed the analogues of the Core tests: 69 passed, 4 skipped for extensions it does not implement, over
three runs. Every one of 17 gate mutations was caught. The port also ran end to end on Fhenix's published mock stack.
A third registry, Inco Lightning, was read but not run. Core maps onto it without a change of mechanism, with two
cautions for a port: an existence check written as a negated use view must stay ungated, and its pause also gates
the views.

## 7. The three limits

Retirement is useful, and limited. Every claim about it carries three limits:

1. **Pre-emptive, not a clawback.** Retirement protects an account whose key has not yet been used against it. After
   a compromise it is a race that the attacker usually wins: a thief's off-chain permit needs no transaction, and a
   decryption takes seconds. Whatever the key already re-shared, published or had decrypted stays exposed.
2. **Oracle access only.** Retirement stops the oracle honouring the key. It does not stop the key moving funds, or
   holding application roles such as token observers and operators. Those need applications to check retirement
   too; an extension of 18 lines of code does it for OpenZeppelin's ERC-7984 token without a fork [M].
3. **As final as the chain's governance.** Retirement is per host chain, and whoever can upgrade that chain's
   contracts can undo it. On mainnet today, Zama's registry is owned by a DAO for which either of two ECDSA
   multisigs (3-of-6 and 9-of-17) executes, with no timelock [V, 2026-10-20]. The upgrade guard stops accidents, not
   an implementation that lies. Operators' canaries and implementation pinning catch that, but only at n−t operators.

## 8. Open questions

- **Governance is the ceiling.** Durability against a CRQC needs post-quantum governance signers and operator
  ratification of rights-widening upgrades. Neither exists today.
- **Host-state concentration.** Each node reads the views through some RPC source. Whoever controls the source of t+1
  nodes can make them answer "allowed" for anything. That predates this work and applies to every threshold oracle.
- **Partial adoption.** Anything that needs verifier code (signature hygiene, a declared post-quantum signer, a
  post-quantum-only mode) binds only at n−t operators. Our measurement shows the cliff at exactly 9 of 13.
- **Readiness for a post-quantum-only mode.** Of 1,713 active decryptors on mainnet, none has a proven
  post-quantum-capable route today [M, 2026-10-21]. Such a mode can only be scheduled and announced, never switched
  on.
- **Libraries.** The declared signer relies on ML-DSA implementations without a completed audit for this use:
  - RustCrypto `ml-dsa` 0.1.1;
  - `fips204` 0.4.6;
  - `libcrux-ml-dsa` 0.0.10, whose arithmetic is formally verified;
  - PQClean through `pqcrypto-mldsa` 0.1.2, unmaintained since PQClean was archived on 2026-08-04.

  The design therefore requires two libraries to agree, or no library on t+1 nodes; we tested both modes with an
  injected fault. Elsewhere the prototype uses the Fireblocks `evm-ml-dsa-verifier` (MIT, unaudited) for the on-chain
  ERC-1271 measurements, the `ml-kem` crate 0.3.2 in the example's reply channel (no completed audit for that use),
  and the pure-Python `dilithium-py` only as an independent test signer.
- **Release trains.** Upgradeable registries number their releases. A lifecycle release that takes the next number
  on a vendor's line collides with the vendor's own next release. We propose numbering lifecycle releases from 1000
  upward, but nothing is renumbered yet.
- **Amsterdam's transaction rule.** The single-transaction carry limit under EIP-8037 is an estimate until a client
  that implements the rule end to end can be run locally.

## 9. Related work

- **ERC-8227, "Encrypted Token"** (forum post, April 2026), specifies fungible tokens with FHE-encrypted balances and
  zero-knowledge transfer proofs. Its discussion mentions `keyVersion()` and `isKeyActive()` "for key lifecycle
  management". Those concern the lifecycle of the token's FHE encryption key, not an account's authority to have data
  decrypted; the post does not define them further. The two are complementary: rotating an encryption key does not
  stop the oracle releasing old data to whoever the registry still says may ask.
- **"Open, Application-Driven FHE for Ethereum"** (ethresear.ch, September 2025) surveys FHE on Ethereum: use cases,
  verifiability and key management. It notes that proxy re-encryption can support committee rotation and delegated
  decryption rights. It does not address revoking an account's decryption authority. Our work sits on the access
  side of the same systems.
- **EIP-7851, EIP-8298 and EIP-8151** change the host chain's treatment of ECDSA keys; §5 explains why off-chain
  verifiers need more.
- **ERC-7984** confidential tokens are an application of the access model, and the place where identity-gated roles
  (observers, operators) show limit 2.
- **NIST SP 800-57** key states inform the decision to have one terminal state, not several.

## 10. Status and reproduction

All of this is a local reference prototype and a draft standard. It is not deployed, not audited, and not endorsed
by any vendor.

The draft splits into a registry-side ERC (Core, the successor, the certificate) and a companion document with the
verifier, oracle and application candidates. The repository holds:
- the patches against Zama's pinned commits and the port to Fhenix;
- the conformance kit;
- every harness, with three runs per check and the raw data of each number above;
- instructions to rerun the Core suites and the kit from a clean clone.
