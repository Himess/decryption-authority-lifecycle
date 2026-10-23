# F1: Fhenix CoFHE verification notes (Phase 1)

**Scope:** brief §3 item F1, plus design doc §4.2 ("Fhenix CoFHE ile karşılaştırma") and Appendix A refs R15 and R16.
**Written:** 2026-10-21, by a Claude Code verification agent. All work was read-only: no transactions, no outreach, no issues or PRs.
**Legend:**
- **[V]** verified: read in code at the stated commit, or observed on-chain.
- **[I]** inferred: reasoning, documentation or comments, not directly observed.
- **[M]** measured, with tool, date and block given.
- **[E]** estimated.

---

## 0. Verdicts at a glance

| # | Claim checked | Verdict | Deliberate vs oversight |
|---|---|---|---|
| 1a | Any holder of a handle can `allow` it to any address (B3 analog) | **Confirmed** [V] | Deliberate. Documented, tested, and intentionally not gated. The key-compromise lifecycle is not addressed. |
| 1b | Any holder can make a handle public | **Confirmed, with a correction** [V]: the verb is `allowGlobal` (`FHE.allowPublic`). `allowForDecryption` is callable but writes a flag that the public decryption path does not read. | Deliberate for `allowGlobal`. `allowForDecryption` looks vestigial, and the docs contradict themselves about it. |
| 1c | "allowances are never revoked" comment / no revoke (B1 analog) | **Confirmed** [V]. The comment is at ACL.sol:364–366, not in TaskManager.sol or ACL.sol 160–211. The official docs say the same thing more directly. | Deliberate. |
| 2a | ACP revocation is optional, and the revoker is chosen by the signer | **Confirmed** [V] | Deliberate. Built against leaked permits, not leaked keys. |
| 2b | A key holder can sign a non-revocable permit (B2 variant) | **Confirmed, and stronger than stated** [V]. The permit can also have an unbounded expiry and can be a "sharing" permit to any address, with no on-chain trace. | The revocation design is deliberate. Unbounded expiry is undocumented. Key compromise is not considered. |
| 2c | Any user-controlled way to retire an address, or a global deny | **None** [V]. The only deny list is governance-only and covers task intake only. It is not checked on `allow*` or on the decryption path. | The deny list's scope is deliberate (stated in the CHANGELOG). There is no retirement concept. |
| 3a | EIP-1271 supported off-chain; gas cap | **Supported. No 250K-style cap exists** [V]+[M]. Verification is an `eth_call` of the on-chain ACL, and the 1271 `staticcall` gets all of the call's gas. The effective cap is the operator RPC's `eth_call` gas cap (not public) and a 5 s default timeout. An `isValidSignature` of about 4.0M gas was accepted on Sepolia. | By construction, not an explicit decision. There is no sign that PQ accounts were considered. |
| 3b | Ecrecover-first? | **No: code-first** [V]+[M]. ECDSA is tried only if the issuer has no code; otherwise only ERC-1271. Seen in the verified deployed source (OZ 5.1+ `SignatureChecker`) and by behavior. | Inherited OZ ≥5.1 default. Fhenix is aware of the 7702 effect (SDK test note), but it is not a documented security decision. |
| 3c | EIP-7702 handling | **Implicit only** [V]+[M]. A delegated EOA has 23 bytes of code, so its permits go to the delegate's `isValidSignature`. ECDSA is never tried directly. **B5 as worded is refuted for Fhenix.** The underlying risk remains: typical delegates accept the EOA key, the key can re-delegate, and on-chain `allow` still works. | Inherited behavior. Not designed for retirement. |
| 4 | B8 analog: upgradeability | **Upgradeable (UUPS)** [V]. TaskManager, ACL, PlaintextsStorage and ACPShareRegistry are upgradeable via `UPGRADER_ROLE`; CoFHEAddressBook via `onlyOwner`. There is no upgrade timelock. **On testnets a single EOA holds every admin and upgrader role on all four role-gated contracts [M]**, and `defaultAdminDelay` = 1 s [M]. Mainnet, per the runbook: a Gnosis Safe [I, not checked on-chain]. Upgrades change decryption decisions immediately. | Deliberate and documented, including explicit "admin-equivalent" role warnings. |
| 5 | Testnets running CoFHE; E7 feasibility | Ethereum Sepolia, Arbitrum Sepolia and Base Sepolia [M] (addresses in §6). **E7 is cheap and safe** with our own EOAs and our own contract. It was **not run**. | n/a |

Two other findings matter for the design doc (§7):

- **Fhenix's user-decryption channel is not post-quantum** [V]. Sealoutput uses NaCl `crypto_box` (X25519 + XSalsa20-Poly1305), not ML-KEM.
- **Fhenix decryption today is done by Teecryptor, a TEE**, not by a threshold network [V, docs]. The SDK still calls the endpoint `thresholdNetworkUrl`.

---

## 1. Sources and method

