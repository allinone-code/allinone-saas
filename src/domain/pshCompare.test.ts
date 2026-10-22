import { describe, expect, it } from "vitest";
import type { XrayRow } from "./sat26XrayRead";
import type { PshRow } from "./pshRead";
import { buildPshCompare, comparePsh, type PshFinding, type PshFindingCode } from "./pshCompare";

let n = 1;
const buy = (over: Partial<XrayRow> = {}): XrayRow => ({
  rowNo: ++n,
  buyer: "",
  date: new Date("2026-06-01T00:00:00.000Z"),
  label: "",
  orderNo: "WO1",
  asinRaw: "B00LAK1MGU",
  asin: "B00LAK1MGU",
  mskuRaw: "B00LAK1MGU",
  msku: "B00LAK1MGU",
  qty: 4,
  unitCost: 10,
  totalCost: 40,
  cargoStatus: "Tam Geldi",
  card: "1753",
  shipped: 0,
  p1: 0,
  p2: 0,
  p3: 0,
  p4: 0,
  ...over,
});
const psh = (over: Partial<PshRow> = {}): PshRow => ({
  rowNo: ++n,
  orderNo: "WO1",
  asin: "B00LAK1MGU",
  msku: "B00LAK1MGU",
  qty: 4,
  received: 4,
  damaged: 0,
  shipped: 4,
  status: "fulfilled",
  cost: 10,
  date: new Date("2026-06-19T00:00:00.000Z"),
  supplier: "",
  ...over,
});
const of = (f: PshFinding[], code: PshFindingCode) => f.filter((x) => x.code === code);
const codes = (f: PshFinding[]) => f.map((x) => x.code).sort();

describe("comparePsh: eşleşme ve teslim", () => {
  it("aynı adet ve fiyatta bulgu çıkmaz", () => {
    const r = comparePsh([buy()], [psh()]);
    expect(r.findings).toEqual([]);
    expect(r.cards).toMatchObject({ purchaseKeys: 1, pshKeys: 1, matched: 1 });
  });

  it("eksik teslim ve hasarlı: etki adet x alım birim maliyeti", () => {
    const r = comparePsh([buy({ qty: 5, totalCost: 50 })], [psh({ qty: 5, received: 3, damaged: 1 })]);
    expect(of(r.findings, "MISSING_DELIVERY")[0]).toMatchObject({ impactUsd: 10, severity: "high" });
    expect(of(r.findings, "DAMAGED")[0].impactUsd).toBe(10);
    expect(of(r.findings, "QTY_DIFF")).toHaveLength(0);
  });

  it("intransit: eksik teslim değil Bekleniyor; hasar yine bulgu; partially_delivered PARTIAL olur", () => {
    const b = buy({ qty: 5, totalCost: 50 });
    const r = comparePsh([b], [psh({ qty: 5, received: 3, damaged: 1, status: "intransit" })]);
    expect(of(r.findings, "MISSING_DELIVERY")).toHaveLength(0);
    expect(of(r.findings, "DAMAGED")).toHaveLength(1);
    expect(r.waitingItems).toHaveLength(1);
    expect(r.waitingItems[0]).toMatchObject({ kind: "INTRANSIT", missingQty: 1, valueUsd: 10 });
    expect(r.waiting.INTRANSIT).toEqual({ keys: 1, missingQty: 1, valueUsd: 10 });
    const p = comparePsh([b], [psh({ qty: 5, received: 5, status: "partially_delivered" })]);
    expect(p.waitingItems[0].kind).toBe("PARTIAL");
  });

  it("boş veya bilinmeyen PSH durumu: ne eksik teslim ne Bekleniyor", () => {
    for (const status of ["", "cancelled"]) {
      const r = comparePsh([buy()], [psh({ received: 0, status })]);
      expect(of(r.findings, "MISSING_DELIVERY")).toHaveLength(0);
      expect(r.waitingItems).toEqual([]);
    }
  });

  it("adet farkı: fark adedi x birim maliyet", () => {
    const r = comparePsh([buy()], [psh({ qty: 6, received: 6 })]);
    expect(of(r.findings, "QTY_DIFF")[0].impactUsd).toBe(20);
  });
});

