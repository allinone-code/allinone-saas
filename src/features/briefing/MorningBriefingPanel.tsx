"use client";

import { AlertTriangle, CheckCircle2, Info, Sun, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { BriefingItemView, MorningBriefingView } from "../types";

const SEVERITY_STYLES: Record<BriefingItemView["severity"], { dot: string; text: string }> = {
  CRITICAL: { dot: "bg-rose-400", text: "text-rose-200" },
  WARN: { dot: "bg-amber-400", text: "text-amber-100" },
  INFO: { dot: "bg-slate-500", text: "text-slate-300" },
};

function BriefingList({ items, empty }: { items: BriefingItemView[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-[11px] text-slate-500 italic">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const style = SEVERITY_STYLES[item.severity];
        return (
          <li key={`${item.metric}-${i}`} className="flex items-start gap-2">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
            <span className="min-w-0">
              <span className={`block leading-snug ${style.text}`}>{item.text}</span>
              {/* Her cümlenin dayandığı metrik gösterilir: "bu sayı nereden geliyor?" */}
              <span className="text-[10px] text-slate-600 font-mono-tech">{item.metric}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function gradeColor(grade: string) {
  switch (grade) {
    case "GÜÇLÜ":
      return "text-emerald-400";
    case "İYİ":
      return "text-sky-400";
    case "İZLEMEDE":
      return "text-amber-400";
    default:
      return "text-rose-400";
  }
}

export function MorningBriefingPanel({
  briefing,
  storeScope,
}: {
  briefing: MorningBriefingView | null;
  storeScope: string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!briefing || briefing.sampleSize === 0) {
    return (
      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-6 text-center">
        <Sun className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h2 className="text-sm font-display font-bold text-white">
          Brifing için henüz yeterli veri yok
        </h2>
        <p className="text-xs text-slate-400 font-mono-tech mt-1 max-w-xl mx-auto">
          İş Sağlığı Skoru ve aksiyon önerileri yalnızca gerçek sipariş ve ürün kayıtlarından
          hesaplanır. Sipariş içe aktardığınızda ({storeScope} kapsamı) bu panel otomatik dolar.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#121A2C] via-[#0F1626] to-[#121A2C] border border-indigo-500/40 rounded-2xl p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono-tech uppercase tracking-wider text-indigo-400 font-bold block">
              MORNING BRIEFING — {storeScope} KAPSAMI • {briefing.sampleSize} KAYIT ÜZERİNDEN
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Günlük Karar Destek Brifingi &amp; İş Sağlığı Skoru
            </h2>
          </div>
        </div>

        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="text-right font-mono-tech group cursor-pointer"
          title="Skorun nasıl hesaplandığını gör"
        >
          <span className="text-[10px] text-slate-400 block group-hover:text-indigo-300">
            BUSINESS HEALTH SCORE — kırılımı gör
          </span>
          <span className={`text-2xl font-display font-bold ${gradeColor(briefing.healthGrade)}`}>
            {briefing.businessHealthScore} / 100
            <span className="text-xs ml-2 uppercase">{briefing.healthGrade}</span>
          </span>
        </button>
      </div>

      {showBreakdown && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          {briefing.healthBreakdown.map((axis) => (
            <div
              key={axis.axis}
              className="bg-[#080C14] border border-slate-800 rounded-xl p-3 font-mono-tech"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-slate-400">%{Math.round(axis.weight * 100)} ağırlık</span>
                <span className="text-sm font-bold text-white">{axis.score}</span>
              </div>
              <span className="text-[11px] text-indigo-300 block mt-1 leading-tight">{axis.axis}</span>
              <div className="h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    axis.score >= 75 ? "bg-emerald-500" : axis.score >= 50 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${axis.score}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1.5 leading-tight">{axis.detail}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 text-xs font-mono-tech">
        <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2">
          <span className="text-indigo-400 font-bold uppercase flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> WHAT CHANGED? (NE DEĞİŞTİ?)
          </span>
          <BriefingList items={briefing.whatChanged} empty="Dönem içinde ölçülen hareket yok." />
        </div>

        <div className="bg-[#080C14] p-4 rounded-xl border border-amber-500/30 space-y-2">
          <span className="text-amber-400 font-bold uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> WHAT MATTERS? (KRİTİK RİSKLER)
          </span>
          <BriefingList items={briefing.whatMatters} empty="Açık risk kaydı bulunmuyor." />
        </div>

        <div className="bg-[#080C14] p-4 rounded-xl border border-emerald-500/40 space-y-2">
          <span className="text-emerald-400 font-bold uppercase flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> WHAT SHOULD I DO? (AKSİYONLAR)
          </span>
          <BriefingList items={briefing.whatShouldIDo} empty="Bekleyen aksiyon yok." />
        </div>
      </div>

      <p className="text-[10px] text-slate-600 font-mono-tech mt-3 flex items-center gap-1.5">
        <Info className="w-3 h-3" />
        Tüm maddeler canlı veritabanı agregasyonundan üretildi •{" "}
        {new Date(briefing.generatedAt).toLocaleString("tr-TR")}
      </p>
    </div>
  );
}
