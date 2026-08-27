# CERBERUS — ASIL VERİTABANI, YAZILIM VE SİSTEM MİMARİSİ ANAYASASI (v3.0 LOCKED SPEC)

> **⚠️ KİLİT POLİTİKASI (FROZEN DATABASE SCHEMA POLICY):**  
> Bu belgede tanımlanan 8 PostgreSQL tablosu (`users`, `stores`, `researchers`, `research_sessions`, `product_masters`, `orders`, `psh_batches`, `audit_logs`) **Neon Cloud PostgreSQL veritabanındaki canlı ve nihai şemadır**.  
> **Hiçbir AI Agent veya geliştirici bu tablolardan kolon silemez, tablo adını değiştiremez veya mevcut 40-kolonluk Google Drive XLS yapısını bozamaz.**

---

## BÖLÜM 1: NİHAİ VERİTABANI ŞEMASI (NEON POSTGRESQL DRIZZLE ORM)

### 1. `users` — Kullanıcılar & Mağaza İzolasyon Yetkileri
| Kolon Adı | Veri Tipi | Kısıt / Varsayılan | Açıklama |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Benzersiz kullanıcı ID |
| `name` | `TEXT` | `NOT NULL` | Kullanıcı Ad Soyad |
| `email` | `TEXT` | `NOT NULL UNIQUE` | Kurumsal giriş e-posta adresi |
| `password_hash` | `TEXT` | `NOT NULL DEFAULT 'store2026'` | Oturum açma şifresi |
| `role` | `TEXT` | `NOT NULL DEFAULT 'STORE_USER'` | Yetki Rolü: `ADMIN`, `MANAGER`, `STORE_USER` |
| `store_code` | `TEXT` | `NOT NULL DEFAULT 'HRN'` | Sorumlu Mağaza: `ALL` (Admin) veya `HRN`, `SEL`, `MK` |
| `avatar` | `TEXT` | `NULLABLE` | İnisiyaller (`AE`, `HRN`, `SY`, `CD`) |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Kayıt tarihi |

---

### 2. `stores` — 26 Çoklu Mağaza Filosu (Multi-Store Fleet)
| Kolon Adı | Veri Tipi | Kısıt / Varsayılan | Açıklama |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Benzersiz mağaza ID |
| `store_code` | `TEXT` | `NOT NULL UNIQUE` | Mağaza Kodu (`HRN`, `SEL`, `MK`, `AMZ-US-01`..`18`, `WMT-US-01`) |
| `store_name` | `TEXT` | `NOT NULL` | Mağaza Resmi Adı |
| `marketplace` | `TEXT` | `NOT NULL DEFAULT 'AMAZON'` | Pazar Yeri: `AMAZON`, `WALMART`, `SHOPIFY`, `WHOLESALE` |
| `buyer_name` | `TEXT` | `NOT NULL DEFAULT 'Harun'` | Satın Alma Sorumlusu |
| `currency` | `TEXT` | `NOT NULL DEFAULT 'USD'` | Para Birimi (`USD`, `CAD`) |
| `status` | `TEXT` | `NOT NULL DEFAULT 'ACTIVE'` | Mağaza Durumu: `ACTIVE`, `PASSIVE` |
| `default_card` | `TEXT` | `DEFAULT '1753'` | Varsayılan Kredi Kartı Son 4 Hane |
| `default_email` | `TEXT` | `NULLABLE` | Mağaza Sipariş E-Postası |
| `notes` | `TEXT` | `NULLABLE` | Operasyonel notlar |
| `account_health_score` | `INTEGER` | `NOT NULL DEFAULT 98` | Amazon Seller Central Hesap Sağlığı Puanı (0–100) |
| `total_orders_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Toplam Sipariş Adedi |
| `total_spend` | `NUMERIC(12, 2)` | `NOT NULL DEFAULT '0.00'` | Toplam Harcama Tutarı ($) |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Oluşturulma tarihi |

---

### 3. `researchers` — 10 Kişilik ABD Sourcing Ekibi (Quality-Adjusted Scorecard)
| Kolon Adı | Veri Tipi | Kısıt / Varsayılan | Açıklama |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Uzman ID |
| `code` | `TEXT` | `NOT NULL UNIQUE` | Uzman Kodu (`SRC-01` ... `SRC-10`) |
| `name` | `TEXT` | `NOT NULL` | Araştırmacı Ad Soyad |
| `email` | `TEXT` | `NOT NULL` | E-posta |
| `specialty_domain` | `TEXT` | `NOT NULL` | Uzmanlık Alanı (`Home Depot & Lowe's Clearance`, `Ulta Beauty` vb.) |
| `discovery_volume` | `INTEGER` | `NOT NULL DEFAULT 0` | Keşfedilen Ürün Sayısı |
| `approval_rate` | `NUMERIC(5, 2)` | `NOT NULL DEFAULT '0.00'` | Yönetici Onay Oranı (%) |
| `purchase_conversion`| `NUMERIC(5, 2)` | `NOT NULL DEFAULT '0.00'` | Satın Almaya Dönüşüm Oranı (%) |
| `average_roi` | `NUMERIC(6, 2)` | `NOT NULL DEFAULT '0.00'` | Ortalama Portföy ROI (%) |
| `average_net_profit` | `NUMERIC(10, 2)`| `NOT NULL DEFAULT '0.00'` | Aylık Üretilen Net Kâr ($) |
| `problem_rate` | `NUMERIC(5, 2)` | `NOT NULL DEFAULT '0.00'` | Depo Fire & İptal Oranı (%) |
| `researcher_score` | `INTEGER` | `NOT NULL DEFAULT 85` | Kalite Ayarlı Başarı Puanı (0–100) |
| `active_listings_count`| `INTEGER` | `NOT NULL DEFAULT 0` | Aktif FBA Listing Sayısı |
| `avatar` | `TEXT` | `NULLABLE` | İnisiyaller |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Kayıt tarihi |

