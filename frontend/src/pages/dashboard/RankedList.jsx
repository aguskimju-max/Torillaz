import React from "react";
import { rupiah } from "@/lib/format";

export function RankedList({ icon: Icon, title, items, emptyText }) {
  const list = items || [];
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-emerald-600" />
        <h3 className="font-heading font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-3">
        {list.slice(0, 6).map((it, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-6 w-6 rounded bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <span className="truncate text-slate-700">{it.nama}</span>
            </div>
            <span className="font-medium text-slate-900">{rupiah(it.nilai)}</span>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-400">{emptyText}</p>}
      </div>
    </div>
  );
}
