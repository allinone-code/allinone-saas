# ADR-08: Amazon SP-API Entegrasyon Kararı (T8.1)

- **Tarih:** 2026-09-01 (Faz 8 mimari borç temizliği)
- **Durum:** KARAR VERİLDİ — Kademeli yol haritası, PII'siz başlangıç
- **Bağlam:** Bu karar daha önce yazılı değildi; "SP-API yapılacak mı?" sorusu her planlamada açık borç olarak duruyordu.

## 1. Mevcut durum

Uygulamada **hiçbir SP-API istemcisi yoktur**. Amazon'a ilişkin tüm veri akışı manueldir:

- `POST /api/orders/import-xls` — XLS dosya yükleme (40-kolon master format)
- `POST /api/orders/import-drive-url` — Google Drive URL'sinden çekme
- `amazonUrl` / `asin` alanları manuel taşınır; `shippedToAmazon` insan girişidir
- "Amazon NJ Prep Merkezi entegre" gibi ifadeler vardı — gerçek entegrasyon değil, sabitlenmiş metindi (Faz 8'de T8.3 ile kaldırıldı)

## 2. Seçenekler

### A) Manuel akışta kal (statüko)
- **Maliyet:** 0
- **Risk:** Operasyon hacmi arttıkça insan hatası, veri tazeliği kaybı (haftalık XLS ritmi)
- **Uygun olduğu eşik:** Haftalık ≤ ~150 sipariş, tek marketplace (US)

### B) Tam SP-API entegrasyonu (alıcı PII dahil)
- **Gerekenler:** Amazon Developer kaydı + uygulama onayı, Login with Amazon (OAuth), AWS IAM + SigV4 imzalama, rate-limit yönetimi, bildirimler (SQS/EventBridge).
- **Kritik duvar — restricted PII:** Alıcı adı/adresi/telefonu/e-postası ancak Amazon'un **Public PII Process** denetimiyle açılır: AES-256 at-rest şifreleme, **sevkiyat sonrası 30 günde PII silme** zorunluluğu, erişim loglaması, yıllık üçüncü-taraf sızma testi, olay müdahale planı. Süreç tipik olarak **aylar** sürer ve küçük iç-araç başvuruları sıklıkla reddedilir ([kaynak 1](https://www.datadoe.com/blog-posts/amazon-sp-api-restricted-pii), [kaynak 2](https://github.com/amzn/selling-partner-api-models/discussions/3085)).
- **Maliyet tahmini:** 8-12 hafta geliştirme + uyumluluk altyapısı + aylık denetim yükü.
- **Sonuç:** Bu ölçekte reddedilir.

### C) Kademeli entegrasyon — PII'siz başla (SEÇİLEN)
1. **Adım 1 (tetikte bekliyor):** Yalnızca kısıtlı-olmayan SP-API verileri — Catalog Items (ASIN doğrulama, fiyat/boyut), FBA Inventory, Orders API **meta verisi** (PII alanları istemeden), Finances/fee özetleri. Alıcı PII'si **istek kapsamı dışında**.
2. **Adım 2:** `shippedToAmazon` ve stok/konsinye akışlarının otomasyonu; manuel XLS akışı yedek olarak korunur.
3. **Adım 3 (koşullu):** İade/tazminat iş akışı alıcı teması gerektirirse PII Process'e ayrı iş case'i ile başvuru değerlendirilir.

## 3. Karar ve gerekçe

**Karar: Seçenek C.** Kısa vadede manuel akış yeterli; otomasyon ihtiyacı doğduğunda PII'siz SP-API kapsamıyla başlanır.

Gerekçeler:
- Uygulamanın tuttuğu PII (`orders.order_email`, kart son-4) **kendi mağaza sistemlerimizin** verisidir; Amazon alıcı PII'si akışta yok — bu yüzden PII Process duvarı mevcut işlevler için gerekmiyor.
- Faz 7 saklama politikamız (365 gün) Amazon'un PII kuralıyla (30 günde silme) çelişirdi; PII'siz kapsam bu çelişkiyi yapısal olarak ortadan kaldırır.
- PII'siz onay yolu ölçülebilir biçimde daha hızlıdır.

## 4. Tetik koşulları (kararı yeniden gözden geçir)

- [ ] Haftalık sipariş hacmi 2 hafta üst üste > 150 veya manuel import hata oranı hissedilir düzeyde
- [ ] İkinci marketplace (EU/UK) açılması (XLS format uyumsuzlukları başlar)
- [ ] `shippedToAmazon` mutabakatı ayda 1'den fazla manuel müdahale gerektirirse
- [ ] Amazon tarafında fee/envanter uyumsuzluğu kaynaklı finansal fark > tolerans

## 5. Teknik tasarım notları (uygulama başladığında)

- Kimlik: LWA refresh token + AWS SigV4 — token SP-API'ye özel env değişkenlerinde tutulur (`SPAPI_*`), asla repoya girmez; rotasyon takvimi `docs/operations/security-rotation.md`'e eklenir.
- İmza/imzalama ve bağlantı soyutlaması `src/lib/spapi/` altında toplanır; route'lar doğrudan HTTP konuşmaz (Faz 3 katman ayrımı ilkesi).
- Rate limit: SP-API uç başına kova sınırlıdır — server-side in-process rate limiter + `Retry-After` saygısı zorunlu.
- Bildirimler: SQS consumer ayrı worker (Vercel app router süre sınırlarına takılmaz).
- KVKK etkisi: PII'siz kapsamda bile sipariş meta verisi ABD'ye gider/gelir — m.9 değerlendirmesi ve `veri-envanteri.md` güncellemesi Adım 1 öncesi zorunludur.
- Test: fixture-based (kayıtlı SP-API yanıtları) — canlı hesap olmadan CI koşabilmeli (Faz 4 test altyapı deseni).

## 6. Açık risk / kabul edilen borç

- Amazon katalog fiyat sapmaları manuel akışta 1 hafta gecikmeyle görünür — kabul edildi.
- Public PII Process'in reddedilme ihtimali yüksek ([kaynak 2](https://github.com/amzn/selling-partner-api-models/discussions/3085)) — Adım 3 buna bağımlı değildir; iş akışı PII'siz tasarlanır.
