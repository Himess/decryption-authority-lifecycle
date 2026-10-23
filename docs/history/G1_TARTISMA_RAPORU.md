Early design discussion (Turkish), kept for history. The current design is in erc/ and docs/.

# FHE şifre çözme yetkisi: doğrulama ve tasarım incelemesi raporu (G1 öncesi)

**Tarih:** 21 Ekim 2026
**Hazırlayan:** Claude Code, Semih (Himess) için
**Durum:** Prototip G1 kapısında bekliyor. Semih bu raporu Claude web ile tartıştıktan sonra karar verecek. Bu rapordan sonra hiçbir şey inşa edilmedi ya da çalıştırılmadı.
**Kapsam:** "FHE'de Kuantum Güvenliği Yetkilendirmede Biter" (v0.1) belgesindeki bulguların (B1–B7) ve "Emekli Et ve Taşı" tasarımının (C1–C5) doğrulanması ve eleştirilmesi.

**Etiketler:**

| Etiket | Anlamı |
|---|---|
| [D] | Kodda ya da zincirde doğrulandı |
| [Ö] | Ölçüldü (zincir veya donanım ve tarih kaynakta yazılı) |
| [T] | Tahmin |
| [Ç] | Çıkarım |

**Ayrıntılı kaynaklar** (`fhe-authority-lifecycle/` altında):
- `results/VERIFICATION.md`: Faz 1, kanıtlar ve işlem hash'leri.
- `DESIGN_REVIEW.md`: Faz 2 sonucu (İngilizce).
- `results/review/01–05_*.md`: dört bağımsız inceleme ve hakemin kararları.
- `results/review/objection_ledger.md`: 129 itirazın tek tek eşlemesi.

---

## 0. Bir sayfada sonuç

1. **Teşhis doğru, ama sürüm konusunda önemli bir düzeltme var.**
   - Kodda ve Sepolia'da kendi hesaplarımızla yaptığımız testlerde, ECDSA kökenli adresler için iki şey doğrulandı: adres kendi şifre çözme yetkisini emekliye ayıramıyor, ve ele geçirilmiş bir anahtar bütün geçmişi tek işlemle başkasına açabiliyor.
   - **Sepolia ve Ethereum mainnet, GitHub'daki `main`'i (ACL v0.7.0) değil, eski v0.13.8 sürümünü (ACL v0.4.0) çalıştırıyor.**
   - Canlı sistemde imza iptali (`invalidateDecryptionSignaturesBefore`) hiç yok. Şifre çözme izni yalnızca ECDSA ile, gateway zincirinde doğrulanıyor.
   - Yani canlı sistemdeki durum, belgede anlatılandan daha kötü.
2. **Orijinal çözüm (C1–C5) yetmiyor ve tamamen geride kalıyor.**
   - C1'deki yazma tarafı `notSealed` korumaları ve `invalidatedBefore = 2^256−1` sentinel değeri canlı sistemde hiçbir şey yapmıyor.
   - `main`'de ise dApp'ler bu korumaları atlatabiliyor. Örneğin OpenZeppelin ERC-7984 `requestDiscloseEncryptedAmount` ve `FHE.fromExternal(h, "")`.
   - C3, B5'i çözmüyor. C4(a) proxy cüzdanlarda çalışmıyor. C5 ise bugün herkes için kesinti demek.
3. **Önerilen yeni tasarım, "Retire & Carry v2":**
   - Hesabın yalnızca kendisinin açabildiği, tek yönlü bir `retired` biti.
   - Bit, bütün connector sürümlerinin, relayer'ın, SDK'nın ve dApp'lerin **zaten çağırdığı** ACL görünümlerinin içinde uygulanıyor: `isAllowed`, `persistAllowed` ve iki delegasyon kontrolü.
   - Böylece hem canlı sistemde hem `main`'de, connector, relayer, gateway, KMS ya da SDK'ya dokunmadan bütün kapılar kapanıyor.
   - Taşıma işi var olan `multicall` ile yapılıyor.
