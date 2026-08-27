# CERBERUS — Product Intelligence & Commerce Operations Platform

**Cerberus** is an enterprise-grade multi-store SaaS built for high-velocity US product sourcing, landed-cost profitability intelligence, duplicate detection, and 26-store marketplace operations.

---

## ⚡ Hızlı Başlangıç (Lokalde Çalıştırma)

Projeyi bilgisayarınızda çalıştırmak için yalnızca **3 adım**:

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Ortam Değişkeni (.env)
Proje kökünde `.env` dosyası oluşturun (veya `.env.example` dosyasını kopyalayın):
```bash
cp .env.example .env
```
İçine Neon veya yerel PostgreSQL bağlantı adresinizi yazın:
```env
DATABASE_URL=postgresql://neondb_owner:PAROLANIZ@ep-XXX-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

> **Not:** Eğer henüz bir veritabanınız yoksa, sistem otomatik olarak **Demo / Offline Modu**nda açılır ve 26 mağaza, 10 uzman ve ürünlerle eksiksiz çalışır!

### 3. Veritabanı Tablolarını Oluşturun (Eğer DATABASE_URL tanımladıysanız)
```bash
npx drizzle-kit push
```

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```

Tarayıcınızda açın: **http://localhost:3000** 🚀

---

## 🏛️ Mimari ve Çekirdek Modüller

1. **4 Katmanlı Taktik Komuta Dashboard'u**
   - **Executive KPI Strip**: 26 mağazanın konsolide $2.84M+ brüt cirosu, +$682K+ net kârı, 3.140+ aktif listelemesi ve %48.2 ortalama portföy ROI'si.
   - **1. Katman — Ürün İstihbaratı ve Sourcing Motoru**: 13 aşamalı yaşam döngüsü, canlı ASIN/UPC/Brand araması, filtreler, landed cost dökümü ve 360° müfettiş.
   - **2. Katman — 10 Kişilik ABD Sourcing Ekibi Liderlik Tablosu**: Gerçek ticari dönüşüm takibi (*Keşif Hacmi → Yönetici Onayı → Satın Alma Oranı → Net ROI → Problem Oranı*).
   - **3. Katman — 26 Mağazalık Filo ve Tedarikçi İstihbaratı**: 18 Amazon, 2 Walmart, 5 Shopify, 1 Toptan B2B portalı ve 0–100 arası tedarikçi skoru.
   - **4. Katman — P1–P4 Operasyonel Problem Merkezi ve Denetim İzi**: BuyBox kırılmaları, hesap sağlığı alarmları ve değişmez Audit Log (*Kim • Ne Zaman • Öncesi • Sonrası*).

2. **13 Aşamalı Merkezi Ürün Yaşam Döngüsü (Lifecycle Pipeline)**
   $$\text{DISCOVERED} \rightarrow \text{SCREENING} \rightarrow \text{DUPLICATE\_CHECK} \rightarrow \text{ANALYZING} \rightarrow \text{REVIEW} \rightarrow \text{APPROVED} \rightarrow \text{PURCHASING} \rightarrow \text{RECEIVED} \rightarrow \text{LISTING} \rightarrow \text{ACTIVE} \rightarrow \text{MONITORING} \rightarrow \text{PAUSED} \rightarrow \text{DISCONTINUED}$$

3. **Landed Cost & Kârlılık Motoru**
   - Gerçek maliyet hesabı:
     $$\text{Landed Cost} = \text{Kaynak Fiyat} + \text{Kargo} + \text{Prep/Etiket} + \text{Amazon Ref Bedeli (\%15)} + \text{FBA Kargo}$$
     $$\text{ROI (\%)} = \frac{\text{Tahmini Net Kâr}}{\text{Landed Cost}} \times 100$$
   - Zaman içindeki fiyat hareketlerini izleyen **SVG Alan Trend Grafiği**.

4. **Yapay Zeka Fırsat Radarı (AI Opportunity Radar - 6 Eksenli Hexagonal SVG)**
   - `PROFITABILITY`, `DEMAND`, `COMPETITION`, `PRICE STABILITY`, `SUPPLIER RELIABILITY`, `OPERATIONAL RISK` skorları.
   - Yapay zeka tavsiyesi: `HIGH_MARGIN_SCALER`, `APPROVED_FOR_PURCHASE`, `HOLD_FOR_PRICE_DROP`, `FLAGGED_IP_RISK`.

5. **Chrome Extension Hızlı Yakalama & Excel İçe Aktarma**
   - Tek tıkla Home Depot, Ulta, Costco, BestBuy, Target sitelerinden veri yakalama.
   - Anlık %96 duplicate tespiti.
   - Excel / CSV toplu içe aktarma ve normalizasyon hattı.

---

## 🚀 Canlıya Alma (Vercel + Neon)

1. Projeyi GitHub'a pushlayın:
   ```bash
   git push origin main
   ```
2. [Vercel](https://vercel.com) üzerinde projeyi içe aktarın (Import).
3. **Environment Variables** bölümüne:
   - `DATABASE_URL` = Neon Pooled Connection String
4. **Deploy** butonuna basın. İlk açılışta demo veriler otomatik olarak PostgreSQL'e yazılır.
