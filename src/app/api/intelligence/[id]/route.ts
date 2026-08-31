import { NextResponse } from "next/server";
import { db } from "@/db";
import { productMasters, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, isDenied } from "@/lib/guards";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Karar motoru override'ı yönetici işlemidir (Approval Matrix)
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { id } = await context.params;
    const body = await req.json();

    const existing = await db
      .select()
      .from(productMasters)
      .where(eq(productMasters.id, Number(id)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Product Master bulunamadı" }, { status: 404 });
    }

    const current = existing[0];
    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.decisionAction) updatePayload.decisionAction = body.decisionAction;
    if (body.lifecycleStage) updatePayload.lifecycleStage = body.lifecycleStage;
    if (body.policyStatus) updatePayload.policyStatus = body.policyStatus;
    if (body.dataQualityStatus) updatePayload.dataQualityStatus = body.dataQualityStatus;

    if (body.sellingPrice !== undefined) {
      const selling = Number(body.sellingPrice);
      const landed = Number(current.landedCost);
      const netProfit = Number((selling - landed).toFixed(2));
      const roi = landed > 0 ? Number(((netProfit / landed) * 100).toFixed(2)) : 0;

      updatePayload.sellingPrice = selling.toFixed(2);
      updatePayload.estimatedNetProfit = netProfit.toFixed(2);
      updatePayload.roiPercent = roi.toFixed(2);

      const history = Array.isArray(current.costHistory) ? [...current.costHistory] : [];
      history.push({
        date: new Date().toISOString().split("T")[0],
        sourcePrice: Number(current.sourcePrice),
        landedCost: landed,
        sellingPrice: selling,
        roi,
      });
      updatePayload.costHistory = history;
    }

    const [updated] = await db
      .update(productMasters)
      .set(updatePayload)
      .where(eq(productMasters.id, Number(id)))
      .returning();

    await db.insert(auditLogs).values({
      actorName: currentUser.name,
      storeCode: "HRN",
      actionType: "DECISION_OVERRIDE",
      targetEntity: `${current.productCode} (${current.title.slice(0, 32)})`,
      beforeState: current.decisionAction,
      afterState: updated.decisionAction,
      details: `Karar motoru aksiyonu ${current.decisionAction} -> ${updated.decisionAction} olarak güncellendi.`,
    });

    return NextResponse.json({
      message: "Decision Engine aksiyonu güncellendi",
      master: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
