import { describe, expect, it } from "vitest";
import {
  aggregateSalesByAsin,
  compareAmazonReceipts,
  compareInventoryLab,
  normalizeAmazonReceiptRows,
  normalizeInventoryLabRows,
  type SalesOrderFact,
} from "./salesReconciliation";

const order = (o: Partial<SalesOrderFact>): SalesOrderFact => ({
  asin: "B085542GWZ",
  orderNumber: "WO1",
  quantity: 4,
  p1CancelQty: 0,
  p2MissingQty: 0,
  p3DefectiveQty: 0,
  p4ExpiredQty: 0,
  totalCost: 80,
  sellingPrice: 30,
  productTitle: "Miele UltraTabs",
  ...o,
});

describe("aggregateSalesByAsin", () => {
  it("aynı ASIN'in siparişlerini birleştirir, distinct order sayar", () => {
    const m = aggregateSalesByAsin([
      order({ orderNumber: "WO1", quantity: 4, totalCost: 80 }),
      order({ orderNumber: "WO2", quantity: 6, totalCost: 120, p1CancelQty: 1, p2MissingQty: 1 }),
      order({ orderNumber: "WO2", quantity: 0, totalCost: 0 }), // aynı order tekrarı sayıyı şişirmez
    ]);
    const a = m.get("B085542GWZ")!;
    expect(a.orderCount).toBe(2);
    expect(a.units).toBe(10);
    expect(a.expectedReceived).toBe(8); // 10 − 1 iptal − 1 eksik (Excel&Amazon!H)
    expect(a.avgUnitCost).toBe(20);
    expect(a.avgSellingPrice).toBe(30);
  });

  it("ASIN'deki boşluk/küçük harfi normalize eder", () => {
    const m = aggregateSalesByAsin([order({ asin: " b085542gwz\n" })]);
    expect(m.has("B085542GWZ")).toBe(true);
  });
});

describe("compareAmazonReceipts (karşılaştırma 2)", () => {
  const sales = aggregateSalesByAsin([
    order({ asin: "AAAAAAAAAA", quantity: 15 }),
    order({ asin: "BBBBBBBBBB", quantity: 4 }),
    order({ asin: "CCCCCCCCCC", quantity: 5 }),
    order({ asin: "DDDDDDDDDD", quantity: 3 }),
  ]);
  const receipts = normalizeAmazonReceiptRows([
    { ASIN: "AAAAAAAAAA", Quantity: "14", "Event Type": "Receipts" }, // Excel&Amazon satır 3: 15 vs 14 → Problem
    { ASIN: "BBBBBBBBBB", Quantity: 4, "Event Type": "Receipts" }, //   satır 4: OK
    { ASIN: "CCCCCCCCCC", Quantity: 6, "Event Type": "Receipts" }, //   fazla
    { ASIN: "ZZZZZZZZZZ", Quantity: 2, "Event Type": "Receipts" }, //   satışta yok
    { ASIN: "DDDDDDDDDD", Quantity: -3, "Event Type": "Adjustments" }, // kabul sayılmaz
  ]);
  const { rows, summary, ignoredEventRows } = compareAmazonReceipts(sales, receipts);
  const by = (asin: string) => rows.find((r) => r.asin === asin)!;

  it("farkı ve durumu Excel formülüyle aynı hesaplar", () => {
    expect(by("AAAAAAAAAA")).toMatchObject({ expected: 15, received: 14, diff: -1, status: "EKSIK" });
    expect(by("BBBBBBBBBB")).toMatchObject({ diff: 0, status: "OK" });
    expect(by("CCCCCCCCCC")).toMatchObject({ diff: 1, status: "FAZLA" });
  });
  it("Amazon'da olmayan ASIN 'DISTA_YOK' (Yokdir)", () => {
    expect(by("DDDDDDDDDD")).toMatchObject({ received: null, diff: null, status: "DISTA_YOK" });
  });
  it("Receipt olmayan olaylar toplamı bozmaz ve sayılır", () => {
    expect(ignoredEventRows).toBe(1);
  });
  it("satışta olmayan Amazon kaydını yakalar", () => {
    expect(by("ZZZZZZZZZZ")).toMatchObject({ status: "SATISTA_YOK", received: 2 });
  });
  it("özet sayıları tutarlı, sorunlular başta", () => {
    expect(summary).toEqual({ total: 5, ok: 1, fazla: 1, eksik: 1, satistaYok: 1, distaYok: 1 });
    expect(rows[0].status).toBe("EKSIK");
    expect(rows.at(-1)!.status).toBe("OK");
  });
  it("aynı ASIN'in birden çok kabul satırını toplar (Receipt örneği: 7 + 6)", () => {
    const s = aggregateSalesByAsin([order({ quantity: 13 })]);
    const r = normalizeAmazonReceiptRows([
      { ASIN: "B085542GWZ", Quantity: "7.0", "Event Type": "Receipts" },
      { ASIN: "B085542GWZ", Quantity: "6.0", "Event Type": "Receipts" },
    ]);
    expect(compareAmazonReceipts(s, r).rows[0]).toMatchObject({ received: 13, status: "OK" });
  });
});