---

### 4. `research_sessions` — Sourcing Araştırma Oturumları
| Kolon Adı | Veri Tipi | Kısıt / Varsayılan | Açıklama |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Oturum ID |
| `session_code` | `TEXT` | `NOT NULL UNIQUE` | Oturum Kodu (`SES-2026-0827-01`) |
| `researcher_code` | `TEXT` | `NOT NULL` | Sourcing Uzmanı Kodu |
| `researcher_name` | `TEXT` | `NOT NULL` | Sourcing Uzmanı Adı |
| `source_domain` | `TEXT` | `NOT NULL` | Hedef Site (`homedepot.com`, `ulta.com`) |
| `products_found` | `INTEGER` | `NOT NULL DEFAULT 0` | Oturumda Bulunan Ürün |
| `products_approved` | `INTEGER` | `NOT NULL DEFAULT 0` | Onaylanan Ürün |
| `session_quality_score`| `INTEGER`| `NOT NULL DEFAULT 90` | Oturum Verimlilik Puanı |
| `started_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Başlangıç zamanı |

---

### 5. `product_masters` — Merkezi Ürün & Karar Kasası (`Product ≠ Listing`)
| Kolon Adı | Veri Tipi | Kısıt / Varsayılan | Açıklama |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Master Ürün ID |
| `product_code` | `TEXT` | `NOT NULL UNIQUE` | Master Ürün Kodu (`CRB-2026-9041`) |
| `title` | `TEXT` | `NOT NULL` | Ürün Başlığı |
| `brand` | `TEXT` | `NOT NULL` | Marka (`DEWALT`, `LA ROCHE-POSAY`, `NINJA`) |
| `category` | `TEXT` | `NOT NULL` | Kategori |
| `upc` | `TEXT` | `NOT NULL` | Evrensel Barkod (UPC/GTIN) |
| `asin` | `TEXT` | `NOT NULL` | Amazon ASIN |
| `msku` | `TEXT` | `NOT NULL` | Master SKU |
| `source_url` | `TEXT` | `NOT NULL` | ABD Tedarikçi Ürün URL'si |
| `source_domain` | `TEXT` | `NOT NULL` | Tedarikçi Domain (`homedepot.com`) |
| `supplier_name` | `TEXT` | `NOT NULL` | Tedarikçi Firma |
| `researcher_code` | `TEXT` | `NOT NULL DEFAULT 'SRC-01'` | Keşfeden Uzman Kodu |
| `researcher_name` | `TEXT` | `NOT NULL` | Keşfeden Uzman Adı |
| `lifecycle_stage` | `TEXT` | `NOT NULL DEFAULT 'APPROVED'` | 13-Aşamalı Yaşam Döngüsü Durumu |
| `data_quality_status`| `TEXT` | `NOT NULL DEFAULT 'VALID'` | Veri Kalitesi: `VALID`, `INVALID`, `CONFLICTING` |
| `data_freshness_status`| `TEXT`| `NOT NULL DEFAULT 'FRESH'` | Veri Tazeliği: `FRESH`, `AGING`, `STALE`, `EXPIRED` |
| `decision_action` | `TEXT` | `NOT NULL DEFAULT 'BUY'` | Karar Motoru: `BUY`, `TEST`, `WAIT`, `REJECT` |
| `confidence_score` | `INTEGER` | `NOT NULL DEFAULT 88` | AI Güven Skoru (%) |
| `risk_level` | `TEXT` | `NOT NULL DEFAULT 'LOW'` | Risk Seviyesi (`LOW`, `MEDIUM`, `HIGH`) |
| `policy_status` | `TEXT` | `NOT NULL DEFAULT 'APPROVED_BY_POLICY'` | Policy Engine Durumu |
| `source_price` | `NUMERIC(10, 2)` | `NOT NULL` | Alış Fiyatı ($) |
| `prep_cost` | `NUMERIC(10, 2)` | `NOT NULL DEFAULT '1.35'` | FBA Prep & Etiket Maliyeti ($) |
| `marketplace_fee` | `NUMERIC(10, 2)` | `NOT NULL DEFAULT '0.00'` | Amazon Referral Komisyonu (%15) |
| `fulfillment_fee` | `NUMERIC(10, 2)` | `NOT NULL DEFAULT '0.00'` | FBA Kargo Bedeli ($) |
| `landed_cost` | `NUMERIC(10, 2)` | `NOT NULL` | Toplam Landed Cost ($) |
| `selling_price` | `NUMERIC(10, 2)` | `NOT NULL` | Hedef Amazon Satış Fiyatı ($) |
| `estimated_net_profit`| `NUMERIC(10, 2)`| `NOT NULL` | Tahmini Net Kâr ($) |
| `roi_percent` | `NUMERIC(7, 2)` | `NOT NULL` | Tahmini Net ROI (%) |
| `actual_roi_percent` | `NUMERIC(7, 2)` | `NULLABLE` | Gerçekleşen ROI (%) (Actual vs Estimated Engine) |
| `duplicate_score` | `INTEGER` | `NOT NULL DEFAULT 12` | Çift Kayıt Benzerlik Skoru (0–100) |
| `duplicate_status` | `TEXT` | `NOT NULL DEFAULT 'CLEAR'` | `CLEAR`, `EXACT_DUPLICATE` |
| `profitability_score`| `INTEGER` | `NOT NULL DEFAULT 88` | Radar Alt Skoru: Kârlılık |
| `demand_score` | `INTEGER` | `NOT NULL DEFAULT 92` | Radar Alt Skoru: Talep |
| `competition_score` | `INTEGER` | `NOT NULL DEFAULT 78` | Radar Alt Skoru: Rekabet |
| `price_stability_score`| `INTEGER`| `NOT NULL DEFAULT 85` | Radar Alt Skoru: Fiyat İstikrarı |
| `supplier_risk_score`| `INTEGER` | `NOT NULL DEFAULT 94` | Radar Alt Skoru: Tedarikçi Güvenilirliği |
| `operational_risk_score`| `INTEGER`| `NOT NULL DEFAULT 90` | Radar Alt Skoru: Operasyonel Risk |
| `opportunity_score` | `INTEGER` | `NOT NULL DEFAULT 88` | Ağırlıklı Toplam AI Fırsat Skoru (0–100) |
| `evidence_chain` | `JSONB` | `NOT NULL DEFAULT '[]'` | AI Kanıt Zinciri (`claim`, `source`, `confidence`) |
| `channel_listings` | `JSONB` | `NOT NULL DEFAULT '[]'` | 26 Mağaza Kanal Listeleme Dağılımı |
| `cost_history` | `JSONB` | `NOT NULL DEFAULT '[]'` | Zaman İçinde Fiyat/Maliyet Değişim Geçmişi |
| `notes` | `TEXT` | `NULLABLE` | Uzman Notları |
| `discovered_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Keşif Zamanı |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Son Güncelleme |

