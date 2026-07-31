import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rupiah, angka, tanggal } from "@/lib/format";

export default function StokListPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [itemType, setItemType] = useState("all");
  const [lowOnly, setLowOnly] = useState("all");
  const limit = 20;

  const params = { q, page, limit };
  if (itemType !== "all") params.item_type = itemType;
  if (lowOnly === "low") params.low_only = "true";

  const { data, isLoading } = useQuery({
    queryKey: ["balances", q, page, itemType, lowOnly],
    queryFn: async () => (await api.get("/stock/balances", { params })).data,
  });

  const exportExcel = () => {
    const rows = (data?.items || []).map((r) => ({
      Kode: r.item_kode, Nama: r.item_nama, Gudang: r.gudang_nama, Batch: r.batch,
      Qty: r.qty, Satuan: r.satuan, "Harga Rata2": r.avg_price, Nilai: r.nilai,
      "Stok Min": r.stok_min, Expired: r.expired_date || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok");
    XLSX.writeFile(wb, "stok-saat-ini.xlsx");
  };

  const isExpiring = (d) => d && new Date(d) <= new Date(Date.now() + 30 * 86400000);

  const columns = [
    { key: "item_kode", label: "Kode" },
    { key: "item_nama", label: "Nama Item" },
    { key: "gudang_nama", label: "Gudang" },
    { key: "batch", label: "Batch" },
    { key: "expired_date", label: "Expired", render: (r) => r.expired_date
      ? <StatusBadge variant={new Date(r.expired_date) < new Date() ? "danger" : isExpiring(r.expired_date) ? "warning" : "neutral"}>{tanggal(r.expired_date)}</StatusBadge>
      : "-" },
    { key: "qty", label: "Qty", align: "right", render: (r) => `${angka(r.qty)} ${r.satuan}` },
    { key: "avg_price", label: "Harga Rata²", align: "right", render: (r) => rupiah(r.avg_price) },
    { key: "nilai", label: "Nilai", align: "right", render: (r) => rupiah(r.nilai) },
    { key: "status", label: "Status", render: (r) => r.qty < 0
      ? <StatusBadge variant="danger">Negatif</StatusBadge>
      : r.is_low ? <StatusBadge variant="warning">Stok Minimum</StatusBadge>
      : <StatusBadge variant="success">Aman</StatusBadge> },
  ];

  return (
    <div>
      <PageHeader title="Stok Saat Ini" subtitle="Posisi persediaan real-time per gudang & batch">
        <Button variant="outline" data-testid="export-stok" onClick={exportExcel}>
          <Download className="h-4 w-4 mr-1.5" /> Export Excel
        </Button>
      </PageHeader>

      <DataTable
        testId="stok-table"
        columns={columns}
        rows={data?.items || []}
        loading={isLoading}
        total={data?.total || 0}
        page={page}
        limit={limit}
        onPageChange={setPage}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Cari item..."
        toolbar={
          <>
            <Select value={itemType} onValueChange={(v) => { setItemType(v); setPage(1); }}>
              <SelectTrigger data-testid="filter-item-type" className="w-40 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="bahan_baku">Bahan Baku</SelectItem>
                <SelectItem value="barang_jadi">Barang Jadi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lowOnly} onValueChange={(v) => { setLowOnly(v); setPage(1); }}>
              <SelectTrigger data-testid="filter-low" className="w-36 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">Semua Stok</SelectItem>
                <SelectItem value="low">Stok Minimum</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
    </div>
  );
}
