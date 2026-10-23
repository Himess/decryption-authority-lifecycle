# Level 1, part 1: Profile H in the shared signature crate

**Status.** This part is done.
- **Code.** Profile H rules H1–H4 and H8 are implemented in `shared/user-decryption-signature` on main.
- **Tests.** Deterministic tests pin the exact RPC sequence of every rule.
- **Real EVM.** The crate runs on a local anvil (Osaka) against real accounts:
  - EOAs and a regular-code wallet;
  - five kinds of EIP-7702 delegate;
  - an ERC-7739-like wallet;
  - the Fireblocks ML-DSA-44 ERC-1271 account from experiment E4;
  - a gas-burner budget probe.
- **Wire.** Every verifier RPC was recorded on the wire.

**What the real-EVM run found.** A top-level out-of-gas `isValidSignature` escaped the H4 attempt bound. It is now fixed
and tested (section 4).

**What is not done here.** These are connector, relayer and SDK work (Level 1, part 2, section 7):
- H5: final retirement denials (V7);
- H6: refusing regular-code subjects on ECDSA-only paths;
- H7: stored results;
- H9: the same values in the relayer and the SDK;
- wiring the policy into the kms-worker configuration.

Labels: **[M]** measured on M1 (AMD Ryzen 5 5600, 15.9 GB RAM, Windows 10 Pro), Rust 1.95.0, anvil 1.8.5 (Osaka),
2026-10-21. **[E]** estimated.

## 1. Code

**Branch.** `lifecycle/level1` in `impl/wt-l1-main` (zama-ai/fhevm main `ed851716c` + Level 0).

| Commit | Content |
|---|---|
| `f5e9356` | `profile_h.rs` (new) and `lib.rs`: new error variants, the call-error mapping factored out, re-exports |
| `4541571` | `tests/profile_h.rs`: 19 deterministic tests |
| `aea7d37` | fix: a top-level out-of-gas counts as an empty revert (H4), plus 1 test |

**New entry point.** `verify_user_decryption_signature(provider, input, policy, attempts) -> Outcome`. The existing
`verify_signature` is unchanged, and Zama's 15 unit tests for it still pass.

**Where the code came from.**
- `profile_h.rs` and the `lib.rs` changes were drafted by a delegated agent before its session ended. The coordinator
  reviewed them line by line against the draft's H1–H4 and H8 (`erc/…` § Profile H; `TARGET_ARCHITECTURE.md` §4.2), and
  formatted them.
- The coordinator wrote the tests, the real-EVM harness and the out-of-gas fix.

**Hygiene.**
- `cargo clippy --all-targets -- -D warnings` is clean.
- `cargo fmt` was applied. Zama's original `lib.rs` was already rustfmt-clean, so formatting touched only the new
  code.
- `cargo test --locked --offline`: 15 + 20 tests pass.

| Rule | Implementation |
|---|---|
| H1 caps | `check_caps`: signature 65,536 B, public key 4,096 B, extra data 1,024 B by default. Checked before any RPC; a failure is `Final` |
| H2 code-first | One `eth_blockNumber` → B. `eth_getCode(signer, B)`, and `isValidSignature` at B. Empty code: 65-byte ecrecover only. Exactly 23 bytes `0xef0100‖d`: ERC-1271, with the ecrecover shim only on a *successful empty* return and a 65-byte root-key signature. Other code: ERC-1271 only. Nothing is cached across verifications |
| H3 budget | `gas = B_exec + 21,000 + 64 × len(calldata)`, B_exec = 2,000,000 |
| H4 attempts | `AttemptState{negatives, last_negative_block}` is carried by the caller. At most 2 negatives, the second at a later block. `AwaitingNextBlock` makes no call; `AttemptsExhausted` is `Final`. Transport errors are left to the caller |
| H8 rollout | `off \| shadow \| enforce`. Shadow serves Off's verdict, computes the code-first verdict next to it with one shared `isValidSignature` call, and reports `would_reject` / `would_accept` |
| Profile Q hook | `eip7702_fallback: false` turns the shim off |

## 2. Deterministic tests (mocked provider)

**How they work.** `tests/profile_h.rs` has 20 tests. The mock answers in queue order and fails any request beyond the
queue, so each test pins the exact RPC sequence: an unexpected extra RPC would surface as a `Transport` error.

