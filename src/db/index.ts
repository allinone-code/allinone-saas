import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
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

/**
 * Yerel geliştirme sürücüsü (yalnızca `pglite:` şemasıyla).
 *
 * Bazı geliştirme ortamlarında Postgres ikilisi kurulamıyor. Bu durumda
 * `DATABASE_URL=pglite:./.pglite-dev` verilerek uygulama in-process bir
 * Postgres (PGlite) üzerinde çalıştırılabilir; testlerin kullandığı motorun
 * aynısıdır, dolayısıyla şema ve kısıt davranışı birebir aynıdır.
 *
 * Üretim yolu DEĞİŞMEZ: `postgres://` adresleri her zaman gerçek `pg`
 * havuzunu kullanır. Bu dal yalnızca açıkça `pglite:` yazıldığında devreye
 * girer, yani kazayla üretimde etkinleşemez.
 */
const isPglite = databaseUrl.startsWith("pglite:");

const globalForDb = globalThis as typeof globalThis & {
  __cerberusPool?: Pool;
  __cerberusDb?: NodePgDatabase;
};

let db: NodePgDatabase;
let pool: Pool | undefined;

if (isPglite) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "pglite: sürücüsü yalnızca geliştirme içindir; üretimde postgres:// kullanın."
    );
  }

  if (globalForDb.__cerberusDb) {
    db = globalForDb.__cerberusDb;
  } else {
    // Dinamik require: PGlite üretim paketine dahil edilmez.
    const { PGlite } = require("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite");

    const dataDir = databaseUrl.replace(/^pglite:/, "") || "./.pglite-dev";
    db = drizzlePglite(new PGlite(dataDir)) as unknown as NodePgDatabase;
    globalForDb.__cerberusDb = db;
  }
} else {
  pool =
    globalForDb.__cerberusPool ??
    new Pool({
      connectionString: databaseUrl,
      max: 3,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 8_000,
    });

  globalForDb.__cerberusPool = pool;
  db = drizzle(pool);
}

export { db, pool };
