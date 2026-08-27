import { NextResponse } from "next/server";
import { db } from "@/db";
import { productDiscoveries, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const existing = await db
      .select()
      .from(productDiscoveries)
      .where(eq(productDiscoveries.id, Number(id)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Product discovery not found" },
        { status: 404 }
      );
    }

    const current = existing[0];
    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.lifecycleStage) {
      updatePayload.lifecycleStage = body.lifecycleStage;
    }
    if (body.sellingPrice !== undefined) {
      const selling = Number(body.sellingPrice);
      const landed = Number(current.landedCost);
      const netProfit = Number((selling - landed).toFixed(2));
      const roi = landed > 0 ? Number(((netProfit / landed) * 100).toFixed(2)) : 0;

      updatePayload.sellingPrice = selling.toFixed(2);
      updatePayload.estimatedNetProfit = netProfit.toFixed(2);
      updatePayload.roiPercent = roi.toFixed(2);

      const history = Array.isArray(current.costHistory)
        ? [...current.costHistory]
        : [];
      history.push({
        date: new Date().toISOString().split("T")[0],
        sourcePrice: Number(current.sourcePrice),
        landedCost: landed,
        sellingPrice: selling,
        roi,
      });
      updatePayload.costHistory = history;
    }

    if (body.channelListings) {
      updatePayload.channelListings = body.channelListings;
    }

    const [updated] = await db
      .update(productDiscoveries)
      .set(updatePayload)
      .where(eq(productDiscoveries.id, Number(id)))
      .returning();

    if (body.lifecycleStage && body.lifecycleStage !== current.lifecycleStage) {
      await db.insert(auditLogs).values({
        actorName: body.actorName || "Ahmet Erdem (VP Operations)",
        actorRole: body.actorRole || "MANAGER",
        actionType: "STAGE_TRANSITION",
        targetEntity: `${current.productCode} (${current.title.slice(0, 32)}...)`,
        beforeState: current.lifecycleStage,
        afterState: body.lifecycleStage,
        details: `Stage shifted from ${current.lifecycleStage} to ${body.lifecycleStage}. Current ROI: ${current.roiPercent}%`,
      });
    }

    return NextResponse.json({
      message: "Discovery updated",
      discovery: updated,
    });
  } catch (error: any) {
    console.error("PATCH /api/cerberus/discoveries/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update discovery" },
      { status: 500 }
    );
  }
}