---

### 6. `orders` — 40-Kolon Gerçek Google Drive XLS Sipariş Tablosu (DEĞİŞTİRİLEMEZ)
| # | Kolon Adı | Veri Tipi | Google Drive XLS Kolonu | Açıklama |
|---|---|---|---|---|
| 1 | `buyer_store` | `TEXT` | **Satın Alan** | Mağaza Kodu (`HRN`, `SEL`, `MK`) |
| 2 | `order_date` | `TEXT` | **Tarih** | Sipariş Tarihi (`YYYY-MM-DD`) |
| 3 | `image_url` | `TEXT` | **Ürün resmi** | Ürün Görsel URL'si |
| 4 | `fulfillment_type` | `TEXT` | **FBM/FBA** | Gönderim Tipi (`FBA` / `FBM`) |
| 5 | `product_title` | `TEXT` | **Ürün adı Amazon** | Amazon Ürün Başlığı |
| 6 | `asin` | `TEXT` | **ASIN** | Amazon Standart Kimlik Numarası |
| 7 | `msku` | `TEXT` | **MSKU** | Mağaza Satıcı SKU Kodu |
| 8 | `supplier_name` | `TEXT` | **Satıcı adı** | Tedarikçi Firma (`THE VITAMINSHOPPE`) |
| 9 | `supplier_code` | `TEXT` | **Satıcı kodu** | Tedarikçi Cari Kodu (`A198`) |
| 10 | `supplier_url` | `TEXT` | **Satıcı link** | ABD Tedarikçi Satış Linki |
| 11 | `amazon_url` | `TEXT` | **Amazon link** | Amazon Listing Linki |
| 12 | `order_number` | `TEXT` | **Orderno** | Sipariş Numarası (`WO110074776` vb.) |
| 13 | `drive_link` | `TEXT` | **Order'ın drive linki** | Google Drive Fatura PDF Linki |
| 14 | `pack_count` | `INTEGER` | **Kaçlı paket** | Paket İçi Adet |
| 15 | `quantity` | `INTEGER` | **Ürün adedi** | Sipariş Verilen Toplam Miktar |
| 16 | `unit_cost` | `NUMERIC(10,2)`| **Ürün birim maliyeti** | Birim Alış Bedeli ($) |
| 17 | `selling_price` | `NUMERIC(10,2)`| **Ürün satış fiyatı** | Hedef Amazon Satış Bedeli ($) |
| 18 | `total_cost` | `NUMERIC(12,2)`| **Ürün toplam maliyeti** | Toplam Sipariş Bedeli ($) |
| 19 | `order_email` | `TEXT` | **Mail adresi** | Sipariş Maili (`cerberusnisan@gmail.com`) |
| 20 | `cargo_status` | `TEXT` | **Kargo durumu** | `Tam Geldi`, `İPTAL`, `Yolda`, `Kayıp Depoya gelmiş` |
| 21 | `shipped_to_amazon`| `INTEGER` | **Amazona gönderilen adet**| NJ Depodan Amazon FBA'e Sevk Edilen Adet |
| 22 | `p1_cancel_qty` | `INTEGER` | **İptal adet-P1** | P1 Fire: Satıcı veya Kart İptali Adedi |
| 23 | `p2_missing_qty` | `INTEGER` | **Eksik adet-P2** | P2 Fire: Depoya Eksik Gelen Adet |
| 24 | `p3_defective_qty` | `INTEGER` | **Defolu adet-P3** | P3 Fire: Hasarlı / Kırık Gelen Adet |
| 25 | `p4_expired_qty` | `INTEGER` | **Tarihi geçmiş adet-P4** | P4 Fire: SKT Yaklaşan / Geçen Adet |
| 26 | `problem_action` | `TEXT` | **Problemle ilgili eylem** | Satıcıya İtiraz / Tazminat Talep Notu |
| 27 | `problem_result` | `TEXT` | **Problemle ilgili sonuç** | İade Alındı / Kargo Tazmin Edildi |
| 28 | `refund_amount` | `NUMERIC(10,2)`| **Refund miktarı** | R-Kodlu Kredi Kartı İade Tutarı ($) |
| 29 | `credit_card` | `TEXT` | **Kredi Kartı** | Ödeme Kartı Son 4 Hane (`1753`, `5686`) |
| 30 | `is_fragile` | `TEXT` | **Fragile** | Kırılabilir Ürün (`YES` / `NO`) |
| 31 | `is_multipack` | `TEXT` | **MultiPack** | Çoklu Paket (`YES` / `NO`) |
| 32 | `is_bundle` | `TEXT` | **Bundle** | Bundle (`YES` / `NO`) |
| 33 | `count_per_bundle` | `INTEGER` | **CountPerBundle** | Bundle İçi Adet |
| 34 | `condition` | `TEXT` | **Condition** | Ürün Durumu (`New`) |
| 35 | `brand_name` | `TEXT` | **Marka adı** | Marka (`MegaFood`, `Vital`, `FORCE`) |
| 36 | `description_1` | `TEXT` | **Ürünle ilgili açıklama1**| Not 1 (`Kayıp Depoya gelmiş`, `ev`) |
| 37 | `description_2` | `TEXT` | **Ürünle ilgili açıklama2**| Kargo Takip URL (Narvar / Amazon TBA...) |
| 38 | `audit_note` | `TEXT` | **Denetim için açıklama** | Denetim Notu (`Depoda kayıp`) |
| 39 | `period_code` | `TEXT` | **Tarih2 (Dönem Kodu)** | Muhasebe Dönemi (`O26` Ocak, `Ş26` Şubat) |
| 40 | `corrected_cost` | `NUMERIC(12,2)`| **Düzeltilmiş maliyet** | İade Sonrası Net Düzeltilmiş Maliyet ($) |
| + | `psh_batch_no` | `TEXT` | **PSH Batch Numarası** | PSH Ön-Envanter Parti Kodu (`PSH-BATCH-2026-01`) |
| + | `psh_status` | `TEXT` | **PSH Envanter Durumu** | `BEKLIYOR`, `BATCH_OLUSTURULDU`, `DEPO_SAYILDI`, `AMAZONA_SEVK` |
| + | `inventory_lab_status`| `TEXT`| **Inventory Lab Durumu** | `GIRILMEDI`, `GIRILDI`, `AKTIF_SATISTA` |

