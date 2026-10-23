# A6: Product, institutions and wallets

**Role:** deliberation agent A6 of 7 (brief §3), 2026-10-21. I read no other agent's file in `results/deliberation/`.

**Inputs:** the brief (§0–§3, §5 Level 2); V1 (v0.1); `DESIGN_REVIEW.md`; the G1 report; `VERIFICATION.md`; reviews 01–05, the 04 census and the objection ledger. Code read-only: fhevm `ed851716c` and OZ confidential-contracts 0.5.3. Public web pages fetched 2026-10-21. No transactions, no requests to Zama services, no outreach.

**Labels:** **[V]** verified, with the source; **[M]** measured in an earlier phase (source given); **[I]** inferred; **[E]** estimate; **[C]** cited, not reproduced.

**Versions:** "deployed" means v0.13.x (ACL v0.4.0) on Ethereum and Polygon; "main" means `ed851716c`.

## Summary

1. **The product is safe rotation of decryption authority,** not "get PQ". Deployed v0.13.x offers retirement and rotation; PQ destinations come with main's connector-verified paths.
2. **Continuity needs both mechanisms.** Carry what you must use or re-share; a **dormant, matured successor** is the safety net, encoded as its own state and events, not as a locked wildcard delegation.
3. **Certificates and watchtowers.** A retirement certificate is worth a small Extension (lost keys, one-ceremony multi-chain retirement, custodian exit). Watchtowers are real only for on-chain anomalies and protocol regressions; as "history protection after a theft" they are theatre, because off-chain decryption leaves nothing to watch.
4. **Cross-chain.** One bit per chain, per-chain status everywhere, one signature relayed to every chain, no propagation protocol.
5. **PQ-only mode is the off-chain half of the host chain's ECDSA freeze.** Without that freeze the old key re-grants on-chain; with it, the host chain's recovery path becomes the user's.
6. **Semih's instinct.** It is right about scope and wrong about "better". All six V1 intents return; none of the six mechanisms returns as written (§3).

**The three limits, stated every time:**
1. pre-emptive, not a clawback;
2. oracle access only;
3. as final as the chain's governance.

---

## 1. Recommendations per segment, and wallet copy

### 1.1 Segments

**Individuals.** Census: 12.7K holder accounts; 80.7% plain EOAs, 17.2% 7702 EOAs; a median of 12 handles [M-04].
- **One wizard, two modes.** *Planned move:* designate the new wallet as successor → confirm after D (7 days) → move balances by handle → carry → retire on every host chain. *Urgent move:* balances → carry → retire, no wait; later arrivals stay unreadable.
- **Cost is no obstacle** (a median carry is ~0.40M gas, ~$0.07 at 0.068 gwei [E-04]). 7702 users get W8. Certificates are advanced-only: a seed backup already allows retirement after losing a device.

**Institutions** (treasury, payroll, OTC, RWA):
- **Designate a successor at wallet creation,** while the key is fresh. It stays dormant until retirement, so the recovery key can live cold.
- **Retire-with-successor is decryption-key rotation that keeps the address.** Whitelists, Travel Rule records and RWA allowlists [V `ERC7984Restricted.sol:14-16`] stay valid; the successor reads inbound payments; the old key keeps asset authority (limit 2).
- **Carry whatever must be re-shared** (auditors, app positions): the successor cannot re-share (SU-9). Export records first; the chain is not the system of record [V `ERC7984Omnibus.sol:13-14`].

**MPC custodians and wallet platforms.** Dfns and Bron are verified Zama integrations [V-04]. Dfns wallets are EOAs ("Dfns provides an Externally Owned Account (EOA) wallet" [V-web, docs.pimlico.io]); Bron is a three-party MPC wallet [V-web, Silence Labs].
- **Runbooks.** *Key ceremony:* designate a successor and escrow a multi-chain certificate. *Decommission:* retire everywhere. *Incident:* carry and retire at once (there is no suspend). A client-held certificate gives vendor independence for the one action that only removes rights.
- **PQ route: a declared PQ decryption signer on the existing address.** Bron is a design partner for Silence Labs' threshold ML-DSA "PQ-MPC Vault" [V-web, byline 2026-05-15; production status unclear].
- **Policy-engine gap.** Neither engine I checked documents function-selector or EIP-712-field rules: Dfns' recipient whitelist "will trigger the policy (ie. fail closed)" for non-transfers [V-web, docs.dfns.co], and Coinbase CDP documents only `evmTypedDataVerifyingContract` [V-web]. Custodians need rule templates.

