import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cog, Eye, HandCoins, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rupiah } from "@/lib/format";
import { PayrollKpis } from "@/pages/hr/payroll/PayrollKpis";
import { PayrollRecap } from "@/pages/hr/payroll/PayrollRecap";
import { SlipDetailDialog } from "@/pages/hr/payroll/SlipDetailDialog";
import { BayarDialog } from "@/pages/hr/payroll/BayarDialog";
import { DeleteSlipDialog } from "@/pages/hr/payroll/DeleteSlipDialog";

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

  const openBayar = (row) => { setBayar(row); setRekening("none"); };

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
        {r.status !== "dibayar" && hasPerm("hr", "approve") && <Button variant="ghost" size="icon" className="h-8 w-8" title="Bayar" data-testid={`payroll-bayar-${r.id}`} onClick={() => openBayar(r)}><HandCoins className="h-4 w-4 text-emerald-600" /></Button>}
        {r.status !== "dibayar" && hasPerm("hr", "delete") && <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`payroll-delete-${r.id}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Penggajian (Payroll)" subtitle="Hitung gaji otomatis dari absensi, lembur & potongan; cetak slip gaji" />

      <PayrollKpis summary={summary} />

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-5 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <div><Label className="mb-1.5 block">Periode</Label><Input data-testid="payroll-periode" type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-40" /></div>
        <div><Label className="mb-1.5 block">Hari Kerja</Label><Input data-testid="payroll-hari-kerja" type="number" value={cfg.hari_kerja} onChange={(e) => setCfg((p) => ({ ...p, hari_kerja: e.target.value }))} className="w-24" /></div>
        <div><Label className="mb-1.5 block">BPJS %</Label><Input data-testid="payroll-bpjs" type="number" value={cfg.bpjs_persen} onChange={(e) => setCfg((p) => ({ ...p, bpjs_persen: e.target.value }))} className="w-24" /></div>
        <div><Label className="mb-1.5 block">Pajak %</Label><Input data-testid="payroll-pajak" type="number" value={cfg.pajak_persen} onChange={(e) => setCfg((p) => ({ ...p, pajak_persen: e.target.value }))} className="w-24" /></div>
        {hasPerm("hr", "add") && <Button data-testid="payroll-generate" className="bg-emerald-600 hover:bg-emerald-700" disabled={genMut.isPending} onClick={() => genMut.mutate()}><Cog className="h-4 w-4 mr-1.5" /> Generate Payroll</Button>}
      </div>

      <PayrollRecap periode={periode} recap={recap} />

      <DataTable testId="payroll-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0} emptyText="Belum ada payroll untuk periode ini. Klik Generate Payroll." />

      <SlipDetailDialog detail={detail} onOpenChange={(v) => !v && setDetail(null)} company={company} hasPerm={hasPerm} onBayar={openBayar} />
      <BayarDialog bayar={bayar} onOpenChange={(v) => !v && setBayar(null)} rekening={rekening} setRekening={setRekening} rekList={rekList} onSubmit={() => bayarMut.mutate()} pending={bayarMut.isPending} />
      <DeleteSlipDialog toDelete={toDelete} onOpenChange={(v) => !v && setToDelete(null)} onConfirm={() => delMut.mutate(toDelete.id)} />
    </div>
  );
}
