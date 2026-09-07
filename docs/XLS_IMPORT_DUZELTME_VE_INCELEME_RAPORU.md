# XLS İçe Aktarma Düzeltmesi ve Uzman İnceleme Raporu

**Tarih:** 2026-09-07 · **Kapsam:** XLS/XLSX/CSV içe aktarma akışının uçtan uca düzeltilmesi + veritabanı ve yazılım mühendisliği açısından genel eksiklik incelemesi.

---

## 1. Sorun: "XLS verisi içeri aktarılmıyor"

Gerçek dünya koşullarına uygun bir `.xlsx` (gerçek tarih hücreleri, Türkçe para biçimi `1.234,56`, küçük harf `fba`, başlık üstünde açıklama satırı, boş Orderno) ile uçtan uca test yapıldı. Eski kod **tüm satırları reddediyordu**:

```
İçe aktarılamadı: N satırda sorun var, aktarılacak geçerli satır kalmadı.
```

### Bulunan kök nedenler (6 kritik hata)

| # | Hata | Etki |
|---|------|------|
| K1 | `xlsx` bağımlılığı `cdn.sheetjs.com`'dan iniyor; ağ kısıtlı ortamlarda `npm ci/install` **tamamen patlıyor** | Build/deploy kırık — özellik hiç derlenemiyor |
| K2 | İstemci ön-dönüşümü `String(hücre).replace(",", ".")` **yalnızca ilk virgülü** çeviriyor: `1.234,56` → `1.234.56` → sayıya çevrilemedi | Binlik ayraçlı her tutar satırı reddediyor |
| K3 | Gerçek Excel tarih hücreleri **seri numarası** (`46043`) olarak okunup `TEXT` `order_date` kolonuna yazılıyordu | Sessiz veri bozulması; tarih filtreleri/KPI'lar çöküyor |
| K4 | Küçük harf `fba` değeri katı enum kontrolüne takılıyordu | Türkçe kullanıcı girişi yaygın; satır reddediliyordu |
| K5 | Orderno boşken `cols[11] \|\| cols[5]` zinciri **sipariş numarası olarak ASIN** yazıyordu | Yanlış kimlik + sahte mükerrer çakışmaları |
| K6 | `CountPerBundle` (33. kolon) hiçbir yerde okunmuyordu | Sessiz veri kaybı |

### Uygulanan düzeltmeler

**Kurulum hattı (K1):**
- `xlsx@0.20.3` tarball'ı `vendor/` altına sabitlendi (`file:vendor/xlsx-0.20.3.tgz`); `npm ci` artık ağ bağımsız. ADR-001 güvenlik taban çizgisi (CVE-2023-30533 / CVE-2024-22363 yamalı 0.20.3) korundu. `scripts/vendor-xlsx.sh` CDN'e erişemediğinde npm aynasına (`@e965/xlsx`) düşecek şekilde güncellendi. Ayrıntı: `vendor/README.md`.

**Ortak ayrıştırıcı — yeni `src/lib/xlsRowParse.ts` (K2, K3, K5, K6):**
- `normalizeExcelDate()`: Excel seri numarası, `Date` nesnesi, ISO ve Türkçe (`GG.AA.YYYY`, `GG/AA/YYYY`, 2 haneli yıl, ABD-ters yazımı) biçimlerini `YYYY-MM-DD`'ye indirger; çözülemeyen `null`.
- `detectHeaderRow()` + başlık eşleme: ilk 8 satırda bilinen başlıklar aranır (Türkçe-duyarsız katlama + ≥6 karakterli güvenli önek eşleşmesi — `Birim maliyeti` ⇒ alias `Birim maliyet`; `Tarihi geçmiş adet-P4` ⇒ tarihe **eşlenmez**). Bulunamazsa resmî 40-kolon konumsal eşlemeye geri düşer. Başlık üstündeki title/boş satırlar otomatik atlanır.
- Para değerleri **ham bırakılır**; tek doğruluk noktası sunucudaki `normalizeMoney`'dir.
- Boş Orderno artık `WO-########` üretir; ASIN asla sipariş no yerine geçmez.
- `countPerBundle` (indeks 32) artık okunur.

**Sunucu doğrulama ve yazma (`importValidation.ts`, `import-xls/route.ts`) (K3, K4):**
- `normalizeFulfillmentType()`: `fba`/`FBA ` gibi girdiler kanonikleşir; `DHL` gibi gerçekten geçersiz değerler hâlâ raporlanır.
- Çözülemeyen dolu tarih, satır bazında **açık gerekçeyle** raporlanır (eski sessiz bozulma yerine). Boş tarih bugüne düşer (mevcut davranış).
- Insert tarafında sayaç alanları doğrulamayla aynı `normalizeCount`'tan geçer (doğrulanan = yazılan).
- `normalizeMoney`'ye `NUMERIC(10,2)` üst sınır koruyucusu (99.999.999,99) — DB taşma hatası yerine net satır raporu.
- `resolveProduct`'a **kanonikleşmiş** tarih gider; tedarikçi fiyat gözlemleri doğru güne yazılır.
- İstemci + Drive-URL route'u `XLSX.read(..., { cellDates: true })` kullanır. Üç ayrıştırma yolu (dosya yükleme, Drive URL, kopyala-yapıştır) artık **tek ortak modülü** paylaşır.
- Önizleme tablosundaki para/adet input'ları `type="text" + inputMode` oldu — `type="number"` virgüllü Türkçe değerleri boş gösteriyordu.

