/**
 * Sat26 veri hijyeni kuralları (Cerberus operasyon denetimi R2, R5, R8).
 *
 * Gerçek Sat26 yedeği (194 satır) üzerinde ölçülen sorunlar:
 *  - R2: 32 satır "İPTAL" ama P1 (iptal adet) boş → düzeltilmiş maliyet
 *    iptali düşmüyor, 4.595,23 $ maliyet gerçekte yok.
 *  - R8: 13 MSKU'nun başında "\n" var; 5 MSKU bilinen kalıplara uymuyor
 *    (HRN1-…, çıplak ASIN, L7-FTOK-K9TZ).
 *  - R5: birim maliyet 2 basamaktan uzun kesirlerle tutuluyordu.
 *
 * Bu modül SAF fonksiyonlar içerir (DB/IO yok); import yolları ve denetim
 * ekranları aynı kuralı buradan kullanır — kural iki yerde çoğalmasın.
 */

/** Bilinen MSKU önekleri: HRN-/KHRN- (mağaza), FCR/MH (eski), yanında 10 haneli ASIN. */
const ASIN_MSKU = /^(HRN|KHRN|FCR|MH)-?(B[0-9A-Z]{9})$/;
/** Tedarikçi SKU biçimi, ör. "L7-FTOK-K9TZ". */
const SUPPLIER_MSKU = /^[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const CANCEL_STATUSES = new Set(["İPTAL", "IPTAL", "CANCELLED", "CANCELED"]);

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Boşluk, satır sonu ve `<br>` kalıntılarını temizler (R8). Harf büyüklüğüne dokunmaz. */
export function cleanMsku(raw: unknown): string {
  return String(raw ?? "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/\s+/g, "")
    .trim();
}

/** MSKU bilinen kalıplardan birine uyuyor mu? (R8) */
export function isKnownMskuPattern(msku: string): boolean {
  return ASIN_MSKU.test(msku) || SUPPLIER_MSKU.test(msku);
}

/** Kargo durumu iptal mi? Büyük/küçük harf ve Türkçe İ'ye toleranslı. */
export function isCancelledStatus(status: unknown): boolean {
  const s = String(status ?? "").trim().toLocaleUpperCase("tr-TR");
  return CANCEL_STATUSES.has(s);
}

export interface Sat26QuantityRow {
  cargoStatus: string;
  quantity: number;
  p1CancelQty: number;
  p2MissingQty: number;
  p3DefectiveQty: number;
  p4ExpiredQty: number;
}

/**
 * İPTAL kuralı (R2): durum iptal ve P1 boşsa, P1'i kalan adede tamamlar.
 * Kalan = adet − (P2+P3+P4). DB kısıtı (fire toplamı ≤ adet) bozulmaz.
 * P1 zaten doluysa kullanıcının girdiğine dokunmaz.
 */
export function applyCancelRule<T extends Sat26QuantityRow>(row: T): { row: T; applied: boolean } {
  if (!isCancelledStatus(row.cargoStatus) || row.p1CancelQty > 0) return { row, applied: false };
  const others = row.p2MissingQty + row.p3DefectiveQty + row.p4ExpiredQty;
  const p1 = Math.max(0, row.quantity - others);
  if (p1 === 0) return { row, applied: false };
  return { row: { ...row, p1CancelQty: p1 }, applied: true };
}

export interface CorrectedCostInput extends Omit<Sat26QuantityRow, "cargoStatus"> {
  totalCost: number;
  refundAmount: number;
}

/**
 * Düzeltilmiş maliyet — Sat26!AN formülünün birebir karşılığı:
 *   R − P×(V+W+X+Y) + AB,  P = R/O
 * Birim maliyet yuvarlanmadan kullanılır, yalnız sonuç ROUND(2) (R5).
 */
export function computeCorrectedCost(i: CorrectedCostInput): number {
  if (!(i.quantity > 0)) return round2(i.totalCost + i.refundAmount);
  const unit = i.totalCost / i.quantity;
  const lost = i.p1CancelQty + i.p2MissingQty + i.p3DefectiveQty + i.p4ExpiredQty;
  return round2(i.totalCost - unit * lost + i.refundAmount);
}

export interface Sat26Warning {
  code: "MSKU_CLEANED" | "MSKU_PATTERN" | "CANCEL_P1_FILLED";
  message: string;
}

/** Tek satır için hijyen uyarıları (içe aktarma raporunda gösterilir; satırı ENGELLEMEZ). */
export function describeMsku(raw: unknown): { msku: string; warnings: Sat26Warning[] } {
  const original = String(raw ?? "");
  const msku = cleanMsku(original);
  const warnings: Sat26Warning[] = [];
  if (msku && msku !== original) {
    warnings.push({ code: "MSKU_CLEANED", message: `MSKU temizlendi: ${JSON.stringify(original)} → ${msku}` });
  }
  if (msku && !isKnownMskuPattern(msku)) {
    warnings.push({ code: "MSKU_PATTERN", message: `MSKU bilinen kalıplara uymuyor: ${msku}` });
  }
  return { msku, warnings };
}
