import React from "react";
import { CalendarCheck } from "lucide-react";
import { angka } from "@/lib/format";

export function PayrollRecap({ periode, recap }) {
  const items = recap?.items || [];
  return (
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
          {items.map((r) => (
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
          {items.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Belum ada data absensi pada periode ini</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
