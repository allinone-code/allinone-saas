/**
 * Satış (Sat26/orders) listesi ↔ dış kaynak karşılaştırmaları.
 *
 * Karşılaştırma 2: Amazon "Inventory Receipts" raporu (depoya kabul edilen adet).
 * Karşılaştırma 3: Inventory Lab ASIN kâr raporu (birim maliyet, eldeki stok, satış).
 *
 * Kurallar Den_Rapor'daki mevcut Excel formüllerinden alındı:
 *  - Excel&Amazon: Excel Toplam = adet − iptal − eksik; Fark = Amazon kabul − Excel;
 *    Yok / 0=OK / >0=Fazla / <0=Problem.
 *  - Excel&Ilab: Birim maliyet farkı ±2,5 $ içindeyse OK, değilse Problem, iLab'da yoksa Yok.
 *
 * Eşleştirme anahtarı ASIN'dir (iki raporda da ortak tek alan).
 * Saf fonksiyonlar: DB/IO yok.
 */
import { normalizeHeaderLabel } from "@/lib/importFieldSchema";

export type ReconStatus = "OK" | "FAZLA" | "EKSIK" | "SATISTA_YOK" | "DISTA_YOK";

export const ILAB_COST_TOLERANCE = 2.5;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
export const normalizeAsinKey = (v: unknown): string =>
  String(v ?? "").replace(/\s+/g, "").toUpperCase();

/* ── Satış tarafı ── */

export interface SalesOrderFact {
  asin: string;
  orderNumber: string;
  quantity: number;
  p1CancelQty: number;
  p2MissingQty: number;
  p3DefectiveQty: number;
  p4ExpiredQty: number;
  totalCost: number;
  sellingPrice: number; // birim satış fiyatı
  productTitle?: string;
}

export interface SalesAsinAggregate {
  asin: string;
  title: string;
  orderCount: number;
  units: number;
  cancelled: number;
  missing: number;
  defective: number;
  expired: number;
  /** Excel'in "toplam" mantığı: adet − iptal − eksik (Excel&Amazon!H). */
  expectedReceived: number;
  /** Fiziksel olarak elde olması beklenen net adet: adet − tüm fire. */
  netUnits: number;
  totalCost: number;
  avgUnitCost: number | null;
  avgSellingPrice: number | null;
}

export function aggregateSalesByAsin(rows: SalesOrderFact[]): Map<string, SalesAsinAggregate> {
  const acc = new Map<string, SalesAsinAggregate & { _orders: Set<string>; _priceUnits: number; _priceSum: number }>();
  for (const r of rows) {
    const asin = normalizeAsinKey(r.asin);
    if (!asin) continue;
    let a = acc.get(asin);
    if (!a) {
      a = {
        asin, title: r.productTitle ?? "", orderCount: 0, units: 0, cancelled: 0, missing: 0, defective: 0,
        expired: 0, expectedReceived: 0, netUnits: 0, totalCost: 0, avgUnitCost: null, avgSellingPrice: null,
        _orders: new Set(), _priceUnits: 0, _priceSum: 0,
      };
      acc.set(asin, a);
    }
    a._orders.add(r.orderNumber.trim());
    a.units += r.quantity;
    a.cancelled += r.p1CancelQty;
    a.missing += r.p2MissingQty;
    a.defective += r.p3DefectiveQty;
    a.expired += r.p4ExpiredQty;
    a.totalCost += r.totalCost;
    a._priceUnits += r.quantity;
    a._priceSum += r.sellingPrice * r.quantity;
  }
  const out = new Map<string, SalesAsinAggregate>();
  for (const [asin, a] of acc) {
    const expectedReceived = a.units - a.cancelled - a.missing;
    const netUnits = a.units - a.cancelled - a.missing - a.defective - a.expired;
    out.set(asin, {
      asin, title: a.title, orderCount: a._orders.size, units: a.units, cancelled: a.cancelled,
      missing: a.missing, defective: a.defective, expired: a.expired, expectedReceived, netUnits,
      totalCost: round2(a.totalCost),
      avgUnitCost: a.units > 0 ? round2(a.totalCost / a.units) : null,
      avgSellingPrice: a._priceUnits > 0 ? round2(a._priceSum / a._priceUnits) : null,
    });
  }
  return out;
}

/* ── Başlık eşleme yardımcısı ── */

