/**
 * T5.2 — Faz 2 veritabanı kısıtlarının gerçek migration üzerinden entegrasyon testi.
 * PGlite (in-process Postgres) ile drizzle/ klasöründeki migration uygulanır;
 * FK, unique ve index davranışları kanıtlanır.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { orders, stores, pshBatches } from "@/db/schema";

const db = drizzle(new PGlite());
/** PG hata kodları: 23503=FKey, 23505=Unique. Drizzle hatası cause zincirinde taşınır. */
async function expectPgError(promise: Promise<unknown>, code: "23503" | "23505") {
  try {
    await promise;
  } catch (e: any) {
    const actual = e?.cause?.code ?? e?.code;
    expect(actual, `Beklenen PG kodu ${code}, gelen: ${actual} (${e?.message?.slice(0, 120)})`).toBe(code);
    return;
  }
  throw new Error("Beklenen kısıt hatası fırlatılmadı!");
}

async function applyMigrations() {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

async function insertStore(code: string) {
  await db.insert(stores).values({ storeCode: code, storeName: `${code} Store` });
}

const ORDER_BASE = {
  orderDate: "2026-09-01",
  fulfillmentType: "FBA",
  productTitle: "Test Ürün",
  asin: "B0TESTCODE",
  msku: "TST-001",
  supplierName: "TEST SUPPLIER",
  supplierUrl: "https://supplier.example",
  amazonUrl: "https://amazon.com/dp/B0TESTCODE",
  orderNumber: "WO-TEST-001",
  quantity: 1,
  unitCost: "10.00",
  sellingPrice: "25.00",
  totalCost: "10.00",
  orderEmail: "test@example.com",
  cargoStatus: "Yolda",
  brandName: "TestBrand",
  correctedCost: "10.00",
} as const;

describe("DB kısıtları (T2.2/T2.3) — gerçek migration üzerinde", () => {
  beforeAll(async () => {
    await applyMigrations();
    await insertStore("HRN");
  });

  it("FK: var olmayan mağazaya (buyer_store) sipariş yazılamaz", async () => {
    await expectPgError(db.insert(orders).values({ ...ORDER_BASE, buyerStore: "YOKEDKC" }), "23503");
  });

  it("FK + insert birlikte çalışır: var olan mağaza başarılı", async () => {
    const [row] = await db
      .insert(orders)
      .values({ ...ORDER_BASE, buyerStore: "HRN" })
      .returning();
    expect(row.buyerStore).toBe("HRN");
  });

  it("UNIQUE(orders.order_number, buyer_store): mükerrer import engellenir", async () => {
    await expectPgError(db.insert(orders).values({ ...ORDER_BASE, buyerStore: "HRN" }), "23505");

    // aynı orderNumber farklı mağazada sorun değil
    await insertStore("SEL");
    const [row] = await db
      .insert(orders)
      .values({ ...ORDER_BASE, buyerStore: "SEL" })
      .returning();
    expect(row.buyerStore).toBe("SEL");
  });

  it("FK(psh_batch_no): var olmayan batch reddedilir", async () => {
    await expectPgError(
      db.insert(orders).values({
        ...ORDER_BASE,
        buyerStore: "SEL",
        orderNumber: "WO-TEST-002",
        pshBatchNo: "PSH-OLMAYAN",
      }),
      "23503"
    );
  });

  it("FK zinciri çalışır: geçerli store + batch referanslı sipariş yazılır", async () => {
    await insertStore("BTS");
    await db.insert(pshBatches).values({
      batchNumber: "PSH-TEST-1",
      storeCode: "BTS",
      title: "Test Batch",
    });

    const [row] = await db
      .insert(orders)
      .values({
        ...ORDER_BASE,
        buyerStore: "BTS",
        orderNumber: "WO-TEST-004",
        pshBatchNo: "PSH-TEST-1",
      })
      .returning();
    expect(row.pshBatchNo).toBe("PSH-TEST-1");
  });

  it("psh_batch_no NULL kabul edilir (batch'e bağlanmamış sipariş)", async () => {
    const [row] = await db
      .insert(orders)
      .values({ ...ORDER_BASE, buyerStore: "SEL", orderNumber: "WO-TEST-003" })
      .returning();
    expect(row.pshBatchNo).toBeNull();
  });

  it("Kritik indexler migration ile oluşuyor", async () => {
    const { sql } = await import("drizzle-orm");
    const result = await db.execute<{ indexname: string }>(
      sql.raw(`SELECT indexname FROM pg_indexes WHERE tablename = 'orders'`)
    );
    const names = result.rows.map((r) => r.indexname);
    expect(names).toContain("orders_order_number_store_uq");
    expect(names).toContain("orders_buyer_store_date_idx");
    expect(names).toContain("orders_asin_idx");
  });
});
