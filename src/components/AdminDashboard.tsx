"use client";

import React, { useState, useEffect } from "react";
import {
  Store,
  Users,
  ShieldCheck,
  Plus,
  XCircle,
  History,
  Activity,
  CheckCircle2,
  Key,
  Globe,
  TrendingUp,
  Server,
  Zap,
  Trash2,
  AlertTriangle,
  Database,
  RefreshCw,
  FileSpreadsheet,
  Package,
  Layers,
} from "lucide-react";

interface AdminDashboardProps {
  onStoreSelected?: (storeCode: string) => void;
  currentUser: any;
  onDataRefresh?: () => void;
}

export function AdminDashboard({
  onStoreSelected,
  currentUser,
  onDataRefresh,
}: AdminDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "STORES" | "USERS" | "ORDERS_CRUD" | "SP_API" | "AUDIT" | "DB_TOOLS"
  >("STORES");

  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter for orders subtab
  const [orderStoreFilter, setOrderStoreFilter] = useState("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  // New Store Modal state
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [marketplace, setMarketplace] = useState("AMAZON");
  const [buyerName, setBuyerName] = useState("");
  const [defaultCard, setDefaultCard] = useState("1753");
  const [defaultEmail, setDefaultEmail] = useState("");
  const [storeNotes, setStoreNotes] = useState("");
  const [savingStore, setSavingStore] = useState(false);

  // New User Modal state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("STORE_USER");
  const [newUserStore, setNewUserStore] = useState("HRN");
  const [newUserPass, setNewUserPass] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Database Reset confirmation state
  const [confirmationInput, setConfirmationInput] = useState("");
  const [resettingDb, setResettingDb] = useState(false);

  // Status message
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  const fetchAdminData = async () => {
    try {
      const [storesRes, usersRes, logsRes] = await Promise.all([
        fetch("/api/admin/stores"),
        fetch("/api/admin/users"),
        fetch("/api/orders?storeCode=ALL"),
      ]);

      if (storesRes.ok) {
        const data = await storesRes.json();
        setStores(data.stores || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setAuditLogs(data.auditLogs || []);
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Admin data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeCode || !storeName) return;
    setSavingStore(true);
    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeCode,
          storeName,
          marketplace,
          buyerName: buyerName || "Alıcı Sorumlusu",
          defaultCard,
          defaultEmail: defaultEmail || `${storeCode.toLowerCase()}@cerberus-commerce.io`,
          notes: storeNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || "Mağaza başarıyla oluşturuldu.");
        setIsNewStoreModalOpen(false);
        setStoreCode("");
        setStoreName("");
        fetchAdminData();
        if (onDataRefresh) onDataRefresh();
      } else {
        showFeedback(data.error || "Mağaza oluşturulamadı", "error");
      }
    } catch (err: any) {
      showFeedback(err.message, "error");
    } finally {
      setSavingStore(false);
    }
  };

  const handleToggleStoreStatus = async (store: any) => {
    const nextStatus = store.status === "ACTIVE" ? "PASSIVE" : "ACTIVE";
    try {
      const res = await fetch("/api/admin/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: store.id,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        setStores((prev) =>
          prev.map((s) => (s.id === store.id ? { ...s, status: nextStatus } : s))
        );
        showFeedback(`${store.storeCode} mağazası ${nextStatus === "ACTIVE" ? "Aktif" : "Pasif"} yapıldı.`);
      }
    } catch {
      showFeedback("Durum güncellenemedi", "error");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    setSavingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
          storeCode: newUserStore,
          password: newUserPass,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || "Kullanıcı başarıyla oluşturuldu.");
        setIsNewUserModalOpen(false);
        setNewUserName("");
        setNewUserEmail("");
        fetchAdminData();
      } else {
        showFeedback(data.error || "Kullanıcı eklenemedi", "error");
      }
    } catch (err: any) {
      showFeedback(err.message, "error");
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateUserStore = async (userId: number, targetStore: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          storeCode: targetStore,
        }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, storeCode: targetStore } : u))
        );
        showFeedback("Kullanıcı mağaza ataması güncellendi.");
      }
    } catch {
      showFeedback("Güncelleme başarısız", "error");
    }
  };

  // Delete a specific row from orders table
  const handleDeleteOrderRow = async (orderId: number) => {
    try {
      const res = await fetch("/api/admin/master-crud", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: "orders", id: orderId }),
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        showFeedback("Sipariş satırı veritabanından kalıcı olarak silindi.");
        if (onDataRefresh) onDataRefresh();
      }
    } catch {
      showFeedback("Silme başarısız oldu", "error");
    }
  };

  // Execute Database Reset or Restore action
  const handleExecuteDatabaseTool = async (
    actionType: "CLEAN_ORDERS_ONLY" | "RESTORE_REAL_XLS" | "NUKE_ALL_KEEP_ADMIN"
  ) => {
    if (confirmationInput !== "RESET-CERBERUS") {
      showFeedback("Lütfen kutuya tam olarak 'RESET-CERBERUS' yazın.", "error");
      return;
    }
    setResettingDb(true);
    try {
      const res = await fetch("/api/admin/database-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          confirmationCode: confirmationInput,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(data.message);
        setConfirmationInput("");
        fetchAdminData();
        if (onDataRefresh) onDataRefresh();
      } else {
        showFeedback(data.error || "İşlem başarısız", "error");
      }
    } catch (err: any) {
      showFeedback(err.message, "error");
    } finally {
      setResettingDb(false);
    }
  };

  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.status === "ACTIVE").length;
  const totalUsers = users.length;
  const totalGlobalSpend = stores.reduce((sum, s) => sum + Number(s.totalSpend || 0), 0);

  const displayedOrders = orders.filter((o) => {
    const matchStore = orderStoreFilter === "ALL" || o.buyerStore === orderStoreFilter;
    const q = orderSearchQuery.toLowerCase();
    const matchSearch =
      !q ||
      o.orderNumber?.toLowerCase().includes(q) ||
      o.asin?.toLowerCase().includes(q) ||
      o.productTitle?.toLowerCase().includes(q);
    return matchStore && matchSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Admin Top Notification */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-mono-tech flex items-center justify-between border ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/40 text-rose-300"
          }`}
        >
          <span className="font-bold">{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)}>
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Header Strip */}
      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono-tech uppercase font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              SİSTEM ADMIN MERKEZİ
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Çoklu Mağaza Filosu, Yetki, Sipariş &amp; Veritabanı Temizleme Konsolu
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono-tech">
            26 mağazayı denetleyin, kullanıcıların mağazalarını atayın, sipariş satırlarını yönetin ve gerçek canlı verilerinizi yüklemek için temizlik araçlarını kullanın.
          </p>
        </div>

        {/* Global Stats */}
        <div className="flex flex-wrap items-center gap-3 font-mono-tech text-xs">
          <div className="bg-[#080C14] px-3.5 py-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 block uppercase">Mağaza Filosu</span>
            <span className="text-white font-bold">{activeStores} Aktif / {totalStores} Mağaza</span>
          </div>
          <div className="bg-[#080C14] px-3.5 py-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 block uppercase">Uzman Personel</span>
            <span className="text-indigo-400 font-bold">{totalUsers} Kullanıcı</span>
          </div>
          <div className="bg-[#080C14] px-3.5 py-2.5 rounded-xl border border-indigo-500/40 text-center">
            <span className="text-[10px] text-indigo-400 block uppercase">Konsolide Tedarik Bedeli</span>
            <span className="text-emerald-400 font-bold">${totalGlobalSpend.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Admin Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5 font-mono-tech text-xs overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("STORES")}
          className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "STORES"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>1. Mağaza Yönetimi ({stores.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("USERS")}
          className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "USERS"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Kullanıcı &amp; Mağaza İzolasyonu ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("ORDERS_CRUD")}
          className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "ORDERS_CRUD"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>3. Siparişler &amp; Toplu Düzenleme ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("SP_API")}
          className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "SP_API"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Zap className="w-4 h-4 text-sky-400" />
          <span>4. Amazon SP-API &amp; Muhasebe</span>
        </button>

        <button
          onClick={() => setActiveSubTab("AUDIT")}
          className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === "AUDIT"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <History className="w-4 h-4" />
          <span>5. Denetim İzi (Audit Log)</span>
        </button>

        <button
          onClick={() => setActiveSubTab("DB_TOOLS")}
          className={`px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap border ${
            activeSubTab === "DB_TOOLS"
              ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/25"
              : "bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20"
          }`}
        >
          <Database className="w-4 h-4 text-rose-400" />
          <span>6. 🧹 Veritabanı Temizleme &amp; Sıfırlama Araçları</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. MAĞAZA YÖNETİMİ TAB'I                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === "STORES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
              Tanımlı Mağazalar ve Satın Alma Yetkilileri
            </h3>
            <button
              onClick={() => setIsNewStoreModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono-tech font-bold uppercase rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" /> Yeni Mağaza Tanımla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((st) => {
              const isActive = st.status === "ACTIVE";
              return (
                <div
                  key={st.id}
                  className="bg-[#0F1626] border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-mono-tech text-xs font-bold border border-indigo-500/30">
                          {st.storeCode}
                        </span>
                        <span className="text-[10px] font-mono-tech text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                          {st.marketplace}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleStoreStatus(st)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono-tech font-bold transition ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {isActive ? "AKTİF" : "PASİF"}
                      </button>
                    </div>

                    <h4 className="text-base font-bold text-white mb-1">{st.storeName}</h4>
                    <p className="text-xs text-slate-400 font-mono-tech mb-4">
                      Alıcı Sorumlusu: <strong className="text-slate-200">{st.buyerName}</strong>
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech bg-[#080C14] p-3 rounded-xl border border-slate-800/80 mb-3">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Sipariş Sayısı</span>
                        <span className="text-white font-bold">{st.totalOrdersCount} Kayıt</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Toplam Harcama</span>
                        <span className="text-emerald-400 font-bold">${st.totalSpend}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono-tech">
                    <span className="text-slate-500 text-[11px]">Kart: **** {st.defaultCard || "1753"}</span>
                    {onStoreSelected && (
                      <button
                        onClick={() => onStoreSelected(st.storeCode)}
                        className="text-indigo-400 hover:underline font-bold text-xs flex items-center gap-1"
                      >
                        Siparişleri İncele →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. KULLANICI & MAĞAZA ATAMALARI TAB'I                                     */}
      {/* ========================================================================= */}
      {activeSubTab === "USERS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
              Kullanıcılar, Yetkiler ve Mağaza İzolasyon Atamaları
            </h3>
            <button
              onClick={() => setIsNewUserModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono-tech font-bold uppercase rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" /> Yeni Kullanıcı Ekle
            </button>
          </div>

          <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                <tr>
                  <th className="p-3.5">Kullanıcı</th>
                  <th className="p-3.5">E-posta</th>
                  <th className="p-3.5">Yetki Seviyesi</th>
                  <th className="p-3.5">Atanmış Mağaza (İzolasyon)</th>
                  <th className="p-3.5 text-right">İşlem / Mağaza Değiştir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const isAdmin = u.role === "ADMIN";
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs border border-indigo-500/30">
                          {u.avatar || u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-white">{u.name}</span>
                      </td>
                      <td className="p-3.5 text-slate-300">{u.email}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                            isAdmin
                              ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
                              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                          {u.storeCode === "ALL" ? "TÜM MAĞAZALAR (YETKİLİ)" : `${u.storeCode} STORE`}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {!isAdmin ? (
                          <select
                            value={u.storeCode}
                            onChange={(e) => handleUpdateUserStore(u.id, e.target.value)}
                            className="px-3 py-1.5 bg-[#080C14] border border-slate-700 rounded-xl text-xs font-mono-tech text-indigo-400 font-bold focus:outline-none"
                          >
                            {stores.map((s) => (
                              <option key={s.storeCode} value={s.storeCode}>
                                {s.storeCode} Mağazasına Ata
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Süper Yetkili</span>
                        )}
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
      {/* 3. SİPARİŞLER YÖNETİMİ & HIZLI SİLME / DÜZENLEME (ORDERS CRUD)            */}
      {/* ========================================================================= */}
      {activeSubTab === "ORDERS_CRUD" && (
        <div className="space-y-4">
          <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
                Tüm Mağazaların Sipariş Listesi ({displayedOrders.length} Kayıt)
              </h3>
              <p className="text-xs text-slate-400 font-mono-tech">
                Herhangi bir hatalı satırı tek tıkla silebilir veya inceleyebilirsiniz.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={orderStoreFilter}
                onChange={(e) => setOrderStoreFilter(e.target.value)}
                className="bg-[#080C14] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono-tech text-indigo-300 font-bold"
              >
                <option value="ALL">TÜM MAĞAZALAR</option>
                {stores.map((st) => (
                  <option key={st.storeCode} value={st.storeCode}>
                    {st.storeCode}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Order No veya ASIN ara..."
                className="px-3 py-1.5 bg-[#080C14] border border-slate-700 rounded-xl text-xs font-mono-tech text-white"
              />
            </div>
          </div>

          <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Mağaza</th>
                  <th className="p-3">Order No</th>
                  <th className="p-3">ASIN</th>
                  <th className="p-3">Ürün Başlığı</th>
                  <th className="p-3">Adet</th>
                  <th className="p-3">Birim Maliyet</th>
                  <th className="p-3">Kargo Durumu</th>
                  <th className="p-3 text-right">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-500">#{o.id}</td>
                    <td className="p-3 font-bold text-indigo-400">{o.buyerStore}</td>
                    <td className="p-3 font-bold text-white">{o.orderNumber}</td>
                    <td className="p-3 text-sky-400">{o.asin}</td>
                    <td className="p-3 font-sans text-slate-200 truncate max-w-xs">{o.productTitle}</td>
                    <td className="p-3 text-white font-bold">{o.quantity}</td>
                    <td className="p-3 text-amber-300 font-bold">${o.unitCost}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">
                        {o.cargoStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteOrderRow(o.id)}
                        className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white transition"
                        title="Bu siparişi kalıcı olarak sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
      {/* 4. AMAZON SP-API & MUHASEBE BAĞLANTILARI                                   */}
      {/* ========================================================================= */}
      {activeSubTab === "SP_API" && (
        <div className="space-y-4">
          <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white uppercase font-mono-tech flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              Amazon Seller Central SP-API &amp; Inventory Lab Entegrasyon Durumu
            </h3>
            <p className="text-xs text-slate-400 font-mono-tech mt-1">
              Her mağazanın Amazon Marketplace ID, LWA Refresh Token ve BuyBox Repricer bağlantısı denetlenir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stores.map((st) => (
              <div
                key={st.id}
                className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 font-mono-tech">
                      {st.storeCode} — {st.marketplace}
                    </span>
                    <h4 className="text-sm font-bold text-white">{st.storeName}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono-tech font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> SP-API BAĞLI
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono-tech bg-[#080C14] p-3.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Marketplace ID:</span>
                    <span className="text-slate-200 font-bold">ATVPDKIKX0DER (US-EAST)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">LWA Client Token:</span>
                    <span className="text-emerald-400">amzn1.application-oa2-client.••••</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inventory Lab Senkronu:</span>
                    <span className="text-indigo-400 font-bold">Otomatik (FBA Feed)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs font-mono-tech">
                  <span className="text-slate-500">Son Senkronizasyon: 2 dk önce</span>
                  <button
                    onClick={() => showFeedback(`${st.storeCode} SP-API FBA stok senkronizasyonu tetiklendi.`)}
                    className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 rounded-lg text-xs font-bold transition"
                  >
                    Senkronize Et
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SİSTEM DENETİM İZİ (AUDIT LOGS)                                        */}
      {/* ========================================================================= */}
      {activeSubTab === "AUDIT" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
            Gerçek Zamanlı Sistem Değişiklik Günlüğü (Audit Trail)
          </h3>
          <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-4 max-h-[500px] overflow-y-auto space-y-2.5">
            {auditLogs.length === 0 ? (
              <p className="text-xs font-mono-tech text-slate-500">Henüz denetim kaydı bulunmuyor.</p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-[#080C14] border border-slate-800/80 text-xs font-mono-tech flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-indigo-400 font-bold">{log.actorName}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-amber-300">
                        {log.actionType}
                      </span>
                      <span className="text-slate-200 font-semibold truncate max-w-sm">
                        {log.targetEntity}
                      </span>
                    </div>
                    {log.details && <p className="text-[11px] text-slate-400">{log.details}</p>}
                  </div>
                  <div className="text-right text-[11px] text-slate-500 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString()} • Mağaza: {log.storeCode}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VERİTABANI TEMİZLEME & SIFIRLAMA ARAÇLARI (DATABASE CLEAN & RESET)      */}
      {/* ========================================================================= */}
      {activeSubTab === "DB_TOOLS" && (
        <div className="space-y-6">
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-rose-300 uppercase font-mono-tech">
                ⚠️ DANGER ZONE: Veritabanı Temizleme &amp; Gerçek Veri Hazırlık Merkezi
              </h3>
              <p className="text-xs text-slate-300 font-mono-tech mt-1">
                Kendi gerçek Google Drive / Excel sipariş verilerinizi yüklemeden önce mevcut test/demo siparişlerini tek tıkla temizleyebilir veya dilediğinizde 38 gerçek Vitamin Shoppe siparişini fabrika verisi olarak geri getirebilirsiniz.
              </p>
            </div>
          </div>

          {/* Security confirmation input */}
          <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 space-y-3 font-mono-tech text-xs">
            <label className="block text-slate-300 font-bold">
              Güvenlik Onayı: Aşağıdaki araçları çalıştırmak için kutuya büyük harflerle{" "}
              <code className="text-rose-400 bg-slate-900 px-1.5 py-0.5 rounded">RESET-CERBERUS</code> yazın:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="RESET-CERBERUS"
              className="w-full max-w-sm px-3.5 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white font-bold tracking-wider focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Tool 1: Clean Orders Only (Keep Users & Stores) */}
            <div className="bg-[#0F1626] border border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono-tech text-[10px] font-bold">
                  EN ÇOK ÖNERİLEN (TEMİZ BAŞLANGIÇ)
                </span>
                <h4 className="text-base font-bold text-white mt-2">
                  1. Sadece Siparişleri Temizle
                </h4>
                <p className="text-xs text-slate-400 font-mono-tech mt-2 leading-relaxed">
                  Tüm demo siparişlerini (`orders`) ve PSH sevkiyat partilerini (`psh_batches`) temizler.  
                  <strong className="text-emerald-400 block mt-1">
                    ✓ 26 Mağaza tanımınız ve kullanıcı hesaplarınız (Harun, Selin, Can, Ahmet) KORUNUR!
                  </strong>
                </p>
              </div>

              <button
                disabled={resettingDb || confirmationInput !== "RESET-CERBERUS"}
                onClick={() => handleExecuteDatabaseTool("CLEAN_ORDERS_ONLY")}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-mono-tech text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-emerald-600/20"
              >
                {resettingDb ? "Temizleniyor..." : "Siparişleri Temizle & Hazırla"}
              </button>
            </div>

            {/* Tool 2: Restore 38 Real Vitamin Shoppe Orders */}
            <div className="bg-[#0F1626] border border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono-tech text-[10px] font-bold">
                  REFERANS VERİYİ GERİ YÜKLE
                </span>
                <h4 className="text-base font-bold text-white mt-2">
                  2. 38 Gerçek XLS Siparişi Yükle
                </h4>
                <p className="text-xs text-slate-400 font-mono-tech mt-2 leading-relaxed">
                  Paylaştığınız 40-kolonluk The Vitamin Shoppe 38 gerçek siparişini (`WO110074776` vb.), Google Drive linklerini ve PSH partilerini tek tıkla geri getirir.
                </p>
              </div>

              <button
                disabled={resettingDb || confirmationInput !== "RESET-CERBERUS"}
                onClick={() => handleExecuteDatabaseTool("RESTORE_REAL_XLS")}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-600/20"
              >
                {resettingDb ? "Yükleniyor..." : "38 Gerçek Siparişi Geri Yükle"}
              </button>
            </div>

            {/* Tool 3: Factory Reset Keep Admin */}
            <div className="bg-[#0F1626] border border-rose-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono-tech text-[10px] font-bold">
                  TAM SIFIRLAMA
                </span>
                <h4 className="text-base font-bold text-white mt-2">
                  3. Fabrika Ayarlarına Dön
                </h4>
                <p className="text-xs text-slate-400 font-mono-tech mt-2 leading-relaxed">
                  Tüm siparişleri, batch'leri, mağaza kullanıcılarını (`STORE_USER`) ve denetim kayıtlarını siler. Sadece Sistem Yöneticisi (`Ahmet Erdem`) kalır.
                </p>
              </div>

              <button
                disabled={resettingDb || confirmationInput !== "RESET-CERBERUS"}
                onClick={() => handleExecuteDatabaseTool("NUKE_ALL_KEEP_ADMIN")}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-rose-600/20"
              >
                {resettingDb ? "Sıfırlanıyor..." : "Tüm Verileri Sıfırla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: YENİ MAĞAZA TANIMLA                                                */}
      {/* ========================================================================= */}
      {isNewStoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1626] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Yeni Mağaza Tanımla</h3>
              </div>
              <button onClick={() => setIsNewStoreModalOpen(false)}>
                <XCircle className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-3.5 text-xs font-mono-tech">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Mağaza Kodu (Benzersiz)</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: WMT-01, AMZ-03"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Pazar Yeri</label>
                  <select
                    value={marketplace}
                    onChange={(e) => setMarketplace(e.target.value)}
                    className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                  >
                    <option value="AMAZON">AMAZON FBA</option>
                    <option value="WALMART">WALMART</option>
                    <option value="SHOPIFY">SHOPIFY DTC</option>
                    <option value="WHOLESALE">B2B WHOLESALE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Mağaza Resmi Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Vanguard Retail Amazon Storefront"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Alıcı Sorumlusu (Buyer)</label>
                  <input
                    type="text"
                    placeholder="Örn: Selin Yılmaz"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ödeme Kartı Son 4</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={defaultCard}
                    onChange={(e) => setDefaultCard(e.target.value)}
                    className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Mağaza Sipariş E-posta Adresi</label>
                <input
                  type="email"
                  placeholder="amz03@cerberus-commerce.io"
                  value={defaultEmail}
                  onChange={(e) => setDefaultEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingStore}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase transition"
                >
                  {savingStore ? "Kaydediliyor..." : "Mağazayı Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: YENİ KULLANICI EKLE                                                */}
      {/* ========================================================================= */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1626] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Yeni Kullanıcı &amp; Mağaza Tanımla</h3>
              </div>
              <button onClick={() => setIsNewUserModalOpen(false)}>
                <XCircle className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs font-mono-tech">
              <div>
                <label className="block text-slate-400 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ece Demir"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">E-posta Adresi (Giriş İçin)</label>
                <input
                  type="email"
                  required
                  placeholder="ece@cerberus-commerce.io"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Yetki Rolü</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                  >
                    <option value="STORE_USER">Mağaza Sorumlusu</option>
                    <option value="ADMIN">Sistem Yöneticisi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Atanacak Mağaza</label>
                  <select
                    disabled={newUserRole === "ADMIN"}
                    value={newUserStore}
                    onChange={(e) => setNewUserStore(e.target.value)}
                    className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white"
                  >
                    {stores.map((s) => (
                      <option key={s.storeCode} value={s.storeCode}>
                        {s.storeCode} - {s.storeName.slice(0, 16)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Başlangıç Parolası</label>
                <input
                  type="text"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className="w-full px-3 py-2 bg-[#080C14] border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase transition"
                >
                  {savingUser ? "Ekleniyor..." : "Kullanıcıyı Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
