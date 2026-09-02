"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  TrendingDown,
  AlertOctagon,
  Wallet,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PackageSearch,
  Compass,
} from "lucide-react";
import type { ProductView, ProductSummaryView } from "../types";
import {
  money,
  percent,
  shortDate,
  trendTone,
  compareByUrgency,
  VERDICT_TONE,
  VERDICT_LABEL,
  STAGE_LABEL,
  TONE_CLASS,
  JOURNEY_ORDER,
  journeyIndex,
} from "./productFormat";

/**
 * Aşama 2 — Ürün Portföyü.
 *
 * Sistemin kalbi burası: mağaza değil ÜRÜN merkezli görünüm. Her satır bir
 * ürünün tüm yolculuğunu özetler ve "şimdi ne yapmalıyım" sorusuna cevap verir.
 */

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Boxes;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-4 transition hover:border-line-strong">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono-tech text-[10px] font-bold uppercase tracking-wider text-ink-faint">
          {label}
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TONE_CLASS[tone].chip}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className={`mt-2 font-display text-[22px] font-bold leading-none tabular ${TONE_CLASS[tone].text}`}>
        {value}
      </div>
      <p className="mt-1.5 font-mono-tech text-[10px] leading-tight text-ink-faint">{hint}</p>
    </div>
  );
}

/** Ürünün yolculukta nerede olduğunu gösteren kompakt ilerleme şeridi */
function JourneyBar({ stage }: { stage: string }) {
  const idx = journeyIndex(stage);
  const offJourney = idx === -1;

  if (offJourney) {
    const tone = stage === "PAUSED" ? "caution" : "danger";
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono-tech text-[10px] font-bold ${TONE_CLASS[tone].chip}`}
      >
        {STAGE_LABEL[stage] ?? stage}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5" aria-hidden="true">
        {JOURNEY_ORDER.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 w-3 rounded-full transition ${
              i < idx ? "bg-brand/50" : i === idx ? "bg-brand" : "bg-surface-3"
            }`}
          />
        ))}
      </div>
      <span className="font-mono-tech text-[10px] font-bold text-ink-muted">
        {STAGE_LABEL[stage] ?? stage}
      </span>
    </div>
  );
}

function TrendCell({ product }: { product: ProductView }) {
  const { priceTrend } = product;
  const tone = trendTone(priceTrend.direction, priceTrend.isBuyingOpportunity);
  const Icon =
    priceTrend.direction === "UP"
      ? ArrowUpRight
      : priceTrend.direction === "DOWN"
        ? ArrowDownRight
        : Minus;

  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-sm font-bold tabular text-ink">
        {product.latestPrice !== null ? money(product.latestPrice) : "—"}
      </span>
      <span className={`inline-flex items-center gap-1 font-mono-tech text-[10px] font-bold ${TONE_CLASS[tone].text}`}>
        <Icon className="h-3 w-3 shrink-0" />
        {percent(priceTrend.changePercent)}
        {priceTrend.isBuyingOpportunity && (
          <span className="ml-1 rounded bg-positive/20 px-1 py-px text-[9px] text-positive">
            FIRSAT
          </span>
        )}
      </span>
    </div>
  );
}

const PIPELINE_STAGES = ["DISCOVERED", "ANALYZING", "SCORED", "APPROVED", "REJECTED"] as const;