4. **Neden ACL içinde?** Bir istek sahibinin 13 KMS düğümünden yalnızca **5'inin** payına ihtiyacı var. Bu yüzden connector'a eklenen herhangi bir kural, operatörlerin **en az 9'u** o kuralı çalıştırana kadar kimseyi korumuyor. ACL görünümüne konan kural ise yükseltme bloğunda bütün sürümleri birden bağlıyor.
5. **Zama'ya önerinin şekli:**
   - **PR-1:** Yalnızca ACL'de yaklaşık 55 satırlık `retireAccount()`. 0.13.x'e geri taşınabilir.
   - **PR-2:** Olgunlaşma süreli, iki adımlı halef hesap ve `FHE.isAccountRetired`.
   - **PR-3:** Yalnızca `main` için imza düzeni: önce kod kontrolü ve yürütme gas'ı üzerinden ERC-1271 bütçesi.
   - **Ayrı istekler:** Yönetişim için zaman kilidi, connector'larda uygulama sabitleme.
   - **C5:** Protokol önerisinden çıkıyor.
6. **İfade.** "Geri alınabilir gizlilik" bırakılıyor: akademide bu terim "koşullu ifşa" demek, yani arka kapı gibi okunuyor. Yerine **"geri alınabilir erişim"** ve fiil olarak **"emekliye ayırmak"** kullanılıyor, her seferinde üç sınırla birlikte:
   - yalnızca önleyici;
   - yalnızca oracle erişimi;
   - zincirin yönetişimi kadar kesin.

---

## 1. Ne yapıldı?

**Faz 1, doğrulama (G0):**
- Zama `fhevm` (`main` = `ed851716c`; canlı sürüm etiketi `v0.13.8`), `kms` (`c755e84f`) ve Fhenix `cofhe-contracts` (`b5c20ed`) kodları satır satır okundu. Bugünkü HEAD'ler belgedeki commit'lerle aynı.
- Sepolia'da **yalnızca kendi test hesaplarımızla ve kendi sözleşmelerimizle** E2–E5 deneyleri çalıştırıldı: kendi ERC-7984 token'ımız, 7702 delegasyonu, PQ akıllı hesap.
  - Toplam harcama yaklaşık **0,00013 Sepolia ETH**.
  - Mainnet'e işlem gönderilmedi.
  - Başkasına ait hiçbir veri okunmadı ya da çözülmedi.
  - Kimseyle iletişime geçilmedi.

**G0 sonucu.** Sepolia `main`'den farklı çıktı. Semih "hedef `main`, canlı sürüm ayrı kayıt edilsin" diye karar verdi.

**Faz 2, çok ajanlı inceleme:**
- Dört bağımsız inceleme yapıldı. Hiçbiri diğerinin çıktısını görmedi:
  1. Zama mühendisi (savunucu)
  2. Kriptograf / kırmızı takım
  3. Hesap soyutlama (AA) ve PQ hesap uzmanı
  4. Ürün / UX, mainnet'te yalnızca toplu sayımlarla
- En son bir sadelik hakemi bütün anlaşmazlıkları kodu yeniden okuyarak karara bağladı.
- Çıkan 129 itirazın sonucu: 109'u kabul, 3'ü ret, 3'ü kalan risk, 2'si düzeltildi, 1'i kapsam dışı. **10'u ve 14 alt nokta tartışmaya açık** (§9).

---

## 2. Faz 1 bulguları: sürüm tablosu

"Canlı" = Sepolia ve mainnet, v0.13.8 (ACL v0.4.0). "Main" = ACL v0.7.0.

