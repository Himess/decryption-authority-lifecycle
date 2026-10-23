# Şifre çözme yetkisi için tam kuantum sonrası yol

Durum: araştırma sonucu, 2026-10-22. Faz 5'in B Bölümü. Kanıtlar: `results/phase5/` (etiketler: [M] ölçüldü, [V] kodda
okundu, [I] çıkarım, [E] tahmin; kanıt sınıfları Mock, Connector, Local-Amsterdam, Design). İngilizce sürüm:
`docs/PQ_FULL_PATH.md`.

Bu belge, Zama'nın fhEVM'indeki bir hesabın şifre çözme yetkisini bir ECDSA anahtarından kuantum sonrası bir imzaya
taşımak için neler gerektiğini anlatır:
- hangi tarafın ne yapması gerektiğini;
- bunların hangi sırayla olabileceğini;
- maliyetlerini;
- açık kalanları.

Belirtilen varsayımlar altındaki özellikleri tarif eder. Hiçbir yapılandırmanın her saldırıya karşı güvenli olduğunu
iddia etmez.

## 1. Hedef

Hesabın eski ECDSA anahtarının başka birinin elinde olduğunu varsayalım. Aşağıdaki dört özelliğin dördü de sağlandığında
hesap **kuantum sonrası yolu tamamlamış** sayılır:

1. **Zincir dışı.** Hiçbir doğrulayıcı, eski anahtara dayanarak hiçbir şey vermez: onunla imzalanmış hiçbir istek, izin
   ya da yetki devri kabul edilmez.
2. **Zincir üstü.** Eski anahtar hiçbir hak yaratamaz ya da uzatamaz. Önceden planlanmış devrin ötesinde hiçbir izin
   verme, yetki devri, herkese açma, halef değişikliği ya da sertifika üretemez.
3. **Süreklilik.** Hesabın geçmiş ve gelecek verileri, sahibi tarafından yalnızca kuantum sonrası bir imzayla
   çözülebilir kalır.
4. **Yükseltme güvenliği.** Kayıt sözleşmesi, kuantum sonrası yetkilendirme olmadan 1–3 numaralı özellikleri geri
   alacak biçimde yükseltilemez. Bu yetkilendirme ML-DSA imzalı operatör onayıdır; yanında yükseltme koruması ve
   kanarya bulunur.

**Kapsam dışı:**
- şifreli metinlerin kendi gizliliği (TFHE);
- taşıma ve yanıt şifrelemesi (ML-KEM).

İkisini de boşluk haritası kaydeder (§8).

## 2. Yapı taşları

Bunların hepsi bu projede kod olarak var ve çalıştırıldı [M]. Hiçbiri bir Zama sürümünde yok.

