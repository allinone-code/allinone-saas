"use client";

import type { MorningBriefingView, OrderKpis } from "../types";

function Card({
  label,
  value,
  hint,
  badge,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint: string;
  badge?: string;
  tone?: "slate" | "indigo" | "amber" | "emerald" | "rose";
}) {
  const border = {
    slate: "border-slate-800/90",
    indigo: "border-indigo-500/35",
    amber: "border-amber-500/35",
    emerald: "border-emerald-500/35",
    rose: "border-rose-500/35",
  }[tone];

  const valueColor = {
    slate: "text-white",
    indigo: "text-indigo-300",
    amber: "text-amber-300",
    emerald: "text-emerald-400",
    rose: "text-rose-300",
  }[tone];

  return (
    <div className={`bg-[#0F1626] border ${border} rounded-2xl p-3.5 shadow-sm`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono-tech uppercase text-slate-400 truncate">{label}</span>
        {badge && (
          <span className="text-[10px] font-mono-tech text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
            {badge}
          </span>
        )}
      </div>
      <div className={`text-xl font-display font-bold mt-1 ${valueColor}`}>{value}</div>
      <span className="text-[10px] font-mono-tech text-slate-500">{hint}</span>
    </div>
  );
}

/**
 * KPI şeridi — tüm değerler görüntülenen veriden hesaplanır.
 * Önceki sürümdeki sabit "+14.2%" ve "The Vitamin Shoppe US" gibi
 * uydurma rozetler kaldırıldı (F-15/F-23).
 */
export function KpiStrip({
  kpis,
  briefing,
  storeScope,
}: {
  kpis: OrderKpis;
  briefing: MorningBriefingView | null;
  storeScope: string;
}) {
  return (
    <section className="border-b border-slate-800/80 bg-[#0F1626]/50 px-5 sm:px-6 py-3.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card
          label={`Sipariş sayısı (${storeScope})`}
          value={`${kpis.totalOrders}`}
          hint="Görüntülenen filtredeki kayıt"
        />
        <Card
          label="Toplam adet"
          value={`${kpis.totalUnits}`}
          hint={`FBA sevk: ${kpis.totalShipped} adet`}
          badge={`%${kpis.fulfillmentRate} sevk`}
          tone="emerald"
        />
        <Card
          label="Toplam tedarik maliyeti"
          value={`$${Number(kpis.totalSpend).toLocaleString()}`}
          hint="Tedarikçi fatura bedeli"
          badge={kpis.avgRoi === "—" ? "ROI —" : `ROI %${kpis.avgRoi}`}
          tone="indigo"
        />
        <Card
          label="Tahmini Amazon cirosu"
          value={`$${Number(kpis.totalRevenueEst).toLocaleString()}`}
          hint={`Tahmini net: $${Number(kpis.grossNetEst).toLocaleString()}`}
          tone={Number(kpis.grossNetEst) >= 0 ? "emerald" : "rose"}
        />
        <Card
          label="P1–P4 fire / problem"
          value={`${kpis.problemCount}`}
          hint={`Refund toplamı: $${kpis.totalRefunds}`}
          tone="amber"
        />
        <Card
          label="İş sağlığı skoru"
          value={briefing ? `${briefing.businessHealthScore}/100` : "—"}
          hint={briefing ? `Durum: ${briefing.healthGrade}` : "Veri bekleniyor"}
          tone={
            !briefing
              ? "slate"
              : briefing.businessHealthScore >= 70
              ? "emerald"
              : briefing.businessHealthScore >= 55
              ? "amber"
              : "rose"
          }
        />
      </div>
    </section>
  );
}
