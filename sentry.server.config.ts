// T6.1 — Sunucu tarafı Sentry (yalnızca SENTRY_DSN tanımlıysa aktif)
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // üretimde maliyet/gürültü dengesi
    sendDefaultPii: false, // KVKK: PII gönderilmez
  });
}
