"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { clientLog } from "@/lib/clientLogger";

/**
 * Global segment hata sınırı. Render/veri hatasında beyaz ekran yerine
 * toparlanma seçenekleri sunar; detay istemciye sızdırılmaz.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLog.error("app/error-boundary", "Segment hatası yakalandı", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-surface-base p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface-1 p-6 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-danger/15 text-danger">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-bold text-ink">
          Bir şeyler ters gitti
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
          Bu ekran yüklenirken beklenmeyen bir hata oluştu. Tekrar deneyebilir
          veya ana panele dönebilirsiniz.
          {error.digest && (
            <span className="mt-2 block font-mono-tech text-[11px] text-ink-faint">
              Referans: {error.digest}
            </span>
          )}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={reset}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[13px] font-bold text-white transition hover:bg-brand-soft"
          >
            <RefreshCw className="h-4 w-4" /> Tekrar dene
          </button>
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 py-2.5 text-[13px] font-bold text-ink transition hover:border-line-strong"
          >
            <Home className="h-4 w-4" /> Ana panel
          </Link>
        </div>
      </div>
    </div>
  );
}
