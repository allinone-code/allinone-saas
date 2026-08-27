import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, auditLogs } from "@/db/schema";
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
      .from(orders)
      .where(eq(orders.id, Number(id)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    const current = existing[0];
    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Update allowed fields
    const fields = [
      "cargoStatus",
      "shippedToAmazon",
      "p1CancelQty",
      "p2MissingQty",
      "p3DefectiveQty",
      "p4ExpiredQty",
      "problemAction",
      "problemResult",
      "refundAmount",
      "pshBatchNo",
      "pshStatus",
      "inventoryLabStatus",
      "description1",
      "description2",
      "auditNote",
      "driveLink",
      "sellingPrice",
      "unitCost",
      "quantity",
      "totalCost",
      "correctedCost",
    ];

    for (const f of fields) {
      if (body[f] !== undefined) {
        updatePayload[f] = body[f];
      }
    }

    const [updated] = await db
      .update(orders)
      .set(updatePayload)
      .where(eq(orders.id, Number(id)))
      .returning();

    // Log action if significant change
    if (body.cargoStatus || body.pshStatus || body.problemAction) {
      await db.insert(auditLogs).values({
        actorName: body.actorName || "Operasyon Sorumlusu",
        storeCode: current.buyerStore,
        actionType: "ORDER_UPDATED",
        targetEntity: `${current.orderNumber} - ${current.productTitle.slice(0, 28)}`,
        beforeState: current.cargoStatus,
        afterState: updated.cargoStatus,
        details: body.problemAction || `Kargo: ${updated.cargoStatus}, PSH: ${updated.pshStatus}`,
      });
    }

    return NextResponse.json({
      message: "Sipariş güncellendi",
      order: updated,
    });
  } catch (error: any) {
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await db
      .select()
      .from(orders)
      .where(eq(orders.id, Number(id)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    await db.delete(orders).where(eq(orders.id, Number(id)));

    return NextResponse.json({
      message: "Sipariş silindi",
      deletedId: id,
    });
  } catch (error: any) {
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete order" },
      { status: 500 }
    );
  }
}
