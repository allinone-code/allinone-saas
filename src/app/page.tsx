"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Download,
  Activity,
  Server,
  Cpu,
  Sun,
  Users,
  Layers,
} from "lucide-react";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";
import { NewOrderModal } from "@/components/NewOrderModal";
import { GoogleDriveXlsImportModal } from "@/components/GoogleDriveXlsImportModal";
import { PshBatchModal } from "@/components/PshBatchModal";
import { WarehouseReconciliationModal } from "@/components/WarehouseReconciliationModal";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ProductMasterDrawer } from "@/components/ProductMasterDrawer";

export default function CerberusApp() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Core Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [productMasters, setProductMasters] = useState<any[]>([]);
  const [researchers, setResearchers] = useState<any[]>([]);
  const [morningBriefing, setMorningBriefing] = useState<any>({
    businessHealthScore: 89,
    whatChanged: [
      "26 Mağaza Konsolide Ciro: $5,562.88 (+%14.2 artış)",
      "Ortalama Landed-Cost Ayarlı ROI: %41.4 (Hedef >%30.0)",
      "FBA Sevk Oranı: %94.2 (Amazon NJ Prep Merkezi entegre)",
    ],
    whatMatters: [
      "2 kritik depo sayım uyarısı (P2 Eksik Teslimat takipte)",
      "10 ABD Sourcing Uzmanı aktif (4 onaylı Master Ürün Kasası)",
      "Dyson V15 Detect (B09ZVDL7D4) ROI <%25 Policy Engine tarafından otomatik DURDURULDU",
    ],
    whatShouldIDo: [
      "1. DeWalt 20V MAX XR (B0183RLW8A) için 65 adet FBA sevk emrini onayla (%53.2 ROI)",
      "2. Ninja CREAMi (B08QX6L29W) %96 Duplicate Alarmını Selin'in kaydıyla birleştir",
      "3. WO310759607 numaralı siparişin Narvar kargo tazminat dosyasını kontrol et",
    ],
  });

  // Active Store Isolation State
  const [selectedStore, setSelectedStore] = useState<string>("HRN");

  // Operational Workflow Tab
  const [activeTab, setActiveTab] = useState<
    "BRIEFING_DECISION" | "RESEARCHERS" | "XLS_MASTER" | "PSH_BATCHES" | "WAREHOUSE" | "INVENTORY_LAB" | "PROBLEMS" | "ADMIN"
  >("BRIEFING_DECISION");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [cargoFilter, setCargoFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");
  const [decisionFilter, setDecisionFilter] = useState("ALL");

  // Modals & Drawers
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<any | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isXlsImportOpen, setIsXlsImportOpen] = useState(false);
  const [isPshBatchOpen, setIsPshBatchOpen] = useState(false);
  const [isWarehouseReconOpen, setIsWarehouseReconOpen] = useState(false);

  // 1. Check Authentication on Mount & Query Params
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
          // Oturum yoksa/gecersizse login'e yonlendir (sahte admin fallback'i kaldirildi)
          router.push("/login");
        }
      } catch {
        // fallback demo
      } finally {
        setCheckingAuth(false);
      }
    }
    verifyUser();

    // Check for ?tab=admin or other tab parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam) {
        const up = tabParam.toUpperCase();
        if (up === "ADMIN") setActiveTab("ADMIN");
        else if (up === "XLS_MASTER") setActiveTab("XLS_MASTER");
        else if (up === "PSH_BATCHES") setActiveTab("PSH_BATCHES");
        else if (up === "WAREHOUSE") setActiveTab("WAREHOUSE");
        else if (up === "INVENTORY_LAB") setActiveTab("INVENTORY_LAB");
        else if (up === "PROBLEMS") setActiveTab("PROBLEMS");
      }
      const storeParam = params.get("store");
      if (storeParam) setSelectedStore(storeParam);
    }
  }, [router]);

  // 2. Fetch Orders and Intelligence for Selected Store
  const fetchAllData = useCallback(async () => {
    try {
      const [ordersRes, intelRes] = await Promise.all([
        fetch(`/api/orders?storeCode=${selectedStore}`, { cache: "no-store" }),
        fetch(`/api/intelligence`, { cache: "no-store" }),
      ]);
      if (ordersRes.status === 401 || intelRes.status === 401) {
        router.push("/login");
        return;
      }
      setDataError(null);
      if (ordersRes.ok) {
        const json = await ordersRes.json();
        if (json.orders) setOrders(json.orders);
        if (json.stores) setStores(json.stores);
        if (json.batches) setBatches(json.batches);
      }
      if (intelRes.ok) {
        const json = await intelRes.json();
        if (json.productMasters) setProductMasters(json.productMasters);
        if (json.researchers) setResearchers(json.researchers);
        if (json.morningBriefing) setMorningBriefing(json.morningBriefing);
      }
    } catch {
      // Mock veriye SESSIZCE dusmek yok: kullanici gerçek sanabilir (F-15)
      setDataError("Veriler yuklenemedi. Lutfen baglantinizi kontrol edip sayfayi yenileyin.");
    }
  }, [selectedStore, router]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

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

  const handleUpdateMasterDecision = async (
    id: number,
    decisionAction: string,
    sellingPrice?: number
  ) => {
    setProductMasters((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              decisionAction,
              sellingPrice: sellingPrice ? String(sellingPrice) : m.sellingPrice,
            }
          : m
      )
    );
    if (selectedMaster?.id === id) {
      setSelectedMaster((prev: any) => ({ ...prev, decisionAction }));
    }

    try {
      await fetch(`/api/intelligence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionAction, sellingPrice }),
      });
    } catch (err) {
      console.error("Master update failed:", err);
    }
  };

  // Export 40-column Google Drive XLS format to CSV
  const handleExportCsv = () => {
    const headers = [
      "Satın Alan",
      "Tarih",
      "Ürün resmi",
      "FBM/FBA",
      "Ürün adı Amazon",
      "ASIN",
      "MSKU",
      "Satıcı adı",
      "Satıcı kodu",
      "Satıcı link",
      "Amazon link",
      "Orderno",
      "Order'ın drive linki",
      "Kaçlı paket",
      "Ürün adedi",
      "Ürün birim maliyeti",
      "Ürün satış fiyatı",
      "Ürün toplam maliyeti",
      "Mail adresi",
      "Kargo durumu",
      "Amazona gönderilen adet",
      "İptal adet-P1",
      "Eksik adet-P2",
      "Defolu adet-P3",
      "Tarihi geçmiş adet-P4",
      "Problemle ilgili eylem",
      "Problemle ilgili sonuç",
      "Refund miktarı",
      "Kredi Kartı",
      "Fragile",
      "MultiPack",
      "Bundle",
      "CountPerBundle",
      "Condition",
      "Marka adı",
      "Açıklama1",
      "Açıklama2",
      "Denetim için açıklama",
      "Dönem Kodu",
      "Düzeltilmiş maliyet",
    ];

    const rows = filteredOrders.map((o) => [
      o.buyerStore,
      o.orderDate,
      o.imageUrl,
      o.fulfillmentType,
      `"${String(o.productTitle || "").replace(/"/g, '""')}"`,
      o.asin,
      o.msku,
      o.supplierName,
      o.supplierCode,
      o.supplierUrl,
      o.amazonUrl,
      o.orderNumber,
      o.driveLink,
      o.packCount,
      o.quantity,
      o.unitCost,
      o.sellingPrice,
      o.totalCost,
      o.orderEmail,
      o.cargoStatus,
      o.shippedToAmazon,
      o.p1CancelQty,
      o.p2MissingQty,
      o.p3DefectiveQty,
      o.p4ExpiredQty,
      `"${String(o.problemAction || "").replace(/"/g, '""')}"`,
      `"${String(o.problemResult || "").replace(/"/g, '""')}"`,
      o.refundAmount,
      o.creditCard,
      o.isFragile,
      o.isMultiPack,
      o.isBundle,
      o.countPerBundle || "",
      o.condition,
      o.brandName,
      `"${String(o.description1 || "").replace(/"/g, '""')}"`,
      `"${String(o.description2 || "").replace(/"/g, '""')}"`,
      `"${String(o.auditNote || "").replace(/"/g, '""')}"`,
      o.periodCode,
      o.correctedCost,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `CERBERUS_${selectedStore}_40KOLON_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const totalRevenueEst = filteredOrders.reduce(
      (s, o) => s + Number(o.sellingPrice || 0) * Number(o.shippedToAmazon || o.quantity || 0),
      0
    );
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

    const fulfillmentRate = totalUnits > 0 ? Math.round((totalShipped / totalUnits) * 100) : 100;
    const grossNetEst = totalRevenueEst - totalSpend;
    const avgRoi = totalSpend > 0 ? ((grossNetEst / totalSpend) * 100).toFixed(1) : "41.4";

    return {
      totalOrders,
      totalUnits,
      totalSpend: totalSpend.toFixed(2),
      totalShipped,
      totalRevenueEst: totalRevenueEst.toFixed(2),
      grossNetEst: grossNetEst.toFixed(2),
      avgRoi,
      fulfillmentRate,
      problemCount,
      totalRefunds: totalRefunds.toFixed(2),
    };
  }, [filteredOrders]);

  return (
    <div className="min-h-screen bg-[#080C14] bg-tactical-grid text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {dataError && (
        <div className="mx-6 mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {dataError}
        </div>
      )}
      {/* Top Refined Header Strip */}
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                DECISION-CENTRIC OS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-tech hidden sm:block">
              Sabah Brifingi • Karar Motoru • 40-Kolon XLS • PSH Envanter • Depo Sayım
            </p>
          </div>
        </div>

        {/* Store Switcher & Executive Toolbar */}
        <div className="flex items-center gap-2.5">
          {/* MAĞAZA SEÇİCİ */}
          <div className="flex items-center gap-2 bg-[#080C14] border border-slate-700/90 rounded-xl px-3 py-1.5 shadow-sm">
            <Store className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-mono-tech text-slate-400 font-bold">MAĞAZA:</span>

            {isStoreLocked ? (
              <div className="flex items-center gap-1.5 text-xs font-mono-tech text-emerald-400 font-bold">
                <span>{selectedStore} STORE</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> İzole
                </span>
              </div>
            ) : (
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="bg-transparent text-xs font-mono-tech text-emerald-400 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#080C14]">TÜM MAĞAZALAR (Yönetici Görünümü)</option>
                {stores.map((st) => (
                  <option key={st.storeCode} value={st.storeCode} className="bg-[#080C14]">
                    {st.storeCode} — {st.storeName.slice(0, 18)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Admin Komuta Merkezi Quick Link */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab("ADMIN")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono-tech text-xs font-bold uppercase tracking-wider transition border shadow-sm ${
                activeTab === "ADMIN"
                  ? "bg-indigo-600 text-white border-indigo-400 shadow-indigo-600/30"
                  : "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>🛡️ Admin Paneli</span>
            </button>
          )}

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            title="Google Drive 40-Kolon formatında Excel/CSV indir"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-mono-tech text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            CSV Export
          </button>

          {/* Import XLS / Google Drive */}
          <button
            onClick={() => setIsXlsImportOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-mono-tech font-bold transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Excel / Google Drive Yükle
          </button>

          <button
            onClick={() => setIsNewOrderOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-600/25"
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
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 border border-slate-700 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Modern Executive Metric Cards Strip with Deltas & ROI */}
      <section className="border-b border-slate-800/80 bg-[#0F1626]/50 px-5 sm:px-6 py-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#0F1626] border border-slate-800/90 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-tech uppercase text-slate-400 block">
                SİPARİŞ SAYISI ({selectedStore})
              </span>
              <span className="text-[10px] font-mono-tech text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                +14.2%
              </span>
            </div>
            <div className="text-xl font-display font-bold text-white mt-1">
              {kpis.totalOrders} Kayıt
            </div>
            <span className="text-[10px] font-mono-tech text-indigo-400">
              The Vitamin Shoppe US
            </span>
          </div>

          <div className="bg-[#0F1626] border border-slate-800/90 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-tech uppercase text-slate-400 block">
                TOPLAM SİPARİŞ ADEDİ
              </span>
              <span className="text-[10px] font-mono-tech text-sky-400 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded">
                {kpis.fulfillmentRate}% SEVK
              </span>
            </div>
            <div className="text-xl font-display font-bold text-emerald-400 mt-1">
              {kpis.totalUnits} Adet
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              FBA Sevk: {kpis.totalShipped} Adet
            </span>
          </div>

          <div className="bg-[#0F1626] border border-indigo-500/35 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-tech uppercase text-indigo-400 block">
                TOPLAM SİPARİŞ MALİYETİ
              </span>
              <span className="text-[10px] font-mono-tech text-emerald-400 font-bold">
                %{kpis.avgRoi} ROI
              </span>
            </div>
            <div className="text-xl font-display font-bold text-indigo-300 mt-1">
              ${Number(kpis.totalSpend).toLocaleString()}
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              Tedarikçi fatura bedeli
            </span>
          </div>

          <div className="bg-[#0F1626] border border-slate-800/90 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-tech uppercase text-slate-400 block">
                TAHMİNİ AMAZON CİRO
              </span>
              <span className="text-[10px] font-mono-tech text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                NET +${Number(kpis.grossNetEst).toLocaleString()}
              </span>
            </div>
            <div className="text-xl font-display font-bold text-white mt-1">
              ${Number(kpis.totalRevenueEst).toLocaleString()}
            </div>
            <span className="text-[10px] font-mono-tech text-emerald-400">
              Inventory Lab hedef ciro
            </span>
          </div>

          <div className="bg-[#0F1626] border border-amber-500/35 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-tech uppercase text-amber-400 block">
                P1–P4 FİRE / PROBLEM
              </span>
              <span className="text-[10px] font-mono-tech text-amber-300 font-bold">
                AUDIT TAKİP
              </span>
            </div>
            <div className="text-xl font-display font-bold text-amber-300 mt-1">
              {kpis.problemCount} Sipariş
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              İptal veya eksik teslimat
            </span>
          </div>

          <div className="bg-[#0F1626] border border-rose-500/35 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono-tech uppercase text-rose-400 block">
                İŞ SAĞLIĞI SKORU
              </span>
              <span className="text-[10px] font-mono-tech text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                YÜKSEK
              </span>
            </div>
            <div className="text-xl font-display font-bold text-emerald-400 mt-1">
              {morningBriefing.businessHealthScore}/100
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              Morning Briefing SKORU
            </span>
          </div>
        </div>
      </section>

      {/* Main Navigation Tabs */}
      <div className="px-5 sm:px-6 border-b border-slate-800 bg-[#0F1626] flex items-center justify-between overflow-x-auto">
        <nav className="flex items-center gap-5 sm:gap-6">
          {[
            {
              id: "BRIEFING_DECISION",
              label: "🌅 Sabah Brifingi & Karar Kasası (BUY/TEST/WAIT/REJECT)",
              badge: `${productMasters.length} Ürün`,
              icon: Sun,
            },
            {
              id: "RESEARCHERS",
              label: "🧠 10 Kişilik ABD Sourcing Ekibi",
              badge: "10 Uzman",
              icon: Users,
            },
            {
              id: "XLS_MASTER",
              label: "📋 40-Kolon Google Drive XLS Siparişleri",
              badge: `${filteredOrders.length} Satır`,
              icon: FileSpreadsheet,
            },
            {
              id: "PSH_BATCHES",
              label: "📦 PSH Envanter & Batch Partileri",
              badge: `${batches.length} Parti`,
              icon: Building2,
            },
            {
              id: "WAREHOUSE",
              label: "🏭 Depo Karşılama & Sayım",
              badge: "Order No Eşleştir",
              icon: PackageCheck,
            },
            {
              id: "INVENTORY_LAB",
              label: "📈 Inventory Lab & Muhasebe",
              badge: "Maliyet vs Satış",
              icon: TrendingUp,
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
      <main className="flex-1 p-5 sm:p-6 max-w-[1700px] w-full mx-auto space-y-5">
        {/* ========================================================================= */}
        {/* TAB 0: MORNING BRIEFING & DECISION ENGINE VAULT (FAZ 5 & 12 & 34)         */}
        {/* ========================================================================= */}
        {activeTab === "BRIEFING_DECISION" && (
          <div className="space-y-6">
            {/* Executive Morning Briefing Banner (WHAT CHANGED? • WHAT MATTERS? • WHAT SHOULD I DO?) */}
            <div className="bg-gradient-to-r from-[#121A2C] via-[#0F1626] to-[#121A2C] border border-indigo-500/40 rounded-2xl p-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                    <Sun className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono-tech uppercase tracking-wider text-indigo-400 font-bold block">
                      CERBERUS MORNING BRIEFING — EXECUTIVE INTELLIGENCE (GAP FAZ 34 &amp; 36)
                    </span>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Günlük Karar Destek Brifingi &amp; İş Sağlığı Skoru
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono-tech">
                    <span className="text-[10px] text-slate-400 block">BUSINESS HEALTH SCORE</span>
                    <span className="text-2xl font-display font-bold text-emerald-400">
                      {morningBriefing.businessHealthScore} / 100
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 text-xs font-mono-tech">
                <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-indigo-400 font-bold block uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> WHAT CHANGED? (NE DEĞİŞTİ?)
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {morningBriefing.whatChanged.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#080C14] p-4 rounded-xl border border-amber-500/30 space-y-2">
                  <span className="text-amber-400 font-bold block uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> WHAT MATTERS? (KRİTİK RİSKLER)
                  </span>
                  <ul className="space-y-1.5 text-slate-300">
                    {morningBriefing.whatMatters.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5">⚠️</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#080C14] p-4 rounded-xl border border-emerald-500/40 space-y-2">
                  <span className="text-emerald-400 font-bold block uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> WHAT SHOULD I DO? (TAVSİYE EDİLEN AKSİYONLAR)
                  </span>
                  <ul className="space-y-1.5 text-slate-200">
                    {morningBriefing.whatShouldIDo.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold mt-0.5">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Decision Engine Filter Bar */}
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
                  Product Master Karar Kasası (Product ≠ Listing Ayrımı)
                </h3>
                <p className="text-xs text-slate-400 font-mono-tech">
                  Karar Matrisi (`BUY | TEST | WAIT | REJECT`), Veri Tazeliği ve AI Kanıt Zinciri
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={decisionFilter}
                  onChange={(e) => setDecisionFilter(e.target.value)}
                  className="bg-[#080C14] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono-tech text-indigo-300 font-bold"
                >
                  <option value="ALL">TÜM DECISION KARARLARI (4)</option>
                  <option value="BUY">BUY (Satın Al - Yüksek Güven)</option>
                  <option value="TEST">TEST (Test Partisi - Orta Risk)</option>
                  <option value="WAIT">WAIT (Beklet - Çift Kayıt İncele)</option>
                  <option value="REJECT">REJECT (Reddet - Policy İhlali)</option>
                </select>
              </div>
            </div>

            {/* Product Masters Decision Vault Table */}
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                  <tr>
                    <th className="p-3.5">Product Code / Barcodes</th>
                    <th className="p-3.5">Ürün Master &amp; US Kaynak</th>
                    <th className="p-3.5">Veri Tazeliği &amp; Kalite</th>
                    <th className="p-3.5 text-right">Landed Cost</th>
                    <th className="p-3.5 text-right">Amazon Satış</th>
                    <th className="p-3.5 text-right">Tahmini vs Gerçek ROI</th>
                    <th className="p-3.5 text-center">AI Opportunity</th>
                    <th className="p-3.5">Decision Engine</th>
                    <th className="p-3.5 text-right">360° Müfettiş</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {productMasters
                    .filter(
                      (m) => decisionFilter === "ALL" || m.decisionAction === decisionFilter
                    )
                    .map((m) => (
                      <tr key={m.id} className="hover:bg-[#162035]/80 transition">
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-indigo-400 font-bold block">{m.productCode}</span>
                          <span className="text-[10px] text-slate-400 block">ASIN: {m.asin}</span>
                          <span className="text-[10px] text-slate-500 block">UPC: {m.upc}</span>
                        </td>
                        <td className="p-3.5 max-w-sm font-sans">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tech text-[10px] font-bold">
                              {m.brand}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono-tech">
                              {m.researcherName}
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedMaster(m)}
                            className="font-medium text-white hover:text-indigo-400 text-left line-clamp-2 transition"
                          >
                            {m.title}
                          </button>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold block w-fit ${
                              m.dataFreshnessStatus === "FRESH"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {m.dataFreshnessStatus}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            Kalite: {m.dataQualityStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-bold text-amber-300">
                          ${m.landedCost}
                        </td>
                        <td className="p-3.5 text-right font-bold text-white">
                          ${m.sellingPrice}
                        </td>
                        <td className="p-3.5 text-right">
                          <span className="text-emerald-400 font-bold block">
                            %{m.roiPercent} Tahmini
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Gerçek: %{m.actualRoiPercent || m.roiPercent}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-base font-display font-bold text-indigo-300">
                            {m.opportunityScore}/100
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border block text-center ${
                              m.decisionAction === "BUY"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : m.decisionAction === "TEST"
                                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                : m.decisionAction === "WAIT"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}
                          >
                            {m.decisionAction} (Güven: %{m.confidenceScore})
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedMaster(m)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 font-bold transition"
                          >
                            Kanıt &amp; Radar 360°
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
        {/* TAB 1.5: 10-PERSON US SOURCING SPECIALISTS LEADERBOARD (FAZ 33)           */}
        {/* ========================================================================= */}
        {activeTab === "RESEARCHERS" && (
          <div className="space-y-4">
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-bold text-white">
                  10 Kişilik ABD Sourcing Ekibi Zekâsı (Quality-Adjusted Researcher Scorecard)
                </h2>
                <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                  Madde 33: Sadece ürün sayısı değil; Onay Oranı → Satın Alma Dönüşümü → Üretilen Net Kâr ve Fire Oranı ölçümü
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono-tech font-bold">
                10 ABD SOURCING UZMANI AKTİF
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {researchers.map((r) => (
                <div
                  key={r.id}
                  className="bg-[#0F1626] border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono-tech font-bold flex items-center justify-center text-xs">
                          {r.avatar}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{r.name}</span>
                            <span className="text-[10px] font-mono-tech text-slate-400">{r.code}</span>
                          </div>
                          <span className="text-[11px] text-indigo-400 block truncate max-w-[210px]">
                            {r.specialtyDomain}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono-tech">
                        <span className="text-[10px] text-slate-400 block">KALİTE SKORU</span>
                        <span
                          className={`text-xl font-bold ${
                            Number(r.researcherScore) >= 90
                              ? "text-emerald-400"
                              : "text-indigo-300"
                          }`}
                        >
                          {r.researcherScore}/100
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech bg-[#080C14] p-3 rounded-xl border border-slate-800 my-3">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Keşif Hacmi</span>
                        <span className="text-white font-bold">{r.discoveryVolume} Ürün</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Onay Oranı</span>
                        <span className="text-emerald-400 font-bold">%{r.approvalRate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Aylık Net Kâr Katkısı</span>
                        <span className="text-emerald-400 font-bold">+${Number(r.averageNetProfit).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Ortalama ROI</span>
                        <span className="text-indigo-300 font-bold">%{r.averageRoi}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-mono-tech text-slate-400">
                    <span>Aktif FBA Listing: {r.activeListingsCount}</span>
                    <span className="text-amber-400">Fire Oranı: %{r.problemRate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: GOOGLE DRIVE XLS MASTER VIEW                                       */}
        {/* ========================================================================= */}
        {activeTab === "XLS_MASTER" && (
          <div className="space-y-4">
            {/* Filter & Toolbar */}
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Order No (WO...), ASIN, MSKU, Ürün Adı veya Sipariş Maili ara..."
                  className="w-full pl-10 pr-3.5 py-2 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs font-mono-tech text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={cargoFilter}
                  onChange={(e) => setCargoFilter(e.target.value)}
                  className="bg-[#080C14] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono-tech text-slate-200"
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
                  className="bg-[#080C14] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono-tech text-slate-200"
                >
                  <option value="ALL">TÜM PSH BATCH&rsquo;LERİ</option>
                  {batches.map((b) => (
                    <option key={b.batchNumber} value={b.batchNumber}>
                      {b.batchNumber}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 rounded-xl text-xs font-mono-tech font-bold transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV İndir
                </button>

                <button
                  onClick={() => setIsWarehouseReconOpen(true)}
                  className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-mono-tech font-bold transition flex items-center gap-1.5"
                >
                  <PackageCheck className="w-3.5 h-3.5" /> Depo Sayım Modu
                </button>
              </div>
            </div>

            {/* 40-Column Master Data Table */}
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[640px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#080C14] text-[11px] font-mono-tech uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-3.5">Mağaza / Tarih</th>
                      <th className="py-3.5 px-3.5">Order No / Fatura</th>
                      <th className="py-3.5 px-3.5">Ürün Adı Amazon</th>
                      <th className="py-3.5 px-3.5">ASIN / MSKU</th>
                      <th className="py-3.5 px-3.5">Satıcı &amp; Link</th>
                      <th className="py-3.5 px-3.5 text-center">Adet</th>
                      <th className="py-3.5 px-3.5 text-right">Birim Maliyet</th>
                      <th className="py-3.5 px-3.5 text-right">Satış Fiyatı</th>
                      <th className="py-3.5 px-3.5 text-right">Toplam Maliyet</th>
                      <th className="py-3.5 px-3.5">Kargo Durumu</th>
                      <th className="py-3.5 px-3.5 text-center">Amazona Sevk</th>
                      <th className="py-3.5 px-3.5">P1-P4 Fire</th>
                      <th className="py-3.5 px-3.5">PSH Batch</th>
                      <th className="py-3.5 px-3.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono-tech">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-8 text-center text-slate-500 font-mono-tech">
                          Bu mağaza için henüz sipariş kaydı bulunmuyor. Yukarıdaki &quot;Yeni Sipariş Gir&quot; veya &quot;Drive XLS&rsquo;den Yapıştır&quot; butonuyla sipariş ekleyebilirsiniz.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((item) => {
                        const isCancelled = item.cargoStatus === "İPTAL";
                        const hasMissing = Number(item.p2MissingQty) > 0;
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-[#162035]/80 transition group"
                          >
                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold block w-fit">
                                {item.buyerStore}
                              </span>
                              <span className="text-[11px] text-slate-400 block mt-1">
                                {item.orderDate}
                              </span>
                            </td>

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
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

                            <td className="py-3.5 px-3.5 max-w-xs font-sans text-xs">
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

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
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

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
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

                            <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                              <span className="text-white font-bold">{item.quantity}</span>
                              <span className="text-[10px] text-slate-500 block">
                                {item.packCount}li paket
                              </span>
                            </td>

                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-amber-300 font-bold">
                              ${item.unitCost}
                            </td>

                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-emerald-400 font-bold">
                              ${item.sellingPrice}
                            </td>

                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-sky-400 font-bold">
                              ${item.totalCost}
                            </td>

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
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

                            <td className="py-3.5 px-3.5 text-center whitespace-nowrap font-bold text-emerald-400">
                              {item.shippedToAmazon} / {item.quantity}
                            </td>

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              {isCancelled ? (
                                <span className="text-rose-400 font-bold">P1 İptal: {item.p1CancelQty}</span>
                              ) : hasMissing ? (
                                <span className="text-amber-400 font-bold">P2 Eksik: {item.p2MissingQty}</span>
                              ) : (
                                <span className="text-slate-500">Fire Yok</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                {item.pshBatchNo || "Atanmadı"}
                              </span>
                            </td>

                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
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
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-bold text-white">
                  PSH Envanter Programı Ön-Parti (Batch) Yönetimi
                </h2>
                <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                  Ürünler depoya varmadan önce açılan sevkiyat batch&rsquo;leri ve envanter hazırlığı
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
                    className="bg-[#0F1626] border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between transition"
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

                      <div className="grid grid-cols-3 gap-2 text-xs font-mono-tech bg-[#080C14] p-3 rounded-xl border border-slate-800">
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
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
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

            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
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
            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-display font-bold text-white">
                  Inventory Lab &amp; Amazon Satış / Kârlılık Muhasebesi
                </h2>
                <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                  PSH&rsquo;ta hazırlanan batch&rsquo;lerin Amazon satış fiyatı, maliyet ve tahmini net marj dökümü
                </p>
              </div>

              {/* Profitability Executive Ribbon */}
              <div className="flex items-center gap-3 font-mono-tech text-xs">
                <div className="bg-[#080C14] px-3.5 py-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Tahmini Ciro</span>
                  <span className="text-white font-bold">${Number(kpis.totalRevenueEst).toLocaleString()}</span>
                </div>
                <div className="bg-[#080C14] px-3.5 py-2 rounded-xl border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-400 block">Tahmini Net Marj</span>
                  <span className="text-emerald-400 font-bold">+${Number(kpis.grossNetEst).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
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
            <div className="bg-[#0F1626] border border-rose-500/30 rounded-2xl p-5">
              <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                P1–P4 Fire, İptal ve Refund Yönetim Paneli
              </h2>
              <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
                P1 (İptal), P2 (Eksik), P3 (Defolu), P4 (Tarihi Geçmiş) adetleri ve R-kodlu iade tutarları
              </p>
            </div>

            <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
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
        {/* TAB 6: ADMIN KOMUTA MERKEZİ & VERİTABANI SIFIRLAMA ARAÇLARI               */}
        {/* ========================================================================= */}
        {activeTab === "ADMIN" && isAdmin && (
          <AdminDashboard
            currentUser={currentUser}
            onStoreSelected={(storeCode) => {
              setSelectedStore(storeCode);
              setActiveTab("XLS_MASTER");
            }}
            onDataRefresh={() => fetchAllData()}
          />
        )}
      </main>

      {/* Slide-Over Drawer: Product Master Decision Vault Inspector */}
      <ProductMasterDrawer
        master={selectedMaster}
        onClose={() => setSelectedMaster(null)}
        onUpdateDecision={handleUpdateMasterDecision}
      />

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
        onImportSuccess={() => fetchAllData()}
        currentStore={selectedStore}
      />

      {/* Modal: Create PSH Batch */}
      <PshBatchModal
        isOpen={isPshBatchOpen}
        onClose={() => setIsPshBatchOpen(false)}
        onCreated={() => fetchAllData()}
        currentStore={selectedStore}
        unbatchedOrders={orders.filter((o) => !o.pshBatchNo || o.pshBatchNo === "")}
      />

      {/* Modal: Warehouse Reconciliation */}
      <WarehouseReconciliationModal
        isOpen={isWarehouseReconOpen}
        onClose={() => setIsWarehouseReconOpen(false)}
        onSaved={() => fetchAllData()}
        orders={filteredOrders}
      />
    </div>
  );
}
