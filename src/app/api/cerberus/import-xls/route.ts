import { NextResponse } from "next/server";
import { db } from "@/db";
import { productDiscoveries, auditLogs } from "@/db/schema";

export async function POST(req: Request) {
  try {
    const { rows = [], researcherName = "Selin Yilmaz (Lead Sourcing)" } =
      await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No product rows provided for import" },
        { status: 400 }
      );
    }

    const existingDiscoveries = await db.select().from(productDiscoveries);
    const existingUpcs = new Set(existingDiscoveries.map((d) => d.upc));
    const existingAsins = new Set(
      existingDiscoveries.map((d) => d.asin.toUpperCase())
    );

    const importedResults: any[] = [];
    let duplicatesFound = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const title = row.title || `Sourced Product Item #${i + 1}`;
      const upc = row.upc || `UPC${Math.floor(100000000000 + Math.random() * 899999999999)}`;
      const asin = row.asin || `B0${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const sourcePrice = Number(row.sourcePrice || 25);
      const sellingPrice = Number(row.sellingPrice || sourcePrice * 1.8);
      const sourceUrl = row.sourceUrl || "https://www.homedepot.com";
      const brand = (row.brand || "GENERIC").toUpperCase();

      const isDup =
        existingUpcs.has(upc) || existingAsins.has(asin.toUpperCase());
      if (isDup) duplicatesFound++;

      const marketplaceFee = Number((sellingPrice * 0.15).toFixed(2));
      const fulfillmentFee = 5.25;
      const prepCost = 1.35;
      const landedCost = Number(
        (sourcePrice + prepCost + marketplaceFee + fulfillmentFee).toFixed(2)
      );
      const netProfit = Number((sellingPrice - landedCost).toFixed(2));
      const roiPercent =
        landedCost > 0 ? Number(((netProfit / landedCost) * 100).toFixed(2)) : 0;

      const productCode = `CRB-2026-${Math.floor(9200 + Math.random() * 800)}`;

      const [inserted] = await db
        .insert(productDiscoveries)
        .values({
          productCode,
          title,
          brand,
          category: row.category || "Retail Arbitrage",
          upc,
          asin: asin.toUpperCase(),
          msku: `${brand.slice(0, 3)}-IMP-${Math.floor(100 + Math.random() * 899)}`,
          sourceUrl,
          sourceDomain: "excel-import.source",
          supplierName: row.supplierName || "Excel Batch Source",
          researcherName,
          lifecycleStage: isDup ? "DUPLICATE_CHECK" : "SCREENING",
          sourcePrice: sourcePrice.toFixed(2),
          sourceShipping: "0.00",
          intlShipping: "0.00",
          prepCost: prepCost.toFixed(2),
          marketplaceFee: marketplaceFee.toFixed(2),
          fulfillmentFee: fulfillmentFee.toFixed(2),
          otherCost: "0.00",
          landedCost: landedCost.toFixed(2),
          sellingPrice: sellingPrice.toFixed(2),
          estimatedNetProfit: netProfit.toFixed(2),
          roiPercent: roiPercent.toFixed(2),
          monthlyEstimatedUnits: 65,
          duplicateScore: isDup ? 96 : 10,
          duplicateStatus: isDup ? "EXACT_DUPLICATE" : "CLEAR",
          profitabilityScore: Math.min(99, Math.round(55 + roiPercent * 0.5)),
          demandScore: 84,
          competitionScore: 72,
          priceStabilityScore: 85,
          supplierRiskScore: 90,
          operationalRiskScore: 88,
          opportunityScore: Math.min(95, Math.round(62 + roiPercent * 0.4)),
          aiRecommendation:
            roiPercent > 30 ? "HIGH_MARGIN_SCALER" : "HOLD_FOR_PRICE_DROP",
          aiAnalysisNotes: isDup
            ? "Imported row flagged as Duplicate by Cerberus UPC/ASIN Matcher."
            : `Normalized and imported from XLS batch with projected ${roiPercent}% ROI.`,
        })
        .returning();

      importedResults.push(inserted);
    }

    await db.insert(auditLogs).values({
      actorName: researcherName,
      actorRole: "LEAD_SOURCER",
      actionType: "XLS_IMPORT",
      targetEntity: `Batch Import (${rows.length} rows)`,
      beforeState: "EXCEL_SHEET",
      afterState: "POSTGRESQL_DB",
      details: `Imported ${rows.length} sourcing records. Flagged ${duplicatesFound} exact duplicates.`,
    });

    return NextResponse.json({
      message: `Normalized & imported ${rows.length} products (${duplicatesFound} duplicates flagged)`,
      imported: importedResults,
    });
  } catch (error: any) {
    console.error("POST /api/cerberus/import-xls error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import XLS rows" },
      { status: 500 }
    );
  }
}
