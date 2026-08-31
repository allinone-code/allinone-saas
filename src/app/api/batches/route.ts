import { NextResponse } from "next/server";
import { db } from "@/db";
import { pshBatches, orders, auditLogs } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { parseBody, batchCreateSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";

export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { searchParams } = new URL(req.url);
    const storeCode = resolveStoreScope(currentUser, searchParams.get("storeCode"));

    const allBatches = storeCode && storeCode !== "ALL"
      ? await db.select().from(pshBatches).where(eq(pshBatches.storeCode, storeCode)).orderBy(desc(pshBatches.createdAt))
      : await db.select().from(pshBatches).orderBy(desc(pshBatches.createdAt));

    return NextResponse.json({ batches: allBatches });
  } catch (error: unknown) {
    return handleRouteError("GET /api/batches", error);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    // Zod doğrulama (T3.1)
    const parsed = await parseBody(req, batchCreateSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;
    const {
      batchNumber,
      title,
      orderIds = [],
      notes = "",
    } = body;

    // Mağaza kapsamı ve aktör oturumdan zorlanır (F-11, audit spoofing engeli)
    const storeCode = resolveStoreScope(currentUser, body.storeCode || "HRN");
    const actorName = currentUser.name;


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
  } catch (error: unknown) {
    return handleRouteError("POST /api/batches", error);
  }
}
