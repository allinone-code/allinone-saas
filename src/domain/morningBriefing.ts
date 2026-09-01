/**
 * Morning Briefing — saf alan mantığı (T8.3).
 * Faz 8 öncesi `/api/intelligence` içinde SABİTLENMİŞ metinler vardı
 * ("%94.2 FBA", "2 kritik depo uyarısı", Dyson/DeWalt tavsiyeleri...).
 * Bu modül brifingi tamamen gerçek DB verisinden türetir; UI sözleşmesi aynıdır:
 *   { businessHealthScore, whatChanged[], whatMatters[], whatShouldIDo[] }
 */

export interface BriefingOrder {
  sellingPrice: string | number | null;
  quantity: number | null;
  shippedToAmazon: number | null;
  cargoStatus: string;
  p2MissingQty: number | null;
  orderNumber: string;
  createdAt: Date | null;
}

export interface BriefingMaster {
  asin: string | null;
  title: string;
  researcherName: string | null;
  roiPercent: string | number | null;
  decisionAction: string | null;
  duplicateScore: number | null;
}

export interface BriefingInput {
  orders: BriefingOrder[];
  masters: BriefingMaster[];
  researcherCount: number;
  storeCount: number;
  generatedFor?: Date;
}

export interface MorningBriefing {
  businessHealthScore: number;
  whatChanged: string[];
  whatMatters: string[];
  whatShouldIDo: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function num(v: string | number | null | undefined): number {
  return Number(v ?? 0) || 0;
}

export function buildMorningBriefing(input: BriefingInput): MorningBriefing {
  const now = input.generatedFor ?? new Date();
  const { orders, masters, researcherCount, storeCount } = input;

  // --- WHAT CHANGED: ciro + 30 gün delta + ROI + FBA oranı ---
  const revenue = orders.reduce((s, o) => s + num(o.sellingPrice) * num(o.quantity), 0);
  const revLast30 = orders
    .filter((o) => o.createdAt && now.getTime() - o.createdAt.getTime() <= 30 * DAY_MS)
    .reduce((s, o) => s + num(o.sellingPrice) * num(o.quantity), 0);
  const revPrev30 = orders
    .filter((o) => {
      if (!o.createdAt) return false;
      const age = now.getTime() - o.createdAt.getTime();
      return age > 30 * DAY_MS && age <= 60 * DAY_MS;
    })
    .reduce((s, o) => s + num(o.sellingPrice) * num(o.quantity), 0);
  const deltaPct =
    revPrev30 > 0 ? ((revLast30 - revPrev30) / revPrev30) * 100 : null;

  const avgRoi = masters.reduce((s, m) => s + num(m.roiPercent), 0) / (masters.length || 1);
  const totalQty = orders.reduce((s, o) => s + num(o.quantity), 0);
  const shippedQty = orders.reduce((s, o) => s + num(o.shippedToAmazon), 0);
  const fbaRatePct = totalQty > 0 ? (shippedQty / totalQty) * 100 : null;

  const whatChanged = [
    `${storeCount} mağaza konsolide ciro: $${revenue.toFixed(2)}` +
      (deltaPct !== null
        ? ` (son 30 gün, önceki 30 güne göre %${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)})`
        : " (yeterli geçmiş veri yok — delta hesaplanamadı)"),
    `Ortalama landed-cost ayarlı ROI: %${avgRoi.toFixed(1)} (hedef >%30.0, ${masters.length} onaylı ürün)`,
    fbaRatePct !== null
      ? `FBA sevk oranı: %${fbaRatePct.toFixed(1)} (${shippedQty}/${totalQty} birim Amazon'a sevk edildi)`
      : `FBA sevk oranı: hesaplanamadı (henüz sipariş yok)`,
  ];

  // --- WHAT MATTERS: problemli siparişler + ekip + policy motoru ---
  const cancelled = orders.filter((o) => o.cargoStatus === "İPTAL").length;
  const missingOrders = orders.filter((o) => num(o.p2MissingQty) > 0);
  const missingUnits = missingOrders.reduce((s, o) => s + num(o.p2MissingQty), 0);
  const rejected = masters.filter((m) => m.decisionAction === "REJECT");
  const topRejected = rejected[0]; // route desc(discoveredAt) sıralı gönderir

  const whatMatters = [
    missingUnits > 0
      ? `${missingOrders.length} siparişte toplam ${missingUnits} birim P2 eksik teslimat takipte` +
        (cancelled > 0 ? `; ayrıca ${cancelled} iptal` : "")
      : cancelled > 0
        ? `${cancelled} iptal sipariş inceleme bekliyor`
        : `Açık depo/kargo uyarısı yok`,
    `${researcherCount} sourcing uzmanı aktif (${masters.length} onaylı ürün kasası)`,
    topRejected
      ? `${topRejected.title} (${topRejected.asin ?? "ASIN yok"}) ROI <%25 — Policy Engine tarafından otomatik DURDURULDU` +
        (rejected.length > 1 ? ` (toplam ${rejected.length} ürün durduruldu)` : "")
      : `Policy Engine durdurması yok (tüm ürünler eşik üzerinde)`,
  ];

  // --- WHAT SHOULD I DO: gerçek adaylardan en fazla 3 aksiyon ---
  const actionable: string[] = [];
  const bestBuy = masters
    .filter((m) => m.decisionAction === "BUY" || m.decisionAction === "TEST")
    .sort((a, b) => num(b.roiPercent) - num(a.roiPercent))[0];
  if (bestBuy) {
    actionable.push(
      `1. ${bestBuy.title} (${bestBuy.asin ?? "ASIN yok"}) için ${bestBuy.decisionAction} kararı var — %${num(bestBuy.roiPercent).toFixed(1)} ROI ile FBA sevk planını değerlendir`
    );
  }
  const worstMissing = [...missingOrders].sort((a, b) => num(b.p2MissingQty) - num(a.p2MissingQty))[0];
  if (worstMissing) {
    actionable.push(
      `${actionable.length + 1}. ${worstMissing.orderNumber} numaralı siparişin ${num(worstMissing.p2MissingQty)} birim eksik teslimatı için kargo tazminat dosyasını kontrol et`
    );
  }
  const duplicate = masters.filter((m) => num(m.duplicateScore) >= 80)[0];
  if (duplicate) {
    actionable.push(
      `${actionable.length + 1}. ${duplicate.title} %${num(duplicate.duplicateScore).toFixed(0)} duplicate alarmı — ${duplicate.researcherName ?? "ilgili uzman"} kaydıyla birleştir`
    );
  }
  if (actionable.length === 0) {
    actionable.push(
      "1. Kritik aksiyon yok — yeni ürün araştırma oturumu planlamak için Zeka Merkezi'ni kullanın"
    );
  }

  // --- Skor: sorun başına ceza ve ROI primi öncekiyle aynı, sınırlar korunur ---
  const businessHealthScore = Math.min(
    99,
    Math.max(65, Math.round(75 + avgRoi * 0.25 - (cancelled + missingOrders.length) * 1.5))
  );

  return { businessHealthScore, whatChanged, whatMatters, whatShouldIDo: actionable.slice(0, 3) };
}
