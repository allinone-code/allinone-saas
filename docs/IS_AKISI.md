# CERBERUS — İş Akışı (Kullanıcı Giriş Yaptıktan Sonra Ne Oluyor?)

Bu belge, uygulamanın **gerçek kodundan** çıkarılmıştır. Her adımda hangi dosya
ve hangi API uç noktasının çalıştığı belirtilmiştir. Tasarım niyeti değil,
mevcut davranış anlatılır.

---

## 0. Bir cümlede iş modeli

CERBERUS, **ABD'den ürün tedarik edip Amazon FBA üzerinden satan** çok mağazalı
bir e-ticaret operasyonunun karar ve takip sistemidir.

Değer zinciri:

```
Araştırmacı ürün bulur → Karar motoru "alınır mı?" der → Sipariş verilir
   → Ürünler PSH deposuna gelir → Sayım yapılır → Batch'lenip FBA'e sevk edilir
      → Kâr/fire muhasebesi tutulur → Sabah brifingi yöneticiye özetler
```

Sistemin ana iddiası şudur: **yönetici sabah tek ekrana bakar ve "bugün ne
yapmalıyım?" sorusunun cevabını hesaplanmış veriyle alır.**

---

## 1. Giriş ve oturum doğrulama

**Dosyalar:** `src/app/login/page.tsx`, `src/features/useCerberusData.ts`,
`POST /api/auth/login`, `GET /api/auth/me`

1. Kullanıcı `/login` ekranında e-posta + parola girer.
2. `POST /api/auth/login` kimliği doğrular ve **imzalı bir oturum çerezi** yazar.
3. Ana sayfaya (`/`) yönlendirilir. `useCerberusData` hook'u ilk iş olarak
   `GET /api/auth/me` çağırır.
4. Oturum geçersizse **anında `/login`'e geri atılır.** Burada bilinçli bir
   karar var: oturum doğrulanamazsa sistem sahte/demo veriye düşmez, çünkü bir
   yöneticinin demo veriyi gerçek sanması en tehlikeli senaryodur.

### Roller ve ilk çatallanma

| Rol | Mağaza kapsamı | Menüde "Komuta Merkezi" |
|---|---|---|
| `ADMIN` | Tüm mağazalar, değiştirilebilir | ✅ Görür |
| `MANAGER` | Tüm mağazalar, değiştirilebilir | ✅ Görür |
| `STORE_USER` | **Kendi mağazasına kilitli** | ❌ Görmez |

`STORE_USER` için mağaza seçici üst çubukta kilit ikonuyla donar. Kritik nokta:
bu kilit yalnızca arayüzde değil, **sunucuda da zorlanır** — mağaza kullanıcısı
elle `?storeCode=ALL` isteği gönderse bile API kapsamı kendi mağazasına
düşürür. Arayüz kısıtı bir güvenlik önlemi değildir; asıl kapı sunucudadır.

---

## 2. Açılışta ne yükleniyor?

Oturum doğrulanır doğrulanmaz **iki istek paralel** gider
(`useCerberusData.load`):

| İstek | Getirdiği |
|---|---|
| `GET /api/orders?storeCode=…` | siparişler, mağazalar, PSH batch'leri |
| `GET /api/intelligence?storeCode=…` | ürün ana kayıtları, araştırmacılar, **sabah brifingi** |

İkisi de `cache: no-store` ile çağrılır — operasyonel veride bayat sayı
gösterilmez. Bir `AbortController` yarış durumunu engeller: kullanıcı hızlıca
mağaza değiştirirse eski isteğin geç dönen cevabı yenisinin üzerine yazamaz.

Yükleme başarısız olursa ekran boş veri göstermez; kırmızı bir uyarı şeridi ve
"Tekrar dene" düğmesi çıkar.

---

## 3. Varsayılan varış noktası: Sabah Brifingi

Kullanıcı **her zaman** `BRIEFING_DECISION` sekmesinde açılır. Bu, ürünün
felsefesidir: kullanıcı boş bir tabloya değil, **bir yargıya** iner.

### 3.1 İş Sağlığı Skoru (0–100)

`src/domain/briefing.ts` içindeki `computeBusinessHealth` beş ekseni ağırlıklı
toplar. Skor sabit kodlanmış değildir; canlı siparişlerden hesaplanır.

