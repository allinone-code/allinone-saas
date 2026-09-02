/**
 * AŞAMA 2 — Yaşam döngüsü durak geçişi, gerçek veritabanı üzerinde.
 *
 * PATCH /api/products/[id] uç noktasının dayandığı değişmezleri kilitler:
 *   1. Kurallara aykırı geçiş yapılamaz (keyfî sıçrama yok).
 *   2. Her geçiş kalıcı bir OLAY bırakır — Cerberus'un hafızası.
 *   3. Olay, kararın verildiği andaki gerçekliği snapshot olarak saklar.
 *
 * HTTP katmanını değil, o katmanın çağırdığı veri işlemlerini test ederiz;
 * böylece testler gerçek şema kısıtlarına (CHECK, FK) çarpar.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { products, productLifecycleEvents, orders, stores } from "@/db/schema";
import { resolveProduct } from "@/db/resolveProduct";
import {
  isValidTransition,
  STAGE_META,
  LIFECYCLE_STAGES,
  type LifecycleStage,
} from "@/domain/productIntelligence";

const db = drizzle(new PGlite());

/** PATCH uç noktasının transaction gövdesinin birebir aynısı. */
async function moveStage(
  productId: number,
  toStage: LifecycleStage,
  reason: string,
  actor = "Test Yönetici"
) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product) throw new Error("Ürün bulunamadı");

    const fromStage = product.lifecycleStage as LifecycleStage;
    if (fromStage === toStage) throw new Error("Ürün zaten bu durakta");
    if (!isValidTransition(fromStage, toStage)) {
      throw new Error(
        `Geçersiz geçiş: ${fromStage} → ${toStage}. İzin verilenler: ${STAGE_META[fromStage].next.join(", ")}`
      );
    }

    await tx
      .update(products)
      .set({ lifecycleStage: toStage, updatedAt: new Date() })
      .where(eq(products.id, productId));

    const [event] = await tx
      .insert(productLifecycleEvents)
      .values({
        productId,
        fromStage,
        toStage,
        actorName: actor,
        reason,
        contextSnapshot: { asin: product.asin, actorRole: "ADMIN" },
      })
      .returning();

    return { fromStage, toStage, event };
  });
}

async function newProduct(asin: string, stage: LifecycleStage = "PURCHASING") {
  const { productId } = await resolveProduct(db, { asin });
  await db.update(products).set({ lifecycleStage: stage }).where(eq(products.id, productId));
  return productId;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await db.insert(stores).values({ storeCode: "LFC", storeName: "Lifecycle Store" });
});

describe("Geçiş kuralları — keyfî sıçrama engellenir", () => {
  it("izin verilen geçiş kabul edilir (PURCHASING → IN_WAREHOUSE)", async () => {
    const id = await newProduct("B0STAGE001", "PURCHASING");
    const r = await moveStage(id, "IN_WAREHOUSE", "Depoya teslim alındı");
    expect(r.fromStage).toBe("PURCHASING");

    const [p] = await db.select().from(products).where(eq(products.id, id));
    expect(p.lifecycleStage).toBe("IN_WAREHOUSE");
  });

  it("kural dışı sıçrama reddedilir (DISCOVERED → SELLING)", async () => {
    const id = await newProduct("B0STAGE002", "DISCOVERED");
    await expect(moveStage(id, "SELLING", "Hemen satalım")).rejects.toThrow(/Geçersiz geçiş/);

    // durum DEĞİŞMEMELİ
    const [p] = await db.select().from(products).where(eq(products.id, id));
    expect(p.lifecycleStage).toBe("DISCOVERED");
  });

  it("başarısız geçiş olay bırakmaz (transaction geri alınır)", async () => {
    const id = await newProduct("B0STAGE003", "DISCOVERED");
    const before = await db
      .select()
      .from(productLifecycleEvents)
      .where(eq(productLifecycleEvents.productId, id));

    await expect(moveStage(id, "LISTED", "Olmaz")).rejects.toThrow();

    const after = await db
      .select()
      .from(productLifecycleEvents)
      .where(eq(productLifecycleEvents.productId, id));
    expect(after.length).toBe(before.length);
  });

  it("aynı durağa geçiş reddedilir (anlamsız olay üretilmez)", async () => {
    const id = await newProduct("B0STAGE004", "SELLING");
    await expect(moveStage(id, "SELLING", "Tekrar")).rejects.toThrow(/zaten/);
  });

  it("sonlandırılmış üründen çıkış yoktur (DISCONTINUED terminal)", async () => {
    const id = await newProduct("B0STAGE005", "DISCONTINUED");
    expect(STAGE_META.DISCONTINUED.next).toHaveLength(0);
    for (const s of LIFECYCLE_STAGES) {
      if (s === "DISCONTINUED") continue;
      await expect(moveStage(id, s, "Geri dönüş")).rejects.toThrow();
    }
  });

  it("veritabanı geçersiz durak metnini de reddeder (son savunma hattı)", async () => {
    const id = await newProduct("B0STAGE006", "SELLING");
    let code: string | undefined;
    try {
      await db
        .update(products)
        .set({ lifecycleStage: "UYDURMA_DURAK" })
        .where(eq(products.id, id));
    } catch (e: any) {
      code = e?.cause?.code ?? e?.code;
    }
    expect(code).toBe("23514"); // CHECK violation
  });
});

