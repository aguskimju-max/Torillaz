import React, { useMemo, useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, PackageMinus, SlidersHorizontal, ArrowLeftRight, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rupiah, angka, tanggalWaktu } from "@/lib/format";

const MODE_META = {
  penerimaan: { title: "Penerimaan Barang", icon: PackagePlus, desc: "Barang masuk ke gudang (stok bertambah)", qtyLabel: "Jumlah Masuk", price: true, tipe: "penerimaan" },
  pengeluaran: { title: "Pengeluaran Barang", icon: PackageMinus, desc: "Barang keluar dari gudang (stok berkurang)", qtyLabel: "Jumlah Keluar", price: false, tipe: "pengeluaran" },
  penyesuaian: { title: "Penyesuaian Stok", icon: SlidersHorizontal, desc: "Koreksi stok (+ menambah / - mengurangi)", qtyLabel: "Qty Penyesuaian (+/-)", price: true, tipe: "penyesuaian", signed: true },
  transfer: { title: "Transfer Antar Gudang", icon: ArrowLeftRight, desc: "Pindahkan stok dari satu gudang ke gudang lain", qtyLabel: "Jumlah Transfer", price: false, tipe: "transfer", transfer: true },
  opname: { title: "Stock Opname", icon: ClipboardCheck, desc: "Input hasil hitung fisik, sistem hitung selisih", qtyLabel: "Qty Fisik (hasil hitung)", price: false, tipe: "opname" },
};

export default function StockOperationPage({ mode }) {
  const meta = MODE_META[mode];
  const qc = useQueryClient();
  const [form, setForm] = useState({ item_type: "bahan_baku" });
  const change = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const [itemsBB, itemsBJ, gudangs] = useQueries({
    queries: [
      { queryKey: ["options", "bahan_baku"], queryFn: async () => (await api.get("/master/bahan_baku/options")).data },
      { queryKey: ["options", "barang_jadi"], queryFn: async () => (await api.get("/master/barang_jadi/options")).data },
      { queryKey: ["options", "gudang"], queryFn: async () => (await api.get("/master/gudang/options")).data },
    ],
  });
  const items = (form.item_type === "barang_jadi" ? itemsBJ.data : itemsBB.data) || [];
  const selectedItem = items.find((i) => String(i.id) === String(form.item_id));

  const { data: moves, isLoading } = useQuery({
    queryKey: ["movements", meta.tipe],
    queryFn: async () => (await api.get("/stock/movements", { params: { tipe: meta.tipe === "transfer" ? "transfer_keluar" : meta.tipe, limit: 15 } })).data,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, tipe: meta.tipe, qty: Number(form.qty) };
      if (meta.price && form.harga_satuan) payload.harga_satuan = Number(form.harga_satuan);
      return (await api.post("/stock/movement", payload)).data;
    },
    onSuccess: () => {
      toast.success(`${meta.title} berhasil dicatat`);
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      setForm({ item_type: form.item_type });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.item_id || !form.gudang_id || !form.qty) return toast.error("Lengkapi item, gudang, dan qty");
    if (meta.transfer && !form.gudang_tujuan_id) return toast.error("Pilih gudang tujuan");
    mut.mutate();
  };

  const Icon = meta.icon;
  const columns = [
    { key: "no_transaksi", label: "No. Transaksi" },
    { key: "item_nama", label: "Item" },
    { key: "gudang_nama", label: "Gudang" },
    { key: "batch", label: "Batch" },
    { key: "qty", label: "Qty", align: "right", render: (r) => <span className={r.qty >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>{r.qty >= 0 ? "+" : ""}{angka(r.qty)} {r.satuan}</span> },
    { key: "saldo_akhir", label: "Saldo", align: "right", render: (r) => angka(r.saldo_akhir) },
    { key: "created_at", label: "Waktu", render: (r) => tanggalWaktu(r.created_at) },
  ];

  return (
    <div>
      <PageHeader title={meta.title} subtitle={meta.desc} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="lg:col-span-1 bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-emerald-700">
            <Icon className="h-5 w-5" />
            <span className="font-heading font-semibold">Form {meta.title}</span>
          </div>

          <div>
            <Label className="mb-1.5 block">Jenis Item</Label>
            <Select value={form.item_type} onValueChange={(v) => setForm({ item_type: v })}>
              <SelectTrigger data-testid="stock-item-type" className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="bahan_baku">Bahan Baku</SelectItem>
                <SelectItem value="barang_jadi">Barang Jadi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Item <span className="text-rose-500">*</span></Label>
            <Select value={form.item_id || ""} onValueChange={(v) => change("item_id", v)}>
              <SelectTrigger data-testid="stock-item" className="bg-white"><SelectValue placeholder="Pilih item..." /></SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                {items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.nama} ({i.kode})</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedItem && <p className="text-xs text-slate-400 mt-1">Satuan: {selectedItem.satuan_nama} · Stok min: {angka(selectedItem.stok_min)}</p>}
          </div>

          <div>
            <Label className="mb-1.5 block">{meta.transfer ? "Gudang Asal" : "Gudang"} <span className="text-rose-500">*</span></Label>
            <Select value={form.gudang_id || ""} onValueChange={(v) => change("gudang_id", v)}>
              <SelectTrigger data-testid="stock-gudang" className="bg-white"><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {(gudangs.data || []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {meta.transfer && (
            <div>
              <Label className="mb-1.5 block">Gudang Tujuan <span className="text-rose-500">*</span></Label>
              <Select value={form.gudang_tujuan_id || ""} onValueChange={(v) => change("gudang_tujuan_id", v)}>
                <SelectTrigger data-testid="stock-gudang-tujuan" className="bg-white"><SelectValue placeholder="Pilih gudang tujuan..." /></SelectTrigger>
                <SelectContent className="bg-white">
                  {(gudangs.data || []).filter((g) => String(g.id) !== String(form.gudang_id)).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Batch / Lot</Label>
              <Input data-testid="stock-batch" value={form.batch || ""} onChange={(e) => change("batch", e.target.value)} placeholder="Opsional" />
            </div>
            <div>
              <Label className="mb-1.5 block">Expired Date</Label>
              <Input data-testid="stock-expired" type="date" value={form.expired_date || ""} onChange={(e) => change("expired_date", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">{meta.qtyLabel} <span className="text-rose-500">*</span></Label>
              <Input data-testid="stock-qty" type="number" step="any" value={form.qty || ""} onChange={(e) => change("qty", e.target.value)} placeholder="0" />
            </div>
            {meta.price && (
              <div>
                <Label className="mb-1.5 block">Harga Satuan</Label>
                <Input data-testid="stock-harga" type="number" value={form.harga_satuan || ""} onChange={(e) => change("harga_satuan", e.target.value)} placeholder="0" />
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block">Keterangan</Label>
            <Textarea data-testid="stock-keterangan" value={form.keterangan || ""} onChange={(e) => change("keterangan", e.target.value)} placeholder="Opsional" />
          </div>

          <Button data-testid="stock-submit" type="submit" disabled={mut.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {mut.isPending ? "Menyimpan..." : `Catat ${meta.title}`}
          </Button>
        </form>

        <div className="lg:col-span-2">
          <h3 className="font-heading font-semibold text-slate-800 mb-3">Transaksi Terbaru</h3>
          <DataTable testId="stock-movements-table" columns={columns} rows={moves?.items || []} loading={isLoading} total={moves?.total || 0} limit={15} />
        </div>
      </div>
    </div>
  );
}
