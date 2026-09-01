import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const isDatabaseConfigured = !!process.env.DATABASE_URL;

// F-31/T4.4: fail-open localhost fallback'i kaldırıldı.
// DATABASE_URL yoksa uygulama açılışta net hata verir; sessizce yanlış DB'ye bağlanmaz.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL ortam değişkeni tanımlı değil. .env.example dosyasına bakın."
  );
}

const globalForDb = globalThis as typeof globalThis & {
  __cerberusPool?: Pool;
};

export const pool =
  globalForDb.__cerberusPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 3,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  });

globalForDb.__cerberusPool = pool;

export const db = drizzle(pool);