describe("comparePsh: iptal", () => {
  const cancelled = () => buy({ qty: 3, totalCost: 30, cargoStatus: "İPTAL" });

  it("iptal alım, PSH'ta Received > 0 ise İptal çelişkisi; adet/eksik kontrolleri atlanır", () => {
    const r = comparePsh([cancelled()], [psh({ qty: 3, received: 2 })]);
    expect(codes(r.findings)).toEqual(["CANCEL_CONFLICT"]);
    expect(r.findings[0].impactUsd).toBe(20);
  });

  it("iptal alım PSH'ta yoksa sessiz geçilir", () => {
    const r = comparePsh([cancelled()], [psh({ orderNo: "WO9" })]);
    expect(of(r.findings, "NOT_IN_PSH")).toHaveLength(0);
    expect(r.waitingItems).toEqual([]);
    expect(r.cards.cancelledSkipped).toBe(1);
  });
});

describe("comparePsh: fiyat ve MSKU", () => {
  it("eşik üstü PRICE_DIFF (PSH − alım) x adet; eşik altı gri; eşik ayarlanabilir; aynı fiyat bulgusuz", () => {
    const at = (cost: number, opts = {}) => comparePsh([buy()], [psh({ cost })], opts).findings;
    expect(of(at(12), "PRICE_DIFF")[0]).toMatchObject({ impactUsd: 8, muted: false });
    expect(of(at(10.5), "PRICE_DIFF")[0].muted).toBe(true);
    expect(of(at(10), "PRICE_DIFF")).toHaveLength(0);
    expect(of(at(12, { priceTolerancePct: 30 }), "PRICE_DIFF")[0].muted).toBe(true);
  });

  it("MSKU_DIFF: önek farkı gri, tamamen farklı gri değil, büyük/küçük harf ve boşluk fark sayılmaz", () => {
    const at = (a: string, b: string) => of(comparePsh([buy({ msku: a })], [psh({ msku: b })]).findings, "MSKU_DIFF");
    expect(at("HRN-B00LAK1MGU", "B00LAK1MGU")[0].muted).toBe(true);
    expect(at("ABC", "XYZ")[0].muted).toBe(false);
    expect(at("hrn-b00lak1mgu ", "HRN-B00LAK1MGU")).toHaveLength(0);
  });
});

describe("comparePsh: eşleşmeyenler ve Bekleniyor", () => {
  const anchor = psh({ orderNo: "WO1" }); // en yeni PSH tarihi 2026-06-19 -> sınır 2026-06-05
  const run = (extra: XrayRow[], pshRows: PshRow[] = [anchor]) => comparePsh([buy(), ...extra], pshRows);

  it("sınırdan sonraki tarih Bekleniyor; sınır günü ve öncesi PSH'ta yok bulgusu (etki adet x birim)", () => {
    const r = run([
      buy({ orderNo: "WO2", date: new Date("2026-06-10T00:00:00.000Z") }),
      buy({ orderNo: "WO3", date: new Date("2026-06-05T00:00:00.000Z") }),
      buy({ orderNo: "WO4", date: new Date("2026-06-01T00:00:00.000Z") }),
    ]);
    expect(r.cards.cutoffDate?.toISOString()).toBe("2026-06-05T00:00:00.000Z");
    expect(r.waitingItems.map((w) => [w.kind, w.orderNo])).toEqual([["NOT_YET_IN_PSH", "WO2"]]);
    expect(of(r.findings, "NOT_IN_PSH").map((f) => f.orderNo).sort()).toEqual(["WO3", "WO4"]);
    expect(of(r.findings, "NOT_IN_PSH")[0].impactUsd).toBe(40);
    expect(r.waiting.NOT_YET_IN_PSH).toEqual({ keys: 1, missingQty: 4, valueUsd: 40 });
  });

  it("tarihsiz alım satırı ve tarihsiz PSH dosyası bulgu olur, Bekleniyor olmaz", () => {
    const r = run([buy({ orderNo: "WO2", date: null })]);
    expect(of(r.findings, "NOT_IN_PSH")).toHaveLength(1);
    const undated = run([buy({ orderNo: "WO2", date: new Date("2026-07-01T00:00:00.000Z") })], [psh({ date: null })]);
    expect(undated.cards.cutoffDate).toBeNull();
    expect(undated.waitingItems).toEqual([]);
    expect(of(undated.findings, "NOT_IN_PSH")).toHaveLength(1);
  });

  it("PSH'ta olup alımda olmayan satır: etki adet x PSH maliyeti", () => {
    const r = comparePsh([], [psh({ orderNo: "WO7", qty: 3, cost: 5 })]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ code: "NOT_IN_PURCHASE", impactUsd: 15 });
  });

  it("WO/W0 farkı birleştirilmez: tek TYPO_SUSPECT, ayrıca PSH'ta yok / alımda yok üretilmez", () => {
    const r = comparePsh([buy({ orderNo: "WO110085599" })], [psh({ orderNo: "W0110085599" })]);
    expect(codes(r.findings)).toEqual(["TYPO_SUSPECT"]);
    expect(r.cards.matched).toBe(0);
  });
});