| Eksen | Ağırlık | Ne ölçer |
|---|---|---|
| Kârlılık (Landed-Cost ROI) | %30 | Gerçek ROI, hedef ROI'ye karşı |
| FBA Sevk Performansı | %22 | Sevk edilen adet / toplam adet |
| Fire & Problem Oranı | %20 | Problemli sipariş oranı |
| Veri Tazeliği | %15 | Kaç ürün kaydı `FRESH` |
| Nakit Sızıntısı (Refund) | %13 | İade tutarı / harcama |

Not karşılıkları: **≥85 GÜÇLÜ · ≥70 İYİ · ≥55 İZLEMEDE · ≥40 ZAYIF · altı KRİTİK**

Her eksen kendi gerekçesini (`detail`) taşır; skor tıklanabilir bir açıklamadır,
kapalı bir kutu değil.

### 3.2 Üç soru

Panel, yöneticinin gerçekte sorduğu üç soruya ayrılır:

- **Ne değişti?** — dünden bugüne oynayan metrikler
- **Ne önemli?** — önem sırasına dizilmiş riskler
- **Ne yapmalıyım?** — *eyleme dönüştürülebilir* maddeler

Üçüncüsü işin kalbi. `buildWhatShouldIDo` şu tetikleyicileri tarar ve her
maddeye kaynağını (`metric`) iliştirir:

| Tetikleyici | Önerilen eylem | Önem |
|---|---|---|
| `decisionAction = BUY` olan ürünler | Satın alma emirlerini onaya taşı | INFO |
| Bekleyen politika onayları | Onayları sonuçlandır | WARN |
| `pshBatchNo IS NULL` siparişler | Sevkiyat partisi aç | WARN |
| `p2MissingQty > 0` | Depo sayım eşleştirmesini kapat | **CRITICAL** |
| `decisionAction = REJECT` olan ürünler | Kaynak listelerinden düş | INFO |

Liste öneme göre sıralanır ve **en fazla 5 maddeye** kırpılır. Bu bilinçli bir
kısıt: 30 maddelik bir yapılacaklar listesi hiç liste olmamasıyla aynı şeydir.

### 3.3 Karar Kasası

Aynı sekmenin altında, karar motorunun ürün bazlı çıktıları durur. Buradan
kullanıcı doğrudan **eyleme geçer** — brifingdeki "3 ürün BUY kararında"
maddesi, hemen altındaki tabloda o ürünlere karşılık gelir.

---

## 4. Karar motoru — "bu ürünü alalım mı?"

**Dosya:** `src/domain/decisionEngine.ts`

Altı risk ekseni ağırlıklı toplanarak bir **Fırsat Skoru** üretilir:
kârlılık %28, talep %22, rekabet %15, fiyat istikrarı %13, tedarikçi riski %12,
operasyonel risk %10.

Karar dört sonuçtan biridir ve kural sırası önemlidir:

| Koşul | Karar | Politika | Risk |
|---|---|---|---|
| Duplicate skoru ≥ 80 | **WAIT** | Yönetici onayı gerekir | HIGH |
| ROI < %25 | **REJECT** | IP riski işaretli | HIGH |
| ROI < %38 | **TEST** | Politikaca onaylı | MEDIUM |
| Diğer | **BUY** | Politikaca onaylı | LOW |

Duplicate kontrolünün ROI'den **önce** gelmesi kasıtlıdır: çok kârlı görünen bir
ürün, ekipte başkası zaten araştırdıysa yine de beklemeye alınır. Kârlılık,
mükerrer emeği meşrulaştırmaz.

Kârlılık hesabı `calculateLandedCostAndProfit` ile yapılır — ürün fiyatı değil,
**landed cost** (kargo, vergi, FBA ücretleri dahil) esas alınır.

---

## 5. Günlük operasyon döngüsü

Sol menü, işin akış sırasına göre dizilmiştir: **Karar → Tedarik → Operasyon →
Finans → Yönetim.** Menü rozetleri canlı sayıları gösterir; "Fire & Problem"
rozeti sıfırdan büyükse kırmızıya döner.

### 5.1 Tedarik — Sourcing Ekibi

Araştırmacıların **kalite düzeltilmiş** performans karnesi. Ölçü "kaç ürün
buldu" değil, bulduklarının kaçının BUY'a dönüştüğüdür. Hacim değil isabet
ödüllendirilir.

