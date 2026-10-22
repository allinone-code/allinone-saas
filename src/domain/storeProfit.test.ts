import { describe, expect, it } from "vitest";
import { computeMonthlyProfit, monthRange, OFFICE_EXPENSE_RATE, type FinanceEntry } from "./storeProfit";

const e = (
  month: string,
  source: FinanceEntry["source"],
  category: FinanceEntry["category"],
  amount: number
): FinanceEntry => ({ month, source, category, amount });

describe("computeMonthlyProfit", () => {
  it("ofis gideri satışın sabit %10'u", () => {
    expect(OFFICE_EXPENSE_RATE).toBe(0.1);
    // Den_Rapor Kar!E2: Ocak satış 3888,84 → ofis 388,884 → 388,88
    const [jan] = computeMonthlyProfit([e("2026-01", "INVENTORY_LAB", "REVENUE", 3888.84)], ["2026-01"]);
    expect(jan.officeExpense).toBe(388.88);
  });

  it("net kar kalemlerden hesaplanır: satış − COGS − Amazon − PSH − diğer − ofis", () => {
    const [m] = computeMonthlyProfit(
      [
        e("2026-02", "AMAZON", "REVENUE", 1000),
        e("2026-02", "INVENTORY_LAB", "COGS", 500),
        e("2026-02", "AMAZON", "AMAZON_FEES", 150),
        e("2026-02", "PSH", "PREP_SHIPPING", 50),
        e("2026-02", "BANK", "OTHER_EXPENSE", 30),
      ],
      ["2026-02"]
    );
    // 1000 − 500 − 150 − 50 − 30 − 100 (ofis)
    expect(m.netProfit).toBe(170);
    expect(m.marginPct).toBe(17);
    expect(m.sources).toEqual(["AMAZON", "PSH", "INVENTORY_LAB", "BANK"]);
  });

  it("aynı satış hem Amazon hem iLab'dan gelirse TOPLANMAZ, Amazon öncelikli", () => {
    const [m] = computeMonthlyProfit(
      [e("2026-03", "AMAZON", "REVENUE", 1000), e("2026-03", "INVENTORY_LAB", "REVENUE", 990)],
      ["2026-03"]
    );
    expect(m.revenue).toBe(1000);
  });

  it("Amazon yoksa gelir iLab'dan gelir", () => {
    const [m] = computeMonthlyProfit([e("2026-03", "INVENTORY_LAB", "REVENUE", 990)], ["2026-03"]);
    expect(m.revenue).toBe(990);
  });

  it("veri olmayan ay hata değil null verir (#DIV/0! yerine)", () => {
    const [m] = computeMonthlyProfit([], ["2026-08"]);
    expect(m.revenue).toBeNull();
    expect(m.netProfit).toBeNull();
    expect(m.marginPct).toBeNull();
    expect(m.officeExpense).toBe(0);
  });

  it("kümülatif net yalnız verili ayları toplar, boş ay kümülatifi bozmaz", () => {
    const rows = computeMonthlyProfit(
      [e("2026-01", "AMAZON", "REVENUE", 1000), e("2026-03", "AMAZON", "REVENUE", 2000)],
      ["2026-01", "2026-02", "2026-03"]
    );
    expect(rows.map((r) => r.cumulativeNet)).toEqual([900, 900, 2700]);
  });

  it("iLab'ın raporladığı net ile bizim hesap arasındaki farkı gösterir", () => {
    const [m] = computeMonthlyProfit(
      [e("2026-04", "AMAZON", "REVENUE", 1000), e("2026-04", "INVENTORY_LAB", "REPORTED_NET", 850)],
      ["2026-04"]
    );
    expect(m.netProfit).toBe(900);
    expect(m.reportedNet).toBe(850);
    expect(m.reportedNetDiff).toBe(50);
  });

  it("aylar sırasız verilse de sıralı döner", () => {
    const rows = computeMonthlyProfit([], ["2026-03", "2026-01"]);
    expect(rows.map((r) => r.month)).toEqual(["2026-01", "2026-03"]);
  });
});

describe("monthRange", () => {
  it("boş aylar dahil ardışık aralık üretir ve yıl sınırını geçer", () => {
    expect(monthRange([e("2026-11", "AMAZON", "REVENUE", 1), e("2027-02", "AMAZON", "REVENUE", 1)])).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
  it("kayıt yoksa boş", () => {
    expect(monthRange([])).toEqual([]);
  });
});

describe("mağaza bazlı kaynak önceliği", () => {
  it("ALL görünümünde bir mağazanın Amazon geliri diğerinin iLab gelirini düşürmez", () => {
    const rows: FinanceEntry[] = [
      { ...e("2026-09", "AMAZON", "REVENUE", 10000), storeCode: "A" },
      { ...e("2026-09", "INVENTORY_LAB", "REVENUE", 8000), storeCode: "B" },
    ];
    const [m] = computeMonthlyProfit(rows, ["2026-09"]);
    expect(m.revenue).toBe(18000);
  });
});

describe("ALLOWED_SOURCES_BY_CATEGORY", () => {
  it("PREP_SHIPPING yalnız PSH, COGS yalnız AMAZON/INVENTORY_LAB", async () => {
    const { ALLOWED_SOURCES_BY_CATEGORY } = await import("./storeProfit");
    expect(ALLOWED_SOURCES_BY_CATEGORY.PREP_SHIPPING).toEqual(["PSH"]);
    expect(ALLOWED_SOURCES_BY_CATEGORY.COGS).not.toContain("BANK");
  });
});
