"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Store,
  KeyRound,
  Sparkles,
  Info,
  Server,
  Activity,
  CheckCircle2,
  Terminal,
} from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    name: "Ahmet Erdem",
    roleLabel: "SİSTEM YÖNETİCİSİ (ADMIN)",
    email: "ahmet@cerberus-commerce.io",
    password: "admin2026",
    storeCode: "TÜM MAĞAZALAR (ALL)",
    badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
    desc: "Tüm 26 mağazayı denetler, yeni mağaza/kullanıcı açar, SP-API token'larını ve denetim loglarını yönetir.",
  },
  {
    name: "Harun",
    roleLabel: "MAĞAZA YÖNETİCİSİ (HRN STORE)",
    email: "harun@cerberus-commerce.io",
    password: "store2026",
    storeCode: "HRN STORE",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    desc: "Yalnızca HRN mağazasının 38 siparişini, Google Drive faturalarını ve PSH batch'lerini görür.",
  },
  {
    name: "Selin Yılmaz",
    roleLabel: "MAĞAZA YÖNETİCİSİ (SEL STORE)",
    email: "selin@cerberus-commerce.io",
    password: "store2026",
    storeCode: "SEL STORE",
    badgeColor: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    desc: "Yalnızca SEL mağazasının ürünlerini, depo karşılama ve kârlılık süreçlerini yönetebilir.",
  },
  {
    name: "Can Demir",
    roleLabel: "MAĞAZA YÖNETİCİSİ (MK STORE)",
    email: "can@cerberus-commerce.io",
    password: "store2026",
    storeCode: "MK STORE",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    desc: "Yalnızca MK mağazasına yetkilidir; diğer mağaza ciro ve siparişlerine erişemez.",
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
        if (data.user?.role === "ADMIN") {
          router.push("/?tab=admin");
        } else {
          router.push("/");
        }
        router.refresh();
      } else {
        setErrorMsg(data.error || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
        setLoading(false);
      }
    } catch {
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
    <div className="min-h-screen bg-[#080C14] bg-tactical-grid text-slate-100 flex flex-col justify-center items-center px-4 py-10 selection:bg-indigo-500/30 font-sans">
      <div className="w-full max-w-5xl space-y-7">
        {/* System Status & Brand Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-emerald-500 shadow-xl shadow-indigo-500/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-bold tracking-wider text-white">
                  CERBERUS COMMERCE
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  ENTERPRISE v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono-tech">
                Çoklu Mağaza İzolasyonu • US Retail Arbitrage &amp; Amazon FBA Komuta Merkezi
              </p>
            </div>
          </div>

          {/* Live System Diagnostics Micro-Bar */}
          <div className="flex items-center gap-3 text-[11px] font-mono-tech bg-[#0F1626] border border-slate-800/90 rounded-xl px-3.5 py-2">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              AMAZON SP-API LIVE
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-300">NJ PREP WAREHOUSE: ONLINE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Login Form Card (5 cols) */}
          <div className="lg:col-span-5 bg-[#0F1626] border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white tracking-tight">Yetkili Oturum Açma</h2>
                <span className="text-[10px] font-mono-tech text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" /> SSL / TLS 1.3
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Atandığınız mağazanın (`storeCode`) izole veritabanı paneline erişin.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-mono-tech flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={(e) => handleLogin(e)} className="space-y-4 text-xs font-mono-tech">
              <div>
                <label className="block text-slate-300 uppercase tracking-wider text-[11px] mb-1.5 font-bold">
                  Kurumsal E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@cerberus-commerce.io"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition"
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
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#080C14] border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition"
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
                    <span>Komuta Merkezine Bağlan</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400 font-mono-tech">
              <div className="flex items-center justify-between">
                <span>Mağaza İzolasyon Motoru</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> AKTİF
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Veritabanı: PostgreSQL (Neon)</span>
                <span className="text-sky-400 font-bold">40-Kolon XLS Schema</span>
              </div>
            </div>
          </div>

          {/* Quick 1-Click Demo Accounts (7 cols) */}
          <div className="lg:col-span-7 bg-[#0F1626] border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono-tech tracking-wider">
                  1-Tıkla Test Giriş Rolleri (Anında Geçiş)
                </h3>
              </div>
              <span className="text-[10px] font-mono-tech text-slate-400">Tek tıklama ile oturum açar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleQuickDemoSelect(acc)}
                  className="p-4 rounded-xl bg-[#080C14] border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold border ${acc.badgeColor}`}>
                        {acc.roleLabel}
                      </span>
                      <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                        {acc.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                      {acc.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono-tech">
                    <span className="text-slate-400 truncate max-w-[170px]">{acc.email}</span>
                    <span className="text-indigo-400 group-hover:text-white font-bold flex items-center gap-1 transition">
                      Giriş <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono-tech text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Çoklu Mağaza Veri Güvencesi:</strong> Bir mağaza sorumlusu (örneğin Harun veya Selin) giriş yaptığında, sunucu API'si tüm siparişleri ve PSH partilerini kullanıcının kimlik token'ındaki <code>storeCode</code> ile filtreler.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
