import { NextResponse } from "next/server";
import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { parseBody, reconciliationSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import {
  aggregateSalesByAsin,
  compareAmazonReceipts,
  compareInventoryLab,
  normalizeAmazonReceiptRows,
  normalizeInventoryLabRows,
  type SalesOrderFact,
} from "@/domain/salesReconciliation";

/**
 * POST /api/reconciliation/compare
 *
 * Satış listesini (orders) yüklenen dış rapor satırlarıyla ASIN bazında
 * karşılaştırır. SALT OKUNUR: hiçbir sipariş/envanter kaydı değişmez, yüklenen
 * dosya saklanmaz. STORE_USER yalnız kendi mağazasını karşılaştırır.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;

    const parsed = await parseBody(req, reconciliationSchema);
    if ("response" in parsed) return parsed.response;
    const { kind, from, to, rows, tolerance } = parsed.data;
    const storeCode = resolveStoreScope(gate.user, parsed.data.storeCode);

    const conditions: SQL[] = [];
    if (storeCode !== "ALL") conditions.push(eq(orders.buyerStore, storeCode));
    if (from) conditions.push(gte(orders.orderDate, from));
    if (to) conditions.push(lte(orders.orderDate, to));
    const base = db.select().from(orders);
    const orderRows = await (conditions.length ? base.where(and(...conditions)) : base);

    const facts: SalesOrderFact[] = orderRows.map((o) => ({
      asin: o.asin,
      orderNumber: o.orderNumber,
      quantity: Number(o.quantity),
      p1CancelQty: Number(o.p1CancelQty),
      p2MissingQty: Number(o.p2MissingQty),
      p3DefectiveQty: Number(o.p3DefectiveQty),
      p4ExpiredQty: Number(o.p4ExpiredQty),
      totalCost: Number(o.totalCost),
      sellingPrice: Number(o.sellingPrice),
      productTitle: o.productTitle,
    }));
    const sales = aggregateSalesByAsin(facts);

    if (kind === "AMAZON_RECEIPTS") {
      const receipts = normalizeAmazonReceiptRows(rows);
      if (!receipts.length) {
        return NextResponse.json(
          { error: "Dosyada ASIN kolonu veya geçerli satır bulunamadı. Amazon 'Inventory Receipts' raporunu yükleyin (ASIN, Quantity, Event Type)." },
          { status: 422 }
        );
      }
      return NextResponse.json({ kind, storeCode, salesOrders: orderRows.length, ...compareAmazonReceipts(sales, receipts) });
    }

    const ilab = normalizeInventoryLabRows(rows);
    if (!ilab.length) {
      return NextResponse.json(
        { error: "Dosyada ASIN kolonu veya geçerli satır bulunamadı. Inventory Lab ASIN raporunu yükleyin (ASIN, Orders, Revenue, On Hand, Cost/Unit)." },
        { status: 422 }
      );
    }
    return NextResponse.json({ kind, storeCode, salesOrders: orderRows.length, ...compareInventoryLab(sales, ilab, tolerance) });
  } catch (error: unknown) {
    return handleRouteError("POST /api/reconciliation/compare", error);
  }
}
