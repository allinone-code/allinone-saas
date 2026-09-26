"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

/**
 * Amazon eşleştirme paneli — GTIN → Keepa → ASIN hattının kullanıcı yüzü.
 *
 * İki iş bir arada çünkü ikisi aynı varlığın iki tarafı:
 *   1) ÇÖZÜMLEME — GTIN'i olan, henüz Amazon'a bağlanmamış ürünler için
 *      Keepa'da arama. Yalnız `exact`/`high` güvenli eşleşme otomatik bağlanır.
 *   2) ONAY — Düşük güvenli adaylar burada durur. Kullanıcı gözüyle bakar ve
 *      uygular ya da reddeder.
 *
 * Neden insan onayı şart: YANLIŞ ürüne bağlamak, bağlamamaktan kötüdür.
 * Birincisi sessiz satın alma riski; ikincisi yalnızca "bulamadım" mesajı.
 * Bu yüzden sistem düşük güvenli adayda kendi kararını VERMEZ.
 */

interface Candidate {
  id: number;
  productId: number;
  productTitle: string;
  productAsin: string;
  asin: string;
  title: string | null;
  brand: string | null;
  confidence: "exact" | "high" | "medium" | "low";
  reason: string;
  source: string;
  amazonUrl: string;
  createdAt: string;
}

interface ResolveOutcome {
  productId: number;
  title: string;
  applied: { asin: string; confidence: string; reason: string } | null;
  candidates: Array<{ asin: string; title: string; confidence: string; reason: string; amazonUrl: string }>;
  error: string | null;
  quotaExhausted: boolean;
}

interface UnlinkedProduct {
  id: number;
  title: string;
  brand: string;
  upc: string;
  asin: string;
}

