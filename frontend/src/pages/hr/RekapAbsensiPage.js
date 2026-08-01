import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import ExportButtons from "@/components/common/ExportButtons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { angka } from "@/lib/format";

const thisMonth = () => new Date().toISOString().slice(0, 7);

const LEGEND = [
  { v: "hadir", l: "H", label: "Hadir", cls: "bg-emerald-100 text-emerald-700", head: "text-emerald-700" },
  { v: "izin", l: "I", label: "Izin", cls: "bg-sky-100 text-sky-700", head: "text-sky-700" },
  { v: "sakit", l: "S", label: "Sakit", cls: "bg-amber-100 text-amber-700", head: "text-amber-700" },
  { v: "alpha", l: "A", label: "Alpha", cls: "bg-rose-100 text-rose-700", head: "text-rose-700" },
  { v: "libur", l: "L", label: "Libur", cls: "bg-slate-100 text-slate-400", head: "text-slate-400" },
];
const CELL = Object.fromEntries(LEGEND.map((x) => [x.v, x]));

export default function RekapAbsensiPage() {
  const [periode, setPeriode] = useState(thisMonth());
  const { data, isLoading } = useQuery({
    queryKey: ["att-monthly", periode],
    queryFn: async () => (await api.get("/hr/attendance/monthly", { params: { periode } })).data,
  });
  const days = data?.days || 31;
  const items = data?.items || [];
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);

  const totals = items.reduce(
    (a, r) => ({
      hadir: a.hadir + r.hadir, izin: a.izin + r.izin, sakit: a.sakit + r.sakit,
      alpha: a.alpha + r.alpha, libur: a.libur + r.libur, jam_lembur: a.jam_lembur + r.jam_lembur,
    }),
    { hadir: 0, izin: 0, sakit: 0, alpha: 0, libur: 0, jam_lembur: 0 }
  );

  const exportCols = [
    { label: "Karyawan", value: (r) => r.karyawan_nama, width: 22 },
    { label: "Jabatan", value: (r) => r.jabatan_nama, width: 18 },
    { label: "Hadir", value: (r) => r.hadir, align: "right" },
    { label: "Izin", value: (r) => r.izin, align: "right" },
    { label: "Sakit", value: (r) => r.sakit, align: "right" },
    { label: "Alpha", value: (r) => r.alpha, align: "right" },
    { label: "Libur", value: (r) => r.libur, align: "right" },
    { label: "Lembur (jam)", value: (r) => angka(r.jam_lembur), align: "right" },
    { label: "Total Tercatat", value: (r) => r.tercatat, align: "right" },
  ];

  return (
    <div>
      <PageHeader title="Rekap Absensi" subtitle="Rekap kehadiran karyawan yang sudah diinput di menu Absensi, per bulan" />

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-5 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <div>
          <Label className="mb-1.5 block">Periode</Label>
          <Input data-testid="rekap-periode" type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-44" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 pb-2">
          <CalendarCheck className="h-4 w-4 text-emerald-600" /> {items.length} karyawan aktif
        </div>
        <div className="sm:ml-auto pb-0.5">
          <ExportButtons
            testId="rekap-export"
            filename={`Rekap-Absensi-${periode}`}
            title={`Rekap Absensi ${periode}`}
            subtitle={`Total ${items.length} karyawan aktif`}
            orientation="landscape"
            rows={items}
            columns={exportCols}
          />
        </div>
      </div>

      {/* Ringkasan rekap */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-5" data-testid="rekap-summary">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-emerald-600" />
          <span className="font-heading font-semibold text-slate-800 text-sm">Ringkasan · {periode}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-4 py-2">Karyawan</th>
                <th className="px-3 py-2 text-emerald-700">Hadir</th>
                <th className="px-3 py-2 text-sky-700">Izin</th>
                <th className="px-3 py-2 text-amber-700">Sakit</th>
                <th className="px-3 py-2 text-rose-600">Alpha</th>
                <th className="px-3 py-2 text-slate-400">Libur</th>
                <th className="px-3 py-2">Lembur (jam)</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.karyawan_id} className="border-t border-slate-100 text-center" data-testid={`rekap-row-${r.karyawan_id}`}>
                  <td className="text-left px-4 py-2">
                    <div className="font-medium text-slate-800">{r.karyawan_nama}</div>
                    <div className="text-xs text-slate-400">{r.jabatan_nama}</div>
                  </td>
                  <td className="px-3 py-2 text-emerald-700 font-medium">{r.hadir}</td>
                  <td className="px-3 py-2">{r.izin}</td>
                  <td className="px-3 py-2">{r.sakit}</td>
                  <td className="px-3 py-2 text-rose-600 font-medium">{r.alpha}</td>
                  <td className="px-3 py-2 text-slate-400">{r.libur}</td>
                  <td className="px-3 py-2">{angka(r.jam_lembur)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-700">{r.tercatat}</td>
                </tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Belum ada data absensi pada periode ini</td></tr>
              )}
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Memuat...</td></tr>}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 text-center bg-slate-50 font-semibold text-slate-700">
                  <td className="text-left px-4 py-2">TOTAL</td>
                  <td className="px-3 py-2 text-emerald-700">{totals.hadir}</td>
                  <td className="px-3 py-2">{totals.izin}</td>
                  <td className="px-3 py-2">{totals.sakit}</td>
                  <td className="px-3 py-2 text-rose-600">{totals.alpha}</td>
                  <td className="px-3 py-2 text-slate-400">{totals.libur}</td>
                  <td className="px-3 py-2">{angka(totals.jam_lembur)}</td>
                  <td className="px-3 py-2">{totals.hadir + totals.izin + totals.sakit + totals.alpha + totals.libur}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Keterangan:</span>
        {LEGEND.map((s) => (
          <span key={s.v} className="inline-flex items-center gap-1.5">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded font-semibold ${s.cls}`}>{s.l}</span>
            {s.label}
          </span>
        ))}
      </div>

      {/* Matriks harian */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" data-testid="rekap-matrix">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <span className="font-heading font-semibold text-slate-800 text-sm">Detail Harian · {periode}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-3 py-2 min-w-[180px] border-r border-slate-200">Karyawan</th>
                {dayList.map((d) => (
                  <th key={d} className="px-1.5 py-2 w-7 text-center font-medium">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.karyawan_id} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 min-w-[180px] border-r border-slate-200">
                    <div className="font-medium text-slate-800 truncate">{r.karyawan_nama}</div>
                    <div className="text-[11px] text-slate-400 truncate">{r.jabatan_nama}</div>
                  </td>
                  {dayList.map((d) => {
                    const st = r.daily?.[String(d)];
                    const c = st ? CELL[st] : null;
                    const lem = r.lembur_daily?.[String(d)];
                    return (
                      <td key={d} className="px-0.5 py-1 text-center">
                        {c ? (
                          <span
                            className={`relative inline-flex h-6 w-6 items-center justify-center rounded font-semibold ${c.cls}`}
                            title={`${c.label}${lem ? ` · lembur ${angka(lem)} jam` : ""}`}
                          >
                            {c.l}
                            {lem ? <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-indigo-500" /> : null}
                          </span>
                        ) : (
                          <span className="text-slate-200">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={days + 1} className="px-4 py-8 text-center text-slate-400">Belum ada data absensi pada periode ini</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
          Titik indigo di kanan atas menandakan ada jam lembur pada hari tersebut.
        </div>
      </div>
    </div>
  );
}
