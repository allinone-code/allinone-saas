import { NextResponse } from "next/server";
import { db } from "@/db";
import { pshBatches, orders, auditLogs } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeCode = searchParams.get("storeCode");

    const allBatches = storeCode && storeCode !== "ALL"
      ? await db.select().from(pshBatches).where(eq(pshBatches.storeCode, storeCode)).orderBy(desc(pshBatches.createdAt))
      : await db.select().from(pshBatches).orderBy(desc(pshBatches.createdAt));

    return NextResponse.json({ batches: allBatches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      batchNumber,
      storeCode = "HRN",
      title,
      orderIds = [],
      notes = "",
      actorName = "Operasyon Sorumlusu",
    } = body;

    if (!batchNumber || !title) {
      return NextResponse.json({ error: "Batch no ve başlık zorunludur" }, { status: 400 });
    }

    const [created] = await db
      .insert(pshBatches)
      .values({
        batchNumber,
        storeCode,
        title,
        totalItemsCount: orderIds.length,
        notes,
      })
      .returning();

    // Assign selected orders to this batch
    if (orderIds.length > 0) {
      await db
        .update(orders)
        .set({
          pshBatchNo: batchNumber,
          pshStatus: "BATCH_OLUSTURULDU",
        })
        .where(inArray(orders.id, orderIds));
    }

    await db.insert(auditLogs).values({
      actorName,
      storeCode,
      actionType: "PSH_BATCH_CREATED",
      targetEntity: batchNumber,
      beforeState: "HAZIRLANIYOR",
      afterState: "BATCH_OLUSTURULDU",
      details: `${title} - ${orderIds.length} adet sipariş bu batch altına bağlandı.`,
    });

    return NextResponse.json({
      message: "PSH Envanter Batch başarıyla oluşturuldu",
      batch: created,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
