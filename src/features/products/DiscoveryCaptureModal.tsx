"use client";

import { useState } from "react";
import { Compass, X } from "lucide-react";
import { clientLog } from "@/lib/clientLogger";
import type { ResearcherView } from "../types";

/**
 * Aşama 3 — Keşif kaydı.
 *
 * Sipariş modalının keşif karşılığı: ürün henüz satın alınmadı, puanlanır.
 * ASIN, alış ve satış fiyatı zorunludur — sahte kimlik/skor üretilmez.
 */
export function DiscoveryCaptureModal({
  isOpen,
  onClose,
  researchers,
  onCaptured,
}: {
  isOpen: boolean;
  onClose: () => void;
  researchers: ResearcherView[];
  onCaptured: (result: {
    productId: number;
    decision: string;
    lifecycleStage: string;
    duplicate: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [asin, setAsin] = useState("");
  const [brand, setBrand] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePrice, setSourcePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [researcherName, setResearcherName] = useState(researchers[0]?.name ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !asin.trim() || !sourcePrice || !sellingPrice) {
      setError("Başlık, ASIN, alış fiyatı ve satış fiyatı zorunludur.");
      return;
    }
    setSubmitting(true);
    try {
      const selected = researchers.find((r) => r.name === researcherName);
      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          asin: asin.trim().toUpperCase(),
          brand: brand.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          sourcePrice: Number(sourcePrice),
          sellingPrice: Number(sellingPrice),
          supplierName: supplierName.trim() || undefined,
          researcherName: selected
            ? `${selected.name} (${selected.code})`
            : researcherName || undefined,
          researcherCode: selected?.code,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data?.details)
          ? data.details.map((d: { message: string }) => d.message).join(" · ")
          : data?.error;
        throw new Error(detail || "Keşif kaydı alınamadı");
      }
      onCaptured({
        productId: data.productId,
        decision: data.decision,
        lifecycleStage: data.lifecycleStage,
        duplicate: Boolean(data.duplicate),
      });
      setTitle("");
      setAsin("");
      setBrand("");
      setSourceUrl("");
      setSourcePrice("");
      setSellingPrice("");
      setSupplierName("");
      setNotes("");
      onClose();
    } catch (err) {
      clientLog.error("discovery/capture", "Keşif kaydı başarısız", { err: String(err) });
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line bg-surface-base px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-brand/30 bg-brand/10 p-2 text-brand-soft">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Ürün Keşfi</h2>
              <p className="font-mono-tech text-xs text-ink-muted">
                Katalogda DISCOVERED olarak doğar, karar motoru puanlar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-3 hover:text-ink"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">
              Ürün başlığı
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Amazon başlığı"
              className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-xs text-ink"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">ASIN</label>
              <input
                required
                value={asin}
                onChange={(e) => setAsin(e.target.value.toUpperCase())}
                placeholder="B0XXXXXXXX"
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 font-mono-tech text-xs text-ink"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">Marka</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-xs text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">
                Alış fiyatı ($)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={sourcePrice}
                onChange={(e) => setSourcePrice(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 font-mono-tech text-xs text-caution"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">
                Amazon satış fiyatı ($)
              </label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 font-mono-tech text-xs text-positive"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">
              Kaynak URL
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.homedepot.com/..."
              className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 font-mono-tech text-xs text-ink"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">
                Tedarikçi
              </label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">
                Araştırmacı
              </label>
              {researchers.length > 0 ? (
                <select
                  value={researcherName}
                  onChange={(e) => setResearcherName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 font-mono-tech text-xs text-ink"
                >
                  {researchers.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={researcherName}
                  onChange={(e) => setResearcherName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-xs text-ink"
                />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono-tech text-[11px] text-ink-muted">Not</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-xs text-ink"
            />
          </div>

          {error && (
            <p className="font-mono-tech text-[11px] text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 font-mono-tech text-xs text-ink-muted hover:text-ink"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand px-5 py-2.5 font-mono-tech text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand/20 disabled:opacity-50"
            >
              {submitting ? "Puanlanıyor…" : "Keşfi kaydet ve puanla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
