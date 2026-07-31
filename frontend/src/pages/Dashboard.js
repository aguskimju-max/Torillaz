import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Boxes, Wheat, Package, Warehouse, Truck, Users, AlertTriangle, TrendingUp,
  Clock, UserSquare2, PackageSearch, CalendarClock,
  ShoppingCart, Wallet, HandCoins, Factory,
} from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import StatusBadge from "@/components/common/StatusBadge";
import { rupiah, angka, tanggal, tanggalWaktu } from "@/lib/format";

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
    refetchInterval: 60_000,
  });

  const k = data?.kpi || {};

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Ringkasan kondisi bisnis Anda secara real-time" />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testId="kpi-nilai-persediaan" icon={Boxes} accent="emerald" label="Nilai Persediaan" value={rupiah(k.nilai_persediaan)} sub="Bahan baku + barang jadi" />
        <KpiCard testId="kpi-nilai-bb" icon={Wheat} accent="amber" label="Persediaan Bahan Baku" value={rupiah(k.nilai_bahan_baku)} sub={`${k.total_bahan_baku || 0} item`} />
        <KpiCard testId="kpi-nilai-bj" icon={Package} accent="sky" label="Persediaan Barang Jadi" value={rupiah(k.nilai_barang_jadi)} sub={`${k.total_barang_jadi || 0} item`} />
        <KpiCard testId="kpi-low-stock" icon={AlertTriangle} accent={k.low_stock_count ? "rose" : "slate"} label="Stok Minimum" value={angka(k.low_stock_count)} sub="Item perlu restock" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard testId="kpi-gudang" icon={Warehouse} accent="slate" label="Gudang" value={angka(k.jumlah_gudang)} />
        <KpiCard testId="kpi-supplier" icon={Truck} accent="slate" label="Supplier" value={angka(k.jumlah_supplier)} />
        <KpiCard testId="kpi-pelanggan" icon={Users} accent="slate" label="Pelanggan" value={angka(k.jumlah_pelanggan)} />
        <KpiCard testId="kpi-karyawan" icon={UserSquare2} accent="slate" label="Karyawan Aktif" value={angka(k.karyawan_aktif)} />
        <KpiCard testId="kpi-expiring" icon={CalendarClock} accent={k.expiring_count ? "amber" : "slate"} label="Segera Expired" value={angka(k.expiring_count)} />
        <KpiCard testId="kpi-movement" icon={Clock} accent="violet" label="Transaksi Hari Ini" value={angka(k.movement_today)} />
      </div>

      {/* Sales & finance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard testId="kpi-omzet-bulan" icon={ShoppingCart} accent="emerald" label="Omzet Bulan Ini" value={rupiah(k.omzet_bulan)} sub={`${angka(k.total_transaksi)} transaksi (tahun)`} />
        <KpiCard testId="kpi-omzet-hari" icon={TrendingUp} accent="sky" label="Omzet Hari Ini" value={rupiah(k.omzet_hari_ini)} />
        <KpiCard testId="kpi-laba-kotor" icon={Wallet} accent="violet" label="Laba Kotor Bulan Ini" value={rupiah(k.laba_kotor)} />
        <KpiCard testId="kpi-piutang" icon={HandCoins} accent="amber" label="Piutang" value={rupiah(k.piutang)} sub="Belum tertagih" />
        <KpiCard testId="kpi-produksi" icon={Factory} accent="slate" label="Total Produksi" value={angka(k.total_produksi)} />
      </div>

      {/* Omzet trend + best sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="font-heading font-semibold text-slate-800">Tren Omzet (7 Hari)</h3>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data?.chart_sales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="omzet" name="Omzet" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-emerald-600" />
            <h3 className="font-heading font-semibold text-slate-800">Produk Terlaris</h3>
          </div>
          <div className="space-y-3">
            {(data?.top_products || []).slice(0, 6).map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-6 w-6 rounded bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="truncate text-slate-700">{it.nama}</span>
                </div>
                <span className="font-medium text-slate-900">{rupiah(it.nilai)}</span>
              </div>
            ))}
            {(!data?.top_products || data.top_products.length === 0) && <p className="text-sm text-slate-400">Belum ada penjualan</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Movement chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="font-heading font-semibold text-slate-800">Pergerakan Stok (7 Hari)</h3>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data?.chart_movement || []}>
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

        {/* Top items */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <PackageSearch className="h-4 w-4 text-emerald-600" />
            <h3 className="font-heading font-semibold text-slate-800">Top Nilai Persediaan</h3>
          </div>
          <div className="space-y-3">
            {(data?.top_items || []).slice(0, 6).map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-6 w-6 rounded bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="truncate text-slate-700">{it.nama}</span>
                </div>
                <span className="font-medium text-slate-900">{rupiah(it.nilai)}</span>
              </div>
            ))}
            {(!data?.top_items || data.top_items.length === 0) && <p className="text-sm text-slate-400">Belum ada data</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Perlu Restock
          </h3>
          <div className="space-y-2">
            {(data?.low_stock || []).map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-700">{it.nama}</span>
                <StatusBadge variant="warning">{angka(it.qty)} / min {angka(it.stok_min)} {it.satuan}</StatusBadge>
              </div>
            ))}
            {(!data?.low_stock || data.low_stock.length === 0) && <p className="text-sm text-slate-400">Semua stok aman </p>}
          </div>
        </div>

        {/* Recent movements */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" /> Transaksi Stok Terbaru
          </h3>
          <div className="space-y-2">
            {(data?.recent_movements || []).map((m, i) => (
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
            {(!data?.recent_movements || data.recent_movements.length === 0) && <p className="text-sm text-slate-400">Belum ada transaksi</p>}
          </div>
        </div>
      </div>
      {isLoading && <p className="text-sm text-slate-400 mt-4">Memuat data...</p>}
    </div>
  );
}
