import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const isDatabaseConfigured = !!process.env.DATABASE_URL;

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

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
