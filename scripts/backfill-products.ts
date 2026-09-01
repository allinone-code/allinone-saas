/**
 * AŞAMA 1.1 — Ürün geri doldurma çalıştırıcısı
 *
 * Mevcut `orders` satırlarından `products`, `supplier_offers` ve
 * `product_lifecycle_events` kayıtlarını türetir; ardından
 * `orders.product_id` FK'sını geri doldurur.
 *
 * Güvenlik özellikleri:
 *   - Tek transaction: kısmi hata tüm işlemi geri alır
 *   - Idempotent: tekrar çalıştırılabilir, mevcut ürünleri günceller
 *   - --dry-run: hiçbir şey yazmadan ne olacağını raporlar
 *
 * Kullanım:
 *   npx tsx scripts/backfill-products.ts --dry-run
 *   npx tsx scripts/backfill-products.ts
 */
import "dotenv/config";
import { db } from "../src/db";
import {
  orders,
  products,
  supplierOffers,
  productLifecycleEvents,
  auditLogs,
} from "../src/db/schema";
import { backfillProductsFromOrders } from "../src/domain/productBackfill";
import { eq, sql, isNull, inArray } from "drizzle-orm";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n=== CERBERUS ÜRÜN GERİ DOLDURMA ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

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
    console.log("Sipariş yok — geri doldurulacak bir şey bulunamadı.\n");
    return;
  }

  const result = backfillProductsFromOrders(orderRows);

  console.log("ANALİZ:");
  console.log(`  Girdi satırı        : ${result.stats.inputRows}`);
  console.log(`  Benzersiz ürün      : ${result.stats.uniqueProducts}`);
  console.log(`  Fiyat gözlemi       : ${result.stats.offersCreated}`);
  console.log(`  Yinelenen (atlandı) : ${result.stats.duplicateOffersSkipped}`);
  console.log(`  ASIN'siz satır      : ${result.stats.rowsWithoutAsin}`);

  const dedupRate =
    result.stats.inputRows > 0
      ? (1 - result.stats.uniqueProducts / result.stats.inputRows) * 100
      : 0;
  console.log(`  Tekrar oranı        : %${dedupRate.toFixed(1)} (bu kadar veri tekrarı kalkıyor)`);

  if (result.warnings.length > 0) {
    console.log(`\nUYARILAR (${result.warnings.length}):`);
    for (const w of result.warnings.slice(0, 15)) console.log(`  - ${w}`);
    if (result.warnings.length > 15) {
      console.log(`  ... ve ${result.warnings.length - 15} uyarı daha`);
    }
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — hiçbir kayıt yazılmadı.\n");
    return;
  }

  // Tek transaction: kısmi hata tüm işlemi geri alır
  const summary = await db.transaction(async (tx) => {
    let productsCreated = 0;
    let productsUpdated = 0;
    let offersInserted = 0;
    let ordersLinked = 0;

    const asinToId = new Map<string, number>();

    for (const p of result.products) {
      // Idempotent: ASIN unique olduğu için çakışmada güncelle
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

      // Yolculuğun ilk kaydı: ürün nereden geldi?
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

    // Fiyat zaman serisi
    for (const o of result.offers) {
      const productId = asinToId.get(o.asin);
      if (!productId) continue;

      // Idempotency: aynı (ürün, tedarikçi, an, fiyat) tekrar yazılmasın
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
      const res = await tx
        .update(orders)
        .set({ productId })
        .where(inArray(orders.id, p.sourceOrderIds));
      ordersLinked += p.sourceOrderIds.length;
      void res;
    }

    return { productsCreated, productsUpdated, offersInserted, ordersLinked };
  });

  console.log("\nYAZILDI:");
  console.log(`  Yeni ürün           : ${summary.productsCreated}`);
  console.log(`  Güncellenen ürün    : ${summary.productsUpdated}`);
  console.log(`  Fiyat gözlemi       : ${summary.offersInserted}`);
  console.log(`  Bağlanan sipariş    : ${summary.ordersLinked}`);

  const [unlinked] = await db
    .select({ n: sql<string>`count(*)` })
    .from(orders)
    .where(isNull(orders.productId));
  console.log(`  Bağlanmamış kalan   : ${unlinked?.n ?? "?"}`);

  await db.insert(auditLogs).values({
    actorName: "SYSTEM",
    storeCode: "ALL",
    actionType: "PRODUCT_BACKFILL",
    targetEntity: "products, supplier_offers, orders.product_id",
    beforeState: "ORDERS_ONLY",
    afterState: "PRODUCT_CENTRIC",
    details: `${summary.productsCreated} ürün, ${summary.offersInserted} fiyat gözlemi oluşturuldu; ${summary.ordersLinked} sipariş ürüne bağlandı.`,
  });

  console.log("\nTamamlandı.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("HATA:", e);
    process.exit(1);
  });
