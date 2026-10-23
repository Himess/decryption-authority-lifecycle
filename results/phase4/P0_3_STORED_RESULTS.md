# P0.3: stored results (V6, H7) and H4 across a restart

**Proof class:** Connector. **Status:** done. **Date:** 2026-10-21.

**Machine:** the VPS, a capped scope (`MemoryMax=2560M`, `CPUQuota=200%`), Rust 1.99.1, anvil 1.3.5, Postgres 17.5 in
`lifecycle-pg`. **Bases:** fhevm `main` `ed851716c`, `v0.13.8` `fe3ca89b5`.

**Code:**

- `lifecycle/level1` `a15aaa6`: the connector's endpoint and kms-worker.
- `lifecycle/level1` `256306b`: the relayer.

**Raw data:** `raw/p03/`, scrubbed and secret-scanned (`raw/p03/SCAN_REPORT.txt`: 82 files, 0 hits).
**Table:** `p03/P03_TABLE.md`, generated from the raw runs by `impl/harness/phase4/analyze_p03.py`.

## 1. Where results and deduplication keys are stored

Every place where a user decryption result, or a key that leads to one, is kept and can be served again. Each entry
was read from the code at both bases.

| Place | What is kept | Key | Served again | Retention | `main` `ed851716c` | `v0.13.8` `fe3ca89b5` |
|---|---|---|---|---|---|---|
| Connector Postgres: `user_decryption_responses` | The KMS's signcrypted shares and signature, or an error code | `decryption_id` | **main:** the HTTP endpoint answers a repeated request from this row with no new check. **v0.13.8:** the row only feeds the tx-sender, which posts it to the gateway once | **main:** nothing deletes it. `endpoint.toml:30`: "Successful results are reused indefinitely". **v0.13.8:** the tx-sender's garbage collection deletes completed and failed rows after 24 h, every 5 min | `connector-db/migrations/20250604141515_decryption_response.sql:11-18`; `20260828000000_http_decryption_source_and_errors.sql:37-46`; endpoint `src/core/http/decrypt.rs:108-135` | `tx-sender/src/monitoring/garbage_collection.rs:72, 118`; `tx-sender/src/core/config.rs:184-186` |
| Connector endpoint deduplication | The request row | the content id, the EIP-712 hash of the whole request, signature and validity window included (`api/src/types.rs:79-91`) | an identical request attaches to the stored row; an equivalent request (new signature or window) is a new row | as above | as above | no HTTP endpoint at this tag |
| Gateway chain: `UserDecryptionResponse` events | Each KMS node's share, re-encrypted to the requester's transport key, with its signature | `decryptionId` | anyone can read the event later; the relayer collects shares from it | permanent, as long as the gateway chain's history is kept | `gateway-contracts/contracts/interfaces/IDecryption.sol:182-188`; `Decryption.sol:748` | `IDecryption.sol:112-118`; `Decryption.sol:691` |
| Relayer Postgres: `user_decrypt_req` / `user_decrypt_share` | The job and its shares | `int_job_id`, a SHA-256 content hash that **excludes the signature and the validity window** | a request with the same content returns the stored job (`DuplicateCompleted`), and `GET` serves its shares with no new check | the expiry worker is opt-in (`expiry_enabled: false` in the shipped examples); when on, `user_decrypt_expiry` is 7 d | `relayer/src/core/user_decrypt_request.rs:22-24` (exclusion); `src/http/endpoints/v2/handlers/user_decrypt.rs:301, 559` and `v3/.../user_decrypt.rs:301` (`DuplicateCompleted`); `config/local.yaml.example:263-270`; `src/store/sql/repositories/expiry_repo.rs:130-136` | `relayer/src/core/user_decrypt_request.rs:33-34`; `config/local.yaml.example:238-243` |
| SDK (`sdk/js-sdk`) | No decryption result. The caches hold metadata only: the KMS signer context, host-contract versions and relayer features | — | — | — | `src/core/base/cachedFetch.ts` and its users; `src/core/kms/fetchKmsSigncryptedSharesV2-p.ts:157-160` | `src/core/base/cachedFetch.ts` users (host-contract and context reads only) |

What this means for V6:

- **Gateway events are outside any verifier's control.** A share released before retirement stays readable on the gateway chain. Whoever holds the requester's transport key can decrypt it later. No V6 rule can remove it. This is the first limit (pre-emptive, not a clawback), not a defect of V6.
- **What V6 governs** is a result that a component serves again, after retirement, *in answer to a request*: the connector endpoint's row on main, and the relayer's job on both lines.

## 2. The unmodified behaviour [M]

Each step is three runs, every run identical (`p03/P03_TABLE.md`).

**Connector, main, unmodified** (runs r1–r3). The first request is served from the KMS mock (4 hits). Then:

| Step | Answer | KMS hits | What happened |
|---|---|---|---|
| The same request, still live | 200 | 0 | the stored row, no new check |
| **The same request, after the user retired** | **200** | **0** | **the stored row, no new check: the gap V6 names** |
| An equivalent request (new signature and window), after retirement | 403 `acl_denied` | 0 | a new content id, so a new check, which refuses |