---

### 7. `psh_batches` — PSH Ön-Envanter Parti Takibi
| Kolon Adı | Veri Tipi | Kısıt / Varsayılan | Açıklama |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Batch ID |
| `batch_number` | `TEXT` | `NOT NULL UNIQUE` | Benzersiz PSH Parti Kodu (`PSH-BATCH-2026-01`) |
| `store_code` | `TEXT` | `NOT NULL DEFAULT 'HRN'` | Mağaza Kodu |
| `title` | `TEXT` | `NOT NULL` | Parti Başlığı |
| `status` | `TEXT` | `NOT NULL DEFAULT 'HAZIRLANIYOR'` | `HAZIRLANIYOR`, `DEPODA`, `SAYILDI`, `AMAZONA_GONDERILDI` |
| `total_items_count`| `INTEGER` | `NOT NULL DEFAULT 0` | Partideki Toplam Sipariş Kalemi |
| `total_units_count`| `INTEGER` | `NOT NULL DEFAULT 0` | Beklenen Toplam Ürün Adedi |
| `received_units_count`| `INTEGER`| `NOT NULL DEFAULT 0` | Depoya Sağlam Gelen Ürün Adedi |
| `missing_units_count`| `INTEGER` | `NOT NULL DEFAULT 0` | Eksik Çıkan Ürün Adedi |
| `defective_units_count`|`INTEGER`| `NOT NULL DEFAULT 0` | Defolu Çıkan Ürün Adedi |
| `inventory_lab_synced`| `BOOLEAN`| `NOT NULL DEFAULT false` | Inventory Lab Muhasebesine İşlendi mi? |
| `notes` | `TEXT` | `NULLABLE` | Parti Notları |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | Oluşturulma tarihi |