describe("compareInventoryLab (karşılaştırma 3)", () => {
  // AsinKar!2: Orders 39, Units/Order 1.15, Refunds 1, Revenue 2684.85, On Hand 5, Cost/Unit 18.56
  const ilab = normalizeInventoryLabRows([
    { ASIN: "B085542GWZ", Orders: "39", "Units Per Order": "1.15", Refunds: "1", "Units Per Refund": "1", Revenue: "2684.85", "On Hand": "5", "Cost/Unit": "18.56", Profit: "1123.11" },
    { ASIN: "B00R3ZLXZ6", Orders: "51", "Units Per Order": "1", Refunds: "0", Revenue: "3140.18", "On Hand": "0", "Cost/Unit": "30.9", Profit: "699.11" },
    { ASIN: "B0ONLYILAB", Orders: "2", "Units Per Order": "1", Revenue: "10", "On Hand": "1", "Cost/Unit": "5" },
  ]);

  it("satılan adedi Orders × Units/Order olarak yuvarlar", () => {
    expect(ilab[0].unitsSold).toBe(45); // 39 × 1.15 = 44.85
  });

  it("birim maliyet farkı ±2,5 içindeyse OK, dışındaysa işaretler (Excel&Ilab!H)", () => {
    const sales = aggregateSalesByAsin([
      order({ asin: "B085542GWZ", quantity: 50, totalCost: 1000 }), // ort. 20.00, iLab 18.56 → −1.44 OK
      order({ asin: "B00R3ZLXZ6", quantity: 10, totalCost: 250 }), //  ort. 25.00, iLab 30.9 → +5.90 FAZLA
    ]);
    const { rows } = compareInventoryLab(sales, ilab);
    const a = rows.find((r) => r.asin === "B085542GWZ")!;
    const b = rows.find((r) => r.asin === "B00R3ZLXZ6")!;
    expect(a).toMatchObject({ costDiff: -1.44, status: "OK" });
    expect(b).toMatchObject({ costDiff: 5.9, status: "FAZLA" });
  });

  it("beklenen stok = net alınan − iLab satılan + iade; farkı hesaplar", () => {
    const sales = aggregateSalesByAsin([order({ asin: "B085542GWZ", quantity: 50, totalCost: 1000 })]);
    const row = compareInventoryLab(sales, ilab).rows.find((r) => r.asin === "B085542GWZ")!;
    // 50 − 45 + 1 = 6 beklenen; iLab 5 → −1
    expect(row.expectedOnHand).toBe(6);
    expect(row.stockDiff).toBe(-1);
  });

  it("iLab'da olmayan satış ASIN'i ve satışta olmayan iLab ASIN'i yakalanır", () => {
    const sales = aggregateSalesByAsin([order({ asin: "B0NOTINILAB" })]);
    const { rows, summary } = compareInventoryLab(sales, ilab);
    expect(rows.find((r) => r.asin === "B0NOTINILAB")!.status).toBe("DISTA_YOK");
    expect(rows.find((r) => r.asin === "B0ONLYILAB")!.status).toBe("SATISTA_YOK");
    expect(summary.satistaYok).toBe(3);
  });

  it("tolerans parametreyle değişir", () => {
    const sales = aggregateSalesByAsin([order({ asin: "B00R3ZLXZ6", quantity: 10, totalCost: 250 })]);
    const { rows } = compareInventoryLab(sales, ilab, 10);
    expect(rows.find((r) => r.asin === "B00R3ZLXZ6")!.status).toBe("OK");
  });

  it("stok tutmayan satır stockMismatch=true olur ama maliyet durumunu değiştirmez", () => {
    const sales = aggregateSalesByAsin([order({ asin: "B085542GWZ", quantity: 50, totalCost: 1000 })]);
    const row = compareInventoryLab(sales, ilab).rows.find((r) => r.asin === "B085542GWZ")!;
    expect(row.stockMismatch).toBe(true);
    expect(row.status).toBe("OK");
  });
  it("iLab'da karşılığı olmayan satırda stockMismatch=false", () => {
    const sales = aggregateSalesByAsin([order({ asin: "B0NOTINILAB" })]);
    const row = compareInventoryLab(sales, ilab).rows.find((r) => r.asin === "B0NOTINILAB")!;
    expect(row.stockMismatch).toBe(false);
  });
});