**Code (local clones, read-only, under `<workspace>\scratch\fhenix\`):**

| Repo | Commit (date) | Notes |
|---|---|---|
| `FhenixProtocol/cofhe-contracts` | `b5c20ed487fa…` (2026-10-19, "bump version to 1.0.2") | Same as the doc. Pre-existing clone, not modified. |
| `FhenixProtocol/teecryptor` | `2616344b29e2…` (2026-10-20) | The production decryption service (TDX TEE). Shallow clone. |
| `FhenixProtocol/cofhesdk` | `04a69f89807f…` (2026-10-19) | Current SDK (`@cofhe/sdk` 0.8.x). Shallow clone. |
| `FhenixProtocol/cofhejs` | `637d18b5e347…` (2026-04-21, **archived**) | Legacy SDK. Shallow clone. |
| `FhenixProtocol/fhenix-docs` | `0dd79c8014a2…` (2026-10-20) | Official docs. Shallow clone. |
| `FhenixProtocol/zee-k-verifier` | `47a59438caa7…` (2026-10-19) | Input-proof verifier. Cloned, not relevant to F1. |
| `FhenixProtocol/fhenix-toolkit` | `56a14ba7179f…` (2026-10-01) | One file read via `gh api`. Agent plugin; see §8. |
| `OpenZeppelin/openzeppelin-contracts` | tag `v5.2.0` = `acd4ff74de83…` | `SignatureChecker.sol` read via `gh api`. |
| `alloy-rs/alloy` | tag `v1.8.3` | `crates/provider/src/fillers/{mod,gas}.rs` read via `gh api`. |

- `FhenixProtocol/threshold-network` (the dispatcher that teecryptor says it mirrors) returns 404. **It is not public**, so its behavior is inferred from teecryptor comments only.
- **On-chain reads [M]:** made with `cast` 1.8.5 (read-only subcommands only: `call`, `code`, `implementation`, `nonce`, `chain-id`, `block`) on the user's Windows 10 Pro workstation, 2026-10-20 ≈22:00–22:15 UTC (2026-10-21 local).
  - **RPCs:** `ethereum-sepolia-rpc.publicnode.com` (block ≈11,958,150–11,958,174); `sepolia-rollup.arbitrum.io/rpc` and `arbitrum-sepolia-rpc.publicnode.com` (≈321,192,332); `sepolia.base.org` (≈48,382,805).
  - **Verified source:** from `eth-sepolia.blockscout.com` (API v2, read-only GET). **No mainnet state was read.**

---

## 2. Item 1: TaskManager `allow` / `allowGlobal` / `allowForDecryption` (B3, B1 analogs)

### Code
- **TaskManager wrappers** (TaskManager.sol:947–971):
  - `allow` (947–949), `allowGlobal` (951–953), `allowTransient` (955–957), `shareCtHash` (959–961), `receiveCtHash` (963–965) and `allowForDecryption` (967–971) are `external` with **no modifier**.
  - Each forwards `msg.sender` as the ACL's `requester`.
  - They are **not** gated by `onlyIfEnabled` (kill switch) or `onlyAccessListed` (access list / deny list). Those gate only `createRandomTask` (666), `createTask` (701, via `sendEventCreated` 445) and `batchVerifyInputs` (916).
- **ACL** (ACL.sol): `allow` (160–171), `allowGlobal` (179–191) and `allowForDecryption` (197–213) each do two things:
  1. require `msg.sender == TaskManager`;
  2. require `isAllowed(handle, requester)`.

  Then they write `persistedAllowedPairs[handle][account] = true`, `globalHandles[handle] = true`, or `allowedForDecryption[handle] = true` respectively.
- **`isAllowed`** = transient OR persistent OR global (ACL.sol:447–449). Persistent and global entries are never cleared: no ACL function deletes them [V, grep].
- **Events:** `allow` and `allowGlobal` emit **no event**. Only `allowForDecryption` emits `AllowedForDecryption` (ACL.sol:212). A user's handle set therefore **cannot be listed from logs** [V]; it needs traces or app-level events. This matters for C2 "carry" on Fhenix.
- **Delegation:** Fhenix shares access through off-chain "sharing ACPs" (§3).

### Fhenix's own statements
- **Test:** ACLGranting.ts:181–187 ("lets a grantee re-grant, so a persistent grant is transitive"). Lines 198–205 show that after `allowGlobal`, `isAllowed(handle, stranger)` is true. Lines 207–212 show `allowForDecryption` sets only its own flag.
- **Docs:** `fhenix-docs/cofhe/deep-dive/cofhe-components/acl.mdx:23` says the ACL has no revoke and any holder can extend access to anyone. `fhe-library/core-concepts/access-control.mdx:134–140, 191` says the same.
- **CHANGELOG:** CHANGELOG.md:87 says ACL `allow*` and decrypt-result publishing are intentionally not gated by the access list. Line 67 says the same for `shareCtHash`/`receiveCtHash`.

### What "make public" means on Fhenix
- **The verb is `allowGlobal`.** `FHE.allowPublic(x)` calls `TaskManager.allowGlobal` (FHE.sol:3161–3205).
- **The public decrypt path reads `globalAllowed`.** Teecryptor's no-ACP branch calls `TaskManager.isPubliclyAllowed` (= `acl.globalAllowed`) (teecryptor `src/permit.rs:633–665`, `src/http.rs:1060–1069`).
- **`allowGlobal` also opens ACP decryption to everyone.** `isAllowedWithPermission` begins with `isAllowed(handle, acp.issuer)` (ACL.sol:616–618), which is true for any issuer once the handle is global. Any address can then sealoutput the value with a self-signed ACP, compute on it, or re-grant it.
- **`allowForDecryption` is inert on the decryption path today** [V for teecryptor; I for the closed dispatcher]. It sets `allowedForDecryption`, and nothing in teecryptor or the SDK reads `isAllowedForDecryption`. The docs are inconsistent here: `acl.mdx:43–46` lists `isAllowedForDecryption` as one of "the last two" functions the decryption path runs on, but the next sentence names `isAllowedWithPermission` and `isPubliclyAllowed`.

### "One transaction"
- TaskManager has no batch `allow`, so a plain EOA needs **one transaction per handle**. Contract helpers do not work, because `msg.sender` must be the holder.
- An EOA can still batch everything into one transaction through an EIP-7702 self-delegation to a batch executor [I].
- More importantly, the key holder does not need the on-chain path at all. It can sign a global-scope ACP, or a sharing ACP to any address (§3), and decrypt everything off-chain with no transaction.

### Does the deployed code match master? [M]
- **ACL, source:** the ACL implementation `0x5484…1b76` on Sepolia is source-verified on Blockscout (verified 2026-10-12; solc 0.8.25, optimizer 800, EVM cancun).
  - Its `Permissioned.sol` is **byte-identical to master**.
  - Its `ACL.sol` differs from master **only** in how the TaskManager address is stored: a compile-time constant there, versus master's storage slot and `setTaskManager`. `allow`, `allowGlobal`, `allowForDecryption`, `isAllowed` and `isAllowedWithPermission` are logically the same.
- **ACL, other chains:** the ACL implementations on Arbitrum Sepolia (`0xb780…d27f`) and Base Sepolia (`0x8838…5f38`) are **byte-identical** to Sepolia's once the UUPS `__self` immutable is masked (14,295 B each).
- **TaskManager:** the implementations are byte-identical across the three testnets after the same masking (24,343 B). They are not source-verified, but they contain the selectors for:
  - `allow`, `allowGlobal`, `allowForDecryption`, `allowTransient`, `shareCtHash`;
  - `isPubliclyAllowed`, `isAllowedWithPermission`;
  - `setDenyList`, `addToAccessList`, `upgradeToAndCall`.

**Verdict:** Confirmed for `allow` and `allowGlobal`. Partially true for `allowForDecryption`: it is callable, but it does not make anything public on the current decryption path. "Allowances are never revoked" is confirmed (comment at ACL.sol:364–366; it states the invariant explaining why a check in `receiveCtHash` is unreachable).
**Deliberate vs oversight:** Deliberate, as documented, tested and stated in the CHANGELOG. Nothing in the public code or docs addresses what happens to this authority after a key compromise or under a PQ threat (oversight relative to our threat model).

---

## 3. Item 2: `Permissioned.sol` and ACP revocation (B2 variant); retirement and deny

### Code
- **Revoker fields:** `revokerData` and `revokerContract` are optional and set by the issuer. Setting either to zero disables the revocation check (Permissioned.sol:57–61, 71–76).
- **The check** runs only if both are non-zero. It then calls `IPermissionCustomIdValidator(revokerContract).disabled(issuer, revokerData)` (Permissioned.sol:186–194).
- **Both fields are inside the issuer-signed EIP-712 struct**, so the signer chooses them: `ACPIssuerSelf` (223–234) and `ACPIssuerShared` (245–255).
- **The default revoker** is `ACPTimestampRevoker` (ACPTimestampRevoker.sol):
  - `revokeAllExisting()` sets `revokeAllAt[msg.sender] = block.timestamp` (55–58);
  - `disabled = id > now || id <= revokeAllAt || revokedSingle` (61–63).
  - So a permit signed after the revoke, with `revokerData` in `(revokeAllAt, now]`, passes. That is **exactly B2**: revocation acts on existing permits, not on the key.
- **SDK statements:**
  - `revokeAllACPs` is documented as leaving ACPs created afterwards valid (cofhesdk `packages/sdk/core/acps.ts:331–336`).
  - The default revoker is injected only when the caller passes no revoker fields, and only if the ACL serves one (acps.ts:243–285).
  - The low-level validators default to `revokerData = 0, revokerContract = 0x0`, i.e. not revocable (`acps/validation.ts:81–82, 145–146, 189–190`).
- **Expiry has no upper bound anywhere:**
  - The contract checks only `expiration < block.timestamp` (Permissioned.sol:164–165; `uint64`). Teecryptor tests use `u64::MAX` (`src/permit.rs:988`).
  - The SDK default is 7 days but can be overridden (`validation.ts:29`). The archived cofhejs defaulted to `1e12` s, about year 33,658, and to no validator (`cofhejs/src/core/permit/permit.z.ts:20, 28–32`).
  - Zama, by contrast, caps permits at 365 days (doc §4.1).
- **Sharing:** an issuer can sign a **sharing ACP** for any `recipient`. The recipient adds its own sealing key and signature and then reads the issuer's data (Permissioned.sol:33–47 and 176–184; ACL `isAllowedWithPermission` checks the *issuer's* access). This needs **no transaction** and leaves **no on-chain trace** unless the share registry is used.

### User-controlled retirement or global deny
- **User side: none** [V]. No function, keyed on the user, blocks future permits or future `allow*` calls.
  - `revokeAllExisting` only looks backwards, applies only to permits that point at that revoker, and the signer can opt out (revoker = 0, a self-deployed revoker that always returns false, or a fresh `revokerData`).
- **Governance side** [V]:
  - `TaskManager.setDenyList` (`ACCESS_LIST_MANAGER_ROLE`; TaskManager.sol:368–369, 385–393, 435–443) only blocks **task intake**. It is ignored while the access list is enabled (CHANGELOG.md:9), and it is not checked on `allow*`, on `isAllowedWithPermission`, or on `isPubliclyAllowed`.
  - The access list (`accessList`) and the kill switch (`disable()`, TaskManager.sol:354–357, 400–403) do not stop holders re-granting or making handles public. They also do not stop off-chain decryption: `isAllowedWithPermission` (1091–1093) and `isPubliclyAllowed` (977–979) have no modifiers.
  - Governance can deny decryption only by **upgrading or re-pointing the ACL** (B8, §5).

**Verdict:** Confirmed. The B2 variant is stronger than Zama's B2: revocation is opt-in per permit, the signer can pick the revoker, and lifetime is unbounded. B1 is confirmed: there is no user retirement, and governance deny does not reach decryption.
**Deliberate vs oversight:** The revocation design is deliberate. The trade-offs are documented in ACPTimestampRevoker.sol:28–31, and revocation targets leaked or shared permits. Key compromise and PQ retirement are not addressed (oversight relative to our threat model). Unbounded expiry is not discussed anywhere; I found no evidence it was a conscious choice.

---

## 4. Item 3: off-chain permit verification (decryption service and SDKs)

### Who decides
- **Production decryption today is Teecryptor**, a single Intel TDX Confidential Space VM. It reconstructs the FHE key from 3-of-6 Shamir shares.
  - Sources: `fhenix-docs/.../teecryptor.mdx:12, 59–61`; the MPC "Threshold Network" is described as future work (`teecryptor.mdx:78–80`, `acl.mdx:46`).
  - The SDK still names the endpoint `thresholdNetworkUrl`: `https://testnet-cofhe-tn.fhenix.zone` for all three testnets and `https://cofhe-tn.mainnet.fhenix.zone` for mainnet (`cofhesdk/packages/sdk/chains/chains/*.ts`).
- **Teecryptor does no cryptographic check of its own.** For every decrypt or sealoutput:
  - with an ACP, it `eth_call`s `TaskManager.isAllowedWithPermission(ACP, handle)`;
  - without one, it calls `isPubliclyAllowed(handle)`.

  Sources: `src/permit.rs:13–20, 593–631, 633–665`; `src/http.rs:1043–1128`. It "trusts the contract's boolean answer". The gate is baked on for testnet and mainnet (`src/envs/testnet.toml`, `mainnet.toml`: `require_permit = true`).
  - `verify_local` (ecrecover-only, no 1271; permit.rs:725–760) is called **only in tests** [V, grep].
- **Closed-source dispatcher:** teecryptor comments say the `threshold-network` dispatcher's `verify_acl` does the same thing (permit.rs:47–54, 593–596) [I; source not public].
- **SDKs do no local signature verification:**
  - cofhesdk asks the chain (`checkPermissionValidity` / `isAllowedWithPermission` via `eth_call`, `acps/onchain-utils.ts:97–171`) and can *sign* through an EIP-1271 smart account (`adapters/smartWallet.ts`).
  - cofhejs (archived) only checked expiry and that a signature was present (`permit.ts:495–509`).

### 3b. Ecrecover-first? No: code-first
- **Verifier used:** `withPermission` uses OZ `SignatureChecker.isValidSignatureNow` (Permissioned.sol:168–184).
- **OZ semantics:** in OZ ≥5.1, including 5.2.0 pinned in `host-chain/pnpm-lock.yaml`, `isValidSignatureNow` does ECDSA **only if `signer.code.length == 0`**; otherwise it does **only** ERC-1271 (OZ v5.2.0 `SignatureChecker.sol:22–29`).
- **Deployed:** the verified Sepolia ACL embeds this exact branch ("last updated v5.1.0") [M], and the other two testnets run the same bytecode [M].
- **Behavioral probe [M]** (Sepolia ACL `0x5ACD…1b84`, `checkPermissionValidity`, block ≈11,958,174, 2026-10-20T22:09Z):
  - The issuer was a **freshly generated throwaway key**: never printed, never funded, nothing broadcast.
  - The permit was a synthetic self-ACP: global scope, **no handles**, revoker 0, expiry +1 h.
  - Code was injected only through `eth_call` state overrides (`--override-code`).

| Case | Issuer code (override) | Signature | Result |
|---|---|---|---|
| A | none (EOA) | valid ECDSA by issuer | `true` |
| B | `0x60006000fd` (always reverts) | same valid ECDSA | revert `PermissionInvalid_IssuerSignature` (`0x4c40eccb`), so ECDSA was **not** tried |
| C | `isValidSignature` that always returns magic | 65 zero bytes (garbage) | `true`; the decision is fully the account's |
| D1 | burns ≈4.0M gas [E: 153,870 × 26 gas], then magic | garbage | `true` with the RPC's default `eth_call` gas |
| D2 | same as D1 | garbage | revert `IssuerSignature` with `--gas-limit 3000000`, so the burn is real and the gas is the only limit |
| E | `0xef0100‖D`, where D's code reverts (7702 designator) | valid ECDSA by issuer | revert `IssuerSignature`; the valid EOA-key signature is rejected |
| F | `0xef0100‖D`, where D always returns magic | garbage | `true`; the node followed the 7702 designator into D |

- **Fhenix's own corroboration:** its SDK test setup warns against public/anvil keys. Those keys carry 7702 delegations set by strangers on public testnets, so the ACL verifies their signatures through the delegate (ERC-1271), which may reject them (`cofhesdk/test/setup/src/env.ts:18–20`; same in `.memory/testing.md:74`).

### 3a. EIP-1271 gas cap
- **Contract:** OZ `isValidERC1271SignatureNow` does a `staticcall` with **no gas argument** (OZ v5.2.0 `SignatureChecker.sol:38–49`), so it gets 63/64 of whatever the `eth_call` has [V].
- **Teecryptor:**
  - The `eth_call` is sent through alloy 1.8.3 with **no `gas` field**. `FillProvider::call` runs only `prepare_call_sync`, a no-op default that `GasFiller` does not override (alloy v1.8.3 `fillers/mod.rs:279–283, 442–446`; `gas.rs`) [V].
  - So the limit is the **operator's RPC `eth_call` gas cap**. That RPC is env-supplied through `PERMIT_CHAINS_JSON` and is not in public code.
  - Each call is also bounded by `timeout_ms`, default **5,000 ms** (`src/main.rs:336–375`).
  - Client defaults (geth/op-geth/Nitro `RPCGasCap` = 50,000,000) suggest tens of millions of gas [I/E].
- **Measured [M]:** a ≈4.0M-gas `isValidSignature` was accepted through the public Sepolia RPC (D1).
- **Consequence for B6:** **B6 does not carry over to Fhenix.** The PQ verifier costs in doc §B6 (0.65–3.9M gas) would fit, subject to the operator's RPC cap and the 5 s timeout [I]. The exact Teecryptor-side cap can be measured only with E7-d (§6).

### 3c. EIP-7702
- **There is no 7702-specific code** in any Fhenix repo [V, grep]. Handling is implicit, via the code-first branch (cases E and F above).
- **Consequences:**
  1. **B5 as worded (ecrecover-first lets the old key through) is refuted for Fhenix.**
  2. The risk B5 describes still holds:
     - most 7702 delegates accept the EOA's own ECDSA key in `isValidSignature`;
     - the EOA key can **re-delegate or clear** the delegation at will and regain the ECDSA path;
     - a 7702 EOA can still send transactions, so it keeps the on-chain `allow` / `allowGlobal` door (§2).

     7702 is therefore not a retirement mechanism. Only EIP-7851-style key deactivation would make it one [I].
  3. **ERC-6492:** signatures wrapped for undeployed accounts are not unwrapped (OZ 5.2 has no 6492 support; also noted in `fhenix-toolkit/.../permit-issuer-gotcha.md:40`).

### B4 analog (off-chain door)
**Partially true.**
- A code-less EOA's ACP passes through `ecrecover` inside an `eth_call`. A "transaction freeze" of quantum-exposed EOAs would close the on-chain `allow*` door but **not** the ACP path.
- **Unlike Zama**, the check runs *in the EVM* of the RPC node. EVM-level changes therefore **propagate automatically** once the node runs the forked rules:
  - an EIP-8151-style ecrecover that returns 0 for deactivated keys;
  - any rule that puts code on EOAs (7702/7851; code-first then routes to 1271).

  [I; depends on final EIP semantics.]

**Verdict for item 3:**
- 1271: supported, no fixed cap (RPC-dependent; ≥4M measured on a public RPC).
- Ordering: code-first, not ecrecover-first.
- 7702: handled implicitly through the delegate, which does not retire the key.

**Deliberate vs oversight:** Code-first is inherited OZ library behavior. Fhenix knows its 7702 effect (SDK test note), but no design text treats it as a security property. The absence of a 1271 gas cap follows from delegating to `eth_call` and is not an explicit decision. Teecryptor bounds cost with timeouts and an admission cap instead.

---

## 5. Item 4: B8 analog (upgradeability and who can change decryption authority)

### Code [V]
| Contract | Pattern | Who can upgrade | Other authority-relevant powers |
|---|---|---|---|
| TaskManager | UUPS + AccessControlDefaultAdminRules | `UPGRADER_ROLE` (TaskManager.sol:315–317) | `CONFIG_MANAGER_ROLE` can re-point `acl` and `plaintextsStorage` (1069–1088). `DECRYPT_SIGNER_MANAGER_ROLE` can set `decryptResultSigner`, and `address(0)` disables result verification (1049–1053). Fhenix's own comment (158–174) calls these four roles admin-equivalent. |
| ACL | UUPS + AccessControlDefaultAdminRules | `UPGRADER_ROLE` (ACL.sol:531) | `DEFAULT_ADMIN_ROLE` sets the default revoker, the share registry and the TaskManager (565–596). |
| PlaintextsStorage | UUPS | `UPGRADER_ROLE` (PlaintextsStorage.sol:105) | none |
| ACPShareRegistry | UUPS + AccessControl | `UPGRADER_ROLE` (ACPShareRegistry.sol:247) | none |
| CoFHEAddressBook | UUPS + Ownable2Step | `owner` (CoFHEAddressBook.sol:82) | `setTm` / `unsetTm` (61–80). Teecryptor names it a trust root (SECURITY-OVERVIEW.md:27–28, 148–155). |
| ACPTimestampRevoker | plain contract | not upgradeable (no proxy; its TODO says production wants it upgradeable, lines 33–34) | none |

- **No upgrade timelock.** `defaultAdminDelay` governs only transfers of `DEFAULT_ADMIN_ROLE`; `_authorizeUpgrade` is only `onlyRole(UPGRADER_ROLE)`.
- **Effect on decryption:** Teecryptor resolves the TaskManager once at boot, but then calls it live. An ACL or TaskManager upgrade, or `setACLContract`, changes decryption decisions **immediately** for running instances. `setTm` takes effect only at the next boot (SECURITY-OVERVIEW.md:153–155).

### Testnet state [M] (identical on all three chains unless noted)
- **Address book:** `CoFHEAddressBook` `0xC0F4e00E531a2B086492Ae3DCC1515038307196b` (impl `0x7ACeE74B…BD22`).
  - `owner()` = **`0x6578D0E3A6d902896415c51cf4188fFBEBE753DB`**.
  - Base Sepolia shows `pendingOwner` set to that same address.
- **TaskManager and ACL roles:** on both, `defaultAdmin()` = `0x6578…53DB` and `defaultAdminDelay()` = **1 s**.
  - On TaskManager this address holds `DEFAULT_ADMIN_ROLE`, `UPGRADER_ROLE`, `CONFIG_MANAGER_ROLE` and `DECRYPT_SIGNER_MANAGER_ROLE`.
  - On ACL it holds `DEFAULT_ADMIN_ROLE` and `UPGRADER_ROLE`.
  - On PlaintextsStorage and ACPShareRegistry it holds admin and upgrader.
  - The pre-handover bootstrap owner `0xf514…dADd1` (from `deterministic/addresses.json`) holds **no** roles.
- **The admin is an EOA**: code size 0 and nonce 111 on Sepolia; code size 0 and nonce 123 on Arbitrum Sepolia. On **Base Sepolia it carries an EIP-7702 delegation** (code `0xef0100 63c0c19a…e32b`; the delegate's identity is not verified).
- **This matches the testnet runbook:** `SAFE_ADMIN_ADDRESS` is optional there, and "Unset keeps the deployer as admin" (docs/deployment-runbook.md:17).

### Mainnet (runbook only; not read on-chain, per ground rules) [I]
A Gnosis Safe holds `DEFAULT_ADMIN_ROLE` and every operational role, and owns the address book. The deployer holds nothing (docs/mainnet-deployment.md:8, 98–100). The Safe's threshold and signers are unknown.

### Additional authority roots in the decryption path [I, from code and docs]
1. **Address-book owner:** picks the TaskManager, effective at the next Teecryptor boot.
2. **`UPGRADER_ROLE` / `CONFIG_MANAGER_ROLE` holders:** can rewrite `isAllowed*`, effective immediately.
3. **Teecryptor operator:** supplies the RPC URL for the ACL gate (`PERMIT_CHAINS_JSON`, env, not attested; SECURITY-OVERVIEW.md:141, 244–245). The gate is a plain `eth_call` with no proof. The overview states this trust note explicitly for the commitment gate (237–242), and the same reasoning applies to the ACL gate (`permit.rs:606–631`).
4. **The caller's choice of `host_chain_id`:** the caller picks which chain's ACL answers (SECURITY-OVERVIEW.md:168–188).

**Verdict:** Upgradeable. On testnets one hot EOA can unilaterally upgrade or re-point the ACL and TaskManager, with immediate effect on who may decrypt.
**Deliberate vs oversight:** Deliberate and documented, including Fhenix's explicit "admin-equivalent" warnings. The testnet single-EOA admin with a 1 s delay is a testnet convenience.

---

## 6. Item 5: testnets and E7 feasibility (E7 was **not run**)

### Chains and addresses [M] (2026-10-20/21; cross-checked with cofhesdk chain definitions, `fhenix-docs/.../compatibility.mdx:53–63` and teecryptor `src/envs/testnet.toml`)

| | Ethereum Sepolia (11155111) | Arbitrum Sepolia (421614) | Base Sepolia (84532) |
|---|---|---|---|
| CoFHEAddressBook | `0xC0F4e00E531a2B086492Ae3DCC1515038307196b` | same | same |
| TaskManager (id 1) | `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` (impl `0x74aead3e…cf8f`, `getVersion` 11) | same proxy (impl `0x1bacf617…624f`, v12) | same proxy (impl `0x4c8d8c4d…414f`, v11) |
| ACL ("ACL v0.1.0", EIP-712 "ACL"/"2") | `0x5ACD9054a211C1bF5aD24d47b16eA736ccC91b84` | `0x76d57191A9769A88a041FeeADc53AaE6EB663B83` | `0x64aCebB2c0C35330E3d1aADD1159B16bf71eB189` |
| Default ACPTimestampRevoker | `0xA849B06cBfA1557b2c425Fb379F07806c5D3f3e9` | `0xDD226320D90f68e97378E79cA832A3bAf1DD6Dc1` | `0xB430c31E25A39bfE676BF9220776116a27131C2B` |
| ACPShareRegistry | `0x4a68A8EEAcFdE6346a008BFe837303FC09c8AB20` | `0x5441073E16709A9235B56A710Ad4c5FeEF8ae7a0` | `0x2b143Ea3a3124b6815e7484463cA795b66eeCDeE` |
| PlaintextsStorage | `0x11b3845fbe9cD1468588b586f3E83D8F936f916b` | `0x3150A5f542e5Ecb28b67399f1a48E6385c4ad579` | `0x1eea1872Cd3fEe9B67E3fb49F1607EbB454f8011` |
| `isEnabled` / `accessListEnabled` | true / **false** (open intake) | true / false | true / false |
| `decryptResultSigner` / `verifierSigner` | `0x5a33…AE1A` / `0x013a…fe71` | same | same |

- **Services** (SDK chain definitions):
  - CoFHE: `https://testnet-cofhe.fhenix.zone`
  - Verifier: `https://testnet-cofhe-vrf.fhenix.zone`
  - Decryption (Teecryptor; named "tn"): `https://testnet-cofhe-tn.fhenix.zone`
- **Testnet CommitmentRegistry:** `0x4ed29DD2bda5055ADaB10ff63f5556F6774e7D9F` on Arbitrum Sepolia, warn-only (teecryptor `src/envs/testnet.toml`) [V, not read on-chain].
- **Mainnet** (out of scope): Ethereum (1) and Arbitrum One (42161) (teecryptor `src/envs/mainnet.toml`; SDK chains).

### What E7 would need
- **Chain:** Arbitrum Sepolia is cheapest and is cofhesdk's default test chain (`PRIMARY_TEST_CHAIN = 421614`). Ethereum Sepolia reuses the Zama faucet funds. All three run identical contract code [M].
- **Accounts:** 3 fresh EOAs from `.env` (A = holder, B = grantee, C = stranger), plus 1 extra for the 7702 test. **Do not use well-known or anvil keys**: they carry 7702 delegations set by strangers on public testnets (cofhesdk `test/setup/src/env.ts:18–20`).
- **Our own contract:** a minimal contract on `@fhenixprotocol/cofhe-contracts` 1.0.x that mints a handle and calls `FHE.allowThis` and `FHE.allow(h, msg.sender)`. Intake is open on testnets (`accessListEnabled = false`), so no allowlisting is needed. Use dummy values, since `allowGlobal` makes them public.
- **Client:** `@cofhe/sdk` 0.8.x (Node, viem), using `decryptForView` (sealoutput) and `decryptForTx`.
- **Steps:**
  - **E7-a (B2 variant):**
    1. ACP with the default revoker: decrypt OK.
    2. `revokeAllExisting()` (1 tx): the old ACP is denied.
    3. A fresh ACP: OK.
    4. An ACP with revoker 0 and expiry the largest uint64 value: OK.
    5. A sharing ACP from A to C, with no transaction: C decrypts.
  - **E7-b (B3):**
    1. A `allow(h,B)`: B decrypts. Measure gas.
    2. B `allow(h,C)`: transitivity.
    3. A `allowGlobal(h)`: C decrypts without an ACP.
    4. A `allowForDecryption(h′)` on a fresh handle: expect C to be **denied** (`403 not_publicly_allowed`). This confirms it is inert.
  - **E7-c (optional, B5):** delegate A via 7702 to a delegate that rejects raw ECDSA, so the ACP is denied. Re-delegate or clear the delegation, so the ACP is accepted again. A can call `allow` from the EOA throughout.
  - **E7-d (optional, B6):** a contract account whose `isValidSignature` burns about 1M and then about 4M gas, one request each. This finds the operator RPC cap and timeout. Keep it to a handful of requests at realistic PQ sizes. It is the only step that uses Fhenix's live service in an unusual way.
- **Cost [E]:** testnet gas only, about 15–25 transactions, roughly zero real money. Decrypt requests to the testnet service are free.
- **Safety:** only our own accounts, contract, handles and dummy values. Fhenix contracts and the decryption service are used as intended. No third-party data is read. Points to watch:
  - our test EOAs become publicly linked to the experiment;
  - the testnet admin can upgrade the contracts mid-run, so record the implementation addresses before and after;
  - the SDK retries `204` for up to 5 minutes, so keep requests single-flight.
- **Zero-footprint variant:** E7-a and E7-c can also be shown with `eth_call` and state overrides against the live ACL, as done in §4 for the ordering probe. This costs nothing but does not exercise Teecryptor.
- **Assessment:** E7 is **cheap and safe** under the brief's ground rules.

---

## 7. Corrections and suggested changes to the design doc

1. **§4.2 (replace).** Suggested Turkish text:

   > Fhenix'te (cofhe-contracts @ b5c20ed) bir handle'a erişimi olan her adres (EOA ya da sözleşme) `TaskManager.allow` ile bu erişimi başka bir adrese kalıcı olarak verebilir, `TaskManager.allowGlobal` (`FHE.allowPublic`) ile de handle'ı herkese açabilir [R15]. İzinler geri alınamaz ve geçişlidir; ACL'de iptal fonksiyonu yoktur ve Fhenix'in kendi belgeleri ile testleri bunu açıkça belirtir. `allowForDecryption` da çağrılabilir, ancak yazdığı bayrağı bugünkü şifre çözme yolu okumaz; herkese açma işlevi `allowGlobal`'dadır. Şifre çözme izinleri (ACP) EIP-712 ile imzalanır ve doğrulama tamamen zincir üstünde yapılır: şifre çözme servisi (bugün TEE içinde çalışan Teecryptor; eşik ağı henüz planlanan bir adımdır) her istekte `TaskManager.isAllowedWithPermission`'ı `eth_call` ile çağırır. İptal isteğe bağlıdır: `revokerData` ve `revokerContract` alanlarını izni imzalayan seçer; sıfır bırakılırsa izin iptal edilemez [R16]. Varsayılan iptal sözleşmesi yalnızca o ana kadar oluşturulmuş izinleri iptal eder; sonradan imzalananlar geçerlidir. İzin süresinin üst sınırı yoktur. Dolayısıyla anahtarı ele geçiren biri iptal edilemez ve süresiz bir izin imzalayabilir, hatta zincirde iz bırakmadan başka bir adrese "paylaşım" izni verebilir. Kullanıcının kendi adresini emekliye ayırabileceği bir mekanizma yoktur; yönetişimin `denyList`'i yalnızca görev girişini engeller, şifre çözmeyi etkilemez. Dolayısıyla B1, B2 (daha güçlü bir biçimde) ve B3 Fhenix'te de geçerlidir. B5 ve B6 ise farklıdır: ACL, OpenZeppelin 5.1+ `SignatureChecker` kullanır; adreste kod varsa (7702 ile delege edilmiş EOA'lar dahil) ECDSA hiç denenmez ve karar ERC-1271 ile hesabın koduna bırakılır. Sözleşme düzeyinde gas tavanı yoktur; sınır, operatörün RPC'sinin `eth_call` tavanıdır (Sepolia'da ~4M gas'lık bir `isValidSignature` kabul edildi). Yine de 7702 EOA'nın orijinal anahtarı delegasyonu değiştirerek ya da zincir üstünde `allow` ile yetkisini korur. Son olarak Fhenix'te kullanıcıya şifre çözme kanalı (sealoutput) ML-KEM değil, X25519 tabanlı NaCl `crypto_box`'tır; bu kanal kuantuma dayanıklı değildir.

2. **Özet and §1.1 (and brief §0).** The premise that "the ciphertexts and the user-decryption channel are post-quantum" holds for Zama only. Fhenix seals to X25519 (teecryptor `src/seal.rs:1–7`; cofhesdk `acps/sealing.ts:1, 31, 53–57`), and its result and input signatures are secp256k1 (TaskManager.sol:825–848, 1004–1029). Fhenix therefore also carries an HNDL exposure on sealed outputs wherever they are recorded [I].
3. **Appendix A.**
   - **R15:** TaskManager.sol 947–971 is fine. For ACL.sol, cite 160–213 and add 364–366 (the "never revoked" comment) and 447–449 (`isAllowed`).
   - **R16:** Permissioned.sol 57–61, 164–165, 168–194, 216–255; ACPTimestampRevoker.sol 55–63.
   - **Add:** teecryptor `src/permit.rs:606–665`, OZ v5.2.0 `SignatureChecker.sol:22–49`, `fhenix-docs` `acl.mdx:23, 46`.
4. **§10 E7.** Add the concrete plan and the E7-b(4) "`allowForDecryption` is inert" check from §6.
5. **For Phase 2 (Q4, Q6) [I, analysis]:**
   - **Retire & Carry ports to Fhenix as an ACL-only change**, because every authority decision is an on-chain `eth_call`:
     - `sealed[issuer]` and `sealed[recipient]` checks in `withPermission`;
     - `notSealed` on `allow`, `allowGlobal`, `allowForDecryption`, `allowTransient` and `shareCtHash`;
     - a fail-closed flag that rejects `issuer.code.length == 0`.

     No change to Teecryptor is needed.
   - **C3 is effectively already deployed on Fhenix** (code-first), which shows it is deployable. It also shows its limit: a 7702 key can re-delegate.
   - **C4 option (a) is effectively Fhenix's status quo:** no cap, with the DoS and timeout cost borne by the RPC.
   - **Red-team items:**
     - a sealed address acting as the *recipient* of someone else's sharing ACP;
     - the caller-chosen `host_chain_id` across chains, so sealing must be consistent per chain;
     - operator RPC trust;
     - unbounded ACP expiry, so pre-signed permits persist;
     - no `allow` events, so carry needs traces to enumerate handles;
     - governance upgrade or re-point can override any seal (B8).

---

## 8. Possible prompt injection / agent-targeted content (treated as data; nothing acted upon)

- **`teecryptor/CLAUDE.md`.** The harness loaded it automatically when that directory was read. Its content is a pointer: "See AGENTS.md. Agent guidance for this repo lives there". No instructions were followed.
- **`teecryptor/AGENTS.md:16–18`.** Writing-style guidance for agents, e.g. "State facts and their mitigations, not warnings". Not followed for this report.
- **`teecryptor/.claude/settings.json`.** Defines a `SessionStart` hook that runs `python3 .claude/check-plugins.py` and registers a third-party plugin marketplace (`FhenixProtocol/claude-marketplace`, `autoUpdate: true`). It **did not run** (no session is rooted there). **Recommendation:** do not open Claude Code sessions with a scratch clone as the project root, and do not trust those folders.
- **`cofhesdk/.memory/*.md` and `cofhesdk/skills/`.** Agent memory and skill files. Only `testing.md` lines 60–90 were read, as data.
- **`fhenix-toolkit` plugin** (`.../skills/fhenix-sdk/references/concepts/permit-issuer-gotcha.md`). Agent-oriented developer guidance (e.g. "Always derive `issuer` from the connected client. Never hardcode."). Read as data; one factual point is cited above (ERC-6492).

None of this content tried to redirect this verification task.

---

## 9. What was executed (for reproducibility)

- **`git clone --depth 1`** of the five Fhenix repos listed in §1, into `scratch/fhenix/`. No build, install or script from those repos was run.
- **Read-only `gh api` / `gh search code`** on public repos.
- **Read-only `cast`** against testnet public RPCs: `chain-id`, `block-number`, `code`, `nonce`, `implementation`, `call`. `call` was used with `--override-code` / `--gas-limit` for the §4 probe.
  - The probe's private key was generated in-process from `os.urandom`, never printed or stored, and never funded.
  - The signed typed data and the scratch files are in the session scratchpad (`…/scratchpad/probe/td.json`, `…/scratchpad/explorer/`).
- **Read-only HTTPS GET** to the Blockscout API v2 for verified source.
- **No transactions, no mainnet access, no contact with anyone.**
