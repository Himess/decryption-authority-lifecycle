# Experiments E2–E5: status

**Date:** 2026-10-21. Sepolia runs were in blocks 11958285–11958369 (2026-10-20 22:32–22:49 UTC).
**Scope:** design doc §10, E2–E5, and the local part of E4. Only our own accounts and contracts were used; Zama's contracts and testnet relayer were used as an ordinary user would.
**Code:** `experiments/` (single runner `experiments/run.mjs`; one folder per experiment with a README, scripts and `raw/<mode>/records.jsonl` + `summary.json`).
**Hardware for local numbers:** AMD Ryzen 5 5600 (6C/12T), 16 GiB, Windows 10 Pro 19045, anvil/forge 1.8.5, solc 0.8.30, Node 22.13.0, Rust 1.95.0.
**Upstream commits:** zama-ai/fhevm `ed851716c` (read-only), zama-ai/kms `c755e84`, fireblocks-labs/evm-ml-dsa-verifier `cca262b5` (unaudited), ZKNoxHQ/ETHFALCON `820da4b6` and ETHDILITHIUM `f9f4fe1d` (cloned, not run), ZKNoxHQ/NTT `3ac5f5dc` (Python dependency). All clones are `git status` clean.

## 1. Bottom line

| Experiment | Finding | Verdict | Where |
|---|---|---|---|
| E2 | B2 | **Not testable on Sepolia.** Its ACL (v0.4.0) has no `invalidateDecryptionSignaturesBefore`, so a user cannot revoke a signed permit before it expires. B2 remains a code-level claim about `main`. | Sepolia |
| E3 | B3 | **Confirmed.** One transaction re-granted ALICE's balance to BOB, who decrypted it. A second transaction made it public and it was public-decrypted. | Sepolia |
| E4 | B6 | **Confirmed.** ML-DSA-44 `isValidSignature` costs about 1.23M gas (5.2× the 250K cap), and Zama's `verify_signature` rejects it at 250K. On Sepolia the relayer rejects any signature that is not 65 bytes, so PQ accounts can't even reach ERC-1271. | local + Sepolia |
| E5 | B5 | **Confirmed.** After EIP-7702 delegation to a wallet that rejects every signature, EVE's original ECDSA key still decrypted on Sepolia. Main's `verify_signature` against the live account also accepts it (ecrecover-first). | Sepolia + local |

**Funding:** FUNDER received 1.0 Sepolia ETH and sent ALICE 0.05, BOB 0.02 and EVE7702 0.02. All gas for the whole campaign came to about 0.000132 ETH at about 0.001 gwei. FUNDER ends with 0.909871 ETH, ALICE 0.049997, BOB 0.020000 and EVE7702 0.019999942.

**Blockers:** none of the stop kind. The testnet relayer needed no API key, fee token, allowlist or captcha.

**G0 flag for the coordinator:** Sepolia does **not** run `main`. See §2. This limits what Sepolia can show for B2, B5 and B6.

## 2. Sepolia as found (measured, read-only probes, `experiments/common/raw/sepolia/preflight.json`)

