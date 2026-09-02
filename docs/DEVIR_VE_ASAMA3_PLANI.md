# CERBERUS — Devir Notu ve Aşama 3 Planı

| | |
|---|---|
| **Tarih** | 2026-09-02 |
| **Önceki oturum** | `arena/01a05ea7-allinone-saas` (PR #13) |
| **Bu oturum** | `arena/01a061bb-allinone-saas` |
| **Kaynak rapor** | `docs/audit/04_Veri_Mimarisi_Urun_Bazli_Model.md` |

---

## 1. Devir — önceki çalışma nerede?

Önceki oturum ürün merkezli mimariyi (Aşama 0 / 1 / 1.2 / 2) `arena/01a05ea7-allinone-saas` dalında tamamladı. Bu dosya o oturumda yazıldı ama **PR #13 kapatıldığı için push edilemedi**; bu yüzden yeni oturumda yeniden oluşturuldu.

**PR #13 `main`'e merge edilmiştir** (squash, `e99cc58`). Önceki dal ile `main` ağacı birebir aynıdır (`531598e`). Yani Aşama 0–2 kodu `main`'dedir; ikinci bir "taşıma PR"ı boş olurdu. Bu oturumun PR'ı **Aşama 3**'ü taşır.

| Aşama | Ne yaptı | Kanıt |
|---|---|---|
| 0 | CHECK kısıtları, durum enum'ları | `drizzle/0001_same_ultragirl.sql` |
| 1 | `products`, `supplier_offers`, `product_lifecycle_events` | `drizzle/0002_lonely_drax.sql` |
| 1.2 | `orders.product_id NOT NULL` + `resolveProduct` tek kapı | `drizzle/0003_concerned_luke_cage.sql` |
| 2 | Ürün Portföyü + Yolculuk çekmecesi + durak geçişi | `src/features/products/*`, `PATCH /api/products/[id]` |

### Bilinçli olarak Aşama 3'e bırakılan kopukluk

Ürünler yolculuğa **`PURCHASING`** durağından giriyor, çünkü yalnızca sipariş kaydıyla doğuyorlar.

Durak makinesi `DISCOVERED → ANALYZING → SCORED → APPROVED` tanımlı, arayüzde ilerleme çubuğu var, ama **hiçbir yazma yolu bu duraklara ürün koymaz**. Karar Kasası (`product_masters`) ayrı bir evrende yaşar: ASIN kesişimi seed veride sıfırdır, FK yoktur, puanlama katalog durağını değiştirmez.

Sonuç: keşif → puanlama → onay → satın alma tek akış değil, iki paralel sistem.

---

## 2. Aşama 3 — keşif ve puanlama ucunu bağlamak

Orijinal rapordaki "Aşama 3 = envanter olay defteri" **erteleme** olarak kalır. Önceki oturumun "sırada ne var" notu önceliği netleştirir:

> Karar Kasası'ndaki puanlama mantığı bu duraklarla birleştirilirse yolculuk baştan sona tek akış olur.

### Hedef değişmezler

1. **Keşif, katalogda bir üründür.** `POST /api/intelligence` artık yalnızca `product_masters` satırı yazmaz; `products` satırı `DISCOVERED` durağında doğar, fiyat gözlemi ve olay defteri yazılır.
2. **Puanlama durak üretir.** Karar motoru (`computeDecisionEngine`) çalışınca ürün `ANALYZING → SCORED` yürür; `BUY`/`TEST` → `APPROVED`, `REJECT` → `REJECTED`, `WAIT` → `SCORED` (yönetici onayı).
3. **Karar kasası ürüne bağlıdır.** `product_masters.product_id` FK. Bir ürünün en fazla bir kasa kaydı vardır.
4. **Sipariş, onaylı (veya keşfedilmiş) ürünü satın almaya taşır.** Yeni ASIN'li sipariş hâlâ `PURCHASING`'de doğar (tarihsel XLS yalan söylemez). Mevcut ürün ön-satın-alma durağındaysa sipariş onu `PURCHASING`'e yürütür; `SELLING`'den geri gitmez.
5. **Sahte ASIN yok.** Keşif kaydı ASIN, alış fiyatı ve satış fiyatı olmadan kabul edilmez. Eski kodun `B0` + `Math.random()` üretmesi katalogu çöple doldururdu.

### Kabul kriteri

| Senaryo | Beklenen |
|---|---|
| Yeni ASIN keşfi, yüksek ROI | `products` DISCOVERED→…→APPROVED, kasa BUY, olay zinciri kopuksuz |
| ROI < %25 | SCORED→REJECTED, kasa REJECT |
| Aynı ASIN ikinci kez | Yeni ürün YOK, duplicate WAIT, mevcut durak geri gitmez |
| Onaylı ürüne sipariş | Durak PURCHASING, sipariş `product_id` dolu |
| Satıştaki ürüne sipariş | Durak SELLING kalır |
| Yönetici WAIT→BUY | Katalog SCORED→APPROVED |
| ASIN'siz keşif | 422, katalogda satır yok |

Envanter olay defteri (`inventory_movements`) bu aşamanın **değil**, bir sonraki iş paketinin konusudur.

---

## 3. Bu oturumda yapılmayacaklar

- `purchase_orders` / `order_items` ayrımı (orijinal Aşama 2, hâlâ erken)
- `inventory_movements` (orijinal Aşama 3)
- SP-API / Keepa
- `product_masters` tablosunu kaldırmak — bağlanır, birleştirilmez

---

## 4. Doğrulama

```bash
npm test          # keşif hattı + mevcut paket
npm run lint
npm run typecheck
npm run build
```
