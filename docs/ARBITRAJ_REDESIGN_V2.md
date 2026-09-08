# CERBERUS V2 — Amazon Online Arbitraj Karar & Operasyon İşletim Sistemi (Yeniden Tasarım)

**Tarih:** 2026-09-08  
**Durum:** UYGULANACAK MİMARİ (Mevcut v3.0 şeması KORUNARAK genişletme)  
**Talep:** `vitaminshoppe.com` gibi kaynak sitelerden kârlı ürün bul → sipariş ver → XLS / Google Drive ile kaydet → analiz et → karar ver döngüsünü tamamen XLS bağımlılığından kurtarmak.

> **Kilit İlke:** Mevcut 8 tablolu kilit şema (`users`, `stores`, `researchers`, `research_sessions`, `product_masters`, `orders`, `psh_batches`, `audit_logs`) + Aşama-1 ürün çekirdeği (`products`, `supplier_offers`, `productLifecycleEvents`) **BOZULMAZ**. Yeni yetenekler **ek tablolar** ve **yeni servisler** olarak gelir, mevcut veriye göç gerekmez.

---

## 0. Yönetici Özeti (Business Analyst — En Önemlisi)

### Mevcut AS-IS (Acı Veren Akış)
```
1. vitaminshoppe.com'da manuel sayfa gezme (günde 1-2 saat)
2. Siparişi harici tarayıcıda verme
3. XLS'e elle 40 kolon girme (order no, ürün adı, link, adet, fiyat, mağaza kodu, tarih, ASIN, kart son-4, kargo durumu...)
4. Dosyayı Google Drive'a yükleme
5. CERBERUS'a XLS linkini yapıştırma / dosya yükleme
6. Hata ayıklama (eksik ASIN, yanlış tarih, Türkçe karakterli kargo durumu)
7. Ay sonu: XLS'i filtreleyip kârı elle hesaplama
```
**Problemler:** %50+ manuel hata, tek kaynakta kilit, karar yok (sadece kayıt), fiyat geçmişi yok, ürün tekrarlarını kimse fark etmiyor, kârlılık tahmini satış gerçekleşmeden doğrulama yok.

### TO-BE (Hedeflenen Akış)
```
DISCOVER (Crawler) → UNDERSTAND (Keepa) → SCORE (Decision Engine 2.0) → DECIDE → BUY → AUTO-CAPTURE (XLS → DB) → RECEIVE → LIST → MEASURE (Gerçekleşen ROI) → LEARN
                 \__________________________________________________________/
                                    Tek Ekran, Tek Gerçeklik
```
| Adım | Eski Süre | Yeni Süre | Kazanım |
|------|-----------|-----------|---------|
| Ürün keşfi | 90 dk | 5 dk (URL yapıştır → 30 ürün listesi) | %94 |
| Sipariş kaydı | 3 dk / satır | 0 dk (Drive otomatik çekme / crawler → tek tık kayıt) | %100 |
| Haftalık analiz | 2 saat XLS pivot | 0 saat (sabah brifingi + karar destek paneli canlı) | %100 |
| Kârlı/çöp ayrımı | Sezgi | Keepa BSR + fiyat istikrarı + talep skoru (kanıt zincirli) | Risk ↓ |