---

### 8. `audit_logs` — Değiştirilemez Denetim İzi (Audit Trail)
| Kolon Adı | Veri Tipi | Kısıt / Varsayılan | Açıklama |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Denetim Kayıt ID |
| `actor_name` | `TEXT` | `NOT NULL` | İşlemi Yapan Kullanıcı |
| `store_code` | `TEXT` | `NOT NULL DEFAULT 'HRN'` | İşlemin Yapıldığı Mağaza |
| `action_type` | `TEXT` | `NOT NULL` | `ORDER_CREATED`, `DECISION_OVERRIDE`, `STORE_CREATED`, `XLS_BATCH_IMPORT` |
| `target_entity` | `TEXT` | `NOT NULL` | Hedef Varlık (`WO110074776`, `CRB-2026-9041`) |
| `before_state` | `TEXT` | `NULLABLE` | Önceki Durum |
| `after_state` | `TEXT` | `NULLABLE` | Sonraki Durum |
| `details` | `TEXT` | `NULLABLE` | Kanıt ve İşlem Açıklaması |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | İşlem Zamanı |

---

## BÖLÜM 2: YAZILIM MİMARİSİ (SOFTWARE ARCHITECTURE)

- **Framework:** Next.js 16 (App Router + Server Actions + Dynamic API Routes)
- **Sunucu Taraflı ORM & Veritabanı Bağlantısı:** `drizzle-orm/node-postgres` + `pg.Pool` (`max: 3` bağlantı limitiyle Vercel serverless pooler uyumlu)
- **Oturum & Mağaza İzolasyon Proxy Katmanı (`src/proxy.ts`):**
  - Tüm `/api/*` ve statik dosyalar dışındaki sayfa isteklerinde `cerberus_session` HTTP-only çerezini denetler.
  - Rolü `STORE_USER` olan bir kullanıcının sunucu API'lerine (`/api/orders`) gönderdiği sorguları zorunlu olarak kullanıcının `storeCode` (`HRN`, `SEL`, `MK`) değeriyle kilitler.
