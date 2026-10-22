/**
 * PSH (PrepShip) indirme dosyası — ham satırları tipli `PshRow`'a çevirir.
 *
 * Girdi tarayıcıda `xlsx` ile okunup JSON olarak gelir. PSH `Purchase Date`
 * metni AY-ÖNCE yazılır ("06/19/2026"); alım listesinin gün-önce çözümlemesi
 * buna uygulanmaz. Saf fonksiyon: DB/IO yok.
 */
import { normalizeHeaderLabel } from "@/lib/importFieldSchema";
import { parseSheetDate } from "./sat26XrayRead";

export interface PshRow {
  /** Sayfadaki satır numarası (başlık = 1, ilk veri = 2). */
  rowNo: number;
  orderNo: string;
  asin: string;
  msku: string;
  qty: number;
  received: number;
  damaged: number;
  shipped: number;
  /** trim + küçük harf: "fulfilled", "intransit", "partially_delivered", "delivered". */
  status: string;
  /** Birim maliyet; boşsa 0. */
  cost: number;
  date: Date | null;
  supplier: string;
}

const REQUIRED = [
  "Order Number",
  "ASIN",
  "MSKU",
  "Quantity",
  "Received",
  "Damaged",
  "Status",
  "Cost",
  "Purchase Date",
] as const;

const OPTIONAL = { shipped: "Shipped", supplier: "Supplier" } as const;

/** Okuyucunun kullandığı tüm başlıklar; ekran yalnız bu kolonları sunucuya gönderir. */
export const PSH_HEADERS: readonly string[] = [...REQUIRED, ...Object.values(OPTIONAL)];

function money(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parsePshDate(v: unknown): Date | null {
  const m = typeof v === "string" ? /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(v) : null;
  if (!m) return parseSheetDate(v);
  const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  // 02/31 gibi olmayan günler Date'te kayar; geri okuyup tutmuyorsa tarih değildir.
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d : null;
}

export function readPshRows(raw: Record<string, unknown>[]): { rows: PshRow[]; missingHeaders: string[] } {
  const keyByHeader = new Map<string, string>();
  for (const r of raw) {
    for (const k of Object.keys(r)) {
      const n = normalizeHeaderLabel(k);
      if (n && !keyByHeader.has(n)) keyByHeader.set(n, k);
    }
  }
  const resolve = (header: string): string | undefined => keyByHeader.get(normalizeHeaderLabel(header));

  const missingHeaders = REQUIRED.filter((h) => !resolve(h));
  if (missingHeaders.length) return { rows: [], missingHeaders: [...missingHeaders] };

  const req = (h: (typeof REQUIRED)[number]): string => resolve(h)!;
  const kOrder = req("Order Number"), kAsin = req("ASIN"), kMsku = req("MSKU"), kQty = req("Quantity");
  const kRec = req("Received"), kDmg = req("Damaged"), kStatus = req("Status"), kCost = req("Cost"), kDate = req("Purchase Date");
  const kShipped = resolve(OPTIONAL.shipped), kSupplier = resolve(OPTIONAL.supplier);

  const blank = (v: unknown): boolean => String(v ?? "").trim() === "";
  const squash = (v: unknown): string => String(v ?? "").replace(/\s+/g, "").toUpperCase();

  const rows = raw.flatMap((r, i): PshRow[] => {
    if (blank(r[kOrder]) && blank(r[kAsin]) && blank(r[kQty])) return [];
    return [{
      rowNo: typeof r.__rowNum__ === "number" ? r.__rowNum__ + 1 : i + 2,
      orderNo: squash(r[kOrder]),
      asin: squash(String(r[kAsin] ?? "").replace(/<br\s*\/?>/gi, "")),
      msku: squash(r[kMsku]),
      qty: money(r[kQty]),
      received: money(r[kRec]),
      damaged: money(r[kDmg]),
      shipped: kShipped ? money(r[kShipped]) : 0,
      status: String(r[kStatus] ?? "").trim().toLowerCase(),
      cost: money(r[kCost]),
      date: parsePshDate(r[kDate]),
      supplier: kSupplier ? String(r[kSupplier] ?? "").trim() : "",
    }];
  });
  return { rows, missingHeaders: [] };
}