function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  const wanted = new Set(aliases.map(normalizeHeaderLabel));
  for (const [k, v] of Object.entries(row)) if (wanted.has(normalizeHeaderLabel(k))) return v;
  return undefined;
}

/* ── Karşılaştırma 2: Amazon kabul ── */

export interface AmazonReceiptRow {
  asin: string;
  quantity: number;
  eventType: string;
}

export function normalizeAmazonReceiptRows(raw: Record<string, unknown>[]): AmazonReceiptRow[] {
  return raw
    .map((r) => ({
      asin: normalizeAsinKey(pick(r, ["ASIN"])),
      quantity: num(pick(r, ["Quantity", "Adet"])),
      eventType: String(pick(r, ["Event Type", "EventType"]) ?? "Receipts").trim(),
    }))
    .filter((r) => r.asin);
}

export interface AmazonCompareRow {
  asin: string;
  title: string;
  orderCount: number;
  orderedUnits: number;
  cancelled: number;
  missing: number;
  expected: number;
  received: number | null;
  diff: number | null;
  status: ReconStatus;
  totalCost: number;
}

export interface ReconSummary {
  total: number;
  ok: number;
  fazla: number;
  eksik: number;
  satistaYok: number;
  distaYok: number;
}

const summarize = (rows: { status: ReconStatus }[]): ReconSummary => ({
  total: rows.length,
  ok: rows.filter((r) => r.status === "OK").length,
  fazla: rows.filter((r) => r.status === "FAZLA").length,
  eksik: rows.filter((r) => r.status === "EKSIK").length,
  satistaYok: rows.filter((r) => r.status === "SATISTA_YOK").length,
  distaYok: rows.filter((r) => r.status === "DISTA_YOK").length,
});

export function compareAmazonReceipts(
  sales: Map<string, SalesAsinAggregate>,
  receipts: AmazonReceiptRow[]
): { rows: AmazonCompareRow[]; summary: ReconSummary; ignoredEventRows: number } {
  // Yalnız "Receipts" olayları kabul sayılır; Adjustments/Removals gibi olaylar toplamı bozmasın.
  const isReceipt = (e: string) => /receipt/i.test(e);
  const received = new Map<string, number>();
  let ignoredEventRows = 0;
  for (const r of receipts) {
    if (!isReceipt(r.eventType)) {
      ignoredEventRows++;
      continue;
    }
    received.set(r.asin, (received.get(r.asin) ?? 0) + r.quantity);
  }

  const rows: AmazonCompareRow[] = [];
  for (const s of sales.values()) {
    const got = received.has(s.asin) ? received.get(s.asin)! : null;
    const diff = got === null ? null : got - s.expectedReceived;
    rows.push({
      asin: s.asin, title: s.title, orderCount: s.orderCount, orderedUnits: s.units, cancelled: s.cancelled,
      missing: s.missing, expected: s.expectedReceived, received: got, diff,
      status: diff === null ? "DISTA_YOK" : diff === 0 ? "OK" : diff > 0 ? "FAZLA" : "EKSIK",
      totalCost: s.totalCost,
    });
  }
  // Amazon'da olup satış listesinde olmayanlar (Excel&PSH "Excelde olmayan" karşılığı)
  for (const [asin, qty] of received) {
    if (!sales.has(asin)) {
      rows.push({
        asin, title: "", orderCount: 0, orderedUnits: 0, cancelled: 0, missing: 0, expected: 0,
        received: qty, diff: qty, status: "SATISTA_YOK", totalCost: 0,
      });
    }
  }
  rows.sort((a, b) => severity(a.status) - severity(b.status) || a.asin.localeCompare(b.asin));
  return { rows, summary: summarize(rows), ignoredEventRows };
}

/** Sıralama: önce sorunlular. */
function severity(s: ReconStatus): number {
  return { EKSIK: 0, SATISTA_YOK: 1, DISTA_YOK: 2, FAZLA: 3, OK: 4 }[s];
}

/* ── Karşılaştırma 3: Inventory Lab ── */

export interface InventoryLabRow {
  asin: string;
  orders: number;
  unitsSold: number;
  refundedUnits: number;
  revenue: number;
  onHand: number;
  costPerUnit: number;
  profit: number;
}

