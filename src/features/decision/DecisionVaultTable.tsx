"use client";

import type { ProductMasterView } from "../types";

const DECISION_STYLES: Record<string, string> = {
  BUY: "bg-positive/20 text-positive border-positive/40",
  TEST: "bg-sky-500/20 text-info border-sky-500/40",
  WAIT: "bg-caution/20 text-caution border-amber-500/40",
  REJECT: "bg-danger/20 text-danger border-danger/40",
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
      <div className="bg-surface-1 border border-line rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink uppercase font-mono-tech">
            Product Master Karar Kasası (Product ≠ Listing Ayrımı)
          </h3>
          <p className="text-xs text-ink-muted font-mono-tech">
            Karar matrisi (BUY | TEST | WAIT | REJECT), veri tazeliği ve AI kanıt zinciri
          </p>
        </div>

        <select
          value={decisionFilter}
          onChange={(e) => onDecisionFilterChange(e.target.value)}
          className="bg-surface-base border border-line rounded-xl px-3 py-2 text-xs font-mono-tech text-brand-soft font-bold"
        >
          <option value="ALL">TÜM KARARLAR ({masters.length})</option>
          <option value="BUY">BUY — Satın Al</option>
          <option value="TEST">TEST — Test Partisi</option>
          <option value="WAIT">WAIT — Beklet</option>
          <option value="REJECT">REJECT — Reddet</option>
        </select>
      </div>

      <div className="bg-surface-1 border border-line rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-tech">
            <thead className="bg-surface-base text-ink-muted border-b border-line text-[11px] uppercase">
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
            <tbody className="divide-y divide-line">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-ink-faint">
                    Bu filtrede ürün kaydı yok.
                  </td>
                </tr>
              ) : (
                visible.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-2 transition">
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="text-brand-soft font-bold block">{m.productCode}</span>
                      <span className="text-[10px] text-ink-muted block">ASIN: {m.asin}</span>
                      <span className="text-[10px] text-ink-faint block">UPC: {m.upc}</span>
                    </td>
                    <td className="p-3.5 max-w-sm font-sans">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-surface-3 text-caution font-mono-tech text-[10px] font-bold">
                          {m.brand}
                        </span>
                        <span className="text-[10px] text-ink-muted font-mono-tech">
                          {m.researcherName}
                        </span>
                      </div>
                      <button
                        onClick={() => onSelect(m)}
                        className="font-medium text-ink hover:text-brand-soft text-left line-clamp-2 transition"
                      >
                        {m.title}
                      </button>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold block w-fit ${
                          m.dataFreshnessStatus === "FRESH"
                            ? "bg-positive/15 text-positive border border-positive/30"
                            : "bg-caution/15 text-caution border border-caution/30"
                        }`}
                      >
                        {m.dataFreshnessStatus}
                      </span>
                      <span className="text-[10px] text-ink-muted block mt-1">
                        Kalite: {m.dataQualityStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-caution">${m.landedCost}</td>
                    <td className="p-3.5 text-right font-bold text-ink">${m.sellingPrice}</td>
                    <td className="p-3.5 text-right">
                      <span className="text-positive font-bold block">%{m.roiPercent} tahmini</span>
                      <span className="text-[10px] text-ink-muted block">
                        Gerçek: %{m.actualRoiPercent ?? "—"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="text-base font-display font-bold text-brand-soft">
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
                        className="px-3 py-1.5 rounded-xl bg-brand/20 hover:bg-brand/35 text-brand-soft font-bold transition"
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
