"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

interface Finding {
  orderId: number;
  orderNumber: string;
  asin: string;
  code: "CANCEL_P1_EMPTY" | "MSKU_DIRTY" | "MSKU_UNKNOWN_PATTERN";
  message: string;
}
interface AuditPreview {
  scanned: number;
  counts: { CANCEL_P1_EMPTY: number; MSKU_DIRTY: number; MSKU_UNKNOWN_PATTERN: number };
  overstatedCost: number;
  findings: Finding[];
}
interface ApplyResult {
  cancelFixed: number;
  mskuFixed: number;
  skippedChanged: number;
  overstatedCostRemoved: number;
  unknownPatternForManualReview: number;
}

const usd = (v: number) => `$${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Mevcut siparişlerde İPTAL/P1 ve MSKU hijyen denetimi + onaylı düzeltme. Yalnız ADMIN/MANAGER görür. */
export function Sat26AuditPanel({ storeCode }: { storeCode: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AuditPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);

  async function call(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/operations/sat26-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeCode, apply }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "İşlem başarısız");
      if (apply) {
        setResult(j as ApplyResult);
        setPreview(null);
      } else {
        setPreview(j as AuditPreview);
        setResult(null);
      }
      setConfirming(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const fixable = preview ? preview.counts.CANCEL_P1_EMPTY + preview.counts.MSKU_DIRTY : 0;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-bold text-ink">
            <ShieldCheck className="h-4 w-4 text-brand-soft" /> Sipariş veri denetimi (İPTAL / MSKU)
          </h3>
          <p className="text-[11px] text-ink-faint">
            İPTAL durumlu ama iptal adedi boş siparişleri ve kirli MSKU&apos;ları bulur. Denetim hiçbir şey değiştirmez.
          </p>
        </div>
        <button
          onClick={() => call(false)}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
        >
          {busy && !confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Denetle
        </button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Taranan sipariş" value={String(preview.scanned)} />
            <Stat label="İPTAL, P1 boş" value={String(preview.counts.CANCEL_P1_EMPTY)} tone="text-danger" />
            <Stat label="Fazla gösterilen maliyet" value={usd(preview.overstatedCost)} tone="text-danger" />
            <Stat label="Kirli MSKU" value={String(preview.counts.MSKU_DIRTY)} tone="text-caution" />
          </div>
          {preview.counts.MSKU_UNKNOWN_PATTERN > 0 && (
            <p className="text-[11px] text-caution">
              {preview.counts.MSKU_UNKNOWN_PATTERN} MSKU bilinen kalıplara uymuyor. Bunlara dokunulmaz, elle kontrol edilmeli.
            </p>
          )}
          <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-ink-muted">
            {preview.findings.slice(0, 30).map((f, i) => (
              <li key={i}>
                <span className="font-mono-tech text-ink">{f.orderNumber}</span> · {f.asin} — {f.message}
              </li>
            ))}
          </ul>

          {fixable === 0 ? (
            <p className="flex items-center gap-2 text-xs text-positive">
              <CheckCircle2 className="h-4 w-4" /> Otomatik düzeltilecek kayıt yok.
            </p>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              <span>
                {fixable} kayıt güncellenecek (iptal adedi, düzeltilmiş maliyet, MSKU). İşlem audit kaydına yazılır. Emin misiniz?
              </span>
              <button onClick={() => call(true)} disabled={busy} className="rounded bg-danger px-3 py-1 font-bold text-white disabled:opacity-50">
                {busy ? "Uygulanıyor…" : "Evet, uygula"}
              </button>
              <button onClick={() => setConfirming(false)} disabled={busy} className="rounded border border-danger/40 px-3 py-1">
                Vazgeç
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white">
              Düzeltmeyi uygula ({fixable} kayıt)
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="flex gap-2 rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 text-xs text-positive">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {result.cancelFixed} İPTAL siparişinin iptal adedi tamamlandı, {result.mskuFixed} MSKU temizlendi,{" "}
            {usd(result.overstatedCostRemoved)} fazla gösterilen maliyet düzeltildi.
            {result.skippedChanged > 0 && ` ${result.skippedChanged} kayıt denetimden sonra değiştiği için atlandı.`}
            {result.unknownPatternForManualReview > 0 && ` ${result.unknownPatternForManualReview} kalıp dışı MSKU elle kontrol bekliyor.`}
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular ${tone}`}>{value}</div>
    </div>
  );
}
