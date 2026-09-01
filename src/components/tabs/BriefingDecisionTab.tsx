"use client";

import { Sun, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * T8.2 — page.tsx ayrıştırması (BriefingDecisionTab).
 * TAB 0: Morning Briefing + Decision Engine Vault
 */
export default function BriefingDecisionTab({ morningBriefing, productMasters, decisionFilter, onDecisionFilterChange, onSelectMaster }: { [key: string]: any }) {
  return (
  <div className="space-y-6">
    {/* Executive Morning Briefing Banner (WHAT CHANGED? • WHAT MATTERS? • WHAT SHOULD I DO?) */}
    <div className="bg-gradient-to-r from-[#121A2C] via-[#0F1626] to-[#121A2C] border border-indigo-500/40 rounded-2xl p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono-tech uppercase tracking-wider text-indigo-400 font-bold block">
              CERBERUS MORNING BRIEFING — EXECUTIVE INTELLIGENCE
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Günlük Karar Destek Brifingi &amp; İş Sağlığı Skoru
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono-tech">
            <span className="text-[10px] text-slate-400 block">BUSINESS HEALTH SCORE</span>
            <span className="text-2xl font-display font-bold text-emerald-400">
              {morningBriefing.businessHealthScore} / 100
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 text-xs font-mono-tech">
        <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2">
          <span className="text-indigo-400 font-bold block uppercase flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> WHAT CHANGED? (NE DEĞİŞTİ?)
          </span>
          <ul className="space-y-1.5 text-slate-300">
            {morningBriefing.whatChanged.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#080C14] p-4 rounded-xl border border-amber-500/30 space-y-2">
          <span className="text-amber-400 font-bold block uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> WHAT MATTERS? (KRİTİK RİSKLER)
          </span>
          <ul className="space-y-1.5 text-slate-300">
            {morningBriefing.whatMatters.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">⚠️</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#080C14] p-4 rounded-xl border border-emerald-500/40 space-y-2">
          <span className="text-emerald-400 font-bold block uppercase flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> WHAT SHOULD I DO? (TAVSİYE EDİLEN AKSİYONLAR)
          </span>
          <ul className="space-y-1.5 text-slate-200">
            {morningBriefing.whatShouldIDo.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold mt-0.5">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>

    {/* Decision Engine Filter Bar */}
    <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
          Product Master Karar Kasası (Product ≠ Listing Ayrımı)
        </h3>
        <p className="text-xs text-slate-400 font-mono-tech">
          Karar Matrisi (`BUY | TEST | WAIT | REJECT`), Veri Tazeliği ve AI Kanıt Zinciri
        </p>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={decisionFilter}
          onChange={(e) => onDecisionFilterChange(e.target.value)}
          className="bg-[#080C14] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-tech text-indigo-300 font-bold"
        >
          <option value="ALL">TÜM DECISION KARARLARI (4)</option>
          <option value="BUY">BUY (Satın Al - Yüksek Güven)</option>
          <option value="TEST">TEST (Test Partisi - Orta Risk)</option>
          <option value="WAIT">WAIT (Beklet - Çift Kayıt İncele)</option>
          <option value="REJECT">REJECT (Reddet - Policy İhlali)</option>
        </select>
      </div>
    </div>

    {/* Product Masters Decision Vault Table */}
    <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <table className="w-full text-left text-xs font-mono-tech">
        <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
          <tr>
            <th className="p-3.5">Product Code / Barcodes</th>
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
          {productMasters
            .filter((m: any) => decisionFilter === "ALL" || m.decisionAction === decisionFilter
            )
            .map((m: any) => (
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
                    onClick={() => onSelectMaster(m)}
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
                <td className="p-3.5 text-right font-bold text-amber-300">
                  ${m.landedCost}
                </td>
                <td className="p-3.5 text-right font-bold text-white">
                  ${m.sellingPrice}
                </td>
                <td className="p-3.5 text-right">
                  <span className="text-emerald-400 font-bold block">
                    %{m.roiPercent} Tahmini
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Gerçek: %{m.actualRoiPercent || m.roiPercent}
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
                      m.decisionAction === "BUY"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : m.decisionAction === "TEST"
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                        : m.decisionAction === "WAIT"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    {m.decisionAction} (Güven: %{m.confidenceScore})
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => onSelectMaster(m)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 font-bold transition"
                  >
                    Kanıt &amp; Radar 360°
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  </div>
  );
}
