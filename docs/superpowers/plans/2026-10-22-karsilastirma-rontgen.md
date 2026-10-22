# Alım Listesi Röntgeni (Aşama 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının yüklediği alım listesini (`Sat26` sayfası) kendi içinde analiz eden röntgen ekranını kurmak: özet kartları, ASIN/order/MSKU/kart/ay kırılımları ve dolar etkisine göre sıralı hata listesi.

**Architecture:** Saf domain fonksiyonları (`src/domain`) satırları okur, özetler ve hataları bulur. Dosya tarayıcıda `xlsx` ile okunup satırlar JSON olarak `POST /api/reconciliation/xray` route'una gider (mevcut `compare` deseni); route yalnız ADMIN/MANAGER'a açık ve hiçbir şey kaydetmez. Ekran `src/features/analytics/XrayScreen.tsx`, mevcut `ReconciliationScreen` içine yeni bir bölüm olarak eklenir; arduvaz+camgöbeği palet yalnız bu ekranın kapsayıcısında yerel CSS değişkenleriyle tanımlanır.

**Tech Stack:** Next.js (projedeki sürüm; AGENTS.md gereği route/sayfa yazmadan `node_modules/next/dist/docs/` okunur), TypeScript, zod, `xlsx`, Vitest, Tailwind tokenları (`globals.css`).

**Spec:** `docs/superpowers/specs/2026-10-22-karsilastirma-rontgen-design.md`. Bu plan yalnız **Aşama 1 (röntgen)** kapsar. PSH karşılaştırması (Aşama 2) ayrı plan olacak.

## Global Constraints

- Salt okunur: veritabanına yazılmaz, dosya saklanmaz, veri otomatik düzeltilmez.
- Yetki: `requireRole("ADMIN", "MANAGER")`.
- Boyut: en fazla 50.000 satır (10 MB gövde sınırı mevcut `MAX_JSON_BODY_BYTES` ile; sınır aşılırsa neden yazan hata).
- Fiyat sapma eşiği varsayılan %25, ekranda ayarlanabilir; yalnız en az 3 satırı olan ASIN'ler için medyan hesaplanır.
- Alım tarihi `Tarih` kolonudur; `Tarih2` yalnız etiket kontrolünde kullanılır. `Depo26` ve `Data` sayfaları kullanılmaz.
- Başlıklar `normalizeHeaderLabel` (`@/lib/importFieldSchema`) ile eşlenir; zorunlu başlık eksikse hangileri eksik olduğu listelenir.
- İptal satırlar toplamlara dahil, ayrıca "iptal hariç" değeri gösterilir. İptal tespiti `isCancelledStatus` (`@/domain/sat26Hygiene`).
- Özet kartlarında genel dolar toplamı yoktur; kategori toplamları ayrı gösterilir.
- Palet (yalnız bu ekranda): zemin `#0f1517`, kart `#151d20`, çizgi `#243035`, ana yazı `#e8f0f2`, ikincil yazı `#84979d`, vurgu `#06b6d4`. Uyarı `#FBBF24`, tehlike `#FB7185`, olumlu `#34D399` projedeki gibi.
- Tüm kullanıcıya görünen metin Türkçe.

## Review Focus

1. Başlıkta/sonunda `\n` olan ASIN ("\nB00LAK1MGU"): temizlenmiş ASIN altında gruplanır **ve** `ASIN_DIRTY` bulgusu üretir.
2. `cellDates: true` ile okunan dosyada tarih JSON'a ISO metin olarak gelir; Excel seri sayısı ve "dd.mm.yyyy" metni de gelebilir. Üçü de tarih olarak okunur, okunamayan tarih hata vermeden "Tarihsiz" olur.
3. Boş sayfa, yalnız başlık satırı olan sayfa ve zorunlu başlıkları eksik sayfa: çökmez, `missingHeaders` döner.
4. Para değerleri metin gelebilir ("$1,234.50", "1.234,50" değil; yalnız `$` ve `,` temizlenir): sayıya çevrilir, çevrilemezse 0.
5. `Ürün adedi` 0 veya boş olan satır: sıfıra bölme yok, birim maliyet `null`, `TOTAL_MISMATCH` üretmez.

