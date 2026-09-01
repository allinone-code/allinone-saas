"use client";

/**
 * Tarayıcı tarafı için log yaklaşımı (T6.1).
 * HTML tarafında pino çalışmadığı için yapıyı koruyan ince bir sarmalayıcı:
 * üretimde yalnızca warn/error yazar; geliştirmede hepsini yazar.
 * (Faz 6 adımı: SENTRY_DSN tanımlanınca error'lar Sentry'e de gider.)
 */

const isProd = process.env.NODE_ENV === "production";

function emit(level: "debug" | "info" | "warn" | "error", scope: string, msg: string, extra?: Record<string, unknown>) {
  if (isProd && (level === "debug" || level === "info")) return;
   
  console[level === "debug" ? "debug" : level](JSON.stringify({ level, scope, msg, ...extra }));
}

export const clientLog = {
  debug: (scope: string, msg: string, extra?: Record<string, unknown>) => emit("debug", scope, msg, extra),
  info: (scope: string, msg: string, extra?: Record<string, unknown>) => emit("info", scope, msg, extra),
  warn: (scope: string, msg: string, extra?: Record<string, unknown>) => emit("warn", scope, msg, extra),
  error: (scope: string, msg: string, extra?: Record<string, unknown>) => emit("error", scope, msg, extra),
};
