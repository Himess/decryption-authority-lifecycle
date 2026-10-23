# P2.5: what Profile H's `enforce` would refuse today (H8 impact)

**Proof class:** read-only mainnet aggregates (the census and the code at its head); Local (each delegate's code run
on anvil with our own key). [M], except the rows marked [E].
**Date:** 2026-10-22. **Status:** done.
**Raw data:** `raw/p25/`, aggregates only. Per-address data stays outside the project.

## 1. The census

**The refresh.** It is the one done in P1.2, with Phase 2's method and filters (`P1_2_PROFILE_Q.md` §3).
- **Head:** block 26,243,993, 2026-10-21 22:33 UTC.
- **Real end accounts:** 12,730.
- **Active:** 1,713 accounts received a handle in the 90 days before the head.

**The code.** Read for every real end account at the head, read-only (`impl/harness/phase4/p25_delegates.py`).
- Endpoints: the census's two log endpoints, tenderly and mevblocker, in batches of 10 calls at 8 calls a second or fewer. On 2026-10-22 the endpoint P1.2 used for code (publicnode) started to require a token for archive reads (D56).
- Delegates are grouped by the keccak256 of their runtime code at the head.
- Implementations are named from Sourcify where verified; no address is published (D57).

| Real end accounts at the head | All | Active (90 days) |
|---|---|---|
| No code (ECDSA) | 10,291 | 1,216 |
| EIP-7702 delegated | **2,220** | **414** |
| EIP-7851 | 0 | 0 |
| Other code (contracts) | 219 | 83 |
| **Total** | 12,730 | 1,713 |

The 2,220 delegated accounts point to 64 delegates, and the 64 have 64 distinct codes.

## 2. The H2 matrix, locally

`impl/harness/phase4/p25_h2_matrix.py` takes each of the 64 delegate codes in turn and runs:

1. The code is placed at a local address on anvil 1.8.5 (Osaka, 127.0.0.1:8651).
2. A fresh key of ours gets the EIP-7702 indicator to it, as the Level 1 harness does. The key is derived from a public label and the code hash.
3. Our key signs a fixed digest with plain ECDSA (65 bytes), as a wallet's root key signs a request today.
4. `isValidSignature(digest, signature)` is called on our account with H3's gas (B_exec 2,000,000 + 21,000 + 64 × calldata). H2 then gives the verdict:
   - the magic value: accepted through ERC-1271;
   - success with empty return data: accepted through the empty-success shim (H2's ECDSA fallback);
   - anything else: refused under `enforce`.
5. `debug_traceCall` records whether the call read our account's own storage (an `SLOAD` in the account's context). If it did, the verdict may depend on a real account's initialisation, which this run cannot reproduce, so it is labelled [E] (D58).

**Three runs gave identical verdicts for all 64 codes** (`raw/p25/h2_matrix_r{1,2,3}.json`).

## 3. Results

| H2 verdict for a root-key signature | Codes | All 7702 accounts | Active 7702 accounts |
|---|---|---|---|
| Accepted through ERC-1271 | 24 | **1,494** (1,393 [M] + 101 [E]) | **307** (286 [M] + 21 [E]) |
| Accepted through the empty-success shim | 19 | **46** [M] | **4** [M] |
| **Refused under `enforce`** | 21 | **680** (507 [M] + 173 [E]) | **103** (68 [M] + 35 [E]) |

**What `enforce` would refuse today:**

| Scope | Accounts refused | Their handles |
|---|---|---|
| All real end accounts | **680 of 12,730 (5.3%)**; 507 of them [M] (4.0%) | 10,609 of 408,894 (2.6%) |
| Active end accounts | **103 of 1,713 (6.0%)**; 68 of them [M] (4.0%) | 3,865 of 151,063 (2.6%) |

**The largest implementations** (Sourcify names; unnamed codes are unverified):

| Accounts | Implementation | Verdict |
|---|---|---|
| 802 | `EIP7702StatelessDeleGator` (exact match) | ERC-1271 |
| 184 | unverified | ERC-1271 |
| 151 | unverified | refused (empty revert) |
| 148 | `WalletCore` (exact match) | ERC-1271 |
| 132 | unverified | refused (returns `0xffffffff`) |
| 104 | unverified | refused (returns `0xffffffff`), [E] |
| 99 | unverified | refused (empty revert) |
| 86 | `EIP7702Proxy` (exact match) | ERC-1271, [E] |
| 79 | unverified | ERC-1271 |
| 69 | `SemiModularAccount7702` (match) | refused (revert `0x151d90fe`), [E] |
| 63 | `BronAccount` (exact match) | refused (empty revert) |
| 57 | `CaliburEntry` (match) | ERC-1271 |

## 4. Reading the numbers

- **Most delegated accounts would keep working.** 69% of the delegated accounts (1,540 of 2,220) answer a root-key signature with the magic value or through the shim.
- **About 5% of all end accounts, and 6% of the active ones, would be refused.** Their wallets would have to sign through their delegate's own scheme before `enforce` is switched on. That is why H8 asks for shadow mode first, with its impact published.
- **Some refusals may be expected envelopes [I].**
  - A delegate that implements ERC-7739 nested typed data expects its own envelope around the request digest. It refuses a plain signature, and a wallet that signs the envelope would pass.
  - Which of the 21 refusing codes are of this kind was not analysed. An envelope-signing run is a follow-up.
- **[E] rows.** A delegate that reads its own storage may answer differently in a real, initialised account. The direction is not known: [E] covers 101 accepted and 173 refused accounts.

## 5. What this does not show

- **The census.** One host chain (mainnet). Its last state is block 26,243,993; delegations can change after it.
- **The signature.** The digest is not a real user-decryption request's. A delegate that inspects the hashed content would answer differently; nothing in the 64 codes was checked for that.
- **Verification.** The verdicts are those of each code run locally, on anvil's Osaka rules, with no transaction on any network.
