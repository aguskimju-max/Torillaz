import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, HandCoins, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import KpiCard from "@/components/common/KpiCard";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rupiah, tanggal } from "@/lib/format";

export default function KasbonPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [bayar, setBayar] = useState(null);
  const [bayarJumlah, setBayarJumlah] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const limit = 20;

  const { data, isLoading } = useQuery({ queryKey: ["kasbon", page], queryFn: async () => (await api.get("/hr/kasbon", { params: { page, limit } })).data });
  const { data: karyawan } = useQuery({ queryKey: ["options", "karyawan"], queryFn: async () => (await api.get("/master/karyawan/options")).data });

  const saveMut = useMutation({
    mutationFn: async () => (await api.post("/hr/kasbon", { karyawan_id: form.karyawan_id, jumlah: Number(form.jumlah), keterangan: form.keterangan, tanggal: form.tanggal })).data,
    onSuccess: () => { toast.success("Kasbon dicatat"); qc.invalidateQueries({ queryKey: ["kasbon"] }); setForm(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const bayarMut = useMutation({
    mutationFn: async () => (await api.post(`/hr/kasbon/${bayar.id}/bayar`, { jumlah: Number(bayarJumlah) })).data,
    onSuccess: () => { toast.success("Pembayaran kasbon dicatat"); qc.invalidateQueries({ queryKey: ["kasbon"] }); setBayar(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/hr/kasbon/${id}`)).data,
    onSuccess: () => { toast.success("Kasbon dihapus"); qc.invalidateQueries({ queryKey: ["kasbon"] }); setToDelete(null); },
    onError: (e) => { toast.error(apiError(e)); setToDelete(null); },
  });

  const submit = () => {
    if (!form.karyawan_id) return toast.error("Pilih karyawan");
    if (!(Number(form.jumlah) > 0)) return toast.error("Jumlah harus lebih dari 0");
    saveMut.mutate();
  };

  const columns = [
    { key: "no", label: "No", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.no}</span> },
    { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
    { key: "karyawan_nama", label: "Karyawan" },
    { key: "keterangan", label: "Keterangan", render: (r) => <span className="text-slate-500">{r.keterangan || "-"}</span> },
    { key: "jumlah", label: "Jumlah", align: "right", render: (r) => rupiah(r.jumlah) },
    { key: "sisa", label: "Sisa", align: "right", render: (r) => <span className={r.sisa > 0 ? "text-rose-600 font-medium" : ""}>{rupiah(r.sisa)}</span> },
    { key: "status", label: "Status", render: (r) => r.status === "lunas" ? <StatusBadge variant="success">Lunas</StatusBadge> : <StatusBadge variant="warning">Aktif</StatusBadge> },
    { key: "_aksi", label: "Aksi", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1">
        {r.status === "aktif" && hasPerm("hr", "edit") && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Bayar" data-testid={`kasbon-bayar-${r.id}`} onClick={() => { setBayar(r); setBayarJumlah(String(r.sisa)); }}><HandCoins className="h-4 w-4 text-emerald-600" /></Button>
        )}
        {hasPerm("hr", "delete") && <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`kasbon-delete-${r.id}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Kasbon Karyawan" subtitle="Pinjaman karyawan yang otomatis dipotong saat penggajian">
        {hasPerm("hr", "add") && (
          <Button data-testid="kasbon-add-btn" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setForm({ karyawan_id: "", jumlah: "", keterangan: "", tanggal: new Date().toISOString().slice(0, 10) })}>
            <Plus className="h-4 w-4 mr-1.5" /> Ajukan Kasbon
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <KpiCard testId="kasbon-total-aktif" icon={Wallet} accent="amber" label="Total Kasbon Aktif" value={rupiah(data?.total_aktif)} sub="Belum lunas" />
      </div>

      <DataTable testId="kasbon-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0} page={page} limit={limit} onPageChange={setPage} emptyText="Belum ada kasbon" />

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="bg-white max-w-md" data-testid="kasbon-dialog">
          <DialogHeader><DialogTitle className="font-heading">Ajukan Kasbon</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3 py-2">
              <div>
                <Label className="mb-1.5 block">Karyawan <span className="text-rose-500">*</span></Label>
                <Select value={form.karyawan_id} onValueChange={(v) => setForm((p) => ({ ...p, karyawan_id: v }))}>
                  <SelectTrigger data-testid="kasbon-karyawan" className="bg-white"><SelectValue placeholder="Pilih karyawan..." /></SelectTrigger>
                  <SelectContent className="bg-white max-h-64">{(karyawan || []).map((k) => <SelectItem key={k.id} value={String(k.id)}>{k.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Jumlah <span className="text-rose-500">*</span></Label>
                  <Input data-testid="kasbon-jumlah" type="number" value={form.jumlah} onChange={(e) => setForm((p) => ({ ...p, jumlah: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Tanggal</Label>
                  <Input data-testid="kasbon-tanggal" type="date" value={form.tanggal} onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Keterangan</Label>
                <Textarea data-testid="kasbon-keterangan" rows={2} value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="kasbon-submit" disabled={saveMut.isPending} onClick={submit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bayar} onOpenChange={(v) => !v && setBayar(null)}>
        <DialogContent className="bg-white max-w-sm" data-testid="kasbon-bayar-dialog">
          <DialogHeader><DialogTitle className="font-heading">Bayar Kasbon · {bayar?.karyawan_nama}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500">Sisa: <b className="text-rose-600">{rupiah(bayar?.sisa)}</b></p>
            <div><Label className="mb-1.5 block">Jumlah Bayar</Label><Input data-testid="kasbon-bayar-jumlah" type="number" value={bayarJumlah} onChange={(e) => setBayarJumlah(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBayar(null)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="kasbon-bayar-submit" disabled={bayarMut.isPending} onClick={() => bayarMut.mutate()}>Bayar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader><AlertDialogTitle>Hapus kasbon?</AlertDialogTitle><AlertDialogDescription>Kasbon <b>{toDelete?.no}</b> ({rupiah(toDelete?.jumlah)}) akan dihapus.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" data-testid="kasbon-delete-confirm" onClick={() => delMut.mutate(toDelete.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
