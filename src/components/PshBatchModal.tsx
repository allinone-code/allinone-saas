"use client";

import { clientLog } from "@/lib/clientLogger";
import React, { useState } from "react";
import { X, Building2, CheckCircle2 } from "lucide-react";

interface PshBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentStore: string;
  unbatchedOrders: any[];
}

export function PshBatchModal({
  isOpen,
  onClose,
  onCreated,
  currentStore,
  unbatchedOrders,
}: PshBatchModalProps) {
  const store = currentStore === "ALL" ? "HRN" : currentStore;
  const [batchNumber, setBatchNumber] = useState(
    `PSH-${store}-${new Date().toISOString().split("T")[0]}`
  );
  const [title, setTitle] = useState(`${store} Mağazası Yeni FBA Sevkiyat Batch'i`);
  const [selectedIds, setSelectedIds] = useState<number[]>(
    unbatchedOrders.slice(0, 8).map((o) => o.id)
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNumber || !title) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber,
          storeCode: store,
          title,
          orderIds: selectedIds,
          notes,
          actorName: `Kullanıcı (${store})`,
        }),
      });

      if (res.ok) {
        onCreated();
        onClose();
      }
    } catch (err) {
      clientLog.error("batches/create", "PSH batch oluşturulamadı", { err: String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161C28] border border-line rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-positive/10 border border-positive/30 text-positive">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-ink">
                PSH Envanter Programı Ön-Batch Oluştur
              </h2>
              <p className="text-xs text-ink-muted font-mono-tech">
                Ürünler depoya varmadan önce PSH programında parti numarası tanımlayın
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-3 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="my-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                PSH Batch No
              </label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full px-3 py-2 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                Mağaza
              </label>
              <input
                type="text"
                disabled
                value={store}
                className="w-full px-3 py-2 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-positive font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
              Batch Başlığı / Açıklaması
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-surface-base border border-line rounded-lg text-xs text-ink"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono-tech text-ink-muted mb-1.5">
              Bu Batch&rsquo;e Eklenecek Siparişler ({selectedIds.length} adet seçili):
            </label>
            <div className="max-h-48 overflow-y-auto border border-line rounded-xl bg-surface-base p-2 space-y-1.5">
              {unbatchedOrders.length === 0 ? (
                <p className="text-xs font-mono-tech text-ink-faint p-2">
                  Atanmamış sipariş bulunamadı.
                </p>
              ) : (
                unbatchedOrders.map((o) => (
                  <label
                    key={o.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 cursor-pointer text-xs font-mono-tech"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(o.id)}
                      onChange={() => toggleSelect(o.id)}
                      className="rounded border-line text-sky-500 focus:ring-0"
                    />
                    <span className="text-info font-bold">{o.orderNumber}</span>
                    <span className="text-ink-muted truncate flex-1">{o.productTitle}</span>
                    <span className="text-ink-muted">{o.quantity} Adet</span>
                    <span className="text-caution">${o.totalCost}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono-tech text-ink-muted hover:text-ink transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-ink font-mono-tech text-xs uppercase font-bold tracking-wider transition shadow-lg shadow-emerald-500/20"
            >
              {submitting ? "Oluşturuluyor..." : "PSH Batch Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