| Bulgu | Canlı (v0.13.8) | Main (v0.7.0) | Hüküm |
|---|---|---|---|
| **V0:** Sepolia main ile aynı mı? | Hayır. ACL v0.4.0, KMSVerifier v0.3.0, InputVerifier v0.2.0; Sourcify'da v0.13.8 ile birebir aynı [D] | — | **Çürütüldü** (G0) |
| **B1:** Kullanıcı yetkisini geri alamaz | Doğru. `blockAccount` yalnızca sahip tarafından çağrılabiliyor, yalnızca çağıranı kontrol ediyor; alıcıları, delegasyonu ve zincir dışını kontrol etmiyor [D] | Aynı | **Doğrulandı, belgede yazandan güçlü.** Zama'nın ACL belgesi yanlış ("engellenen hesap izin alamaz" diyor) |
| **B2:** İptal anahtara karşı değil | İptal fonksiyonu hiç yok, yani imzalı izin 365 güne kadar geri alınamıyor [D] | Doğru, yalnızca EOA'lar için. Eşit zaman damgası geçiyor (bilinçli). Akıllı hesapta "imzalayıcıyı değiştir + iptal et" Zama'nın amaçladığı çözüm [D] | **Main'de doğrulandı.** Sepolia'da test edilemedi (fonksiyon yok) |
| **B3:** Geçmiş tek işlemle aktarılabilir | Doğru. Ayrıca `delegateForUserDecryption(saldırgan, WILDCARD, uint64.max)` sabit gas'lık **tek işlemle** bütün geçmiş ve gelecek handle'ları açıyor. OZ ERC-7984 "kendi adına ifşa" (confused deputy) açığı var [D] | Aynı, buna köprü (bridge) de ekleniyor | **Doğrulandı, daha geniş.** Sepolia'da: tek `allow` ile BOB, ALICE'in bakiyesini (21000) çözdü [Ö] |
| **B4:** Zincir dışı kapı | Doğru. Gateway'de ECDSA doğrulanıyor, hesap durumu okunmuyor [D] | Doğru. Connector'da `ecrecover` RPC'siz çalışıyor [D] | **Doğrulandı** |
| **B5:** 7702'de eski anahtar geçerli | Doğru. Sepolia'da "her şeyi reddeden" cüzdana delege edilmiş EOA eski anahtarla şifre çözdü [Ö] | Doğru. Önce `ecrecover` yapılıyor [D] | **Doğrulandı** |
| **B6:** PQ hesaplar 250K tavanına takılır | Daha kötü: ERC-1271 yolu hiç yok; 65 bayttan farklı her imza HTTP 400 alıyor ("Must be 130 characters long") [Ö] | Doğru. ML-DSA-44 `isValidSignature` = 1.232.720 gas; Zama doğrulayıcısı ancak gas limiti ≥ 1.309.193 olunca kabul ediyor (tavanın 5,24 katı) [Ö]. Tavan üç ayrı yerde: connector, relayer, SDK [D] | **Doğrulandı** |
| **B7:** KMS'in PQ imzaları kullanılmıyor | Doğru [D] | Doğru. Belgedeki R8 referansı yalnızca v0.15'ten itibaren var [D] | **Doğrulandı** |
| **B8 (yeni):** Yönetişim ve yükseltilebilirlik | Bütün host sözleşmeleri UUPS; kök `ACL.owner()` = Aragon OSx DAO, **zaman kilidi yok**. Mainnet'te iki multisig (3/6 ve 9/17) **tek başına** yükseltebiliyor. Sepolia'da 3/5 EOA. Gateway: 3/5 Safe ya da LayerZero. Hepsi ECDSA [D] | Aynı | **Doğrulandı.** Ele geçirilmiş bir gateway, "kullanıcı" olarak token sözleşmesini gösterip izin kontrolünü aşabiliyor |
| **F1:** Fhenix | B1 ve B3 doğru; B2 daha güçlü (iptal sözleşmesini imzalayan seçiyor, 0 = kalıcı, süre sınırı yok, zincir dışı paylaşım izinleri). **B5 Fhenix için yanlış:** önce kod kontrolü yapılıyor. **B6 taşınmıyor:** sabit tavan yok. **Yeni:** Fhenix'in kanalı X25519, yani PQ değil. Testnet'lerde tek EOA yönetici [D] | — | **Kısmen doğru** |

**Ek bulgular:**
- Saklanan şifre çözme sonuçları süresiz sunuluyor.
- Kullanıcının ML-KEM "taşıma" anahtarı tek kullanımlık değil; 365 güne kadar yeniden kullanılabiliyor.
- Testnet'te 21 saatte yaklaşık 1.577 kullanıcı şifre çözme isteği görüldü, yani yol aktif kullanılıyor.

