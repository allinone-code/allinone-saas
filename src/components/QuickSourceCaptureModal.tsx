"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Globe,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

interface QuickSourceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (discovery: any) => void;
  existingDiscoveries: any[];
  researchers: any[];
}

const SAMPLE_US_RETAIL_DEALS = [
  {
    label: "Home Depot — Milwaukee M18 Fuel 2-Tool Combo Kit ($169)",
    sourceUrl: "https://www.homedepot.com/p/Milwaukee-M18-FUEL-Combo/320145889",
    title: "Milwaukee M18 FUEL 18V Lithium-Ion Brushless Cordless 2-Tool Combo Kit (2997-22)",
    brand: "MILWAUKEE",
    category: "Power & Hand Tools",
    upc: "045242561912",
    asin: "B07CZ3Y1PW",
    sourcePrice: 169.0,
    sellingPrice: 279.0,
    supplierName: "The Home Depot Commercial US",
  },
  {
    label: "Ulta Beauty — CeraVe Daily Moisturizing Lotion 19 fl oz 2-Pack ($19.50)",
    sourceUrl: "https://www.ulta.com/p/cerave-daily-moisturizing-lotion-duo",
    title: "CeraVe Daily Moisturizing Lotion for Dry Skin with Hyaluronic Acid (19 fl oz Duo)",
    brand: "CERAVE",
    category: "Dermatological Skincare",
    upc: "3606000537736",
    asin: "B07RK4HST7",
    sourcePrice: 19.5,
    sellingPrice: 42.0,
    supplierName: "Ulta Beauty Pro Wholesale & Clearance",
  },
  {
    label: "TEST DUPLICATE — Ninja CREAMi 7-in-1 Ice Cream Maker (Triggers 96% Match)",
    sourceUrl: "https://www.costcobusinessdelivery.com/ninja-creami-7-in-1.html",
    title: "Ninja CREAMi 7-in-1 Ice Cream & Frozen Treat Maker (NC301 Silver)",
    brand: "NINJA",
    category: "Kitchen & Countertop Appliances",
    upc: "622356565147", // matches seed duplicate
    asin: "B08QX6L29W",
    sourcePrice: 124.99,
    sellingPrice: 219.99,
    supplierName: "Costco Business Center Pallets",
  },
];

