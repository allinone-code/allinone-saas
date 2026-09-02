/**
 * CERBERUS — Keşif ve puanlama hattı (Aşama 3)
 *
 * Saf fonksiyonlar: veritabanına bağlı değil. Karar motorunun çıktısını
 * ürün yolculuğu duraklarına çevirir ve bir duraktan diğerine giden
 * yasal yolu hesaplar.
 *
 * Neden ayrı bir modül?
 * Aşama 2 durak makinesini (STAGE_META) kilitledi ama hiç kimse
 * DISCOVERED'dan ürün doğurmadı. Bu dosya o kopukluğu kapatmanın
 * kural katmanıdır; yazma işi db katmanındadır.
 */
import {
  STAGE_META,
  type LifecycleStage,
} from "@/domain/productIntelligence";
import type { DecisionEngineResult } from "@/domain/decisionEngine";

export type DecisionAction = DecisionEngineResult["decisionAction"];

/** Satın alma öncesi duraklar — sipariş bunlardan PURCHASING'e yürütebilir. */
export const PRE_PURCHASE_STAGES: readonly LifecycleStage[] = [
  "DISCOVERED",
  "ANALYZING",
  "SCORED",
  "APPROVED",
  "REJECTED",
];

export function isPrePurchaseStage(stage: string): stage is LifecycleStage {
  return (PRE_PURCHASE_STAGES as readonly string[]).includes(stage);
}

/**
 * Karar motoru çıktısının katalogda karşılık geldiği durak.
 *
 * WAIT, SCORED'da kalır: yönetici onayı olmadan sermaye taahhüdü yok.
 * BUY ve TEST ikisi de APPROVED'dur — TEST "küçük parti al" demektir,
 * reddetmek değil.
 */
export function stageAfterDecision(decision: DecisionAction): LifecycleStage {
  switch (decision) {
    case "BUY":
    case "TEST":
      return "APPROVED";
    case "REJECT":
      return "REJECTED";
    case "WAIT":
      return "SCORED";
  }
}

/**
 * `from` durağından `to` durağına giden en kısa yasal yol (from hariç).
 * Yol yoksa null — keyfî sıçrama yok, durak makinesi tek kapı.
 */
export function transitionPath(
  from: LifecycleStage,
  to: LifecycleStage
): LifecycleStage[] | null {
  if (from === to) return [];

  const queue: LifecycleStage[][] = [[from]];
  const seen = new Set<LifecycleStage>([from]);

  while (queue.length) {
    const path = queue.shift()!;
    const cur = path[path.length - 1]!;
    for (const next of STAGE_META[cur].next) {
      if (seen.has(next)) continue;
      if (next === to) return [...path.slice(1), next];
      seen.add(next);
      queue.push([...path, next]);
    }
  }

  return null;
}

export function canReach(from: LifecycleStage, to: LifecycleStage): boolean {
  return transitionPath(from, to) !== null;
}

export interface StageHop {
  to: LifecycleStage;
  reason: string;
}

function hopReason(to: LifecycleStage, decision: DecisionAction, roiPercent: number): string {
  switch (to) {
    case "ANALYZING":
      return "Keşif kaydı puanlama kuyruğuna alındı";
    case "SCORED":
      return decision === "WAIT"
        ? `Karar motoru WAIT — yönetici onayı bekleniyor (tahmini ROI %${roiPercent.toFixed(1)})`
        : `Karar motoru ${decision} (tahmini ROI %${roiPercent.toFixed(1)})`;
    case "APPROVED":
      return `Karar ${decision} — satın alma onaylandı (tahmini ROI %${roiPercent.toFixed(1)})`;
    case "REJECTED":
      return `Karar REJECT — ürün elendi (tahmini ROI %${roiPercent.toFixed(1)})`;
    case "PURCHASING":
      return "Sipariş kaydı — satın alma başladı";
    default:
      return `${STAGE_META[to]?.label ?? to} durağına geçiş`;
  }
}

/**
 * Mevcut duraktan, kararın gerektirdiği durağa yasal hop listesi.
 * Hedefe yasal yol yoksa boş dizi — çağıran sessizce durak değiştirmez.
 */
export function scoringWalk(
  from: LifecycleStage,
  decision: DecisionAction,
  roiPercent: number
): StageHop[] {
  const target = stageAfterDecision(decision);
  const path = transitionPath(from, target);
  if (!path) return [];
  return path.map((to) => ({ to, reason: hopReason(to, decision, roiPercent) }));
}

/**
 * Sipariş yazıldığında ürün PURCHASING'e çekilmeli mi?
 *
 * Evet: keşif/analiz/onay/red durağındaysa — sipariş satın almanın kanıtıdır.
 * Hayır: zaten PURCHASING veya daha ilerideyse (geri gitmek yasaktır).
 */
export function shouldAdvanceToPurchasingOnOrder(stage: string): boolean {
  return isPrePurchaseStage(stage);
}

export function purchasingWalk(from: LifecycleStage): StageHop[] {
  const path = transitionPath(from, "PURCHASING");
  if (!path) return [];
  return path.map((to) => ({
    to,
    reason: hopReason(to, "BUY", 0),
  }));
}
