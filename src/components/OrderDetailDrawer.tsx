"use client";

import React, { useState } from "react";
import {
  X,
  ExternalLink,
  DollarSign,
  Package,
  Truck,
  AlertTriangle,
  FileText,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  Send,
} from "lucide-react";

interface OrderDetailDrawerProps {
  order: any | null;
  onClose: () => void;
  onUpdate: (id: number, updates: any) => Promise<void>;
  batches: any[];
}

export function OrderDetailDrawer({
  order,
  onClose,
  onUpdate,
  batches,
}: OrderDetailDrawerProps) {
  const [updating, setUpdating] = useState(false);
  const [cargoStatus, setCargoStatus] = useState(order?.cargoStatus || "Tam Geldi");
  const [shippedToAmazon, setShippedToAmazon] = useState(order?.shippedToAmazon || 0);
  const [pshBatchNo, setPshBatchNo] = useState(order?.pshBatchNo || "");
  const [pshStatus, setPshStatus] = useState(order?.pshStatus || "BEKLIYOR");
  const [problemAction, setProblemAction] = useState(order?.problemAction || "");
  const [problemResult, setProblemResult] = useState(order?.problemResult || "");
  const [refundAmount, setRefundAmount] = useState(order?.refundAmount || "0.00");
  const [p2MissingQty, setP2MissingQty] = useState(order?.p2MissingQty || 0);
  const [p3DefectiveQty, setP3DefectiveQty] = useState(order?.p3DefectiveQty || 0);
  const [p4ExpiredQty, setP4ExpiredQty] = useState(order?.p4ExpiredQty || 0);

  if (!order) return null;

  const handleSave = async () => {
    setUpdating(true);
    await onUpdate(order.id, {
      cargoStatus,
      shippedToAmazon: Number(shippedToAmazon),
      pshBatchNo,
      pshStatus,
      problemAction,
      problemResult,
      refundAmount: Number(refundAmount).toFixed(2),
      p2MissingQty: Number(p2MissingQty),
      p3DefectiveQty: Number(p3DefectiveQty),
      p4ExpiredQty: Number(p4ExpiredQty),
    });
    setUpdating(false);
  };

  const isCancelled = order.cargoStatus === "İPTAL";
  const hasProblems =
    Number(order.p1CancelQty) > 0 ||
    Number(order.p2MissingQty) > 0 ||
    Number(order.p3DefectiveQty) > 0 ||
    Number(order.p4ExpiredQty) > 0 ||
    isCancelled ||
    Number(order.refundAmount) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
      <div className="bg-[#161C28] border-l border-line w-full max-w-3xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line bg-[#0E1420] flex items-start justify-between">
          <div className="pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="px-2.5 py-0.5 rounded bg-info/15 border border-info/30 text-info font-mono-tech text-xs font-bold">
                Order No: {order.orderNumber}
              </span>
              <span className="px-2 py-0.5 rounded bg-positive/15 border border-positive/30 text-positive font-mono-tech text-xs font-bold">
                Mağaza: {order.buyerStore}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-3 text-ink-muted font-mono-tech text-xs">
                Tarih: {order.orderDate}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono-tech font-bold ${
                  isCancelled
                    ? "bg-danger/20 text-danger border border-danger/30"
                    : order.cargoStatus === "Tam Geldi"
                    ? "bg-positive/20 text-positive border border-positive/30"
                    : "bg-caution/20 text-caution border border-caution/30"
                }`}
              >
                {order.cargoStatus}
              </span>
            </div>
            <h2 className="text-sm font-display font-bold text-ink leading-snug">
              {order.productTitle}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-ink-muted font-mono-tech">
              <span>ASIN: <strong className="text-ink">{order.asin}</strong></span>
              <span>•</span>
              <span>MSKU: <strong className="text-ink">{order.msku}</strong></span>
              <span>•</span>
              <span>Marka: <strong className="text-caution">{order.brandName}</strong></span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-3 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Links & Drive Invoice */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href={order.amazonUrl}
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-xl bg-[#0E1420] border border-line hover:border-info/40 text-xs font-mono-tech flex items-center justify-between transition"
            >
              <span className="text-ink-muted">Amazon Listing Link</span>
              <ExternalLink className="w-4 h-4 text-info" />
            </a>
            <a
              href={order.supplierUrl}
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-xl bg-[#0E1420] border border-line hover:border-info/40 text-xs font-mono-tech flex items-center justify-between transition"
            >
              <span className="text-ink-muted truncate">Satıcı: {order.supplierName}</span>
              <ExternalLink className="w-4 h-4 text-caution" />
            </a>
            {order.driveLink ? (
              <a
                href={order.driveLink}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-positive/10 border border-positive/30 text-xs font-mono-tech text-positive flex items-center justify-between hover:bg-positive/20 transition"
              >
                <span>Google Drive Fatura Linki</span>
                <ExternalLink className="w-4 h-4 text-positive" />
              </a>
            ) : (
              <div className="p-3 rounded-xl bg-[#0E1420] border border-line text-xs font-mono-tech text-ink-faint">
                Drive linki girilmemiş
              </div>
            )}
          </div>

          {/* Finans & Maliyet Tablosu */}
          <div className="bg-[#0E1420] border border-line rounded-xl p-4">
            <h3 className="text-xs font-mono-tech uppercase text-info font-bold mb-3 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              Maliyet, Satış ve Kârlılık Hesabı
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-tech">
              <div className="bg-surface-base p-2.5 rounded-lg border border-line">
                <span className="text-[10px] text-ink-muted block">Sipariş Adedi</span>
                <span className="text-ink font-bold text-sm">{order.quantity} Adet</span>
                <span className="text-[10px] text-ink-faint block">Paket: {order.packCount}li</span>
              </div>
              <div className="bg-surface-base p-2.5 rounded-lg border border-line">
                <span className="text-[10px] text-ink-muted block">Birim Alış Maliyeti</span>
                <span className="text-caution font-bold text-sm">${order.unitCost}</span>
              </div>
              <div className="bg-surface-base p-2.5 rounded-lg border border-line">
                <span className="text-[10px] text-ink-muted block">Amazon Satış Fiyatı</span>
                <span className="text-positive font-bold text-sm">${order.sellingPrice}</span>
              </div>
              <div className="bg-surface-base p-2.5 rounded-lg border border-info/30">
                <span className="text-[10px] text-info block">Toplam Sipariş Tutarı</span>
                <span className="text-info font-bold text-sm">${order.totalCost}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-xs font-mono-tech">
              <span className="text-ink-muted">
                Düzeltilmiş Maliyet: <strong className="text-ink">${order.correctedCost}</strong> (Dönem: {order.periodCode})
              </span>
              <span className="text-ink-muted">
                Ödeme Kredi Kartı: <strong className="text-ink">**** {order.creditCard}</strong>
              </span>
            </div>
          </div>

          {/* PSH Envanter Programı & Depo Karşılama */}
          <div className="bg-[#0E1420] border border-line rounded-xl p-4">
            <h3 className="text-xs font-mono-tech uppercase text-positive font-bold mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              PSH Envanter Programı &amp; Depo Süreci
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                  PSH Batch Numarası
                </label>
                <select
                  value={pshBatchNo}
                  onChange={(e) => setPshBatchNo(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-ink focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Batch Atanmadı --</option>
                  {batches.map((b) => (
                    <option key={b.batchNumber} value={b.batchNumber}>
                      {b.batchNumber} ({b.title})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                  PSH Envanter Durumu
                </label>
                <select
                  value={pshStatus}
                  onChange={(e) => setPshStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-info font-semibold focus:outline-none"
                >
                  <option value="BEKLIYOR">BEKLIYOR (Depoya Gelmedi)</option>
                  <option value="BATCH_OLUSTURULDU">BATCH_OLUSTURULDU (PSH&rsquo;ta)</option>
                  <option value="DEPO_SAYILDI">DEPO_SAYILDI (Eksik/Defo Not Edildi)</option>
                  <option value="AMAZONA_SEVK">AMAZONA_SEVK (FBA&rsquo;e Çıktı)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono-tech text-ink-muted mb-1">
                  Amazona Gönderilen Adet
                </label>
                <input
                  type="number"
                  value={shippedToAmazon}
                  onChange={(e) => setShippedToAmazon(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-base border border-line rounded-lg text-xs font-mono-tech text-positive font-bold"
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-line text-xs font-mono-tech flex items-center justify-between text-ink-muted">
              <span>Sipariş Verilen Mail: <strong className="text-ink">{order.orderEmail}</strong></span>
              <span>Inventory Lab Durumu: <strong className="text-positive">{order.inventoryLabStatus}</strong></span>
            </div>
          </div>

          {/* P1-P4 Fire, Problem ve İade Yönetimi */}
          <div className="bg-[#0E1420] border border-danger/30 rounded-xl p-4">
            <h3 className="text-xs font-mono-tech uppercase text-danger font-bold mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              P1–P4 Depo Fire, İptal ve İade (Reconciliation)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-surface-base p-2.5 rounded-lg border border-line">
                <span className="text-[10px] text-danger block font-mono-tech">P1: İPTAL ADET</span>
                <span className="text-ink font-bold text-sm">{order.p1CancelQty}</span>
              </div>
              <div className="bg-surface-base p-2.5 rounded-lg border border-line">
                <span className="text-[10px] text-caution block font-mono-tech">P2: EKSİK ADET</span>
                <input
                  type="number"
                  value={p2MissingQty}
                  onChange={(e) => setP2MissingQty(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 bg-surface-2 border border-line rounded text-xs font-mono-tech text-ink"
                />
              </div>
              <div className="bg-surface-base p-2.5 rounded-lg border border-line">
                <span className="text-[10px] text-violet-400 block font-mono-tech">P3: DEFOLU ADET</span>
                <input
                  type="number"
                  value={p3DefectiveQty}
                  onChange={(e) => setP3DefectiveQty(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 bg-surface-2 border border-line rounded text-xs font-mono-tech text-ink"
                />
              </div>
              <div className="bg-surface-base p-2.5 rounded-lg border border-line">
                <span className="text-[10px] text-red-400 block font-mono-tech">P4: TARİHİ GEÇMİŞ</span>
                <input
                  type="number"
                  value={p4ExpiredQty}
                  onChange={(e) => setP4ExpiredQty(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1 bg-surface-2 border border-line rounded text-xs font-mono-tech text-ink"
                />
              </div>
            </div>

            <div className="space-y-3 text-xs font-mono-tech">
              <div>
                <label className="block text-ink-muted mb-1">Problemle İlgili Eylem:</label>
                <input
                  type="text"
                  value={problemAction}
                  onChange={(e) => setProblemAction(e.target.value)}
                  placeholder="Örn: Satıcıya eksik teslimat bildirildi, tazminat açıldı..."
                  className="w-full px-3 py-1.5 bg-surface-base border border-line rounded-lg text-ink"
                />
              </div>

              <div>
                <label className="block text-ink-muted mb-1">Problemle İlgili Sonuç:</label>
                <input
                  type="text"
                  value={problemResult}
                  onChange={(e) => setProblemResult(e.target.value)}
                  placeholder="Örn: $107.97 kart ekstresine iade edildi..."
                  className="w-full px-3 py-1.5 bg-surface-base border border-line rounded-lg text-ink"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-1/2">
                  <label className="block text-ink-muted mb-1">Refund Miktarı (R-kod):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-base border border-line rounded-lg text-positive font-bold"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-ink-muted mb-1">Kargo Durumu Güncelle:</label>
                  <select
                    value={cargoStatus}
                    onChange={(e) => setCargoStatus(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-base border border-line rounded-lg text-ink"
                  >
                    <option value="Tam Geldi">Tam Geldi</option>
                    <option value="İPTAL">İPTAL</option>
                    <option value="Yolda">Yolda</option>
                    <option value="Kayıp Depoya gelmiş">Kayıp Depoya gelmiş</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Açıklamalar ve Takip Bilgileri */}
          <div className="bg-[#0E1420] border border-line rounded-xl p-4 text-xs font-mono-tech space-y-2">
            <h3 className="uppercase text-ink-muted font-bold mb-2">Açıklamalar ve Takip Notları</h3>
            {order.description1 && (
              <p className="text-ink-muted">
                <span className="text-caution font-semibold">Not 1:</span> {order.description1}
              </p>
            )}
            {order.description2 && (
              <p className="text-ink-muted break-all">
                <span className="text-info font-semibold">Kargo Takip:</span>{" "}
                <a href={order.description2} target="_blank" rel="noreferrer" className="underline text-info">
                  {order.description2}
                </a>
              </p>
            )}
            {order.auditNote && (
              <p className="text-danger">
                <span className="font-semibold">Denetim Notu:</span> {order.auditNote}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-line bg-[#0E1420] flex items-center justify-between">
          <span className="text-xs text-ink-muted font-mono-tech">
            {order.buyerStore} • Order #{order.orderNumber}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono-tech text-ink-muted hover:text-ink hover:bg-surface-3 transition"
            >
              Kapat
            </button>
            <button
              disabled={updating}
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-ink font-mono-tech text-xs font-bold uppercase transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {updating ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
