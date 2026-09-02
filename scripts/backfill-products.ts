/**
 * CERBERUS — Ürün Geri Doldurma (Aşama 1.1)
 *
 * Mevcut sipariş satırlarından ürün kataloğunu, fiyat gözlemlerini ve
 * yaşam döngüsü kayıtlarını türetir; `orders.product_id` bağlarını kurar.
 *
 * Kullanım:
 *   npx tsx scripts/backfill-products.ts --dry-run   # yazmadan analiz
 *   npx tsx scripts/backfill-products.ts             # uygula
 *
 * İdempotenttir: iki kez çalıştırmak yeni kayıt üretmez.
 *
 * Not: Yazma mantığı `src/db/applyBackfill.ts` içindedir; bootstrap betiği de
 * aynı modülü kullanır, böylece iki yol birbirinden ayrışmaz.
 */
import "dotenv/config";
import { db } from "../src/db";
import { orders } from "../src/db/schema";
import { backfillProductsFromOrders } from "../src/domain/productBackfill";
import { applyProductBackfill } from "../src/db/applyBackfill";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n=== CERBERUS ÜRÜN GERİ DOLDURMA ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  if (DRY_RUN) {
    // Kuru provada hiçbir şey yazmayız: yalnızca saf hesaplamayı çalıştırıp
    // ne olacağını raporlarız.
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
    console.log(`  Tekrar oranı        : %${dedupRate.toFixed(1)}`);

    if (result.warnings.length > 0) {
      console.log(`\nUYARILAR (${result.warnings.length}):`);
      for (const w of result.warnings.slice(0, 15)) console.log(`  - ${w}`);
      if (result.warnings.length > 15) {
        console.log(`  ... ve ${result.warnings.length - 15} uyarı daha`);
      }
    }

    console.log("\nDRY RUN — hiçbir kayıt yazılmadı.\n");
    return;
  }

  const summary = await applyProductBackfill(db);

  if (summary.inputRows === 0) {
    console.log("Sipariş yok — geri doldurulacak bir şey bulunamadı.\n");
    return;
  }

  console.log("YAZILDI:");
  console.log(`  Yeni ürün           : ${summary.productsCreated}`);
  console.log(`  Güncellenen ürün    : ${summary.productsUpdated}`);
  console.log(`  Fiyat gözlemi       : ${summary.offersInserted}`);
  console.log(`  Bağlanan sipariş    : ${summary.ordersLinked}`);
  console.log(`  Bağlanmamış kalan   : ${summary.unlinkedRemaining}`);

  if (summary.warnings.length > 0) {
    console.log(`\nUYARILAR (${summary.warnings.length}):`);
    for (const w of summary.warnings.slice(0, 15)) console.log(`  - ${w}`);
  }

  console.log("\nTamamlandı.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Geri doldurma başarısız:", e);
    process.exit(1);
  });
