import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, auditLogs } from "@/db/schema";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { parseBody, importXlsSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    // Zod doğrulama (T3.1) + 15 MB gövde üst sınırı (T3.4, toplu import hacmi için)
    const parsed = await parseBody(req, importXlsSchema, 15 * 1024 * 1024);
    if ("response" in parsed) return parsed.response;
    // Şema satır "varlığını/boyutunu" kilitler; alan tipleri aşağıda
    // String()/Number() ile normalize edildiği için satırı any gevşekliğinde okuruz
    const { rows, defaultStore = "HRN" } = parsed.data as {
      rows: Record<string, any>[];
      defaultStore?: string;
    };

    // Mağaza kapsamı ve aktör oturumdan zorlanır (F-11, audit spoofing engeli)
    const scopedStore = resolveStoreScope(currentUser, defaultStore);
    const actorName = currentUser.name;

    // T2.7: Coklu INSERT tek transaction'da — kismi hata butun importu geri alir
    const insertedOrders = await db.transaction(async (tx) => {
      const accumulator: (typeof orders.$inferSelect)[] = [];

      for (const r of rows) {
      const buyerStore = scopedStore !== "ALL" ? (r.buyerStore || scopedStore) : (r.buyerStore || "HRN");
      // STORE_USER her satırı kendi mağazasına kilitler
      const effectiveRowStore =
        currentUser.role === "STORE_USER" && currentUser.storeCode !== "ALL"
          ? currentUser.storeCode
          : buyerStore;
      const unitCost = String(r.unitCost || "0").replace(",", ".");
      const sellingPrice = String(r.sellingPrice || "0").replace(",", ".");
      const totalCost = String(r.totalCost || "0").replace(",", ".");
      const correctedCost = String(r.correctedCost || totalCost).replace(",", ".");
      const refundAmount = String(r.refundAmount || "0").replace(",", ".");

        const [inserted] = await tx
          .insert(orders)
        .values({
          buyerStore: effectiveRowStore,
          orderDate: r.orderDate || new Date().toISOString().split("T")[0],
          imageUrl: r.imageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80",
          fulfillmentType: r.fulfillmentType || "FBA",
          productTitle: r.productTitle || "Amazon Ürünü",
          asin: (r.asin || "").trim().toUpperCase(),
          msku: (r.msku || "").trim() || `${buyerStore}-${r.asin}`,
          supplierName: r.supplierName || "THE VITAMINSHOPPE",
          supplierCode: r.supplierCode || "A198",
          supplierUrl: r.supplierUrl || "",
          amazonUrl: r.amazonUrl || `https://www.amazon.com/dp/${r.asin}`,
          orderNumber: (r.orderNumber || "").trim(),
          driveLink: r.driveLink || "",
          packCount: Number(r.packCount) || 1,
          quantity: Number(r.quantity) || 1,
          unitCost: Number(unitCost).toFixed(2),
          sellingPrice: Number(sellingPrice).toFixed(2),
          totalCost: Number(totalCost).toFixed(2),
          orderEmail: r.orderEmail || "",
          cargoStatus: r.cargoStatus || "Tam Geldi",
          shippedToAmazon: Number(r.shippedToAmazon) || 0,
          p1CancelQty: Number(r.p1CancelQty) || 0,
          p2MissingQty: Number(r.p2MissingQty) || 0,
          p3DefectiveQty: Number(r.p3DefectiveQty) || 0,
          p4ExpiredQty: Number(r.p4ExpiredQty) || 0,
          problemAction: r.problemAction || "",
          problemResult: r.problemResult || "",
          refundAmount: Number(refundAmount).toFixed(2),
          creditCard: r.creditCard || "1753",
          isFragile: r.isFragile || "NO",
          isMultiPack: r.isMultiPack || "NO",
          isBundle: r.isBundle || "NO",
          countPerBundle: Number(r.countPerBundle) || null,
          condition: r.condition || "New",
          brandName: r.brandName || "General",
          description1: r.description1 || "",
          description2: r.description2 || "",
          auditNote: r.auditNote || "",
          periodCode: r.periodCode || "O26",
          correctedCost: Number(correctedCost).toFixed(2),
          pshBatchNo: r.pshBatchNo || "PSH-BATCH-2026-02",
          pshStatus: r.pshStatus || "BEKLIYOR",
          inventoryLabStatus: r.inventoryLabStatus || "GIRILMEDI",
        })
        .returning();

        accumulator.push(inserted);
      }

      return accumulator;
    });

    await writeAuditLog({
      actorName,
      storeCode: scopedStore === "ALL" ? "HRN" : scopedStore,
      actionType: "XLS_BATCH_IMPORT",
      targetEntity: `Google Drive XLS (${insertedOrders.length} Sipariş)`,
      beforeState: "EXCEL_TABLOSU",
      afterState: "CERBERUS_VERITABANI",
      details: `${insertedOrders.length} satır sipariş başarıyla aktarıldı.`,
    });

    return NextResponse.json({
      message: `${insertedOrders.length} adet sipariş başarıyla veritabanına aktarıldı.`,
      importedCount: insertedOrders.length,
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/orders/import-xls", error);
  }
}
