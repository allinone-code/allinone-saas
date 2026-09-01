"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  PackageCheck,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";

import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";
import { NewOrderModal } from "@/components/NewOrderModal";
import { GoogleDriveXlsImportModal } from "@/components/GoogleDriveXlsImportModal";
import { PshBatchModal } from "@/components/PshBatchModal";
import { WarehouseReconciliationModal } from "@/components/WarehouseReconciliationModal";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ProductMasterDrawer } from "@/components/ProductMasterDrawer";

import { useCerberusData } from "@/features/useCerberusData";
import { AppHeader } from "@/features/shell/AppHeader";
import { KpiStrip } from "@/features/shell/KpiStrip";
import { MorningBriefingPanel } from "@/features/briefing/MorningBriefingPanel";
import { DecisionVaultTable } from "@/features/decision/DecisionVaultTable";
import { ResearcherBoard } from "@/features/sourcing/ResearcherBoard";
import { OrdersTable } from "@/features/orders/OrdersTable";
import {
  InventoryLabPanel,
  ProblemsPanel,
  PshBatchPanel,
  WarehousePanel,
} from "@/features/operations/OperationsPanels";
import { computeOrderKpis, downloadOrdersCsv, filterOrders } from "@/features/orders/ordersCsv";
import { clientLog } from "@/lib/clientLogger";
import type { OrderView, ProductMasterView, TabId } from "@/features/types";
import { isProblemOrder } from "@/features/types";

