"use client";

import type { ProductMasterView } from "../types";

const DECISION_STYLES: Record<string, string> = {
  BUY: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  TEST: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  WAIT: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  REJECT: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export function DecisionVaultTable({
  masters,
  decisionFilter,
  onDecisionFilterChange,
  onSelect,
}: {
  masters: ProductMasterView[];
  decisionFilter: string;
  onDecisionFilterChange: (value: string) => void;
  onSelect: (master: ProductMasterView) => void;
}) {
  const visible =
    decisionFilter === "ALL"
      ? masters
      : masters.filter((m) => m.decisionAction === decisionFilter);

  return (
    <div className="space-y-4">
      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
            Product Master Karar Kasası (Product ≠ Listing Ayrımı)
          </h3>
          <p className="text-xs text-slate-400 font-mono-tech">
            Karar matrisi (BUY | TEST | WAIT | REJECT), veri tazeliği ve AI kanıt zinciri
          </p>
        </div>

        <select
          value={decisionFilter}
          onChange={(e) => onDecisionFilterChange(e.target.value)}
          className="bg-[#080C14] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-tech text-indigo-300 font-bold"
        >
          <option value="ALL">TÜM KARARLAR ({masters.length})</option>
          <option value="BUY">BUY — Satın Al</option>
          <option value="TEST">TEST — Test Partisi</option>
          <option value="WAIT">WAIT — Beklet</option>
          <option value="REJECT">REJECT — Reddet</option>
        </select>
      </div>

      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-tech">
            <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
              <tr>
                <th className="p-3.5">Product Code / Barkodlar</th>
                <th className="p-3.5">Ürün Master &amp; US Kaynak</th>
                <th className="p-3.5">Veri Tazeliği &amp; Kalite</th>
                <th className="p-3.5 text-right">Landed Cost</th>
                <th className="p-3.5 text-right">Amazon Satış</th>
                <th className="p-3.5 text-right">Tahmini vs Gerçek ROI</th>
                <th className="p-3.5 text-center">AI Opportunity</th>
                <th className="p-3.5">Decision Engine</th>
                <th className="p-3.5 text-right">360° Müfettiş</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    Bu filtrede ürün kaydı yok.
                  </td>
                </tr>
              ) : (
                visible.map((m) => (
                  <tr key={m.id} className="hover:bg-[#162035]/80 transition">
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="text-indigo-400 font-bold block">{m.productCode}</span>
                      <span className="text-[10px] text-slate-400 block">ASIN: {m.asin}</span>
                      <span className="text-[10px] text-slate-500 block">UPC: {m.upc}</span>
                    </td>
                    <td className="p-3.5 max-w-sm font-sans">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tech text-[10px] font-bold">
                          {m.brand}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono-tech">
                          {m.researcherName}
                        </span>
                      </div>
                      <button
                        onClick={() => onSelect(m)}
                        className="font-medium text-white hover:text-indigo-400 text-left line-clamp-2 transition"
                      >
                        {m.title}
                      </button>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold block w-fit ${
                          m.dataFreshnessStatus === "FRESH"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {m.dataFreshnessStatus}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Kalite: {m.dataQualityStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-amber-300">${m.landedCost}</td>
                    <td className="p-3.5 text-right font-bold text-white">${m.sellingPrice}</td>
                    <td className="p-3.5 text-right">
                      <span className="text-emerald-400 font-bold block">%{m.roiPercent} tahmini</span>
                      <span className="text-[10px] text-slate-400 block">
                        Gerçek: %{m.actualRoiPercent ?? "—"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="text-base font-display font-bold text-indigo-300">
                        {m.opportunityScore}/100
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border block text-center ${
                          DECISION_STYLES[m.decisionAction] ?? DECISION_STYLES.REJECT
                        }`}
                      >
                        {m.decisionAction} (Güven: %{m.confidenceScore})
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onSelect(m)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 font-bold transition"
                      >
                        Kanıt &amp; Radar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