| Yapı taşı | Ne yapar | Nerede çalışır |
|---|---|---|
| **Core** | `retireAccount()` bir hesabın şifre çözme yetkisini kalıcı olarak bitirir: izinleri, yetki devirleri ve imzalı izinleri sayılmaz olur, sonraki izin verme çağrıları geri döner (revert). Bir yükseltme koruması, Core'u içermeyen bir uygulamayı reddeder | ACL (kayıt sözleşmesi) |
| **E1, halef** | Hesap bir halef atar, halef kabul eder, bir bekleme süresi D geçer (testlerde 7 gün), hesap onaylar. Hesap emekliye ayrıldıktan sonra halef onun tanıtıcılarını (handle) okur | ACL |
| **E2, sertifika** | Önceden imzalanmış bir emeklilik; herhangi biri (bir watchtower) onu sonra zincire iletebilir | ACL, watchtower |
| **Profil H** | Sözleşme hesapları için doğrulayıcı kuralları. Önce imzacının koduna bakar ve kodu olan her hesap için ERC-1271 kullanır, eski anahtarını asla geri kazanmaz (H2). ERC-1271 çağrısına bir ML-DSA cüzdanına yetecek bütçe verir (H3: 2.000.000 gaz yürütme). Kodu olan hesapları yalnızca ECDSA kullanan eski yolda reddeder (H6). Saklanmış sonuçları yeniden denetler (H7) | şifre çözme oracle'ının doğrulayıcıları (Zama'nın kms-connector'ı) |
| **E3, beyan edilmiş imzacılar** | Hesap, kuantum sonrası bir anahtarın adresine (anahtardan türetilmiş adres, KDA) yetki devreder. Doğrulayıcı o anahtarın ML-DSA imzasını zincir dışında, yerel olarak denetler. K8 ile, sonuçları uyuşması gereken iki ayrı gerçekleme kullanır | doğrulayıcılar |
| **Profil Q** | Bir etkinleşme bloğu B_Q'dan itibaren operatörler, kökü bir ECDSA anahtarına dayanan her isteği reddeder (Q4). Kökü ECDSA'ya dayanan ve B_Q'dan sonra değişmiş yetki devirlerini ve halefleri saymaz (Q5). 13 operatörden n − t = 9'unun ML-DSA-65 imzalı beyanlarıyla kurulur (Q1) | doğrulayıcılar |
| **Operatör onaylı yükseltmeler** | Kayıt sözleşmesinin sahibi, ancak 13 operatörden 9'unun ML-DSA-44 imzasıyla ve 7 günlük bir beklemeden sonra yükseltme yapan bir sözleşmedir | kayıt sözleşmesinin yönetişimi |
| **Kanarya** | Bir yükseltmeden önce ve sonra, emekliliğin görünümler (view) üzerinden hâlâ çalıştığını denetler | zincir dışı |
| **Kuantum sonrası bir cüzdan** | Tek anahtarı ML-DSA-44 olan bir sözleşme cüzdanı: istekler için ERC-1271, işlemler için herkesin iletebileceği `execute`. Test düzeneğidir, denetlenmemiştir (`impl/pq-wallet/`) | hesap |
| **Taşıma aracı, `getAuthorityStatus`** | Araç, bir tanıtıcı listesini yeni cüzdana izin olarak verir ve eski hesabı tek işlemde emekliye ayırır (uzun listede parçalar hâlinde, emeklilik sonuncusunda). SDK çağrısı bir hesabın kod türünü ve emekliliğini bildirir | kullanıcı tarafı |

## 3. Üç yol ve her birinin ne zaman kullanılacağı

### B1: geçmişi taşıyarak başka adrese geçmek

**Adımlar:**
- Eski hesap A, tanıtıcılarını yeni cüzdan W'ye izin olarak verir.
- Aynı işlemde A emekliye ayrılır. Bunu taşıma aracının gönderdiği, çağıranı koruyan tek bir `multicall` yapar.
- W bundan sonra çözmeyi kendisi olarak ERC-1271 üzerinden ya da kendi beyan edilmiş imzacısıyla (E3) yapar.

**Ne zaman:**
- hesap adres değiştirebiliyorsa;
- geçmiş taşınabilecek kadar küçükse: tanıtıcı başına Osaka'da 31.385, Local-Amsterdam'da 119.505 gaz (Faz 4).

**Bilinmesi gereken:**
- **Taşımadan sonra A'ya verilen bir tanıtıcı etkisizdir.** Emekli bir hesaba verilen izin kimseye sayılmaz, bu yüzden
  uygulamalar W'ye izin vermelidir.
- **W kendi tanıtıcıları için E3'ü kullanabilir.** Bu, mevcut en ucuz doğrulamadır: yerel bir denetim, istek başına
  hiç `eth_call` yok.

### B2: bir halef atayarak başka adrese geçmek

**Adımlar:**
1. A, W'yi halef olarak atar; W kendi `execute`'u ile kabul eder.
2. D geçtikten sonra A onaylar.
3. A emekliye ayrılır: doğrudan, ya da daha sonra bir watchtower'ın ilettiği bir sertifikayla.
4. W, A'nın tanıtıcılarını halef yolundan okur.

