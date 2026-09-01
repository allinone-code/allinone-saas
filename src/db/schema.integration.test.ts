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
/** PG hata kodları: 23503=FKey, 23505=Unique, 23514=Check. Drizzle hatası cause zincirinde taşınır. */
async function expectPgError(
  promise: Promise<unknown>,
  code: "23503" | "23505" | "23514"
) {
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

/**
 * Aşama 0 güvenlik ağı (denetim bulgusu B-04/B-05).
 *
 * Bu kuralların bir kısmı uygulama katmanında da var; buradaki testler
 * veritabanının SON savunma hattı olarak davrandığını kanıtlar. Toplu import,
 * manuel SQL veya ileride yazılacak bir servis uygulama kontrollerini
 * atlayabilir — bu kısıtları atlayamaz.
 */
describe("CHECK kısıtları — fiziksel olarak imkânsız veri reddedilir", () => {
  beforeAll(async () => {
    await insertStore("CHK");
  });

  const base = (over: Record<string, unknown>) => ({
    ...ORDER_BASE,
    buyerStore: "CHK",
    orderNumber: `WO-CHK-${Math.random().toString(36).slice(2, 10)}`,
    ...over,
  });

  it("negatif adet reddedilir", async () => {
    await expectPgError(db.insert(orders).values(base({ quantity: -5 })), "23514");
  });

  it("negatif birim maliyet reddedilir", async () => {
    await expectPgError(db.insert(orders).values(base({ unitCost: "-10.00" })), "23514");
  });

  it("negatif iade tutarı reddedilir", async () => {
    await expectPgError(db.insert(orders).values(base({ refundAmount: "-1.00" })), "23514");
  });

  it("sipariş edilenden fazla adet sevk edilemez", async () => {
    await expectPgError(
      db.insert(orders).values(base({ quantity: 3, shippedToAmazon: 99 })),
      "23514"
    );
  });

  it("var olandan fazla fire kaydedilemez", async () => {
    await expectPgError(
      db.insert(orders).values(base({ quantity: 2, p2MissingQty: 50 })),
      "23514"
    );
  });

  it("fire kalemlerinin TOPLAMI adedi aşamaz (tek tek geçerli olsa bile)", async () => {
    await expectPgError(
      db.insert(orders).values(
        base({ quantity: 4, p1CancelQty: 2, p2MissingQty: 2, p3DefectiveQty: 2 })
      ),
      "23514"
    );
  });

  it("tanımsız kargo durumu reddedilir (yazım hatasına karşı koruma)", async () => {
    // "IPTAL" != "İPTAL" — Türkçe karakter farkı sessizce geçmemeli
    await expectPgError(db.insert(orders).values(base({ cargoStatus: "IPTAL" })), "23514");
  });

  it("tanımsız PSH durumu reddedilir", async () => {
    await expectPgError(db.insert(orders).values(base({ pshStatus: "HERHANGI" })), "23514");
  });

  it("tanımsız fulfillment tipi reddedilir", async () => {
    await expectPgError(db.insert(orders).values(base({ fulfillmentType: "DHL" })), "23514");
  });

  it("sınır değerler kabul edilir: sevk + fire tam olarak adede eşit", async () => {
    const [row] = await db
      .insert(orders)
      .values(base({ quantity: 5, shippedToAmazon: 3, p2MissingQty: 2 }))
      .returning();
    expect(row.quantity).toBe(5);
    expect(row.shippedToAmazon).toBe(3);
  });

  it("geçerli kayıt normal şekilde yazılır", async () => {
    const [row] = await db
      .insert(orders)
      .values(base({ quantity: 10, shippedToAmazon: 4, cargoStatus: "İPTAL" }))
      .returning();
    expect(row.cargoStatus).toBe("İPTAL");
  });
});
