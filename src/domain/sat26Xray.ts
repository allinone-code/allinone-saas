/**
 * Alım listesi (Sat26) röntgeni — özet kartları, kırılımlar ve hata bulucu.
 * Saf fonksiyonlar: DB/IO yok, hiçbir şeyi düzeltmez.
 */
import { isCancelledStatus } from "./sat26Hygiene";
import { readSat26Rows, type XrayRow } from "./sat26XrayRead";

export interface XrayGroup {
  key: string;
  rows: number;
  units: number;
  cost: number;
  avgUnitCost: number | null;
  minUnitCost: number | null;
  maxUnitCost: number | null;
  cancelledRows: number;
}

export interface XrayCards {
  rows: number;
  orders: number;
  asins: number;
  mskus: number;
  units: number;
  cost: number;
  avgUnitCost: number | null;
  cancelledRows: number;
  /** 0..1 */
  cancelledRate: number;
  unitsExCancelled: number;
  costExCancelled: number;
}

export interface XraySummary {
  cards: XrayCards;
  byAsin: XrayGroup[];
  byOrder: XrayGroup[];
  byMsku: XrayGroup[];
  byCard: XrayGroup[];
  byMonth: XrayGroup[];
}

const NO_CARD = "Kart yok";
const NO_DATE = "Tarihsiz";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function groupBy(rows: XrayRow[], keyOf: (r: XrayRow) => string): XrayGroup[] {
  const map = new Map<string, XrayGroup>();
  for (const r of rows) {
    const key = keyOf(r);
    const g =
      map.get(key) ??
      map.set(key, { key, rows: 0, units: 0, cost: 0, avgUnitCost: null, minUnitCost: null, maxUnitCost: null, cancelledRows: 0 }).get(key)!;
    g.rows++;
    g.units += r.qty;
    g.cost += r.totalCost;
    if (isCancelledStatus(r.cargoStatus)) g.cancelledRows++;
    if (r.unitCost !== null) {
      g.minUnitCost = g.minUnitCost === null ? r.unitCost : Math.min(g.minUnitCost, r.unitCost);
      g.maxUnitCost = g.maxUnitCost === null ? r.unitCost : Math.max(g.maxUnitCost, r.unitCost);
    }
  }
  for (const g of map.values()) {
    g.avgUnitCost = g.units > 0 ? g.cost / g.units : null;
    g.cost = round2(g.cost);
  }
  return [...map.values()];
}

const byCostDesc = (a: XrayGroup, b: XrayGroup): number => b.cost - a.cost || a.key.localeCompare(b.key);

export function summarizeXray(rows: XrayRow[]): XraySummary {
  const cancelled = rows.filter((r) => isCancelledStatus(r.cargoStatus));
  const units = rows.reduce((s, r) => s + r.qty, 0);
  const cost = rows.reduce((s, r) => s + r.totalCost, 0);
  const unitsEx = units - cancelled.reduce((s, r) => s + r.qty, 0);
  const costEx = cost - cancelled.reduce((s, r) => s + r.totalCost, 0);

  const monthOf = (r: XrayRow): string => (r.date ? r.date.toISOString().slice(0, 7) : NO_DATE);
  const byMonth = groupBy(rows, monthOf).sort((a, b) =>
    a.key === NO_DATE ? 1 : b.key === NO_DATE ? -1 : a.key.localeCompare(b.key)
  );

  return {
    cards: {
      rows: rows.length,
      orders: new Set(rows.map((r) => r.orderNo)).size,
      asins: new Set(rows.map((r) => r.asin)).size,
      mskus: new Set(rows.map((r) => r.msku)).size,
      units,
      cost: round2(cost),
      avgUnitCost: units > 0 ? cost / units : null,
      cancelledRows: cancelled.length,
      cancelledRate: rows.length ? cancelled.length / rows.length : 0,
      unitsExCancelled: unitsEx,
      costExCancelled: round2(costEx),
    },
    byAsin: groupBy(rows, (r) => r.asin).sort(byCostDesc),
    byOrder: groupBy(rows, (r) => r.orderNo).sort(byCostDesc),
    byMsku: groupBy(rows, (r) => r.msku).sort(byCostDesc),
    byCard: groupBy(rows, (r) => r.card || NO_CARD).sort(byCostDesc),
    byMonth,
  };
}

