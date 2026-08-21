import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rupiah, angka, tanggal } from "@/lib/format";

const isExpiring = (d) => d && new Date(d) <= new Date(Date.now() + 30 * 86400000);
const expBadge = (d) => (
  <StatusBadge variant={new Date(d) < new Date() ? "danger" : isExpiring(d) ? "warning" : "neutral"}>{tanggal(d)}</StatusBadge>
);

export default function StokListPage() {
  const [q, setQ] = useState("");
  const [itemType, setItemType] = useState("all");
  const [lowOnly, setLowOnly] = useState("all");
  const [detail, setDetail] = useState(null);

  const params = { q };
  if (itemType !== "all") params.item_type = itemType;
  if (lowOnly === "low") params.low_only = "true";

  const { data, isLoading } = useQuery({
    queryKey: ["stock-summary", q, itemType, lowOnly],
    queryFn: async () => (await api.get("/stock/summary", { params })).data,
  });
  const items = data?.items || [];

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["stock-detail", detail?.item_id],
    queryFn: async () => (await api.get("/stock/balances", { params: { item_type: detail.item_type, item_id: detail.item_id, limit: 200 } })).data,
    enabled: !!detail,
  });

  const exportExcel = () => {
    const rows = items.map((r) => ({
      Kode: r.item_kode, Nama: r.item_nama, "Total Qty": r.total_qty, Satuan: r.satuan,
      "Lokasi/Batch": r.lokasi, "Nilai Total": r.total_nilai, Status: r.is_low ? "Stok Minimum" : "Aman",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Stok");
    XLSX.writeFile(wb, "rekap-stok.xlsx");
  };

  const columns = [
    { key: "item_kode", label: "Kode" },
    { key: "item_nama", label: "Nama Item", render: (r) => <span className="font-medium text-slate-800">{r.item_nama}</span> },
    { key: "total_qty", label: "Total Qty", align: "right", render: (r) => <span className="font-semibold">{angka(r.total_qty)} {r.satuan}</span> },
    { key: "lokasi", label: "Lokasi/Batch", align: "right", render: (r) => r.lokasi },
    { key: "total_nilai", label: "Nilai Total", align: "right", render: (r) => rupiah(r.total_nilai) },
    { key: "status", label: "Status", render: (r) => r.total_qty < 0
      ? <StatusBadge variant="danger">Negatif</StatusBadge>
      : r.is_low ? <StatusBadge variant="warning">Stok Minimum</StatusBadge>
      : <StatusBadge variant="success">Aman</StatusBadge> },
    { key: "_detail", label: "Detail", align: "right", render: (r) => (
      <Button variant="outline" size="sm" data-testid={`stok-detail-${r.item_id}`} onClick={() => setDetail(r)}>
        <Eye className="h-4 w-4 mr-1.5" /> Detail
      </Button>
    ) },
  ];

  const detailRows = detailData?.items || [];

  return (
    <div>
      <PageHeader title="Stok Saat Ini" subtitle="Rekap total stok per item — klik Detail untuk rincian per gudang & batch">
        <Button variant="outline" data-testid="export-stok" onClick={exportExcel}>
          <Download className="h-4 w-4 mr-1.5" /> Export Excel
        </Button>
      </PageHeader>

      <DataTable
        testId="stok-table"
        columns={columns}
        rows={items}
        loading={isLoading}
        total={items.length}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Cari item..."
        emptyText="Belum ada stok"
        toolbar={
          <>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger data-testid="filter-item-type" className="w-40 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="bahan_baku">Bahan Baku</SelectItem>
                <SelectItem value="barang_jadi">Barang Jadi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lowOnly} onValueChange={setLowOnly}>
              <SelectTrigger data-testid="filter-low" className="w-36 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Semua Stok</SelectItem>
                <SelectItem value="low">Stok Minimum</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-white max-w-3xl" data-testid="stok-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Rincian Stok · {detail?.item_nama}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-500 -mt-1">
            Total: <b className="text-slate-800">{angka(detail?.total_qty)} {detail?.satuan}</b> · {detail?.lokasi} lokasi/batch · Nilai {rupiah(detail?.total_nilai)}
          </div>
          <div className="overflow-auto max-h-[58vh] mt-2 rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2">Gudang</th>
                  <th className="text-left px-3 py-2">Batch / Tgl Produksi</th>
                  <th className="px-3 py-2">Kadaluarsa</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Harga Rata²</th>
                  <th className="text-right px-3 py-2">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((b) => (
                  <tr key={`${b.gudang_id}-${b.batch}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">{b.gudang_nama}</td>
                    <td className="px-3 py-2">{b.tanggal_produksi ? tanggal(b.tanggal_produksi) : (b.batch && b.batch !== "-" ? b.batch : "-")}</td>
                    <td className="px-3 py-2 text-center">{b.expired_date ? expBadge(b.expired_date) : "-"}</td>
                    <td className="px-3 py-2 text-right font-medium">{angka(b.qty)} {b.satuan}</td>
                    <td className="px-3 py-2 text-right">{rupiah(b.avg_price)}</td>
                    <td className="px-3 py-2 text-right">{rupiah(b.nilai)}</td>
                  </tr>
                ))}
                {detailLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Memuat...</td></tr>}
                {!detailLoading && detailRows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Tidak ada rincian</td></tr>}
              </tbody>
              {detailRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold bg-slate-50">
                    <td className="px-3 py-2" colSpan={3}>Total</td>
                    <td className="px-3 py-2 text-right">{angka(detail?.total_qty)} {detail?.satuan}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right">{rupiah(detail?.total_nilai)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
