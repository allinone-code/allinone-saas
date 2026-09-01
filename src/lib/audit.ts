import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * T8.4 / T6.5 geçişi — denetim kaydı tek yazım noktası.
 *
 * AUDIT_DATABASE_URL tanımlıysa audit_logs kayıtları kısıtlı `cerberus_audit`
 * rolüyle (INSERT-only, UPDATE/DELETE/TRUNCATE REVOKE) yazılır.
 * Tanımlı değilse birincil bağlantıya düşer (mevcut davranış; SQL tarafı
 * docs/operations/sql/audit-append-only.sql henüz uygulanmadıysa geçiş yumuşaktır).
 *
 * Okumalar bilinçli olarak birincil bağlantıda kalır (rol SELECT'e sahip olsa da
 * listeleme sıklığı yüksek; ayrım yalnızca yazım yolundadır).
 */
export type AuditEntry = typeof auditLogs.$inferInsert;

const globalForAudit = globalThis as typeof globalThis & {
  __cerberusAuditDb?: typeof db;
};

function getAuditWriter(): typeof db {
  const url = process.env.AUDIT_DATABASE_URL;
  if (!url) return db;
  if (!globalForAudit.__cerberusAuditDb) {
    const pool = new Pool({
      connectionString: url,
      max: 2,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 8_000,
    });
    globalForAudit.__cerberusAuditDb = drizzle(pool);
  }
  return globalForAudit.__cerberusAuditDb;
}

export function isAuditSegmentationActive(): boolean {
  return !!process.env.AUDIT_DATABASE_URL;
}

/**
 * Denetim kaydı yazar. Hata davranışı mevcut rotalarla aynıdır: başarısızlık
 * çağırana fırlatılır (append-only bütünlüğü ticari işlemden önce gelir).
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await getAuditWriter().insert(auditLogs).values(entry);
}
