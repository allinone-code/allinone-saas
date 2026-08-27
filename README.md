# CERBERUS — DECISION-CENTRIC COMMERCE OPERATING SYSTEM (v3.0)

> **Mükemmellik daha fazla ekran yapmak değildir. Mükemmellik; doğru verinin, doğru zamanda, doğru güven seviyesiyle, doğru insana, doğru kararı aldırmasıdır.**

---

## 🏛️ Mimari Katmanlar (Kaynak A + Kaynak B Birleşimi)

```text
DISCOVER → UNDERSTAND → NORMALIZE → MATCH/DEDUP → ANALYZE → SCORE → RISK + CONFIDENCE → DECIDE → APPROVE → BUY → RECEIVE → LIST → SELL → MEASURE → RECONCILE → LEARN → BETTER DECISION
```

1. **Yönetici Sabah Brifingi (Morning Briefing) & İş Sağlığı Skoru (0–100):**
   - `WHAT CHANGED?` • `WHAT MATTERS?` • `WHAT SHOULD I DO?`
   - Günlük 26 mağaza konsolide ciro, Landed-Cost ayarlı ROI ve FBA sevk oranı.
2. **Product Master Decision Vault (`Product ≠ Listing`):**
   - Karar Motoru: `BUY | TEST | WAIT | REJECT | REPRICE | REORDER | PAUSE | LIQUIDATE`
   - Veri Tazeliği: `FRESH | AGING | STALE | EXPIRED`
   - Veri Kalitesi: `VALID | INVALID | CONFLICTING`
   - 6-Eksenli Hexagonal SVG Yapay Zeka Radarı (`PROFITABILITY`, `DEMAND`, `COMPETITION`, `PRICE STABILITY`, `SUPPLIER RELIABILITY`, `OPERATIONAL RISK`)
   - AI Kanıt Zinciri (`Evidence Chain` - Kaynak, gözlem tarihi, güven yüzdesi)
   - Tahmini ROI vs Gerçekleşen ROI (`Actual vs Estimated Profitability Engine`)
3. **10 Kişilik ABD Sourcing Ekibi Zekâsı (`Quality-Adjusted Researcher Score`):**
   - Bulunan Ürün → Onaylanan → Satın Alınan → Kâr Üreten Ürün + Fire Oranı.
4. **40 Kolonluk Google Drive XLS Siparişleri + CSV İndir:**
   - 38 gerçek The Vitamin Shoppe siparişi (`WO110074776`, `WO310759607`...)
5. **PSH Envanter & Batch Partileri Modülü:**
   - Ön-envanter sevkiyat partileri (`PSH-BATCH-2026-01`, `PSH-BATCH-2026-02`).
6. **Depo Karşılama & Sayım (Order No Eşleştirme & P1–P4 Fire):**
   - Gelen kutulardaki Order No'yu eşleştirip `P1 İptal`, `P2 Eksik`, `P3 Defolu`, `P4 Tarihi Geçmiş` kaydı.
7. **Inventory Lab & Amazon Muhasebesi:**
   - Birim alış, satış fiyatı, kâr ve net ROI.
8. **Admin Komuta Merkezi & Mağaza İzolasyonu (Zero Trust RBAC):**
   - `ADMIN` (Tüm Mağazalar) vs `STORE_USER` (`HRN`, `SEL`, `MK` İzole Mağazalar).

---

## 🔐 1-Tıkla Test Giriş Hesapları

| Kullanıcı | E-posta | Parola | Rol | Mağaza Kapsamı |
|---|---|---|---|---|
| **Ahmet Erdem** | `ahmet@cerberus-commerce.io` | `admin2026` | `ADMIN` | **Tüm Mağazalar**: Yeni mağaza ve kullanıcı açabilir, SP-API ve denetim loglarını yönetir. |
| **Harun** | `harun@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca HRN Mağazası**: Sadece HRN'in 38 siparişini ve verilerini görür. |
| **Selin Yılmaz** | `selin@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca SEL Mağazası** |
| **Can Demir** | `can@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca MK Mağazası** |

---

## ⚡ Canlıya Alma (Vercel + Neon)

1. Projeyi GitHub'a pushlayın (`allinone-code/allinone-saas`).
2. Neon veritabanında şemayı güncelleyin:
   ```bash
   DATABASE_URL="your-neon-pooled-connection-string" npx drizzle-kit push
   ```
3. Vercel'de **Redeploy** çalıştırın.
