# CERBERUS — Veri Mimarisi İncelemesi ve Ürün Bazlı Model Önerisi

**Tarih:** 2026-09-02
**Kapsam:** `orders` tablosu merkezli mevcut tasarımın veritabanı, iş analizi ve
e-ticaret operasyonu açısından değerlendirilmesi
**Yöntem:** Mevcut şema + gerçek XLS verisi (24 satır) üzerinde ölçüm

---

## 0. Kısa cevap

**Evet, ciddi bir tasarım eksikliği var.**

Sistem şu anda XLS dosyasının **tamamını tek bir düz tabloya** (`orders`, 40+
kolon) yazıyor. Bu, bir Excel dosyasını veritabanına *kopyalamak*tır — onu
*modellemek* değil. Excel'in düz yapısı veritabanına olduğu gibi taşındığında
Excel'in tüm zayıflıkları da beraberinde geliyor.

En kritik sonuç: **sistem "ürün" diye bir şeyi gerçekten bilmiyor.** Ürün,
sipariş satırlarının içinde tekrar eden metin alanları olarak yaşıyor. Bu
yüzden "bu üründen toplam ne kazandık?" sorusu ancak metin eşleştirmesiyle,
kırılgan biçimde cevaplanabiliyor.

Aşağıdaki bulguların hepsi **mevcut gerçek veriden ölçülmüştür**, teorik değil.

---

## 1. Bulgular — ölçümle

### B-01 · Ürün verisi %50.8 oranında tekrar ediyor (KRİTİK)

24 sipariş satırında yalnızca **12 benzersiz ürün** var.

| Ölçüm | Değer |
|---|---|
| Sipariş satırı | 24 |
| Benzersiz ASIN | 12 |
| Ürün düzeyi alanların toplam boyutu | 10.709 karakter |
| Bunun tekrar eden kısmı | 5.438 karakter (**%50.8**) |
| En uzun ürün başlığı | 200 karakter |

Her sipariş satırı şunları yeniden yazıyor: `productTitle` (200 karaktere
kadar), `imageUrl`, `supplierUrl`, `amazonUrl`, `brandName`, `msku`, `asin`,
`supplierName`, `supplierCode`.

Bu yalnızca disk israfı değil. Asıl maliyet **güncelleme anomalisi**: bir
ürünün Amazon başlığı değişirse 5 satırın 5'ini birden güncellemek gerekir.
Biri atlanırsa veri sessizce çelişkili hale gelir.

### B-02 · Aynı ürün farklı maliyetlerle kayıtlı — ve bu bir hata değil (KRİTİK)

Ölçüm, aynı ASIN'in farklı satırlarda farklı `unitCost` taşıdığını gösterdi:

| ASIN | Tarih bazlı maliyet seyri | Değişim |
|---|---|---|
| `B0DGQX1FS7` | 2026-02-11: $29.99 → 2026-02-13: **$26.24** | **-%12.5** |
| `B0D47RZVR3` | 2026-02-11: $23.99 → 2026-02-12: **$21.59** | **-%10.0** |
| `B01CQ3E6HG` | 2026-01-21: $34.26 → 2026-01-23: $34.27 | +%0.03 |

Bu **gerçek ve değerli bir sinyal**: tedarikçi fiyatı iki günde %12.5 düştü.
Bir arbitraj işletmesi için bu, "aynı üründen tekrar al" demektir.

Ama mevcut şemada bu bilgi **hiçbir yerde ürünün özelliği olarak durmuyor**.
`product_masters.sourcePrice` tek bir skaler değer; hangi tarihe ait olduğu
belirsiz. Fiyat geçmişi `costHistory` adlı bir JSONB kolonunda tutuluyor —
yani sorgulanamaz, indekslenemez, agregasyona giremez.

Sonuç: sistem fiyat trendini **göremiyor**. "Bu ürünün maliyeti düşüyor mu?"
sorusu SQL ile cevaplanamıyor.

### B-03 · `orders` ile `product_masters` arasında ilişki yok (KRİTİK)

Veritabanındaki foreign key'ler:

```
orders.buyer_store   → stores
orders.psh_batch_no  → psh_batches
```

