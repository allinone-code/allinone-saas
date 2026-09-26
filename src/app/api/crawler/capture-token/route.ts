import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireUser, isDenied } from "@/lib/guards";
import { handleRouteError } from "@/lib/apiResponse";
import { crawlerCaptureTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureCaptureToken, hasCaptureToken, revealCaptureToken, rotateCaptureToken } from "@/lib/crawler/captureToken";
import { buildBookmarkletSource } from "@/lib/crawler/bookmarklet";

/**
 * GET  /api/crawler/capture-token — token var mı, ve yeni token (ilk kez)
 * POST /api/crawler/capture-token — rotasyon (eski token anında geçersiz)
 *
 * Token DÜZ METİN OLARAK SAKLANMAZ; yalnız SHA-256 hash'i tutulur. Bu
 * yüzden mevcut token yeniden gösterilemez — kullanıcı kaybederse rotasyon
 * yapmalıdır. Bu, "token'ı bir yere yazıp unutma" riskini de azaltır: kayıp
 * token yerine yeni üretilir.
 */
export async function GET() {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const user = gate.user;

    const has = await hasCaptureToken(user.email);
    if (has) {
      // Token AES-GCM ile şifreli saklanıyor, bu yüzden tekrar GÖSTERİLEBİLİR.
      // Bu kritik: ekipte herkes bookmarklet'ini kendi tarayıcısına kuracak.
      // Token geri getirilemeseydi herkes "yenile"ye basar ve birbirlerinin
      // bookmarklet'ini geçersiz kılardı.
      const revealed = await revealCaptureToken(user.email);
      if (revealed) {
        return NextResponse.json({
          hasToken: true,
          token: revealed,
          bookmarklet: buildBookmarkletSource({ token: revealed }),
          message: "Mevcut token'ınız gösteriliyor.",
        });
      }
      // Şifre çözülemedi (ör. SESSION_SECRET değişti). Yeni üretilecek.
      const fresh = await rotateCaptureToken(user.email);
      return NextResponse.json({
        hasToken: true,
        token: fresh,
        bookmarklet: buildBookmarkletSource({ token: fresh }),
        message: "Önceki token çözülemediği için yenisi oluşturuldu. Bookmarklet'lerinizi güncelleyin.",
      });
    }

    const { token } = await ensureCaptureToken(user.email);
    if (!token) {
      return NextResponse.json({ hasToken: false, token: null });
    }

    return NextResponse.json({
      hasToken: true,
      token,
      bookmarklet: buildBookmarkletSource({ token }),
      message: "Token oluşturuldu.",
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/crawler/capture-token", error);
  }
}

export async function POST() {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const user = gate.user;

    // Kullanıcının kendi token'ını silmesi/iptali de bir işlem: denetim izi.
    const existing = await db
      .select({ userEmail: crawlerCaptureTokens.userEmail })
      .from(crawlerCaptureTokens)
      .where(eq(crawlerCaptureTokens.userEmail, user.email.toLowerCase()))
      .limit(1);

    const token = await rotateCaptureToken(user.email);

    return NextResponse.json({
      hasToken: true,
      token,
      bookmarklet: buildBookmarkletSource({ token }),
      revoked: existing.length > 0,
      message: existing.length
        ? "Eski token geçersiz kılındı. Bookmarklet'lerinizi yeniden kurun."
        : "Token oluşturuldu.",
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/crawler/capture-token", error);
  }
}