/* ── Hata bulucu ── */

export type XrayFindingCode =
  | "ASIN_DIRTY"
  | "ASIN_INVALID"
  | "MSKU_DIRTY"
  | "PRICE_OUTLIER"
  | "TOTAL_MISMATCH"
  | "QTY_OVERFLOW"
  | "STATUS_EMPTY"
  | "CARD_EMPTY"
  | "CARD_RARE"
  | "DATE_OUTLIER"
  | "LABEL_EMPTY"
  | "LABEL_YEAR_MISMATCH"
  | "DUPLICATE_KEY";

export type XraySeverity = "high" | "medium" | "low";

export interface XrayFinding {
  code: XrayFindingCode;
  severity: XraySeverity;
  rowNo: number;
  orderNo: string;
  asin: string;
  message: string;
  impactUsd: number | null;
}

export interface XrayOptions {
  /** Aynı ASIN'in medyan birim maliyetinden sapma eşiği, yüzde. Varsayılan 25. */
  priceDeviationPct?: number;
}

const SEVERITY: Record<XrayFindingCode, XraySeverity> = {
  PRICE_OUTLIER: "high",
  TOTAL_MISMATCH: "high",
  QTY_OVERFLOW: "high",
  DUPLICATE_KEY: "high",
  ASIN_DIRTY: "medium",
  ASIN_INVALID: "medium",
  MSKU_DIRTY: "medium",
  STATUS_EMPTY: "medium",
  DATE_OUTLIER: "medium",
  CARD_EMPTY: "low",
  CARD_RARE: "low",
  LABEL_EMPTY: "low",
  LABEL_YEAR_MISMATCH: "low",
};
const SEVERITY_RANK: Record<XraySeverity, number> = { high: 0, medium: 1, low: 2 };

