# CERBERUS — Çoklu Mağaza Operasyon & E-Ticaret Komuta Platformu (Enterprise v2.4)

**Cerberus**, Amazon, Walmart ve Shopify mağazalarında satış yapan e-ticaret operasyonları için geliştirilmiş; **mağaza bazlı veri izolasyonu**, **kullanıcı yetkilendirmesi**, **Google Drive XLS 40-kolon entegrasyonu + CSV Export**, **PSH envanter batch yönetimi**, **depo sayım & fire eşleştirme**, **Amazon SP-API senkronizasyonu** ve **Inventory Lab kârlılık muhasebesi** sunan kurumsal bir SaaS platformudur.

---

## 🔐 Kullanıcı Girişi & Mağaza İzolasyonu

Sistemde her kullanıcının bir rolü ve atanmış bir mağazası (`storeCode`) bulunur:

### 1-Tıkla Test Giriş Hesapları
| Kullanıcı | E-posta | Parola | Rol | Yetki Kapsamı |
|---|---|---|---|---|
| **Ahmet Erdem** | `ahmet@cerberus-commerce.io` | `admin2026` | `ADMIN` | **Tüm Mağazalar**: Yeni mağaza tanımlayabilir, kullanıcıların mağaza atamasını değiştirebilir, SP-API token'larını denetler, tüm sipariş ve denetim loglarını görür. |
| **Harun** | `harun@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca HRN Mağazası**: Sadece HRN'in 38 siparişini, Google Drive faturalarını ve PSH batch'lerini görür. Başka mağazaya erişemez. |
| **Selin Yılmaz** | `selin@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca SEL Mağazası**: Kendi mağazasının ürünlerini ve sipariş süreçlerini yönetir. |
| **Can Demir** | `can@cerberus-commerce.io` | `store2026` | `STORE_USER` | **Yalnızca MK Mağazası**: Yalnızca MK mağazasına yetkilidir. |

---

## 🛡️ Admin Komuta Merkezi & SP-API Paneli (Yalnızca Admin Girişinde Görünür)

Admin girişi yapıldığında üst sekmelerde **"🛡️ Admin Komuta Merkezi"** açılır:
1. **Mağaza Yönetimi**:
   - Yeni mağaza tanımlama (`storeCode`, `storeName`, `marketplace`, `buyerName`, `currency`, `defaultCard`, `defaultEmail`, `notes`).
   - Mağazaları tek tıkla Aktif/Pasif yapma veya sipariş tablosuna geçiş.
2. **Kullanıcı & Mağaza İzolasyon Atama Yönetimi**:
   - Yeni kullanıcı ekleme.
   - Kullanıcıların yetkisini (`ADMIN` / `STORE_USER`) ve sorumlu olduğu mağazayı dinamik olarak değiştirme.
3. **Amazon SP-API & Muhasebe Bağlantıları**:
   - Her mağazanın Amazon Marketplace ID (`ATVPDKIKX0DER`), LWA Client Token durumu ve FBA envanter beslemesi.
4. **Sistem Denetim İzi (Audit Log Stream)**:
   - Kim, ne zaman, hangi mağazada, hangi siparişi veya mağazayı değiştirdi? (`WHO • WHAT • WHEN • BEFORE • AFTER`).

---

## 📦 40 Kolonluk Google Drive XLS, CSV Export ve Operasyonel Akış

1. **Google Drive XLS Siparişleri + CSV İndir**:
   - 40 kolonlu tabloyu görüntüleyin, filtrelenin veya tek tıkla **CSV Export** butonuyla Excel/CSV olarak indirin.
2. **PSH Envanter & Batch Partileri**:
   - Ürünler depoya gelmeden önce açılan sevkiyat batch'leri (`PSH-BATCH-2026-01`, `PSH-BATCH-2026-02`).
3. **Depo Karşılama & Sayım (Order No Eşleştirme)**:
   - Depocu kutunun üzerindeki Order No'yu aratır; gelen, eksik (P2), defolu (P3) adetleri ve Amazona sevk miktarını kaydeder.
4. **Inventory Lab & Amazon Muhasebesi**:
   - Birim alış, satış fiyatı, tahmini Amazon cirosu, kâr ve net **% ROI** dökümü.
5. **P1–P4 Fire & Refund Takip Merkezi**:
   - Satıcı iptalleri, eksik teslimatlar ve R-kodlu iade tutarları.
