import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureDemoData, hashPassword } from "@/lib/data";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

export async function POST(request: Request) {
  await ensureDemoData();
  const body = await request.json().catch(() => ({}));
  if (typeof body.email !== "string" || typeof body.password !== "string") return Response.json({ ok: false }, { status: 400 });
  const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
  if (!user || user.passwordHash !== hashPassword(body.password) || !user.active) return Response.json({ ok: false }, { status: 401 });
  const store = await cookies();
  store.set("cerberus_session", `${user.id}.${randomBytes(24).toString("hex")}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12, path: "/" });
  return Response.json({ ok: true, user: { name: user.name, role: user.role } });
}
