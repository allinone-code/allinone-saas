"use client";

import { useState } from "react";
import { Download, ShieldAlert, UserX } from "lucide-react";

/**
 * KVKK m.11 Veri Sahibi Talebi (DSR) aracı — yalnız ADMIN.
 * GET /api/admin/dsr?email= → JSON dışa aktarımı indirir.
 * POST /api/admin/dsr { email, confirm: "ANONYMIZE" } → geri alınamaz anonimleştirme.
 */
export function DsrPanel() {
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function validEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  async function handleExport() {
    if (!validEmail(email)) {
      setMsg({ type: "err", text: "Geçerli bir e-posta girin." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/dsr?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Dışa aktarım başarısız.");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsr-export-${email.trim().replace(/[@.]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: "ok", text: "DSR dışa aktarımı indirildi." });
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleAnonymize() {
    if (!validEmail(email)) {
      setMsg({ type: "err", text: "Geçerli bir e-posta girin." });
      return;
    }
    if (confirm !== "ANONYMIZE") {
      setMsg({ type: "err", text: "Onay için kutuya ANONYMIZE yazın." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/dsr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), confirm: "ANONYMIZE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Anonimleştirme başarısız.");
      setMsg({ type: "ok", text: data.message || "Kullanıcı anonimleştirildi." });
      setConfirm("");
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface-1 border border-line rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-caution" />
        <h3 className="text-sm font-bold text-ink uppercase font-mono-tech">
          KVKK Veri Sahibi Talepleri (DSR)
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded bg-danger/15 text-danger border border-danger/30 font-mono-tech">
          ADMIN
        </span>
      </div>
      <p className="text-xs text-ink-muted font-mono-tech leading-relaxed">
        İlgili kişinin verilerini JSON olarak dışa aktarın veya hesabını geri alınamaz
        şekilde anonimleştirin. ADMIN hesapları anonimleştirilemez. Akış:{" "}
        <code className="bg-surface-2 px-1 rounded">docs/compliance/dsr-akisi.md</code>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-xs font-mono-tech text-ink-muted">İlgili kişi e-postası</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kullanici@ornek.com"
            className="w-full px-3 py-2.5 rounded-xl bg-surface-base border border-line text-ink text-sm focus:outline-none focus:border-brand"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-mono-tech text-ink-muted">
            Anonimleştirme onayı (<code className="text-danger">ANONYMIZE</code> yazın)
          </span>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="ANONYMIZE"
            className="w-full px-3 py-2.5 rounded-xl bg-surface-base border border-line text-ink text-sm font-mono-tech tracking-wider focus:outline-none focus:border-danger"
          />
        </label>
      </div>

      {msg && (
        <div
          role={msg.type === "err" ? "alert" : "status"}
          className={`p-3 rounded-xl text-xs font-mono-tech border ${
            msg.type === "ok"
              ? "bg-positive/10 border-positive/30 text-positive"
              : "bg-danger/10 border-danger/30 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-line text-xs font-mono-tech font-bold text-ink hover:border-line-strong disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5 text-info" /> Verileri dışa aktar (JSON)
        </button>
        <button
          onClick={handleAnonymize}
          disabled={busy || confirm !== "ANONYMIZE"}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger/15 border border-danger/40 text-xs font-mono-tech font-bold text-danger hover:bg-danger/25 disabled:opacity-40"
        >
          <UserX className="w-3.5 h-3.5" /> Anonimleştir (geri alınamaz)
        </button>
      </div>
    </div>
  );
}
