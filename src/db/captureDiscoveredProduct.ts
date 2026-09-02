/**
 * Aşama 3 — Keşif kaydının tek yazma kapısı.
 *
 * POST /api/intelligence bu fonksiyonu çağırır. Karar kasası ve ürün
 * kataloğu aynı transaction'da doğar; biri yazılıp diğeri unutulamaz.
 */
import { eq, sql } from "drizzle-orm";
import {
  products,
  supplierOffers,
  productLifecycleEvents,
  productMasters,
} from "./schema";
import { normalizeAsin } from "./resolveProduct";
import { extractDomain } from "@/domain/productBackfill";
import {
  calculateLandedCostAndProfit,
  computeDecisionEngine,
  type DecisionEngineResult,
} from "@/domain/decisionEngine";
import { computeFreshness } from "@/domain/dataFreshness";
import { scoringWalk, type DecisionAction } from "@/domain/discoveryPipeline";
import { applyHops } from "./advanceStage";
import type { LifecycleStage } from "@/domain/productIntelligence";

export interface CaptureInput {
  title: string;
  asin: string;
  brand?: string | null;
  category?: string | null;
  upc?: string | null;
  sourceUrl?: string | null;
  sourcePrice: number;
  sellingPrice: number;
  prepCost?: number | null;
  researcherName?: string | null;
  researcherCode?: string | null;
  supplierName?: string | null;
  notes?: string | null;
  actorName: string;
}

export interface CaptureResult {
  productId: number;
  masterId: number;
  createdProduct: boolean;
  createdMaster: boolean;
  duplicate: boolean;
  decision: DecisionEngineResult;
  lifecycleStage: LifecycleStage;
}

function parseResearcher(name: string | null | undefined, code?: string | null) {
  const raw = String(name ?? "").trim() || "Ahmet Kaya (SRC-01)";
  if (code) return { researcherName: raw, researcherCode: code };
  const match = raw.match(/\(([^)]+)\)/);
  return {
    researcherName: raw,
    researcherCode: match?.[1] ?? "SRC-01",
  };
}

