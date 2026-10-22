import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, auditLogs } from "@/db/schema";
import { requireRole, isDenied, canAccessStore } from "@/lib/guards";
import { parseBody, sat26AuditApplySchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { auditSat26Orders, type AuditOrderRow } from "@/domain/sat26Audit";

/** "ALL" (tüm mağazalar) yalnız ADMIN veya kapsamı ALL olan kullanıcıya açık; tek mağaza için canAccessStore. */
function canAuditScope(user: Parameters<typeof canAccessStore>[0], storeCode: string): boolean {
  if (storeCode === "ALL") return user.role === "ADMIN" || user.storeCode === "ALL";
  return canAccessStore(user, storeCode);
}

async function loadAuditRows(storeCode: string | null): Promise<AuditOrderRow[]> {
  const base = db.select().from(orders);
  const rows = await (storeCode && storeCode !== "ALL" ? base.where(eq(orders.buyerStore, storeCode)) : base);
  return rows.map((o) => ({
    id: o.id,
    buyerStore: o.buyerStore,
    orderNumber: o.orderNumber,
    asin: o.asin,
    msku: o.msku,
    cargoStatus: o.cargoStatus,
    quantity: Number(o.quantity),
    totalCost: Number(o.totalCost),
    refundAmount: Number(o.refundAmount),
    correctedCost: Number(o.correctedCost),
    p1CancelQty: Number(o.p1CancelQty),
    p2MissingQty: Number(o.p2MissingQty),
    p3DefectiveQty: Number(o.p3DefectiveQty),
    p4ExpiredQty: Number(o.p4ExpiredQty),
  }));
}

/**
 * GET /api/operations/sat26-audit?storeCode=HRN
 *
 * SALT OKUNUR. Mevcut siparişlerde İPTAL/P1 ve MSKU hijyen sorunlarını bulur
 * ve önerilen düzeltmeyi gösterir; veritabanına hiçbir şey yazmaz.
 * Yalnız ADMIN/MANAGER.
 */
export async function GET(req: Request) {
  try {
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;

    const storeCode = new URL(req.url).searchParams.get("storeCode") || "ALL";
    if (!canAuditScope(gate.user, storeCode)) {
      return NextResponse.json({ error: "Bu mağaza kapsamınızda değil." }, { status: 403 });
    }
    const report = auditSat26Orders(await loadAuditRows(storeCode));
    return NextResponse.json({ ...report, findings: report.findings.slice(0, 500), truncated: report.findings.length > 500 });
  } catch (error: unknown) {
    return handleRouteError("GET /api/operations/sat26-audit", error);
  }
}

/**
 * POST /api/operations/sat26-audit  { storeCode?, apply? }
 *
 * `apply` verilmezse ÖNİZLEME (GET ile aynı sonuç, yazma yok). `apply: true`
 * ise düzeltmeyi TEK transaction'da uygular:
 *  - İPTAL + P1 boş siparişlerde P1 tamamlanır, düzeltilmiş maliyet yeniden hesaplanır.
 *  - Başındaki "\n" / "<br>" olan MSKU'lar temizlenir.
 * Kalıp dışı MSKU'lara DOKUNULMAZ (elle bakılmalı). Her güncelleme, satırın
 * hâlâ denetim anındaki durumda olmasını şart koşar; arada değişmiş satır
 * atlanır ve sayılır. İşlem audit_logs'a yazılır. Yalnız ADMIN/MANAGER.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;

    const parsed = await parseBody(req, sat26AuditApplySchema);
    if ("response" in parsed) return parsed.response;
    const { storeCode, apply } = parsed.data;

    if (!canAuditScope(gate.user, storeCode)) {
      return NextResponse.json({ error: "Bu mağaza kapsamınızda değil." }, { status: 403 });
    }

    const rows = await loadAuditRows(storeCode);
    const report = auditSat26Orders(rows);
    if (!apply) {
      return NextResponse.json({ applied: false, ...report, findings: report.findings.slice(0, 500), truncated: report.findings.length > 500 });
    }

    const byId = new Map(rows.map((r) => [r.id, r]));
    let cancelFixed = 0;
    let mskuFixed = 0;
    let skippedChanged = 0;

    await db.transaction(async (tx) => {
      for (const f of report.findings) {
        const before = byId.get(f.orderId);
        if (!before || !f.proposed) continue;

        if (f.code === "CANCEL_P1_EMPTY" && f.proposed.p1CancelQty !== undefined) {
          const updated = await tx
            .update(orders)
            .set({
              p1CancelQty: f.proposed.p1CancelQty,
              // Elle girilmiş düzeltilmiş maliyet (correctedCost önerilmemiş) ezilmez.
              ...(f.proposed.correctedCost !== undefined ? { correctedCost: f.proposed.correctedCost.toFixed(2) } : {}),
              updatedAt: new Date(),
            })
            // Satır denetimden beri değiştiyse (P1 doldurulmuş / durum değişmiş) dokunma.
            .where(and(eq(orders.id, f.orderId), eq(orders.p1CancelQty, 0), eq(orders.cargoStatus, before.cargoStatus)))
            .returning({ id: orders.id });
          if (updated.length) cancelFixed++;
          else skippedChanged++;
        } else if (f.code === "MSKU_DIRTY" && f.proposed.msku) {
          const updated = await tx
            .update(orders)
            .set({ msku: f.proposed.msku, updatedAt: new Date() })
            .where(and(eq(orders.id, f.orderId), eq(orders.msku, before.msku)))
            .returning({ id: orders.id });
          if (updated.length) mskuFixed++;
          else skippedChanged++;
        }
      }

      await tx.insert(auditLogs).values({
        actorName: gate.user.name,
        storeCode,
        actionType: "SAT26_HYGIENE_FIX",
        targetEntity: `Siparişler (${storeCode})`,
        beforeState: `İPTAL/P1 boş: ${report.counts.CANCEL_P1_EMPTY}, kirli MSKU: ${report.counts.MSKU_DIRTY}`,
        afterState: `P1 tamamlanan: ${cancelFixed}, MSKU temizlenen: ${mskuFixed}, atlanan: ${skippedChanged}`,
        details: `Fazla gösterilen maliyet düzeltildi: $${report.overstatedCost}. Elle girilmiş maliyeti korunan İPTAL satır: ${report.manualCostKept}. Kalıp dışı MSKU (elle kontrol): ${report.counts.MSKU_UNKNOWN_PATTERN}.`,
      });
    });

    return NextResponse.json({
      applied: true,
      cancelFixed,
      mskuFixed,
      skippedChanged,
      overstatedCostRemoved: report.overstatedCost,
      unknownPatternForManualReview: report.counts.MSKU_UNKNOWN_PATTERN,
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/operations/sat26-audit", error);
  }
}