**Ne zaman:**
- uygulamalar A'nın adresine izin vermeyi sürdürecekse;
- ya da geçmiş taşınamayacak kadar büyükse.

**Bilinmesi gereken:**
- W, A'nın tanıtıcıları için her istekte ERC-1271 ile kimlik doğrular. Doğrulayıcı her seferinde yaklaşık 1,23M
  gazlık bir `eth_call` öder; kullanıcı hiçbir şey ödemez.
- W'nin kendi beyan edilmiş imzacısı A'nın tanıtıcılarına **ulaşmaz**. Buna izin veren bir kural, W'nin üçüncü kişilere
  kalıcı erişim aktarmasına yol açardı; tasarım bunu yasaklar (S9; karar D98).
- **Önce taşımak, sonra bir halefle emekliye ayrılmak B1 ile B2'yi birleştirir.** Taşınan geçmiş E3'ü kullanır;
  yalnızca sonradan verilen izinler halef yoluna ihtiyaç duyar.

### B3: aynı adreste kalmak

**Adımlar:**
1. A, tek bir işlemde EIP-7702 ile cüzdan koduna yetki devreder ve ML-DSA-44 anahtarını ayarlar.
2. Ardından host zinciri eski anahtarı devre dışı bırakır:
   - **EIP-7851:** yetki devri göstergesi `0xef0101 ‖ cüzdan` olur;
   - **ya da EIP-8298:** A, cüzdanın kodunu kendi olağan kodu olarak benimser.

**Ne zaman:** adresin kalması gerekiyorsa; örneğin başka yerlerde pozisyon ya da rol tutuyorsa.

**Bilinmesi gereken:**
- **İki EIP de taslaktır (Draft) ve hiçbir zincir bunları uygulamıyor.** Bir host zinciri uygulayana kadar eski anahtar
  hâlâ geçerli işlemler imzalar. Şunları yapabilir:
  - izin vermek;
  - herkese açmak;
  - yetki devretmek;
  - bir halef atamak;
  - sahibin önceki imzalı izinlerini geçersiz kılmak;
  - hesabı emekliye ayırmak.

  Doğrulayıcılar eski anahtarın zincir dışı imzalarını reddeder (Profil H), ama zincir üstü kapı açık kalır (§6).
- **B3, Core emekliliğiyle birleştirilemez.** Emeklilik hesabın yetkisini bitirir, yerinde geçişte ise yeni cüzdan
  hesabın kendisidir. Hem kuantum sonrası bir anahtar hem emeklilik isteyen bir hesap başka adrese geçer (B1 ya da B2).

## 4. Kim ne yapmalı

