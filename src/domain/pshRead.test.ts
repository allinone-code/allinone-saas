import { describe, expect, it } from "vitest";
import { PSH_HEADERS, readPshRows } from "./pshRead";

const base = {
  "Order Number": " wo1\n",
  ASIN: "b00lak1mgu<br>",
  MSKU: "HRN-b00lak1mgu ",
  Quantity: "6",
  Received: 6,
  Damaged: 0,
  Shipped: 6,
  Status: " Intransit ",
  Cost: "$20.39",
  "Purchase Date": "06/19/2026",
  Supplier: "A198",
};
const one = (over: Record<string, unknown> = {}) => readPshRows([{ ...base, ...over }]);

describe("readPshRows", () => {
  it("alanları temizler ve tipler", () => {
    const { rows, missingHeaders } = one();
    expect(missingHeaders).toEqual([]);
    expect(rows[0]).toMatchObject({
      rowNo: 2,
      orderNo: "WO1",
      asin: "B00LAK1MGU",
      msku: "HRN-B00LAK1MGU",
      qty: 6,
      received: 6,
      damaged: 0,
      shipped: 6,
      status: "intransit",
      cost: 20.39,
      supplier: "A198",
    });
    expect(rows[0].date?.toISOString()).toBe("2026-06-19T00:00:00.000Z");
  });

  it("PSH tarihi ay-önce okunur; olmayan tarih null olur", () => {
    expect(one({ "Purchase Date": "02/03/2026" }).rows[0].date?.toISOString()).toBe("2026-02-03T00:00:00.000Z");
    expect(one({ "Purchase Date": "13/02/2026" }).rows[0].date).toBeNull();
    expect(one({ "Purchase Date": "02/31/2026" }).rows[0].date).toBeNull();
    expect(one({ "Purchase Date": "" }).rows[0].date).toBeNull();
  });

  it("Excel seri sayısı ve ISO metin de tarih olarak okunur", () => {
    expect(one({ "Purchase Date": 46043 }).rows[0].date?.toISOString()).toBe("2026-01-21T00:00:00.000Z");
    expect(one({ "Purchase Date": "2026-03-10" }).rows[0].date?.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });

  it("boş girdide 9 zorunlu başlık eksik döner", () => {
    const r = readPshRows([]);
    expect(r.rows).toEqual([]);
    expect(r.missingHeaders).toHaveLength(9);
  });

  it("order, ASIN ve adet boş olan satır atlanır; satır numarası __rowNum__'dan gelir", () => {
    const blank = { ...base, "Order Number": "", ASIN: "", Quantity: "" };
    const { rows } = readPshRows([blank, { ...base, __rowNum__: 4 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNo).toBe(5);
  });

  it("başlıklar büyük/küçük harf ve boşluk toleranslı; PSH_HEADERS kullanılanları listeler", () => {
    const { rows, missingHeaders } = readPshRows([{ "order number ": "WO9", asin: "B00LAK1MGU", msku: "X", quantity: 1, received: 1, damaged: 0, status: "fulfilled", cost: 5, "purchase date": "06/01/2026" }]);
    expect(missingHeaders).toEqual([]);
    expect(rows[0].orderNo).toBe("WO9");
    expect(PSH_HEADERS).toContain("Order Number");
    expect(PSH_HEADERS).toContain("Purchase Date");
  });

  it("durum yazımı farklılıkları bilinen duruma çevrilir; bilinmeyen olduğu gibi kalır", () => {
    const st = (v: string) => one({ Status: v }).rows[0].status;
    expect(st(" In Transit ")).toBe("intransit");
    expect(st("Partially Delivered")).toBe("partially_delivered");
    expect(st("partially-delivered")).toBe("partially_delivered");
    expect(st("FULFILLED")).toBe("fulfilled");
    expect(st("Shipped Out")).toBe("shipped out");
  });
});
