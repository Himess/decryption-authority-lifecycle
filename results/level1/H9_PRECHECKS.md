# Level 1, part 3: rule H9 in the relayer and the SDK

**Status.** Done for the prototype. Profile H rule H9 says that advisory prechecks SHOULD use the same caps, budget
and ordering as the verifier. Zama has two such prechecks, and both now can:
- **the relayer's** signature pre-check on the v3 user-decryption endpoint
  (`relayer/src/host/signature_prechecker.rs`);
- **the SDK's** precautionary check of a signed decryption permit
  (`sdk/js-sdk/src/core/utils-p/decrypt/verifyErc1271UserDecrypt-p.ts`).

Together with the connector (`PROFILE_H_CONNECTOR.md`), this covers the three places where the 250,000 cap lives
today (connector, relayer, SDK; Phase 1 finding B6).

**Off by default, in both.** Without a policy each precheck behaves exactly as before: `ecrecover` first, then
ERC-1271 capped at 250,000 gas including calldata. The existing tests still pass unchanged.

Labels:
- **[M] M1:** AMD Ryzen 5 5600, Windows 10 Pro 19045, anvil 1.8.5 (Osaka), Node 22.13.0, vitest 4.1.9, ethers
  6.17.0, 2026-10-21.
- **[M] VPS:** the relayer build and tests on the VPS, Rust 1.99.1, in the capped scope of
  `results/level0/CONNECTOR_PROOF.md` §1.
- **[E]:** estimated.

## 1. Code

**Branch.** `lifecycle/level1` in a second worktree of the main clone, `impl/wt-l1-h9`, on top of the connector
commit `cce53bb`.

| Commit | Content |
|---|---|
| `5b69260` | SDK: Profile H in the precautionary check |
| `0eec675` | relayer: Profile H in the signature pre-check |

### 1.1 The SDK

