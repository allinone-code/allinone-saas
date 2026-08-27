"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Store,
  UserCheck,
  KeyRound,
  Sparkles,
  Info,
} from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    name: "Ahmet Erdem",
    roleLabel: "SİSTEM YÖNETİCİSİ (ADMIN)",
    email: "ahmet@cerberus-commerce.io",
    password: "admin2026",
    storeCode: "TÜM MAĞAZALAR (ALL)",
    badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    desc: "Tüm 26 mağazayı görür, yeni mağaza ve kullanıcı tanımlayabilir, küresel denetim izini yönetir.",
  },
  {
    name: "Harun",
    roleLabel: "MAĞAZA YÖNETİCİSİ (HRN STORE)",
    email: "harun@cerberus-commerce.io",
    password: "store2026",
    storeCode: "HRN STORE",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    desc: "Yalnızca HRN mağazasının siparişlerini, Google Drive faturalarını ve PSH batch'lerini görür.",
  },
  {
    name: "Selin Yılmaz",
    roleLabel: "MAĞAZA YÖNETİCİSİ (SEL STORE)",
    email: "selin@cerberus-commerce.io",
    password: "store2026",
    storeCode: "SEL STORE",
    badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    desc: "Yalnızca SEL mağazasının ürünlerini ve sipariş süreçlerini yönetebilir.",
  },
  {
    name: "Can Demir",
    roleLabel: "MAĞAZA YÖNETİCİSİ (MK STORE)",
    email: "can@cerberus-commerce.io",
    password: "store2026",
    storeCode: "MK STORE",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    desc: "Yalnızca MK mağazasına yetkilidir, diğer mağazalara erişemez.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("ahmet@cerberus-commerce.io");
  const [password, setPassword] = useState("admin2026");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const submitEmail = customEmail || email;
    const submitPassword = customPass || password;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submitEmail, password: submitPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMsg(data.error || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  const handleQuickDemoSelect = (account: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    handleLogin(undefined, account.email, account.password);
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-indigo-500/30 font-sans">
      <div className="w-full max-w-4xl space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-emerald-500 shadow-xl shadow-indigo-500/20 mb-2">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
            CERBERUS COMMERCE
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-mono-tech max-w-md mx-auto">
            Çoklu Mağaza İzolasyonu &amp; Operasyonel Komuta Merkezi
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Login Card (5 cols) */}
          <div className="lg:col-span-5 bg-[#121A2C] border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Kullanıcı Girişi</h2>
              <p className="text-xs text-slate-400 mt-1">
                Yetkinize göre atanmış mağaza paneline yönlendirileceksiniz.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono-tech flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={(e) => handleLogin(e)} className="space-y-4 text-xs font-mono-tech">
              <div>
                <label className="block text-slate-300 uppercase tracking-wider text-[11px] mb-1.5 font-bold">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@cerberus-commerce.io"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0B101E] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 uppercase tracking-wider text-[11px] mb-1.5 font-bold">
                  Parola
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#0B101E] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  "Doğrulanıyor..."
                ) : (
                  <>
                    <span>Güvenli Giriş Yap</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono-tech">
              <span>RBAC &amp; Store Isolated</span>
              <span>v2.4 Production</span>
            </div>
          </div>

          {/* Quick 1-Click Demo Accounts (7 cols) */}
          <div className="lg:col-span-7 bg-[#121A2C] border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono-tech tracking-wider">
                  1-Tıkla Test Hesapları (Yetki &amp; İzolasyon)
                </h3>
              </div>
              <span className="text-[10px] font-mono-tech text-slate-400">Tıklayınca doğrudan girer</span>
            </div>

            <div className="space-y-3">
              {DEMO_ACCOUNTS.map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleQuickDemoSelect(acc)}
                  className="p-3.5 rounded-xl bg-[#0B101E] border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold border ${acc.badgeColor}`}>
                        {acc.roleLabel}
                      </span>
                      <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                        {acc.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {acc.desc}
                    </p>
                    <span className="text-[10px] font-mono-tech text-slate-500 block">
                      {acc.email} • Şifre: {acc.password}
                    </span>
                  </div>

                  <div className="shrink-0 ml-3 pl-3 border-l border-slate-800">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500 text-indigo-400 group-hover:text-white text-[11px] font-mono-tech font-bold flex items-center gap-1 transition">
                      Giriş <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] font-mono-tech text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>Güvenlik Prensibi:</strong> Giriş yaptığınız kullanıcının rolü <code>STORE_USER</code> ise, sistem arka uçta (server-side) tüm siparişleri ve PSH partilerini kullanıcının mağaza koduyla sınırlar. Başka mağazanın verisi kesinlikle sızmaz.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
