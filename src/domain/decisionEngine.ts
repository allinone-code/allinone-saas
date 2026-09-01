/**
 * CERBERUS Karar Motoru (T5.1) — saf fonksiyonlar, route'tan bağımsız.
 * İş kurallarının birim testi burada yapılır; route yalnızca IO katmanıdır.
 */

export interface LandedCostResult {
  marketplaceFee: number;
  fulfillmentFee: number;
  landedCost: number;
  estimatedNetProfit: number;
  roiPercent: number;
}

export function calculateLandedCostAndProfit(
  sourcePrice: number,
  sellingPrice: number,
  prepCost = 1.35
): LandedCostResult {
  const marketplaceFee = Number((sellingPrice * 0.15).toFixed(2));
  const fulfillmentFee = Number(
    (sellingPrice > 100 ? 7.45 : sellingPrice > 45 ? 5.8 : 4.15).toFixed(2)
  );
  const landedCost = Number(
    (sourcePrice + prepCost + marketplaceFee + fulfillmentFee).toFixed(2)
  );
  const estimatedNetProfit = Number((sellingPrice - landedCost).toFixed(2));
  const roiPercent =
    landedCost > 0 ? Number(((estimatedNetProfit / landedCost) * 100).toFixed(2)) : 0;

  return {
    marketplaceFee,
    fulfillmentFee,
    landedCost,
    estimatedNetProfit,
    roiPercent,
  };
}

export interface DecisionEngineResult {
  profitabilityScore: number;
  demandScore: number;
  competitionScore: number;
  priceStabilityScore: number;
  supplierRiskScore: number;
  operationalRiskScore: number;
  opportunityScore: number;
  decisionAction: "BUY" | "TEST" | "WAIT" | "REJECT";
  policyStatus: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  confidenceScore: number;
}

export function computeDecisionEngine(
  roiPercent: number,
  sourceDomain: string,
  duplicateScore: number
): DecisionEngineResult {
  const profitabilityScore = Math.min(99, Math.max(30, Math.round(55 + roiPercent * 0.55)));
  const demandScore =
    sourceDomain.includes("homedepot") || sourceDomain.includes("ulta") ? 94 : 86;
  const competitionScore = roiPercent > 50 ? 82 : 68;
  const priceStabilityScore = 88;
  const supplierRiskScore = 94;
  const operationalRiskScore = 90;

  const opportunityScore = Math.round(
    profitabilityScore * 0.28 +
      demandScore * 0.22 +
      competitionScore * 0.15 +
      priceStabilityScore * 0.13 +
      supplierRiskScore * 0.12 +
      operationalRiskScore * 0.1
  );

  let decisionAction: DecisionEngineResult["decisionAction"] = "BUY";
  let policyStatus = "APPROVED_BY_POLICY";
  let riskLevel: DecisionEngineResult["riskLevel"] = "LOW";
  let confidenceScore = 92;

  if (duplicateScore >= 80) {
    decisionAction = "WAIT";
    policyStatus = "REQUIRES_MANAGER_APPROVAL";
    riskLevel = "HIGH";
    confidenceScore = 68;
  } else if (roiPercent < 25) {
    decisionAction = "REJECT";
    policyStatus = "FLAGGED_IP_RISK";
    riskLevel = "HIGH";
    confidenceScore = 89;
  } else if (roiPercent < 38) {
    decisionAction = "TEST";
    policyStatus = "APPROVED_BY_POLICY";
    riskLevel = "MEDIUM";
    confidenceScore = 84;
  }

  return {
    profitabilityScore,
    demandScore,
    competitionScore,
    priceStabilityScore,
    supplierRiskScore,
    operationalRiskScore,
    opportunityScore,
    decisionAction,
    policyStatus,
    riskLevel,
    confidenceScore,
  };
}
