"use client";

import React, { useState } from "react";
import { X, FileSpreadsheet, CheckCircle2, Upload } from "lucide-react";

interface XlsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedCount: number) => void;
}

const SAMPLE_EXCEL_ROWS = [
  {
    title: "Makita 18V LXT Lithium-Ion Brushless Cordless Reciprocating Saw (XRJ05Z)",
    brand: "MAKITA",
    category: "Power & Hand Tools",
    upc: "088381806338",
    asin: "B01D538BEQ",
    sourcePrice: 114.0,
    sellingPrice: 189.0,
    sourceUrl: "https://www.homedepot.com/p/Makita-18V-LXT/206862569",
    supplierName: "The Home Depot Commercial US",
  },
  {
    title: "Olaplex No. 3 Hair Perfector Repairing Treatment (3.3 fl oz Jumbo Duo)",
    brand: "OLAPLEX",
    category: "Professional Haircare",
    upc: "896364002350",
    asin: "B00SNM5US4",
    sourcePrice: 31.0,
    sellingPrice: 60.0,
    sourceUrl: "https://www.sephora.com/product/olaplex-hair-perfector-no-3",
    supplierName: "Sephora Wholesale & Arbitrage Deals",
  },
  {
    title: "Ninja CREAMi 7-in-1 Ice Cream & Frozen Treat Maker (NC301 Silver)",
    brand: "NINJA",
    category: "Kitchen Appliances",
    upc: "622356565147", // intentional duplicate test
    asin: "B08QX6L29W",
    sourcePrice: 124.99,
    sellingPrice: 219.99,
    sourceUrl: "https://www.costcobusinessdelivery.com/ninja-creami.html",
    supplierName: "Costco Business Center Pallets",
  },
];

export function XlsImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}: XlsImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBatchImport = async () => {
    setImporting(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/cerberus/import-xls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: SAMPLE_EXCEL_ROWS,
          researcherName: "Selin Yilmaz (Lead Sourcing)",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(data.message);
        setTimeout(() => {
          onImportSuccess(SAMPLE_EXCEL_ROWS.length);
          onClose();
        }, 1100);
      }
    } catch (err) {
      console.error("XLS import error:", err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161C28] border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white">
                EXCEL MIGRATION &amp; BATCH SOURCING PIPELINE
              </h2>
              <p className="text-xs text-slate-400">
                Excel → Import → Validation → Normalization → Duplicate Detection → PostgreSQL
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

        <div className="my-4 space-y-3">
          <div className="p-3.5 rounded-xl bg-[#0E1420] border border-slate-800 text-xs text-slate-300">
            <p className="font-mono-tech text-sky-400 font-bold mb-1">
              AUTOMATIC UPC / ASIN NORMALIZATION PREVIEW (3 EXCEL ROWS):
            </p>
            <div className="space-y-2 mt-2">
              {SAMPLE_EXCEL_ROWS.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#0B0F17] border border-slate-800/80"
                >
                  <div className="truncate pr-3">
                    <span className="font-mono-tech text-amber-400 text-[11px]">
                      [{row.brand}]
                    </span>{" "}
                    <span className="text-slate-200 text-xs">{row.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono-tech text-xs">
                    <span className="text-slate-400">${row.sourcePrice}</span>
                    <span className="text-emerald-400 font-bold">
                      → ${row.sellingPrice}
                    </span>
                    {idx === 2 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                        DUP TEST
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {statusMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono-tech flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {statusMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono-tech text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleBatchImport}
            disabled={importing}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-mono-tech text-xs uppercase font-bold tracking-wider shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {importing
              ? "Running Normalization & Dup Check..."
              : "Import Excel Rows to PostgreSQL"}
          </button>
        </div>
      </div>
    </div>
  );
}
