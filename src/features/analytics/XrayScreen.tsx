"use client";

import { useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, ScanSearch } from "lucide-react";
import type { XrayFinding, XrayFindingCode, XrayGroup, XrayResult, XraySeverity } from "@/domain/sat26Xray";
import { XRAY_HEADERS } from "@/domain/sat26XrayRead";
import { pickColumns } from "./sheetColumns";

const CODE_LABEL: Record<XrayFindingCode, string> = {
  PRICE_OUTLIER: "Fiyat sapması",
  TOTAL_MISMATCH: "Toplam tutmuyor",
  QTY_OVERFLOW: "Adet aşımı",
  DUPLICATE_KEY: "Tekrar eden order+ASIN",
  ASIN_DIRTY: "Bozuk ASIN",
  ASIN_INVALID: "Geçersiz ASIN",
  MSKU_DIRTY: "Kirli MSKU",
  STATUS_EMPTY: "Kargo durumu boş",
  DATE_OUTLIER: "Şüpheli tarih",
  CARD_EMPTY: "Kart boş",
  CARD_RARE: "Tek satırlık kart",
  LABEL_EMPTY: "Tarih2 etiketi boş",
  LABEL_YEAR_MISMATCH: "Tarih2 yılı tutmuyor",
};

const SEVERITY_TONE: Record<XraySeverity, string> = {
  high: "text-danger border-danger/30 bg-danger/10",
  medium: "text-caution border-caution/30 bg-caution/10",
  low: "text-ink-muted border-line bg-surface-2",
};
const SEVERITY_LABEL: Record<XraySeverity, string> = { high: "Yüksek", medium: "Orta", low: "Düşük" };

const SHOWN_FINDINGS = 200;

