# B7: post-quantum gap map of the decryption path (proof class: Design, [V] code reading)

Date: 2026-10-22. This is a map, not a fix.

**Sources read:**
- `zama-ai/fhevm` at `main` = `ed851716c` (a clean checkout) and at tag `v0.13.8` = `fe3ca89b5` (`git show`);
- `zama-ai/kms` at `main` = `c755e84f` (2026-10-20);
- `tfhe` 1.8.1 and `tfhe-zk-pok` 0.9.0, the versions `main`'s coprocessor pins. `v0.13.8` pins `tfhe` 1.6.1-1 and
  `tfhe-zk-pok` 0.8.1.

**Classes:**
- **classical:** broken by a cryptographically relevant quantum computer (CRQC): ECDSA on secp256k1, ECDH, pairings.
- **post-quantum:** FIPS 203/204/205, or lattice FHE.
- **symmetric:** AES-256, Keccak-256; Grover leaves a margin.

**Effects:** C confidentiality, I integrity, A availability.

**[V]** means read in the code at the line given; **[I]** means inferred and not checked.

## The map

| # | Primitive | `main` (`ed851716c`) | `v0.13.8` (`fe3ca89b5`) | Scheme and class | A break affects | Who would change it |
|---|---|---|---|---|---|---|
| 1 | **Account authorization, an EOA's signature** on a user-decryption request | the connector recovers the signer (`shared/user-decryption-signature/src/lib.rs:106` `recover_address_from_prehash`, `:196` `verify_signature`); the legacy path's gateway check stays (`gateway-contracts/contracts/Decryption.sol:964, 990`) | the gateway only (`Decryption.sol:923, 947`, `ECDSA.recover`); the connector checks no signature | ECDSA secp256k1: **classical** | **C**: a forged request decrypts the holder's data, past and future | verifiers and operators (Profile H, Profile Q); wallets (migrate); Ethereum (disable the key) |
| 2 | **Account authorization, a contract account** (ERC-1271) | the connector's `isValidSignature` call with `erc1271_gas_limit` 250,000 (`kms-connector/crates/kms-worker/src/core/config.rs:274-275`) | none: the gateway checks ECDSA only | the wallet's own scheme; the cap refuses an ML-DSA-44 wallet (about 1.23M gas) | **A** for post-quantum wallets | verifiers (Profile H's budget, H3) |
| 3 | **Declared signers** (E3, key-derived) | not in Zama's code; ours, branch `lifecycle/level3-connector` | — | ML-DSA-44/65/87 verified natively (four unaudited libraries, K8): **post-quantum** | — | verifiers (E3 is an off-chain route) |
| 4 | **Grants, publication, delegations and successions** (registry transactions) | authorized by `msg.sender` (ACL functions) | the same | the sender's Ethereum transaction signature: ECDSA, **classical** | **C, I**: a forged grant, delegation, publication or succession | Ethereum (EIP-7851, EIP-8298, EIP-8141); the registry (Core retirement); operators (Q5's cutoff) |
| 5 | **Permits** (EIP-712 typed data of a request) | `UserDecryptRequestVerification`, Keccak-256 | the gateway's EIP-712 types | hash **symmetric**; the signature's class is rows 1 and 2 | as rows 1 and 2 | — |
| 6 | **Reply encryption** (the transport key) | the SDK holds an ML-KEM-512 key (`sdk/js-sdk/src/core/modules/decrypt/module/api-p.ts:2-3`); the KMS encrypts with hybrid ML-KEM-512 and AES-256-GCM (kms `core/service/src/cryptography/hybrid_ml_kem.rs:1`, `encryption.rs:35-37`) | the same SDK file and lines | FIPS 203, category 1: **post-quantum** | C of the reply | KMS and SDK. The companion's Q6 recommends ML-KEM-768 or stronger for replies published on chain |
| 7 | **Reply signature** (the KMS's signcryption) | ECDSA secp256k1 in the deployed envelope (kms `signcryption/ecdsa_v0.rs:1-4`, "FROZEN" since 0.11; `signing/ecdsa.rs:1`). A multi-signature layout and an ML-DSA backend exist (`signcryption/composite_v1.rs`, `signing/mldsa.rs`), not the deployed format | the same envelope [I: same KMS line] | **classical** | **I**: a forged reply passes the SDK's check | KMS and SDK (switch to the composite layout) |
| 8 | **KMS decryption results verified on chain** | host `KMSVerifier.sol:143` (`verifyDecryptionEIP712KMSSignatures`), `:417` `ECDSA.recover`; gateway `Decryption.sol:925` (`_validateDecryptionResponseEIP712Signature`) | host `KMSVerifier.sol:141, 412`; gateway `Decryption.sol:888` | ECDSA, **classical** | **I**: a forged public-decryption result | KMS operators, governance (signer sets) |
| 9 | **Coprocessor signatures on inputs** | gateway `InputVerification.sol:252`; host `InputVerifier.sol:247` (`verifyInput`), `:521` `ECDSA.recover` | gateway `InputVerification.sol:257`; host `InputVerifier.sol:244, 525` | ECDSA, **classical** | **I**, and C [I]: a forged input binding could present someone else's ciphertext as the attacker's own input | coprocessor operators, governance |
| 10 | **Input proofs** (ZK proofs of knowledge) | `tfhe-zk-pok` 0.9.0, pairing curve BLS12-446 (`tfhe` 1.8.1 `src/zk/mod.rs:35`); verified in `coprocessor/fhevm-engine/zkproof-worker/src/verifier.rs:684` | `tfhe-zk-pok` 0.8.1; `verifier.rs:445` | pairing-based: **classical** | **I**, and C [I], as row 9 | Zama (a lattice- or hash-based proof system) |
| 11 | **Ciphertext attestations and HTTP authentication** between components | `shared/ciphertext-attestation` (ECDSA attestations, coprocessor and connector); `shared/fhevm-sig-auth` (EIP-712 and `ecrecover`, `src/lib.rs:1-8`) | — (not present) | ECDSA, **classical** | **I**, A | Zama's components |
| 12 | **The ciphertexts themselves** | TFHE (LWE) | the same | lattice: **post-quantum**. Out of Part B's scope | C | — |
| 13 | **KMS key shares and the threshold protocol** | secret sharing, and transport between parties | the same | shares: information-theoretic; transport as row 17 [I] | C (key compromise) | KMS. Out of scope |
| 14 | **Governance** (who can upgrade or reconfigure) | ACL owner, `Ownable2StepUpgradeable`, `_authorizeUpgrade` `onlyOwner` (`host-contracts/contracts/ACL.sol:674`); `PauserSet` `onlyACLOwner` (`immutable/PauserSet.sol:26`); cross-chain governance over LayerZero (`protocol-contracts/contracts/governance/contracts/GovernanceOAppSender.sol`, `GovernanceOAppReceiver.sol`) from a Safe | ACL owner, `_authorizeUpgrade` `onlyOwner` (`ACL.sol:591`) | Safe owners' ECDSA, and the bridge's verifiers [I]: **classical** | **C, I, A**: an upgrade can undo every property | governance. Phase 4's operator-ratified upgrades (ML-DSA-44, 9 of 13) and B5 |
| 15 | **Host-chain transactions** | Ethereum transactions, ECDSA secp256k1. EIP-7702 keeps the key; EIP-7851 and EIP-8298 (drafts) would disable it; EIP-8141 (frame transactions) would let code authorize | the same | **classical** | **C, I** through the on-chain door (row 4) | Ethereum |
| 16 | **Gateway-chain transactions** (relayer, connectors, coprocessors) | ECDSA senders | the same | **classical** | I, A | operators |
| 17 | **Transport between components** | TLS 1.3 through rustls 0.23.46 (connector, relayer); 0.23.43 (KMS). `aws-lc-rs` 1.18 and `ring` 0.17 are both in the lock files; with `aws-lc-rs`, rustls can negotiate X25519MLKEM768 | rustls 0.23.40 (connector) | X25519 alone is **classical**. Which provider each binary installs, and what a connection negotiates, were not checked [I] | C of request metadata in transit (replies are end-to-end ML-KEM, row 6) | operators |
| 18 | **User to relayer** (HTTPS from a browser) | outside Zama's code | the same | the browser's TLS [I] | C of request metadata | relayer operators, browsers |

## What the post-quantum path covers, and what it does not

**Covered:**
- Rows 1–5 (account authority) are what Part B migrates.
- The old key's off-chain requests: retirement refuses them on every path (Core). Profile H's code-first ordering refuses
  them where the account kept its address. Profile Q refuses ECDSA-rooted requests after B_Q.
- The holder authorizes with ML-DSA-44, through ERC-1271 (row 2, under Profile H's budget) or E3 (row 3).

**Partly covered:**
- Row 4 on a host chain that still accepts the old key's transactions:
  - an account that retired is safe (every grant path reverts);
  - an account that migrated in place is not, until the host chain enforces EIP-7851 or EIP-8298 (B3, the drill).

**Not covered** (Part B leaves each as found):
- **Rows 7–11 and 16:** the KMS's, coprocessors' and components' own signatures, and the input proofs. A CRQC that
  forges them attacks integrity, and through inputs possibly confidentiality [I]. No account-level step can close them.
- **Row 14:** governance, unless it moves to operator ratification with post-quantum signatures (Phase 4 P3, B5).
- **Row 17:** whether internal TLS is hybrid.
- **Rows 12 and 13:** stated out of scope by the brief.
- Row 6 is already post-quantum at category 1.
