"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, PlusCircle, RefreshCw, Wallet } from "lucide-react";

interface MonthlyProfit {
  month: string;
  revenue: number | null;
  cogs: number;
  amazonFees: number;
  prepShipping: number;
  otherExpense: number;
  officeExpense: number;
  netProfit: number | null;
  marginPct: number | null;
  cumulativeNet: number;
  reportedNet: number | null;
  reportedNetDiff: number | null;
  sources: string[];
}
interface ProfitData {
  storeCode: string;
  months: MonthlyProfit[];
  totals: { revenue: number; netProfit: number; marginPct: number | null };
  missingSources: string[];
}

const SOURCE_LABEL: Record<string, string> = {
  AMAZON: "Amazon",
  PSH: "PSH",
  INVENTORY_LAB: "Inventory Lab",
  BANK: "Banka",
};
const CATEGORY_LABEL: Record<string, string> = {
  REVENUE: "Satış geliri",
  COGS: "Satılan mal maliyeti",
  AMAZON_FEES: "Amazon ücretleri",
  PREP_SHIPPING: "PSH hazırlama/gönderim",
  OTHER_EXPENSE: "Diğer gider",
  REPORTED_NET: "Kaynağın raporladığı net (karşılaştırma)",
};

const usd = (v: number | null) =>
  v === null ? "—" : `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function StoreProfitScreen({ storeCode, canEdit }: { storeCode: string; canEdit: boolean }) {
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    storeCode: storeCode === "ALL" ? "" : storeCode,
    month: new Date().toISOString().slice(0, 7),
    source: "AMAZON",
    category: "REVENUE",
    label: "",
    amount: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fetchProfit = useCallback(async (): Promise<ProfitData> => {
    const res = await fetch(`/api/analytics/store-profit?storeCode=${encodeURIComponent(storeCode)}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Karlılık verisi yüklenemedi");
    return j as ProfitData;
  }, [storeCode]);

  // Elle yenileme (buton / kayıt sonrası): durum güncellemeleri olay işleyicisinde.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchProfit());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchProfit]);

  // İlk yükleme / mağaza değişimi: setState yalnız asenkron geri çağrılarda.
  useEffect(() => {
    let alive = true;
    fetchProfit()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fetchProfit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/analytics/store-profit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeCode: form.storeCode,
          entries: [
            {
              month: form.month,
              source: form.source,
              category: form.category,
              label: form.label,
              amount: form.amount,
            },
          ],
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Kaydedilemedi");
      setSaveMsg("Kaydedildi.");
      setForm((f) => ({ ...f, amount: "", label: "" }));
      await load();
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-soft" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {error}
        <button onClick={load} className="ml-auto rounded bg-danger/20 px-3 py-1 text-xs font-bold">
          Tekrar dene
        </button>
      </div>
    );
  }
  if (!data) return null;

  const inputCls = "rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Wallet className="h-4 w-4 text-brand-soft" /> Mağaza Karlılığı
          </h2>
          <p className="text-xs font-mono-tech text-ink-muted">
            Amazon, PSH, Inventory Lab ve banka aylık raporlarından. Ofis gideri satışın %10&apos;u olarak hesaplanır.
          </p>
        </div>
        <button onClick={load} className="rounded-xl border border-line bg-surface-1 p-2 text-ink-muted hover:text-ink">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {data.missingSources.length > 0 && data.months.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-caution/30 bg-caution/10 px-3 py-2 text-xs text-caution">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Bu kâr eksik veriyle hesaplandı. Hiç veri girilmeyen kaynak: {data.missingSources.map((s) => SOURCE_LABEL[s]).join(", ")}.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface-1 p-3">
          <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">Toplam Satış</div>
          <div className="mt-1 text-lg font-bold tabular text-ink">{usd(data.totals.revenue)}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface-1 p-3">
          <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">Net Kâr</div>
          <div className={`mt-1 text-lg font-bold tabular ${data.totals.netProfit >= 0 ? "text-positive" : "text-danger"}`}>
            {usd(data.totals.netProfit)}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface-1 p-3">
          <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">Karlılık</div>
          <div className="mt-1 text-lg font-bold tabular text-ink">
            {data.totals.marginPct === null ? "—" : `%${data.totals.marginPct.toLocaleString("tr-TR")}`}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface-1 p-3">
          <div className="text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">Ay Sayısı</div>
          <div className="mt-1 text-lg font-bold tabular text-ink">{data.months.length}</div>
        </div>
      </div>

      {data.months.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface-1 p-6 text-center text-xs text-ink-muted">
          Henüz aylık finans kalemi girilmemiş.
          {canEdit ? " Aşağıdaki formdan Amazon, PSH, Inventory Lab ve banka kalemlerini ekleyin." : ""}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-[10px] font-mono-tech uppercase tracking-widest text-ink-faint">
                {["Ay", "Satış", "Maliyet", "Amazon", "PSH", "Diğer", "Ofis %10", "Net Kâr", "Karlılık", "Kümülatif", "iLab Net Farkı"].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => (
                <tr key={m.month} className="border-b border-line/50 tabular">
                  <td className="px-3 py-2 font-mono-tech font-bold text-ink">{m.month}</td>
                  <td className="px-3 py-2">{usd(m.revenue)}</td>
                  <td className="px-3 py-2">{usd(m.cogs)}</td>
                  <td className="px-3 py-2">{usd(m.amazonFees)}</td>
                  <td className="px-3 py-2">{usd(m.prepShipping)}</td>
                  <td className="px-3 py-2">{usd(m.otherExpense)}</td>
                  <td className="px-3 py-2">{usd(m.officeExpense)}</td>
                  <td className={`px-3 py-2 font-bold ${m.netProfit === null ? "text-ink-faint" : m.netProfit >= 0 ? "text-positive" : "text-danger"}`}>
                    {usd(m.netProfit)}
                  </td>
                  <td className="px-3 py-2">{m.marginPct === null ? "—" : `%${m.marginPct.toLocaleString("tr-TR")}`}</td>
                  <td className="px-3 py-2">{usd(m.cumulativeNet)}</td>
                  <td className="px-3 py-2 text-ink-muted">{usd(m.reportedNetDiff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-line bg-surface-1 p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold text-ink">
            <PlusCircle className="h-4 w-4 text-brand-soft" /> Aylık kalem ekle
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <input required placeholder="Mağaza (HRN)" value={form.storeCode} onChange={(e) => setForm({ ...form, storeCode: e.target.value.toUpperCase() })} className={inputCls} />
            <input required type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className={inputCls} />
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputCls}>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input placeholder="Kalem adı (isteğe bağlı)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputCls} />
            <input required type="number" step="0.01" placeholder="Tutar ($, pozitif)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
          </div>
          <div className="flex items-center gap-3">
            <button disabled={saving} className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
            {saveMsg && <span className="text-xs text-ink-muted">{saveMsg}</span>}
          </div>
          <p className="text-[11px] text-ink-faint">
            Tutarları pozitif girin; gider sınıfları otomatik çıkarılır. Aynı ay/kaynak/sınıf/kalem tekrar girilirse üzerine yazılır.
          </p>
        </form>
      )}
    </div>
  );
}
