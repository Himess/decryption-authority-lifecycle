# Patches, by level

Our local commits on Zama's `fhevm` repository, exported with `git format-patch` by `scripts/export_patches.py`. Apply each series with `git am`, in the order below, on a clone of `zama-ai/fhevm`. Nothing here has been pushed or proposed anywhere. The code is Zama's (BSD 3-Clause Clear) with our changes; see `NOTICE`.

Bases: `main` = `ed851716c9a6b799996a23399ece2858336f96db`; tag `v0.13.8` = `fe3ca89b5111ca2b4abb220bf3c78417b821ceb5`; tag `v0.14.4` = `ccdd1ce0`.

| Series | Apply after | Commits | Base → tip | Rebuilds the branch tree |
|---|---|---|---|---|
| `level0/main/` | main `ed851716c` | 3 | `ed851716c` → `5e61f3de4` | yes |
| `level1/main/` | `level0/main` | 8 | `5e61f3de4` → `256306b68` | yes |
| `level2/main/` | `level0/main` | 8 | `5e61f3de4` → `c4482aba5` | yes |
| `level3/main/` | `level2/main` | 6 | `c4482aba5` → `83f7312a2` | yes |
| `level3/verifier/` | the first 4 patches of `level1/main` (commit `cce53bb`) | 3 | `cce53bbb0` → `719e68c1a` | yes |
| `level3/connector/` | the first 7 patches of `level1/main` (commit `a15aaa6`) | 5 | `a15aaa67a` → `e8a5a685d` | yes |
| `phase4/sdk-status/` | `level2/main` | 2 | `c4482aba5` → `dbb289039` | yes |
| `phase5/connector/` | `level3/connector` | 1 | `e8a5a685d` → `a4416155c` | yes |
| `level0/v0.14.4/` | tag `v0.14.4` (`ccdd1ce0`) | 2 | `ccdd1ce0d` → `a2fa91bff` | yes |
| `level0/v0.13.8/` | tag `v0.13.8` (`fe3ca89b5`) | 3 | `fe3ca89b5` → `06d769f29` | yes |
| `level0/v0.13.8-mock/` | `level0/v0.13.8` | 1 | `06d769f29` → `228e85fc2` | yes |
| `level2/v0.13.8/` | `level0/v0.13.8-mock` | 4 | `228e85fc2` → `588e63970` | yes |
| `level2/v0.13.8-mock/` | `level2/v0.13.8` | 3 | `588e63970` → `a3e6cbf8c` | yes |
| `level3/v0.13.8/` | `level2/v0.13.8` | 3 | `588e63970` → `6467036e4` | yes |

**The commits of each series:**

