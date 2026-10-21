"use client";

import { useState } from "react";
import { Sat26AuditPanel } from "./Sat26AuditPanel";
import { AlertTriangle, Download, FileSpreadsheet, GitCompareArrows, Loader2 } from "lucide-react";

type Kind = "AMAZON_RECEIPTS" | "INVENTORY_LAB";
type Status = "OK" | "FAZLA" | "EKSIK" | "SATISTA_YOK" | "DISTA_YOK";

interface Summary { total: number; ok: number; fazla: number; eksik: number; satistaYok: number; distaYok: number }
interface AmazonRow {
  asin: string; title: string; orderCount: number; orderedUnits: number; cancelled: number; missing: number;
  expected: number; received: number | null; diff: number | null; status: Status; totalCost: number;
}
interface LabRow {
  asin: string; title: string; salesUnits: number; salesAvgUnitCost: number | null; salesAvgPrice: number | null;
  ilabCostPerUnit: number | null; costDiff: number | null; ilabOnHand: number | null; ilabUnitsSold: number | null;
  ilabRevenue: number | null; expectedOnHand: number | null; stockDiff: number | null; status: Status;
}
interface Result {
  kind: Kind; salesOrders: number; summary: Summary; rows: (AmazonRow | LabRow)[]; ignoredEventRows?: number;
}

const KIND_META: Record<Kind, { label: string; hint: string }> = {
  AMAZON_RECEIPTS: {
    label: "Amazon kabul",
    hint: "Seller Central → Inventory Receipts raporu (ASIN, Quantity, Event Type)",
  },
  INVENTORY_LAB: {
    label: "Inventory Lab",
    hint: "Inventory Lab ASIN kâr raporu (ASIN, Orders, Units Per Order, Revenue, On Hand, Cost/Unit)",
  },
};

const STATUS_LABEL: Record<Kind, Record<Status, string>> = {
  AMAZON_RECEIPTS: { OK: "Tamam", FAZLA: "Fazla geldi", EKSIK: "Eksik geldi", SATISTA_YOK: "Satışta yok", DISTA_YOK: "Amazon'da yok" },
  INVENTORY_LAB: { OK: "Tamam", FAZLA: "iLab maliyeti yüksek", EKSIK: "iLab maliyeti düşük", SATISTA_YOK: "Satışta yok", DISTA_YOK: "iLab'da yok" },
};
const STATUS_TONE: Record<Status, string> = {
  OK: "text-positive border-positive/30 bg-positive/10",
  FAZLA: "text-caution border-caution/30 bg-caution/10",
  EKSIK: "text-danger border-danger/30 bg-danger/10",
  SATISTA_YOK: "text-danger border-danger/30 bg-danger/10",
  DISTA_YOK: "text-caution border-caution/30 bg-caution/10",
};