---

## 3. Orijinal tasarım neden yetmiyor?

| Bileşen | Sorun |
|---|---|
| **C1** (`notSealed` + sentinel) | Canlı sistemde ACL'de iptal alanı yok ve connector onu hiç okumuyor, yani **etkisiz**. Main'de dApp'ler ACL'in *okuma* görünümleri üzerinden yetki kullanıyor (ERC-7984 ifşa ve transfer, `fromExternal(h,"")`, köprü), dolayısıyla yazma tarafı koruması **delinir** |
| **C2** (`allowMany`, `carryAndSeal`) | `multicall` zaten var. "İzin ver ve mühürle"yi tek fonksiyonda birleştirmek, oltalama ile alınmış tek bir işlemi geri alınamaz bir izne çevirir |
| **C3** (EIP-8151 kuralı) | 7702 hesabının kodu zaten delegasyon göstergesi olduğu için kök anahtarı **yine kabul eder**. B5'i çözmüyor |
| **C4(a)** (kod hash'i izin listesi) | Proxy ve modüler cüzdanlarda çalışmıyor. Tavan üç yerde. 20 kez yeniden deneme DoS'u büyütüyor |
| **C5** (yönetişim bayrağı) | Bugün açılırsa sahiplerin yaklaşık %98'i için kesinti olur. Bayrağı çeviren yönetişim (3/6 ya da 9/17 ECDSA, zaman kilidi yok) kuantum günü ilk düşecek hedef |

---

## 4. Önerilen tasarım: Retire & Carry v2

### 4.1 Bileşenler

**R1. Emeklilik biti (PR-1).**
- `retireAccount()` tek yönlüdür: geri alınamaz, duraklatmadan (pause) etkilenmez, yönetişim tarafından kaldırılamaz.
- Etkisi:
  - `isAllowed(h, a)`: FHEVMExecutor dışındaki bütün çağıranlar için false.
  - `persistAllowed(h, a)`: false.
  - Hesabın delege eden **ya da** delege olduğu bütün delegasyonlar ölür.
  - Hesap yeni delegasyon oluşturamaz.
  - Hesabın bütün ACL yazma çağrıları geri döner.
- Hesaba gelen yeni izinler kabul edilir ama işe yaramaz. Böylece ERC-7984 transferleri bozulmaz.
- **Depolama:** ayrı bir ERC-7201 alanı, `fhevm.storage.ACLRetirement` (`0xe6ae1005…6200`). Hem 0.13.x hem `main` için aynı, dolayısıyla depolama çakışması yok.
- **Maliyet [T]:**
  - `retireAccount` yaklaşık 45–55K gas (Osaka kuralları); Sepolia'nın güncel tarifesinde 120–140K.
  - FHEVMExecutor yolu işlenen başına yaklaşık +20 gas.
  - `allow` yolu işlem başına 1 SLOAD, yani gizli transfer maliyetinin yaklaşık %0,7–0,9'u.
  - **Yeni RPC yok.**

**R2. Taşıma.**
- `ACL.multicall([allow(h, YENİ)…, retireAccount()])`: önce izinler, sonra emeklilik.
- İşlem başına yaklaşık 500 handle [T].
- Mainnet sayımına göre ECDSA sahiplerinin %99,9'undan fazlası tek işlemle taşıyabiliyor [T].

**R3. Olgunlaşma süreli halef (PR-2).**
- Adımlar: önce `designateSuccessor(s)`, D gün sonra `confirmSuccessor()`. Onaylanan halef eski anahtara karşı kilitlenir; yalnızca halefin kendisi çekilebilir.
- Emeklilikten sonra yalnızca onaylı halef, var olan "delege olarak çöz" akışıyla okuyabilir. Sonradan gelen handle'ları da görür.
- Halef zincirleme çalışmaz, ödeme adresi olarak da kullanılmamalı.
- Amaç: bir hırsızın kullanıcıdan önce emekliye ayırarak onu kilitlemesini engellemek. Ayrıca bir delege anahtarının, ona bağlı bütün hesapları tek işlemle emekliye ayırabilmesi (mainnet'te 403 delege eden hesabın 374'ü tek bir anahtara bağlı [Ö]).

**R4. Uygulamalar (PR-2).**
- `FHE.isAccountRetired(address)` yardımcısı eklenir.
- OpenZeppelin'den `ERC7984ObserverAccess.setObserver` ve `setOperator`'ı emeklilik bitine bağlaması istenir. Bu kapı bitle kapanmıyor: mevcut ve gelecekteki değerleri sızdırıyor, geçmişi sızdırmıyor.

**R5. İmza düzeni (PR-3, yalnızca `main`).**
- Önce kod kontrolü: kod yoksa `ecrecover`, kod varsa yalnızca ERC-1271. 7702 için sınırlı bir ara katman.
- `gas_limit = yürütme bütçesi + calldata maliyeti`, ayrıca bir imza uzunluğu sınırı.
- Yeniden denemeler toplam gas ile sınırlanır.

**Ayrı istekler (B8).**
- Şimdi: yönetişim yükseltmeleri için zaman kilidi ve çıkış penceresi; connector'larda uygulama sabitleme.
- İleride: PQ yönetişim.

**C5.** Protokol önerisinden çıkıyor. İleride ancak üç koşul sağlanırsa operatör politikası olur: bir PQ yolu canlıya alınmış olmalı, bir hazırlık metriği yayımlanmış olmalı ve operatörlerin en az 9'u kabul etmeli.

### 4.2 Neyi kapatıyor, neyi kapatmıyor?

| Bulgu / kapı | Canlı + PR-1 | Main + PR-1 | + PR-2 | + PR-3 |
|---|---|---|---|---|
| B1: kullanıcı emekliye ayıramıyor | **Kapanır** | **Kapanır** | Halef + kilitlenme sigortası | — |
| B2: EOA anahtarı izin üretmeye devam ediyor | **Emekli hesap için kapanır** | **Kapanır** | — | — |
| B3: ACL kapıları (allow, herkese açma, multicall, `fromExternal("")`, ERC-7984) | **Kapanır** | **Kapanır**, köprü dahil | — | — |
| B3: delegasyonlar (gelen, giden, wildcard) | **Kapanır** | **Kapanır** | Yalnızca halef kalır | — |
| B3: kimliğe bağlı uygulama yetkileri (`setObserver`) | Açık | Açık | Uygulama benimserse kapanır | — |
| B4: zincir dışı kapı, emekli kullanıcı için (kuantumla taklit edilen eski anahtar dahil) | **Kapanır** | **Kapanır** | — | — |
| B5: 7702 kök anahtarı, emekli *olmayan* hesap | Açık | Açık | — | **Main'in birleşik yolunda kapanır** |
| B6: PQ 1271 hesaplar | Açık (canlıda 1271 yok) | Açık | — | **Kapanır** (bütçe) |
| B8: yönetişim, gateway | Açık | Açık | — | Ayrı istekler |
| Saklanan sonuçlar, taşıma anahtarı | Açık | Açık | — | SDK hijyeni |

---

## 5. Ölçümler

**Sepolia (Glamsterdam tarifesi) ile yerel anvil (Osaka kuralları) [Ö]:**

| İşlem | Sepolia | Osaka |
|---|---|---|
| Tek `ACL.allow` | 140.780 | 58.348 |
| `multicall` içinde her ek handle | 119.201 | 31.083 |
| `allowForDecryption` | 141.493 | 59.073 |
| EIP-7702 delegasyonu | 58.456 | 37.160 |
| ML-DSA-44 `isValidSignature` | 1.232.720 | ≈1,23M |

Belgedeki handle başına 22–27K tahmini düşük kaldı.

**Calldata etkisi** [Ö, Sepolia tarifesi]. 250K tavanından imza verisinin yediği pay, yürütmeden önce:

| İmza | Gas | Tavandaki payı |
|---|---|---|
| ML-DSA-44 | 177.048 | %71 |
| ML-DSA-65 | 234.392 | %94 |
| ML-DSA-87 | 318.360 | %127 |

Yani precompile tek başına yetmez; tavan yürütme gas'ına uygulanmalı.

**Doğrulama süreleri** [Ö, inceleme ajanı, yerel]:
- **Zincir dışı (native):** ML-DSA-44 35–82 µs, FN-DSA-512 8–12 µs. Connector'ın bugünkü `ecrecover` yolu 172–178 µs, yani PQ doğrulama ondan daha ucuz.
- **EVM'de:** ETHFALCON 1.547.336 gas, NIST Falcon 3.910.833 gas.

**Mainnet toplu sayımı** [Ö, yalnızca toplam; kişi bazında veri saklanmadı]:
- Gizli veri tutan hesap sayısı yaklaşık **12.714**.
- 1.000 hesaplık rastgele örnekte: %80,7 düz EOA, %17,2 7702 EOA, yaklaşık %2 sözleşme.
- Hesap başına handle: medyan 12, p99 127.
- 41 hesap (%0,3) bütün handle'ların %42'sini tutuyor. Bunların 33'ü sözleşme (32'si ZAMA müzayede cüzdanı), yalnızca 8'i ECDSA kökenli.

