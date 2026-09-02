# CERBERUS — DECISION-CENTRIC COMMERCE OPERATING SYSTEM (v3.0 LOCKED SCHEMA)

> 🔒 **ASIL MİMARİ VE VERİTABANI ANAYASASI:**  
> Projenin Neon Cloud PostgreSQL veritabanındaki değişmez 8 tablosu (`users`, `stores`, `researchers`, `research_sessions`, `product_masters`, `orders`, `psh_batches`, `audit_logs`), 40-kolonluk Google Drive XLS şeması ve yazılım mimarisi **[`ARCHITECTURE_AND_DATABASE_SPEC.md`](./ARCHITECTURE_AND_DATABASE_SPEC.md)** dosyasında kilitlenmiştir.

---

## 🏛️ Mimari Katmanlar (Kaynak A + Kaynak B Birleşimi)

```text
DISCOVER → UNDERSTAND → NORMALIZE → MATCH/DEDUP → ANALYZE → SCORE → RISK + CONFIDENCE → DECIDE → APPROVE → BUY → RECEIVE → LIST → SELL → MEASURE → RECONCILE → LEARN → BETTER DECISION
```

1. **Yönetici Sabah Brifingi (Morning Briefing) & İş Sağlığı Skoru (0–100):**
   - `WHAT CHANGED?` • `WHAT MATTERS?` • `WHAT SHOULD I DO?`
   - Konsolide ciro, Landed-Cost ayarlı ROI ve FBA sevk oranı.
   - **Tüm maddeler canlı SQL agregasyonundan üretilir** (`src/domain/briefing.ts`);
     sabit kodlanmış demo cümlesi yoktur. Veri yoksa madde üretilmez.
   - İş Sağlığı Skoru **5 eksenli ve açıklanabilirdir** (kârlılık %30, FBA sevk %22,
     fire %20, veri tazeliği %15, nakit sızıntısı %13); skora tıklayınca kırılım açılır.
   - ⚠️ **Amazon SP-API entegrasyonu henüz yapılmamıştır.** Admin panelindeki
     entegrasyon ekranı bunu dürüstçe "BAĞLI DEĞİL" olarak gösterir.
2. **Product Master Decision Vault (`Product ≠ Listing`):**
   - Karar Motoru: `BUY | TEST | WAIT | REJECT | REPRICE | REORDER | PAUSE | LIQUIDATE`
   - Veri Tazeliği: `FRESH | AGING | STALE | EXPIRED`
   - Veri Kalitesi: `VALID | INVALID | CONFLICTING`
   - 6-Eksenli Hexagonal SVG Yapay Zeka Radarı (`PROFITABILITY`, `DEMAND`, `COMPETITION`, `PRICE STABILITY`, `SUPPLIER RELIABILITY`, `OPERATIONAL RISK`)
   - AI Kanıt Zinciri (`Evidence Chain` - Kaynak, gözlem tarihi, güven yüzdesi)
   - Tahmini ROI vs Gerçekleşen ROI (`Actual vs Estimated Profitability Engine`)
3. **10 Kişilik ABD Sourcing Ekibi Zekâsı (`Quality-Adjusted Researcher Score`):**
   - Bulunan Ürün → Onaylanan → Satın Alınan → Kâr Üreten Ürün + Fire Oranı.
4. **40 Kolonluk Google Drive XLS Siparişleri + Çoklu Kaynak Excel İçe Aktarıcı (KİLİTLİ ŞEMA):**
   - 38 gerçek The Vitamin Shoppe siparişi (`WO110074776`, `WO310759607`...)
   - **Bilgisayardan `.xlsx` / `.xls` / `.csv` Sürükle & Bırak:** SheetJS kütüphanesi dosyayı tarayıcıda okur ve 40 kolonu otomatik haritalar.
   - **Google Drive E-Tablo Linki Çekme:** Paylaşım linkini (`https://docs.google.com/spreadsheets/d/...`) yapıştırıp doğrudan sunucu üzerinden içe aktarma.
   - **Excel Tarzı Hücre Düzenleyici Önizleme Tablosu:** Kaydetmeden önce satırları, birim maliyeti, ASIN ve kargo durumunu Excel hücresi gibi tıklayıp düzeltebilme.
   - Tek tıkla **CSV Export (`.csv`)**.
5. **PSH Envanter & Batch Partileri Modülü:**
   - Ön-envanter sevkiyat partileri (`PSH-BATCH-2026-01`, `PSH-BATCH-2026-02`).
6. **Depo Karşılama & Sayım (Order No Eşleştirme & P1–P4 Fire):**
   - Gelen kutulardaki Order No'yu eşleştirip `P1 İptal`, `P2 Eksik`, `P3 Defolu`, `P4 Tarihi Geçmiş` kaydı.
7. **Inventory Lab & Amazon Muhasebesi:**
   - Birim alış, satış fiyatı, kâr ve net ROI.
