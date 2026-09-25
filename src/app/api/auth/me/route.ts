import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, isDenied } from "@/lib/guards";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { parseBody, passwordChangeSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { log } from "@/lib/logger";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user });
}

/**
 * Oturum açmış kullanıcının kendi parolasını değiştirmesi.
 *
 * Mevcut parola doğrulanmadan değişiklik yapılmaz. Hash değiştiği anda
 * authVersion fingerprrint'i de değişir; varsa diğer cihazlardaki eski
 * oturumlar bir sonraki API çağrısında 401 olur (canlı doğrulama).
 */
export async function PATCH(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;

    const parsed = await parseBody(req, passwordChangeSchema);
    if ("response" in parsed) return parsed.response;

    const [live] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, gate.user.id))
      .limit(1);
    if (!live) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    const verification = await verifyPassword(parsed.data.currentPassword, live.passwordHash);
    if (!verification.ok) {
      return NextResponse.json({ error: "Mevcut parola hatalı." }, { status: 401 });
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
      .where(eq(users.id, gate.user.id));

    await db.insert(auditLogs).values({
      actorName: gate.user.name,
      storeCode: gate.user.storeCode,
      actionType: "PASSWORD_CHANGED_SELF",
      targetEntity: gate.user.email,
      beforeState: "PAROLA_MEVCUT",
      afterState: "PAROLA_DEGISTI",
      details: "Kullanıcı kendi parolasını değiştirdi.",
    });

    log.info("auth/password-change", "Kullanıcı parolasını değiştirdi", {
      userId: gate.user.id,
    });
    return NextResponse.json({ message: "Parolanız güncellendi." });
  } catch (error: unknown) {
    return handleRouteError("PATCH /api/auth/me", error);
  }
}