---

## File Structure

- Create `src/domain/sat26XrayRead.ts`: ham satırları `XrayRow`'a çevirir (başlık eşleme, tarih/para ayrıştırma, ASIN/MSKU temizliği).
- Create `src/domain/sat26Xray.ts`: `summarizeXray`, `findXrayIssues`, `buildXray`.
- Create `src/domain/sat26XrayRead.test.ts`, `src/domain/sat26Xray.test.ts`.
- Modify `src/lib/validation.ts`: `xraySchema`.
- Create `src/app/api/reconciliation/xray/route.ts`.
- Create `src/features/analytics/XrayScreen.tsx`.
- Modify `src/features/analytics/ReconciliationScreen.tsx`: üstte bölüm seçici.
- Modify `src/app/globals.css`: `.xray-theme` yerel değişkenleri.

### Task 1: Satırları okuma (`sat26XrayRead.ts`)

**Files:**
- Create: `src/domain/sat26XrayRead.ts`
- Test: `src/domain/sat26XrayRead.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface XrayRow {
    rowNo: number;            // sayfadaki satır numarası (başlık = 1, ilk veri = 2)
    buyer: string;            // "Satın Alan"
    date: Date | null;        // "Tarih"
    label: string;            // "Tarih2" (ör. "O26"), yoksa ""
    orderNo: string;          // "Orderno", boşluksuz
    asinRaw: string;          // ham ASIN
    asin: string;             // boşluk/satır sonu silinmiş, büyük harf
    mskuRaw: string;
    msku: string;             // cleanMsku
    qty: number;              // "Ürün adedi"
    unitCost: number | null;  // "Ürün birim maliyeti"; qty<=0 ise null
    totalCost: number;        // "Ürün toplam maliyeti"
    cargoStatus: string;      // "Kargo durumu", kırpılmış
    card: string;             // "Kredi Kartı" metin, boşsa ""
    shipped: number;          // "Amazona göndilen adet"
    p1: number; p2: number; p3: number; p4: number; // İptal/Eksik/Defolu/Tarihi geçmiş adet
  }
  export function readSat26Rows(raw: Record<string, unknown>[]): { rows: XrayRow[]; missingHeaders: string[] }
  ```
