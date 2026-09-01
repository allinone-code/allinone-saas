"use client";

import { AlertTriangle } from "lucide-react";

/**
 * T8.2 — page.tsx ayrıştırması (ProblemsTab).
 * TAB 5: P1–P4 fire/iade paneli
 */
export default function ProblemsTab({ filteredOrders, onSelectOrder }: { [key: string]: any }) {
  return (
  <div className="space-y-4">
    <div className="bg-[#0F1626] border border-rose-500/30 rounded-2xl p-5">
      <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-rose-400" />
        P1–P4 Fire, İptal ve Refund Yönetim Paneli
      </h2>
      <p className="text-xs text-slate-400 font-mono-tech mt-0.5">
        P1 (İptal), P2 (Eksik), P3 (Defolu), P4 (Tarihi Geçmiş) adetleri ve R-kodlu iade tutarları
      </p>
    </div>

    <div className="bg-[#0F1626] border border-slate-800 rounded-2xl overflow-hidden">
      <table className="w-full text-left text-xs font-mono-tech">
        <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800 text-[11px] uppercase">
          <tr>
            <th className="p-3.5">Order No</th>
            <th className="p-3.5">Ürün</th>
            <th className="p-3.5">Problem Türü</th>
            <th className="p-3.5">Problem Eylemi</th>
            <th className="p-3.5">Problem Sonucu</th>
            <th className="p-3.5 text-right">Refund Miktarı</th>
            <th className="p-3.5 text-right">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {filteredOrders
            .filter((o: any) =>
                o.cargoStatus === "İPTAL" ||
                Number(o.p1CancelQty) > 0 ||
                Number(o.p2MissingQty) > 0 ||
                Number(o.p3DefectiveQty) > 0 ||
                Number(o.p4ExpiredQty) > 0 ||
                Number(o.refundAmount) > 0
            )
            .map((o: any) => (
              <tr key={o.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 text-indigo-400 font-bold">{o.orderNumber}</td>
                <td className="p-3.5 font-sans text-white max-w-xs truncate">{o.productTitle}</td>
                <td className="p-3.5">
                  {o.cargoStatus === "İPTAL" ? (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                      P1: İPTAL ({o.p1CancelQty || o.quantity} Adet)
                    </span>
                  ) : Number(o.p2MissingQty) > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                      P2: EKSİK ({o.p2MissingQty} Adet)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      Depo Kaybı / Kontrol
                    </span>
                  )}
                </td>
                <td className="p-3.5 text-slate-300 max-w-xs truncate">
                  {o.problemAction || "Eylem bekleniyor"}
                </td>
                <td className="p-3.5 text-emerald-400 max-w-xs truncate">
                  {o.problemResult || "İşlem sürüyor"}
                </td>
                <td className="p-3.5 text-right text-rose-400 font-bold">
                  ${o.refundAmount}
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => onSelectOrder(o)}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px]"
                  >
                    Çözümle
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  </div>
  );
}
