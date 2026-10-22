"use client";

import { useState } from "react";
import { AlertTriangle, FileSpreadsheet, GitCompareArrows, Loader2 } from "lucide-react";
import type { PshCompareResult, PshFindingCode, WaitingKind } from "@/domain/pshCompare";
import { XRAY_HEADERS } from "@/domain/sat26XrayRead";
import { PSH_HEADERS } from "@/domain/pshRead";
import { pickColumns } from "./sheetColumns";

/** Sunucudan JSON olarak gelen sonuç: Date alanları ISO metin olur. */
type Jsonify<T> = T extends Date ? string : T extends (infer U)[] ? Jsonify<U>[] : T extends object ? { [K in keyof T]: Jsonify<T[K]> } : T;
type Result = Jsonify<PshCompareResult>;

const CODE_LABEL: Record<PshFindingCode, string> = {
  MISSING_DELIVERY: "Eksik teslim",
  DAMAGED: "Hasarlı",
  QTY_DIFF: "Adet farkı",
  CANCEL_CONFLICT: "İptal çelişkisi",
  PRICE_DIFF: "Fiyat farkı",
  MSKU_DIFF: "MSKU farkı",
  NOT_IN_PSH: "PSH'ta yok",
  NOT_IN_PURCHASE: "Alımda yok",
  TYPO_SUSPECT: "Olası yazım hatası",
  DUPLICATE_KEY: "Tekrar eden anahtar",
};
const MUTED_LABEL: Partial<Record<PshFindingCode, string>> = { PRICE_DIFF: "küçük fark", MSKU_DIFF: "önek farkı" };
const SUMMARY_CODES: PshFindingCode[] = ["MISSING_DELIVERY", "DAMAGED", "QTY_DIFF", "PRICE_DIFF", "CANCEL_CONFLICT", "NOT_IN_PSH", "NOT_IN_PURCHASE"];
const WAITING_LABEL: Record<WaitingKind, string> = { INTRANSIT: "Yolda", PARTIAL: "Kısmi teslim", NOT_YET_IN_PSH: "PSH'a henüz girmemiş" };
const SEVERITY_TONE = {
  high: "text-danger border-danger/30 bg-danger/10",
  medium: "text-caution border-caution/30 bg-caution/10",
  low: "text-ink-muted border-line bg-surface-2",
} as const;
const SHOWN = 200;

