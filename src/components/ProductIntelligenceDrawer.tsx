"use client";

import React, { useState } from "react";
import {
  X,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { AiOpportunityRadar } from "./AiOpportunityRadar";
import { CostHistoryChart } from "./CostHistoryChart";

const CERBERUS_13_STAGES = [
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
];

interface ProductIntelligenceDrawerProps {
  discovery: any | null;
  onClose: () => void;
  onUpdateStage: (id: number, newStage: string) => Promise<void>;
  onUpdatePrice: (id: number, newPrice: number) => Promise<void>;
  stores: any[];
}

export function ProductIntelligenceDrawer({
  discovery,
  onClose,
  onUpdateStage,
  onUpdatePrice,
}: ProductIntelligenceDrawerProps) {
  const [updating, setUpdating] = useState(false);
  const [sellingPriceInput, setSellingPriceInput] = useState<string>("");

  if (!discovery) return null;

  const currentStageIndex = CERBERUS_13_STAGES.indexOf(
    discovery.lifecycleStage
  );

  const handleStageClick = async (targetStage: string) => {
    setUpdating(true);
    await onUpdateStage(discovery.id, targetStage);
    setUpdating(false);
  };

  const handlePriceUpdate = async () => {
    const val = Number(sellingPriceInput);
    if (!val || val <= 0) return;
    setUpdating(true);
    await onUpdatePrice(discovery.id, val);
    setSellingPriceInput("");
    setUpdating(false);
  };

  const listings: any[] = Array.isArray(discovery.channelListings)
    ? discovery.channelListings
    : [];

  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-xs flex justify-end">
      <div className="bg-[#161C28] border-l border-slate-700/80 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between bg-[#0E1420]">
          <div className="pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-400 font-mono-tech text-xs font-bold">
                {discovery.productCode}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-tech text-xs">
                ASIN: {discovery.asin}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono-tech text-xs">
                UPC: {discovery.upc}
              </span>
              {discovery.duplicateStatus === "EXACT_DUPLICATE" ? (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono-tech text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> DUP SCORE:{" "}
                  {discovery.duplicateScore}%
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono-tech text-xs flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> UNIQUE (
                  {discovery.duplicateScore}%)
                </span>
              )}
            </div>
            <h2 className="text-base font-display font-bold text-white leading-snug">
              {discovery.title}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-mono-tech">
              <span>Sourced by: {discovery.researcherName}</span>
              <span>•</span>
              <a
                href={discovery.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1"
              >
                {discovery.sourceDomain} <ExternalLink className="w-3 h-3" />
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 13-Stage Cerberus Lifecycle Stepper */}
          <div className="bg-[#0E1420] border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400">
                13-Stage Cerberus Lifecycle Pipeline (Click stage to advance)
              </span>
              <span className="text-xs font-mono-tech text-sky-400 font-bold">
                STAGE {currentStageIndex + 1}/13: {discovery.lifecycleStage}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CERBERUS_13_STAGES.map((stage, idx) => {
                const isActive = stage === discovery.lifecycleStage;
                const isPassed = idx < currentStageIndex;
                return (
                  <button
                    key={stage}
                    disabled={updating}
                    onClick={() => handleStageClick(stage)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono-tech uppercase transition ${
                      isActive
                        ? "bg-sky-500 text-white font-bold shadow-md shadow-sky-500/25 border border-sky-400"
                        : isPassed
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                        : "bg-[#0B0F17] text-slate-500 border border-slate-800 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Opportunity Score Radar + Landed Cost Breakdown side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AiOpportunityRadar
              profitability={Number(discovery.profitabilityScore || 85)}
              demand={Number(discovery.demandScore || 84)}
              competition={Number(discovery.competitionScore || 76)}
              priceStability={Number(discovery.priceStabilityScore || 85)}
              supplierRisk={Number(discovery.supplierRiskScore || 90)}
              operationalRisk={Number(discovery.operationalRiskScore || 88)}
              opportunityScore={Number(discovery.opportunityScore || 84)}
              recommendation={discovery.aiRecommendation || "HIGH_MARGIN_SCALER"}
            />

            {/* Landed Cost Breakdown Card */}
            <div className="bg-[#0E1420] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono-tech uppercase text-slate-400">
                    Landed Cost Breakdown
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono-tech font-bold ${
                      Number(discovery.roiPercent) >= 30
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                    }`}
                  >
                    NET ROI: {discovery.roiPercent}%
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono-tech">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">US Source Price:</span>
                    <span className="text-amber-400 font-bold">
                      ${Number(discovery.sourcePrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Prep &amp; FBA Label:</span>
                    <span className="text-slate-300">
                      +${Number(discovery.prepCost).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">AMZ Referral (15%):</span>
                    <span className="text-slate-300">
                      +${Number(discovery.marketplaceFee).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">FBA Fulfillment:</span>
                    <span className="text-slate-300">
                      +${Number(discovery.fulfillmentFee).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-[#0B0F17] px-2.5 rounded-lg border border-sky-500/30">
                    <span className="text-sky-400 font-semibold">
                      TOTAL LANDED COST:
                    </span>
                    <span className="text-sky-300 font-bold">
                      ${Number(discovery.landedCost).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-emerald-500/10 px-2.5 rounded-lg border border-emerald-500/40">
                    <span className="text-emerald-400 font-semibold">
                      SELLING PRICE / PROFIT:
                    </span>
                    <span className="text-emerald-400 font-bold">
                      ${Number(discovery.sellingPrice).toFixed(2)} (+
                      ${Number(discovery.estimatedNetProfit).toFixed(2)})
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
                  placeholder={`Reprice (Curr $${discovery.sellingPrice})`}
                  className="w-full px-2.5 py-1.5 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-xs font-mono-tech text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  disabled={updating || !sellingPriceInput}
                  onClick={handlePriceUpdate}
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white rounded-lg text-xs font-mono-tech font-bold uppercase shrink-0 transition"
                >
                  Update Price
                </button>
              </div>
            </div>
          </div>

          {/* AI Decision Support Notes */}
          {discovery.aiAnalysisNotes && (
            <div className="bg-[#0E1420] border border-sky-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-mono-tech text-sky-400 font-bold mb-1">
                <Cpu className="w-4 h-4" />
                CERBERUS AI PRODUCT INTELLIGENCE INSIGHT
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {discovery.aiAnalysisNotes}
              </p>
            </div>
          )}

          {/* Cost History Timeline SVG Chart */}
          <CostHistoryChart history={discovery.costHistory} />

          {/* 26-Store Marketplace Listing Matrix */}
          <div className="bg-[#0E1420] border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400">
                Active Store Listings ({listings.length} Multi-Store Allocations)
              </span>
              <span className="text-xs font-mono-tech text-slate-400">
                MSKU: {discovery.msku}
              </span>
            </div>
            {listings.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono-tech">
                Not listed on any store yet. Move to LISTING or ACTIVE stage to publish.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {listings.map((l: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#0B0F17] border border-slate-800 flex items-center justify-between text-xs font-mono-tech"
                  >
                    <div>
                      <span className="text-sky-400 font-bold">
                        {l.storeCode}
                      </span>
                      <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                        {l.storeName}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold">
                        ${Number(l.price).toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {l.stock} units • {l.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#0E1420] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono-tech">
            Discovered: {new Date(discovery.discoveredAt).toLocaleDateString()}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono-tech text-white transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
