import { describe, expect, it } from "vitest";
import type { XrayRow } from "./sat26XrayRead";
import { summarizeXray } from "./sat26Xray";

let n = 1;
const row = (over: Partial<XrayRow> = {}): XrayRow => ({
  rowNo: ++n,
  buyer: "HRN",
  date: new Date("2026-03-10T00:00:00.000Z"),
  label: "M26",
  orderNo: `WO${n}`,
  asinRaw: "B00LAK1MGU",
  asin: "B00LAK1MGU",
  mskuRaw: "HRN-B00LAK1MGU",
  msku: "HRN-B00LAK1MGU",
  qty: 2,
  unitCost: 10,
  totalCost: 20,
  cargoStatus: "Tam Geldi",
  card: "1753",
  shipped: 0,
  p1: 0,
  p2: 0,
  p3: 0,
  p4: 0,
  ...over,
});

describe("summarizeXray", () => {
  const rows = [
    row({ orderNo: "WO1", asin: "B00LAK1MGU", asinRaw: "\nB00LAK1MGU", qty: 2, unitCost: 10, totalCost: 20 }),
    row({ orderNo: "WO2", asin: "B00LAK1MGU", qty: 4, unitCost: 12, totalCost: 48, card: "" }),
    row({ orderNo: "WO3", asin: "B01CQ3E6HG", msku: "HRN-B01CQ3E6HG", qty: 6, unitCost: 5, totalCost: 30, cargoStatus: "İPTAL", date: new Date("2026-01-05T00:00:00.000Z") }),
  ];
  const s = summarizeXray(rows);

  it("kartlar toplamları, iptal oranını ve iptal hariç değerleri verir", () => {
    expect(s.cards).toMatchObject({
      rows: 3,
      orders: 3,
      asins: 2,
      mskus: 2,
      units: 12,
      cost: 98,
      cancelledRows: 1,
      unitsExCancelled: 6,
      costExCancelled: 68,
    });
    expect(s.cards.cancelledRate).toBeCloseTo(1 / 3, 5);
    expect(s.cards.avgUnitCost).toBeCloseTo(98 / 12, 5);
  });

  it("temizlenmiş ve ham ASIN tek grupta birleşir; gruplar maliyete göre azalan sıralanır", () => {
    expect(s.byAsin.map((g) => g.key)).toEqual(["B00LAK1MGU", "B01CQ3E6HG"]);
    expect(s.byAsin[0]).toMatchObject({ rows: 2, units: 6, cost: 68, minUnitCost: 10, maxUnitCost: 12 });
    expect(s.byAsin[0].avgUnitCost).toBeCloseTo(68 / 6, 5);
  });

  it("boş kart 'Kart yok' grubuna, tarihler ay anahtarına ve tarihsiz sona düşer", () => {
    expect(s.byCard.map((g) => g.key).sort()).toEqual(["1753", "Kart yok"]);
    const withUndated = summarizeXray([...rows, row({ date: null })]);
    expect(withUndated.byMonth.map((g) => g.key)).toEqual(["2026-01", "2026-03", "Tarihsiz"]);
  });

  it("iptal satır sayısı grup bazında tutulur", () => {
    expect(s.byAsin.find((g) => g.key === "B01CQ3E6HG")?.cancelledRows).toBe(1);
  });

  it("boş girdide her şey 0, ortalama null olur", () => {
    const e = summarizeXray([]);
    expect(e.cards).toMatchObject({ rows: 0, orders: 0, asins: 0, units: 0, cost: 0, avgUnitCost: null, cancelledRate: 0 });
    expect(e.byAsin).toEqual([]);
  });
});