**`orders` → `product_masters` bağlantısı yok.** İki tablo ASIN metni üzerinden
"umutla" eşleşiyor.

Bunun bedeli somut: bir önceki turda gerçekleşen ROI motorunu bağlarken, demo
veride 4 ürün kaydı ile 24 siparişin **ASIN kesişiminin sıfır** olduğunu
ölçtük. Kimse fark etmemişti çünkü veritabanı bunu engelleyecek bir kısıt
tanımıyor. Eski kodun ROI'yi `roiPercent * 0.96` ile uydurmak zorunda
kalmasının kök nedeni tam olarak buydu.

### B-04 · Hiç CHECK constraint yok (YÜKSEK)

```sql
select count(*) from pg_constraint
where contype='c' and conrelid::regclass::text in ('orders','product_masters');
-- 0
```

Veritabanı şu anda şunları kabul eder:

- `quantity = -5` (negatif adet)
- `shippedToAmazon = 999` iken `quantity = 3` (sipariş edilenden fazla sevk)
- `p1+p2+p3+p4 > quantity` (var olandan fazla fire)
- `unitCost = -10` (negatif maliyet)
- `cargoStatus = 'asdf'` (tanımsız durum)

Bu kuralların bir kısmı uygulama katmanında var, ama **veritabanı son
savunma hattıdır**. Toplu import, manuel SQL düzeltmesi veya ileride yazılacak
bir servis bu kuralları atlarsa veri sessizce bozulur.

> Not: Mevcut gerçek veride sevk/fire tutarsızlığı bulunmadı (0 satır) —
> yani veri şu an temiz. Sorun, temiz kalacağının **garanti altında olmaması**.

### B-05 · Durum alanları serbest metin (ORTA)

`cargoStatus`, `pshStatus`, `inventoryLabStatus`, `lifecycleStage`,
`decisionAction`, `riskLevel` — hepsi `text`.

Kod içinde `cargoStatus === "İPTAL"` gibi karşılaştırmalar var. Türkçe karakter
içeren bir string'e karşı yapılan eşitlik kontrolü kırılgandır: `"IPTAL"`,
`"İptal"`, `"iptal "` (sondaki boşluk) sessizce eşleşmez ve sipariş problemli
sayılmaz — brifing yanlış skor üretir.

### B-06 · Sipariş başlığı ile kalemi ayrılmamış (ORTA)

Ölçüm: 24 satırın 24'ü benzersiz `orderNumber` taşıyor; çok kalemli sipariş
yok. Yani bugünkü veri bu sorunu **henüz göstermiyor**.

Ama gerçek dünyada bir satın alma siparişi çoğu zaman birden fazla kalem
içerir. Mevcut şemada `orderNumber` + `buyerStore` üzerinde unique index var:

```sql
uniqueIndex("orders_order_number_store_uq").on(t.orderNumber, t.buyerStore)
```

Bu, **aynı siparişe ikinci bir kalem eklenmesini fiilen imkânsız kılıyor**.
Tedarikçiden tek seferde 3 farklı ürün alındığında sistem ya kaydı reddedecek
ya da sahte sipariş numaraları üretmek gerekecek.

Ayrıca sipariş düzeyindeki alanlar (`orderEmail`, `creditCard`, `driveLink`,
`orderDate`, `supplierName`) her kalemde tekrar edecek.

### B-07 · Türetilmiş değer kolon olarak saklanıyor (ORTA)

`totalCost` kolonu `unitCost × quantity` olmalı. Ölçüm:

| Sipariş | unitCost × qty | Kayıtlı totalCost | Fark |
|---|---|---|---|
| WO110074774 | 205.56 | 205.58 | +0.02 |
| WO110074746 | 274.08 | 274.11 | +0.03 |
| WO110075476 | 137.08 | 137.06 | **-0.02** |

**24 satırın 5'inde tutarsızlık var.** Farklar küçük (yuvarlama/kargo payı
olabilir) ama sorun şu: hangisi doğru? Sistem bilmiyor, çünkü ilişkiyi
tanımlayan bir kural yok. `correctedCost` diye ayrı bir kolon daha var ve onun
ne zaman devreye girdiği belirsiz.

### B-08 · Migration disiplini eksik (ORTA)

