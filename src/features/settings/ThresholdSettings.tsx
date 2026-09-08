"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, KeyRound, ShieldCheck, Loader2, Check, AlertTriangle, Eye, EyeOff } from "lucide-react";

export function ThresholdSettings() {
  const [rejectRoi, setRejectRoi] = useState(25);
  const [testRoi, setTestRoi] = useState(38);
  const [keepaKey, setKeepaKey] = useState("");
  const [keepaMeta, setKeepaMeta] = useState<{ hasEnvKey: boolean; hasDbKey: boolean; effectiveHasKey: boolean } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setRejectRoi(j.thresholds?.rejectRoi ?? 25);
      setTestRoi(j.thresholds?.testRoi ?? 38);
      setKeepaMeta(j.keepa || null);
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { rejectRoi, testRoi };
      if (keepaKey.trim()) body.keepaKey = keepaKey.trim();
      // boşsa gönderme — silme için ayrı akış yok; gönderirsek silinmez. Silmek isterse boş bırak + checkbox gerek — basitçe boşsa gönderme
      const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      setMsg({ type: "ok", text: `Eşikler kaydedildi: REJECT < %${rejectRoi}, TEST < %${testRoi}${j.keepaUpdated ? " (Keepa güncellendi)" : ""}` });
      setKeepaKey("");
      await load();
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function clearKeepa() {
    if (!confirm("Keepa anahtarını DB'den silmek istediğinize emin misiniz? Vercel ENV'deki anahtar varsa o kalır.")) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rejectRoi, testRoi, keepaKey: "" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      setMsg({ type: "ok", text: "Keepa anahtarı DB'den silindi." });
      await load();
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 flex items-center gap-2 text-xs font-mono-tech text-ink-muted"><Loader2 className="w-4 h-4 animate-spin"/> Ayarlar yükleniyor…</div>;

  const invalid = rejectRoi >= testRoi;

  return (
    <div className="space-y-4">
      <div className="bg-surface-1 border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-brand-soft"/>
          <h3 className="text-sm font-bold text-ink uppercase font-mono-tech">ROI Karar Eşikleri</h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-brand/15 text-brand-soft border border-brand/30 font-mono-tech">ADMIN/MANAGER</span>
        </div>
        <p className="text-xs text-ink-muted font-mono-tech leading-relaxed">
          Karar motoru ROI&apos;ya göre 3 kademeye ayrılır. Örn. <code className="bg-surface-2 px-1 rounded">REJECT &lt; %25</code> &rarr; <code className="bg-surface-2 px-1 rounded">TEST &lt; %38</code> &rarr; <code className="bg-surface-2 px-1 rounded">BUY</code>.
          Eşikler <code className="bg-surface-2 px-1 rounded">app_settings.roi_thresholds</code>&apos;te saklanır; anında tüm kararlara yansır.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-mono-tech text-ink-muted">REJECT eşiği — altı REJECT <span className="text-danger">● yüksek risk</span></span>
            <div className="flex items-center gap-3">
              <input type="range" min={5} max={50} value={rejectRoi} onChange={e=> setRejectRoi(Number(e.target.value))} className="flex-1 accent-brand"/>
              <input type="number" min={0} max={100} value={rejectRoi} onChange={e=> setRejectRoi(Number(e.target.value))} className="w-20 px-2 py-1.5 rounded-lg bg-surface-base border border-line text-ink text-sm font-mono-tech"/>
              <span className="text-xs font-mono-tech text-ink-muted">%</span>
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-mono-tech text-ink-muted">TEST eşiği — altı TEST, üstü BUY <span className="text-caution">● incele</span></span>
            <div className="flex items-center gap-3">
              <input type="range" min={10} max={80} value={testRoi} onChange={e=> setTestRoi(Number(e.target.value))} className="flex-1 accent-positive"/>
              <input type="number" min={0} max={100} value={testRoi} onChange={e=> setTestRoi(Number(e.target.value))} className="w-20 px-2 py-1.5 rounded-lg bg-surface-base border border-line text-ink text-sm font-mono-tech"/>
              <span className="text-xs font-mono-tech text-ink-muted">%</span>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-tech">
          <span className={`px-2 py-1 rounded-lg border ${rejectRoi < testRoi ? "bg-positive/10 text-positive border-positive/30" : "bg-danger/10 text-danger border-danger/30"}`}>
            {rejectRoi} %  &lt;  {testRoi} % {invalid ? "— GEÇERSİZ (REJECT ≥ TEST)" : "✓"}
          </span>
          <span className="text-ink-muted">REJECT &lt; {rejectRoi}%  •  TEST {rejectRoi}–{testRoi}%  •  BUY ≥ {testRoi}%</span>
        </div>

        {invalid && <p className="text-xs text-danger font-mono-tech flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5"/> REJECT eşiği TEST eşiğinden küçük olmalı.</p>}
      </div>

      <div className="bg-surface-1 border border-line rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-info"/>
          <h3 className="text-sm font-bold text-ink uppercase font-mono-tech">Keepa API Anahtarı</h3>
        </div>
        <p className="text-xs text-ink-muted font-mono-tech leading-relaxed">
          Öncelik: <strong className="text-ink">Vercel Environment Variables → KEEPA_API_KEY</strong> (önerilen). Vercel&apos;de
          <code className="bg-surface-2 px-1 rounded">Settings → Environment Variables → Add</code> &rarr; <code className="bg-surface-2 px-1 rounded">KEEPA_API_KEY=…</code>
          ekleyin, sonra <em>Redeploy</em> yapın. DB&apos;ye anahtar girmek isterseniz aşağıdaki alana yazın — ENV yoksa fallback olarak kullanılır.
          API anahtarını alın: <a href="https://keepa.com/#!api" target="_blank" rel="noreferrer" className="text-brand-soft underline">keepa.com → API</a>.
        </p>

        <div className="flex items-center gap-2 text-xs font-mono-tech">
          <span className={`px-2 py-1 rounded border ${keepaMeta?.hasEnvKey ? "bg-positive/15 text-positive border-positive/30" : "bg-surface-2 text-ink-muted border-line"}`}>ENV: {keepaMeta?.hasEnvKey ? "VAR ✓" : "YOK"}</span>
          <span className={`px-2 py-1 rounded border ${keepaMeta?.hasDbKey ? "bg-positive/15 text-positive border-positive/30" : "bg-surface-2 text-ink-muted border-line"}`}>DB: {keepaMeta?.hasDbKey ? "VAR ✓" : "YOK"}</span>
          <span className={`px-2 py-1 rounded border font-bold ${keepaMeta?.effectiveHasKey ? "bg-brand/15 text-brand-soft border-brand/30" : "bg-caution/15 text-caution border-caution/30"}`}>{keepaMeta?.effectiveHasKey ? "Keepa ETKİN" : "MOCK (anahtar yok — kota harcanmaz)"}</span>
        </div>

        <div className="flex items-stretch gap-2">
          <div className="flex-1 relative">
            <input
              type={showKey ? "text" : "password"}
              value={keepaKey}
              onChange={e=> setKeepaKey(e.target.value)}
              placeholder={keepaMeta?.hasDbKey ? "•••••••• — yeni anahtar yazarsanız üzerine yazılır (boş bırakırsanız değişmez)" : "Keepa API anahtarını yapıştırın (opsiyonel — Vercel ENV önerilir)"}
              className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-surface-base border border-line text-ink text-sm font-mono-tech focus:outline-none focus:border-brand placeholder:text-ink-faint/60"
            />
            <button type="button" onClick={()=> setShowKey(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-surface-2 text-ink-muted">
              {showKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>
        </div>
        {keepaMeta?.hasDbKey && <button onClick={clearKeepa} disabled={saving} className="text-xs font-mono-tech text-danger hover:underline disabled:opacity-40">DB&apos;deki Keepa anahtarını sil (ENV kalır)</button>}
        <p className="text-[11px] font-mono-tech text-ink-faint">Anahtar asla istemciye düz metin olarak geri döndürülmez; yalnız var/yok bilgisi gösterilir. DB değeri <code className="bg-surface-2 px-1 rounded">app_settings.keepa_api_key</code> satırında tutulur.</p>
      </div>

      {msg && <div className={`p-3.5 rounded-xl text-xs font-mono-tech flex items-center gap-2 border ${msg.type==="ok" ? "bg-positive/10 border-positive/30 text-positive" : "bg-danger/10 border-danger/30 text-danger"}`}>
        {msg.type==="ok" ? <Check className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>} {msg.text}
      </div>}

      <div className="flex items-center gap-3 justify-end">
        <button onClick={load} disabled={saving} className="px-4 py-2 rounded-xl bg-surface-2 border border-line text-xs font-mono-tech text-ink-muted hover:text-ink disabled:opacity-40">Yenile</button>
        <button onClick={save} disabled={saving || invalid} className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-soft text-ink text-xs font-mono-tech font-bold uppercase shadow-lg shadow-brand/20 disabled:opacity-40 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <ShieldCheck className="w-4 h-4"/>} Kaydet
        </button>
      </div>
    </div>
  );
}
