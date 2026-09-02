import { NextResponse } from "next/server";
import { db } from "@/db";
import { productMasters, auditLogs, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, isDenied } from "@/lib/guards";
import { parseBody, intelligencePatchSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { scoringWalk, type DecisionAction } from "@/domain/discoveryPipeline";
import { applyHops } from "@/db/advanceStage";
import type { LifecycleStage } from "@/domain/productIntelligence";

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

    // Zod doğrulama (T3.1): karar aksiyonu enum olarak doğrulanır
    const parsed = await parseBody(req, intelligencePatchSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

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

    const scoringActions = new Set(["BUY", "TEST", "WAIT", "REJECT"]);

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(productMasters)
        .set(updatePayload)
        .where(eq(productMasters.id, Number(id)))
        .returning();

      const action = String(body.decisionAction ?? row.decisionAction);
      if (scoringActions.has(action) && row.productId) {
        const [catalog] = await tx
          .select({ lifecycleStage: products.lifecycleStage })
          .from(products)
          .where(eq(products.id, row.productId))
          .limit(1);
        if (catalog) {
          const hops = scoringWalk(
            catalog.lifecycleStage as LifecycleStage,
            action as DecisionAction,
            Number(row.roiPercent) || 0
          );
          if (hops.length > 0) {
            const walked = await applyHops(
              tx,
              row.productId,
              hops,
              currentUser.name || currentUser.email,
              { source: "decision_override", decision: action }
            );
            if ("invalid" in walked || "notFound" in walked) {
              throw new Error("Karar hattı durak geçişini uygulayamadı.");
            }
          }
        }
      }

      await tx.insert(auditLogs).values({
        actorName: currentUser.name,
        storeCode: "HRN",
        actionType: "DECISION_OVERRIDE",
        targetEntity: `${current.productCode} (${current.title.slice(0, 32)})`,
        beforeState: current.decisionAction,
        afterState: row.decisionAction,
        details: `Karar motoru aksiyonu ${current.decisionAction} -> ${row.decisionAction} olarak güncellendi.`,
      });

      return row;
    });

    return NextResponse.json({
      message: "Decision Engine aksiyonu güncellendi",
      master: updated,
    });
  } catch (error: unknown) {
    return handleRouteError("PATCH /api/intelligence/[id]", error);
  }
}
