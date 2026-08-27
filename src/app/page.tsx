"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Search,
  Plus,
  FileSpreadsheet,
  PackageCheck,
  Building2,
  AlertTriangle,
  ExternalLink,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Truck,
  CreditCard,
  Mail,
  FileText,
  ShieldCheck,
  LogOut,
  User,
  Settings,
  Lock,
  Sparkles,
} from "lucide-react";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";
import { NewOrderModal } from "@/components/NewOrderModal";
import { GoogleDriveXlsImportModal } from "@/components/GoogleDriveXlsImportModal";
import { PshBatchModal } from "@/components/PshBatchModal";
import { WarehouseReconciliationModal } from "@/components/WarehouseReconciliationModal";
import { AdminDashboard } from "@/components/AdminDashboard";
import { INITIAL_ORDERS, INITIAL_STORES, INITIAL_BATCHES } from "@/lib/mockData";

export default function CerberusApp() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [orders, setOrders] = useState<any[]>(INITIAL_ORDERS);
  const [stores, setStores] = useState<any[]>(INITIAL_STORES);
  const [batches, setBatches] = useState<any[]>(INITIAL_BATCHES);
  const [loading, setLoading] = useState(true);

  // Active Store Isolation State
  const [selectedStore, setSelectedStore] = useState<string>("HRN");

  // Operational Workflow Tab
  const [activeTab, setActiveTab] = useState<
    "XLS_MASTER" | "PSH_BATCHES" | "WAREHOUSE" | "INVENTORY_LAB" | "PROBLEMS" | "ADMIN"
  >("XLS_MASTER");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [cargoFilter, setCargoFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");

  // Modals & Drawers
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isXlsImportOpen, setIsXlsImportOpen] = useState(false);
  const [isPshBatchOpen, setIsPshBatchOpen] = useState(false);
  const [isWarehouseReconOpen, setIsWarehouseReconOpen] = useState(false);

  // 1. Check Authentication on Mount
  useEffect(() => {
    async function verifyUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
            if (data.user.role === "STORE_USER" && data.user.storeCode !== "ALL") {
              setSelectedStore(data.user.storeCode);
            }
          }
        } else {
          // Default demo admin if no session cookie
          setCurrentUser({
            id: 1,
            name: "Ahmet Erdem",
            email: "ahmet@cerberus-commerce.io",
            role: "ADMIN",
            storeCode: "ALL",
            avatar: "AE",
          });
        }
      } catch (err) {
        console.warn("Auth check fallback:", err);
      } finally {
        setCheckingAuth(false);
      }
    }
    verifyUser();
  }, []);

  // 2. Fetch Orders for Selected Store
  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/orders?storeCode=${selectedStore}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.orders) setOrders(json.orders);
        if (json.stores) setStores(json.stores);
        if (json.batches) setBatches(json.batches);
      }
    } catch (err) {
      console.warn("Using local memory dataset:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedStore]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const handleUpdateOrder = async (id: number, updates: any) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
    if (selectedOrder?.id === id) {
      setSelectedOrder((prev: any) => ({ ...prev, ...updates }));
    }

    try {
      await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error("Order update failed:", err);
    }
  };

  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
  const isStoreLocked = !isAdmin && currentUser?.storeCode && currentUser?.storeCode !== "ALL";

  // Filtered Orders for current view
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStore = selectedStore === "ALL" || o.buyerStore === selectedStore;
      const matchCargo = cargoFilter === "ALL" || o.cargoStatus === cargoFilter;
      const matchBatch = batchFilter === "ALL" || o.pshBatchNo === batchFilter;

      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        o.orderNumber?.toLowerCase().includes(q) ||
        o.asin?.toLowerCase().includes(q) ||
        o.msku?.toLowerCase().includes(q) ||
        o.productTitle?.toLowerCase().includes(q) ||
        o.brandName?.toLowerCase().includes(q) ||
        o.supplierName?.toLowerCase().includes(q) ||
        o.orderEmail?.toLowerCase().includes(q);

      return matchStore && matchCargo && matchBatch && matchSearch;
    });
  }, [orders, selectedStore, cargoFilter, batchFilter, searchQuery]);

  // Aggregated KPIs
  const kpis = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalUnits = filteredOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
    const totalSpend = filteredOrders.reduce((s, o) => s + Number(o.totalCost || 0), 0);
    const totalShipped = filteredOrders.reduce((s, o) => s + Number(o.shippedToAmazon || 0), 0);
    const problemCount = filteredOrders.filter(
      (o) =>
        o.cargoStatus === "İPTAL" ||
        Number(o.p1CancelQty) > 0 ||
        Number(o.p2MissingQty) > 0 ||
        Number(o.p3DefectiveQty) > 0 ||
        Number(o.p4ExpiredQty) > 0 ||
        Number(o.refundAmount) > 0
    ).length;
    const totalRefunds = filteredOrders.reduce((s, o) => s + Number(o.refundAmount || 0), 0);

    return {
      totalOrders,
      totalUnits,
      totalSpend: totalSpend.toFixed(2),
      totalShipped,
      problemCount,
      totalRefunds: totalRefunds.toFixed(2),
    };
  }, [filteredOrders]);

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Refined Header */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0F1626]/95 backdrop-blur-md sticky top-0 z-30 px-5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-emerald-500 flex items-center justify-center font-display font-bold text-white text-sm shadow-md shadow-indigo-500/20">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wide text-white">
                CERBERUS
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Çoklu Mağaza İzolasyonu
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-tech hidden sm:block">
              US Sourcing • PSH Envanter • Depo Sayım • Inventory Lab
            </p>
          </div>
        </div>

        {/* Store Switcher & User Profile */}
        <div className="flex items-center gap-3">
          {/* MAĞAZA SEÇİCİ */}
          <div className="flex items-center gap-2 bg-[#0B101E] border border-slate-700/90 rounded-xl px-3 py-1.5 shadow-sm">
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-mono-tech text-slate-400 font-bold">MAĞAZA:</span>

            {isStoreLocked ? (
              <div className="flex items-center gap-1.5 text-xs font-mono-tech text-emerald-400 font-bold">
                <span>{selectedStore} STORE</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Kilitli
                </span>
              </div>
            ) : (
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="bg-transparent text-xs font-mono-tech text-emerald-400 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0B101E]">TÜM MAĞAZALAR (Yönetici Görünümü)</option>
                {stores.map((st) => (
                  <option key={st.storeCode} value={st.storeCode} className="bg-[#0B101E]">
                    {st.storeCode} — {st.storeName.slice(0, 18)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick Action Buttons */}
          <button
            onClick={() => setIsXlsImportOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-mono-tech text-slate-200 border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Drive XLS'den Yapıştır
          </button>

          <button
            onClick={() => setIsNewOrderOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Yeni Sipariş
          </button>

          {/* User Profile & Logout */}
          <div className="pl-2 ml-1 border-l border-slate-800 flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-white block leading-tight">
                {currentUser?.name || "Kullanıcı"}
              </span>
              <span className="text-[10px] font-mono-tech text-indigo-400 block">
                {currentUser?.role === "ADMIN" ? "SİSTEM ADMIN" : `${currentUser?.storeCode} YÖNETİCİ`}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Güvenli Çıkış Yap"
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 border border-slate-700 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Modern Executive Metric Cards Strip */}
      <section className="border-b border-slate-800/80 bg-[#0F1626]/40 px-5 sm:px-6 py-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#121A2C] border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono-tech uppercase text-slate-400 block">
              SİPARİŞ SAYISI ({selectedStore})
            </span>
            <div className="text-xl font-display font-bold text-white mt-1">
              {kpis.totalOrders} Kayıt
            </div>
            <span className="text-[10px] font-mono-tech text-indigo-400">
              The Vitamin Shoppe US
            </span>
          </div>

          <div className="bg-[#121A2C] border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono-tech uppercase text-slate-400 block">
              TOPLAM SİPARİŞ ADEDİ
            </span>
            <div className="text-xl font-display font-bold text-emerald-400 mt-1">
              {kpis.totalUnits} Adet
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              Satın alma hacmi
            </span>
          </div>

          <div className="bg-[#121A2C] border border-indigo-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono-tech uppercase text-indigo-400 block">
              TOPLAM SİPARİŞ MALİYETİ
            </span>
            <div className="text-xl font-display font-bold text-indigo-300 mt-1">
              ${Number(kpis.totalSpend).toLocaleString()}
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              Tedarikçi fatura bedeli
            </span>
          </div>

          <div className="bg-[#121A2C] border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] font-mono-tech uppercase text-slate-400 block">
              AMAZON FBA SEVK
            </span>
            <div className="text-xl font-display font-bold text-white mt-1">
              {kpis.totalShipped} Adet
            </div>
            <span className="text-[10px] font-mono-tech text-emerald-400">
              Depodan çıkan
            </span>
          </div>

          <div className="bg-[#121A2C] border border-amber-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono-tech uppercase text-amber-400 block">
              P1–P4 FİRE / PROBLEM
            </span>
            <div className="text-xl font-display font-bold text-amber-300 mt-1">
              {kpis.problemCount} Sipariş
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              İptal veya eksik teslimat
            </span>
          </div>

          <div className="bg-[#121A2C] border border-rose-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono-tech uppercase text-rose-400 block">
              REFUND İADE GERİ KAZANIM
            </span>
            <div className="text-xl font-display font-bold text-rose-400 mt-1">
              ${Number(kpis.totalRefunds).toLocaleString()}
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              R-kodlu kart iadeleri
            </span>
          </div>
        </div>
      </section>

      {/* Main Navigation Tabs */}
      <div className="px-5 sm:px-6 border-b border-slate-800 bg-[#0F1626] flex items-center justify-between overflow-x-auto">
        <nav className="flex items-center gap-5 sm:gap-6">
          {[
            {
              id: "XLS_MASTER",
              label: "1. Google Drive XLS Siparişleri",
              badge: `${filteredOrders.length} Satır`,
              icon: FileSpreadsheet,
            },
            {
              id: "PSH_BATCHES",
              label: "2. PSH Envanter & Batch",
              badge: `${batches.length} Parti`,
              icon: Building2,
            },
            {
              id: "WAREHOUSE",
              label: "3. Depo Karşılama & Sayım",
              badge: "Order No Eşleştir",
              icon: PackageCheck,
            },
            {
              id: "INVENTORY_LAB",
              label: "4. Inventory Lab & Muhasebe",
              badge: "Maliyet vs Satış",
              icon: TrendingUp,
            },
            {
              id: "PROBLEMS",
              label: "5. P1–P4 Problem & Refund",
              badge: `${kpis.problemCount} Sorun`,
              icon: AlertTriangle,
            },
            ...(isAdmin
              ? [
                  {
                    id: "ADMIN" as const,
                    label: "🛡️ Admin Komuta Merkezi",
                    badge: `${stores.length} Mağaza`,
                    icon: ShieldCheck,
                  },
                ]
              : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 text-xs font-mono-tech uppercase font-bold tracking-wider flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-indigo-500 text-indigo-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    active
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-5 sm:p-6 max-w-[1700px] w-full mx-auto space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: GOOGLE DRIVE XLS MASTER VIEW                                       */}
        {/* ========================================================================= */}
        {activeTab === "XLS_MASTER" && (
          <div className="space-y-4">
            {/* Filter & Toolbar */}
            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Order No (WO...), ASIN, MSKU, Ürün Adı veya Sipariş Maili ara..."
                  className="w-full pl-10 pr-3.5 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-xs font-mono-tech text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={cargoFilter}
                  onChange={(e) => setCargoFilter(e.target.value)}
                  className="bg-[#0B101E] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-tech text-slate-200"
                >
                  <option value="ALL">TÜM KARGO DURUMLARI</option>
                  <option value="Tam Geldi">Tam Geldi</option>
                  <option value="İPTAL">İPTAL</option>
                  <option value="Yolda">Yolda</option>
                  <option value="Kayıp Depoya gelmiş">Kayıp Depoya gelmiş</option>
                </select>

                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="bg-[#0B101E] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-tech text-slate-200"
                >
                  <option value="ALL">TÜM PSH BATCH'LERİ</option>
                  {batches.map((b) => (
                    <option key={b.batchNumber} value={b.batchNumber}>
                      {b.batchNumber}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setIsWarehouseReconOpen(true)}
                  className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-mono-tech font-bold transition flex items-center gap-1.5"
                >
                  <PackageCheck className="w-3.5 h-3.5" /> Depo Sayım Modu
                </button>
              </div>
            </div>

            {/* 40-Column Master Data Table */}
            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[620px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#0B101E] text-[11px] font-mono-tech uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Mağaza / Tarih</th>
                      <th className="py-3 px-3">Order No / Fatura</th>
                      <th className="py-3 px-3">Ürün Adı Amazon</th>
                      <th className="py-3 px-3">ASIN / MSKU</th>
                      <th className="py-3 px-3">Satıcı &amp; Link</th>
                      <th className="py-3 px-3 text-center">Adet</th>
                      <th className="py-3 px-3 text-right">Birim Maliyet</th>
                      <th className="py-3 px-3 text-right">Satış Fiyatı</th>
                      <th className="py-3 px-3 text-right">Toplam Maliyet</th>
                      <th className="py-3 px-3">Kargo Durumu</th>
                      <th className="py-3 px-3 text-center">Amazona Sevk</th>
                      <th className="py-3 px-3">P1-P4 Fire</th>
                      <th className="py-3 px-3">PSH Batch</th>
                      <th className="py-3 px-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono-tech">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-8 text-center text-slate-500 font-mono-tech">
                          Bu mağaza için henüz sipariş kaydı bulunmuyor. Yukarıdaki "Yeni Sipariş Gir" veya "Drive XLS'den Yapıştır" butonuyla sipariş ekleyebilirsiniz.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((item) => {
                        const isCancelled = item.cargoStatus === "İPTAL";
                        const hasMissing = Number(item.p2MissingQty) > 0;
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-[#1A253C]/80 transition group"
                          >
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold block w-fit">
                                {item.buyerStore}
                              </span>
                              <span className="text-[11px] text-slate-400 block mt-1">
                                {item.orderDate}
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="text-white font-bold block">
                                {item.orderNumber}
                              </span>
                              {item.driveLink ? (
                                <a
                                  href={item.driveLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-emerald-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                                >
                                  Drive Fatura <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  Fatura yok
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 max-w-xs font-sans text-xs">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-mono-tech text-[10px] font-bold">
                                  {item.brandName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono-tech">
                                  {item.fulfillmentType}
                                </span>
                              </div>
                              <button
                                onClick={() => setSelectedOrder(item)}
                                className="font-medium text-white hover:text-indigo-400 text-left line-clamp-2 transition"
                              >
                                {item.productTitle}
                              </button>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <a
                                href={item.amazonUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                              >
                                {item.asin} <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <span className="text-[10px] text-slate-400 block truncate max-w-[110px]">
                                {item.msku}
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <a
                                href={item.supplierUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-300 hover:text-amber-400 inline-flex items-center gap-1"
                              >
                                {item.supplierName} <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <span className="text-[10px] text-slate-500 block">
                                Kod: {item.supplierCode}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="text-white font-bold">{item.quantity}</span>
                              <span className="text-[10px] text-slate-500 block">
                                {item.packCount}li paket
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap text-amber-300 font-bold">
                              ${item.unitCost}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap text-emerald-400 font-bold">
                              ${item.sellingPrice}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap text-sky-400 font-bold">
                              ${item.totalCost}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isCancelled
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                    : item.cargoStatus === "Tam Geldi"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {item.cargoStatus}
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[120px]">
                                {item.orderEmail}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center whitespace-nowrap font-bold text-emerald-400">
                              {item.shippedToAmazon} / {item.quantity}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              {isCancelled ? (
                                <span className="text-rose-400 font-bold">P1 İptal: {item.p1CancelQty}</span>
                              ) : hasMissing ? (
                                <span className="text-amber-400 font-bold">P2 Eksik: {item.p2MissingQty}</span>
                              ) : (
                                <span className="text-slate-500">Fire Yok</span>
                              )}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                {item.pshBatchNo || "Atanmadı"}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedOrder(item)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[11px] font-bold transition"
                              >
                                Detay
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PSH BATCH YÖNETİMİ                                                 */}
        {/* ========================================================================= */}
        {activeTab === "PSH_BATCHES" && (
          <div className="space-y-4">
            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-bold text-white">
                  PSH Envanter Programı Ön-Parti (Batch) Yönetimi
                </h2>
                <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                  Ürünler depoya varmadan önce açılan sevkiyat batch'leri ve envanter hazırlığı
                </p>
              </div>
              <button
                onClick={() => setIsPshBatchOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono-tech font-bold uppercase rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" /> Yeni PSH Batch Aç
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batches.map((batch) => {
                const batchOrders = orders.filter((o) => o.pshBatchNo === batch.batchNumber);
                const totalUnits = batchOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
                const shippedUnits = batchOrders.reduce((s, o) => s + Number(o.shippedToAmazon || 0), 0);
                const totalSpend = batchOrders.reduce((s, o) => s + Number(o.totalCost || 0), 0);

                return (
                  <div
                    key={batch.id}
                    className="bg-[#121A2C] border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono-tech text-xs font-bold">
                          {batch.batchNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold ${
                            batch.status === "AMAZONA_GONDERILDI"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </div>

                      <h3 className="text-sm font-display font-bold text-white mb-1.5">
                        {batch.title}
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">{batch.notes}</p>

                      <div className="grid grid-cols-3 gap-2 text-xs font-mono-tech bg-[#0B101E] p-3 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Sipariş Sayısı</span>
                          <span className="text-white font-bold">{batchOrders.length} Sipariş</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Beklenen / Sevk</span>
                          <span className="text-emerald-400 font-bold">{shippedUnits} / {totalUnits} Adet</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Batch Tutarı</span>
                          <span className="text-indigo-400 font-bold">${totalSpend.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono-tech">
                      <span className="text-slate-500">Mağaza: {batch.storeCode}</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {batch.inventoryLabSynced ? "Inventory Lab Eşleşti" : "Inventory Lab Bekliyor"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DEPO KARŞILAMA                                                     */}
        {/* ========================================================================= */}
        {activeTab === "WAREHOUSE" && (
          <div className="space-y-4">
            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-bold text-white">
                  Depo Karşılama, Sayım ve Order No Eşleştirme Modülü
                </h2>
                <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                  Depoya ulaşan kutuları Orderno ile eşleştirip gelen, eksik ve defolu adetleri kaydedin
                </p>
              </div>
              <button
                onClick={() => setIsWarehouseReconOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono-tech font-bold uppercase rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                <PackageCheck className="w-4 h-4" /> Sayım Başlat
              </button>
            </div>

            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#0B101E] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="p-3.5">Order No</th>
                    <th className="p-3.5">Ürün Adı</th>
                    <th className="p-3.5 text-center">Beklenen Sipariş</th>
                    <th className="p-3.5 text-center">Gelen / Amazona Sevk</th>
                    <th className="p-3.5">Fire Durumu</th>
                    <th className="p-3.5">Depo Notu</th>
                    <th className="p-3.5 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-bold text-indigo-400">{o.orderNumber}</td>
                      <td className="p-3.5 font-sans text-white max-w-sm truncate">{o.productTitle}</td>
                      <td className="p-3.5 text-center font-bold text-white">{o.quantity} Adet</td>
                      <td className="p-3.5 text-center font-bold text-emerald-400">{o.shippedToAmazon} Adet</td>
                      <td className="p-3.5">
                        {Number(o.p2MissingQty) > 0 ? (
                          <span className="text-amber-400 font-bold">P2: {o.p2MissingQty} Eksik</span>
                        ) : Number(o.p1CancelQty) > 0 ? (
                          <span className="text-rose-400 font-bold">P1: {o.p1CancelQty} İptal</span>
                        ) : (
                          <span className="text-emerald-400">Tam Teslim</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-400 max-w-xs truncate">
                        {o.description1 || o.auditNote || "Not yok"}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg font-bold"
                        >
                          Sayıma Gir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: INVENTORY LAB MUHASEBE                                             */}
        {/* ========================================================================= */}
        {activeTab === "INVENTORY_LAB" && (
          <div className="space-y-4">
            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl p-5">
              <h2 className="text-base font-display font-bold text-white">
                Inventory Lab &amp; Amazon Satış / Kârlılık Muhasebesi
              </h2>
              <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                PSH'ta hazırlanan batch'lerin Amazon satış fiyatı, maliyet ve tahmini net marj dökümü
              </p>
            </div>

            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#0B101E] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="p-3.5">MSKU / ASIN</th>
                    <th className="p-3.5">Ürün Adı</th>
                    <th className="p-3.5 text-right">Birim Alış ($)</th>
                    <th className="p-3.5 text-right">Amazon Satış ($)</th>
                    <th className="p-3.5 text-right">Brüt Kâr / Adet</th>
                    <th className="p-3.5 text-right">ROI %</th>
                    <th className="p-3.5 text-center">Sevk Adet</th>
                    <th className="p-3.5">Muhasebe Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.map((o) => {
                    const unitCost = Number(o.unitCost) || 1;
                    const selling = Number(o.sellingPrice) || 1;
                    const profitPerUnit = (selling - unitCost).toFixed(2);
                    const roi = ((Number(profitPerUnit) / unitCost) * 100).toFixed(1);

                    return (
                      <tr key={o.id} className="hover:bg-slate-800/40">
                        <td className="p-3.5">
                          <span className="font-bold text-white block">{o.msku}</span>
                          <span className="text-[10px] text-indigo-400">{o.asin}</span>
                        </td>
                        <td className="p-3.5 font-sans text-white max-w-sm truncate">{o.productTitle}</td>
                        <td className="p-3.5 text-right text-amber-300 font-bold">${o.unitCost}</td>
                        <td className="p-3.5 text-right text-emerald-400 font-bold">${o.sellingPrice}</td>
                        <td className="p-3.5 text-right text-sky-400 font-bold">+${profitPerUnit}</td>
                        <td className="p-3.5 text-right font-bold text-emerald-400">%{roi}</td>
                        <td className="p-3.5 text-center text-white">{o.shippedToAmazon}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            {o.inventoryLabStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: P1–P4 FIRE & PROBLEM                                               */}
        {/* ========================================================================= */}
        {activeTab === "PROBLEMS" && (
          <div className="space-y-4">
            <div className="bg-[#121A2C] border border-rose-500/30 rounded-2xl p-5">
              <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                P1–P4 Fire, İptal ve Refund Yönetim Paneli
              </h2>
              <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                P1 (İptal), P2 (Eksik), P3 (Defolu), P4 (Tarihi Geçmiş) adetleri ve R-kodlu iade tutarları
              </p>
            </div>

            <div className="bg-[#121A2C] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#0B101E] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="p-3.5">Order No</th>
                    <th className="p-3.5">Ürün</th>
                    <th className="p-3.5">Problem Türü</th>
                    <th className="p-3.5">Problem Eylemi</th>
                    <th className="p-3.5">Problem Sonucu</th>
                    <th className="p-3.5 text-right">Refund Miktarı</th>
                    <th className="p-3.5 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders
                    .filter(
                      (o) =>
                        o.cargoStatus === "İPTAL" ||
                        Number(o.p1CancelQty) > 0 ||
                        Number(o.p2MissingQty) > 0 ||
                        Number(o.p3DefectiveQty) > 0 ||
                        Number(o.p4ExpiredQty) > 0 ||
                        Number(o.refundAmount) > 0
                    )
                    .map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/40">
                        <td className="p-3.5 text-indigo-400 font-bold">{o.orderNumber}</td>
                        <td className="p-3.5 font-sans text-white max-w-xs truncate">{o.productTitle}</td>
                        <td className="p-3.5">
                          {o.cargoStatus === "İPTAL" ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                              P1: İPTAL ({o.p1CancelQty || o.quantity} Adet)
                            </span>
                          ) : Number(o.p2MissingQty) > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                              P2: EKSİK ({o.p2MissingQty} Adet)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                              Depo Kaybı / Kontrol
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-300 max-w-xs truncate">
                          {o.problemAction || "Eylem bekleniyor"}
                        </td>
                        <td className="p-3.5 text-emerald-400 max-w-xs truncate">
                          {o.problemResult || "İşlem sürüyor"}
                        </td>
                        <td className="p-3.5 text-right text-rose-400 font-bold">
                          ${o.refundAmount}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedOrder(o)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px]"
                          >
                            Çözümle
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: ADMIN KOMUTA MERKEZİ                                               */}
        {/* ========================================================================= */}
        {activeTab === "ADMIN" && isAdmin && (
          <AdminDashboard
            currentUser={currentUser}
            onStoreSelected={(storeCode) => {
              setSelectedStore(storeCode);
              setActiveTab("XLS_MASTER");
            }}
          />
        )}
      </main>

      {/* Slide-Over Drawer: 40-Column Detailed Inspection */}
      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdate={handleUpdateOrder}
        batches={batches}
      />

      {/* Modal: New Order Entry */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onCreated={(newOrder) => {
          setOrders((prev) => [newOrder, ...prev]);
          setSelectedOrder(newOrder);
        }}
        currentStore={selectedStore}
      />

      {/* Modal: Google Drive XLS Paste & Import */}
      <GoogleDriveXlsImportModal
        isOpen={isXlsImportOpen}
        onClose={() => setIsXlsImportOpen(false)}
        onImportSuccess={() => fetchOrders()}
        currentStore={selectedStore}
      />

      {/* Modal: Create PSH Batch */}
      <PshBatchModal
        isOpen={isPshBatchOpen}
        onClose={() => setIsPshBatchOpen(false)}
        onCreated={() => fetchOrders()}
        currentStore={selectedStore}
        unbatchedOrders={orders.filter((o) => !o.pshBatchNo || o.pshBatchNo === "")}
      />

      {/* Modal: Warehouse Reconciliation */}
      <WarehouseReconciliationModal
        isOpen={isWarehouseReconOpen}
        onClose={() => setIsWarehouseReconOpen(false)}
        onSaved={() => fetchOrders()}
        orders={filteredOrders}
      />
    </div>
  );
}
