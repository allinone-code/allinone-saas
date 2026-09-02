import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  productMasters,
  researchers,
  researchSessions,
  auditLogs,
  orders,
  products,
} from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { computeDecisionEngine } from "@/domain/decisionEngine";
import { buildMorningBriefing } from "@/domain/briefing";
import { computeRealizedRoi, computeRoiVariance } from "@/domain/realizedRoi";
import { computeFreshness, summarizeFreshness } from "@/domain/dataFreshness";
import { parseBody, intelligenceCreateSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { captureDiscoveredProduct } from "@/db/captureDiscoveredProduct";
import { STAGE_META, type LifecycleStage } from "@/domain/productIntelligence";


export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    // Mağaza kapsamı sunucuda çözülür (F-11): STORE_USER kendi mağazasının
    // brifingini görür, yönetici seçtiği kapsamı görür.
    const { searchParams } = new URL(req.url);
    const effectiveStore = resolveStoreScope(currentUser, searchParams.get("storeCode") || "ALL");
    const storeFilter = effectiveStore !== "ALL" ? eq(orders.buyerStore, effectiveStore) : undefined;

    // T8.2 — Brifing artık sabit metinlerden değil, SQL aggregate'lerinden üretilir.
    // Satırlar belleğe çekilmez; maliyet veri hacminden bağımsızdır.
    const orderFactsQuery = db
      .select({
        totalOrders: count(),
        totalUnits: sql<string>`coalesce(sum(${orders.quantity}), 0)`,
        totalSpend: sql<string>`coalesce(sum(${orders.totalCost}), 0)`,
        totalShippedToAmazon: sql<string>`coalesce(sum(${orders.shippedToAmazon}), 0)`,
        totalRefunds: sql<string>`coalesce(sum(${orders.refundAmount}), 0)`,
        p1CancelTotal: sql<string>`coalesce(sum(${orders.p1CancelQty}), 0)`,
        p2MissingTotal: sql<string>`coalesce(sum(${orders.p2MissingQty}), 0)`,
        p3DefectiveTotal: sql<string>`coalesce(sum(${orders.p3DefectiveQty}), 0)`,
        p4ExpiredTotal: sql<string>`coalesce(sum(${orders.p4ExpiredQty}), 0)`,
        estimatedRevenue: sql<string>`coalesce(sum(${orders.sellingPrice} * ${orders.quantity}), 0)`,
        unbatchedOrders: sql<string>`count(*) filter (where ${orders.pshBatchNo} is null or ${orders.pshBatchNo} = '')`,
        inTransitOrders: sql<string>`count(*) filter (where ${orders.cargoStatus} = 'Yolda')`,
        problemOrdersCount: sql<string>`count(*) filter (where
          ${orders.cargoStatus} = 'İPTAL'
          or ${orders.p1CancelQty} > 0
          or ${orders.p2MissingQty} > 0
          or ${orders.p3DefectiveQty} > 0
          or ${orders.p4ExpiredQty} > 0
          or ${orders.refundAmount} > 0)`,
      })
      .from(orders);

    const masterFactsQuery = db
      .select({
        totalMasters: count(),
        avgRoi: sql<string>`coalesce(avg(${productMasters.roiPercent}), 0)`,
        duplicateAlerts: sql<string>`count(*) filter (where ${productMasters.duplicateScore} >= 80)`,
        pendingPolicyApprovals: sql<string>`count(*) filter (where ${productMasters.policyStatus} = 'REQUIRES_MANAGER_APPROVAL')`,
      })
      .from(productMasters);

    const [masters, team, sessions, [orderFacts], [masterFacts], decisionRows, realizedRows] =
      await Promise.all([
        db.select().from(productMasters).orderBy(desc(productMasters.discoveredAt)),
        db.select().from(researchers).orderBy(desc(researchers.researcherScore)),
        db.select().from(researchSessions).orderBy(desc(researchSessions.startedAt)),
        storeFilter ? orderFactsQuery.where(storeFilter) : orderFactsQuery,
        masterFactsQuery,
        db
          .select({ key: productMasters.decisionAction, n: count() })
          .from(productMasters)
          .groupBy(productMasters.decisionAction),
        // Tazelik artık kayıtlı metin alanından değil, observedAt damgasından
        // hesaplanır (aşağıda). Bu sorgu yalnızca ASIN bazlı gerçekleşen ROI
        // için sipariş gerçeklerini toplar.
        db
          .select({
            asin: orders.asin,
            quantity: orders.quantity,
            unitCost: orders.unitCost,
            sellingPrice: orders.sellingPrice,
            totalCost: orders.totalCost,
            shippedToAmazon: orders.shippedToAmazon,
            p1CancelQty: orders.p1CancelQty,
            p2MissingQty: orders.p2MissingQty,
            p3DefectiveQty: orders.p3DefectiveQty,
            p4ExpiredQty: orders.p4ExpiredQty,
            refundAmount: orders.refundAmount,
            cargoStatus: orders.cargoStatus,
          })
          .from(orders),
      ]);

    const catalog = await db
      .select({ id: products.id, asin: products.asin, lifecycleStage: products.lifecycleStage })
      .from(products);
    const catalogById = new Map(catalog.map((p) => [p.id, p]));
    const catalogByAsin = new Map(catalog.map((p) => [p.asin, p]));

    const toCounts = (rows: Array<{ key: string; n: number }>) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.key] = Number(r.n);
        return acc;
      }, {});

    const now = new Date();

    // --- Gerçekleşen ROI: ASIN bazında fiili siparişlerden hesaplanır ---
    // Sabit katsayıyla (roiPercent * 0.96) uydurma dönemi bitti.
    const rowsByAsin = new Map<string, typeof realizedRows>();
    for (const r of realizedRows) {
      const key = (r.asin || "").toUpperCase();
      if (!key) continue;
      const bucket = rowsByAsin.get(key);
      if (bucket) bucket.push(r);
      else rowsByAsin.set(key, [r]);
    }

    const enrichedMasters = masters.map((m) => {
      const asinKey = (m.asin || "").toUpperCase();
      const realized = computeRealizedRoi(
        (rowsByAsin.get(asinKey) || []).map((r) => ({
          quantity: Number(r.quantity) || 0,
          unitCost: Number(r.unitCost) || 0,
          sellingPrice: Number(r.sellingPrice) || 0,
          totalCost: Number(r.totalCost) || 0,
          shippedToAmazon: Number(r.shippedToAmazon) || 0,
          p1CancelQty: Number(r.p1CancelQty) || 0,
          p2MissingQty: Number(r.p2MissingQty) || 0,
          p3DefectiveQty: Number(r.p3DefectiveQty) || 0,
          p4ExpiredQty: Number(r.p4ExpiredQty) || 0,
          refundAmount: Number(r.refundAmount) || 0,
          cargoStatus: r.cargoStatus || "",
        }))
      );

      const variance = computeRoiVariance(Number(m.roiPercent), realized.realizedRoiPercent);

      // Kanıt şeffaflığı: skorun hangi kısmı ölçüm, hangi kısmı varsayım?
      // Saf hesap, ucuz; DB'de saklamak yerine her istekte türetilir.
      const engine = computeDecisionEngine(
        Number(m.roiPercent) || 0,
        m.sourceDomain || "",
        Number(m.duplicateScore) || 0
      );
      const freshness = computeFreshness(m.observedAt, now);

      const linked =
        (m.productId != null ? catalogById.get(m.productId) : undefined) ??
        catalogByAsin.get(asinKey);
      const catalogStage = (linked?.lifecycleStage ?? null) as LifecycleStage | null;

      return {
        ...m,
        productId: m.productId ?? linked?.id ?? null,
        catalogStage,
        catalogStageLabel: catalogStage ? STAGE_META[catalogStage]?.label ?? catalogStage : null,
        // Ölçülemiyorsa null kalır — arayüz "henüz ölçülmedi" gösterir.
        actualRoiPercent:
          realized.realizedRoiPercent === null
            ? null
            : realized.realizedRoiPercent.toFixed(2),
        realizedRoi: realized,
        roiVariance: variance,
        // Kayıtlı metni değil, hesaplanan tazeliği döndürüyoruz.
        dataFreshnessStatus: freshness.status,
        freshness,
        evidenceCoverage: engine.evidenceCoverage,
        assumedAxes: engine.assumedAxes,
        signals: engine.signals,
      };
    });

    // Sağlık skorunun tazelik ekseni artık canlı hesaptan beslenir.
    const freshnessCounts = summarizeFreshness(
      masters.map((m) => m.observedAt),
      now
    );

    const morningBriefing = buildMorningBriefing(
      {
        totalOrders: Number(orderFacts?.totalOrders || 0),
        totalUnits: Number(orderFacts?.totalUnits || 0),
        totalSpend: Number(orderFacts?.totalSpend || 0),
        totalShippedToAmazon: Number(orderFacts?.totalShippedToAmazon || 0),
        totalRefunds: Number(orderFacts?.totalRefunds || 0),
        problemOrdersCount: Number(orderFacts?.problemOrdersCount || 0),
        p1CancelTotal: Number(orderFacts?.p1CancelTotal || 0),
        p2MissingTotal: Number(orderFacts?.p2MissingTotal || 0),
        p3DefectiveTotal: Number(orderFacts?.p3DefectiveTotal || 0),
        p4ExpiredTotal: Number(orderFacts?.p4ExpiredTotal || 0),
        estimatedRevenue: Number(orderFacts?.estimatedRevenue || 0),
        unbatchedOrders: Number(orderFacts?.unbatchedOrders || 0),
        inTransitOrders: Number(orderFacts?.inTransitOrders || 0),
      },
      {
        totalMasters: Number(masterFacts?.totalMasters || 0),
        avgRoiPercent: Number(masterFacts?.avgRoi || 0),
        decisionCounts: toCounts(decisionRows),
        freshnessCounts,
        duplicateAlerts: Number(masterFacts?.duplicateAlerts || 0),
        pendingPolicyApprovals: Number(masterFacts?.pendingPolicyApprovals || 0),
      }
    );

    return NextResponse.json({
      storeScope: effectiveStore,
      productMasters: enrichedMasters,
      researchers: team,
      researchSessions: sessions,
      morningBriefing,
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/intelligence", error);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    // Zod doğrulama (T3.1)
    const parsed = await parseBody(req, intelligenceCreateSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    let captured;
    try {
      captured = await db.transaction((tx) =>
        captureDiscoveredProduct(tx, {
          title: body.title,
          asin: body.asin,
          brand: body.brand,
          category: body.category,
          upc: body.upc,
          sourceUrl: body.sourceUrl,
          sourcePrice: body.sourcePrice,
          sellingPrice: body.sellingPrice,
          prepCost: body.prepCost,
          researcherName: body.researcherName,
          researcherCode: body.researcherCode,
          supplierName: body.supplierName,
          notes: body.notes,
          actorName: currentUser.name || currentUser.email,
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Keşif kaydı yazılamadı.";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    await db.insert(auditLogs).values({
      actorName: currentUser.name,
      storeCode: currentUser.storeCode === "ALL" ? "HRN" : currentUser.storeCode,
      actionType: "DECISION_ENGINE_CAPTURE",
      targetEntity: `product:${captured.productId} master:${captured.masterId}`,
      beforeState: captured.createdProduct ? "NEW_DISCOVERY" : "EXISTING_PRODUCT",
      afterState: `${captured.decision.decisionAction} @ ${captured.lifecycleStage}`,
      details: `Keşif kaydı. Karar: ${captured.decision.decisionAction}. Durak: ${captured.lifecycleStage}. Mükerrer: ${captured.duplicate}`,
    });

    return NextResponse.json({
      message: `Keşif kaydı oluşturuldu. Decision Engine: ${captured.decision.decisionAction}`,
      productId: captured.productId,
      masterId: captured.masterId,
      lifecycleStage: captured.lifecycleStage,
      decision: captured.decision.decisionAction,
      decisionEngine: captured.decision,
      createdProduct: captured.createdProduct,
      duplicate: captured.duplicate,
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/intelligence", error);
  }
}
