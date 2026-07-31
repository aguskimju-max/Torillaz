import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Plus, X, Truck, HandCoins, Trash2, Eye, FileText, Receipt, FileDown } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rupiah, angka, tanggal } from "@/lib/format";
import { invoicePDF, notaPDF, suratJalanPDF } from "@/lib/pdf";

const EMPTY = {
  pelanggan_id: "", gudang_id: "", tanggal: new Date().toISOString().slice(0, 10),
  tipe: "tunai", jatuh_tempo: "", pajak_id: "none", rekening_id: "none", metode: "",
  catatan: "", items: [{ item_id: "", qty: "", harga: "", diskon: "" }],
};

const STATUS_BADGE = {
  draft: ["neutral", "Draft"], dikirim: ["info", "Dikirim"],
  sebagian: ["warning", "Sebagian"], lunas: ["success", "Lunas"],
};

export default function SalesPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null);
  const [kirim, setKirim] = useState(null);
  const [bayar, setBayar] = useState(null);
  const [bayarForm, setBayarForm] = useState({ jumlah: "", rekening_id: "none", metode: "Transfer" });
  const [toDelete, setToDelete] = useState(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["sales", q, status, page],
    queryFn: async () => (await api.get("/sales/orders", { params: { q, status, page, limit } })).data,
  });
  const { data: pelanggan } = useQuery({ queryKey: ["options", "pelanggan"], queryFn: async () => (await api.get("/master/pelanggan/options")).data });
  const { data: gudang } = useQuery({ queryKey: ["options", "gudang"], queryFn: async () => (await api.get("/master/gudang/options")).data });
  const { data: barang } = useQuery({ queryKey: ["options", "barang_jadi"], queryFn: async () => (await api.get("/master/barang_jadi/options")).data });
  const { data: pajak } = useQuery({ queryKey: ["options", "pajak"], queryFn: async () => (await api.get("/master/pajak/options")).data });
  const { data: rekening } = useQuery({ queryKey: ["options", "rekening"], queryFn: async () => (await api.get("/master/rekening/options")).data });
  const { data: perusahaan } = useQuery({ queryKey: ["perusahaan-list"], queryFn: async () => (await api.get("/master/perusahaan", { params: { limit: 1 } })).data });
  const company = perusahaan?.items?.[0];

  useEffect(() => { if (!open) setForm(EMPTY); }, [open]);

  const bjMap = useMemo(() => Object.fromEntries((barang || []).map((b) => [String(b.id), b])), [barang]);
  const setItem = (idx, key, val) => setForm((p) => {
    const items = [...p.items];
    items[idx] = { ...items[idx], [key]: val };
    if (key === "item_id") {
      const bj = bjMap[val];
      if (bj && !items[idx].harga) items[idx].harga = String(bj.harga_jual || "");
    }
    return { ...p, items };
  });
  const addRow = () => setForm((p) => ({ ...p, items: [...p.items, { item_id: "", qty: "", harga: "", diskon: "" }] }));
  const rmRow = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const validItems = form.items.filter((i) => i.item_id && Number(i.qty) > 0);
  const subtotal = validItems.reduce((s, i) => s + (Number(i.qty) * Number(i.harga || 0) - Number(i.diskon || 0)), 0);
  const pajakObj = (pajak || []).find((p) => String(p.id) === form.pajak_id);
  const pajakNom = pajakObj ? subtotal * (Number(pajakObj.persen) || 0) / 100 : 0;
  const total = subtotal + pajakNom;

  const custMap = useMemo(() => Object.fromEntries((pelanggan || []).map((c) => [String(c.id), c])), [pelanggan]);

  const saveMut = useMutation({
    mutationFn: async () => (await api.post("/sales/order", {
      pelanggan_id: form.pelanggan_id, gudang_id: form.gudang_id, tanggal: form.tanggal,
      tipe: form.tipe, jatuh_tempo: form.tipe === "kredit" ? (form.jatuh_tempo || undefined) : undefined,
      pajak_id: form.pajak_id === "none" ? undefined : form.pajak_id,
      rekening_id: form.rekening_id === "none" ? undefined : form.rekening_id,
      metode: form.metode || undefined, catatan: form.catatan || undefined,
      items: validItems.map((i) => ({ item_id: i.item_id, qty: Number(i.qty), harga: Number(i.harga || 0), diskon: Number(i.diskon || 0) })),
    })).data,
    onSuccess: (d) => { toast.success(`Sales Order ${d.no_so} dibuat`); qc.invalidateQueries({ queryKey: ["sales"] }); setOpen(false); },
    onError: (e) => toast.error(apiError(e)),
  });

  const kirimMut = useMutation({
    mutationFn: async (so) => (await api.post(`/sales/orders/${so.id}/kirim`, {
      rekening_id: form.rekening_id === "none" ? undefined : undefined,
    })).data,
    onSuccess: (d) => {
      toast.success(`Order dikirim · Invoice ${d.no_invoice}`);
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setKirim(null);
    },
    onError: (e) => { toast.error(apiError(e)); setKirim(null); },
  });

  const bayarMut = useMutation({
    mutationFn: async () => (await api.post(`/sales/orders/${bayar.id}/bayar`, {
      jumlah: Number(bayarForm.jumlah),
      rekening_id: bayarForm.rekening_id === "none" ? undefined : bayarForm.rekening_id,
      metode: bayarForm.metode,
    })).data,
    onSuccess: () => { toast.success("Pembayaran dicatat"); qc.invalidateQueries({ queryKey: ["sales"] }); qc.invalidateQueries({ queryKey: ["piutang"] }); setBayar(null); },
    onError: (e) => toast.error(apiError(e)),
  });

  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/sales/orders/${id}`)).data,
    onSuccess: () => { toast.success("Draft dihapus"); qc.invalidateQueries({ queryKey: ["sales"] }); setToDelete(null); },
    onError: (e) => { toast.error(apiError(e)); setToDelete(null); },
  });

  const submit = () => {
    if (!form.pelanggan_id) return toast.error("Pilih pelanggan");
    if (!form.gudang_id) return toast.error("Pilih gudang");
    if (validItems.length === 0) return toast.error("Tambahkan minimal 1 item");
    saveMut.mutate();
  };

  const doPrint = (so, type) => {
    const cust = custMap[String(so.pelanggan_id)];
    if (type === "invoice") invoicePDF(so, company, cust);
    else if (type === "nota") notaPDF(so, company, cust);
    else suratJalanPDF(so, company, cust);
  };

  const columns = [
    { key: "no_so", label: "No. SO", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.no_so}</span> },
    { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
    { key: "pelanggan_nama", label: "Pelanggan" },
    { key: "tipe", label: "Tipe", render: (r) => <StatusBadge variant={r.tipe === "tunai" ? "success" : "info"}>{r.tipe}</StatusBadge> },
    { key: "total", label: "Total", align: "right", render: (r) => rupiah(r.total) },
    { key: "sisa", label: "Sisa", align: "right", render: (r) => r.sisa > 0 ? <span className="text-rose-600 font-medium">{rupiah(r.sisa)}</span> : rupiah(0) },
    { key: "status", label: "Status", render: (r) => { const [v, l] = STATUS_BADGE[r.status] || ["neutral", r.status]; return <StatusBadge variant={v}>{l}</StatusBadge>; } },
    { key: "_aksi", label: "Aksi", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`sales-view-${r.id}`} onClick={() => setDetail(r)}><Eye className="h-4 w-4 text-slate-500" /></Button>
        {r.status === "draft" && hasPerm("penjualan", "approve") && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Kirim & Invoice" data-testid={`sales-kirim-${r.id}`} onClick={() => setKirim(r)}><Truck className="h-4 w-4 text-emerald-600" /></Button>
        )}
        {(r.status === "dikirim" || r.status === "sebagian") && hasPerm("penjualan", "add") && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Terima Pembayaran" data-testid={`sales-bayar-${r.id}`} onClick={() => { setBayar(r); setBayarForm({ jumlah: String(r.sisa), rekening_id: "none", metode: "Transfer" }); }}><HandCoins className="h-4 w-4 text-amber-600" /></Button>
        )}
        {r.status === "draft" && hasPerm("penjualan", "delete") && (
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`sales-delete-${r.id}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Transaksi Penjualan" subtitle="Sales Order → Surat Jalan → Invoice → Pembayaran, dengan cetak dokumen">
        {hasPerm("penjualan", "add") && (
          <Button data-testid="sales-add-btn" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>
            <ShoppingCart className="h-4 w-4 mr-1.5" /> Buat Penjualan
          </Button>
        )}
      </PageHeader>

      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }} className="mb-4">
        <TabsList data-testid="sales-tabs">
          <TabsTrigger value="all" data-testid="sales-tab-all">Semua</TabsTrigger>
          <TabsTrigger value="draft" data-testid="sales-tab-draft">Draft</TabsTrigger>
          <TabsTrigger value="dikirim" data-testid="sales-tab-dikirim">Dikirim</TabsTrigger>
          <TabsTrigger value="sebagian" data-testid="sales-tab-sebagian">Sebagian</TabsTrigger>
          <TabsTrigger value="lunas" data-testid="sales-tab-lunas">Lunas</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable testId="sales-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0}
        page={page} limit={limit} onPageChange={setPage} search={q} onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Cari no SO / invoice / pelanggan..." />

      {/* Create */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="bg-white w-full sm:max-w-2xl overflow-y-auto" data-testid="sales-drawer">
          <SheetHeader><SheetTitle className="font-heading">Buat Penjualan</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Pelanggan <span className="text-rose-500">*</span></Label>
                <Select value={form.pelanggan_id} onValueChange={(v) => setForm((p) => ({ ...p, pelanggan_id: v }))}>
                  <SelectTrigger data-testid="sales-pelanggan" className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent className="bg-white max-h-64">{(pelanggan || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Gudang <span className="text-rose-500">*</span></Label>
                <Select value={form.gudang_id} onValueChange={(v) => setForm((p) => ({ ...p, gudang_id: v }))}>
                  <SelectTrigger data-testid="sales-gudang" className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent className="bg-white max-h-64">{(gudang || []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Tanggal</Label>
                <Input data-testid="sales-tanggal" type="date" value={form.tanggal} onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Tipe Pembayaran</Label>
                <Select value={form.tipe} onValueChange={(v) => setForm((p) => ({ ...p, tipe: v }))}>
                  <SelectTrigger data-testid="sales-tipe" className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white"><SelectItem value="tunai">Tunai</SelectItem><SelectItem value="kredit">Kredit</SelectItem></SelectContent>
                </Select>
              </div>
              {form.tipe === "kredit" && (
                <div>
                  <Label className="mb-1.5 block">Jatuh Tempo</Label>
                  <Input data-testid="sales-jatuh-tempo" type="date" value={form.jatuh_tempo} onChange={(e) => setForm((p) => ({ ...p, jatuh_tempo: e.target.value }))} />
                </div>
              )}
              <div>
                <Label className="mb-1.5 block">Pajak</Label>
                <Select value={form.pajak_id} onValueChange={(v) => setForm((p) => ({ ...p, pajak_id: v }))}>
                  <SelectTrigger data-testid="sales-pajak" className="bg-white"><SelectValue placeholder="Tanpa pajak" /></SelectTrigger>
                  <SelectContent className="bg-white"><SelectItem value="none">Tanpa Pajak</SelectItem>{(pajak || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nama} ({angka(p.persen)}%)</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Item Penjualan</Label>
                <Button type="button" variant="outline" size="sm" data-testid="sales-add-row" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Item</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                    <div className="col-span-5">
                      <Select value={it.item_id} onValueChange={(v) => setItem(idx, "item_id", v)}>
                        <SelectTrigger data-testid={`sales-item-${idx}`} className="bg-white"><SelectValue placeholder="Produk..." /></SelectTrigger>
                        <SelectContent className="bg-white max-h-64">{(barang || []).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.nama}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Input data-testid={`sales-qty-${idx}`} className="col-span-2" type="number" step="any" placeholder="Qty" value={it.qty} onChange={(e) => setItem(idx, "qty", e.target.value)} />
                    <Input data-testid={`sales-harga-${idx}`} className="col-span-2" type="number" placeholder="Harga" value={it.harga} onChange={(e) => setItem(idx, "harga", e.target.value)} />
                    <Input data-testid={`sales-diskon-${idx}`} className="col-span-2" type="number" placeholder="Diskon" value={it.diskon} onChange={(e) => setItem(idx, "diskon", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" className="col-span-1 h-9 w-9" onClick={() => rmRow(idx)}><X className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {form.tipe === "tunai" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Rekening (kas masuk)</Label>
                  <Select value={form.rekening_id} onValueChange={(v) => setForm((p) => ({ ...p, rekening_id: v }))}>
                    <SelectTrigger data-testid="sales-rekening" className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent className="bg-white"><SelectItem value="none">-</SelectItem>{(rekening || []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nama}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Metode</Label>
                  <Input data-testid="sales-metode" placeholder="Tunai / Transfer" value={form.metode} onChange={(e) => setForm((p) => ({ ...p, metode: e.target.value }))} />
                </div>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span data-testid="sales-subtotal">{rupiah(subtotal)}</span></div>
              {pajakObj && <div className="flex justify-between text-sm text-slate-600"><span>Pajak {pajakObj.nama} ({angka(pajakObj.persen)}%)</span><span>{rupiah(pajakNom)}</span></div>}
              <div className="flex justify-between text-base font-bold text-emerald-700 pt-1.5 border-t border-slate-200"><span>Total</span><span data-testid="sales-total">{rupiah(total)}</span></div>
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="sales-submit" disabled={saveMut.isPending} onClick={submit}>Simpan Order</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Detail + print */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-white max-w-lg" data-testid="sales-detail">
          <DialogHeader><DialogTitle className="font-heading">{detail?.no_so}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400 text-xs">Pelanggan</span><div className="font-medium">{detail.pelanggan_nama}</div></div>
                <div><span className="text-slate-400 text-xs">Tanggal</span><div className="font-medium">{tanggal(detail.tanggal)}</div></div>
                <div><span className="text-slate-400 text-xs">No. Invoice</span><div className="font-medium">{detail.no_invoice || "-"}</div></div>
                <div><span className="text-slate-400 text-xs">No. Surat Jalan</span><div className="font-medium">{detail.no_surat_jalan || "-"}</div></div>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {(detail.items || []).map((it, i) => (
                      <tr key={i} className="border-t border-slate-100 first:border-0">
                        <td className="px-3 py-1.5">{it.item_nama}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{angka(it.qty)} × {rupiah(it.harga)}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{rupiah(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between font-bold text-emerald-700"><span>Total</span><span>{rupiah(detail.total)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Terbayar / Sisa</span><span>{rupiah(detail.terbayar)} / {rupiah(detail.sisa)}</span></div>
              {detail.status !== "draft" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" data-testid="print-invoice" onClick={() => doPrint(detail, "invoice")}><FileText className="h-4 w-4 mr-1.5" /> Invoice</Button>
                  <Button variant="outline" size="sm" data-testid="print-nota" onClick={() => doPrint(detail, "nota")}><Receipt className="h-4 w-4 mr-1.5" /> Nota</Button>
                  <Button variant="outline" size="sm" data-testid="print-sj" onClick={() => doPrint(detail, "sj")}><FileDown className="h-4 w-4 mr-1.5" /> Surat Jalan</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kirim confirm */}
      <AlertDialog open={!!kirim} onOpenChange={(v) => !v && setKirim(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader><AlertDialogTitle>Kirim & terbitkan Invoice?</AlertDialogTitle>
            <AlertDialogDescription>Stok barang jadi akan dipotong, Surat Jalan & Invoice diterbitkan untuk <b>{kirim?.no_so}</b>. {kirim?.tipe === "tunai" ? "Pembayaran tunai otomatis dicatat lunas." : "Menambah piutang pelanggan."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" data-testid="sales-kirim-confirm" disabled={kirimMut.isPending} onClick={() => kirimMut.mutate(kirim)}>Kirim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bayar */}
      <Dialog open={!!bayar} onOpenChange={(v) => !v && setBayar(null)}>
        <DialogContent className="bg-white max-w-md" data-testid="sales-bayar-dialog">
          <DialogHeader><DialogTitle className="font-heading">Terima Pembayaran · {bayar?.no_so}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500">Sisa piutang: <b className="text-rose-600">{rupiah(bayar?.sisa)}</b></p>
            <div>
              <Label className="mb-1.5 block">Jumlah Bayar</Label>
              <Input data-testid="bayar-jumlah" type="number" value={bayarForm.jumlah} onChange={(e) => setBayarForm((p) => ({ ...p, jumlah: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Rekening</Label>
                <Select value={bayarForm.rekening_id} onValueChange={(v) => setBayarForm((p) => ({ ...p, rekening_id: v }))}>
                  <SelectTrigger data-testid="bayar-rekening" className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent className="bg-white"><SelectItem value="none">-</SelectItem>{(rekening || []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Metode</Label>
                <Input data-testid="bayar-metode" value={bayarForm.metode} onChange={(e) => setBayarForm((p) => ({ ...p, metode: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBayar(null)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="bayar-submit" disabled={bayarMut.isPending} onClick={() => bayarMut.mutate()}>Catat Pembayaran</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader><AlertDialogTitle>Hapus draft?</AlertDialogTitle>
            <AlertDialogDescription>Order <b>{toDelete?.no_so}</b> akan dihapus permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" data-testid="sales-delete-confirm" onClick={() => delMut.mutate(toDelete.id)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
