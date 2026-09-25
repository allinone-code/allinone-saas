"use client";

import React, { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, X } from "lucide-react";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Oturum açmış kullanıcının kendi parolasını değiştirmesi.
 * PATCH /api/auth/me — mevcut parola doğrulanır, min 12 karakter.
 */
export function ChangePasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEscapeClose(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-sm rounded-2xl border border-line bg-surface-1 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-soft" />
            <h2 id="change-password-title" className="text-sm font-bold text-ink">
              Parolayı değiştir
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-3 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Her açılışta temiz form: key değişimi state'i sıfırlar (effect ile setState yok) */}
        <PasswordForm key="password-form" onClose={onClose} />
      </div>
    </div>
  );
}

function PasswordForm({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 12) {
      setError("Yeni parola en az 12 karakter olmalıdır.");
      return;
    }
    if (newPassword !== repeat) {
      setError("Yeni parolalar birbirini tutmuyor.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Yeni parola mevcut paroladan farklı olmalıdır.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Parola değiştirilemedi.");
        setSaving(false);
        return;
      }
      setDone(true);
      setSaving(false);
    } catch {
      setError("Sunucuya ulaşılamadı.");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-positive/40 bg-positive/10 px-3.5 py-3 text-[12px] text-positive">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Parolanız güncellendi. Güvenlik için diğer cihazlardaki oturumlarınız
            kapatılacaktır.
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-brand py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-soft"
        >
          Kapat
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[12px] text-danger"
        >
          {error}
        </div>
      )}
      <div>
        <label
          htmlFor="cp-current"
          className="mb-1.5 block font-mono-tech text-[11px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Mevcut parola
        </label>
        <input
          id="cp-current"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label
          htmlFor="cp-new"
          className="mb-1.5 block font-mono-tech text-[11px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Yeni parola (en az 12 karakter)
        </label>
        <input
          id="cp-new"
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label
          htmlFor="cp-repeat"
          className="mb-1.5 block font-mono-tech text-[11px] font-bold uppercase tracking-wider text-ink-muted"
        >
          Yeni parola (tekrar)
        </label>
        <input
          id="cp-repeat"
          type="password"
          required
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink focus:border-brand focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-soft disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Kaydediliyor…
          </>
        ) : (
          "Parolayı güncelle"
        )}
      </button>
    </form>
  );
}
