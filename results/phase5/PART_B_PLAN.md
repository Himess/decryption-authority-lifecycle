# Part B: working plan (Phase 5, P1)

The brief's §4 in the order it is built. Kept current while the work runs; the reports are the record.

## Harnesses

1. **Connector drill (VPS, [M] Connector).**
   - Runs the real kms-worker on the Level 3 tree (`KW_TREE=l3`: Profile H, H7, E3, K8 and Profile Q).
   - The registry is the Level 3 ACL v0.10.0 (Core, E1, E2), built from `impl/wt-l2-main` (`lifecycle/level3`) like the
     Level 2 artifacts (`results/phase5/vps-artifacts/level3_acl_main.json`).
   - Generator: `impl/harness/phase5/make_pq_drill_tests.py`, from the Level 1 harness file plus the P0.4, P1.1 and
     P1.2 helpers. Output: `results/phase5/harness/main-l3/crates/kms-worker/tests/acl_pq_drill.rs`, filter `pq_`.
   - One scenario on one chain: the paths B1, B2 (direct), B2 (certificate), B3 (7851) and B3 (8298); then the drill
     rows; then Profile Q (B_Q) and the k = 8 and k = 9 adoption runs. Three runs.
   - The test sends the on-chain steps itself (the carry batch, the certificate relay); the real tools run in the
     local drill (D96).
2. **Local drill (M1, [M] Mock).** `impl/harness/phase5/pq-drill/` (vitest).
   - Anvil (Osaka; Amsterdam for B8); the same ACL artifact; the B0 wallet.
   - The real carry tool (B1) and watchtower (B2 certificate); the crate verifier `udsig-h` (Profile H); the SDK
     (`getAuthorityStatus`, precheck).
   - B5 with the real canary. B8 receipts.
   - This is what `make pq-drill` runs in the export.

## Steps

- **B0.** `impl/pq-wallet/` (PQWallet, Foundry tests on fixed vectors). Then one `execute` as an anvil receipt.
- **B1.** A carries N handles to W and retires in one multicall. W decrypts as itself (ERC-1271, Profile H budget),
  and through E3 (a KDA declared by `delegateForUserDecryption` sent through W's `execute`).
- **B2.** A designates W; W accepts through `execute`; time passes D; A confirms.
  - Then A retires (run 1), or the watchtower relays A's E2 certificate (run 2).
  - W reads A's handles on the delegated path (ERC-1271).
  - The design question (successor's own declared signer) is analysed and decided in DECISIONS_LOG.
- **B3.** A delegates (EIP-7702) to the PQWallet code and initializes its key.
  - (a) The proxy shows `0xef0101 ‖ wallet`.
  - (b) `anvil_setCode` with the wallet runtime; the storage written through the delegation stays.
  - One transaction signed by the old key on the local chain, recorded.
  - Why B3 does not combine with Core retirement.
- **B4.** After B_Q: the ECDSA-rooted rows are refused, the B1–B3 post-quantum rows served. k = 8 and k = 9 of 13 on
  the scenario's requests. Q5's read of the code at B_Q for adopted code (D92) is implemented and tested.
- **B5.** In the local drill.
  - The registry is owned by an operator-ratified upgrader: P3's contract, plus the acceptance of a pending ownership
    transfer.
  - 8 signatures revert. 9 signatures upgrade to a Core-preserving implementation, the guard passes, and the canary
    stays green. 9 signatures to an implementation without Core revert at the guard.
- **B6.** The old key does everything it could after each path:
  - off-chain requests on every path; permits; delegations;
  - every grant path, and publication; succession changes; a new certificate.
  - Also shown: the post-quantum key decrypts the full history, and a handle granted to A after migration is followed.
  - Matrix: `results/phase5/PQ_DRILL_MATRIX.md`, three runs per cell.
- **B7–B9.** Gap map [V]; costs (Osaka, Local-Amsterdam) and the EIP-8355 note; the live line at `v0.13.8`.