8. **Admin Komuta Merkezi & Veritabanı Temizleme/Sıfırlama Paneli (Zero Trust RBAC):**
   - `ADMIN` (Tüm Mağazalar) vs `STORE_USER` (`HRN`, `SEL`, `MK` İzole Mağazalar).
   - **Mağaza Yönetimi (Stores CRUD)**: 26 Mağaza tanımı, aktif/pasif, varsayılan kart ve e-posta yönetimi.
   - **Kullanıcı Yönetimi (Users & RBAC)**: Personel ekleme, şifre belirleme, mağaza izolasyon ataması.
   - **Siparişler Yönetimi & Satır Silme (Orders CRUD)**: Tüm mağazaların siparişlerini süzme ve tek tek silme.
   - **🧹 Veritabanı Temizleme & Sıfırlama Araçları (DANGER ZONE)**:
     - `RESET-CERBERUS` güvenlik onayıyla çalışır ve **yalnızca geliştirme ortamında** aktiftir (üretimde 404 döner, T0.2).
     - **1. Sadece Siparişleri Temizle (Kullanıcılar & Mağazalar Kalır):** Kendi gerçek Excel/Drive verilerinizi yüklemek için sipariş ve batch tablolarını sıfırlar; kullanıcı ve mağaza ayarlarını korur.
     - **2. 38 Gerçek XLS Siparişi Geri Yükle:** 40-kolonluk referans verisini dilediğinizde tek tıkla geri getirir.
     - **3. Fabrika Ayarlarına Dön:** Sadece Süper Admin hesabını bırakıp tüm tabloları boşaltır.

### 🧭 Admin Dashboard'a Giriş Yapmanın 3 Kolay Yolu:
1. **Giriş Ekranından:** `/login` sayfasında **Ahmet Erdem (Sistem Yöneticisi)** butonuna tıklayın veya `ahmet@cerberus-commerce.io` ve size verilen parola ile giriş yapın → Sistem sizi doğrudan Admin Dashboard'una açar.
2. **Üst Menüdeki Butondan:** Sayfanın en üstünde yer alan mor/indigo renkli **[ 🛡️ Admin Paneli ]** butonuna tıklayın.
3. **Doğrudan URL ile:** Tarayıcı adres çubuğuna doğrudan `https://.../admin` yazın.

---

## 🔐 Kimlik Doğrulama ve Güvenlik (2026-09 Güvenlik Sertleştirmesi)

> Önceki sürümde README'de yayınlanan demo parolaları **kalıcı olarak iptal edilmiştir** (Audit F-03/F-04).

- **Parolalar bcrypt ile saklanır** (`bcryptjs`, cost 12); düz metin parola kabul edilmez.
- **Oturumlar imzalı JWT**'dir (`jose` HS256, 8 saat) — çerez kurcalanamaz.
- **İlk kurulum parolaları** `SEED_ADMIN_PASSWORD` / `SEED_STORE_PASSWORD` ortam değişkenlerinden alınır (üretimde zorunlu, min 12 karakter). Tanımlanmazsa varsayılan hesaplar oluşturulmaz.
- **Login hız sınırlama:** IP+hesap başına 5 deneme/15 dk.
- Kullanıcı ekleme/parola sıfırlama Admin Paneli → Kullanıcı Yönetimi üzerinden yapılır (min 12 karakter).

| Kullanıcı | E-posta | Rol | Mağaza Kapsamı |
|---|---|---|---|
| **Ahmet Erdem** | `ahmet@cerberus-commerce.io` | `ADMIN` | Tüm Mağazalar |
| **Harun** | `harun@cerberus-commerce.io` | `STORE_USER` | Yalnızca HRN |
| **Selin Yılmaz** | `selin@cerberus-commerce.io` | `STORE_USER` | Yalnızca SEL |
| **Can Demir** | `can@cerberus-commerce.io` | `STORE_USER` | Yalnızca MK |

---

## ⚡ Canlıya Alma (Vercel + Neon)

1. Ortam değişkenlerini tanımlayın (ZORUNLU — bk. `.env.example`): `DATABASE_URL`, `SESSION_SECRET` (min 32 kr.), `SEED_ADMIN_PASSWORD`, `SEED_STORE_PASSWORD` (min 12 kr.)
2. Projeyi GitHub'a pushlayın (`allinone-code/allinone-saas`).
3. Neon veritabanında şemayı kurun ve başlangıç verisini yükleyin (T2.1/T2.4):
   ```bash
   export DATABASE_URL="your-neon-pooled-connection-string"
   npm run db:migrate   # versiyonlu migration'lar (drizzle/ klasörü)
   npm run db:seed      # tek seferlik kullanıcı + referans verisi
   ```
   > Not: `db:push` yalnızca lokal geliştirme ve mevcut kurulumlarda TEK SEFERLİK
   > şema eşitlemesi içindir; yeni değişiklikler `npm run db:generate` ile
   > migration olarak üretilir ve commit edilir.
   > Mevcut Neon kurulumlarında FK/unique eklerken hata alırsanız önce mükerrer
   > kontrolü yapın:
   > `SELECT order_number, buyer_store, count(*) FROM orders GROUP BY 1,2 HAVING count(*)>1;`
4. Vercel'de **Redeploy** çalıştırın.
