# CERBERUS — DISCOVERY & SCHEMA INVENTORY REPORT (FAZ 0)

**Tarih:** 2026-08-27  
**Sistem Durumu:** Canlı Next.js 16 (App Router) + PostgreSQL (Drizzle ORM) + Neon Serverless Pooler  

---

## 1. MEVCUT REPOSITORY & VERİTABANI ENVANTERİ

| Tablo Adı | Durum | Rolü ve Kapsamı |
|---|---|---|
| `users` | Aktif | Kullanıcılar, `role` (`ADMIN` / `STORE_USER`), `storeCode` (`ALL`, `HRN`, `SEL`, `MK`), `passwordHash` |
| `stores` | Aktif | 26 Mağazalık Filo kaydı (`storeCode`, `storeName`, `marketplace`, `buyerName`, `defaultCard`, `defaultEmail`) |
| `orders` | Aktif | Google Drive 40-Kolon Gerçek Sipariş Veritabanı (`The Vitamin Shoppe` 38 gerçek sipariş, `Orderno`, `ASIN`, `MSKU`, `P1-P4 Fire`, `PSH Batch`, `Inventory Lab`) |
| `psh_batches` | Aktif | PSH Ön-Envanter Parti Takibi (`PSH-BATCH-2026-01`, `PSH-BATCH-2026-02`) |
| `audit_logs` | Aktif | Değiştirilemez Denetim İzi (`WHO • WHAT • WHEN • BEFORE • AFTER`) |

---

## 2. FAZ 1 & FAZ 2 GAP KAPATMA (GAP CLOSURE)

Mevcut şemaya ek olarak Blueprint'in zorunlu kıldığı şu **Decision Intelligence ve Product Master** katmanları ekleniyor:

1. **`product_masters` (Ürün Master Veritabanı):**
   - `Product ≠ Listing` ayrımı. Tek bir Master Ürün (`ASIN/UPC`), 26 mağazada farklı `channel_listings` ve fiyatlarla yaşar.
   - `dataQualityStatus`: `VALID | INVALID | MISSING | STALE | CONFLICTING`
   - `dataFreshnessStatus`: `FRESH | AGING | STALE | EXPIRED`
   - `decisionAction`: `BUY | TEST | WAIT | REJECT | REPRICE | REORDER | PAUSE | LIQUIDATE`
   - `confidenceScore` (0-100), `riskLevel` (`LOW | MEDIUM | HIGH | CRITICAL`), `policyStatus` (`APPROVED_BY_POLICY | REQUIRES_MANAGER | FLAGGED_IP_RISK`)
   - `evidenceChain`: JSONB Kanıt Zinciri (`claim`, `source`, `observedAt`, `confidence`)
   - `estimatedVsActual`: Tahmini ROI vs Gerçekleşen ROI analizi (`estimatedRoi`, `actualRoi`, `variancePercent`)

2. **`researchers` & `research_sessions` (10 Kişilik Sourcing Ekibi Zekâsı):**
   - 10 ABD Sourcing Uzmanı (`SRC-01`...`SRC-10`) için **Quality-Adjusted Research Score** (Keşif Hacmi → Onay Oranı → Satın Alma Oranı → Net Kâr → Fire Oranı).
   - Oturum (`research_session_id`) bazlı kaynak site verimliliği.

3. **`morning_briefings` (Yönetici Sabah Brifingi & İş Sağlığı Skoru):**
   - **Business Health Score (0–100)**: Gelir, Kârlılık, Envanter, Tedarikçi Sağlığı, Pazar Yeri Sağlığı, Veri Kalitesi bileşimi.
   - **WHAT CHANGED? • WHAT MATTERS? • WHAT SHOULD I DO?** günlük aksiyon kartları.
