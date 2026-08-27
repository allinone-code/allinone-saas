import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stores, pshBatches, auditLogs, users } from "@/db/schema";
import { ensureCerberusSeeded } from "@/db/seed";
import { desc, eq, and, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await ensureCerberusSeeded();

    const { searchParams } = new URL(req.url);
    const storeCode = searchParams.get("storeCode") || "ALL";
    const cargoStatus = searchParams.get("cargoStatus");
    const pshBatchNo = searchParams.get("pshBatchNo");
    const search = searchParams.get("search");

    let query = db.select().from(orders);

    const conditions = [];
    if (storeCode && storeCode !== "ALL") {
      conditions.push(eq(orders.buyerStore, storeCode));
    }
    if (cargoStatus && cargoStatus !== "ALL") {
      conditions.push(eq(orders.cargoStatus, cargoStatus));
    }
    if (pshBatchNo && pshBatchNo !== "ALL") {
      conditions.push(eq(orders.pshBatchNo, pshBatchNo));
    }

    const allOrders = conditions.length > 0
      ? await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.orderDate), desc(orders.id))
      : await db.select().from(orders).orderBy(desc(orders.orderDate), desc(orders.id));

    const [allStores, allBatches, allAuditLogs, allUsers] = await Promise.all([
      db.select().from(stores).orderBy(stores.storeCode),
      db.select().from(pshBatches).orderBy(desc(pshBatches.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(30),
      db.select().from(users),
    ]);

    // Calculate aggregated operational KPIs for current view
    const totalOrdersCount = allOrders.length;
    const totalUnits = allOrders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
    const totalSpend = allOrders.reduce((sum, o) => sum + Number(o.totalCost || 0), 0);
    const totalShippedToAmazon = allOrders.reduce((sum, o) => sum + Number(o.shippedToAmazon || 0), 0);

    // Problem / Discrepancy counts
    const p1CancelTotal = allOrders.reduce((sum, o) => sum + Number(o.p1CancelQty || 0), 0);
    const p2MissingTotal = allOrders.reduce((sum, o) => sum + Number(o.p2MissingQty || 0), 0);
    const p3DefectiveTotal = allOrders.reduce((sum, o) => sum + Number(o.p3DefectiveQty || 0), 0);
    const p4ExpiredTotal = allOrders.reduce((sum, o) => sum + Number(o.p4ExpiredQty || 0), 0);
    const totalRefunds = allOrders.reduce((sum, o) => sum + Number(o.refundAmount || 0), 0);

    const problemOrdersCount = allOrders.filter(
      (o) =>
        o.cargoStatus === "İPTAL" ||
        Number(o.p1CancelQty) > 0 ||
        Number(o.p2MissingQty) > 0 ||
        Number(o.p3DefectiveQty) > 0 ||
        Number(o.p4ExpiredQty) > 0 ||
        Number(o.refundAmount) > 0
    ).length;

    return NextResponse.json({
      orders: allOrders,
      stores: allStores,
      batches: allBatches,
      auditLogs: allAuditLogs,
      users: allUsers,
      kpis: {
        totalOrdersCount,
        totalUnits,
        totalSpend: totalSpend.toFixed(2),
        totalShippedToAmazon,
        problemOrdersCount,
        p1CancelTotal,
        p2MissingTotal,
        p3DefectiveTotal,
        p4ExpiredTotal,
        totalRefunds: totalRefunds.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      buyerStore = "HRN",
      orderDate = new Date().toISOString().split("T")[0],
      imageUrl = "",
      fulfillmentType = "FBA",
      productTitle,
      asin,
      msku,
      supplierName = "THE VITAMINSHOPPE",
      supplierCode = "A198",
      supplierUrl = "",
      amazonUrl = "",
      orderNumber,
      driveLink = "",
      packCount = 1,
      quantity = 1,
      unitCost = 0,
      sellingPrice = 0,
      totalCost = 0,
      orderEmail = "cerberusnisan@gmail.com",
      cargoStatus = "Tam Geldi",
      shippedToAmazon = 0,
      p1CancelQty = 0,
      p2MissingQty = 0,
      p3DefectiveQty = 0,
      p4ExpiredQty = 0,
      problemAction = "",
      problemResult = "",
      refundAmount = 0,
      creditCard = "1753",
      isFragile = "NO",
      isMultiPack = "NO",
      isBundle = "NO",
      condition = "New",
      brandName = "General",
      description1 = "",
      description2 = "",
      auditNote = "",
      periodCode = "Ş26",
      correctedCost = 0,
      pshBatchNo = "PSH-BATCH-2026-02",
      pshStatus = "BEKLIYOR",
      inventoryLabStatus = "GIRILMEDI",
      actorName = "Store Specialist",
    } = body;

    if (!productTitle || !asin || !orderNumber) {
      return NextResponse.json(
        { error: "Ürün adı, ASIN ve Sipariş No zorunludur" },
        { status: 400 }
      );
    }

    const calculatedTotal = Number(totalCost) || Number(unitCost) * Number(quantity);
    const calculatedCorrected = Number(correctedCost) || calculatedTotal;

    const [inserted] = await db
      .insert(orders)
      .values({
        buyerStore,
        orderDate,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80",
        fulfillmentType,
        productTitle,
        asin: asin.trim().toUpperCase(),
        msku: msku ? msku.trim() : `${buyerStore}-${asin.trim()}`,
        supplierName,
        supplierCode,
        supplierUrl: supplierUrl || `https://www.vitaminshoppe.com/search?q=${encodeURIComponent(productTitle)}`,
        amazonUrl: amazonUrl || `https://www.amazon.com/dp/${asin.trim()}`,
        orderNumber: orderNumber.trim(),
        driveLink,
        packCount: Number(packCount) || 1,
        quantity: Number(quantity) || 1,
        unitCost: Number(unitCost).toFixed(2),
        sellingPrice: Number(sellingPrice).toFixed(2),
        totalCost: calculatedTotal.toFixed(2),
        orderEmail,
        cargoStatus,
        shippedToAmazon: Number(shippedToAmazon) || 0,
        p1CancelQty: Number(p1CancelQty) || 0,
        p2MissingQty: Number(p2MissingQty) || 0,
        p3DefectiveQty: Number(p3DefectiveQty) || 0,
        p4ExpiredQty: Number(p4ExpiredQty) || 0,
        problemAction,
        problemResult,
        refundAmount: Number(refundAmount).toFixed(2),
        creditCard,
        isFragile,
        isMultiPack,
        isBundle,
        condition,
        brandName,
        description1,
        description2,
        auditNote,
        periodCode,
        correctedCost: calculatedCorrected.toFixed(2),
        pshBatchNo,
        pshStatus,
        inventoryLabStatus,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorName,
      storeCode: buyerStore,
      actionType: "ORDER_CREATED",
      targetEntity: `${orderNumber} - ${productTitle.slice(0, 32)}`,
      beforeState: "YENI_GIRIS",
      afterState: cargoStatus,
      details: `${buyerStore} mağazasına ${quantity} adet (${unitCost}$) sipariş girildi.`,
    });

    return NextResponse.json({
      message: "Sipariş Google Drive XLS veritabanına başarıyla kaydedildi.",
      order: inserted,
    });
  } catch (error: any) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
