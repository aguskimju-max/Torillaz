import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

export function MovementChart({ data }) {
  return (
    <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-emerald-600" />
        <h3 className="font-heading font-semibold text-slate-800">Pergerakan Stok (7 Hari)</h3>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="tanggal" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="masuk" name="Masuk" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="keluar" name="Keluar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
