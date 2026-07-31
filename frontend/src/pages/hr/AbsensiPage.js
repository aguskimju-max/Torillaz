import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Save } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS = [
  { v: "hadir", l: "Hadir" }, { v: "izin", l: "Izin" }, { v: "sakit", l: "Sakit" },
  { v: "alpha", l: "Alpha" }, { v: "libur", l: "Libur" },
];
const DEFAULT = { status: "hadir", jam_masuk: "08:00", jam_keluar: "17:00", jam_lembur: "" };

export default function AbsensiPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState({});

  const { data: karyawan } = useQuery({ queryKey: ["options", "karyawan"], queryFn: async () => (await api.get("/master/karyawan/options")).data });
  const { data: existing } = useQuery({
    queryKey: ["attendance", tanggal],
    queryFn: async () => (await api.get("/hr/attendance", { params: { tanggal } })).data,
  });

  const existMap = useMemo(() => Object.fromEntries((existing?.items || []).map((e) => [String(e.karyawan_id), e])), [existing]);

  useEffect(() => {
    const next = {};
    (karyawan || []).forEach((k) => {
      const e = existMap[String(k.id)];
      next[k.id] = e
        ? { status: e.status, jam_masuk: e.jam_masuk || "", jam_keluar: e.jam_keluar || "", jam_lembur: e.jam_lembur ? String(e.jam_lembur) : "" }
        : { ...DEFAULT };
    });
    setRows(next);
  }, [karyawan, existMap]);

  const setRow = (id, key, val) => setRows((p) => ({ ...p, [id]: { ...p[id], [key]: val } }));

  const saveMut = useMutation({
    mutationFn: async () => (await api.post("/hr/attendance/bulk", {
      tanggal,
      entries: (karyawan || []).map((k) => ({ karyawan_id: k.id, ...rows[k.id], jam_lembur: Number(rows[k.id]?.jam_lembur || 0) })),
    })).data,
    onSuccess: (d) => { toast.success(`Absensi tersimpan (${d.saved} karyawan)`); qc.invalidateQueries({ queryKey: ["attendance"] }); },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <PageHeader title="Absensi Karyawan" subtitle="Catat kehadiran harian; direkap otomatis untuk penggajian">
        {hasPerm("hr", "add") && (
          <Button data-testid="absensi-save" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            <Save className="h-4 w-4 mr-1.5" /> Simpan Absensi
          </Button>
        )}
      </PageHeader>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-5 flex items-end gap-3">
        <div>
          <Label className="mb-1.5 block">Tanggal</Label>
          <Input data-testid="absensi-tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-48" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 pb-2"><CalendarCheck className="h-4 w-4 text-emerald-600" /> {(karyawan || []).length} karyawan aktif</div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" data-testid="absensi-table">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Karyawan</th>
              <th className="text-left px-4 py-3 w-40">Status</th>
              <th className="text-left px-4 py-3 w-28">Masuk</th>
              <th className="text-left px-4 py-3 w-28">Keluar</th>
              <th className="text-left px-4 py-3 w-28">Lembur (jam)</th>
            </tr>
          </thead>
          <tbody>
            {(karyawan || []).map((k) => {
              const r = rows[k.id] || DEFAULT;
              const dis = r.status !== "hadir";
              return (
                <tr key={k.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{k.nama}</td>
                  <td className="px-4 py-2.5">
                    <Select value={r.status} onValueChange={(v) => setRow(k.id, "status", v)}>
                      <SelectTrigger data-testid={`absensi-status-${k.id}`} className="bg-white h-9"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white">{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5"><Input type="time" className="h-9" value={r.jam_masuk} disabled={dis} onChange={(e) => setRow(k.id, "jam_masuk", e.target.value)} /></td>
                  <td className="px-4 py-2.5"><Input type="time" className="h-9" value={r.jam_keluar} disabled={dis} onChange={(e) => setRow(k.id, "jam_keluar", e.target.value)} /></td>
                  <td className="px-4 py-2.5"><Input type="number" step="any" className="h-9" placeholder="0" value={r.jam_lembur} disabled={dis} onChange={(e) => setRow(k.id, "jam_lembur", e.target.value)} /></td>
                </tr>
              );
            })}
            {(karyawan || []).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada karyawan aktif</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
