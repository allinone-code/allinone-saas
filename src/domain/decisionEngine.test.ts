import { describe, it, expect } from "vitest";
import {
  calculateLandedCostAndProfit,
  computeDecisionEngine,
} from "@/domain/decisionEngine";

describe("calculateLandedCostAndProfit (Landed-Cost Motoru)", () => {
  it("temel hesap: fee + fulfillment + prep dahil landed cost", () => {
    const r = calculateLandedCostAndProfit(20, 45);
    // fee = 45 * 0.15 = 6.75, fulfillment (<=45) = 4.15, prep = 1.35
    expect(r.marketplaceFee).toBe(6.75);
    expect(r.fulfillmentFee).toBe(4.15);
    expect(r.landedCost).toBe(32.25);
    expect(r.estimatedNetProfit).toBe(12.75);
    expect(r.roiPercent).toBeCloseTo(39.53, 1);
  });

  it("fulfillment basamakları: <=45 / 45-100 / >100", () => {
    expect(calculateLandedCostAndProfit(10, 40).fulfillmentFee).toBe(4.15);
    expect(calculateLandedCostAndProfit(10, 60).fulfillmentFee).toBe(5.8);
    expect(calculateLandedCostAndProfit(10, 150).fulfillmentFee).toBe(7.45);
  });

  it("landed cost 0'a düşerse ROI sıfırdır (sıfıra bölme yok)", () => {
    const r = calculateLandedCostAndProfit(0, 0, -100);
    expect(r.landedCost).toBeLessThanOrEqual(0);
    expect(r.roiPercent).toBe(0);
  });

  it("yuvarlama: tüm çıktılar 2 ondalık", () => {
    const r = calculateLandedCostAndProfit(13.37, 29.99);
    for (const v of [r.marketplaceFee, r.fulfillmentFee, r.landedCost, r.estimatedNetProfit, r.roiPercent]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v * 100 - Math.round(v * 100))).toBeLessThan(1e-6);
    }
  });
});

describe("computeDecisionEngine (Karar Motoru)", () => {
  it("yüksek ROI + temiz duplicate -> BUY / LOW risk", () => {
    const r = computeDecisionEngine(60, "homedepot.com", 12);
    expect(r.decisionAction).toBe("BUY");
    expect(r.riskLevel).toBe("LOW");
    expect(r.policyStatus).toBe("APPROVED_BY_POLICY");
    expect(r.demandScore).toBe(94); // homedepot bonusu
  });

  it("duplicateScore >= 80 -> WAIT + REQUIRES_MANAGER_APPROVAL (ROI yüksek olsa bile)", () => {
    const r = computeDecisionEngine(80, "homedepot.com", 96);
    expect(r.decisionAction).toBe("WAIT");
    expect(r.policyStatus).toBe("REQUIRES_MANAGER_APPROVAL");
    expect(r.riskLevel).toBe("HIGH");
  });

  it("ROI < 25 -> REJECT + FLAGGED_IP_RISK", () => {
    const r = computeDecisionEngine(20, "walmart.com", 10);
    expect(r.decisionAction).toBe("REJECT");
    expect(r.policyStatus).toBe("FLAGGED_IP_RISK");
  });

  it("25 <= ROI < 38 -> TEST / MEDIUM", () => {
    const r = computeDecisionEngine(30, "walmart.com", 10);
    expect(r.decisionAction).toBe("TEST");
    expect(r.riskLevel).toBe("MEDIUM");
  });

  it("skorlar 30..99 bandında sınırlanır", () => {
    const high = computeDecisionEngine(500, "x.com", 0);
    expect(high.profitabilityScore).toBeLessThanOrEqual(99);
    const low = computeDecisionEngine(-500, "x.com", 0);
    expect(low.profitabilityScore).toBeGreaterThanOrEqual(30);
  });
});
