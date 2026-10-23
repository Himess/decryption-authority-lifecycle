# P0.1: what an account can and cannot remove in the registry (proof class: Design, [V])

Date: 2026-10-22. Method: code reading of Zama's `ACL.sol` at both bases, every function the contract declares and the
ones it inherits. Lines: `v0.13.8` = `fe3ca89b5`, `main` = `ed851716c`, file `host-contracts/contracts/ACL.sol`.

## Why this task exists

The ERC's Motivation item 1, its evidence entry 1, both architecture documents and the research write-up said that every
user-callable registry function only adds rights. That was not exact: an account can revoke a delegation it granted on
both lines, and on `main` it can invalidate its permits whose start time is earlier than a chosen time. The correct statement is narrower and
still supports the ERC's point: **no account can end its own authority.**

## The surface an account can call

| Function | `v0.13.8` | `main` | Who can call | Effect | Adds or removes |
|---|---|---|---|---|---|
| `allow(handle, account)` | `:206` | `:230` | an account allowed on the handle and not on the deny list; not while paused | a persistent per-handle grant. There is no inverse | adds |
| `allowForDecryption(handles)` | `:224` | `:248` | the same | marks the handles publicly decryptable. There is no inverse | adds (irreversible publication) |
| `allowTransient(handle, account)` | `:253` | `:295` | the same; the executor (and on `main` the confidential bridge) without these checks | a grant for the current transaction only | adds (transaction-scoped) |
| `delegateForUserDecryption(delegate, contract, expiry)` | `:283` | `:326` | any account, for its own delegations; not while paused; one change per block; the expiry must be in the future and differ from the current one | creates, extends **or shortens** a delegation | adds; shortening narrows an existing delegation |
| `revokeDelegationForUserDecryption(delegate, contract)` | `:342`, **not while paused** (`whenNotPaused`) | `:386`, also while paused | any account, for its own delegations; one change per block | ends that delegation | **removes** |
| `invalidateDecryptionSignaturesBefore(timestamp)` | — (absent) | `:273` | any account, for itself; the timestamp may not decrease and may not be in the future (0 means now) | the account's permits whose start time is earlier than the timestamp stop being valid; the signer picks a permit's start time, and the verifier rejects a permit only if `start < invalidatedBefore` (Phase 1, `results/VERIFICATION.md` §B2) | **removes** (permits with an earlier start time) |
| `cleanTransientStorage()` | `:552` | `:635` | anyone | clears the current transaction's transient allowances | removes transaction-scoped grants only |
| `multicall(bytes[])` | inherited (OpenZeppelin `MulticallUpgradeable`) | the same | anyone | runs the calls above in one transaction, as the caller | — |

Not callable by an ordinary account: `pause` (pauser set; `:378` / `:422`), `unpause` (owner; `:390` / `:434`),
`blockAccount` and `unblockAccount` (owner; `:518`, `:531` / `:601`, `:614`), `upgradeToAndCall` (owner, through
`_authorizeUpgrade`, `:591` / `:674`), `transferOwnership` and `renounceOwnership` (owner, inherited),
`acceptOwnership` (pending owner; overridden on `main` at `:215`), and the initializers.

## The exact statement

At both bases, an account **can**:
- revoke a delegation it granted, or shorten its expiry (on `v0.13.8`, not while the registry is paused);
- on `main` only, invalidate its permits whose start time is earlier than a chosen time.

At both bases, an account **cannot**:
- end its own authority: no function sets a state that makes the views answer `false` for it;
- withdraw a per-handle grant (`allow` has no inverse);
- undo a public decryption (`allowForDecryption` has no inverse);
- stop its key from signing new permits: a permit is an off-chain EIP-712 signature, and its start time is the
  signer's choice, so the key can always sign one with `invalidatedBefore ≤ start ≤ now` (Phase 1: Zama's own e2e test
  accepts exactly that);
- reach the deny list, which is owner-only and is checked only against the caller of `allow`, `allowForDecryption`
  and `allowTransient`, never by a view or an off-chain component (Phase 1, `results/VERIFICATION.md` §B1).

## Where the statement was corrected

| File | Place |
|---|---|
| `erc/ERC-XXXX-decryption-authority-lifecycle.md` | Motivation item 1 |
| `erc/assets/erc-XXXX/EVIDENCE.md` | entry 1 |
| `docs/TARGET_ARCHITECTURE.md` | the "No user-side retirement" row of the problem table |
| `docs/HEDEF_MIMARI_TR.md` | the same row in Turkish |
| `drafts/RESEARCH_WRITEUP.md` | the opening section |

A search of the ERC, its assets, `docs/`, `drafts/`, the README and RESULTS finds no remaining "only adds rights"
wording, in two runs (`raw/p01/search_after_r{1,2}.txt`, 0 matches each). The two archived drafts in `erc/archive/`
keep the old sentence: they are frozen snapshots of earlier drafts (Phase 4, D69).
