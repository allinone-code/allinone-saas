import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores, auditLogs, orders } from "@/db/schema";
import { requireUser, requireRole, isDenied } from "@/lib/guards";
import { parseBody, storeCreateSchema, storeUpdateSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { desc, eq, count, sum } from "drizzle-orm";

export async function GET() {
  try {
    // Giriş yapmış herkes mağaza listesini okuyabilir; yönetim yazma işlemleri ADMIN/MANAGER ister
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;

    const allStores = await db.select().from(stores).orderBy(stores.storeCode);

    // Compute live order count and spend for each store from orders table
    const storeStats = await Promise.all(
      allStores.map(async (st) => {
        const orderSummary = await db
          .select({
            orderCount: count(),
            totalSpend: sum(orders.totalCost),
          })
          .from(orders)
          .where(eq(orders.buyerStore, st.storeCode));

        const orderCount = Number(orderSummary[0]?.orderCount || 0);
        const spend = Number(orderSummary[0]?.totalSpend || 0).toFixed(2);

        return {
          ...st,
          totalOrdersCount: orderCount,
          totalSpend: spend,
        };
      })
    );

    return NextResponse.json({ stores: storeStats });
  } catch (error: unknown) {
    return handleRouteError("admin/stores", error);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    // Zod doğrulama (T3.1)
    const parsed = await parseBody(req, storeCreateSchema);
    if ("response" in parsed) return parsed.response;
    const {
      storeCode,
      storeName,
      marketplace = "AMAZON",
      buyerName = "Harun",
      currency = "USD",
      defaultCard = "1753",
      defaultEmail = "",
      notes = "",
    } = parsed.data;

    const cleanCode = storeCode.trim().toUpperCase();

    // Check existing
    const existing = await db
      .select()
      .from(stores)
      .where(eq(stores.storeCode, cleanCode))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: `Bu mağaza kodu (${cleanCode}) zaten tanımlı.` }, { status: 400 });
    }

    const [created] = await db
      .insert(stores)
      .values({
        storeCode: cleanCode,
        storeName: storeName.trim(),
        marketplace,
        buyerName: buyerName.trim(),
        currency,
        status: "ACTIVE",
        defaultCard,
        defaultEmail,
        notes,
        totalOrdersCount: 0,
        totalSpend: "0.00",
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: currentUser.name,
      storeCode: cleanCode,
      actionType: "STORE_CREATED",
      targetEntity: `${cleanCode} - ${storeName}`,
      beforeState: "YOK",
      afterState: "ACTIVE",
      details: `Yeni mağaza tanımlandı: ${storeName} (${marketplace}). Alıcı: ${buyerName}`,
    });

    return NextResponse.json({
      message: `${cleanCode} mağazası başarıyla oluşturuldu.`,
      store: created,
    });
  } catch (error: unknown) {
    return handleRouteError("admin/stores", error);
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    // Zod doğrulama (T3.1)
    const parsed = await parseBody(req, storeUpdateSchema);
    if ("response" in parsed) return parsed.response;
    const { id, storeName, buyerName, status, defaultCard, defaultEmail, notes } = parsed.data;

    const existing = await db
      .select()
      .from(stores)
      .where(eq(stores.id, Number(id)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (storeName !== undefined) updateData.storeName = storeName;
    if (buyerName !== undefined) updateData.buyerName = buyerName;
    if (status !== undefined) updateData.status = status;
    if (defaultCard !== undefined) updateData.defaultCard = defaultCard;
    if (defaultEmail !== undefined) updateData.defaultEmail = defaultEmail;
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db
      .update(stores)
      .set(updateData)
      .where(eq(stores.id, Number(id)))
      .returning();

    await db.insert(auditLogs).values({
      actorName: currentUser.name,
      storeCode: updated.storeCode,
      actionType: "STORE_UPDATED",
      targetEntity: `${updated.storeCode} - ${updated.storeName}`,
      beforeState: existing[0].status,
      afterState: updated.status,
      details: `Mağaza güncellendi. Durum: ${updated.status}`,
    });

    return NextResponse.json({
      message: "Mağaza güncellendi",
      store: updated,
    });
  } catch (error: unknown) {
    return handleRouteError("admin/stores", error);
  }
}