const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("tr-TR"));
const usd = (v: number | null) =>
  v === null ? "—" : `$${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function GroupTable({ title, groups, keyLabel }: { title: string; groups: XrayGroup[]; keyLabel: string }) {
  return (
    <details className="rounded-2xl border border-line bg-surface-1">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink">
        {title} <span className="font-normal text-ink-muted">({groups.length})</span>
      </summary>
      <div className="max-h-96 overflow-auto px-2 pb-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-left text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">
              {[keyLabel, "Satır", "Adet", "Maliyet", "Ort. birim", "Min", "Maks", "İptal"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-b border-line/50 tabular">
                <td className="px-3 py-1.5 font-mono-tech">{g.key}</td>
                <td className="px-3 py-1.5">{n(g.rows)}</td>
                <td className="px-3 py-1.5">{n(g.units)}</td>
                <td className="px-3 py-1.5">{usd(g.cost)}</td>
                <td className="px-3 py-1.5">{usd(g.avgUnitCost)}</td>
                <td className="px-3 py-1.5">{usd(g.minUnitCost)}</td>
                <td className="px-3 py-1.5">{usd(g.maxUnitCost)}</td>
                <td className="px-3 py-1.5">{g.cancelledRows ? n(g.cancelledRows) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function XrayScreen() {
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pct, setPct] = useState(25);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<XrayResult | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: "array", bookSheets: true });
      setBytes(data);
      setSheets(wb.SheetNames);
      setSheet(wb.SheetNames.find((s) => s === "Sat26") ?? wb.SheetNames[0] ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  }

  async function run() {
    if (!bytes || !sheet) return;
    setRunning(true);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      // cellDates kapalı: tarihler Excel seri sayısı olarak kalır, saat dilimi kayması olmaz.
      const wb = XLSX.read(bytes, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { defval: "" });
      const res = await fetch("/api/reconciliation/xray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: pickColumns(rows, XRAY_HEADERS), priceDeviationPct: pct }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Röntgen başarısız");
      setResult(j as XrayResult);
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const inputCls = "rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink";
  const counts = new Map<XrayFindingCode, { severity: XraySeverity; count: number }>();
  result?.findings.forEach((f) => {
    const c = counts.get(f.code);
    if (c) c.count++;
    else counts.set(f.code, { severity: f.severity, count: 1 });
  });
  const shown: XrayFinding[] = result ? result.findings.slice(0, SHOWN_FINDINGS) : [];
  const c = result?.summary.cards;

  return (
    <div className="xray-theme space-y-4 rounded-2xl bg-surface-base p-4 text-ink">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <ScanSearch className="h-4 w-4 text-brand-soft" /> Alım listesi röntgeni
        </h2>
        <p className="text-xs font-mono-tech text-ink-muted">
          Alım listenizi (Sat26 sayfası) kendi içinde inceler: ASIN, order, MSKU, kart ve ay özetleri ile hata listesi. Dosya saklanmaz, hiçbir kayıt değişmez.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface-1 p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <label className="text-[11px] text-ink-faint md:col-span-3">
            Alım listesi (.xlsx)
            <input type="file" accept=".xlsx,.xls" onChange={onFile} className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-[11px] text-ink-faint">
            Fiyat sapma eşiği (%)
            <input type="number" min={1} max={500} value={pct} onChange={(e) => setPct(Number(e.target.value) || 25)} className={`${inputCls} mt-1 w-full`} />
          </label>
        </div>
        {sheets.length > 1 && (
          <label className="block text-[11px] text-ink-faint">
            Sayfa
            <select value={sheet} onChange={(e) => setSheet(e.target.value)} className={`${inputCls} ml-2`}>
              {sheets.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={!bytes || running}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-surface-base disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Röntgenini çek
          </button>
          {fileName && <span className="text-xs text-ink-muted">{fileName}</span>}
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && c && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {([
              ["Satır", n(c.rows)],
              ["Order", n(c.orders)],
              ["ASIN", n(c.asins)],
              ["MSKU", n(c.mskus)],
              ["Adet", n(c.units)],
              ["Maliyet", usd(c.cost)],
              ["İptal hariç maliyet", usd(c.costExCancelled)],
              ["Ort. birim maliyet", usd(c.avgUnitCost)],
              ["İptal oranı", `%${(c.cancelledRate * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`],
              ["Bulgu", n(result.findings.length)],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-surface-1 p-3">
                <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">{label}</div>
                <div className="mt-1 text-lg font-bold tabular text-ink">{value}</div>
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
                  {[...counts.entries()].map(([code, v]) => (
                    <span key={code} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_TONE[v.severity]}`}>
                      {CODE_LABEL[code]}: {v.count}
                    </span>
                  ))}
                </div>
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">
                        {["Önem", "Tür", "Satır", "Order", "ASIN", "Etki", "Açıklama"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((f, i) => (
                        <tr key={`${f.code}-${f.rowNo}-${i}`} className="border-b border-line/50 tabular align-top">
                          <td className="px-3 py-1.5">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_TONE[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span>
                          </td>
                          <td className="px-3 py-1.5 font-bold">{CODE_LABEL[f.code]}</td>
                          <td className="px-3 py-1.5">{f.rowNo}</td>
                          <td className="px-3 py-1.5 font-mono-tech">{f.orderNo}</td>
                          <td className="px-3 py-1.5 font-mono-tech">{f.asin}</td>
                          <td className="px-3 py-1.5 font-bold">{usd(f.impactUsd)}</td>
                          <td className="px-3 py-1.5 text-ink-muted">{f.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.findings.length > SHOWN_FINDINGS && (
                  <p className="text-[11px] text-ink-faint">İlk {SHOWN_FINDINGS} bulgu gösteriliyor, {result.findings.length - SHOWN_FINDINGS} bulgu daha var.</p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <GroupTable title="ASIN bazlı" groups={result.summary.byAsin} keyLabel="ASIN" />
            <GroupTable title="Order bazlı" groups={result.summary.byOrder} keyLabel="Order" />
            <GroupTable title="MSKU bazlı" groups={result.summary.byMsku} keyLabel="MSKU" />
            <GroupTable title="Kart bazlı" groups={result.summary.byCard} keyLabel="Kart" />
            <GroupTable title="Ay bazlı" groups={result.summary.byMonth} keyLabel="Ay" />
          </div>
        </>
      )}
    </div>
  );
}