| File | Change |
|---|---|
| `core/utils-p/decrypt/userDecryptSignaturePolicy.ts` (new) | `UserDecryptSignaturePolicy` (ordering `off` / `shadow` / `enforce`, `B_exec`, the three caps, the 7702 fallback), `PROFILE_H_DEFAULT_SIGNATURE_POLICY` (the draft's values, `off`) and `erc1271GasLimit(B_exec, calldata bytes)`. It has no imports, so the `types` entry point can export it |
| `core/utils-p/decrypt/verifyErc1271UserDecrypt-p.ts` | An optional `policy`. With one, `verifyProfileH` applies: H1 caps before any RPC; H3 gas `B_exec + 21,000 + 64 × len(calldata)`; H2 ordering. `enforce` reads the code at one block B and calls `isValidSignature` at B: no code means a 65-byte `ecrecover` only; an EIP-7702 indicator means ERC-1271 with the narrow shim (successful empty return plus the account's own 65-byte signature); other code means ERC-1271 only. `shadow` serves the `off` verdict and logs a different code-first verdict (`PROFILE-H-SHADOW`). One attempt (H4 allows at most two) |
| `core/modules/ethereum/types.ts`; `ethers/internal/ethereum{,-ct}.ts`; `viem/internal/ethereum{,-ct}.ts` | Optional `getCode` and `getBlockNumber` in the ethereum module, and an optional block for `call`. Both adapters implement them (viem's block number uncached). A module without them makes `enforce` inconclusive, which forwards, as every inconclusive check does |
| `core/types/coreFhevmRuntime.ts`, `ethers/internal/config.ts`, `viem/internal/config.ts`, `core/runtimeConfig-p.ts` | `FhevmRuntimeConfig.userDecryptSignaturePolicy`; `setFhevmRuntimeConfig` freezes it and compares it field by field, like the other settings |
| `core/kms/SignedDecryptionPermitV2-p.ts` | Passes the runtime's policy to the check |
| `core/types/index.ts` | Exports the type and the default values |

### 1.2 The relayer

| File | Change |
|---|---|
| `src/config/settings.rs` | `user_decrypt_signature_check.profile_h` (`#[serde(default)]`): `enabled` (false), `code_first_mode` (`off`), `erc1271_execution_budget` (2,000,000), the three caps, `max_erc1271_attempts` (2), `eip7702_fallback` (true). The same keys as the connector's `profile_h`, minus the verifier-only H5 and H6. An unknown mode is a configuration error at load |
| `src/host/signature_prechecker.rs` | With Profile H enabled, the pre-check calls the shared crate's `verify_user_decryption_signature` with that policy: caps, ordering at one block, budget, and the H4 gate. **What it retries stays as before:** transport failures and empty reverts, within the host-ACL retry window, an empty revert only at a later block. Every other rejection is definitive (wrong magic, reasoned revert, short or empty return on a code-bearing account), as it was. Shadow differences are logged |
| `src/startup.rs` | Passes the policy to the pre-checker |
| `config/*.yaml.example` | The new block, commented out |

**Why the retry rule stays.** H4 is a verifier rule: at most two ERC-1271 negatives per request. H9 asks the
precheck for the same caps, budget and ordering. The relayer answers the HTTP request synchronously, and a second
attempt needs a later block; widening what it retries would make it wait for a block before every wrong-magic answer.
So it keeps its own rule, now gated by H4's later-block condition.

## 2. The SDK on a local EVM [M] M1

**Setup.** `impl/harness/level1/sdk-h9/` (`run_sdk_h9.sh`, `sdk-h9-real-evm.test.ts`). The check runs from the
worktree's SDK source with **Zama's own ethers adapter**, over a JSON-RPC provider, against real accounts on anvil
(Osaka) that the test deploys:
- E4's ML-DSA-44 ERC-1271 account (the Fireblocks verifier; E4's public local test seed; 2,420-byte signatures);
- EIP-7702 accounts delegating to `RejectAll1271Wallet` and to `NoErc1271` (real type-4 transactions);
- a fresh EOA, and `OwnerWallet1271` signed by its owner.

Keys are fresh and never printed. Raw data: `raw/L1_h9_sdk_real_evm.json`, `raw/L1_h9_sdk_vitest.log`,
`raw/L1_h9_sdk_summary.txt`.

**4/4 tests pass**, on commit `5b69260`. Every row below is read from the raw JSON:

| Account and signature | No policy (today) | `off` | `shadow` | `enforce` |
|---|---|---|---|---|
| ML-DSA-44 ERC-1271 account | **refused**: `Erc1271RejectedError` (out of gas), call gas 250,000 | **accepted**, call gas **2,183,048** | — | **accepted**: 1 code read, the call at the code's block, gas 2,183,048 |
| 7702 account, reject-all delegate, root-key ECDSA | **accepted**, no RPC (the B5 gap) | accepted, no RPC | accepted, with the log line "served accept, code-first would reject" | **refused**: `Erc1271WrongMagicError`, `0xffffffff` |
| 7702 account, delegate without `isValidSignature`, root key | — | — | — | **accepted** through the shim; **refused** (`Erc1271RejectedError`) with the shim off |
| EOA, own key | — | accepted, no RPC | — | accepted after 1 code read, no call |
| EOA, another key | — | — | — | refused: `Erc1271EoaMismatchNoCodeError` |
| Regular-code wallet, owner key | — | — | — | accepted (ERC-1271), gas 2,033,544 |

**Readings.**
- **The SDK no longer refuses the post-quantum account that a Profile H verifier accepts.** Its call gets 2,183,048
  gas: 2,000,000 + 21,000 + 64 × 2,532 calldata bytes. That is the value the crate measured (`PROFILE_H_CRATE.md` §5).
- **Under `enforce` the SDK refuses the 7702 root key the account's own delegate rejects,** as the connector does.
  Under `off` or `shadow` it accepts, because the verifier would too.
- **Typical 7702 accounts keep working** through the shim, and only through it.

**Unit tests [M] M1.** `verifyErc1271UserDecrypt-p.test.ts` has 11 new tests next to Zama's 14: the caps refuse
before any RPC (signature and transport public key); the budget formula; `off` keeps today's ordering with no RPC;
`enforce` with each kind of code; the shim and its refusals; `shadow` logging; a module that cannot read code
forwards; the policy comparison. **The SDK's full unit suite passes 910/910** (35 files), with no type errors. ESLint
(the SDK's config), prettier and `tsc -b` pass. That run's log was not kept; the suite was rerun twice on 2026-10-22
on the same SDK tree (`5b69260`, unchanged at the worktree's later tip): 910/910 both times
(`raw/L1_sdk_unit_h9_rerun_r{1,2}.log`).

## 3. The relayer [M] VPS

**Why on the VPS.** M1's offline cargo cache lacks many of the relayer's dependencies, and the relayer builds
`aws-lc-sys`, a native library for which M1 has neither cmake nor NASM on its `PATH`. The VPS already builds Zama's
connector, so the relayer was built there, in the same capped scope. The rustfmt check of the changed files also ran
on M1, with the relayer's pinned toolchain 1.97.1 (rustfmt 1.9.0): clean.

**The tree.** `/srv/lifecycle/src/fhevm-main-l1h9`: the relayer, `shared/` and the two binding crates, copied from the
Level 1 tree (whose files equal `cce53bb`'s, checked by SHA-256), with the six changed relayer files copied in. Those
six files' SHA-256 equal the committed `0eec675`'s.

**The run** (`/srv/lifecycle/scripts/run_l1h9_relayer.sh`, started 16:05:05Z):
- **Toolchain:** Rust **1.99.1**, the one installed for the connector, instead of the relayer's pin 1.97.1, so no new
  toolchain was downloaded. `SQLX_OFFLINE=true` (the relayer's committed `.sqlx` data); no database.
- **Build:** the test profile in 28 min 55 s, one job, in the capped scope; `<live-service>` active throughout.
- **Unit tests: 59/59 pass:** the 12 tests of `host::signature_prechecker` (Zama's 5 and the 7 new ones) and Zama's 47
  tests of `config::settings`, which load the YAML and environment configuration with the new block absent.

| New test | Shows |
|---|---|
| `profile_h_caps_refuse_before_any_rpc` | H1: a 65,537-byte signature is refused with an empty RPC queue |
| `profile_h_off_accepts_an_eoa_signature_with_no_rpc` | `off` keeps `ecrecover` first: no RPC |
| `profile_h_enforce_refuses_a_7702_root_key_its_delegate_rejects` | H2: block, then code `0xef0100‖d`, then wrong magic at that block: refused, although the 65-byte signature recovers the account |
| `profile_h_enforce_accepts_an_eoa_after_one_code_read` | H2: block, empty code, `ecrecover`: accepted with no call |
| `profile_h_empty_revert_is_retried_only_at_a_later_block` | H4: an empty revert at block 16; the next attempt sees block 16 and makes no call; the third sees block 17 and the wallet answers the magic value |
| `profile_h_wrong_magic_is_definitive_for_the_precheck` | the relayer's retry rule is unchanged: wrong magic is answered at once |
| `profile_h_settings_default_off_and_reject_an_unknown_mode` | the block defaults to off; `enforce` maps to the crate's policy; an unknown mode is an error |

**Every relayer unit test** (the lib target, `run_l1h9_relayer_alltests.sh`): **281 passed, 0 failed, 1 ignored**
(Zama's own `#[ignore]`d `core::event::tests::test_input_proof_request_conversion_`), in 5.98 s.

**Formatting.** `rustfmt --check` with the relayer's pinned toolchain 1.97.1 (rustfmt 1.9.0), on M1: the whole crate
(`src/lib.rs` and every module it reaches), the three binaries and every integration-test file are clean.

**Lint.** The first clippy attempt (`cargo clippy --lib --tests -- -D warnings`) stopped with `rc=101`, because of the
command, not the code: `--tests` also compiles the integration-test targets, which need the `integration-tests`
feature (`ethereum_rpc_mock`), so `dispatch_gate_test` could not find that crate. Zama's own target is
`make clippy` = `cargo clippy --workspace --all-targets --all-features -- -D warnings`. **It passes** (rc 0, 8 min 16 s,
Rust 1.99.1; `run_l1h9_relayer_lint.sh`, `logs/l1h9-relayer-lint.log`).

**The three capped runs** (from `heavy.sh`): build and targeted tests 2,364 s (that run's last step was the clippy
command above, hence its rc 101); every unit test 57 s; Zama's clippy 501 s. No freeze, nothing killed; the scope's
memory reached its 2,560 MB cap during the builds and swapped up to 223 MB. `<live-service>` was active before and
after each run, and the VPS was left idle (no container, scope or build process).

**Raw data:** `raw/vps/l1h9/` (the three scripts; `logs/l1h9-relayer.log`, `l1h9-relayer-alltests.log`, and the
`<live-service>` checks in `health_l1h9.log`). The logs were scanned for secrets: the only matches are test names.

## 4. What this does not show

- **Not through a live relayer HTTP flow.** The relayer pre-check is tested at the unit level with a mocked provider;
  the end-to-end path through the HTTP handler is Zama's own `user_decrypt_v3_test.rs`, which needs its integration
  setup and was not run here.
- **The SDK on viem.** The viem adapter got the same two functions; the run used the ethers adapter.
- **H7** (re-checking stored results) is still open.

## 5. Reproduction (from `fhe-authority-lifecycle/`)

```bash
# SDK unit tests (worktree on lifecycle/level1; link its node_modules first)
node impl/harness/level2/link_deps.mjs impl wt-l1-h9
(cd impl/wt-l1-h9/sdk/js-sdk && node node_modules/vitest/vitest.mjs run --config src/vitest.config.ts)
# SDK on a local EVM (needs experiments/contracts built and E4's Python venv)
bash impl/harness/level1/sdk-h9/run_sdk_h9.sh
```

The relayer (on the VPS, in the capped scope; the scripts are in `raw/vps/l1h9/scripts/`):

```bash
S=/srv/lifecycle/scripts
$S/bg.sh l1h9-relayer $S/run_l1h9_relayer.sh                    # build, the pre-check and settings tests
$S/bg.sh l1h9-relayer-alltests $S/run_l1h9_relayer_alltests.sh  # every lib unit test
$S/bg.sh l1h9-relayer-lint $S/run_l1h9_relayer_lint.sh          # Zama's `make clippy`
```
