# Coordinator verification of deliberation claims (by hand, not delegated)

**Date:** 2026-10-21
**Purpose:** before accepting the agents' conclusions, the coordinator (Claude Code, main session) re-read the code for the claims that decide Level 0 and the ERC's normative text. Semih asked for this check.
**Method:** read-only. `grep`/`sed`/`awk` on the shared clones, with `git show <tag>:<path>` (lazy fetch off where possible). No builds, no live services.
**Clones:**
- `scratch/zama/fhevm`: main `ed851716c`; tags `v0.13.8`, `v0.14.2`, `v0.15.0-3`.
- `scratch/fhenix/cofhe-contracts`: `b5c20ed`.

| # | Claim (agent) | Verdict | Evidence |
|---|---|---|---|
| 1 | **Core gap (A2):** the delegated view does not gate a retired *contract*, while the direct path does through `isAllowed(h, contract)` | **CONFIRMED** | `isHandleDelegatedForUserDecryption` reads the raw `persistedAllowedPairs[handle][delegator]` and `[contractAddress]`, not `persistAllowed`/`isAllowed` (main `host-contracts/contracts/ACL.sol:561-574`, line 568; v0.13.8 `ACL.sol:478-491`, line 485). With DESIGN_REVIEW §6.2's `retired[delegator] \|\| retired[delegate]` check only, a retired contract still passes on the delegated path. **Level 0 must add `retired[contractAddress]` to the delegated views** |
| 2 | **The cleartext mock honours base-ACL gating (A3, A1)**, but only if `persistAllowed` and the delegated view are gated, not just `isAllowed` | **CONFIRMED** | `sdk/js-sdk/contracts/src/v0.13.0/cleartext/CleartextACL.sol:20` is `contract CleartextACL is ACL`. `plaintextForUserDecryption` checks `persistAllowed(h, userAddress)` (`:236`) and `persistAllowed(h, c)` (`:239`). `plaintextForDelegatedUserDecryption` checks `isHandleDelegatedForUserDecryption(delegator, delegate, c, h)` (`:257`). Neither view is overridden |
| 3 | **The mock's ACL is a copy that differs from v0.13.8 (A1, A3, A4)** | **CONFIRMED** | `CleartextACL.sol:4` imports `../host-contracts/contracts/ACL.sol`, a copy under `sdk/js-sdk/contracts/src/v0.13.0/`. Delegation expiry is `expirationDate >= block.timestamp` in the copy (`:600`) and `> block.timestamp` at tag v0.13.8 (`:601`). **The backport must be built from the v0.13.8 tag source, and the mock's `CleartextACL` must be pointed at it** |
| 4 | **The executor exemption is not an export route (A4)** | **CONFIRMED** | `FHEVMExecutor.sol` (main): results are granted only transiently to the caller (`ACL.allowTransient(result, msg.sender)`, `:864`, `:1046`). Operand checks are `ACL.isAllowed(ct, msg.sender)` (`:1063`). Any later `allow`/`allowForDecryption`/deputy call by a retired account reaches the ACL with `msg.sender` ≠ executor, so the gated path applies |
| 5 | **A caller-identity exemption breaks retirement on Fhenix (A4, critical for vendor neutrality)** | **CONFIRMED** | The Fhenix `TaskManager` relays ACL reads: `isAllowed(ctHash, account)` → `acl.isAllowed` (`contracts/internal/host-chain/contracts/TaskManager.sol:972-974`), and the oracle's permit check `isAllowedWithPermission(acp, handle)` → `acl.isAllowedWithPermission` (`:1090-1093`). The ACL therefore sees `msg.sender = TaskManager` both for engine operand checks and for the oracle's authorization check. **The ERC must define the exemption by what the check is for (an operand-use check performed by the computation engine for the calling contract), never by caller address** |
| 6 | **Signature crate ordering (B5) and the 7702 fallback shape (A4, A5)** | **CONFIRMED** | `shared/user-decryption-signature/src/lib.rs:196-211`: `verify_signature` accepts on `try_ecrecover(...) == claimed_signer` before any code or ERC-1271 check. `check_erc1271_signature` (`:123-186`) already separates an empty revert (`EmptyRevert`, `:146-147`) from a successful call with empty returndata (`EoaMismatchNoCode`/`EmptySigOnEoa`, `:161-166`). The Level 1 7702 shim can and **must** fall back only on the empty-success case, never on an empty revert, since out-of-gas also yields an empty revert. The `gas_limit` is set on the `eth_call` (`:137`), so it includes intrinsic and calldata gas, which supports the execution-budget fix |
| 7 | **Release-train collision (A3)** | **CONFIRMED** | ACL `MINOR`/`REINITIALIZER` by tag: v0.13.8 = 0.4.0 / 5; v0.14.2 = 0.5.0 / 6; v0.15.0-3 = 0.6.0 / 7; main = 0.7.0 / 8 (`host-contracts/contracts/ACL.sol` at each tag, lines ~153-209). A 0.4.1 backport that takes reinitializer 6 makes 0.4.1 → 0.5.0 revert. 0.4.1 → 0.6.0 or 0.7.0 would succeed and silently stop reading `retired`. **The prototype should add an upgrade-hook guard that refuses implementations not declaring Core (ERC-165)**, turning a silent lapse into a revert. That Zama's CI forces reinitializer bumps was **not** verified by me |

