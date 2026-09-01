"use client";

import {
  Download,
  FileSpreadsheet,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
  Store,
} from "lucide-react";
import type { SessionUserView, StoreView } from "../types";

export function AppHeader({
  currentUser,
  stores,
  selectedStore,
  onStoreChange,
  storeLocked,
  isAdmin,
  adminActive,
  onOpenAdmin,
  onExportCsv,
  onOpenImport,
  onOpenNewOrder,
  onLogout,
}: {
  currentUser: SessionUserView | null;
  stores: StoreView[];
  selectedStore: string;
  onStoreChange: (code: string) => void;
  storeLocked: boolean;
  isAdmin: boolean;
  adminActive: boolean;
  onOpenAdmin: () => void;
  onExportCsv: () => void;
  onOpenImport: () => void;
  onOpenNewOrder: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0F1626]/95 backdrop-blur-md sticky top-0 z-30 px-5 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-emerald-500 flex items-center justify-center font-display font-bold text-white text-sm shadow-md shadow-indigo-500/20">
          C
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm tracking-wide text-white">
              CERBERUS COMMERCE
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              DECISION-CENTRIC OS
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono-tech hidden sm:block">
            Sabah Brifingi • Karar Motoru • 40-Kolon XLS • PSH Envanter • Depo Sayım
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-[#080C14] border border-slate-700/90 rounded-xl px-3 py-1.5 shadow-sm">
          <Store className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-mono-tech text-slate-400 font-bold hidden sm:inline">
            MAĞAZA:
          </span>

          {storeLocked ? (
            <div className="flex items-center gap-1.5 text-xs font-mono-tech text-emerald-400 font-bold">
              <span>{selectedStore}</span>
              <span className="text-[10px] px-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> İzole
              </span>
            </div>
          ) : (
            <select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="bg-transparent text-xs font-mono-tech text-emerald-400 font-bold focus:outline-none cursor-pointer max-w-[220px]"
            >
              <option value="ALL" className="bg-[#080C14]">
                TÜM MAĞAZALAR (Yönetici)
              </option>
              {stores.map((st) => (
                <option key={st.storeCode} value={st.storeCode} className="bg-[#080C14]">
                  {st.storeCode} — {st.storeName}
                </option>
              ))}
            </select>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono-tech text-xs font-bold uppercase tracking-wider transition border shadow-sm ${
              adminActive
                ? "bg-indigo-600 text-white border-indigo-400 shadow-indigo-600/30"
                : "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Admin Paneli</span>
          </button>
        )}

        <button
          onClick={onExportCsv}
          title="40 kolon formatında CSV indir"
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-mono-tech text-slate-200 border border-slate-700 transition"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          CSV Export
        </button>

        <button
          onClick={onOpenImport}
          className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-mono-tech font-bold transition shadow-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          Excel / Drive Yükle
        </button>

        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-600/25"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Yeni Sipariş</span>
        </button>

        <div className="pl-2 ml-1 border-l border-slate-800 flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block leading-tight">
              {currentUser?.name ?? "Kullanıcı"}
            </span>
            <span className="text-[10px] font-mono-tech text-indigo-400 block">
              {currentUser?.role === "ADMIN"
                ? "SİSTEM ADMİN"
                : `${currentUser?.storeCode ?? ""} YETKİLİ`}
            </span>
          </div>

          <button
            onClick={onLogout}
            title="Güvenli çıkış"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 border border-slate-700 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
