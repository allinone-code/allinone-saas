/**
 * Keepa + Landed-Cost birleşik karar motoru (Decision Engine 2.0)
 *
 * Önceki motor (decisionEngine.ts) 6 eksenin 3'ünü ASSUMED sayıyordu (evidenceCoverage %45).
 * Keepa bağlandığında talep/rekabet/fiyat istikrarı MEASURED'a terfi eder (coverage %85).
 *
 * Bu dosya, keepa sinyallerini mevcut motorun üzerine ek katman olarak uygular;
 * mevcut `computeDecisionEngine` bozulmaz — üzerine Keepa zenginleştirmesi yapılır.
 */

import {
  calculateLandedCostAndProfit,
  computeDecisionEngine,
  type DecisionEngineResult,
  type ScoredSignal,
} from "./decisionEngine";
import type { KeepaProductStats } from "@/lib/keepa/client";

export interface KeepaDecisionInput {
  sourcePrice: number;
  sellingPrice: number;
  prepCost?: number;
  sourceDomain: string;
  duplicateScore: number;
  keepa: KeepaProductStats | null;
  thresholds?: { rejectRoi: number; testRoi: number };
}

export interface KeepaDecisionResult extends DecisionEngineResult {
  keepa: KeepaProductStats | null;
  landed: ReturnType<typeof calculateLandedCostAndProfit>;
  /** Keepa bağlı mı? */
  keepaEnriched: boolean;
  /** Keepa'dan gelen ham skorlar (debug) */
  keepaRaw?: {
    demandScore: number;
    competitionScore: number;
    priceStabilityScore: number;
    evidenceCoverage: number;
  };
}

function scoreDemandFromKeepa(k: KeepaProductStats): ScoredSignal {
  if (k.salesRank === null) {
    return { score: 72, provenance: "HEURISTIC", basis: "Keepa BSR yok — taban değer" };
  }
  const r = k.salesRank;
  let score: number;
  let basis: string;
  if (r < 10_000) {
    score = 96;
    basis = `BSR ${r.toLocaleString("tr-TR")} — çok yüksek talep (Keepa)`;
  } else if (r < 50_000) {
    score = 88;
    basis = `BSR ${r.toLocaleString("tr-TR")} — yüksek talep (Keepa)`;
  } else if (r < 150_000) {
    score = 76;
    basis = `BSR ${r.toLocaleString("tr-TR")} — orta talep (Keepa)`;
  } else if (r < 300_000) {
    score = 58;
    basis = `BSR ${r.toLocaleString("tr-TR")} — düşük talep (Keepa)`;
  } else {
    score = 38;
    basis = `BSR ${r.toLocaleString("tr-TR")} — çok düşük talep (Keepa)`;
  }
  return { score, provenance: "MEASURED" as const, basis };
}

function scoreCompetitionFromKeepa(k: KeepaProductStats): ScoredSignal {
  if (k.offerCount === null) {
    return { score: 70, provenance: "HEURISTIC", basis: "Keepa satıcı sayısı yok — taban" };
  }
  const c = k.offerCount;
  let score: number;
  let basis: string;
  if (c < 5) {
    score = 92;
    basis = `${c} satıcı — düşük rekabet (Keepa BuyBox)`;
  } else if (c < 10) {
    score = 78;
    basis = `${c} satıcı — orta rekabet (Keepa)`;
  } else if (c < 16) {
    score = 62;
    basis = `${c} satıcı — yoğun rekabet (Keepa)`;
  } else {
    score = 44;
    basis = `${c} satıcı — aşırı rekabet (Keepa)`;
  }
  return { score, provenance: "MEASURED" as const, basis };
}

function scoreStabilityFromKeepa(k: KeepaProductStats): ScoredSignal {
  if (k.priceVolatility === null) {
    return { score: 75, provenance: "HEURISTIC", basis: "Keepa fiyat geçmişi yok" };
  }
  const v = k.priceVolatility;
  let score: number;
  let basis: string;
  if (v < 0.06) {
    score = 94;
    basis = `Volatilite %${(v * 100).toFixed(1)} — fiyat çok istikrarlı (Keepa 90 gün)`;
  } else if (v < 0.12) {
    score = 82;
    basis = `Volatilite %${(v * 100).toFixed(1)} — fiyat istikrarlı (Keepa)`;
  } else if (v < 0.22) {
    score = 64;
    basis = `Volatilite %${(v * 100).toFixed(1)} — dalgalı (Keepa)`;
  } else {
    score = 42;
    basis = `Volatilite %${(v * 100).toFixed(1)} — çok dalgalı, riskli (Keepa)`;
  }
  return { score, provenance: "MEASURED" as const, basis };
}