### 5.2 Siparişler (40 kolonluk ana tablo)

Operasyonun ana çalışma yüzeyi. Üç yoldan veri girer:

1. **Tek sipariş** — "Yeni Sipariş" modalı
2. **Google Drive XLS** — Drive bağlantısı yapıştırılır → `POST /api/orders/import-drive-url`
3. **Dosya yükleme** — `POST /api/orders/import-xls`

Tabloda arama, kargo durumu ve batch filtreleri vardır. **CSV dışa aktarım**
40 kolonu RFC 4180 uyumlu üretir; formül enjeksiyonuna karşı `=+-@` ile başlayan
hücreler nötrlenir — dışa aktarılan dosya Excel'de açıldığında kod çalıştıramaz.

Bir siparişe tıklandığında yan çekmece açılır; kargo durumu şu değerleri alır:
**Tam Geldi · Yolda · İPTAL · Kayıp Depoya gelmiş.**

### 5.3 PSH Partileri

FBA'e gitmeden önce ürünler bir batch'te toplanır. `POST /api/batches` ile yeni
parti açılır. Brifing, batch'e atanmamış siparişleri sürekli kovalar — burası
operasyonun en sık tıkandığı yerdir.

### 5.4 Depo Sayımı

Fiziksel gerçekle kaydın yüzleştiği adım. Order No eşleştirilir, gelen adet
girilir; sistem farkı otomatik **P2 (eksik)** olarak hesaplar. Defolu adet
**P3** olarak ayrıca kaydedilir. `PATCH /api/orders/{id}` ile yazılır.

### 5.5 Fire & Problem Yönetimi

Dört problem sınıfı ve iade takibi:

| Kod | Anlamı |
|---|---|
| **P1** | İptal edilen adet |
| **P2** | Eksik gelen adet |
| **P3** | Defolu adet |
| **P4** | Tarihi geçmiş adet |

Bir sipariş şu koşulda "problemli" sayılır:
`cargoStatus='İPTAL' OR p1>0 OR p2>0 OR p3>0 OR p4>0 OR refundAmount>0`

### 5.6 Inventory Lab (Finans)

Birim maliyet, satış fiyatı ve net marj dökümü. Karar motorunun *tahmin* ettiği
kârın, gerçekleşen kârla karşılaştırıldığı yer — döngüyü kapatan adım.

---

## 6. Yönetim — Komuta Merkezi (yalnız ADMIN/MANAGER)

Altı alt sekme: **Mağazalar · Kullanıcılar · Sipariş CRUD · SP-API · Denetim
Kayıtları · Veritabanı Araçları.**

Denetim kaydı ayrıca önemlidir: kritik işlemler iz bırakır, giriş ekranındaki
"tüm oturumlar denetim kaydına alınır" ifadesi karşılıksız değildir.

---

## 7. Günün tam döngüsü (özet)

```
08:00  Giriş → Sabah Brifingi açılır
       └─ Sağlık skoru + "Ne yapmalıyım?" 5 maddesi

08:05  Karar Kasası → BUY ürünleri onaya taşınır
       └─ WAIT/REJECT olanlar listeden düşürülür

09:00  Sourcing → araştırmacı isabet oranları gözden geçirilir

10:00  Siparişler → XLS içe aktarılır, yeni siparişler girilir

13:00  Depo Sayımı → gelen kargo eşleştirilir, P2/P3 kaydedilir

15:00  PSH Partileri → batch'lenmemiş siparişler için parti açılır

17:00  Fire & Problem → P1–P4 ve iadeler kapatılır
       Inventory Lab → günün marjı kontrol edilir

Ertesi sabah: skor yeniden hesaplanır → döngü kapanır
```

Kritik olan şu: **çıktı girdiyi besler.** Bugün kapatılan P2 kayıtları yarınki
"Fire & Problem" eksenini yükseltir; batch'lenen siparişler "FBA Sevk" eksenini
iyileştirir. Sistem bir raporlama aracı değil, bir geri besleme döngüsüdür.

---

## 8. Zayıf halkalar — GİDERİLDİ (2026-09-02)

Belgenin ilk sürümünde tespit edilen üç kopuk halka kapatıldı.

### 8.1 Gerçekleşen ROI artık ölçülüyor

