// T6.1 — Tarayıcı tarafı Sentry (yalnızca NEXT_PUBLIC_SENTRY_DSN tanımlıysa aktif)
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    sendDefaultPii: false, // KVKK: PII gönderilmez
    replaysOnErrorSampleRate: 0,
  });
}
