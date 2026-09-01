"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Store,
  LogOut,
  Users,
  Settings,
  Lock,
  Database,
  CheckCircle2,
} from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            if (data.user.role !== "ADMIN" && data.user.role !== "MANAGER") {
              // Non-admin trying to access /admin -> redirect to home
              router.push("/");
              return;
            }
            setCurrentUser(data.user);
          } else {
            router.push("/login");
            return;
          }
        } else {
          router.push("/login");
          return;
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    verifyUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center text-slate-400 font-mono-tech">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span>YÖNETİCİ KONSOLU DOĞRULANIYOR...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080C14] bg-tactical-grid text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0F1626]/95 backdrop-blur-md sticky top-0 z-30 px-5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-mono-tech text-slate-200 border border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ana Dashboard&rsquo;a Dön</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-indigo-500/20">
              C
            </div>
            <div>
              <span className="font-display font-bold text-sm tracking-wide text-white block leading-none">
                CERBERUS ADMIN
              </span>
              <span className="text-[10px] text-slate-400 font-mono-tech">
                Süper Yönetici &amp; Veritabanı Konsolu
              </span>
            </div>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block leading-tight">
              {currentUser?.name || "Ahmet Erdem"}
            </span>
            <span className="text-[10px] font-mono-tech text-indigo-400 font-bold block">
              SİSTEM YÖNETİCİSİ (ADMIN)
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
      </header>

      {/* Main Container */}
      <main className="flex-1 p-5 sm:p-6 max-w-[1700px] w-full mx-auto space-y-6">
        <AdminDashboard
          currentUser={currentUser}
          onStoreSelected={(storeCode) => {
            router.push(`/?store=${storeCode}&tab=XLS_MASTER`);
          }}
        />
      </main>
    </div>
  );
}