**Önce:** `actualRoiPercent = roiPercent * 0.96` — tahminden sabit katsayıyla
türetilen kurgu bir sayı. Karar motoru kendi tahminini kendi notlandırıyordu.

**Şimdi:** `src/domain/realizedRoi.ts`. Gerçekleşen ROI, ürünün ASIN'ine bağlı
**fiili sipariş satırlarından** hesaplanır:

- Gelir yalnızca **Amazon'a sevk edilmiş** adetten doğar; depoda bekleyen mal
  para kazanmış sayılmaz.
- İadeler brüt gelirden düşülür.
- Fire (P1–P4) adetleri kaybedilir ama **maliyeti silinmez** — o para harcandı.
  Bu, ROI'yi bilinçli olarak acımasız kılar; fire gerçekten cezalandırılır.
- Ölçülecek veri yoksa sayı **uydurulmaz**: `null` döner, arayüz "henüz
  ölçülmedi" ya da "sevkiyat bekleniyor" gösterir.

`computeRoiVariance` tahmin ile gerçeği karşılaştırır: ±5 puan `ON_TARGET`,
üstü `OPTIMISTIC`, altı `PESSIMISTIC`. Karar motorunun kalibrasyonu artık
ölçülebilir.

> Canlı doğrulama: 3 sipariş / 12 adet sevk edilmiş bir ASIN'de tahmini ROI
> %53.18 iken gerçekleşen **%35.18** çıktı — 18 puan iyimser sapma. Eski kod
> bu ürünü "%51.05" diye raporlayacaktı.

### 8.2 Veri tazeliği artık zamandan hesaplanıyor

**Önce:** `dataFreshnessStatus` elle set edilen bir metindi ve yeni kayıtlara
daima "FRESH" yazılıyordu. Sağlık skorunun %15'i, güncellemesi unutulabilen
bir alana bağlıydı — eksen yapay olarak hep yüksekti.

**Şimdi:** `src/domain/dataFreshness.ts`. Tazelik `observedAt` damgasından
**hesaplanır**; bir sayı elle "taze" ilan edilemez, taze olmayı zamanla
kaybeder.

| Yaş | Durum | Puan |
|---|---|---|
| 0–7 gün | FRESH | 100 |
| 8–21 gün | AGING | 100→60 (doğrusal) |
| 22–45 gün | STALE | 60→20 |
| 45+ gün / tarih yok | EXPIRED | 0 |

Gözlem tarihi olmayan kayıt varsayılan olarak taze **sayılmaz**, EXPIRED olur.

> Canlı doğrulama: kayıtlara 12/30/90 günlük yaş verildiğinde tazelik ekseni
> 100'den **25**'e, genel skor 50'den **39**'a düştü. Sahte iyimserlik gitti.

### 8.3 Karar motoru artık ne bilmediğini söylüyor

**Önce:** Altı eksen sabit ağırlıklarla toplanıyordu ama dördü gerçek sinyal
taşımıyordu. Skorun ~%35'i bilgi içermeyen dolguydu ve tek bir "Fırsat Skoru:
88" olarak sunuluyordu — olmayan bir kesinlik iddiası.

**Şimdi:** Her eksen `provenance` ile etiketlenir:

| Eksen | Kaynak | Eski ağırlık | Yeni ağırlık |
|---|---|---|---|
| Kârlılık | `MEASURED` | %28 | **%45** |
| Talep | `HEURISTIC` | %22 | %22 |
| Rekabet | `HEURISTIC` | %15 | %15 |
| Fiyat İstikrarı | `ASSUMED` | %13 | **%6** |
| Tedarikçi Riski | `ASSUMED` | %12 | **%6** |
| Operasyonel Risk | `ASSUMED` | %10 | **%6** |

Salt varsayımların toplam ağırlığı **%35 → %18**'e indirildi; artık skoru
domine edemezler. Her sinyal gerekçesini (`basis`) Türkçe taşır, arayüzde
"%45 ölçüm · 3 eksen tahmini" olarak gösterilir.

Ayrıca **güven skoru kanıt kapsamıyla sınırlandı**: sabit varsayımlara dayanan
bir karar artık "%92 eminim" diyemez. Sistem kendi cehaletini itiraf ediyor.

