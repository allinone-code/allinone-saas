import { db } from "@/db";
import {
  users,
  stores,
  researchers,
  researchSessions,
  productMasters,
  orders,
  pshBatches,
  auditLogs,
} from "@/db/schema";
import { count } from "drizzle-orm";
import {
  ALL_38_XLS_ORDERS,
  INITIAL_STORES,
  INITIAL_BATCHES,
  INITIAL_RESEARCHERS,
  INITIAL_PRODUCT_MASTERS,
} from "@/lib/mockData";

export async function ensureCerberusSeeded() {
  // 1. Ensure users exist
  const existingUsers = await db.select({ total: count() }).from(users);
  if (Number(existingUsers[0]?.total || 0) === 0) {
    await db.insert(users).values([
      {
        name: "Ahmet Erdem (Sistem Yöneticisi)",
        email: "ahmet@cerberus-commerce.io",
        passwordHash: "admin2026",
        role: "ADMIN",
        storeCode: "ALL",
        avatar: "AE",
      },
      {
        name: "Harun (HRN Store Yöneticisi)",
        email: "harun@cerberus-commerce.io",
        passwordHash: "store2026",
        role: "STORE_USER",
        storeCode: "HRN",
        avatar: "HRN",
      },
      {
        name: "Selin Yılmaz (SEL Store Yöneticisi)",
        email: "selin@cerberus-commerce.io",
        passwordHash: "store2026",
        role: "STORE_USER",
        storeCode: "SEL",
        avatar: "SY",
      },
      {
        name: "Can Demir (MK Store Yöneticisi)",
        email: "can@cerberus-commerce.io",
        passwordHash: "store2026",
        role: "STORE_USER",
        storeCode: "MK",
        avatar: "CD",
      },
    ]);
  }

  // 2. Stores Table (26 Multi-Store Fleet)
  const existingStores = await db.select({ total: count() }).from(stores);
  if (Number(existingStores[0]?.total || 0) === 0) {
    await db.insert(stores).values(
      INITIAL_STORES.map((s) => ({
        storeCode: s.storeCode,
        storeName: s.storeName,
        marketplace: s.marketplace,
        buyerName: s.buyerName,
        currency: s.currency,
        status: s.status,
        defaultCard: "1753",
        defaultEmail: `${s.storeCode.toLowerCase()}@cerberus-commerce.io`,
        notes: `${s.storeName} ana operasyon mağazası`,
        totalOrdersCount: s.totalOrdersCount,
        totalSpend: s.totalSpend,
      }))
    );
  }

  // 3. 10-Person US Sourcing Intelligence Specialists
  const existingResearchers = await db.select({ total: count() }).from(researchers);
  if (Number(existingResearchers[0]?.total || 0) === 0) {
    await db.insert(researchers).values(
      INITIAL_RESEARCHERS.map((r) => ({
        code: r.code,
        name: r.name,
        email: r.email,
        specialtyDomain: r.specialtyDomain,
        discoveryVolume: r.discoveryVolume,
        approvalRate: r.approvalRate,
        purchaseConversion: r.purchaseConversion,
        averageRoi: r.averageRoi,
        averageNetProfit: r.averageNetProfit,
        problemRate: r.problemRate,
        researcherScore: r.researcherScore,
        activeListingsCount: r.activeListingsCount,
        avatar: r.avatar,
      }))
    );
  }

  // 4. Research Sessions
  const existingSessions = await db.select({ total: count() }).from(researchSessions);
  if (Number(existingSessions[0]?.total || 0) === 0) {
    await db.insert(researchSessions).values([
      {
        sessionCode: "SES-2026-0827-01",
        researcherCode: "SRC-01",
        researcherName: "Ahmet Kaya (SRC-01)",
        sourceDomain: "homedepot.com",
        productsFound: 14,
        productsApproved: 6,
        sessionQualityScore: 94,
      },
      {
        sessionCode: "SES-2026-0827-02",
        researcherCode: "SRC-05",
        researcherName: "Zeynep Aksoy (SRC-05)",
        sourceDomain: "ulta.com",
        productsFound: 19,
        productsApproved: 9,
        sessionQualityScore: 96,
      },
    ]);
  }

  // 5. Product Master Decision Vault
  const existingMasters = await db.select({ total: count() }).from(productMasters);
  if (Number(existingMasters[0]?.total || 0) === 0) {
    await db.insert(productMasters).values(
      INITIAL_PRODUCT_MASTERS.map((p) => ({
        productCode: p.productCode,
        title: p.title,
        brand: p.brand,
        category: p.category,
        upc: p.upc,
        asin: p.asin,
        msku: p.msku,
        sourceUrl: p.sourceUrl,
        sourceDomain: p.sourceDomain,
        supplierName: p.supplierName,
        researcherCode: p.researcherCode,
        researcherName: p.researcherName,
        lifecycleStage: p.lifecycleStage,
        dataQualityStatus: p.dataQualityStatus,
        dataFreshnessStatus: p.dataFreshnessStatus,
        decisionAction: p.decisionAction,
        confidenceScore: p.confidenceScore,
        riskLevel: p.riskLevel,
        policyStatus: p.policyStatus,
        sourcePrice: p.sourcePrice,
        prepCost: p.prepCost,
        marketplaceFee: p.marketplaceFee,
        fulfillmentFee: p.fulfillmentFee,
        landedCost: p.landedCost,
        sellingPrice: p.sellingPrice,
        estimatedNetProfit: p.estimatedNetProfit,
        roiPercent: p.roiPercent,
        actualRoiPercent: p.actualRoiPercent,
        duplicateScore: p.duplicateScore,
        duplicateStatus: p.duplicateStatus,
        profitabilityScore: p.profitabilityScore,
        demandScore: p.demandScore,
        competitionScore: p.competitionScore,
        priceStabilityScore: p.priceStabilityScore,
        supplierRiskScore: p.supplierRiskScore,
        operationalRiskScore: p.operationalRiskScore,
        opportunityScore: p.opportunityScore,
        evidenceChain: p.evidenceChain,
        channelListings: p.channelListings,
        costHistory: p.costHistory,
        notes: p.notes,
      }))
    );
  }

  // 6. Seed PSH Batches
  const existingBatches = await db.select({ total: count() }).from(pshBatches);
  if (Number(existingBatches[0]?.total || 0) === 0) {
    await db.insert(pshBatches).values(
      INITIAL_BATCHES.map((b) => ({
        batchNumber: b.batchNumber,
        storeCode: b.storeCode,
        title: b.title,
        status: b.status,
        totalItemsCount: b.totalItemsCount,
        totalUnitsCount: b.totalUnitsCount,
        receivedUnitsCount: b.receivedUnitsCount,
        missingUnitsCount: b.missingUnitsCount,
        defectiveUnitsCount: b.defectiveUnitsCount,
        inventoryLabSynced: b.inventoryLabSynced,
        notes: b.notes,
      }))
    );
  }

  // 7. Seed all 38 Real Orders from the XLS data if not yet present
  const existingCount = await db.select({ total: count() }).from(orders);
  if (Number(existingCount[0]?.total || 0) < 30) {
    if (Number(existingCount[0]?.total || 0) > 0) {
      await db.delete(orders);
    }
    await db.insert(orders).values(ALL_38_XLS_ORDERS as any);
  }

  // 8. Initial Audit Log
  const existingLogs = await db.select({ total: count() }).from(auditLogs);
  if (Number(existingLogs[0]?.total || 0) === 0) {
    await db.insert(auditLogs).values([
      {
        actorName: "Harun (HRN Store)",
        storeCode: "HRN",
        actionType: "XLS_BATCH_IMPORT",
        targetEntity: `HRN Master XLS (${ALL_38_XLS_ORDERS.length} Sipariş)`,
        beforeState: "GOOGLE_DRIVE_XLS",
        afterState: "CERBERUS_DATABASE",
        details:
          "Google Drive XLS tablosundaki 40 kolonlu gerçek siparişler aktarıldı. PSH ve Inventory Lab entegrasyonu sağlandı.",
      },
    ]);
  }
}
