"use client";

import { clientLog } from "@/lib/clientLogger";
import React, { useState } from "react";
import { X, PackageCheck, AlertTriangle, CheckCircle2, Search } from "lucide-react";

interface WarehouseReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  orders: any[];
}

export function WarehouseReconciliationModal({
  isOpen,
  onClose,
  onSaved,
  orders,
}: WarehouseReconciliationModalProps) {
  const [searchOrderNo, setSearchOrderNo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const [receivedQty, setReceivedQty] = useState(0);
  const [p2Missing, setP2Missing] = useState(0);
  const [p3Defective, setP3Defective] = useState(0);
  const [p4Expired, setP4Expired] = useState(0);
  const [shippedToAmazon, setShippedToAmazon] = useState(0);
  const [cargoStatus, setCargoStatus] = useState("Tam Geldi");
  const [problemAction, setProblemAction] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order);
    const expected = Number(order.quantity) || 1;
    setReceivedQty(expected);
    setP2Missing(Number(order.p2MissingQty) || 0);
    setP3Defective(Number(order.p3DefectiveQty) || 0);
    setP4Expired(Number(order.p4ExpiredQty) || 0);
    setShippedToAmazon(Number(order.shippedToAmazon) || expected);
    setCargoStatus(order.cargoStatus || "Tam Geldi");
    setProblemAction(order.problemAction || "");
  };

  const handleReceivedChange = (val: number) => {
    setReceivedQty(val);
    const expected = Number(selectedOrder.quantity) || 0;
    const diff = Math.max(0, expected - val);
    setP2Missing(diff);
    setShippedToAmazon(Math.max(0, val - p3Defective - p4Expired));
    if (diff > 0) {
      setCargoStatus("Eksik Geldi");
      setProblemAction(`${diff} adet eksik geldi, satıcıya talep açıldı`);
    } else {
      setCargoStatus("Tam Geldi");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargoStatus,
          shippedToAmazon: Number(shippedToAmazon),
          p2MissingQty: Number(p2Missing),
          p3DefectiveQty: Number(p3Defective),
          p4ExpiredQty: Number(p4Expired),
          problemAction,
          pshStatus: "DEPO_SAYILDI",
          actorName: "Depo Karşılama Sorumlusu",
        }),
      });

      if (res.ok) {
        onSaved();
        onClose();
      }
    } catch (err) {
      clientLog.error("warehouse/reconcile", "Depo karşılama kaydı yapılamadı", { err: String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = searchOrderNo.trim()
    ? orders.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(searchOrderNo.toLowerCase()) ||
          o.asin?.toLowerCase().includes(searchOrderNo.toLowerCase()) ||
          o.productTitle?.toLowerCase().includes(searchOrderNo.toLowerCase())
      )
    : orders.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161C28] border border-line rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-info/10 border border-info/30 text-info">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-ink">
                Depo Karşılama &amp; Sayım (Order No Eşleştirme)
              </h2>
              <p className="text-xs text-ink-muted font-mono-tech">
                Gelen kutuları Order No ile eşleştirin; eksik, defolu ve Amazona sevk adetlerini hesaplayın
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

        {/* 1. Adım: Order No ile Arama & Seçme */}
        {!selectedOrder ? (
          <div className="my-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
              <input
                type="text"
                value={searchOrderNo}
                onChange={(e) => setSearchOrderNo(e.target.value)}
                placeholder="Order No (örn: WO110086220), ASIN veya ürün adı ara..."
                className="w-full pl-9 pr-3 py-2 bg-surface-base border border-line rounded-xl text-xs font-mono-tech text-ink focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="border border-line rounded-xl bg-[#0E1420] overflow-hidden">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-surface-base text-ink-muted border-b border-line">
                  <tr>
                    <th className="p-3">Order No</th>
                    <th className="p-3">Ürün</th>
                    <th className="p-3 text-center">Beklenen</th>
                    <th className="p-3">Kargo</th>
                    <th className="p-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-2">
                      <td className="p-3 text-info font-bold">{o.orderNumber}</td>
                      <td className="p-3 text-ink truncate max-w-xs">{o.productTitle}</td>
                      <td className="p-3 text-center text-caution font-bold">{o.quantity} Adet</td>
                      <td className="p-3">{o.cargoStatus}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleSelectOrder(o)}
                          className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-ink rounded font-bold text-[11px]"
                        >
                          Sayıma Başla
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 2. Adım: Seçilen Sipariş Sayım Formu */
          <form onSubmit={handleSubmit} className="my-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-surface-base border border-info/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono-tech text-info block font-bold">
                  SEÇİLEN SİPARİŞ: {selectedOrder.orderNumber} ({selectedOrder.buyerStore})
                </span>
                <h3 className="text-xs font-bold text-ink mt-0.5">{selectedOrder.productTitle}</h3>
                <span className="text-[11px] font-mono-tech text-ink-muted">
                  ASIN: {selectedOrder.asin} • Satıcı: {selectedOrder.supplierName} • Sipariş: {selectedOrder.quantity} Adet
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-xs text-ink-muted hover:text-ink underline font-mono-tech"
              >
                Farklı Sipariş Seç
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#0E1420] border border-line">
                <span className="text-[10px] font-mono-tech text-ink-muted block">Sipariş Adedi</span>
                <span className="text-base font-bold text-ink">{selectedOrder.quantity} Adet</span>
              </div>

              <div className="p-3 rounded-xl bg-[#0E1420] border border-positive/40">
                <label className="text-[10px] font-mono-tech text-positive block font-bold mb-1">
                  Depoya Gelen Adet
                </label>
                <input
                  type="number"
                  min="0"
                  value={receivedQty}
                  onChange={(e) => handleReceivedChange(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-surface-base border border-line rounded text-sm font-mono-tech text-positive font-bold"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#0E1420] border border-caution/40">
                <label className="text-[10px] font-mono-tech text-caution block font-bold mb-1">
                  Eksik Adet (P2)
                </label>
                <input
                  type="number"
                  min="0"
                  value={p2Missing}
                  onChange={(e) => setP2Missing(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-surface-base border border-line rounded text-sm font-mono-tech text-caution font-bold"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#0E1420] border border-info/40">
                <label className="text-[10px] font-mono-tech text-info block font-bold mb-1">
                  Amazona Sevk Edilen
                </label>
                <input
                  type="number"
                  min="0"
                  value={shippedToAmazon}
                  onChange={(e) => setShippedToAmazon(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-surface-base border border-line rounded text-sm font-mono-tech text-info font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                  Defolu Adet (P3):
                </label>
                <input
                  type="number"
                  value={p3Defective}
                  onChange={(e) => setP3Defective(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-ink"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                  Tarihi Geçmiş Adet (P4):
                </label>
                <input
                  type="number"
                  value={p4Expired}
                  onChange={(e) => setP4Expired(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-ink"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                Problem / Eksiklik Açıklaması ve Aksiyon:
              </label>
              <input
                type="text"
                value={problemAction}
                onChange={(e) => setProblemAction(e.target.value)}
                placeholder="Örn: 2 adet eksik teslim alındı. Fatura itirazı başlatıldı..."
                className="w-full px-3 py-2 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-ink"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-lg text-xs font-mono-tech text-ink-muted hover:text-ink transition"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-ink font-mono-tech text-xs uppercase font-bold tracking-wider transition shadow-lg shadow-sky-500/20"
              >
                {submitting ? "Kaydediliyor..." : "Sayım Sonucunu Kaydet"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
