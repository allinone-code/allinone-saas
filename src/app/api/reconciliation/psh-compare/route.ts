import { NextResponse } from "next/server";
import { requireRole, isDenied } from "@/lib/guards";
import { parseBody, pshCompareSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { buildPshCompare } from "@/domain/pshCompare";

/**
 * POST /api/reconciliation/psh-compare
 *
 * Alım listesi (Sat26) ile PSH dosyasının order+ASIN karşılaştırması: eksik,
 * hasarlı, adet/fiyat farkı, iptal çelişkisi ve ayrı "Bekleniyor" grubu.
 * SALT OKUNUR: veritabanına dokunmaz, dosyaları saklamaz, veriyi düzeltmez.
 * Alım dosyası kart numarası ve e-posta içerdiği için yalnız ADMIN/MANAGER.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;

    const parsed = await parseBody(req, pshCompareSchema);
    if ("response" in parsed) return parsed.response;
    const { purchaseRows, pshRows, priceTolerancePct, pendingWindowDays } = parsed.data;

    const result = buildPshCompare(purchaseRows, pshRows, { priceTolerancePct, pendingWindowDays });
    const { purchase, psh } = result.missingHeaders;
    if (purchase.length || psh.length) {
      const parts = [
        purchase.length ? `Alım dosyası: ${purchase.join(", ")}` : "",
        psh.length ? `PSH dosyası: ${psh.join(", ")}` : "",
      ].filter(Boolean);
      return NextResponse.json(
        { error: `Zorunlu kolonlar bulunamadı. ${parts.join(" | ")}`, missingHeaders: result.missingHeaders },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleRouteError("POST /api/reconciliation/psh-compare", error);
  }
}