`drizzle/` altında yalnızca `0000_faz2-baseline.sql` var. `package.json`:

```
"db:push": "drizzle-kit push   # YALNIZ lokal geliştirme"
```

Şema değişiklikleri `push` ile yapılıyorsa üretimde geri alınabilir, sıralı ve
denetlenebilir bir göç geçmişi yok demektir. Aşağıdaki model önerisi zaten
versiyonlu migration gerektiriyor.

### B-09 · Ürün kayıtları mağaza kapsamsız (DÜŞÜK — şimdilik)

`orders.buyerStore` var ama `product_masters`'ta mağaza kavramı yok. Bugünkü
veride tek mağaza (`HRN`) kullanıldığı için sorun görünmüyor. Çok mağazalı
operasyonda aynı ürün farklı mağazalarda farklı fiyata listelenecek —
`channelListings` JSONB'si bunu tutmaya çalışıyor ama sorgulanamıyor.

---

## 2. Kök neden: yanlış tanecik boyutu (granularity)

Mevcut model tek bir tanecik boyutu tanıyor: **sipariş satırı**.

Oysa bu işte en az beş farklı kavram var ve her birinin kendi yaşam döngüsü,
kendi değişim hızı ve kendi sahibi var:

| Kavram | Değişim hızı | Sahibi | Mevcut durumu |
|---|---|---|---|
| **Ürün** (ASIN/UPC) | Neredeyse hiç | Katalog | Satırlara dağılmış |
| **Tedarikçi teklifi** (fiyat) | Günlük | Sourcing | `costHistory` JSONB'de gömülü |
| **Satın alma siparişi** | Bir kez | Satın alma | Kalemle iç içe |
| **Sipariş kalemi** | Bir kez | Satın alma | `orders` tablosu |
| **Envanter hareketi** | Sürekli | Depo/FBA | Kolon olarak (`shippedToAmazon`) |

Hepsini tek tabloya sıkıştırmak, **hızlı değişen veriyle hiç değişmeyen
veriyi aynı satırda tutmak** demektir. Fiyat her gün değişirken ürün başlığı
sabittir; ikisini aynı yere yazarsanız ya fiyat geçmişini kaybedersiniz ya da
başlığı 500 kez tekrarlarsınız. Şu anda **her ikisi de** oluyor.

---

## 3. Önerilen model — ürün merkezli

### 3.1 Kavramsal yapı

```
                    ┌──────────────┐
                    │   products   │  ← ürünün DEĞİŞMEYEN kimliği
                    │ (ASIN/UPC)   │     (başlık, marka, kategori)
                    └──────┬───────┘
                           │ 1
              ┌────────────┼────────────────┬──────────────────┐
              │ N          │ N              │ N                │ N
    ┌─────────▼──────┐ ┌──▼─────────────┐ ┌▼───────────────┐ ┌▼──────────────┐
    │ supplier_offers│ │ product_listings│ │  order_items   │ │inventory_moves│
    │ fiyat ZAMANLA  │ │ mağaza×ürün    │ │ satın alınan   │ │ her hareket   │
    │ (tarihli seri) │ │ (fiyat/stok)   │ │ kalem          │ │ (sevk/fire)   │
    └────────────────┘ └────────────────┘ └───────┬────────┘ └───────────────┘
                                                   │ N
                                          ┌────────▼────────┐
                                          │purchase_orders  │ ← sipariş BAŞLIĞI
                                          │ (mail, kart,    │
                                          │  tarih, drive)  │
                                          └─────────────────┘
```

### 3.2 Tablolar ve gerekçeleri

#### `products` — ürünün tek doğruluk kaynağı

Değişmeyen kimlik burada yaşar: `asin` (unique), `upc`, `title`, `brand`,
`category`, `imageUrl`, `isFragile`, `isMultiPack`, `countPerBundle`.

**Kazanç:** 200 karakterlik başlık 5 kez değil 1 kez saklanır. Başlık
değişince tek satır güncellenir. B-01'deki %50.8 tekrar sıfırlanır.

#### `supplier_offers` — fiyatın zaman serisi

`(productId, supplierId, observedAt, unitPrice, currency, inStock, sourceUrl)`

