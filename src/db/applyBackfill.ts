/**
 * Ürün geri doldurmanın VERİTABANINA YAZMA katmanı.
 *
 * `src/domain/productBackfill.ts` saf hesaplamayı yapar (test edilebilir);
 * burası o sonucu tek transaction içinde kalıcı hale getirir.
 *
 * Ayrı bir modül olmasının sebebi: hem `scripts/backfill-products.ts` hem de
 * `scripts/bootstrap-db.ts` aynı mantığa ihtiyaç duyuyor. Kopyalanırsa ikisi
 * zamanla birbirinden ayrışır ve "hangi yol doğru yazıyor?" sorusu doğar.
 */
import { eq, inArray, isNull, sql } from "drizzle-orm";
import {
  orders,
  products,
  supplierOffers,
  productLifecycleEvents,
  auditLogs,
} from "./schema";
import { backfillProductsFromOrders } from "@/domain/productBackfill";

export interface ApplyBackfillSummary {
  inputRows: number;
  productsCreated: number;
  productsUpdated: number;
  offersInserted: number;
  ordersLinked: number;
  unlinkedRemaining: number;
  warnings: string[];
}

/** Siparişleri okur, ürün kataloğunu türetir ve yazar. İdempotenttir. */
export async function applyProductBackfill(
  db: any,
  options: { writeAuditLog?: boolean } = {}
): Promise<ApplyBackfillSummary> {
  const orderRows = await db
    .select({
      id: orders.id,
      asin: orders.asin,
      productTitle: orders.productTitle,
      brandName: orders.brandName,
      imageUrl: orders.imageUrl,
      amazonUrl: orders.amazonUrl,
      supplierName: orders.supplierName,
      supplierCode: orders.supplierCode,
      supplierUrl: orders.supplierUrl,
      unitCost: orders.unitCost,
      packCount: orders.packCount,
      isFragile: orders.isFragile,
      isMultiPack: orders.isMultiPack,
      isBundle: orders.isBundle,
      countPerBundle: orders.countPerBundle,
      orderDate: orders.orderDate,
      pshStatus: orders.pshStatus,
      inventoryLabStatus: orders.inventoryLabStatus,
      shippedToAmazon: orders.shippedToAmazon,
    })
    .from(orders);

  if (orderRows.length === 0) {
    return {
      inputRows: 0,
      productsCreated: 0,
      productsUpdated: 0,
      offersInserted: 0,
      ordersLinked: 0,
      unlinkedRemaining: 0,
      warnings: [],
    };
  }

  const result = backfillProductsFromOrders(orderRows);

  // Tek transaction: kısmi hata her şeyi geri alır.
  const written = await db.transaction(async (tx: any) => {
    let productsCreated = 0;
    let productsUpdated = 0;
    let offersInserted = 0;
    let ordersLinked = 0;

    const asinToId = new Map<string, number>();

    for (const p of result.products) {
      const [saved] = await tx
        .insert(products)
        .values({
          asin: p.asin,
          title: p.title,
          brand: p.brand,
          category: p.category,
          imageUrl: p.imageUrl,
          amazonUrl: p.amazonUrl,
          isFragile: p.isFragile,
          isMultiPack: p.isMultiPack,
          isBundle: p.isBundle,
          countPerBundle: p.countPerBundle,
          packCount: p.packCount,
          lifecycleStage: p.lifecycleStage,
          discoveredAt: p.discoveredAt,
        })
        .onConflictDoUpdate({
          target: products.asin,
          set: {
            title: p.title,
            brand: p.brand,
            lifecycleStage: p.lifecycleStage,
            updatedAt: new Date(),
          },
        })
        .returning();

      asinToId.set(p.asin, saved.id);
      if (saved.createdAt.getTime() === saved.updatedAt.getTime()) productsCreated++;
      else productsUpdated++;

      const [existingEvent] = await tx
        .select({ id: productLifecycleEvents.id })
        .from(productLifecycleEvents)
        .where(eq(productLifecycleEvents.productId, saved.id))
        .limit(1);

      if (!existingEvent) {
        await tx.insert(productLifecycleEvents).values({
          productId: saved.id,
          fromStage: null,
          toStage: p.lifecycleStage,
          actorName: "SYSTEM",
          reason: "Mevcut sipariş kayıtlarından geri doldurma (Aşama 1.1)",
          contextSnapshot: {
            sourceOrderCount: p.sourceOrderIds.length,
            migratedAt: new Date().toISOString(),
          },
          occurredAt: p.discoveredAt,
        });
      }
    }

    for (const o of result.offers) {
      const productId = asinToId.get(o.asin);
      if (!productId) continue;

      const [dup] = await tx
        .select({ id: supplierOffers.id })
        .from(supplierOffers)
        .where(
          sql`${supplierOffers.productId} = ${productId}
              and ${supplierOffers.supplierName} = ${o.supplierName}
              and ${supplierOffers.observedAt} = ${o.observedAt}
              and ${supplierOffers.unitPrice} = ${o.unitPrice}`
        )
        .limit(1);
      if (dup) continue;

      await tx.insert(supplierOffers).values({
        productId,
        supplierName: o.supplierName,
        supplierCode: o.supplierCode,
        sourceUrl: o.sourceUrl,
        sourceDomain: o.sourceDomain,
        unitPrice: o.unitPrice,
        observedAt: o.observedAt,
        sourceType: o.sourceType,
      });
      offersInserted++;
    }

    // FK geri doldurma — B-03'ün kapanışı
    for (const p of result.products) {
      const productId = asinToId.get(p.asin);
      if (!productId) continue;
      await tx.update(orders).set({ productId }).where(inArray(orders.id, p.sourceOrderIds));
      ordersLinked += p.sourceOrderIds.length;
    }

    return { productsCreated, productsUpdated, offersInserted, ordersLinked };
  });

  const [unlinked] = await db
    .select({ n: sql<string>`count(*)` })
    .from(orders)
    .where(isNull(orders.productId));

  if (options.writeAuditLog !== false) {
    await db.insert(auditLogs).values({
      actorName: "SYSTEM",
      storeCode: "ALL",
      actionType: "PRODUCT_BACKFILL",
      targetEntity: "products, supplier_offers, orders.product_id",
      beforeState: "ORDERS_ONLY",
      afterState: "PRODUCT_CENTRIC",
      details:
        `${written.productsCreated} ürün, ${written.offersInserted} fiyat gözlemi ` +
        `oluşturuldu; ${written.ordersLinked} sipariş ürüne bağlandı.`,
    });
  }

  return {
    inputRows: result.stats.inputRows,
    ...written,
    unlinkedRemaining: Number(unlinked?.n ?? 0),
    warnings: result.warnings,
  };
}