Gerçek pazar verisi bağlandığında yapılacak tek şey ilgili eksenin
provenance'ını `MEASURED`'a çevirip ağırlığını yükseltmektir.

### 8.4 Boş sistem artık "KRİTİK" demiyor

Sıfırlama sonrası test ederken ek bir dürüstlük hatası bulundu: veri yokken
sağlık skoru **"33 KRİTİK"** gösteriyordu. Veri yokken iş sağlığı kötü
değildir — *ölçülemez*. Yönetici olmayan bir problemi kovalamaya başlardı.

Artık `healthMeasurable: false` döner, arayüz skor yerine
**"— Ölçülemedi · veri bekleniyor"** gösterir.

---

## 9. Gerçek veriyle başlangıç

Admin → Komuta Merkezi → **Veritabanı Araçları** altına yeni bir seçenek
eklendi: **"0. Gerçek Veriyle Başlangıç"** (`FRESH_START_REAL_DATA`).

| Silinen | Korunan |
|---|---|
| `orders` | `stores` (mağaza tanımları) |
| `psh_batches` | `users` (kullanıcı hesapları) |
| `product_masters` | `researchers` (araştırmacı kadrosu) |
| `research_sessions` | `audit_logs` (denetim izi) |

**Mevcut "1. Sadece Siparişleri Temizle" seçeneğinden farkı:** ürün ana
kayıtlarını da siler. Aksi halde demo ürünler kalır, gerçek siparişlerle
eşleşmez ve gerçekleşen ROI ölçümü hayalet ürünler üzerinden kirlenir.

> Bu risk teorik değil: sıfırlama öncesi demo veride 4 ürün ana kaydı ile 24
> siparişin ASIN kesişimi **sıfırdı**. Eski kodun ROI'yi uydurmak zorunda
> kalmasının sebebi tam olarak buydu.

İşlem `RESET-CERBERUS` onay kodu ister, yalnızca `ADMIN` rolüne açıktır ve
üretim ortamında (`NODE_ENV=production`) tamamen devre dışıdır. Her çalıştırma
denetim kaydına yazılır.

### Canlıya geçiş sırası

1. Komuta Merkezi → Veritabanı Araçları → onay kutusuna `RESET-CERBERUS`
2. **"Gerçek Veriyle Başla"** → sistem boşalır, skor "Ölçülemedi" olur
3. Mağaza tanımlarını ve kullanıcı yetkilerini gözden geçirin (korundular)
4. Siparişler sekmesi → Google Drive XLS bağlantısı ya da dosya yükleme
5. İlk sevkiyat kapandığında gerçekleşen ROI **kendiliğinden** hesaplanmaya
   başlar; sabah brifingi gerçek sayılarla dolar

---

## 9.5 Aşama 3 — keşif hattı (2026-09-02)

Ürün artık siparişten önce var olabilir. Araştırmacı **Ürün Portföyü → Ürün keşfet**
ile ASIN, alış ve satış fiyatı girer. `POST /api/intelligence` katalogda ürünü
`DISCOVERED` doğurur, karar motorunu çalıştırır ve durakları yürütür:

```
DISCOVERED → ANALYZING → SCORED → APPROVED   (BUY / TEST)
DISCOVERED → REJECTED                        (düşük ROI — analiz uydurulmaz)
WAIT ise SCORED'da kalır
```

Karar Kasası'ndaki BUY/TEST/WAIT/REJECT düğmesi aynı durakları senkronlar.
Onaylı ürüne sipariş yazılınca durak `PURCHASING`'e geçer; satıştaki ürün geri gitmez.

---

## 10. Kalan teknik borç

Bu turda kapatılmayan, bilinçli olarak devredilen maddeler:

- `morning_briefings` tablosu yok; brifing her istekte runtime hesaplanır.
  Tarihsel trend ("dünden bugüne ne değişti") bu yüzden sınırlı.
- Talep ve rekabet skorları hâlâ `HEURISTIC` — gerçek pazar verisi (Keepa,
  SP-API satış sıralaması) bağlanmadı.
- `productMasters` mağaza kapsamsız: ürün ana kayıtları tüm mağazalarda ortak
  görünür, `storeCode` filtresi yalnızca siparişlere uygulanır.
- Bileşen testi yok (vitest node ortamında, jsdom kurulu değil). Görsel
  regresyonlar otomatik yakalanamıyor.
