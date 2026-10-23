# Şifre Çözme Yetkisinin Yaşam Döngüsü: hedef mimari

> Bu belge docs/TARGET_ARCHITECTURE.md'nin tam Türkçe karşılığıdır; çelişki durumunda İngilizce sürüm esastır.

**Oracle tabanlı gizli yürütme için geri alınabilir erişim; referans sistem Zama fhEVM**

| | |
|---|---|
| **Sahibi** | Semih Civelek (Himess) |
| **Tarih** | 2026-10-21; Faz 4 eklemeleri 2026-10-22 (§11) |
| **Durum** | Tasarım; Level 0–3 için Zama'nın kendi mock'ları ve test düzenekleri üzerinde yerel bir referans prototip var (seviye seviye durum §4'te; ölçümler `results/RESULTS.md`'de). Müzakere hükümlerini izler. Yerel belge: hiçbir şey yayımlanmadı ya da gönderilmedi. |
| **Eşlikçi belgeler** | `erc/ERC-XXXX-decryption-authority-lifecycle.md` (kayıt tarafı standardı: Core, E1, E2); `docs/COMPANION_EXTENSIONS_AND_PROFILES.md` (E3 ve H, Q, A profilleri); `docs/HEDEF_MIMARI_TR.md` (tam Türkçe sürüm) |

**Girdiler, otorite sırasıyla:**
1. Brief, `docs/CLAUDE_CODE_BRIEF_ERC_TARGET_DESIGN.md` (§0, §1, §4 B1).
2. `results/deliberation/DELIBERATION_SUMMARY.md`. Hükümleri bağlayıcıdır. Girdiler çeliştiğinde bu belge onu izler; çelişkiler Ek A'da listelenir.
3. Derinlik ve kanıt için `results/deliberation/A1…A7_*.md` ve `COORDINATOR_VERIFICATION.md`.
4. Arka plan: `results/VERIFICATION.md`, `DESIGN_REVIEW.md`, `G1_TARTISMA_RAPORU.md`, `results/review/04_census/aggregate.json` ve özgün vizyon V1, `docs/FHE_Yetkilendirme_PQ_Tasarim.md`.

Bu belgeye yeni bir araştırma girmedi. Belge, girdilerin sentezidir.

---

## Bu belge nasıl okunmalı

**Sıra.** Brief önce vizyonu, sonra yolu, sonra bugün için asgari olanı istiyor:
- §1–§3: aklımızdaki (problem, ilkeler, son durum);
- §4: oraya nasıl varılacağı (Level 0–3);
- §5: bugün yayına çıkabilecek olan;
- §6–§10: kayıt (kararlar, hedef dışı bırakılanlar, V1 eşlemesi, artık riskler, açık sorular).

**Kanıt etiketleri.** Her olgusal iddia, girdilerden kopyalanmış bir etiket içerir.
- Bir etiket asla yükseltilmez. İki girdi aynı olguyu farklı etiketlediğinde düşük olan kullanılır (Ek A).
- Mimarinin neyi gerektirdiği gibi tasarım ifadeleri etiket içermez. Bunlar karardır ve §6'da kayıtlıdır.

| Etiket | Anlamı |
|---|---|
| [V-A7] | Hakem (A7) tarafından kodda, `A7_judge.md`'de verilen dosya:satır konumunda doğrulandı |
| [V-CV] | Koordinatör tarafından kodda doğrulandı (`COORDINATOR_VERIFICATION.md`) |
| [V-A1] … [V-A6] | İlgili müzakere ajanı tarafından doğrulandı; hakem yeniden kontrol etmedi |
| [V-P1] | Faz 1'de (`results/VERIFICATION.md`) kodda ya da salt okunur zincir okumalarıyla doğrulandı |
| [V-05] | `DESIGN_REVIEW.md`'de bildirildiği üzere Faz 2 hakemi tarafından doğrulandı |
| [M-…] | Ölçüldü; kaynaklar bir sonraki tabloda |
| [E] | Tahmin |
| [I] | Çıkarım |
| [C] | Bir spesifikasyondan ya da web sayfasından alıntılandı; yeniden üretilmedi |

**Ölçüm kaynakları.**

| Etiket | Kaynak | Tarih (UTC) | Donanım ve yazılım |
|---|---|---|---|
| [M-P1] | Faz 1 (`results/VERIFICATION.md` §5): kendi hesaplarımızdan Sepolia işlemleri (bloklar 11958285–11958369) ve Osaka kurallarıyla çalışan yerel anvil | 2026-10-20, 22:32–22:49 | AMD Ryzen 5 5600 (6C/12T), 16 GiB, Windows 10 Pro 19045; anvil/forge 1.8.5, solc 0.8.30, Node 22.13.0, Rust 1.95.0 |
| [M-03] | Faz 2 inceleyicisi 03 (`results/review/03_aa_pq_expert.md`) | 2026-10-20, 23:15–23:31 | AMD Ryzen 5 5600, 16 GB, Windows 10 Pro 19045; Rust 1.95.0; forge/anvil/cast 1.8.5; solc 0.8.25 |
| [M-04] | Mainnet sayımı (census), yalnızca toplamlar (`results/review/04_census/aggregate.json`). Ethereum mainnet ACL v0.4.0 üzerinde salt okunur `eth_getLogs`, bloklar 23.832.647–26.237.004 (2025-11-19 ile 2026-10-20 arası) | çalıştırma: 2026-10-20, 23:15–23:55 | AMD Ryzen 5 5600, Windows 10 Pro 19045; Node 22.13.0, Python 3.11.9 |
| [M-A5] | Müzakere ajanı A5: yerel (native) PQ doğrulama kıyaslamaları (benchmark). Ham çıktılar `impl/bench-pq/a5_native_verify/` içinde | 2026-10-21, 05:16–05:18 | AMD Ryzen 5 5600, Windows 10, rustc 1.95.0; RustCrypto crate'leri, hepsi denetlenmemiş |
| [M-L1] | Level 1 (`results/level1/PROFILE_H_CRATE.md`, `PROFILE_H_CONNECTOR.md`, `H9_PRECHECKS.md`): yerel anvil'de (Osaka) imza crate'i ve SDK ön kontrolü; VPS'te yerel bir anvil'e karşı Zama'nın kms-worker'ı ve relayer'ın birim testleri | 2026-10-21 | AMD Ryzen 5 5600, Windows 10 Pro 19045, Rust 1.95.0, anvil 1.8.5; the VPS (4 vCPU), Rust 1.99.1, anvil 1.3.5 |
| [M-L2] | Level 2 (`results/level2/`): `lifecycle/level2` dallarında Foundry testleri ve anvil gas ölçümleri, VPS'te connector ispatı | 2026-10-21 | AMD Ryzen 5 5600, Windows 10 Pro 19045, forge/anvil 1.8.5, solc 0.8.24; VPS, [M-L1]'deki gibi |
| [M-L3] | Level 3 (`results/level3/LEVEL3.md`): `lifecycle/level3` üzerinde Foundry, anvil düzenekleri (izleyici için üç zincir), ortak crate'in KDA testleri, Profil Q simülasyonu ve A5 ölçümlerinin yeniden koşturulması | 2026-10-21 | AMD Ryzen 5 5600, Windows 10 Pro 19045, forge/anvil 1.8.5, solc 0.8.24, Node 22.13.0, Rust 1.95.0, Python 3.11.9 |
| [M-P4] | Faz 4 (`results/phase4/`): VPS'te connector, uç nokta (endpoint) ve relayer düzenekleri; M1'de SDK ve crate testleri; aksi belirtilmedikçe her kontrol üç koşu | 2026-10-21 ve sonrası | AMD Ryzen 5 5600, Windows 10 Pro 19045, Rust 1.95.0, anvil 1.8.5; VPS (4 vCPU, sınırlı kapsam), Rust 1.99.1, anvil 1.3.5, Postgres 17.5 |

