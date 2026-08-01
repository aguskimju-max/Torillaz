import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { rupiah } from "@/lib/format";

export function SalesTrendChart({ data }) {
  return (
    <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-emerald-600" />
        <h3 className="font-heading font-semibold text-slate-800">Tren Omzet (7 Hari)</h3>
      </div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="tanggal" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