---

## 6. Tez ve sınırlar (önerilen metin)

> Eşik şifre çözme oracle'ına dayanan FHE sistemlerinde geçmiş verinin gizliliği, oracle'dan her şifre çözme istendiğinde yeniden karara bağlanır. Şifreli metinler kuantum sonrası güvenlidir; bunu isteme yetkisi ise bir adrese kalıcı olarak bağlı bir ECDSA anahtarıdır. Emekli Et ve Taşı eksik yaşam döngüsü adımını ekler: Bir adres ihtiyaç duyduğunu yeni bir hesaba taşıyıp kendi şifre çözme yetkisini emekliye ayırabilir; bundan sonra oracle eski anahtara dayanan her isteği reddeder. Bu, geri alınabilir *erişimdir*. Zama'nın kendi KMS anahtarlarına uyguladığı NIST SP 800-57 anahtar durumlarının (devre dışı, ele geçirilmiş) kullanıcı yetkisi için bir karşılığıdır.

**Her seferinde belirtilecek sınırlar:**
1. **Önleyicidir, geri alma değildir.** Anahtar ele geçirildikten sonra saldırganın çoğunlukla kazandığı bir yarıştır.
2. **Yalnızca oracle erişimini keser.** Çözülmüş ya da herkese açılmış veriyi geri almaz. Anahtarın hesap olarak hareket etmesini (varlık taşıma, gözlemci atama gibi uygulama rolleri) engellemez.
3. **Bulunduğu zincir kadar kesindir.** Emekliye ayırma her zincirde ayrı yapılır ve yönetişim onu geri alabilir.

