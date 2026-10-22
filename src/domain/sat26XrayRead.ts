/**
 * Alım listesi (Sat26) röntgeni — ham satırları tipli `XrayRow`'a çevirir.
 *
 * Girdi tarayıcıda `xlsx` ile okunup JSON olarak gelir; bu yüzden tarih üç
 * biçimde olabilir: Excel seri sayısı, `Date` / ISO metin, "dd.mm.yyyy" metni.
 * Saf fonksiyon: DB/IO yok.
 */
import { normalizeHeaderLabel } from "@/lib/importFieldSchema";
import { cleanMsku } from "./sat26Hygiene";

export interface XrayRow {
  /** Sayfadaki satır numarası (başlık = 1, ilk veri = 2). */
  rowNo: number;
  buyer: string;
  date: Date | null;
  /** "Tarih2" etiketi (ör. "O26"), yoksa "". */
  label: string;
  orderNo: string;
  asinRaw: string;
  asin: string;
  mskuRaw: string;
  msku: string;
  qty: number;
  /** qty <= 0 ise null. */
  unitCost: number | null;
  totalCost: number;
  cargoStatus: string;
  card: string;
  shipped: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
}

/** Zorunlu başlıklar, kullanıcıya gösterilecek orijinal adlarıyla. */
const REQUIRED = [
  "Tarih",
  "ASIN",
  "MSKU",
  "Orderno",
  "Ürün adedi",
  "Ürün birim maliyeti",
  "Ürün toplam maliyeti",
  "Kargo durumu",
  "Kredi Kartı",
] as const;

const OPTIONAL = {
  buyer: "Satın Alan",
  label: "Tarih2",
  shipped: "Amazona göndilen adet",
  p1: "İptal adet-P1",
  p2: "Eksik adet-P2",
  p3: "Defolu adet-P3",
  p4: "Tarihi geçmiş adet-P4",
} as const;

const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const DAY_MS = 86_400_000;

function money(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Makul Excel seri aralığı (1954–2119); dışı tarih değil, rastgele sayıdır.
    if (v < 20000 || v > 80000) return null;
    return new Date(Math.round((v - EXCEL_EPOCH_OFFSET_DAYS) * DAY_MS));
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return null;
}

export function readSat26Rows(raw: Record<string, unknown>[]): { rows: XrayRow[]; missingHeaders: string[] } {
  // Normalleştirilmiş başlık → satırdaki gerçek anahtar (tüm satırların birleşimi).
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

  // Zorunlu başlıklar yukarıda doğrulandı; burada kesin olarak vardır.
  const req = (h: (typeof REQUIRED)[number]): string => resolve(h)!;
  const kDate = req("Tarih"), kAsin = req("ASIN"), kMsku = req("MSKU"), kOrder = req("Orderno");
  const kQty = req("Ürün adedi"), kUnit = req("Ürün birim maliyeti"), kTotal = req("Ürün toplam maliyeti");
  const kStatus = req("Kargo durumu"), kCard = req("Kredi Kartı");
  const k = Object.fromEntries(Object.entries(OPTIONAL).map(([id, h]) => [id, resolve(h)])) as Record<keyof typeof OPTIONAL, string | undefined>;
  const text = (r: Record<string, unknown>, key: string | undefined): string => (key ? String(r[key] ?? "").trim() : "");
  const qtyOf = (r: Record<string, unknown>, key: string | undefined): number => (key ? money(r[key]) : 0);

  const rows = raw.map((r, i): XrayRow => {
    const qty = money(r[kQty]);
    const asinRaw = String(r[kAsin] ?? "");
    const mskuRaw = String(r[kMsku] ?? "");
    return {
      rowNo: i + 2,
      buyer: text(r, k.buyer),
      date: parseDate(r[kDate]),
      label: text(r, k.label),
      orderNo: String(r[kOrder] ?? "").replace(/\s+/g, ""),
      asinRaw,
      asin: asinRaw.replace(/\s+/g, "").toUpperCase(),
      mskuRaw,
      msku: cleanMsku(mskuRaw),
      qty,
      unitCost: qty > 0 ? money(r[kUnit]) : null,
      totalCost: money(r[kTotal]),
      cargoStatus: text(r, kStatus),
      card: text(r, kCard),
      shipped: qtyOf(r, k.shipped),
      p1: qtyOf(r, k.p1),
      p2: qtyOf(r, k.p2),
      p3: qtyOf(r, k.p3),
      p4: qtyOf(r, k.p4),
    };
  });
  return { rows, missingHeaders: [] };
}