/** Güven düzeyi rozeti. `exact`/`high` otomatik uygulanmış olur. */
function ConfidenceBadge({ confidence }: { confidence: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    exact: { label: "TAM EŞLEŞME", cls: "bg-positive/20 text-positive" },
    high: { label: "YÜKSEK", cls: "bg-positive/20 text-positive" },
    medium: { label: "KISMİ", cls: "bg-caution/20 text-caution" },
    low: { label: "ZAYIF", cls: "bg-danger/20 text-danger" },
  };
  const conf = map[confidence] ?? map.low;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${conf.cls}`}>{conf.label}</span>
  );
}

export function AmazonMatchPanel({ products }: { products: UnlinkedProduct[] }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedProduct[]>(products);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "warn" | "err" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products/resolve-amazon", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setCandidates(data.candidates ?? []);
    } catch {
      // Aday listesi açılamazsa panel çalışmaya devam etsin.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Portföy verisi yenilendiğinde bağlantısız ürün listesini güncelle.
  useEffect(() => {
    setUnlinked(products);
    setSelected(new Set(products.map((p) => p.id)));
  }, [products]);

  async function resolve() {
    if (!selected.size) return;
    setResolving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/products/resolve-amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Çözümleme başarısız");

      const applied = data.appliedCount as number;
      const review = data.needsReviewCount as number;
      const failed = data.failedCount as number;

      const parts: string[] = [];
      if (applied) parts.push(`${applied} ürün Amazon'a bağlandı`);
      if (review) parts.push(`${review} ürün sizin onayınızı bekliyor`);
      if (failed) parts.push(`${failed} ürün eşleştirilemedi`);

      setMessage({
        text: parts.length
          ? parts.join(" · ")
          : "Eşleşme bulunamadı.",
        kind: data.quotaExhausted ? "warn" : applied ? "ok" : "warn",
      });
      if (data.quotaExhausted) {
        setMessage({
          text: "Keepa kotası doldu. Kalan ürünler için biraz sonra tekrar deneyin.",
          kind: "warn",
        });
      }
      // Bağlanan ürünler artık listeden çıkmalı.
      const appliedIds = new Set(
        (data.outcomes as ResolveOutcome[]).filter((o) => o.applied).map((o) => o.productId)
      );
      setUnlinked((prev) => prev.filter((p) => !appliedIds.has(p.id)));
      setSelected(new Set());
      await load();
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : String(e), kind: "err" });
    } finally {
      setResolving(false);
    }
  }

  async function review(candidateId: number, decision: "apply" | "reject") {
    setReviewing(candidateId);
    setMessage(null);
    try {
      const res = await fetch("/api/products/resolve-amazon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İşlem başarısız");
      setMessage({
        text:
          decision === "apply"
            ? `✓ ${data.asin} bağlandı. Ürün artık Amazon'da.`
            : "Aday reddedildi. Ürün bağlantısız kalıyor.",
        kind: "ok",
      });
      const pid = candidates.find((c) => c.id === candidateId)?.productId;
      if (decision === "apply" && pid) {
        setUnlinked((prev) => prev.filter((p) => p.id !== pid));
      }
      await load();
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : String(e), kind: "err" });
    } finally {
      setReviewing(null);
    }
  }

  const hasWork = unlinked.length > 0 || candidates.length > 0;
  if (!hasWork && !loading) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-1/50 p-5">
        <div className="flex items-center gap-2.5">
          <Check className="h-4 w-4 text-positive" />
          <p className="text-sm font-medium text-ink-muted">
            Tüm ürünler Amazon ASIN&apos;ine bağlı — eşleştirme bekleyen yok.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1) ÇÖZÜMLEME — GTIN'i olan, Amazon'a bağlanmamış ürünler */}
      {unlinked.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface-1 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-brand/30 bg-brand/15 text-brand-soft">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink">
                  Amazon eşleştirmesi bekleyen ürünler
                  <span className="ml-2 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] font-mono-tech text-ink-muted">
                    {unlinked.length}
                  </span>
                </h2>
                <p className="text-[11px] font-mono-tech text-ink-faint">
                  GTIN ile Keepa&apos;da aranır. Yalnız tam eşleşme otomatik bağlanır.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-tech text-ink-faint">{selected.size} seçili</span>
              <button
                onClick={() => setSelected(new Set(unlinked.map((p) => p.id)))}
                className="text-xs font-mono-tech text-brand-soft hover:underline"
              >
                Hepsini seç
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs font-mono-tech text-ink-faint hover:text-ink"
              >
                Temizle
              </button>
              <button
                onClick={() => void resolve()}
                disabled={!selected.size || resolving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand/90 disabled:opacity-40"
              >
                {resolving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Keepa&apos;da çözümle
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                message.kind === "ok"
                  ? "border-positive/30 bg-positive/10 text-positive"
                  : message.kind === "warn"
                    ? "border-caution/30 bg-caution/10 text-caution"
                    : "border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {unlinked.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`flex gap-3 rounded-xl border p-3 transition ${
                    isSelected ? "border-brand/40 bg-brand/5" : "border-line"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-line bg-surface-2 text-brand focus:ring-brand/30"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs font-medium leading-snug text-ink">
                      {p.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold text-caution">
                        {p.brand}
                      </span>
                      <span className="font-mono-tech text-[10px] text-ink-faint">GTIN {p.upc}</span>
                    </div>
                    <div className="mt-1 font-mono-tech text-[10px] text-ink-faint">
                      geçici kimlik: {p.asin}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2) ONAY — düşük güvenli adaylar */}
      {candidates.length > 0 && (
        <div className="rounded-2xl border border-caution/30 bg-caution/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-caution/30 bg-caution/15 text-caution">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-ink">
                  Onayınızı bekleyen eşleşmeler
                  <span className="ml-2 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] font-mono-tech text-ink-muted">
                    {candidates.length}
                  </span>
                </h2>
                <p className="text-[11px] font-mono-tech text-ink-faint">
                  Keepa eşleşmesi yeterince güvenli değil. Bağlamadan önce karşılaştırın.
                </p>
              </div>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-lg border border-line bg-surface-2 p-1.5 text-ink-faint hover:text-ink"
              aria-label="Yenile"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {candidates.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-surface-1 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                      Sizin ürününüz
                    </p>
                    <p className="truncate text-xs font-medium text-ink" title={c.productTitle}>
                      {c.productTitle}
                    </p>
                    <p className="mt-0.5 font-mono-tech text-[10px] text-ink-faint">
                      {c.productAsin} (geçici kimlik)
                    </p>

                    <p className="mt-3 text-[10px] uppercase tracking-wider text-ink-faint">
                      Keepa önerisi
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={c.amazonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono-tech text-[10px] font-bold text-brand-soft hover:underline"
                      >
                        {c.asin}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <ConfidenceBadge confidence={c.confidence} />
                    </div>
                    <p className="mt-1 text-xs text-ink" title={c.title ?? undefined}>
                      {c.title ?? "(başlıksız)"}
                    </p>
                    <p className="mt-1.5 rounded-lg border border-line bg-surface-base px-2.5 py-1.5 text-[10px] font-mono-tech leading-relaxed text-ink-muted">
                      {c.reason}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      onClick={() => void review(c.id, "apply")}
                      disabled={reviewing === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-positive px-3 py-1.5 text-[11px] font-bold text-white hover:bg-positive/90 disabled:opacity-40"
                    >
                      {reviewing === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Bağla
                    </button>
                    <button
                      onClick={() => void review(c.id, "reject")}
                      disabled={reviewing === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-ink-muted hover:text-danger disabled:opacity-40"
                    >
                      <X className="h-3 w-3" />
                      Reddet
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
