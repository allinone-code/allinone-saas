/**
 * İçe aktarma esnekliği (import-xls) — route çekirdeğinin DB seviyesinde
 * entegrasyon testi.
 *
 * Route'un kendisi auth gerektirdiği için burada aynı akış PGlite üzerinde
 * birebir simüle edilir: tanımsız mağaza kodu otomatik oluşturma, serbest
 * metin kargo durumu, savepoint ile hatalı satır atlama ve aynı order
 * number altında farklı ASIN'ler.
 *
 * Migration 0004: UNIQUE(order_number, buyer_store, asin) + kargo enum
 * CHECK kısıtının kaldırılması bu testlerin ön koşuludur.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { eq } from "drizzle-orm";
import { orders, stores, products } from "@/db/schema";
import { resolveProduct, normalizeAsin } from "@/db/resolveProduct";
import { pgErrorCode } from "@/lib/importValidation";

const db = drizzle(new PGlite());

/**
 * import-xls route'unun satır yazma bloğunun sadeleştirilmiş aynası.
 * Kaynak: src/app/api/orders/import-xls/route.ts (tx.transaction savepoint'i)
 */
async function importRow(
  row: {
    asin: string;
    orderNumber: string;
    buyerStore: string;
    cargoStatus?: string;
    quantity?: number;
    shippedToAmazon?: number;
  },
  createdStores: string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    // Route'daki gibi: satırın mağazası tanımlı değilse otomatik oluştur
    const existing = await tx
      .select({ storeCode: stores.storeCode })
      .from(stores)
      .where(eq(stores.storeCode, row.buyerStore));
    if (!existing.length) {
      await tx
        .insert(stores)
        .values({ storeCode: row.buyerStore, storeName: `${row.buyerStore} (Otomatik — XLS İçe Aktarım)` })
        .onConflictDoNothing();
      createdStores.push(row.buyerStore);
    }

    await tx.transaction(async (inner) => {
      const { productId } = await resolveProduct(inner, {
        asin: normalizeAsin(row.asin),
        unitCost: "10",
        sourceType: "XLS_IMPORT",
      });
      await inner.insert(orders).values({
        productId,
        buyerStore: row.buyerStore,
        orderDate: "2026-09-01",
        fulfillmentType: "FBA",
        productTitle: "Simülasyon Ürünü",
        asin: normalizeAsin(row.asin),
        msku: `M-${row.asin}`,
        supplierName: "S",
        supplierUrl: "https://supplier.example",
        amazonUrl: `https://www.amazon.com/dp/${row.asin}`,
        orderNumber: row.orderNumber,
        quantity: row.quantity ?? 1,
        unitCost: "10.00",
        sellingPrice: "20.00",
        totalCost: "10.00",
        orderEmail: "",
        cargoStatus: row.cargoStatus ?? "Tam Geldi", // serbest metin
        shippedToAmazon: row.shippedToAmazon ?? 0,
        brandName: "B",
        correctedCost: "10.00",
      });
    });
  });
}

describe("import-xls esnekliği — gerçek migration üzerinde", () => {
  let fixtureProductId = 0;
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    const [p] = await db
      .insert(products)
      .values({ asin: "B0FIXTURE1", title: "Fixture" })
      .returning();
    fixtureProductId = p.id;
    expect(fixtureProductId).toBeGreaterThan(0);
  });

  it("hatalı satır atlanır, doğru satırlar aktarılır; tanımsız mağaza otomatik oluşur", async () => {
    const createdStores: string[] = [];
    const rows = [
      // AUTONEW tanımsız → otomatik oluşturulur; kargo durumu serbest metin
      { asin: "B0NEWASIN1", orderNumber: "WO-SIM-1", buyerStore: "AUTONEW", cargoStatus: "Kargoya verildi 12.09" },
      // CHECK ihlali (sevk 150 > adet 99) → savepoint geri alınır, batch devam eder
      { asin: "B0FIXTURE1", orderNumber: "WO-SIM-BAD", buyerStore: "AUTONEW", quantity: 99, shippedToAmazon: 150 },
      // geçerli satır
      { asin: "B0NEWASIN2", orderNumber: "WO-SIM-2", buyerStore: "AUTONEW" },
    ];

    const skipped: Array<{ orderNumber: string; code: string | null }> = [];
    for (const r of rows) {
      try {
        await importRow(r, createdStores);
      } catch (e: unknown) {
        skipped.push({ orderNumber: r.orderNumber, code: pgErrorCode(e) });
      }
    }

    // Yalnızca CHECK ihlali yapan satır atlandı
    expect(skipped).toEqual([{ orderNumber: "WO-SIM-BAD", code: "23514" }]);

    // Tanımsız mağaza kodu otomatik oluşturuldu
    expect(createdStores).toEqual(["AUTONEW"]);
    const [store] = await db.select().from(stores).where(eq(stores.storeCode, "AUTONEW"));
    expect(store.storeName).toContain("Otomatik");

    // İki geçerli satır yazıldı; hatalı satır tamamen geri alındı
    const all = await db.select().from(orders).where(eq(orders.buyerStore, "AUTONEW"));
    expect(all.map((o) => o.orderNumber).sort()).toEqual(["WO-SIM-1", "WO-SIM-2"]);
    expect(all.find((o) => o.orderNumber === "WO-SIM-BAD")).toBeUndefined();

    // Serbest metin kargo durumu DB'de korundu
    expect(all.find((o) => o.orderNumber === "WO-SIM-1")?.cargoStatus).toBe(
      "Kargoya verildi 12.09"
    );
  });

  it("aynı order number + farklı ASIN aynı mağazada bir arada yaşar", async () => {
    const createdStores: string[] = [];
    await importRow({ asin: "B0MULTI01", orderNumber: "WO-MULTI", buyerStore: "MULTIST" }, createdStores);
    await importRow({ asin: "B0MULTI02", orderNumber: "WO-MULTI", buyerStore: "MULTIST" }, createdStores);

    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "WO-MULTI"));
    expect(rows.map((r) => r.asin).sort()).toEqual(["B0MULTI01", "B0MULTI02"]);
  });

  it("aynı order number + AYNI ASIN tekrar edilirse unique index engeller", async () => {
    const createdStores: string[] = [];
    await importRow({ asin: "B0DUPLEX1", orderNumber: "WO-DUPLEX", buyerStore: "DUPST" }, createdStores);
    let code: string | null = null;
    try {
      await importRow({ asin: "B0DUPLEX1", orderNumber: "WO-DUPLEX", buyerStore: "DUPST" }, createdStores);
    } catch (e: unknown) {
      code = pgErrorCode(e);
    }
    expect(code).toBe("23505");
  });
});
