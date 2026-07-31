import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rupiah, angka } from "@/lib/format";

const EMPTY = { barang_jadi_id: "", output_qty: 1, items: [{ item_id: "", qty: "" }], biaya_tk: "", biaya_overhead: "", is_active: true };

export default function BomPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [toDelete, setToDelete] = useState(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["bom", q, page],
    queryFn: async () => (await api.get("/production/bom", { params: { q, page, limit } })).data,
  });
  const { data: bjOpts } = useQuery({ queryKey: ["options", "barang_jadi"], queryFn: async () => (await api.get("/master/barang_jadi/options")).data });
  const { data: bbOpts } = useQuery({ queryKey: ["options", "bahan_baku"], queryFn: async () => (await api.get("/master/bahan_baku/options")).data });

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        barang_jadi_id: editing.barang_jadi_id, output_qty: editing.output_qty,
        items: (editing.items || []).map((i) => ({ item_id: i.item_id, qty: i.qty })),
        biaya_tk: editing.biaya_tk, biaya_overhead: editing.biaya_overhead, is_active: editing.is_active,
      } : EMPTY);
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, items: form.items.filter((i) => i.item_id && Number(i.qty) > 0) };
      if (editing) return (await api.put(`/production/bom/${editing.id}`, payload)).data;
      return (await api.post("/production/bom", payload)).data;
    },
    onSuccess: () => { toast.success("Resep disimpan"); qc.invalidateQueries({ queryKey: ["bom"] }); setOpen(false); setEditing(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/production/bom/${id}`)).data,
    onSuccess: () => { toast.success("Resep dihapus"); qc.invalidateQueries({ queryKey: ["bom"] }); setToDelete(null); },
    onError: (e) => { toast.error(apiError(e)); setToDelete(null); },
  });

  const setItem = (idx, key, val) => setForm((p) => { const items = [...p.items]; items[idx] = { ...items[idx], [key]: val }; return { ...p, items }; });
  const addRow = () => setForm((p) => ({ ...p, items: [...p.items, { item_id: "", qty: "" }] }));
  const rmRow = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const submit = () => {
    if (!form.barang_jadi_id) return toast.error("Pilih barang jadi");
    if (!form.items.some((i) => i.item_id && Number(i.qty) > 0)) return toast.error("Tambahkan minimal 1 bahan baku");
    saveMut.mutate();
  };

  const columns = [
    { key: "kode", label: "Kode" },
    { key: "barang_jadi_nama", label: "Barang Jadi" },
    { key: "output_qty", label: "Output", align: "right", render: (r) => `${angka(r.output_qty)} ${r.satuan_output || ""}` },
    { key: "items", label: "Jumlah Bahan", align: "right", render: (r) => `${(r.items || []).length} bahan` },
    { key: "biaya_tk", label: "Tenaga Kerja", align: "right", render: (r) => rupiah(r.biaya_tk) },
    { key: "biaya_overhead", label: "Overhead", align: "right", render: (r) => rupiah(r.biaya_overhead) },
    { key: "is_active", label: "Status", render: (r) => r.is_active === false ? <StatusBadge variant="neutral">Nonaktif</StatusBadge> : <StatusBadge variant="success">Aktif</StatusBadge> },
    { key: "_aksi", label: "Aksi", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1">
        {hasPerm("produksi", "edit") && <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`bom-edit-${r.id}`} onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4 text-slate-500" /></Button>}
        {hasPerm("produksi", "delete") && <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`bom-delete-${r.id}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Resep / Bill of Material (BOM)" subtitle="Definisikan komposisi bahan baku & biaya untuk setiap produk">
        {hasPerm("produksi", "add") && (
          <Button data-testid="bom-add-btn" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Tambah Resep
          </Button>
        )}
      </PageHeader>

      <DataTable testId="bom-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0} page={page} limit={limit} onPageChange={setPage} search={q} onSearch={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Cari resep..." />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="bg-white w-full sm:max-w-lg overflow-y-auto" data-testid="bom-drawer">
          <SheetHeader><SheetTitle className="font-heading">{editing ? "Ubah" : "Tambah"} Resep</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-1.5 block">Barang Jadi <span className="text-rose-500">*</span></Label>
              <Select value={form.barang_jadi_id} onValueChange={(v) => setForm((p) => ({ ...p, barang_jadi_id: v }))}>
                <SelectTrigger data-testid="bom-barang-jadi" className="bg-white"><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
                <SelectContent className="bg-white max-h-64">
                  {(bjOpts || []).map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Jumlah Output per Resep</Label>
              <Input data-testid="bom-output" type="number" step="any" value={form.output_qty} onChange={(e) => setForm((p) => ({ ...p, output_qty: e.target.value }))} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Komposisi Bahan Baku</Label>
                <Button type="button" variant="outline" size="sm" data-testid="bom-add-row" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Baris</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select value={it.item_id} onValueChange={(v) => setItem(idx, "item_id", v)}>
                      <SelectTrigger data-testid={`bom-item-${idx}`} className="bg-white flex-1"><SelectValue placeholder="Bahan baku..." /></SelectTrigger>
                      <SelectContent className="bg-white max-h-64">
                        {(bbOpts || []).map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.nama} ({o.satuan_nama})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input data-testid={`bom-qty-${idx}`} type="number" step="any" className="w-24" placeholder="Qty" value={it.qty} onChange={(e) => setItem(idx, "qty", e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => rmRow(idx)}><X className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Biaya Tenaga Kerja</Label>
                <Input data-testid="bom-tk" type="number" value={form.biaya_tk} onChange={(e) => setForm((p) => ({ ...p, biaya_tk: e.target.value }))} placeholder="Per resep" />
              </div>
              <div>
                <Label className="mb-1.5 block">Biaya Overhead</Label>
                <Input data-testid="bom-oh" type="number" value={form.biaya_overhead} onChange={(e) => setForm((p) => ({ ...p, biaya_overhead: e.target.value }))} placeholder="Per resep" />
              </div>
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="bom-submit" disabled={saveMut.isPending} onClick={submit}>Simpan</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader><AlertDialogTitle>Hapus resep?</AlertDialogTitle>
            <AlertDialogDescription>Resep <b>{toDelete?.barang_jadi_nama}</b> akan dihapus.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" data-testid="bom-delete-confirm" onClick={() => delMut.mutate(toDelete.id)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
