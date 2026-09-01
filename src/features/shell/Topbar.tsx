"use client";

import { Download, FileSpreadsheet, Lock, Menu, Plus, RefreshCw, Store } from "lucide-react";
import type { StoreView } from "../types";

export function Topbar({
  title,
  subtitle,
  stores,
  selectedStore,
  onStoreChange,
  storeLocked,
  onOpenMobileNav,
  onExportCsv,
  onOpenImport,
  onOpenNewOrder,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle: string;
  stores: StoreView[];
  selectedStore: string;
  onStoreChange: (code: string) => void;
  storeLocked: boolean;
  onOpenMobileNav: () => void;
  onExportCsv: () => void;
  onOpenImport: () => void;
  onOpenNewOrder: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] items-center gap-3 border-b border-line bg-surface-1/90 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-ink-muted transition hover:bg-surface-2 hover:text-ink lg:hidden"
        aria-label="Menüyü aç"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sayfa başlığı — kullanıcı nerede olduğunu her an bilir */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[15px] font-bold text-ink">{title}</h1>
        <p className="hidden truncate font-mono-tech text-[11px] text-ink-faint sm:block">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Mağaza kapsamı */}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-1.5">
          <Store className="h-3.5 w-3.5 shrink-0 text-brand-soft" />
          {storeLocked ? (
            <span className="flex items-center gap-1.5 font-mono-tech text-[11px] font-bold text-positive">
              {selectedStore}
              <Lock className="h-3 w-3" />
            </span>
          ) : (
            <>
              <label htmlFor="store-scope" className="sr-only">
                Mağaza kapsamı seç
              </label>
              <select
                id="store-scope"
                value={selectedStore}
                onChange={(e) => onStoreChange(e.target.value)}
                className="max-w-[150px] cursor-pointer bg-transparent font-mono-tech text-[11px] font-bold text-ink focus:outline-none"
              >
                <option value="ALL" className="bg-surface-2">
                  Tüm mağazalar
                </option>
                {stores.map((st) => (
                  <option key={st.storeCode} value={st.storeCode} className="bg-surface-2">
                    {st.storeCode} — {st.storeName}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <button
          onClick={onRefresh}
          title="Verileri yenile"
          aria-label="Verileri yenile"
          className="rounded-xl border border-line bg-surface-2 p-2 text-ink-muted transition hover:text-ink"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-brand-soft" : ""}`} />
        </button>

        <button
          onClick={onExportCsv}
          title="40 kolon formatında CSV indir"
          className="hidden items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono-tech text-[11px] font-bold text-ink-muted transition hover:text-ink xl:flex"
        >
          <Download className="h-3.5 w-3.5 text-info" />
          CSV
        </button>

        <button
          onClick={onOpenImport}
          className="hidden items-center gap-1.5 rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 font-mono-tech text-[11px] font-bold text-positive transition hover:bg-positive/20 md:flex"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          İçe aktar
        </button>

        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 font-mono-tech text-[11px] font-bold uppercase tracking-wide text-white shadow-lg shadow-brand/25 transition hover:bg-brand-soft"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Yeni sipariş</span>
        </button>
      </div>
    </header>
  );
}
