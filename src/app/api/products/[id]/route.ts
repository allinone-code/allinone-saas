import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  products,
  supplierOffers,
  productLifecycleEvents,
  orders,
  auditLogs,
} from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { requireUser, requireRole, isDenied, resolveStoreScope } from "@/lib/guards";
import { handleRouteError } from "@/lib/apiResponse";
import { computePriceTrend } from "@/domain/productBackfill";
import {
  assessProductHealth,
  isValidTransition,
  STAGE_META,
  LIFECYCLE_STAGES,
  type LifecycleStage,
} from "@/domain/productIntelligence";

/**
 * GET /api/products/[id] — Bir ürünün TÜM hikâyesi (Aşama 2)
 *
 * Liste uç noktası portföyü özetler; burası tek ürünü derinlemesine anlatır:
 *   kimlik → fiyat serisi → sipariş geçmişi → operasyon → P&L → olay defteri
 *
 * Cerberus'un "hafızası" bu uç noktada görünür hale gelir: ürünün hangi
 * duraktan hangi durağa, kim tarafından, neden geçtiği kalıcı olarak okunur.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: "Geçersiz ürün kimliği" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const effectiveStore = resolveStoreScope(
      currentUser,
      searchParams.get("storeCode") || "ALL"
    );

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    // Mağaza kapsamı: katalog ortaktır ama P&L yalnızca yetkili mağazadan.
    const storeCondition =
      effectiveStore !== "ALL"
        ? sql`and ${orders.buyerStore} = ${effectiveStore}`
        : sql``;

    const [offers, orderRows, events] = await Promise.all([
      db
        .select()
        .from(supplierOffers)
        .where(eq(supplierOffers.productId, productId))
        .orderBy(asc(supplierOffers.observedAt)),
      db
        .select()
        .from(orders)
        .where(sql`${orders.productId} = ${productId} ${storeCondition}`)
        .orderBy(desc(orders.orderDate)),
      db
        .select()
        .from(productLifecycleEvents)
        .where(eq(productLifecycleEvents.productId, productId))
        .orderBy(desc(productLifecycleEvents.occurredAt)),
    ]);

    // Operasyonel gerçekleşme — sipariş satırlarından toplanır
    const num = (v: unknown) => Number(v ?? 0) || 0;
    const facts = orderRows.reduce(
      (acc, o) => {
        acc.orderCount += 1;
        acc.unitsPurchased += num(o.quantity);
        acc.unitsShipped += num(o.shippedToAmazon);
        acc.unitsLost +=
          num(o.p1CancelQty) + num(o.p2MissingQty) + num(o.p3DefectiveQty) + num(o.p4ExpiredQty);
        acc.totalCost += num(o.totalCost);
        acc.grossRevenue += num(o.shippedToAmazon) * num(o.sellingPrice);
        acc.totalRefunds += num(o.refundAmount);
        return acc;
      },
      {
        orderCount: 0,
        unitsPurchased: 0,
        unitsShipped: 0,
        unitsLost: 0,
        totalCost: 0,
        grossRevenue: 0,
        totalRefunds: 0,
      }
    );

    const priceTrend = computePriceTrend(offers);
    const stage = product.lifecycleStage as LifecycleStage;

    const health = assessProductHealth({
      ...facts,
      priceTrendPercent: priceTrend.changePercent,
      lifecycleStage: stage,
    });

    // Fire dökümü — hangi problem tipi ne kadar? Operasyonu düzeltmek için
    // "fire %50" yetmez; nedeni gerekir.
    const lossBreakdown = orderRows.reduce(
      (acc, o) => {
        acc.p1Cancel += num(o.p1CancelQty);
        acc.p2Missing += num(o.p2MissingQty);
        acc.p3Defective += num(o.p3DefectiveQty);
        acc.p4Expired += num(o.p4ExpiredQty);
        return acc;
      },
      { p1Cancel: 0, p2Missing: 0, p3Defective: 0, p4Expired: 0 }
    );

    // Tedarikçi karşılaştırması: aynı ürünü kimden kaça alıyoruz?
    const bySupplier = new Map<string, { count: number; min: number; max: number; last: number }>();
    for (const o of offers) {
      const price = Number(o.unitPrice);
      const cur = bySupplier.get(o.supplierName);
      if (cur) {
        cur.count += 1;
        cur.min = Math.min(cur.min, price);
        cur.max = Math.max(cur.max, price);
        cur.last = price;
      } else {
        bySupplier.set(o.supplierName, { count: 1, min: price, max: price, last: price });
      }
    }
    const suppliers = [...bySupplier.entries()]
      .map(([name, s]) => ({ supplierName: name, ...s }))
      .sort((a, b) => a.last - b.last);

    return NextResponse.json({
      storeScope: effectiveStore,
      product: {
        id: product.id,
        asin: product.asin,
        upc: product.upc,
        title: product.title,
        brand: product.brand,
        category: product.category,
        imageUrl: product.imageUrl,
        amazonUrl: product.amazonUrl,
        lifecycleStage: stage,
        stageLabel: STAGE_META[stage]?.label ?? stage,
        allowedNextStages: (STAGE_META[stage]?.next ?? []).map((s) => ({
          stage: s,
          label: STAGE_META[s].label,
        })),
        isTerminal: STAGE_META[stage]?.isTerminal ?? false,
        isActive: product.isActive,
        packCount: product.packCount,
        isFragile: product.isFragile,
        isMultiPack: product.isMultiPack,
        isBundle: product.isBundle,
        discoveredAt: product.discoveredAt,
        updatedAt: product.updatedAt,
      },
      priceTrend,
      priceSeries: offers.map((o) => ({
        id: o.id,
        observedAt: o.observedAt,
        unitPrice: Number(o.unitPrice),
        supplierName: o.supplierName,
        sourceDomain: o.sourceDomain,
        sourceType: o.sourceType,
      })),
      suppliers,
      operations: { ...facts, lossBreakdown },
      pnl: health.pnl,
      verdict: health.verdict,
      verdictReasons: health.reasons,
      recommendedAction: health.recommendedAction,
      severity: health.severity,
      orders: orderRows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate,
        buyerStore: o.buyerStore,
        supplierName: o.supplierName,
        quantity: o.quantity,
        shippedToAmazon: o.shippedToAmazon,
        unitCost: o.unitCost,
        sellingPrice: o.sellingPrice,
        totalCost: o.totalCost,
        refundAmount: o.refundAmount,
        cargoStatus: o.cargoStatus,
        pshStatus: o.pshStatus,
      })),
      timeline: events.map((e) => ({
        id: e.id,
        fromStage: e.fromStage,
        fromLabel: e.fromStage ? STAGE_META[e.fromStage as LifecycleStage]?.label ?? e.fromStage : null,
        toStage: e.toStage,
        toLabel: STAGE_META[e.toStage as LifecycleStage]?.label ?? e.toStage,
        actorName: e.actorName,
        reason: e.reason,
        contextSnapshot: e.contextSnapshot,
        occurredAt: e.occurredAt,
      })),
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/products/[id]", error);
  }
}

/**
 * PATCH /api/products/[id] — Yaşam döngüsü durağını ilerlet (Aşama 2)
 *
 * Bu uç nokta ürün yolculuğunun kalbidir. Üç güvence verir:
 *  1. Geçiş kurallara uygun mu? (STAGE_META.next) — keyfî sıçrama yok.
 *  2. Her geçiş bir OLAY olarak kalıcı yazılır — Cerberus hafızasını büyütür.
 *  3. O anki ürün durumu snapshot olarak saklanır — "o karar neye bakarak
 *     verildi?" sorusu aylar sonra cevaplanabilir.
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Durak değiştirmek sermaye taahhüdü doğuran bir karardır.
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { id } = await context.params;
    const productId = Number(id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ error: "Geçersiz ürün kimliği" }, { status: 400 });
    }

    let body: { toStage?: string; reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
    }

    const toStage = String(body.toStage ?? "").trim().toUpperCase() as LifecycleStage;
    const reason = String(body.reason ?? "").trim();

    if (!LIFECYCLE_STAGES.includes(toStage)) {
      return NextResponse.json(
        {
          error: "Geçersiz yaşam döngüsü durağı.",
          allowedStages: LIFECYCLE_STAGES,
        },
        { status: 422 }
      );
    }

    // Gerekçe zorunlu: gerekçesiz karar, aylar sonra okunamayan karardır.
    if (reason.length < 3) {
      return NextResponse.json(
        { error: "Durak değişikliği için gerekçe zorunludur (en az 3 karakter)." },
        { status: 422 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) return { notFound: true as const };

      const fromStage = product.lifecycleStage as LifecycleStage;

      if (fromStage === toStage) {
        return { noop: true as const, fromStage };
      }

      if (!isValidTransition(fromStage, toStage)) {
        return {
          invalid: true as const,
          fromStage,
          allowed: STAGE_META[fromStage]?.next ?? [],
        };
      }

      // O anki operasyonel gerçekliği snapshot'a yazmak için özet çek
      const [snapshot] = await tx
        .select({
          orderCount: sql<string>`count(*)`,
          unitsPurchased: sql<string>`coalesce(sum(${orders.quantity}), 0)`,
          unitsShipped: sql<string>`coalesce(sum(${orders.shippedToAmazon}), 0)`,
          totalCost: sql<string>`coalesce(sum(${orders.totalCost}), 0)`,
        })
        .from(orders)
        .where(eq(orders.productId, productId));

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
          actorName: currentUser.name || currentUser.email,
          reason,
          contextSnapshot: {
            asin: product.asin,
            orderCount: Number(snapshot?.orderCount ?? 0),
            unitsPurchased: Number(snapshot?.unitsPurchased ?? 0),
            unitsShipped: Number(snapshot?.unitsShipped ?? 0),
            totalCost: Number(snapshot?.totalCost ?? 0),
            actorRole: currentUser.role,
          },
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorName: currentUser.name || currentUser.email,
        storeCode: currentUser.storeCode || "ALL",
        actionType: "PRODUCT_STAGE_CHANGE",
        targetEntity: `product:${productId}:${product.asin}`,
        beforeState: fromStage,
        afterState: toStage,
        details: `${STAGE_META[fromStage]?.label ?? fromStage} → ${
          STAGE_META[toStage]?.label ?? toStage
        } — ${reason}`,
      });

      return { ok: true as const, fromStage, event };
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }
    if ("noop" in result) {
      return NextResponse.json(
        { error: `Ürün zaten "${STAGE_META[result.fromStage]?.label}" durağında.` },
        { status: 422 }
      );
    }
    if ("invalid" in result) {
      return NextResponse.json(
        {
          error: `Geçersiz geçiş: "${STAGE_META[result.fromStage]?.label}" durağından "${
            STAGE_META[toStage]?.label
          }" durağına doğrudan geçilemez.`,
          allowedNextStages: (result.allowed ?? []).map((s) => ({
            stage: s,
            label: STAGE_META[s].label,
          })),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      message: `Ürün "${STAGE_META[toStage]?.label}" durağına taşındı.`,
      fromStage: result.fromStage,
      toStage,
      event: result.event,
    });
  } catch (error: unknown) {
    return handleRouteError("PATCH /api/products/[id]", error);
  }
}