**Kazanç:** B-02'deki fiyat düşüşü artık sorgulanabilir bir olgu:

```sql
-- Son 30 günde maliyeti %10'dan fazla düşen ürünler
select p.asin, p.title,
       first_value(o.unit_price) over w as eski,
       last_value(o.unit_price)  over w as yeni
from supplier_offers o join products p on p.id = o.product_id
window w as (partition by o.product_id order by o.observed_at)
```

Bu sorgu bugün **yazılamıyor**, çünkü veri JSONB içinde gömülü.

Ayrıca `dataFreshness` motoru artık doğal bir yuvaya kavuşur: tazelik,
`supplier_offers.observedAt`'in yaşıdır — ayrı bir alan tutmaya gerek kalmaz.

#### `purchase_orders` + `order_items` — başlık/kalem ayrımı

Sipariş düzeyi alanlar (`orderNumber`, `orderDate`, `orderEmail`,
`creditCard`, `driveLink`, `supplierId`, `buyerStore`) başlıkta; kalem düzeyi
alanlar (`productId`, `quantity`, `unitCost`, `packCount`) kalemde.

**Kazanç:** B-06 çözülür — çok kalemli sipariş mümkün hale gelir.
`orderNumber` unique kısıtı artık doğru yerde (başlıkta) durur ve ikinci kalem
eklemeyi engellemez.

#### `inventory_movements` — fire ve sevkiyatın olay defteri

`shippedToAmazon`, `p1CancelQty`…`p4ExpiredQty` kolonları yerine hareket
kayıtları: `(orderItemId, movementType, quantity, occurredAt, note)`.
`movementType`: `RECEIVED | SHIPPED_FBA | CANCELLED | MISSING | DEFECTIVE |
EXPIRED | RETURNED`.

**Kazanç:** *Ne zaman* fire olduğu öğrenilir. Bugün "3 adet eksik" biliniyor
ama ne zaman tespit edildiği bilinmiyor — depo performansı ölçülemiyor.
Mevcut kolonlar bir **anlık görüntü**; hareket defteri bir **tarihçe**.

#### `product_listings` — mağaza × ürün

`channelListings` JSONB'sinin yerine gerçek tablo: `(productId, storeId,
sellingPrice, status, stock)`.

**Kazanç:** B-09 çözülür; "hangi ürün hangi mağazada kaça satılıyor" sorgusu
mümkün olur.

### 3.3 Veri bütünlüğü kuralları (B-04 için)

```sql
alter table order_items add constraint qty_positive
  check (quantity > 0);
alter table order_items add constraint unit_cost_non_negative
  check (unit_cost >= 0);
alter table inventory_movements add constraint move_qty_positive
  check (quantity > 0);
