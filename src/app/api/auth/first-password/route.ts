import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createAuthVersion,
  createSessionToken,
  isSessionRole,
} from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { isPlaceholderPasswordHash } from "@/setup/neonSetupPassword";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseBody, firstPasswordSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { log } from "@/lib/logger";

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * İlk kurulum parolası rotasyonu (public, rate-limited).
 *
 * Neon tek dosyalık kurulum / seed, başlangıç hesaplarına depoda yayınlanmış
 * bilinen bir parola yazar. Bu uç, o parolayı BİLEN kişinin (kurulumu yapan
 * ekip) ilk girişte kalıcı parolaya geçmesini sağlar:
 *
 * - Hesap yer tutucu hash TAŞIMIYORSA → 404 (uç o hesap için kapalıdır).
 * - Mevcut parola yanlışsa → hesap varlığı sızdırılmadan 401.
 * - Başarıda yeni hash yazılır + oturum açılır + audit kaydı düşülür.
 *
 * Brute-force koruması: IP+hesap 5/15dk, IP geneli 20/15dk.
 */
export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, firstPasswordSchema);
    if ("response" in parsed) return parsed.response;
    const { email, currentPassword, newPassword } = parsed.data;

    const ip = getClientIp(req);
    const accountLimit = checkRateLimit(`firstpw:${ip}:${email}`, 5, 15 * 60_000);
    const ipLimit = checkRateLimit(`firstpw-ip:${ip}`, 20, 15 * 60_000);
    if (!accountLimit.allowed || !ipLimit.allowed) {
      return NextResponse.json(
        { error: "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(accountLimit.retryAfterSec, ipLimit.retryAfterSec)),
          },
        }
      );
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // Hesap sayımını engelle: yoksa da, yer tutucu değilse de aynı yanıt.
    if (!user || !isPlaceholderPasswordHash(user.passwordHash)) {
      return NextResponse.json(
        { error: "Bu hesap için ilk parola belirleme hakkı bulunamadı." },
        { status: 404 }
      );
    }
    if (!isSessionRole(user.role)) {
      log.error("auth/first-password", "Desteklenmeyen rol", { userId: user.id });
      return NextResponse.json(
        { error: "Bu hesap için ilk parola belirleme hakkı bulunamadı." },
        { status: 404 }
      );
    }

    const verification = await verifyPassword(currentPassword, user.passwordHash);
    if (!verification.ok) {
      return NextResponse.json({ error: "Kurulum parolası hatalı." }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    await db.insert(auditLogs).values({
      actorName: user.name,
      storeCode: user.storeCode,
      actionType: "PASSWORD_INITIALIZED",
      targetEntity: user.email,
      beforeState: "KURULUM_PAROLASI",
      afterState: "KALICI_PAROLA",
      details: "Kurulum parolası ilk girişte kalıcı parolayla değiştirildi.",
    });

    const token = await createSessionToken(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeCode: user.storeCode || "HRN",
        avatar: user.avatar,
      },
      await createAuthVersion(newHash)
    );
    if (!token) {
      return NextResponse.json(
        { error: "Oturum altyapısı yapılandırılamadı (SESSION_SECRET). Yöneticiyle iletişime geçin." },
        { status: 500 }
      );
    }

    log.info("auth/first-password", "İlk parola belirlendi", { userId: user.id });
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeCode: user.storeCode || "HRN",
        avatar: user.avatar,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
    return res;
  } catch (error: unknown) {
    return handleRouteError("POST /api/auth/first-password", error);
  }
}
