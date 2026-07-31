import React, { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { angka, tanggalWaktu } from "@/lib/format";

const TIPE_LABEL = {
  penerimaan: "Penerimaan", pengeluaran: "Pengeluaran", penyesuaian: "Penyesuaian",
  transfer_keluar: "Transfer Keluar", transfer_masuk: "Transfer Masuk", opname: "Opname",
};

export default function KartuStokPage() {
  const [itemType, setItemType] = useState("bahan_baku");
  const [itemId, setItemId] = useState("");

  const [itemsBB, itemsBJ] = useQueries({
    queries: [
      { queryKey: ["options", "bahan_baku"], queryFn: async () => (await api.get("/master/bahan_baku/options")).data },
      { queryKey: ["options", "barang_jadi"], queryFn: async () => (await api.get("/master/barang_jadi/options")).data },
    ],
  });
  const items = (itemType === "barang_jadi" ? itemsBJ.data : itemsBB.data) || [];

  const { data, isLoading } = useQuery({
    queryKey: ["kartu", itemType, itemId],
    queryFn: async () => (await api.get("/stock/kartu", { params: { item_type: itemType, item_id: itemId } })).data,
    enabled: !!itemId,
  });

  const columns = [
    { key: "created_at", label: "Waktu", render: (r) => tanggalWaktu(r.created_at) },
    { key: "no_transaksi", label: "No. Transaksi" },
    { key: "tipe", label: "Tipe", render: (r) => TIPE_LABEL[r.tipe] || r.tipe },
    { key: "gudang_nama", label: "Gudang" },
    { key: "batch", label: "Batch" },
    { key: "masuk", label: "Masuk", align: "right", render: (r) => (r.qty > 0 ? angka(r.qty) : "-") },
    { key: "keluar", label: "Keluar", align: "right", render: (r) => (r.qty < 0 ? angka(Math.abs(r.qty)) : "-") },
    { key: "saldo", label: "Saldo", align: "right", render: (r) => <b>{angka(r.saldo)}</b> },
    { key: "keterangan", label: "Keterangan" },
  ];

  return (
    <div>
      <PageHeader title="Kartu Stok" subtitle="Riwayat lengkap pergerakan stok per item dengan saldo berjalan" />
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <Label className="mb-1.5 block">Jenis Item</Label>
          <Select value={itemType} onValueChange={(v) => { setItemType(v); setItemId(""); }}>
            <SelectTrigger data-testid="kartu-item-type" className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="bahan_baku">Bahan Baku</SelectItem>
              <SelectItem value="barang_jadi">Barang Jadi</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Item</Label>
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger data-testid="kartu-item" className="bg-white"><SelectValue placeholder="Pilih item..." /></SelectTrigger>
            <SelectContent className="bg-white max-h-64">
              {items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.nama} ({i.kode})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!itemId ? (
        <div className="bg-white rounded-lg border border-slate-200 p-16 text-center text-slate-400">
          <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Pilih item untuk melihat kartu stok
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-slate-600">
            Saldo akhir: <b className="text-slate-900">{angka(data?.saldo || 0)}</b> {data?.item?.satuan_nama}
          </div>
          <DataTable testId="kartu-table" columns={columns} rows={data?.movements || []} loading={isLoading} total={(data?.movements || []).length} limit={999} />
        </>
      )}
    </div>
  );
}
