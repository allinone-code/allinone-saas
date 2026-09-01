import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, supplierOffers, orders } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { handleRouteError } from "@/lib/apiResponse";
import { computePriceTrend } from "@/domain/productBackfill";
import {
  assessProductHealth,
  type LifecycleStage,
} from "@/domain/productIntelligence";

/**
 * GET /api/products — Ürün merkezli görünüm (Aşama 1)
 *
 * Bu uç nokta, ürünün TÜM yolculuğunu tek yerde toplar:
 *   kimlik → fiyat trendi → operasyonel gerçekleşme → kâr → yargı
 *
 * Önceki mimaride bu mümkün değildi: ürün diye bir varlık yoktu, sipariş
 * satırlarında tekrar eden metinler vardı. Buradaki her sayı FK garantili
 * bir JOIN'den gelir; metin eşleştirmesi yok.
 */
export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { searchParams } = new URL(req.url);
    const effectiveStore = resolveStoreScope(
      currentUser,
      searchParams.get("storeCode") || "ALL"
    );

    // Mağaza kapsamı sipariş tarafına uygulanır; ürün kataloğu ortaktır ama
    // ürünün P&L'i yalnızca yetkili olunan mağazanın siparişlerinden hesaplanır.
    const storeCondition =
      effectiveStore !== "ALL"
        ? sql`and ${orders.buyerStore} = ${effectiveStore}`
        : sql``;

    // Ürün başına operasyonel gerçekleşme — tek agregasyon, N+1 yok
    const factsRows = await db
      .select({
        productId: orders.productId,
        orderCount: sql<string>`count(*)`,
        unitsPurchased: sql<string>`coalesce(sum(${orders.quantity}), 0)`,
        unitsShipped: sql<string>`coalesce(sum(${orders.shippedToAmazon}), 0)`,
        unitsLost: sql<string>`coalesce(sum(
          ${orders.p1CancelQty} + ${orders.p2MissingQty}
          + ${orders.p3DefectiveQty} + ${orders.p4ExpiredQty}), 0)`,
        totalCost: sql<string>`coalesce(sum(${orders.totalCost}), 0)`,
        grossRevenue: sql<string>`coalesce(sum(
          ${orders.shippedToAmazon} * ${orders.sellingPrice}), 0)`,
        totalRefunds: sql<string>`coalesce(sum(${orders.refundAmount}), 0)`,
        lastOrderDate: sql<string>`max(${orders.orderDate})`,
      })
      .from(orders)
      .where(sql`${orders.productId} is not null ${storeCondition}`)
      .groupBy(orders.productId);

    const factsByProduct = new Map(factsRows.map((f) => [f.productId, f]));

    const [catalog, offerRows] = await Promise.all([
      db.select().from(products).orderBy(desc(products.updatedAt)),
      db
        .select({
          productId: supplierOffers.productId,
          unitPrice: supplierOffers.unitPrice,
          observedAt: supplierOffers.observedAt,
          supplierName: supplierOffers.supplierName,
        })
        .from(supplierOffers)
        .orderBy(supplierOffers.observedAt),
    ]);

    const offersByProduct = new Map<number, typeof offerRows>();
    for (const o of offerRows) {
      const bucket = offersByProduct.get(o.productId);
      if (bucket) bucket.push(o);
      else offersByProduct.set(o.productId, [o]);
    }

    const enriched = catalog.map((p) => {
      const facts = factsByProduct.get(p.id);
      const offers = offersByProduct.get(p.id) ?? [];

      const priceTrend = computePriceTrend(offers);

      const health = assessProductHealth({
        orderCount: Number(facts?.orderCount ?? 0),
        unitsPurchased: Number(facts?.unitsPurchased ?? 0),
        unitsShipped: Number(facts?.unitsShipped ?? 0),
        unitsLost: Number(facts?.unitsLost ?? 0),
        totalCost: Number(facts?.totalCost ?? 0),
        grossRevenue: Number(facts?.grossRevenue ?? 0),
        totalRefunds: Number(facts?.totalRefunds ?? 0),
        priceTrendPercent: priceTrend.changePercent,
        lifecycleStage: p.lifecycleStage as LifecycleStage,
      });

      return {
        id: p.id,
        asin: p.asin,
        title: p.title,
        brand: p.brand,
        imageUrl: p.imageUrl,
        amazonUrl: p.amazonUrl,
        lifecycleStage: p.lifecycleStage,
        isActive: p.isActive,
        discoveredAt: p.discoveredAt,

        priceTrend,
        latestPrice: priceTrend.latestPrice,
        offerCount: offers.length,
        supplierName: offers[offers.length - 1]?.supplierName ?? null,

        operations: {
          orderCount: Number(facts?.orderCount ?? 0),
          unitsPurchased: Number(facts?.unitsPurchased ?? 0),
          unitsShipped: Number(facts?.unitsShipped ?? 0),
          unitsLost: Number(facts?.unitsLost ?? 0),
          lastOrderDate: facts?.lastOrderDate ?? null,
        },

        pnl: health.pnl,
        verdict: health.verdict,
        verdictReasons: health.reasons,
        recommendedAction: health.recommendedAction,
        severity: health.severity,
      };
    });

    // Portföy özeti — yöneticinin tek bakışta göreceği tablo
    const summary = {
      totalProducts: enriched.length,
      byVerdict: enriched.reduce<Record<string, number>>((acc, p) => {
        acc[p.verdict] = (acc[p.verdict] ?? 0) + 1;
        return acc;
      }, {}),
      byStage: enriched.reduce<Record<string, number>>((acc, p) => {
        acc[p.lifecycleStage] = (acc[p.lifecycleStage] ?? 0) + 1;
        return acc;
      }, {}),
      buyingOpportunities: enriched.filter((p) => p.priceTrend.isBuyingOpportunity).length,
      totalNetProfit: Number(
        enriched.reduce((s, p) => s + (p.pnl.netProfit || 0), 0).toFixed(2)
      ),
      productsAtLoss: enriched.filter((p) => p.pnl.netProfit < 0).length,
    };

    return NextResponse.json({
      storeScope: effectiveStore,
      summary,
      products: enriched,
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/products", error);
  }
}