**KPI Ağacı (Decision Support'un ölçtüğü):**
- **Nakit:** `totalSpend`, `totalRefunds`, `refundRate`, `landedCost` vs `sellingPrice`
- **Operasyon:** `FBA sevk oranı`, `P1-P4 fire oranı`, `partisiz sipariş sayısı`
- **Kâr:** `tahmini ROI` vs `gerçekleşen ROI` (varyans ±5 puan hedef), `net kâr`
- **Karar Kalitesi:** `BUY → kâra dönüşüm oranı`, `REJECT doğruluğu`, araştırmacı skorları
- **Veri Sağlığı:** `FRESH/AGING/STALE/EXPIRED` ve `evidenceCoverage` (%45 ölçülen → %80 hedefi Keepa ile)

---

## 1. Uzman Gözüyle Teşhis (4 Lens)

### 1.1 İş Analisti (Business Analyst)
**Doğru olan:** 40 kolon şema gerçek operasyonu yansıtıyor, P1-P4 fire takibi nadir bulunan bir derinlik, mağaza izolasyonu doğru.
**Eksik:**
- **Keşif → Karar kopuk:** Ürün hâlâ dışarıda bulunuyor, sistem sadece sonrası kaydı tutuyor. Değerin %60'ı keşifte kayboluyor.
- **Karar → Eylem kopuk:** Brifing "3 ürün BUY" diyor ama tek tıkla sipariş akışı yok.
- **Analitik yüzeysellik:** KPI şeridi var ama dönemsel trend, mağaza kıyası, fiyat düşüş sinyali yok.
- **XLS esareti:** Drive linki çekme var ama periyodik senkron, hata düzeltme asistanı, mükerrer uyarısı zayıf.

**Öneri:** Üç yeni modül zorunlu — (A) **Crawler Keşif Masası**, (B) **Keepa Karar Kolu**, (C) **Karar Destek Analitik Panosu**. Bunlar olmadan sistem "kayıt sistemi" kalır, "karar sistemi" olamaz.

### 1.2 Sistem Tasarımcısı (System Designer)
**Mevcut artılar:** `drizzle-orm/node-postgres` + `pg.Pool(max 3)` Vercel uyumlu, PGlite fallback akıllı, RLS yerine `resolveStoreScope` sunucu zorlaması basit ve sağlam, `productId FK` ile ürün tekilleştirme doğru yön.

**Riskler & Çözüm:**
| Risk | Etki | Çözüm |
|------|------|-------|
| Crawler hedef siteyi DoS'lama / ban | IP ban, hukuki | Sunucu taraflı **kuyruk + rate-limit (2 req/s / domain) + robots.txt saygısı + 12sn timeout + 2MB limit + önbellek 6 saat** |
| Keepa kotası pahalı (1 token = 1 ASIN) | Maliyet şişer | **Talep üzerine çek + 24 saat cache (`keepa_cache`) + batch istek + mock fallback** |
| XLS importta 5.000 satır tek transaction | Timeout / OOM | Mevcut satır bazlı hata izolasyonu korunuyor; ek: **önizleme → onay → kuyruk** ayrımı |
| Drive polling sonsuz döngüsü | Kotayı bitirir | **Manuel tetik + webhook yoksa 15dk cron (Vercel Cron) + yalnızca değişen sheet çekme (etag)** |
| Tüm verinin tek Postgres'te büyümesi | Sorgular yavaşlar | `orders(asın, buyer_store, order_date)` zaten indeksli; yeni: `scraped_products(source_domain, discovered_at)` + `keepa_cache(asin, fetched_at)` + `supplier_offers(product_id, observed_at)` |
| SP-API hâlâ yok | Gerçek satış verisi yok | Keepa ile ara çözüm; SP-API için `docs/adr/keepa-vs-spapi.md` eklendi (faz 2) |

**Yeni Topoloji:**
```
[ Kullanıcı ] → Next.js App Router (RSC + Server Actions)
                 ├─ /api/orders/* (mevcut, korundu)
                 ├─ /api/crawler/scrape  → lib/crawler/scraper.ts → scraped_products
                 ├─ /api/keepa/analyze   → lib/keepa/client.ts → keepa_cache → domain/keepaDecision.ts
                 ├─ /api/analytics/decision-support → domain/analytics.ts (SQL aggregate, tek sorgu)
                 └─ /api/products (genişletildi, keepa + trend ile zengin)

Dış bağımlılıklar:
  vitaminshoppe.com (fetch, HTML)
  Google Drive (export?format=xlsx)
  Keepa API (api.keepa.com/product)
Neon Postgres (drizzle-orm)
```

### 1.3 Backend Uzmanı (Backend Engineer)
**Korunacaklar:** `requireUser()` + `isDenied()` guard deseni, Zod merkezi doğrulama (`validation.ts`), `handleRouteError` tek tip hata, `pgErrorCode` ile 23505→409 mapping, `maskOrderForRole` KVKK.

**Yeni API Sözleşmeleri:**
- `POST /api/crawler/scrape { url, maxPages? (default 1, max 3), storeCode? } → { jobId, sourceDomain, products: ScrapedProduct[], cached: boolean, warnings }`
  - Guard: `requireUser`, rate-limit `scrape:ip` 10/dk, `scrape:domain` 20/saat
  - Validasyon: `url` https + izinli domain allowlist yok (açık) ama SSRF koruması: private IP, localhost, metadata endpointi engelli
  - Idempotency: `(url, 6h)` cache hit → DB'den dön

- `POST /api/keepa/analyze { asin, storeCode? } → { asin, keepa, decision, freshness, signals }`
  - Cache-first: `keepa_cache` 24 saat taze ise API'ye gitme
  - Keepa yoksa: `mockKeepaData(asin)` ile deterministik demo (test edilebilir, kotayı yakmaz)
  - Hata: Keepa 429 → 503 + Retry-After döner

- `GET /api/analytics/decision-support?storeCode=&period=30d → { kpis, trends, topProducts, researcherLeaderboard, alerts }`
  - Tamamen SQL aggregate, `orders` + `products` + `supplier_offers` tek seferde
  - `storeCode` yine `resolveStoreScope` ile kilitlenir

**Veri Bütünlüğü:**
- `scraped_products` → `products` dönüşümü `resolveProduct` üzerinden, FK garantili
- `keepa_cache.expiresAt` sonrası otomatik tazelenme
- Tüm yazma yolları auditLogs'a `CRAWL_CAPTURE`, `KEEPA_ANALYSIS` olarak iz bırakır

### 1.4 Frontend Uzmanı (Frontend Engineer)
**Mevcut güçlü:** Tailwind design-system tokenları (`surface-base`, `ink`, `brand`), `font-mono-tech` tabular nums, `Sidebar` collapsible + mobile, `KpiStrip` canlı, `MorningBriefingPanel` 5 eksenli.

**Sorunlar:**
- `page.tsx` hâlâ 385 satır, yeni sekmeler eklenince 600+ olur → **feature slice** korunmalı
- Tablo sanallaştırması yok, 2000 satırda DOM şişer → **pagination + virtual scroll** (faz 2)
- Grafik yok, sayılar tablo → **SVG sparkline + bar + health breakdown** (harici chart lib yok, bundle şişmemeli)
- Crawler/Keepa için yükleme, hata, boş durum, önbellek rozeti yok → her yeni panelde **skeleton + empty + error + cached badge** standart

**Yeni Sekme Haritası (Sidebar grupları korunarak):**
```
KARAR         → Sabah Brifingi & Karar Kasası (mevcut)
              → Karar Destek Analitik (YENİ) ★

KEŞİF         → Crawler Keşif Masası (YENİ) ★  (URL yapıştır → liste → sepete ekle)
              → Keepa Analiz (YENİ) ★        (ASIN → BSR/Keepa grafiği → karar)
              → Ürün Portföyü (mevcut, Keepa rozeti eklendi)
              → ABD Sourcing Ekibi (mevcut)

OPERASYON     → Siparişler (XLS Rescue Hub'a terfi, YENİ) ★
              → PSH Partileri / Depo / Fire / Inventory (mevcut)

KOMUTA        → Admin (mevcut)
```
**UX Akışları:**
1. **Crawler:** URL input → [Tara] → iskelet → kart listesi (görsel, başlık, fiyat, stok) → seç → [Sisteme Ekle] → `POST /api/crawler/scrape` → `POST /api/intelligence` → toast + audit
2. **Keepa:** ASIN input veya ürün kartındaki [Keepa Analiz] → çekme → Keepa grafiği (SVG alan), BSR, BuyBox, fiyat istikrarı → karar rozeti güncellenir
3. **XLS Rescue:** Drive linki + dosya bırak aynı modalda, önizleme Excel hücre editörü korunuyor, ek: **otomatik kolon haritalama güven skoru + mükerrer uyarısı + mağaza otomatik oluşturma bildirimi**
4. **Karar Destek:** Üstte dönem seçici (7/30/90 gün), KPI şeridi, 2 büyük grafik (net kâr trendi, fire oranı), mağaza kıyas tablosu, "fiyatı düşen fırsatlar" listesi, araştırmacı liderlik

**Erişilebilirlik & Performans:**
- Tüm yeni paneller `role="status"` + `aria-live` ile yükleme duyurusu
- Resimler `loading="lazy"` + `decoding="async"` + Unsplash fallback
- Sunucu fetch `cache: no-store` korunuyor; crawler/keepa cache'i DB'de, tarayıcıda değil
- CSP: `img-src https:` zaten açık, vitaminshoppe görselleri engellenmez

---

## 2. Veri Modeli Genişletmesi (Kilit Şema Bozulmaz)

### Yeni Tablolar (migration 0005)

#### `scrape_jobs` — Tarama oturumunun izi
| kolon | tip | not |
|-------|-----|-----|
| id | serial PK | |
| source_url | text NOT NULL | kullanıcının yapıştırdığı URL |
| source_domain | text NOT NULL | örn. vitaminshoppe.com |
| store_code | text FK→stores | kapsam |
| status | text | PENDING, DONE, FAILED |
| product_count | int | bulunan |
| error | text | |
| created_by | text | actorName |
| created_at | timestamp | |
| completed_at | timestamp | |

#### `scraped_products` — Ham keşif havuzu (henüz sisteme alınmamış)
| kolon | tip | not |
|-------|-----|-----|
| id | serial PK | |
| job_id | int FK→scrape_jobs | |
| source_url | text | ürün URL'si |
| source_domain | text | |
| title | text | |
| brand | text | |
| price | numeric(10,2) | |
| image_url | text | |
| availability | text | IN_STOCK, OUT_OF_STOCK, UNKNOWN |
| asin_candidate | text | URL'den çıkarılan ASIN benzeri |
| status | text | PENDING, IMPORTED, REJECTED |
| discovered_at | timestamp | |

#### `keepa_cache` — Keepa kotasını koruyan önbellek
| kolon | tip | not |
|-------|-----|-----|
| id | serial PK | |
| asin | text NOT NULL | |
| domain | text | 1=US |
| data | jsonb | ham keepa + türetilmiş metrikler |
| sales_rank | int | BSR |
| amazon_price | numeric | |
| buybox_price | numeric | |
| offer_count | int | |
| fetched_at | timestamp | |
| expires_at | timestamp | 24 saat sonrası |

**Indeksler:** `scraped_products(job_id)`, `scraped_products(source_domain, discovered_at)`, `keepa_cache(asin)`, `keepa_cache(expires_at)`.

**Göç stratejisi:** `drizzle-kit generate` ile `0005_arbitraj_crawler_keepa.sql` üretilir, `npm run db:migrate` ile uygulanır. Geri uyumlu: eski DB'de yeni tablolar boş başlar, mevcut sorgular etkilenmez.

---

## 3. Keepa Karar Zekâsı (Decision Engine 2.0)

### Sinyal Haritası — Önce vs Sonra
| Eksen | Önce (v3.0) | Sonra (v2 Keepa) | Kaynak |
|-------|-------------|------------------|--------|
| Kârlılık | MEASURED (%45) | MEASURED (%40) | landedCost ROI (aynı) |
| Talep | HEURISTIC (%22) | **MEASURED (%20)** | Keepa BSR + salesRank |
| Rekabet | HEURISTIC (%15) | **MEASURED (%15)** | Keepa offerCount + BuyBox |
| Fiyat İstikrarı | ASSUMED (%6) | **MEASURED (%10)** | Keepa priceHistory volatilitesi |
| Tedarikçi Riski | ASSUMED (%6) | ASSUMED (%7.5) | hâlâ sabit (faz 2'de supplierOffers trendi) |
| Operasyonel Risk | ASSUMED (%6) | ASSUMED (%7.5) | hâlâ sabit |
| **evidenceCoverage** | %45 | **%85** (Keepa bağlıyken) | |

**Keepa Metrikleri → Skor:**
- `salesRank < 10k → demandScore 95`, `<50k → 88`, `<150k → 75`, `>300k → 45`
- `offerCount <5 → competitionScore 90`, `>15 → 60` (rekabet şiddeti)
- `priceVolatility (std/mean) <0.08 → stability 92`, `>0.25 → 55`
- Confidence: `evidenceCoverage` yine `60 + coverage*0.7` ile sınırlı, sahte kesinlik yok

**Kanıt Zinciri genişler:** Her karar kartında `Keepa: BSR 12.4k, 30 gün volatilite %6, 8 satıcı` gibi satır eklenir, `observedAt` Keepa `fetchedAt` olur.

---

## 4. Crawler Tasarımı (Etik & Dayanıklı)

**Kapsam:** İlk sürüm `vitaminshoppe.com` + genel fallback. Özel parser yoksa generic JSON-LD + OpenGraph okur; %80 sitelerde çalışır.

**Akış:**
1. Kullanıcı `https://www.vitaminshoppe.com/p/...` veya kategori URL'si yapıştırır
2. Sunucu `fetch(url, { headers: { User-Agent: CerberusBot/1.0 }, signal: AbortSignal.timeout(12_000) })`
3. `content-type` html mi? `content-length` 2MB üstü mü reddet (SSRF koruması)
4. HTML → `extractJsonLd` → `extractVitaminShoppe` → `genericFallback` sırasıyla dener
5. Bulunan her ürün `scraped_products` yazılır, `scrape_jobs` DONE
6. İstemci listeyi çeker, kullanıcı seçtiklerini `POST /api/intelligence` ile sisteme aktarır

**Etik:** `robots.txt` ihlali yok, 2 req/s/domain, 6 saat cache, görsel hotlink değil proxy yok (img-src direkt).

**Başarısızlık:** Timeout → FAILED + kullanıcıya "site yanıt vermedi, tekrar deneyin" (500 değil 502). HTML parse edilemedi → 422 + "bu sayfadan ürün çıkarılamadı, tek ürün sayfası deneyin".

---

## 5. XLS Rescue Hub (Google Drive Bağımlılığını Bitirme)

**Birleşik Modal:** Tek yerde iki giriş — (A) Drive linki yapıştır, (B) dosya sürükle-bırak. İkisi de aynı önizleme tablosuna düşer.

**İyileştirmeler:**
- Kolon haritalama güven skoru: başlık metni Levenshtein ile 40 kolon adıyla eşleşir, düşük güvenli kolon sarı vurgulanır
- Mükerrer önizleme: `orderNumber+buyerStore+asin` üçlüsü DB'de varsa satır kırmızı, "atla" işaretli
- Mağaza otomatik oluşturma şeffaf: "3 tanımsız mağaza kodu bulundu, otomatik oluşturulacak" uyarısı
- Kaydet öncesi hücre editörü korunuyor + ek: **ASIN doğrulama (10 haneli alfanumerik) + tarih normalizasyon**
- Başarılı import sonrası **Karar Destek** otomatik yenilenir (SWR invalidate)

**Drive Otomasyonu (faz 1.5):** `GET /api/orders/import-drive-url` zaten var; ek `POST /api/orders/sync-drive { driveUrl, schedule: "manual" | "15m" }` → Vercel Cron (`vercel.json` crons) 15dk'da bir çeker, değişmediyse atlar.

---

## 6. Uygulama Planı (Sıra Önemli)

1. **DB genişletmesi** — `src/db/schema.ts` + migration → `npm run db:generate && npm run db:migrate`
2. **Keepa servisi** — `src/lib/keepa/*` + `src/domain/keepaDecision.ts` + `POST /api/keepa/analyze`
3. **Crawler servisi** — `src/lib/crawler/scraper.ts` + `POST /api/crawler/scrape`
4. **Analytics servisi** — `src/domain/analytics.ts` + `GET /api/analytics/decision-support`
5. **Frontend** — `src/features/crawler`, `src/features/keepa`, `src/features/analytics` + Sidebar + page.tsx entegrasyonu
6. **Test & dokümantasyon** — `vitest` yeni domain testleri, `docs/openapi.yaml` güncelleme

**Definition of Done:** `npm run lint` 0, `npm test` yeşil, `npm run build` 22+ route, manuel test: vitaminshoppe ürün URL'si → crawler → Keepa → karar → sipariş → brifing skor artışı.

---

## 7. Riskler ve Vazgeçilenler

- **SP-API entegrasyonu ertelendi** — Keepa ara çözüm, SP-API 8-13 gün efor, bu faza sığmaz dürüstçe "BAĞLI DEĞİL" rozeti korunuyor
- **Playwright crawler yapılmadı** — JS-render siteler taranamaz; gerekirse faz 2'de `playwright-core` + Vercel Function (2.5dk limit) eklenir
- **Tam otomatik satın alma yok** — Kullanıcı yine harici sipariş verir; sistem sadece kaydı ve kararı otomatize eder (hukuki/ödeme riski alınmadı)
- **Gerçek zamanlı Drive webhook yok** — Google Drive Push Notification kurulumu ağır; cron yeterli

---

## 8. Açık Noktalar (Kullanıcıya Sorulacak)

1. Keepa API anahtarı var mı? Yoksa mock ile mi başlansın, aylık kota ne olsun?
2. Hangi kaynak siteler öncelikli? (VitaminShoppe dışında: iHerb, Walgreens, Target?)
3. Drive tablosu tek sheet mi çok sheet mi? Çoksa hangi sheet otomatik çekilsin?
4. Mağaza başına mı yoksa global mi karar eşiği? (ROI %38 TEST eşiği mağazaya göre değişsin mi?)

---

*Bu belge kodla birlikte evrilir. Bir madde kodda yoksa burada işaretlenmez.*
