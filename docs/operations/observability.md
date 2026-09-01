# Gözlemlenebilirlik Runbook'u — T6.1 / T6.3

## Loglama (pino)

- Sunucu tarafı: `src/lib/logger.ts` — JSON satır logları; `scope` alanıyla filtrelenir
  (örn. Vercel loglarında `"scope":"auth/login"` araması)
- Parola/çerez/oturum alanları otomatik `[MASKLENDI]` olarak redakte edilir
- İstemci tarafı: `src/lib/clientLogger.ts` (üretimde yalnız warn/error)
- Ham `console.*` kullanımı ESLint'te **hata**dır (`no-console`)

## Sentry (opsiyonel, hazır iskelet)

1. https://sentry.io → yeni Next.js projesi aç → DSN'i al
2. Vercel env'lerine ekle:
   - `SENTRY_DSN` (sunucu + instrumentation)
   - `NEXT_PUBLIC_SENTRY_DSN` (tarayıcı)
3. Redeploy. DSN yoksa SDK yüklenmez; hiçbir davranış değişmez.
4. `sendDefaultPii: false` sabitli — KVKK gereği değiştirilmez.

## Sağlık uçları

| Uç | Kullanım |
|---|---|
| `GET /api/health` | Liveness — DB bir kez `SELECT 1` (çökme tespiti için yeterli) |
| `GET /api/health/ready` | Readiness — DB + SESSION_SECRET yapılandırması; 503 dönerse trafik alamaz |

**Uptime izleme önerisi:** Better Stack / UptimeRobot free tier →
30 sn aralıkla `GET /api/health/ready`; 2 ardışık başarısızlıkta e-posta/Telegram alarmı.

## Alarm eşikleri (öneri)

| Sinyal | Eşik | Aksiyon |
|---|---|---|
| readiness 503 | 2 ardışık | Sayfalama/on-call |
| 5xx oranı | 5 dk içinde > %5 | Son deploy'u geri al |
| login 429 patlaması | > 50/dk | WAF/rate limit gözden geçir (olası saldırı) |
| Sentry yeni issue | her kritik | Günlük triage |
