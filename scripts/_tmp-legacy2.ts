import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { stores, orders } from "../src/db/schema";

async function main() {
  const db = drizzle(new PGlite("/tmp/legacy-db"));
  await db.insert(stores).values({ storeCode: "HRN", storeName: "Harun" });

  // Ürüne bağlanmamış 3 eski sipariş (Neon'daki gerçek durum)
  for (let i = 1; i <= 3; i++) {
    await db.insert(orders).values({
      buyerStore: "HRN",
      orderDate: "2026-06-0" + i,
      fulfillmentType: "FBA",
      productTitle: "Eski Ürün " + i,
      asin: i === 3 ? "B0LEGACY01" : "B0LEGACY0" + i, // 3. satır 1. ile aynı ASIN degil, ayri
      msku: "LEG-" + i,
      supplierName: "ESKI TEDARIK",
      supplierUrl: "https://eski.example/p" + i,
      amazonUrl: "https://amazon.com/dp/X",
      orderNumber: "WO-LEG-" + i,
      quantity: 5,
      shippedToAmazon: 4,
      unitCost: (10 + i) + ".00",
      sellingPrice: "30.00",
      totalCost: ((10 + i) * 5) + ".00",
      orderEmail: "e@e.com",
      cargoStatus: "Tam Geldi",
      brandName: "ESKIMARKA",
      correctedCost: "50.00",
    } as never);
  }
  const r = await db.execute(sql`select count(*)::int as n from orders where product_id is null`);
  const rows = Array.isArray(r) ? r : (r as any).rows;
  process.stderr.write("LEGACY_ORDERS=" + rows[0].n + "\n");
}
void main();