export function computeKeepaDecision(input: KeepaDecisionInput): KeepaDecisionResult {
  const { sourcePrice, sellingPrice, prepCost = 1.35, sourceDomain, duplicateScore, keepa, thresholds = { rejectRoi: 25, testRoi: 38 } } = input;
  const landed = calculateLandedCostAndProfit(sourcePrice, sellingPrice, prepCost);
  const roi = landed.roiPercent;

  // Keepa yoksa eski motora düş (coverage %45)
  if (!keepa) {
    const base = computeDecisionEngine(roi, sourceDomain, duplicateScore, thresholds);
    return { ...base, keepa: null, landed, keepaEnriched: false };
  }

  // Keepa zenginleştirmeli skorlar
  const profitabilityScore = Math.min(99, Math.max(30, Math.round(55 + roi * 0.55)));
  const profitability: ScoredSignal = {
    score: profitabilityScore,
    provenance: "MEASURED",
    basis: `Landed-cost ROI %${roi.toFixed(2)} (alış $${sourcePrice} → satış $${sellingPrice})`,
  };

  const demand = scoreDemandFromKeepa(keepa);
  const competition = scoreCompetitionFromKeepa(keepa);
  const priceStability = scoreStabilityFromKeepa(keepa);

  // Tedarikçi ve operasyonel hâlâ ASSUMED (faz 2'de supplierOffers trendi ile MEASURED olacak)
  const supplierRisk: ScoredSignal = {
    score: 78,
    provenance: "ASSUMED",
    basis: "Tedarikçi geçmişi henüz izlenmiyor — sabit varsayım (Keepa sonrası)",
  };
  const operationalRisk: ScoredSignal = {
    score: 80,
    provenance: "ASSUMED",
    basis: "Operasyonel gecikme verisi bağlı değil — sabit varsayım",
  };

  const signals = {
    profitability,
    demand,
    competition,
    priceStability,
    supplierRisk,
    operationalRisk,
  };

  // Ağırlıklar Keepa sonrası: ölçülenler toplam %85
  const weights = {
    profitability: 0.40,
    demand: 0.20,
    competition: 0.15,
    priceStability: 0.10,
    supplierRisk: 0.075,
    operationalRisk: 0.075,
  } as const;

  const opportunityScore = Math.round(
    profitability.score * weights.profitability +
      demand.score * weights.demand +
      competition.score * weights.competition +
      priceStability.score * weights.priceStability +
      supplierRisk.score * weights.supplierRisk +
      operationalRisk.score * weights.operationalRisk
  );

  const evidenceCoverage = Math.round(
    (weights.profitability + weights.demand + weights.competition + weights.priceStability) * 100
  ); // %85

  const assumedAxes = [
    supplierRisk.provenance === "ASSUMED" ? "Tedarikçi Riski" : null,
    operationalRisk.provenance === "ASSUMED" ? "Operasyonel Risk" : null,
  ].filter((x): x is string => x !== null);

  // Karar eşikleri aynı kalır ama skorlar Keepa ile daha güvenilir
  let decisionAction: DecisionEngineResult["decisionAction"] = "BUY";
  let policyStatus = "APPROVED_BY_POLICY";
  let riskLevel: DecisionEngineResult["riskLevel"] = "LOW";
  let confidenceScore = 92;

  const duplicateRisk = Math.min(99, Math.max(1, Math.round(duplicateScore)));
  if (duplicateRisk >= 80) {
    decisionAction = "WAIT";
    policyStatus = "REQUIRES_MANAGER_APPROVAL";
    riskLevel = "HIGH";
    confidenceScore = 68;
  } else if (roi < thresholds.rejectRoi) {
    decisionAction = "REJECT";
    policyStatus = "FLAGGED_IP_RISK";
    riskLevel = "HIGH";
    confidenceScore = 89;
  } else if (roi < thresholds.testRoi) {
    decisionAction = "TEST";
    policyStatus = "APPROVED_BY_POLICY";
    riskLevel = "MEDIUM";
    confidenceScore = 84;
  } else if (demand.score < 50 || competition.score < 50) {
    // Keepa'ya özgü ek kural: talep çok düşükse veya rekabet aşırıysa TEST'e düşür
    decisionAction = "TEST";
    policyStatus = "APPROVED_BY_POLICY";
    riskLevel = "MEDIUM";
    confidenceScore = 78;
  }

  confidenceScore = Math.min(confidenceScore, 60 + Math.round(evidenceCoverage * 0.5));

  return {
    profitabilityScore,
    demandScore: demand.score,
    competitionScore: competition.score,
    priceStabilityScore: priceStability.score,
    supplierRiskScore: supplierRisk.score,
    operationalRiskScore: operationalRisk.score,
    opportunityScore,
    decisionAction,
    policyStatus,
    riskLevel,
    confidenceScore,
    signals,
    evidenceCoverage,
    assumedAxes,
    keepa,
    landed,
    keepaEnriched: true,
    keepaRaw: {
      demandScore: demand.score,
      competitionScore: competition.score,
      priceStabilityScore: priceStability.score,
      evidenceCoverage,
    },
  };
}