export function ProductPortfolio({
  products,
  summary,
  loading,
  onSelect,
  onDiscover,
}: {
  products: ProductView[];
  summary: ProductSummaryView | null;
  loading: boolean;
  onSelect: (product: ProductView) => void;
  onDiscover?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (verdictFilter !== "ALL" && p.verdict !== verdictFilter) return false;
        if (stageFilter !== "ALL" && p.lifecycleStage !== stageFilter) return false;
        if (!q) return true;
        return (
          p.asin.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q) ||
          (p.supplierName ?? "").toLowerCase().includes(q)
        );
      })
      .sort(compareByUrgency);
  }, [products, search, verdictFilter, stageFilter]);

  return (
    <div className="space-y-4">
      {/* Portföy özeti */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Katalogdaki Ürün"
            value={String(summary.totalProducts)}
            hint={`${Object.keys(summary.byStage).length} farklı durakta`}
            icon={Boxes}
            tone="info"
          />
          <SummaryCard
            label="Net Kâr / Zarar"
            value={money(summary.totalNetProfit)}
            hint="Sevk edilen adet üzerinden, iadeler düşülmüş"
            icon={Wallet}
            tone={summary.totalNetProfit >= 0 ? "positive" : "danger"}
          />
          <SummaryCard
            label="Zarardaki Ürün"
            value={String(summary.productsAtLoss)}
            hint="Müdahale gerektiren kalem sayısı"
            icon={AlertOctagon}
            tone={summary.productsAtLoss > 0 ? "danger" : "positive"}
          />
          <SummaryCard
            label="Alım Fırsatı"
            value={String(summary.buyingOpportunities)}
            hint="Tedarikçi fiyatı anlamlı biçimde düşen ürün"
            icon={TrendingDown}
            tone={summary.buyingOpportunities > 0 ? "positive" : "neutral"}
          />
        </div>
      )}

      {/* Aşama 3 — keşif hattı */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-1 p-3">
        <span className="px-2 font-mono-tech text-[10px] font-bold uppercase tracking-wider text-ink-faint">
          Keşif hattı
        </span>
        {PIPELINE_STAGES.map((stage) => {
          const n = summary?.byStage?.[stage] ?? 0;
          const active = stageFilter === stage;
          return (
            <button
              key={stage}
              onClick={() => setStageFilter(active ? "ALL" : stage)}
              className={`rounded-lg border px-2.5 py-1 font-mono-tech text-[11px] font-bold transition ${
                active
                  ? "border-brand bg-brand/15 text-brand-soft"
                  : "border-line bg-surface-base text-ink-muted hover:text-ink"
              }`}
            >
              {STAGE_LABEL[stage]} · {n}
            </button>
          );
        })}
        {onDiscover && (
          <button
            onClick={onDiscover}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 font-mono-tech text-[11px] font-bold text-white shadow-lg shadow-brand/20"
          >
            <Compass className="h-3.5 w-3.5" />
            Ürün keşfet
          </button>
        )}
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-1 p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ASIN, ürün adı, marka veya tedarikçi ara…"
            className="w-full rounded-xl border border-line bg-surface-base py-2 pl-9 pr-3 font-mono-tech text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
        </div>

        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface-base px-3 py-2 font-mono-tech text-xs font-bold text-brand-soft focus:border-brand focus:outline-none"
        >
          <option value="ALL">TÜM YARGILAR ({products.length})</option>
          {Object.entries(VERDICT_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label} ({summary?.byVerdict?.[key] ?? 0})
            </option>
          ))}
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface-base px-3 py-2 font-mono-tech text-xs font-bold text-brand-soft focus:border-brand focus:outline-none"
        >
          <option value="ALL">TÜM DURAKLAR</option>
          {Object.entries(STAGE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label} ({summary?.byStage?.[key] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* Ürün tablosu */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-tech text-xs">
            <thead className="border-b border-line bg-surface-base text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="p-3.5">Ürün / ASIN</th>
                <th className="p-3.5">Yolculuk</th>
                <th className="p-3.5">Tedarikçi Fiyatı</th>
                <th className="p-3.5">Operasyon</th>
                <th className="p-3.5">Kâr / ROI</th>
                <th className="p-3.5">Yargı &amp; Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-ink-muted">
                    Ürün kataloğu yükleniyor…
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <PackageSearch className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
                    <p className="font-bold text-ink">Eşleşen ürün yok</p>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      Filtreleri gevşetin ya da arama terimini değiştirin.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((p) => {
                  const tone = VERDICT_TONE[p.verdict] ?? "neutral";
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelect(p)}
                      className="cursor-pointer transition hover:bg-surface-2"
                    >
                      <td className="max-w-[280px] p-3.5">
                        <p className="truncate font-bold text-ink" title={p.title}>
                          {p.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-faint">
                          <span className="text-brand-soft">{p.asin}</span>
                          {p.brand ? ` · ${p.brand}` : ""}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <JourneyBar stage={p.lifecycleStage} />
                        {p.decision && (
                          <span className="mt-1 inline-block font-mono-tech text-[10px] font-bold text-brand-soft">
                            {p.decision.action} · {p.decision.opportunityScore}/100
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <TrendCell product={p} />
                        <p className="mt-0.5 text-[10px] text-ink-faint">
                          {p.offerCount} gözlem
                          {p.supplierName ? ` · ${p.supplierName}` : ""}
                        </p>
                      </td>

                      <td className="p-3.5 text-ink-muted">
                        <p className="text-ink">
                          <span className="font-bold tabular">{p.operations.unitsShipped}</span>
                          {" / "}
                          <span className="tabular">{p.operations.unitsPurchased}</span>
                          <span className="ml-1 text-[10px] text-ink-faint">sevk/alım</span>
                        </p>
                        <p className="mt-0.5 text-[10px]">
                          {p.operations.unitsLost > 0 ? (
                            <span className="text-danger">
                              {p.operations.unitsLost} fire (%
                              {p.pnl.lossRatePercent.toFixed(0)})
                            </span>
                          ) : (
                            <span className="text-ink-faint">fire yok</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-faint">
                          son: {shortDate(p.operations.lastOrderDate)}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <p
                          className={`font-display text-sm font-bold tabular ${
                            p.pnl.netProfit >= 0 ? "text-positive" : "text-danger"
                          }`}
                        >
                          {money(p.pnl.netProfit)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-muted">
                          ROI {percent(p.pnl.roiPercent)}
                        </p>
                      </td>

                      <td className="max-w-[260px] p-3.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-1 text-[10px] font-bold ${TONE_CLASS[tone].chip}`}
                        >
                          {VERDICT_LABEL[p.verdict] ?? p.verdict}
                        </span>
                        <p className="mt-1.5 text-[10px] leading-snug text-ink-muted">
                          {p.recommendedAction}
                        </p>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && visible.length > 0 && (
        <p className="px-1 font-mono-tech text-[10px] text-ink-faint">
          {visible.length} ürün gösteriliyor · aciliyet ve parasal etkiye göre sıralı ·
          satıra tıklayarak ürünün tüm hikâyesini açın
        </p>
      )}
    </div>
  );
}