/** AsinKar sayfasının kolonları: Orders, Units Per Order, Refunds, Units Per Refund, Revenue, On Hand, Cost/Unit, Profit. */
export function normalizeInventoryLabRows(raw: Record<string, unknown>[]): InventoryLabRow[] {
  return raw
    .map((r) => {
      const orders = num(pick(r, ["Orders"]));
      const refunds = num(pick(r, ["Refunds"]));
      return {
        asin: normalizeAsinKey(pick(r, ["ASIN"])),
        orders,
        unitsSold: Math.round(orders * (num(pick(r, ["Units Per Order"])) || 1)),
        refundedUnits: Math.round(refunds * (num(pick(r, ["Units Per Refund"])) || 1)),
        revenue: num(pick(r, ["Revenue"])),
        onHand: num(pick(r, ["On Hand"])),
        costPerUnit: num(pick(r, ["Cost/Unit", "Cost per Unit"])),
        profit: num(pick(r, ["Profit"])),
      };
    })
    .filter((r) => r.asin);
}

export interface InventoryLabCompareRow {
  asin: string;
  title: string;
  salesUnits: number;
  salesAvgUnitCost: number | null;
  salesAvgPrice: number | null;
  ilabCostPerUnit: number | null;
  costDiff: number | null;
  ilabOnHand: number | null;
  ilabUnitsSold: number | null;
  ilabRevenue: number | null;
  ilabProfit: number | null;
  /** Beklenen eldeki stok = net alınan − iLab satılan + iLab iade. Pencere dışı alımlar farkı şişirir. */
  expectedOnHand: number | null;
  stockDiff: number | null;
  /**
   * Stok uyuşmuyor mu (stockDiff ≠ 0)? `status` yalnız maliyete bakar; stok farkı
   * pencere dışı alımlarla şiştiği için duruma katılmaz, ayrı gösterge olarak verilir.
   */
  stockMismatch: boolean;
  status: ReconStatus;
}

export function compareInventoryLab(
  sales: Map<string, SalesAsinAggregate>,
  ilab: InventoryLabRow[],
  tolerance = ILAB_COST_TOLERANCE
): { rows: InventoryLabCompareRow[]; summary: ReconSummary } {
  const byAsin = new Map(ilab.map((r) => [r.asin, r]));
  const rows: InventoryLabCompareRow[] = [];

  for (const s of sales.values()) {
    const l = byAsin.get(s.asin);
    if (!l) {
      rows.push({
        asin: s.asin, title: s.title, salesUnits: s.units, salesAvgUnitCost: s.avgUnitCost,
        salesAvgPrice: s.avgSellingPrice, ilabCostPerUnit: null, costDiff: null, ilabOnHand: null,
        ilabUnitsSold: null, ilabRevenue: null, ilabProfit: null, expectedOnHand: null, stockDiff: null,
        stockMismatch: false, status: "DISTA_YOK",
      });
      continue;
    }
    const costDiff = s.avgUnitCost === null ? null : round2(l.costPerUnit - s.avgUnitCost);
    const expectedOnHand = s.netUnits - l.unitsSold + l.refundedUnits;
    rows.push({
      asin: s.asin, title: s.title, salesUnits: s.units, salesAvgUnitCost: s.avgUnitCost,
      salesAvgPrice: s.avgSellingPrice, ilabCostPerUnit: l.costPerUnit, costDiff, ilabOnHand: l.onHand,
      ilabUnitsSold: l.unitsSold, ilabRevenue: l.revenue, ilabProfit: l.profit, expectedOnHand,
      stockDiff: l.onHand - expectedOnHand,
      stockMismatch: l.onHand !== expectedOnHand,
      status: costDiff === null ? "OK" : costDiff > tolerance ? "FAZLA" : costDiff < -tolerance ? "EKSIK" : "OK",
    });
  }
  for (const l of ilab) {
    if (!sales.has(l.asin)) {
      rows.push({
        asin: l.asin, title: "", salesUnits: 0, salesAvgUnitCost: null, salesAvgPrice: null,
        ilabCostPerUnit: l.costPerUnit, costDiff: null, ilabOnHand: l.onHand, ilabUnitsSold: l.unitsSold,
        ilabRevenue: l.revenue, ilabProfit: l.profit, expectedOnHand: null, stockDiff: null,
        stockMismatch: false, status: "SATISTA_YOK",
      });
    }
  }
  rows.sort((a, b) => severity(a.status) - severity(b.status) || a.asin.localeCompare(b.asin));
  return { rows, summary: summarize(rows) };
}
