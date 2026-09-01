import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requireRole, isDenied, canAccessStore } from "@/lib/guards";
import { parseBody, orderUpdateSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { id } = await context.params;

    // Zod doğrulama (T3.1): yalnızca izinli alanlar, strict mod
    const parsed = await parseBody(req, orderUpdateSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const existing = await db
      .select()
      .from(orders)
      .where(eq(orders.id, Number(id)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    // Mağaza izolasyonu: STORE_USER yalnızca kendi mağazasının siparişini düzenleyebilir
    if (!canAccessStore(currentUser, existing[0].buyerStore)) {
      return NextResponse.json(
        { error: "Bu sipariş sizin mağaza kapsamınızda değil." },
        { status: 403 }
      );
    }

    const current = existing[0];
    // Strict şema, alan listesinin kendisidir (T3.1): alan beyaz listesi tek yerde
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) updatePayload[key] = value;
    }

    const [updated] = await db
      .update(orders)
      .set(updatePayload)
      .where(eq(orders.id, Number(id)))
      .returning();

    // Log action if significant change
    if (body.cargoStatus || body.pshStatus || body.problemAction) {
      await db.insert(auditLogs).values({
        actorName: currentUser.name,
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
  } catch (error: unknown) {
    return handleRouteError("PATCH /api/orders/[id]", error);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Satır silme yıkıcıdır: yalnızca ADMIN/MANAGER (önceden herkese açıktı — F-02)
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;

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
  } catch (error: unknown) {
    return handleRouteError("DELETE /api/orders/[id]", error);
  }
}
