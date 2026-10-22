# PSH Karşılaştırması (Aşama 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının yüklediği alım listesi (`Sat26`) ile PSH'tan indirdiği dosyayı order+ASIN bazında karşılaştırmak: eksik, hasarlı, yanlış adet, yanlış fiyat, iptal çelişkisi; zaman farkından doğanlar "Bekleniyor" grubunda ayrı.

**Architecture:** İki saf domain modülü: `pshRead` (PSH satırlarını okur) ve `pshCompare` (iki tarafı anahtara göre toplar, bulguları ve bekleyenleri üretir). Alım satırları Aşama 1'in `readSat26Rows` / `XrayRow` çıktısıdır, yeniden yazılmaz. İki dosya tarayıcıda okunup tek istekle `POST /api/reconciliation/psh-compare` route'una gider (ADMIN/MANAGER, salt okunur). Ekran `PshCompareScreen.tsx`, `ReconciliationScreen` bölüm seçicisine üçüncü bölüm olarak eklenir ve Aşama 1'in `xray-theme` kapsayıcısını kullanır.

**Tech Stack:** Next.js (AGENTS.md gereği route yazmadan `node_modules/next/dist/docs/` okunur), TypeScript, zod, `xlsx`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-karsilastirma-rontgen-design.md` ("Aşama 2: PSH karşılaştırması" ve "Okuyucu kontrolünden gelen netleştirmeler"). Aşama 1 kodu (`src/domain/sat26XrayRead.ts`, `sat26Xray.ts`, `XrayScreen.tsx`) mevcut ve ana dalda.

## Global Constraints

- Salt okunur: veritabanına yazılmaz, dosya saklanmaz, veri otomatik düzeltilmez. Yetki `requireRole("ADMIN", "MANAGER")`.
- Eşleşme anahtarı Order No + ASIN; ikisi boşluk/satır sonu temizlenip büyük harfe çevrilir. Aynı anahtarın birden çok satırı toplanır; birim maliyet ağırlıklı ortalama.
- PSH `intransit` ve `partially_delivered` satırları "Bekleniyor"; hata sayılmaz. Alımı PSH'ta olmayan satır, tarihi `PSH'ın en yeni Purchase Date'i − 14 gün` sınırından sonraysa "Bekleniyor", değilse "PSH'ta yok" bulgusu. 14 gün ayarlanabilir.
- Fiyat farkı eşiği PSH karşılaştırmada %10 (ayarlanabilir); küçük farklar listede gri.
- İptal alım satırları "Eksik teslim" ve "Adet farkı"ndan hariç; yalnız "İptal çelişkisi" kuralına girer.
- Dolar etkisi: eksik/hasarlı = adet × alım birim maliyeti; fiyat farkı = (PSH − alım) × adet; adet farkı = fark adedi × birim; "PSH'ta yok"/"Alımda yok" = satır adedi × birim maliyet. Özet kartlarında genel toplam yok, kategori toplamları ayrı.
- Şüpheli order numarası (`WO` / `W0`) otomatik birleştirilmez; "olası yazım hatası" bulgusu olur.
- Alım dosyası kart/e-posta içerir: ekran yalnız gerekli kolonları gönderir. İstek gövdesi sınırı mevcut 2 MB (`MAX_JSON_BODY_BYTES`).
- Palet yalnız `.xray-theme` kapsayıcısında; tüm kullanıcıya görünen metin Türkçe.

## Review Focus

1. PSH'ta aynı order+ASIN iki satır (örnek dosyada `W0110085599|B0D47RZVR3`): toplanır, tek karşılaştırma yapılır, "tekrar eden anahtar" bulgusu çıkar, sahte "adet farkı" çıkmaz.
2. PSH `Purchase Date` metni ay-önce biçimindedir (`06/19/2026`); alım okuyucusunun gün-önce çözümlemesi buna uygulanmamalı. Olmayan tarih (`02/31/2026`, `13/02/2026`) hata vermeden `null` olur.
3. Tamamen iptal alım satırı PSH'ta yoksa sessiz geçilir (ne eksik ne bekleniyor); PSH'ta `Received > 0` ise "İptal çelişkisi".
4. PSH'ta hiç tarih yoksa sınır hesaplanamaz: hiçbir satır tarih yüzünden "Bekleniyor" olmaz, bulgu olarak görünür.
5. Boş / bilinmeyen PSH durumu: ne "Bekleniyor" ne "Eksik teslim" üretir (yalnız `fulfilled`/`delivered` eksik teslim kontrolüne girer).
6. ASIN küçük harf, `<br>` veya `\n` içerse de iki taraf eşleşir; para metin gelebilir (`"$20.39"`).

---

## File Structure

- Modify `src/domain/sat26XrayRead.ts`: `parseDate` → `export function parseSheetDate` (davranış aynı).
- Create `src/domain/pshRead.ts` + `pshRead.test.ts`.
- Create `src/domain/pshCompare.ts` + `pshCompare.test.ts`.
- Modify `src/lib/validation.ts` + `validation.test.ts`: `pshCompareSchema`.
- Create `src/app/api/reconciliation/psh-compare/route.ts`.
- Create `src/features/analytics/sheetColumns.ts`: `pickColumns(rows, headers)` (XrayScreen'deki yerel fonksiyon buraya taşınır).
- Create `src/features/analytics/PshCompareScreen.tsx`.
- Modify `src/features/analytics/XrayScreen.tsx` (`pickColumns` importu), `ReconciliationScreen.tsx` (üçüncü bölüm).

### Task 1: PSH satırlarını okuma (`pshRead.ts`)

**Files:**
- Modify: `src/domain/sat26XrayRead.ts` (`parseDate` adını `parseSheetDate` yap, export et; iç kullanım güncellenir)
- Create: `src/domain/pshRead.ts`
- Test: `src/domain/pshRead.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PshRow {
    rowNo: number;        // Excel satırı (başlık = 1)
    orderNo: string;      // boşluksuz, büyük harf
    asin: string;         // <br>/boşluk silinmiş, büyük harf
    msku: string;         // boşluksuz, büyük harf
    qty: number; received: number; damaged: number; shipped: number;
    status: string;       // trim + küçük harf ("intransit")
    cost: number;         // birim; boşsa 0
    date: Date | null;    // "Purchase Date"
    supplier: string;
  }
  export const PSH_HEADERS: readonly string[];   // kullanılan tüm başlıklar, ekran yalnız bunları gönderir
  export function readPshRows(raw: Record<string, unknown>[]): { rows: PshRow[]; missingHeaders: string[] };
  ```
  Zorunlu: `Order Number, ASIN, MSKU, Quantity, Received, Damaged, Status, Cost, Purchase Date`. İsteğe bağlı: `Shipped, Supplier`. Başlıklar `normalizeHeaderLabel` ile eşlenir.

- [ ] **Step 1: Write the failing tests** (`pshRead.test.ts`). Ham satır `{ "Order Number": " wo1\n", ASIN: "b00lak1mgu<br>", MSKU: "HRN-b00lak1mgu ", Quantity: "6", Received: 6, Damaged: 0, Shipped: 6, Status: " Intransit ", Cost: "$20.39", "Purchase Date": "06/19/2026", Supplier: "A198" }` için: `orderNo "WO1"`, `asin "B00LAK1MGU"`, `msku "HRN-B00LAK1MGU"`, `qty 6`, `status "intransit"`, `cost 20.39`, `date` = `2026-06-19T00:00:00.000Z`. Ayrı testler: `"13/02/2026"` ve `"02/31/2026"` → `date null`; Excel seri `46043` → `2026-01-21`; ISO `"2026-03-10"` → tarih; `readPshRows([])` → `missingHeaders` uzunluğu 9, `rows []`; Order Number / ASIN / Quantity üçü de boş olan satır atlanır; `__rowNum__: 4` olan satır `rowNo 5`, yoksa dizin + 2; başlıklar büyük/küçük harf ve fazladan boşluk toleranslı (`"order number "`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/pshRead.test.ts`
Expected: FAIL (`./pshRead` bulunamadı).

