import pino from "pino";

/**
 * Merkezi yapısal loglayıcı (T6.1).
 * - JSON satır logları: log toplayıcı (Vercel/Logtail/Datadog) doğrudan okur
 * - PII/sır maskeleme: parola, çerez ve oturum alanları asla loglanmaz (T7.2 öncüsü)
 * - Kullanım: logger.info({ scope, ... }, "mesaj")
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: {
    service: "cerberus-commerce-os",
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "req.headers.cookie",
      "req.headers.authorization",
      "sessionToken",
      "*.sessionToken",
    ],
    censor: "[MASKLENDI]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/** Kapsamlı kısayollar — route'larda tek satır kullanım için */
export const log = {
  info: (scope: string, msg: string, extra?: Record<string, unknown>) =>
    logger.info({ scope, ...extra }, msg),
  warn: (scope: string, msg: string, extra?: Record<string, unknown>) =>
    logger.warn({ scope, ...extra }, msg),
  error: (scope: string, msg: string, error?: unknown, extra?: Record<string, unknown>) =>
    logger.error(
      {
        scope,
        ...extra,
        err:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
      },
      msg
    ),
};