```

Sevk + fire ≤ sipariş adedi kuralı hareket tablosunda tetikleyici veya
uygulama katmanı + periyodik doğrulama sorgusu ile korunur.

Durum alanları için (B-05) PostgreSQL `enum` ya da en azından
`check (cargo_status in (...))`. Türkçe karakterli serbest metin
karşılaştırması ortadan kalkar.

### 3.4 Türetilmiş değerler (B-07 için)

`totalCost` kolonu kaldırılır; `quantity * unitCost` olarak hesaplanır.
Gerçekten farklı bir tutar ödendiyse (kargo, vergi, indirim) bunlar
**ayrı ve adı konmuş** kolonlar olur: `shippingCost`, `taxAmount`,
`discountAmount`. "Düzeltilmiş maliyet" belirsizliği (`correctedCost`) böylece
biter.

---

## 4. Somut kazanımlar

| Bugün imkânsız / kırılgan | Önerilen modelde |
|---|---|
| "Bu üründen toplam ne kazandık?" | `products` üzerinden tek JOIN |
| "Maliyeti düşen ürünler hangileri?" | `supplier_offers` pencere fonksiyonu |
| Çok kalemli satın alma siparişi | `purchase_orders` + `order_items` |
| "Fire ne zaman tespit edildi?" | `inventory_movements.occurredAt` |
| Ürün başlığını güncellemek | 1 satır (bugün N satır) |
| Gerçekleşen ROI eşleşmesi | FK garantisi (bugün metin eşleştirme) |
| Aynı ürün farklı mağazada farklı fiyat | `product_listings` |
| Negatif adet / aşırı sevk | CHECK constraint reddeder |

**Depolama:** ürün alanlarındaki %50.8 tekrar ortadan kalkar. Veri hacmi
büyüdükçe kazanç doğrusal artar — 10.000 siparişte tek bir başlık değişikliği
bugün 10.000 satır UPDATE'i, yeni modelde 1 satır.

---

## 5. Risk ve geçiş stratejisi

Bu, tek seferde yapılacak bir değişiklik **değil**. `orders` tablosu şu anda
canlı akışın merkezinde; doğrudan parçalamak sistemi durdurur.

### Aşama 0 — Güvenlik ağı (düşük risk, hemen)
- CHECK constraint'leri ekle (B-04)
- Durum alanlarını enum'a çevir (B-05)
- Versiyonlu migration disiplinine geç (B-08)

Bu aşama mevcut kodu **hiç değiştirmez**, sadece veritabanını sertleştirir.

### Aşama 1 — Ürünü ayır (orta risk)
- `products` ve `supplier_offers` tablolarını oluştur
- Mevcut `orders` satırlarından ASIN bazında `products` üret
- `orders.productId` FK kolonu ekle (önce nullable, geri doldur, sonra
  `not null`)
- `orders` kolonlarını **silme** — okuma yollarını kademeli olarak yeni
  tabloya taşı

### Aşama 2 — Siparişi böl (yüksek risk)
- `purchase_orders` / `order_items` ayrımı
- `orders` bir görünüme (`view`) dönüştürülerek eski sorgular çalışmaya
  devam eder

### Aşama 3 — Envanter olay defteri
- `inventory_movements`; mevcut P1–P4 kolonları geriye dönük hareket olarak
  yazılır

Her aşama kendi başına değer üretir ve geri alınabilir. Aşama 0 bugün
yapılabilir; Aşama 2 ancak yeterli test kapsamı varken denenmelidir.

---

## 6. Öneri

**Aşama 0'ı hemen uygulamayı öneriyorum.** Kod değişikliği gerektirmez, riski
düşüktür ve B-04'teki sessiz bozulma riskini bugün kapatır.

**Aşama 1 bir sonraki iş paketi olmalı.** Ürünü ayırmak, gerçekleşen ROI
motorunun (geçen turda kurduğumuz) metin eşleştirmesi yerine FK garantisiyle
çalışmasını sağlar — yani sistemin en değerli özelliğini sağlamlaştırır.

Aşama 2 ve 3, gerçek çok kalemli sipariş ihtiyacı doğduğunda ele alınmalıdır.
Bugünkü veride (24/24 tek kalemli) acil değil.

---

# EK — AŞAMA 1 UYGULANDI (2026-09-02)

Rapordaki Aşama 1 hayata geçirildi. Aşağıdaki sonuçlar **canlı veritabanında
gerçek veri üzerinde** ölçülmüştür.

## Kurulan yapı

| Tablo | Rolü |
|---|---|
| `products` | Ürünün tek doğruluk kaynağı; ASIN unique |
| `supplier_offers` | Tedarikçi fiyatının **zaman serisi** |
| `product_lifecycle_events` | Ürünün hafızası — her durak bir olay |
| `orders.product_id` | FK (B-03'ün kapanışı) |

Ürünün yolculuğu 12 duraklı bir durum makinesi olarak modellendi:
`DISCOVERED → ANALYZING → SCORED → APPROVED → PURCHASING → IN_WAREHOUSE →
LISTED → SELLING → MONITORING → PAUSED / DISCONTINUED` (+ `REJECTED`).
Geçerli geçişler `isValidTransition` ile kilitlendi; durak atlanamaz.

## Geri doldurma sonuçları (gerçek veri)

```
Girdi satırı        : 24
Benzersiz ürün      : 12
Fiyat gözlemi       : 16
Yinelenen (atlandı) : 8
Tekrar oranı        : %50.0
Bağlanan sipariş    : 24
Bağlanmamış kalan   : 0     ← B-03 kapandı
```

Script idempotenttir: ikinci çalıştırmada 0 yeni kayıt, 0 yinelenen gözlem.

## B-02'nin kanıtı — artık sorgulanabilir

Raporun yazıldığı anda **imkânsız** olan sorgu şimdi çalışıyor:

| ASIN | Ürün | Gözlem | İlk | Son | Değişim |
|---|---|---|---|---|---|
| B0DGQX1FS7 | FORCE FACTOR Hair Growth | 2 | $29.99 | $26.24 | **-%12.50** |
| B0D47RZVR3 | FORCE FACTOR Total Beets | 2 | $23.99 | $21.59 | **-%10.00** |
| B01CQ3E6HG | MegaFood Baby & Me 2 | 2 | $34.26 | $34.27 | +%0.03 |

İki gerçek arbitraj fırsatı, eskiden JSONB içinde görünmez haldeydi.

## Ürün zekâsı — yeni yetenek

`GET /api/products` ürünün tüm yolculuğunu tek yerde toplar ve bir **yargı**
üretir. Kural sırası kasıtlıdır: **önce para kaybı, sonra operasyon, sonra
büyüme.** Zarar eden bir ürün, maliyeti düşse bile "daha al" tavsiyesi alamaz.

Canlı portföy çıktısı:

```
totalProducts: 12    productsAtLoss: 7    buyingOpportunities: 2
byVerdict: UNMEASURED 6, HEALTHY 3, STOP_LOSS 1, FIX_OPERATIONS 1, SCALE_UP 1
byStage:   PURCHASING 5, SELLING 6, IN_WAREHOUSE 1
```

### Ortaya çıkan iş bulguları

**1. B01CQ3E6HG — gizli kanama (STOP_LOSS)**

| Maliyet | Gelir | İade | Alınan | Sevk | Fire |
|---|---|---|---|---|---|
| $1.027,91 | $240,00 | $890,85 | 30 | 4 | **26** |

Bu ürün tek başına portföyün en büyük zarar kalemi. 30 adetten 26'sı fire
olmuş, harcamanın %87'si iade olarak geri dönmüş. Sipariş bazlı görünümde bu
5 ayrı satıra dağıldığı için **fark edilmiyordu**; ürün bazlı toplamda anında
görünür hale geldi.

**2. B0D47RZVR3 — büyüme fırsatı (SCALE_UP)**

ROI %35.18 ve tedarikçi maliyeti -%10. Kârlı bir üründe arbitraj penceresi
açık; sipariş miktarı artırılmalı. Bu sinyal iki ayrı veri kaynağının
(gerçekleşen kâr + fiyat trendi) birleşmesinden doğuyor — ikisi de eski
mimaride yoktu.

**3. Portföy net kârı -$2.660,78 · 12 üründen 7'si zararda**

Sipariş bazlı bakışta toplam ciro ve harcama görünüyordu; hangi ürünün
sermayeyi yaktığı görünmüyordu.

## Doğrulama

- Testler **117 → 171** (+54): 27 backfill, 19 ürün zekâsı, 8 entegrasyon
- Veritabanı garantileri PGlite üzerinde gerçek migration ile kanıtlandı:
  ASIN unique, FK zorlaması, cascade, RESTRICT (siparişi olan ürün silinemez),
  negatif fiyat reddi, tanımsız durak reddi
- `tsc` temiz · `eslint` 0 hata · `next build` başarılı

## Sırada ne var

Aşama 1 tamamlandı ama `orders.product_id` hâlâ **nullable**. Bir sonraki
adım (Aşama 1.2): import yolunu ürün oluşturacak şekilde güncelleyip kolonu
`NOT NULL` yapmak. Bundan sonra ürünsüz sipariş yazmak **fiziksel olarak
imkânsız** hale gelir.

Aşama 2 (purchase_orders/order_items ayrımı) ve Aşama 3
(inventory_movements) raporun 5. bölümündeki sırayla ele alınmalıdır.

---

## EK — AŞAMA 1.2 UYGULANDI (2026-09-02)

### Kapatılan bulgu: B-03 (ürünsüz sipariş)

Aşama 1'de `orders.product_id` eklenmişti ama **nullable**'dı: yani şema ürünü
öneriyordu, zorunlu kılmıyordu. Bu, mimarinin en kırılgan noktasıydı — tek bir
unutulmuş `insert(orders)` çağrısı katalogun dışında sipariş yaratıp tüm ürün
merkezli raporlamayı sessizce yanlışlardı.

Aşama 1.2 bu boşluğu kapattı: **`product_id` artık `NOT NULL`.**

```
  product_id nullable: NO
  yetim sipariş sayısı: 0
  ürünsüz sipariş denemesi: REDDEDİLDİ (23502 not_null_violation)
