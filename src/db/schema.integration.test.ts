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
import { eq } from "drizzle-orm";
import { orders, stores, pshBatches, products, supplierOffers } from "@/db/schema";

const db = drizzle(new PGlite());
/** PG hata kodları: 23503=FKey, 23505=Unique, 23514=Check, 23001=Restrict. Drizzle hatası cause zincirinde taşınır. */
async function expectPgError(
  promise: Promise<unknown>,
  code: "23503" | "23505" | "23514" | "23001"
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

/**
 * AŞAMA 1 — Ürün merkezli çekirdeğin veritabanı garantileri.
 *
 * Denetim bulgusu B-03: orders ile ürün arasında FK yoktu, ASIN metniyle
 * eşleşiyordu ve gerçek veride kesişim SIFIR çıkmıştı. Bu testler bağın
 * artık veritabanı tarafından zorlandığını kanıtlar.
 */
describe("Ürün merkezli çekirdek (Aşama 1)", () => {
  beforeAll(async () => {
    await insertStore("PRD");
  });

  it("ASIN benzersizdir: aynı ürün iki kez yaratılamaz (B-01)", async () => {
    await db.insert(products).values({ asin: "B0UNIQUE01", title: "Ürün A" });
    await expectPgError(
      db.insert(products).values({ asin: "B0UNIQUE01", title: "Ürün A kopya" }),
      "23505"
    );
  });

  it("FK: var olmayan ürüne sipariş bağlanamaz (B-03)", async () => {
    await expectPgError(
      db.insert(orders).values({
        ...ORDER_BASE,
        buyerStore: "PRD",
        orderNumber: "WO-PRD-FK",
        productId: 999999,
      }),
      "23503"
    );
  });

  it("geçerli ürüne bağlı sipariş yazılabilir ve JOIN çalışır", async () => {
    const [p] = await db
      .insert(products)
      .values({ asin: "B0LINKED01", title: "Bağlı Ürün" })
      .returning();

    const [o] = await db
      .insert(orders)
      .values({
        ...ORDER_BASE,
        buyerStore: "PRD",
        orderNumber: "WO-PRD-LINK",
        productId: p.id,
      })
      .returning();

    expect(o.productId).toBe(p.id);
  });

  it("fiyat zaman serisi: aynı ürüne farklı tarihli gözlemler yazılır (B-02)", async () => {
    const [p] = await db
      .insert(products)
      .values({ asin: "B0TREND001", title: "Trend Ürünü" })
      .returning();

    await db.insert(supplierOffers).values([
      {
        productId: p.id,
        supplierName: "TEST TEDARIKCI",
        unitPrice: "29.99",
        observedAt: new Date("2026-02-11"),
      },
      {
        productId: p.id,
        supplierName: "TEST TEDARIKCI",
        unitPrice: "26.24",
        observedAt: new Date("2026-02-13"),
      },
    ]);

    const rows = await db
      .select()
      .from(supplierOffers)
      .where(eq(supplierOffers.productId, p.id));

    expect(rows).toHaveLength(2);
  });

  it("negatif fiyatlı teklif reddedilir", async () => {
    const [p] = await db
      .insert(products)
      .values({ asin: "B0NEGPRICE", title: "Negatif" })
      .returning();

    await expectPgError(
      db.insert(supplierOffers).values({
        productId: p.id,
        supplierName: "X",
        unitPrice: "-5.00",
      }),
      "23514"
    );
  });

  it("tanımsız yaşam döngüsü durağı reddedilir", async () => {
    await expectPgError(
      db.insert(products).values({
        asin: "B0BADSTAGE",
        title: "Hatalı durak",
        lifecycleStage: "UCUYOR",
      }),
      "23514"
    );
  });

  it("ürün silinince fiyat geçmişi de silinir (cascade)", async () => {
    const [p] = await db
      .insert(products)
      .values({ asin: "B0CASCADE1", title: "Cascade" })
      .returning();

    await db.insert(supplierOffers).values({
      productId: p.id,
      supplierName: "X",
      unitPrice: "10.00",
    });

    await db.delete(products).where(eq(products.id, p.id));

    const remaining = await db
      .select()
      .from(supplierOffers)
      .where(eq(supplierOffers.productId, p.id));
    expect(remaining).toHaveLength(0);
  });

  it("siparişi olan ürün silinemez (restrict) — veri kaybı önlenir", async () => {
    const [p] = await db
      .insert(products)
      .values({ asin: "B0RESTRICT", title: "Korumalı" })
      .returning();

    await db.insert(orders).values({
      ...ORDER_BASE,
      buyerStore: "PRD",
      orderNumber: "WO-PRD-RESTRICT",
      productId: p.id,
    });

    // ON DELETE RESTRICT ihlali 23001 kodu üretir (23503 değil): sipariş
    // geçmişi olan bir ürün silinerek P&L tarihçesi yok edilemez.
    await expectPgError(db.delete(products).where(eq(products.id, p.id)), "23001");
  });
});