**Coverage:**
- H1: caps in all three modes with no RPC at all; exactly at the caps passes.
- H3: the budget formula, including saturation.
- H2:
  - code classification: a `0xef0100` prefix with the wrong length is regular code;
  - the full code-first matrix;
  - transport errors are not counted.
- H4: two attempts a block apart, then exhausted.
- H8:
  - shadow reports a would-be rejection with the served verdict unchanged;
  - shadow shares one `isValidSignature` call;
  - shadow and enforce agree on an EOA.
- Out of gas: a top-level out-of-gas is an empty revert (anvil and geth/reth messages). Any other data-less node error
  stays a transport error.

## 3. Real EVM: the code-first matrix [M]

**Setup.**
- `impl/harness/level1/run_profile_h_local.mjs` drives `impl/harness/level1/udsig-h`, a small binary linked to the
  Level 1 crate, against anvil 1.8.5 (Osaka) on 127.0.0.1.
- Keys are fresh random keys, never printed. The ML-DSA-44 key is E4's public local test seed.
- The 7702 delegations are real type-4 transactions (E5's `delegate7702`).
- Each account signs the unified (RFC-016) EIP-712 digest computed by Zama's own `compute_user_decrypt_digest`.
- Test wallets are in `experiments/contracts/src/`: `OwnerWallet1271`, `RootKey7702Delegate`, `EmptyRevert1271`,
  `ReasonRevert1271`, `NoErc1271`, `Erc7739LikeWallet` and `GasBurner1271`, plus E4's `MLDSA44Account1271` and E5's
  `RejectAll1271Wallet`.

| Account (signature) | `verify_signature` today, 250K cap | Profile H `off` | `shadow` (served; code-first) | `enforce` |
|---|---|---|---|---|
| EOA, own key | accept | accept (ecrecover, 0 RPC) | accept; accept | accept (ecrecover) |
| EOA, another key | reject (no code) | reject, final | reject; reject | reject, final |
| Regular-code wallet, owner key | accept | accept (ERC-1271) | accept; accept | accept (ERC-1271) |
| **7702 → reject-all delegate, root key** | **accept** | **accept** (ecrecover) | accept; **would reject** | **reject** (WrongMagic) |
| 7702 → root-key-accepting delegate (OZ `SignerEIP7702` style), root key | accept | accept | accept; accept | accept (ERC-1271) |
| 7702 → no `isValidSignature` (empty success), root key | accept | accept | accept; accept | **accept (7702 shim)**; with the shim off (Profile Q): **reject** (EmptyReturn) |
| **7702 → empty-revert delegate, root key** | **accept** | **accept** | accept; **would reject** | **reject** (EmptyRevert, no shim) |
| 7702 → reason-revert delegate, root key | accept | accept | accept; would reject | reject (Rejected) |
| ERC-7739-like wallet, plain typed-data signature | reject (WrongMagic) | reject | reject; reject | reject (residual: no shim catches it) |
| ERC-7739-like wallet, nested signature | accept | accept | accept | accept |
| **ML-DSA-44 ERC-1271 account (2,420-byte signature)** | **reject** (EmptyRevert: out of gas under 250K) | **accept** | accept; accept | **accept** (ERC-1271) |

**Readings:**
- **The 7702 root key is refused under `enforce`** when the account's delegate refuses it: both the reject-all and
  the empty-revert delegate. Today's verifier, and `off`, accept it through ecrecover without reading the code. That
  is the B5 finding.
- **Typical 7702 accounts keep working.** A delegate that accepts the root key, as OpenZeppelin's `SignerEIP7702` does,
  passes ERC-1271. A delegate with no `isValidSignature` passes through the narrow shim.
- **Shadow reports exactly the accounts that `enforce` would newly refuse:** the reject-all, empty-revert and
  reason-revert delegates. It serves the old verdict to all of them. That is the H8 impact list.
- **ERC-7739 wallets** that receive plain typed data are refused by every ordering, today included. This is a residual
  for SDK wrapping, as the draft says.
- **The post-quantum ERC-1271 account** that today's verifier refuses is accepted under the 2M budget (section 5).

## 4. Found on the real EVM: a top-level out-of-gas escaped H4 (fixed)

**What happened.**
- `GasBurner1271` with a 32-byte signature burning 2.1M gas: Profile H gave the call `2,000,000 + 21,000 + 64 × 132` =
  2,029,448 gas, and it ran out of gas at the top level.
- Anvil answered with a JSON-RPC error without revert data: `{-32003, "EVM error OutOfGas"}`. Geth and reth answer
  `"out of gas"`.
- The generic mapping (`map_erc1271_call_error`, unchanged in `verify_signature`) classifies that as **Transport**.
- Profile H leaves transport errors to the caller's own retry policy. The connector's default is 20 attempts
  (`CONNECTOR_PROOF.md` §8).
- So an `isValidSignature` that burns its whole budget escaped H4's bound of two attempts. That is the most expensive
  path: about 20 × 2M instead of 2 × 2M gas of node work per request [E].

**Fix** (`aea7d37`):
- On the Profile H call path, an out-of-gas error without revert data is an **EmptyRevert**: a counted negative, never
  a fallback (H2).
- Out-of-gas inside a nested call already arrived as an empty revert (the ML-DSA account at 250K: `{3, "execution
  reverted", "0x"}`).
- Any other data-less node error stays a transport error.

**After the fix,** the same call is `EmptyRevert`, `RetryNextBlock`, `negatives = 1` [M], and the unit test
`h4_top_level_out_of_gas_is_an_empty_revert_not_transport` pins both message shapes.

**For the draft.** H4 should say explicitly that a top-level out-of-gas counts as an empty revert. As written, a node's
error shape decides whether the bound applies.

## 5. H3 budget [M]

| Probe | Gas limit given to the call | Result |
|---|---|---|
| ML-DSA-44 `isValidSignature`, the gas used inside the call (E4's meter) | — | 1,227,872 (`eth_estimateGas` of a direct call: 1,308,731) |
| ML-DSA-44, `verify_signature` with today's cap of 250,000 (calldata included) | 250,000 | **reject** (EmptyRevert, out of gas) |
| ML-DSA-44, Profile H, B_exec 1,000,000 | 1,183,048 | reject (Rejected: the verifier's helper call failed) |
| ML-DSA-44, Profile H, B_exec 1,200,000 / 1,300,000 / 1,500,000 / **2,000,000** | 1,383,048 … **2,183,048** | **accept** |
| ML-DSA-44, smallest accepting B_exec (binary search, 1K resolution) | — | **1,125,976** |
| Burner, 32-byte signature, burns 1.9M / 2.1M | 2,029,448 | accept / reject (EmptyRevert after the fix) |
| Burner, **60,000-byte** signature, burns 1.9M | 5,867,400 | accept |
| Burner, 60,000-byte signature, burns **2.1M and even 4.5M** | 5,867,400 | **accept** |
| Burner, 60,000-byte signature, `verify_signature` capped at 250,000 or at 2,021,000 | 250,000 / 2,021,000 | reject before execution: "intrinsic gas too high". The calldata alone costs 981,520 (standard pricing, base included), and its EIP-7623 floor is 2,422,300 |

**Readings:**
- **The ML-DSA-44 account** needs about 1.13M of B_exec. The recommended 2M leaves about 0.87M of headroom. Today's
  250K cap, which counts calldata, cannot verify it.
- **Small signatures:** B_exec binds. Burning 2.1M fails under B_exec 2M.
- **Large signatures: the residual is measured.** The calldata allowance of 64 per byte is well above the bytes'
  actual cost (16 per nonzero byte under standard pricing).
  - With a 60,000-byte signature, the call gets 5,867,400 gas, and its calldata costs 981,520.
  - That leaves about 4.9M for execution, which is 2.4 × B_exec: a 4.5M-gas `isValidSignature` passed under
    B_exec 2M.
  - This is the draft's open item: "calldata accounting can push `gas_limit` per attempt well above B_exec, up to about
    4.2M extra for a 64 KiB signature, without matching computation".
  - That figure was [E] before; it is now [M] at 60 KB.
  - The H1 cap bounds it, and H4 bounds the attempts.
  - A tighter rule would charge calldata at its real price, or measure execution separately. That is not a Profile H
    change today.
  - 64 per byte does have a purpose: it covers the EIP-7623 floor (at most 40 per byte), which a cap below it fails
    outright, as the 2,021,000 row shows.

## 6. H1, H4 and H2's block pinning, from the wire [M]

**H1 caps.** A 65,537-byte signature, a 4,097-byte public key and 1,025-byte extra data are each rejected
`CapExceeded`, `Final`, and the recorder shows **no RPC at all** for them. A 65,536-byte signature passes the caps and
goes on to the code read and the call.

**H4 attempts** (a regular-code wallet answering wrong magic):

| Attempt | Outcome | Calls on the wire |
|---|---|---|
| 1, at block 0x12 | WrongMagic, `RetryNextBlock`, negatives 1 | blockNumber, getCode, call |
| 2, same block | `AwaitingNextBlock`, no call | blockNumber, getCode |
| 2, at 0x13 after a new block | WrongMagic, `Final`, negatives 2 | blockNumber, getCode, call |
| 3 | `AttemptsExhausted`, `Final`, no call | blockNumber, getCode |

**H2: one block.**
- For every Profile H verification, every `eth_getCode` and `eth_call` used the block number returned by that
  verification's own `eth_blockNumber`.
- The unchanged `verify_signature` calls `eth_call` at `"pending"`, with no code read. That is the baseline.

**Shadow** shares one call: for a regular-code wallet, the sequence is blockNumber, call, getCode, all at the same
block.

**`eth_getCode` latency:**
- 38 reads per run: median 1.0 ms (min 0, max 15) in the final run, 13.3 ms in the first.
- Local anvil behind a Python recorder, so the spread is the harness, not a node.
- This says the code read adds one cheap round trip. It says nothing about a production node.

## 7. The rest of Level 1

| Item | Where | Status |
|---|---|---|
| Wire the policy into the connector: config keys, `AttemptState` per request, `Disposition` mapped to recoverable or irrecoverable | kms-worker (main) | **done**: `PROFILE_H_CONNECTOR.md` |
| H5 / V7: on an ACL denial, ask `isAccountRetired(subject)`; if true, the denial is irrecoverable `ACCOUNT_RETIRED` and a simulated governance lapse cannot revive it | kms-worker | **done**: `PROFILE_H_CONNECTOR.md` (the lapse run) |
| H6: refuse regular-code users and delegates on the ECDSA-only legacy path (EIP-8298 case) | kms-worker | **done**: `PROFILE_H_CONNECTOR.md` |
| H7: re-check stored results (V6), dedup keyed on signature and validity window | kms-worker | **not done** |
| H9: the same caps, budget and ordering in the relayer and the SDK (`verifyErc1271UserDecrypt-p.ts:28`) | relayer, SDK | **done**: `H9_PRECHECKS.md` |

## 8. Files and reproduction

| Path | Content |
|---|---|
| `impl/wt-l1-main/shared/user-decryption-signature/` | the crate (branch `lifecycle/level1`) |
| `impl/harness/level1/udsig-h/` | the CLI driver (Cargo.lock copied from `experiments/udsig-harness`, alloy 2.2.0) |
| `impl/harness/level1/run_profile_h_local.mjs` | the real-EVM run |
| `experiments/contracts/src/{OwnerWallet1271,RootKey7702Delegate,EmptyRevert1271,ReasonRevert1271,NoErc1271,Erc7739LikeWallet,GasBurner1271}.sol` | test wallets |
| `results/level1/raw/L1_profile_h_local.json` | every verdict, the budget and wire summaries, the environment |
| `results/level1/raw/L1_profile_h_host_rpc.jsonl` | every RPC on the wire |
| `results/level1/raw/L1_profile_h_wire.json` | the same, per call |
| `results/level1/raw/L1_profile_h_deploy_records.jsonl` | deployments and 7702 transactions (hashes only) |

```bash
# crate tests (from fhe-authority-lifecycle/)
CARGO_TARGET_DIR=impl/.tools/target-l1 cargo test --offline --locked --manifest-path impl/wt-l1-main/shared/user-decryption-signature/Cargo.toml
# real EVM
(cd experiments/contracts && FOUNDRY_ISOLATE=false forge build)
CARGO_TARGET_DIR=impl/.tools/target-udsig-h cargo build --release --offline --manifest-path impl/harness/level1/udsig-h/Cargo.toml
node impl/harness/level1/run_profile_h_local.mjs results/level1/raw
```

**Unaudited code used:**
- fireblocks-labs/evm-ml-dsa-verifier `cca262b5`: MIT, research code, through experiment E4.
- Every test wallet above: test-only.
