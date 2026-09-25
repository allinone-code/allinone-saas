# CERBERUS Üretim Hazırlığı — Güncel Durum

**Son güncelleme:** 25 Eylül 2026

**Branch:** `arena/01a0d5cf-allinone-saas`

**Durum:** PM uçtan uca denetimi tamamlandı; tüm kalite kapıları yeşil, canlı PGlite
doğrulaması (10/10 duman testi + kimlikli akışlar) geçiyor. Aşağıdaki "yayın öncesi
kontrol listesi" tamamlanınca canlıya alınabilir.

## Bu denetimde kapatılan eksikler

- [x] Seed veri kaybı riski: `< 30 ise sil + yeniden yaz` kaldırıldı; seed yalnızca
      boş tabloyu doldurur, mevcut kayda asla dokunmaz (24→24 idempotency kanıtlandı)
- [x] Fixture dürüstlüğü: `ALL_XLS_ORDERS` ana export (24 satır), uydurma `1753` kart
      değerleri temizlendi, dürüstlük testleriyle kilitlendi
- [x] Neon kurulum SQL'i yeniden üretildi: 8/8 migration, güncel fixture, migration
      takibi; üretici artık DB bağlantısı gerektirmiyor (`systemUsers` ayrıştırması)
- [x] Kurulum parolası zorunlu rotasyonu: bilinen parolayla oturum açılmaz (403 +
      `PASSWORD_CHANGE_REQUIRED`); ilk girişte kalıcı parola ekranı
      (`POST /api/auth/first-password`, tek kullanımlık, rate-limited)
- [x] Kullanıcı kendi parolasını değiştirebilir (`PATCH /api/auth/me` + UI);
      değişiklik diğer oturumları derhal geçersiz kılar
- [x] Ölü "Ayarlar" sekmesi canlandırıldı: ROI eşikleri + Keepa + entegrasyon durumu
      (Keepa/Scrapling/SP-API dürüst rozetler) + ADMIN DSR paneli
- [x] KVKK yüzeyleri: `/yasal/aydinlatma`, `/yasal/cerez` (public) + giriş ekranı
      çerez açıklaması + altbilgi bağlantıları
- [x] Yayın rotaları: `error.tsx`, `not-found.tsx`, `loading.tsx`, `robots.ts`,
      `manifest.ts`, favicon; proxy `/yasal/*` için public
- [x] İyimser güncelleme dürüstlüğü: reddedilen sipariş/karar değişikliği hata
      gösterir ve sunucu verisine geri alınır
- [x] OpenAPI 38 uyarı → **0 uyarı** (license, operationId, 4xx, ErrorResponse
      kullanımı) + yeni parola uçları sözleşmeye eklendi
- [x] Preflight güncellendi: sabit `4` yerine migration manifest (8 + head hash)
- [x] HTTP duman testi: `npm run smoke` (10 kontrol, üretime dokunmaz)
- [x] Modal/çekmece erişilebilirliği: ESC ile kapatma, `role=dialog`,
      backdrop tıklamasıyla kapatma; mobil üst barda CSV/içe aktarma ikonları
- [x] Sipariş boş-durumu: ilk veri yükleme rehberi + tek tık aksiyonlar
- [x] CSP `connect-src` Sentry ingest izni + `sentry.server/edge.config.ts`
- [x] `vercel.json` anlamsız `/api/health` cron'u kaldırıldı (izleme = alarmlı
      uptime probe'ları, runbook'ta tanımlı)
- [x] `db:push` içindeki kabuk-bozan `#` yorumu temizlendi
- [x] CI: `py_compile`, Python kurulumu, concurrency iptali eklendi
- [x] Admin UI metin düzeltmeleri (yanlış "38"/"Ahmet Erdem" varsayımları)
- [x] Doküman senkronu: PLAN, runbook, KURULUM, README, CHANGELOG

## Son doğrulama sonuçları (25 Eylül 2026)

| Kontrol | Sonuç |
|---|---|
| TypeScript (`npm run typecheck`) | PASS |
| ESLint (`npm run lint`) | PASS — 0 hata |
| Vitest + Python + OpenAPI (`npm test`) | PASS — 297 test / 26 dosya, 0 OpenAPI uyarısı |
| Next.js production build | PASS |
| Production dependency audit | PASS — 0 açık |
| HTTP duman testi (`npm run smoke`, yerel PGlite) | PASS — 10/10 |
| Kimlikli akışlar (PGlite) | PASS — admin login, 24 sipariş + KPI, settings |
| Mağaza izolasyonu | PASS — SEL kullanıcısı HRN isteğinde 0 kayıt |
| Rol maskelemesi | PASS — STORE_USER e-posta maskeli |
| Kurulum parolası rotasyonu | PASS — 403 (çerezsiz) → 401 (yanlış) → 200 (doğru) → 404 (tek kullanımlık kapandı) |
| Parola değiştirme + oturum iptali | PASS — PATCH 200, eski oturum 401 |
| Rate-limit | PASS — 5×401 ardından 429 |
| Authenticated 404 + dashboard render | PASS |
| Seed idempotency | PASS — 24→24, silme yok |
| Git whitespace kontrolü | PASS |

## Yayın öncesi kontrol listesi (insan onayı gerektirir)

- [ ] Managed PostgreSQL + PITR/backup doğrulandı
- [ ] `SESSION_SECRET` (≥32 kr) + seed parolaları (≥12 kr) secret manager'da
- [ ] Staging'de `db:migrate` + `/api/health/ready` 200 + `npm run smoke` 10/10
- [ ] KVKK metinlerindeki `[ŞİRKET ...]` alanları dolduruldu, hukukçu inceledi
- [ ] Crawler allowlist (`CRAWLER_ALLOWED_HOSTS`) bilinçli daraltıldı
- [ ] Platform rate-limit + uptime alarmları (liveness/readiness probe) bağlandı
- [ ] Release/DB/rollback sahipleri belirlendi (runbook §8 kayıt şablonu)

## Bilinen, engelleyici olmayan konular

- Amazon SP-API bağlı değildir; UI planlanan özellik olarak gösterir.
- Döviz dönüşümü yoktur; farklı para birimleri tek toplamda birleştirilmemelidir.
- Tam bağımlılık audit'inde yalnız dev zinciri (`drizzle-kit → esbuild`) kaynaklı
  moderate bildirimler kalabilir; production audit sıfırdır.
- Tarayıcı E2E (Playwright) ve bağımsız WCAG AA taraması henüz yapılmadı;
  kritik akışlar canlı PGlite üzerinde HTTP + sayfa seviyesinde kanıtlandı.
- Rate-limit proses-içidir; çok instance'lı yayında platform katmanı da açılmalıdır.
