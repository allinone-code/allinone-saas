import { describe, expect, it } from "vitest";
import type { XrayRow } from "./sat26XrayRead";
import { buildXray, findXrayIssues, summarizeXray, type XrayFinding } from "./sat26Xray";

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

const codes = (f: XrayFinding[]) => f.map((x) => x.code);
const of = (f: XrayFinding[], code: XrayFinding["code"]) => f.filter((x) => x.code === code);

describe("findXrayIssues", () => {
  it("PRICE_OUTLIER: medyandan %25 fazla sapan satırı etkisiyle işaretler; 3'ten az satırlı ASIN'de işaretlemez", () => {
    const mk = (unit: number, qty = 2) => row({ qty, unitCost: unit, totalCost: unit * qty });
    const f = findXrayIssues([mk(20), mk(20), mk(20), mk(30, 3)]);
    const hits = of(f, "PRICE_OUTLIER");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ severity: "high", impactUsd: 30 }); // (30-20) x 3
    expect(of(findXrayIssues([mk(20), mk(30)]), "PRICE_OUTLIER")).toHaveLength(0);
  });

  it("PRICE_OUTLIER eşiği ayarlanabilir", () => {
    const mk = (unit: number) => row({ qty: 1, unitCost: unit, totalCost: unit });
    const rows = [mk(20), mk(20), mk(20), mk(24)];
    expect(of(findXrayIssues(rows), "PRICE_OUTLIER")).toHaveLength(0);
    expect(of(findXrayIssues(rows, { priceDeviationPct: 10 }), "PRICE_OUTLIER")).toHaveLength(1);
  });

  it("ASIN_DIRTY ham ASIN temizlenince değişiyorsa; ASIN_INVALID biçim bozuksa", () => {
    const f = findXrayIssues([row({ asinRaw: "\nB00LAK1MGU", asin: "B00LAK1MGU" }), row({ asinRaw: "XYZ", asin: "XYZ" })]);
    expect(of(f, "ASIN_DIRTY")).toHaveLength(1);
    expect(of(f, "ASIN_INVALID")).toHaveLength(1);
    expect(of(f, "ASIN_INVALID")[0].asin).toBe("XYZ");
  });

  it("küçük harfli ASIN için mesaj gizli boşluk demez", () => {
    const f = findXrayIssues([row({ asinRaw: "b00lak1mgu", asin: "B00LAK1MGU" })]);
    expect(of(f, "ASIN_DIRTY")[0].message).not.toMatch(/gizli/);
  });

  it("MSKU_DIRTY ham MSKU temizlenince değişiyorsa", () => {
    const f = findXrayIssues([row({ mskuRaw: "\nFCRB00LAK1MGU", msku: "FCRB00LAK1MGU" })]);
    expect(codes(f)).toContain("MSKU_DIRTY");
  });

  it("TOTAL_MISMATCH: adet x birim toplamla tutmuyorsa fark etkisiyle; adet 0 ise üretmez", () => {
    const f = findXrayIssues([row({ qty: 4, unitCost: 10, totalCost: 50 }), row({ qty: 0, unitCost: null, totalCost: 0 })]);
    const hits = of(f, "TOTAL_MISMATCH");
    expect(hits).toHaveLength(1);
    expect(hits[0].impactUsd).toBe(10);
  });

  it("QTY_OVERFLOW: gönderilen + fire adedi aşarsa", () => {
    const f = findXrayIssues([row({ qty: 4, shipped: 3, p2: 2 })]);
    expect(codes(f)).toContain("QTY_OVERFLOW");
    expect(codes(findXrayIssues([row({ qty: 4, shipped: 3, p2: 1 })]))).not.toContain("QTY_OVERFLOW");
  });

  it("STATUS_EMPTY, CARD_EMPTY ve CARD_RARE", () => {
    const f = findXrayIssues([
      row({ cargoStatus: "" }),
      row({ card: "" }),
      row({ card: "4550" }),
      row({ card: "1753" }),
      row({ card: "1753" }),
    ]);
    expect(of(f, "STATUS_EMPTY")).toHaveLength(1);
    expect(of(f, "CARD_EMPTY")).toHaveLength(1);
    expect(of(f, "CARD_RARE")).toHaveLength(1);
  });

  it("DATE_OUTLIER: en sık yıldan farklı yıl", () => {
    const old = row({ date: new Date("2025-03-12T00:00:00.000Z") });
    const f = findXrayIssues([row(), row(), row(), old]);
    expect(of(f, "DATE_OUTLIER").map((x) => x.rowNo)).toEqual([old.rowNo]);
  });

  it("LABEL_EMPTY ve LABEL_YEAR_MISMATCH (etiket yılı tarih yılıyla uyuşmuyorsa)", () => {
    const f = findXrayIssues([row({ label: "" }), row({ label: "T27" }), row({ label: "T26" })]);
    expect(of(f, "LABEL_EMPTY")).toHaveLength(1);
    expect(of(f, "LABEL_YEAR_MISMATCH")).toHaveLength(1);
  });

  it("hiçbir satırda etiket yoksa (Tarih2 kolonu yok) LABEL_EMPTY üretmez", () => {
    expect(of(findXrayIssues([row({ label: "" }), row({ label: "" })]), "LABEL_EMPTY")).toHaveLength(0);
  });

  it("DUPLICATE_KEY: aynı order+ASIN tekrar eden her satır için", () => {
    const f = findXrayIssues([row({ orderNo: "WO9" }), row({ orderNo: "WO9" }), row({ orderNo: "WO8" })]);
    expect(of(f, "DUPLICATE_KEY")).toHaveLength(2);
  });

  it("sıralama: büyük dolar etkisi üstte, etkisizler sonda (önem sırasıyla)", () => {
    const big = row({ qty: 10, unitCost: 10, totalCost: 200 }); // +100
    const small = row({ qty: 1, unitCost: 10, totalCost: 12 }); // +2
    const f = findXrayIssues([small, big, row({ cargoStatus: "" })]);
    expect(f[0].rowNo).toBe(big.rowNo);
    expect(f[1].rowNo).toBe(small.rowNo);
    expect(f[f.length - 1].impactUsd).toBeNull();
  });

  it("iptal satırda PRICE_OUTLIER üretmez", () => {
    const mk = (unit: number, st = "Tam Geldi") => row({ qty: 1, unitCost: unit, totalCost: unit, cargoStatus: st });
    expect(of(findXrayIssues([mk(20), mk(20), mk(20), mk(40, "İPTAL")]), "PRICE_OUTLIER")).toHaveLength(0);
  });
});

describe("buildXray", () => {
  it("boş girdi: 9 zorunlu başlık eksik, bulgu yok, kartlar 0", () => {
    const r = buildXray([]);
    expect(r.missingHeaders).toHaveLength(9);
    expect(r.findings).toEqual([]);
    expect(r.summary.cards.rows).toBe(0);
    expect(r.scanned).toBe(0);
  });

  it("ham satırlardan özet ve bulgu üretir", () => {
    const raw = [
      { Tarih: 46043, ASIN: "\nB00LAK1MGU", MSKU: "HRN-B00LAK1MGU", Orderno: "WO1", "Ürün adedi": 2, "Ürün birim maliyeti": 10, "Ürün toplam maliyeti": 20, "Kargo durumu": "", "Kredi Kartı": 1753 },
    ];
    const r = buildXray(raw);
    expect(r.missingHeaders).toEqual([]);
    expect(r.scanned).toBe(1);
    expect(r.summary.cards.asins).toBe(1);
    expect(r.findings.map((f) => f.code).sort()).toEqual(["ASIN_DIRTY", "CARD_RARE", "STATUS_EMPTY"]);
  });
});