- [ ] **Step 3: Implement `readPshRows` in `src/domain/pshRead.ts`**

`sat26XrayRead.ts` yapısını izle (anahtar eşleme, `money`, boş satır atlama, `__rowNum__ + 1`). `money` oradan değil yerelde tanımlanır (3 satır). Tarih: `^(\d{1,2})/(\d{1,2})/(\d{4})$` ise AY-ÖNCE çözülür, `Date.UTC` ile kurulur ve ay/gün geri okunup tutmuyorsa `null`; diğer her şey `parseSheetDate`'e gider.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/pshRead.test.ts src/domain/sat26XrayRead.test.ts`
Expected: PASS (Aşama 1 okuyucu testleri bozulmadı).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pshRead.ts src/domain/pshRead.test.ts src/domain/sat26XrayRead.ts
git commit -m "feat(psh): PSH satır okuyucu"   # sonuna Co-Authored-By satırı
```

### Task 2: Karşılaştırma motoru (`pshCompare.ts`)

**Files:**
- Create: `src/domain/pshCompare.ts`
- Test: `src/domain/pshCompare.test.ts`

**Interfaces:**
- Consumes: `XrayRow` (`sat26XrayRead`), `PshRow`, `readPshRows` (Task 1), `readSat26Rows`, `isCancelledStatus` (`@/domain/sat26Hygiene`).
- Produces:
  ```ts
  export type PshFindingCode =
    | "MISSING_DELIVERY" | "DAMAGED" | "QTY_DIFF" | "CANCEL_CONFLICT" | "PRICE_DIFF"
    | "MSKU_DIFF" | "NOT_IN_PSH" | "NOT_IN_PURCHASE" | "TYPO_SUSPECT" | "DUPLICATE_KEY";
  export interface PshFinding {
    code: PshFindingCode; severity: "high" | "medium" | "low";
    orderNo: string; asin: string; message: string;
    impactUsd: number | null;           // 2 ondalığa yuvarlı
    muted: boolean;                     // gri liste: küçük fiyat farkı, önek MSKU farkı
    purchaseRows: number[]; pshRows: number[];   // Excel satır numaraları
  }
  export type WaitingKind = "INTRANSIT" | "PARTIAL" | "NOT_YET_IN_PSH";
  export interface WaitingItem {
    kind: WaitingKind; orderNo: string; asin: string;
    qty: number; missingQty: number; valueUsd: number;   // valueUsd = missingQty × alım birim (yoksa PSH cost)
    purchaseDate: Date | null; purchaseRows: number[]; pshRows: number[];
  }
  export interface PshCompareOptions { priceTolerancePct?: number /*10*/; pendingWindowDays?: number /*14*/ }
  export interface PshCompareResult {
    cards: { purchaseKeys: number; pshKeys: number; matched: number; cancelledSkipped: number;
             pshNewestDate: Date | null; cutoffDate: Date | null };
    totals: Record<PshFindingCode, { count: number; impactUsd: number }>;   // muted hariç
    waiting: Record<WaitingKind, { keys: number; missingQty: number; valueUsd: number }>;
    findings: PshFinding[]; waitingItems: WaitingItem[];
  }
  export function comparePsh(purchase: XrayRow[], psh: PshRow[], opts?: PshCompareOptions): PshCompareResult;
  export function buildPshCompare(rawPurchase: Record<string, unknown>[], rawPsh: Record<string, unknown>[], opts?: PshCompareOptions):
    { missingHeaders: { purchase: string[]; psh: string[] } } & PshCompareResult;
  ```
  Kurallar (spec tablosu, ayrıntılar): anahtar `orderNo|asin`; alım tarafı yalnız iptal olmayan satırları adet/maliyet için toplar, anahtarın TÜM satırları iptalse "tamamen iptal"; PSH tarafında durum, anahtarın satırlarından biri `intransit` ise `intransit`, değilse biri `partially_delivered` ise o, yoksa ilk satırın durumu. Kontroller yalnız eşleşen anahtarlarda: MISSING_DELIVERY (durum `fulfilled`/`delivered`, `qty−received−damaged>0`, tamamen iptal değil); DAMAGED (`damaged>0`); QTY_DIFF (tamamen iptal değil, alım adedi ≠ PSH `qty`); CANCEL_CONFLICT (tamamen iptal ve `received>0`, etki `received × iptal satırlarının birim maliyeti`); PRICE_DIFF (iki birim maliyet de >0; `|fark|/alım > eşik` ise yüksek, aksi halde `|fark| ≥ 0,01` ise `muted`); MSKU_DIFF (temizlenmiş MSKU'lar farklıysa; biri diğerine `endsWith` ise `muted`). Bekleniyor: eşleşen anahtarın durumu `intransit` → `INTRANSIT`, `partially_delivered` → `PARTIAL` (`missingQty = qty−received−damaged`, negatifse 0). Eşleşmeyen alım anahtarı: tamamen iptalse `cancelledSkipped++` ve sessiz; benzeri PSH'ta varsa TYPO_SUSPECT; tarihi (anahtarın en yeni satırı) `cutoffDate`'ten sonraysa `NOT_YET_IN_PSH`; değilse (tarih yok, sınır yok dahil) `NOT_IN_PSH` (yüksek, etki `adet × birim`). Eşleşmeyen PSH anahtarı: TYPO_SUSPECT ya da `NOT_IN_PURCHASE`. TYPO_SUSPECT: iki tarafta eşleşmeyen anahtarların ASIN'i aynı ve `O`→`0` çevrilmiş order'ları eşitse tek bulgu; bu çift için NOT_IN_PSH / NOT_IN_PURCHASE üretilmez, başka karşılaştırma yapılmaz, birleştirme yok. DUPLICATE_KEY: bir taraf aynı anahtarı birden çok satırda taşıyorsa o taraf için tek bulgu (orta, etkisiz). `cutoffDate = pshNewestDate − pendingWindowDays gün`; `tarih > cutoff` ise bekleniyor. Sıralama: önce `muted` olmayanlar, `|etki|` azalan (etkisizler sonda), sonra önem, sonra orderNo. `waitingItems` `valueUsd` azalan.

- [ ] **Step 1: Write the failing tests** (`pshCompare.test.ts`). Yerel yardımcılar `buy(over)` / `pshRow(over)` (varsayılan: `WO1`, `B00LAK1MGU`, adet 4, birim 10, toplam 40, durum "Tam Geldi" / PSH adet 4, received 4, damaged 0, `fulfilled`, cost 10, tarih 2026-06-19). Testler:
  1. Aynı adet/fiyat → `findings []`, `cards.matched 1`.
  2. PSH adet 5, received 3, damaged 1, fulfilled, alım 5×10 → `MISSING_DELIVERY` etki 10 **ve** `DAMAGED` etki 10; aynısı `intransit` ile → MISSING yok, `waitingItems` tek `INTRANSIT` (`missingQty 1`, `valueUsd 10`), DAMAGED yine var; `partially_delivered` → `PARTIAL`.
  3. Alım 4, PSH 6 (received 6) → `QTY_DIFF` etki 20.
  4. Tek iptal alım satırı (adet 3, toplam 30), PSH received 2 → `CANCEL_CONFLICT` etki 20, QTY_DIFF/MISSING yok; PSH'ta olmayan iptal satırı → bulgu yok, `cancelledSkipped 1`, `waitingItems []`.
  5. Alım birim 10, PSH cost 12, adet 4 → `PRICE_DIFF` etki 8, `muted false`; cost 10,5 → `muted true`; cost 10 → bulgu yok; `{ priceTolerancePct: 30 }` ile 12 → `muted true`.
  6. MSKU `HRN-B00LAK1MGU` ↔ `B00LAK1MGU` → `MSKU_DIFF muted true`; `ABC` ↔ `XYZ` → `muted false`; büyük/küçük harf ve boşluk farkı → bulgu yok.
  7. PSH en yeni tarih 2026-06-19, pencere 14 → `cutoffDate` 2026-06-05: eşleşmeyen alım 2026-06-10 → `NOT_YET_IN_PSH`; 2026-06-05 (tam sınır) ve 2026-06-01 → `NOT_IN_PSH` etki `adet × birim`; tarihsiz → `NOT_IN_PSH`; PSH'ta hiç tarih yoksa hepsi `NOT_IN_PSH`.
  8. PSH'ta olup alımda olmayan → `NOT_IN_PURCHASE` etki `qty × cost`.
  9. Alım `WO110085599`, PSH `W0110085599`, aynı ASIN → tek `TYPO_SUSPECT`, `NOT_IN_PSH`/`NOT_IN_PURCHASE` yok, `matched 0`.
  10. PSH'ta iki satır (adet 2+2, cost 10 ve 12), alım 4 → tek `DUPLICATE_KEY` (taraf PSH), `QTY_DIFF` yok, ağırlıklı cost 11 ile PRICE_DIFF değerlendirilir (alım birim 10 → %10 sınırında, bulgu yok).
  11. PSH durumu `""` ve `"cancelled"`: MISSING_DELIVERY yok, `waitingItems []`.
  12. `totals` muted'ı saymaz; sıralama: büyük etki üstte, muted en sonda.
  13. `buildPshCompare`: eksik başlıklar her iki taraf için ayrı döner (`{purchase: [...], psh: [...]}`); geçerli ham veriyle (`Tarih: 46043`, `"Order Number"`) uçtan uca bir bulgu üretir; ASIN `"\nb00lak1mgu"` ve `"B00LAK1MGU<br>"` eşleşir.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/pshCompare.test.ts`
