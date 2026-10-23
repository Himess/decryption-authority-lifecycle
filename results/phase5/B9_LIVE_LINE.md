# B9: what works on the live line `v0.13.8` today (proof class: Design, [V] code reading, with earlier [M] runs)

Date: 2026-10-22. Code at tag `v0.13.8` = `fe3ca89b5` of `zama-ai/fhevm`.

## What the line checks

- **User signatures are checked by the gateway with ECDSA only.**
  - `gateway-contracts/contracts/Decryption.sol:923`, `_validateUserDecryptRequestEIP712Signature`: `ECDSA.recover(digest,
    signature)` must equal the user, else `InvalidUserSignature`.
  - `:947`, `_validateDelegatedUserDecryptRequestEIP712Signature`: the same for the delegate.
  - The connector checks no user signature at all on this line.
- **There is no ERC-1271 path.**
  - A search of the gateway, host and connector code for `isValidSignature`, `1271` and `SignatureChecker` finds only
    three comments (besides hexadecimal bytecode and numbers that contain the digits), and all three say the opposite:
    `InputVerifier.sol:519`, `KMSVerifier.sol:406` and `lib/FHE.sol:8366`, "It does not support contract signature
    (EIP-1271)".
  - So a contract account cannot sign a decryption request on this line, as user or as delegate.
- **The registry.**
  - The ACL inherits `MulticallUpgradeable` (`ACL.sol:5, 26`), so a carry and a retirement fit in one transaction.
  - It has no `invalidateDecryptionSignaturesBefore`; that function is `main`'s.
  - Upgrades are `onlyOwner` (`ACL.sol:591`).

## Part by part

| Part | On `v0.13.8` | Why, and evidence |
|---|---|---|
| **Core** (retirement in the views) | **works** with a registry upgrade only: the gateway, the connector and the SDK are unchanged | Level 0 on the v0.13 line (ACL v0.4.1) with the unmodified v0.13.8 connector [M, `results/level0/CONNECTOR_PROOF.md`]; TC13 and TC14 [M, Phase 4 P0.1, P0.2] |
| **E1, the successor** | **works**, for a successor that signs with ECDSA | The unmodified connector serves the successor through the delegated path: 8/8 requests [M, `results/level2/LEVEL2_E1.md`]. The gateway checks the delegate's 65-byte ECDSA signature (`Decryption.sol:947`), so a post-quantum contract wallet cannot be the one that reads |
| **E2, the certificate** | **works** on chain, including for contract accounts (C5's code-first check runs in the registry) | Phase 4 P1.3, E2 on the v0.13 line [M, `results/phase4/P1_3_E2_V013.md`] |
| **B1, carry** | the carry and the retirement **work** (`multicall`); reading the carried history with a post-quantum key **does not** | W would have to sign requests, and only ECDSA verifies (`Decryption.sol:923`). Carried to an ECDSA account it works, but that is not the post-quantum path |
| **B2, successor** | the succession **works**; a post-quantum W cannot read | as E1 |
| **B3, in place** (EIP-7702, then EIP-7851 or EIP-8298) | **gives nothing** for decryption | The gateway accepts A's old ECDSA key whatever A's code is: forwarded on the legacy direct and delegated paths [M, Phase 4 P0.4 and Phase 5 P0.3, v0.13.8 rows]. The wallet's ML-DSA-44 signature has no path at all |
| **E3, declared signers** | **absent** | an off-chain route of our Level 3 connector, built on `main`'s RFC-016 path |
| **Profile H** (code-first, the budget, H5–H7) | **absent** | our Level 1 connector, on `main`. On this line the gateway does the signature check, so code-first ordering would need a gateway change. H6 (refusing regular code on the ECDSA-only path) would need a connector change |
| **Profile Q** | **absent** | our Level 3 connector, on `main` |
| **B5** (operator-ratified upgrades) | the owner contract is independent of the line; the guard needs Core | the v0.13 line's Core includes the upgrade guard (R11, TC11) [M, Phase 3 Level 0] |

## In one sentence

On the live line an account can **retire**, **name a successor** and **carry**, and those steps protect it against
its old key. But no account can yet **decrypt with a post-quantum key**. That needs `main`'s RFC-016 path with the
ERC-1271 check under Profile H's budget, or E3 — a newer release and a verifier update.
