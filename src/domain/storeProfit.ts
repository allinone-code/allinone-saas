/**
 * Aylık mağaza karlılığı — Amazon, PSH, Inventory Lab ve banka aylık
 * raporlarından tek bir kar tablosu üretir (Den_Rapor "Kar" sayfasının
 * karşılığı; oradaki #DIV/0! / #N/A hataları burada boş ay = null olur).
 *
 * KURAL: Ofis gideri gerçek bir kayıt değil, satışın sabit %10'udur
 * (kullanıcı kararı, 2026-10-22). Değiştirmek için tek yer `OFFICE_EXPENSE_RATE`.
 *
 * Çift sayım uyarısı: Inventory Lab'ın "Net Profit"i Amazon ücretlerini
 * zaten düşer. Bu yüzden net kar, Inventory Lab'ın net karından değil
 * KALEMLERDEN hesaplanır; iLab net karı yalnız karşılaştırma için tutulur.
 */

export const OFFICE_EXPENSE_RATE = 0.1;

export const FINANCE_SOURCES = ["AMAZON", "PSH", "INVENTORY_LAB", "BANK"] as const;
export type FinanceSource = (typeof FINANCE_SOURCES)[number];

/**
 * Kalem sınıfları:
 *  REVENUE      satış geliri (Amazon "Product sales" / iLab "Sales")
 *  COGS         satılan malın maliyeti
 *  AMAZON_FEES  Amazon ücretleri (referral, FBA, depolama…) — pozitif tutar girilir
 *  PREP_SHIPPING PSH hazırlama/gönderim faturaları
 *  OTHER_EXPENSE banka/kart kaynaklı diğer giderler (yazılım, reklam…)
 *  REPORTED_NET  kaynağın kendi raporladığı net kar — yalnız karşılaştırma
 */
export const FINANCE_CATEGORIES = [
  "REVENUE",
  "COGS",
  "AMAZON_FEES",
  "PREP_SHIPPING",
  "OTHER_EXPENSE",
  "REPORTED_NET",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export interface FinanceEntry {
  month: string; // "YYYY-MM"
  source: FinanceSource;
  category: FinanceCategory;
  amount: number;
}

export interface MonthlyProfit {
  month: string;
  revenue: number | null;
  cogs: number;
  amazonFees: number;
  prepShipping: number;
  otherExpense: number;
  officeExpense: number;
  netProfit: number | null;
  /** Net kar / satış, yüzde. Satış yoksa null (#DIV/0! yerine). */
  marginPct: number | null;
  cumulativeNet: number;
  /** iLab'ın raporladığı net kar (varsa) ve bizim hesapla farkı. */
  reportedNet: number | null;
  reportedNetDiff: number | null;
  /** Hangi kaynaklardan veri geldi — eksik kaynak ekranda uyarı olur. */
  sources: FinanceSource[];
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Gelir önceliği: Amazon (gerçek satış) → yoksa Inventory Lab. İkisi de
 * girilmişse TOPLANMAZ (aynı satışın iki raporu olduğu için çift sayım olur).
 */
function pickRevenue(entries: FinanceEntry[]): number | null {
  const sum = (src: FinanceSource) => {
    const rows = entries.filter((e) => e.source === src && e.category === "REVENUE");
    return rows.length ? rows.reduce((s, e) => s + e.amount, 0) : null;
  };
  return sum("AMAZON") ?? sum("INVENTORY_LAB");
}

/** Aynı kalem hem Amazon hem iLab'dan geliyorsa tek kaynağı (Amazon öncelikli) kullanır. */
function pickCategory(entries: FinanceEntry[], category: FinanceCategory): number {
  for (const src of ["AMAZON", "INVENTORY_LAB", "PSH", "BANK"] as FinanceSource[]) {
    const rows = entries.filter((e) => e.source === src && e.category === category);
    if (rows.length) return rows.reduce((s, e) => s + e.amount, 0);
  }
  return 0;
}

export function computeMonthlyProfit(entries: FinanceEntry[], months: string[]): MonthlyProfit[] {
  let cumulative = 0;
  return [...months].sort().map((month) => {
    const m = entries.filter((e) => e.month === month);
    const revenue = pickRevenue(m);

    // Her sınıf için ilgili kaynağın değerini al; COGS iLab'dan, PSH yalnız PSH'dan.
    const cogs = pickCategory(m.filter((e) => e.source !== "PSH" && e.source !== "BANK"), "COGS");
    const amazonFees = pickCategory(m.filter((e) => e.source === "AMAZON" || e.source === "INVENTORY_LAB"), "AMAZON_FEES");
    const prepShipping = m.filter((e) => e.source === "PSH" && e.category === "PREP_SHIPPING").reduce((s, e) => s + e.amount, 0);
    const otherExpense = m.filter((e) => e.category === "OTHER_EXPENSE").reduce((s, e) => s + e.amount, 0);
    const officeExpense = revenue === null ? 0 : round2(revenue * OFFICE_EXPENSE_RATE);

    const netProfit =
      revenue === null ? null : round2(revenue - cogs - amazonFees - prepShipping - otherExpense - officeExpense);
    if (netProfit !== null) cumulative = round2(cumulative + netProfit);

    const reportedRows = m.filter((e) => e.category === "REPORTED_NET");
    const reportedNet = reportedRows.length ? round2(reportedRows.reduce((s, e) => s + e.amount, 0)) : null;

    return {
      month,
      revenue: revenue === null ? null : round2(revenue),
      cogs: round2(cogs),
      amazonFees: round2(amazonFees),
      prepShipping: round2(prepShipping),
      otherExpense: round2(otherExpense),
      officeExpense,
      netProfit,
      marginPct: netProfit === null || !revenue ? null : round2((netProfit / revenue) * 100),
      cumulativeNet: cumulative,
      reportedNet,
      reportedNetDiff: netProfit === null || reportedNet === null ? null : round2(netProfit - reportedNet),
      sources: FINANCE_SOURCES.filter((s) => m.some((e) => e.source === s)),
    };
  });
}

/** Ay listesi: girilen kayıtlardaki en eski ayla en yeni ay arasındaki TÜM aylar (boş aylar dahil). */
export function monthRange(entries: FinanceEntry[]): string[] {
  const months = [...new Set(entries.map((e) => e.month))].sort();
  if (!months.length) return [];
  const out: string[] = [];
  let [y, mo] = months[0].split("-").map(Number);
  const [ey, emo] = months[months.length - 1].split("-").map(Number);
  while (y < ey || (y === ey && mo <= emo)) {
    out.push(`${y}-${String(mo).padStart(2, "0")}`);
    mo++;
    if (mo > 12) {
      mo = 1;
      y++;
    }
  }
  return out;
}
