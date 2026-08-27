# CERBERUS — İKİ RAPORUN KARŞILAŞTIRMALI GAP ANALYSIS + AI AGENT IMPLEMENTATION BLUEPRINT

> **Amaç:** Bu belge, Cerberus'un mevcut mimari/iş süreçleri dokümanı ile ikinci aşamadaki stratejik/mükemmelleştirme değerlendirmesinin karşılaştırmasından çıkarılmıştır.
> **Merkezi Felsefe:** CERBERUS = DECISION-CENTRIC COMMERCE OS (Product Intelligence + Sourcing Intelligence + Commercial Decision Intelligence).

## 0. KAYNAK DOKÜMANLAR VE GERÇEK AKTİF YAPI
- **26 Mağazalık Filo:**
  - 18 Amazon US/CA Mağazası (`AMZ-US-01`...`AMZ-US-18`, `HRN`, `SEL`, `MK`)
  - 2 Walmart Mağazası (`WMT-US-01`, `WMT-US-02`)
  - 5 Shopify DTC Mağazası (`SHP-US-01`...`SHP-US-05`)
  - 1 B2B Wholesale Portal (`WHS-B2B-01`)
- **10 Kişilik ABD Sourcing Ekibi:** Kişisel kabiliyetleriyle ABD perakende sitelerinden (Home Depot, Ulta, Costco, BestBuy, Target, Grainger, Chewy, Macy's, REI, Wayfair) ürün bulur.
- **40 Kolonluk Google Drive XLS & Operasyonel Akış:**
  - `Satın Alan` → `Tarih` → `ASIN/MSKU` → `Orderno` → `Drive Fatura Linki` → `PSH Batch` → `Depo Karşılama (Order No Eşleştirme & P1-P4 Fire)` → `Inventory Lab Amazon Muhasebesi`.

## 1. NİHAİ KARAR DÖNGÜSÜ (DECISION ENGINE)
```text
DISCOVER → UNDERSTAND → NORMALIZE → MATCH/DEDUP → ANALYZE → SCORE → RISK + CONFIDENCE → DECIDE → APPROVE → BUY → RECEIVE → LIST → SELL → MEASURE → RECONCILE → LEARN → BETTER DECISION
```

## 2. VERİ KALİTESİ & VERİ TAZELİĞİ (DATA QUALITY & FRESHNESS)
- **Data Quality Status:** `VALID | INVALID | MISSING | STALE | CONFLICTING | UNVERIFIED`
- **Data Freshness:** `FRESH (<3 gün) | AGING (3-7 gün) | STALE (7-14 gün) | EXPIRED (>14 gün)`
- **Evidence Chain:** Her AI karar önerisinde (`BUY | TEST | WAIT | REJECT`) kanıt zinciri (`claim`, `source`, `observed_at`, `confidence`, `policy_check`) saklanır.
