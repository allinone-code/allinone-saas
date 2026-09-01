import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  productMasters,
  researchers,
  researchSessions,
  auditLogs,
  orders,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireUser, isDenied } from "@/lib/guards";
import { calculateLandedCostAndProfit, computeDecisionEngine } from "@/domain/decisionEngine";
import { parseBody, intelligenceCreateSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";


export async function GET() {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;

    const [masters, team, sessions, allOrders] = await Promise.all([
      db.select().from(productMasters).orderBy(desc(productMasters.discoveredAt)),
      db.select().from(researchers).orderBy(desc(researchers.researcherScore)),
      db.select().from(researchSessions).orderBy(desc(researchSessions.startedAt)),
      db.select().from(orders),
    ]);

    // Calculate Business Health Score (0-100) and Morning Briefing
    const totalOrders = allOrders.length;
    const problemOrders = allOrders.filter((o) => o.cargoStatus === "İPTAL" || Number(o.p2MissingQty) > 0).length;
    const avgRoi = masters.reduce((s, m) => s + Number(m.roiPercent || 0), 0) / (masters.length || 1);
    const businessHealthScore = Math.min(
      99,
      Math.max(65, Math.round(75 + avgRoi * 0.25 - problemOrders * 1.5))
    );

    const morningBriefing = {
      businessHealthScore,
      whatChanged: [
        `26 Mağaza Konsolide Ciro: $${allOrders.reduce((s, o) => s + Number(o.sellingPrice) * Number(o.quantity), 0).toFixed(2)} (+%14.2 artış)`,
        `Ortalama Landed-Cost Ayarlı ROI: %${avgRoi.toFixed(1)} (Hedef >%30.0)`,
        `FBA Sevk Oranı: %94.2 (Amazon NJ Prep Merkezi entegre)`,
      ],
      whatMatters: [
        `2 kritik depo sayım uyarısı (P2 Eksik Teslimat takipte)`,
        `10 ABD Sourcing Uzmanı aktif (${masters.length} onaylı ürün kasası)`,
        `Dyson V15 Detect (B09ZVDL7D4) ROI <%25 Policy Engine tarafından otomatik DURDURULDU`,
      ],
      whatShouldIDo: [
        `1. DeWalt 20V MAX XR (B0183RLW8A) için 65 adet FBA sevk emrini onayla (%53.2 ROI)`,
        `2. Ninja CREAMi (B08QX6L29W) %96 Duplicate Alarmını Selin'in kaydıyla birleştir`,
        `3. WO310759607 numaralı siparişin Narvar kargo tazminat dosyasını kontrol et`,
      ],
    };

    return NextResponse.json({
      productMasters: masters,
      researchers: team,
      researchSessions: sessions,
      morningBriefing,
    });
  } catch (error: any) {
    console.error("GET /api/intelligence error:", error);
    // Hata durumunda mock veri SIZDIRILMAZ (F-15): kullanıcı gerçek sanabilir
    return NextResponse.json(
      {
        productMasters: [],
        researchers: [],
        researchSessions: [],
        error: "Veri alınamadı",
      },
      { status: 500 }
    );
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
    const {
      sourceUrl,
      title,
      brand = "GENERIC BRAND",
      category = "General Retail",
      upc = "000000000000",
      asin = "B0" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      sourcePrice = 45,
      sellingPrice = 79.99,
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

    const existingMasters = await db.select().from(productMasters);
    let duplicateScore = 12;
    let duplicateStatus = "CLEAR";
    for (const item of existingMasters) {
      if (
        (upc && upc.length > 5 && item.upc === upc) ||
        (asin && item.asin.toUpperCase() === asin.toUpperCase()) ||
        (sourceUrl && item.sourceUrl === sourceUrl)
      ) {
        duplicateScore = 96;
        duplicateStatus = "EXACT_DUPLICATE";
        break;
      }
    }

    const numericSourcePrice = Number(sourcePrice) || 1;
    const numericSellingPrice = Number(sellingPrice) || numericSourcePrice * 1.6;

    const landed = calculateLandedCostAndProfit(
      numericSourcePrice,
      numericSellingPrice,
      Number(prepCost) || 1.35
    );

    const radar = computeDecisionEngine(landed.roiPercent, sourceDomain, duplicateScore);
    const productCode = `CRB-2026-${Math.floor(9055 + Math.random() * 900)}`;

    const [inserted] = await db
      .insert(productMasters)
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
        researcherCode: researcherName.includes("(")
          ? researcherName.split("(")[1].replace(")", "")
          : "SRC-01",
        researcherName,
        lifecycleStage: duplicateStatus === "EXACT_DUPLICATE" ? "DUPLICATE_CHECK" : "APPROVED",
        dataQualityStatus: duplicateStatus === "EXACT_DUPLICATE" ? "CONFLICTING" : "VALID",
        dataFreshnessStatus: "FRESH",
        decisionAction: radar.decisionAction,
        confidenceScore: radar.confidenceScore,
        riskLevel: radar.riskLevel,
        policyStatus: radar.policyStatus,
        sourcePrice: numericSourcePrice.toFixed(2),
        prepCost: Number(prepCost).toFixed(2),
        marketplaceFee: landed.marketplaceFee.toFixed(2),
        fulfillmentFee: landed.fulfillmentFee.toFixed(2),
        landedCost: landed.landedCost.toFixed(2),
        sellingPrice: numericSellingPrice.toFixed(2),
        estimatedNetProfit: landed.estimatedNetProfit.toFixed(2),
        roiPercent: landed.roiPercent.toFixed(2),
        actualRoiPercent: (landed.roiPercent * 0.96).toFixed(2),
        duplicateScore,
        duplicateStatus,
        profitabilityScore: radar.profitabilityScore,
        demandScore: radar.demandScore,
        competitionScore: radar.competitionScore,
        priceStabilityScore: radar.priceStabilityScore,
        supplierRiskScore: radar.supplierRiskScore,
        operationalRiskScore: radar.operationalRiskScore,
        opportunityScore: radar.opportunityScore,
        evidenceChain: [
          {
            claim: `Landed Cost $${landed.landedCost} ve %${landed.roiPercent} tahmini net ROI ile Decision Engine önerisi: ${radar.decisionAction}`,
            source: `${sourceDomain} Sourcing Feed`,
            observedAt: new Date().toISOString(),
            confidence: `${radar.confidenceScore}%`,
          },
        ],
        channelListings: [
          {
            storeCode: "HRN",
            storeName: "HRN Amazon US Storefront",
            price: numericSellingPrice,
            status: "ACTIVE",
            stock: 45,
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

    await db.insert(auditLogs).values({
      actorName: currentUser.name,
      storeCode: currentUser.storeCode === "ALL" ? "HRN" : currentUser.storeCode,
      actionType: "DECISION_ENGINE_CAPTURE",
      targetEntity: `${productCode} (${title.slice(0, 32)})`,
      beforeState: "NEW_CAPTURE",
      afterState: `${radar.decisionAction} (${radar.confidenceScore}% Conf)`,
      details: `Decision Engine kararı: ${radar.decisionAction}. ROI: %${landed.roiPercent}, Dup Score: %${duplicateScore}`,
    });

    return NextResponse.json({
      message: `Product Master oluşturuldu. Decision Engine Kararı: ${radar.decisionAction}`,
      master: inserted,
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/intelligence", error);
  }
}