İngilizce metin `DESIGN_REVIEW.md` §8'de.

---

## 7. Claude web'in önerileriyle karşılaştırma

| Claude web'in önerisi | Sonuç |
|---|---|
| B8'i ekle | **Kabul.** Doğrulandı ve tasarıma girdi: zaman kilidi + uygulama sabitleme isteği, sınır 3 |
| "Geri alınabilir gizlilik" çerçevesi | **Değiştirildi.** Terim literatürde "koşullu ifşa" anlamında kullanılıyor ve arka kapı gibi okunuyor. Yerine "geri alınabilir erişim / emekliye ayırma" geldi. Fikrin özü (oracle'ın kullanıcıya not sistemlerinde olmayan bir hak sunabilmesi) korunuyor, ama yalnızca **önleyici** olarak |
| Kurumsal saklama şirketleri asıl kullanıcı | **Kısmen.** Dfns ve Bron doğrulandı; Utila duyurulmuş ama canlı olduğu doğrulanmadı; **GSR saklama şirketi değil**, bir alım-satım karşı tarafı. Ölçülen gerçek: sahiplerin yaklaşık %98'i ECDSA kökenli. Kurumlar örnek olarak anılabilir, "asıl kullanıcı" iddiası için kanıt yok |
| Rakamlar | arXiv 2603.28846 (Google QAI, Drake, Boneh) doğrulandı. ~10.900 cüzdan, bizim saydığımız 11.040 ile tutarlı. TVL ~82M$ eskimiş; güncel değer yaklaşık 130M$. 532M$ hacim doğrulanamadı |
| İlk PR: B5 + B6 | **Reddedildi; PR-3'e kaydırıldı.** İkisi de yalnızca canlıda olmayan `main` yoluna dokunuyor. B6 tek dosya değil, üç yer. Hiçbiri kullanıcıya emekliye ayırma imkânı vermiyor. Tavanı yükseltmek DoS sınırını da yükseltir |
| Önce Sepolia kanıtı | **Yapıldı.** B3, B5 ve B6 Sepolia'da kanıtlandı. B2 canlıda yok |

---

## 8. Kalan riskler (v2 sonrası bile)

1. **Ele geçirmeden sonrası.** Üçüncü taraflara verilmiş izinler, herkese açılmış handle'lar ve çözülmüş veri geri alınamaz.
2. **Kimliğe bağlı uygulama yetkileri** (`setObserver`, `setOperator`, `Ownable`), uygulamalar `isAccountRetired`'ı benimseyene kadar açık kalır.
3. **Yönetişim ve gateway.** Emekliye ayırmayı geri alabilir ya da "kullanıcı olarak token sözleşmesi" hilesiyle taklit edebilir. Zaman kilidi ve sabitleme bunu daraltır; asıl çözüm PQ yönetişim.
4. **Saklanan ve yayımlanmış sonuçlar.** 365 gün yeniden kullanılabilen taşıma anahtarı da bu riske dahil.
5. **Zincir başına kapsam.** Polygon da v0.4.0 çalıştırıyor.
6. **Yalnızca PR-2 için.** Anahtar çalınır ve bekleyen bir halef adaylığı D gün boyunca fark edilmezse, saldırgan kendi halefini onaylatabilir. O halef emekliye ayırmadan sonra da erişimini korur. Önlemler: cüzdan uyarıları, izleme ve halefin hesap kurulurken atanması.
7. **Canlı v0.13.x'te PQ hedef hesap yok.** Bu yüzden iki aşama var: canlıda emekliye ayırma ve rotasyon (A), `main`'de PQ hesaplar (B).
8. **Denetlenmemiş kütüphaneler.** Fireblocks ML-DSA, `ml-dsa` crate'i ve ZKNOX.

---

## 9. Tartışılacak sorular

### 9.1 G1 ve prototip

1. **G1.** Prototipi v2'ye geçirelim mi? Orijinal C1–C5 yalnızca "başlangıç tasarımı" olarak belgede kalır. *Önerim: evet.*
2. **PR-2 (halef) ilk prototipte olsun mu, D kaç gün olsun?** *Önerim: evet, D = 7 gün.* Zama'ya ise önce yalnızca PR-1 önerilir.
3. **Ortam.** Zama'nın Docker imajları ghcr.io'da anonim erişime kapalı ("Unauthorized"). Tam yığın için GitHub token'ına `read:packages` izni gerekir ve erişim yine reddedilebilir. *Önerim:* önce hafif yerel ortam (değiştirilmiş ACL + OZ ERC-7984 + connector'ın okuduğu görünümler için bir test düzeneği), tam yığın daha sonra VPS'te.
4. **0.13.x backport'u da prototiplensin mi?** *Önerim: evet.* Canlı v0.13.8 connector'ı hiç değiştirilmeden çalıştığını göstermek, önerinin en güçlü kanıtı olur.

