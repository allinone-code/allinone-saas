import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Serverless-friendly global pool cache (works on Vercel, Neon, local dev)
const globalForDb = globalThis as typeof globalThis & {
  __cerberusPool?: Pool;
};

export const pool =
  globalForDb.__cerberusPool ??
  new Pool({
    connectionString: databaseUrl,
    // Neon free tier has strict connection limits; keep pool small
    max: 3,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

// Cache in both dev and production so serverless invocations reuse the pool
globalForDb.__cerberusPool = pool;

export const db = drizzle(pool);