const n = (v: number) => v.toLocaleString("tr-TR");
const usd = (v: number | null) =>
  v === null ? "—" : `$${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("tr-TR", { timeZone: "UTC" }) : "—");
const rowsText = (a: number[], b: number[]) => [a.length ? `alım ${a.join(", ")}` : "", b.length ? `PSH ${b.join(", ")}` : ""].filter(Boolean).join(" · ");

const inputCls = "rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink";

interface PickedFile { name: string; bytes: Uint8Array; sheets: string[]; sheet: string }

function FilePick({ label, file, preferSheet, onPick, onSheet }: {
  label: string;
  file: PickedFile | null;
  preferSheet?: string;
  onPick: (f: PickedFile | null, error?: string) => void;
  onSheet: (sheet: string) => void;
}) {
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return onPick(null);
    try {
      const XLSX = await import("xlsx");
      const bytes = new Uint8Array(await f.arrayBuffer());
      const wb = XLSX.read(bytes, { type: "array", bookSheets: true });
      onPick({ name: f.name, bytes, sheets: wb.SheetNames, sheet: wb.SheetNames.find((s) => s === preferSheet) ?? wb.SheetNames[0] ?? "" });
    } catch (err: unknown) {
      onPick(null, err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  }
  return (
    <div className="space-y-1">
      <label className="block text-[11px] text-ink-faint">
        {label}
        <input type="file" accept=".xlsx,.xls" onChange={onChange} className={`${inputCls} mt-1 w-full`} />
      </label>
      {file && file.sheets.length > 1 && (
        <label className="block text-[11px] text-ink-faint">
          Sayfa
          <select value={file.sheet} onChange={(e) => onSheet(e.target.value)} className={`${inputCls} ml-2`}>
            {file.sheets.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

async function sheetRows(f: PickedFile): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  // cellDates kapalı: tarihler seri sayısı/metin olarak kalır, saat dilimi kayması olmaz.
  const wb = XLSX.read(f.bytes, { type: "array" });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[f.sheet], { defval: "" });
}

export function PshCompareScreen() {
  const [buy, setBuy] = useState<PickedFile | null>(null);
  const [psh, setPsh] = useState<PickedFile | null>(null);
  const [tolerance, setTolerance] = useState(10);
  const [windowDays, setWindowDays] = useState(14);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState<PshFindingCode | null>(null);

  // Girdi değişince eski sonuç ekranda kalmasın.
  const reset = () => { setResult(null); setError(null); setFilter(null); };

  async function run() {
    if (!buy || !psh) return;
    setRunning(true);
    reset();
    try {
      const [purchaseRows, pshRows] = await Promise.all([sheetRows(buy), sheetRows(psh)]);
      const res = await fetch("/api/reconciliation/psh-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseRows: pickColumns(purchaseRows, XRAY_HEADERS),
          pshRows: pickColumns(pshRows, PSH_HEADERS),
          priceTolerancePct: tolerance,
          pendingWindowDays: windowDays,
        }),
      });
      if (res.status === 413) throw new Error("Dosyalar çok büyük (istek sınırı 2 MB). Satır sayısını azaltın.");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Karşılaştırma başarısız");
      setResult(j as Result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const visible = result ? result.findings.filter((f) => !filter || f.code === filter) : [];
  const counts = new Map<PshFindingCode, number>();
  result?.findings.forEach((f) => counts.set(f.code, (counts.get(f.code) ?? 0) + 1));
  const waitingTotal = result ? (Object.values(result.waiting).reduce((a, w) => a + w.valueUsd, 0)) : 0;

  return (
    <div className="xray-theme space-y-4 rounded-2xl bg-surface-base p-4 text-ink">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <GitCompareArrows className="h-4 w-4 text-brand-soft" /> Alım listesi ↔ PSH karşılaştırması
        </h2>
        <p className="text-xs font-mono-tech text-ink-muted">
          Order + ASIN bazında eksik, hasarlı, yanlış adet ve yanlış fiyatı bulur. Yoldaki ve PSH&apos;a henüz girmemiş satırlar hata sayılmaz, ayrı &quot;Bekleniyor&quot; grubunda görünür. Dosyalar saklanmaz, hiçbir kayıt değişmez.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface-1 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <FilePick label="Alım listesi (.xlsx)" file={buy} preferSheet="Sat26" onSheet={(sheet) => { setBuy((f) => f && { ...f, sheet }); reset(); }}
              onPick={(f, e) => { setBuy(f); reset(); if (e) setError(e); }} />
          </div>
          <div className="md:col-span-1">
            <FilePick label="PSH dosyası (.xlsx)" file={psh} onSheet={(sheet) => { setPsh((f) => f && { ...f, sheet }); reset(); }}
              onPick={(f, e) => { setPsh(f); reset(); if (e) setError(e); }} />
          </div>
          <label className="text-[11px] text-ink-faint">
            Fiyat farkı eşiği (%)
            <input type="number" min={1} max={500} value={tolerance} onChange={(e) => { setTolerance(Math.min(500, Math.max(1, Number(e.target.value) || 10))); reset(); }} className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-[11px] text-ink-faint">
            Bekleme penceresi (gün)
            <input type="number" min={0} max={90} value={windowDays} onChange={(e) => { setWindowDays(Math.min(90, Math.max(0, Number(e.target.value) || 0))); reset(); }} className={`${inputCls} mt-1 w-full`} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={!buy || !psh || running}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-surface-base disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Karşılaştır
          </button>
          <span className="text-xs text-ink-muted">{[buy?.name, psh?.name].filter(Boolean).join(" ↔ ")}</span>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Eşleşen order+ASIN", n(result.cards.matched), `${n(result.cards.purchaseKeys)} alım · ${n(result.cards.pshKeys)} PSH`],
              ["PSH en yeni tarih", day(result.cards.pshNewestDate), `Bekleme sınırı: ${day(result.cards.cutoffDate)}`],
              ...SUMMARY_CODES.map((c): [string, string, string] => [CODE_LABEL[c], n(result.totals[c].count), usd(result.totals[c].impactUsd)]),
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border border-line bg-surface-1 p-3">
                <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">{label}</div>
                <div className="mt-1 text-lg font-bold tabular text-ink">{value}</div>
                <div className="text-[11px] tabular text-ink-muted">{sub}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl border border-line bg-surface-1 p-4">
            <h3 className="text-sm font-bold text-ink">Bakılacaklar</h3>
            {result.findings.length === 0 ? (
              <p className="text-xs text-positive">Hiçbir sorun bulunmadı.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {[...counts.entries()].map(([code, count]) => (
                    <button key={code} onClick={() => setFilter(filter === code ? null : code)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${filter === code ? "border-brand bg-brand/10 text-brand-soft" : "border-line text-ink-muted"}`}>
                      {CODE_LABEL[code]}: {count}
                    </button>
                  ))}
                </div>
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">
                        {["Önem", "Tür", "Order", "ASIN", "Etki", "Açıklama", "Satır"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.slice(0, SHOWN).map((f, i) => (
                        <tr key={`${f.code}-${f.orderNo}-${f.asin}-${i}`} className={`border-b border-line/50 tabular align-top ${f.muted ? "opacity-60" : ""}`}>
                          <td className="px-3 py-1.5">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_TONE[f.severity]}`}>{f.muted ? "Gri" : f.severity === "high" ? "Yüksek" : f.severity === "medium" ? "Orta" : "Düşük"}</span>
                          </td>
                          <td className="px-3 py-1.5 font-bold">{CODE_LABEL[f.code]}{f.muted && MUTED_LABEL[f.code] ? <span className="ml-1 font-normal text-ink-faint">({MUTED_LABEL[f.code]})</span> : null}</td>
                          <td className="px-3 py-1.5 font-mono-tech">{f.orderNo}</td>
                          <td className="px-3 py-1.5 font-mono-tech">{f.asin}</td>
                          <td className="px-3 py-1.5 font-bold">{usd(f.impactUsd)}</td>
                          <td className="px-3 py-1.5 text-ink-muted">{f.message}</td>
                          <td className="px-3 py-1.5 text-ink-faint">{rowsText(f.purchaseRows, f.pshRows)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visible.length > SHOWN && <p className="text-[11px] text-ink-faint">İlk {SHOWN} bulgu gösteriliyor, {visible.length - SHOWN} bulgu daha var.</p>}
              </>
            )}
          </div>

          <details className="rounded-2xl border border-line bg-surface-1" open={result.waitingItems.length > 0 && result.waitingItems.length <= 40}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink">
              Bekleniyor <span className="font-normal text-ink-muted">({n(result.waitingItems.length)} satır · {usd(waitingTotal)}) — hata sayılmaz</span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {(Object.keys(WAITING_LABEL) as WaitingKind[]).map((k) => (
                  <div key={k} className="rounded-xl border border-line bg-surface-2 p-3">
                    <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">{WAITING_LABEL[k]}</div>
                    <div className="mt-1 text-lg font-bold tabular">{n(result.waiting[k].keys)}</div>
                    <div className="text-[11px] tabular text-ink-muted">{n(result.waiting[k].missingQty)} adet · {usd(result.waiting[k].valueUsd)}</div>
                  </div>
                ))}
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line text-left text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">
                      {["Durum", "Order", "ASIN", "Bekleyen adet", "Tutar", "Alım tarihi", "Satır"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.waitingItems.slice(0, SHOWN).map((w, i) => (
                      <tr key={`${w.kind}-${w.orderNo}-${w.asin}-${i}`} className="border-b border-line/50 tabular">
                        <td className="px-3 py-1.5 font-bold">{WAITING_LABEL[w.kind]}</td>
                        <td className="px-3 py-1.5 font-mono-tech">{w.orderNo}</td>
                        <td className="px-3 py-1.5 font-mono-tech">{w.asin}</td>
                        <td className="px-3 py-1.5">{n(w.missingQty)} / {n(w.qty)}</td>
                        <td className="px-3 py-1.5">{usd(w.valueUsd)}</td>
                        <td className="px-3 py-1.5">{day(w.purchaseDate)}</td>
                        <td className="px-3 py-1.5 text-ink-faint">{rowsText(w.purchaseRows, w.pshRows)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.waitingItems.length > SHOWN && <p className="text-[11px] text-ink-faint">İlk {SHOWN} satır gösteriliyor, {result.waitingItems.length - SHOWN} satır daha var.</p>}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