| Taraf | Ne yapmalı | Hangi özellik için | Kanıt |
|---|---|---|---|
| **Zama ACL** (host sözleşmeleri) | Core'u yükseltme korumasıyla, E1 ve E2 ile birlikte yayımlamak. Bir yetki devrinin son değiştiği bloğu veren bir getter, doğrulayıcıların Q5'i depolama okumadan uygulamasını sağlar | 1, 2, 3; yönetişimle 4 | `results/level0/`, `results/level2/`; tatbikat satırları T1–T8 |
| **Zama doğrulayıcıları ve operatörleri** (kms-connector, relayer) | Profil H: önce-kod sıralaması, ERC-1271 bütçesi, H6, H7. İsteğe bağlı olarak bir bayrak arkasında E3. Profil Q: en az 13'te 9 operatörün uygulamasıyla, planlanmış bir B_Q'da ya da bir kuantum saldırısının kanıtı üzerine | 1, 3 | tatbikat satırları R1–R6, P1, P2, Q-P1, k = 8 ve 9 koşuları |
| **Zama yönetişimi** | Kayıt sözleşmesinin sahipliğini operatör onaylı sözleşmeye devretmek (ML-DSA-44, 13'te 9, 7 gün bekleme). Her sürümde korumayı ve kanaryayı tutmak | 4 | B5, yerel tatbikat |
| **Zama KMS ve yardımcı işlemcileri** | Yolun dışında: kendi ECDSA imzaları ve eşleme (pairing) tabanlı girdi kanıtları (§8) | — | `results/phase5/PQ_GAP_MAP.md` |
| **Cüzdanlar ve SDK** | ERC-1271 ve herkesin iletebileceği `execute` içeren bir ML-DSA-44 sözleşme cüzdanı sunmak. `getAuthorityStatus`'u ve tipli `ACCOUNT_RETIRED` hatasını göstermek. Taşıma aracını ve watchtower'ı çalıştırmak | 3 | B0; yerel tatbikat (SDK, araçlar) |
| **Ethereum** | Yerinde kalan hesaplar için EIP-7851 ya da EIP-8298. EIP-8141 (çerçeve işlemleri), benimsenmiş kodun kendi işlemlerini gönderip ödemesini sağlar; o zamana kadar cüzdanın `execute`'u gibi bir iletme yoluna ihtiyaç vardır. Bir ML-DSA ön derlemesi (precompile) olan EIP-8355, ERC-1271 denetimini ucuzlatır | B3 için 2 | B3 satırları; `B8_COSTS.md` §6 |
| **Hesap sahibi** | Anahtarı kendisine karşı kullanılmadan **önce** bir yolu tamamlamak | hepsi | üç sınır (§9) |

## 5. Bunların hangi sırayla olabileceği

1. **Bugün, canlı hatta (`v0.13.8`).**
   - **Çalışan:** Core yalnızca bir kayıt sözleşmesi yükseltmesi ister; gateway, connector ve SDK olduğu gibi kalır.
     Hesaplar o zaman emekliye ayrılabilir, bir ECDSA halefi atayabilir ve taşıyabilir.
   - **Çalışmayan:** kuantum sonrası bir anahtarla şifre çözmek. Gateway kullanıcı ve temsilci imzalarını yalnızca
     ECDSA ile denetler ve ERC-1271 yolu yoktur (`Decryption.sol:923, 947`; B9).
2. **Bir sonraki Zama sürümü, `main`'in RFC-016 yolu.** Doğrulayıcılarda Profil H ile kuantum sonrası bir sözleşme
   cüzdanı çözebilir. B1 ve B2 o zaman 1. ve 3. özellikleri tamamlar. E3 bir bayrak arkasında arkadan gelebilir.
3. **Yönetişim.** Operatör onaylı sahiplikle 4. özellik yükseltme yolu için sağlanır. Bu devir bugünkü ECDSA sahibinin
   bir işlemidir ve o anahtar güvendeyken yapılmalıdır.
4. **Profil Q.** Yeterli sayıda hesap geçiş yaptığında operatörler B_Q'yu planlar. Bundan sonra kökü ECDSA'ya dayanan
   istekler reddedilir. En az 13'te 9'un uygulaması gerekir.
5. **Ethereum.** EIP-7851 ya da EIP-8298 yayımlanırsa, B3 yerinde kalan hesaplar için 2. özelliği tamamlar. EIP-8355,
   ERC-1271 bütçesi sorusunu ortadan kaldırır.

2–4. adımlar Ethereum'a bağlı değildir. 5. adım yalnızca adresini koruması gereken hesaplar için önemlidir.

## 6. Tatbikatın gösterdikleri

Her yoldan sonra eski anahtarı bizim test anahtarımız oynadı. Her hücre üç koşudan gelir:
- VPS'te Faz 5'in gerçek kms-worker'ı;
- M1'de, Osaka ve Local-Amsterdam altında yerel zincirler.

Tam matris: `results/phase5/PQ_DRILL_MATRIX.md`.

| Eski anahtarın denediği | B1 | B2 (iki biçim) | B3a (EIP-7851) | B3b (EIP-8298) |
|---|---|---|---|---|
| Her yolda, kullanıcı ya da temsilci olarak istekler | reddedildi | reddedildi | reddedildi | reddedildi |
| Geçişten önce atadığı bir temsilcinin onun adına okuması | reddedildi | reddedildi | sahip geri alana kadar sunuldu | aynı |
| İzin vermek, herkese açmak, yetki devretmek, halef atamak | geri döndü | geri döndü | **bu zincirde işlendi** | **bu zincirde işlendi** |
| Bir halefi onaylamak, yeni bir sertifika | geri döndü | geri döndü | geri döndü | geri döndü |
| Önceki imzalı izinleri geçersiz kılmak | işlendi, zararsız (A emekli) | aynı | işlendi: sahip yenilerini imzalar | aynı |
| Hesabı emekliye ayırmak | geri döndü | geri döndü | **işlendi: cüzdanın yetkisini de bitirir** | aynı |

**Sahip tarafı:**
- **Geçmişin tamamı her yolda sunuldu,** ERC-1271 üzerinden, B1 ve B3'te ayrıca E3 üzerinden. Bu, Profil Q altında da
  geçerli.
- **A'ya sonradan verilen bir tanıtıcı** B2 ve B3'te W'ye ulaşır, B1'de tasarım gereği etkisizdir.

**Aynı senaryoda Profil Q:**
- B_Q'dan sonra kökü ECDSA'ya dayanan her okuyucuyu reddeder; eski anahtarın B3'te adını verdiği saldırgan da buna
  dahil. Kuantum sonrası bir cüzdanla okuyan bir saldırgan ise sunulurdu (Faz 4 P1.2 §2.4).
- Eski anahtarın B3a'daki sonraki yetki devrini de reddeder.
- B3b'deki aynı yetki devrini reddetmez: B3b'nin kodu B_Q'da zaten olağan koddu, bu yüzden doğrulayıcı onu bir
  sözleşmenin kodundan ayıramaz. EIP-8298'i uygulayan bir zincirde anahtar o işlemi gönderemezdi.
- **13 işçiyle eşik keskindir.** 8 işçi uygularken kalan beşi bir ECDSA isteğini hâlâ serbest bırakır; 9'da yalnızca
  dördü bırakır ve istek alıkonur.

**Yükseltme güvenliği (yerel):**
- 8 operatör imzası geri döner.
- Core içeren bir sürüm 9 imzayla korumadan geçer ve kanarya yeşil kalır.
- Core içermeyen bir sürüm 9 imzayla korumada geri döner.

## 7. Maliyetler

Yerel zincirlerde gaz [M]. Local-Amsterdam, Last Call aşamasındaki EIP taslaklarını kullanır; sabitleri değişebilir.
Doğrulama süreleri Faz 4'ün M1'deki ölçümüdür [M]. Ayrıntılar: `results/phase5/B8_COSTS.md`.

| Kalem | Osaka | Local-Amsterdam |
|---|---|---|
| ML-DSA-44 doğrulayıcısı ve yardımcısı, zincir başına bir kez | 5,17M + 4,72M | 37,2M + 33,6M |
| Bir hesabın anahtarı (doğrulayıcının 20.545 baytlık hazırlanmış biçimi) | 4,43M | 31,9M (yalnızca EIP-8037'nin rezervuar kuralıyla geçerli) |
| B1: 3 tanıtıcıyı taşıyıp emekliye ayrılmak | 156.448 | 503.316 |
| B2: atama, kabul (`execute`), onay, emeklilik | 62.128 + 1,34M + 57.256 + 54.516 | 144.548 + 1,43M + 140.060 + 136.936 |
| B3: tek bir type-4 işlemde yetki devri ve anahtar | 83.059 | 284.005 |

**İstek başına, zincir dışı:**

| Yol | Maliyet |
|---|---|
| ML-DSA-44 cüzdanıyla ERC-1271 | doğrulayıcının düğümü için yaklaşık 1,23M gazlık `eth_call`; M1'de crate üzerinden 2,7 ms. Değiştirilmemiş 250.000 gaz sınırı bunu reddeder |
| E3 | 80–86 µs yerel doğrulama; yolun tamamı 242–247 µs; uyuşması gereken iki kütüphaneyle 337–341 µs |

**EIP-8355 ile [E]:**
- `isValidSignature` yaklaşık 13.000–15.000 gaz tutar ve değiştirilmemiş sınırın içine girer.
- Bir anahtarı kaydetmek 4,4M yerine yaklaşık 0,3M gaz tutar.

## 8. Açık kalanlar

**Yolun kendi kalıntıları** (her birinin nedeni ve kapanışı matriste):
- **EIP-7851 ya da EIP-8298 olmayan bir zincirde B3:** eski anahtarın işlemleri. Yalnızca host zinciri kapatır.
- **B3:** geçişten önce yapılan yetki devirleri, sahip onları `execute` ile geri alana kadar geçerlidir.
- **4. özellik yönetişim devrinde durur.** Koruma kazara yapılan bir sürümü durdurur; arayüzü hakkında yalan söyleyen
  bir uygulamayı durdurmaz.
- **Profil Q yalnızca 13'te en az 9 uyguladığında korur.** Emekli olmamış bir hesabın eski anahtarını hâlâ kabul eden
  bir zincirde, o anahtarın bir saldırganın kuantum sonrası cüzdanına sahteleyerek verdiği izin Q altında sunulur
  (Faz 4 P1.2 §2.4). Emekli bir hesabın izinleri geri döner.

**Boşluk haritası** (`results/phase5/PQ_GAP_MAP.md`, kodda okunan 18 ilkel [V]):
- **Zaten kuantum sonrası:**
  - şifreli metinler (TFHE);
  - yanıt şifrelemesi (ML-KEM-512, kategori 1).
- **Klasik, yolun dışında:**
  - KMS'in yanıt imzası ve şifre çözme sonucu imzaları;
  - yardımcı işlemcilerin girdi imzaları;
  - girdi kanıtları (eşleme tabanlı);
  - bileşen tasdikleri;
  - gateway zincirindeki gönderenler;
  - devredilene kadar yönetişim.
- **Denetlenmedi:** iç TLS'in karma (hibrit) bir anahtar değişimi kurup kurmadığı [I].
- **Bunları sahteleyen bir kuantum saldırganı** bütünlüğe, girdiler üzerinden belki gizliliğe de saldırır [I]. Hesap
  düzeyindeki hiçbir adım bunları kapatmaz.

**Burada kullanılan, denetlenmemiş kütüphaneler:**
- Fireblocks `evm-ml-dsa-verifier`, `cca262b5`: test cüzdanının ve B5 sahibinin arkasında;
- RustCrypto `ml-dsa` 0.1.1 ve `fips204` 0.4.6: uyuşma kipinde E3 için;
- `dilithium-py`: doğrulayıcı deposunun test imzacısı.

Cüzdan ve sahip sözleşmesi test düzenekleridir.

## 9. Üç sınır

1. **Önleyicidir, geri alma değildir.** Yol, anahtarı kendisine karşı kullanılmadan önce yolu tamamlayan bir hesabı
   korur. Anahtarın daha önce paylaştığı, herkese açtığı ya da çözdürdüğü veriler açıkta kalır.
2. **Yalnızca oracle erişimini keser.** Şifre çözmeyi yönetir. Uygulamalar emekliliği de denetlemedikçe eski anahtar
   fon taşımayı ve uygulama rolleri tutmayı sürdürebilir. B3'te ayrıca host zinciri onu devre dışı bırakana kadar kayıt
   sözleşmesi üzerinde işlem yapmayı sürdürür.
3. **Bulunduğu zincirin yönetişimi kadar kesindir.** Kayıt sözleşmesini yükseltebilen, bunu geri alabilir. Kuantum
   sonrası imzalarla operatör onaylı yükseltmeler bunu daraltır. Bugünkü sahip, zaman kilidi olmayan bir ECDSA çoklu
   imza cüzdanıdır.
