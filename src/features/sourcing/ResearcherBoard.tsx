"use client";

import type { ResearcherView } from "../types";

export function ResearcherBoard({ researchers }: { researchers: ResearcherView[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-surface-1 border border-line rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold text-ink">
            ABD Sourcing Ekibi (Quality-Adjusted Researcher Scorecard)
          </h2>
          <p className="text-xs text-ink-muted font-mono-tech mt-0.5">
            Sadece ürün sayısı değil: onay oranı → satın alma dönüşümü → üretilen net kâr ve fire oranı
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-positive/15 border border-positive/30 text-positive text-xs font-mono-tech font-bold">
          {researchers.length} UZMAN KAYITLI
        </span>
      </div>

      {researchers.length === 0 ? (
        <div className="bg-surface-1 border border-line rounded-2xl p-8 text-center text-ink-faint text-sm font-mono-tech">
          Henüz araştırmacı kaydı yok. Admin panelinden ekip üyelerini tanımlayın.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {researchers.map((r) => (
            <div
              key={r.id}
              className="bg-surface-1 border border-line hover:border-brand/50 rounded-2xl p-5 flex flex-col justify-between transition shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand/20 border border-brand/30 text-brand-soft font-mono-tech font-bold flex items-center justify-center text-xs shrink-0">
                      {r.avatar || r.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink truncate">{r.name}</span>
                        <span className="text-[10px] font-mono-tech text-ink-muted">{r.code}</span>
                      </div>
                      <span className="text-[11px] text-brand-soft block truncate">
                        {r.specialtyDomain}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono-tech shrink-0">
                    <span className="text-[10px] text-ink-muted block">KALİTE</span>
                    <span
                      className={`text-xl font-bold ${
                        Number(r.researcherScore) >= 90 ? "text-positive" : "text-brand-soft"
                      }`}
                    >
                      {r.researcherScore}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech bg-surface-base p-3 rounded-xl border border-line my-3">
                  <div>
                    <span className="text-[10px] text-ink-faint block">Keşif Hacmi</span>
                    <span className="text-ink font-bold">{r.discoveryVolume} ürün</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-faint block">Onay Oranı</span>
                    <span className="text-positive font-bold">%{r.approvalRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-faint block">Net Kâr Katkısı</span>
                    <span className="text-positive font-bold">
                      +${Number(r.averageNetProfit).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-faint block">Ortalama ROI</span>
                    <span className="text-brand-soft font-bold">%{r.averageRoi}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-line flex items-center justify-between text-xs font-mono-tech text-ink-muted">
                <span>Aktif listing: {r.activeListingsCount}</span>
                <span className="text-caution">Fire: %{r.problemRate}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
