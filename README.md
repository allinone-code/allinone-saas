# CERBERUS — Çoklu Mağaza Operasyon & E-Ticaret Komuta Platformu

**Cerberus**, Amazon, Walmart ve Shopify mağazalarında satış yapan e-ticaret operasyonları için geliştirilmiş; **mağaza bazlı veri izolasyonu**, **kullanıcı yetkilendirmesi**, **Google Drive XLS 40-kolon entegrasyonu**, **PSH envanter batch yönetimi**, **depo sayım & fire eşleştirme** ve **Inventory Lab kârlılık muhasebesi** sunan kurumsal bir SaaS platformudur.

---

## 🔐 Kullanıcı Girişi & Mağaza İzolasyonu

Sistemde her kullanıcının bir rolü ve atanmış bir mağazası (`storeCode`) bulunur:

### 1-Tıkla Test Giriş Hesapları
| Kullanıcı | E-posta | Parola | Rol | Yetki Kapsamı |
|---|---|---|---|---|
| **Ahmet Erdem** | `ahmet@cerberus-commerce.io` | `admin2026` | `ADMIN` | **Tüm Mağazalar**: Yeni mağaza tanımlayabilir, kullanıcıların mağaza atamasını değiştirebilir, tüm sipariş ve denetim loglarını görür. |
| **Harun** | `harun@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca HRN Mağazası**: Sadece HRN'in 38 siparişini, Google Drive faturalarını ve PSH batch'lerini görür. Başka mağazaya erişemez. |
| **Selin Yılmaz** | `selin@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca SEL Mağazası**: Kendi mağazasının ürünlerini ve sipariş süreçlerini yönetir. |
| **Can Demir** | `can@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca MK Mağazası**: Yalnızca MK mağazasına yetkilidir. |

> 🛡️ **Güvenlik Güvencesi:** `STORE_USER` rolündeki bir kullanıcı tarayıcıdan filtreyi değiştirmeye çalışsa bile, sunucu tarafı (`/api/orders`) kullanıcının oturumundaki `storeCode` ile sorguyu zorunlu olarak kilitler.

---

## 🛡️ Admin Komuta Merkezi (Yalnızca Admin Girişinde Görünür)

Admin girişi yapıldığında üst sekmelerde **"🛡️ Admin Komuta Merkezi"** açılır:
1. **Mağaza Yönetimi**:
   - Yeni mağaza tanımlama (`storeCode`, `storeName`, `marketplace`, `buyerName`, `currency`, `defaultCard`, `defaultEmail`, `notes`).
   - Mağazaları tek tıkla Aktif/Pasif yapma veya düzenleme.
   - Her mağazanın toplam sipariş sayısı ve canlı harcama tutarı.
2. **Kullanıcı & Mağaza Atama Yönetimi**:
   - Yeni kullanıcı ekleme.
   - Kullanıcıların yetkisini (`ADMIN` / `STORE_USER`) ve sorumlu olduğu mağazayı dinamik olarak değiştirme.
3. **Sistem Denetim İzi (Audit Log Stream)**:
   - Kim, ne zaman, hangi mağazada, hangi siparişi veya mağazayı değiştirdi? (`WHO • WHAT • WHEN • BEFORE • AFTER`).

---

## 📦 40 Kolonluk Google Drive XLS ve Operasyonel Akış

Sistem, Google Drive tablonuzdaki 40 kolonu birebir işler:
1. **Google Drive XLS Siparişleri**:
   - `Satın Alan` (HRN vb.), `Tarih`, `FBM/FBA`, `Ürün adı Amazon`, `ASIN`, `MSKU`, `Satıcı adı`, `Satıcı kodu`, `Satıcı link`, `Amazon link`, `Orderno`, `Drive fatura linki`, `Kaçlı paket`, `Ürün adedi`, `Birim maliyet`, `Satış fiyatı`, `Toplam maliyet`, `Mail adresi`, `Kargo durumu`, `Amazona gönderilen adet`, `P1 İptal`, `P2 Eksik`, `P3 Defolu`, `P4 Tarihi geçmiş`, `Problem eylem`, `Problem sonuç`, `Refund miktarı`, `Kredi kartı`, `Condition`, `Marka adı`, `Dönem kodu`, `Düzeltilmiş maliyet`.
2. **PSH Envanter & Batch Partileri**:
   - Ürünler depoya gelmeden önce açılan sevkiyat batch'leri (`PSH-BATCH-2026-01`, `PSH-BATCH-2026-02`).
3. **Depo Karşılama & Sayım (Order No Eşleştirme)**:
   - Depocu kutunun üzerindeki Order No'yu aratır; gelen, eksik (P2), defolu (P3) adetleri ve Amazona sevk miktarını kaydeder.
4. **Inventory Lab & Amazon Muhasebesi**:
   - Birim alış, satış fiyatı, kâr ve net **% ROI** dökümü.
5. **P1–P4 Fire & Refund Takip Merkezi**:
   - Satıcı iptalleri, eksik teslimatlar ve R-kodlu iade tutarları.

---

## ⚡ Hızlı Başlangıç (Lokalde Çalıştırma)

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. .env dosyasını oluşturun (Neon veya yerel PostgreSQL)
cp .env.example .env

# 3. Veritabanı şemasını uygulayın
npx drizzle-kit push

# 4. Sunucuyu başlatın
npm run dev
```

Tarayıcınızda açın: **http://localhost:3000** → Otomatik olarak `/login` ekranına yönlendirilirsiniz. 1-tıkla test butonlarıyla sisteme giriş yapabilirsiniz! 🚀