export async function captureDiscoveredProduct(
  tx: any,
  input: CaptureInput
): Promise<CaptureResult> {
  const asin = normalizeAsin(input.asin);
  if (!asin) {
    throw new Error("Keşif kaydı ASIN olmadan kataloga yazılamaz.");
  }

  const title = String(input.title ?? "").trim();
  if (!title) {
    throw new Error("Keşif kaydı ürün başlığı olmadan yazılamaz.");
  }

  const sourcePrice = Number(input.sourcePrice);
  const sellingPrice = Number(input.sellingPrice);
  if (!Number.isFinite(sourcePrice) || sourcePrice < 0) {
    throw new Error("Alış fiyatı geçersiz.");
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new Error("Satış fiyatı geçersiz.");
  }

  let sourceDomain = "us-retail.com";
  try {
    if (input.sourceUrl) {
      sourceDomain = new URL(input.sourceUrl).hostname.replace(/^www\./, "");
    }
  } catch {
    // bozuk URL keşfi durdurmaz; alan adı sezgisel kalır
  }

  const [existingProduct] = await tx
    .select({ id: products.id, lifecycleStage: products.lifecycleStage })
    .from(products)
    .where(eq(products.asin, asin))
    .limit(1);

  let productId: number;
  let createdProduct = false;
  let duplicate = Boolean(existingProduct);

  if (existingProduct) {
    productId = existingProduct.id;
  } else {
    const brand = String(input.brand ?? "").trim().toUpperCase() || "GENERAL";
    const [inserted] = await tx
      .insert(products)
      .values({
        asin,
        upc: input.upc ?? null,
        title,
        brand,
        category: String(input.category ?? "").trim() || "UNCATEGORIZED",
        amazonUrl: `https://www.amazon.com/dp/${asin}`,
        lifecycleStage: "DISCOVERED",
      })
      .onConflictDoUpdate({
        target: products.asin,
        set: { updatedAt: new Date() },
      })
      .returning({ id: products.id, lifecycleStage: products.lifecycleStage });

    productId = inserted.id;
    createdProduct = true;

    await tx.insert(productLifecycleEvents).values({
      productId,
      fromStage: null,
      toStage: "DISCOVERED",
      actorName: input.actorName,
      reason: "Araştırmacı keşif kaydı",
      contextSnapshot: {
        asin,
        sourceUrl: input.sourceUrl ?? null,
        sourcePrice,
        sellingPrice,
      },
    });
  }

  // Aynı ASIN kasa kaydında da varsa mükerrer emektir — karar WAIT'e çekilir.
  const [existingMasterByAsin] = await tx
    .select({ id: productMasters.id, productId: productMasters.productId })
    .from(productMasters)
    .where(sql`upper(${productMasters.asin}) = ${asin}`)
    .limit(1);
  if (existingMasterByAsin) duplicate = true;

  const duplicateScore = duplicate ? 96 : 12;
  const duplicateStatus = duplicate ? "EXACT_DUPLICATE" : "CLEAR";

  const prepCost = Number(input.prepCost) || 1.35;
  const landed = calculateLandedCostAndProfit(sourcePrice, sellingPrice, prepCost);
  const decision = computeDecisionEngine(landed.roiPercent, sourceDomain, duplicateScore);

  const [productNow] = await tx
    .select({ lifecycleStage: products.lifecycleStage, asin: products.asin })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  const fromStage = productNow.lifecycleStage as LifecycleStage;

  const hops = scoringWalk(fromStage, decision.decisionAction as DecisionAction, landed.roiPercent);
  if (hops.length > 0) {
    const walked = await applyHops(tx, productId, hops, "SYSTEM", {
      asin,
      decision: decision.decisionAction,
      opportunityScore: decision.opportunityScore,
      roiPercent: landed.roiPercent,
      evidenceCoverage: decision.evidenceCoverage,
    });
    if ("invalid" in walked || "notFound" in walked) {
      throw new Error("Keşif hattı durak geçişini uygulayamadı.");
    }
  }

  const [after] = await tx
    .select({ lifecycleStage: products.lifecycleStage })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  const lifecycleStage = after.lifecycleStage as LifecycleStage;

  const supplierName = String(input.supplierName ?? "").trim() || "US Sourcing Vendor";
  const unitPrice = sourcePrice.toFixed(2);
  const observedAt = new Date();
  const [dupOffer] = await tx
    .select({ id: supplierOffers.id })
    .from(supplierOffers)
    .where(
      sql`${supplierOffers.productId} = ${productId}
          and ${supplierOffers.supplierName} = ${supplierName}
          and ${supplierOffers.unitPrice} = ${unitPrice}
          and date(${supplierOffers.observedAt}) = date(${observedAt})`
    )
    .limit(1);
  if (!dupOffer) {
    await tx.insert(supplierOffers).values({
      productId,
      supplierName,
      sourceUrl: input.sourceUrl ?? null,
      sourceDomain: extractDomain(input.sourceUrl) ?? sourceDomain,
      unitPrice,
      observedAt,
      sourceType: "MANUAL",
    });
  }

  const { researcherName, researcherCode } = parseResearcher(
    input.researcherName,
    input.researcherCode
  );
  const sourceUrl = input.sourceUrl || `https://www.amazon.com/dp/${asin}`;
  const productCode = `CRB-2026-${String(9000 + productId).slice(-4)}`;

  const masterValues = {
    productId,
    title,
    brand: String(input.brand ?? "").trim().toUpperCase() || "GENERAL",
    category: String(input.category ?? "").trim() || "General Retail",
    upc: String(input.upc ?? "").trim() || "000000000000",
    asin,
    msku: `${String(input.brand ?? "GEN").slice(0, 3).toUpperCase()}-${asin.slice(-4)}`,
    sourceUrl,
    sourceDomain,
    supplierName,
    researcherCode,
    researcherName,
    lifecycleStage,
    dataQualityStatus: duplicate ? "CONFLICTING" : "VALID",
    dataFreshnessStatus: computeFreshness(observedAt).status,
    observedAt,
    decisionAction: decision.decisionAction,
    confidenceScore: decision.confidenceScore,
    riskLevel: decision.riskLevel,
    policyStatus: decision.policyStatus,
    sourcePrice: sourcePrice.toFixed(2),
    prepCost: prepCost.toFixed(2),
    marketplaceFee: landed.marketplaceFee.toFixed(2),
    fulfillmentFee: landed.fulfillmentFee.toFixed(2),
    landedCost: landed.landedCost.toFixed(2),
    sellingPrice: sellingPrice.toFixed(2),
    estimatedNetProfit: landed.estimatedNetProfit.toFixed(2),
    roiPercent: landed.roiPercent.toFixed(2),
    actualRoiPercent: null as string | null,
    duplicateScore,
    duplicateStatus,
    profitabilityScore: decision.profitabilityScore,
    demandScore: decision.demandScore,
    competitionScore: decision.competitionScore,
    priceStabilityScore: decision.priceStabilityScore,
    supplierRiskScore: decision.supplierRiskScore,
    operationalRiskScore: decision.operationalRiskScore,
    opportunityScore: decision.opportunityScore,
    evidenceChain: [
      {
        claim: `Landed Cost $${landed.landedCost} ve %${landed.roiPercent} tahmini ROI — Decision Engine: ${decision.decisionAction}`,
        source: `${sourceDomain} keşif kaydı`,
        observedAt: observedAt.toISOString(),
        confidence: `${decision.confidenceScore}%`,
      },
    ],
    channelListings: [],
    costHistory: [
      {
        date: observedAt.toISOString().split("T")[0],
        sourcePrice,
        landedCost: landed.landedCost,
        sellingPrice,
        roi: landed.roiPercent,
      },
    ],
    notes: input.notes ?? "",
    updatedAt: observedAt,
  };

  const [existingMaster] = await tx
    .select({ id: productMasters.id })
    .from(productMasters)
    .where(eq(productMasters.productId, productId))
    .limit(1);

  const reusableMasterId = existingMaster?.id
    ?? (existingMasterByAsin && (!existingMasterByAsin.productId || existingMasterByAsin.productId === productId)
      ? existingMasterByAsin.id
      : null);

  let masterId: number;
  let createdMaster = false;
  if (reusableMasterId) {
    const [updated] = await tx
      .update(productMasters)
      .set(masterValues)
      .where(eq(productMasters.id, reusableMasterId))
      .returning({ id: productMasters.id });
    masterId = updated.id;
  } else {
    const [inserted] = await tx
      .insert(productMasters)
      .values({ ...masterValues, productCode })
      .returning({ id: productMasters.id });
    masterId = inserted.id;
    createdMaster = true;
  }

  return {
    productId,
    masterId,
    createdProduct,
    createdMaster,
    duplicate,
    decision,
    lifecycleStage,
  };
}
