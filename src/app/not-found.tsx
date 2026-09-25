import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-base p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface-1 p-6 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand/15 text-brand-soft">
          <Compass className="h-6 w-6" />
        </div>
        <p className="font-mono-tech text-[11px] font-bold uppercase tracking-widest text-ink-faint">
          404 — Sayfa bulunamadı
        </p>
        <h1 className="mt-2 font-display text-lg font-bold text-ink">
          Aradığınız adres bu panelde yok
        </h1>
        <p className="mt-2 text-[13px] text-ink-muted">
          Bağlantıyı kontrol edin veya ana panele dönerek devam edin.
        </p>
        <Link
          href="/"
          className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-soft"
        >
          <Home className="h-4 w-4" /> Ana panele dön
        </Link>
      </div>
    </div>
  );
}
