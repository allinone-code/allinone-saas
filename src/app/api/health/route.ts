import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json(
      { status: "unhealthy", error: error?.message || "Database unreachable" },
      { status: 500 }
    );
  }
}
