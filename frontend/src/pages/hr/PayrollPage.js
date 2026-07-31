import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Wallet, Clock, Cog, Eye, HandCoins, Trash2, FileText, CalendarCheck } from "lucide-react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rupiah, angka } from "@/lib/format";
import { slipGajiPDF } from "@/lib/pdf";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function PayrollPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [periode, setPeriode] = useState(thisMonth());
  const [cfg, setCfg] = useState({ hari_kerja: "26", bpjs_persen: "0", pajak_persen: "0" });
  const [detail, setDetail] = useState(null);
  const [bayar, setBayar] = useState(null);
  const [rekening, setRekening] = useState("none");
  const [toDelete, setToDelete] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ["payroll", periode], queryFn: async () => (await api.get("/hr/payroll", { params: { periode, limit: 200 } })).data });
  const { data: recap } = useQuery({ queryKey: ["att-recap", periode], queryFn: async () => (await api.get("/hr/attendance/recap", { params: { periode } })).data });
  const { data: summary } = useQuery({ queryKey: ["hr-summary"], queryFn: async () => (await api.get("/hr/summary")).data });
  const { data: rekList } = useQuery({ queryKey: ["fin-rekening"], queryFn: async () => (await api.get("/finance/rekening")).data });
  const { data: perusahaan } = useQuery({ queryKey: ["perusahaan-list"], queryFn: async () => (await api.get("/master/perusahaan", { params: { limit: 1 } })).data });
  const company = perusahaan?.items?.[0];

  const genMut = useMutation({
    mutationFn: async () => (await api.post("/hr/payroll/generate", { periode, hari_kerja: Number(cfg.hari_kerja), bpjs_persen: Number(cfg.bpjs_persen), pajak_persen: Number(cfg.pajak_persen) })).data,
    onSuccess: (d) => { toast.success(`Payroll ${d.periode} dibuat untuk ${d.count} karyawan`); qc.invalidateQueries({ queryKey: ["payroll"] }); qc.invalidateQueries({ queryKey: ["hr-summary"] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const bayarMut = useMutation({
    mutationFn: async () => (await api.post(`/hr/payroll/${bayar.id}/bayar`, { rekening_id: rekening === "none" ? undefined : rekening })).data,
    onSuccess: () => { toast.success("Gaji dibayar"); ["payroll", "hr-summary", "fin-summary", "fin-rekening", "kasbon"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); setBayar(null); setDetail(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const delMut = useMutation({
    mutationFn: async (id) => (await api.delete(`/hr/payroll/${id}`)).data,
    onSuccess: () => { toast.success("Slip dihapus"); qc.invalidateQueries({ queryKey: ["payroll"] }); setToDelete(null); },
    onError: (e) => { toast.error(apiError(e)); setToDelete(null); },
  });

  const columns = [
    { key: "no", label: "No. Slip", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.no}</span> },
    { key: "karyawan_nama", label: "Karyawan", render: (r) => <div><div className="font-medium text-slate-800">{r.karyawan_nama}</div><div className="text-xs text-slate-400">{r.jabatan_nama}</div></div> },
    { key: "hari_hadir", label: "Hadir", align: "right", render: (r) => `${r.hari_hadir} hr` },
    { key: "upah_lembur", label: "Lembur", align: "right", render: (r) => rupiah(r.upah_lembur) },
    { key: "total_potongan", label: "Potongan", align: "right", render: (r) => <span className="text-rose-600">{rupiah(r.total_potongan)}</span> },
    { key: "gaji_bersih", label: "Gaji Bersih", align: "right", render: (r) => <span className="font-semibold text-emerald-700">{rupiah(r.gaji_bersih)}</span> },
    { key: "status", label: "Status", render: (r) => r.status === "dibayar" ? <StatusBadge variant="success">Dibayar</StatusBadge> : <StatusBadge variant="warning">Draft</StatusBadge> },
    { key: "_aksi", label: "Aksi", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`payroll-view-${r.id}`} onClick={() => setDetail(r)}><Eye className="h-4 w-4 text-slate-500" /></Button>
        {r.status !== "dibayar" && hasPerm("hr", "approve") && <Button variant="ghost" size="icon" className="h-8 w-8" title="Bayar" data-testid={`payroll-bayar-${r.id}`} onClick={() => { setBayar(r); setRekening("none"); }}><HandCoins className="h-4 w-4 text-emerald-600" /></Button>}
        {r.status !== "dibayar" && hasPerm("hr", "delete") && <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`payroll-delete-${r.id}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
      </div>
    ) },
  ];

  const Line = ({ label, value, minus, bold, tone }) => (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold text-slate-800" : "text-slate-600"}`}>
      <span>{label}</span><span className={tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-700 font-semibold" : ""}>{minus ? `(${rupiah(value)})` : rupiah(value)}</span>
    </div>
  );

  return (
    <div>
      <PageHeader title="Penggajian (Payroll)" subtitle="Hitung gaji otomatis dari absensi, lembur & potongan; cetak slip gaji" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <KpiCard testId="payroll-karyawan" icon={Users} accent="sky" label="Karyawan Aktif" value={summary?.karyawan_aktif || 0} />
        <KpiCard testId="payroll-gaji-bulan" icon={Wallet} accent="emerald" label={`Gaji Periode ${summary?.periode || ""}`} value={rupiah(summary?.gaji_bulan)} />
        <KpiCard testId="payroll-belum" icon={Clock} accent="amber" label="Belum Dibayar" value={summary?.belum_dibayar || 0} sub="slip menunggu pembayaran" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-5 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <div><Label className="mb-1.5 block">Periode</Label><Input data-testid="payroll-periode" type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-40" /></div>
        <div><Label className="mb-1.5 block">Hari Kerja</Label><Input data-testid="payroll-hari-kerja" type="number" value={cfg.hari_kerja} onChange={(e) => setCfg((p) => ({ ...p, hari_kerja: e.target.value }))} className="w-24" /></div>
        <div><Label className="mb-1.5 block">BPJS %</Label><Input data-testid="payroll-bpjs" type="number" value={cfg.bpjs_persen} onChange={(e) => setCfg((p) => ({ ...p, bpjs_persen: e.target.value }))} className="w-24" /></div>
        <div><Label className="mb-1.5 block">Pajak %</Label><Input data-testid="payroll-pajak" type="number" value={cfg.pajak_persen} onChange={(e) => setCfg((p) => ({ ...p, pajak_persen: e.target.value }))} className="w-24" /></div>
        {hasPerm("hr", "add") && <Button data-testid="payroll-generate" className="bg-emerald-600 hover:bg-emerald-700" disabled={genMut.isPending} onClick={() => genMut.mutate()}><Cog className="h-4 w-4 mr-1.5" /> Generate Payroll</Button>}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-5" data-testid="payroll-recap">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-emerald-600" />
          <span className="font-heading font-semibold text-slate-800 text-sm">Rekap Absensi · {periode}</span>
          <span className="text-xs text-slate-400 ml-auto">Cek sebelum generate payroll</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="text-left px-4 py-2">Karyawan</th>
              <th className="px-3 py-2">Hadir</th><th className="px-3 py-2">Izin</th><th className="px-3 py-2">Sakit</th>
              <th className="px-3 py-2">Alpha</th><th className="px-3 py-2">Libur</th><th className="px-3 py-2">Lembur (jam)</th>
            </tr>
          </thead>
          <tbody>
            {(recap?.items || []).map((r) => (
              <tr key={r.karyawan_id} className="border-t border-slate-100 text-center">
                <td className="text-left px-4 py-2"><div className="font-medium text-slate-800">{r.karyawan_nama}</div><div className="text-xs text-slate-400">{r.jabatan_nama}</div></td>
                <td className="px-3 py-2 text-emerald-700 font-medium">{r.hadir}</td>
                <td className="px-3 py-2">{r.izin}</td>
                <td className="px-3 py-2">{r.sakit}</td>
                <td className="px-3 py-2 text-rose-600 font-medium">{r.alpha}</td>
                <td className="px-3 py-2 text-slate-400">{r.libur}</td>
                <td className="px-3 py-2">{angka(r.jam_lembur)}</td>
              </tr>
            ))}
            {(!recap?.items || recap.items.length === 0) && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Belum ada data absensi pada periode ini</td></tr>}
          </tbody>
        </table>
      </div>

      <DataTable testId="payroll-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0} emptyText="Belum ada payroll untuk periode ini. Klik Generate Payroll." />

      {/* Detail / slip */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-white max-w-md" data-testid="payroll-detail">
          <DialogHeader><DialogTitle className="font-heading">Slip Gaji · {detail?.karyawan_nama}</DialogTitle></DialogHeader>
          {detail && (
            <div className="text-sm">
              <div className="flex justify-between text-xs text-slate-400 mb-2"><span>{detail.no}</span><span>Periode {detail.periode}</span></div>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mt-2">Pendapatan</div>
              <Line label={`Gaji Pokok (${detail.hari_hadir} hr × ${rupiah(detail.gaji_harian != null ? detail.gaji_harian : (detail.hari_kerja ? detail.gaji_pokok / detail.hari_kerja : 0))})`} value={detail.gaji_diperoleh != null ? detail.gaji_diperoleh : detail.gaji_pokok} />
              <Line label="Tunjangan" value={detail.tunjangan} />
              <Line label={`Lembur (${angka(detail.jam_lembur)} jam)`} value={detail.upah_lembur} />
              <div className="border-t border-slate-200 my-1" />
              <Line label="Total Pendapatan" value={detail.gross} bold />
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mt-3">Potongan</div>
              <Line label={`BPJS (${angka(detail.bpjs_persen)}%)`} value={detail.bpjs} minus tone="rose" />
              <Line label={`Pajak (${angka(detail.pajak_persen)}%)`} value={detail.pajak} minus tone="rose" />
              <Line label="Potongan Kasbon" value={detail.kasbon_potong} minus tone="rose" />
              <div className="border-t border-slate-200 my-1" />
              <Line label="Total Potongan" value={detail.total_potongan} bold tone="rose" />
              <div className="border-t-2 border-emerald-600 mt-2 pt-2"><Line label="GAJI BERSIH" value={detail.gaji_bersih} bold tone="emerald" /></div>
              <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" data-testid="payroll-slip-pdf" onClick={() => slipGajiPDF(detail, company)}><FileText className="h-4 w-4 mr-1.5 text-rose-600" /> Download Slip</Button>
                {detail.status !== "dibayar" && hasPerm("hr", "approve") && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setBayar(detail); setRekening("none"); }}><HandCoins className="h-4 w-4 mr-1.5" /> Bayar</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bayar */}
      <Dialog open={!!bayar} onOpenChange={(v) => !v && setBayar(null)}>
        <DialogContent className="bg-white max-w-sm" data-testid="payroll-bayar-dialog">
          <DialogHeader><DialogTitle className="font-heading">Bayar Gaji · {bayar?.karyawan_nama}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500">Gaji bersih: <b className="text-emerald-700">{rupiah(bayar?.gaji_bersih)}</b></p>
            <div>
              <Label className="mb-1.5 block">Bayar dari Rekening</Label>
              <Select value={rekening} onValueChange={setRekening}>
                <SelectTrigger data-testid="payroll-rekening" className="bg-white"><SelectValue placeholder="Pilih rekening..." /></SelectTrigger>
                <SelectContent className="bg-white"><SelectItem value="none">Tanpa catat kas</SelectItem>{(rekList?.rekening || []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nama} ({rupiah(r.saldo)})</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Jika rekening dipilih, otomatis tercatat sebagai kas keluar (beban gaji) & kasbon dipotong.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBayar(null)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="payroll-bayar-submit" disabled={bayarMut.isPending} onClick={() => bayarMut.mutate()}>Bayar Gaji</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader><AlertDialogTitle>Hapus slip?</AlertDialogTitle><AlertDialogDescription>Slip <b>{toDelete?.no}</b> ({toDelete?.karyawan_nama}) akan dihapus.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" data-testid="payroll-delete-confirm" onClick={() => delMut.mutate(toDelete.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
