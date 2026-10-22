/**
 * Alım listesi (Sat26) ↔ PSH karşılaştırması, Order No + ASIN anahtarıyla.
 *
 * Zaman farkından doğan sahte alarmı önlemek için yoldaki (`intransit`),
 * kısmi teslim ve PSH'a henüz girmemiş satırlar hata değil "Bekleniyor" grubudur.
 * Şüpheli order numaraları (WO/W0) birleştirilmez, yalnız bildirilir.
 * Saf fonksiyon: DB/IO yok.
 */
import { isCancelledStatus } from "./sat26Hygiene";
import { readPshRows, type PshRow } from "./pshRead";
import { readSat26Rows, type XrayRow } from "./sat26XrayRead";

export type PshFindingCode =
  | "MISSING_DELIVERY"
  | "DAMAGED"
  | "QTY_DIFF"
  | "CANCEL_CONFLICT"
  | "PRICE_DIFF"
  | "MSKU_DIFF"
  | "NOT_IN_PSH"
  | "NOT_IN_PURCHASE"
  | "TYPO_SUSPECT"
  | "DUPLICATE_KEY";

export interface PshFinding {
  code: PshFindingCode;
  severity: "high" | "medium" | "low";
  orderNo: string;
  asin: string;
  message: string;
  /** 2 ondalığa yuvarlı; formülü olmayan bulgularda null. */
  impactUsd: number | null;
  /** Gri liste: eşik altı fiyat farkı, önek farkı olan MSKU. */
  muted: boolean;
  /** Excel satır numaraları. */
  purchaseRows: number[];
  pshRows: number[];
}

export type WaitingKind = "INTRANSIT" | "PARTIAL" | "NOT_YET_IN_PSH";

export interface WaitingItem {
  kind: WaitingKind;
  orderNo: string;
  asin: string;
  qty: number;
  missingQty: number;
  /** missingQty × alım birim maliyeti (yoksa PSH maliyeti). */
  valueUsd: number;
  purchaseDate: Date | null;
  purchaseRows: number[];
  pshRows: number[];
}

export interface PshCompareOptions {
  /** Varsayılan 10. */
  priceTolerancePct?: number;
  /** Varsayılan 14. */
  pendingWindowDays?: number;
}

export interface PshCompareResult {
  cards: {
    purchaseKeys: number;
    pshKeys: number;
    matched: number;
    cancelledSkipped: number;
    pshNewestDate: Date | null;
    cutoffDate: Date | null;
  };
  /** Gri bulgular hariç. */
  totals: Record<PshFindingCode, { count: number; impactUsd: number }>;
  waiting: Record<WaitingKind, { keys: number; missingQty: number; valueUsd: number }>;
  findings: PshFinding[];
  waitingItems: WaitingItem[];
}

const DAY_MS = 86_400_000;
const FINAL_STATUSES = new Set(["fulfilled", "delivered"]);
const ALL_CODES: PshFindingCode[] = [
  "MISSING_DELIVERY", "DAMAGED", "QTY_DIFF", "CANCEL_CONFLICT", "PRICE_DIFF",
  "MSKU_DIFF", "NOT_IN_PSH", "NOT_IN_PURCHASE", "TYPO_SUSPECT", "DUPLICATE_KEY",
];
const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;

const round2 = (x: number): number => Math.round(x * 100) / 100;
const squash = (s: string): string => s.replace(/\s+/g, "").toUpperCase();
const keyOf = (orderNo: string, asin: string): string => `${orderNo.toUpperCase()}|${asin.toUpperCase()}`;
const newest = (dates: (Date | null)[]): Date | null =>
  dates.reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null);

interface BuySide {
  orderNo: string; asin: string; msku: string; rows: number[];
  qty: number; total: number; unit: number | null;
  cancelledAll: boolean; cancelUnit: number | null; date: Date | null;
}
interface PshSide {
  orderNo: string; asin: string; msku: string; rows: number[];
  qty: number; received: number; damaged: number; cost: number; status: string;
}