- Versions: ACL v0.4.0 (impl `0xF4f793e6a2eF47DE60A94c0bC412292da5F7aB98`), KMSVerifier v0.3.0, InputVerifier v0.2.0, ProtocolConfig v0.1.0, FHEVMExecutor v0.5.0. This is the **protocol 0.13 line**; `main` @ `ed851716c` has ACL v0.7.0. Addresses match `@fhevm/sdk` 0.13.8 `chains/sepolia`, `@zama-fhe/relayer-sdk` 0.4.5 `SepoliaConfig` and `@fhevm/solidity` `ZamaConfig`.
- The ACL runtime has no selector for `invalidateDecryptionSignaturesBefore(uint256)` or `decryptionSignatureInvalidatedBefore(address)`, and calls to both revert. Upstream added them in `6ee4ba705` (2026-05-26).
- `ACL.multicall(bytes[])` **exists**.
- Relayer `https://relayer.testnet.zama.org`: `v2/user-decrypt`, `v2/delegated-user-decrypt`, `v2/public-decrypt` and `v2/keyurl` are present. **`v3/user-decrypt` and `v4/user-decrypt` return 404** ("no Route matched"). So user decryption takes the **legacy gateway path**, not the RFC-016 unified path. The relayer validates `signature` as exactly 130 hex characters and rejects a future `startTimestamp`.
- Gas schedule: Sepolia block headers carry `blockAccessListHash` and `slotNumber`, ETH transfers emit EIP-7708 logs, and the client is reth/v2.7.0. This is an Amsterdam-era schedule with much more expensive state creation (numbers in §4). Osaka is active (CLZ probe = 255).
- SDK note: `@zama-fhe/relayer-sdk` (latest 0.4.5) is **deprecated on npm** ("use @zama-fhe/sdk"). I used `@fhevm/sdk` 0.13.8 (npm `latest`, the repo's successor SDK, and what `@zama-fhe/sdk` 3.7.0 wraps). `@openzeppelin/confidential-contracts` 0.5.3 pins `@fhevm/solidity` 0.11.1 as a peer. I used 0.11.1; the latest, 0.13.4, has the same Sepolia addresses.

## 3. Results per experiment

### E2 (B2), `experiments/E2/`
- ALICE's permit P1 decrypted her balance: **21000** (7.8 s). A new permit P2: **21000**. P1 again at the end: **21000**.
- Invalidation is **not available** on the deployed ACL (selector absent; `staticCall`, `estimateGas` and the getter all revert). No transaction was sent.
- Edge, future `startTimestamp` (now + 3600):
  - the SDK refuses locally (`startTimestamp is set in the future`, no request sent);
  - a raw request gets **HTTP 400 `validation_failed`**, "requestValidity: Timestamp must not be in the future".
- Edge, `startTimestamp == invalidatedBefore`: not testable on Sepolia. On `main` it **passes**: `decryption.rs:531` rejects only when `start < invalidatedBefore`, and Zama's own test case `boundary_passes` (EqualToStart) asserts acceptance.
- Also from `main`'s code: the connector rejects `now < start` as **recoverable** (retried), not irrecoverable (`decryption.rs:342-362`).
- Pending: an end-to-end B2 run on a local `main` stack (E6).

### E3 (B3), `experiments/E3/`
- Before: BOB not allowed on ALICE's balance handle `0xad6959c5…0500`.
- ALICE `ACL.allow(h, BOB)` (tx `0x6c8153…2863`, 140,780 gas), then BOB's own permit → **21000**.
- ALICE `allowForDecryption([h])` (tx `0x9253b9…cea`, 141,493 gas), then public decrypt with no permit → **21000**.
- `ACL.multicall` batches `allow` calls in one transaction with `msg.sender` preserved, so "allowMany" exists already, for the user and for a key thief alike.

### E4 (B6), `experiments/E4/`
- Verifier: Fireblocks ML-DSA-44, unaudited.
- Real signatures were produced with the repo's own tooling over real permit digests. Locally the digest is the RFC-016 unified digest computed by Zama's `compute_user_decrypt_digest`; on Sepolia it is the V1 digest.
- Zama `verify_signature` at gas_limit 250,000:
  - locally → `EmptyRevert`;
  - against the live Sepolia account → `Transport`, because the node returns code 3 with no revert data. The connector retries `EmptyRevert` as a recoverable signature rejection and `Transport` as a transient network error (`error.rs:101-114`).
- At 5M gas it is accepted. The smallest accepted gas_limit is 1,309,193 – 1,313,408.
- Sepolia user-decryption attempt for the PQ account (raw `POST /v2/user-decrypt`, 2,420-byte signature): **HTTP 400 `validation_failed`, "signature: Must be 130 characters long"** (request id `122ae62e-9b0b-4355-b02c-a3394979a2fc`).
- Not shown: the Sepolia connector's configured cap can't be observed, because no testnet path reaches it. End-to-end PQ decryption is impossible on Sepolia today.

### E5 (B5), `experiments/E5/`
- EVE baseline → **7702**.
- 7702 delegation to RejectAll1271Wallet `0xb01bAD…e564` (tx `0x69cad7…87ea`, 58,456 gas, designator `0xef0100b01b…e564`).
- The account's own `isValidSignature` → `0xffffffff`.
- EVE's original-key permit → **7702** (B5 on Sepolia).
- Empty signature → HTTP 400 "Must be 130 characters long".
- Main's `verify_signature` against the live account:
  - original key → accepted with no RPC call (0.26 ms);
  - empty signature or an unrelated key's signature → `WrongMagic(0xffffffff)`.
- A local anvil replica gives the same result.

## 4. Gas numbers

| Operation | Sepolia, live (measured) | Osaka rules: anvil fork of Sepolia or local anvil (measured) | Doc |
|---|---|---|---|
| `ACL.allow`, single tx | **140,780** | 58,348 | n/a |
| `allow` marginal per handle in one `ACL.multicall` (2→10) | **119,201** | 31,083 | 22–27K **(estimate)** |
| `ACL.multicall` of 2 / 5 / 10 allows | 263,879 / 621,483 / 1,217,488 | 93,215 / 186,411 / 341,876 | n/a |
| `ACL.allowForDecryption` ×1 | **141,493** | 59,073 | n/a |
| EIP-7702 delegation tx (1 auth, self-sponsored) | **58,456** | 37,160 | n/a |
| ML-DSA-44 `isValidSignature` (STATICCALL, meter) | **1,232,720** | 1,230,457 – 1,232,110 | ~1.23M (published) |
| same, top-level `eth_estimateGas` | 1,326,329 | 1,311,669 – 1,313,408 | n/a |
| smallest `gas_limit` accepted by Zama `verify_signature` | **1,309,193** (5.24× cap) | 1,311,669 – 1,313,408 | cap 250,000 |
| PQ stack deploy: helper / verifier / pk blob / account | 33,632,238 / 37,233,691 / 31,917,713 / 2,091,761 | 4,716,322 / 5,166,161 / 4,434,717 / 317,011 | n/a |
| ERC-7984 token deploy / later mint | 14,734,825 / 766,634 | 2,158,639 / 306,634 | n/a |
| code deposit per byte | 1,558.7 (`eth_estimateGas` slope) | 200 (spec) | n/a |
| plain ETH transfer to a fresh account | 204,600 | 21,000 | n/a |

**Estimates (not measured):** carrying 1,000 handles ≈ 119M gas on Sepolia's schedule, or ≈ 31M on Osaka rules (linear extrapolation). The 2^24 per-transaction cap would allow about 10.6 KB of code if it applied to state gas. It does not seem to: deployments of 33.6M and 37.2M gas were accepted.

## 5. On-chain actions (Sepolia, all ours)

| Step | Action | Tx hash | Gas used | Block | Date (UTC) |
|---|---|---|---|---|---|
| fund | FUNDER → ALICE 0.05 ETH | `0xcd02654e72190d847aa95270a87bb8544f6aa276991384acaf8a5f45175188fe` | 204,600 | 11958285 | 2026-10-20 22:32:12 |
| fund | FUNDER → BOB 0.02 ETH | `0x29ef11ac6249474a876400d37e872dac0b28d3f24470bf11634321e517688f53` | 204,600 | 11958286 | 22:32:24 |
| fund | FUNDER → EVE7702 0.02 ETH | `0x119b060261fe3b5c08ee0a114007f3f3f9c43f343bd57ec6201388a27abb9c45` | 204,600 | 11958287 | 22:32:36 |
| setup | deploy TestConfidentialToken `0x1F32d758…6086` | `0x5cacfec5b5310e66eec9e06984ebd6752a214326d310fbbaf44afa13604d4d19` | 14,734,825 | 11958288 | 22:32:48 |
| setup | deploy RejectAll1271Wallet `0xb01bAD1A…e564` | `0xa977596338e3ea02eb73b82f2b0645bacd530ca052dc0f707351e4ab6cc986b8` | 1,060,519 | 11958289 | 22:33:00 |
| setup | mint 1000 → ALICE | `0xeea0ae96a4a26446563cba2049447e424884ed4cdc06a016028c5c88ae8f6228` | 929,713 | 11958290 | 22:33:12 |
| setup | mint 2000 → ALICE | `0xc853ad86e41d412d78a542ff460bb6b68cf943bc5b322b3783443a4d9bdb1d6b` | 766,634 | 11958291 | 22:33:24 |
| setup | mint 3000 → ALICE | `0xfdc19d07776cb020cc36b594b18af00f05745523c88925db755e115f6f1b366a` | 766,634 | 11958292 | 22:33:36 |
| setup | mint 4000 → ALICE | `0xd01aeeb567006b3119896164ac22c9ce8b7047f7d32e2d165cd659a5fb9c34c2` | 766,634 | 11958293 | 22:33:48 |
| setup | mint 5000 → ALICE | `0x0d7a2ea73de2ec6bd0c32f1a0a0750962ed41412f26a79879791db067737d654` | 766,634 | 11958294 | 22:34:00 |
| setup | mint 6000 → ALICE | `0x102c9ffe8fb8e955e9f11deb6433095665d83f9e3035b0b374608fbac21a4f50` | 766,634 | 11958296 | 22:34:24 |
| setup | mint 7702 → EVE7702 | `0x9945aab2b4981ca9c641f7de389f9954e564046f866f64a977ff0e8705a61b62` | 872,232 | 11958303 | 22:35:48 |
| E3.2 | ALICE `ACL.allow(balance, BOB)` | `0x6c815311a408fb0fff2d9558368a09bbde40d80d231cb521d0f9a3309ec12863` | 140,780 | 11958309 | 22:37:00 |
| E3.4 | ALICE `ACL.allow(amount1, BOB)` | `0x376c4b3f4fc1d6f7ef20f75e232a29f532bff8189dde6de61dfbe500facd335c` | 140,780 | 11958311 | 22:37:24 |
| E3.4 | ALICE `ACL.allow(amount2, BOB)` | `0xb49356820f2a7acf9750b6ddca0415e0e52ae136bfc7b7e6652d48a2c190d376` | 140,780 | 11958312 | 22:37:36 |
| E3.4 | ALICE `ACL.multicall` ×2 → BOB | `0x924990fbc27392b1816e02254fbe29d9987de5d18dae2f327ea380d419849b22` | 263,879 | 11958313 | 22:37:48 |
| E3.4 | ALICE `ACL.multicall` ×5 → BOB | `0xb4cb23b476a84dd6e3c8939485a5395abc0f2d74981c9f35aa93a9f8865f763c` | 621,483 | 11958314 | 22:38:00 |
| E3.4 | ALICE `ACL.multicall` ×10 → EVE7702 | `0x2ece7d920c0f471cd617d761b462491820882e0a1497cb228d17140397686795` | 1,217,488 | 11958315 | 22:38:12 |
| E3.5 | ALICE `ACL.allowForDecryption([balance])` | `0x9253b97b8f754b60bf202e2c3fc75bf6353798c3a8d3b7653a5b02bba9be1cea` | 141,493 | 11958316 | 22:38:24 |
| E5.2 | EVE7702 EIP-7702 delegation → RejectAll1271Wallet | `0x69cad73edb11c3039259ed773ee19ae5119611954342b6c560e8609b269c87ea` | 58,456 | 11958318 | 22:38:48 |
| E4.1 | deploy Keccak-f1600 helper `0x3446A1A0…E05b` | `0x06807b672df883dfdac958d80ce13cfa9e08b45786f10ce8db55aa7d4b4705aa` | 33,632,238 | 11958319 | 22:39:00 |
| E4.1 | deploy MLDSA44Verifier `0x00425424…861d` | `0xf88f7c6f2aeff592a1bb441b110a5066124dcf5a38581b32e62815e590259ce0` | 37,233,691 | 11958320 | 22:39:12 |
| E4.1 | deploy ML-DSA-44 pk blob `0x015724EC…1415` | `0xedb37023b8a7965fd5daa7a569704fb332a08362c9270f0f5e8a37bf86a36c73` | 31,917,713 | 11958321 | 22:39:24 |
| E4.1 | deploy MLDSA44Account1271 `0xeAA97EaE…5eB6` | `0x0596a20de2c9aa0b635cde201d13eb7f6aa8bc47f5ca9928ca2fb93b76355830` | 2,091,761 | 11958322 | 22:39:36 |
| E4.1 | deploy Erc1271GasMeter `0xE53Aadce…81DC` | `0x382fbb82319604a7f76aa32e5e08ab45903c51c2b3adefe3592bfdf8c28d912f` | 1,429,908 | 11958323 | 22:39:48 |
| E4.2 | mint 4242 → PQ account | `0xb42e62f0dc5e1be864f6b8f9aa7eab1d31dc8dac7eace1861bd45f1fae36c542` | 872,232 | 11958326 | 22:40:24 |

## 6. Decryption attempts (Sepolia)

Only hashes are recorded. "Digest" is the EIP-712 permit digest; "sig hash" is `keccak256(signature)`.

| Step | Requester | Request type / route | Result | Relayer status / error | Digest | Sig hash |
|---|---|---|---|---|---|---|
| E2.2 | ALICE | user-decrypt, SDK → `POST /v2/user-decrypt` | success 21000 (7.8 s) | n/a | `0x6a753b4b…f64b` | `0xd084ce69…53dc` |
| E2.5 | ALICE | user-decrypt, SDK | success 21000 (2.5 s) | n/a | `0xdb735e46…8c51` | `0x64bcf2b1…572b` |
| E2.7a | ALICE (start now+3600) | SDK local check | refused locally | "startTimestamp is set in the future" (no request) | `0x116845a5…43a2` | `0x83e5dc43…86fb` |
| E2.7b | ALICE (start now+3600) | raw `POST /v2/user-decrypt` | rejected | 400 `validation_failed`: requestValidity "Timestamp must not be in the future" | `0x116845a5…43a2` | `0x83e5dc43…86fb` |
| E2.8 | ALICE (P1 again) | user-decrypt, SDK | success 21000 (2.5 s) | n/a | `0x6a753b4b…f64b` | `0xd084ce69…53dc` |
| E3.3 | BOB, on ALICE's handle | user-decrypt, SDK | success 21000 (12.6 s) | n/a | `0x80d14c91…21e9` | `0xebec006b…4e06` |
| E3.6 | anyone | public-decrypt, SDK → `POST /v2/public-decrypt` | success 21000 (2.6 s) | n/a | n/a | n/a |
| E5.1 | EVE7702 (plain EOA) | user-decrypt, SDK | success 7702 (7.0 s) | n/a | `0x535278e9…ac39` | `0xd3fa0e8e…a7b7` |
| E5.4 | EVE7702 (7702-delegated, original key) | user-decrypt, SDK | **success 7702** (2.8 s) | n/a | `0x9da8908d…5f16` | `0x6f7a553b…188e` |
| E5.5 | EVE7702, empty signature | raw `POST /v2/user-decrypt` | rejected | 400 `validation_failed`: signature "Must be 130 characters long" | `0x9da8908d…5f16` | `0xc5d24601…a470` (empty) |
| E4.6 | PQ account, 2,420-byte ML-DSA-44 signature | raw `POST /v2/user-decrypt` | rejected | 400 `validation_failed`: signature "Must be 130 characters long" (request id `122ae62e-…a2fc`) | `0xfcafcb2d…e86b` | `0x8ae1f893…08fc` |

## 7. Other findings worth carrying into the design doc

1. **C2 is cheaper to propose than the doc assumes, but more expensive to run.** `ACL.multicall` already gives a one-transaction batch re-grant. Per-handle cost on Sepolia's current schedule is about 119K gas (measured), not 22–27K. Under Osaka rules it is about 31K (measured).
2. **The over-cap ERC-1271 failure is not a clean rejection.** Zama's crate maps it to `EmptyRevert` (recoverable) or `Transport` (transient) depending on how the host node shapes the error. A PQ account's request is therefore retried until the attempt or validity limits run out, which costs the operator repeated 250K-gas `eth_call`s.
3. **B5 on the testnet is structural.** The testnet path accepts only 65-byte ECDSA signatures, so a 7702 or PQ account cannot even opt into ERC-1271 there.
4. **Today's PQ verifiers are expensive to deploy on Sepolia's current schedule:** about 100M gas for one key (helper + verifier + blob), measured. This strengthens the case for C4(b) or C4(c) over C4(a).

## 8. Pending / next

- **B2 end-to-end:** run E2 steps 3–5 on a local stack running `main` (part of E6). Sepolia can't do it until its ACL is upgraded. `E2/e2.mjs` detects the function and will run the full sequence when it appears.
- **Sepolia connector cap:** unobservable until `v3/user-decrypt` is exposed. `node run.mjs preflight` re-probes it.
- **Second PQ verifier (optional):** ZKNOX ETHFALCON/ETHDILITHIUM were cloned but not measured.
- EVE7702 remains 7702-delegated to RejectAll1271Wallet. The `E4_MLDSA44_SEED` test seed was added to `.env` (git-ignored, never printed).

## 9. Hygiene

- `node experiments/lib/secret-scan.mjs`: scanned 68 files (all experiment sources and outputs plus `results/`) for every `.env` secret and for hex blobs of 65 bytes or more. **0 findings.**
- No mainnet interaction. No third-party contracts other than Zama's ACL, KMSVerifier, InputVerifier, ProtocolConfig and FHEVMExecutor, plus the Zama relayer. No outreach, issues, PRs or publishing.

## 10. Possible prompt injection

None found. The fetched content was relayer JSON responses, npm metadata, and upstream READMEs and code. `zama-ai/fhevm/sdk/js-sdk/CLAUDE.md` exists in the clone. It contains only `@`-includes of the SDK's contributor style docs, is not addressed to this task, and was not followed.