const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("tr-TR"));
const usd = (v: number | null) => (v === null ? "—" : `$${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function toCsv(kind: Kind, rows: (AmazonRow | LabRow)[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = Object.keys(rows[0] ?? { asin: "" });
  const lines = rows.map((r) => header.map((h) => esc((r as unknown as Record<string, unknown>)[h])).join(","));
  void kind;
  return `﻿${header.join(",")}\r\n${lines.join("\r\n")}`;
}

export function ReconciliationScreen({ storeCode, canAudit = false }: { storeCode: string; canAudit?: boolean }) {
  const [kind, setKind] = useState<Kind>("AMAZON_RECEIPTS");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [workbookBytes, setWorkbookBytes] = useState<Uint8Array | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(true);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(bytes, { type: "array" });
      setWorkbookBytes(bytes);
      setSheets(wb.SheetNames);
      setSheet(wb.SheetNames[0] ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  }

  async function run() {
    if (!workbookBytes || !sheet) return;
    setRunning(true);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(workbookBytes, { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { defval: "" });
      const res = await fetch("/api/reconciliation/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, storeCode, from: from || undefined, to: to || undefined, rows }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Karşılaştırma başarısız");
      setResult(j as Result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([toCsv(result.kind, result.rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `karsilastirma-${result.kind.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const visible = result ? result.rows.filter((r) => !onlyProblems || r.status !== "OK") : [];
  const inputCls = "rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <GitCompareArrows className="h-4 w-4 text-brand-soft" /> Karşılaştırma
        </h2>
        <p className="text-xs font-mono-tech text-ink-muted">
          Satış listesini (siparişler) aylık dış raporla ASIN bazında karşılaştırır. Yüklenen dosya saklanmaz, hiçbir kayıt değişmez.
        </p>
      </div>

      {canAudit && <Sat26AuditPanel storeCode={storeCode} />}

      <div className="space-y-3 rounded-2xl border border-line bg-surface-1 p-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_META) as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => { setKind(k); setResult(null); }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${kind === k ? "border-brand bg-brand/10 text-brand-soft" : "border-line text-ink-muted"}`}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-faint">{KIND_META[kind].hint}</p>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <label className="text-[11px] text-ink-faint">
            Satış başlangıç (isteğe bağlı)
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-[11px] text-ink-faint">
            Satış bitiş (isteğe bağlı)
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-[11px] text-ink-faint md:col-span-2">
            Rapor dosyası (.xlsx / .csv)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className={`${inputCls} mt-1 w-full`} />
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
            disabled={!workbookBytes || running}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Karşılaştır
          </button>
          {fileName && <span className="text-xs text-ink-muted">{fileName}</span>}
        </div>
        {from === "" && to === "" && (
          <p className="text-[11px] text-ink-faint">
            Tarih seçmezseniz TÜM siparişler karşılaştırılır. Aylık rapor için o ayın satış aralığını seçin; aksi hâlde geçmiş alımlar &quot;eksik&quot; görünür.
          </p>
        )}
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {([
              ["Toplam ASIN", result.summary.total, "text-ink"],
              ["Tamam", result.summary.ok, "text-positive"],
              [kind === "AMAZON_RECEIPTS" ? "Fazla" : "iLab yüksek", result.summary.fazla, "text-caution"],
              [kind === "AMAZON_RECEIPTS" ? "Eksik" : "iLab düşük", result.summary.eksik, "text-danger"],
              ["Satışta yok", result.summary.satistaYok, "text-danger"],
              [kind === "AMAZON_RECEIPTS" ? "Amazon'da yok" : "iLab'da yok", result.summary.distaYok, "text-caution"],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="rounded-2xl border border-line bg-surface-1 p-3">
                <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">{label}</div>
                <div className={`mt-1 text-lg font-bold tabular ${tone}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <span>{result.salesOrders} sipariş satırı karşılaştırıldı.</span>
            {!!result.ignoredEventRows && <span>{result.ignoredEventRows} Receipt-dışı olay satırı yok sayıldı.</span>}
            <label className="ml-auto flex items-center gap-1">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Yalnız sorunlular
            </label>
            <button onClick={download} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 hover:text-ink">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-surface-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-left text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">
                  {(kind === "AMAZON_RECEIPTS"
                    ? ["Durum", "ASIN", "Ürün", "Sipariş", "Adet", "İptal", "Eksik", "Beklenen", "Amazon kabul", "Fark", "Maliyet"]
                    : ["Durum", "ASIN", "Ürün", "Alınan", "Ort. maliyet", "iLab maliyet", "Fark", "Ort. satış", "iLab satılan", "iLab stok", "Beklenen stok", "Stok farkı"]
                  ).map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.asin} className="border-b border-line/50 tabular">
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[kind][r.status]}</span>
                    </td>
                    <td className="px-3 py-2 font-mono-tech">{r.asin}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-ink-muted">{r.title}</td>
                    {kind === "AMAZON_RECEIPTS" ? (() => {
                      const a = r as AmazonRow;
                      return (<>
                        <td className="px-3 py-2">{n(a.orderCount)}</td><td className="px-3 py-2">{n(a.orderedUnits)}</td>
                        <td className="px-3 py-2">{n(a.cancelled)}</td><td className="px-3 py-2">{n(a.missing)}</td>
                        <td className="px-3 py-2">{n(a.expected)}</td><td className="px-3 py-2">{n(a.received)}</td>
                        <td className="px-3 py-2 font-bold">{n(a.diff)}</td><td className="px-3 py-2">{usd(a.totalCost)}</td>
                      </>);
                    })() : (() => {
                      const l = r as LabRow;
                      return (<>
                        <td className="px-3 py-2">{n(l.salesUnits)}</td><td className="px-3 py-2">{usd(l.salesAvgUnitCost)}</td>
                        <td className="px-3 py-2">{usd(l.ilabCostPerUnit)}</td><td className="px-3 py-2 font-bold">{usd(l.costDiff)}</td>
                        <td className="px-3 py-2">{usd(l.salesAvgPrice)}</td><td className="px-3 py-2">{n(l.ilabUnitsSold)}</td>
                        <td className="px-3 py-2">{n(l.ilabOnHand)}</td><td className="px-3 py-2">{n(l.expectedOnHand)}</td>
                        <td className="px-3 py-2 font-bold">{n(l.stockDiff)}</td>
                      </>);
                    })()}
                  </tr>
                ))}
                {!visible.length && (
                  <tr><td colSpan={12} className="px-3 py-6 text-center text-ink-muted">Gösterilecek satır yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {kind === "INVENTORY_LAB" && (
            <p className="text-[11px] text-ink-faint">
              Beklenen stok = net alınan adet − iLab&apos;da satılan + iade. Tarih aralığı dışındaki alımlar stok farkını şişirir.
            </p>
          )}
        </>
      )}
    </div>
  );
}