Expected: FAIL (`./pshCompare` bulunamadı).

- [ ] **Step 3: Implement `comparePsh` and `buildPshCompare` in `src/domain/pshCompare.ts`**

Önce iki taraf anahtara göre toplanır (`Map`), sonra kurallar sırayla uygulanır; para değerleri `Math.round(x*100)/100`. `buildPshCompare` iki okuyucuyu çağırır; herhangi bir tarafta eksik başlık varsa boş sonuç + `missingHeaders` döner.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/pshCompare.test.ts`
Expected: PASS, tüm testler.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pshCompare.ts src/domain/pshCompare.test.ts
git commit -m "feat(psh): order+ASIN karşılaştırma motoru"
```

### Task 3: Şema ve route

**Files:**
- Modify: `src/lib/validation.ts` (`xraySchema`'nın altına), `src/lib/validation.test.ts`
- Create: `src/app/api/reconciliation/psh-compare/route.ts`

**Interfaces:**
- Produces: `pshCompareSchema = z.object({ purchaseRows: array(record) min 1 max 20000, pshRows: array(record) min 1 max 20000, priceTolerancePct: coerce number 1..500 optional, pendingWindowDays: coerce number int 0..90 optional })`. Route `POST`, çıktı `PshCompareResult`; eksik başlıkta 422 `{ error, missingHeaders: { purchase, psh } }`.

- [ ] **Step 1: Write the failing tests** (`validation.test.ts`): boş `purchaseRows` ve boş `pshRows` ayrı ayrı reddedilir; `priceTolerancePct: "10"` sayıya çevrilir; `pendingWindowDays: 91` ve `-1` reddedilir; `pendingWindowDays` verilmezse alan `undefined`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: FAIL (`pshCompareSchema` yok).

- [ ] **Step 3: Implement the schema and the route**

Önce `node_modules/next/dist/docs/` içinde route handler bölümünü oku (AGENTS.md). Route, `src/app/api/reconciliation/xray/route.ts` ile aynı yapıda: `requireRole("ADMIN","MANAGER")`, `parseBody`, `buildPshCompare`, `handleRouteError("POST /api/reconciliation/psh-compare", …)`. Eksik başlıklar iki taraftan birinde varsa 422, hata metni hangi dosyada hangi başlıkların bulunamadığını söyler.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/validation.test.ts && npx tsc --noEmit`
Expected: PASS, tip hatası yok.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts src/app/api/reconciliation/psh-compare/route.ts
git commit -m "feat(psh): psh-compare route'u (ADMIN/MANAGER)"
```

### Task 4: Ekran (`PshCompareScreen.tsx`)

**Files:**
- Create: `src/features/analytics/sheetColumns.ts`, `src/features/analytics/PshCompareScreen.tsx`
- Modify: `src/features/analytics/XrayScreen.tsx` (yerel `pickColumns` kaldırılıp import edilir), `src/features/analytics/ReconciliationScreen.tsx`

**Interfaces:**
- Produces: `export function pickColumns(rows: Record<string, unknown>[], headers: readonly string[]): Record<string, unknown>[]` (Aşama 1'deki davranış, `__rowNum__` taşıması dahil). `export function PshCompareScreen()`. `Section` tipi `"XRAY" | "PSH" | "COMPARE"`; bölüm seçici yalnız `canAudit` iken "Alım röntgeni", "PSH karşılaştırma", "Amazon & Inventory Lab karşılaştırma" gösterir.

- [ ] **Step 1: Extract `pickColumns` and re-point `XrayScreen`**

`XrayScreen` `pickColumns(rows, XRAY_HEADERS)` çağırır. Run: `npx tsc --noEmit && npx vitest run` — Expected: temiz, 604+ test geçer (davranış değişmedi).

- [ ] **Step 2: Build `PshCompareScreen`**

Kapsayıcı `xray-theme`, `XrayScreen` ile aynı görsel dil. İki dosya seçici (Alım listesi: sayfa seçici, varsayılan `Sat26`; PSH dosyası: sayfa seçici, varsayılan ilk sayfa), iki sayısal giriş (Fiyat farkı eşiği % = 10, Bekleme penceresi gün = 14), "Karşılaştır" düğmesi iki dosya seçilene kadar kapalı. İstek: `purchaseRows = pickColumns(rows, XRAY_HEADERS)`, `pshRows = pickColumns(rows, PSH_HEADERS)`. Gövde 413 dönerse "Dosya çok büyük" metni göster; 422'de eksik başlıkları dosya adıyla listele. Sonuç düzeni (A): (1) kartlar: eşleşen anahtar, PSH'ın en yeni tarihi ve sınır tarihi, kategori başına sayı + dolar (MISSING, DAMAGED, QTY_DIFF, PRICE_DIFF, CANCEL_CONFLICT, NOT_IN_PSH, NOT_IN_PURCHASE; genel toplam yok); (2) "Bakılacaklar" listesi, ilk 200, kod etiketi + order + ASIN + mesaj + dolar etkisi + Excel satır numaraları (alım / PSH), `muted` olanlar gri ve "küçük fark" etiketli; kod çipleri ile süzülebilir; (3) ayrı "Bekleniyor" kartı ve listesi: "Yolda", "Kısmi teslim" (eksik adet ve tutarıyla), "PSH'a henüz girmemiş" alt etiketleri, her biri anahtar sayısı ve toplam tutarla. Sonuç, dosya/sayfa/eşik değişince temizlenir (Aşama 1'in ertelenen M7 kusuru burada tekrarlanmaz).

- [ ] **Step 3: Add the section to `ReconciliationScreen`**

Mevcut `XRAY` / `COMPARE` davranışı aynı kalır; `PSH` yalnız `canAudit` ile gösterilir ve varsayılan bölüm yine `XRAY`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run && DATABASE_URL="postgres://u:p@localhost:5432/x" npx next build`
Expected: hepsi temiz; build çıktısında `/api/reconciliation/psh-compare` listelenir.

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics
git commit -m "feat(psh): PSH karşılaştırma ekranı"
```

### Task 5: Gerçek veriyle doğrulama

**Files:** (geçici) `src/domain/pshReal.tmp.test.ts` — iş bitince silinir, commit'e girmez.

- [ ] **Step 1: Run the real files through `buildPshCompare`**

Geçici test `Cerberus_Yedek_21Ags.xlsx` (`Sat26`) ve `psh1016.xlsx` (`Sayfa1`) dosyalarını `fs.readFileSync` + `XLSX.read` ile okur (`xlsx.readFile` Vitest'te çalışmaz), `{ defval: "" }` ile `sheet_to_json` yapar, `buildPshCompare` sonucunu `throw new Error("RESULT " + JSON.stringify(...))` ile yüzeye çıkarır (Vitest `console.log`'u yutar).
Expected, **kesin**: `missingHeaders` iki tarafta boş; `cards.matched 134`; `cards.pshKeys 134`; `waiting.NOT_YET_IN_PSH.keys 60`; `totals.NOT_IN_PSH.count 0`; `totals.NOT_IN_PURCHASE.count 0`; `totals.MISSING_DELIVERY.count 0`; `totals.DAMAGED.count 1`; `DUPLICATE_KEY` PSH tarafı 1 (`W0110085599|B0D47RZVR3`); `waiting.INTRANSIT` + `waiting.PARTIAL` anahtar sayısı PSH'taki `intransit`/`partially_delivered` anahtarlarına eşit.
**Gözlemlenecek, kayda geçirilecek** (iptal satırları sonuçları değiştirdiği için tam sayı bu plan yazılırken kesinleşmedi): `QTY_DIFF`, `PRICE_DIFF` (muted hariç; yaklaşık 11 aday), `CANCEL_CONFLICT` (yaklaşık 2), `MSKU_DIFF`. Beklenenden çok farklı çıkarsa kuralı değil önce veriyi (örn. iptal satırının PSH'ta görünüşü) incele ve bulguyu rapora yaz.

- [ ] **Step 2: Remove the temporary test, run the whole suite**

Run: `rm src/domain/pshReal.tmp.test.ts && npx vitest run && git status -s`
Expected: tüm testler geçer; `git status`'ta yalnız izlenmeyen veri dosyaları kalır.

- [ ] **Step 3: Final whole-branch review and push (ayrı onayla)**

Fresh-context reviewer (en yetenekli model) Aşama 2 diff'ini inceler; Critical/Important bulgular tek fix turunda test-önce düzeltilir. Push, kullanıcıya sorulduktan sonra yapılır.
