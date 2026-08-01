import React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import StatusBadge from "@/components/common/StatusBadge";
import { angka, tanggalWaktu } from "@/lib/format";

export function LowStockList({ items }) {
  const list = items || [];
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <h3 className="font-heading font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" /> Perlu Restock
      </h3>
      <div className="space-y-2">
        {list.map((it, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
            <span className="text-slate-700">{it.nama}</span>
            <StatusBadge variant="warning">{angka(it.qty)} / min {angka(it.stok_min)} {it.satuan}</StatusBadge>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-400">Semua stok aman </p>}
      </div>
    </div>
  );
}

export function RecentMovements({ items }) {
  const list = items || [];
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <h3 className="font-heading font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-500" /> Transaksi Stok Terbaru
      </h3>
      <div className="space-y-2">
        {list.map((m, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
            <div className="min-w-0">
              <div className="text-slate-700 truncate">{m.item_nama}</div>
              <div className="text-xs text-slate-400">{m.no_transaksi} · {tanggalWaktu(m.created_at)}</div>
            </div>
            <span className={m.qty >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
              {m.qty >= 0 ? "+" : ""}{angka(m.qty)}
            </span>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-400">Belum ada transaksi</p>}
      </div>
    </div>
  );
}