function groupBuy(rows: XrayRow[]): Map<string, BuySide> {
  const by = new Map<string, XrayRow[]>();
  for (const r of rows) {
    const k = keyOf(r.orderNo, r.asin);
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const out = new Map<string, BuySide>();
  for (const [k, rs] of by) {
    const active = rs.filter((r) => !isCancelledStatus(r.cargoStatus));
    const cancelled = rs.filter((r) => isCancelledStatus(r.cargoStatus));
    const qty = active.reduce((a, r) => a + r.qty, 0);
    const total = active.reduce((a, r) => a + r.totalCost, 0);
    const cQty = cancelled.reduce((a, r) => a + r.qty, 0);
    out.set(k, {
      orderNo: rs[0].orderNo.toUpperCase(),
      asin: rs[0].asin.toUpperCase(),
      msku: squash(rs[0].msku),
      rows: rs.map((r) => r.rowNo),
      qty,
      total,
      unit: qty > 0 ? total / qty : null,
      cancelledAll: active.length === 0,
      cancelUnit: cQty > 0 ? cancelled.reduce((a, r) => a + r.totalCost, 0) / cQty : null,
      date: newest(rs.map((r) => r.date)),
    });
  }
  return out;
}

function groupPsh(rows: PshRow[]): Map<string, PshSide> {
  const by = new Map<string, PshRow[]>();
  for (const r of rows) {
    const k = keyOf(r.orderNo, r.asin);
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const out = new Map<string, PshSide>();
  for (const [k, rs] of by) {
    const qty = rs.reduce((a, r) => a + r.qty, 0);
    // Yoldaki satır varsa anahtar yoldadır: sahte "eksik" alarmı çıkmasın.
    const status = rs.some((r) => r.status === "intransit")
      ? "intransit"
      : rs.some((r) => r.status === "partially_delivered")
        ? "partially_delivered"
        : rs[0].status;
    out.set(k, {
      orderNo: rs[0].orderNo.toUpperCase(),
      asin: rs[0].asin.toUpperCase(),
      msku: squash(rs[0].msku),
      rows: rs.map((r) => r.rowNo),
      qty,
      received: rs.reduce((a, r) => a + r.received, 0),
      damaged: rs.reduce((a, r) => a + r.damaged, 0),
      cost: qty > 0 ? rs.reduce((a, r) => a + r.cost * r.qty, 0) / qty : rs[0].cost,
      status,
    });
  }
  return out;
}

export function comparePsh(purchase: XrayRow[], psh: PshRow[], opts: PshCompareOptions = {}): PshCompareResult {
  const tol = (opts.priceTolerancePct ?? 10) / 100;
  const windowDays = opts.pendingWindowDays ?? 14;
  const B = groupBuy(purchase);
  const S = groupPsh(psh);

  const pshNewestDate = newest(psh.map((r) => r.date));
  const cutoffDate = pshNewestDate ? new Date(pshNewestDate.getTime() - windowDays * DAY_MS) : null;

  const findings: PshFinding[] = [];
  const waitingItems: WaitingItem[] = [];
  let matched = 0;
  let cancelledSkipped = 0;

  const add = (f: Omit<PshFinding, "muted"> & { muted?: boolean }) => findings.push({ muted: false, ...f });

  for (const [k, b] of B) {
    if (b.rows.length > 1) {
      add({ code: "DUPLICATE_KEY", severity: "medium", orderNo: b.orderNo, asin: b.asin, impactUsd: null, purchaseRows: b.rows, pshRows: [],
        message: `Alım listesinde aynı order+ASIN ${b.rows.length} satırda (adet ve maliyet toplandı)` });
    }
    const s = S.get(k);
    if (!s) continue;
    matched++;
    const unit = b.unit ?? s.cost;
    const ids = { orderNo: b.orderNo, asin: b.asin, purchaseRows: b.rows, pshRows: s.rows };

    if (!b.cancelledAll && b.qty !== s.qty) {
      const diff = Math.abs(b.qty - s.qty);
      add({ ...ids, code: "QTY_DIFF", severity: "high", impactUsd: round2(diff * unit), message: `Alım ${b.qty} adet, PSH ${s.qty} adet` });
    }
    const missing = s.qty - s.received - s.damaged;
    if (!b.cancelledAll && FINAL_STATUSES.has(s.status) && missing > 0) {
      add({ ...ids, code: "MISSING_DELIVERY", severity: "high", impactUsd: round2(missing * unit), message: `PSH ${s.status}: ${missing} adet gelmedi (adet ${s.qty}, gelen ${s.received}, hasarlı ${s.damaged})` });
    }
    if (s.damaged > 0) {
      add({ ...ids, code: "DAMAGED", severity: "high", impactUsd: round2(s.damaged * (b.unit ?? b.cancelUnit ?? s.cost)), message: `${s.damaged} adet hasarlı geldi` });
    }
    if (b.cancelledAll && s.received > 0) {
      add({ ...ids, code: "CANCEL_CONFLICT", severity: "high", impactUsd: round2(s.received * (b.cancelUnit ?? s.cost)), message: `Alımda İPTAL, PSH ${s.received} adet teslim almış` });
    }
    if (!b.cancelledAll && b.unit && b.unit > 0 && s.cost > 0) {
      const diff = s.cost - b.unit;
      const over = Math.abs(diff) / b.unit > tol;
      if (over || round2(Math.abs(diff)) >= 0.01) {
        add({ ...ids, code: "PRICE_DIFF", severity: over ? "high" : "low", muted: !over, impactUsd: round2(diff * s.qty),
          message: `Birim maliyet alımda $${round2(b.unit)}, PSH'ta $${round2(s.cost)}` });
      }
    }
    if (b.msku && s.msku && b.msku !== s.msku) {
      const prefixOnly = b.msku.endsWith(s.msku) || s.msku.endsWith(b.msku);
      add({ ...ids, code: "MSKU_DIFF", severity: prefixOnly ? "low" : "medium", muted: prefixOnly, impactUsd: null,
        message: `MSKU alımda ${b.msku}, PSH'ta ${s.msku}` });
    }
    if (!b.cancelledAll && (s.status === "intransit" || s.status === "partially_delivered")) {
      const missingQty = Math.max(0, missing);
      waitingItems.push({ kind: s.status === "intransit" ? "INTRANSIT" : "PARTIAL", orderNo: b.orderNo, asin: b.asin, qty: s.qty,
        missingQty, valueUsd: round2(missingQty * unit), purchaseDate: b.date, purchaseRows: b.rows, pshRows: s.rows });
    }
  }

  for (const s of S.values()) {
    if (s.rows.length > 1) {
      add({ code: "DUPLICATE_KEY", severity: "medium", orderNo: s.orderNo, asin: s.asin, impactUsd: null, purchaseRows: [], pshRows: s.rows,
        message: `PSH'ta aynı order+ASIN ${s.rows.length} satırda (adet ve maliyet toplandı)` });
    }
  }

  // Eşleşmeyenler; O/0 farkıyla birbirine benzeyenler birleştirilmeden tek bulgu olur.
  const unmatchedBuy = [...B].filter(([k, b]) => !S.has(k) && !b.cancelledAll);
  const unmatchedPsh = [...S].filter(([k]) => !B.has(k));
  const typoOfPsh = new Set<string>();
  const typoOfBuy = new Set<string>();
  for (const [bk, b] of unmatchedBuy) {
    const hit = unmatchedPsh.find(([sk, s]) => !typoOfPsh.has(sk) && s.asin === b.asin && s.orderNo !== b.orderNo
      && s.orderNo.replace(/O/g, "0") === b.orderNo.replace(/O/g, "0"));
    if (!hit) continue;
    typoOfBuy.add(bk);
    typoOfPsh.add(hit[0]);
    add({ code: "TYPO_SUSPECT", severity: "medium", orderNo: b.orderNo, asin: b.asin, impactUsd: null, purchaseRows: b.rows, pshRows: hit[1].rows,
      message: `Order numarası benziyor: alım ${b.orderNo} ↔ PSH ${hit[1].orderNo} (O/0 farkı); birleştirilmedi, kontrol edin` });
  }

  for (const [k, b] of B) if (!S.has(k) && b.cancelledAll) cancelledSkipped++;

  for (const [k, b] of unmatchedBuy) {
    if (typoOfBuy.has(k)) continue;
    if (cutoffDate && b.date && b.date > cutoffDate) {
      waitingItems.push({ kind: "NOT_YET_IN_PSH", orderNo: b.orderNo, asin: b.asin, qty: b.qty, missingQty: b.qty,
        valueUsd: round2(b.total), purchaseDate: b.date, purchaseRows: b.rows, pshRows: [] });
    } else {
      add({ code: "NOT_IN_PSH", severity: "high", orderNo: b.orderNo, asin: b.asin, impactUsd: round2(b.total), purchaseRows: b.rows, pshRows: [],
        message: b.date ? "PSH'ta yok (alım tarihi bekleme sınırından önce)" : "PSH'ta yok (alım tarihi yok, bekleniyor mu belli değil)" });
    }
  }
  for (const [k, s] of unmatchedPsh) {
    if (typoOfPsh.has(k)) continue;
    add({ code: "NOT_IN_PURCHASE", severity: "high", orderNo: s.orderNo, asin: s.asin, impactUsd: round2(s.qty * s.cost), purchaseRows: [], pshRows: s.rows,
      message: `PSH'ta ${s.qty} adet var, alım listesinde yok` });
  }

  findings.sort((a, b) =>
    Number(a.muted) - Number(b.muted)
    || Math.abs(b.impactUsd ?? -1) - Math.abs(a.impactUsd ?? -1)
    || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    || a.orderNo.localeCompare(b.orderNo));
  waitingItems.sort((a, b) => b.valueUsd - a.valueUsd);

  const totals = Object.fromEntries(ALL_CODES.map((c) => [c, { count: 0, impactUsd: 0 }])) as PshCompareResult["totals"];
  for (const f of findings) {
    if (f.muted) continue;
    totals[f.code].count++;
    totals[f.code].impactUsd = round2(totals[f.code].impactUsd + (f.impactUsd ?? 0));
  }
  const waiting: PshCompareResult["waiting"] = {
    INTRANSIT: { keys: 0, missingQty: 0, valueUsd: 0 },
    PARTIAL: { keys: 0, missingQty: 0, valueUsd: 0 },
    NOT_YET_IN_PSH: { keys: 0, missingQty: 0, valueUsd: 0 },
  };
  for (const w of waitingItems) {
    waiting[w.kind].keys++;
    waiting[w.kind].missingQty += w.missingQty;
    waiting[w.kind].valueUsd = round2(waiting[w.kind].valueUsd + w.valueUsd);
  }

  return {
    cards: { purchaseKeys: B.size, pshKeys: S.size, matched, cancelledSkipped, pshNewestDate, cutoffDate },
    totals,
    waiting,
    findings,
    waitingItems,
  };
}

export function buildPshCompare(
  rawPurchase: Record<string, unknown>[],
  rawPsh: Record<string, unknown>[],
  opts?: PshCompareOptions,
): { missingHeaders: { purchase: string[]; psh: string[] } } & PshCompareResult {
  const p = readSat26Rows(rawPurchase);
  const s = readPshRows(rawPsh);
  const missingHeaders = { purchase: p.missingHeaders, psh: s.missingHeaders };
  if (p.missingHeaders.length || s.missingHeaders.length) return { missingHeaders, ...comparePsh([], [], opts) };
  return { missingHeaders, ...comparePsh(p.rows, s.rows, opts) };
}