**Custodian policy defaults:**
- **P-1.** Retire only with a confirmed successor, or in the same transaction as a carry.
- **P-2.** Quorum for retirement and successor calls, wildcard or non-expiring delegations, any ACL `allow`/`allowForDecryption`/`multicall`, `setObserver`/`setOperator`, and certificate signing.
- **P-3.** Decryption permits (EIP-712 domain: the gateway `Decryption` contract with the **host** chain id [V `gateway-contracts/contracts/Decryption.sol:1023-1031`]): at most 7 `durationDays`, listed contracts, a fresh transport key per session.
- **P-4.** The successor lives in another security domain; never a hot wallet or payment address. **P-5.** Decommission means retire everywhere. **P-6.** Suspected key or quorum compromise means carry and retire now.
- **P-7.** Alert on ACL events naming custodian addresses that no workflow produced. EOA egress is nearly zero on mainnet: 4 EOAs ever called `allow`; 0 of 91,737 `allowForDecryption` calls came from an EOA [M-04].

**Service delegates.** Census: 19 delegates, one of which serves 374 of 403 delegators; 53 non-expiring delegation events [M-04].
- **One delegate key per client,** with expiring delegations.
- **Rotation is a self-retire** (all of that key's delegations stop in one transaction), then each client re-delegates. On deployed the delegate must be an ECDSA EOA [V-J 05 §1.3]; on main an ERC-1271 smart-account delegate rotates owners without re-delegation.

**Auditors and observers:**
- **Time-boxed access already exists:** `delegateForUserDecryption(auditor, contract, expiry)` [V main `ACL.sol:326-377`]; default to at most 90 days. Retiring the delegator kills it (Core); re-issue it from the carried account, or use successor-issued delegations (Q5).
- **Observers should be smart accounts reading through short-lived delegated view keys.** Otherwise rotating an EOA observer means every observed holder must call `setObserver` (`msg.sender == account` [V `ERC7984ObserverAccess.sol:28`]), and the new key sees only the current balance, not past amounts (`:33`), unless the old observer carried them first. Observers and auditors migrate first (SU-11).

**Token issuers and OpenZeppelin:**
- **Gate non-zero `setObserver` and `_setOperator` on `FHE.isAccountRetired`;** never block inbound grants. `setObserver` is the real leak (current balance plus future amounts). `setOperator` is asset authority with transient decryption reach [V `ERC7984.sol:135, 144, 283`], so gating it is about consistency [I].
- **RWA tokens.** The agent's `recoverAddress` [V `ERC7984Rwa.sol:164-175`] keeps working for retired accounts, since it uses the token's own ACL rights [I]. Document asset recovery and decryption retirement together.

**Wallets and explorers:**
- **Publish ERC-7730 clear-signing descriptors** for the ACL calls, the permit and the certificate; ERC-7730 covers calldata and EIP-712 [V-web, Sourcify; ethereum.org 2026-05-11]. Show per-chain status and typed errors.
- **Lifecycle calls are wallet-native.** A dApp-originated `retireAccount` or `designateSuccessor` is blocked by default, as `setApprovalForAll` from unknown sites is.
- **Never offer "send to successor",** and never style retirement as a freeze or a sanction.

### 1.2 Wallet copy (EN / TR)

**Confirmation levels.** *Red* (one-way, or grants; hold to confirm and type the address suffix): retire, carry, `allowForDecryption`, wildcard or non-expiring delegation, certificate. *Amber* (adds authority later): designate, confirm, `setObserver`, permits over 7 days. Dates and addresses below are illustrative.

**W1. Retire, with a successor (red)**

EN:
> **Retire 0xA1…C3 on Ethereum and Polygon?**
>
> After this, the decryption network will no longer accept this address's key, even from you. Your successor 0x5E…77 (confirmed 14 Oct 2026) keeps reading this address's history and anything sent here later.
>
> Retiring does not:
> - **take anything back.** What this key already decrypted, shared or made public stays exposed, including results stored by services;
> - **cover more than decryption.** This key can still move funds and act in apps;
> - **outlast the protocol's rules.** It is recorded on each chain separately, and whoever can upgrade the protocol on a chain could change it.
>
> ☐ I understand that neither I nor anyone holding this key can undo this.
>
> **[Retire on 2 chains]**

TR:
> **0xA1…C3 Ethereum ve Polygon'da emekliye ayrılsın mı?**
>
> Bundan sonra şifre çözme ağı bu adresin anahtarını kabul etmeyecek; istek sizden gelse bile. Halefiniz 0x5E…77 (14 Eki 2026'da onaylandı), bu adresin geçmişini ve adrese sonradan gelenleri okumaya devam eder.
>
> Emekliye ayırma:
> - **hiçbir şeyi geri almaz.** Bu anahtarın daha önce çözdüğü, paylaştığı ya da herkese açtığı her şey, servislerin sakladığı sonuçlar dahil, açıkta kalır;
> - **yalnızca şifre çözmeyi kapsar.** Bu anahtar varlıkları taşıyabilir ve uygulamalarda işlem yapabilir;
> - **her zincirin kuralları kadar kalıcıdır.** Her zincirde ayrı kaydedilir; o zincirde protokolü yükseltebilenler bunu değiştirebilir.
>
> ☐ Bunu ne benim ne de bu anahtarı elinde tutan birinin geri alamayacağını anlıyorum.
>
> **[2 zincirde emekliye ayır]**

**W2. Retire without a successor (red; the user must type RETIRE / EMEKLİ)**

- EN: *"No successor is set. After retiring, no one, including you, can decrypt anything through this address on Ethereum again, including what is sent here later. Use this only if the key is lost or exposed and you cannot wait 7 days for a successor."*
- TR: *"Halef atanmamış. Emekliye ayırdıktan sonra Ethereum'da bu adres üzerinden, siz dahil, kimse bir daha hiçbir şeyin şifresini çözemez; buraya sonradan gelenler de dahil. Bunu yalnızca anahtar kaybolduysa ya da ele geçirildiyse ve halef için 7 gün bekleyemiyorsanız kullanın."*

**W3a. Pending successor, expected (banner with a countdown)**

- EN: *"Successor pending: 0x5E…77 can be confirmed from 28 Oct 2026. Once confirmed, no one holding this address's key can change it; only the successor can step down."*
- TR: *"Halef onay bekliyor: 0x5E…77, 28 Eki 2026'dan itibaren onaylanabilir. Onaylandıktan sonra bu adresin anahtarını elinde tutan hiç kimse onu değiştiremez; yalnızca halef çekilebilir."*

**W3b. Unexpected designation (red; push notification, and email for custodial accounts)**

- EN: *"A successor you may not recognise was proposed for this address: 0x9F…01, by this address's own key, on 21 Oct 2026 at 14:02. If this wasn't you, your key is compromised. Recommended: move what you need and retire now, so the proposal can never be confirmed."* **[Move & retire now]** [This was me]
- TR: *"Tanımadığınız bir halef önerilmiş olabilir: 0x9F…01, bu adresin kendi anahtarıyla, 21 Eki 2026 14:02'de. Bu siz değilseniz anahtarınız ele geçirilmiş demektir. Önerimiz: ihtiyacınız olanı taşıyıp hemen emekliye ayırın; böylece öneri hiçbir zaman onaylanamaz."* **[Taşı ve şimdi emekliye ayır]** [Bu bendim]

"Replace it" is not the main action: a thief can replace it back.

**W4. Sending to a retired recipient**

With a successor (neutral):
- EN: *"0xA1…C3 retired its decryption key on 21 Oct 2026. Its designated successor can read incoming amounts. Payments work as usual."*
- TR: *"0xA1…C3, şifre çözme anahtarını 21 Eki 2026'da emekliye ayırdı. Gelen tutarları atanmış halefi okuyabilir. Ödemeler her zamanki gibi çalışır."*

Without a successor (amber):
- EN: *"No one can read amounts sent to 0xA1…C3 (retired 21 Oct 2026, no successor). Ask the recipient for a current address."*
- TR: *"0xA1…C3'e gönderilen tutarları kimse okuyamaz (21 Eki 2026'da emekliye ayrıldı, halefi yok). Alıcıdan güncel bir adres isteyin."*

Neither variant has a "send to successor" button.

**W5. Partially retired (amber)**

- EN: *"Retired on Ethereum · still active on Polygon. This key can still decrypt this address's Polygon history. [Retire on Polygon]"*
- TR: *"Ethereum'da emekli · Polygon'da hâlâ aktif. Bu anahtar bu adresin Polygon geçmişini hâlâ çözebilir. [Polygon'da emekliye ayır]"*

**W6. Who else can see this** (built from `Allowed` and delegation events)

- EN: *"Who can decrypt this amount: you · recipient 0xB0…22 · the token contract (and its admin, if upgradeable) · your observer 0x0B…5E · PayrollCo, until 1 Dec 2026. Retiring removes only your line."*
- TR: *"Bu tutarı kimler çözebilir: siz · alıcı 0xB0…22 · token sözleşmesi (yükseltilebiliyorsa yöneticisi de) · gözlemciniz 0x0B…5E · PayrollCo, 1 Ara 2026'ya kadar. Emekliye ayırmak yalnızca sizin satırınızı kaldırır."*

**W7. Retirement certificate (red)**

- EN: *"Create a retirement certificate for Ethereum and Polygon. Anyone holding it can retire this address on those chains without your key. It can never grant access, and it works only while this address has a confirmed successor. Store it offline, like a recovery phrase."*
- TR: *"Ethereum ve Polygon için emeklilik sertifikası oluştur. Bu sertifikayı elinde tutan herkes, anahtarınız olmadan bu adresi o zincirlerde emekliye ayırabilir. Hiçbir zaman erişim vermez ve yalnızca bu adresin onaylı bir halefi olduğu sürece geçerlidir. Kurtarma ifadesi gibi çevrim dışı saklayın."*

**W8. Notice for 7702 accounts**

- EN: *"Upgrading to a smart account does not protect your confidential history. This address's original key can still decrypt it. To protect it, retire the address with a successor."*
- TR: *"Akıllı hesaba yükseltmek gizli geçmişinizi korumaz. Bu adresin asıl anahtarı onu hâlâ çözebilir. Korumak için adresi bir halefle emekliye ayırın."*

**W9. Scheduled PQ-only notice (banner, and an SDK warning on every permit)**

- EN: *"From 1 Oct 2029, Ethereum's decryption network will refuse requests signed by classic (ECDSA) keys, like this address's. Before then, add a post-quantum (PQ) decryption signer or retire to a PQ successor, or you will not read these balances until you complete the chain's recovery process. Funds are not affected by this change."*
- TR: *"1 Eki 2029'dan itibaren Ethereum'un şifre çözme ağı, bu adresinki gibi klasik (ECDSA) anahtarlarla imzalanan istekleri reddedecek. O tarihten önce kuantum sonrası (PQ) bir şifre çözme imzacısı ekleyin ya da adresi PQ bir halefle emekliye ayırın; yoksa zincirin kurtarma sürecini tamamlayana kadar bu bakiyeleri okuyamazsınız. Varlıklarınız bu değişiklikten etkilenmez."*

**W10. Fixed glossary** (04 P11), the same in every product:

| EN | TR |
|---|---|
| Forget on this device | Bu cihazda unut |
| Revoke delegation | Yetki devrini geri al |
| Retire address | Adresi emekliye ayır |
| Successor | Halef |
| Retirement certificate | Emeklilik sertifikası |

Help pages add: *"There is no restore service for retired addresses; any such offer is a scam."* / *"Emekli adresleri geri getiren bir hizmet yoktur; böyle bir teklif dolandırıcılıktır."*

---

## 2. Answers to Q1–Q12

### Q1. Ideal end state (in 2–3 years, from the product side)

- **Every address has a per-chain authority panel:** status, successor, declared signer and scheme, expiring delegations, "who else can see this".
- **Onboarding sets a successor;** institutions escrow a certificate; PQ users declare an ML-DSA signer and retire the classic key.
- **Lifecycle calls and permits are first-class** in custodian policies and clear signing. PQ-only mode runs per chain, aligned with the host chain's ECDSA sunset; upgrades to the views are timelocked, watched and pinned.

### Q2. V1 ideas

The table is in §3.

**Testing Semih's instinct honestly:**
- **"Broader" is true, along one axis.** V1 had the PQ destination (C4), the Q-day switch (C5), and a profile shaped exactly like an ERC: an interface plus normative off-chain verifier rules (R1–R4). The brief's Level 0–3 path is largely V1's C1–C5 re-ordered.
- **V1 also got details right that the reviews later confirmed:** inbound grants are harmless; no governance override; the delegator-side check; "after theft it is a race"; "both doors close together with Ethereum's freeze".
- **It was narrower along the user-harm and reality axes.** V1 missed lockout (and the successor that answers it), deputies, the deployed-versus-main split, governance (B8), per-chain scope, stored results and app-level authority, and it claimed no residual risk.
- **"Better" holds for direction, not for design.** All six intents return; none of the six mechanisms survives as written. The target should be V1's breadth, built with v2's mechanism and the review's user safety.

### Q3. Lifecycle states

**On-chain, Core has two states: Active and Retired.** The UX adds per-chain sub-states: successor pending until DATE; successor confirmed; retired and read by the successor; retired and unreadable.

**No on-chain Suspended state:** (1) nobody safe can lift it: the key cannot (a thief would), and a guardian becomes a new censorship-and-restore power; (2) the need is covered elsewhere: MPC custodians suspend at the policy layer, smart accounts suspend by refusing in ERC-1271 (unified path, once Level 1 code-first stops 7702 root keys bypassing it), and an EOA with a confirmed successor can simply retire; (3) a third state reads like a freeze.

**Compromised versus Deactivated** has the same on-chain effect, so keep the reason in the audit log; a public "compromised" flag would be a breach notice set by a possibly hostile key. `AccountRetired` serves as SP 800-57 deactivation evidence, the lifecycle Zama uses for its own KMS keys [V `docs/protocol/architecture/kms.md:68-77`].

### Q4. A declared decryption signer

**Verdict: yes, as an Extension**, on main's connector-verified paths only. It serves MPC custodians and anyone keeping their address, and spares PQ smart accounts a ~1.23M-gas ERC-1271 call [M-P1].

**It is safe only under four rules:**
1. Retirement kills it.
2. Declaring or changing it waits D and is surfaced like a successor designation (*adding authority waits; removing it is instant*).
3. Once declared, the account's ECDSA permits are refused. Without this no-downgrade rule it adds nothing under T2.
4. Removing it needs the declared signer, or the delay.

**The copy must say** it protects decryption requests only: the classic key can still re-share on-chain (B3) until the address is retired or the chain disables classic keys.

### Q5. Continuity: successor, carry, or both?

**Both, with different jobs:**
- **Carry** (`multicall([allow…, retireAccount()])`) covers what the new account must *use or re-share*: auditor delegations, app flows, re-grants. It fits one transaction for more than 99.9% of ECDSA holders [E-05].
- **The successor** is the safety net: stragglers that arrive after retirement, insurance against lockout when a thief retires first, the 8 heavy ECDSA-rooted accounts [M-04], and inheritance.

**Encoding: a dedicated successor rather than a locked wildcard delegation (ruling on SU-14):**
1. **Dormant versus live.** A locked wildcard delegation is live from confirmation, so two keys can read for the account's whole life. The dedicated successor reads only after retirement (05 §4.2 spec), so the recovery key can stay cold.
2. **The pending state must be visible.** Delegation events cannot say "pending until". Wallets need `SuccessorDesignated(account, successor, confirmableAt)`, `…Confirmed`, `…Resigned` and `AccountRetired(account, successor)`.
3. **Little is gained by reusing delegations.** UIs would show a Revoke button that reverts, while the SDK's "decrypt as" flow works under either encoding (its precheck reads only `isHandleDelegatedForUserDecryption` [V-04]) and old coprocessor listeners skip unknown events [V-J 05 §4.1].

**Product requirements:**
- **D defaults to 7 days** (optionally raise-only per account). **W3b alerts** on unexpected designations or resignations; the safe response is carry plus retire, since a thief can keep replacing a pending proposal.
- **Coverage** equals what the account could decrypt directly: both need the app contract allowed on the handle [I from the view logic].
- **The successor cannot be replaced after retirement and cannot re-share.** On main, recommend a smart-account successor, which rotates owners inside. On deployed it must be an EOA (P1d), so losing it is final, and institutions should also carry.
- **Optional, worth considering:** successor-issued read delegations over the retired account's handles (at most 90 days, no re-delegation, dying with the successor). Auditors get KMS-backed access with an on-chain trail, at no new exposure [I].
- **MUST NOT** be a payment address or a redirect target.
- **If the successor key is lost before retirement,** no new designation is possible [05 §4.2]. The remedy is carrying to a new address, and the "Learn more" text should say so.

### Q6. Revocation certificate and watchtower

**Verdict.** The certificate (an EIP-712 message, signed by the account, letting anyone call `retireAccountWithSig` on listed chains) is worth a small Extension. A watchtower is worth it only for on-chain signals.

**Where they are realistic:**
1. **A lost key with no backup.**
2. **One signing ceremony for many chains,** with a relayer paying gas (users often hold no gas token on the second chain).
3. **Separation of duties and vendor independence:** compliance or the client can retire an MPC wallet.
4. **Response to on-chain compromise signals:** retiring kills every delegation the thief created and stops reading of later arrivals.

**Where they are theatre:**
1. **Protecting the past after a theft.** The thief decrypts with an off-chain permit: main's HTTP path has no transaction at all [V-P1 §1.3], the mainnet gateway's RPC is private [M-P1], and a decryption completes in seconds (2.5–12.6 s on Sepolia [M-P1]).
2. **Mempool racing.** Both sides can use private order flow, and the thief's earlier `allow` grants survive a later retirement.
3. **A "quantum watchtower".** A CRQC harvests silently.

**Product constraints on the certificate:**
- **It only retires; it never grants.** A signed grant is a phishing primitive [05 M3].
- **`requireSuccessor`, on by default.** It executes only while a confirmed successor exists, so a leaked certificate merely triggers the planned handover; without the flag it is a lockout tool.
- **No nonce and no cancellation by the key,** or a thief cancels the user's certificate first.
- **An explicit list of chain ids under one signature.** ERC-1271 accounts are supported; ML-DSA-44 verification costs about 1.23M gas, once [M-P1].
- **Quantum forgery adds nothing:** a forged certificate equals `retireAccount()` from a derived key.
- **Small:** under ~300 bytes, printable as a QR code [E].

**The real watchtower job:**
- **Triggers:** ACL events naming the account that no workflow produced (`Allowed` with the account as caller, `AllowedForDecryption`, wildcard or non-expiring delegation, unexpected designation or resignation, observer changes); an ETH or ERC-20 drain; the user's emergency button.
- **Response:** relay the certificate to every listed chain, then notify.
- **Protocol-regression watch, the most valuable job.** After every ACL upgrade on each chain, confirm that `isAccountRetired` exists and a retired test account is still refused (the release-train hazard [05 §1.10]).
- **Decryption-activity notices** are possible only for the relayer or operators: opt-in, detection only, at a privacy cost. Watchtowers suit custodians and explorers, rarely individuals.

### Q7. Cross-chain

**Facts.** Ethereum and Polygon have separate ACLs, both at v0.4.0 [M-04]. They share one gateway chain (261131), one `Decryption` contract and one relayer URL [V `sdk/js-sdk/src/core/chains/definitions/mainnet.ts:20-25`, `polygon.ts:21-26`]. Permits are bound to the host chain id [V `Decryption.sol:1023-1031`]. So retirement is per host chain, and permits cannot cross chains.

**UX rules:**
1. **Status is per (chain, address);** the aggregate is Active, Partially retired (a warning, W5) or Retired everywhere.
2. **Retire on every supported host chain by default,** even with no history there, or later arrivals stay readable by a stolen key.
3. **One signature covers many chains** (the certificate or SDK batching). Successors are per chain too; designate them in the same session.
4. **Detect the feature per chain** ("not available on Polygon yet"), and ask Zama to upgrade both host chains in one release window, under the release rule.
5. **Bridged handles** (main only) are new destination handles, so retire there too [V-J 05 §1.1].
6. **No propagation protocol;** it adds bridge trust for a rare action. Explorers show each chain, never a global badge.

### Q8. PQ-only mode from the user's side

**Starting point.** About 98% of holders and every delegate signer are ECDSA-rooted [M-04]; switched on today, PQ-only mode is an outage.

**What it actually protects:**
- **Accounts that retired to a PQ successor** (or carried to a PQ account) before Q-day are protected without anyone's switch.
- **For everyone else it closes only the off-chain door.** A quantum attacker can still use the derived key to `allow` or delegate to their own PQ account on-chain [I from B3]. So it protects unmigrated users only if the host chain freezes ECDSA transactions on the same date, as V1's C5 already said.

**Effect per path:**

| Path | Under PQ-only |
|---|---|
| EOA or 7702 direct permits | refused |
| ECDSA delegates (all 19 today) | refused |
| Deployed legacy path | refused outright |
| PQ smart account (1271 with the budget), or a declared PQ signer | accepted |
| Confirmed PQ successor of a retired account | accepted |
| Public decryption | unchanged |
| Funds | untouched by this switch |

**Notice:**
- **Scheduled mode.** At least 24 months' notice, and no later than the host chain's ECDSA sunset. NIST IR 8547's draft proposes deprecation after 2030 and disallowance after 2035 [C]. Milestones:

  | When | What |
  |---|---|
  | T−24 months | Announce; monthly readiness KPI (share of holders and value with PQ-capable authority, per chain) |
  | T−18 months | PQ authorization live on all production paths and major wallets |
  | T−12 months | SDK warnings on ECDSA permits; relayer `Sunset` header (RFC 8594 [C]) |
  | T−6 months | No new ECDSA successors or delegates in wallets |
  | T−3 months | Explorer banners, custodian notices |
  | T0 | Switch, per chain |

- **Emergency mode** may come with no notice; say so in advance, so the KPI and "prepare now" prompts are the notice.
- **Messengers:** the KMS operators who build wallets and explorers (Ledger, Dfns, Fireblocks, Etherscan, OpenZeppelin [V-04 P14]).

**Recovery for users who did not migrate.** Zama should inherit the host chain's recovery rather than invent one.
- If Ethereum lets users prove seed knowledge to regain control [C, R14], the recovered address can carry and retire through ordinary ACL calls. If it becomes a contract account, it decrypts directly through ERC-1271 once Level 1 code-first ordering is live: "the proof that recovers your ETH also recovers your confidential history" (04 P13).
- A Zama-only STARK route is optional and later. Never a support-desk unfreeze: that is a backdoor.

**A caveat on hidden keys** [I]. Every ECDSA permit reveals the public key to whoever stores the request; on deployed, the request is a gateway-chain transaction. Users who ever decrypted cannot rely on "my key was never exposed".

### Q9. Governance

Holders cannot "exit" confidential history, so a timelock's exit window mainly serves operators (pinning) and watchers. The product asks are: explorers flag pending upgrades to decryption permissions; the regression watchtower; the release rule on both chains; and limit 3 in plain words (W1). An immutable registry helps only if operators pin it [05 §1.8].

### Q10. Vendor neutrality

- **One surface for wallets:** an ERC-165 interface id, `isAccountRetired`, and `AccountRetired(account, successor)`, with identical semantics on every oracle.
- **Oracles declare their reply-channel scheme,** so wallets label decryptions honestly: Zama uses ML-KEM [V-P1 N6], Fhenix X25519 [V-P1 N4], Inco ECIES inputs (per the brief).
- **Denials carry a distinct "retired" reason,** or the SDK prechecks.

### Q11. What changes, in product order

1. **ACL Core** on both host chains in one window, plus the release rule.
2. **SDK:** `getAuthorityStatus(address, chains)`; an `isAccountRetired` precheck throwing a typed `AccountRetiredError` (today a failed `persistAllowed` precheck throws a generic `AclUserDecryptionError` [V `sdk/js-sdk/src/core/host-contracts/checkPersistAllowed.ts:100-109`], so a retired user would look like any denial [I]); `plan`/`execute`/`verifyRetirement` with a dry run; a purge of permits and transport keys on retirement; a fresh transport key per session by default (today only recommended [V `sdk/js-sdk/docs/security.md:153`]).
3. **Wallets and explorers** (copy, confirmations, ERC-7730 descriptors, per-chain status); **OpenZeppelin** gates; `FHE.isAccountRetired` in Zama's library.
4. **The Successor Extension;** an advisory `account_retired` code in the relayer.
5. **Custodian policy templates,** the certificate Extension and a reference watchtower.
6. **Level 1 on main,** enabling smart-account successors and delegates and account-level suspend.
7. **Later:** the declared PQ signer (after an audit), the PQ-only signal with `Sunset` headers, and PQ KMS and gateway responses (Zama's roadmap). The KMS and gateway need nothing for Level 0.

### Q12. Conformance

- **Off-chain verifiers** refuse, at processing time, any request whose signer, delegator or delegate is retired on that host chain, and SHOULD return a distinguishable reason.
- **Normative (Security Considerations):** anything that displays successors MUST NOT treat one as a payment address or redirect payments to it.
- **Informative "lifecycle-aware wallet" profile:** per-chain status, decoded lifecycle calls, dApp-originated lifecycle calls blocked, transport-key purge, W1-equivalent disclosures with the three limits.
- **Conformance is per chain and per release:** "conforming on chain X from block N".

---

## 3. V1 ideas: verdicts

| V1 idea | Verdict | Form it returns in | Why |
|---|---|---|---|
| **C1** sealing | **Returns (Core)** | `retireAccount()`: a one-way bit read in the ACL views; no sentinel, no write-side modifier | Mechanism inert on deployed and bypassed by deputies. V1 already had irreversibility, no governance override, inert inbound grants and the delegator check |
| **C2** carry-and-seal UX | **Returns as UX and SDK** | Wizard: inventory → app exits → balances → `multicall([allow…, retire])` with dry run and decoded preview, plus the successor | `allowMany` duplicates `multicall`; grant-plus-seal is a phishing primitive; carry is a snapshot; V1's order was wrong |
| **C3** connector-side rules | **Mechanism no; destination rule yes, as UX** | Level 1 code-first. Wizard labels: EOA = rotation only; 7702 = root key remains; ECDSA Safe = rotatable, not PQ; PQ account or declared signer = PQ-capable (main) | C3 accepts a 7702 root key; 7851 declined, 8298 now the path |
| **C4(a)** code-hash allowlist | **Does not return** | — | Proxies, three layers, DoS, re-listing per wallet release |
| **C4(b)** native verification | **Returns (Extension)** | Declared Decryption Signer: subordinate, matured, no-downgrade; native FIPS 204 after audit | The PQ path for MPC custodians and address keepers |
| **C4(c)** precompiles | **Returns as "inherit"** | Nothing to build; pairs with Level 1's execution budget | Calldata alone is 71% of 250k for ML-DSA-44 [M-03] |
| **C5** fail-closed | **Returns, new owner and preconditions** | PQ-only signal (Extension) plus operator policy (≥ 9/13), aligned with the host chain's ECDSA freeze; notice, KPI, host-chain recovery | A governance flag is an outage for ~98% and ECDSA-flippable; V1's "both doors with Ethereum's freeze" survives |
| **ERC-7984 PQ profile** | **Returns, broadened and renamed** | The vendor-neutral ERC itself, plus an ERC-7984 companion section (inbound not blocked; identity-gated grants check retirement) | V1's R1–R4 map to Core, Level 1, PQ-only and the declared signer; "PQ" in the name overclaims Phase A |

---

## 4. Core versus Extensions, from the product side

**Core** (ships on deployed): `retireAccount`, `isAccountRetired`, `AccountRetired(account, successor)` (successor 0 when none), read-side semantics, inert inbound grants, no un-retire, not pause-gated, and ERC-165 discovery. Wallets need nothing more on day one: the SDK precheck gives typed errors without any off-chain change.

**Extensions, in product priority:** (1) **Successor**, which any wallet offering retirement SHOULD offer, since without it retirement is a lockout risk; (2) the **token and app profile** (OZ gating); (3) the **revocation certificate**; (4) **cross-chain conventions** (status and chain lists, no protocol); (5) the **declared decryption signer** (Phase B); (6) **PQ-only signalling** (a signal only).

**Kept out of the ERC:** watchtowers, suspend, reason codes, and wallet copy (an informative appendix at most).

**What drives adoption:**
- **Wallets:** one status call, typed errors, ERC-7730 descriptors shipped with the ERC (Ledger proposed ERC-7730 [V-web, Unchained] and runs a KMS node [V-04 P14]), tested EN/TR copy, nothing new for non-retiring users.
- **Custodians:** policy templates, SP 800-57 evidence, address continuity, one-ceremony certificates, a PQ path that keeps the address.
- **OpenZeppelin:** a two-line gate mirroring `isAccountDenied`, no change to `_update`. **Zama:** L2BEAT already lists the risk [V-04]; Core is about 55 lines [E-05].

**What blocks it:** lockout fear (answered by the successor and the copy), indexing cost, policy engines without selector rules, unsynchronised host-chain upgrades, and the `setObserver` gap until OZ ships.

---

## 5. Expected disagreements

1. **Red team: "the certificate is new attack surface."** It only retires, needs a confirmed successor by default, and the key cannot cancel it; worst case, an early handover.
2. **Red team and judge: "successor-issued delegations empower the successor key."** No exposure beyond what it reads; time-boxed and visible. If rejected: smart-account successors on main, carry for institutions.
3. **Zama engineer: "reason codes and synchronised upgrades are operational load."** Most of it lives in the SDK precheck.
4. **Clean-slate architect: Suspended or Compromised states, or a protocol PQ-only state.** Suspend belongs to the account layer; enforcement stays with operators.
5. **AA/PQ expert: a live successor, or optional no-downgrade.** A dormant successor exposes less; without no-downgrade a declared signer adds nothing under T2.
6. **ERC editor: "no wallet MUSTs in an ERC."** Keep one MUST NOT (successor ≠ payment address).
7. **I depart from earlier rulings on** SU-14 (dedicated encoding), SU-9 (carry plus successor) and a raise-only D.

---

## 6. Open questions

1. **A lost confirmed successor:** replaceable (long delay plus successor veto), or "move to a new address"?
2. **On main:** a bounded successor chain, or a mandatory smart-account successor?
3. **Certificate scope:** explicit chain lists only, or an explicit "present and future chains" flag?
4. **Decryption-activity notices:** who may run them, at what privacy cost?
5. **Host-chain recovery:** will Ethereum's and Polygon's quantum plans offer a recovery transaction that preserves `msg.sender` for ACL calls, on aligned dates?
6. **Observers:** should OZ let a confirmed successor manage a retired account's observers?
7. **Policy engines:** will Dfns, Fireblocks and others add selector and EIP-712 field rules?
8. **Non-EVM hosts:** how does retirement work on, for example, Solana, which Zama announced [C, newsletter title, 2026-10-01]?

**Sources (web, fetched 2026-10-21):**
- [Dfns policies](https://docs.dfns.co/api-reference/policies)
- [Pimlico: Dfns signer](https://docs.pimlico.io/permissionless/how-to/signers/dfns)
- [Coinbase CDP policies](https://docs.cdp.coinbase.com/embedded-wallets/policies/evm-policies)
- [Silence Labs: Bron](https://silencelaboratories.com/blog/why-bron-is-a-design-partner-for-the-world-s-first-pq-mpc-wallet-infrastructure)
- [ethereum.org: clear signing](https://ethereum.org/developers/tutorials/clear-signing)
- [Sourcify: ERC-7730](https://docs.sourcify.dev/blog/intro-to-erc7730/)
- [Unchained: clear-signing launch](https://unchainedcrypto.com/ethereum-foundation-launches-clear-signing-standard-to-end-blind-signing-exploits/)
- NIST IR 8547 draft, via [Encryption Consulting](https://www.encryptionconsulting.com/education-center/nist-ir-8547-sp-800-131a-algorithm-transitions/) [C]
