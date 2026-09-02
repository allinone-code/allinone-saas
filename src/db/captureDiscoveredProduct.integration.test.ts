/**
 * AŞAMA 3 — Keşif hattı entegrasyon testleri.
 *
 * Değişmez: keşif kaydı katalogda bir üründür; puanlama durak üretir;
 * sahte ASIN yoktur; sipariş onaylı ürünü PURCHASING'e çeker ve
 * satıştaki ürünü geri götürmez.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import {
  products,
  productMasters,
  productLifecycleEvents,
  supplierOffers,
  orders,
  stores,
} from "@/db/schema";
import { captureDiscoveredProduct } from "@/db/captureDiscoveredProduct";
import { resolveProduct } from "@/db/resolveProduct";

const db = drizzle(new PGlite());

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await db.insert(stores).values({ storeCode: "CAP", storeName: "Capture Store" });
});

describe("captureDiscoveredProduct", () => {
  it("ASIN boşsa yazmaz", async () => {
    await expect(
      captureDiscoveredProduct(db, {
        title: "X",
        asin: "  ",
        sourcePrice: 10,
        sellingPrice: 40,
        actorName: "Test",
      })
    ).rejects.toThrow(/ASIN/);
  });

  it("yüksek ROI keşfi DISCOVERED → APPROVED yürür ve kasa BUY yazar", async () => {
    const r = await db.transaction((tx) =>
      captureDiscoveredProduct(tx, {
        title: "High ROI Widget",
        asin: "B0HIGHROI1",
        brand: "Acme",
        sourceUrl: "https://www.homedepot.com/p/1",
        sourcePrice: 12,
        sellingPrice: 45,
        actorName: "Ayşe Araştırmacı",
      })
    );

    expect(r.createdProduct).toBe(true);
    expect(r.duplicate).toBe(false);
    expect(r.decision.decisionAction).toBe("BUY");
    expect(r.lifecycleStage).toBe("APPROVED");

    const [p] = await db.select().from(products).where(eq(products.id, r.productId));
    expect(p.lifecycleStage).toBe("APPROVED");
    expect(p.asin).toBe("B0HIGHROI1");

    const [m] = await db.select().from(productMasters).where(eq(productMasters.id, r.masterId));
    expect(m.productId).toBe(r.productId);
    expect(m.decisionAction).toBe("BUY");

    const events = await db
      .select()
      .from(productLifecycleEvents)
      .where(eq(productLifecycleEvents.productId, r.productId))
      .orderBy(asc(productLifecycleEvents.occurredAt));
    expect(events.map((e) => e.toStage)).toEqual([
      "DISCOVERED",
      "ANALYZING",
      "SCORED",
      "APPROVED",
    ]);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.fromStage).toBe(events[i - 1]!.toStage);
    }

    const offers = await db
      .select()
      .from(supplierOffers)
      .where(eq(supplierOffers.productId, r.productId));
    expect(offers.length).toBeGreaterThanOrEqual(1);
  });

  it("düşük ROI keşfi REJECTED durağında elenir", async () => {
    const r = await captureDiscoveredProduct(db, {
      title: "Low ROI",
      asin: "B0LOWROI01",
      sourcePrice: 40,
      sellingPrice: 42,
      actorName: "Test",
    });
    expect(r.decision.decisionAction).toBe("REJECT");
    expect(r.lifecycleStage).toBe("REJECTED");
  });

  it("aynı ASIN ikinci kez yeni ürün yaratmaz ve WAIT üretir", async () => {
    const first = await captureDiscoveredProduct(db, {
      title: "Once",
      asin: "B0DUPES001",
      sourcePrice: 12,
      sellingPrice: 45,
      sourceUrl: "https://www.homedepot.com/p/2",
      actorName: "Test",
    });
    const before = await db.select().from(products);
    const second = await captureDiscoveredProduct(db, {
      title: "Twice",
      asin: "b0dupes001",
      sourcePrice: 12,
      sellingPrice: 45,
      sourceUrl: "https://www.homedepot.com/p/2",
      actorName: "Test",
    });
    const after = await db.select().from(products);
    expect(second.productId).toBe(first.productId);
    expect(second.createdProduct).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.decision.decisionAction).toBe("WAIT");
    expect(after.length).toBe(before.length);
    // Durak geri gitmez
    const [p] = await db.select().from(products).where(eq(products.id, first.productId));
    expect(["APPROVED", "SCORED"]).toContain(p.lifecycleStage);
  });
});

describe("sipariş, keşif hattını satın almaya bağlar", () => {
  it("onaylı ürüne sipariş PURCHASING'e çeker", async () => {
    const r = await captureDiscoveredProduct(db, {
      title: "Buy then order",
      asin: "B0ORDER001",
      sourcePrice: 12,
      sellingPrice: 45,
      sourceUrl: "https://www.homedepot.com/p/3",
      actorName: "Test",
    });
    expect(r.lifecycleStage).toBe("APPROVED");

    await resolveProduct(db, {
      asin: "B0ORDER001",
      unitCost: "12.00",
      supplierName: "HD",
      sourceType: "MANUAL",
    });

    const [p] = await db.select().from(products).where(eq(products.id, r.productId));
    expect(p.lifecycleStage).toBe("PURCHASING");
  });

  it("satıştaki ürün siparişle geri gitmez", async () => {
    const { productId } = await resolveProduct(db, { asin: "B0SELLING1" });
    await db.update(products).set({ lifecycleStage: "SELLING" }).where(eq(products.id, productId));

    await resolveProduct(db, {
      asin: "B0SELLING1",
      unitCost: "9.00",
      supplierName: "X",
    });

    const [p] = await db.select().from(products).where(eq(products.id, productId));
    expect(p.lifecycleStage).toBe("SELLING");
  });

  it("siparişle doğan ürün hâlâ PURCHASING'de başlar (keşif uydurulmaz)", async () => {
    const r = await resolveProduct(db, {
      asin: "B0BORNORD1",
      productTitle: "Siparişten doğan",
      sourceType: "XLS_IMPORT",
    });
    const [p] = await db.select().from(products).where(eq(products.id, r.productId));
    expect(p.lifecycleStage).toBe("PURCHASING");
    const events = await db
      .select()
      .from(productLifecycleEvents)
      .where(eq(productLifecycleEvents.productId, r.productId));
    expect(events[0]!.toStage).toBe("PURCHASING");
  });
});

describe("şema — kasa FK", () => {
  it("var olmayan ürüne kasa bağlanamaz", async () => {
    let code: string | undefined;
    try {
      await db.insert(productMasters).values({
        productCode: "CRB-FK-FAIL",
        title: "Yok",
        brand: "X",
        category: "Y",
        upc: "0",
        asin: "B0NOEXIST1",
        msku: "X-1",
        sourceUrl: "https://example.com",
        sourceDomain: "example.com",
        supplierName: "S",
        researcherName: "R",
        sourcePrice: "1.00",
        landedCost: "2.00",
        sellingPrice: "3.00",
        estimatedNetProfit: "1.00",
        roiPercent: "50.00",
        productId: 999999,
      });
    } catch (e: any) {
      code = e?.cause?.code ?? e?.code;
    }
    expect(code).toBe("23503");
  });

  it("aynı ürüne ikinci kasa kaydı unique ihlalidir", async () => {
    const r = await captureDiscoveredProduct(db, {
      title: "Unique master",
      asin: "B0UNIQMAST",
      sourcePrice: 12,
      sellingPrice: 45,
      sourceUrl: "https://www.homedepot.com/p/9",
      actorName: "Test",
    });
    let code: string | undefined;
    try {
      await db.insert(productMasters).values({
        productCode: "CRB-DUP-M",
        title: "Dup",
        brand: "X",
        category: "Y",
        upc: "0",
        asin: "B0UNIQMAST",
        msku: "X-2",
        sourceUrl: "https://example.com",
        sourceDomain: "example.com",
        supplierName: "S",
        researcherName: "R",
        sourcePrice: "1.00",
        landedCost: "2.00",
        sellingPrice: "3.00",
        estimatedNetProfit: "1.00",
        roiPercent: "50.00",
        productId: r.productId,
      });
    } catch (e: any) {
      code = e?.cause?.code ?? e?.code;
    }
    expect(code).toBe("23505");
  });
});

describe("ürün-sipariş bağının bozulmadığı", () => {
  it("keşfedilmiş ürüne yazılan sipariş product_id taşır", async () => {
    const r = await captureDiscoveredProduct(db, {
      title: "Linked order",
      asin: "B0LINKORD1",
      sourcePrice: 12,
      sellingPrice: 45,
      sourceUrl: "https://www.homedepot.com/p/4",
      actorName: "Test",
    });
    const resolved = await resolveProduct(db, { asin: "B0LINKORD1", unitCost: 12 });
    await db.insert(orders).values({
      buyerStore: "CAP",
      orderDate: "2026-09-02",
      fulfillmentType: "FBA",
      productTitle: "Linked order",
      asin: "B0LINKORD1",
      msku: "L-1",
      supplierName: "S",
      supplierUrl: "https://s.example",
      amazonUrl: "https://a.example",
      orderNumber: "WO-CAP-LINK",
      quantity: 2,
      unitCost: "12.00",
      sellingPrice: "45.00",
      totalCost: "24.00",
      orderEmail: "t@t.com",
      cargoStatus: "Yolda",
      brandName: "Acme",
      correctedCost: "24.00",
      productId: resolved.productId,
    });
    const [o] = await db.select().from(orders).where(eq(orders.orderNumber, "WO-CAP-LINK"));
    expect(o.productId).toBe(r.productId);
  });
});
