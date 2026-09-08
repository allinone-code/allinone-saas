"use client";

import { useState } from "react";
import { Search, Loader2, TrendingUp, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";

interface KeepaData {
  asin: string;
  domain: number;
  salesRank: number | null;
  amazonPrice: number | null;
  buyBoxPrice: number | null;
  offerCount: number | null;
  priceHistory: Array<{ date: string; price: number }>;
  rankHistory: Array<{ date: string; rank: number }>;
  priceVolatility: number | null;
  priceTrendPercent: number | null;
  isPriceStable: boolean;
  fetchedAt: string;
  isMock: boolean;
}

interface Decision {
  opportunityScore: number;
  decisionAction: string;
  confidenceScore: number;
  riskLevel: string;
  policyStatus: string;
  evidenceCoverage: number;
  assumedAxes: string[];
  signals: Record<string, { score: number; provenance: string; basis: string }>;
  landed: { landedCost: number; estimatedNetProfit: number; roiPercent: number };
  keepaEnriched: boolean;
}

function Sparkline({ data, color = "#818CF8" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const w = 260, h = 48, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.8} points={points} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((_, i) => i % Math.ceil(data.length / 6) === 0 ? null : null)}
    </svg>
  );
}

export function KeepaAnalysisPanel({ defaultStore }: { defaultStore: string }) {
  const [asin, setAsin] = useState("B0DGQX1FS7");
  const [sourcePrice, setSourcePrice] = useState("22.50");
  const [sellingPrice, setSellingPrice] = useState("49.99");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ keepa: KeepaData; summary: { demandLabel: string; competitionLabel: string; stabilityLabel: string }; decision: Decision; fromCache: boolean; cachedUntil: string } | null>(null);

  async function handleAnalyze() {
    const clean = asin.trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(clean)) { setError("ASIN 10 haneli olmalı (örn. B0DGQX1FS7)"); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/keepa/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin: clean,
          domain: 1,
          sourcePrice: Number(sourcePrice) || 20,
          sellingPrice: Number(sellingPrice) || 45,
          sourceDomain: "amazon.com",
          duplicateScore: 12,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Keepa analizi başarısız");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand/20 bg-surface-1 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-caution/15 border border-caution/30 text-caution">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink">Keepa Karar Analizi</h2>
            <p className="text-xs text-ink-muted font-mono-tech">ASIN girin → Keepa BSR, fiyat geçmişi ve BuyBox’ı çekip <span className="text-brand-soft font-bold">Decision Engine 2.0</span> ile BUY/TEST/WAIT/REJECT kararı üretir. <span className="text-ink-faint">Keepa anahtarı yoksa deterministik mock döner (kotayı yakmaz).</span></p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1.2fr_0.7fr_0.7fr_auto] gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input value={asin} onChange={(e) => setAsin(e.target.value.toUpperCase())} placeholder="ASIN — 10 hane (B0...)" maxLength={10} className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-9 pr-3 font-mono-tech text-sm tracking-widest text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none" onKeyDown={(e) => e.key === "Enter" && handleAnalyze()} />
          </div>
          <input value={sourcePrice} onChange={(e) => setSourcePrice(e.target.value)} placeholder="Alış $" className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm tabular text-ink focus:border-brand/50 focus:outline-none" />
          <input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="Satış $" className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm tabular text-ink focus:border-brand/50 focus:outline-none" />
          <button onClick={handleAnalyze} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />} Analiz Et
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-mono-tech">
          <span className="text-ink-faint">Örnek ASIN:</span>
          {["B0DGQX1FS7", "B0CJ5S4QSK", "B07XJ8DF14"].map((a) => (
            <button key={a} onClick={() => setAsin(a)} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-ink-muted hover:border-brand/30 hover:text-brand-soft">{a}</button>
          ))}
          <span className="text-ink-faint ml-2">Store: {defaultStore}</span>
        </div>
      </div>

      {error && (
        <div className="flex gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Keepa header */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-line bg-surface-1 p-4">
              <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">Keepa — Talep</div>
              <div className="mt-1 text-lg font-bold text-ink tabular">{result.keepa.salesRank !== null ? result.keepa.salesRank.toLocaleString("tr-TR") : "—"} <span className="text-xs font-normal text-ink-muted">BSR</span></div>
              <div className="text-xs text-brand-soft">{result.summary.demandLabel}</div>
              <div className="mt-2 text-[11px] font-mono-tech text-ink-faint">AMZ: {result.keepa.amazonPrice !== null ? `$${result.keepa.amazonPrice}` : "—"} • BuyBox: {result.keepa.buyBoxPrice !== null ? `$${result.keepa.buyBoxPrice}` : "—"}</div>
              {result.keepa.isMock && <span className="mt-2 inline-block rounded bg-caution/15 text-caution px-1.5 py-0.5 text-[10px] font-bold">MOCK (KEEPA_API_KEY yok)</span>}
              {result.fromCache && <span className="ml-1 inline-block rounded bg-positive/15 text-positive px-1.5 py-0.5 text-[10px] font-bold">ÖNBELLEK 24s</span>}
            </div>
            <div className="rounded-2xl border border-line bg-surface-1 p-4">
              <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">Rekabet — BuyBox</div>
              <div className="mt-1 text-lg font-bold text-ink tabular">{result.keepa.offerCount ?? "—"} <span className="text-xs font-normal text-ink-muted">satıcı</span></div>
              <div className="text-xs text-info">{result.summary.competitionLabel}</div>
              <div className="mt-2 text-[11px] font-mono-tech text-ink-faint">Stability: {result.keepa.priceVolatility !== null ? `%${(result.keepa.priceVolatility * 100).toFixed(1)} volatilite` : "—"} • {result.summary.stabilityLabel}</div>
            </div>
            <div className="rounded-2xl border border-brand/30 bg-surface-1 p-4">
              <div className="text-[10px] font-mono-tech uppercase tracking-widest text-brand-soft">Karar — Decision Engine 2.0</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`rounded px-2 py-1 text-xs font-bold ${result.decision.decisionAction === "BUY" ? "bg-positive/15 text-positive border border-positive/30" : result.decision.decisionAction === "REJECT" ? "bg-danger/15 text-danger border border-danger/30" : result.decision.decisionAction === "WAIT" ? "bg-caution/15 text-caution border border-caution/30" : "bg-info/15 text-info border border-info/30"}`}>{result.decision.decisionAction}</span>
                <span className="text-xs font-mono-tech text-ink-muted">{result.decision.confidenceScore}% güven • {result.decision.riskLevel} risk</span>
              </div>
              <div className="mt-1 text-xs text-ink-muted">{result.decision.evidenceCoverage}% ölçülen • {result.decision.keepaEnriched ? "Keepa zenginleştirmeli" : "Keepa yok"}</div>
              <div className="mt-1 text-[11px] font-mono-tech text-ink-faint">{result.decision.policyStatus}</div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-mono-tech">
                <span className="text-ink-muted">Landed: ${result.decision.landed.landedCost.toFixed(2)}</span>
                <span className="text-positive">Kâr: ${result.decision.landed.estimatedNetProfit.toFixed(2)}</span>
                <span className="text-caution">ROI: %{result.decision.landed.roiPercent.toFixed(1)}</span>
                <span className="text-ink-faint">Fırsat: {result.decision.opportunityScore}/100</span>
              </div>
            </div>
          </div>

          {/* Sparklines */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface-1 p-4">
              <div className="text-xs font-bold text-ink">Fiyat Geçmişi (Keepa 90 gün)</div>
              <div className="text-[11px] font-mono-tech text-ink-faint">Trend: {result.keepa.priceTrendPercent !== null ? `${result.keepa.priceTrendPercent > 0 ? "↑" : "↓"} ${result.keepa.priceTrendPercent}%` : "—"} • {result.keepa.isPriceStable ? "İstikrarlı" : "Dalgalı"}</div>
              <div className="mt-3 overflow-x-auto">
                <Sparkline data={result.keepa.priceHistory.map((p) => p.price)} color={result.keepa.priceTrendPercent !== null && result.keepa.priceTrendPercent < 0 ? "#34D399" : "#FBBF24"} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-mono-tech text-ink-faint">
                <span>{result.keepa.priceHistory[0]?.date}</span><span>{result.keepa.priceHistory[result.keepa.priceHistory.length - 1]?.date}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-surface-1 p-4">
              <div className="text-xs font-bold text-ink">BSR Geçmişi</div>
              <div className="text-[11px] font-mono-tech text-ink-faint">Düşük BSR = yüksek talep • Son: {result.keepa.salesRank?.toLocaleString("tr-TR") ?? "—"}</div>
              <div className="mt-3 overflow-x-auto">
                <Sparkline data={result.keepa.rankHistory.map((r) => r.rank)} color="#38BDF8" />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-mono-tech text-ink-faint">
                <span>{result.keepa.rankHistory[0]?.date}</span><span>{result.keepa.rankHistory[result.keepa.rankHistory.length - 1]?.date}</span>
              </div>
            </div>
          </div>

          {/* Signals */}
          <div className="rounded-2xl border border-line bg-surface-1 p-4">
            <div className="text-xs font-bold text-ink flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-positive" /> 6-Eksenli Kanıt Zinciri</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(result.decision.signals).map(([key, s]) => (
                <div key={key} className="rounded-xl border border-line bg-surface-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-ink capitalize">{key}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${s.provenance === "MEASURED" ? "bg-positive/15 text-positive" : s.provenance === "HEURISTIC" ? "bg-caution/15 text-caution" : "bg-surface-3 text-ink-faint"}`}>{s.provenance}</span>
                  </div>
                  <div className="mt-1 text-lg font-bold tabular text-ink">{s.score}<span className="text-xs font-normal text-ink-faint">/100</span></div>
                  <div className="h-1.5 rounded-full bg-surface-3 mt-1 overflow-hidden"><div className={`h-full rounded-full ${s.score >= 80 ? "bg-positive" : s.score >= 60 ? "bg-caution" : "bg-danger"}`} style={{ width: `${s.score}%` }} /></div>
                  <div className="mt-1.5 text-[11px] leading-snug text-ink-muted">{s.basis}</div>
                </div>
              ))}
            </div>
            {result.decision.assumedAxes.length > 0 && (
              <div className="mt-3 rounded-lg bg-caution/10 border border-caution/20 px-3 py-2 text-xs text-caution">
                Varsayıma dayalı eksenler: {result.decision.assumedAxes.join(", ")} — Keepa sonrası hâlâ {result.decision.assumedAxes.length} eksen ASSUMED (faz 2&apos;de supplierOffers trendi ile MEASURED olacak).
              </div>
            )}
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-line bg-surface-1/50 p-10 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-ink-faint" />
          <p className="mt-2 text-sm font-medium text-ink-muted">ASIN girip analiz edin</p>
          <p className="mx-auto mt-1 max-w-md text-xs font-mono-tech text-ink-faint">Keepa BSR, fiyat istikrarı ve rekabet skorlarıyla karar motoru size BUY/TEST/WAIT/REJECT önerir. Alış/satış fiyatını değiştirip senaryo deneyin.</p>
        </div>
      )}
    </div>
  );
}