export function QuickSourceCaptureModal({
  isOpen,
  onClose,
  onCreated,
  existingDiscoveries,
  researchers,
}: QuickSourceCaptureModalProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("DEWALT");
  const [category, setCategory] = useState("Power & Hand Tools");
  const [upc, setUpc] = useState("");
  const [asin, setAsin] = useState("");
  const [sourcePrice, setSourcePrice] = useState("79.00");
  const [sellingPrice, setSellingPrice] = useState("149.00");
  const [sourceShipping, setSourceShipping] = useState("0.00");
  const [prepCost, setPrepCost] = useState("1.35");
  const [researcherName, setResearcherName] = useState("Ahmet Kaya (SRC-01)");
  const [supplierName, setSupplierName] = useState("The Home Depot Commercial US");
  const [submitting, setSubmitting] = useState(false);

  // Live Duplicate Check against existing PostgreSQL discoveries
  const duplicateMatch = useMemo(() => {
    if (!upc && !asin && !sourceUrl) {
      return { score: 10, status: "CLEAR", matched: null };
    }
    for (const item of existingDiscoveries) {
      if (upc && upc.length > 5 && item.upc === upc) {
        return {
          score: 96,
          status: "EXACT_DUPLICATE",
          matched: `${item.productCode}: ${item.title} (Found by ${item.researcherName})`,
        };
      }
      if (asin && asin.length > 4 && item.asin.toUpperCase() === asin.toUpperCase()) {
        return {
          score: 96,
          status: "EXACT_DUPLICATE",
          matched: `${item.productCode}: ${item.title} (ASIN ${item.asin})`,
        };
      }
      if (sourceUrl && item.sourceUrl === sourceUrl) {
        return {
          score: 92,
          status: "EXACT_DUPLICATE",
          matched: `${item.productCode}: Same source URL`,
        };
      }
    }
    return { score: 12, status: "CLEAR", matched: null };
  }, [upc, asin, sourceUrl, existingDiscoveries]);

  // Live Landed Cost & Profitability preview
  const liveFinancials = useMemo(() => {
    const src = Number(sourcePrice) || 0;
    const sell = Number(sellingPrice) || 0;
    const ship = Number(sourceShipping) || 0;
    const prep = Number(prepCost) || 1.35;
    const marketplaceFee = Number((sell * 0.15).toFixed(2));
    const fulfillmentFee = Number(
      (sell > 100 ? 7.45 : sell > 45 ? 5.8 : 4.15).toFixed(2)
    );
    const otherCost = 0.5;
    const landedCost = Number(
      (src + ship + prep + marketplaceFee + fulfillmentFee + otherCost).toFixed(2)
    );
    const netProfit = Number((sell - landedCost).toFixed(2));
    const roi = landedCost > 0 ? Number(((netProfit / landedCost) * 100).toFixed(2)) : 0;

    return {
      marketplaceFee,
      fulfillmentFee,
      otherCost,
      landedCost,
      netProfit,
      roi,
    };
  }, [sourcePrice, sellingPrice, sourceShipping, prepCost]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: (typeof SAMPLE_US_RETAIL_DEALS)[0]) => {
    setSourceUrl(preset.sourceUrl);
    setTitle(preset.title);
    setBrand(preset.brand);
    setCategory(preset.category);
    setUpc(preset.upc);
    setAsin(preset.asin);
    setSourcePrice(String(preset.sourcePrice));
    setSellingPrice(String(preset.sellingPrice));
    setSupplierName(preset.supplierName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/cerberus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          title,
          brand,
          category,
          upc,
          asin,
          sourcePrice: Number(sourcePrice),
          sellingPrice: Number(sellingPrice),
          sourceShipping: Number(sourceShipping),
          prepCost: Number(prepCost),
          researcherName,
          supplierName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.discovery) {
        onCreated(data.discovery);
        onClose();
      }
    } catch (err) {
      console.error("Failed to capture product:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161C28] border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white tracking-wide">
                CERBERUS CHROME EXTENSION &amp; US SOURCING CAPTURE
              </h2>
              <p className="text-xs text-slate-400">
                1-click US Retail discovery capture with real-time UPC/ASIN Duplicate Check &amp; Landed Cost Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Sample US Sourcing Buttons */}
        <div className="px-6 py-3 bg-[#0E1420] border-b border-slate-800/80">
          <span className="text-[11px] font-mono-tech uppercase text-slate-400 block mb-2">
            Instant Test US Sourcing Scenarios:
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_US_RETAIL_DEALS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`text-xs px-3 py-1.5 rounded-lg font-mono-tech border transition ${
                  idx === 2
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                    : "bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Duplicate Detection Live Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              duplicateMatch.status === "EXACT_DUPLICATE"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
            }`}
          >
            {duplicateMatch.status === "EXACT_DUPLICATE" ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <div className="flex items-center gap-2 font-mono-tech font-bold uppercase">
                <span>
                  Duplicate Detection Score: {duplicateMatch.score}%
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px]">
                  {duplicateMatch.status}
                </span>
              </div>
              {duplicateMatch.matched ? (
                <p className="mt-1 text-amber-300/90 font-mono-tech">
                  ⚠️ Match in PostgreSQL: {duplicateMatch.matched}
                </p>
              ) : (
                <p className="mt-1 text-slate-300">
                  Unique UPC/ASIN signature. Ready for Landed Cost analysis &amp; multi-store allocation.
                </p>
              )}
            </div>
          </div>

          {/* Source URL & Product Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono-tech uppercase text-slate-400 mb-1">
                US Retail Source URL (Home Depot, Ulta, Costco, BestBuy...)
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="url"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://www.homedepot.com/p/..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm font-mono-tech text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono-tech uppercase text-slate-400 mb-1">
                Product Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. DeWalt 20V MAX XR Brushless Impact Driver Kit"
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono-tech uppercase text-slate-400 mb-1">
                UPC / GTIN Barcode
              </label>
              <input
                type="text"
                value={upc}
                onChange={(e) => setUpc(e.target.value)}
                placeholder="885911425129"
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm font-mono-tech text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono-tech uppercase text-slate-400 mb-1">
                Amazon ASIN
              </label>
              <input
                type="text"
                value={asin}
                onChange={(e) => setAsin(e.target.value)}
                placeholder="B0183RLW8A"
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm font-mono-tech text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono-tech uppercase text-slate-400 mb-1">
                Brand Name
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono-tech uppercase text-slate-400 mb-1">
                Discovered By (Sourcing Specialist)
              </label>
              <select
                value={researcherName}
                onChange={(e) => setResearcherName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {researchers.map((r) => (
                  <option key={r.code} value={`${r.name} (${r.code})`}>
                    {r.name} ({r.code}) — Score: {r.researcherScore}/100
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Landed Cost & Profitability Calculator */}
          <div className="bg-[#0E1420] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono-tech uppercase text-sky-400 font-bold flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                CERBERUS LANDED COST &amp; PROFITABILITY ENGINE
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono-tech font-bold ${
                  liveFinancials.roi >= 30
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : liveFinancials.roi >= 15
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                EST. ROI: {liveFinancials.roi}%
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-[10px] font-mono-tech text-slate-400 mb-1">
                  Source Unit Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sourcePrice}
                  onChange={(e) => setSourcePrice(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm font-mono-tech text-amber-300 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-tech text-slate-400 mb-1">
                  Prep &amp; FBA Label ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={prepCost}
                  onChange={(e) => setPrepCost(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm font-mono-tech text-slate-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-tech text-slate-400 mb-1">
                  Supplier Shipping ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sourceShipping}
                  onChange={(e) => setSourceShipping(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-slate-700/80 rounded-lg text-sm font-mono-tech text-slate-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono-tech text-slate-400 mb-1">
                  Target Amazon Selling Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-emerald-500/50 rounded-lg text-sm font-mono-tech text-emerald-400 font-bold"
                />
              </div>
            </div>

            {/* Landed cost summary breakdown */}
            <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-800 text-xs font-mono-tech">
              <div className="bg-[#0B0F17] p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">
                  AMZ Ref Fee (15%)
                </span>
                <span className="text-slate-200 font-semibold">
                  ${liveFinancials.marketplaceFee}
                </span>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">
                  FBA Fulfillment
                </span>
                <span className="text-slate-200 font-semibold">
                  ${liveFinancials.fulfillmentFee}
                </span>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded-lg border border-sky-500/30">
                <span className="text-[10px] text-sky-400 block">
                  TOTAL LANDED COST
                </span>
                <span className="text-sky-300 font-bold">
                  ${liveFinancials.landedCost}
                </span>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded-lg border border-emerald-500/40">
                <span className="text-[10px] text-emerald-400 block">
                  EST. NET PROFIT
                </span>
                <span className="text-emerald-400 font-bold">
                  +${liveFinancials.netProfit}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono-tech uppercase text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-mono-tech text-xs uppercase font-bold tracking-wider shadow-lg shadow-sky-500/20 transition flex items-center gap-2"
            >
              {submitting ? (
                "Scanning & Saving..."
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Capture &amp; Run AI Intelligence
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
