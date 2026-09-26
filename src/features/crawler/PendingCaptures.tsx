"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Loader2,
  PackagePlus,
  RefreshCw,
  TrendingDown,
} from "lucide-react";

/**
 * Onay bekleyen yakalamalar.
 *
 * Kullanıcının iş akışı iki aşamalıdır:
 *   1. Eklenti/bookmarklet ürünü yakalar (bu ekran dolmaz — o tarayıcıda)
 *   2. Kullanıcı burada onaylar ve ürün kataloğa girer
 *
 * İkinci adım görünür olmazsa yakalanan ürünler `scraped_products`ta
 * kalıcı olarak birikir ve hiç kullanılmaz. Bu ekran o boşluğu kapatır.
 */

interface PendingItem {
  id: number;
  title: string;
  brand: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  availability: string;
  gtin: string | null;
  sourceSku: string | null;
  asinCandidate: string | null;
  sourceUrl: string;
  sourceDomain: string;
  baselinePrice: number | null;
  firstBelowBaselineAt: string | null;
  discoveredAt: string;
  isBelowBaseline: boolean;
  discountPct: number | null;
}

interface PendingResponse {
  storeScope: string;
  count: number;
  withoutGtin: number;
  discounted: number;
  items: PendingItem[];
}

export function PendingCaptures({ defaultStore }: { defaultStore: string }) {
  const [data, setData] = useState<PendingResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/crawler/pending?storeCode=${encodeURIComponent(defaultStore)}&limit=100`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Liste alınamadı");
      setData(body);
      // GTIN'li olanları varsayılan seç: eşleştirilebilir olanlar önce.
      setSelected(new Set((body.items as PendingItem[]).filter((i) => i.gtin).map((i) => i.id)));
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : String(e), kind: "err" });
    } finally {
      setLoading(false);
    }
  }, [defaultStore]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!selected.size) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/crawler/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrapedIds: Array.from(selected), storeCode: defaultStore }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Aktarım başarısız");
      setMessage({
        text: `✓ ${body.imported} ürün kataloğa eklendi. Keepa analizini Ürün Portföyü'nden elle tetikleyebilirsiniz. ${
          body.warnings?.length ? body.warnings.join(" ") : ""
        }`,
        kind: "ok",
      });
      await load();
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : String(e), kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-surface-1 p-5">
        <div className="flex items-center gap-2 text-xs font-mono-tech text-ink-faint">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yakalamalar yükleniyor…
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-1/50 p-6 text-center">
        <Inbox className="mx-auto h-7 w-7 text-ink-faint" />
        <p className="mt-2 text-sm font-medium text-ink-muted">Onay bekleyen yakalama yok</p>
        <p className="mx-auto mt-1 max-w-md text-xs font-mono-tech text-ink-faint">
          Tarayıcı eklentisiyle bir ürün sayfasında &quot;Bu sayfadaki ürünü
          kaydet&quot;
          dediğinizde burada listelenir.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-brand/30 bg-brand/15 text-brand-soft">
            <PackagePlus className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink">
              Onay bekleyen yakalamalar
              <span className="ml-2 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] font-mono-tech text-ink-muted">
                {data?.count}
              </span>
            </h2>
            <p className="text-[11px] font-mono-tech text-ink-faint">
              {data?.discounted ? (
                <span className="text-positive">🔻 {data.discounted} ürün tepe fiyatının altında</span>
              ) : (
                "Seçip ürün kataloğuna ekleyin"
              )}
              {data?.withoutGtin ? ` · ${data.withoutGtin} üründe GTIN yok` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="rounded-lg border border-line bg-surface-2 p-1.5 text-ink-faint hover:text-ink"
            title="Yenile"
            aria-label="Listeyi yenile"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-xs font-mono-tech text-ink-faint">{selected.size} seçili</span>
          <button
            onClick={() => setSelected(new Set(items.map((i) => i.id)))}
            className="text-xs font-mono-tech text-brand-soft hover:underline"
          >
            Hepsini seç
          </button>
          <span className="text-ink-faint">·</span>
          <button
            onClick={() => setSelected(new Set(items.filter((i) => i.gtin).map((i) => i.id)))}
            className="text-xs font-mono-tech text-brand-soft hover:underline"
            title="Yalnız GTIN&apos;si olanlar - Amazon eşleştirmesi bunlarla yapılabilir"
          >
            GTIN&apos;li olanlar
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs font-mono-tech text-ink-faint hover:text-ink"
          >
            Temizle
          </button>
          <button
            onClick={() => void approve()}
            disabled={!selected.size || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-positive px-3.5 py-1.5 text-xs font-bold text-white hover:bg-positive/90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Kataloğa ekle
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            message.kind === "ok"
              ? "border-positive/30 bg-positive/10 text-positive"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <div
              key={item.id}
              className={`group relative flex gap-3 rounded-xl border p-3 transition ${
                isSelected ? "border-brand/40 bg-brand/5" : "border-line hover:border-line-strong"
              }`}
            >
              <label className="absolute left-3 top-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 rounded border-line bg-surface-2 text-brand focus:ring-brand/30"
                />
              </label>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute right-3 top-3 text-ink-faint hover:text-brand-soft"
                title="Kaynak sayfayı aç"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 pl-5 text-xs font-medium leading-snug text-ink">
                  {item.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold text-caution">
                    {item.brand}
                  </span>
                  {item.availability === "IN_STOCK" && (
                    <span className="rounded bg-positive/15 px-1.5 py-0.5 text-[10px] font-bold text-positive">
                      Stokta
                    </span>
                  )}
                  {item.sourceSku && (
                    <span className="font-mono-tech text-[10px] text-ink-faint">SKU {item.sourceSku}</span>
                  )}
                </div>

                <div className="mt-1.5 flex items-baseline gap-2">
                  {item.price !== null ? (
                    <span className="text-sm font-bold tabular text-caution">
                      ${item.price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">Fiyat yok</span>
                  )}
                  {item.isBelowBaseline && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-positive/15 px-1.5 py-0.5 text-[10px] font-bold text-positive">
                      <TrendingDown className="h-3 w-3" />%{item.discountPct} indirim
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-1 text-[10px] font-mono-tech">
                  <Barcode className="h-3 w-3 shrink-0 text-ink-faint" />
                  {item.gtin ? (
                    <span className="text-ink-muted" title="Amazon'daki karşılığı bu numarayla bulunur">
                      {item.gtin}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-0.5 text-caution"
                      title="GTIN yok - Amazon eşleştirmesi yapılamaz"
                    >
                      <AlertTriangle className="h-3 w-3" /> GTIN yok
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
