"use client";

import React, { useState } from "react";
import { X, FileSpreadsheet, CheckCircle2, Upload, AlertCircle } from "lucide-react";

interface GoogleDriveXlsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  currentStore: string;
}

export function GoogleDriveXlsImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  currentStore,
}: GoogleDriveXlsImportModalProps) {
  const store = currentStore === "ALL" ? "HRN" : currentStore;
  const [tsvText, setTsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseAndImport = async () => {
    if (!tsvText.trim()) return;

    setImporting(true);
    setResultMessage(null);

    try {
      const lines = tsvText.trim().split("\n");
      const rows = [];

      for (const line of lines) {
        // Tab or comma separated
        const cols = line.includes("\t") ? line.split("\t") : line.split(",");
        if (cols.length < 5) continue;

        // Map column indexes based on the 40-column prompt header
        const buyerStore = cols[0]?.trim() || store;
        const orderDate = cols[1]?.trim() || new Date().toISOString().split("T")[0];
        const imageUrl = cols[2]?.trim() || "";
        const fulfillmentType = cols[3]?.trim() || "FBA";
        const productTitle = cols[4]?.trim() || "Sipariş Edilen Ürün";
        const asin = cols[5]?.trim() || "";
        const msku = cols[6]?.trim() || "";
        const supplierName = cols[7]?.trim() || "THE VITAMINSHOPPE";
        const supplierCode = cols[8]?.trim() || "A198";
        const supplierUrl = cols[9]?.trim() || "";
        const amazonUrl = cols[10]?.trim() || "";
        const orderNumber = cols[11]?.trim() || `WO-${Math.floor(10000000 + Math.random() * 90000000)}`;
        const driveLink = cols[12]?.trim() || "";
        const packCount = Number(cols[13]) || 1;
        const quantity = Number(cols[14]) || 1;
        const unitCost = cols[15]?.trim() || "0";
        const sellingPrice = cols[16]?.trim() || "0";
        const totalCost = cols[17]?.trim() || "0";
        const orderEmail = cols[18]?.trim() || "";
        const cargoStatus = cols[19]?.trim() || "Tam Geldi";
        const shippedToAmazon = Number(cols[20]) || 0;
        const p1CancelQty = Number(cols[21]) || 0;
        const p2MissingQty = Number(cols[22]) || 0;
        const p3DefectiveQty = Number(cols[23]) || 0;
        const p4ExpiredQty = Number(cols[24]) || 0;
        const problemAction = cols[25]?.trim() || "";
        const problemResult = cols[26]?.trim() || "";
        const refundAmount = cols[27]?.trim() || "0";
        const creditCard = cols[28]?.trim() || "1753";
        const isFragile = cols[29]?.trim() || "NO";
        const isMultiPack = cols[30]?.trim() || "NO";
        const isBundle = cols[31]?.trim() || "NO";
        const countPerBundle = Number(cols[32]) || null;
        const condition = cols[33]?.trim() || "New";
        const brandName = cols[34]?.trim() || "General";
        const description1 = cols[35]?.trim() || "";
        const description2 = cols[36]?.trim() || "";
        const auditNote = cols[37]?.trim() || "";
        const periodCode = cols[38]?.trim() || "O26";
        const correctedCost = cols[39]?.trim() || totalCost;

        rows.push({
          buyerStore,
          orderDate,
          imageUrl,
          fulfillmentType,
          productTitle,
          asin,
          msku,
          supplierName,
          supplierCode,
          supplierUrl,
          amazonUrl,
          orderNumber,
          driveLink,
          packCount,
          quantity,
          unitCost,
          sellingPrice,
          totalCost,
          orderEmail,
          cargoStatus,
          shippedToAmazon,
          p1CancelQty,
          p2MissingQty,
          p3DefectiveQty,
          p4ExpiredQty,
          problemAction,
          problemResult,
          refundAmount,
          creditCard,
          isFragile,
          isMultiPack,
          isBundle,
          countPerBundle,
          condition,
          brandName,
          description1,
          description2,
          auditNote,
          periodCode,
          correctedCost,
        });
      }

      if (rows.length === 0) {
        setResultMessage("Geçerli satır tespit edilemedi. Lütfen veriyi kontrol edin.");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/orders/import-xls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          defaultStore: store,
          actorName: `Kullanıcı (${store})`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResultMessage(data.message);
        setTimeout(() => {
          onImportSuccess();
          onClose();
        }, 1200);
      } else {
        setResultMessage(`Hata: ${data.error}`);
      }
    } catch (err: any) {
      setResultMessage(`Hata oluştu: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161C28] border border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white">
                Google Drive XLS Tablosundan Toplu İçe Aktar
              </h2>
              <p className="text-xs text-slate-400 font-mono-tech">
                Excel veya Google E-Tablolar'dan kopyaladığınız satırları buraya yapıştırın ({store} Mağazası)
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
          <div className="p-3 rounded-lg bg-[#0E1420] border border-slate-800 text-xs font-mono-tech text-slate-300">
            <p className="text-sky-400 font-bold mb-1">📋 Format Rehberi (40 Kolon Destekli):</p>
            <p className="text-slate-400">
              Google Drive tablonuzdaki satırları kopyalayıp (Ctrl+C / Cmd+C) doğrudan aşağıdaki metin kutusuna yapıştırın. Sistem satırları, birim maliyeti, ASIN, Orderno, Drive linki, P1-P4 eksik/defolu adetleri otomatik ayrıştıracaktır.
            </p>
          </div>

          <textarea
            rows={8}
            value={tsvText}
            onChange={(e) => setTsvText(e.target.value)}
            placeholder={`Satın Alan\tTarih\tÜrün resmi\tFBM/FBA\tÜrün adı Amazon\tASIN\tMSKU\tSatıcı adı\tSatıcı kodu...\nHRN\t2026-01-21\t\tFBA\tMegaFood One Daily...\tB00014DAJ8\tMHB00014DAJ8\tTHE VITAMINSHOPPE\tA198\t...\tWO110074776\t...`}
            className="w-full p-3 bg-[#0B0F17] border border-slate-700 rounded-xl text-xs font-mono-tech text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
          />

          {resultMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono-tech flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {resultMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono-tech text-slate-400 hover:text-white transition"
          >
            Vazgeç
          </button>
          <button
            onClick={handleParseAndImport}
            disabled={importing || !tsvText.trim()}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-mono-tech text-xs uppercase font-bold tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Upload className="w-4 h-4" />
            {importing ? "Satırlar İşleniyor..." : "Veritabanına Aktar"}
          </button>
        </div>
      </div>
    </div>
  );
}