/** ASIN 10 harf/rakamdır; kitap ASIN'leri (ISBN-10) "B" ile başlamaz, bu yüzden önek aranmaz. */
const ASIN_SHAPE = /^[A-Z0-9]{10}$/;
const MIN_ROWS_FOR_MEDIAN = 3;
const TOTAL_TOLERANCE = 0.05;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function findXrayIssues(rows: XrayRow[], opts: XrayOptions = {}): XrayFinding[] {
  const pct = opts.priceDeviationPct ?? 25;
  const findings: XrayFinding[] = [];
  const add = (r: XrayRow, code: XrayFindingCode, message: string, impactUsd: number | null = null) =>
    findings.push({ code, severity: SEVERITY[code], rowNo: r.rowNo, orderNo: r.orderNo, asin: r.asin, message, impactUsd: impactUsd === null ? null : round2(impactUsd) });

  // ASIN başına medyan birim maliyet (iptal satırlar hariç, en az 3 satır).
  const unitsByAsin = new Map<string, number[]>();
  for (const r of rows) {
    if (r.unitCost === null || isCancelledStatus(r.cargoStatus)) continue;
    unitsByAsin.set(r.asin, [...(unitsByAsin.get(r.asin) ?? []), r.unitCost]);
  }
  const medianByAsin = new Map<string, number>();
  for (const [asin, v] of unitsByAsin) if (v.length >= MIN_ROWS_FOR_MEDIAN) medianByAsin.set(asin, median(v));

  const cardCount = new Map<string, number>();
  const keyCount = new Map<string, number>();
  const yearCount = new Map<number, number>();
  for (const r of rows) {
    if (r.card) cardCount.set(r.card, (cardCount.get(r.card) ?? 0) + 1);
    const k = `${r.orderNo}|${r.asin}`;
    keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
    if (r.date) yearCount.set(r.date.getUTCFullYear(), (yearCount.get(r.date.getUTCFullYear()) ?? 0) + 1);
  }
  const commonYear = [...yearCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  // Tarih2 kolonu dosyada yoksa her satır "boş" görünür; o durumda etiket kontrolleri atlanır.
  const hasLabels = rows.some((r) => r.label !== "");

  for (const r of rows) {
    if (r.asinRaw !== r.asin) add(r, "ASIN_DIRTY", `ASIN temizlenmeli: ${JSON.stringify(r.asinRaw)} → ${r.asin}`);
    if (!ASIN_SHAPE.test(r.asin)) add(r, "ASIN_INVALID", `ASIN biçimi geçersiz: ${JSON.stringify(r.asin)}`);
    if (r.mskuRaw !== r.msku) add(r, "MSKU_DIRTY", `MSKU temizlenmeli: ${JSON.stringify(r.mskuRaw)} → ${r.msku}`);

    const med = medianByAsin.get(r.asin);
    if (med !== undefined && r.unitCost !== null && med > 0 && !isCancelledStatus(r.cargoStatus)) {
      const dev = ((r.unitCost - med) / med) * 100;
      if (Math.abs(dev) > pct) {
        add(r, "PRICE_OUTLIER", `Birim maliyet ${r.unitCost.toFixed(2)} $, aynı ASIN'in medyanı ${med.toFixed(2)} $ (%${Math.round(dev)})`, (r.unitCost - med) * r.qty);
      }
    }
    if (r.qty > 0 && r.unitCost !== null) {
      const diff = r.totalCost - r.qty * r.unitCost;
      if (Math.abs(diff) > TOTAL_TOLERANCE) {
        add(r, "TOTAL_MISMATCH", `Adet × birim = ${(r.qty * r.unitCost).toFixed(2)} $ ama toplam ${r.totalCost.toFixed(2)} $`, diff);
      }
    }
    if (r.shipped + r.p1 + r.p2 + r.p3 + r.p4 > r.qty) {
      add(r, "QTY_OVERFLOW", `Gönderilen + iptal/eksik/defolu/tarihi geçmiş adedi (${r.shipped + r.p1 + r.p2 + r.p3 + r.p4}) sipariş adedini (${r.qty}) aşıyor`);
    }
    if (r.cargoStatus === "") add(r, "STATUS_EMPTY", "Kargo durumu boş");
    if (r.card === "") add(r, "CARD_EMPTY", "Kredi kartı boş");
    else if (cardCount.get(r.card) === 1) add(r, "CARD_RARE", `Kart ${r.card} dosyada yalnız bu satırda geçiyor (yazım hatası olabilir)`);
    if (r.date && commonYear !== undefined && r.date.getUTCFullYear() !== commonYear) {
      add(r, "DATE_OUTLIER", `Tarih ${r.date.toISOString().slice(0, 10)}; satırların çoğu ${commonYear} yılında`);
    }
    if (hasLabels) {
      if (r.label === "") add(r, "LABEL_EMPTY", "Tarih2 etiketi boş");
      const m = /(\d{2})$/.exec(r.label);
      if (m && r.date && String(r.date.getUTCFullYear()).slice(2) !== m[1]) {
        add(r, "LABEL_YEAR_MISMATCH", `Tarih2 etiketi ${r.label}, tarih ${r.date.toISOString().slice(0, 10)}`);
      }
    }
    if ((keyCount.get(`${r.orderNo}|${r.asin}`) ?? 0) > 1) add(r, "DUPLICATE_KEY", `Aynı order+ASIN birden çok satırda: ${r.orderNo} ${r.asin}`);
  }

  return findings.sort(
    (a, b) =>
      (b.impactUsd === null ? -1 : Math.abs(b.impactUsd)) - (a.impactUsd === null ? -1 : Math.abs(a.impactUsd)) ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.rowNo - b.rowNo
  );
}

export interface XrayResult {
  missingHeaders: string[];
  scanned: number;
  summary: XraySummary;
  findings: XrayFinding[];
}

export function buildXray(raw: Record<string, unknown>[], opts?: XrayOptions): XrayResult {
  const { rows, missingHeaders } = readSat26Rows(raw);
  return { missingHeaders, scanned: rows.length, summary: summarizeXray(rows), findings: findXrayIssues(rows, opts) };
}