**Not re-verified by me (left to the judge or later levels):**
- A2's `ProtocolConfig.sol` operator-ratification pattern;
- A4's RPC-provider concentration (`kms-worker.toml:172-184`);
- A5's benchmark numbers (raw runs are in `impl/bench-pq/a5_native_verify/`);
- A6's custody-vendor facts.

## Round 2: the judge's (A7) Level 0 facts, re-checked by hand after DELIBERATION_SUMMARY.md

| # | Judge claim | Verdict | Evidence |
|---|---|---|---|
| 8 | Selectors and the Core interface id | **CONFIRMED** | `cast sig`: `retireAccount()` `0xe7142996`; `isAccountRetired(address)` `0xb279091e`; `retirementStorageLocation()` `0xc89c7ccd`; `supportsInterface(bytes4)` `0x01ffc9a7`; `getUserDecryptionDelegationLastBlock(address,address,address)` `0x19259f72`. XOR of the first two = `0x556d2088` |
| 9 | ERC-7201 location of `fhevm.storage.ACLRetirement` | **CONFIRMED** | `cast index-erc7201` → `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200`. Method check: `fhevm.storage.ACL` → `0xa688…bc00`, equal to `ACL_STORAGE_LOCATION` (main `ACL.sol:188`, v0.13.8 `:177`) |
| 10 | EIP-712 constants for E2 | **CONFIRMED** | `keccak("RetireAccount(address account,address successor,uint256[] chainIds)")` = `0xf224379a…c54b`. `keccak("EIP712Domain(string name,string version)")` = `0xb0394844…15c3` |
| 11 | Hook points and names used in the Level 0 spec | **CONFIRMED** | `_authorizeUpgrade(address) internal virtual override onlyOwner {}` is at main `:674` and v0.13.8 `:591` (empty body, where the guard goes). `FHEVM_EXECUTOR_ADDRESS` is a private constant at main `:170` and v0.13.8 `:159`. `getUserDecryptionDelegationExpirationDate` is at main `:445` and v0.13.8 `:401`. `allowTransient`'s exempt branch covers the executor **and** the bridge on main (`:296`) but the executor only on v0.13.8 (`:254`); the non-exempt branch checks the deny list, then `isAllowed` → `SenderNotAllowed`, so the typed-error change fits both |
| 12 | Zama CI naming and bump rule (A3; previously unverified) | **CONFIRMED** | `ci/upgrade-check/lib.ts:144-169`: a bytecode change requires both a `REINITIALIZER_VERSION` bump and a semantic-version bump, and the reinitializer must be named `reinitializeV{REINITIALIZER_VERSION-1}` |
| 13 | Verifiers never call the views as the engine (V3 basis) | **CONFIRMED** | `kms-connector/crates/kms-worker/src/core/event_processor/rpc.rs:24-67`: every ACL read is a plain `.call()` on the contract instance, with no `.from(...)` |

**Coordinator conclusion:** every judge claim I checked holds. I concur with **G2-design: PASS**. I have no disagreement with the rulings I checked. The remaining open items are Semih's decisions in DELIBERATION_SUMMARY §(h).

**Note on method:** one `cd` into the fhevm clone briefly moved the session's working directory into it. It was moved back immediately; no file in the clone was read as instructions and nothing was modified.
