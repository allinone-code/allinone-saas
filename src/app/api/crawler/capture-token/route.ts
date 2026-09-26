import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireUser, isDenied } from "@/lib/guards";
import { handleRouteError } from "@/lib/apiResponse";
import { crawlerCaptureTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureCaptureToken, hasCaptureToken, rotateCaptureToken } from "@/lib/crawler/captureToken";
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
      return NextResponse.json({
        hasToken: true,
        // Mevcut token geri getirilemez (hash'li saklanıyor). UI buna göre
        // "rotasyonla yeniden al" der.
        token: null,
        message: "Token aktif. Metni kaybettiyseniz yenileyebilirsiniz.",
      });
    }

    const { token, created } = await ensureCaptureToken(user.email);
    if (!created || !token) {
      return NextResponse.json({ hasToken: true, token: null });
    }

    return NextResponse.json({
      hasToken: true,
      token,
      // Kullanıcı bu değeri bookmarklet'e gömer.
      bookmarklet: buildBookmarkletSource({ token }),
      message: "Token oluşturuldu. Bu metni bir yere kaydedin — tekrar gösterilemez.",
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