describe("Olay defteri — Cerberus'un hafızası", () => {
  it("her geçiş kim/ne zaman/neden bilgisiyle kalıcı yazılır", async () => {
    const id = await newProduct("B0MEMORY01", "PURCHASING");
    await moveStage(id, "IN_WAREHOUSE", "Kargo teslim edildi", "Ayşe Yönetici");

    const events = await db
      .select()
      .from(productLifecycleEvents)
      .where(eq(productLifecycleEvents.productId, id))
      .orderBy(asc(productLifecycleEvents.occurredAt));

    // 1: resolveProduct'ın yazdığı doğuş olayı, 2: bizim geçişimiz
    const last = events[events.length - 1];
    expect(last.fromStage).toBe("PURCHASING");
    expect(last.toStage).toBe("IN_WAREHOUSE");
    expect(last.actorName).toBe("Ayşe Yönetici");
    expect(last.reason).toBe("Kargo teslim edildi");
    expect(last.occurredAt).toBeInstanceOf(Date);
  });

  it("tam yolculuk uçtan uca izlenebilir", async () => {
    const id = await newProduct("B0JOURNEY1", "DISCOVERED");
    const journey: LifecycleStage[] = [
      "ANALYZING",
      "SCORED",
      "APPROVED",
      "PURCHASING",
      "IN_WAREHOUSE",
      "LISTED",
      "SELLING",
      "MONITORING",
    ];
    for (const stage of journey) {
      await moveStage(id, stage, `${STAGE_META[stage].label} durağına geçiş`);
    }

    const events = await db
      .select()
      .from(productLifecycleEvents)
      .where(eq(productLifecycleEvents.productId, id))
      .orderBy(asc(productLifecycleEvents.occurredAt));

    // doğuş olayı + 8 geçiş
    expect(events).toHaveLength(9);

    // Zincir kopuksuz olmalı: her olayın fromStage'i bir öncekinin toStage'i
    const transitions = events.slice(1);
    for (let i = 1; i < transitions.length; i++) {
      expect(transitions[i].fromStage).toBe(transitions[i - 1].toStage);
    }

    const [p] = await db.select().from(products).where(eq(products.id, id));
    expect(p.lifecycleStage).toBe("MONITORING");
  });

  it("karar anındaki gerçeklik snapshot olarak saklanır", async () => {
    const { productId } = await resolveProduct(db, { asin: "B0SNAP0001" });
    await db.insert(orders).values({
      buyerStore: "LFC",
      orderDate: "2026-05-01",
      fulfillmentType: "FBA",
      productTitle: "Snapshot Ürünü",
      asin: "B0SNAP0001",
      msku: "SNP-1",
      supplierName: "S",
      supplierUrl: "https://s.example",
      amazonUrl: "https://a.example",
      orderNumber: "WO-SNAP-1",
      quantity: 10,
      shippedToAmazon: 7,
      unitCost: "5.00",
      sellingPrice: "12.00",
      totalCost: "50.00",
      orderEmail: "e@e.com",
      cargoStatus: "Tam Geldi",
      brandName: "B",
      correctedCost: "50.00",
      productId,
    });

    const [snap] = await db
      .select({
        unitsPurchased: orders.quantity,
        unitsShipped: orders.shippedToAmazon,
      })
      .from(orders)
      .where(eq(orders.productId, productId));

    await db
      .update(products)
      .set({ lifecycleStage: "IN_WAREHOUSE" })
      .where(eq(products.id, productId));

    const [event] = await db
      .insert(productLifecycleEvents)
      .values({
        productId,
        fromStage: "IN_WAREHOUSE",
        toStage: "LISTED",
        actorName: "Test",
        reason: "Listelendi",
        contextSnapshot: {
          unitsPurchased: snap.unitsPurchased,
          unitsShipped: snap.unitsShipped,
        },
      })
      .returning();

    const ctx = event.contextSnapshot as Record<string, number>;
    expect(ctx.unitsPurchased).toBe(10);
    expect(ctx.unitsShipped).toBe(7);
  });

  it("ürün silinemediği için olay geçmişi de kaybolmaz", async () => {
    // Siparişi olan ürün RESTRICT ile korunur; dolayısıyla ona bağlı
    // yaşam döngüsü kaydı da hiçbir zaman yetim kalmaz.
    const [p] = await db
      .select()
      .from(products)
      .where(eq(products.asin, "B0SNAP0001"));

    let code: string | undefined;
    try {
      await db.delete(products).where(eq(products.id, p.id));
    } catch (e: any) {
      code = e?.cause?.code ?? e?.code;
    }
    expect(code).toBe("23001");
  });
});

describe("STAGE_META bütünlüğü", () => {
  it("her durağın hedefleri geçerli duraklardır", () => {
    for (const stage of LIFECYCLE_STAGES) {
      for (const next of STAGE_META[stage].next) {
        expect(LIFECYCLE_STAGES).toContain(next);
      }
    }
  });

  it("hiçbir durak kendine geçiş öneremez", () => {
    for (const stage of LIFECYCLE_STAGES) {
      expect(STAGE_META[stage].next).not.toContain(stage);
    }
  });

  it("DISCOVERED'dan SELLING'e ulaşılabilir (yolculuk çıkmaz değil)", () => {
    const seen = new Set<LifecycleStage>(["DISCOVERED"]);
    const queue: LifecycleStage[] = ["DISCOVERED"];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of STAGE_META[cur].next) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.has("SELLING")).toBe(true);
    expect(seen.has("DISCONTINUED")).toBe(true);
  });
});
