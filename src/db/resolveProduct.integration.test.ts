/**
 * AŞAMA 1.2 — Ürün Çözümleyici entegrasyon testleri.
 *
 * Bu dosya, sistemin en kritik değişmezini kilitler:
 *   "Ürüne bağlanmamış sipariş var olamaz."
 *
 * Gerçek migration'lar PGlite üzerinde uygulanır, yani NOT NULL kısıtı da
 * dahil olmak üzere üretimdeki şemanın aynısı test edilir.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { orders, stores, products, supplierOffers, productLifecycleEvents } from "@/db/schema";
import { resolveProduct, normalizeAsin, insertOrdersWithProducts } from "@/db/resolveProduct";

const db = drizzle(new PGlite());

const ROW = {
  buyerStore: "RSV",
  orderDate: "2026-09-01",
  fulfillmentType: "FBA",
  productTitle: "Test Ürün",
  asin: "B0RESOLVE1",
  msku: "TST-001",
  supplierName: "TEST SUPPLIER",
  supplierUrl: "https://supplier.example/p/1",
  amazonUrl: "https://amazon.com/dp/B0RESOLVE1",
  orderNumber: "WO-RSV-001",
  quantity: 1,
  unitCost: "10.00",
  sellingPrice: "25.00",
  totalCost: "10.00",
  orderEmail: "test@example.com",
  cargoStatus: "Yolda",
  brandName: "TestBrand",
  correctedCost: "10.00",
};

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await db.insert(stores).values({ storeCode: "RSV", storeName: "Resolver Store" });
});

describe("normalizeAsin — kimlik tek biçime indirgenir", () => {
  it("kırpar ve büyük harfe çevirir", () => {
    expect(normalizeAsin("  b0abc123  ")).toBe("B0ABC123");
  });

  it("null/undefined boş dizeye düşer", () => {
    expect(normalizeAsin(null)).toBe("");
    expect(normalizeAsin(undefined)).toBe("");
  });

  it("aynı ASIN'in farklı yazımları tek ürüne çözülür", async () => {
    const a = await resolveProduct(db, { asin: "b0casetest" });
    const b = await resolveProduct(db, { asin: "  B0CASETEST " });
    expect(b.productId).toBe(a.productId);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
  });
});

describe("resolveProduct — get-or-create davranışı", () => {
  it("ASIN boşsa hata fırlatır (katalog çöple dolmaz)", async () => {
    await expect(resolveProduct(db, { asin: "" })).rejects.toThrow(/ASIN boş/);
    await expect(resolveProduct(db, { asin: "   " })).rejects.toThrow(/ASIN boş/);
  });

  it("yeni ürün yaratır ve ilk yaşam döngüsü olayını yazar", async () => {
    const r = await resolveProduct(db, {
      asin: "B0NEWPROD1",
      productTitle: "Yepyeni Ürün",
      brandName: "acme",
      sourceType: "XLS_IMPORT",
    });
    expect(r.created).toBe(true);

    const [p] = await db.select().from(products).where(eq(products.id, r.productId));
    expect(p.title).toBe("Yepyeni Ürün");
    expect(p.brand).toBe("ACME"); // marka normalize edilir
    expect(p.lifecycleStage).toBe("PURCHASING");

    const events = await db
      .select()
      .from(productLifecycleEvents)
      .where(eq(productLifecycleEvents.productId, r.productId));
    expect(events).toHaveLength(1);
    expect(events[0].fromStage).toBeNull();
    expect(events[0].toStage).toBe("PURCHASING");
  });

  it("başlık yoksa ASIN'den okunabilir bir ad türetir", async () => {
    const r = await resolveProduct(db, { asin: "B0NOTITLE1" });
    const [p] = await db.select().from(products).where(eq(products.id, r.productId));
    expect(p.title).toBe("Ürün B0NOTITLE1");
  });

  it("ikinci çağrı yeni ürün YARATMAZ (idempotent)", async () => {
    await resolveProduct(db, { asin: "B0IDEMPOT1" });
    const before = await db.select().from(products);
    const r = await resolveProduct(db, { asin: "B0IDEMPOT1", productTitle: "Farklı ad" });
    const after = await db.select().from(products);
    expect(r.created).toBe(false);
    expect(after.length).toBe(before.length);
  });
});

describe("resolveProduct — fiyat gözlemi (B-02 trend beslemesi)", () => {
  it("sipariş fiyatı gözlem olarak kaydedilir", async () => {
    const r = await resolveProduct(db, {
      asin: "B0PRICE001",
      supplierName: "ACME TEDARIK",
      supplierUrl: "https://shop.acme.com/item/9",
      unitCost: "19.99",
      observedAt: "2026-01-10",
    });
    expect(r.offerRecorded).toBe(true);

    const [o] = await db
      .select()
      .from(supplierOffers)
      .where(eq(supplierOffers.productId, r.productId));
    expect(o.unitPrice).toBe("19.99");
    expect(o.supplierName).toBe("ACME TEDARIK");
    // extractDomain alt alan adını korur: shop.acme.com ile acme.com farklı
    // tedarikçi uçlarıdır ve fiyatları ayrı izlenmelidir.
    expect(o.sourceDomain).toBe("shop.acme.com");
  });

  it("aynı gün + tedarikçi + fiyat tekrarı ikinci kez yazılmaz", async () => {
    const args = {
      asin: "B0DEDUPE01",
      supplierName: "AYNI TEDARIK",
      unitCost: "12.50",
      observedAt: "2026-02-01",
    };
    const a = await resolveProduct(db, args);
    const b = await resolveProduct(db, args);
    expect(a.offerRecorded).toBe(true);
    expect(b.offerRecorded).toBe(false);

    const rows = await db
      .select()
      .from(supplierOffers)
      .where(eq(supplierOffers.productId, a.productId));
    expect(rows).toHaveLength(1);
  });

  it("fiyat değişirse aynı gün bile YENİ gözlem yazılır (trend kaybolmaz)", async () => {
    const base = { asin: "B0TREND001", supplierName: "T", observedAt: "2026-03-01" };
    const a = await resolveProduct(db, { ...base, unitCost: "30.00" });
    const b = await resolveProduct(db, { ...base, unitCost: "27.00" });
    expect(b.offerRecorded).toBe(true);

    const rows = await db
      .select()
      .from(supplierOffers)
      .where(eq(supplierOffers.productId, a.productId));
    expect(rows).toHaveLength(2);
  });

  it("fiyat yoksa ürün yine de çözülür, gözlem yazılmaz", async () => {
    const r = await resolveProduct(db, { asin: "B0NOPRICE1" });
    expect(r.productId).toBeGreaterThan(0);
    expect(r.offerRecorded).toBe(false);
  });
});

describe("insertOrdersWithProducts — toplu yol NOT NULL kısıtını karşılar", () => {
  it("ham satırları ürünlere bağlayarak yazar", async () => {
    const written = await db.transaction(async (tx) =>
      insertOrdersWithProducts(tx, orders, [
        { ...ROW, orderNumber: "WO-BULK-1", asin: "B0BULK0001" },
        { ...ROW, orderNumber: "WO-BULK-2", asin: "B0BULK0002" },
        // aynı ASIN tekrar: yeni ürün değil, yeni sipariş olmalı
        { ...ROW, orderNumber: "WO-BULK-3", asin: "B0BULK0001", unitCost: "11.00" },
      ])
    );
    expect(written).toBe(3);

    const rows = await db
      .select()
      .from(orders)
      .where(sql`${orders.orderNumber} like 'WO-BULK-%'`);
    expect(rows).toHaveLength(3);
    // hepsi bir ürüne bağlı
    expect(rows.every((r) => typeof r.productId === "number" && r.productId > 0)).toBe(true);
    // 1 ve 3 aynı ürünü paylaşır
    const byNo = Object.fromEntries(rows.map((r) => [r.orderNumber, r.productId]));
    expect(byNo["WO-BULK-1"]).toBe(byNo["WO-BULK-3"]);
    expect(byNo["WO-BULK-2"]).not.toBe(byNo["WO-BULK-1"]);
  });

  it("ASIN'siz satır toplu yolu durdurur (sessizce atlanmaz)", async () => {
    await expect(
      db.transaction(async (tx) =>
        insertOrdersWithProducts(tx, orders, [{ ...ROW, orderNumber: "WO-BAD-1", asin: "" }])
      )
    ).rejects.toThrow();

    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "WO-BAD-1"));
    expect(rows).toHaveLength(0); // transaction geri alındı
  });
});

describe("Değişmez: ürünsüz sipariş fiziksel olarak imkânsız", () => {
  it("product_id olmadan sipariş eklenemez (NOT NULL)", async () => {
    let code: string | undefined;
    try {
      await db.insert(orders).values({ ...ROW, orderNumber: "WO-ORPHAN" } as never);
    } catch (e: any) {
      code = e?.cause?.code ?? e?.code;
    }
    expect(code).toBe("23502"); // not_null_violation
  });

  it("veritabanında hiç yetim sipariş yok", async () => {
    const rows = await db
      .select()
      .from(orders)
      .where(sql`${orders.productId} is null`);
    expect(rows).toHaveLength(0);
  });
});
