# B2 design question: may a confirmed successor authorize with its own declared signer? (proof class: Design)

Date: 2026-10-22. Decision D98: **not adopted, and not prototyped.** The reasons follow.

## The question

After A retires, its confirmed successor W reads A's handles on the delegated path. The registry's view
`isHandleDelegatedForUserDecryption(A, W, C, h)` answers true for W (E1, S8). A post-quantum W authenticates that
request through ERC-1271, so every request costs the verifier an `eth_call` under Profile H's budget.

S9 forbids transitivity: "MUST NOT let S grant, publish, compute on or delegate them". So W's declared signers (E3
KDAs) do not reach A's handles today. The candidate rule:

> A confirmed successor may authorize with its own declared signer, which dies with the successor's retirement or
> revocation.

It would be checked off-chain, in the verifier's E3 route. A KDA request for A's handle would count when all of these
hold:
- A is retired;
- `successorOf(A) == W`;
- `isDelegatedForUserDecryption(W, KDA, C)` is live;
- the KDA's signature verifies.

The registry would not change.

## Analysis

**Against the one-key rule: safe.** The rule adds no transition that A's old key can trigger.
- A's commitment (designation, acceptance, the delay D, confirmation) matured while A's key was safe. After A
  retires, the old key can change nothing about W.
- W's declarations are W's own acts, under W's authority (here W's ML-DSA-44 key, through `execute`).

**Exposure: neutral.** Every key the rule admits is one W declared. W can already read A's history as itself, and can
pass the plaintext on.

**Transitivity: the rule reintroduces it.** This is why it is not adopted.
- A KDA is the address of *any* public key. Nothing on chain or off chain can tell W's own keys from a third party's.
- So the rule lets W give lasting, direct access to A's history to anyone whose key W declares, and to the handles
  granted to A later. The access would be revocable only by W.
- That is the property S9 forbids for delegations. Decision D14 rejected it when the successor was designed:
  "Transitivity was the most-objected property" (`docs/TARGET_ARCHITECTURE.md`, D14). The deferred variant (line
  1168) asks, if ever adopted, for at most 90 days, per contract, non-re-delegable and dying with the successor. A
  delegation to a KDA cannot express "non-re-delegable" or a 90-day bound without changing the registry.

**What it would save is small.**
- The saving is the verifier's cost per request: one ERC-1271 `eth_call`, measured at a 2,183,048 gas budget and
  about 2.7 ms on a local node. The native E3 route takes about 245 µs (Phase 4, P1.1, P1.6).
- The user pays no gas for either.
- The design already avoids most of it: an account that knows its successor can **carry first and then retire with
  the successor in place** (B1 and B2 together). The carried history is then W's own, readable through W's KDA; only
  handles granted to A later need the successor path.

## Decision

- **Not a rule, and not a candidate in the companion.** Recorded as considered and rejected, with the reason above.
- **Use instead:** carry, then retire with a confirmed successor. The drill's P2 row records that W's KDA does not
  reach A's handles on the successor path (refused), while it reaches W's own handles on the carry path (served).
- **If transitivity is ever reconsidered,** it belongs in the registry, with D14's terms, not in an off-chain route
  that cannot bound it.
