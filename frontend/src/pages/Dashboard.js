import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, PackageSearch } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { DashboardKpis } from "@/pages/dashboard/DashboardKpis";
import { SalesTrendChart } from "@/pages/dashboard/SalesTrendChart";
import { MovementChart } from "@/pages/dashboard/MovementChart";
import { RankedList } from "@/pages/dashboard/RankedList";
import { LowStockList, RecentMovements } from "@/pages/dashboard/StockLists";

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

      <DashboardKpis k={k} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <SalesTrendChart data={data?.chart_sales} />
        <RankedList icon={ShoppingCart} title="Produk Terlaris" items={data?.top_products} emptyText="Belum ada penjualan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <MovementChart data={data?.chart_movement} />
        <RankedList icon={PackageSearch} title="Top Nilai Persediaan" items={data?.top_items} emptyText="Belum ada data" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LowStockList items={data?.low_stock} />
        <RecentMovements items={data?.recent_movements} />
      </div>

      {isLoading && <p className="text-sm text-slate-400 mt-4">Memuat data...</p>}
    </div>
  );
}