**Relayer, main, unmodified** (three runs of `tests/user_decrypt_v3_h7_test.rs`). The ACL answers come from a mocked
host chain that flips every answer to false at "retirement".

| Step | Answer | Shares | Same job |
|---|---|---|---|
| The first request | 200 | 9 | — |
| **The same request, after retirement** | **200** | **9** | yes |
| **An equivalent request, after retirement** | **200** | **9** | **yes: the dedup key ignores the signature and the window** |

So today a stored result is re-served after retirement:

- by the connector endpoint on main, for an identical request;
- by the relayer on main, for an identical *or an equivalent* request, for as long as the job is kept.

Retention:

- the relayer keeps the job until its opt-in expiry (7 d in the examples);
- the main connector keeps the row indefinitely.

The v0.13.8 connector serves nothing again to a requester. The v0.13.8 relayer has the same dedup key (§1).

## 3. H7 on `lifecycle/level1` [M]

**Connector endpoint** (`revalidate_stored_results = true`). Before a stored successful user decryption payload is
served, the endpoint:

1. drops the payload;
2. puts the request back to `pending`, keeping its `already_sent` flag;
3. waits for the worker, which applies V1 again at a fresh decision block (L = 0, P0.2).

Duplicates attach to that one revalidation. Public decryption results are served as stored (R9). The endpoint's
content id already covers the signature and the validity window, so its deduplication meets H7 unchanged.

| Step (runs r4–r6, Profile H `enforce` with H5) | Answer | KMS hits |
|---|---|---|
| The first request | 200 | 4 |
| The same request, still live | 200 | 4: revalidated, sent to the KMS again |
| **The same request, after retirement** | **403 `account_retired`** | **0** |
| **An equivalent request, after retirement** | **403 `account_retired`** | **0** |
| The same request again | 403 `account_retired` | 0: the final denial is served as stored |

**Relayer** (`revalidate_stored_results = true`, which also switches the dedup key):

- The dedup key covers the signature and the validity window: SHA-256 of `h7:`, the old key, the signature and the window.
- Before the shares of a completed job are served on `GET`, the host ACL is checked again. These are the per-variant checks of the readiness check.

| Step (three runs) | Answer | Shares | Same job |
|---|---|---|---|
| The first request | 200 | 9 | — |
| The same request, after retirement | 400 `not_allowed_on_host_acl` | 0 | yes: revalidated and refused |
| An equivalent request, after retirement | 400 `not_allowed_on_host_acl` | 0 | no: a new job, refused by the readiness check |

**Zama's suites, and ours** (VPS):

- the endpoint's whole suite on the Level 1 tree: 27 unit, 1 health and 22 integration tests, the 22 including the three H7 tests;
- the kms-worker unit tests: 53;
- the relayer unit tests: 284 passed, 1 ignored, including the H7 dedup-key test;
- the relayer's H7 integration test: 3 runs;
- `make clippy` clean, and rustfmt clean on the changed files.

## 4. H4 across a worker restart [M]

Profile H allows at most 2 ERC-1271 negatives per request, a block apart (H4). The test runs a request against a
wallet that rejects every signature:

1. worker A makes the first attempt;
2. A is stopped;
3. a fresh worker B, with fresh memory, picks the request up.

| Attempt state | ERC-1271 calls: worker A | worker B | Total (limit 2) | Runs |
|---|---|---|---|---|
| In memory (Phase 3) | 1 | 2 | **3** | r4, r5, r6 |
| In the connector database (`profile_h_erc1271_attempts`) | 1 | 1 | **2** | r4, r5, r6 |

With the database copy, a restart no longer grants extra attempts. Residual 12 is closed for the Level 1 connector.

## 5. Phase 3 residuals

- **6. Stored results and transport keys.** Narrowed. With H7, neither the connector endpoint nor the relayer serves a stored result after retirement, or to an equivalent request. Two parts remain:
  - the shares already published on the gateway chain;
  - the transport key that decrypts them. These are limit 1.
- **12. H4 attempt state in memory.** Closed for the Level 1 connector: the state is kept in its database.

## 6. Deviation

**The first chain's Level 1 endpoint binary was stale** (DECISIONS_LOG D18).

- **What happened.** cargo reused an older `kms-connector-api` build, so the binary had no `account_retired` code. It answered the H7 refusal as 500 `unknown`.
- **The fix.** Every file of the Level 1 tree got a fresh modification time, and the binary was rebuilt. The rebuilt binary carries the code.
- **The runs.** The three runs made with the stale binary are kept under `raw/p03/superseded-stale-endpoint/`. Their stored-result and H4 steps otherwise matched.
- **Checks.**
  - Zama's endpoint suite was unaffected: its test build recompiled the crate.
  - P0.4's Level 1 test was re-run once on the rebuilt tree (`raw/p03/runs/p04-main-l1-r4-*`) and matched its three earlier runs.
  - Since then, every VPS sync extracts with `tar -m`.
