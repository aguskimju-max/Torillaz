import React from "react";
import {
  Boxes, Wheat, Package, Warehouse, Truck, Users, AlertTriangle, TrendingUp,
  Clock, UserSquare2, CalendarClock, ShoppingCart, Wallet, HandCoins, Factory,
} from "lucide-react";
import KpiCard from "@/components/common/KpiCard";
import { rupiah, angka } from "@/lib/format";

export function DashboardKpis({ k }) {
  return (
    <>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard testId="kpi-omzet-bulan" icon={ShoppingCart} accent="emerald" label="Omzet Bulan Ini" value={rupiah(k.omzet_bulan)} sub={`${angka(k.total_transaksi)} transaksi (tahun)`} />
        <KpiCard testId="kpi-omzet-hari" icon={TrendingUp} accent="sky" label="Omzet Hari Ini" value={rupiah(k.omzet_hari_ini)} />
        <KpiCard testId="kpi-laba-kotor" icon={Wallet} accent="violet" label="Laba Kotor Bulan Ini" value={rupiah(k.laba_kotor)} />
        <KpiCard testId="kpi-piutang" icon={HandCoins} accent="amber" label="Piutang" value={rupiah(k.piutang)} sub="Belum tertagih" />
        <KpiCard testId="kpi-produksi" icon={Factory} accent="slate" label="Total Produksi" value={angka(k.total_produksi)} />
      </div>
    </>
  );
}