### 9.2 Zama notunun içeriği

Önerdiğim varsayılanlar:
- **B8:** Ölçülen gerçekleri (3/6, 9/17, zaman kilidi yok) içeren tarafsız bir paragraf, notun sonuna doğru.
- **C5:** Tek cümle: "ileride bir operatör politikası olabilir, bugün bir istek değil".
- **OpenZeppelin `setObserver` boşluğu:** Notta tek cümle. Ayrı bir OZ notu yalnızca Semih onaylarsa.
- **Fonksiyon adı:** `retireAccount()`.
- **Polygon:** Zincir başına kapsam notta belirtilir; prototip tek zincirde çalışır.
- **Fhenix:** Zama notunda tek tarafsız cümle; ayrı not daha sonra.
- **Belge revizyonu:** G1'den sonra Türkçe belgenin §4–§11'i baştan revize edilir.

### 9.3 İncelemede çözülmeden kalanlar ve önerilerim

| # | Konu | Önerim |
|---|---|---|
| 1 | B4 "FHE'ye özgü değil, gözden kaçma değil" itirazı | B4'ü genel bir sınıf olarak yeniden çerçevele (zincir dışı doğrulayıcılar zincirdeki anahtar devre dışı bırakmayı miras almıyor) ve FHE'yi bunun özel bir örneği yap. Etiket "gözden kaçan" yerine "ele alınmamış kapsam" |
| 2 | Kurumları asıl kullanıcı olarak anmak | Yalnızca doğrulanmış örnekler (Dfns, Bron) ve bizim sayım (%98 ECDSA kökenli) |
| 3 | B6 tablosundaki gas değerleri | Ölçülmüş, etiketli değerlerle değiştir; kaynaksız 0,65M'yi çıkar |
| 4 | ERC-8231 | v2'nin dışında tut; gelecekteki C4(b) için kısıtları not et |
| 5 | ERC-6492 / henüz deploy edilmemiş hesaplar | Yalnızca belgele: "şifre çözmeden önce hesabı deploy et" |
| 6 | PR-3 uygulama yöntemi (state-override veya native Rust) | Ertele; PR-3 bütçeli bir `eth_call` ile yeterli |
| 7 | EIP durum değişiklikleri (7851 Hegotá'ya alınmadı; 8298 ve 8151 aday) | Belge revizyonunda güncelle |
| 8 | L2BEAT'in riski zaten listelemesi; KMS operatörlerinin cüzdan ve explorer yapan şirketler olması | Notta birer satır |
| 9 | Not açılışı (reddedilen "anında halef" üzerine kuruluydu) | Açılışı PR-1 ve SP 800-57 çerçevesi üzerine yeniden yaz |
| 10 | Piyasa rakamları | Yalnızca doğrulanmış ve tarihli rakamlar kullanılsın |

**Alt noktalardan öne çıkanlar:**
- **SU-1, uyumluluk riski.** İzin verdikten sonra `isAllowed(h, alıcı)` kontrol eden uygulamalar, emekli bir alıcıya transferde geri dönebilir. Büyük ERC-7984 uygulamaları taranmalı ve bunun için bir test eklenmeli.
- **SU-9, denetçi sürekliliği.** Halef, emekli hesabın geçmişini bir denetçiye yeniden açamaz. Kurumlar için önerilen yol halef değil, taşıma.
- **SU-14, alternatif PR-2 kodlaması.** Halef, indeksleyicilerin değişmesine gerek kalmasın diye "kilitli wildcard delegasyon" olarak kodlanabilir. Açık soru.

---

## 10. Dosyalar

| Dosya | İçerik |
|---|---|
| `results/VERIFICATION.md` | Faz 1: hükümler, sürüm tablosu, Sepolia işlemleri, düzeltmeler |
| `DESIGN_REVIEW.md` | Faz 2: değişiklikler, itiraz özeti, alternatif sıralaması, nihai tasarım, Q1–Q7, tez (İngilizce) |
| `results/review/01_defender.md` … `05_judge.md` | Bağımsız incelemeler ve hakem kararları |
| `results/review/objection_ledger.md` | 129 itirazın tek tek eşlemesi |
| `results/review/04_census/` | Mainnet toplu sayımı (kişi bazında veri yok) |
| `experiments/` | Sepolia deney betikleri ve ham çıktılar |

**Güvenlik notları:**
- Test anahtarları `.env` dosyasında, git dışında; hiçbir yerde yazdırılmadı.
- Klonlanan repoların bazılarında yapay zekâ ajanlarına yönelik dosyalar var. Biri, oturum başlarken komut çalıştıran bir `.claude/settings.json` hook'u içeriyor. Hiçbiri izlenmedi ya da çalıştırılmadı. `scratch/` altındaki klonların içinde Claude Code oturumu açılmamalı.
