# B0: a test post-quantum wallet (proof class: Mock; TEST ONLY, NOT AUDITED)

Date: 2026-10-22. Code: `impl/pq-wallet/` (Foundry project). The ML-DSA-44 verifier is fireblocks-labs/evm-ml-dsa-verifier
at `cca262b5` (MIT, **unaudited** research code), the copy vendored for Phase 4 P3.

## What it is

`PQWallet` is a minimal contract wallet whose only authority is one ML-DSA-44 (FIPS 204) key.

- **`isValidSignature(hash, signature)`** (ERC-1271) accepts iff `signature` is a valid 2,420-byte ML-DSA-44 signature
  over the 32-byte `hash`: message M = hash, empty context. Anything else returns `0xffffffff`.
- **`execute(target, data, signature)`** calls `target` with `data`, authorized by an ML-DSA-44 signature over
  `keccak256(abi.encode(EXECUTE_TYPEHASH, chainid, account, nonce, target, keccak256(data)))`.
  - Anyone can submit it and pay the gas, which is the relay path EIP-8298's Security Considerations ask of adopted code.
  - The nonce makes each signature single-use.
  - The account is in the digest, beyond the brief's (target, data, nonce, chain id), so one key can serve several
    accounts (D97).
- **One code, both uses.**
  - The key (the address of its prepared public-key blob, and its hash) lives in ERC-7201 storage
    `fhe-authority-lifecycle.storage.PQWallet`.
  - A deployed wallet gets its key from the constructor.
  - An EIP-7702 delegated account sets its key once, with `initialize`, which only the account itself can call. That is
    a transaction to itself, still authorized by its ECDSA key at that point.
  - An account that later adopts this code as its own (EIP-8298) keeps that storage. The drill checks it (B3b).
- **Key registration** follows the verifier's shape (b), docs/SAFETY.md §3.1:
  - the owner derives the blob client-side with the upstream `prepare.py` from its own genuine key, and deploys it as a
    data contract;
  - the wallet only ever passes the stored address to the verifier, and does not validate the blob.
- **Ether.** Plain ether transfers to the account succeed (`receive`).

**One behaviour to know.** The wallet turns a verifier that reverts, or runs out of gas, into the reject value
`0xffffffff`; it does not revert.
- For a verifier this changes nothing: a negative is a negative (Profile H's H4 counts both).
- But `eth_estimateGas` on `isValidSignature` then measures the gas needed to *answer*, about 119,000, not to *accept*.
  B8 measures acceptance with E4's gas meter instead.
- Under the unmodified 250,000 cap the wallet answers `0xffffffff` (B8).

## Tests [M]

`forge test` in `impl/pq-wallet`: **21 passed, 0 failed, three runs** (`raw/b0/forge_test_r{1,2,3}.log`).
- **The signatures** are fixed vectors from `script/make_vectors.py`:
  - E4's signer (`experiments/E4/pq/mldsa_tool.py`, the verifier repository's own deterministic FIPS 204 signing);
  - two test keys from public labels;
  - accounts at fixed addresses, so no FFI is needed.
- **ERC-1271:**
  - its own key → `0x1626ba7e`;
  - another key, another hash, a corrupted signature, a 65-byte ECDSA signature or an empty one → `0xffffffff`.
- **`execute`:**
  - relayed by anyone;
  - in nonce order;
  - refused on replay, out of order, with other data, another target or another key, and with ECDSA;
  - a target's revert bubbles up and leaves the nonce unchanged;
  - the digest equals the vectors' (the Python and Solidity encodings agree).
- **Keys:**
  - only the account itself can initialize;
  - a second initialization reverts;
  - code without a key accepts nothing.
- **EIP-7702:**
  - an account delegates to the code (Foundry's `signAndAttachDelegation`), initializes, and then
    `isValidSignature` and `execute` work at the account's address;
  - someone else cannot initialize the account.
- **Gas inside the test:** one `execute` uses **1,369,296** execution gas (`gasleft()` difference, without intrinsic or
  calldata cost; the same in all three runs).

## One `execute` as a receipt

See B8 (`results/phase5/B8_COSTS.md`): the relayed `execute` transactions of the local drill, under Osaka and
Local-Amsterdam.
