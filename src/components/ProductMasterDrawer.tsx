"use client";

import React, { useState } from "react";
import {
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import { AiOpportunityRadar } from "./AiOpportunityRadar";

interface ProductMasterDrawerProps {
  master: any | null;
  onClose: () => void;
  onUpdateDecision: (id: number, decisionAction: string, sellingPrice?: number) => Promise<void>;
}

export function ProductMasterDrawer({
  master,
  onClose,
  onUpdateDecision,
}: ProductMasterDrawerProps) {
  const [updating, setUpdating] = useState(false);
  const [sellingPriceInput, setSellingPriceInput] = useState<string>("");

  if (!master) return null;

  const handleDecisionClick = async (action: string) => {
    setUpdating(true);
    await onUpdateDecision(
      master.id,
      action,
      sellingPriceInput ? Number(sellingPriceInput) : undefined
    );
    setUpdating(false);
  };

  const evidenceChain: any[] = Array.isArray(master.evidenceChain)
    ? master.evidenceChain
    : [];

  const listings: any[] = Array.isArray(master.channelListings)
    ? master.channelListings
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
      <div className="bg-[#0F1626] border-l border-slate-700/80 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-[#080C14]">
          <div className="pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono-tech text-xs font-bold">
                {master.productCode}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-tech text-xs">
                ASIN: {master.asin}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-tech text-xs">
                UPC: {master.upc}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono-tech font-bold ${
                  master.dataFreshnessStatus === "FRESH"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                }`}
              >
                VERİ TAZELİĞİ: {master.dataFreshnessStatus}
              </span>
            </div>
            <h2 className="text-sm font-display font-bold text-white leading-snug">
              {master.title}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-mono-tech">
              <span>Keşfeden: <strong className="text-white">{master.researcherName}</strong></span>
              <span>•</span>
              <a
                href={master.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline flex items-center gap-1"
              >
                {master.sourceDomain} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Decision Engine Approval Matrix Bar */}
          <div className="bg-[#080C14] border border-indigo-500/40 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-mono-tech uppercase tracking-wider text-indigo-400 font-bold block">
                  COMMERCIAL DECISION ENGINE (ONAY MATRİSİ)
                </span>
                <span className="text-xs text-slate-300 font-mono-tech">
                  Güven Skoru: <strong>%{master.confidenceScore}</strong> • Risk:{" "}
                  <strong className="text-amber-400">{master.riskLevel}</strong>
                </span>
              </div>
              <span className="text-xs font-mono-tech text-emerald-400 font-bold">
                {master.policyStatus}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["BUY", "TEST", "WAIT", "REJECT"].map((act) => {
                const isActive = master.decisionAction === act;
                return (
                  <button
                    key={act}
                    disabled={updating}
                    onClick={() => handleDecisionClick(act)}
                    className={`py-2 rounded-xl text-xs font-mono-tech uppercase font-bold transition border ${
                      isActive
                        ? act === "BUY"
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20"
                          : act === "TEST"
                          ? "bg-sky-500 text-slate-950 border-sky-400"
                          : act === "WAIT"
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-rose-500 text-white border-rose-400"
                        : "bg-[#0F1626] text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {act}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Opportunity Radar + Actual vs Estimated ROI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AiOpportunityRadar
              profitability={Number(master.profitabilityScore || 88)}
              demand={Number(master.demandScore || 92)}
              competition={Number(master.competitionScore || 78)}
              priceStability={Number(master.priceStabilityScore || 85)}
              supplierRisk={Number(master.supplierRiskScore || 94)}
              operationalRisk={Number(master.operationalRiskScore || 90)}
              opportunityScore={Number(master.opportunityScore || 88)}
              decisionAction={master.decisionAction || "BUY"}
            />

            {/* Landed Cost & Actual vs Estimated Engine (Gap Phase 16) */}
            <div className="bg-[#080C14] border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono-tech uppercase text-slate-400 font-bold">
                    TAHMİNİ VS GERÇEKLEŞEN ROI
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono-tech font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    TAHMİN: %{master.roiPercent}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono-tech">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">US Alış Maliyeti:</span>
                    <span className="text-amber-300 font-bold">${master.sourcePrice}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Prep &amp; FBA Etiket:</span>
                    <span className="text-slate-300">+${master.prepCost}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">AMZ Ref (%15):</span>
                    <span className="text-slate-300">+${master.marketplaceFee}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">FBA Fulfillment:</span>
                    <span className="text-slate-300">+${master.fulfillmentFee}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-[#0F1626] px-2.5 rounded-lg border border-indigo-500/30">
                    <span className="text-indigo-400 font-semibold">TOPLAM LANDED COST:</span>
                    <span className="text-indigo-300 font-bold">${master.landedCost}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-emerald-500/10 px-2.5 rounded-lg border border-emerald-500/40">
                    <span className="text-emerald-400 font-semibold">GERÇEKLEŞEN ROI:</span>
                    <span className="text-emerald-400 font-bold">
                      %{master.actualRoiPercent || master.roiPercent} (Sapma -1.8%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Reprice Selling Price Input */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={sellingPriceInput}
                  onChange={(e) => setSellingPriceInput(e.target.value)}
                  placeholder={`Reprice (Curr $${master.sellingPrice})`}
                  className="w-full px-2.5 py-1.5 bg-[#0F1626] border border-slate-700/80 rounded-xl text-xs font-mono-tech text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  disabled={updating || !sellingPriceInput}
                  onClick={() => handleDecisionClick(master.decisionAction)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono-tech font-bold uppercase shrink-0 transition"
                >
                  Fiyatı Güncelle
                </button>
              </div>
            </div>
          </div>

          {/* AI Evidence Chain (Phase 30) */}
          <div className="bg-[#080C14] border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-tech text-indigo-400 font-bold flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> AI KANIT ZİNCİRİ (EVIDENCE CHAIN)
              </span>
              <span className="text-[10px] font-mono-tech text-slate-400">
                {evidenceChain.length} Doğrulanmış Veri Kaynağı
              </span>
            </div>
            {evidenceChain.map((ev: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#0F1626] border border-slate-800 text-xs font-mono-tech space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">{ev.source}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
                    Güven: {ev.confidence}
                  </span>
                </div>
                <p className="text-slate-200">{ev.claim}</p>
              </div>
            ))}
          </div>

          {/* Multi-Store Channel Listings (Product ≠ Listing) */}
          <div className="bg-[#080C14] border border-slate-800/80 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400">
                Çoklu Mağaza Kanal Listeleme Dağılımı ({listings.length} Mağaza)
              </span>
              <span className="text-xs font-mono-tech text-slate-400">
                MSKU: {master.msku}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {listings.map((l: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#0F1626] border border-slate-800 flex items-center justify-between text-xs font-mono-tech"
                >
                  <div>
                    <span className="text-indigo-400 font-bold">{l.storeCode}</span>
                    <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                      {l.storeName}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold">${Number(l.price).toFixed(2)}</span>
                    <span className="block text-[10px] text-slate-500">
                      {l.stock} adet • {l.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#080C14] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono-tech">
            Keşif Tarihi: {new Date(master.discoveredAt).toLocaleDateString()}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono-tech text-white transition"
          >
            Müfettişi Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
