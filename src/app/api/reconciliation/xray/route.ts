import { NextResponse } from "next/server";
import { requireRole, isDenied } from "@/lib/guards";
import { parseBody, xraySchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { buildXray } from "@/domain/sat26Xray";

/**
 * POST /api/reconciliation/xray
 *
 * Alım listesinin (Sat26) röntgeni: özet kartları, ASIN/order/MSKU/kart/ay
 * kırılımları ve hata listesi. SALT OKUNUR: veritabanına dokunmaz, dosyayı
 * saklamaz, veriyi düzeltmez. Dosya kart numarası ve e-posta içerdiği için
 * yalnız ADMIN/MANAGER.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;

    const parsed = await parseBody(req, xraySchema);
    if ("response" in parsed) return parsed.response;
    const { rows, priceDeviationPct } = parsed.data;

    const result = buildXray(rows, { priceDeviationPct });
    if (result.missingHeaders.length) {
      return NextResponse.json(
        { error: `Zorunlu kolonlar bulunamadı: ${result.missingHeaders.join(", ")}`, missingHeaders: result.missingHeaders },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleRouteError("POST /api/reconciliation/xray", error);
  }
}
