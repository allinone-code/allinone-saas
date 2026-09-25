# CHANGELOG

Biçim: `YYYY-AA-GG — başlık` + kullanıcıya/güvenliğe etkisi. Teknik detay PR
açıklamasındadır.

## 2026-09-25 — PM uçtan uca yayın denetimi (`arena/01a0d5cf-allinone-saas`)

Güvenlik:

- Seed artık mevcut kaydı asla silmiyor (yalnızca boş tabloyu doldurur).
- Bilinen kurulum parolasıyla oturum açılmıyor; ilk girişte zorunlu kalıcı
  parola belirleme (`POST /api/auth/first-password`, tek kullanımlık).
- Kullanıcılar kendi parolalarını değiştirebiliyor (`PATCH /api/auth/me`);
  değişiklik diğer oturumları iptal ediyor.
- Fixture'daki uydurma `1753` kart değerleri temizlendi; Neon kurulum SQL'i
  8 migration ile yeniden üretildi.
- CSP Sentry ingest izni; `sentry.server/edge.config.ts` eklendi.

Ürün:

- Ölü "Ayarlar" sekmesi canlandı: ROI eşikleri, Keepa, entegrasyon durumu
  (Keepa/Scrapling/SP-API dürüst rozetler), ADMIN DSR paneli.
- KVKK aydınlatma/çerez sayfaları (`/yasal/*`) + giriş ekranı açıklamaları.
- Hata/404/yükleniyor sayfaları, favicon, robots, PWA manifest.
- Reddedilen değişiklikler artık hata gösterip geri alınıyor (iyimser UI).
- Sipariş boş-durumu ilk-veri rehberi; modal/çekmecelerde ESC + dialog
  erişilebilirliği; mobil üst barda CSV/içe aktarma erişimi.

Operasyon:

- `npm run smoke`: üretime dokunmayan 10 maddelik HTTP duman testi.
- Preflight migration manifest'e bağlandı (8 + head hash).
- OpenAPI 0 uyarı; CI'a `py_compile` + concurrency; anlamsız Vercel health
  cron'u kaldırıldı.
- `generate-neon-sql` artık DB bağlantısı gerektirmiyor.

## 2026-09-14 — Üretim hazırlığı sertleştirme (`arena/01a09cb2`)

- Server-side arama/filtreleme/sayfalama + SQL KPI + 10k sınırlı CSV export.
- Finansal sözleşme düzeltmesi (refund = tedarikçi maliyet iadesi).
- Crawler/Scrapling güvenlik sınırları, mağaza izolasyonu, maskeleme.
- Migration manifest + head-hash drift kontrolü; runbook ve readiness.
