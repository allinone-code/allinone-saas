import { describe, expect, it } from "vitest";
import {
  buildMorningBriefing,
  buildWhatMatters,
  buildWhatShouldIDo,
  computeBusinessHealth,
  type BriefingMasterFacts,
  type BriefingOrderFacts,
} from "./briefing";

const emptyOrders: BriefingOrderFacts = {
  totalOrders: 0,
  totalUnits: 0,
  totalSpend: 0,
  totalShippedToAmazon: 0,
  totalRefunds: 0,
  problemOrdersCount: 0,
  p1CancelTotal: 0,
  p2MissingTotal: 0,
  p3DefectiveTotal: 0,
  p4ExpiredTotal: 0,
  estimatedRevenue: 0,
  unbatchedOrders: 0,
  inTransitOrders: 0,
};

const emptyMasters: BriefingMasterFacts = {
  totalMasters: 0,
  avgRoiPercent: 0,
  decisionCounts: {},
  freshnessCounts: {},
  duplicateAlerts: 0,
  pendingPolicyApprovals: 0,
};

const healthyOrders: BriefingOrderFacts = {
  ...emptyOrders,
  totalOrders: 100,
  totalUnits: 500,
  totalSpend: 10_000,
  totalShippedToAmazon: 475,
  totalRefunds: 100,
  problemOrdersCount: 4,
  estimatedRevenue: 16_000,
};

const healthyMasters: BriefingMasterFacts = {
  totalMasters: 20,
  avgRoiPercent: 42,
  decisionCounts: { BUY: 12, TEST: 5, REJECT: 3 },
  freshnessCounts: { FRESH: 19, AGING: 1 },
  duplicateAlerts: 0,
  pendingPolicyApprovals: 0,
};

describe("computeBusinessHealth", () => {
  it("sağlıklı işletmede yüksek skor ve GÜÇLÜ notu verir", () => {
    const health = computeBusinessHealth(healthyOrders, healthyMasters);
    expect(health.score).toBeGreaterThanOrEqual(85);
    expect(health.grade).toBe("GÜÇLÜ");
  });

  it("skoru açıklayan 5 eksenli kırılım döndürür ve ağırlıklar 1.0 eder", () => {
    const health = computeBusinessHealth(healthyOrders, healthyMasters);
    expect(health.breakdown).toHaveLength(5);
    const totalWeight = health.breakdown.reduce((s, b) => s + b.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });

  it("yüksek fire ve refund skoru düşürür", () => {
    const bad = computeBusinessHealth(
      { ...healthyOrders, problemOrdersCount: 45, totalRefunds: 4_000 },
      healthyMasters
    );
    const good = computeBusinessHealth(healthyOrders, healthyMasters);
    expect(bad.score).toBeLessThan(good.score);
  });

  it("veri yokken skoru uydurmaz (0'a yakın, KRİTİK)", () => {
    const health = computeBusinessHealth(emptyOrders, emptyMasters);
    expect(health.score).toBeLessThan(40);
    expect(health.grade).toBe("KRİTİK");
  });

  it("skor her zaman 0-100 aralığında kalır", () => {
    const extreme = computeBusinessHealth(
      { ...healthyOrders, totalRefunds: 999_999, problemOrdersCount: 100 },
      { ...healthyMasters, avgRoiPercent: 5000 }
    );
    expect(extreme.score).toBeGreaterThanOrEqual(0);
    expect(extreme.score).toBeLessThanOrEqual(100);
  });
});

describe("buildWhatMatters", () => {
  it("risk yokken uydurma uyarı üretmez", () => {
    const cleanOrders = {
      ...healthyOrders,
      problemOrdersCount: 0,
      totalRefunds: 0,
    };
    const items = buildWhatMatters(cleanOrders, healthyMasters);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe("INFO");
    expect(items[0].text).toContain("Açık risk kaydı yok");
  });

  it("fire oranı yüksekse CRITICAL üretir ve metrik kaynağını belirtir", () => {
    const items = buildWhatMatters(
      { ...healthyOrders, problemOrdersCount: 30, p2MissingTotal: 12 },
      healthyMasters
    );
    const critical = items.find((i) => i.severity === "CRITICAL");
    expect(critical).toBeDefined();
    expect(critical!.metric).toBe("orders.problemOrdersCount");
  });

  it("bayat veri ve mükerrer alarmını ayrı maddeler olarak raporlar", () => {
    const items = buildWhatMatters(healthyOrders, {
      ...healthyMasters,
      duplicateAlerts: 2,
      freshnessCounts: { FRESH: 5, STALE: 10, EXPIRED: 5 },
    });
    expect(items.some((i) => i.metric === "productMasters.duplicateScore")).toBe(true);
    expect(items.some((i) => i.metric === "productMasters.dataFreshnessStatus")).toBe(true);
  });
});

describe("buildWhatShouldIDo", () => {
  it("aksiyonları önceliğe göre sıralar; CRITICAL ilk sırada", () => {
    const items = buildWhatShouldIDo(
      { ...healthyOrders, p2MissingTotal: 8, unbatchedOrders: 3 },
      { ...healthyMasters, pendingPolicyApprovals: 2 }
    );
    expect(items[0].severity).toBe("CRITICAL");
  });

  it("en fazla 5 aksiyon önerir (yönetici odağı korunur)", () => {
    const items = buildWhatShouldIDo(
      { ...healthyOrders, p2MissingTotal: 8, unbatchedOrders: 3 },
      { ...healthyMasters, pendingPolicyApprovals: 2, decisionCounts: { BUY: 9, REJECT: 4 } }
    );
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it("veri yoksa hiç aksiyon üretmez", () => {
    expect(buildWhatShouldIDo(emptyOrders, emptyMasters)).toHaveLength(0);
  });
});

describe("buildMorningBriefing", () => {
  it("boş veritabanında sampleSize 0 döner ve madde uydurmaz", () => {
    const briefing = buildMorningBriefing(emptyOrders, emptyMasters);
    expect(briefing.sampleSize).toBe(0);
    expect(briefing.whatChanged).toHaveLength(0);
    expect(briefing.whatShouldIDo).toHaveLength(0);
  });

  it("gerçek veriyle tüm bölümleri doldurur ve zaman damgası basar", () => {
    const briefing = buildMorningBriefing(healthyOrders, healthyMasters, new Date("2026-09-01T06:00:00Z"));
    expect(briefing.whatChanged.length).toBeGreaterThan(0);
    expect(briefing.generatedAt).toBe("2026-09-01T06:00:00.000Z");
    expect(briefing.sampleSize).toBe(120);
  });

  it("hiçbir maddede sabit kodlanmış demo ürün adı geçmez (F-23 regresyon testi)", () => {
    const briefing = buildMorningBriefing(healthyOrders, healthyMasters);
    const allText = [
      ...briefing.whatChanged,
      ...briefing.whatMatters,
      ...briefing.whatShouldIDo,
    ]
      .map((i) => i.text)
      .join(" ");
    expect(allText).not.toMatch(/Dyson|DeWalt|Ninja CREAMi|WO310759607/);
  });
});
