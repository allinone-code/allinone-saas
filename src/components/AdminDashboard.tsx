"use client";

import React, { useState, useEffect } from "react";
import {
  Store,
  Users,
  ShieldCheck,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Building2,
  FileText,
  DollarSign,
  Lock,
  Search,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  History,
} from "lucide-react";

interface AdminDashboardProps {
  onStoreSelected?: (storeCode: string) => void;
  currentUser: any;
}

export function AdminDashboard({ onStoreSelected, currentUser }: AdminDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"STORES" | "USERS" | "AUDIT">("STORES");
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [newUserPass, setNewUserPass] = useState("store2026");
  const [savingUser, setSavingUser] = useState(false);

  // Status message
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
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
    } catch (err: any) {
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

  const handleUpdateUserStore = async (userId: number, targetStore: string, currentRole: string) => {
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
    } catch (err: any) {
      showFeedback("Güncelleme başarısız", "error");
    }
  };

  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.status === "ACTIVE").length;
  const totalUsers = users.length;
  const totalGlobalSpend = stores.reduce((sum, s) => sum + Number(s.totalSpend || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Admin Top Notification */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-mono-tech flex items-center justify-between border ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)}>
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Header Strip */}
      <div className="bg-[#121A2C] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-tech uppercase font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              YÖNETİCİ KONSOLU
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Admin &amp; Çoklu Mağaza Yetki Yönetimi
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono-tech">
            Yeni mağaza tanımlayın, kullanıcıların mağaza erişimlerini sınırlayın ve sistem denetim izini inceleyin.
          </p>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-3 font-mono-tech text-xs">
          <div className="bg-[#0B101E] px-3 py-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 block">Kayıtlı Mağaza</span>
            <span className="text-white font-bold">{activeStores} Aktif / {totalStores}</span>
          </div>
          <div className="bg-[#0B101E] px-3 py-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 block">Kullanıcılar</span>
            <span className="text-sky-400 font-bold">{totalUsers} Personel</span>
          </div>
          <div className="bg-[#0B101E] px-3 py-2 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 block">Konsolide Harcama</span>
            <span className="text-emerald-400 font-bold">${totalGlobalSpend.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Admin Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 font-mono-tech text-xs">
        <button
          onClick={() => setActiveSubTab("STORES")}
          className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 ${
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
          className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 ${
            activeSubTab === "USERS"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Kullanıcı &amp; Mağaza Atamaları ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("AUDIT")}
          className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-2 ${
            activeSubTab === "AUDIT"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <History className="w-4 h-4" />
          <span>3. Sistem Denetim İzi (Audit Logs)</span>
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
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono-tech font-bold uppercase rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni Mağaza Tanımla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {stores.map((st) => {
              const isActive = st.status === "ACTIVE";
              return (
                <div
                  key={st.id}
                  className="bg-[#121A2C] border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4 flex flex-col justify-between transition"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-mono-tech text-xs font-bold border border-indigo-500/30">
                          {st.storeCode}
                        </span>
                        <span className="text-[10px] font-mono-tech text-slate-400">
                          {st.marketplace}
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleStoreStatus(st)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold transition ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {isActive ? "AKTİF" : "PASİF"}
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-white mb-1">{st.storeName}</h4>
                    <p className="text-xs text-slate-400 font-mono-tech mb-3">
                      Alıcı Sorumlusu: <strong className="text-slate-200">{st.buyerName}</strong>
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono-tech bg-[#0B101E] p-2.5 rounded-xl border border-slate-800/80 mb-3">
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

                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-mono-tech">
                    <span className="text-slate-500 text-[11px]">Kart: **** {st.defaultCard || "1753"}</span>
                    {onStoreSelected && (
                      <button
                        onClick={() => onStoreSelected(st.storeCode)}
                        className="text-indigo-400 hover:underline font-bold text-xs"
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
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono-tech font-bold uppercase rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni Kullanıcı Ekle
            </button>
          </div>

          <div className="bg-[#121A2C] border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#0B101E] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
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
                      <td className="p-3.5 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs">
                          {u.avatar || u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-white">{u.name}</span>
                      </td>
                      <td className="p-3.5 text-slate-300">{u.email}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                            isAdmin
                              ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                              : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-white px-2 py-0.5 rounded bg-slate-800">
                          {u.storeCode === "ALL" ? "TÜM MAĞAZALAR (YETKİLİ)" : `${u.storeCode} STORE`}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {!isAdmin ? (
                          <select
                            value={u.storeCode}
                            onChange={(e) => handleUpdateUserStore(u.id, e.target.value, u.role)}
                            className="px-2 py-1 bg-[#0B101E] border border-slate-700 rounded-lg text-xs font-mono-tech text-sky-400 font-semibold focus:outline-none"
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
      {/* 3. SİSTEM DENETİM İZİ (AUDIT LOGS)                                        */}
      {/* ========================================================================= */}
      {activeSubTab === "AUDIT" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase font-mono-tech">
            Gerçek Zamanlı Sistem Değişiklik Günlüğü (Audit Trail)
          </h3>
          <div className="bg-[#121A2C] border border-slate-800 rounded-2xl p-4 max-h-[500px] overflow-y-auto space-y-2.5">
            {auditLogs.length === 0 ? (
              <p className="text-xs font-mono-tech text-slate-500">Henüz denetim kaydı bulunmuyor.</p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#0B101E] border border-slate-800/80 text-xs font-mono-tech flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-indigo-400 font-bold">{log.actorName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-amber-300">
                        {log.actionType}
                      </span>
                      <span className="text-slate-300 font-semibold truncate max-w-sm">
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
      {/* MODAL: YENİ MAĞAZA TANIMLA                                                */}
      {/* ========================================================================= */}
      {isNewStoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121A2C] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
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
                    className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Pazar Yeri</label>
                  <select
                    value={marketplace}
                    onChange={(e) => setMarketplace(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
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
                  className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
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
                    className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ödeme Kartı Son 4</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={defaultCard}
                    onChange={(e) => setDefaultCard(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white font-bold"
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
                  className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
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
          <div className="bg-[#121A2C] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
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
                  className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
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
                  className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Yetki Rolü</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
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
                    className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white"
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
                  className="w-full px-3 py-2 bg-[#0B101E] border border-slate-700 rounded-xl text-white font-bold"
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
