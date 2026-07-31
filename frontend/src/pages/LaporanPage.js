import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, TrendingUp, Boxes, Factory, Users } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import KpiCard from "@/components/common/KpiCard";
import ExportButtons from "@/components/common/ExportButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rupiah, angka, tanggal } from "@/lib/format";
import { labaRugiPDF } from "@/lib/pdf";

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

  const RangeBar = ({ children }) => (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <div><Label className="mb-1.5 block">Dari</Label><Input data-testid="rep-start" type="date" value={range.start} onChange={(e) => setRange((p) => ({ ...p, start: e.target.value }))} className="w-44" /></div>
      <div><Label className="mb-1.5 block">Sampai</Label><Input data-testid="rep-end" type="date" value={range.end} onChange={(e) => setRange((p) => ({ ...p, end: e.target.value }))} className="w-44" /></div>
      <div className="flex-1" />{children}
    </div>
  );

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

      {tab === "penjualan" && (<>
        <RangeBar>
          <ExportButtons testId="rep-sales-export" filename={`Laporan-Penjualan-${range.start}_${range.end}`} title="Laporan Penjualan" subtitle={`${range.start} s/d ${range.end}`} orientation="landscape" rows={salesRows} columns={[
            { label: "No. SO", value: (r) => r.no_so }, { label: "Tanggal", value: (r) => tanggal(r.tanggal) }, { label: "Pelanggan", value: (r) => r.pelanggan_nama || "" },
            { label: "Invoice", value: (r) => r.no_invoice || "" }, { label: "Tipe", value: (r) => r.tipe }, { label: "Total", value: (r) => r.total, align: "right" },
            { label: "Terbayar", value: (r) => r.terbayar, align: "right" }, { label: "Sisa", value: (r) => r.sisa, align: "right" }, { label: "Status", value: (r) => r.status }]} />
        </RangeBar>
        <div className="mb-3 text-sm text-slate-600">Total omzet periode: <b className="text-emerald-700">{rupiah(salesTotal)}</b> · {salesRows.length} transaksi</div>
        <DataTable testId="rep-sales-table" columns={[
          { key: "no_so", label: "No. SO", render: (r) => <span className="font-mono text-xs">{r.no_so}</span> }, { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
          { key: "pelanggan_nama", label: "Pelanggan" }, { key: "total", label: "Total", align: "right", render: (r) => rupiah(r.total) },
          { key: "sisa", label: "Sisa", align: "right", render: (r) => rupiah(r.sisa) }, { key: "status", label: "Status" }]} rows={salesRows} total={salesRows.length} />
      </>)}

      {tab === "labarugi" && (<>
        <RangeBar>
          <Button variant="outline" data-testid="rep-lr-pdf" disabled={!lr} onClick={() => labaRugiPDF(lr, company, `${tanggal(range.start)} — ${tanggal(range.end)}`)}>Export PDF</Button>
        </RangeBar>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <KpiCard testId="rep-lr-pendapatan" icon={TrendingUp} accent="emerald" label="Pendapatan" value={rupiah(lr?.pendapatan)} />
          <KpiCard testId="rep-lr-hpp" icon={Boxes} accent="amber" label="HPP" value={rupiah(lr?.hpp)} />
          <KpiCard testId="rep-lr-beban" icon={ShoppingCart} accent="rose" label="Total Beban" value={rupiah(lr?.total_beban)} />
          <KpiCard testId="rep-lr-bersih" icon={TrendingUp} accent="emerald" label="Laba Bersih" value={rupiah(lr?.laba_bersih)} />
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-xl">
          <div className="flex justify-between py-1 text-slate-600"><span>Pendapatan</span><span>{rupiah(lr?.pendapatan)}</span></div>
          <div className="flex justify-between py-1 text-slate-600"><span>HPP</span><span>({rupiah(lr?.hpp)})</span></div>
          <div className="flex justify-between py-1 font-semibold border-t border-slate-200 mt-1"><span>Laba Kotor</span><span className="text-emerald-700">{rupiah(lr?.laba_kotor)}</span></div>
          {(lr?.beban || []).map((b, i) => <div key={i} className="flex justify-between py-1 text-slate-600 pl-3"><span>{b.kategori}</span><span>({rupiah(b.jumlah)})</span></div>)}
          <div className="flex justify-between py-1 font-semibold border-t border-slate-200 mt-1"><span>Total Beban</span><span className="text-rose-600">({rupiah(lr?.total_beban)})</span></div>
          <div className="flex justify-between py-2 border-t-2 border-emerald-600 mt-2 font-bold"><span>Laba Bersih</span><span className="text-emerald-700">{rupiah(lr?.laba_bersih)}</span></div>
        </div>
      </>)}

      {tab === "persediaan" && (<>
        <div className="flex justify-end mb-4">
          <ExportButtons testId="rep-stok-export" filename="Laporan-Persediaan" title="Laporan Persediaan / Stok" orientation="landscape" rows={stok?.items || []} columns={[
            { label: "Kode", value: (r) => r.item_kode || "" }, { label: "Nama", value: (r) => r.item_nama || "" }, { label: "Gudang", value: (r) => r.gudang_nama || "" },
            { label: "Batch", value: (r) => r.batch || "" }, { label: "Qty", value: (r) => r.qty, align: "right" }, { label: "Satuan", value: (r) => r.satuan || "" },
            { label: "Harga Rata2", value: (r) => r.avg_price, align: "right" }, { label: "Nilai", value: (r) => r.nilai, align: "right" }]} />
        </div>
        <DataTable testId="rep-stok-table" columns={[
          { key: "item_nama", label: "Item", render: (r) => <div><div className="font-medium">{r.item_nama}</div><div className="text-xs text-slate-400">{r.item_kode}</div></div> },
          { key: "gudang_nama", label: "Gudang" }, { key: "batch", label: "Batch", render: (r) => r.batch || "-" },
          { key: "qty", label: "Qty", align: "right", render: (r) => `${angka(r.qty)} ${r.satuan || ""}` },
          { key: "nilai", label: "Nilai", align: "right", render: (r) => rupiah(r.nilai) }]} rows={stok?.items || []} total={stok?.total || 0} />
      </>)}

      {tab === "produksi" && (<>
        <div className="flex justify-end mb-4">
          <ExportButtons testId="rep-prod-export" filename="Laporan-Produksi" title="Laporan Produksi & HPP" orientation="landscape" rows={prod?.items || []} columns={[
            { label: "No. Produksi", value: (r) => r.no_produksi }, { label: "Tanggal", value: (r) => tanggal(r.tanggal) }, { label: "Produk", value: (r) => r.barang_jadi_nama || "" },
            { label: "Hasil", value: (r) => r.qty_hasil, align: "right" }, { label: "HPP/Unit", value: (r) => r.hpp_per_unit, align: "right" }, { label: "Total HPP", value: (r) => r.total_hpp, align: "right" }]} />
        </div>
        <DataTable testId="rep-prod-table" columns={[
          { key: "no_produksi", label: "No. Produksi", render: (r) => <span className="font-mono text-xs">{r.no_produksi}</span> }, { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
          { key: "barang_jadi_nama", label: "Produk" }, { key: "qty_hasil", label: "Hasil", align: "right", render: (r) => angka(r.qty_hasil) },
          { key: "hpp_per_unit", label: "HPP/Unit", align: "right", render: (r) => rupiah(r.hpp_per_unit) }, { key: "total_hpp", label: "Total HPP", align: "right", render: (r) => rupiah(r.total_hpp) }]} rows={prod?.items || []} total={prod?.total || 0} />
      </>)}

      {tab === "payroll" && (<>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4 flex items-end gap-3">
          <div><Label className="mb-1.5 block">Periode</Label><Input data-testid="rep-payroll-periode" type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-44" /></div>
          <div className="flex-1" />
          <ExportButtons testId="rep-payroll-export" filename={`Laporan-Payroll-${periode}`} title={`Laporan Payroll ${periode}`} orientation="landscape" rows={payroll?.items || []} columns={[
            { label: "No. Slip", value: (r) => r.no }, { label: "Karyawan", value: (r) => r.karyawan_nama }, { label: "Jabatan", value: (r) => r.jabatan_nama },
            { label: "Gaji Pokok", value: (r) => (r.gaji_diperoleh != null ? r.gaji_diperoleh : r.gaji_pokok), align: "right" }, { label: "Lembur", value: (r) => r.upah_lembur, align: "right" }, { label: "Potongan", value: (r) => r.total_potongan, align: "right" },
            { label: "Gaji Bersih", value: (r) => r.gaji_bersih, align: "right" }, { label: "Status", value: (r) => r.status }]} />
        </div>
        <div className="mb-3 text-sm text-slate-600">Total gaji periode: <b className="text-emerald-700">{rupiah(payroll?.total_gaji)}</b></div>
        <DataTable testId="rep-payroll-table" columns={[
          { key: "karyawan_nama", label: "Karyawan" }, { key: "jabatan_nama", label: "Jabatan" },
          { key: "gaji_pokok", label: "Gaji Pokok", align: "right", render: (r) => rupiah(r.gaji_diperoleh != null ? r.gaji_diperoleh : r.gaji_pokok) }, { key: "total_potongan", label: "Potongan", align: "right", render: (r) => rupiah(r.total_potongan) },
          { key: "gaji_bersih", label: "Gaji Bersih", align: "right", render: (r) => <span className="font-semibold text-emerald-700">{rupiah(r.gaji_bersih)}</span> }, { key: "status", label: "Status" }]} rows={payroll?.items || []} total={payroll?.total || 0} emptyText="Belum ada payroll pada periode ini" />
      </>)}
    </div>
  );
}
