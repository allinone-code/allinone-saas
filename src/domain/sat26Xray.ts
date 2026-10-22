/**
 * Alım listesi (Sat26) röntgeni — özet kartları, kırılımlar ve hata bulucu.
 * Saf fonksiyonlar: DB/IO yok, hiçbir şeyi düzeltmez.
 */
import { isCancelledStatus } from "./sat26Hygiene";
import type { XrayRow } from "./sat26XrayRead";

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
