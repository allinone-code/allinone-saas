/**
 * Yerel geliştirme veritabanını (PGlite) sıfırdan kurar: migration + seed.
 *
 * Postgres ikilisi kurulamayan ortamlarda önizlemeyi ayağa kaldırmak için.
 * Üretimde kullanılmaz; `pglite:` şeması yalnızca geliştirmede kabul edilir.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

async function main() {
  const dataDir = process.env.PGLITE_DIR ?? "./.pglite-dev";
  const db = drizzle(new PGlite(dataDir));
  await migrate(db, { migrationsFolder: "./drizzle" });
  process.stderr.write("MIGRATIONS_OK\n");
}

void main();