- `level0/main/`: `feat(host-contracts): ACL v0.8.0 with account retirement (lifecycle Core, Level 0)`; `test(host-contracts): Level 0 retirement tests for ACL v0.8.0`; `test(host-contracts): follow the ACL v0.8.0 version bump in the Hardhat upgrade test`
- `level1/main/`: `feat(shared): Profile H verifier hygiene in user-decryption-signature (lifecycle Level 1)`; `test(shared): deterministic Profile H tests with a mocked provider`; `fix(shared): count a top-level out-of-gas isValidSignature as an empty revert (Profile H4)`; `feat(kms-worker): Profile H in the connector (lifecycle Level 1)`; `feat(sdk): Profile H in the precautionary signature check (lifecycle Level 1, H9)`; `feat(relayer): Profile H in the signature pre-check (lifecycle Level 1, H9)`; `feat(kms-connector): H7 stored-result revalidation and persistent H4 attempts (lifecycle Level 1)`; `feat(relayer): H7 stored-result revalidation and dedup key (lifecycle Level 1)`
- `level2/main/`: `feat(host-contracts): ACL v0.9.0 with the E1 successor extension (lifecycle Level 2)`; `test(host-contracts): E1 successor tests for ACL v0.9.0 (TC17, TC18)`; `test(host-contracts): follow the ACL v0.9.0 version bump in the Hardhat upgrade test`; `feat(library-solidity): FHE.isAccountRetired for applications (lifecycle Level 2, Profile A)`; `test(host-contracts): Profile A ERC-7984 variant and TC23 tests (lifecycle Level 2)`; `style(host-contracts): prettier on the lifecycle tests; ignore the vendored OZ copy`; `feat(sdk): lifecycle hygiene in the SDK (Decryption Authority Lifecycle, Level 2)`; `fix(sdk): refuse a disposed transport key pair before requesting shares`
- `level3/main/`: `test(host-contracts): exclude every declared interface id from the ERC-165 fuzz test`; `feat(host-contracts): ACL v0.10.0 with the E2 retirement certificate (lifecycle Level 3)`; `test(host-contracts): E2 retirement-certificate tests (TC19, TC24)`; `test(host-contracts): governance profile tests (timelock, guard, canary, pinning)`; `test(host-contracts): Profile Q on-chain door, asserted residual (TC22, lifecycle Level 3)`; `test(conformance): add the Decryption Authority Lifecycle conformance kit adapter`
- `level3/verifier/`: `feat(shared): E3 declared decryption signer, the KDA route (lifecycle Level 3)`; `feat(shared): K8 implementation diversity for the KDA route (lifecycle Level 3)`; `feat(shared): Profile Q's signer rule (Q4) in the signature check (lifecycle Level 3)`
- `level3/connector/`: `feat(shared): E3 declared decryption signer, the KDA route (lifecycle Level 3)`; `feat(shared): K8 implementation diversity for the KDA route (lifecycle Level 3)`; `feat(kms-worker): E3, the KDA route, in the connector (lifecycle Level 3)`; `feat(shared): Profile Q's signer rule (Q4) in the signature check (lifecycle Level 3)`; `feat(kms-worker): Profile Q in the connector (lifecycle Level 3)`
- `phase4/sdk-status/`: `feat(sdk): Profile H in the precautionary signature check (lifecycle Level 1, H9)`; `feat(sdk): report the account's code in getAuthorityStatus (EIP-7702, EIP-7851)`
- `phase5/connector/`: `feat(kms-worker): Profile Q5 reads the state at B_Q (lifecycle Phase 5)`
- `level0/v0.14.4/`: `feat(host-contracts): ACL v0.5.1 with account retirement (lifecycle Core, Level 0, 0.14 line)`; `test(host-contracts): Level 0 retirement tests on the 0.14 line, with U6`
- `level0/v0.13.8/`: `feat(host-contracts): ACL v0.4.1 backport of account retirement (lifecycle Core, Level 0)`; `test(host-contracts): Level 0 retirement tests for the ACL v0.4.1 backport`; `test(host-contracts): follow the ACL v0.4.1 version bump in the Hardhat upgrade test`
- `level0/v0.13.8-mock/`: `test(sdk/contracts): re-point the v0.13.0 cleartext mock at the ACL v0.4.1 backport`
- `level2/v0.13.8/`: `feat(host-contracts): ACL v0.4.2 backport of the E1 successor extension (lifecycle Level 2)`; `test(host-contracts): E1 successor tests for the ACL v0.4.2 backport (TC17, TC18)`; `test(host-contracts): follow the ACL v0.4.2 version bump in the Hardhat upgrade test`; `style(host-contracts): prettier on the lifecycle tests; ignore the vendored OZ copy`
- `level2/v0.13.8-mock/`: `test(sdk): re-point the cleartext mock's ACL at the lifecycle ACL v0.4.2 (Level 2)`; `feat(sdk): lifecycle hygiene in the SDK (Decryption Authority Lifecycle, Level 2)`; `fix(sdk): refuse a disposed transport key pair before requesting shares`
- `level3/v0.13.8/`: `feat(host-contracts): ACL v0.4.3 with the E2 retirement certificate (lifecycle Level 3, v0.13 line)`; `test(host-contracts): E2 retirement-certificate tests (TC19, TC24) on the v0.13 line`; `test(conformance): add the Decryption Authority Lifecycle conformance kit adapter`

**Checked.** On a temporary index holding each series' base tree, `git apply --cached` of the series, in order, gives exactly the tree of the branch it was exported from.

How to reproduce each level: `results/level{0,1,2,3}/README.md` and the Phase 4 reports in `results/phase4/`.
