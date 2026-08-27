import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/db";
import {
  stores,
  researchers,
  suppliers,
  productDiscoveries,
  problems,
  auditLogs,
} from "@/db/schema";
import { ensureCerberusSeeded } from "@/db/seed";
import { desc } from "drizzle-orm";
import {
  INITIAL_DISCOVERIES,
  INITIAL_PROBLEMS,
  INITIAL_RESEARCHERS,
  INITIAL_STORES,
  INITIAL_SUPPLIERS,
  INITIAL_AUDIT_LOGS,
} from "@/lib/mockData";

// In-memory runtime cache for fallback / offline mode
let runtimeDiscoveries: any[] = [...INITIAL_DISCOVERIES];
let runtimeProblems: any[] = [...INITIAL_PROBLEMS];
let runtimeAuditLogs: any[] = [...INITIAL_AUDIT_LOGS];

function calculateLandedCostAndProfit(
  sourcePrice: number,
  sellingPrice: number,
  sourceShipping = 0,
  prepCost = 1.35
) {
  const marketplaceFee = Number((sellingPrice * 0.15).toFixed(2));
  const fulfillmentFee = Number(
    (sellingPrice > 100 ? 7.45 : sellingPrice > 45 ? 5.8 : 4.15).toFixed(2)
  );
  const otherCost = 0.5;
  const landedCost = Number(
    (sourcePrice + sourceShipping + prepCost + marketplaceFee + fulfillmentFee + otherCost).toFixed(2)
  );
  const estimatedNetProfit = Number((sellingPrice - landedCost).toFixed(2));
  const roiPercent =
    landedCost > 0 ? Number(((estimatedNetProfit / landedCost) * 100).toFixed(2)) : 0;

  return {
    marketplaceFee,
    fulfillmentFee,
    otherCost,
    landedCost,
    estimatedNetProfit,
    roiPercent,
  };
}

function computeOpportunityRadar(roiPercent: number, sourceDomain: string) {
  const profitabilityScore = Math.min(
    99,
    Math.max(25, Math.round(55 + roiPercent * 0.6))
  );
  const demandScore = sourceDomain.includes("homedepot") || sourceDomain.includes("ulta")
    ? 93
    : 84;
  const competitionScore = roiPercent > 50 ? 82 : 68;
  const priceStabilityScore = 86;
  const supplierRiskScore = 91;
  const operationalRiskScore = 88;

  const opportunityScore = Math.round(
    profitabilityScore * 0.28 +
      demandScore * 0.22 +
      competitionScore * 0.15 +
      priceStabilityScore * 0.13 +
      supplierRiskScore * 0.12 +
      operationalRiskScore * 0.1
  );

  let aiRecommendation = "HIGH_MARGIN_SCALER";
  if (opportunityScore < 60 || roiPercent < 15) {
    aiRecommendation = "HOLD_FOR_PRICE_DROP";
  } else if (opportunityScore >= 80) {
    aiRecommendation = "APPROVED_FOR_PURCHASE";
  }

  return {
    profitabilityScore,
    demandScore,
    competitionScore,
    priceStabilityScore,
    supplierRiskScore,
    operationalRiskScore,
    opportunityScore,
    aiRecommendation,
  };
}

