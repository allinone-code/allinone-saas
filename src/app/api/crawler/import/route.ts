import { NextResponse } from "next/server";
import { db } from "@/db";
import { scrapedProducts, products, supplierOffers, auditLogs, productLifecycleEvents } from "@/db/schema";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { parseBody, crawlerImportSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { inArray, eq } from "drizzle-orm";

/**
 * POST /api/crawler/import — seçilen scraped ürünleri sisteme aktar
 * Her ürün: products + supplierOffers + lifecycle event oluşturur
 */
export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const user = gate.user;

    const parsed = await parseBody(req, crawlerImportSchema);
    if ("response" in parsed) return parsed.response;
    const { scrapedIds, storeCode: requestedStore } = parsed.data;
    const storeCode = resolveStoreScope(user, requestedStore || "HRN");

    const rows = await db.select().from(scrapedProducts).where(inArray(scrapedProducts.id, scrapedIds));
    if (!rows.length) return NextResponse.json({ error: "Seçilen ürünler bulunamadı." }, { status: 404 });

    const pending = rows.filter((r) => r.status === "PENDING");
    if (!pending.length) return NextResponse.json({ error: "Seçilen ürünlerin hepsi zaten aktarıldı veya reddedildi." }, { status: 409 });

    const results: Array<{ scrapedId: number; productId: number; asin: string; title: string }> = [];
    const warnings: string[] = [];

    for (const sp of pending) {
      // ASIN adayı yoksa üret
      const rawAsin = (sp.asinCandidate || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      const asin = /^[A-Z0-9]{10}$/.test(rawAsin) ? rawAsin : `SC${String(sp.id).padStart(8, "0")}`;
      // Mevcut ürünü ASIN ile bul veya oluştur
      const existing = await db.select().from(products).where(eq(products.asin, asin)).limit(1);
      let productId: number;
      if (existing.length) {
        productId = existing[0].id;
        warnings.push(`${sp.title.slice(0, 40)} — ASIN ${asin} zaten var, fiyat gözlemi eklendi.`);
      } else {
        const [created] = await db.insert(products).values({
          asin,
          title: sp.title,
          brand: sp.brand || "General",
          category: "UNCATEGORIZED",
          imageUrl: sp.imageUrl,
          amazonUrl: sp.sourceUrl,
          lifecycleStage: "DISCOVERED",
          isActive: true,
        }).returning();
        productId = created.id;
        await db.insert(productLifecycleEvents).values({
          productId,
          fromStage: null,
          toStage: "DISCOVERED",
          actorName: user.name,
          reason: `Crawler: ${sp.sourceDomain} keşfi`,
          contextSnapshot: { sourceUrl: sp.sourceUrl, price: sp.price, storeCode },
        });
      }

      // Fiyat gözlemi
      if (sp.price !== null) {
        await db.insert(supplierOffers).values({
          productId,
          supplierName: sp.brand || sp.sourceDomain,
          sourceUrl: sp.sourceUrl,
          sourceDomain: sp.sourceDomain,
          unitPrice: Number(sp.price).toFixed(2),
          currency: sp.currency || "USD",
          inStock: sp.availability === "IN_STOCK",
          sourceType: "SCRAPER",
        });
      }

      await db.update(scrapedProducts).set({ status: "IMPORTED" }).where(eq(scrapedProducts.id, sp.id));
      results.push({ scrapedId: sp.id, productId, asin, title: sp.title });
    }

    await db.insert(auditLogs).values({
      actorName: user.name,
      storeCode,
      actionType: "CRAWL_IMPORT",
      targetEntity: `${results.length} ürün aktarıldı`,
      beforeState: `scrapedIds: ${scrapedIds.join(",")}`,
      afterState: "IMPORTED",
      details: `${results.length} crawler ürünü ürün kataloğuna aktarıldı.`,
    });

    return NextResponse.json({ imported: results.length, results, warnings });
  } catch (error: unknown) {
    return handleRouteError("POST /api/crawler/import", error);
  }
}
