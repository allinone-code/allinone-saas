"use client";

import type { ResearcherView } from "../types";

export function ResearcherBoard({ researchers }: { researchers: ResearcherView[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold text-white">
            ABD Sourcing Ekibi (Quality-Adjusted Researcher Scorecard)
          </h2>
          <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
            Sadece ürün sayısı değil: onay oranı → satın alma dönüşümü → üretilen net kâr ve fire oranı
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono-tech font-bold">
          {researchers.length} UZMAN KAYITLI
        </span>
      </div>

      {researchers.length === 0 ? (
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm font-mono-tech">
          Henüz araştırmacı kaydı yok. Admin panelinden ekip üyelerini tanımlayın.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {researchers.map((r) => (
            <div
              key={r.id}
              className="bg-[#0F1626] border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono-tech font-bold flex items-center justify-center text-xs shrink-0">
                      {r.avatar || r.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{r.name}</span>
                        <span className="text-[10px] font-mono-tech text-slate-400">{r.code}</span>
                      </div>
                      <span className="text-[11px] text-indigo-400 block truncate">
                        {r.specialtyDomain}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono-tech shrink-0">
                    <span className="text-[10px] text-slate-400 block">KALİTE</span>
                    <span
                      className={`text-xl font-bold ${
                        Number(r.researcherScore) >= 90 ? "text-emerald-400" : "text-indigo-300"
                      }`}
                    >
                      {r.researcherScore}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech bg-[#080C14] p-3 rounded-xl border border-slate-800 my-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Keşif Hacmi</span>
                    <span className="text-white font-bold">{r.discoveryVolume} ürün</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Onay Oranı</span>
                    <span className="text-emerald-400 font-bold">%{r.approvalRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Net Kâr Katkısı</span>
                    <span className="text-emerald-400 font-bold">
                      +${Number(r.averageNetProfit).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Ortalama ROI</span>
                    <span className="text-indigo-300 font-bold">%{r.averageRoi}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-mono-tech text-slate-400">
                <span>Aktif listing: {r.activeListingsCount}</span>
                <span className="text-amber-400">Fire: %{r.problemRate}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