- Zorunlu başlıklar (eksikse `missingHeaders`'a Türkçe orijinal adıyla): `Tarih`, `ASIN`, `MSKU`, `Orderno`, `Ürün adedi`, `Ürün birim maliyeti`, `Ürün toplam maliyeti`, `Kargo durumu`, `Kredi Kartı`. Diğerleri isteğe bağlı (yoksa 0 / "").

- [ ] **Step 1: Write the failing tests** in `sat26XrayRead.test.ts`: (a) `readSat26Rows([])` → `{rows: [], missingHeaders: [...9 zorunlu]}`; (b) tek satırlık örnek (`ASIN: "\nB00LAK1MGU"`, `MSKU: "\nFCRB00LAK1MGU"`, `Tarih: 46043`, `"Ürün adedi": 4`, `"Ürün toplam maliyeti": "$185.44"`, `"Ürün birim maliyeti": 46.36`) → `asin === "B00LAK1MGU"`, `asinRaw === "\nB00LAK1MGU"`, `msku === "FCRB00LAK1MGU"`, `date` = 2026-01-?? (46043 = 2026-01-23; assert `toISOString().slice(0,10) === "2026-01-23"`), `totalCost === 185.44`, `rowNo === 2`; (c) `Tarih` ISO metin ("2026-03-03T00:00:00.000Z"), "03.03.2026" metni ve `Date` nesnesi aynı güne çıkar; çözülemeyen "abc" → `date === null`; (d) `"Ürün adedi": 0` → `unitCost === null`; (e) başlıkları büyük/küçük harf ve boşluk farklı ("ASIN ", "orderno") yine eşlenir; (f) `Kredi Kartı: 1753` (sayı) → `card === "1753"`.
- [ ] **Step 2: Run** `npx vitest run src/domain/sat26XrayRead.test.ts`. Expected: FAIL (modül yok).
- [ ] **Step 3: Implement `readSat26Rows`** — her ham satırın anahtarlarını `normalizeHeaderLabel` ile bir kez eşleyen küçük bir `pick` yardımcısı; Excel seri tarihi için `(n − 25569) × 86400000` ms (UTC); `$` ve `,` temizleyen para ayrıştırıcı; `cleanMsku` ve ASIN için `.replace(/\s+/g, "").toUpperCase()`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(xray): alım listesi satır okuyucu`.

### Task 2: Özet ve kırılımlar (`summarizeXray`)

**Files:**
- Create: `src/domain/sat26Xray.ts`
- Test: `src/domain/sat26Xray.test.ts`

**Interfaces:**
- Consumes: `XrayRow` (Task 1), `isCancelledStatus` (`./sat26Hygiene`).
- Produces:
  ```ts
  export interface XrayGroup {
    key: string; rows: number; units: number; cost: number;
    avgUnitCost: number | null; minUnitCost: number | null; maxUnitCost: number | null;
    cancelledRows: number;
  }
  export interface XrayCards {
    rows: number; orders: number; asins: number; mskus: number; units: number; cost: number;
    avgUnitCost: number | null; cancelledRows: number; cancelledRate: number; // 0..1
    unitsExCancelled: number; costExCancelled: number;
  }
  export interface XraySummary {
    cards: XrayCards;
    byAsin: XrayGroup[]; byOrder: XrayGroup[]; byMsku: XrayGroup[]; byCard: XrayGroup[]; byMonth: XrayGroup[];
  }
  export function summarizeXray(rows: XrayRow[]): XraySummary
  ```
- Kurallar: gruplar `cost` azalan sıralı, `byMonth` anahtara göre artan ("YYYY-MM", tarihsiz → "Tarihsiz" sonda); boş kart → "Kart yok"; `avgUnitCost = cost / units` (units 0 ise null); `unitsExCancelled`/`costExCancelled` iptal satırlar çıkarılmış.

- [ ] **Step 1: Write the failing tests**: 3 satırlık fixture (2 aynı ASIN farklı order, 1 İPTAL satır, 1 kartı boş) için `cards.rows === 3`, `cards.orders`, `cards.cancelledRate` (1/3), `costExCancelled`, `byAsin[0]` değerleri, `byCard` içinde "Kart yok", `byMonth` sırası; boş girdide tüm sayılar 0 ve `avgUnitCost === null`; "\nB00..." ve "B00..." tek ASIN grubunda birleşir.
- [ ] **Step 2: Run** `npx vitest run src/domain/sat26Xray.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `summarizeXray`** with one generic `groupBy(rows, keyFn)` helper.
- [ ] **Step 4: Run**. Expected: PASS.
- [ ] **Step 5: Commit** `feat(xray): özet kartları ve beş kırılım`.

### Task 3: Hata bulucu (`findXrayIssues`, `buildXray`)

**Files:**
- Modify: `src/domain/sat26Xray.ts`
- Test: `src/domain/sat26Xray.test.ts`

**Interfaces:**
- Consumes: `XrayRow`, `readSat26Rows`, `summarizeXray`, `isCancelledStatus`.
- Produces:
  ```ts
  export type XrayFindingCode =
    | "ASIN_DIRTY" | "ASIN_INVALID" | "MSKU_DIRTY" | "PRICE_OUTLIER" | "TOTAL_MISMATCH"
    | "QTY_OVERFLOW" | "STATUS_EMPTY" | "CARD_EMPTY" | "CARD_RARE" | "DATE_OUTLIER"
    | "LABEL_EMPTY" | "LABEL_YEAR_MISMATCH" | "DUPLICATE_KEY";
  export interface XrayFinding {
    code: XrayFindingCode; severity: "high" | "medium" | "low";
    rowNo: number; orderNo: string; asin: string; message: string;
    impactUsd: number | null;
  }
  export interface XrayOptions { priceDeviationPct?: number } // varsayılan 25
  export function findXrayIssues(rows: XrayRow[], opts?: XrayOptions): XrayFinding[]
  export interface XrayResult { missingHeaders: string[]; scanned: number; summary: XraySummary; findings: XrayFinding[] }
  export function buildXray(raw: Record<string, unknown>[], opts?: XrayOptions): XrayResult
  ```
- Kurallar (önem → kod): high: `PRICE_OUTLIER`, `TOTAL_MISMATCH`, `QTY_OVERFLOW`, `DUPLICATE_KEY`; medium: `ASIN_DIRTY`, `ASIN_INVALID`, `MSKU_DIRTY`, `STATUS_EMPTY`, `DATE_OUTLIER`; low: `CARD_EMPTY`, `CARD_RARE`, `LABEL_EMPTY`, `LABEL_YEAR_MISMATCH`.
  - `ASIN_DIRTY`: `asinRaw !== asin`. `ASIN_INVALID`: `asin` `/^B[0-9A-Z]{9}$/` değil.
  - `MSKU_DIRTY`: `mskuRaw` temizlenince değişiyorsa.
  - `PRICE_OUTLIER`: ASIN'in satır sayısı ≥ 3 ve `|unitCost − medyan| / medyan > pct/100`; `impactUsd = (unitCost − medyan) × qty` (iptal satırlar atlanır).
  - `TOTAL_MISMATCH`: `qty > 0` ve `|qty × unitCost − totalCost| > 0.05`; `impactUsd = totalCost − qty × unitCost`.
  - `QTY_OVERFLOW`: `shipped + p1 + p2 + p3 + p4 > qty`.
  - `STATUS_EMPTY`: `cargoStatus === ""`. `CARD_EMPTY`: `card === ""`. `CARD_RARE`: kart tüm dosyada tam 1 satırda geçiyor.
  - `DATE_OUTLIER`: tarihli satırların en sık görülen yılından farklı yıl. `LABEL_EMPTY`: `label === ""`. `LABEL_YEAR_MISMATCH`: etiket `\d{2}$` ile bitiyor ve bu 2 hane `date`'in yılının son 2 hanesinden farklı (ör. "T27" ama tarih 2026). Etiketteki ay harfinin kontrolü bu sürümde YOK (harf-ay eşlemesi belirsiz; spec'e not düşülecek).
  - `DUPLICATE_KEY`: aynı `orderNo|asin` birden çok satırda; her tekrar eden satır için bir bulgu.
  - `impactUsd` diğerlerinde `null`. Sonuç sıralaması: `|impactUsd|` azalan (null'lar sonda), sonra severity (high→low), sonra `rowNo`.

- [ ] **Step 1: Write the failing tests** (her kod için bir test, spec değerleriyle): `findXrayIssues` ile `PRICE_OUTLIER` (aynı ASIN 4 satır, birim 20/20/20/30 → 30'luk satır bulgu, `impactUsd = 10 × qty`; ASIN 2 satırsa bulgu yok); `ASIN_DIRTY` + `ASIN_INVALID` ("\nB00LAK1MGU" yalnız DIRTY, "XYZ" INVALID); `TOTAL_MISMATCH` (qty 4 × 10 ≠ 50 → impact 10; qty 0 → bulgu yok); `QTY_OVERFLOW`; `CARD_RARE` (bir kart tek satırda); `DATE_OUTLIER` (1 satır 2025, diğerleri 2026); `LABEL_YEAR_MISMATCH` ("T27" + 2026); `DUPLICATE_KEY`; sıralama (büyük etki üstte). Ayrıca `buildXray([])` → `missingHeaders.length === 9`, `findings` boş, `summary.cards.rows === 0`.
- [ ] **Step 2: Run** `npx vitest run src/domain/sat26Xray.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `findXrayIssues` and `buildXray`** — `buildXray` = `readSat26Rows` → `summarizeXray` + `findXrayIssues`; `missingHeaders` doluysa `findings` ve `summary` boş girdiyle hesaplanır (çökmez).
- [ ] **Step 4: Run** `npx vitest run src/domain`. Expected: PASS (mevcut testler dahil).
- [ ] **Step 5: Commit** `feat(xray): hata bulucu ve buildXray`.

### Task 4: Route ve şema

**Files:**
- Modify: `src/lib/validation.ts` (`xraySchema`)
- Create: `src/app/api/reconciliation/xray/route.ts`
- Test: `src/lib/validation.test.ts` (varsa; yoksa `src/domain/sat26Xray.test.ts` içine şema testi)

**Interfaces:**
- Consumes: `buildXray`, `XrayResult`, `requireRole`, `isDenied`, `parseBody`, `handleRouteError`.
- Produces: `POST /api/reconciliation/xray` gövde `{ rows: Record<string, unknown>[] (1..50000), priceDeviationPct?: number (1..500) }` → `200 XrayResult`; satır yoksa 400 (şema); `missingHeaders` doluysa 422 `{ error: "Zorunlu kolonlar bulunamadı: …", missingHeaders }`.

- [ ] **Step 1: Write the failing test**: `xraySchema.safeParse({rows: []})` başarısız; 50.001 satır başarısız; `{rows:[{a:1}], priceDeviationPct: 25}` başarılı.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement `xraySchema`** in `validation.ts` and the route; route kodunu yazmadan önce `src/app/api/reconciliation/compare/route.ts` desenini ve `node_modules/next/dist/docs/01-app` içindeki route handler bölümünü oku.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(xray): röntgen route'u (ADMIN/MANAGER)`.

### Task 5: Ekran ve tema

**Files:**
- Create: `src/features/analytics/XrayScreen.tsx`
- Modify: `src/features/analytics/ReconciliationScreen.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `POST /api/reconciliation/xray` (Task 4), `XrayResult` tipi (yalnız `import type`).
- Produces: `export function XrayScreen(): JSX.Element`; `ReconciliationScreen` en üstte iki düğmeli bölüm seçici gösterir ("Alım röntgeni" / "Amazon & Inventory Lab karşılaştırma"); röntgen yalnız `canAudit` (ADMIN/MANAGER) için görünür, varsayılan bölüm röntgen.

- [ ] **Step 1: `globals.css`** içine `.xray-theme { --color-surface-base:#0f1517; --color-surface-1:#151d20; --color-surface-2:#1a2427; --color-surface-3:#202c30; --color-line:#243035; --color-line-strong:#314247; --color-ink:#e8f0f2; --color-ink-muted:#84979d; --color-ink-faint:#5f7278; --color-brand:#06b6d4; --color-brand-soft:#22d3ee; }` ekle (surface-2/3 ve line-strong/ink-faint spec'te yok, türetilmiş değerlerdir; benim kararım).
- [ ] **Step 2: Implement `XrayScreen`** — mevcut `ReconciliationScreen`'in dosya okuma/sayfa seçme desenini izler (`xlsx` dinamik import, `cellDates: true`, varsayılan sayfa "Sat26" varsa o); eşik girişi (varsayılan 25); çalıştır düğmesi; hata ve `missingHeaders` mesajı; kartlar (satır, order, ASIN, MSKU, adet, maliyet, iptal hariç maliyet, ortalama birim, iptal oranı); "Bakılacaklar" listesi (kod etiketi Türkçe, severity rengi: high `text-danger`, medium `text-caution`, low `text-ink-muted`; ilk 200 satır + "N bulgu daha"); beş kırılım `<details>` bölümleri; her şey `className="xray-theme ..."` kapsayıcısı içinde.
- [ ] **Step 3: Wire** `ReconciliationScreen` içine bölüm seçici ve `XrayScreen`.
- [ ] **Step 4: Verify** `npx tsc --noEmit && npx eslint src && npx vitest run` → hepsi geçer. Ardından `npm run dev` ile ekranı aç, `Cerberus_Yedek_21Ags.xlsx` yükle; beklenen: 194 satır, 155 order, 57 ASIN, 1.492 adet, $30.600,50, 4 `ASIN_DIRTY`, 10 `STATUS_EMPTY`, 21 `CARD_EMPTY`, 1 `DATE_OUTLIER` bulgusu görünür.
- [ ] **Step 5: Commit** `feat(xray): röntgen ekranı ve arduvaz tema`.
