import { describe, it, expect } from "vitest";
import { mockKeepaData } from "@/lib/keepa/client";
import { computeKeepaDecision } from "./keepaDecision";

describe("Keepa Decision Engine 2.0", () => {
  it("mock keepa ile BUY kararı üretir (yüksek ROI)", () => {
    const keepa = mockKeepaData("B0TEST1234");
    const r = computeKeepaDecision({
      sourcePrice: 15,
      sellingPrice: 55,
      sourceDomain: "vitaminshoppe.com",
      duplicateScore: 10,
      keepa,
    });
    expect(r.keepaEnriched).toBe(true);
    expect(r.evidenceCoverage).toBe(85);
    expect(["BUY", "TEST"]).toContain(r.decisionAction);
    expect(r.signals.demand.provenance).toBe("MEASURED");
  });

  it("keepa yoksa eski motora düşer (coverage %45)", () => {
    const r = computeKeepaDecision({
      sourcePrice: 30,
      sellingPrice: 35,
      sourceDomain: "unknown.com",
      duplicateScore: 5,
      keepa: null,
    });
    expect(r.keepaEnriched).toBe(false);
    expect(r.evidenceCoverage).toBe(45);
    expect(r.decisionAction).toBe("REJECT"); // ROI % <25
  });

  it("düşük talep + yüksek rekabet TEST'e düşürür", () => {
    const keepa = {
      ...mockKeepaData("B0LOWDEMAND"),
      salesRank: 500_000,
      offerCount: 22,
      priceVolatility: 0.04,
      priceTrendPercent: -2,
      isPriceStable: true,
    } as unknown as ReturnType<typeof mockKeepaData>;
    const r = computeKeepaDecision({
      sourcePrice: 18,
      sellingPrice: 42,
      sourceDomain: "amazon.com",
      duplicateScore: 5,
      keepa,
    });
    // Talep skoru 38, rekabet 44 → TEST
    expect(r.signals.demand.score).toBeLessThan(50);
    expect(r.decisionAction).toBe("TEST");
  });

  it("duplicate >=80 WAIT üretir (Keepa olsa bile)", () => {
    const keepa = mockKeepaData("B0DUPL00001");
    const r = computeKeepaDecision({
      sourcePrice: 10,
      sellingPrice: 60,
      sourceDomain: "amazon.com",
      duplicateScore: 85,
      keepa,
    });
    expect(r.decisionAction).toBe("WAIT");
    expect(r.policyStatus).toBe("REQUIRES_MANAGER_APPROVAL");
  });
});
