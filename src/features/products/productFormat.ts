/**
 * Aşama 2 — Ürün görünümü biçimlendirme yardımcıları.
 *
 * Saf fonksiyonlar: React'e bağımlı değil, test edilebilir. Amaç, aynı
 * biçimlendirme kararının (para, yüzde, tonlama) farklı bileşenlerde farklı
 * yazılıp tutarsız görünmesini önlemek.
 */

export type Tone = "positive" | "caution" | "danger" | "info" | "neutral";

/** Yargı → görsel ton. Tek doğruluk kaynağı. */
export const VERDICT_TONE: Record<string, Tone> = {
  SCALE_UP: "positive",
  HEALTHY: "positive",
  WATCH: "caution",
  FIX_OPERATIONS: "caution",
  STOP_LOSS: "danger",
  UNMEASURED: "neutral",
};

export const VERDICT_LABEL: Record<string, string> = {
  SCALE_UP: "Büyüt",
  HEALTHY: "Sağlıklı",
  WATCH: "İzle",
  FIX_OPERATIONS: "Operasyonu düzelt",
  STOP_LOSS: "Zararı durdur",
  UNMEASURED: "Ölçülmedi",
};

export const STAGE_LABEL: Record<string, string> = {
  DISCOVERED: "Keşfedildi",
  ANALYZING: "Analiz ediliyor",
  SCORED: "Puanlandı",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  PURCHASING: "Satın alınıyor",
  IN_WAREHOUSE: "Depoda",
  LISTED: "Listelendi",
  SELLING: "Satışta",
  MONITORING: "İzleniyor",
  PAUSED: "Durduruldu",
  DISCONTINUED: "Sonlandırıldı",
};

/** Yolculuk sırası — ilerleme çubuğu bu sırayı kullanır. */
export const JOURNEY_ORDER = [
  "DISCOVERED",
  "ANALYZING",
  "SCORED",
  "APPROVED",
  "PURCHASING",
  "IN_WAREHOUSE",
  "LISTED",
  "SELLING",
  "MONITORING",
] as const;

/** Yolculuk dışı duraklar (dallanma): bunlar ilerleme çubuğunda yer almaz. */
export const OFF_JOURNEY = new Set(["REJECTED", "PAUSED", "DISCONTINUED"]);

/** Ürünün ana yolculukta kaçıncı durakta olduğu (0-tabanlı, yoksa -1) */
export function journeyIndex(stage: string): number {
  return (JOURNEY_ORDER as readonly string[]).indexOf(stage);
}

/** Para biçimi — her yerde aynı görünsün diye. */
export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Yüzde biçimi. null "ölçülemedi" demektir ve 0 ile KARIŞTIRILMAMALIDIR —
 * ROI'si olmayan ürünle ROI'si sıfır olan ürün farklı şeylerdir.
 */
export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `%${Number(value).toFixed(digits)}`;
}

/** Tarih — kısa Türkçe biçim */
export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Fiyat trendine göre ton: düşen tedarikçi fiyatı BİZİM için iyidir. */
export function trendTone(direction: string, isBuyingOpportunity: boolean): Tone {
  if (isBuyingOpportunity) return "positive";
  if (direction === "UP") return "danger";
  if (direction === "DOWN") return "positive";
  return "neutral";
}

export function trendLabel(direction: string): string {
  if (direction === "UP") return "Yükseliyor";
  if (direction === "DOWN") return "Düşüyor";
  if (direction === "FLAT") return "Sabit";
  return "Bilinmiyor";
}

/** Ton → Tailwind sınıf üçlüsü. Bileşenler bunu doğrudan kullanır. */
export const TONE_CLASS: Record<Tone, { chip: string; text: string; bar: string }> = {
  positive: {
    chip: "bg-positive/15 text-positive border-positive/40",
    text: "text-positive",
    bar: "bg-positive",
  },
  caution: {
    chip: "bg-caution/15 text-caution border-caution/40",
    text: "text-caution",
    bar: "bg-caution",
  },
  danger: {
    chip: "bg-danger/15 text-danger border-danger/40",
    text: "text-danger",
    bar: "bg-danger",
  },
  info: {
    chip: "bg-info/15 text-info border-info/40",
    text: "text-info",
    bar: "bg-info",
  },
  neutral: {
    chip: "bg-surface-3 text-ink-muted border-line",
    text: "text-ink-muted",
    bar: "bg-ink-faint",
  },
};

/**
 * Sıralama: yöneticinin ekranında EN ÖNEMLİ ürün en üstte olmalı.
 * Önem = aciliyet (severity) + parasal büyüklük. Alfabetik sıralama
 * bir karar destek ekranında işe yaramaz.
 */
const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
};

export function compareByUrgency(
  a: { severity: string; pnl: { netProfit: number } },
  b: { severity: string; pnl: { netProfit: number } }
): number {
  const sa = SEVERITY_RANK[a.severity] ?? 9;
  const sb = SEVERITY_RANK[b.severity] ?? 9;
  if (sa !== sb) return sa - sb;
  // Aynı aciliyette: parasal etkisi büyük olan önce (zarar da etkidir)
  return Math.abs(b.pnl.netProfit) - Math.abs(a.pnl.netProfit);
}