export default function CerberusApp() {
  const {
    currentUser,
    checkingAuth,
    orders,
    stores,
    batches,
    productMasters,
    researchers,
    briefing,
    loading,
    dataError,
    selectedStore,
    setSelectedStore,
    refresh,
    applyOrderPatch,
    applyMasterPatch,
    prependOrder,
    logout,
  } = useCerberusData();

  const [activeTab, setActiveTab] = useState<TabId>("BRIEFING_DECISION");
  const [searchQuery, setSearchQuery] = useState("");
  const [cargoFilter, setCargoFilter] = useState("ALL");
  const [batchFilter, setBatchFilter] = useState("ALL");
  const [decisionFilter, setDecisionFilter] = useState("ALL");

  const [selectedOrder, setSelectedOrder] = useState<OrderView | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<ProductMasterView | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isXlsImportOpen, setIsXlsImportOpen] = useState(false);
  const [isPshBatchOpen, setIsPshBatchOpen] = useState(false);
  const [isWarehouseReconOpen, setIsWarehouseReconOpen] = useState(false);

  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
  const isStoreLocked = Boolean(
    !isAdmin && currentUser?.storeCode && currentUser.storeCode !== "ALL"
  );

  const filteredOrders = useMemo(
    () => filterOrders(orders, { search: searchQuery, cargo: cargoFilter, batch: batchFilter }),
    [orders, searchQuery, cargoFilter, batchFilter]
  );

  const kpis = useMemo(() => computeOrderKpis(filteredOrders), [filteredOrders]);

  const handleUpdateOrder = useCallback(
    async (id: number, updates: Partial<OrderView>) => {
      applyOrderPatch(id, updates);
      setSelectedOrder((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        // Sunucu reddederse iyimser güncellemeyi geri al: ekran gerçeği göstersin
        if (!res.ok) await refresh();
      } catch (err) {
        clientLog.error("orders/update", "Sipariş güncelleme başarısız", { err: String(err) });
        await refresh();
      }
    },
    [applyOrderPatch, refresh]
  );

  const handleUpdateMasterDecision = useCallback(
    async (id: number, decisionAction: string, sellingPrice?: number) => {
      applyMasterPatch(id, {
        decisionAction,
        ...(sellingPrice ? { sellingPrice: String(sellingPrice) } : {}),
      });
      setSelectedMaster((prev) => (prev && prev.id === id ? { ...prev, decisionAction } : prev));
      try {
        const res = await fetch(`/api/intelligence/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisionAction, sellingPrice }),
        });
        if (!res.ok) await refresh();
      } catch (err) {
        clientLog.error("intelligence/update", "Karar güncelleme başarısız", { err: String(err) });
        await refresh();
      }
    },
    [applyMasterPatch, refresh]
  );

  const handleExportCsv = useCallback(() => {
    downloadOrdersCsv(filteredOrders, selectedStore);
  }, [filteredOrders, selectedStore]);

  const tabs = useMemo(
    () =>
      [
        {
          id: "BRIEFING_DECISION" as const,
          label: "Sabah Brifingi & Karar Kasası",
          badge: `${productMasters.length} ürün`,
          icon: Sun,
        },
        {
          id: "RESEARCHERS" as const,
          label: "ABD Sourcing Ekibi",
          badge: `${researchers.length} uzman`,
          icon: Users,
        },
        {
          id: "XLS_MASTER" as const,
          label: "40-Kolon XLS Siparişleri",
          badge: `${filteredOrders.length} satır`,
          icon: FileSpreadsheet,
        },
        {
          id: "PSH_BATCHES" as const,
          label: "PSH Envanter & Batch",
          badge: `${batches.length} parti`,
          icon: Building2,
        },
        {
          id: "WAREHOUSE" as const,
          label: "Depo Karşılama & Sayım",
          badge: "Order No eşleştir",
          icon: PackageCheck,
        },
        {
          id: "INVENTORY_LAB" as const,
          label: "Inventory Lab & Muhasebe",
          badge: "Maliyet vs satış",
          icon: TrendingUp,
        },
        {
          id: "PROBLEMS" as const,
          label: "P1–P4 Fire & Problem",
          badge: `${orders.filter(isProblemOrder).length} kayıt`,
          icon: AlertTriangle,
        },
        ...(isAdmin
          ? [
              {
                id: "ADMIN" as const,
                label: "Admin Komuta Merkezi",
                badge: `${stores.length} mağaza`,
                icon: ShieldCheck,
              },
            ]
          : []),
      ],
    [productMasters.length, researchers.length, filteredOrders.length, batches.length, orders, isAdmin, stores.length]
  );

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 mx-auto mb-3 animate-pulse" />
          <p className="text-xs font-mono-tech text-slate-400">Oturum doğrulanıyor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] bg-tactical-grid text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      <AppHeader
        currentUser={currentUser}
        stores={stores}
        selectedStore={selectedStore}
        onStoreChange={setSelectedStore}
        storeLocked={isStoreLocked}
        isAdmin={Boolean(isAdmin)}
        adminActive={activeTab === "ADMIN"}
        onOpenAdmin={() => setActiveTab("ADMIN")}
        onExportCsv={handleExportCsv}
        onOpenImport={() => setIsXlsImportOpen(true)}
        onOpenNewOrder={() => setIsNewOrderOpen(true)}
        onLogout={logout}
      />

      {dataError && (
        <div className="mx-5 sm:mx-6 mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {dataError}
          <button
            onClick={() => refresh()}
            className="ml-auto px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-bold"
          >
            Tekrar dene
          </button>
        </div>
      )}

      <KpiStrip kpis={kpis} briefing={briefing} storeScope={selectedStore} />

      <div className="px-5 sm:px-6 border-b border-slate-800 bg-[#0F1626] overflow-x-auto">
        <nav className="flex items-center gap-5 sm:gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`py-3.5 text-xs font-mono-tech uppercase font-bold tracking-wider flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-indigo-500 text-indigo-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
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

      <main className="flex-1 p-5 sm:p-6 max-w-[1700px] w-full mx-auto space-y-5">
        {loading && (
          <div className="text-[11px] font-mono-tech text-slate-500">Veriler güncelleniyor…</div>
        )}

        {activeTab === "BRIEFING_DECISION" && (
          <div className="space-y-6">
            <MorningBriefingPanel briefing={briefing} storeScope={selectedStore} />
            <DecisionVaultTable
              masters={productMasters}
              decisionFilter={decisionFilter}
              onDecisionFilterChange={setDecisionFilter}
              onSelect={setSelectedMaster}
            />
          </div>
        )}

        {activeTab === "RESEARCHERS" && <ResearcherBoard researchers={researchers} />}

        {activeTab === "XLS_MASTER" && (
          <OrdersTable
            orders={filteredOrders}
            batches={batches}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cargoFilter={cargoFilter}
            onCargoFilterChange={setCargoFilter}
            batchFilter={batchFilter}
            onBatchFilterChange={setBatchFilter}
            onExportCsv={handleExportCsv}
            onOpenWarehouse={() => setIsWarehouseReconOpen(true)}
            onSelect={setSelectedOrder}
          />
        )}

        {activeTab === "PSH_BATCHES" && (
          <PshBatchPanel
            batches={batches}
            orders={orders}
            onCreate={() => setIsPshBatchOpen(true)}
          />
        )}

        {activeTab === "WAREHOUSE" && (
          <WarehousePanel
            orders={filteredOrders}
            onStartCount={() => setIsWarehouseReconOpen(true)}
            onSelect={setSelectedOrder}
          />
        )}

        {activeTab === "INVENTORY_LAB" && (
          <InventoryLabPanel orders={filteredOrders} kpis={kpis} />
        )}

        {activeTab === "PROBLEMS" && (
          <ProblemsPanel orders={filteredOrders} onSelect={setSelectedOrder} />
        )}

        {activeTab === "ADMIN" && isAdmin && (
          <AdminDashboard
            currentUser={currentUser}
            onStoreSelected={(storeCode: string) => {
              setSelectedStore(storeCode);
              setActiveTab("XLS_MASTER");
            }}
            onDataRefresh={refresh}
          />
        )}
      </main>

      <ProductMasterDrawer
        master={selectedMaster}
        onClose={() => setSelectedMaster(null)}
        onUpdateDecision={handleUpdateMasterDecision}
      />

      <OrderDetailDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdate={handleUpdateOrder}
        batches={batches}
      />

      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onCreated={(newOrder: OrderView) => {
          prependOrder(newOrder);
          setSelectedOrder(newOrder);
        }}
        currentStore={selectedStore}
      />

      <GoogleDriveXlsImportModal
        isOpen={isXlsImportOpen}
        onClose={() => setIsXlsImportOpen(false)}
        onImportSuccess={refresh}
        currentStore={selectedStore}
      />

      <PshBatchModal
        isOpen={isPshBatchOpen}
        onClose={() => setIsPshBatchOpen(false)}
        onCreated={refresh}
        currentStore={selectedStore}
        unbatchedOrders={orders.filter((o) => !o.pshBatchNo)}
      />

      <WarehouseReconciliationModal
        isOpen={isWarehouseReconOpen}
        onClose={() => setIsWarehouseReconOpen(false)}
        onSaved={refresh}
        orders={filteredOrders}
      />
    </div>
  );
}
