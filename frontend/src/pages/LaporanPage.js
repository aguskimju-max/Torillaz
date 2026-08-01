import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, TrendingUp, Boxes, Factory, Users } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenjualanReport } from "@/pages/laporan/PenjualanReport";
import { LabaRugiReport } from "@/pages/laporan/LabaRugiReport";
import { PersediaanReport } from "@/pages/laporan/PersediaanReport";
import { ProduksiReport } from "@/pages/laporan/ProduksiReport";
import { PayrollReport } from "@/pages/laporan/PayrollReport";

const firstOfMonth = () => new Date().toISOString().slice(0, 8) + "01";
const today = () => new Date().toISOString().slice(0, 10);
const inRange = (d, s, e) => { const x = (d || "").slice(0, 10); return x >= s && x <= e; };

export default function LaporanPage() {
  const [tab, setTab] = useState("penjualan");
  const [range, setRange] = useState({ start: firstOfMonth(), end: today() });
  const [periode, setPeriode] = useState(new Date().toISOString().slice(0, 7));

  const { data: sales } = useQuery({ queryKey: ["rep-sales"], queryFn: async () => (await api.get("/sales/orders", { params: { limit: 2000 } })).data, enabled: tab === "penjualan" });
  const { data: lr } = useQuery({ queryKey: ["rep-lr", range.start, range.end], queryFn: async () => (await api.get("/finance/laba-rugi", { params: range })).data, enabled: tab === "labarugi" });
  const { data: stok } = useQuery({ queryKey: ["rep-stok"], queryFn: async () => (await api.get("/stock/balances", { params: { limit: 2000 } })).data, enabled: tab === "persediaan" });
  const { data: prod } = useQuery({ queryKey: ["rep-prod"], queryFn: async () => (await api.get("/production/orders", { params: { limit: 2000 } })).data, enabled: tab === "produksi" });
  const { data: payroll } = useQuery({ queryKey: ["rep-payroll", periode], queryFn: async () => (await api.get("/hr/payroll", { params: { periode, limit: 500 } })).data, enabled: tab === "payroll" });
  const { data: perusahaan } = useQuery({ queryKey: ["perusahaan-list"], queryFn: async () => (await api.get("/master/perusahaan", { params: { limit: 1 } })).data });
  const company = perusahaan?.items?.[0];

  const salesRows = useMemo(() => (sales?.items || []).filter((s) => s.status !== "draft" && inRange(s.tanggal, range.start, range.end)), [sales, range]);
  const salesTotal = salesRows.reduce((a, r) => a + (r.total || 0), 0);

  return (
    <div>
      <PageHeader title="Laporan" subtitle="Laporan lengkap dengan filter tanggal dan export Excel/PDF" />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList data-testid="laporan-tabs">
          <TabsTrigger value="penjualan" data-testid="tab-penjualan"><ShoppingCart className="h-4 w-4 mr-1.5" /> Penjualan</TabsTrigger>
          <TabsTrigger value="labarugi" data-testid="tab-labarugi"><TrendingUp className="h-4 w-4 mr-1.5" /> Laba/Rugi</TabsTrigger>
          <TabsTrigger value="persediaan" data-testid="tab-persediaan"><Boxes className="h-4 w-4 mr-1.5" /> Persediaan</TabsTrigger>
          <TabsTrigger value="produksi" data-testid="tab-produksi"><Factory className="h-4 w-4 mr-1.5" /> Produksi</TabsTrigger>
          <TabsTrigger value="payroll" data-testid="tab-payroll"><Users className="h-4 w-4 mr-1.5" /> Payroll</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "penjualan" && <PenjualanReport range={range} setRange={setRange} salesRows={salesRows} salesTotal={salesTotal} />}
      {tab === "labarugi" && <LabaRugiReport range={range} setRange={setRange} lr={lr} company={company} />}
      {tab === "persediaan" && <PersediaanReport stok={stok} />}
      {tab === "produksi" && <ProduksiReport prod={prod} />}
      {tab === "payroll" && <PayrollReport payroll={payroll} periode={periode} setPeriode={setPeriode} />}
    </div>
  );
}
