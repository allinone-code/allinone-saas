/**
 * T6.1 — Sentry iskeleti (opsiyonel, env-korumalı).
 * SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN tanımlı değilse hiçbir şey başlatılmaz ve
 * SDK paketi runtime'da yüklenmez. Kurulum: docs/operations/observability.md
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1, // üretimde maliyet/gürültü dengesi
      sendDefaultPii: false, // KVKK: PII gönderilmez (T7.2)
    });
  }

  if (process.env.NEXT_RUNTIME === "edge" && process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}
