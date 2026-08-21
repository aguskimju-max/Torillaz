import React, { useState, useMemo } from "react";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { rupiah, angka, tanggal } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { item_id: "", gudang_id: "", tanggal_produksi: today(), expired_date: "", qty: "" };
const NEW_PRODUCT = { nama: "", satuan_id: "", harga_jual: "", harga_pokok: "" };

export default function StokInputPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [addOpen, setAddOpen] = useState(false);
  const [np, setNp] = useState(NEW_PRODUCT);
  const [extraProducts, setExtraProducts] = useState([]);
  const change = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const [produk, gudangs, satuans] = useQueries({
    queries: [
      { queryKey: ["options", "barang_jadi"], queryFn: async () => (await api.get("/master/barang_jadi/options")).data },
      { queryKey: ["options", "gudang"], queryFn: async () => (await api.get("/master/gudang/options")).data },
      { queryKey: ["options", "satuan"], queryFn: async () => (await api.get("/master/satuan/options")).data },
    ],
  });
  const products = useMemo(() => {
    const map = new Map();
    [...(produk.data || []), ...extraProducts].forEach((p) => map.set(String(p.id), p));
    return Array.from(map.values());
  }, [produk.data, extraProducts]);
  const selected = products.find((p) => String(p.id) === String(form.item_id));

  const { data: stok, isLoading } = useQuery({
    queryKey: ["balances", "barang_jadi-simple"],
    queryFn: async () => (await api.get("/stock/balances", { params: { item_type: "barang_jadi", limit: 50 } })).data,
  });

  const inMut = useMutation({
    mutationFn: async () => (await api.post("/stock/simple-in", {
      item_id: form.item_id, gudang_id: form.gudang_id,
      tanggal_produksi: form.tanggal_produksi, expired_date: form.expired_date || undefined,
      qty: Number(form.qty),
    })).data,
    onSuccess: () => {
      toast.success("Produksi tercatat, stok bertambah");
      ["balances", "dashboard", "notifications"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setForm((p) => ({ ...EMPTY, gudang_id: p.gudang_id, tanggal_produksi: p.tanggal_produksi }));
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const sat = (satuans.data || []).find((s) => String(s.id) === String(np.satuan_id));
      return (await api.post("/master/barang_jadi", {
        nama: np.nama, satuan_id: np.satuan_id, satuan_nama: sat?.nama,
        harga_jual: Number(np.harga_jual) || 0, harga_pokok: Number(np.harga_pokok) || 0,
      })).data;
    },
    onSuccess: (created) => {
      toast.success("Produk baru ditambahkan");
      setExtraProducts((prev) => [...prev, created]);
      qc.invalidateQueries({ queryKey: ["options", "barang_jadi"] });
      setForm((p) => ({ ...p, item_id: String(created.id) }));
      setAddOpen(false);
      setNp(NEW_PRODUCT);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.item_id) return toast.error("Pilih produk dulu");
    if (!form.gudang_id) return toast.error("Pilih gudang dulu");
    if (!form.tanggal_produksi) return toast.error("Isi tanggal produksi");
    if (!form.qty || Number(form.qty) <= 0) return toast.error("Jumlah harus lebih dari 0");
    inMut.mutate();
  };

  const columns = [
    { key: "item_nama", label: "Produk", render: (r) => <div><div className="font-medium text-slate-800">{r.item_nama}</div><div className="text-xs text-slate-400">{r.item_kode}</div></div> },
    { key: "gudang_nama", label: "Gudang" },
    { key: "tanggal_produksi", label: "Tgl Produksi", render: (r) => r.tanggal_produksi ? tanggal(r.tanggal_produksi) : (r.batch && r.batch !== "-" ? r.batch : "-") },
    { key: "expired_date", label: "Kadaluarsa", render: (r) => r.expired_date ? tanggal(r.expired_date) : "-" },
    { key: "qty", label: "Jumlah", align: "right", render: (r) => <span className="font-medium">{angka(r.qty)} {r.satuan}</span> },
  ];

  return (
    <div>
      <PageHeader title="Produksi" subtitle="Catat hasil produksi (produk + tanggal produksi + jumlah) — stok otomatis bertambah" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} data-testid="stok-input-form" className="lg:col-span-1 bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-emerald-700">
            <PackagePlus className="h-5 w-5" />
            <span className="font-heading font-semibold">Form Produksi</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Produk <span className="text-rose-500">*</span></Label>
              {hasPerm("master", "add") && (
                <button type="button" data-testid="stok-add-product-btn" onClick={() => setAddOpen(true)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Produk Baru
                </button>
              )}
            </div>
            <Select value={form.item_id || ""} onValueChange={(v) => { if (v) change("item_id", v); }}>
              <SelectTrigger data-testid="stok-produk" className="bg-white">
                <span className={selected ? "line-clamp-1" : "text-muted-foreground"}>
                  {selected ? `${selected.nama} (${selected.kode})` : "Pilih produk..."}
                </span>
              </SelectTrigger>
              <SelectContent className="bg-white max-h-64">
                {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nama} ({p.kode})</SelectItem>)}
                {products.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Belum ada produk</div>}
              </SelectContent>
            </Select>
            {selected && <p className="text-xs text-slate-400 mt-1">Satuan: {selected.satuan_nama || "-"} · Harga jual: {rupiah(selected.harga_jual)}</p>}
          </div>

          <div>
            <Label className="mb-1.5 block">Gudang <span className="text-rose-500">*</span></Label>
            <Select value={form.gudang_id || ""} onValueChange={(v) => change("gudang_id", v)}>
              <SelectTrigger data-testid="stok-gudang" className="bg-white"><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {(gudangs.data || []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Tanggal Produksi <span className="text-rose-500">*</span></Label>
              <Input data-testid="stok-tgl-produksi" type="date" value={form.tanggal_produksi} onChange={(e) => change("tanggal_produksi", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Kadaluarsa</Label>
              <Input data-testid="stok-kadaluarsa" type="date" value={form.expired_date} onChange={(e) => change("expired_date", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Jumlah <span className="text-rose-500">*</span></Label>
            <Input data-testid="stok-jumlah" type="number" step="any" value={form.qty} onChange={(e) => change("qty", e.target.value)} placeholder="0" />
          </div>

          <Button data-testid="stok-submit" type="submit" disabled={inMut.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {inMut.isPending ? "Menyimpan..." : "Simpan Produksi"}
          </Button>
        </form>

        <div className="lg:col-span-2">
          <h3 className="font-heading font-semibold text-slate-800 mb-3">Stok Produk Saat Ini</h3>
          <DataTable testId="stok-input-table" columns={columns} rows={stok?.items || []} loading={isLoading} total={stok?.total || 0} limit={50} emptyText="Belum ada stok produk" />
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-white max-w-sm" data-testid="stok-add-product-dialog">
          <DialogHeader><DialogTitle className="font-heading">Tambah Produk Baru</DialogTitle>
            <DialogDescription>Produk baru akan langsung terpilih untuk input stok.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="mb-1.5 block">Nama Produk <span className="text-rose-500">*</span></Label>
              <Input data-testid="np-nama" value={np.nama} onChange={(e) => setNp((p) => ({ ...p, nama: e.target.value }))} placeholder="cth: Tortilla Original" />
            </div>
            <div>
              <Label className="mb-1.5 block">Satuan <span className="text-rose-500">*</span></Label>
              <Select value={np.satuan_id || ""} onValueChange={(v) => setNp((p) => ({ ...p, satuan_id: v }))}>
                <SelectTrigger data-testid="np-satuan" className="bg-white"><SelectValue placeholder="Pilih satuan..." /></SelectTrigger>
                <SelectContent className="bg-white max-h-56">
                  {(satuans.data || []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Harga Jual</Label>
                <Input data-testid="np-harga-jual" type="number" value={np.harga_jual} onChange={(e) => setNp((p) => ({ ...p, harga_jual: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label className="mb-1.5 block">Harga Pokok</Label>
                <Input data-testid="np-harga-pokok" type="number" value={np.harga_pokok} onChange={(e) => setNp((p) => ({ ...p, harga_pokok: e.target.value }))} placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button data-testid="np-submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={addMut.isPending || !np.nama || !np.satuan_id} onClick={() => addMut.mutate()}>
              {addMut.isPending ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
