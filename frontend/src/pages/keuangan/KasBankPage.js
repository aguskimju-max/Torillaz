import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Trash2, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import KpiCard from "@/components/common/KpiCard";
import StatusBadge from "@/components/common/StatusBadge";
import ExportButtons from "@/components/common/ExportButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rupiah, tanggal } from "@/lib/format";

export default function KasBankPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [tipe, setTipe] = useState("all");
  const [rek, setRek] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); // {tipe}
  const [toDelete, setToDelete] = useState(null);
  const limit = 20;

  const { data: summary } = useQuery({ queryKey: ["fin-summary"], queryFn: async () => (await api.get("/finance/summary")).data });
  const { data: rekData } = useQuery({ queryKey: ["fin-rekening"], queryFn: async () => (await api.get("/finance/rekening")).data });
  const { data: biaya } = useQuery({ queryKey: ["options", "biaya"], queryFn: async () => (await api.get("/master/biaya/options")).data });
  const { data, isLoading } = useQuery({
    queryKey: ["fin-txn", tipe, rek, q, page],
    queryFn: async () => (await api.get("/finance/transactions", { params: { tipe, rekening_id: rek, q, page, limit } })).data,
  });

  const rekening = rekData?.rekening || [];

  const saveMut = useMutation({
    mutationFn: async () => (await api.post("/finance/transactions", {
      tipe: form.tipe, jumlah: Number(form.jumlah), rekening_id: form.rekening_id,
      kategori: form.kategori || undefined, keterangan: form.keterangan || undefined,
      tanggal: form.tanggal,
    })).data,
    onSuccess: () => {
      toast.success("Transaksi kas dicatat");
      ["fin-txn", "fin-summary", "fin-rekening"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setForm(null);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/finance/transactions/${id}`)).data,
    onSuccess: () => {
      toast.success("Transaksi dihapus");
      ["fin-txn", "fin-summary", "fin-rekening"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setToDelete(null);
    },
    onError: (e) => { toast.error(apiError(e)); setToDelete(null); },
  });

  const openForm = (t) => setForm({ tipe: t, jumlah: "", rekening_id: "", kategori: "", keterangan: "", tanggal: new Date().toISOString().slice(0, 10) });
  const submit = () => {
    if (!form.rekening_id) return toast.error("Pilih rekening");
    if (!(Number(form.jumlah) > 0)) return toast.error("Jumlah harus lebih dari 0");
    saveMut.mutate();
  };

  const columns = [
    { key: "no", label: "No", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.no}</span> },
    { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
    { key: "tipe", label: "Tipe", render: (r) => r.tipe === "masuk" ? <StatusBadge variant="success">Masuk</StatusBadge> : <StatusBadge variant="danger">Keluar</StatusBadge> },
    { key: "kategori", label: "Kategori" },
    { key: "rekening_nama", label: "Rekening" },
    { key: "keterangan", label: "Keterangan", render: (r) => <span className="text-slate-500">{r.keterangan || "-"}</span> },
    { key: "jumlah", label: "Jumlah", align: "right", render: (r) => <span className={r.tipe === "masuk" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>{r.tipe === "masuk" ? "+" : "-"}{rupiah(r.jumlah)}</span> },
    { key: "_aksi", label: "", align: "right", render: (r) => (
      r.ref_type === "manual" && hasPerm("keuangan", "delete")
        ? <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`kas-delete-${r.id}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
        : <StatusBadge variant="neutral">otomatis</StatusBadge>
    ) },
  ];

  const exportColumns = [
    { label: "No", value: (r) => r.no, width: 14 },
    { label: "Tanggal", value: (r) => tanggal(r.tanggal), width: 14 },
    { label: "Tipe", value: (r) => r.tipe, width: 10 },
    { label: "Kategori", value: (r) => r.kategori || "", width: 18 },
    { label: "Rekening", value: (r) => r.rekening_nama || "", width: 18 },
    { label: "Keterangan", value: (r) => r.keterangan || "", width: 30 },
    { label: "Masuk", value: (r) => (r.tipe === "masuk" ? r.jumlah : ""), align: "right", width: 16 },
    { label: "Keluar", value: (r) => (r.tipe === "keluar" ? r.jumlah : ""), align: "right", width: 16 },
  ];
  const fetchAll = async () => (await api.get("/finance/transactions", { params: { tipe, rekening_id: rek, q, page: 1, limit: 2000 } })).data.items;

  return (
    <div>
      <PageHeader title="Kas & Bank" subtitle="Catat pemasukan & pengeluaran kas/bank, saldo terupdate otomatis">
        <ExportButtons testId="kas-export" filename="Kas-Bank" title="Laporan Kas & Bank" columns={exportColumns} rows={fetchAll} orientation="landscape" />
        {hasPerm("keuangan", "add") && <>
          <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" data-testid="kas-masuk-btn" onClick={() => openForm("masuk")}><ArrowDownCircle className="h-4 w-4 mr-1.5" /> Kas Masuk</Button>
          <Button className="bg-rose-600 hover:bg-rose-700" data-testid="kas-keluar-btn" onClick={() => openForm("keluar")}><ArrowUpCircle className="h-4 w-4 mr-1.5" /> Kas Keluar</Button>
        </>}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <KpiCard testId="kas-total-saldo" icon={Wallet} accent="emerald" label="Total Saldo Kas/Bank" value={rupiah(summary?.total_saldo)} sub={`${rekening.length} rekening`} />
        <KpiCard testId="kas-masuk-bulan" icon={TrendingUp} accent="sky" label="Pemasukan Bulan Ini" value={rupiah(summary?.masuk_bulan)} />
        <KpiCard testId="kas-keluar-bulan" icon={TrendingDown} accent="rose" label="Pengeluaran Bulan Ini" value={rupiah(summary?.keluar_bulan)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {rekening.map((r) => (
          <div key={r.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4" data-testid={`rek-card-${r.id}`}>
            <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-semibold"><Landmark className="h-3.5 w-3.5" /> {r.tipe}</div>
            <div className="font-medium text-slate-800 mt-1 truncate">{r.nama}</div>
            <div className="font-heading text-xl font-bold text-emerald-700 mt-1">{rupiah(r.saldo)}</div>
          </div>
        ))}
      </div>

      <Tabs value={tipe} onValueChange={(v) => { setTipe(v); setPage(1); }} className="mb-3">
        <TabsList data-testid="kas-tabs">
          <TabsTrigger value="all" data-testid="kas-tab-all">Semua</TabsTrigger>
          <TabsTrigger value="masuk" data-testid="kas-tab-masuk">Masuk</TabsTrigger>
          <TabsTrigger value="keluar" data-testid="kas-tab-keluar">Keluar</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable testId="kas-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0}
        page={page} limit={limit} onPageChange={setPage} search={q} onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Cari no / kategori / keterangan..."
        toolbar={
          <Select value={rek} onValueChange={(v) => { setRek(v); setPage(1); }}>
            <SelectTrigger data-testid="kas-filter-rekening" className="bg-white w-44"><SelectValue placeholder="Semua rekening" /></SelectTrigger>
            <SelectContent className="bg-white"><SelectItem value="all">Semua Rekening</SelectItem>{rekening.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nama}</SelectItem>)}</SelectContent>
          </Select>
        } />

      {/* Create dialog */}
      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent className="bg-white max-w-md" data-testid="kas-dialog">
          <DialogHeader><DialogTitle className="font-heading">{form?.tipe === "masuk" ? "Kas Masuk" : "Kas Keluar"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Tanggal</Label>
                  <Input data-testid="kas-tanggal" type="date" value={form.tanggal} onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Jumlah <span className="text-rose-500">*</span></Label>
                  <Input data-testid="kas-jumlah" type="number" value={form.jumlah} onChange={(e) => setForm((p) => ({ ...p, jumlah: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Rekening <span className="text-rose-500">*</span></Label>
                <Select value={form.rekening_id} onValueChange={(v) => setForm((p) => ({ ...p, rekening_id: v }))}>
                  <SelectTrigger data-testid="kas-rekening" className="bg-white"><SelectValue placeholder="Pilih rekening..." /></SelectTrigger>
                  <SelectContent className="bg-white">{rekening.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nama} ({rupiah(r.saldo)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Kategori</Label>
                {form.tipe === "keluar" ? (
                  <Select value={form.kategori} onValueChange={(v) => setForm((p) => ({ ...p, kategori: v }))}>
                    <SelectTrigger data-testid="kas-kategori" className="bg-white"><SelectValue placeholder="Pilih biaya / kategori..." /></SelectTrigger>
                    <SelectContent className="bg-white max-h-64">
                      {(biaya || []).map((b) => <SelectItem key={b.id} value={b.nama}>{b.nama}</SelectItem>)}
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input data-testid="kas-kategori" placeholder="mis. Penjualan, Modal, Lainnya" value={form.kategori} onChange={(e) => setForm((p) => ({ ...p, kategori: e.target.value }))} />
                )}
              </div>
              <div>
                <Label className="mb-1.5 block">Keterangan</Label>
                <Textarea data-testid="kas-keterangan" rows={2} value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Batal</Button>
            <Button className={form?.tipe === "masuk" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} data-testid="kas-submit" disabled={saveMut.isPending} onClick={submit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader><AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Transaksi <b>{toDelete?.no}</b> ({rupiah(toDelete?.jumlah)}) akan dihapus.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" data-testid="kas-delete-confirm" onClick={() => delMut.mutate(toDelete.id)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
