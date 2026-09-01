"use client";

import { Download, ExternalLink, PackageCheck, Search } from "lucide-react";
import type { BatchView, OrderView } from "../types";

export function OrdersTable({
  orders,
  batches,
  searchQuery,
  onSearchChange,
  cargoFilter,
  onCargoFilterChange,
  batchFilter,
  onBatchFilterChange,
  onExportCsv,
  onOpenWarehouse,
  onSelect,
}: {
  orders: OrderView[];
  batches: BatchView[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  cargoFilter: string;
  onCargoFilterChange: (v: string) => void;
  batchFilter: string;
  onBatchFilterChange: (v: string) => void;
  onExportCsv: () => void;
  onOpenWarehouse: () => void;
  onSelect: (order: OrderView) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Order No, ASIN, MSKU, ürün adı veya sipariş maili ara..."
            className="w-full pl-10 pr-3.5 py-2 bg-[#080C14] border border-slate-700/80 rounded-xl text-xs font-mono-tech text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={cargoFilter}
            onChange={(e) => onCargoFilterChange(e.target.value)}
            className="bg-[#080C14] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono-tech text-slate-200"
          >
            <option value="ALL">TÜM KARGO DURUMLARI</option>
            <option value="Tam Geldi">Tam Geldi</option>
            <option value="İPTAL">İPTAL</option>
            <option value="Yolda">Yolda</option>
            <option value="Kayıp Depoya gelmiş">Kayıp Depoya gelmiş</option>
          </select>

          <select
            value={batchFilter}
            onChange={(e) => onBatchFilterChange(e.target.value)}
            className="bg-[#080C14] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono-tech text-slate-200"
          >
            <option value="ALL">TÜM PSH BATCH&rsquo;LERİ</option>
            {batches.map((b) => (
              <option key={b.batchNumber} value={b.batchNumber}>
                {b.batchNumber}
              </option>
            ))}
          </select>

          <button
            onClick={onExportCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 rounded-xl text-xs font-mono-tech font-bold transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV İndir
          </button>

          <button
            onClick={onOpenWarehouse}
            className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-mono-tech font-bold transition flex items-center gap-1.5"
          >
            <PackageCheck className="w-3.5 h-3.5" /> Depo Sayım Modu
          </button>
        </div>
      </div>

      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#080C14] text-[11px] font-mono-tech uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-3.5">Mağaza / Tarih</th>
                <th className="py-3.5 px-3.5">Order No / Fatura</th>
                <th className="py-3.5 px-3.5">Ürün Adı</th>
                <th className="py-3.5 px-3.5">ASIN / MSKU</th>
                <th className="py-3.5 px-3.5">Satıcı</th>
                <th className="py-3.5 px-3.5 text-center">Adet</th>
                <th className="py-3.5 px-3.5 text-right">Birim Maliyet</th>
                <th className="py-3.5 px-3.5 text-right">Satış Fiyatı</th>
                <th className="py-3.5 px-3.5 text-right">Toplam Maliyet</th>
                <th className="py-3.5 px-3.5">Kargo Durumu</th>
                <th className="py-3.5 px-3.5 text-center">Amazona Sevk</th>
                <th className="py-3.5 px-3.5">P1-P4 Fire</th>
                <th className="py-3.5 px-3.5">PSH Batch</th>
                <th className="py-3.5 px-3.5 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-mono-tech">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-slate-500">
                    Bu filtrede sipariş kaydı bulunmuyor. &quot;Yeni Sipariş&quot; veya &quot;Excel /
                    Google Drive Yükle&quot; ile ekleyebilirsiniz.
                  </td>
                </tr>
              ) : (
                orders.map((item) => {
                  const isCancelled = item.cargoStatus === "İPTAL";
                  const hasMissing = Number(item.p2MissingQty) > 0;
                  return (
                    <tr key={item.id} className="hover:bg-[#162035]/80 transition">
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold block w-fit">
                          {item.buyerStore}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-1">{item.orderDate}</span>
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="text-white font-bold block">{item.orderNumber}</span>
                        {item.driveLink ? (
                          <a
                            href={item.driveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-emerald-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            Drive Fatura <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-500 block mt-0.5">Fatura yok</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3.5 max-w-xs font-sans text-xs">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="px-1.5 rounded bg-slate-800 text-amber-300 font-mono-tech text-[10px] font-bold">
                            {item.brandName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono-tech">
                            {item.fulfillmentType}
                          </span>
                        </div>
                        <button
                          onClick={() => onSelect(item)}
                          className="font-medium text-white hover:text-indigo-400 text-left line-clamp-2 transition"
                        >
                          {item.productTitle}
                        </button>
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <a
                          href={item.amazonUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          {item.asin} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[110px]">
                          {item.msku}
                        </span>
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <a
                          href={item.supplierUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-300 hover:text-amber-400 inline-flex items-center gap-1"
                        >
                          {item.supplierName} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span className="text-[10px] text-slate-500 block">Kod: {item.supplierCode}</span>
                      </td>

                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span className="text-white font-bold">{item.quantity}</span>
                        <span className="text-[10px] text-slate-500 block">{item.packCount}li paket</span>
                      </td>

                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-amber-300 font-bold">
                        ${item.unitCost}
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-emerald-400 font-bold">
                        ${item.sellingPrice}
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap text-sky-400 font-bold">
                        ${item.totalCost}
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isCancelled
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : item.cargoStatus === "Tam Geldi"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {item.cargoStatus}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[120px]">
                          {item.orderEmail}
                        </span>
                      </td>

                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap font-bold text-emerald-400">
                        {item.shippedToAmazon} / {item.quantity}
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="text-rose-400 font-bold">P1 İptal: {item.p1CancelQty}</span>
                        ) : hasMissing ? (
                          <span className="text-amber-400 font-bold">P2 Eksik: {item.p2MissingQty}</span>
                        ) : (
                          <span className="text-slate-500">Fire yok</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {item.pshBatchNo || "Atanmadı"}
                        </span>
                      </td>

                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelect(item)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[11px] font-bold transition"
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