- **Kendi Kendini Onaran Fallback Mimarisi (Self-Healing Offline Fallback):**
  - PostgreSQL bağlantısı kesilse dahi `src/lib/mockData.ts` üzerindeki eksiksiz bellek veri seti devreye girer; uygulama asla 500 hatası verip çökmez.

---

## BÖLÜM 3: OPERASYONEL İŞ SÜREÇLERİ (7-ADIMLI ZİNCİR)

1. **ABD Sourcing & Karar Kasası:** 10 personel ABD sitelerini tarar. Sistem `BUY | TEST | WAIT | REJECT` kararı üretir.
2. **Google Drive XLS 40-Kolon Sipariş Kaydı:** Sipariş verilen ürün, fatura linki ve kredi kartı ile kaydedilir.
3. **PSH Ön-Envanter Batch Oluşturma:** Ürün depoya gelmeden önce PSH programında parti (`PSH-BATCH-2026-02`) açılır.
4. **Depo Karşılama & Sayım (Order No Eşleştirme):** Depocu kutunun üzerindeki `Orderno` ile arama yapar; sağlam gelen, eksik (`P2`) veya defolu (`P3`) adetleri girer.
5. **P1–P4 Fire & Refund Takip Merkezi:** Eksik/iptal siparişler için satıcıya açılan tazminat ve karta yansıyan R-kodlu iade (`Refund miktarı`) takip edilir.
6. **Inventory Lab & Amazon Muhasebesi:** FBA'e çıkan ürünlerin alış bedeli, Amazon satış bedeli ve net **% ROI** hesaplanır.
7. **Sabah Brifingi & İş Sağlığı Skoru (0–100):** Yönetici her sabah `WHAT CHANGED? • WHAT MATTERS? • WHAT SHOULD I DO?` raporunu alır.