```

### Nasıl güvenli hale getirildi

**1. Tek giriş kapısı — `src/db/resolveProduct.ts`**

Sipariş yazan beş yolun tamamı artık aynı `resolveProduct()` çözümleyicisinden
geçiyor. Dağınık mantık yerine tek bir "get-or-create" noktası:

| Yazma yolu | Durum |
|---|---|
| `api/orders/import-xls` (toplu import) | ✅ bağlandı |
| `api/orders` (manuel sipariş) | ✅ bağlandı |
| `api/admin/database-reset` | ✅ bağlandı |
| `db/seed.ts` | ✅ bağlandı |
| entegrasyon testleri | ✅ fixture ürün |

Çözümleyici her siparişte üç şey yapar: ürünü bulur ya da yaratır, tedarikçi
fiyatını **gözlem** olarak kaydeder, yeni üründe ilk **yaşam döngüsü olayını**
yazar. Yani her sipariş Cerberus'un hafızasını büyütür.

**2. Göç güvenlik kontrolü**

`drizzle/0003_concerned_luke_cage.sql` doğrudan `SET NOT NULL` yapmıyor. Önce
yetim satır sayıyor ve varsa anlaşılır bir Türkçe mesajla duruyor:

> `Gecis durduruldu: N adet siparis henuz bir urune bagli degil. Once "npx tsx scripts/backfill-products.ts" calistirin.`

Aksi halde göç üretimde ham bir Postgres hatasıyla yarıda kalırdı.

**3. Sıfırlama yolları düzeltildi**

`database-reset` yeni tabloları temizlemiyordu; siparişler silinince ürünler
yetim kalıp katalogu kirletiyordu. Artık:
- `FRESH_START` / `NUKE` → ürün çekirdeği tamamen sıfırlanır
- `CLEAN_ORDERS_ONLY` → **ürün kataloğu korunur** (keşif bilgisi siparişten
  bağımsız bir varlıktır), yalnızca siparişlerden türeyen fiyat gözlemleri gider

### Yakalanan gerçek hata: sessiz veri kaybı

Toplu yükleyicinin ilk hali ASIN'siz satırı `continue` ile **sessizce
atlıyordu**. 24 satır gönderip 23'ünün yazıldığını kimse fark etmezdi. Test
bunu yakaladı; artık satır numarası ve sipariş numarasıyla hata fırlatıp
transaction'ı geri alıyor.

### Doğrulama

| Kontrol | Sonuç |
|---|---|
| Test paketi | **186/186 geçti** (171'den +15) |
| `resolveProduct` entegrasyon testleri | 15 yeni test, gerçek migration üzerinde |
| `eslint` | temiz |
| `next build` | başarılı |
| Sıfırdan seed (backfill'siz) | 24 sipariş → **12 ürün, 16 gözlem, 12 olay**, 0 yetim |
| Canlı manuel sipariş (ASIN'siz) | HTTP 422 reddedildi |
| Canlı manuel sipariş (yeni ASIN) | HTTP 200 → ürün + gözlem + olay otomatik oluştu |

Seed'in backfill çalıştırmadan ürettiği sayılar (12/16/12), geri doldurmanın
ürettiği sayılarla **birebir aynı** — iki yol aynı katalogda buluşuyor.

### Sırada ne var

Veri katmanı artık ürün merkezli ve kısıtlarla kilitli. Bundan sonrası
**Aşama 2 — ürün yolculuğunun arayüzü**: ürün detay sayfası (tek ürünün tüm
hikâyesi: fiyat serisi, operasyon, P&L, olay defteri) ve durak geçişlerini
kullanıcının yönetebileceği ekranlar.
