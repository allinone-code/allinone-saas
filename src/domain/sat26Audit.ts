/**
 * Mevcut `orders` kayıtları için Sat26 hijyen denetimi (R2, R5, R8).
 *
 * İçe aktarma kuralları (`sat26Hygiene.ts`) yalnız YENİ import'ları düzeltir.
 * Bu fonksiyon veritabanında zaten duran kayıtları tarar ve ne olacağını
 * hesaplar — hiçbir şey yazmaz. Düzeltmenin uygulanması ayrı, bilinçli bir
 * adımdır.
 */
import {
  applyCancelRule,
  computeCorrectedCost,
  describeMsku,
  isCancelledStatus,
} from "./sat26Hygiene";

export interface AuditOrderRow {
  id: number;
  buyerStore: string;
  orderNumber: string;
  asin: string;
  msku: string;
  cargoStatus: string;
  quantity: number;
  totalCost: number;
  refundAmount: number;
  correctedCost: number;
  p1CancelQty: number;
  p2MissingQty: number;
  p3DefectiveQty: number;
  p4ExpiredQty: number;
}

export type AuditFindingCode = "CANCEL_P1_EMPTY" | "MSKU_DIRTY" | "MSKU_UNKNOWN_PATTERN";

export interface AuditFinding {
  orderId: number;
  orderNumber: string;
  asin: string;
  code: AuditFindingCode;
  message: string;
  /** Düzeltme önerisi; yoksa elle bakılmalı. */
  proposed?: { p1CancelQty?: number; correctedCost?: number; msku?: string };
}

export interface Sat26AuditReport {
  scanned: number;
  findings: AuditFinding[];
  counts: Record<AuditFindingCode, number>;
  /** İPTAL satırlarda düzeltilmiş maliyetin fazla gösterdiği toplam tutar ($). */
  overstatedCost: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function auditSat26Orders(rows: AuditOrderRow[]): Sat26AuditReport {
  const findings: AuditFinding[] = [];
  const counts: Record<AuditFindingCode, number> = {
    CANCEL_P1_EMPTY: 0,
    MSKU_DIRTY: 0,
    MSKU_UNKNOWN_PATTERN: 0,
  };
  let overstatedCost = 0;

  for (const o of rows) {
    if (isCancelledStatus(o.cargoStatus)) {
      const rule = applyCancelRule(o);
      if (rule.applied) {
        const proposedCost = computeCorrectedCost({ ...rule.row, ...o, p1CancelQty: rule.row.p1CancelQty });
        overstatedCost += Math.max(0, o.correctedCost - proposedCost);
        counts.CANCEL_P1_EMPTY++;
        findings.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          asin: o.asin,
          code: "CANCEL_P1_EMPTY",
          message: `İPTAL ama iptal adedi (P1) boş; ${rule.row.p1CancelQty}/${o.quantity} adet iptal sayılmalı.`,
          proposed: { p1CancelQty: rule.row.p1CancelQty, correctedCost: proposedCost },
        });
      }
    }

    const m = describeMsku(o.msku);
    for (const w of m.warnings) {
      const code: AuditFindingCode = w.code === "MSKU_CLEANED" ? "MSKU_DIRTY" : "MSKU_UNKNOWN_PATTERN";
      counts[code]++;
      findings.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        asin: o.asin,
        code,
        message: w.message,
        proposed: code === "MSKU_DIRTY" ? { msku: m.msku } : undefined,
      });
    }
  }

  return { scanned: rows.length, findings, counts, overstatedCost: round2(overstatedCost) };
}