**Sağlayıcı tarafsızlığı.**
- İlkeler ve hedef gereksinimler sağlayıcıdan (vendor) bağımsızdır.
- Zama'ya özgü olgular ve değişiklikler **Zama:**, Fhenix'e özgü olanlar **Fhenix:** ile işaretlenir.
- **Yol kısaltmaları** (A7'deki gibi):
  - `main` = fhevm `ed851716c`; `v0.13.8:` = o etiket (tag);
  - `mock/` = `sdk/js-sdk/contracts/src/v0.13.0/`;
  - `OZ/` = `@openzeppelin/confidential-contracts` 0.5.3; `OZc/` = `@openzeppelin/contracts` 5.6.1;
  - `lib.rs` = `shared/user-decryption-signature/src/lib.rs`; `decryption.rs` = kms-worker olay işleyicisi.
- **"Konuşlu" (deployed)**, v0.13.x sürümündeki (ACL v0.4.0, eski (legacy) gateway yolu) Sepolia ve Ethereum mainnet anlamına gelir. Polygon mainnet de ACL v0.4.0 çalıştırır [M-04].

**Sözcük seçimi.** "Geri alınabilir erişim" (*revocable access*) ve "emekliye ayırmak" (*retire*). Brief §1'in yasakladığı iki terim kullanılmaz.

**Terimler.**

| Terim | Anlamı |
|---|---|
| Kayıt sözleşmesi (registry) | View'ları kullanım ve şifre çözme haklarına karar veren host zinciri sözleşmesi (Zama `ACL`, Fhenix `ACL`) |
| Motor (engine) | Sabit hesaplama sözleşmesi (Zama `FHEVMExecutor`, Fhenix `TaskManager`) |
| Doğrulayıcı (verifier) | Kararı, serbest bırakmanın (release) önünde kapı işlevi gören bileşen (connector, TEE dağıtıcısı). SDK ve relayer ön kontrolleri yalnızca tavsiye niteliğindedir |
| Oracle | Serbest bırakma düğümleri kümesi: n düğüm; bunların t+1 yanıtı yeniden oluşturmaya (reconstruct) yeter. Bir kısıtlama ancak en az n−t düğüm onu uyguladığında bağlayıcı olur |
| Özne (subject) | Bir talebin dayandığı her taraf: talep eden, sahip ya da yetki devreden (delegator), delege (delegate), sözleşme, permit veren (issuer), permit alıcısı (recipient) |
| Yetki verme yolu (grant path) | Bir handle üzerindeki hakları genişleten, handle'ı herkese açan ya da bir yetki devri (delegation) veya permit oluşturan çağrı |
| Vekil sözleşme (deputy) | `isAllowed(h, caller)` kontrolünü yaptıktan sonra bir çağıran adına hareket eden sözleşme |
| Zincir üstü kapı (on-chain door) | Bir handle'ı kullanan, yeniden yetkilendiren ya da herkese açan işlemler. Göndereni host zinciri doğrular |
| Zincir dışı kapı (off-chain door) | Oracle'dan şifre çözmesini isteyen imzalı talepler. İmzacıyı doğrulayıcı doğrular |
| T1, T2 | T1: klasik bir anahtar hırsızı (bugün). T2: açığa çıkmış her secp256k1 anahtarını türeten, kriptografik açıdan anlamlı bir kuantum bilgisayar (Q-günü, *Q-day*) |
| ICS | Uygulama uygunluk beyanı (Implementation Conformance Statement) |
| KDA | Beyan edilmiş bir şifre çözme imzacısının anahtardan türetilmiş adresi (Extension (uzantı) E3) |
| B_Q | Profil Q'nun kesim bloğu |

---

## Bir bakışta

- **Problem.**
  - Oracle tabanlı gizli yürütmede geçmişin gizliliğine her şifre çözme talebinde yeniden karar verilir.
  - Bu kararın arkasındaki yetki, yaşam döngüsü olmayan bir ECDSA anahtarıdır.
  - Zama'nın konuşlu sisteminde bir adres kendi şifre çözme yetkisini emekliye ayıramaz; anahtarından çıkan tek bir işlem adresin bütün geçmişini yeniden paylaşır ya da herkese açar [V-P1; M-P1].
- **Ana fikir.**
  - Yalnızca hesabın kendisinin ayarlayabildiği, tek yönlü bir `retired` biti.
  - Bu bit, her doğrulayıcının, her SDK ön kontrolünün ve her zincir üstü vekil sözleşmenin (deputy) zaten okuduğu kayıt sözleşmesi view'larının içinde uygulanır.
  - Yükseltme bloğundan itibaren her connector sürümü için iki kapıyı da, zincir dışı kodda hiçbir değişiklik gerekmeden kapatır [I from V-A7].
- **Son durum:**
  - PQ ile doğrulanan hesaplar;
  - kayıt sözleşmesi view'larında sağlayıcıdan bağımsız bir yaşam döngüsü: emekliye ayırma, kabul edilmiş bir halef, bir emeklilik sertifikası;
  - yerel (native) olarak doğrulanan, bağımlı (subordinate) PQ şifre çözme imzacıları;
  - bir yürütme gazı bütçesi altında çalışan, kod-öncelikli (code-first) doğrulayıcılar;
  - host zincirinin ECDSA'yı kullanımdan kaldırmasını (sunset) izleyen, yalnızca-PQ bir operatör profili;
  - operatörlerce onaylanan (ratification), timelock'lu (zaman kilitli) PQ yönetişimi;
  - geçici (ephemeral) PQ aktarımı (transport).
- **Yol:**
  - Level 0: Core (çekirdek) (şimdi konuşlandırılabilir);
  - Level 1: imza hijyeni (main);
  - Level 2: süreklilik ve uygulamalar;
  - Level 3: PQ-yerel yetki, yalnızca-PQ profili, emeklilik sertifikaları ve yönetişim.
- **Bugün.** v0.13 hattında ACL 0.4.1; zincir üstü bir yükseltme koruması ve bir sürüm treni kuralıyla birlikte (§5).
- **Faz 4 (§11).** Standart, kayıt tarafı bir ERC ve bir eşlikçi belge olarak bölündü. Core, Fhenix CoFHE'nin bir portunda da çalışıyor ve okumaya göre Inco'ya da oturuyor. Amsterdam maliyetleri ölçüldü ve EIP-7851 açığı gösterildi. Sağlayıcıdan bağımsız bir uygunluk kiti üç kayıtta geçiyor.
- **Üç sınır:**
  1. önleyicidir, geri alma değildir;
  2. yalnızca oracle erişimini keser;
  3. bulunduğu zincirin yönetişimi kadar kesindir.

---

## 1. Problem ve tez

### 1.1 Oracle aracılı gizlilik

Oracle tabanlı gizli yürütmede sözleşmeler şifreli veri üzerinde hesaplama yapar. Açık metin sistemden ancak bir şifre çözme oracle'ı, talep edenin buna hakkı olduğunu kabul ettiğinde çıkar. Oracle şunlardan biri olabilir:
- **bir eşik ağı.** Zama'nın KMS'i 13 düğümden oluşur ve birbiriyle eşleşen herhangi 5 yanıt yeniden oluşturmaya yeter [V-A7, `api-p.ts:405-418`];
- **bir TEE.** Fhenix'in Teecryptor'ı kayıt sözleşmesine `eth_call` yapar ve dönen boolean yanıta güvenir [V-P1].

Bundan üç sonuç çıkar:
1. **Karar tekrarlanır.** Bir şifreli metin hiçbir zaman harcanmaz. Olduğu yerde kalır ve gizliliğine **her talepte yeniden karar verilir**.
2. **İki kapı vardır.**
   - **Zincir üstü kapı**, bir handle'ı kullanan, yeniden yetkilendiren ya da herkese açan işlemleri iletir. Bunların kimliğini host zinciri doğrular.
   - **Zincir dışı kapı**, oracle'a giden imzalı talepleri iletir. Bunların kimliğini doğrulayıcı doğrular.
3. **Güçlü şifreli metinler, zayıf yetki.** Şifreli metinler kuantum sonrası (post-quantum) olabilir: TFHE kafes tabanlıdır [C] ve Zama'nın kullanıcı yanıt kanalı hibrit ML-KEM-512'dir [V-A7]. Oysa talep etme yetkisi, bir adrese kalıcı olarak bağlı bir ECDSA anahtarıdır.

Dolayısıyla gizli geçmiş, ancak iki kapının arkasındaki yetki kadar dayanıklıdır; bugün ise bu yetkinin bir yaşam döngüsü yoktur.

### 1.2 Bugün eksik olan (referans olarak Zama)

| Bulgu | Konuşlu v0.13.x | Main `ed851716c` | Kanıt |
|---|---|---|---|
| **Kullanıcı tarafında emeklilik yok.** Bir hesap verdiği bir yetki devrini geri alabilir ya da süresini kısaltabilir; `main`'de başlangıç zamanı seçtiği bir andan önce olan izinlerini geçersiz kılabilir. Kendi yetkisini sonlandıramaz, tek bir handle için verdiği izni geri çekemez, herkese açık şifre çözmeyi geri alamaz ve anahtarının yeni izin imzalamasını durduramaz (`results/phase5/P0_1_USER_SURFACE.md`). Engel listesi (deny list) yalnızca sahibin (owner) kullanımındadır. Yalnızca `msg.sender` için, üç yazma fonksiyonunda kontrol edilir; alıcılar, yetki devirleri, view'lar ya da herhangi bir zincir dışı bileşen için hiçbir zaman kontrol edilmez | aynı | aynı | [V-P1] |
| **Geçmiş tek işlemle yeniden paylaşılır.** Sepolia'da test hesabımızdan gönderilen tek bir `allow(balance, BOB)`, BOB'un 21000 değerini çözmesini sağladı (140.780 gas); tek bir `allowForDecryption` ise değeri herkese açtı (141.493 gas). Tek bir `delegateForUserDecryption(attacker, WILDCARD, type(uint64).max)` geçmişteki ve gelecekteki her handle'ı O(1) gas ile kapsar | Sepolia'da teyit edildi | aynı kod; dApp vekil sözleşmeleri ve köprü (bridge) ek yollar ekler | [M-P1] Sepolia; [V-P1] kod |
| **Geçersiz kılma anahtarlara değil, permit'lere etki eder.** `startTimestamp` değerini imzacı seçer; bu yüzden anahtar sahibi basitçe taze bir permit imzalar | hiç geçersiz kılma yok: bir permit süresi dolana kadar yaşar (≤ 365 gün) | teyit edildi; EOA'lar ve 7702 EOA'larıyla daraltılmış | [V-P1] |
| **Zincir dışı kontrol, host zincirindeki hesap durumunu yok sayar** | gateway, gateway zincirinde `ECDSA.recover` çalıştırır | `ecrecover` ilk sırada ve sıfır RPC ile çalışır | [V-P1] |
| **7702 ile devredilmiş (7702-delegated) bir EOA'nın özgün anahtarı hâlâ şifre çözer** | Sepolia'da teyit edildi: her şeyi reddeden bir cüzdana devredilmiş bir EOA, özgün anahtarıyla şifre çözmeyi sürdürdü | `ecrecover`-öncelikli sıralama bunu kabul eder | [M-P1]; [V-P1] |
| **PQ hesapları yetkilendirme yapamaz** | ERC-1271 yolu yok: 2.420 baytlık bir ML-DSA-44 imzası HTTP 400 alır | ERC-1271 tavanı (cap) calldata dahil 250.000 gas'tır; ML-DSA-44 için 1.309.193 `gas_limit` gerekir, yani tavanın 5,24 katı | [M-P1] |
| **Yönetişim her katmanı yeniden yazabilir** | mainnet ACL sahibi bir Aragon DAO'sudur; EOA köklü iki çoklu imzadan (multisig; 3-of-6; 9-of-17) herhangi biri onun üzerinden, timelock olmaksızın yürütme yapabilir | aynı yükseltme yüzeyleri (UUPS) | [V-P1], zincir üstü okumalar 2026-10-20 |

**Kim açıkta.**
- Rastgele seçilmiş 1.000 mainnet sahip (holder) hesabından oluşan bir örneklemde 807'si düz EOA, 172'si 7702 ile devredilmiş EOA'dır. Dolayısıyla yaklaşık %98'i ECDSA köklüdür [M-04].
- 12.714 uç hesap gizli handle almıştır: medyan 12 handle, p99 127 [M-04].

**Düğüm tarafındaki düzeltmeler neden yetmez.**
- Her KMS tarafı kendi kullanıcı şifre çözme payını yerelde hesaplar ve 13 yanıttan t+1 = 5'i yeniden oluşturmaya yeter [V-A7].
- Bu yüzden düğüm kodunda ya da yapılandırmasında uygulanan bir kısıtlama, en az n−t = 9 operatör onu çalıştırana kadar kimseyi korumaz; sızıntı için ise yalnızca 5 düğüm yeter [I from V-A7].
- Zincir üstü bir view'a konan kısıtlama ise yükseltme bloğundan itibaren her doğrulayıcı sürümünü bağlar [I from V-A7].

### 1.3 Tez

> Oracle tabanlı gizli yürütmede geçmiş verinin gizliliğine her şifre çözme talebinde yeniden karar verilir. Şifreli metinler kuantum sonrası olabilirken talep etme yetkisi, bir adrese bağlı bir ECDSA anahtarıdır. Bu tasarım eksik yaşam döngüsü adımını, yani **geri alınabilir erişimi** ekler:
> - bir hesap, talep etme yetkisini **emekliye ayırabilir**;
> - bunun ardından her uyumlu oracle, bu yetkiye dayanan her talebi reddeder;
> - durum, oracle'ın zaten başvurduğu zincir üstü view'larda tutulur.

Yaşam döngüsü, Zama'nın kendi KMS anahtarlarına uyguladığı NIST SP 800-57 anahtar durumları *örnek alınarak modellenmiştir* [V-A7, `docs/protocol/architecture/kms.md:24, 68-77`]. Onlara eşdeğer değildir: Zama'nın tablosu Suspended (askıya alınmış), Deactivated (devre dışı bırakılmış) ve Compromised (ele geçirilmiş) anahtarları şifre çözme için kullanılabilir tutar [V-A7]; dolayısıyla bu benzetme bundan daha güçlü hiçbir şeyi desteklemez.

### 1.4 Üç sınır

Sınırlar burada eksiksiz olarak belirtilir ve tasarımın özetlendiği her yerde yeniden belirtilir.
1. **Önleyicidir, geri alma değildir.**
   - Emeklilik, anahtarı henüz kendisine karşı kullanılmamış bir adresi korur.
   - Anahtarın daha önce yeniden paylaştığı, herkese açtığı ya da çözdürdüğü her şey açıkta kalır.
   - Ele geçirilmenin ardından emeklilik, genellikle saldırganın kazandığı bir yarıştır.
2. **Yalnızca oracle erişimini keser.** Emeklilik, oracle'ın anahtarı tanımasını durdurur. Anahtarın bir hesap olarak hareket etmesini durdurmaz: fonlar, varlık yetkisi ve gözlemciler (observers) ile operatörler gibi uygulama rolleri anahtarda kalır.
3. **Bulunduğu zincirin yönetişimi kadar kesindir.**
   - Emeklilik host zinciri başınadır ve o zincirin sözleşmelerini yükseltebilen herkes onu geri alabilir.
   - PQ dünyasında ayrıca ancak host zincirinin kendi uzlaşması (consensus) ve hesap kimlik doğrulaması kadar sağlamdır.

### 1.5 Hedefler ve kapsam

Hedefler, V1'in G1–G6 hedefleridir; hepsi korunmuştur (§8):

| Hedef | İçerik |
|---|---|
| G1 | Bir anahtarın geçmişe erişiminin önleyici olarak kesilmesi |
| G2 | Geçmişi kaybetmeden bir PQ hesabına geçiş |
| G3 | Karşılanabilir maliyetli PQ yetkilendirmesi |
| G4 | Q-günü kapalı kalma (fail-closed). Kapsamı yeniden belirlendi: host zinciri ECDSA'yı dondurmadıkça bu yalnızca zincir dışı kapı için geçerlidir |
| G5 | Geriye dönük uyumluluk |
| G6 | Asgari değişiklik: yeni ilkel (primitive) yok, yeni güven kökü yok |

**Kapsam dışı**, V1'deki gibi:
- kullanıcı harekete geçmeden önce çalınan bir anahtar (sınır 1);
- karşı tarafların paylaşılan handle'lar üzerindeki kendi hakları.

---

## 2. İlkeler

Bunlar müzakerenin ilkeleridir (`DELIBERATION_SUMMARY.md` §(g)); her biri tek satırlık bir gerekçeyle verilmiştir.

| # | İlke | Gerekçe | Uygulandığı yer |
|---|---|---|---|
| P1 | **View'da karar ver.** Yaşam döngüsü durumu, oracle'ın zaten başvurduğu zincir üstü view'larda tutulur. Düğüm kodu yalnızca kısıtlayabilir, asla genişletemez | Bir view, yükseltme bloğunda sıfır kod değişikliğiyle her doğrulayıcıyı bağlar. Aksi halde bir kurulum (deployment), en serbest (t+1)'inci düğümü gibi davranır | Core R6, V1; §3.1, §3.3 |
| P2 | **Emeklilik, emekliye ayrılan anahtarın haklarını yalnızca azaltır** ve yükseltme bloğunda her doğrulayıcıyı bağlar | Saf bir azaltmayı koşulsuz kılmak (duraklatma, rol ya da ücret kapısı olmadan) güvenlidir ve bir yetki vermeye dönüştürülemez | R3–R5 |
| P3 | **Emeklilikten sağ çıkan olgunlaşmalıdır; emekliliğin öldürdüğü anında olabilir.** Halef, anahtar güvendeyken önceden taahhüt edilir; gecikmelidir (D ≥ 7 gün), herkese açıktır ve lehdarınca kabul edilir. Yetki devirleri ve beyan edilmiş imzacılar anında olabilir, çünkü emeklilik onları öldürür | Sağ kalan bir hak, hırsızın ele geçirebileceği en değerli şeydir; bu yüzden anahtar güvendeyken taahhüt edilmelidir. Emekliliğin öldürdüğü haklar, hırsızın joker (wildcard) bir yetki devriyle zaten elde edemeyeceği hiçbir şey eklemez [I from V-P1] | E1 (gecikme, kabul); E3 (gecikme yok) |
| P4 | **Tek anahtar kuralı.** Bir ECDSA hesabında sahip ile hırsız aynı anahtarı tutar. Yalnızca o anahtarın tetikleyebildiği her geçiş saf bir azaltma olmalıdır. Tek `WithSig` yolu emekliliktir ve halefe bağlıdır | Tek anahtarla yapılabilen her geçiş hırsıza da açıktır | E2; E3 için `WithSig` yok |
| P5 | **Her rolde, yetkilendiren her taraf.** Muafiyetler bir kontrolün ne için olduğuna göre tanımlanır, asla kimin çağırdığına göre değil | Atlanan bir rol, bir atlatma yoludur (bypass): devredilmiş yoldaki emekliye ayrılmış bir sözleşmede [V-CV] ya da Fhenix'teki bir permit alıcısında [V-A7] olduğu gibi. Çağıran kimliğine dayalı bir muafiyet, çağrıları ileten (relaying) bir motorda emekliliği devre dışı bırakır [V-CV] | R6, R10 |
| P6 | **Eşik aritmetiği.** Bir sızıntı için t+1 düğüm gerekir; bir kısıtlama n−t'de bağlayıcı olur. Kısıtlamaların yeri view'lardır; düğüm tarafındaki kısıtlayıcı kurallar yalnızca n−t'de iddia edilir | Paylar yerelde hesaplandığında ve 13'te t+1 = 5 iken, bir düğüm kuralının birini koruyabilmesi için önce dokuz operatörün onu uygulaması gerekir [I from V-A7] | O1; Profil H ve Q |
| P7 | **Her sürümden uzun yaşayan monoton durum:** ad alanlı (namespaced) depolama, bir yükseltme koruması (ERC-165 artı depolama konumu), bir kanarya (canary), sabitleme (pinning) | Bugün Core içermeyen bir sürüm bitleri okumayı sessizce bırakır: 0.4.1 → 0.6.0 ya da 0.7.0 yükseltmesi başarılı olurdu [V-A7] | R11; §5.4–§5.5 |
| P8 | **Host zincirini izle, asla öne geçme.** Geçiş yapmamış (unmigrated) hesaplar için yalnızca-PQ iddiaları ancak host zincirinin ECDSA'yı dondurduğu yerde geçerlidir. Kod-öncelikli doğrulama, host zincirindeki hesap değişikliklerini devralır | Geçiş yapmamış bir EOA için zincir üstü kapıyı yalnızca host zinciri kapatabilir. Bir oracle politikası sahte permit'i reddeder, sahte `allow`'u değil [V-A7 for the code; I for the impact] | Profil Q ve H |
| P9 | **Son durumdaki yetki zincirinde ECDSA yok:** kullanıcılar, yönetişim, gateway, operatör yanıtları, aktarım. O zamana dek her iddia ECDSA bağımlılığıyla etiketlenir | Her ECDSA halkası bir T2 başarısızlık noktasıdır ve yönetişim bunların tek başına en büyüğüdür [I from V-P1] | §3.6–§3.8 |
| P10 | **Yetkileri ve anahtarları ayır.** Yetki anahtarları imzalar; aktarım anahtarları alır. Halef yalnızca şifre çözme yetkisini devralır. Beyan edilmiş bir imzacı zincir üstünde hareket edemez | Dar kapsamlı bir anahtar, ele geçirilmesinin sağlayacağı kazancı sınırlar | E1, E3, §3.11 |
| P11 | **Varsayılan olarak geçici:** talep başına bir aktarım anahtarı, emeklilikte silinir; saklanan sonuçlara bir TTL; yeniden sunmadan önce yeniden kontrol | Emeklilik serbest bırakılmış payları geri çekemez; bunların gizliliği, bugün 365 güne kadar yeniden kullanılabilen bir aktarım anahtarına dayanır [V-P1] | V6; §3.5, §3.11 |
| P12 | **Host durumu kaynakları güven kökleridir.** Bunları beyan et ve çeşitlendir | t+1 ya da daha fazla düğümün host durumu yanıtlarını kontrol eden kişi, onlara herhangi bir talep için "izinli" yanıtı verdirebilir ve her ACL kuralını atlatır [I from V-A7] | O2, O3 |
| P13 | **Sağlayıcıdan bağımsız tek bir yüzey:** bir ERC-165 kimliği, `isAccountRetired`, `AccountRetired(account, successor)`. Uygunluk zincir başına, sürüm başına ve kurulum başınadır (ICS) | Cüzdanlar ve doğrulayıcılar, sağlayıcılar ve sürümler arasında tek bir arayüzü algılayıp okuyabilmelidir | R12, O2 |
| P14 | **Her yerde dürüst sınırlar:** önleyicidir, geri alma değildir; yalnızca oracle erişimini keser; bulunduğu zincirin yönetişimi kadar kesindir | V1'in "artık risk: yok" ifadesi onun başlıca abartılı iddiasıydı | her bölüm |
| P15 | **Açıkça belirtilmiş bir vizyonla konuşlandırılabilir bir asgari.** Her karar ne yaptığımızı, bilerek neyi yapmadığımızı ve nedenini söyler | Asgarilik vizyonu küçültmemeli, vizyon da bugün konuşlandırılabilir olanı bulanıklaştırmamalıdır (brief §0) | §5–§7 |

---

## 3. İdeal son durum

### 3.0 Kısaca son durum

Bu, bugünden iki-üç yıl sonrası için hedeflenen durumdur (A7'nin Q1 hakkındaki hükmü).
- **Yetki:**
  - hesabın kendi doğrulaması; bir yürütme gazı bütçesi altında, kod-öncelikli olarak değerlendirilir;
  - isteğe bağlı olarak, yerel olarak doğrulanan bağımlı bir PQ şifre çözme imzacısı.
- **Hesaplar.** PQ ile doğrulanan hesaplar normdur: ERC-1271 akıllı hesapları, EIP-8298 ile benimsenmiş koda sahip hesaplar, çerçeve işlemi (frame transaction) hesapları. EOA'lar eski (legacy) kalır ve onların çıkış yolu halefle emekliye ayırmadır.
- **Kayıt sözleşmesi.** Yaşam döngüsü durumu her sağlayıcının kayıt sözleşmesi view'larında tutulur ve roller arasında tektiptir. Kayıt sözleşmesi, PQ imzacılı ve operatör onaylı bir timelock'un arkasında durur.
- **Doğrulayıcılar:**
  - yalnızca bu view'lara dayanarak karar verir;
  - uygulamaları (implementation) sabitler ve bir kanaryayı izler;
  - host durumu kaynaklarını çeşitlendirir;
  - host zincirinin ECDSA'yı kullanımdan kaldırmasını yalnızca-PQ bir profille izler.
- **Aktarım** geçicidir ve hem girdi hem yanıt kanalında PQ'dur.

Üç sınır son durumu da sınırlar:
1. önleyicidir, geri alma değildir;
2. yalnızca oracle erişimini keser;
3. bulunduğu zincirin yönetişimi kadar kesindir; ayrıca ancak host zincirinin uzlaşması (consensus) ve hesap kimlik doğrulaması kadar sağlamdır.

```
 HOST CHAIN  (authenticates transactions; freezes ECDSA at its own sunset; offers recovery)
 +-----------------------------------------------------------------------------------+
 |  account --tx--> REGISTRY (ACL)  <--operand check (exempt)--  ENGINE (executor)   |
 |                    lifecycle: Active -> Retired; successor (E1); cert. (E2)       |
 |                    views: use | on-behalf | permit   -- every role gated          |
 |  deputies (apps, bridge) --isAllowed(h, caller)--> views   (closes on-chain door) |
 +--------------------------------------+--------------------------------------------+
                                        | eth_call, no `from`, fresh, every subject
 request --> RELAYER --> VERIFIER (connector / TEE) --release iff all views true--> ORACLE NODES
            (advisory)    code-first, budget, KDA route,                           replies: FIPS 203 KEM,
                          canary, pinning, Profile Q                              ephemeral transport key
 GOVERNANCE: timelock owns every authorization-path contract; PQ signers; >= n-t operator ratification
```

| Bileşen | Son durumdaki rolü (sağlayıcıdan bağımsız) | İlk Level |
|---|---|---|
| Kayıt sözleşmesi | Yaşam döngüsü durumunu her view'da, her rol için tutar ve uygular | L0 |
| Motor | Çağıranı için hesaplama yapar; amaca göre tanımlanmış tek muaf değerlendirme | L0 (yalnızca testler) |
| Doğrulayıcılar | Yalnızca her özne için taze ve true dönen view'larla serbest bırakır; kod-öncelikli; yerel PQ; operatör görevleri | L0 (değişiklik yok), L1, L3 |
| Relayer | Güvenilmeyen aktarım; doğrulayıcıyı yansıtan, tavsiye niteliğinde ön kontroller | L1, L2 |
| SDK | Yaşam döngüsü istemcisi: durum, taşıma (carry), halef, sertifikalar, aktarım hijyeni | L1–L3 |
| Oracle ve KMS | ≥ n−t düğümde uygunluk; ICS; PQ yanıt imzaları; PQ yanıt KEM'i | L0 (ICS), L3 |
| Gateway | Yalnızca sıralama ve ücretler; eski ECDSA yolu emekliye ayrılmış | L3 |
| Yönetişim | Her yetkilendirme yolu sözleşmesi üzerinde bir timelock; PQ imzacılar; operatör onayı | şimdi (ayrı talep), L3 |
| Uygulamalar | Kimliğe bağlı yetki verme yolları emekliliğe uyar (Profil A) | L2 |
| Cüzdanlar ve saklama | Zincir başına yetki paneli, açık imzalama (clear signing), saklama runbook'ları | L2–L3 |
| Aktarım | Geçici anahtarlar; her iki kanalda PQ; TTL'ler; yeniden kontroller | L2, L3 |

### 3.1 Kayıt sözleşmesi (Zama: `ACL`)

| | |
|---|---|
| **Hedef** | (a) Hesap başına, host zinciri başına **yaşam döngüsü**: Active → Retired (Etkin → Emekli), tek yönlü (Core R1–R14, §4.1). (b) **Her yetkilendirme view'ında, her rol için uygulanır.** Roller şunlardır: kullanım (`isAllowed`, `persistAllowed`), adına (on-behalf: yetki devreden, delege, sözleşme) ve permit (veren, alıcı). Yetki verme yolları emekliye ayrılmış bir çağıran için revert eder. Gelen izinler kabul edilir ve etkisizdir. Herkese açık şifre çözme değişmez. (c) **Anlama dayalı tek bir motor muafiyeti** (R10, §3.2). (d) **Sürümlerden sağ çıkan durum:** özel bir ERC-7201 ad alanı, bir ERC-165 Core kimliği ve Core'u düşüren ya da depolama konumunu değiştiren uygulamaları reddeden bir yükseltme koruması. (e) **Çağıranı koruyan toplu çağrı (batching)**; böylece önce taşıyıp sonra emekliye ayırma atomik olur. (f) **Extension'lar (uzantılar):** kabul edilmiş, olgunlaşmış halef (E1) ve halefe bağlı emeklilik sertifikası (E2). Beyan edilmiş imzacı (E3) kayıt sözleşmesinde durum gerektirmez. (g) **Sahiplik:** PQ imzacılı bir timelock; hakları genişleten yükseltmeler en az n−t operatörce onaylanır |
| **Zama bugün** | Yaşam döngüsü yok (§1.2). Connector'ın okuduğu view'lar her iki hatta da mevcut [V-A7]. Devredilmiş view'lar sözleşmenin hakkını ham olarak okur (`persistedAllowedPairs[h][contract]`; main `ACL.sol:568`, `v0.13.8:485`); bu yüzden önceki spesifikasyona göre emekliye ayrılmış bir sözleşme orada hâlâ geçerdi [V-CV]. `_authorizeUpgrade` boş bir `onlyOwner` kancasıdır (hook) (main `:674`, `v0.13.8:591`) [V-CV]. `multicall` mevcuttur ve `msg.sender`'ı korur [V-P1]. ACL'nin EIP-712 alanı (domain) yoktur [V-A3]. `lastBlockDelegateOrRevoke` saklanır ama getter'ı yoktur [V-A7] |
| **Zama değişikliği** | **L0:** main'de (ACL 0.8.0) ve v0.13 hattında (0.4.1) Core; isteğe bağlı olarak v0.14 hattında (0.5.1). Hat başına yaklaşık 75–90 Solidity satırı [E]. **L2:** aynı ad alanına eklenen E1; Solidity kütüphanesinde `FHE.isAccountRetired`. **L3:** E2 (sabit alanlı EIP-712 özetlemesiyle `retireAccountWithSig`); Profil Q'nun B_Q'su için isteğe bağlı bir getter, `getUserDecryptionDelegationLastBlock(address,address,address)` (`0x19259f72`); `owner()` olarak bir timelock |
| **Neden** | View'lar, karar veren her bileşenin zaten okuduğu şeydir. Connector'ın bütün ACL yüzeyi, `from` olmadan çağrılan dört view'dan ibarettir [V-A7, V-CV]. SDK ön kontrolü ve Zama'nın açık metin (cleartext) mock'u da emeklilik denetimi uygulanan (gated) view'ları okur [V-A7, V-CV]. Konuşlu gateway hiçbir ACL kontrolü yapmaz [V-A7]. Zincir üstündeki her dışa aktarma, dışa aktaranı özne alarak `isAllowed`'a yeniden girer [V-A7]. Dolayısıyla view'lardaki tek bir bit, sıfır yeni RPC ile, her connector sürümü için iki kapıyı da kapatır. Ad alanı, v0.4.x ile main arasındaki depolama indeksi çakışmasını önler [V-05]. Koruma vardır, çünkü Core içermeyen bir hatta yükseltilen bir backport, uygulamayı sessizce bırakır (§5.4) [V-A7] |

### 3.2 Motor (Zama: `FHEVMExecutor`)

| | |
|---|---|
| **Hedef** | Motor, çağıranı için hesaplama yapar. Operand kontrolü, **anlama (semantics) göre tanımlanmış tek muaf değerlendirmedir** (R10). Bir kayıt sözleşmesi emeklilik kontrolünü yalnızca, bir operandın, motorun çağıranı için yaptığı bir hesaplamaya girdi olarak kullanılmasını yetkilendirirken atlayabilir (MAY). Bu değerlendirmede özne çağıran sözleşmedir ve her çıktı yalnızca o sözleşmeye ve yalnızca o işlem süresince verilir. Muafiyet hiçbir zaman bir yetki vermeye, herkese açmaya, yetki devrine, zincirler arası transfere, permit'e ya da vekil sözleşme eylemine uygulanmaz. Bir doğrulayıcıya ya da başka bir sözleşmeye döndürülen bir yanıta da hiçbir zaman uygulanmaz. Üçüncü taraf çağrılarını ileten motorlar, özel bir operand kontrolü giriş noktası kullanır |
| **Zama bugün** | Executor `isAllowed`'ı yalnızca operand darboğaz noktasında (choke point), çağıran sözleşmeyi özne alarak okur (`FHEVMExecutor.sol:1062-1065`). Geçici (transient) erişimi yalnızca `msg.sender`'a verir (`:864, :1046`). Başka hiçbir host sözleşmesi view'ları executor sıfatıyla okumaz [V-A7, V-CV] |
| **Zama değişikliği** | Yok. Sabit karşılaştırma `msg.sender != FHEVM_EXECUTOR_ADDRESS` yalnızca `isAllowed` içinde kalır. Her biri bir testle sabitlenen üç değişmez (invariant) altında geçerlidir: tek bir operand darboğaz noktası; geçici izinler yalnızca `msg.sender`'a; başka hiçbir sözleşme view'ları executor sıfatıyla okumaz. Operand başına ±25 gas'lık ilk test toleransı tutmadı. Ölçülen ek yük main'de operand başına +44 ile +92, v0.13 hattında +114 ile +137; bu, bir executor çağrısının yaklaşık %0,3–0,7'si [M-L0]. Karşılaştırmanın kendisi yaklaşık +48; kalanı dört yeni dış fonksiyonun seçici dağıtımından (selector dispatch) geliyor. Sınır main için ≤ +100, v0.13 hattı için ≤ +140 olarak yeniden tanımlandı |
| **Fhenix (bilgilendirici)** | `TaskManager`, izinleri (grant), herkese açık `isAllowed`'ı ve oracle'ın `isAllowedWithPermission`'ını iletir; hepsinde `msg.sender` kendisidir [V-A7, V-CV]. Oraya uyarlanan (port edilen) çağıran kimliğine dayalı bir muafiyet, her izni ve oracle'ın kendi permit kontrolünü muaf tutardı [I from V-A7]. Bir port için gerekenler: bir `isAllowedForCompute(ctHash, caller)` giriş noktası; yazma yollarında `requester`'a dayalı denetim; `isAllowedWithPermission` içinde veren (issuer) ve alıcı (recipient) denetimi; ve bugün hiç olay yaymayan `allow` için olaylar (events) [V-A7] |
| **Neden** | Emekliye ayrılmış bir sözleşme hesaplamaya devam etmelidir, çünkü kullanıcılarının bakiyeleri oradadır. Asla dışa aktarmamalıdır ve her dışa aktarma yolu, dışa aktaranı özne alarak `isAllowed`'a yeniden girer [V-A7]. Muafiyeti amaca göre tanımlamak, kuralı çağrı ileten motorlarda da doğru tutar |

### 3.3 Doğrulayıcılar (Zama: kms-connector ve ortak imza crate'i)

| | |
|---|---|
| **Hedef** | **Core (V1–V7, §4.1):** yalnızca ilgili her view, karar anında, her özne için, handle'ın host zincirindeki kayıt sözleşmesinde true döndürdüyse serbest bırak; taze değerlendirme; `from` = motor kullanılmaz; hiçbir imza şeması ya da yolla atlatma yok; replikalar yaşam döngüsü olaylarını uygular. Saklanan sonuçlar sunulmadan önce yeniden kontrol edilir; emeklilik retleri kesindir ve `ACCOUNT_RETIRED` tipindedir: Core'da SHOULD, Profil H'de MUST. **Profil H (§4.2):** tek bir blokta kod-öncelikli doğrulama, dar bir 7702 shim'i, bir yürütme gazı bütçesi, herhangi bir RPC'den önce tavanlar, en fazla 2 deneme ve yalnızca-ECDSA olan her yolda normal koda (regular code) sahip öznelerin reddi. **E3 rotası (§4.4):** beyan edilmiş imzacıların yerel FIPS 204/205 doğrulaması; test vektörleriyle sınanmış, kütüphane çeşitliliğiyle. Host zincirinin ECDSA'yı kullanımdan kaldırmasında **Profil Q (§4.4)**. **Operatör görevleri:** bir emeklilik kanaryası, uygulama sabitleme, onaylanmamış uygulamalarda durma ve beyan edilmiş, çeşitlendirilmiş host durumu kaynakları |
| **Zama bugün** | **v0.13.8 connector'ı:** doğrudan yol `isAllowed(h, user)` ve `isAllowed(h, contract)` kontrollerini yapar; devredilmiş yol yalnızca `isHandleDelegatedForUserDecryption`'ı kontrol eder; kullanıcı imzası doğrulamaz, çünkü bunu gateway yapar [V-A7]. **Main connector'ı:** eski ve birleşik (unified) yollar. Birleşik yol önce `ecrecover`'ı, sonra `eth_call` üzerinde 250.000 `gas_limit` ayarlanmış ERC-1271'i dener; bu yüzden calldata da tavana sayılır (`lib.rs:137, 196-211`) [V-A7, V-CV]. ACL retleri ve ERC-1271 olumsuz yanıtları kurtarılabilir (recoverable) sayılır ve yeniden denenir; varsayılan olarak 20 denemeye kadar [V-A7]. **Her ikisi:** operatör başına, host zinciri başına tek bir RPC URL'si (`kms-worker.toml:172-184`) [V-A7]. Her iki connector'ın da değişiklik olmadan Core'a uyması beklenir [I]; Level 0 bunu göstermelidir |
| **Zama değişikliği** | **L0:** doğruluk için yok. **Operatör kulvarı (track)**, fhevm sürümüne bağlı olmadan: bir kanarya; sabitleme; kesin emeklilik retleri (yalnızca ret yolunda, özne başına bir `isAccountRetired` çağrısı); eski yolda kullanıcının sözleşmelerden biri olmadığının kontrolü; çeşitlendirilmiş host durumu kaynakları. **L1:** ortak crate'te ve connector yapılandırmasında Profil H. **L3:** KDA rotası ve Profil Q yapılandırması |
| **Neden** | Kararı view'lar verir (P1). Hijyen, main'deki 7702 kök anahtar açığını kapatır ve PQ hesaplarını kabul eder. Yerel doğrulama 1,23M gas yerine mikrosaniyeler tutar (§4.4). Operatör görevleri, yalan söyleyen bir kayıt sözleşmesi sürümüne karşı tek savunmadır |

### 3.4 Relayer

| | |
|---|---|
| **Hedef** | Tavsiye niteliğinde ön kontrollere sahip güvenilmeyen aktarım: doğrulayıcıyla aynı tavanlar ve bütçe; imzayı ve geçerlilik penceresini anahtar alan tekilleştirme (dedup); önbelleğe alınmış olumlu yetkilendirme yok; bir sonucu yeniden sunmadan önce yeniden kontrol (ya da ret); tavsiye niteliğinde bir `account_retired` kodu; eski rotalar kaldırılmış; birleşik rotalarda PQ permit boyutları kabul edilir |
| **Zama bugün** | Eski relayer'ın ön kontrolü denetimli view'ları okur [V-A3]. relayer-http hiçbir ACL ya da imza kontrolü yapmaz [V-P1]. Ücret ödeyen çağıranlar doğrudan gateway'e gönderebilir; bu yüzden relayer kontrolleri tavsiye niteliğindedir [V-P1]. Eski relayer sonuçları Postgres'te önbelleğe alır; süre dolumu işçisi (expiry worker) varsayılan olarak kapalıdır ve tekilleştirme anahtarı `signature` ile `request_validity`'yi dışarıda bırakır [V-P1]. `erc1271_gas_limit` zorunlu bir yapılandırmadır; her örnekte 250.000'dir [V-P1] |
| **Zama değişikliği** | **L0:** yok. **L1:** connector'la aynı değerlerle bütçe anlamı (semantics) ve tavanlar. **L2:** tavsiye niteliğindeki kod; tekilleştirme anahtarı; yinelenen bir talebi sunmadan önce yeniden kontrol, çünkü bugün tekilleştirme herhangi bir ACL kontrolünden önce çalışır [V-A3]. **L3:** eski rotaların kaldırılması |
| **Neden** | Relayer bir güvenlik kapısı değildir. Ama önbellekleri, emekliye ayrılmış talep edenlere sonuçları yeniden kontrol olmadan yeniden sunmamalı; ön kontrolleri de PQ hesaplarını, oracle onları daha hiç görmeden reddetmemelidir |

### 3.5 SDK

| | |
|---|---|
| **Hedef** | Bir yaşam döngüsü istemcisi: `getAuthorityStatus(address, chains)`; tipli bir `ACCOUNT_RETIRED` hatası; deneme çalıştırması (dry run), spam filtresi, parçalara bölme ve doğrulama içeren bir taşıma planlayıcısı; `retireEverywhere()`; halef için "adına çöz" (decrypt as); talep başına taze bir aktarım anahtarı, emeklilikte permit'lerle birlikte silinir; doğrulayıcının bütçe ve tavanlarıyla kod-öncelikli bir ön kontrol; ERC-7739 algılama ve sarmalama (wrapping); KDA talebi oluşturma; sertifika oluşturma |
| **Zama bugün** | Ön kontroller `persistAllowed` ve `isHandleDelegatedForUserDecryption`'ı okur (`checkPersistAllowed.ts:79`, `checkDelegation.ts:100`) [V-A7]; dolayısıyla emeklilik onlara hiçbir değişiklik olmadan ulaşır. Başarısız bir ön kontrol genel bir `AclUserDecryptionError` fırlatır [V-A6]. `ERC1271_GAS_LIMIT = 250_000n` koda gömülüdür [V-P1]. viem sarmalayıcısı her "execution reverted" yanıtını temiz bir revert olarak sınıflandırır; bu yüzden bazı düğümlerde gas'ı tükenen bir PQ hesabı istemci tarafında reddedilir [V-A5]; Faz 1 bu yanıt biçimini Sepolia'da gözlemledi [M-P1]. Uygulamalar aktarım anahtarı çiftlerini kalıcı olarak saklayabilir; oturum başına taze bir çift yalnızca önerilir [V-P1]. ERC-7739 desteği yoktur [V-A5] |
| **Zama değişikliği** | **L0:** doğruluk için yok. **L1:** sabit bir bütçeye dönüşür (bunun için bir SDK sürümü gerekir). **L2:** durum, tipli hata, taşıma aracı ve aktarım hijyeni. **L3:** KDA permit'leri ve sertifikalar |
| **Neden** | Cüzdanların tek bir durum çağrısına ve ayırt edilebilir bir nedene ihtiyacı vardır. Taşıma, kullanıcının süreklilik aracıdır. Hijyen olmadan aktarım anahtarları emeklilikten daha uzun yaşar |

### 3.6 Oracle ve KMS

| | |
|---|---|
| **Hedef** | **O1:** bir eşik oracle'ı ancak en az n−t düğüm uyumlu doğrulayıcılar çalıştırıyorsa uyumludur; bir TEE oracle'ı, düğümü uyumluysa uyumludur. **O2:** oracle şunları kapsayan bir ICS yayımlar: zincir kimliği ve kayıt sözleşmesi adresi; arayüz kimlikleri; yükseltme yetkisi ve timelock; motor adresi; n ve t; düğüm başına profiller; karar gecikmesi; saklanan sonuç politikası; yanıt KEM'i; ERC-1271 bütçesi ve tavanları; ve host durumu kaynakları (toplu olarak). **O3 (SHOULD):** hiçbir tekil host durumu kaynağı ya da ilişkili kaynak kümesi, t+1 ya da daha fazla düğümün view yanıtlarını belirlemez; olumlu yanıtlar operatörün kendi düğümüne, bir hafif istemciye (light client) ya da birbiriyle uyuşması gereken iki bağımsız sağlayıcıya karşı teyit edilir. **İddialar:** kısıtlayıcı profiller (H'nin retleri, Q) yalnızca ≥ n−t uygulayan düğümde; eklemeli olanlar (bütçe, KDA) canlılık (liveness) için ≥ t+1 destekleyen düğüm gerektirir. **KMS:** uçtan uca ML-DSA yanıt imzaları ve bağlam bağlamalı (context binding) bir FIPS 203 yanıt KEM'i |
| **Zama bugün** | KMS core'u kullanıcı imzalarını ya da ACL'yi hiç görmez: `UserDecryptionRequest`'in imza alanı yoktur [V-P1]. Paylar yerelde hesaplanır [V-A7]. Yanıtlar uçtan uca ECDSA'dır: main connector'ı yalnızca `Ecdsa256k1` ister; KMSVerifier ve gateway ECDSA doğrular [V-P1]. KMS, kms v0.15.0-0'dan itibaren ML-DSA ile imzalayabilir [V-P1]. Yanıt kanalı AES-256-GCM ile hibrit ML-KEM-512'dir ve ilişkili veri (associated data) içermez [V-A7; V-P1]. `kms/Cargo.toml:175`, `ml-dsa =0.1.1`'i denetlenmemiş olarak işaretler [V-A7] |
| **Zama değişikliği** | **L0–L2:** yok. **L3 ve Zama'nın yol haritası:** ML-DSA yanıtlarını uçtan uca kullanmak (B7); AEAD bağlam bağlamalı daha güçlü bir yanıt KEM'i seçeneği sunmak (§3.11) |
| **Neden** | Yetkinin yeri view'lar ve doğrulayıcılardır; KMS imzaları görmemeye devam etmelidir. Bir PQ iddiası PQ yanıtları ve PQ kanalları gerektirir. Kısıtlamalar yalnızca n−t'de bağlayıcıdır |

**Her oracle'ın yapması gerekenler (MUST) (Core, her sağlayıcı):**
1. yalnızca ilgili view'lar karar anında her özne için, handle'ın host zincirindeki kayıt sözleşmesinde true döndürdüyse serbest bırakmak. Hatalar, revert'ler ve zaman aşımları asla serbest bırakmaz;
2. bir tazelik sınırı beyan etmek ve hiçbir olumlu yanıtı talepler arasında yeniden kullanmamak;
3. anlama dayalı muafiyete uymak ve view'ları asla motor sıfatıyla çağırmamak;
4. hiçbir imza şemasının ya da eski yolun view'ları atlatmasına izin vermemek;
5. yaşam döngüsü olaylarını uygulayan replikalar kullanmak ya da replikalardan yetkilendirme yapmamak;
6. n, t, düğüm başına profilleri ve host durumu güven köklerini içeren bir ICS yayımlamak.

**Sağlayıcı uyumu.**

| | Zama | Fhenix | Inco |
|---|---|---|---|
| Kim karar verir | kms-connector kayıt sözleşmesi view'larını okur; eşik KMS, 13 düğüm, t+1 = 5 [V-A7] | Teecryptor (TEE), `isAllowedWithPermission` ya da `isPubliclyAllowed`'a `eth_call` yapar ve yanıta güvenir [V-P1] | incelenmedi: Inco kodu mevcut değildi [V-A7] |
| Kullanım view'ı | `isAllowed`, `persistAllowed` [V-A7] | `isAllowed`, `persistAllowed` [V-A1] | incelenmedi |
| Adına (on-behalf) view'ı | `isHandleDelegatedForUserDecryption`; main'de ayrıca `isDelegatedForUserDecryption` [V-A7] | `allowedOnBehalf` [V-A1] | incelenmedi |
| Permit view'ı | yok | `isAllowedWithPermission`: veren (issuer) `isAllowed` üzerinden denetlenir; alıcı (recipient) yalnızca imzasıyla kontrol edilir [V-A7] | incelenmedi |
| Motor | executor, yalnızca operand kontrolleri [V-A7] | `TaskManager` her ACL çağrısını iletir [V-A7, V-CV] | incelenmedi |
| Yanıt kanalı | hibrit ML-KEM-512 [V-A7] | X25519 (`tweetnacl` box) [V-A7] | brief'e göre ECIES girdileri (doğrulanmadı) |
| Core uyumu | yalnızca bir ACL değişikliği; connector'ların değişmeden uyması beklenir [I] | bir ACL portu: yalnızca hesaplama için giriş noktası, `requester` denetimi, veren ve alıcı denetimi, `allow` üzerinde olaylar | bilinmiyor |
| PQ iddiası (Profil Q) | yanıtlar (B7) ve kanallar PQ olduğunda mümkün | FIPS 203 yanıt kanalı olmadan mümkün değil | FIPS 203 kanalları olmadan mümkün değil |

### 3.7 Gateway

| | |
|---|---|
| **Hedef** | Yalnızca sıralama ve ücretler: yetki yok, ACL aynası yok; yalnızca birleşik yol; eski ECDSA yolu emekliye ayrılmış; sahip aynı timelock'un arkasında. Bu durumda gateway'in ele geçirilmesi en kötü ihtimalle bir hizmet engellemedir (denial of service) |
| **Zama bugün** | Konuşlu yolda gateway permit'i gateway zincirinde `ECDSA.recover` ile doğrular (`v0.13.8:Decryption.sol:916-925` doğrudan, `:937-949` devredilmiş; delegenin 65 baytlık ECDSA'sı `:947`'de) [V-P1, V-A7]. "ACL checks are performed by the KMS" ("ACL kontrolleri KMS tarafından yapılır") (`v0.13.8:Decryption.sol:724`) [V-A7]. Gateway test ağında sahip, 3-of-5 bir Safe artı bir LayerZero yoludur ve timelock yoktur [V-P1]; mainnet gateway'inin RPC'si özeldir [V-P1]. Konuşlu yolda yalnızca `Decryption`'ın yükseltilmesi bile kullanıcı imzası kontrolünü düşürebilir [I, from V-P1]. Ele geçirilmiş bir gateway, token sözleşmesini kullanıcı olarak gösterip emekliye ayrılmış bir kullanıcı için bile `isAllowed(h, token)` kontrolünü geçebilir [V-05] |
| **Zama değişikliği** | **L0:** yok. ACL kontrolü eklenmez. **Yönetişim:** timelock gateway'in sahibi olur. **Operatör tarafı:** eski yolda kullanıcının sözleşmelerden biri olmadığının kontrolü, "kullanıcı olarak sözleşme" hilesini daraltır. **L3:** eski yolu emekliye ayırmak; main onu zaten kullanımdan kalkmış (deprecated) olarak işaretliyor [V-A3] |
| **Neden** | Gateway host zinciri durumunu göremez. Eski yolda kod-öncelikli doğrulama çalıştıramaz; E3'ü ya da PQ hesaplarını barındıramaz |

### 3.8 Yönetişim

| | |
|---|---|
| **Hedef** | Bir `TimelockController`, her yetkilendirme yolu sözleşmesinin ve işaretçisinin (pointer), ayrıca gateway sahipliğinin sahibidir. Gecikmeyi atlatan her doğrudan yürütme yolu kaldırılır. **Duraklatma (pause)** tek acil durum yetkisidir ve hiçbir zaman emekliliği ya da view'ları kısıtlamaz. **Gecikme:** en az 7 gün; hakları genişleten değişiklikler için 14 gün RECOMMENDED (açık soru 7, §10). **Son durum profili:** PQ imzacılar ve şifre çözme haklarını genişletebilecek her değişikliğin (kayıt sözleşmesi, KMSVerifier, gateway `Decryption`, ProtocolConfig, executor) en az n−t operatörce zincir üstünde onaylanması. Operatörler, onaylanmamış bir uygulamada kullanıcı şifre çözmesini durdurur. **Sürümlerden sağ çıkma:** sürüm kuralı, yükseltme koruması, kanarya, sabitleme (§5.4–§5.5). Profil Q'yu devreden çıkarmak hakları genişletmek sayılır. Çıkış penceresi kullanıcılara değil operatörlere (inceleme, ret, sabitleme) hizmet eder, çünkü kullanıcılar şifreli metin geçmişlerini geri çekemez |
| **Zama bugün** | Mainnet ACL sahibi, iki Multisig eklentisi (plugin) olan bir Aragon OSx DAO'sudur ve bunlardan herhangi biri tek başına yeterlidir: 3-of-6 EOA ya da 9-of-17 (12 EOA, sahipleri EOA olan 4 Safe, 1 Aragon DAO). Timelock yoktur [V-P1, read on-chain 2026-10-20]. Sepolia: 3-of-5 EOA [V-P1]. Gateway test ağı: 3-of-5 bir Safe artı LayerZero [V-P1]. `onlyACLOwner`; executor, KMSVerifier, InputVerifier, HCULimit, KMSGeneration, ProtocolConfig, köprü sözleşmeleri ve PauserSet için `ACL.owner()`'a çözümlenir; dolayısıyla tek bir sahip bütün host yığınını kapsar [V-A7]. Main'de ProtocolConfig, bir KMS bağlamını ancak her yeni düğüm ve en az n−t önceki düğüm teyit ettikten sonra oluşturur [V-A7] |
| **Zama değişikliği** | **Şimdi, ayrı bir talep olarak:** `ACL.owner()` ve gateway sahibi olarak bir timelock. **L0:** yükseltme koruması ve sürüm kuralı. **L3:** kanarya betikleri, PQ imzacılar (ML-DSA onayı başına yaklaşık 1,23M gas [M-P1]) ve ProtocolConfig örnek alınarak modellenen onay (ratification) |
| **Neden** | Sınır 3. Her yönetişim anahtarının açık anahtarı açığa çıkmıştır; bu yüzden yönetişim tek başına en büyük Q-günü hedefidir [I from V-P1]. Onay için gereken desen Zama'nın kodunda zaten mevcut [V-A7]. Bir eklenti daha olarak eklenen bir timelock, mevcut EXECUTE yetkisi sahiplerince atlatılırdı [I from V-P1] |

### 3.9 Uygulamalar (OpenZeppelin ERC-7984)

| | |
|---|---|
| **Hedef (Profil A)** | Kimliğe bağlı yetki verme yolları (gözlemci, operatör, yalnızca sahibin verebildiği izinler) emekliye ayrılmış bir hesap için revert eder; **temizleme ve geri alma (revoke) serbest kalır.** Gelen transferler asla engellenmez; giden transferler engellenmemelidir (SHOULD NOT). Bir token, emekliye ayrılmış hesaplara *giden* transferleri reddedebilir (MAY). Uygulamalar izin verdikten sonra asla `isAllowed(h, recipient)` assert'i yapmaz. Genel çağrı (generic-call) yolları yaşam döngüsü selector'larını reddetmelidir (SHOULD). `FHE.isAccountRetired(address)` uygulamalara dönük yardımcı fonksiyondur |
| **Zama ve OZ bugün** | ERC-7984 handle transferleri ve ifşa (disclosure) `FHE.isAllowed(h, msg.sender)` kontrolü yapar; bu yüzden Core onları hiçbir uygulama değişikliği olmadan kapatır [V-A7]. `_update`, `to`'ya izin verir ve sonrasında asla assert yapmaz [V-A7]. `setObserver` kimliğe bağlıdır ve gözlemciye her transferde yeniden izin verilir [V-A7]. Taze bir girdiyle çağrılan `ERC7984ERC20Wrapper.unwrap`, yakılan tutarı herkese açık olarak çözer ve bu da mevcut bakiyeyi ortaya çıkarır [V-A3] |
| **Zama ve OZ değişikliği** | **L2:** `FHE.isAccountRetired`, `Impl` ve `IACL` üzerinden, `FHE.isAccountDenied`'ın yanına konur (`library-solidity/lib/FHE.sol:8164`). Yerel bir OZ varyantı: `setObserver(account, X)`, `X != 0` ise ve hesap emekliye ayrılmışsa revert eder; `setOperator(op, until)`, `until >= now` ise ve çağıran emekliye ayrılmışsa revert eder (ERC-7984 operatörleri `now <= until` olduğu sürece geçerlidir; yani `until == now` da bir izindir; müzakeredeki `until > now` bunu kaçırıyordu [M-L2]); `_update` değişmez. Genel çağrı yolları yaşam döngüsü fonksiyonlarını ve çağıranı `msg.sender` olarak koruyan kayıt sözleşmesi `multicall`'ını reddeder [M-L2]. Upstream'de benimsenmesi bizim kontrolümüz dışındadır |
| **Neden** | Kimliğe bağlı yetki (`msg.sender == account`), bitin kapatamadığı tek kapıdır (sınır 2). Kapı asimetriktir: naif bir kapı, hırsızın eklediği bir gözlemcinin gelecekteki her tutarı okumaya devam etmesine yol açardı ve emekliye ayrılmış sahip onu temizleyemezdi [V-A7] |

### 3.10 Cüzdanlar ve saklama (custody)

| | |
|---|---|
| **Hedef** | **Hesaplar:** PQ ile doğrulanan; EOA'lar halefle emekliye ayırma yoluyla çıkar. **Zincir başına bir yetki paneli:** durum, halef, beyan edilmiş imzacı ve şeması, süresi dolacak yetki devirleri ve "bunu başka kim görebilir". **İlk kurulum (onboarding)** bir halef atar; kurumlar bir sertifikayı emanete verir (escrow). Yaşam döngüsü çağrıları, permit ve sertifika için **ERC-7730 açık imzalama tanımlayıcıları (clear-signing descriptors)**. **Teyit seviyeleri:** tek yönlü ya da yetki veren eylemler için kırmızı, sonradan eklenen yetki için kehribar. Yaşam döngüsü çağrıları cüzdana özgüdür (wallet-native); dApp kaynaklı olanlar varsayılan olarak engellenir. **Asla** "halefe gönder" seçeneği sunulmaz ve emeklilik asla bir dondurma ya da yaptırım gibi gösterilmez. Her emekliye ayırma ekranı üç sınırı sade bir dille belirtir. **Kullanıcı akışı:** envanter çıkarma ve dışa aktarma → uygulamalardan çıkış (gözlemciler, operatörler) → varlıkları yeni hesaba geçirme → taşıma → her host zincirinde, bir halefle emekliye ayırma |
| **Zama ekosistemi bugün** | Gösterilecek hiçbir şey yok. Sahiplerin yaklaşık %98'i ECDSA köklüdür [M-04]. 19 delege 403 yetki devredene hizmet veriyor, bunlardan biri 374'üne; süresi dolmayan 53 yetki devri olayı var [M-04]. Dfns ve Bron, Zama entegrasyonlarıdır [C, checked by reviewer 04]. Dfns cüzdanları EOA'dır ve incelenen saklayıcı (custodian) politika motorları hiçbir fonksiyon selector'ı ya da EIP-712 alanı kuralı belgelemez [C, fetched by A6 on 2026-10-21; not re-verified by the coordinator] |
| **Değişiklik (cüzdanlar, saklayıcılar, Zama SDK)** | **L2:** cüzdan rehberi (bilgilendirici), halef kullanıcı deneyimi (UX), taşıma sihirbazı. **L3:** sertifika UX'i ve saklama runbook'ları |
| **Neden** | Dışarıda kalma (lockout) korkusu benimsemenin başlıca engelidir. Oltalamayla (phishing) imzalatılmış bir yaşam döngüsü işlemi başlıca T1 riskidir. Anahtar seremonisi, anahtarın güvende olduğunun bilindiği andır |

**Saklama varsayılanları (A6, bilgilendirici):**
- P-1: yalnızca teyit edilmiş bir halefle ya da bir taşımayla aynı işlemde emekliye ayır.
- P-2: yaşam döngüsü çağrıları, joker ya da süresi dolmayan yetki devirleri, herhangi bir ACL izni, `setObserver`/`setOperator` ve sertifika imzalama için yeter sayı (quorum) iste.
- P-3: en fazla 7 günlük, listelenmiş sözleşmeler üzerinde ve oturum başına taze bir aktarım anahtarıyla permit'ler.
- P-4: halefi başka bir güvenlik alanında tut.
- P-5: hizmetten çıkarma, her yerde emekliye ayırmak demektir.
- P-6: ele geçirilme şüphesi, hemen taşı ve emekliye ayır demektir.
- P-7: hiçbir iş akışının üretmediği ACL olaylarında alarm ver.

**Hizmet delegeleri ve denetçiler:**
- müşteri başına bir delege anahtarı, süresi dolan yetki devirleriyle;
- rotasyon, kendini emekliye ayırma ve ardından yeniden yetki devridir;
- denetçiler süre sınırlı yetki devirleri alır (varsayılan ≤ 90 gün);
- gözlemciler, kısa ömürlü devredilmiş anahtarlarla okuyan akıllı hesaplar olmalıdır.

**Sabit sözlük**, her üründe aynı:

| EN | TR |
|---|---|
| Forget on this device | Bu cihazda unut |
| Revoke delegation | Yetki devrini geri al |
| Retire address | Adresi emekliye ayır |
| Successor | Halef |
| Retirement certificate | Emeklilik sertifikası |

Yardım sayfaları şunu ekler: "Emekliye ayrılmış adresler için bir geri yükleme hizmeti yoktur; bu türden her teklif dolandırıcılıktır."

### 3.11 Aktarım (transport)

| | |
|---|---|
| **Hedef** | Talep başına taze bir aktarım anahtarı, emeklilikte silinir. Herhangi bir PQ iddiası için: yanıt kanalında ve girdi şifreleme kanalında, **her ikisinde de**, bir FIPS 203 KEM'i ya da onu içeren bir hibrit. Talep bağlamına bağlanmış AEAD. Saklanan sonuçlara bir TTL ve yeniden sunmadan önce yeniden kontrol. Core aktarımdan bağımsız kalır. Zincir üstünde yayımlanan yanıtlar ML-KEM-768 ya da üstünü kullanmalıdır (SHOULD) (açık soru 10) |
| **Zama bugün** | Hibrit ML-KEM-512 + AES-256-GCM: AES anahtarı KEM sırrının ilk 32 baytıdır, 12 baytlık nonce rastgeledir ve ilişkili veri yoktur [V-P1]. Uygulamalar aktarım anahtarlarını kalıcı olarak saklayabilir ve birini 365 güne kadar yeniden kullanabilir [V-P1]. HTTP yolunda başarılı sonuçlar süresiz sunulur ve yeniden kontrol edilmez; gateway yollarında paylar herkese açık zincir üstü olaylarda yayılır [V-P1]. **Fhenix:** X25519 [V-A7]. **Inco:** brief'e göre ECIES girdileri (incelenmedi) |
| **Zama değişikliği** | **L2:** SDK prototipi (talep başına taze anahtar, emeklilikte silme); tasarım notu olarak saklanan sonuç TTL'leri. **L3 ve yol haritası:** KEM parametresi ve bağlam bağlama |
| **Neden** | Emeklilik, daha önce serbest bırakılmış payları geri çekemez; bunların gizliliği aktarım anahtarına dayanır. T2 altında, klasik şemalarla şifrelenip zincirde saklanan girdiler hiçbir oracle olmadan çözülür; bu yüzden bir PQ iddiası her iki kanalı da gerektirir [I] |

### 3.12 Hedefin host zincirinden varsaydıkları

Host zincirini değiştirmek bize düşmez, ama son durum ona bağlıdır (P8).
- **ECDSA dondurma.** Geçiş yapmamış bir EOA'dan gelen sahte ECDSA işlemlerini yalnızca host zinciri durdurabilir; yani zincir üstü kapıyı yalnızca o kapatabilir.
  - Profil Q'nun geçiş yapmamış hesaplar için koruma iddiası yalnızca bu dondurmanın var olduğu yerde geçerlidir.
- **Kurtarma.** Aynı adrese normal kod kuran yerinde kurtarma (EIP-8298 `SETCODEFROM` ya da tohum ispatlı (seed-proof) bir kurtarma [C]), Profil H en az n−t operatörde canlıya alındığında ERC-1271 üzerinden şifre çözmeyi geri getirir [I]. Yerel bir zincirde, EIP-8298 simüle edildiğinde, Profil H `enforce` benimsenen cüzdanın ML-DSA-44 imzasını kabul etti ve eski anahtarı reddetti [M-P5].
- **EIP durumu [C], A5'in 2026-10-21'de okuduğu haliyle:**

  | EIP | Durum |
  |---|---|
  | 7702 | canlı |
  | 7851 | Hegotá için reddedildi |
  | 8151 | dahil edilmesi değerlendiriliyor |
  | 8298 | dahil edilmesi değerlendiriliyor |
  | 8141 (çerçeve işlemleri, frame transactions) | planlandı |
  | 8355 (ML-DSA ön derlemeleri, precompiles) | Hegotá için reddedildi |
  | 8051, 8052 | taslaklar, listelenmemiş |

Faz 4 (§11.2, §11.4): simüle edilmiş bir EIP-7851 göstergesi, değiştirilmemiş doğrulayıcıların devre dışı bırakılmış anahtarı kabul etmesini durdurmadı; Amsterdam'ın durum oluşturma fiyatlandırması yerel bir zincirde ölçüldü.

Üç sınır host zinciri için de geçerlidir:
1. önleyicidir, geri alma değildir;
2. yalnızca oracle erişimini keser;
3. bulunduğu zincirin yönetişimi kadar kesindir; ayrıca ancak zincirin uzlaşması ve hesap kimlik doğrulaması kadar sağlamdır.

---

## 4. Aşamalı yol, Level 0 → Level 3

| Level | Ekledikleri | Ana bileşenler | Nerede çalışabilir | Bağlayıcılık eşiği | Korudukları | Açık bıraktıkları (başlıca maddeler) |
|---|---|---|---|---|---|---|
| **L0 Core** | View'larda emeklilik; doğrulayıcı ve oracle Core'u; `multicall` ile taşıma | ACL; testler; sürüm kuralı | konuşlu v0.13.x ve main | yükseltme bloğu (view'lar) | B1; emekliye ayrılmış hesaplar için B2 ve B4; her ACL ve vekil sözleşme dışa aktarması; yetki devirleri | emekliye ayrılmamış 7702 anahtarları, PQ hesapları, uygulama rolleri, halef olmadan dışarıda kalma, yönetişim |
| **L1 Profil H** | Kod-öncelikli sıralama, bütçe, tavanlar, sınırlı denemeler, kesin retler, eski yolun reddi | ortak crate; connector; relayer; SDK | main'in birleşik yolları | kısıtlayıcı kısımlar ≥ n−t; eklemeli kısımlar ≥ t+1 | 7702 kök anahtarı (delegenin onu reddettiği yerde); PQ ERC-1271 hesapları; eski yoldaki 8298 hesapları | kök anahtarı kabul eden 7702 delegeleri; ERC-7739 uyumluluğu |
| **L2 Süreklilik ve uygulamalar** | E1 halefi; Profil A; taşıma aracı; SDK hijyeni | ACL; kütüphane; OZ; SDK | her iki hat (E1); uygulamalar her yerde | view'lar (E1); benimseme (uygulamalar) | dışarıda kalma; geç gelenler (stragglers); hırsızın eklediği gözlemciler; aktarım anahtarının yeniden kullanımı | fark edilmeyen saldırgan atamaları; OZ'nin benimsemesi |
| **L3 PQ-yerel, Q, sertifikalar, yönetişim** | E3 KDA; Profil Q; E2; yönetişim profili | connector; SDK; ACL; operatörler; yönetişim; KMS; gateway | main (E3, Q); E1'in bulunduğu her yerde E2 | Q için ≥ n−t; yönetişim için onay | yerel maliyetle PQ yetkisi; ECDSA'nın kullanımdan kaldırılmasında zincir dışı kapı; çok zincirli emeklilik; T2'ye dayanıklı yönetişim | host dondurması olmadan zincir üstü kapı; denetlenmemiş kütüphaneler |

### 4.1 Level 0: konuşlandırılabilir Core

**Ekledikleri.** Core, üç kural kümesi artı taşımadır.

*Kayıt sözleşmesi (R1–R14):*

| Kural | İçerik |
|---|---|
| R1 Emekliye ayır | `retireAccount()`, `msg.sender`'ı emekliye ayrılmış olarak işaretler ve `AccountRetired(account, successor)` yayar. Halef, teyit edilmiş E1 halefidir ya da `address(0)`'dır. İkinci bir emeklilik `AccountAlreadyRetired(account)` ile revert eder |
| R2 Tek yönlü | Ayrıcalıklı olsun olmasın, hiçbir fonksiyon onu temizlemez |
| R3 Koşulsuz | Duraklatma, engel listesi, rol, ücret ya da varlık sahipliği koşuluna bağlı değildir. Sözleşmeler için de çalışır |
| R4 Hiçbir şey vermez | Emeklilik hiçbir hak oluşturmaz ya da genişletmez. E1 yalnızca, anahtar güvendeyken önceden taahhüt edilmiş bir halefi etkinleştirir |
| R5 Anında | İşlemin dahil edildiği bloktan itibaren her view için geçerlidir |
| R6 Her rol | Emekliye ayrılmış hiçbir hesap, hiçbir rolde, hiçbir yetkilendirme view'ını sağlamaz: kullanım; adına (yetki devreden, delege, **sözleşme**); permit (veren, **alıcı**). Tek istisna R10'dur; E1 ise yetki devreden durumunu değiştirir |
| R7 Yetki verme yolları revert eder | `allow`, herkese açma, motor dışındaki geçici izinler, toplu çağrılar ve yetki devri oluşturma, emekliye ayrılmış bir çağıran için revert eder; bunu `SenderRetired(caller)` ile yapmalıdır (SHOULD) |
| R8 Gelen izinler etkisizdir | Bir izin, alıcısı emekliye ayrılmış diye asla revert etmez |
| R9 Herkese açık şifre çözme değişmez | Emeklilik, herkese açılmış hiçbir şeyi asla yeniden kapatmaz |
| R10 Anlama dayalı motor muafiyeti | §3.2'de tanımlandığı gibi |
| R11 Yükseltmeler durumu ve uygulamayı korur | Özel bir ERC-7201 ad alanı (SHOULD). Bir UUPS kayıt sözleşmesi, hem ERC-165 Core desteğini hem de aynı emeklilik depolama konumunu bildirmeyen her yeni uygulamayı reddetmelidir (MUST). Diğer proxy desenleri aynısını kendi araçlarında uygulamalıdır (SHOULD) |
| R12 ERC-165 | `supportsInterface(0x556d2088)` true döndürür. Kimlik, `retireAccount()` `0xe7142996` XOR `isAccountRetired(address)` `0xb279091e`'dir [V-CV] |
| R13 Toplu çağrı | Çağıranı koruyan `multicall` (SHOULD); böylece ardından `retireAccount()` gelen izinler atomik olur |
| R14 Ham getter'lar | Canlılık göstergesi olarak belgelenen getter'lar emekliliği yansıtmalıdır (SHOULD). Hiçbir yetkilendirme ham getter'lara dayanmaz |

*Doğrulayıcı (V1–V7):*

| Kural | İçerik |
|---|---|
| V1 Serbest bırakma | İlgili her view karar anında, her özne için, handle'ın host zinciri kayıt sözleşmesinde true döndürmedikçe serbest bırakma yok, serbest bırakma amacıyla iletme yok ve pay yok. Hatalar, revert'ler ve zaman aşımları asla serbest bırakmaz |
| V2 Tazelik | View'lar talep geldikten sonra, beyan edilmiş bir gecikme sınırı içindeki bir blokta değerlendirilir. Hiçbir olumlu yanıt yeniden kullanılmaz |
| V3 Muafiyet taklidi yok | View'lar asla motor `eth_call` göndereni yapılarak değerlendirilmez |
| V4 Atlatma yok | Hiçbir imza şeması ya da yol V1'i atlatamaz: EOA, ERC-1271, beyan edilmiş imzacı ya da eski gateway yolu |
| V5 Replikalar | Replikalar yaşam döngüsü olaylarını uygular ya da yetkilendirme yapmaz |
| V6 Saklanan sonuçlar (SHOULD; H'de MUST) | Saklanan bir sonucu sunmadan önce V1'i yeniden uygula. Politikayı ICS belirtir |
| V7 Kesin retler (SHOULD; H'de MUST) | Bir emeklilik reddi kesindir ve `ACCOUNT_RETIRED` tipindedir; asla yeniden denenmez ya da diriltilmez |

*Oracle (O1–O3):* bkz. §3.6.

*Taşıma:* mevcut `ACL.multicall([allow(h_i, NEW)…, retireAccount()])`; önce izinler, parçalara bölünmüş olarak. Yeni fonksiyon yok.

**Bileşen başına gerektirdikleri.**

| Bileşen | Level 0 değişikliği |
|---|---|
| Kayıt sözleşmesi | **Zama:** main'de Core (0.7.0 → **0.8.0**, reinitializer 8 → 9, boş `reinitializeV8()`); v0.13 hattında (0.4.0 → **0.4.1**, 5 → 6, `reinitializeV5()`), `v0.13.8` etiketinin kaynağından derlenir; isteğe bağlı olarak v0.14 hattında (0.5.0 → **0.5.1**, 6 → 7, `reinitializeV6()`), `v0.14.2`'den derlenir. Paketin tamamı §5.1'dedir |
| Motor | Yok. Üç değişmez (invariant) testi |
| Doğrulayıcılar | Doğruluk için yok. Değişmeden uymaları beklenir [I]; Level 0 bunu göstermelidir |
| Relayer, SDK, KMS, gateway | Yok |
| Coprocessor host-listener | Bir sonraki yeniden derlemede `AccountRetired` için derleme zamanı match kolları (match arms). Eski ikili dosyalar bilinmeyen olayları atlar [V-A7] |
| Yönetişim | Sürüm kuralı, hat başına CI testleri ve yükseltme koruması (§5.4–§5.5) |
| OpenZeppelin ERC-7984 | Yok: `_update` içinde izin sonrası bir `isAllowed(h, recipient)` assert'i yoktur [V-A7]. Zama'nın örnek uygulamalarının bu tür assert'ler açısından hâlâ taranması gerekiyor |

**Önceki PR-1 spesifikasyonuna göre farklar** (`DESIGN_REVIEW.md` §6.2):
1. sözleşme rolü her iki devredilmiş view'da da denetlenir;
2. muafiyet anlama göre ve değişmez testleriyle tanımlanır;
3. `UpgradeDropsRetirement` ve `retirementStorageLocation()` getter'ı ile bir yükseltme koruması (ERC-165 artı depolama konumu);
4. ERC-165 `supportsInterface`;
5. yetki verme yolu başarısızlıklarında tipli bir `SenderRetired`;
6. yetki devri bitiş getter'ı emekliye ayrılmış taraflar için 0 döndürür;
7. backport `v0.13.8` etiketinden derlenir; isteğe bağlı bir 0.14 hattı hedefiyle birlikte;
8. mock ve connector testleri için kurallar.

§6.2'den değişmeyenler: ad alanı ve konumu, iki özgün fonksiyon ve selector'ları, olay, iki özgün hata, duraklatma kapısının olmaması, emeklilikten çıkarmanın olmaması ve sıfır yeni RPC.

**Korudukları** (her iki hatta, Core bloğundan itibaren):

| Kapı ya da bulgu | Etki |
|---|---|
| B1: kullanıcı emekliye ayıramaz | **Kapandı:** hesap kendini tek yönlü olarak emekliye ayırabilir |
| Emekliye ayrılmış bir hesap için zincir dışı kapı (B2, B4) | İmzası ne olursa olsun, emekliye ayrılmış anahtara dayanan her talep için **kapandı**: taze bir permit, bir ERC-1271 yanıtı ya da sonradan T2 ile sahtelenmiş bir ECDSA imzası. Bu, Q-gününden önce emekliye ayrılan hesaplar için T2'ye karşı önleyici korumadır [I from V-A7] |
| Zincir üstü kapı (B3): ACL yazmaları, `multicall`, `fromExternal(h, "")`, ERC-7984 handle transferleri ve ifşa, köprü `send` (main) | Emekliye ayrılmış hesap için **kapandı**: her dışa aktarma, o hesabı özne alarak `isAllowed`'a yeniden girer [V-A7] |
| Emekliye ayrılmış hesaptan ya da hesaba yetki devirleri | Her iki devredilmiş view'da **kapandı**; emekliye ayrılmış hesap yenilerini oluşturamaz |
| Sözleşme rolü | Emekliye ayrılmış bir sözleşme doğrudan ve devredilmiş yolda reddedilir |
| v0.13.8'de duraklatma sırasında yetki devirleri | Bu hatta geri alma (revocation) duraklatmaya bağlıdır [V-P1]. Emeklilik değildir; bu yüzden duraklatma sırasında da yetki devirlerini öldürür [I] |

**Açık bıraktıkları:**
- emekliye ayrılmamış bir 7702 hesabının kök anahtarı (L1);
- PQ hesapları (L1; konuşlu yolda ise hiç ERC-1271 yoktur);
- kimliğe bağlı uygulama rolleri (L2);
- bir hesap halefsiz emekliye ayrıldığında dışarıda kalma (L2);
- saklanan sonuçlar ve yeniden kullanılabilir aktarım anahtarları (L2);
- yönetişimin ve gateway'in ele geçirilmesi (L3);
- ele geçirilme sonrası yarış (sınır 1);
- zincir başına kapsam.

**Maliyetler:**

| Kalem | Değer |
|---|---|
| `retireAccount` | Osaka kurallarıyla yaklaşık 45–55K gas; Sepolia'nın mevcut ücret tablosuyla 120–140K [E] |
| ERC-7984 transferi | yaklaşık +2,1–2,8K gas, %0,7–0,9 [E] |
| Executor | main'de operand başına ≤ +100 gas, v0.13 hattında ≤ +140. Ölçülen +44–92 ve +114–137 [M-L0]; ilk ±25 hedefi tutmadı (bkz. §3.2) |
| Yeni RPC'ler | 0. Devredilmiş view'lar mevcut bir `eth_call` içinde bir SLOAD daha yapar |
| Taşıma | Osaka kurallarıyla handle başına 31.083 gas, Sepolia'da 119.201 [M-P1]; işlem başına yaklaşık 500 handle [E: ~538 under Osaka] |

**Planlanan kanıt.**

| Ortam | Gösterdiği | İddia etiketi |
|---|---|---|
| Foundry, Zama'nın `host-contracts/test/acl` dizininde | rol başına view'lar; yol başına bir dışa aktarma testi; değişmezler; vekil sözleşmeler; gelen izinlerin etkisizliği; tipli hatalar; ERC-165; duraklatma ve engel listesinden bağımsızlık; atomik taşıma sırası; yükseltme matrisi U1–U7 (§5.4); hiç emekliye ayrılmamış hesaplarda bayt düzeyinde aynılık; gas | — |
| anvil üzerinde Zama'nın açık metin (cleartext) mock'u | `persistAllowed` ve devredilmiş view üzerinden akış: hiç emekliye ayrılmamış bir kullanıcı şifre çözer; NEW, taşıma ve emekliye ayırmadan sonra geçmişi çözer; OLD reddedilir; OLD'dan ve OLD'a yetki devirleri reddedilir; emekliye ayrılmış bir sözleşme her iki yolda da reddedilir. Kurallar: `CleartextACL` 0.4.1 backport'unu miras alır; forge dışı bir KMS imzacı kümesi kullanılır; hiçbir assertion tam bitiş saniyesini sabitlemez | "proven in mock: views and flow; plaintext is public in the mock" ("mock'ta kanıtlandı: view'lar ve akış; mock'ta açık metin herkese açıktır") |
| Gerçek connector test düzeneği (harness): v0.13.8'de ve main'de değiştirilmemiş kms-worker, anvil üzerindeki gerçek ACL'ye karşı | emekliye ayrılmış bir kullanıcı, yetki devreden, delege ya da sözleşme KMS'ten önce reddedilir; hiç emekliye ayrılmamış bir kullanıcı iletilir; main'in birleşik girdileri doğru işlenir | "proven in real connector" ("gerçek connector'da kanıtlandı"). `isAllowed` yolunun kanıtlandığı tek yer burasıdır |

**Prototip durumu: tamamlandı; G2-mock kapısı GEÇTİ (2026-10-21).**
- **Foundry:** ACL testleri main'de 143/143, v0.13.8'de 128/128 geçti. Gas ölçümleri ve yükseltme matrisi
  `results/level0/LEVEL0_CONTRACTS.md` içinde.
- **Açık metin (cleartext) mock'u:** 3 koşuda 15/15 (`results/level0/MOCK_E2E.md`).
- **Gerçek connector:** değiştirilmemiş kms-worker, anvil üzerindeki gerçek Level 0 ACL'ye karşı çalıştırıldı
  (`results/level0/CONNECTOR_PROOF.md`):
  - v0.13.8'de 96/96 istek doğru sonuçlandı;
  - main'de 222/222 istek doğru sonuçlandı (eski yol ve RFC-016 dahil);
  - emekliye ayrılmış her kullanıcı, sahip, yetki devreden, delege ve sözleşme 0 KMS isabetiyle reddedildi;
  - her denemede `false` dönen view kayıtta görülüyor;
  - yeni RPC sıfır; hiçbir `eth_call` `from` taşımıyor.

Kaydedilen sapmalar:
- U5 hatası (D1);
- yürütücü (executor) sınırı (D2);
- değiştirilmemiş connector V7'yi karşılamıyor; bu, Level 0'da beklenen bir durum. Emekliye ayrılmış hesabın isteğini
  her yeniden denemede tekrar reddediyor: varsayılan ayarlarla yaklaşık 54 saniyede 20 deneme, tipsiz, 0 KMS
  isabetiyle [M-L0].

**Bu Level'daki sınırlar:**
1. **Önleyicidir, geri alma değildir.** Üçüncü taraflara verilmiş izinler, herkese açık handle'lar ve daha önce çözülmüş açık metin açıkta kalır.
2. **Yalnızca oracle erişimini keser.** Varlık yetkisi ve kimliğe bağlı uygulama rolleri anahtarda kalır.
3. **Bulunduğu zincirin yönetişimi kadar kesindir.** Emeklilik zincir başınadır. Koruma yalnızca kazara oluşan boşlukları (lapse) durdurur; yalan söyleyen bir uygulama ondan geçer.

### 4.2 Level 1: main'de imza hijyeni (Profil H)

**Ekledikleri.** Profil H; main'in birleşik yolları için bir doğrulayıcı profili. Yapılandırma varsayılanları:

| Anahtar | Varsayılan |
|---|---|
| `erc1271_execution_budget` (B_exec) | 2.000.000 |
| `max_user_signature_bytes` | 65.536 |
| `max_public_key_bytes` | 4.096 [E] |
| `max_extra_data_bytes` | 1.024 [E] |
| `max_erc1271_attempts` | 2 |
| `code_first_mode` | `off` → `shadow` → `enforce` |
| `refuse_regular_code_on_legacy` | false → true |

**Kurallar:**
1. **Herhangi bir RPC'den önce tavanlar.** Bir tavan ihlali kurtarılamaz (irrecoverable). 64 KiB, her FIPS 204 ve 205 imzasını kapsar (SLH-DSA-256f 49.856 bayttır) [C].
2. **Kod-öncelikli, tek bir B bloğunda.** `eth_getCode(user, B)` ve ERC-1271 çağrısı ikisi de B'de çalışır ve kod hiçbir zaman bloklar arasında önbelleğe alınmaz.
   - Boş kod: yalnızca 65 baytlık `ecrecover`.
   - Tam olarak 23 bayt `0xef0100 ‖ d` (EIP-7702): hesap üzerinde ERC-1271. `ecrecover`'a **yalnızca** çağrı *boş dönüş verisiyle başarılı olursa* ve imza 65 baytsa geri düş. Boş bir revert'te asla, çünkü gas tükenmesi (out-of-gas) de boş revert eder. Profil Q altında shim kapalıdır.
   - Diğer her kod: yalnızca ERC-1271.
3. **Bütçe:** `gas_limit = B_exec + 21,000 + 64 × len(calldata)`.
4. **Denemeler:** `WrongMagic`, `Rejected` ve `EmptyRevert` için, en az bir blok sonra, en fazla bir yeniden deneme. Üst seviyede gas'ın bitmesi de bir `EmptyRevert` sayılır; node'lar bunu revert verisi olmayan bir hata olarak bildirse bile. Aksi halde bu durum deneme sınırının dışında kalır [M-L1]. Aktarım (transport) hataları mevcut politikayı korur.
5. **Kesin emeklilik retleri:** bir ACL reddinde `isAccountRetired(subject)` çağrılır; true ise ret `ACCOUNT_RETIRED` ile kurtarılamaz olur.
6. **Eski yol:** host zincirindeki kodu normal kod olan kullanıcıları ya da delegeleri reddet; EIP-8298 durumu.
7. **Önce gölge (shadow):** uygulamaya geçmeden önce her iki kararı da hesapla, olası retleri kaydet ve etkisini yayımla. SDK, ERC-7739 cüzdanlarını `0x7739…` yoklamasıyla algılar ve imzalarını sarmalar.

**Bileşen başına gerektirdikleri.**

| Bileşen | Değişiklik |
|---|---|
| Ortak imza crate'i | `verify_signature` (`lib.rs:196-211`) ve `check_erc1271_signature` (`:123-186`) [V-A7] |
| Connector | yapılandırma (`config.rs:274-276`) |
| Relayer | eski relayer'ın zorunlu yapılandırması |
| SDK | `ERC1271_GAS_LIMIT` sabiti (`verifyErc1271UserDecrypt-p.ts:28`) |
| Üçü birden | connector'da, relayer'da ve SDK'da aynı değerler |
| Kayıt sözleşmesi, KMS, gateway | yok |

**Nerede çalışır.** Main'in birleşik yolları (P2/P3). Konuşlu gateway yolu zincir üstünde yalnızca-ECDSA'dır; bu yüzden Profil H ona ulaşamaz [V-A3].

**Korudukları:**
- **B_exec'e kadar PQ ERC-1271 hesapları.** 2M bütçe şunları kabul eder:
  - 1.232.720 gas ile Fireblocks ML-DSA-44 [M-P1];
  - 1.547.336 gas ile ETHFALCON [M-03];
  - yaklaşık 1,54M gas ile ZKNOX ML-DSA-65 [C].

  3.910.833 gas ile NIST Falcon'u kabul etmez [M-03]. Bugün ML-DSA-44 için yalnızca calldata, 250k tavanın %71'ini kullanır: Sepolia'nın ücret tablosunda 177.048 gas [M-03].
- Delegesi onu ERC-1271'de reddeden hesapların **7702 kök anahtarı** [I].
- En az n−t operatör normal koda sahip özneleri reddettiğinde, **eski yoldaki EIP-8298 ile geçiş yapmış hesaplar**.
- **Yeniden deneme DoS'u.** Operatör başına, talep başına en kötü durumdaki *yürütme* işi 20 × 250k = 5M'den 2 × 2M = 4M gas'a düşer [E].
- **Bir boşluktan sonra yeniden canlanma.** Kesin retler, sıradaki yeniden denemelerin bir yönetişim boşluğundan sonra yeniden canlanmasını engeller.

**Açık bıraktıkları:**
- **Tipik 7702 hesapları.** Delegeleri kök anahtarı kabul eder; OpenZeppelin'in `SignerEIP7702`'si de kabul eder [V-A7]. Kod-öncelikli doğrulama onlar için hiçbir şeyi emekliye ayırmaz; dolayısıyla onların koruması emekliliktir (L0).
- **Düz tipli veri (plain typed data) imzalayan ERC-7739 cüzdanları.** Hiçbir shim'in yakalamadığı yanlış bir sihirli değer (magic value) döndürürler [V-A7]. Gölge modu ve SDK sarmalaması bu durum için vardır.
- **Eski yol**, reddedilene kadar ECDSA kalır.
- **Kısıtlayıcı kısımlar** yalnızca n−t operatörde bağlayıcıdır.
- **Calldata muhasebesi**, deneme başına `gas_limit`'i, buna karşılık gelen bir hesaplama olmadan, B_exec'in çok üstüne, 64 KiB'lık bir imza için yaklaşık 4,2M fazlasına kadar itebilir [E].
- **Sözleşme hesaplarının** sözüne güvenilir. ECDSA sahipli bir Safe ERC-1271'den geçer; bir doğrulayıcı bir sözleşmenin içini göremez.

**Planlanan kanıt.** Level 1 mock'ta çalışmaz; mock'ta ERC-1271 yolu yoktur ve V2 uygulanmamıştır [V-A7]. Ortak crate ve connector test düzeneklerinde çalışır:
- bir ML-DSA-44 ERC-1271 hesabı (Fireblocks doğrulayıcısı) B_exec = 2M ile şifre çözer ve "calldata dahil 250k" ile başarısız olur;
- kod-öncelikli matris: boş kod; reddeden delegeli 7702; boş başarı → shim; boş revert → shim yok; `0xffffffff`; normal kod;
- gölge modunda ve enforce altında ERC-7739;
- herhangi bir RPC'den önce uygulanan tavan; calldata'yı dışarıda bırakan bütçe; en fazla 2 deneme; benzetimli bir boşluğun yeniden canlandıramadığı kesin bir emeklilik reddi; eski yolda normal kodun reddi;
- `eth_getCode` gecikmesi, ölçülmüş olarak.

**Prototip durumu: prototip için tamamlandı (2026-10-21); H7 açık.**
- **1. kısım: paylaşılan imza crate'inde H1–H4 ve H8** (`results/level1/PROFILE_H_CRATE.md`; dal `lifecycle/level1`).
  - 20 deterministik test her kuralın RPC sırasını sabitliyor.
  - Gerçek EVM'de (anvil, Osaka) matris tanımlandığı gibi davranıyor:
    - `enforce` modunda, delegesi reddeden (her şeyi reddeden ya da boş revert dönen) 7702 hesabı reddediliyor; oysa
      bugünkü doğrulayıcı ve `off` modu bu hesabın kök anahtarını kabul ediyor;
    - kök anahtarı kabul eden delegeler ve boş başarılı dönüş veren delegeler (shim üzerinden) çalışmaya devam ediyor;
    - shadow modu tam olarak yeni reddedilecek hesapları listeliyor;
    - ERC-7739 cüzdanına gelen düz typed-data imzası her sıralamada reddediliyor (artık risk).
  - ML-DSA-44 ERC-1271 hesabı bugünkü 250K sınırında reddediliyor, B_exec = 2M altında kabul ediliyor. Kabul eden en
    küçük B_exec 1.125.976 [M].
- **Gerçek EVM'de bulunup düzeltildi.** Üst seviyede gas'ı biten bir `isValidSignature`, node'dan veri taşımayan bir
  hata olarak dönüyordu; bu "taşıma hatası" sayıldığı için H4 sınırının dışında kalıyordu. Artık boş revert sayılıyor.
  H4 bunu açıkça yazmalı.
- **Ölçüldü: calldata payı artık riski.** 60 KB'lık bir imzada, B_exec 2M altında yürütmeye yaklaşık 4,9M gas kalıyor.
- **2. kısım: connector** (`results/level1/PROFILE_H_CONNECTOR.md`; commit `cce53bb`). Varsayılan olarak kapalı ve
  sıfır yeni RPC. VPS'te Level 0 ACL'ine karşı 27 istek [M]:
  - **H5 / V7:** emekli bir hesaba dayanan ret, her yolda ilk denemede kesinleşiyor ve `account_retired` tipini
    taşıyor. Benzetilmiş bir yönetişim boşluğu (lapse), Profil H kapalıyken emekli kullanıcının kuyruktaki isteğini
    diriltti; açıkken hiçbir şeyi diriltmedi;
  - **H6** eski yolda normal koda sahip kullanıcıyı reddediyor; 7702 delegesi kabul edilmeye devam ediyor;
  - **kod-öncelikli:** `enforce`, her şeyi reddeden 7702 kök anahtarını KMS'ten önce reddediyor; `shadow` bunu
    yalnızca logluyor.
  - clippy (`-D warnings`) ve rustfmt geçiyor.
- **3. kısım: H9, relayer ve SDK ön kontrolleri** (`results/level1/H9_PRECHECKS.md`; commit'ler `5b69260` SDK,
  `0eec675` relayer). İkisi de doğrulayıcının politikasını alıyor, varsayılan olarak kapalı:
  - SDK, gerçek EVM'de Zama'nın ethers adaptörüyle: ML-DSA-44 hesabı bugünkü 250K sınırında reddediliyor, politikayla
    kabul ediliyor (çağrı gas'ı 2.183.048); `enforce` altında her şeyi reddeden 7702 kök anahtarı reddediliyor,
    `shadow` bunu logluyor [M];
  - relayer: v3 ön kontrolünde ortak crate'in Profil H doğrulaması, kendi yeniden deneme kuralı korunarak; VPS'te ön
    kontrol ve ayar testleri 59/59, bütün birim testlerinden 281'i geçti (1'i Zama'da yoksayılmış); Zama'nın
    `make clippy` hedefi (`-D warnings`) ve rustfmt geçiyor [M].
- **Açık:** H7 (saklanan sonuçların yeniden kontrolü).

**Bu Level'daki sınırlar:**
1. **Önleyicidir, geri alma değildir.** Hijyen, bundan sonra kimin talep edebileceğini değiştirir; serbest bırakılmış olanı değil.
2. **Yalnızca oracle erişimini keser.** Bir 7702 hesabının kök anahtarı zincir üstünde hâlâ hareket eder.
3. **Bulunduğu zincirin yönetişimi kadar kesindir.** Bunlar düğüm kurallarıdır; dolayısıyla n−t operatörde ve yalnızca operatörler onları sürdürdüğü sürece bağlayıcıdır.

### 4.3 Level 2: süreklilik ve uygulamalar

**Ekledikleri.**

**(a) E1, halef.** İsteğe bağlı; ERC-165 `0x7dc5e209`, isteğe bağlı bir gecikme alt arayüzüyle birlikte: `0xc61ca396`.
- **Yaşam döngüsü:** hesap atar → halef kendi işlemiyle kabul eder (**zorunlu**) → hesap `confirmableAt` anında ya da sonrasında teyit eder → atama kilitlenir.
- **D:** kayıt sözleşmesi genelinde en az 7 gün (RECOMMENDED: 7). `confirmableAt` atama anında sabitlenir. Hesap başına, yalnızca artırılabilen bir D'ye izin verilir (MAY); üst sınırı 365 gündür.
- **Kilitli**, eski anahtarın teyit edilmiş bir halefi ne değiştirebileceği ne de iptal edebileceği anlamına gelir. Onu yalnızca halef, herhangi bir zamanda feragat ederek temizler.
- **Emeklilikte dondurulur:** bekleyen bir atama geçersiz kılınır. Sonrasında atama, kabul, teyit ya da iptal mümkün değildir; feragat ise hâlâ mümkündür.
- **Okuma hakkı, yalnızca emeklilikten sonra:** (account, successor, contract, handle) için adına (on-behalf) view'ları, tam olarak etkin bir joker yetki devrinin yanıtlayacağı gibi yanıt verir. Diğer her delege false alır.
- **Yalnızca adına çözme (decrypt-as):** kullanım, izin verme, herkese açma ya da hesaplama yok; geçişlilik de yok.
- **Asla anahtardan türetilmiş bir adres değildir**, çünkü bir KDA kabul edemez. İstemciler bir halefi ödeme adresi ya da yönlendirme hedefi olarak ele almamalıdır (MUST NOT) ve bekleyen atamaları görünür kılmalıdır (MUST).

| Fonksiyon | Çağıran | Duraklatmaya bağlı | Etki |
|---|---|---|---|
| `designateSuccessor(s)` | hesap | evet | bekleyen her atamanın yerini alır; `confirmableAt = now + effective D` |
| `acceptSuccession(account)` | bekleyen halef | evet | atamayı kabul edilmiş olarak işaretler; taraflardan hiçbiri emekliye ayrılmış olamaz |
| `cancelSuccessorDesignation()` | hesap | hayır | yalnızca bekleyen atamalar |
| `confirmSuccessor()` | hesap | evet | kabul, `now ≥ confirmableAt` ve emekliye ayrılmamış bir halef gerektirir; halefi kilitler |
| `resignSuccession(account)` | teyit edilmiş halef | hayır | herhangi bir zamanda, emeklilikten sonra da |
| `raiseSuccessorDelay(d)` | hesap | hayır | geçerli D'yi kesin olarak artırır; en fazla 365 gün |

**(b) Profil A:** `FHE.isAccountRetired`, artı asimetrik gözlemci ve operatör kapılarına sahip yerel bir OZ ERC-7984 varyantı (§3.9).

**(c) Taşıma aracı:**
1. zincir başına `Allowed(caller, account, handle)` olaylarını listele; `account` olayda indekslidir [V-A3];
2. `persistAllowed(h, OLD)` koşulunu sağlayan handle'ları tut; spam'i bir sözleşme izin listesi (allowlist) ve mevcut bakiye handle'larıyla filtrele;
3. `--dry-run` sözleşme başına bir döküm ve tam listeyi yazdırır;
4. son parçası `retireAccount()` ile biten, parçalara bölünmüş bir `multicall([allow(h_i, NEW)…])` gönder;
5. `isAccountRetired(OLD)`'u ve NEW'in taşınan her handle üzerinde `persistAllowed`'a sahip olduğunu doğrula.

**(d) SDK hijyeni:**
- talep başına taze bir aktarım anahtarı;
- emeklilikte aktarım anahtarlarının ve permit'lerin silinmesi;
- tipli bir `ACCOUNT_RETIRED` hatası ve `getAuthorityStatus(address, chains)`;
- saklanan sonuç TTL'leri, yalnızca tasarım notu olarak.

**Bileşen başına gerektirdikleri.**

| Bileşen | Değişiklik |
|---|---|
| Kayıt sözleşmesi | E1 depolaması `ACLRetirementStorage` içine eklenir (iki slotluk bir `Succession` struct'ı ve `successorDelayOf`); her iki devredilmiş view'ın yetki devreden durumu halef için değiştirilir; `retireAccount()` bekleyen her atamayı geçersiz kılar ve `AccountRetired(account, confirmed)` yayar. Prototip sürümleri: main 0.9.0, reinitializer 10; backport 0.4.2, reinitializer 7. İkinci bir üretim backport'undan önce, reinitializer'ları kesin olarak artan bir sürüm planı gereklidir |
| Solidity kütüphanesi | `FHE.isAccountRetired` |
| OpenZeppelin | Profil A kapıları (yerel varyant) |
| SDK | taşıma aracı, aktarım hijyeni, durum ve hatalar, halef için "adına çöz" |
| Doğrulayıcılar | yok: halef devredilmiş view'lar üzerinden okur |
| Kısıt | Konuşlu P1d yolunda halef bir ECDSA EOA'sı olmalıdır, çünkü gateway delegenin ECDSA imzasını doğrular [V-A7]. Main'de akıllı hesap bir halef önerilir, çünkü kendi sahiplerini kendisi rotasyona sokar |

**Korudukları:**
- Hazırlıklı hesaplar için, hırsızın önce davrandığı ya da oltalamayla yaptırılan bir emeklilikten sonra **dışarıda kalma**.
- **Geç gelenler (stragglers):** emeklilikten sonra gelen handle'lar.
- **Delege anahtarı rotasyonu.** Mainnet'te tek bir delege anahtarı, yetki devreden 403 hesabın 374'üne hizmet ediyor [M-04].
- Emekliye ayrılmış hesabın temizleyebildiği ve kimsenin yeniden ekleyemediği **hırsızın eklediği gözlemciler**.
- **Süreklilik:** taşıma ile O(n) bir anlık görüntü (snapshot), artı halef ile O(1).
- **Aktarım anahtarının yeniden kullanımı.**

**Maliyet:**
- Medyan bir taşıma yaklaşık 0,40M gas'tır [E] (medyan sahip: 12 handle [M-04]).
- Taşıma, ECDSA köklü sahiplerin %99,9'undan fazlası için tek bir işleme sığar [E].
- İşlem başına sınırın üstündeki 41 hesabın 33'ü sözleşme, 8'i ECDSA köklüdür [M-04].

**Açık bıraktıkları:**
- saldırgan tarafından kabul edilen ve fark edilmeden geçen D günün ardından teyit edilen bir saldırgan ataması emeklilikten sağ çıkar;
- bir hırsız *bekleyen* atamaları değiştirmeyi sürdürebilir; güvenli yanıt, hemen taşıyıp emekliye ayırmaktır;
- konuşlu yolda bir ECDSA-EOA halefini kaybetmek kesindir;
- geçişlilik yok; bu yüzden denetçiler taşımaya dayanır;
- OZ'nin benimsemesi bizim kontrolümüz dışındadır;
- `Allowed(OLD, NEW, h)` ve `AccountRetired(OLD, S)` kimlikleri herkese açık biçimde ilişkilendirir.

**Planlanan kanıt:**
- **Foundry:** tam durum makinesi; eski anahtara karşı kilitli; geçişlilik yok; emekliye ayrılmış bir halef başarısız olur; halef `allow` yapamaz, herkese açamaz ya da hesaplama yapamaz; kabul edilmemiş bir atama teyit edilemez; emeklilikle geçersiz kılınmış bir atama hiçbir şey sağlamaz; bir KDA halef olamaz. Assert edilen artık risk: fark edilmeyen bir saldırgan ataması emeklilikten sağ çıkar.
- **Mock:** `plaintextForDelegatedUserDecryption(OLD, S)` geçmiş ve geç gelen handle'ları okur.
- **Connector test düzeneği:** ECDSA-EOA halefli eski devredilmiş yol; main'in birleşik yolu.
- **Uygulamalar:** hırsızın eklediği bir gözlemci emekliye ayrılmış hesap tarafından temizlenir ve yeniden eklenemez; emekliye ayrılmış bir hesaba ve hesaptan transferler başarılı olur; değiştirilmemiş (vanilla) varyant mevcut bakiyeyi ve gelecekteki tutarları hâlâ sızdırır (assert edilen artık risk).
- **Gas**, atama, kabul, teyit ve halefle emekliye ayırma için ölçülür.

**Prototip durumu: prototip için tamamlandı (2026-10-21).**
- **(a) E1 her iki hatta da tamamlandı** (`results/level2/LEVEL2_E1.md`): main'de ACL v0.9.0, v0.13 hattında ACL v0.4.2.
  - Foundry'de 188/188 ve 173/173 test geçti. Bunların içinde 41 E1 testi (TC17) ve test edilip doğrulanmış TC18
    artık riski var.
  - OZ depolama düzeni doğrulaması ve Zama'nın CI sürüm kontrolü geçti.
- **Gerçek connector'da değişiklik gerekmiyor.** Halef, değiştirilmemiş delegated yol üzerinden okuyabiliyor:
  v0.13.8'de 8/8, main'de 13/13 istek doğru sonuçlandı. Buna RFC-016 delegated girdisi ve emeklilik sonrası verilen
  bir handle (straggler) da dahil. Diğer tüm delegeler reddedilmeye devam ediyor.
- **Gas [M]:** designate 62.014; accept 40.074; confirm 57.188; `retireAccount` +4.365 (54.464).
- **Boyut bulgusu.** v0.13 hattının optimizer'sız varsayılan Foundry profili artık EIP-170 sınırına sığmıyor: 25.236 B,
  sınırın 660 B üstünde. Üretim ayarlarıyla 14.290 B.
- **(b) Profil A main'de tamamlandı** (`results/level2/PROFILE_A.md`): kütüphanede `FHE.isAccountRetired` ve yerel
  bir OpenZeppelin ERC-7984 varyantı. TC23, Profil A'sız varyantların yanında 15/15 geçiyor.
  - **Düzeltme:** operatör kapısı `until >= now` olmalı; ERC-7984 operatörleri `now <= until` olduğu sürece
    geçerlidir.
  - **Düzeltme:** A4, kayıt sözleşmesinin çağıranı koruyan `multicall`'ını da reddetmeli.
  - **Bulgu:** genel çağrı yolu, sözleşmesini kendi seçtiği bir halefe de devredebiliyor.
  - **Gas [M]:** kayıt sıcakken kapıların maliyeti 7.781 (`setOperator`) ve 3.809 (`setObserver`).
  - **Faz 4 düzeltmesi:** kayıt soğukken, yani işlemin ona ilk dokunuşunda, `setOperator` kapısı Osaka'da +12.804 gaz
    tutar. forge 1.8.5'in `vm.cool`'u hesapları sıcak bırakmıştı (`results/phase4/P2_4_AMSTERDAM.md` §6).
- **(c) Taşıma aracı tamamlandı** (`results/level2/CARRY_TOOL.md`; `impl/carry-tool/carry.mjs`). anvil'de 426
  handle'dan beklenen 121'ini taşıdı; spam'i ve eskimiş bakiyeleri atladı. Ortasına sokulan bir hatadan sonra
  eski hesabı aktif bıraktı ve yeniden çalıştırınca kaldığı yerden tamamladı. Gas [M]: handle başına 31.386;
  Osaka tavanı altında işlem başına en fazla 532 handle.
- **(d) SDK hijyeni tamamlandı** (`results/level2/SDK_HYGIENE_AND_MOCK.md`), Zama'nın SDK kaynağında iki hatta da:
  - tipli `ACCOUNT_RETIRED` reddi;
  - `getAuthorityStatus`. Faz 4'ten beri hesabın kodunu da bildiriyor: kod yok, EIP-7702 ile devredilmiş,
    EIP-7851 ile devredilmiş ve ECDSA anahtarı kapatılmış, ya da başka kod [M-P4];
  - istek başına tek transport anahtarı; bırakılınca sıfırlanıyor, emeklilikte hesabın izinleriyle birlikte
    siliniyor.
  - 19 yeni birim testi; SDK paketlerinin tamamı geçiyor (914/914 ve 918/918).
- **E1, Zama'nın cleartext mock'unda SDK üzerinden uçtan uca çalışıyor:** 7/7 senaryo testi, üç koşu. Halef
  emeklilikten sonra okuyor; buna emeklilik sonrası verilen handle da dahil. Emeklilikten önce reddediliyor. Diğer
  herkes relayer'dan önce tipli reddi alıyor.

**Bu Level'daki sınırlar:**
1. **Önleyicidir, geri alma değildir.** Halef, hesabın çözebildiğini devralır; sızmış hiçbir şeyi geri kazanmaz.
2. **Yalnızca oracle erişimini keser.** Halef okur; varlıklar ve uygulama rolleri hâlâ sıradan transferler ve uygulama çağrılarıyla hareket eder.
3. **Bulunduğu zincirin yönetişimi kadar kesindir.** Halef, zincir başına, aynı yükseltilebilir kayıt sözleşmesinde yaşar.

### 4.4 Level 3: PQ-yerel yetki, yalnızca-PQ profili, emeklilik sertifikası, yönetişim

**Ekledikleri:** aşağıda (a)–(d) altında açıklanan E3, Profil Q, E2 ve yönetişim profili.

**(a) E3, beyan edilmiş şifre çözme imzacısı (KDA).**

*Kodlama:*
- ERC-7913 düzeninde `signerBytes = verifierId (20 bytes) ‖ publicKey` (ERC-7913 Final durumundadır [C]).
- `KDA = address(uint160(uint256(keccak256("ERC-XXXX key-derived decryption signer v1" ‖ signerBytes))))`. Etiket geçicidir.
- `verifierId`, yerel bir şema için ayrılmış, yine geçici bir tanımlayıcıdır: `address(uint160(uint256(keccak256("ERC-XXXX native scheme:" ‖ name))))`; örneğin "ML-DSA-44" için.

*Beyan etme ve kullanma:*
- Hesap, imzacıyı kendi `delegateForUserDecryption(KDA, contract | WILDCARD, expiry)` çağrısıyla beyan eder.
- Bir talep her girdide `userAddress = KDA`, `ownerAddress = account` ve `signature = abi.encode(signerBytes, sig)` kullanır.
- Doğrulayıcı bu rotayı yalnızca şu durumlarda izler:
  - karar bloğunda `code(KDA)` boşsa;
  - imza 65 bayt değilse ve ayrıştırılabiliyorsa;
  - türetilen KDA `userAddress`'e eşitse;
  - her girdide `ownerAddress ≠ userAddress` ise.

*Doğrulama:*
- Yerel; boş bağlamla, aynı EIP-712 özeti üzerinde. Başarısızlık, `ecrecover`'a ya da ERC-1271'e geri düşmeden, kurtarılamaz biçimde reddeder.
- Şemalar: FIPS 204 ML-DSA-44/65/87 ve FIPS 205 SLH-DSA; SHA2 kümeleri tercih edilir. FN-DSA'ya ancak FIPS 206 nihai hale geldiğinde izin verilir.
- Vektörler: ACVP sigVer ve Wycheproof.
- Bir kütüphane hatası t+1 düğüme ulaşmamalıdır: ya iki bağımsız uygulama uyuşmalıdır ya da hiçbir uygulama t+1 ya da daha fazla düğümde çalışmamalıdır.

*Kurallar:*
- bağımlıdır: onu yalnızca hesap oluşturur;
- emeklilikle ve geri almayla (revocation) ölür;
- yalnızca devredilmiş girdiler; asla doğrudan sahip değil ve asla halef değil;
- `WithSig` yolu yok; sözleşme doğrulayıcıları yok, dolayısıyla sabitlenecek bir şey yok;
- cüzdanlarda varsayılan olarak sonlu bir bitiş süresi;
- Profil Q altında B_Q kuralı;
- yalnızca main'in birleşik yolu. Gateway'in delegenin 65 baytlık ECDSA'sını doğruladığı konuşlu yolda imkânsızdır [V-A7].

*Sayılar [M-A5]:*

| Kalem | Süre |
|---|---|
| KDA yolunda ML-DSA-44, türetme kontrolü dahil | 84–89 µs |
| ML-DSA-44, soğuk | 82–85 µs |
| `ecrecover`, k256 yolu (Zama'nın mevcut uygulaması) | 177–213 µs |
| `ecrecover`, libsecp256k1 | 53–55 µs |
| ML-DSA-65 / ML-DSA-87 (KDA yolu) | 133–142 µs / 221–264 µs |
| SLH-DSA-SHA2-128s / -128f | 150–157 µs / 402–411 µs |
| SLH-DSA-SHAKE-128f (SHA2'den 10× yavaş) | 4,5–4,7 ms |
| RustCrypto `ml-dsa` 0.1.1, Wycheproof ML-DSA-44'e karşı | 180 vektörün 180'inde uyuşur |

ERC-1271 yolu yaklaşık 4,5–5 ms EVM süresi alır [E]. Bundan ayrı olarak, yukarıdaki süre tablosu yerel PQ doğrulamasının Zama'nın k256 `ecrecover` yolundan daha ucuz olduğunu, ama genel olarak optimize edilmiş bir ECDSA'dan (libsecp256k1) daha ucuz olmadığını gösteriyor [M-A5].

**(b) Profil Q, yalnızca-PQ operatör profili.**
- **Tetikleyici.** En az n−t operatör taahhüt eder, ardından duyurulmuş bir B_Q bloğunda birlikte etkinleştirir. Sinyal, PQ imzalı operatör beyanları artı ICS'tir. Zincir üstü bir kayıt bilgilendiricidir; asla tetikleyici değildir ve asla ECDSA yönetişimi değildir.
- **Ön koşullar**, hepsi birlikte:
  1. Profil H, E3 rotası (uygunluk kanıtı ve denetlenmiş bir kütüphaneyle) ve eski yolun reddi, en az n−t operatörde canlıda;
  2. eşiği önceden sabitlenmiş, yayımlanmış bir hazırlık KPI'ı;
  3. belirtilmiş bir kurtarma yolu;
  4. yerinde bir timelock ve uygulama sabitleme;
  5. önce taahhüt, sonra etkinleştirme prosedürü.
- **Bildirim süresi:**
  - Planlı: en az 24 ay ve asla host zincirinin kendi ECDSA devre dışı bırakmasından sonra değil.
  - Acil etkinleştirme yalnızca (i) host zincirinde ECDSA'nın devre dışı bırakılmasında ya da (ii) secp256k1'e karşı bir CRQC'ye dair, en az n−t operatörün PQ imzalı beyanlarla ilan ettiği güvenilir kamusal kanıt durumunda.
- **PQ iddiası.** Bir FIPS 203 yanıt KEM'i ya da onu içeren bir hibrit **ve** PQ girdi şifrelemesi gerektirir.
- **İddia sınırı.** ECDSA işlemlerini hâlâ kabul eden bir host zincirinde, geçiş yapmamış ECDSA hesapları için hiçbir koruma iddiası yoktur.
- **Devreden çıkarma** hakları genişletir; bu yüzden yönetişim kuralına tabidir.
- **Kurtarma:**
  1. B_Q'dan önce hazırlanmış: teyit edilmiş bir PQ halefine emekliye ayırmak; B_Q'dan önce yapılmış bir KDA yetki devrini elde tutmak; ya da bir PQ hesabına taşımak;
  2. normal kod kuran host zinciri kurtarması, ERC-1271 üzerinden; bunun için etkinleştirmeden önce Profil H gerekir;
  3. bir dondurmadan sonra iletilen, önceden imzalanmış bir E2 sertifikası. Sertifikanın `ecrecover`'ı bir işlem değil, bir ön derleme (precompile) çağrısıdır; bu yüzden uyuyan halef hiçbir ECDSA işlemi olmadan uyanır [I];
  4. aksi halde ne erişim ne sızıntı (fail-closed). Destek masası üzerinden dondurmanın kaldırılması da, yalnızca sağlayıcının yapabildiği bir kurtarma da yoktur: ikisi de bir arka kapı olurdu.

| Yol ya da imzacı | Profil Q altında |
|---|---|
| Eski ECDSA gateway yolu (P1/P1d) | doğrudan reddedilir |
| Kodsuz imzacı | reddedilir |
| `0xef0100 ‖ d` (7702) imzacısı | reddedilir; ERC-1271 çağrısı yok; shim kapalı |
| Normal kodlu ERC-1271 hesabı (8298 ile benimsenmiş kod dahil) | "no-root-ECDSA" (kökte ECDSA yok) varyantında kabul edilir (hesabın beyanına dayanır: ECDSA sahipli bir Safe geçer); "strict" (katı) varyantta reddedilir |
| Normal kodlu bir yetki devredenin KDA'sı | kabul edilir |
| ECDSA köklü bir yetki devredenin KDA'sı | yalnızca en son B_Q'da ya da öncesinde yazılmışsa kabul edilir (iddia bir host dondurmasına bağlıdır) |
| Devredilmiş talepler | delegenin kendisi de nitelikli olmalıdır; B_Q kuralı ECDSA köklü yetki devredenlere uygulanır |
| Emekliye ayrılmış bir hesabın teyit edilmiş halefi | kendisi de nitelikli olmalıdır |
| Emekliye ayrılmış özne (herhangi bir rota) | reddedilir (Core) |
| Herkese açık şifre çözme | değişmez; KMS yanıt imzaları hâlâ ECDSA'dır (B7) |
| Sahte ECDSA işlemleriyle zincir üstü kapı (`allow`, yetki devri, herkese açma) | **host zinciri ECDSA'yı dondurana kadar açık** |

**(c) E2, emeklilik sertifikası.** İsteğe bağlı; ERC-165 `0x4b9ec076`.
- **Biçim.** EIP-712 `RetireAccount(address account,address successor,uint256[] chainIds)`; tip özeti (type hash) `0xf224379ad7473578295885cb7fd6795dbf8c4d718c2bd07d70c8f1e5ecaac54b` [V-CV]. Alan (domain) `EIP712Domain(string name,string version)` = ("DecryptionAuthorityLifecycle", "1"): zincirden bağımsızdır; kapsamı `chainIds` belirler.
- **Giriş noktası.** `retireAccountWithSig(account, successor, chainIds, signature)` çağrısını herkes gönderebilir. Kontroller şu sırayla çalışır:
  1. emekliye ayrılmamış olmalı (`AccountAlreadyRetired`);
  2. `block.chainid ∈ chainIds` (`CertificateWrongChain`);
  3. `successor != 0 && successorOf(account) == successor` (`CertificateSuccessorMismatch`);
  4. `SignatureChecker.isValidSignatureNow` (`InvalidRetirementCertificate`). Bu kod-önceliklidir: kod yoksa 65 baytlık low-s ECDSA imzası; herhangi bir kod varsa shim olmadan ERC-1271.
- **Etkileri:** `retireAccount`'unkilerle aynıdır.
- **Asla yapmadıkları:** halef atamak, teyit etmek ya da değiştirmek veya herhangi bir izin vermek. Nonce'u, bitiş süresi ve anahtar tarafından iptali yoktur; duraklatılamaz.
- **Boyut:** bir ya da iki zincir için yaklaşık 200–300 bayt [E].
- **Yardımcı olduğu yerler:**
  - tek bir seremoniden çok zincirli emeklilik;
  - kaybolmuş bir anahtar;
  - sağlayıcıdan bağımsız saklama runbook'ları;
  - bir dondurmadan sonra iletme (relay);
  - zincir üstü ele geçirilme sinyallerini planlı devir teslime dönüştürmek. Sinyaller: hesabın beklenmedik bir `Allowed`'ı, joker ya da süresi dolmayan bir yetki devri ya da bir gözlemci değişikliği;
  - protokol gerilemelerini (regression) izlemek.
- **Yardımcı olmadığı yerler:**
  - bir hırsızlıktan sonra geçmişi korumak: zincir dışı permit'ler işlem gerektirmez ve bir şifre çözme saniyeler içinde tamamlanır (Sepolia'da 2,5–12,6 sn [M-P1]);
  - mempool yarışları, çünkü her iki taraf da özel emir akışı (private order flow) kullanabilir;
  - bir "kuantum watchtower'ı" (gözetleme kulesi), çünkü bir CRQC sessizce toplar.

**(d) Yönetişim profili.**
- **Demo:** bir OZ `TimelockController`, demoda en az 7 günlük gecikmeyle, yerel bir ACL proxy'sinin sahibidir. Ardından `ACLOwnable` üzerinden executor'ı, KMSVerifier'ı ve ProtocolConfig'i kontrol eder.
- **Koruma:** yükseltme timelock üzerinden geçse bile Core içermeyen bir yükseltmeyi engeller.
- **Kanarya:** her `Upgraded` olayında ve periyodik olarak, her operatör bilinen bir emekliye ayrılmış hesabı ve bilinen bir izinli handle'ı kontrol eder:
  - `isAccountRetired` true'dur;
  - `isAllowed` ve `persistAllowed` false'tur;
  - emeklilikten önce oluşturulmuş bir yetki devri için devredilmiş view false'tur.

  Bir uyumsuzlukta operatör o zincir için kullanıcı şifre çözmesini durdurur. Maliyet çalıştırma başına 6 RPC çağrısıdır: 4 view, artı sabitleme için 2 okuma [M-L3]. Kural kısıtlayıcı olduğundan n−t operatörde etkilidir.
- **Sabitleme**, kanaryanın yakalayamadığını yakalar: kanaryalara dokunmayan kötü niyetli bir yükseltme. Sabitleme **dağıtılmış uygulama** başınadır (adres ve çalışma kodu hash'i) ve timelock gecikmesi içinde onaylanır. Yalnızca bytecode ile sabitleme işe yaramaz: bir UUPS uygulaması kendi adresini (`__self`) koduna gömer, bu yüzden aynı kaynağın her dağıtımının kod hash'i farklıdır [M-L3]. Alternatif, immutable'ları maskeleyerek karşılaştırmaktır.
- **Son durum notu:** ML-DSA onayı başına yaklaşık 1,23M gas ile PQ imzacılar [M-P1]; ProtocolConfig deseninde n−t onayı; değiştirilemez (immutable) bir kayıt sözleşmesinin neden ertelendiği (§6, D7).

**Level 3'ün bileşen başına gerektirdikleri.**

| Bileşen | Değişiklik |
|---|---|
| Ortak crate ve connector | `verify_signature` içinde ERC-1271 geri düşüşünden önce eklenen KDA rotası; Profil Q yapılandırması: `pq_only = off \| committed(B_Q) \| active(B_Q)` ve `variant = no_root_ecdsa \| strict`; sabitleme |
| SDK | KDA talebi oluşturma; sertifika oluşturma; `retireEverywhere()` |
| Kayıt sözleşmesi | E2; isteğe bağlı olarak B_Q getter'ı; sahip olarak bir timelock |
| Operatörler | PQ imzalı taahhüt beyanları; hazırlık KPI'ı; kanarya; onay |
| KMS | uçtan uca kullanılan ML-DSA yanıtları; bir yanıt KEM'i seçeneği (Zama'nın yol haritası) |
| Gateway | eski yol emekliye ayrılmış; timelock'lu bir sahip |
| Watchtower | sertifikaları listelenen zincirlere ileten bir referans betik |

**Korudukları:**
- **E3:** bir PQ akıllı hesabı konuşlandırmadan, mevcut bir adres için yerel maliyetle PQ yetkisi. İlk ML-DSA-44 akıllı hesabı Osaka kurallarıyla 14,6M gas, Sepolia'da 104,9M gas tutar [M-P1]. E3 ayrıca en az yetki sağlar: sıcak (hot) bir şifre çözme anahtarı ve soğuk (cold) bir kök.
- **Profil Q:** n−t operatörde zincir dışı kapıyı ECDSA köklü imzacılara kapatır. Geçiş yapmamış hesapları yalnızca bir host dondurmasıyla birlikte korur.
- **E2:** zincirler arasında ve anahtar kaybından sonra emeklilik; bir dondurmadan sonraki planlı devir teslim dahil.
- **Yönetişim:** PQ imzacılar ve onayla, T2'ye dayanıklılık iddiaları ancak o zaman mümkün hale gelir.

**Açık bıraktıkları:**
- **KDA:**
  - denetlenmemiş kütüphaneler ve doğrulama hataları (çeşitlilik kuralı bu yüzden var);
  - münhasırlık yok; bu yüzden ECDSA permit'leri Profil Q'ya kadar geçerli kalır;
  - konuşlu yolda imkânsız;
  - bir akıllı hesabın sahiplerini rotasyona sokmak onun KDA'larını geri almaz.
- **Profil Q:**
  - host dondurması olmadan zincir üstü kapı açık kalır;
  - bir kısmi benimseme uçurumu: 5 ila 8 uygulayan operatörle hizmet, koruma ortaya çıkmadan önce bozulur;
  - ECDSA KMS yanıt imzaları; herkese açık şifre çözme değişmez;
  - hazırlıksız hesaplar erişimi kaybeder (fail-closed);
  - bir ECDSA halefi T2 altında zayıftır.
- **Sertifikalar:** sızmış bir sertifika erken ama planlı bir devir teslimi tetikler.
- **Yönetişim:** PQ imzacılar ve onay bugün hiçbir yerde konuşlu değildir.

**Planlanan kanıt:**
- **Connector test düzeneği:**
  - KDA rotası;
  - Profil Q, artı bir pay toplama benzetimi. 13 operatörden k'si uyguluyorsa ve t = 4 ise, yeniden oluşturma ancak ve ancak 13 − k ≥ 5, yani k ≤ 8 olduğunda başarılı olur [I from V-A7];
  - zincir üstü kapı negatif testi: ECDSA işlemlerini kabul eden anvil üzerinde, kurban EOA'dan gelen sahte bir `allow(h, attackerPQ)`, ardından saldırganın PQ talebi, Profil Q altında şifre çözer.
- **Ortak crate:** KDA doğrulama vektörleri.
- **Foundry, iki anvil zincirinde:** sertifika (yanlış zincir, halef uyuşmazlığı, halef yok, bir ERC-1271 hesabı, duraklatılmışken çalışır, ikinci gönderim revert eder, sahte ya da sızmış bir sertifika yalnızca planlı devir teslimi sağlar); timelock; koruma; kanarya.

**Prototip durumu: connector kısımları dışında prototip için tamamlandı (2026-10-21; `results/level3/LEVEL3.md`).**
- **Main'de E2:** ACL v0.10.0, `retireAccountWithSig` (`lifecycle/level3`).
  - 13 test (TC19, TC24); ERC'nin vektörü Solidity'de ve ethers'ta yeniden üretildi.
  - v0.9.0'dan yükseltme E1 durumunu koruyor.
  - OZ doğrulaması ve Zama'nın CI kontrolü geçiyor.
  - Gas [M]: 65.560 (EOA, 1 zincir) ile 68.015 (ERC-1271) arası.
  - **İzleyici (watchtower)** üç gerçek anvil zincirinde bir hırsızın joker yetki devrini yakaladı ve sertifikayı iki
    listeli zincire 376 ms'de taşıdı. Halef okuyor, hırsızın devri hiçbir şey okumuyor.
- **Yönetişim:**
  - 7 günlük timelock ACL'in ve executor'ın sahibi;
  - koruma (guard) timelock üzerinden de geçerli;
  - kanarya Core'suz yalancıyı yakalıyor;
  - kanaryayı esirgeyen arka kapıyı sabitleme yakalıyor (6 Foundry testi, artı anvil'de kanarya betiği).
- **Ortak crate'te E3 KDA rotası** (`lifecycle/level3-verifier`, `kda` özelliği): 180/180 Wycheproof ML-DSA-44
  vektörü, üç parametre kümesi, geri düşüş yok, değiştirilmemiş doğrulayıcıda kapalı kalarak başarısız oluyor.
- **Profil Q:**
  - gerçek Shamir paylarıyla TC16 kuralı (yeniden kurulum ancak k ≤ 8 iken);
  - kısmi benimseme uçurumu: k = 8'de %5 kesintiyle serbest bırakmaların %77'si hâlâ başarılı;
  - zincir üstü kapı artık riski (TC22).
- **A5'in yerel ölçümleri** bizzat yeniden koşturuldu; A5'in sonuçları geçerli.
- **Açık:** connector'da KDA rotası ve Profil Q; ACVP vektörleri; v0.13 hattında E2.

**Bu Level'daki sınırlar:**
1. **Önleyicidir, geri alma değildir.** Profil Q ve sertifikalar etkinleştirme ya da gönderimden itibaren etki eder; bir CRQC'nin daha önce topladığı geri kazanılmaz.
2. **Yalnızca oracle erişimini keser.** Profil Q zincir dışı kapıyı kapatır; zincir üstü kapı host zincirine aittir.
3. **Bulunduğu zincirin yönetişimi kadar kesindir.** Kayıt sözleşmesini T2 altında dayanıklı kılan yalnızca operatör onaylı PQ yönetişimidir; o durumda bile yönetişim artı bir operatör nitelikli çoğunluğu (supermajority) her şeyi değiştirebilir.

---

## 5. Bugün için asgari olan: v0.13.x'te şimdi yayına çıkan

Bu bölüm, konuşlu v0.13 hattına backport olarak Level 0 Core'dur. Kanıt planı ve prototip durumu §4.1'dedir.

### 5.1 Paket

| Kalem | v0.13 hattı backport'u |
|---|---|
| **Derlendiği kaynak** | Yetki devri bitişinin `>` kullandığı `v0.13.8` etiketinin kaynağı. `>=` kullanan, mock'a gömülü (vendored) kopya değil [V-CV]. Zama'nın `mock/cleartext/CleartextACL`'i testler için ona yeniden yönlendirilir |
| **Sürüm** | ACL 0.4.0 → **0.4.1**; `REINITIALIZER_VERSION` 5 → **6**; boş bir `reinitializeV5()`. Bu, Zama'nın CI kuralını karşılar: herhangi bir bytecode değişikliği iki sürümü de artırır ve reinitializer `reinitializeV{N-1}` olarak adlandırılır (`ci/upgrade-check/lib.ts:144-169`) [V-A7, V-CV] |
| **Depolama** | `0xe6ae1005b480da47ced1ed3eb5869a54ca87c5d592369277249f4148c0e86200` konumunda, `mapping(address => bool) retired` tutan ERC-7201 ad alanı `fhevm.storage.ACLRetirement` [V-CV]. `fhevm.storage.ACL` düzeni bayt düzeyinde aynı kalır (0.4.x'te 4 alan) |
| **Yeni fonksiyonlar** | `retireAccount()` `0xe7142996`; `isAccountRetired(address)` `0xb279091e`; `supportsInterface(bytes4)` `0x01ffc9a7`, `0x01ffc9a7` ve `0x556d2088` için true; `retirementStorageLocation()` `0xc89c7ccd`, `pure` [V-CV]. Hiçbiri mevcut selector'larla çakışmaz [V-A7] |
| **Olay** | `AccountRetired(address indexed account, address indexed successor)`; bu Level'da `successor = address(0)`. Neden kodu yok |
| **Hatalar** | `AccountAlreadyRetired(address)`, `SenderRetired(address)`, `UpgradeDropsRetirement(address)` |
| **View'lar** | `isAllowed` (`:452-454`): `msg.sender` executor değilse emekliye ayrılmış bir hesap için false. `persistAllowed` (`:499-502`): `&& !retired[account]`. `isHandleDelegatedForUserDecryption` (`:478-491`): ilk ifadesi, yetki devreden, delege **ya da sözleşme** emekliye ayrılmışsa false döndürür. `getUserDecryptionDelegationExpirationDate` (`:401-411`): taraflardan herhangi biri emekliye ayrılmışsa 0 döndürür. `isDelegatedForUserDecryption` bu hatta mevcut değildir [V-P1] |
| **Yetki verme yolları** | `allow`, `allowForDecryption` ve executor dışı dalında `allowTransient` (bu hatta muaf dal yalnızca executor'ı kapsar [V-CV]). Yalnızca başarısızlık dalı değişir: gönderen emekliye ayrılmışsa `SenderRetired`, değilse mevcut `SenderNotAllowed`; böylece emekliye ayrılmamış her gönderen için davranış bayt düzeyinde aynıdır. `delegateForUserDecryption` (`:283-334`): ilk ifadesi emekliye ayrılmış bir gönderen için `SenderRetired` ile revert eder. Emekliye ayrılmış bir *delegeye* ya da emekliye ayrılmış bir sözleşme için yetki devretmek revert etmez; etkisizdir (R8) |
| **Değişmeyenler** | `multicall`; `revokeDelegationForUserDecryption` (emekliye ayrılmış hesaplarca çağrılabilir; bu hatta duraklatmaya bağlıdır); `blockAccount` ve `unblockAccount` (engel listesi yalnızca yönetişime ait kalır ve emekliliğe asla dokunmaz); `pause` ve `unpause` (emekliliği ya da herhangi bir view'ı asla kısıtlamaz); `isAllowedForDecryption`; ham `allowedTransient` |
| **Yükseltme koruması** | `_authorizeUpgrade` içinde (`:591`); bkz. §5.4 |
| **Boyut** | Yaklaşık 75–90 Solidity satırı [E]; EIP-170 kod boyutu sınırı CI'da kontrol edilir |
| **Zincir dışı** | Connector, relayer, SDK, KMS ya da gateway'de doğruluk için değişiklik yok. Coprocessor host-listener bir sonraki yeniden derlemesinde derleme zamanı match kollarını alır; eski ikili dosyalar bilinmeyen olayları atlar [V-A7] |
| **Süreç** | Host zinciri başına bir DAO oylaması (Ethereum ve Polygon, ikisi de ACL v0.4.0'da [M-04]) artı test ağları, ideal olarak tek bir sürüm penceresinde. İkisi de tamamlanana kadar cüzdanlar zincir başına durumu gösterir |

**Protokol riski olmadan şimdi teslim edilebilecek diğerleri:**
- **Belgeler:** `docs/solidity-guides/acl/README.md:65`'teki engel listesi abartısını düzelt; orada engellenen hesapların izin alamayacağı yazıyor, oysa kod alıcıyı hiç kontrol etmiyor [V-P1]. Bir adres yaşam döngüsü sayfası ekle.
- **Operatör kulvarı (isteğe bağlı; n−t'de etkili):** kanarya, sabitleme, kesin emeklilik retleri, eski yolda kullanıcının sözleşmelerden biri olmadığının kontrolü ve host durumu çeşitliliği. Kesin retler bir connector kodu değişikliğidir; gerisi yapılandırma ve betiklerdir.
- **Yönetişim (ayrı talep):** `ACL.owner()` ve gateway sahibi olarak bir timelock.

**Bir kullanıcı bugün nasıl kullanır.**
1. Envanter çıkarın ve kayıtları dışa aktarın.
2. Hesap hâlâ etkinken gözlemcileri ve operatörleri temizleyin.
3. Varlıkları yeni hesaba geçirin.
4. Handle'ları `multicall([allow(h_i, NEW)…, retireAccount()])` ile yeni hesaba taşıyın. Önce izinler gelir; ters sıra revert eder. Her işlem yaklaşık 500 handle alır [E].
5. Her host zincirinde emekliye ayırın.

Bu Level'da halef yoktur. Taşımadan emekliye ayrılan bir hesap, sonradan gelenlerin okunamaz kalacağını kabul eder; cüzdan da bunu açıkça söyler.

### 5.2 Tek başına neden güvenli

1. **Yalnızca kısıtlayıcı.** Emeklilik hiçbir hak oluşturmaz ya da genişletmez (R4). Yalnızca emekliye ayrılan hesabın kendi yetkisi daralır; Core hiçbir anahtar ve hiçbir güven kökü eklemez [I].
2. **Karar veren her bileşeni yükseltme bloğunda, sıfır kod değişikliğiyle bağlar:**
   - connector'ın bütün ACL yüzeyi, `from` olmadan çağrılan dört view'dır [V-A7, V-CV];
   - SDK ön kontrolü denetimli view'ları okur [V-A7];
   - konuşlu gateway hiçbir ACL kontrolü yapmaz [V-A7];
   - Zama'nın açık metin mock'u temel ACL'nin `persistAllowed`'ına ve devredilmiş view'ına uyar [V-CV].
3. **Tek bir bit iki kapıyı da kapatır.** Zincir üstündeki her dışa aktarma, dışa aktaranı özne alarak `isAllowed`'a yeniden girer [V-A7]. v0.13.x'te bu; ACL yazmalarını, `fromExternal(h, "")`'yi, ERC-7984 handle transferlerini ve ifşayı kapsar.
4. **Motor muafiyeti bir dışa aktarma rotası değildir.** Üç değişmez geçerlidir [V-A7, V-CV] ve testler onları sabitler.
5. **Hiç emekliye ayrılmamış hesaplar için bayt düzeyinde aynı.** Yalnızca başarısızlık dalları ve denetimli okumalar değişir. Level 0'ın, Zama'nın mevcut test takımlarına karşı fark testleri (differential tests) bunu göstermelidir (G5); prototip beklemededir.
6. **Transferler çalışmaya devam eder.** Gelen izinler kabul edilir ve etkisizdir; bu yüzden her iki yöndeki ERC-7984 transferleri etkilenmez [V-05; V-A7].
7. **Yönetişim araçlarından bağımsızdır.** Duraklatmaya ya da engel listesine bağlı değildir, sözleşmeler için çalışır ve hiçbir şey emeklilikten geri çıkarmaz. Engel listesine dokunulmaz.
8. **Boşluklar revert'e dönüşür.** Koruma, uygulamanın sessizce kaybını bir revert'e dönüştürür; Core içermeyen 0.5.0 ile çakışmalar zaten revert eder (§5.4).
9. **Ucuzdur:** sıfır yeni RPC, devredilmiş view'da bir SLOAD daha, emekliye ayırmak için yaklaşık 45–55K gas [E] ve ERC-7984 transferi başına yaklaşık +2,1–2,8K gas [E].
10. **Zararları sınırlıdır ve açıkça belirtilmiştir:**
    - halef olmadan dışarıda kalma; önce taşıyarak ve cüzdan metniyle hafifletilir;
    - kendini emekliye ayıran bir sözleşme kendi handle'larını kullanılamaz hale getirir; bu, mevcut bir yönetici (admin) yetkisine eşdeğerdir;
    - taşıma olayları üzerinden ilişkilendirilebilirlik;
    - korumanın yakalayamadığı, yalan söyleyen bir uygulama yoluyla boşluklar (§9).

### 5.3 v0.13.x'te sağlamadıkları

- **PQ hedefi yok.** Konuşlu yolda ERC-1271 rotası yoktur ve relayer yalnızca 65 baytlık imzaları kabul eder [M-P1]. Bu yüzden konuşlu aşama yalnızca emeklilik ve rotasyon sunar; PQ hedefleri main'in doğrulayıcı yollarıyla gelir (Level 1 ve 3).
- **Henüz halef yok.** E1, Level 2'dedir, ama daha sonra bu hatta konuşlandırılabilir; P1d'de halef bir ECDSA EOA'sı olmalıdır [V-A7].
- **İmza hijyeni yok, beyan edilmiş imzacı yok:** bunlar yalnızca main'dedir.
- Emeklilikten önce serbest bırakılmış hiçbir şeyin **geri çağrılması yok** (sınır 1).

### 5.4 Yükseltme koruması (UUPS kayıt sözleşmeleri için Core MUST)

```solidity
// _authorizeUpgrade (main :674; v0.13.8 :591). Runs in the CURRENT implementation before the switch.
function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {
    (bool ok1, bytes memory r1) = newImplementation.staticcall(
        abi.encodeWithSelector(0x01ffc9a7, DAL_CORE_INTERFACE_ID));   // supportsInterface(Core)
    (bool ok2, bytes memory r2) = newImplementation.staticcall(
        abi.encodeWithSelector(0xc89c7ccd));                          // retirementStorageLocation()
    bool declaresCore = ok1 && r1.length == 32 && uint256(bytes32(r1)) == 1;
    bool sameState    = ok2 && r2.length == 32 && bytes32(r2) == ACL_RETIREMENT_STORAGE_LOCATION;
    if (!declaresCore || !sameState) revert UpgradeDropsRetirement(newImplementation);
}
```

- **Nerede çalışır.** UUPS, `_authorizeUpgrade`'i geçişten önce mevcut uygulamanın içinde çalıştırır [V-A7].
- **İki kontrol de gereklidir.**
  - Tek başına ERC-165, Core beyan eden ama ad alanı kaymış bir sürümü geçirir; bu da her emekliliği sessizce sıfırlardı.
  - Tek başına konum kontrolü, getter'ı koruyup Core'u düşürmüş bir sürümü geçirir.
- **Kaçış kapısı (escape hatch) yok.** Hatalı bir Core sürümü için geri dönüş (rollback) hedefi, yamalanmış bir Core sürümüdür.
- **Sınır.** Kazaları durdurur, yalan söyleyen bir uygulamayı değil. Bunu kanaryalar ve sabitleme (Level 3) karşılar.

| Kimlik | Yükseltme | Beklenen sonuç |
|---|---|---|
| U1 | 0.4.0 → 0.4.1 | düzen korunur; OZ `validateUpgrade` geçer |
| U2 | 0.4.1 → 0.8.0 | bitler ve uygulama korunur |
| U3 (tehlike gösterimi) | korumasız 0.4.1 → 0.7.0 | başarılı olur ve uygulama boşluğa düşer |
| U4 | 0.4.1 → 0.7.0 | `UpgradeDropsRetirement` ile revert eder |
| U4b | 0.8.0 → başka bir ad alanına sahip, Core beyan eden bir uygulama | `UpgradeDropsRetirement` ile revert eder |
| U5 | 0.4.1 → 0.5.0 | Revert eder. Koruma `upgradeToAndCall` içinde önce çalıştığı için hata `UpgradeDropsRetirement` olur. Korumasız bir derlemede yeniden başlatıcı çakışması (`InvalidInitialization`) görünür [M-L0] |
| U6 (isteğe bağlı) | 0.4.1 → 0.5.1 → 0.8.0 | başarılı olur |
| U7 | 0.8.0 → Core beyan eden ve konumu döndüren ama denetim uygulamayan bir uygulama | korumadan geçer; kanaryanın yakalaması gerekir (artık risk) |

### 5.5 Sürüm treni kuralı

**Kanıt.**
- Etiket başına ACL sürümü ve reinitializer: v0.13.8 = 0.4.0/5; v0.14.0–v0.14.4-0 = 0.5.0/6; v0.15.0-0 = 0.5.0/6; v0.15.0-3 = 0.6.0/7; main = 0.7.0/8 [V-A7, V-CV].
- OZ'nin `reinitializer`'ı `_initialized >= version` olduğunda revert eder [V-A7].
- `test-suite/fhevm/profiles/latest-supported.json` her bileşeni v0.14.2'ye sabitler; dolayısıyla bir sonraki üretim hattı muhtemelen 0.14.x'tir [V-A7].

**Kural:**
1. **Önce main.** Core önce main'e girer (0.8.0, reinitializer 9).
2. **Üretimin geçebileceği her hat, üretim geçmeden önce Core'u içerir.**
   - v0.13 hattı: 0.4.1/6, zorunlu.
   - v0.14 hattı: 0.5.1/7. Level 0'ın yeşil sayılması için isteğe bağlı; 0.14.x'i hedefleyen herhangi bir öneriden önce zorunlu.
3. **Bir üretim kayıt sözleşmesini asla Core içermeyen bir sürüme yükseltme.** Bunu zincir üstü koruma uygular; CI da her hatta bir Core selector testi artı bir negatif yükseltme testiyle uygular.
4. **Numaralandırma.** Her hattın Core sürümü, `reinitializeV{N-1}` adlandırmasıyla, kendi hattının reinitializer + 1 değerini alır.
   - Core içermeyen sürümlerle çakışmalar (0.4.1 ↔ 0.5.0 ve 0.5.1 ↔ 0.6.0) kasıtlıdır ve `InvalidInitialization` ile revert eder.
   - Atlamalı yükseltmeler (0.4.1 → 0.6.0 ya da 0.7.0) bugün başarılı olur ve Core'u sessizce düşürür [V-A7]. Koruma onları yakalar.
   - "Koruma olarak numaralandırma" (çok yüksek reinitializer'lar) reddedilmiştir.
5. **İkinci backport'tan önce plan.** Herhangi bir ikinci üretim backport'undan önce, üretimin geçebileceği her hat boyunca reinitializer'ları kesin olarak artan bir sürüm planı sabitle. Sonraki Level'lar hat başına yeniden artırır.
6. **Zincir başına bir oylama.** Host zinciri başına bir DAO oylaması; her iki host zinciri tek bir sürüm penceresinde yükseltilir ve ikisi de tamamlanana kadar zincir başına durum gösterilir.

Açık sorular 1, 2 ve 14 (§10), hedef hattı ve korumanın ilk önerinin içinde yayına çıkıp çıkmayacağını ele alır.

**Faz 4 değişikliği (§11.5).** 4. maddedeki numaralandırmanın yerine bir öneri geçiyor: yaşam döngüsü sürümleri 1000'den yukarı numaralandırılır, hiçbir zaman daha düşük bir yaşam döngüsü level'ına yükseltme yapılmaz ve her yükseltme yolu CI'da denetlenir (15. açık soru).

### 5.6 Bugün yayına çıkan için üç sınır

1. **Önleyicidir, geri alma değildir.** Anahtarları kendilerine karşı kullanılmadan önce emekliye ayrılan hesapları korur.
2. **Yalnızca oracle erişimini keser.** Emekliye ayrılmış anahtar hâlâ fon hareket ettirir ve uygulama rollerini elinde tutar.
3. **Bulunduğu zincirin yönetişimi kadar kesindir.** Host zinciri başına geçerlidir ve bugün o yönetişim, timelock'suz, EOA köklü çoklu imzalardan (multisig) oluşur [V-P1].

---

## 6. Karar kaydı

"Ref." sütunu `DELIBERATION_SUMMARY.md`'yi gösterir: (f) n, sıralanmış alternatiflerin n'inci sırasıdır; (h) n ise n numaralı açık sorudur.

| # | Karar | Seçilen | Değerlendirilen alternatifler (kaynak) | Neden | Ref. |
|---|---|---|---|---|---|
| D1 | Yaşam döngüsünün uygulandığı yer | Kayıt sözleşmesi view'larının içinde okunan tek yönlü bir bit (Core) | V1 C1: yazma tarafında `notSealed` korumaları artı `invalidatedBefore = 2^256−1` gözcü değeri (sentinel); connector'ların okuduğu bir mühür (seal) bayrağı (DESIGN_REVIEW); birincil depo olarak değiştirilemez bir kayıt sözleşmesi (A2); yönetişimin engel listesi | View'lar, yükseltme bloğunda her doğrulayıcıyı ve her vekil sözleşmeyi bağlar. Gözcü değer konuşlu hatta etkisizdir; bu hatta slot yoktur ve connector'ı geçersiz kılmayı hiç okumaz [V-P1]. Yazma korumaları vekil sözleşmeleri kaçırır [V-P1]. Bir connector bayrağı n−t operatör ve +1 RPC gerektirir. Engel listesi, yönetişimin eline kullanıcı başına bir kesme yetkisi verir | (f) 1, 7, 21, 26 |
| D2 | Yaşam döngüsü durumları | Yalnızca Active → Retired | NIST benzeri Active / Suspended / Retired / Compromised; bir vasinin (guardian) kaldırabildiği Suspended uzantısı (A2) | Askıyı kaldırabilen kim olursa saldırganın hedefi olur. Askıya alma ayrıca hesabın kendi taşımasını engeller ve monotonluğu bozar. İhtiyaç, hesap düzeyinde askıya alma ve halefle emekliye ayırma ile karşılanır | (f) 12 |
| D3 | Neden kodu | Yok: `AccountRetired(account, successor)`, parametresiz `retireAccount()` | `reason ∈ {Superseded, Compromised, Unspecified}` (A4, A5); Core dışında isteğe bağlı (A3) | Düşmanca olabilecek bir anahtarın seçtiği bir neden kanıt değildir. Herkese açık bir "ele geçirildi" (compromised) bayrağı bir ihlal bildirimidir; anlamı tanımlanmamış bir alan da güvenen tarafları ona bir anlam yüklemeye davet eder | (f) 13 |
| D4 | Denetlenen roller | Her view'da her rol: her iki devredilmiş view'da sözleşme rolü ve permit tabanlı sağlayıcılar için permit alıcısı | Yalnızca yetki devreden ve delege (DESIGN_REVIEW §6.2) | Emekliye ayrılmış bir sözleşme devredilmiş yolda hâlâ geçiyordu [V-CV]. Tek tip bir kural test edilebilirdir ve bir SLOAD ile sıfır RPC'ye mal olur | (a), b.2 R6 |
| D5 | Motor muafiyeti | Çağrı anlamına göre tanımlanır (R10). Çağıran kimliğine yalnızca üç değişmez altında izin verilir | "`msg.sender` motor ise atla" (A1 taslağı, DESIGN_REVIEW) | Çağrıları ileten bir motorda (Fhenix) çağıran kimliğine dayalı bir kural, her izni ve oracle'ın permit kontrolünü muaf tutardı [V-CV] | (a), b.2 R10 |
| D6 | Ham getter'lar | Yetki devri bitiş getter'ı emekliye ayrılmış taraflar için 0 döndürür; `allowedTransient` ham kalır ve bağlayıcı olmadığı (non-authoritative) belgelenir | `allowedTransient`'ı da denetlemek (A4); getter'ı değiştirmeden bırakmak | Değişiklik getter'ın kendi docstring'iyle uyumludur ("0 means delegation is inactive"; yani "0, yetki devrinin etkin olmadığı anlamına gelir") [V-A7]. `allowedTransient`, `isAllowed`'ın altındaki ilkeldir (primitive) | (f) 23; (h) 13 |
| D7 | Sürümler arasında sağ kalma | Ad alanı + ERC-165 Core'u **ve** depolama konumunu kontrol eden zincir üstü koruma (UUPS için Core MUST) + CI testleri + kanarya + sabitleme; kaçış kapısı yok; şimdilik değiştirilemez kayıt sözleşmesi yok | Yalnızca ERC-165 koruması (koordinatör); yalnızca konum koruması ve gecikmeli bir kaçış kapısı (A3); koruma olarak numaralandırma; esas kayıt (state of record) olarak değiştirilemez bir kayıt sözleşmesi (A2) | Her tekil kontrol, diğerinin yakaladığı bir başarısızlık türünü kaçırır. Kaçış kapısı, Core içermeyen bir uygulamaya geri dönüştür. Numaralandırma Zama'nın CI geleneğini bozar. Değiştirilemez bir kayıt sözleşmesi view'ları değil bitleri korur; bir CALL ya da bir RPC'ye mal olur; ancak çok sağlayıcılı benimsemeyle kendini amorti eder | (f) 7, 22, 24; (h) 2 |
| D8 | Depolama konumu | Özel bir ERC-7201 ad alanı | v0.4.x ile main arasında indeks 4'te çakışan `ACLStorage`'a ekleme [V-05]; engel listesi sözcüğünün (word) bir baytı, yaklaşık 100 gas daha ucuz (A3) | Çakışmayı önler ve kullanıcı durumunu yönetişimin yazdığı bir sözcüğe bağlamaz | (f) 21 |
| D9 | İkinci emeklilik | Her iki giriş noktasında `AccountAlreadyRetired` ile revert eder | İdempotent başarı (A1) | Deterministik başarısızlık sessiz başarıdan iyidir. Watchtower'lar önceden kontrol eder ve başarısızlığa toleranslı multicall ile toplu gönderir | (c) c.9 |
| D10 | Süreklilik | İkisi de: mevcut `multicall` ile taşıma (önce izinler) ve özel bir halef (E1) | V1'in `allowMany` ve `carryAndSeal`'i; yalnızca taşıma; yalnızca halef; SU-14, kilitli bir joker yetki devri olarak halef | `multicall` zaten mevcut [V-P1]. Birleşik bir izin-ver-ve-emekliye-ayır çağrısı, oltalamayla imzalatılmış tek bir işlemi geri alınamaz bir izin artı bir dışarıda kalmaya dönüştürür. Taşıma bir anlık görüntüdür; halef geç gelenleri ve dışarıda kalmayı karşılar. SU-14 emeklilikten önce canlıdır, geri almada (revoke) ve blok başına tek değişiklik kuralında özel durumlar gerektirir ve cüzdanlara revert eden bir geri alma düğmesi gösterir | (f) 16; (e) C2 |
| D11 | Halefin kabulü | Zorunlu; halefin göndereceği bir işlem olarak | İsteğe bağlı (G1 hakeminin "could" ifadesi); kayıt sözleşmesi içinde bir ERC-1271 kontrolü (A4) | Kontrolü kanıtlar: bir KDA, bir yazım hatası ya da bir yakma (burn) adresi kabul edemez. Örneğin yaptırım uygulanan bir adresle tek taraflı ilişkilendirmeyi durdurur. 1,23M gas'lık zincir üstü ML-DSA kontrolü gerektirmez | (h) 3 |
| D12 | Olgunlaşma gecikmesi D | Kayıt sözleşmesi genelinde ≥ 7 gün (varsayılan 7); hesap başına, yalnızca artırılabilir, 365 güne kadar (MAY); `confirmableAt` atamada sabitlenir | Yalnızca bir öneri ya da 1 günlük bir asgari (A1) | Bir taban, güvenlik özelliğini test edilebilir kılar. Yalnızca artırılabilirlik, kurumsal politikayı zincir üstünde ucuzca uygulanabilir kılar | (h) 4 |
| D13 | Anında halef | Reddedildi | `retire(successor)`; bir sertifika içinde adı verilen bir halef | Oltalamayla alınmış tek bir imza = geri alınamaz ele geçirme artı dışarıda kalma | (f) 17 |
| D14 | Halefin yetkileri | Yalnızca adına çözme, yalnızca emeklilikten sonra, geçişlilik yok. Halefin verdiği yetki devirleri ve halefiyetin devri ertelendi | Halefin verdiği, süre sınırlı denetçi yetki devirleri (A2, A6); halef tarafından halefiyetin devri (A2, A6) | En az yetki. Geçişlilik en çok itiraz edilen özellikti. Akıllı hesap halefler sahiplerini kendi içlerinde rotasyona sokar | (f) 9, 10 |
| D15 | Beyan edilmiş şifre çözme imzacısı | E3: sıfır ACL değişikliğiyle bir KDA'ya yetki devri. Bağımlı; emeklilikle ölür; yalnızca devredilmiş girdiler; asla halef değil; `WithSig` yok; yerel FIPS 204/205; sözleşme doğrulayıcıları yok; olgunlaşma gecikmesi yok | Geri düşürmeye kapalı (no-downgrade), olgunlaşmalı beyan ve temizleme içeren, kayıt sözleşmesi durumunda tutulan bir imzacı (A1, A2, A6); kök olarak ayrı bir şifre çözme kimliği (V1 A1); ERC-8231 (A5 tarafından reddedildi) | Monoton: joker bir yetki devrinin zaten veremeyeceği hiçbir şeyi vermez. Yeni RPC gerektirmez. Değiştirilmemiş doğrulayıcılarda kapalı kalarak başarısız olur (fail-closed) [V-A7]. Münhasırlık; kayıt sözleşmesi durumu, talep başına +1 RPC ve n−t uygulama gerektirir; Profil Q devreye girdiğinde de gereksiz hale gelir | (f) 5; (e) C4(b) |
| D16 | Emeklilik sertifikası | E2: yalnızca emekliye ayırır; teyit edilmiş bir halef gerektirir ve ona bağlanır; açık zincir listesi; zincirden bağımsız EIP-712 alanı; kod-öncelikli; nonce, bitiş süresi ya da iptal yok; duraklatılamaz | Kayıt sözleşmesi başına bir alan (A1); mevcut **ve gelecekteki** zincirlerde geçerlilik (A2, A4, A5); halefsiz bir sertifika (A1; A6'da kapatılabilir bir bayrak olarak); iptal edilebilir sertifikalar (saklama); bir özet taahhüdü (hash-commitment) `H(s)` biçimi (A4) | Halef olmadan, sızmış bir sertifika ya da bir T2 sahteciliği bir dışarıda bırakma bombasıdır; bir host dondurmasından sonra da kalıcı bir bomba. İptal edilebilir bir sertifikayı hırsız iptal edebilir. Sınırsız kapsam onu hamiline yazılı bir araca (bearer instrument) dönüştürür | (f) 8, 14, 15; (h) 5 |
| D17 | Zincirler arası | Kayıt sözleşmesi başına, host zinciri başına; E2'nin zincir listesiyle tek imza; SDK'da `retireEverywhere()` | EOA emekliliklerinin oracle tarafında bir "birleşimi" (union) (A2); köprü ya da LayerZero ile yayılım; ayrı bir zincirler arası uzantı | Bir birleşim kısıtlayıcı bir kuraldır (n−t), zincir başına RPC'ye mal olur, tek zincirli emeklilikleri şaşırtır ve sözleşmeler için güvensizdir. Bir köprünün ele geçirilmesi, protokol içinde geri alınamayacak biçimde hesapları toplu olarak emekliye ayırabilir | (f) 18, 19 |
| D18 | Q-günü duruşu | Profil Q: n−t'de operatör politikası; B_Q'da önce taahhüt, sonra etkinleştirme; ≥ 24 ay planlı bildirim; iki acil durum tetikleyicisi; PQ imzalı sinyal; iddialar yalnızca bir host dondurmasıyla | V1 C5, yönetişimin çevirdiği bir bayrak; zincir üstü bir tetikleyici; kayıt sözleşmesi düzeyinde ECDSA'nın kullanımdan kaldırılması (A2); ≥ 180 gün (A1, A5) ya da ≥ 6 ay (A3) bildirim | Bugün çevrilirse bir bayrak, sahiplerin yaklaşık %98'i için bir kesintidir [M-04] ve bayrağı çeviren ECDSA anahtarı T2 altında ilk düşendir. Zincir üstü kapıyı yalnızca host zinciri kapatır. Kayıt sözleşmesinde bir kullanımdan kaldırma, PQ açısından güvenli bir tetikleyici gerektirir; dolayısıyla önce PQ yönetişimi | (f) 3, 6, 25; (h) 6 |
| D19 | Doğrulayıcı hijyeni | Profil H: kod-öncelikli, dar shim, B_exec 2M artı içsel (intrinsic) gas, 64 KiB tavan, ≤ 2 deneme, önce gölge modu | V1 C3 (EIP-8151 kuralı); V1 C4(a) (bir kod özeti izin listesi); kesin (terminal) ERC-1271 başarısızlıkları; `ecrecover`'ı ilk sırada tutmak; konuşlandırmasız (deployless) bir denetleyici (A5) | 8151 kuralı 7702 kök anahtarlarını hâlâ kabul eder. Proxy'ler ve modüller kod özetlerini etkisiz kılar. Kesin başarısızlıklar, Zama'nın belgelenmiş cüzdan durumu gerekçesiyle çelişir (`error.rs:97-100`) [V-A7]. En kötü durumdaki iş 5M yerine 4M gas olur [E]. Konuşlandırmasız denetleyici bir norm değil, isteğe bağlı bir uygulama olarak kalır | (f) 11, 20; (e) C3, C4(a) |
| D20 | Emeklilik retleri | Kesin ve `ACCOUNT_RETIRED` tipinde (V7) | Bugünkü gibi kurtarılabilir ve yeniden denenen [V-A7] | Emeklilik monotondur; bu yüzden bir yeniden deneme meşru olarak başarılı olamaz. Ayrıca sıradaki yeniden denemelerin bir yönetişim boşluğundan sonra yeniden canlanmasını engeller | b.3 V7 |
| D21 | Yönetişim | Bir timelock, her yetkilendirme yolu sözleşmesinin ve işaretçisinin ve gateway'in sahibidir; duraklatma tek acil durum yetkisidir; son durum: PQ imzacılar artı n−t onayı | Bir eklenti daha olarak eklenen bir timelock; mevcut durum (status quo) | Bir eklenti, mevcut EXECUTE yetkisi sahiplerince atlatılır [I from V-P1]. Zama'nın ProtocolConfig'i n−t desenini zaten kullanıyor [V-A7] | (f) 4; (h) 7 |
| D22 | Uygulamalar | Profil A: asimetrik gözlemci kapısı, operatör kapısı, gelenleri engelleme yok, izin sonrası assert yok | Emekliye ayrılmış bir hesaptan gelen her `setObserver` çağrısını reddeden naif bir kapı | Naif bir kapı, hırsızın eklediği bir gözlemciyi yerine kilitler; o da gelecekteki her tutarı okumaya devam eder [V-A7] | b.6 A |
| D23 | Aktarım ve PQ iddiaları | Core aktarımdan bağımsızdır; herhangi bir PQ iddiası hem yanıt hem girdi kanalında FIPS 203 gerektirir | Core'da zorunlu bir PQ yanıt KEM'i | Core, X25519 ve ECIES kullanan sağlayıcılar için de geçerli olmalıdır. T2 altında klasik olarak şifrelenmiş girdiler oracle olmadan sızar [I] | (h) 10 |
| D24 | Host durumu kaynakları | ICS'te beyan edilmiş güven kökleri; t+1 ya da daha fazla düğüme hizmet eden herhangi bir kaynaktan kaçınılmalıdır (SHOULD) | Örtük bırakmak | t+1 düğümün yanıtlarını kontrol etmek her ACL kuralını atlatır [I] | (h) 11 |
| D25 | Level 0 hedefleri | main 0.8.0/9; `v0.13.8` etiketinden derlenen v0.13 hattı 0.4.1/6; isteğe bağlı olarak v0.14 hattı 0.5.1/7 | Yalnızca backport; yalnızca bir sonraki üretim hattı (A3) | Konuşlu connector ispatı ve mock 0.4.1 gerektirir; üretim de muhtemelen 0.14.x'e geçer [V-A7] | (h) 1, 14 |
| D26 | Standart katmanlaması | Sağlayıcıdan bağımsız bir ERC, "Decryption Authority Lifecycle"; ERC-7984 yalnızca Profil A'yı tutar | V1'in ERC-7984 PQ profili | ERC-7984 hiçbir şifre çözme hakkı tanımlamaz [C]. Kapsam token'lardan daha geniştir ve addaki "PQ" konuşlu aşama için abartılı bir iddiadır | (e) |
| D27 | Testlerin yeri | Mock: view'lar ve akış. Connector test düzeneği: `isAllowed` yolu, değiştirilmemiş connector ispatı, Profil Q. Ortak crate test düzeneği: Level 1 ve KDA rotası | Brief'teki "mock'ta" Level 1 ML-DSA testi | Mock `isAllowed`'ı hiç çağırmaz, ERC-1271 yolu yoktur ve birleşik V2 yolunu uygulanmamış bırakır [V-A7] | A7 §2.12 |
| D28 | Tamamlayıcılar | Profil H üzerinden devralınan Ethereum-yerel rota (EIP-8298 + 3607 + 8151); Profil Q iddialarının ön koşulu olarak host zinciri dondurması ve kurtarma | Herhangi birini bir ikame olarak görmek | Bir dondurmaya kadar düz EOA'lar için hiçbir şey yapmazlar ve eski yol host zinciri kodunu göremez | (f) 2, 3 |

---

## 7. Bilerek yapmadıklarımız ve nedenleri

**(a) Standartlaştırılmayanlar** (`DELIBERATION_SUMMARY.md` b.8):

| Yapmadığımız | Neden | Durum |
|---|---|---|
| Bir Suspended (askıda) durumu eklemek | Onu kaldırabilecek güvenli bir taraf yok. Taşımayı engeller, monotonluğu bozar ve ihtiyacı başka yerde karşılanır (D2) | reddedildi |
| Olaya bir neden kodu koymak | Düşmanca olabilecek bir anahtarın kendi beyanı; herkese açık bir ihlal bildirimi (D3) | reddedildi |
| Zincir üstü bir yalnızca-PQ bayrağı ya da tetikleyicisi kullanmak | Tetikleyicisi ya güvensiz olan ECDSA yönetişimidir ya da zaten katılmayı seçmesi (opt in) gereken operatörlerdir. Bir kayıt bulunabilir ama bilgilendiricidir | reddedildi |
| Kayıt sözleşmesi düzeyinde ECDSA kullanımdan kaldırması eklemek | Hiç dondurma yapmayan bir host zincirinde zincir üstü kapıyı kapatan tek tasarım, ama tetikleyicisi PQ açısından güvenli olmalı (PQ yönetişimi, n−t onayı, ≥ 24 ay bildirim) | ertelenmiş araştırma |
| Emekliliği zincirler arasında yaymak ya da emeklilikleri oracle'da birleştirmek | Nadir bir eylem için köprü güveni; toplu emeklilik riski; n−t'de kısıtlayıcı kurallar; sözleşmeler için güvensiz (D17) | reddedildi |
| Bir taşıma fonksiyonu eklemek ya da engel listesi üzerinden emekliye ayırmak | `multicall` mevcut; birleşik bir çağrı bir oltalama ilkelidir; engel listesi yönetişimin aracıdır (D1, D10) | reddedildi |
| Değiştirilemez bir kayıt sözleşmesini birincil depo yapmak | View'ları değil bitleri korur; bir CALL ya da bir RPC'ye mal olur; ancak çok sağlayıcılı benimsemeyle kendini amorti eder (D7) | ertelenmiş son durum seçeneği |
| Halefin yetki devri vermesine izin vermek | Maruziyet açısından nötr ama geçişliliği geri getirir. Bir gün benimsenirse: ≤ 90 gün, sözleşme başına, yeniden devredilemez, halefle birlikte ölen | ertelendi |
| Beyan edilmiş imzacıyı münhasır yapmak (geri düşürmeye kapalı) | Kayıt sözleşmesi durumu, talep başına +1 RPC ve n−t uygulama gerektirir; Profil Q devreye girdiğinde gereksizdir (D15) | ertelendi |
| Özet taahhüdü (hash-commitment) sertifikası kullanmak | Yalnızca halefsiz, önceden ayarlanmış emeklilik için ya da host'lar dondurulmuş EOA'lar için `ecrecover`'ı değiştirirse gerekir | ertelendi |
| Zincirler arasını ayrı bir uzantı yapmak | O, E2'nin zincir listesi artı zincir başına anlamdır | E2'ye katıldı |

**(b) Reddedilen alternatifler** (`DELIBERATION_SUMMARY.md` §(f), sıra 12–26, yukarıdakilerin ötesinde):

| Yapmadığımız | Neden |
|---|---|
| Mevcut ve gelecekteki zincirlerde geçerli sertifikaları kabul etmek (sıra 14) | Sınırsız kapsamlı, hamiline yazılı bir araç |
| Teyit edilmiş halefi olmayan sertifikaları kabul etmek (sıra 15) | Bir sızıntı ya da oltalama onları dışarıda bırakma bombalarına çevirir; bir dondurmadan sonraki bir T2 sahteciliği hazırlıksız sahipleri kalıcı olarak dışarıda bırakır |
| Halefi kilitli bir joker yetki devri olarak kodlamak, SU-14 (sıra 16) | Emeklilikten önce canlı; geri almada ve blok başına kurallarda özel durumlar; revert eden bir geri alma düğmesi |
| Anında halefe izin vermek (sıra 17) | Oltalamayla alınmış tek bir imza, ele geçirme artı dışarıda kalma demektir |
| ERC-1271 başarısızlıklarını kesin (terminal) yapmak (sıra 20) | Zama'nın cüzdan durumu gerekçesiyle çelişir; bunun yerine 2 denemeyle sınırlandı |
| Bayrağı engel listesi sözcüğünde saklamak (sıra 21) | Kullanıcı durumunu yönetişimin yazdığı bir sözcüğe bağlar |
| Numaralandırmayı koruma olarak kullanmak (sıra 22) | Zama'nın CI geleneğini bozar; işi koruma görür |
| Ham `allowedTransient` getter'ını denetlemek (sıra 23) | `isAllowed`'ın altındaki ilkeldir ve bağlayıcı olmadığı belgelenmiştir |
| Yalnızca ERC-165 ile ya da yalnızca depolama konumuyla korumak (sıra 24) | Her biri, diğerinin yakaladığı bir başarısızlık türünü kaçırır |
| V1 C5'i, yani yönetişimin çevirdiği kapalı-kalma (fail-closed) bayrağını tutmak (sıra 25) | Bugün bir kesinti; bayrağı çeviren ECDSA anahtarı ilk T2 hedefidir |
| V1 C1–C5'i yazıldığı gibi tutmak (sıra 26) | Kesin olarak domine edilir: konuşlu yolda etkisiz, vekil sözleşmelerce atlatılır, daha fazla kod |
| V1'in reddedilen diğer alternatiflerini kullanmak: FHE anahtar rotasyonu ya da yeniden şifreleme; süre sınırlı ACL izinleri; yalnızca Ethereum'a güvenmek; kök olarak ayrı bir şifre çözme kimliği | Erişim kontrolüne dokunmazlar; ERC-7984 anlamını bozarlar; zincir dışı kapıyı açık bırakırlar; ya da kök anahtar zincir üstünde yeniden yetki verdiği için B3'e karşı başarısız olurlar |

**(c) Yapmadığımız iddialar:**
- **"PQ doğrulaması ECDSA'dan ucuzdur."** Yerel ML-DSA-44, Zama'nın k256 `ecrecover`'ını geçer ama libsecp256k1'i geçemez [M-A5].
- **"Bir KDA, bir EOA'yı Q-gününe karşı korur."** Yalnızca koşullu bir sigortadır (hedge); host zincirinin EOA'nın ECDSA işlemlerini dondurduğu yerde geçerlidir.
- ECDSA işlemlerini hâlâ kabul eden bir host zincirinde **"Profil Q, geçiş yapmamış ECDSA hesaplarını korur."**
- **"Watchtower'lar bir hırsızlıktan sonra geçmişi korur."** Zincir dışı şifre çözme izlenecek hiçbir şey bırakmaz.
- **"Bir timelock'un çıkış penceresi kullanıcıları korur."** Kullanıcılar şifreli metin geçmişlerini geri çekemez; pencere operatörlere hizmet eder.
- **"Sözleşme emekliliği her yerde bir şifre çözme acil kapatma anahtarıdır (kill switch)."** Main'in birleşik yolunda, izin verici (permissive) modda hiçbir sözleşmeye hiç başvurulmaz (`decryption.rs:490-492`) [V-A7].
- **"Artık risk: yok."** §9 bunları listeler.

**(d) Operasyonel hedef dışı bırakılanlar:**
- **Gateway'de ACL kontrolü yok.** Orada mevcut durum doğrudur [V-A7].
- **Varsayılan olarak, emekliye ayrılmış hesaplara gelen izinlerin ya da transferlerin engellenmesi yok.**
- **Destek masası üzerinden dondurma kaldırma yok, yalnızca sağlayıcının yapabildiği kurtarma yok.** İkisi de bir arka kapı olurdu.
- **"Halefe gönder" kullanıcı deneyimi (UX) yok.**
- **Emeklilik üzerinde duraklatma kapısı yok.**
- **Eski ECDSA yolunun genişletilmesi yok.**
- **Bu aşamada dış iletişim ya da yayın yok** (brief §0).

---

## 8. V1 → nihai eşleme

Bu bölüm, özünde değiştirilmemiş haliyle `DELIBERATION_SUMMARY.md` §(e)'dir.

| V1 maddesi | V1 içeriği | Nihai biçim | Level | Sonuç | Neden |
|---|---|---|---|---|---|
| **C1** | `sealAccount()`; `notSealed` yazma korumaları; `invalidatedBefore = 2^256−1` gözcü değeri (sentinel) | Core R1–R14: `retireAccount()`, okuma view'larında her rol için (sözleşme dahil) uygulanan tek yönlü bir bit. Yetki verme yolları `isAllowed` üzerinden başarısız olur; gözcü değer yok; yazma korumaları yok | L0 | **Hedef geri döner; mekanizma değiştirildi** | Gözcü değer konuşlu yolda etkisizdir (slot yok; v0.13.8 connector'ı geçersiz kılmayı hiç okumaz) ve main'de gereksizdir. Yazma korumaları, view'lar üzerinden yetkilendirme yapan vekil sözleşmeleri kaçırır |
| **C2** | `allowMany`, `carryAndSeal` | Taşıma = mevcut `ACL.multicall([allow(h_i, NEW)…, retireAccount()])`; önce izinler, parçalara bölünmüş. Deneme çalıştırması ve spam filtresi olan L2 taşıma aracı. O(1) süreklilik ve geç gelenler için E1 halefi | L0 (mekanizma), L2 (araç, E1) | **UX geri döner; fonksiyonlar çıkarıldı** | `multicall` mevcut. Birleşik bir izin-ver-ve-emekliye-ayır çağrısı, oltalamayla imzalatılmış tek bir işlemi geri alınamaz bir izin artı bir dışarıda kalmaya dönüştürür. Taşıma bir anlık görüntüdür |
| **C3** | Connector EIP-8151 kuralını uygular; 7702 "güvenli bir hedef değildir" | Profil H: dar bir 7702 shim'iyle (yalnızca başarılı boş dönüş) kod-öncelikli sıralama; aynı bloktan kod okumaları; eski yol normal koda sahip özneleri reddeder. Cüzdan metni: "bir 7702 yükseltmesi gizli geçmişi korumaz" ("a 7702 upgrade does not protect confidential history") | L1 | **Kavram geri döner; kural çıkarıldı** | 8151 kuralı 7702 kök anahtarlarını kabul eder (`SignerEIP7702` de kabul eder). Düğüm kuralları yalnızca ≥ n−t operatörde bağlayıcıdır |
| **C4(a)** | Daha yüksek gas tavanlı kod özeti izin listesi | Çıkarıldı. Yerine yürütme gazı bütçesi (2M + içsel gas), 64 KiB tavan ve ≤ 2 deneme | L1 | **Çıkarıldı** | Proxy'ler ve modüller kod özetlerini etkisiz kılar. Üç yapılandırma katmanı. ×20 yeniden deneme DoS çarpanı |
| **C4(b)** | `pqAuthKey()` üzerinden şema ipuçlu yerel doğrulama | Bir KDA yetki devri olarak E3 Beyan Edilmiş Şifre Çözme İmzacısı (ERC-7913 düzeni, yerel FIPS 204/205, ayrılmış şema kimlikleri) | L3 | **Geri döner** | 1,23M EVM gas'ına [M-P1] karşı yerel olarak 84–89 µs [M-A5]. Sıfır ACL değişikliği. Bağımlıdır ve emeklilikle ölür |
| **C4(c)** | EIP-8051/8052 ön derlemeleri (precompiles) | Yürütme bütçesi altında otomatik olarak devralınır; ERC bağımlılığı yok | L1+ | **"Devral" olarak geri döner** | ML-DSA-44 için yalnızca calldata, 250k'nın %71'idir [M-03]. EIP-8355 Hegotá için reddedildi [C] |
| **C5** | Yönetişim Q-günü `ecdsaDecryptionAuthorityDisabled`'ı çevirir | Profil Q: ≥ n−t'de operatör politikası, önce taahhüt sonra etkinleştirme, ≥ 24 ay bildirim, B_Q kesimi, PQ imzalı sinyal; iddialar yalnızca bir host zinciri ECDSA dondurmasıyla. Gerçek koruma, bir PQ halefine önleyici emekliliktir | L3 | **Bayrak çıkarıldı; niyet geri döner** | Bugün çevrilirse sahiplerin yaklaşık %98'i için bir kesintidir. Bayrağı çeviren ECDSA anahtarı T2 altında ilk düşendir. Host dondurması olmadan zincir üstü kapı açık kalır |
| **ERC-7984 PQ profili** | `IConfidentialAuthorityLifecycle` (`sealAccount`, `isSealed`, `allowMany`, `carryAndSeal`, `AccountSealed`) artı R1–R4 kuralları | Sağlayıcıdan bağımsız bir ERC, "Decryption Authority Lifecycle": Core + E1–E3 + Profil H/Q/A. ERC-7984 yalnızca Profil A'yı tutar | L0–L3 | **Doğru katmanda geri döner** | ERC-7984 hiçbir şifre çözme hakkı tanımlamaz. Kapsam token'lardan daha geniştir. Addaki "PQ" konuşlu aşama için abartılı bir iddiadır |
| **R1** | Mühürlenmiş (sealed) bir hesap için hiçbir permit kabul edilmez | Core V1 + V4 (yalnızca her özne için true dönen view'larla serbest bırakma; atlatma yok) | L0 | **Geri döner (Core)** | View'larda uygulanır; bu yüzden doğrulayıcıları kod değişikliği olmadan bağlar |
| **R2** | Beyan edilen adreste 7702 göstergesi dışında kod varsa `ecrecover`'ı reddet | Profil H kod-öncelikli (herhangi bir kod → ERC-1271; 7702 → ERC-1271 artı dar shim) | L1 | **Düzeltilerek geri döner** | V1'in 8151 eşdeğerliği 7702 kök anahtarlarını hâlâ kabul ediyordu |
| **R3** | Kapalı kalma (fail-closed) açıkken ECDSA yolunu reddet | Profil Q retleri (kodsuz, `0xef0100`, eski yol) | L3 | **Yeni bir temele oturtularak geri döner** | Bir bayrak değil, bir operatör politikası |
| **R4** | `pqAuthKey()` hesapları için isteğe bağlı yerel doğrulama | E3 KDA rotası | L3 | **Geri döner** | `pqAuthKey()`'in yerini ERC-7913 baytları alır |
| **G1** | Ele geçirilmiş ya da gelecekte ele geçirilecek bir anahtarın geçmiş verilere (orijinal belgedeki korunan varlık "V1": geçmiş handle'ların düz metinleri) erişimini önleyici ve kalıcı olarak kesmek | Core (+ çok zincir ve kaybolmuş anahtarlar için E2) | L0 | **Korundu, kayıtla** | "Önleyicidir, geri alma değildir"; kalıcılık sınır 3 ile sınırlıdır |
| **G2** | Geçmişi kaybetmeden bir PQ hesabına geçmek | Taşıma + E1 halefi + E3 (adresi koruyan bir PQ rotası) | L0/L2/L3 | **Korundu** | PQ hedefleri yalnızca main'de mevcut; konuşlu yolda ERC-1271 yok |
| **G3** | PQ hesapları makul maliyetle yetkilendirme yapar | Profil H bütçesi + E3 yerel doğrulaması | L1/L3 | **Korundu** | — |
| **G4** | Protokol Q-günü kapalı kalarak başarısız olur | Profil Q + host zinciri dondurması + önleyici emeklilik | L3 | **Korundu, kapsamı yeniden belirlendi** | Host zinciri dondurmadıkça yalnızca zincir dışı kapıda kapalı kalarak başarısız olur |
| **G5** | Geriye dönük uyumluluk | Core, hiç emekliye ayrılmamış hesaplar için bayt düzeyinde aynıdır; gelen izinler kabul edilir | L0 | **Korundu** | Fark testleri |
| **G6** | Asgari değişiklik; yeni ilkel yok; yeni güven varsayımı yok | Tek sözleşmede Core ≈ 75–90 satır; standart ilkeller; Extension'lar, zaten güvenilen operatörler ve yönetişimin ötesinde hiçbir güven kökü eklemez | L0 | **Korundu** | E3, denetlenmemiş bir kütüphane bağımlılığı ekler; bu açıkça belirtilmiştir |
| İlke 1 | İcat etme; eksik parçayı ekle | Korundu: view'lar, `multicall`, yetki devirleri ve ERC-7913 yeniden kullanılır | hepsi | **Korundu** | — |
| İlke 2 | İki kapıyı da kapat | Korundu ve daha iyi başarıldı: okuma tarafındaki tek bir bit ikisini de kapatır | L0 | **Korundu** | V1 her kapının yanlış tarafını kilitlemişti |
| İlke 3 | Geri döndürülemezlik | Korundu (R2); sınır 3 ve yükseltme korumasıyla kayıtlı | L0 | **Korundu, kayıtla** | — |
| İlke 4 | Geriye dönük uyumluluk | = G5 | L0 | **Korundu** | — |
| İlke 5 | Kapalı kalma (fail-closed) | Hatalar ve zaman aşımları (V1) ve Profil Q için korundu; asla tek bir kurul üzerinden değil | L0/L3 | **Korundu, yeni bir temele oturtuldu** | — |
| §7.1 kullanıcı akışı | PQ hesabı → `carryAndSeal` → varlıkları geçir → PQ ile şifre çöz | Envanter çıkarma ve dışa aktarma → uygulamalardan çıkış (gözlemciler, operatörler) → varlıkları geçirme → taşıma → her host zincirinde (bir halefle) emekliye ayırma | istemci | **Düzeltildi** | V1'in sırası uygulama rollerini etkin bırakıyordu |
| A1 (alternatif) | Kök olarak ayrı bir şifre çözme kimliği | Kök olarak reddedildi; bağımlı E3 olarak geri döner | L3 | **Dönüştürüldü** | B3: kök anahtar zincir üstünde yeniden yetki verir |
| A2–A6 (alternatifler) | Anahtar rotasyonu; süre sınırlı ACL; Ethereum'a güvenmek; yalnızca akıllı hesaplar; PQ KMS imzaları | Sonuçlar değişmedi: reddedildi; reddedildi; reddedildi; gerekli ama yetersiz; ortogonal (Zama yol haritası B7) | — | **Değişmedi** | — |
| §8 "artık risk: yok" | — | Level başına artık riskler ve üç sınırla değiştirildi | — | **Çıkarıldı** | Abartılı iddia |

**Semih'in sezgisi, sınandı.** V1'in **vizyonu** ilk asgari PR'dan daha genişti. Altı hedefin hepsi, dört doğrulayıcı kuralının hepsi ve "iki kapı, tek karar" ilkesi geri döner.

V1 mekanizma ya da tehdit modeli açısından daha iyi **değildi**:
- beş mekanizmanın hiçbiri yazıldığı gibi ayakta kalmaz;
- tehdit modeli vekil sözleşmeleri, konuşlu hattı, eşik yerleşimini, yönetişimi, saklanan sonuçları, çoklu zincirleri, uygulama rollerini ve dışarıda kalmayı kaçırdı;
- geçerli olmayan üç vizyon düzeyi iddia içeriyordu:
  - zincir dışı bir şalter (switch) Q-günü geçmişi korur;
  - herkes saf bir PQ akıllı hesabına geçmelidir; bunun maliyeti 14,6M–104,9M gas'tır [M-P1];
  - EIP-7851 7702 açığını kapatırdı; oysa Hegotá için reddedildi [C].

**Nihai tasarım, v2'nin uygulama kuramı, incelemenin tehdit modeli ve üç sınırla inşa edilmiş V1 kapsamıdır.**

---

## 9. Level'lara göre artık riskler

Tasarımın yokmuş gibi gösteremeyeceği riskler. Faz 4'ün eklediği artık riskler §11.7'de.

**Level 0 (Core).**

| Artık risk | Neden kalır | Onu daraltan |
|---|---|---|
| Ele geçirilme sonrası yarış | Sınır 1. Üçüncü taraflara verilmiş izinler, herkese açık handle'lar ve çözülmüş açık metin açıkta kalır. Bir hırsızın zincir dışı permit'i işlem gerektirmez ve bir şifre çözme saniyeler sürer (Sepolia'da 2,5–12,6 sn [M-P1]) | önleyici emeklilik; saklama izlemesi |
| Kimliğe bağlı uygulama rolleri | Sınır 2. Gözlemci, operatör ve sahip rolleri `msg.sender`'a dayanır; varlık yetkisi anahtarda kalır | Profil A (L2) |
| Yönetişimin ya da gateway'in ele geçirilmesi | Sınır 3. Buna eski yoldaki "kullanıcı olarak sözleşme" hilesi de dahildir [V-05]. Koruma yalnızca kazara oluşan boşlukları durdurur | şimdi timelock; kanarya ve sabitleme (n−t); PQ yönetişimi (L3) |
| Yalan söyleyen bir uygulama (U7) | Tasarımı gereği korumadan geçer | kanarya ve sabitleme |
| Saklanan sonuçlar ve aktarım anahtarları | Serbest bırakılmış paylar, aktarım anahtarını elinde tutan herkesçe çözülebilir kalır; anahtarlar bugün 365 güne kadar yeniden kullanılabilir [V-P1]. Gateway zincirinde yayımlanan paylar orada kalır. Değiştirilmemiş haliyle main'deki connector uç noktası saklanan bir sonucu emeklilikten sonra yeniden sunar; relayer da aynı ve eşdeğer bir talebe yeniden sunar [M-P4] | SDK hijyeni (L2); Profil H'de H7: onunla ikisi de emeklilikten sonra reddeder ve H4 deneme durumu yeniden başlatmadan sonra korunur [M-P4] |
| Zincir başına kapsam | Her host zincirinin kendi kayıt sözleşmesi vardır; Ethereum ve Polygon'un ikisi de ACL v0.4.0 çalıştırır [M-04]. Köprülenen handle'lar, hedef zincirde yeni handle'lardır [V-05] | `retireEverywhere()`; E2 zincir listeleri; zincir başına durum |
| Halef olmadan dışarıda kalma | Hırsızın önce davrandığı ya da oltalamayla yaptırılan bir emeklilik, sahibi sonradan gelenlerin dışında bırakır | E1 (L2); cüzdanlar emekliliği kırmızı bir eylem olarak ele alır |
| Sözleşmenin kendini emekliye ayırması | Sözleşmenin handle'larını her iki yolda kullanılamaz hale getirir; bu, mevcut bir yönetici yetkisine eşdeğerdir. Keyfi çağrı yapabilen yönetici yolları bunu doğrudan ya da kayıt sözleşmesinin `multicall`'ı üzerinden zorlayabilir; sözleşmeyi kendi seçtikleri bir halefe de devredebilirler [M-L2] | belgeleme; genel çağrı yolları yaşam döngüsü selector'larını reddeder (Profil A) |
| Duraklatma sırasında taşımanın engellenmesi | `allow` duraklatmaya bağlıdır [V-P1], emeklilik ise değildir | bir halefle emekliye ayırmak (E1) |
| İlişkilendirilebilirlik | Taşıma olayları eski ve yeni hesapları ilişkilendirir | SDK uyarısı |
| Host durumu kaynaklarında yoğunlaşma | Önceden var olan: ≥ t+1 düğümün RPC yanıtlarını kontrol eden her ACL kuralını atlatır; operatör başına, host zinciri başına tek bir RPC URL'si [V-A7]. Üretimdeki boyutu bilinmiyor; potansiyel olarak High (Yüksek) [I] | O2 açıklaması; O3 çeşitliliği |
| T2 altında hazırlıksız ECDSA sahipleri | Core yalnızca önce emekliye ayrılanları korur | Level 2–3; host zincirinin dondurması ve kurtarması |

**Level 1 (Profil H).**

| Artık risk | Neden kalır | Onu daraltan |
|---|---|---|
| Tipik 7702 hesapları kök anahtarlarını korur | Delegeleri onu ERC-1271'de kabul eder [V-A7] | emeklilik (L0); host zincirinde 8298 geçişi |
| Uyumluluk kırılması | Düz tipli veri imzalayan ERC-7739 cüzdanları ve `isValidSignature` içermeyen delegeler kod-öncelikli doğrulamada başarısız olur | gölge modu; SDK sarmalaması |
| Eski yol ECDSA kalır | Gateway, gateway zincirinde doğrular | eski yolun reddi; yolun emekliye ayrılması (L3) |
| Kısmi benimseme | Kısıtlayıcı kısımlar yalnızca ≥ n−t operatörde bağlayıcıdır | operatör taahhütleri |
| Calldata muhasebesi | Deneme başına `gas_limit`, buna karşılık gelen bir hesaplama olmadan, 64 KiB'lık bir imza için B_exec'i yaklaşık 4,2M aşabilir [E] | tavan; deneme sınırı |
| Hesabın beyanına dayanan ERC-1271 | ECDSA sahipli bir sözleşme geçer | Profil Q "strict" varyantı (L3) |

**Level 2 (süreklilik ve uygulamalar).**

| Artık risk | Neden kalır | Onu daraltan |
|---|---|---|
| Fark edilmeyen saldırgan ataması | Saldırganca kabul edilip D sonrasında teyit edilirse emeklilikten sağ çıkar (testlerde assert edilir) | atamada alarm; kurulumda atama; D ≥ 7 gün; herhangi bir sürprizde taşıma artı emekliye ayırma |
| Değiştirilen bekleyen atamalar | Bir hırsız onları değiştirmeyi sürdürebilir | hemen taşıma artı emekliye ayırma |
| Kaybolmuş ECDSA-EOA halefi (konuşlu yol) | Kesin: teyitten sonra değiştirme yok | kurumlar ayrıca taşır; main'de akıllı hesap halefler |
| Geçişlilik yok | Halef yeniden paylaşamaz; bu yüzden denetçiler taşımaya dayanır | taşıma |
| OZ'nin benimsemesi | Bizim kontrolümüz dışında; benimsenene kadar değiştirilmemiş (vanilla) gözlemci sızıntısı sürer | upstream'de Profil A |
| Taşıma spam'i | Çöp `Allowed` izinleri taşıma maliyetini şişirir | izin listesi filtresi; deneme çalıştırması; geri kalanını halef karşılar |

**Level 3 (PQ-yerel yetki, Profil Q, sertifikalar, yönetişim).**

| Artık risk | Neden kalır | Onu daraltan |
|---|---|---|
| Denetlenmemiş PQ kütüphaneleri | RustCrypto `ml-dsa` 0.1.1 ve diğerleri denetlenmemiştir [V-A7, C] | denetim; vektörler; kütüphane çeşitliliği |
| Doğrulama hataları | t+1 ya da daha fazla düğümdeki bir hata sahtecilikleri kabul ederdi | iki uygulamanın uyuşması ya da kütüphane çeşitliliği |
| Münhasırlık yok | ECDSA permit'leri Profil Q'ya kadar bir KDA'nın yanında geçerli kalır | Profil Q; ertelenmiş münhasır varyant |
| KDA kapsamı | Konuşlu yolda imkânsız; bir akıllı hesapta sahip rotasyonu KDA'ları geri almaz | cüzdanlar KDA'ları listeler ve geri alır |
| Profil Q altında zincir üstü kapı | Host zinciri ECDSA'yı dondurana kadar sahte ECDSA işlemleri `allow` yapabilir, yetki devredebilir ya da herkese açabilir | host zinciri dondurması; önleyici emeklilik |
| Kısmi benimseme uçurumu | 5–8 uygulayan operatörle hizmet, koruma ortaya çıkmadan önce bozulur | B_Q'da önce taahhüt, sonra etkinleştirme |
| ECDSA KMS yanıtları | Herkese açık şifre çözme sonuçları ECDSA imzalı kalır (B7) | Zama'nın ML-DSA yol haritası |
| Kapalı kalma (fail-closed) kaynaklı dışarıda kalma | Hazırlıksız hesaplar B_Q'da erişimi kaybeder | bildirim, KPI, kurtarma yolları |
| T2 altında ECDSA halefi | Kendisi ECDSA köklü olan bir halef Q-günü zayıftır | PQ halefler |
| Sızmış sertifika | Erken ama planlı bir devir teslimi tetikler | çevrimdışı saklama |
| Yönetişim henüz PQ değil | PQ imzacılar ve onay konuşlu değil | yönetişim profili |

**Level'lar boyunca:**
- **Host zincirinin uzlaşması ve hesap kimlik doğrulaması** her şeyi sınırlar (sınır 3).
- **Inco** incelenmedi; bu yüzden onun için hiçbir uyum iddiasında bulunulmaz.
- **Fhenix**, Core'u ancak permit alıcısını da denetleyen bir ACL portuyla karşılayabilir.

---

## 10. Semih için açık sorular

Bunlar `DELIBERATION_SUMMARY.md` §(h)'deki sorulardır; yanlarında, siz karar verene kadar bu belgenin varsaydığı varsayılan yer alır.

| # | Soru | Burada varsayılan |
|---|---|---|
| 1 | **Üretim hattı.** Zama önerisi v0.13 backport'unu (0.4.1), 0.14 hattını (0.5.1) mı, yoksa önce main'i mi hedeflemeli? `latest-supported.json` v0.14.2'yi gösteriyor [V-A7] | Önce main; Level 0 için 0.4.1 zorunlu; herhangi bir 0.14.x önerisinden önce 0.5.1 |
| 2 | **Yükseltme koruması.** İlk önerinin içinde mi tutulmalı (hüküm: UUPS kayıt sözleşmeleri için Core MUST), yoksa Zama direnirse ayrılabilir bir commit olarak mı sunulmalı? Tasarımı gereği Core öncesi uygulamalara hızlı geri dönüşleri engeller | İçinde, Core MUST olarak |
| 3 | **Halefin kabulü.** Zorunlu kabul, G1 hakeminin "could" ifadesini geçersiz kılar. Bu, soğuk bir kurtarma anahtarının kurulumda bir işlem imzalaması anlamına gelir. Teyit ediyor musunuz? | Zorunlu |
| 4 | **D.** 7 günlük bir taban, varsayılan 7; hesap başına, 365 güne kadar yalnızca artırılabilir bir seçenekle. Kabul ediyor musunuz? | Evet |
| 5 | **Sertifikalar.** Açık bir zincir listesiyle, teyit edilmiş bir halef gerektirir ve ona bağlanırlar. Halefi olmayan kullanıcılar sertifika kullanamaz (doğrudan emekliye ayırırlar) ve özet taahhüdü (hash-commitment) biçimi ertelenmiştir. Kabul ediyor musunuz? | Evet |
| 6 | **Profil Q bildirimi.** 24 ay planlı artı iki acil durum tetikleyicisi mi, yoksa NIST IR 8547 ile hizalı bir tarih mi (2030/2035 [C])? | 24 ay |
| 7 | **Timelock gecikmesi.** Level 3 demosu ve talep için 7 gün; son durumda hakları genişleten değişiklikler için önerilen 14 gün? | Şimdi 7, son durumda 14 |
| 8 | **Adlar.** ERC başlığı "Decryption Authority Lifecycle". Extension adı "Retirement Certificate" (emeklilik sertifikası) mı, yoksa brief'teki gibi "Revocation Certificate" (geri alma sertifikası) mı? | "Retirement Certificate" |
| 9 | **KDA tanımlayıcıları.** Alan (domain) etiketi ve şema kimlikleri geçicidir. EIP-7932 ALG_TYPE ile hizalansın mı, yoksa özetten türetilmiş kimlikler mi korunsun? | Özetten türetilmiş, geçici |
| 10 | **Yanıt KEM'i.** Core aktarımdan bağımsız kalırken, zincir üstünde yayımlanan yanıtlar için ML-KEM-768 ya da üstü önerilsin mi (SHOULD)? | Evet, SHOULD olarak |
| 11 | **RPC yoğunlaşması.** Hüküm bunu genel ifadelerle Security Considerations (güvenlik değerlendirmeleri) bölümünde tutuyor. Herhangi bir yayından önce Zama'ya özel olarak da iletilmesini istiyor musunuz? Bu aşamada hiçbir şey gönderilmez | Yalnızca genel ifadeler |
| 12 | **Inco.** ERC üç sağlayıcılı bir uyum iddia etmeden önce kodu alınıp okunsun mu, yoksa Inco "incelenmedi" olarak mı kalsın? | "İncelenmedi" |
| 13 | **Getter değişikliği.** `getUserDecryptionDelegationExpirationDate` emekliye ayrılmış taraflar için 0 döndürür; bu, bir getter'ın anlamını docstring'iyle uyumlu biçimde değiştirir. Level 0'da kalsın mı? | Kalsın |
| 14 | İsteğe bağlı üçüncü bir Level 0 hedefi olarak, yalnızca zaman kalırsa derlenen **0.14 hattı (0.5.1)**? | İsteğe bağlı |

---

## 11. Faz 4: neler değişti (2026-10-21 – 2026-10-22)

Faz 4 tasarımı yerel zincirlerde ve sınırlandırılmış VPS'te daha ileri sınadı; hiçbir şey yayımlanmadı ve hiçbir
sağlayıcı hizmetiyle iletişim kurulmadı. Her görevin raporu `results/phase4/` altında, durumu
`results/phase4/STATUS.md`'de, kararları `DECISIONS_LOG.md`'de. Bu bölüm bunların mimaride neyi değiştirdiğini
kaydeder.

### 11.1 Standart bölündü

- **`erc/ERC-XXXX-decryption-authority-lifecycle.md`** artık kayıt (registry) tarafının standardıdır: Core (R, V ve O
  kuralları), E1 ve E2. Motivation'daki olgular `erc/assets/erc-XXXX/EVIDENCE.md`'ye atıf yapar; uygunluk kiti
  (conformance kit) de assets altındadır.
- **`docs/COMPANION_EXTENSIONS_AND_PROFILES.md`**, E3'ü ve H, Q, A profillerini tam normatif üslupla, ileride ayrı
  ERC'ler ve operatör profilleri için aday olarak tutar.
- `docs/ERC_SPLIT_MAPPING.md`, Faz 3 taslağının her kuralını, test durumunu ve sabitini yeni yerine eşler. ERC, iki
  yer tutucusu dışında eipw'den temiz geçer; sabitleri `cast` ile yeniden hesaplandı (D1).

### 11.2 EIP-7851 ve EIP-8298: host zincirinde anahtarı devre dışı bırakmak doğrulayıcıya ulaşmıyor

- **Açık [M-P4].** Simüle edilmiş bir EIP-7851 göstergesiyle (`0xef0101` ardından delegate), Zama'nın değiştirilmemiş
  doğrulayıcıları devre dışı bırakılmış kök anahtarı her istek yolunda kabul etti; hem `main`'de hem v0.13.8'de
  (P0.4). İmzayı, hesabın kodunu okumadan önce kurtarıyorlar (recover).
- **Neyin kapattığı.** Profil H'nin önce-kod sıralaması (H2): gösterge olağan koddur, dolayısıyla yalnızca ERC-1271
  sayılır. `enforce` altında kök anahtar reddedilir, bir ML-DSA-44 imzası `B_exec` 2.000.000 ile kabul edilir; H6
  eski (legacy) yolu reddeder; SDK ön denetimi de aynı sonuca varır.
- **Metin.** ERC ve eşlikçi belge göstergeyi olağan kod, bu tür hesapları ise göç etmiş sayar (Q4, Q5, Q7). SDK'nın
  `getAuthorityStatus` işlevi hesabın kodunu bildirir: `empty`, `eip7702`, `eip7851` ya da `regular` (P1.6).
- **EIP-8151** bu tür anahtarları zincir üstünde `ecrecover`'da durdururdu. Zincir dışı doğrulayıcılar imzayı kendi
  kodlarında kurtardığı için o da onlara ulaşmaz [I, EIP metinlerinden].
- **EIP-8298 (Faz 5, P0.3) [M-P5].** Bir cüzdanın olağan kodunu benimseyen bir EOA (`anvil_setCode` ile simüle edildi;
  hiçbir yanıt yeniden yazılmadı) aynı durumdadır. Değiştirilmemiş doğrulayıcılar eski kök anahtarını her yolda kabul
  etti; `enforce` onu reddetti ve cüzdanın ML-DSA-44 imzasını kabul etti; `getAuthorityStatus` `regular` bildirir.
  Benimsenen kod bir sözleşmenin kodundan ayırt edilemediği için Q5 artık olağan kodlu bir yetki verenin B_Q'daki
  kodunu okur (`results/phase5/P0_3_EIP8298.md`).

### 11.3 Fhenix ve Inco: Core sağlayıcıdan bağımsız

- **Fhenix CoFHE'ye port [M-P4] (P2.1).** Core, Fhenix'in host zinciri sözleşmelerinde (`cofhe-contracts`
  `b5c20ed`) mekanizması değişmeden çalışıyor:
  - her görünüm (view) rolü kapılı; izin (permit) rolü ve ACP paylaşım kaydı (share registry) dahil;
  - `TaskManager`'ın aktardığı her yetki verme (grant) yolu, aktardığı istekçi üzerinden kapılı;
  - yükseltme koruması yerinde.
  - **Fhenix'e özgü tek seçim R10'unki.** `TaskManager` yetki vermeleri, kullanım görünümünü ve oracle'ın izin
    denetimini hep kendisi olarak aktarır. Orada çağıranın kimliğine dayalı bir muafiyet, negatif testin gösterdiği
    gibi, emekliye ayrılmış bir hesap için hepsini geçirir; bu yüzden port, motora (engine) ayrı bir
    işlenen-denetimi (operand check) girişi verir.
  - TC1–TC12 ve TC6: 69 geçti, 4 atlandı (E1 ve E2 yok), üç koşu; 17 kapı mutasyonunun hepsi yakalandı.
  - TC3 iki yoldan sağlanıyor: Fhenix'in değiştirilmemiş sözleşmelerine karşı farksal (differential) bir fuzz ve
    Fhenix'in kendi eklenti (plugin) test takımı.
  - Fhenix'in yayımlanmış mock yığınında uçtan uca: 6/6.
  - **Şifre çözme hizmeti [V].** Fhenix'in `teecryptor`'ı izin görünümünü ve genel görünümü `TaskManager` üzerinden
    `latest`'te sorar. Eşik ağının dağıtıcısı (dispatcher) açık değil.
  - **Akılda tutulacak bir kısıt.** Fhenix'in `TaskManager`'ı EIP-170 sınırının 233 bayt altında; port 80 bayt
    bırakıyor.
- **Inco Lightning, okundu [V] (P2.2).** Core onun üzerine de mekanizması değişmeden ve daha basit oturur: kayıt ile
  motor tek sözleşme olduğu için muafiyet bir iç çağrı noktasıdır.
  - Bir port için iki uyarı. Olumsuzlanmış bir varlık denetimi (`require(!isAllowed(...))`, yinelenen girdileri
    reddeder) ham kalmalıdır: kapılanırsa bir girdinin yeniden kullanılarak dışa aktarılmasına izin verir. Inco'nun
    duraklatması (pause) görünümleri de kapatır; yönetişim profilinden farklı.
  - Kaynaklar BUSL-1.1 lisanslı; bu yüzden hiçbir şey projeye alınmadı ve her port özel kalır. Şifre çözme hizmeti
    açık değil. Hiçbir Inco kodu çalıştırılmadı.
- **Sağlayıcıdan bağımsız bir uygunluk kiti (P2.3).** TC1–TC12, TC17 ve TC19 için bağdaştırıcılarla (adapter)
  sürülen soyut bir Foundry takımı; artı TC13–TC15 için JSON fikstürleri ve bir denetleyici. Kayıtlı koşularda TC15
  fikstürü 35 uyumlu hücre ve 8 ihlal buluyor; ihlallerin hepsi değiştirilmemiş doğrulayıcının (saklanmış sonuçları
  yeniden sunuyor ve emeklilik retlerini yeniden deniyor).
  - Zama `main` ve v0.13 hattı geçer: 17 geçti, 1 atlandı (zincir üstü izin yok). Fhenix portu geçer: 14 geçti, 4
    atlandı.
  - Zama'nın kaydından altı kapının herhangi biri çıkarılınca kit başarısız olur.
  - Kit, ERC'nin assets'indedir.

### 11.4 Amsterdam: ölçüldü; taşıma ve dağıtım için anlamı

- **Takvim (schedule) [M-P4] (P2.4).** Bir Foundry nightly sürümünün anvil'i Amsterdam'ın durum oluşturma
  (state-creation) fiyatlandırmasını uygular. Zama'nın değiştirilmemiş ACL v0.7.0'ında yeni bir çift için tek bir
  `allow` orada 140.780 gaz tutar; Sepolia'daki rakamın tam aynısı, Osaka'da ise 58.360. Bir depolama yuvası oluşturan
  bir işlem yaklaşık 82.400 gaz daha pahalı (`allow`, `retireAccount`, `designateSuccessor` ve `raiseSuccessorDelay`
  için tam 82.420).
- **Yaşam döngüsü maliyetleri.**

  | İşlem | Osaka | Amsterdam |
  |---|---|---|
  | `retireAccount()` | 50.099 | 132.519 |
  | Bir taşıma (carry) paketinde tek handle | 31.385 | 119.505 |
  | E1 kurulumu (designate, accept, confirm) | 159.276 | 326.100 |

  Faz 3'ün tahminleri işlem başına 5.600–5.700 gaz yüksekti.
- **Tek işlemde en büyük taşıma.** Tam 2^24 gaz limitinde Osaka'da 524, Amsterdam'da 137 handle [M]. Proxy gazın
  yalnızca 63/64'ünü iletir; doğrusal bir uydurma (fit) bunu kaçırır.
- **EIP-8037 işlem kuralını değiştiriyor** (Last Call). 2^24 sınırı yalnızca yürütme gazına uygulanır; durum gazı
  (state gas) `tx.gas`'ın sınırı aşan kısmından gelir. O kurala göre yürütme gazı açısından yaklaşık 765 handle
  sığar; bloğun gaz limiti bağlarsa daha az [E]. Yerel zincirin havuzu (pool) hâlâ tüm `tx.gas`'ı sınırladığı için
  bu kısım bir makbuz (receipt) ölçümü değil.
- **Dağıtım.** Core içeren ACL sürümleri Amsterdam'da dağıtım için 18–26M gaz ister (Zama'nın kendi v0.7.0'ı 17M).
  Bu yalnızca, kod yatırmayı (code deposit) durum gazına koyan EIP-8037 kuralıyla geçerlidir. Tüm işleme Osaka
  tarzı sınırı uygulamayı sürdüren bir zincir bunları tek işlemde dağıtamazdı.
- **Bir yöntem düzeltmesi.** forge 1.8.5'in `vm.cool`'u depolama yuvalarını soğutur ama hesapları soğutmaz. Bu
  yüzden Profil A'nın operatör kapısı, kayıt soğukken +7.781 değil +12.804 gaz tutar; diğer farklar etkilenmez (D68).

### 11.4b Son durum prototipleri (P3)

- **Operatör onayı zincir üstünde karşılanabilir.** Bir prototip timelock, kayıt yükseltmesini yalnızca 13
  operatörden en az 9'unun zincir üstünde doğrulanan ML-DSA-44 imzalarıyla yürütüyor. Bu, Osaka'da 11,5M,
  Amsterdam takviminde 11,7M gaz tutuyor; 13 imzanın tamamı bile 2^24 altında tek işleme sığıyor [M, yerel].
  Doğrulayıcı denetlenmemiş; her operatör anahtarının yayımlanması 20.545 baytlık bir sözleşme.
- **Yanıt kanalı KEM'inin maliyeti zaman değil bayt.** ML-KEM-768 işlemleri onlarca mikrosaniye sürüyor. Yayımlanan
  her yanıt ML-KEM-512'ye göre 320 bayt büyüyor; Q6'nın önerisi geçerli.
- **Bağlayıcı verimi** park edildi: paylaşılan VPS'te bin eşzamanlı istek, onay ya da ayrı bir makine gerektiriyor.

### 11.5 Sürüm treni

- **v0.14.4 üzerinde Core'lu ACL 0.5.1 (P1.5).** Tüm test takımı 759/759 geçti, üç kez. U6: 0.4.0, 0.4.1 ve 0.5.0,
  durum ve uygulama korunarak ona yükseltiliyor. Bizim 0.4.2'miz (E1) reinitializer 7'de çakışır ve E1'i düşürürdü;
  OpenZeppelin'in doğrulayıcısı da aynısını söylüyor.
- **v0.13 hattında E2 (P1.3).** ACL 0.4.3 629/629 geçti ve ERC'nin sertifika vektörü birebir üretiliyor.
- **Denetim.** `scripts/check_reinitializer_order.py` her sürümü git'ten okur ve olası her yükseltme yolunda
  reinitializer'ın artmasını ister. Bugün Zama'nın öngörülen sonraki sürümlerine karşı 3 ihlal buluyor; öneriyle 0.
- **Öneri** §5.5'in numaralandırma kuralını değiştirir:
  - yaşam döngüsü sürümlerini 1000'den yukarı numaralandır (`1000 + 100 × hat + 10 × (level + 1)`); Zama'nın kendi
    sürümlerine yaklaşık 990 numaralık yer kalır;
  - hiçbir zaman daha düşük bir yaşam döngüsü level'ına yükseltme yapma;
  - denetimi CI'da çalıştır.

  §5.5'in 4. maddesinin yerini alır. Henüz hiçbir şey yeniden numaralandırılmadı; bu, 15. açık soru.
- **Dağıtılmış olan** (salt okunur, 2026-10-22): mainnet ve Sepolia hâlâ ACL v0.4.0 çalıştırıyor.

### 11.6 Eklenen doğrulayıcı ve oracle kanıtı

| Ne | Sonuç | Görev |
|---|---|---|
| Görünüm çağrıları başarısız olduğunda V1 (TC13) | Değiştirilmemiş doğrulayıcılar, emekliye ayrılmış bir özneyi her yolda, iki hatta da reddediyor (her biri 3 koşu): JSON-RPC ve HTTP hatalarında, kopan bağlantılarda, zaman aşımlarında, bozuk JSON'da, boş ya da kesik sonuçlarda, revert'lerde ve aralıklı hatalarda. İddia, görünüm yanıtlarının katı biçimde çözülmesine (decode) bağlıdır; V1 artık bozuk yanıtı tanımlıyor | P0.1 |
| Karar gecikmesi (TC14) | İki hatta da L = 0 (her görünüm `latest`'te); emekliye ayırma bloğundan sonra reddediliyor; yeniden başlatma ya da önceden gönderilmiş istek yeniden denetleniyor; kopyadan (replica) karar yok | P0.2 |
| Saklanmış sonuçlar ve kesin retler (V6, V7, TC15) | Değiştirilmemiş haliyle `main` bağlayıcı uç noktası (endpoint) ve relayer, emekliye ayırmadan sonra saklanmış bir sonucu yeniden sunuyor; bir emeklilik reddi türsüz olarak yeniden deneniyor. H7 ve H5 (Level 1) kesin olarak reddediyor. Kitin TC15 fikstürü: 35 hücre uyumlu, 8 ihlal, hepsi değiştirilmemiş doğrulayıcının | P0.3, P2.3 |
| K8 ile doğrulayıcıda E3 (TC20) | Dört ML-DSA kütüphanesinin her biri 631/631 Wycheproof vektöründen ve sunduğu her ACVP sigVer vektöründen geçiyor. Uzlaşma (agree) kipi enjekte edilen bir hatayı reddediyor. Düğüm başına tek kütüphaneyle hiçbir sahtecilik t + 1'e ulaşmıyor | P1.1 |
| Doğrulayıcıda Profil Q (TC22) | 13 operatörün ML-DSA-65 beyanlarından Q1, eşik 9. Yol başına Q4 reddi ve Q5 kesimi. 13 gerçek doğrulayıcıyla, uygulayan sayısı k = 0, 4, 5 ve 8 iken bir ECDSA isteği yine serbest bırakıldı, k = 9 ve 13 iken reddedildi; diğer k değerlerini eşik kuralı veriyor | P1.2 |
| Hazırlık (Q2) | Mainnet'teki 1.713 aktif şifre çözücünün 0'ının kanıtlanmış kuantum sonrası (post-quantum) uyumlu bir yolu var | P1.2 |
| Profil H `enforce`, gerçek dünyadaki etkisi | EIP-7702 ile delegate edilmiş 2.220 son hesaptan 680'i (tüm 12.730 son hesabın %5,3'ü; aktif olanların %6,0'ı) kök anahtar imzası için reddedilirdi | P2.5 |

### 11.7 Yeni artık riskler

| Artık risk | Neden kalıyor | Neyin daralttığı |
|---|---|---|
| EIP-7851 ya da EIP-8298 hesabının eski anahtarını değiştirilmemiş doğrulayıcıların kabul etmesi | Doğrulayıcılar imzayı kodu okumadan önce kurtarıyor | n−t operatörde Profil H (H2, H6) |
| Bozuk görünüm yanıtları | Doğrulayıcı Core'u ancak görünüm yanıtlarını katı biçimde çözerse devralıyor (V1'in tanımı) | Her doğrulayıcı istemcisinde katı çözme |
| Saklanmış sonuçların yeniden sunulması | Değiştirilmemiş bileşenler emekliye ayırmadan sonra yeniden sunuyor | V6, H7 |
| `enforce`, delegate edilmiş hesapların kök anahtar imzalarının yaklaşık %5–6'sını reddediyor | Delegate'leri kök anahtar için ERC-1271'e yanıt vermiyor ya da yalnızca kendi zarflarına yanıt veriyor | Önce H8'in gölge (shadow) kipi, etkisi yayımlanarak |
| Profil Q'nun kısmi benimseme uçurumu | 8 ya da daha az uygulayan operatörle bir ECDSA isteği yine serbest bırakılıyor | Q1'in önce-taahhüt-sonra-etkinleştir prosedürü |
| Amsterdam maliyetleri | Emekliye ayırma ve halef kurulumu yaklaşık 2–2,7 kat, taşıma yaklaşık 3,8 kat pahalı; tüm işlem gazının sınırlandığı yerde bir işlem yaklaşık 137 handle taşıyor | Parçalı taşımalar; EIP-8037'nin işlem kuralı |
| Sürüm treni çakışmaları | Öngörülen sonraki sağlayıcı sürümleri yaşam döngüsü reinitializer'larıyla çakışıyor | Numaralandırma önerisi ve CI denetimi |
| Port kısıtları | Fhenix'in `TaskManager`'ında 80 bayt kaldı; Inco'da bir varlık denetimi ham kalmalı ve duraklatma görünümleri kapatıyor | Olumsuzlanmış ya da duraklatılmış her denetimin sağlayıcı başına incelenmesi |

Eklenen açık soru:

| # | Soru | Burada varsayılan |
|---|---|---|
| 15 | **Yeniden numaralandırma.** Her fikstürün ve yükseltme testinin yeniden yazılmasını gerektiren, 1000 tabanlı yaşam döngüsü reinitializer'ları herhangi bir öneriden önce benimsensin mi? | İlk öneriden önce benimsensin; henüz yapılmadı |

12. açık soru (Inco) kayıt açısından yanıtlandı: okundu, mekanizması değişmeden eşleniyor (P2.2).

## 12. Faz 5 (2026-10-22)

Faz 5 belgelerdeki üç ifadeyi düzeltti (A Bölümü) ve kuantum sonrası yolu uçtan uca kurdu (B Bölümü). Önceki gibi yerel
zincirlerde ve sınırlandırılmış VPS'te çalıştı, hiçbir şey yayımlamadı ve hiçbir sağlayıcı hizmetiyle iletişim kurmadı.
Raporlar: `results/phase5/`; durum `STATUS.md`; D90'dan başlayan kararlar, `DECISIONS_LOG.md`.

### 12.1 A Bölümü: üç düzeltme

- **Bir hesabın neyi kaldırabildiği (P0.1).** Bir hesap şunları yapabilir:
  - verdiği bir yetki devrini geri alabilir ya da kısaltabilir;
  - `main`'de, başlangıç zamanı seçilen bir zamandan önce olan imzalı izinlerini geçersiz kılabilir.

  Kendi yetkisini bitiremez, handle başına verilmiş bir izni geri çekemez, herkese açık bir şifre çözmeyi geri alamaz,
  anahtarının yeni imzalı izinler imzalamasını durduramaz. Artık her belge bunu söylüyor.
- **TC15 (P0.2).** Değiştirilmemiş doğrulayıcı, Core'un zorunlu kuralları V1–V5'i karşılıyor. Hijyen profili (H5, H7)
  gerektiren V6 ve V7 önerilerini karşılamıyor. TC15'in her anılışı artık ya kitin sayılarını veriyor, 35 hücre uygun, 8
  ihlal (hepsi değiştirilmemiş doğrulayıcının), ya da yalnızca testi tanımlıyor.
- **EIP-7851'in yanında EIP-8298 (P0.3).** Bir cüzdanın olağan kodunu benimseyen bir EOA, doğrulayıcılar için devre dışı
  bırakılmış bir göstergeyle aynı durumdur:
  - değiştirilmemiş doğrulayıcılar eski kök anahtarını her yolda kabul etti;
  - Profil H'nin önce-kod sıralaması onu reddetti;
  - `getAuthorityStatus` `regular` bildiriyor.

  Connector 28/28 satır, yerel 20 satır, her biri üç koşu (§11.2).

### 12.2 B Bölümü: dört özellik olarak hedef

Eski ECDSA anahtarının bir saldırganın elinde olduğu varsayıldığında, bir hesap şu koşullarda kuantum sonrası yolu
tamamlamış sayılır:
1. hiçbir doğrulayıcı o anahtara dayanarak bir şey vermez;
2. o anahtar zincir üstünde hiçbir hak yaratmaz ya da uzatmaz;
3. sahip, geçmiş ve gelecek verileri yalnızca kuantum sonrası bir imzayla çözer;
4. hiçbir yükseltme bunu kuantum sonrası yetkilendirme olmadan geri alamaz.

Yolun tamamını `docs/PQ_TAM_YOL_TR.md` (İngilizcesi: `docs/PQ_FULL_PATH.md`) anlatıyor.

### 12.3 B Bölümü: ne çalıştırıldı

**Parçalar:**
- bir ML-DSA-44 test cüzdanı (ERC-1271 ve herkesin iletebileceği bir `execute`; dağıtılmış olarak ya da EIP-7702
  delegate'i olarak);
- Level 3 kayıt sözleşmesi;
- Faz 5 kms-worker'ı (Level 3 ile B_Q'da Q5);
- taşıma aracı, watchtower, SDK ve kanarya.

**İki tatbikat,** her biri üç koşu:
- VPS'te connector tatbikatı: koşu başına 258 istek satırı ve 40 işlem;
- M1'de, Osaka ve Local-Amsterdam altında yerel tatbikat: çatal başına 81 satır.

Her satır her koşuda tasarımla eşleşti [M].

| Yol | Zincir dışı (1) | Zincir üstü (2) | Süreklilik (3) |
|---|---|---|---|
| **B1** taşı, sonra emekliye ayrıl | sağlanıyor | sağlanıyor | sağlanıyor; eski adrese sonradan verilen izinler etkisiz |
| **B2** halef, sonra emeklilik ya da sertifika | sağlanıyor | sağlanıyor | sağlanıyor; sonradan verilen izinler halefe ulaşıyor |
| **B3** cüzdana EIP-7702, sonra EIP-7851 ya da EIP-8298 (benzetim) | anahtarın kendi imzaları için sağlanıyor; önceki yetki devirleri geri alınana kadar geçerli | anahtarın işlemlerini kabul eden bir zincirde **sağlanmıyor** | eski anahtar hesabı emekliye ayırana kadar sağlanıyor |

**Yükseltme güvenliği (4),** kayıt sözleşmesi operatör onaylı bir sahibin altındayken (13'te 9 ML-DSA-44, 7 gün)
yerel tatbikatta sağlandı:
- 8 imza geri döndü;
- Core içeren bir sürüm 9 imzayla korumadan geçti, kanarya yeşil kaldı;
- Core içermeyen bir sürüm 9 imzayla korumada geri döndü.

Matris: `results/phase5/PQ_DRILL_MATRIX.md`; yol raporu: `results/phase5/B1_B6_PATHS.md`.

### 12.4 B Bölümünün mimaride değiştirdikleri

- **B3, Core emekliliğiyle birleşmiyor.** Emeklilik hesabın yetkisini bitirir; yerinde geçişte cüzdan hesabın
  kendisidir. Eski anahtar bir B3 hesabını emekliye ayırdıktan sonra sahibin istekleri reddedildi.
  - Kuantum sonrası bir anahtar ve emeklilik isteyen bir hesap başka adrese geçer (B1, B2).
  - Yerinde kalan bir hesap, eski anahtarını durdurmak için host zincirine bağlıdır.
- **Önerilen rota: taşı, sonra bir halefle emekliye ayrıl.** Taşınan geçmiş cüzdanın kendisinindir, bu yüzden beyan
  edilmiş bir imzacı (E3) onun için çalışır; sonradan verilen izinler cüzdana halef yolundan ulaşır.
- **Bir halefin kendi beyan edilmiş imzacısı, selefinin handle'larına ulaşmaz** (D98). Aday kural, S9'un yasakladığı
  geçişliliği geri getirirdi. Tamamlayıcı belge onu reddedilmiş olarak kaydediyor (K3, Gerekçe).
- **Q5, B_Q'daki durumu okuyor** (D99, `lifecycle/phase5-connector` dalı, `a4416155`).
  - Bir halef, ancak aynı halef B_Q'da onaylanmışsa sayılır.
  - Kodu şimdi olağan olup B_Q'da boş ya da bir gösterge olan bir yetki devredene kesim uygulanır.
  - İkisi de kapalı kalarak başarısız olur. Önceki işçi Q altında halefleri tamamen reddediyordu: bir erişilebilirlik
    boşluğu, bir delik değil.
- **Profil Q'nun uçurumu tam senaryoda da geçerli.** 13'te 8 uygularken bir ECDSA isteğini kalan 5'i serbest bıraktı;
  9'da istek her koşuda alıkonuldu.
- **Canlı hat (`v0.13.8`) emekliye ayırabiliyor, halef atayabiliyor (ECDSA halefleri) ve taşıyabiliyor; ama kuantum
  sonrası bir anahtarla çözemiyor.** Gateway'i kullanıcı ve temsilci imzalarını yalnızca ECDSA ile denetliyor ve ERC-1271
  yolu yok (B9).
- **Maliyetler (B8).**
  - Zincir başına bir kez: zincir üstü bir ML-DSA-44 doğrulayıcısı, 5,17M gaz (Osaka).
  - Hesap başına bir kez: anahtar, 4,43M (Local-Amsterdam'da 31,9M).
  - İstek başına: bir ERC-1271 denetimi doğrulayıcının düğümüne yaklaşık 1,23M gaza mal oluyor; E3 yaklaşık 245 µs.
  - EIP-8355 denetimi yaklaşık 13.000–15.000 gaza indirirdi [E].
- **Boşluk haritası (B7)** KMS'in, yardımcı işlemcilerin ve bileşenlerin kendi imzalarını, girdi kanıtlarını ve
  yönetişimi klasik bırakıyor. Hesap düzeyindeki hiçbir adım bunları kapatmıyor.

### 12.5 Yeni artık riskler

| Artık risk | Neden kalıyor | Neyin daralttığı |
|---|---|---|
| Yerinde geçişten sonra eski anahtar zincir üstünde işlem yapıyor | Host zinciri, EIP-7851 ya da EIP-8298 uygulanana kadar onun işlemlerini kabul ediyor | Başka adrese geçmek (B1, B2); host zinciri; Profil Q, kökü ECDSA'ya dayanan okuyucular için etkileri daraltıyor |
| Kodunu B_Q'dan önce benimsemiş bir hesap için, eski anahtarın B_Q'dan sonra yaptığı bir yetki devri | B_Q'daki kod zaten olağan, bu yüzden Q5 onu bir sözleşmeninkinden ayıramıyor | Anahtarın onu gönderemeyeceği EIP-8298 uygulaması (Q7) |
| Benimsenmiş kodun B_Q'dan sonraki kendi beyanları Q altında reddediliyor | Doğrulayıcı benimseme bloğunu belirleyemiyor, bu yüzden Q5 kapalı kalarak başarısız oluyor | Bir kayıt sözleşmesi getter'ı ya da dizinlenmiş bir benimseme bloğu |
| Yönetişim devri bir ECDSA işlemi | Bugünkü sahip, sahipliği operatör onaylı sözleşmeye devretmeli | Bunu bugünkü anahtarlar güvendeyken yapmak |
| Yükseltme koruması beyanları denetliyor | Kazara yapılan bir sürümü durdurur, yalan söyleyeni durdurmaz (U7) | Her sürümün incelenmesi; kanarya |

Eklenen açık soru:

| # | Soru | Burada varsayılan |
|---|---|---|
| 16 | **Yetki devri geçmişi getter'ı.** Kayıt sözleşmesinden, bir yetki devrinin son değiştiği bloğu ve bir hesabın belli bir bloktaki halefini veren bir görünüm istensin mi? Böylece Q5 depolama okumasına ya da geçmiş duruma ihtiyaç duymaz | Core ile değil, Profil Q ile önerilsin |

---

## Ek A. Girdiler arasındaki çelişkiler ve nasıl çözüldükleri

Kural: girdiler çeliştiğinde bu belge `DELIBERATION_SUMMARY.md`'yi izler. İki girdi aynı olguyu farklı etiketlediğinde düşük olan etiket kullanılır.

| # | Konu | Bir girdi diyor ki | Bir diğeri diyor ki | Burada izlenen |
|---|---|---|---|---|
| A1 | V1'in sürümü | Brief (§2) tasarım belgesine v0.2 diyor | Tek yerel kopya v0.1 (frontmatter "Taslak v0.1"); A1 ve A7 v0.1'i okudu | Okunduğu gibi v0.1 |
| A2 | Devredilmiş view'larda sözleşme rolü | DESIGN_REVIEW §6.2 yalnızca yetki devredeni ve delegeyi denetler | A2, koordinatör ve A7: sözleşme rolü de denetlenmelidir | Denetlenir (D4) |
| A3 | Halefin kabulü | G1 hakemi: isteğe bağlı ("could"); DESIGN_REVIEW R3'te kabul adımı yok | A4 ve A7: zorunlu | Zorunlu, bir işlem olarak (D11); açık soru 3 |
| A4 | Yükseltme koruması | A3: öneride isteğe bağlı, depolama konumunu kontrol eden ve gecikmeli bir kaçış kapısı olan bir Core SHOULD. Koordinatör: bir ERC-165 kontrolü | A7: UUPS için Core MUST, iki kontrol de, kaçış kapısı yok | A7 (D7); açık soru 2 |
| A5 | Yerel ML-DSA ve `ecrecover` | DESIGN_REVIEW ve G1 raporu: ML-DSA-44 35–82 µs sürer ve connector'ın 172–178 µs'lik `ecrecover`'ından "daha ucuzdur"; A1 ve A2 35–82 µs'yi tekrarlar | A5 ve A7 (K4): soğuk 82–85 µs ve KDA yolunda 84–89 µs; buna karşılık 177–213 µs (k256) ve 53–55 µs (libsecp256k1) | A5'in sayıları; genel bir "ECDSA'dan ucuz" iddiası yok (§7c) |
| A6 | ML-DSA-65 calldata rakamının etiketi | G1 raporu 234.392 gas'ı ölçülmüş olarak listeler | A5: bir ölçüm değil, inceleyici 03'ün uydurulmuş (fitted) formülünden gelir (`15,000 + 64 × bytes`) | [E] olarak ele alındı; metin gövdesinde kullanılmadı |
| A7 | Core boyutu | ~55 satır (DESIGN_REVIEW, G1 raporu, A6) | Sözleşme denetimi, koruma, ERC-165, tipli hatalar ve getter eklendikten sonra hat başına ~75–90 satır (DELIBERATION_SUMMARY) | 75–90 satır [E] |
| A8 | ERC-1271 bütçe varsayılanı | DESIGN_REVIEW R5: varsayılanı 250k olan bir yürütme bütçesi (test 1b'si ≥ 1,4M kullanır); A3: 1,6M | A5 ve DELIBERATION_SUMMARY: B_exec = 2.000.000 | 2.000.000 |
| A9 | Yeniden deneme sınırı | Brief, DESIGN_REVIEW, A1: yeniden denemeler "toplam gas ile sınırlı" | DELIBERATION_SUMMARY: en fazla 2 deneme, ikincisi en az bir blok sonra | ≤ 2 deneme (sınırı bu uygular) |
| A10 | Profil Q bildirimi | A1 ve A5: ≥ 180 gün; A3: ≥ 6 ay; A2: yıllar öncesinden, NIST IR 8547 ile hizalı, ≥ 14 günlük acil öne çekmeyle | A6 ve DELIBERATION_SUMMARY: ≥ 24 ay, artı iki acil durum tetikleyicisi | ≥ 24 ay; açık soru 6 |
| A11 | Beyan edilmiş imzacı | A1: kayıt sözleşmesi durumu, geri düşürmeye kapalı (no-downgrade), ERC-165 `0x39bfd16c`. A2 ve A6: olgunlaşmalı beyan ve temizleme, geri düşürmeye kapalı | A5 ve A7: bir KDA yetki devri, kayıt sözleşmesi durumu yok, olgunlaşma yok, münhasırlık ertelendi | KDA (D15) |
| A12 | Sertifika tasarımı | A1: kayıt sözleşmesi başına alan, `RetireAccount(address account)`, ERC-165 `0x8239e188`. A2, A4, A5: mevcut ve gelecekteki zincirlerde geçerli. A4: bir PQ özet taahhüdü biçimi; sertifikalar asla halef adı vermez. A6: varsayılan olarak açık bir `requireSuccessor` bayrağı | A7: halef zorunlu **ve kayıt sözleşmesince uygulanır**, açık zincir listesi, zincirden bağımsız alan, ERC-165 `0x4b9ec076` | A7 (D16). Sertifika halefin adını yalnızca zaten teyit edilmiş olana bağlanmak için verir; asla halef atamaz |
| A13 | Extension numaralandırması ve kimlikleri | A1: E1 `0x689e3376` (kabul fonksiyonu yok). A2, beyan edilmiş imzacıyı E2, sertifikayı E3 olarak numaralandırır | DELIBERATION_SUMMARY: E1 `0x7dc5e209` (+ `0xc61ca396`), E2 = sertifika `0x4b9ec076`, E3 = KDA | DELIBERATION_SUMMARY |
| A14 | Suspended durumu | A2: isteğe bağlı bir vasi (guardian) uzantısı | A1, A3–A7: yok | Yok (D2) |
| A15 | Neden kodu | A4 ve A5: olayda; A3: isteğe bağlı, Core dışında | A6 ve A7: yok | Yok (D3) |
| A16 | Zincirler arası birleşim; değiştirilemez kayıt sözleşmesi; kayıt sözleşmesi düzeyinde kullanımdan kaldırma | A2 üçünü de son durumun parçaları olarak önerir | A7: birleşim reddedildi; değiştirilemez kayıt sözleşmesi ve kullanımdan kaldırma ertelendi | Reddedildi / ertelendi (§7) |
| A17 | Ham getter'lar | A4: bitiş getter'ını, kütüphane sarmalayıcısı `FHE.getDelegatedUserDecryptionExpirationDate`'i ve `allowedTransient`'ı denetle | A7: ACL bitiş getter'ını denetle; `allowedTransient`'ı ham bırak. **Koordinatör tarafından çözüldü [V-CV]:** kütüphane sarmalayıcısı ayrı bir değişiklik gerektirmez, çünkü `FHE.getDelegatedUserDecryptionExpirationDate` (`library-solidity/lib/FHE.sol:8310-8316`), ACL getter'ını çağıran (`Impl.sol:1012-1018`) `Impl.getUserDecryptionDelegationExpirationDate`'i çağırır. Dolayısıyla ACL getter'ını denetlemek sarmalayıcıyı da denetler | A7 (D6); açık soru 13 (yalnızca getter anlamı) |
| A18 | Timelock gecikmesi | A1: ≥ 7 gün; A2: 14–30 gün | DELIBERATION_SUMMARY: demo ve talep için 7 gün, hakları genişleten değişiklikler için 14 RECOMMENDED | DELIBERATION_SUMMARY; açık soru 7 |
| A19 | Mock'un imza yolu | A1: imza kontrolü "yorum satırına alınmış"; A4: "imza yolu yok" | A7 (K1): yorum satırındaki blok ölü bir kopyadır; canlı yol yalnızca 65 baytlık ECDSA doğrular | A7. Sonuç değişmez: mock ERC-1271'i, geçerlilik pencerelerini ya da kod-öncelikli doğrulamayı test edemez |
| A20 | Level 1'in test edildiği yer | Brief: ML-DSA-44 ERC-1271 hesabı "mock'ta" şifre çözer | A7 (K7): mock'ta imkânsız; ortak crate ve connector test düzeneklerini kullan | A7 (D27) |
| A21 | Level 0 hedef hattı | Brief ve DESIGN_REVIEW: 0.4.1 backport'u | A3: Core bir sonraki üretim hattıyla, muhtemelen 0.14.x ile gitmeli | 0.4.1 zorunlu artı 0.5.1 isteğe bağlı (D25); açık sorular 1 ve 14 |
| A22 | 0.15 hattındaki sürümler | A3: "0.6.0/7 (0.15.x)" | A7 (K5): v0.15.0-0'da hâlâ 0.5.0/6 var; 0.6.0/7 v0.15.0-3'te (bir ön sürüm) ortaya çıkar | A7 |
| A23 | `TaskManager` satır numaraları | Koordinatör: `isAllowed` iletimi `:972-974`'te, permit iletimi `:1090-1093`'te | A7: `:973-975` ve `:1091-1093` | A7 |
| A24 | KMS'te daha yüksek kategorili KEM'ler | A2: ML-KEM-1024 ve P-384 ile bir bileşik (composite) mevcut, ama yedeklemeler için (`encryption.rs`) | A3: imza-şifreleme (signcryption) zaten ML-KEM-1024+P-384'ü destekliyor (`signcryption/common.rs`) | Hakem tarafından yeniden doğrulanmadı ve hiçbir hüküm buna dayanmıyor. Bu belge yalnızca kullanıcı yanıt kanalının ML-KEM-512 olduğunu belirtir [V-A7] |
| A25 | Atamada watchtower tetikleyicisi | A4 ve A6: watchtower beklenmedik bir atamada emekliye ayırır | A7 (K9): teyit edilmiş bir halef varken atama revert eder; halef yoksa E2 yürütülemez | E2 tetikleyicileri atamayı kapsamaz; beklenmedik bir atama, sahibi doğrudan taşımaya ve emekliye ayırmaya yöneltir |
| A26 | Doğrulayıcı kuralı V6 | A1: Core'da SHOULD, H'de MUST; A4: her doğrulayıcı için MUST | DELIBERATION_SUMMARY: Core'da SHOULD, Profil H'de MUST | DELIBERATION_SUMMARY |
| A27 | Yetki verme yolu kodu | DESIGN_REVIEW §6.2: `allow`, `allowForDecryption` ve `allowTransient` değişmeden kalır | DELIBERATION_SUMMARY c.6: yalnızca başarısızlık dalları değişir ve tipli bir `SenderRetired` hatasıyla geri döner (revert) | DELIBERATION_SUMMARY |
| A28 | Halef fonksiyonu adı | DESIGN_REVIEW: `resignSuccessor(account)` | DELIBERATION_SUMMARY: `resignSuccession(address account)` | DELIBERATION_SUMMARY |
| A29 | Sayım medyanları | DESIGN_REVIEW ve G1 raporu: medyan 12, p99 127 | `aggregate.json` ayrıca medyan 11, p99 129 bildirir | Çelişki değil: 12/127, 12.714 "gerçek" uç hesabı kapsar; 11/129 ise 6 operasyon ve test hesabı dahil 12.720 hesabın tümünü kapsar. Bu belge 12/127'yi kullanır |

---

**Üç sınır, bir kez daha:**
1. önleyicidir, geri alma değildir;
2. yalnızca oracle erişimini keser;
3. bulunduğu zincirin yönetişimi kadar kesindir.
