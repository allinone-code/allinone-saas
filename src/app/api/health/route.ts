import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch (error: any) {
    // F-32: ham hata detayı istemciye sızdırılmaz, yalnızca sunucu loguna yazılır
    log.error("GET /api/health", "Veritabanı sağlık kontrolü başarısız", error);
    return NextResponse.json(
      { status: "unhealthy" },
      { status: 500 }
    );
  }
}
