import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { log } from "@/lib/logger";

/**
 * T6.3 — Derin sağlık kontrolü (readiness): uptime sistemleri /api/health'i,
 * gerçek "trafiğe hazır mı?" kontrolünü bu ucu çağırır.
 * Yapılandırma bozuksa 503 döner; hata detayları yalnız sunucu logunda.
 */
export async function GET() {
  const checks: Record<string, boolean> = {
    database: false,
    sessionSecretConfigured:
      !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32,
  };

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch (error) {
    log.error("GET /api/health/ready", "Readiness DB kontrolü başarısız", error);
  }

  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { ready, checks, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503 }
  );
}
