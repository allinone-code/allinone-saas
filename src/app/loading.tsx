import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-base">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-brand-soft" />
        <p className="font-mono-tech text-[11px] text-ink-faint">Yükleniyor…</p>
      </div>
    </div>
  );
}
