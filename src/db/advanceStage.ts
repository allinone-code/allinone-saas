/**
 * Aşama 2/3 — durak geçişinin tek yazma kapısı.
 *
 * PATCH /api/products/[id], keşif hattı ve sipariş çözümleyici aynı
 * fonksiyonu çağırır. Aksi halde üç yol üç farklı olay formatı üretir
 * ve Cerberus'un hafızası parçalanır.
 */
import { eq, sql } from "drizzle-orm";
import { products, productLifecycleEvents, orders } from "./schema";
import {
  isValidTransition,
  STAGE_META,
  type LifecycleStage,
} from "@/domain/productIntelligence";
import type { StageHop } from "@/domain/discoveryPipeline";

export interface AdvanceStageArgs {
  productId: number;
  toStage: LifecycleStage;
  reason: string;
  actorName: string;
  snapshot?: Record<string, unknown>;
}

export type AdvanceStageResult =
  | { ok: true; fromStage: LifecycleStage; toStage: LifecycleStage }
  | { notFound: true }
  | { noop: true; fromStage: LifecycleStage }
  | { invalid: true; fromStage: LifecycleStage; allowed: LifecycleStage[] };

export async function advanceStage(tx: any, args: AdvanceStageArgs): Promise<AdvanceStageResult> {
  const [product] = await tx
    .select()
    .from(products)
    .where(eq(products.id, args.productId))
    .limit(1);

  if (!product) return { notFound: true };

  const fromStage = product.lifecycleStage as LifecycleStage;
  if (fromStage === args.toStage) return { noop: true, fromStage };
  if (!isValidTransition(fromStage, args.toStage)) {
    return { invalid: true, fromStage, allowed: STAGE_META[fromStage]?.next ?? [] };
  }

  let snapshot = args.snapshot;
  if (!snapshot) {
    const [row] = await tx
      .select({
        orderCount: sql<string>`count(*)`,
        unitsPurchased: sql<string>`coalesce(sum(${orders.quantity}), 0)`,
        unitsShipped: sql<string>`coalesce(sum(${orders.shippedToAmazon}), 0)`,
        totalCost: sql<string>`coalesce(sum(${orders.totalCost}), 0)`,
      })
      .from(orders)
      .where(eq(orders.productId, args.productId));
    snapshot = {
      asin: product.asin,
      orderCount: Number(row?.orderCount ?? 0),
      unitsPurchased: Number(row?.unitsPurchased ?? 0),
      unitsShipped: Number(row?.unitsShipped ?? 0),
      totalCost: Number(row?.totalCost ?? 0),
    };
  }

  await tx
    .update(products)
    .set({ lifecycleStage: args.toStage, updatedAt: new Date() })
    .where(eq(products.id, args.productId));

  await tx.insert(productLifecycleEvents).values({
    productId: args.productId,
    fromStage,
    toStage: args.toStage,
    actorName: args.actorName,
    reason: args.reason,
    contextSnapshot: { asin: product.asin, ...snapshot },
  });

  return { ok: true, fromStage, toStage: args.toStage };
}

/**
 * Yasal hop listesini sırayla uygular. İlk başarısız hop'ta durur
 * (çağıran transaction'ı geri almalıdır).
 */
export async function applyHops(
  tx: any,
  productId: number,
  hops: StageHop[],
  actorName: string,
  snapshot?: Record<string, unknown>
): Promise<AdvanceStageResult | { ok: true; applied: number; finalStage: LifecycleStage | null }> {
  if (hops.length === 0) return { ok: true, applied: 0, finalStage: null };

  let applied = 0;
  let lastStage: LifecycleStage | null = null;
  for (const hop of hops) {
    const result = await advanceStage(tx, {
      productId,
      toStage: hop.to,
      reason: hop.reason,
      actorName,
      snapshot,
    });
    if (!("ok" in result) || !("toStage" in result)) return result;
    applied += 1;
    lastStage = result.toStage;
  }
  return { ok: true, applied, finalStage: lastStage };
}