export async function GET() {
  try {
    let allDiscoveries: any[] = [];
    let allStores: any[] = [];
    let allResearchers: any[] = [];
    let allSuppliers: any[] = [];
    let allProblems: any[] = [];
    let allAuditLogs: any[] = [];
    let dbConnected = false;
    let dbMessage = "";

    try {
      await ensureCerberusSeeded();

      [
        allDiscoveries,
        allStores,
        allResearchers,
        allSuppliers,
        allProblems,
        allAuditLogs,
      ] = await Promise.all([
        db.select().from(productDiscoveries).orderBy(desc(productDiscoveries.discoveredAt)),
        db.select().from(stores).orderBy(stores.storeCode),
        db.select().from(researchers).orderBy(desc(researchers.researcherScore)),
        db.select().from(suppliers).orderBy(desc(suppliers.supplierScore)),
        db.select().from(problems).orderBy(desc(problems.openedAt)),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
      ]);

      if (allDiscoveries.length > 0) {
        dbConnected = true;
        dbMessage = "Connected to live PostgreSQL database.";
      }
    } catch (dbErr: any) {
      console.warn("PostgreSQL connection or table query failed, serving fallback data:", dbErr.message);
      dbConnected = false;
      dbMessage = isDatabaseConfigured
        ? `Veritabanı tablosu bulunamadı. Lütfen "npx drizzle-kit push" komutunu çalıştırın. (${dbErr.message})`
        : "DATABASE_URL ortam değişkeni tanımlanmadı. Sistem demo/fallback modunda çalışıyor.";

      allDiscoveries = runtimeDiscoveries;
      allStores = INITIAL_STORES;
      allResearchers = INITIAL_RESEARCHERS;
      allSuppliers = INITIAL_SUPPLIERS;
      allProblems = runtimeProblems;
      allAuditLogs = runtimeAuditLogs;
    }

    const totalGrossSales = allStores.reduce(
      (sum, s) => sum + Number(s.monthlyGrossRevenue || 0),
      0
    );
    const totalMonthlyNetProfit = allStores.reduce(
      (sum, s) => sum + Number(s.monthlyNetProfit || 0),
      0
    );
    const totalActiveListings = allStores.reduce(
      (sum, s) => sum + Number(s.activeListings || 0),
      0
    );
    const avgRoi =
      allDiscoveries.length > 0
        ? allDiscoveries.reduce((sum, d) => sum + Number(d.roiPercent || 0), 0) /
          allDiscoveries.length
        : 0;

    const openProblemsCount = allProblems.filter(
      (p) => p.status === "OPEN" || p.status === "IN_PROGRESS"
    ).length;

    return NextResponse.json({
      dbStatus: {
        connected: dbConnected,
        message: dbMessage,
      },
      discoveries: allDiscoveries,
      stores: allStores,
      researchers: allResearchers,
      suppliers: allSuppliers,
      problems: allProblems,
      auditLogs: allAuditLogs,
      executiveKpis: {
        totalGrossSales: totalGrossSales.toFixed(2),
        totalMonthlyNetProfit: totalMonthlyNetProfit.toFixed(2),
        totalActiveProducts: allDiscoveries.length,
        totalActiveListings,
        averageRoiPercent: avgRoi.toFixed(2),
        openProblemsCount,
        totalStoresCount: allStores.length,
        totalResearchersCount: allResearchers.length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/cerberus unhandled error:", error);
    return NextResponse.json({
      dbStatus: {
        connected: false,
        message: error?.message || "Internal server fallback",
      },
      discoveries: runtimeDiscoveries,
      stores: INITIAL_STORES,
      researchers: INITIAL_RESEARCHERS,
      suppliers: INITIAL_SUPPLIERS,
      problems: runtimeProblems,
      auditLogs: runtimeAuditLogs,
      executiveKpis: {
        totalGrossSales: "2845900.00",
        totalMonthlyNetProfit: "682410.00",
        totalActiveProducts: runtimeDiscoveries.length,
        totalActiveListings: 3140,
        averageRoiPercent: "48.20",
        openProblemsCount: 3,
        totalStoresCount: 26,
        totalResearchersCount: 10,
      },
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      sourceUrl,
      title,
      brand = "GENERIC BRAND",
      category = "General Retail",
      upc = "000000000000",
      asin = "B0" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      sourcePrice = 45,
      sellingPrice = 79.99,
      sourceShipping = 0,
      prepCost = 1.35,
      researcherName = "Ahmet Kaya (SRC-01)",
      supplierName = "US Sourcing Vendor",
      notes = "",
    } = body;

    let sourceDomain = "us-retail.com";
    try {
      if (sourceUrl) {
        const u = new URL(sourceUrl);
        sourceDomain = u.hostname.replace("www.", "");
      }
    } catch {
      // fallback
    }

    const numericSourcePrice = Number(sourcePrice) || 1;
    const numericSellingPrice = Number(sellingPrice) || numericSourcePrice * 1.6;

    const landed = calculateLandedCostAndProfit(
      numericSourcePrice,
      numericSellingPrice,
      Number(sourceShipping) || 0,
      Number(prepCost) || 1.35
    );

    const radar = computeOpportunityRadar(landed.roiPercent, sourceDomain);
    const productCode = `CRB-2026-${Math.floor(9055 + Math.random() * 900)}`;

    let duplicateScore = 12;
    let duplicateStatus = "CLEAR";
    let matchedProductCode: string | null = null;

    try {
      const existingDiscoveries = await db.select().from(productDiscoveries);
      for (const item of existingDiscoveries) {
        if (
          (upc && upc.length > 5 && item.upc === upc) ||
          (asin && item.asin.toUpperCase() === asin.toUpperCase()) ||
          (sourceUrl && item.sourceUrl === sourceUrl)
        ) {
          duplicateScore = 96;
          duplicateStatus = "EXACT_DUPLICATE";
          matchedProductCode = `${item.productCode} (${item.title.slice(0, 36)}...)`;
          break;
        }
      }

      const [inserted] = await db
        .insert(productDiscoveries)
        .values({
          productCode,
          title,
          brand: brand.toUpperCase(),
          category,
          upc,
          asin: asin.toUpperCase(),
          msku: `${brand.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`,
          sourceUrl: sourceUrl || "https://www.homedepot.com",
          sourceDomain,
          supplierName,
          researcherName,
          lifecycleStage: duplicateStatus === "EXACT_DUPLICATE" ? "DUPLICATE_CHECK" : "SCREENING",
          sourcePrice: numericSourcePrice.toFixed(2),
          sourceShipping: Number(sourceShipping).toFixed(2),
          intlShipping: "0.00",
          prepCost: Number(prepCost).toFixed(2),
          marketplaceFee: landed.marketplaceFee.toFixed(2),
          fulfillmentFee: landed.fulfillmentFee.toFixed(2),
          otherCost: landed.otherCost.toFixed(2),
          landedCost: landed.landedCost.toFixed(2),
          sellingPrice: numericSellingPrice.toFixed(2),
          estimatedNetProfit: landed.estimatedNetProfit.toFixed(2),
          roiPercent: landed.roiPercent.toFixed(2),
          monthlyEstimatedUnits: 85,
          duplicateScore,
          duplicateStatus,
          matchedProductCode,
          profitabilityScore: radar.profitabilityScore,
          demandScore: radar.demandScore,
          competitionScore: radar.competitionScore,
          priceStabilityScore: radar.priceStabilityScore,
          supplierRiskScore: radar.supplierRiskScore,
          operationalRiskScore: radar.operationalRiskScore,
          opportunityScore: radar.opportunityScore,
          aiRecommendation: radar.aiRecommendation,
          aiAnalysisNotes:
            duplicateStatus === "EXACT_DUPLICATE"
              ? `Duplicate check flagged ${duplicateScore}% similarity. Landed ROI is ${landed.roiPercent}%.`
              : `AI Opportunity Score ${radar.opportunityScore}/100. Projected Net Profit $${landed.estimatedNetProfit}/unit (${landed.roiPercent}% ROI).`,
          channelListings: [
            {
              storeCode: "AMZ-US-01",
              storeName: "Amazon Storefront #01",
              price: numericSellingPrice,
              status: "ACTIVE",
              stock: 60,
            },
          ],
          costHistory: [
            {
              date: new Date().toISOString().split("T")[0],
              sourcePrice: numericSourcePrice,
              landedCost: landed.landedCost,
              sellingPrice: numericSellingPrice,
              roi: landed.roiPercent,
            },
          ],
          notes,
        })
        .returning();

      return NextResponse.json({
        message: "Product Discovery Captured & Analyzed",
        discovery: inserted,
      });
    } catch (dbErr) {
      console.warn("DB insert fallback to runtime memory:", dbErr);
      const fallbackItem: any = {
        id: Date.now(),
        productCode,
        title,
        brand: brand.toUpperCase(),
        category,
        upc,
        asin: asin.toUpperCase(),
        msku: `${brand.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`,
        sourceUrl: sourceUrl || "https://www.homedepot.com",
        sourceDomain,
        supplierName,
        researcherName,
        lifecycleStage: "SCREENING",
        sourcePrice: numericSourcePrice.toFixed(2),
        sourceShipping: Number(sourceShipping).toFixed(2),
        intlShipping: "0.00",
        prepCost: Number(prepCost).toFixed(2),
        marketplaceFee: landed.marketplaceFee.toFixed(2),
        fulfillmentFee: landed.fulfillmentFee.toFixed(2),
        otherCost: landed.otherCost.toFixed(2),
        landedCost: landed.landedCost.toFixed(2),
        sellingPrice: numericSellingPrice.toFixed(2),
        estimatedNetProfit: landed.estimatedNetProfit.toFixed(2),
        roiPercent: landed.roiPercent.toFixed(2),
        monthlyEstimatedUnits: 85,
        duplicateScore: 12,
        duplicateStatus: "CLEAR",
        matchedProductCode: null,
        profitabilityScore: radar.profitabilityScore,
        demandScore: radar.demandScore,
        competitionScore: radar.competitionScore,
        priceStabilityScore: radar.priceStabilityScore,
        supplierRiskScore: radar.supplierRiskScore,
        operationalRiskScore: radar.operationalRiskScore,
        opportunityScore: radar.opportunityScore,
        aiRecommendation: radar.aiRecommendation,
        aiAnalysisNotes: `AI Opportunity Score ${radar.opportunityScore}/100. Projected Net Profit $${landed.estimatedNetProfit}/unit (${landed.roiPercent}% ROI).`,
        channelListings: [
          {
            storeCode: "AMZ-US-01",
            storeName: "Amazon Storefront #01",
            price: numericSellingPrice,
            status: "ACTIVE",
            stock: 60,
          },
        ],
        costHistory: [
          {
            date: new Date().toISOString().split("T")[0],
            sourcePrice: numericSourcePrice,
            landedCost: landed.landedCost,
            sellingPrice: numericSellingPrice,
            roi: landed.roiPercent,
          },
        ],
        notes,
        discoveredAt: new Date().toISOString(),
      };
      runtimeDiscoveries = [fallbackItem, ...runtimeDiscoveries];
      return NextResponse.json({
        message: "Product Discovery Captured (In-Memory Fallback)",
        discovery: fallbackItem,
      });
    }
  } catch (error: any) {
    console.error("POST /api/cerberus error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create product discovery" },
      { status: 500 }
    );
  }
}
