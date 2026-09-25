import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="border-b border-line bg-surface-1/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/login" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand via-info to-positive">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            <span className="font-display text-sm font-bold text-ink">CERBERUS</span>
          </Link>
          <nav className="flex gap-4 font-mono-tech text-[11px] text-ink-muted">
            <Link href="/yasal/aydinlatma" className="transition hover:text-ink">
              Aydınlatma Metni
            </Link>
            <Link href="/yasal/cerez" className="transition hover:text-ink">
              Çerez Bildirimi
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}