### Doğrulama

- **269/269 test** (`npm test`), **typecheck**, **lint**, **production build** (`npm run build`) — hepsi yeşil.
- Uçtan uca HTTP testi (gerçek `.xlsx` → parse → `POST /api/orders/import-xls` → DB okuma):
  - `21.01.2026` tarih hücresi → `2026-01-21` ✓, `"1.234,56"` → `1234.56` ✓, `"3.703,68"` → `3703.68` ✓
  - `fba` → `FBA` ✓, `CountPerBundle=2` ✓, boş Orderno → üretilmiş `WO-…` ✓
  - Aynı dosyanın tekrarı mükerrer raporuyla atlanır (tasarlandığı gibi) ✓
  - Çoklu kaynak: dosya yükleme, Drive URL ve yapıştırma yolları aynı çıktıyı üretir ✓

---

## 2. Uzman Veritabanıcı İncelemesi

**Güçlü bulunanlar:** `orders` üzerinde `(order_number, buyer_store, asin)` benzersiz indeksi + FK'ler (`buyer_store → stores`, `product_id → products`), CHECK güvenlik ağı (sevk/fire ≤ adet, negatif tutar yok, enum kısıtları), `products`/`supplier_offers`/`product_lifecycle_events` ayrımı (kimlik vs. zaman serisi vs. olay defteri), satır-bazlı savepoint ile transaction bütünlüğü.

| Öncelik | Bulgular / öneriler |
|---|---|
| Orta | `orders.order_date` `TEXT` (YYYY-MM-DD disiplinine uygulama bağımlı). ISO metin sıralaması doğru çalışır; ileride `DATE` tipine geçiş + `order_date ~ '^\d{4}-\d{2}-\d{2}$'` CHECK'i düşünülebilir. Bu düzeltmeyle gelen normalizasyon geçişi kolaylaştırır. |
| Orta | `orders` için sayfalama varsayılanı yok (`SELECT *`, büyüyen tablo). Liste endpoint'ine limit/offset veya imleç önerilir. |
| Düşük | Otomatik mağaza oluşturma `stores.status='ACTIVE'` bırakıyor; operasyon raporu için `notes`'taki "Otomatik" işareti yeterli, ek alan gerekmez. |
| Bilgi | Tedarikçi fiyat tekilleştirmesi (aynı gün+tedarikçi+fiyat) doğru; import yoğunluğunda `(product_id, observed_at)` indeksi yeterli. |

## 3. Uzman Yazılımcı İncelemesi

**Güçlü bulunanlar:** merkezî zod doğrulama + boyut sınırı, oturum-zorlamalı mağaza kapsamı (`resolveStoreScope`), audit'a her import'un işlenmesi, "0 satır yazıldıysa 200 dönmez" kuralı, kapsamlı test tabanı (PGlite entegrasyon + route testleri).

| Öncelik | Bulgular / öneriler |
|---|---|
| Yapıldı | Üç ayrıştırma yolunun kopya kod kayması (K5/K6'nın asıl sebebi) → tek modül `xlsRowParse.ts`. |
| Orta | `importXlsSchema` satır içeriğini gevşek bırakıyor (route normalize ediyor — bilinçli); alan tipleri ileride `xlsRowParse` çıktı tipiyle sözleşmelenebilir. |
| Orta | Sentry DSN tanımlanmamışsa kapalı; import hataları `audit_logs`'a da düştüğü için izlenebilirlik yeterli. |
| Düşük | Önizleme tablosu 10 kolon gösteriyor; diğer alanlar (marka, Tarih2, kart) import'a sessizce dahil — ileride "tüm kolonlar" görünümü eklenebilir. |
| Düşük | `.env.example`'a kısa bir "lokal PGlite ile çalıştırma" notu eklenebilir (`DATABASE_URL=pglite:./.pglite-dev` + `npm run db:bootstrap`). |

## 4. Değişen dosyalar

```
vendor/xlsx-0.20.3.tgz        (yeni — vendored bağımlılık, 2.4 MB)
vendor/README.md              (yeni — neden/içerik/güncelleme)
scripts/vendor-xlsx.sh        (CDN erişilemezse npm aynasına düşer)
package.json, package-lock.json (xlsx → file:vendor/...)
src/lib/xlsRowParse.ts        (yeni — tek doğruluk noktası ayrıştırıcı)
src/lib/xlsRowParse.test.ts   (yeni — 19 test)
src/lib/importValidation.ts(+test) (fulfillment kanonikleştirme, tarih doğrulama, para üst sınırı)
src/app/api/orders/import-xls/route.ts (kanonik tarih/sayaç/fulfillment, fiyat gözlemi tarihi)
src/app/api/orders/import-drive-url/route.ts (ortak ayrıştırıcı + cellDates)
src/components/GoogleDriveXlsImportModal.tsx (ortak ayrıştırıcı, önizleme input tipleri)
.gitignore (.pglite-*/)
```
