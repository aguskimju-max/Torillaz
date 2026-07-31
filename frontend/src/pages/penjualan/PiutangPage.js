import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HandCoins, AlertTriangle } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rupiah, tanggal } from "@/lib/format";

export default function PiutangPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [bayar, setBayar] = useState(null);
  const [form, setForm] = useState({ jumlah: "", rekening_id: "none", metode: "Transfer" });
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["piutang", page],
    queryFn: async () => (await api.get("/sales/piutang", { params: { page, limit } })).data,
  });
  const { data: rekening } = useQuery({ queryKey: ["options", "rekening"], queryFn: async () => (await api.get("/master/rekening/options")).data });

  const bayarMut = useMutation({
    mutationFn: async () => (await api.post(`/sales/orders/${bayar.id}/bayar`, {
      jumlah: Number(form.jumlah),
      rekening_id: form.rekening_id === "none" ? undefined : form.rekening_id,
      metode: form.metode,
    })).data,
    onSuccess: () => { toast.success("Pembayaran dicatat"); qc.invalidateQueries({ queryKey: ["piutang"] }); qc.invalidateQueries({ queryKey: ["sales"] }); setBayar(null); },
    onError: (e) => toast.error(apiError(e)),
  });

  const overdueCount = (data?.items || []).filter((r) => r.overdue).length;

  const columns = [
    { key: "no_invoice", label: "No. Invoice", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.no_invoice || r.no_so}</span> },
    { key: "pelanggan_nama", label: "Pelanggan" },
    { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
    { key: "jatuh_tempo", label: "Jatuh Tempo", render: (r) => r.jatuh_tempo ? <span className={r.overdue ? "text-rose-600 font-medium" : "text-slate-600"}>{tanggal(r.jatuh_tempo)}</span> : "-" },
    { key: "total", label: "Total", align: "right", render: (r) => rupiah(r.total) },
    { key: "terbayar", label: "Terbayar", align: "right", render: (r) => rupiah(r.terbayar) },
    { key: "sisa", label: "Sisa", align: "right", render: (r) => <span className="text-rose-600 font-semibold">{rupiah(r.sisa)}</span> },
    { key: "status", label: "Status", render: (r) => r.overdue ? <StatusBadge variant="danger">Jatuh Tempo</StatusBadge> : <StatusBadge variant="warning">Belum Lunas</StatusBadge> },
    { key: "_aksi", label: "Aksi", align: "right", render: (r) => (
      hasPerm("penjualan", "add") ? (
        <Button variant="outline" size="sm" data-testid={`piutang-bayar-${r.id}`} onClick={() => { setBayar(r); setForm({ jumlah: String(r.sisa), rekening_id: "none", metode: "Transfer" }); }}>
          <HandCoins className="h-4 w-4 mr-1.5 text-emerald-600" /> Bayar
        </Button>
      ) : null
    ) },
  ];

  return (
    <div>
      <PageHeader title="Piutang Pelanggan" subtitle="Daftar tagihan yang belum lunas beserta status jatuh tempo" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard testId="piutang-total" icon={HandCoins} accent="amber" label="Total Piutang" value={rupiah(data?.total_piutang)} sub={`${data?.total || 0} tagihan aktif`} />
        <KpiCard testId="piutang-overdue" icon={AlertTriangle} accent={overdueCount ? "rose" : "slate"} label="Jatuh Tempo" value={overdueCount} sub="Perlu ditagih segera" />
      </div>

      <DataTable testId="piutang-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0}
        page={page} limit={limit} onPageChange={setPage} emptyText="Tidak ada piutang" />

      <Dialog open={!!bayar} onOpenChange={(v) => !v && setBayar(null)}>
        <DialogContent className="bg-white max-w-md" data-testid="piutang-bayar-dialog">
          <DialogHeader><DialogTitle className="font-heading">Terima Pembayaran · {bayar?.no_invoice || bayar?.no_so}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500">Sisa piutang: <b className="text-rose-600">{rupiah(bayar?.sisa)}</b></p>
            <div>
              <Label className="mb-1.5 block">Jumlah Bayar</Label>
              <Input data-testid="piutang-jumlah" type="number" value={form.jumlah} onChange={(e) => setForm((p) => ({ ...p, jumlah: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Rekening</Label>
                <Select value={form.rekening_id} onValueChange={(v) => setForm((p) => ({ ...p, rekening_id: v }))}>
                  <SelectTrigger data-testid="piutang-rekening" className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent className="bg-white"><SelectItem value="none">-</SelectItem>{(rekening || []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Metode</Label>
                <Input data-testid="piutang-metode" value={form.metode} onChange={(e) => setForm((p) => ({ ...p, metode: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBayar(null)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="piutang-bayar-submit" disabled={bayarMut.isPending} onClick={() => bayarMut.mutate()}>Catat Pembayaran</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
