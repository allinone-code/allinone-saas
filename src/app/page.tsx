"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  Plus,
  FileSpreadsheet,
  Cpu,
  Store,
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Lock,
  History,
  Database,
  Info,
} from "lucide-react";
import { QuickSourceCaptureModal } from "@/components/QuickSourceCaptureModal";
import { XlsImportModal } from "@/components/XlsImportModal";
import { ProductIntelligenceDrawer } from "@/components/ProductIntelligenceDrawer";
import {
  INITIAL_DISCOVERIES,
  INITIAL_PROBLEMS,
  INITIAL_RESEARCHERS,
  INITIAL_STORES,
  INITIAL_SUPPLIERS,
  INITIAL_AUDIT_LOGS,
} from "@/lib/mockData";

export default function CerberusApp() {
  const [data, setData] = useState<any>({
    discoveries: INITIAL_DISCOVERIES,
    stores: INITIAL_STORES,
    researchers: INITIAL_RESEARCHERS,
    suppliers: INITIAL_SUPPLIERS,
    problems: INITIAL_PROBLEMS,
    auditLogs: INITIAL_AUDIT_LOGS,
    executiveKpis: {
      totalGrossSales: "2845900.00",
      totalMonthlyNetProfit: "682410.00",
      totalActiveProducts: INITIAL_DISCOVERIES.length,
      totalActiveListings: 3140,
      averageRoiPercent: "48.20",
      openProblemsCount: 3,
      totalStoresCount: 26,
      totalResearchersCount: 10,
    },
    dbStatus: {
      connected: false,
      message: "Checking database status...",
    },
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "INTELLIGENCE" | "RESEARCHERS" | "STORES" | "PROBLEMS"
  >("INTELLIGENCE");

  // Current Role RBAC Selector
  const [currentUserRole, setCurrentUserRole] = useState<
    "MANAGER" | "LEAD_SOURCER" | "RESEARCHER"
  >("MANAGER");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [researcherFilter, setResearcherFilter] = useState("ALL");
  const [duplicateFilter, setDuplicateFilter] = useState("ALL");

  // Modals & Drawer
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isXlsImportOpen, setIsXlsImportOpen] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState<any | null>(null);

  const fetchPlatformData = async () => {
    try {
      const res = await fetch("/api/cerberus", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.discoveries && json.discoveries.length > 0) {
          setData(json);
        }
      }
    } catch (err) {
      console.warn("Using offline memory dataset:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const handleUpdateStage = async (id: number, newStage: string) => {
    // Optimistic immediate update
    setData((prev: any) => ({
      ...prev,
      discoveries: prev.discoveries.map((d: any) =>
        d.id === id ? { ...d, lifecycleStage: newStage } : d
      ),
    }));
    if (selectedDiscovery?.id === id) {
      setSelectedDiscovery((prev: any) => ({
        ...prev,
        lifecycleStage: newStage,
      }));
    }

    try {
      await fetch(`/api/cerberus/discoveries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lifecycleStage: newStage,
          actorName:
            currentUserRole === "MANAGER"
              ? "Ahmet Erdem (VP Operations)"
              : currentUserRole === "LEAD_SOURCER"
              ? "Selin Yilmaz (Lead Sourcing)"
              : "Mert Çelik (Senior Researcher)",
          actorRole: currentUserRole,
        }),
      });
    } catch (err) {
      console.warn("Stage update synced in UI:", err);
    }
  };

  const handleUpdatePrice = async (id: number, newPrice: number) => {
    setData((prev: any) => ({
      ...prev,
      discoveries: prev.discoveries.map((d: any) => {
        if (d.id === id) {
          const landed = Number(d.landedCost || 100);
          const net = Number((newPrice - landed).toFixed(2));
          const roi = Number(((net / landed) * 100).toFixed(2));
          return {
            ...d,
            sellingPrice: String(newPrice),
            estimatedNetProfit: String(net),
            roiPercent: String(roi),
          };
        }
        return d;
      }),
    }));

    try {
      await fetch(`/api/cerberus/discoveries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellingPrice: newPrice,
          actorName: "Ahmet Erdem (VP Operations)",
        }),
      });
    } catch (err) {
      console.warn("Price update synced in UI:", err);
    }
  };

  const handleResolveProblem = async (problemId: number) => {
    setData((prev: any) => ({
      ...prev,
      problems: prev.problems.map((p: any) =>
        p.id === problemId
          ? { ...p, status: "RESOLVED", resolvedAt: new Date().toISOString() }
          : p
      ),
    }));

    try {
      await fetch(`/api/cerberus/problems/${problemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          actionTaken:
            "Verified supplier invoice & re-enabled FBA buybox protection via Cerberus API.",
        }),
      });
    } catch (err) {
      console.warn("Problem resolution synced in UI:", err);
    }
  };

  const filteredDiscoveries = useMemo(() => {
    if (!data?.discoveries) return [];
    return data.discoveries.filter((d: any) => {
      const matchSearch =
        !searchQuery ||
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.upc.includes(searchQuery) ||
        d.asin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.brand.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStage =
        stageFilter === "ALL" || d.lifecycleStage === stageFilter;

      const matchResearcher =
        researcherFilter === "ALL" ||
        d.researcherName.toLowerCase().includes(researcherFilter.toLowerCase());

      const matchDuplicate =
        duplicateFilter === "ALL" || d.duplicateStatus === duplicateFilter;

      return matchSearch && matchStage && matchResearcher && matchDuplicate;
    });
  }, [data, searchQuery, stageFilter, researcherFilter, duplicateFilter]);

  const kpis = data?.executiveKpis || {
    totalGrossSales: "2845900.00",
    totalMonthlyNetProfit: "682410.00",
    totalActiveProducts: 12,
    totalActiveListings: 3140,
    averageRoiPercent: "48.20",
    openProblemsCount: 3,
  };

  const isDbConnected = data?.dbStatus?.connected === true;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F3F4F6] flex flex-col">
      {/* Top Tactical Command Navigation Header */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0E1420]/90 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center font-display font-bold text-white text-sm shadow-md shadow-sky-500/20">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wider text-white">
                CERBERUS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                26 MULTI-STORE FLEET
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                10 US SOURCERS ONLINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-tech">
              Product Intelligence • Sourcing • Landed-Cost Profitability • Marketplace Automation
            </p>
          </div>
        </div>

        {/* Action Bar + DB Badge + Role Switcher */}
        <div className="flex items-center gap-3">
          {/* Database Connection Status Badge */}
          <div
            title={data?.dbStatus?.message || "Database status"}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono-tech border ${
              isDbConnected
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
            }`}
          >
            <Database className="w-3 h-3" />
            <span>
              {isDbConnected ? "POSTGRES LIVE" : "DEMO / OFFLINE MODE"}
            </span>
          </div>

          {/* RBAC Role Simulator */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[#0B0F17] border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono-tech">
            <Lock className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">RBAC ROLE:</span>
            <select
              value={currentUserRole}
              onChange={(e: any) => setCurrentUserRole(e.target.value)}
              className="bg-transparent text-sky-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="MANAGER" className="bg-[#0B0F17]">
                Ahmet Erdem (VP Operations / MANAGER)
              </option>
              <option value="LEAD_SOURCER" className="bg-[#0B0F17]">
                Selin Yilmaz (Lead Sourcing Specialist)
              </option>
              <option value="RESEARCHER" className="bg-[#0B0F17]">
                Mert Çelik (US Sourcing Researcher)
              </option>
            </select>
          </div>

          <button
            onClick={() => setIsXlsImportOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-mono-tech text-slate-200 border border-slate-700/60 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Excel Batch Import
          </button>

          <button
            onClick={() => setIsQuickCaptureOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-mono-tech text-xs uppercase font-bold tracking-wider shadow-lg shadow-sky-500/25 transition"
          >
            <Plus className="w-4 h-4" />
            Chrome Extension Quick-Capture
          </button>
        </div>
      </header>

      {/* Optional Helpful Database Configuration Banner if Offline */}
      {!isDbConnected && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between text-xs font-mono-tech text-amber-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Demo Modu:</strong> Veritabanı bağlantısı bulunamadığı için sistem yerel bellek üzerinden eksiksiz çalışmaktadır. Canlı PostgreSQL için <code>.env</code> dosyasına <code>DATABASE_URL</code> ekleyip <code>npx drizzle-kit push</code> çalıştırabilirsiniz.
            </span>
          </div>
          <button
            onClick={() => fetchPlatformData()}
            className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] shrink-0 transition"
          >
            Yeniden Dene
          </button>
        </div>
      )}

      {/* Executive Command Center KPI Strip */}
      <section className="border-b border-slate-800/80 bg-[#0E1420]/50 px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono-tech uppercase text-slate-400 block">
              26-STORE GROSS REVENUE
            </span>
            <div className="text-xl font-display font-bold text-white mt-1">
              ${Number(kpis.totalGrossSales).toLocaleString()}
            </div>
            <span className="text-[10px] font-mono-tech text-emerald-400">
              18 Amazon • 2 Walmart • 5 Shopify • 1 Wholesale
            </span>
          </div>

          <div className="bg-[#161C28] border border-emerald-500/30 rounded-xl p-3.5">
            <span className="text-[11px] font-mono-tech uppercase text-emerald-400 block">
              TOTAL MONTHLY NET PROFIT
            </span>
            <div className="text-xl font-display font-bold text-emerald-400 mt-1">
              +${Number(kpis.totalMonthlyNetProfit).toLocaleString()}
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              Landed-Cost Adjusted Profit
            </span>
          </div>

          <div className="bg-[#161C28] border border-sky-500/30 rounded-xl p-3.5">
            <span className="text-[11px] font-mono-tech uppercase text-sky-400 block">
              PORTFOLIO AVERAGE ROI
            </span>
            <div className="text-xl font-display font-bold text-sky-400 mt-1">
              {kpis.averageRoiPercent}%
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              Target benchmark &gt;30%
            </span>
          </div>

          <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono-tech uppercase text-slate-400 block">
              PRODUCT MASTER DISCOVERIES
            </span>
            <div className="text-xl font-display font-bold text-white mt-1">
              {data?.discoveries?.length || 0}
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              13-Stage Central Product Vault
            </span>
          </div>

          <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-mono-tech uppercase text-slate-400 block">
              ACTIVE STORE LISTINGS
            </span>
            <div className="text-xl font-display font-bold text-white mt-1">
              {Number(kpis.totalActiveListings).toLocaleString()}
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              Multi-ASIN / Multi-Store Synced
            </span>
          </div>

          <div className="bg-[#161C28] border border-amber-500/40 rounded-xl p-3.5">
            <span className="text-[11px] font-mono-tech uppercase text-amber-400 block">
              OPEN P1–P2 ALARMS
            </span>
            <div className="text-xl font-display font-bold text-amber-400 mt-1">
              {kpis.openProblemsCount}
            </div>
            <span className="text-[10px] font-mono-tech text-slate-400">
              BuyBox drop &amp; Amazon health alerts
            </span>
          </div>
        </div>
      </section>

      {/* Layer Switcher Navigation Tabs */}
      <div className="px-6 border-b border-slate-800 bg-[#0E1420] flex items-center justify-between overflow-x-auto">
        <nav className="flex items-center gap-6">
          {[
            {
              id: "INTELLIGENCE",
              label: "1. Product Intelligence & Sourcing Engine",
              badge: `${filteredDiscoveries.length} Products`,
              icon: Cpu,
            },
            {
              id: "RESEARCHERS",
              label: "2. 10-Person Sourcing Team Intelligence",
              badge: "10 US Specialists",
              icon: Users,
            },
            {
              id: "STORES",
              label: "3. 26 Multi-Store Fleet & Suppliers",
              badge: "26 Stores",
              icon: Store,
            },
            {
              id: "PROBLEMS",
              label: "4. P1–P4 Problem Center & Audit Trail",
              badge: `${kpis.openProblemsCount} Open`,
              icon: ShieldAlert,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 text-xs font-mono-tech uppercase font-bold tracking-wider flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    active
                      ? "bg-sky-500/20 text-sky-300"
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

      {/* Main Dynamic View Content */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto space-y-6">
        {/* TAB 1: PRODUCT INTELLIGENCE & SOURCING ENGINE */}
        {activeTab === "INTELLIGENCE" && (
          <div className="space-y-4">
            <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ASIN, UPC, Brand, Product Title, or Code (e.g. DEWALT, B0183RLW8A, 885911425129)..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-xs font-mono-tech text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono-tech text-slate-200 focus:outline-none"
                >
                  <option value="ALL">ALL LIFECYCLE STAGES (13)</option>
                  <option value="DISCOVERED">DISCOVERED</option>
                  <option value="SCREENING">SCREENING</option>
                  <option value="DUPLICATE_CHECK">DUPLICATE_CHECK</option>
                  <option value="ANALYZING">ANALYZING</option>
                  <option value="REVIEW">REVIEW</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="PURCHASING">PURCHASING</option>
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="LISTING">LISTING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MONITORING">MONITORING</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="DISCONTINUED">DISCONTINUED</option>
                </select>

                <select
                  value={duplicateFilter}
                  onChange={(e) => setDuplicateFilter(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono-tech text-slate-200 focus:outline-none"
                >
                  <option value="ALL">ALL DUPLICATE STATUS</option>
                  <option value="CLEAR">CLEAR (Unique UPC/ASIN)</option>
                  <option value="EXACT_DUPLICATE">EXACT_DUPLICATE (Flagged)</option>
                  <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
                </select>

                <select
                  value={researcherFilter}
                  onChange={(e) => setResearcherFilter(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-mono-tech text-slate-200 focus:outline-none"
                >
                  <option value="ALL">ALL 10 SOURCING SPECIALISTS</option>
                  {data?.researchers?.map((r: any) => (
                    <option key={r.code} value={r.name}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-[#161C28] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0E1420] border-b border-slate-800 text-[11px] font-mono-tech uppercase text-slate-400">
                      <th className="py-3 px-4">Code / Barcodes</th>
                      <th className="py-3 px-4">Product Master &amp; US Source</th>
                      <th className="py-3 px-4">Duplicate Check</th>
                      <th className="py-3 px-4">13-Stage Lifecycle</th>
                      <th className="py-3 px-4 text-right">Landed Cost</th>
                      <th className="py-3 px-4 text-right">Target Sale</th>
                      <th className="py-3 px-4 text-right">Net Profit / ROI</th>
                      <th className="py-3 px-4 text-center">AI Opp. Score</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredDiscoveries.map((item: any) => {
                      const isDup = item.duplicateStatus === "EXACT_DUPLICATE";
                      const isHighRoi = Number(item.roiPercent) >= 30;
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#1C2434]/80 transition group"
                        >
                          <td className="py-3.5 px-4 font-mono-tech whitespace-nowrap">
                            <span className="text-sky-400 font-bold block">
                              {item.productCode}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              ASIN: {item.asin}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              UPC: {item.upc}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 max-w-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono-tech text-[10px] font-bold">
                                {item.brand}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {item.researcherName}
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedDiscovery(item)}
                              className="font-medium text-white hover:text-sky-400 text-left line-clamp-2 transition"
                            >
                              {item.title}
                            </button>
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-mono-tech text-slate-400 hover:text-sky-400 inline-flex items-center gap-1 mt-0.5"
                            >
                              {item.sourceDomain} <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>

                          <td className="py-3.5 px-4 font-mono-tech whitespace-nowrap">
                            {isDup ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px]">
                                <AlertTriangle className="w-3.5 h-3.5" /> DUP{" "}
                                {item.duplicateScore}%
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> UNIQUE (
                                {item.duplicateScore}%)
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <select
                              value={item.lifecycleStage}
                              onChange={(e) =>
                                handleUpdateStage(item.id, e.target.value)
                              }
                              className="bg-[#0B0F17] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono-tech text-sky-300 font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                            >
                              {[
                                "DISCOVERED",
                                "SCREENING",
                                "DUPLICATE_CHECK",
                                "ANALYZING",
                                "REVIEW",
                                "APPROVED",
                                "PURCHASING",
                                "RECEIVED",
                                "LISTING",
                                "ACTIVE",
                                "MONITORING",
                                "PAUSED",
                                "DISCONTINUED",
                              ].map((stage) => (
                                <option key={stage} value={stage}>
                                  {stage}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono-tech whitespace-nowrap">
                            <span className="text-amber-400 font-bold block">
                              ${Number(item.sourcePrice).toFixed(2)}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              Landed: ${Number(item.landedCost).toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono-tech whitespace-nowrap">
                            <span className="text-white font-bold block">
                              ${Number(item.sellingPrice).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Est {item.monthlyEstimatedUnits} u/mo
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono-tech whitespace-nowrap">
                            <span className="text-emerald-400 font-bold block">
                              +${Number(item.estimatedNetProfit).toFixed(2)}
                            </span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                isHighRoi
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-sky-500/20 text-sky-400"
                              }`}
                            >
                              {item.roiPercent}% ROI
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono-tech whitespace-nowrap">
                            <div className="inline-flex flex-col items-center">
                              <span className="text-sm font-bold text-sky-400">
                                {item.opportunityScore}/100
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase">
                                {item.aiRecommendation?.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => setSelectedDiscovery(item)}
                              className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-400 font-mono-tech text-xs font-bold transition"
                            >
                              Inspect 360°
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 10-PERSON SOURCING SPECIALIST PERFORMANCE LEADERBOARD */}
        {activeTab === "RESEARCHERS" && (
          <div className="space-y-4">
            <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-display font-bold text-white">
                    10-PERSON US SOURCING SPECIALIST INTELLIGENCE ATTRIBUTION
                  </h2>
                  <p className="text-xs text-slate-400">
                    Measuring real commercial conversion: Bulunan Ürün → Onaylanan → Satın Alınan → Kâr Üreten Ürün (Points #5 &amp; #6)
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono-tech font-bold">
                  100% US Retail Coverage
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data?.researchers?.map((r: any) => (
                  <div
                    key={r.id}
                    className="bg-[#0E1420] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-sky-500/50 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 font-mono-tech font-bold flex items-center justify-center text-xs">
                            {r.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-display font-bold text-white">
                                {r.name}
                              </span>
                              <span className="text-[11px] font-mono-tech text-slate-400">
                                {r.code}
                              </span>
                            </div>
                            <span className="text-[11px] text-sky-400 block truncate max-w-[210px]">
                              {r.specialtyDomain}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono-tech">
                          <span className="text-xs text-slate-400 block">
                            Researcher Score
                          </span>
                          <span
                            className={`text-lg font-bold ${
                              Number(r.researcherScore) >= 90
                                ? "text-emerald-400"
                                : "text-sky-400"
                            }`}
                          >
                            {r.researcherScore}/100
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 my-3 text-xs font-mono-tech">
                        <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">
                            Discoveries Logged
                          </span>
                          <span className="text-white font-bold">
                            {r.discoveryVolume} items
                          </span>
                        </div>
                        <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">
                            Manager Approval Rate
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {r.approvalRate}%
                          </span>
                        </div>
                        <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">
                            Avg Net Profit / Mo
                          </span>
                          <span className="text-emerald-400 font-bold">
                            +${Number(r.averageNetProfit).toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">
                            Average Portfolio ROI
                          </span>
                          <span className="text-sky-400 font-bold">
                            {r.averageRoi}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono-tech text-slate-400">
                      <span>Active Listings: {r.activeListingsCount}</span>
                      <span className="text-amber-400">
                        Problem Rate: {r.problemRate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 26 MULTI-STORE FLEET & SUPPLIER INTELLIGENCE SCORECARD */}
        {activeTab === "STORES" && (
          <div className="space-y-6">
            <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-display font-bold text-white">
                    SUPPLIER INTELLIGENCE RATING (0-100 COMPOSITE SCORE)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Price stability, delivery reliability, stockout frequency, and return rate scoring across US retail partners
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data?.suppliers?.map((sup: any) => (
                  <div
                    key={sup.id}
                    className="p-4 rounded-xl bg-[#0E1420] border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-mono-tech text-sky-400 font-bold block">
                        {sup.supplierCode}
                      </span>
                      <h3 className="text-sm font-display font-bold text-white">
                        {sup.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-xs font-mono-tech text-slate-400">
                        <span>Price Stab: {sup.priceStabilityScore}</span>
                        <span>Returns: {sup.returnRatePercent}%</span>
                      </div>
                    </div>
                    <div className="text-right font-mono-tech">
                      <span
                        className={`text-2xl font-bold ${
                          Number(sup.supplierScore) >= 90
                            ? "text-emerald-400"
                            : Number(sup.supplierScore) >= 80
                            ? "text-sky-400"
                            : "text-amber-400"
                        }`}
                      >
                        {sup.supplierScore}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        / 100 SCORE
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-display font-bold text-white">
                    26 MULTI-CHANNEL STOREFRONT FLEET (18 AMAZON + 2 WALMART + 5 SHOPIFY + 1 WHOLESALE)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Central ASIN / MSKU inventory sync, account health score, and monthly gross/net breakdown
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {data?.stores?.map((st: any) => (
                  <div
                    key={st.id}
                    className="p-3.5 rounded-xl bg-[#0E1420] border border-slate-800/80 flex flex-col justify-between hover:border-sky-500/40 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 font-mono-tech text-xs font-bold">
                          {st.storeCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold ${
                            st.status === "ACTIVE"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {st.status} • HEALTH {st.accountHealthScore}%
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate">
                        {st.storeName}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono-tech text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          Gross Revenue
                        </span>
                        <span className="text-white font-bold">
                          ${Number(st.monthlyGrossRevenue).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">
                          Net Profit
                        </span>
                        <span className="text-emerald-400 font-bold">
                          +${Number(st.monthlyNetProfit).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: P1–P4 PROBLEM CENTER & AUDIT SECURITY LOGS */}
        {activeTab === "PROBLEMS" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-display font-bold text-white">
                    P1–P4 OPERATIONAL &amp; STORE ALARM CENTER (POINTS #20 &amp; #21)
                  </h2>
                  <p className="text-xs text-slate-400">
                    BuyBox repricer drops, Account Health verification requests, and Supplier Stockouts
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {data?.problems?.map((prob: any) => {
                  const isCritical = prob.severity === "P1_CRITICAL";
                  return (
                    <div
                      key={prob.id}
                      className={`p-4 rounded-xl border ${
                        isCritical
                          ? "bg-red-500/10 border-red-500/40"
                          : prob.status === "RESOLVED"
                          ? "bg-[#0E1420] border-emerald-500/30"
                          : "bg-amber-500/10 border-amber-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-mono-tech text-xs font-bold ${
                              isCritical
                                ? "bg-red-500 text-white"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {prob.severity}
                          </span>
                          <span className="font-mono-tech text-xs text-sky-400 font-bold">
                            {prob.storeCode}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] font-mono-tech text-slate-300">
                            {prob.problemType}
                          </span>
                        </div>
                        <span className="font-mono-tech text-xs font-bold text-amber-400">
                          Impact: -${Number(prob.financialImpact).toLocaleString()}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white mb-1">
                        {prob.productTitle}
                      </h4>
                      <p className="text-xs text-slate-300 mb-2">
                        {prob.rootCause}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <span className="text-slate-400 font-mono-tech">
                          Assigned: {prob.assignedTo}
                        </span>
                        {prob.status === "RESOLVED" ? (
                          <span className="text-emerald-400 font-mono-tech font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> RESOLVED
                          </span>
                        ) : (
                          <button
                            onClick={() => handleResolveProblem(prob.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-mono-tech text-xs font-bold transition"
                          >
                            Mark Action Complete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#161C28] border border-slate-800/80 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" />
                  <div>
                    <h2 className="text-base font-display font-bold text-white">
                      CERBERUS IMMUTABLE AUDIT LOG (WHO • WHAT • WHEN • BEFORE • AFTER)
                    </h2>
                    <p className="text-xs text-slate-400">
                      26-Store RBAC action trail for every sourcing capture, stage transition &amp; price shift
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {data?.auditLogs?.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-[#0E1420] border border-slate-800/80 text-xs font-mono-tech"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sky-400 font-bold">
                        {log.actorName} ({log.actorRole})
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-amber-300">
                        {log.actionType}
                      </span>
                      <span className="truncate">{log.targetEntity}</span>
                    </div>
                    {log.beforeState && log.afterState && (
                      <div className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>{log.beforeState}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">
                          {log.afterState}
                        </span>
                      </div>
                    )}
                    {log.details && (
                      <p className="mt-1 text-[11px] text-slate-400 font-sans">
                        {log.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide-Over Product Intelligence 360 Inspector Drawer */}
      <ProductIntelligenceDrawer
        discovery={selectedDiscovery}
        onClose={() => setSelectedDiscovery(null)}
        onUpdateStage={handleUpdateStage}
        onUpdatePrice={handleUpdatePrice}
        stores={data?.stores || []}
      />

      {/* Chrome Extension & US Retail Quick Capture Modal */}
      <QuickSourceCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onCreated={(newDisc) => {
          setData((prev: any) => ({
            ...prev,
            discoveries: [newDisc, ...(prev?.discoveries || [])],
          }));
          setSelectedDiscovery(newDisc);
        }}
        existingDiscoveries={data?.discoveries || []}
        researchers={data?.researchers || []}
      />

      {/* Excel Migration / Batch Import Modal */}
      <XlsImportModal
        isOpen={isXlsImportOpen}
        onClose={() => setIsXlsImportOpen(false)}
        onImportSuccess={() => fetchPlatformData()}
      />
    </div>
  );
}