describe("comparePsh: tekrar eden anahtar, toplamlar, sıralama", () => {
  it("PSH'ta aynı anahtar iki satır: toplanır, tek DUPLICATE_KEY, sahte adet farkı yok, maliyet ağırlıklı", () => {
    const r = comparePsh([buy()], [psh({ qty: 2, received: 2, cost: 10 }), psh({ qty: 2, received: 2, cost: 12 })]);
    expect(of(r.findings, "DUPLICATE_KEY")).toHaveLength(1);
    expect(of(r.findings, "QTY_DIFF")).toHaveLength(0);
    // ağırlıklı maliyet 11, alım 10: tam %10 sınırı eşik üstü sayılmaz -> gri
    expect(of(r.findings, "PRICE_DIFF")[0]).toMatchObject({ muted: true, impactUsd: 4 });
    expect(r.cards.pshKeys).toBe(1);
  });

  it("totals gri bulguları saymaz; büyük etki üstte, gri bulgular en sonda", () => {
    const r = comparePsh(
      [buy({ orderNo: "WO1" }), buy({ orderNo: "WO2" })],
      [psh({ orderNo: "WO1", cost: 10.5 }), psh({ orderNo: "WO2", received: 0 })],
    );
    expect(r.findings[0].code).toBe("MISSING_DELIVERY");
    expect(r.findings[r.findings.length - 1]).toMatchObject({ code: "PRICE_DIFF", muted: true });
    expect(r.totals.PRICE_DIFF).toEqual({ count: 0, impactUsd: 0 });
    expect(r.totals.MISSING_DELIVERY).toEqual({ count: 1, impactUsd: 40 });
  });
});

describe("buildPshCompare", () => {
  const rawBuy = { Tarih: 46043, ASIN: "\nb00lak1mgu", MSKU: "B00LAK1MGU", Orderno: "WO1", "Ürün adedi": 4, "Ürün birim maliyeti": 10, "Ürün toplam maliyeti": 40, "Kargo durumu": "Tam Geldi", "Kredi Kartı": 1753 };
  const rawPsh = { "Order Number": "WO1", ASIN: "B00LAK1MGU<br>", MSKU: "B00LAK1MGU", Quantity: 4, Received: 3, Damaged: 0, Status: "fulfilled", Cost: 10, "Purchase Date": "06/19/2026" };

  it("eksik başlıklar iki taraf için ayrı döner", () => {
    const r = buildPshCompare([], []);
    expect(r.missingHeaders.purchase).toHaveLength(9);
    expect(r.missingHeaders.psh).toHaveLength(9);
    expect(r.findings).toEqual([]);
  });

  it("ham satırlardan uçtan uca bulgu üretir; kirli ASIN'ler eşleşir", () => {
    const r = buildPshCompare([rawBuy], [rawPsh]);
    expect(r.missingHeaders).toEqual({ purchase: [], psh: [] });
    expect(r.cards.matched).toBe(1);
    expect(codes(r.findings)).toEqual(["MISSING_DELIVERY"]);
    expect(r.findings[0].impactUsd).toBe(10);
  });
});
