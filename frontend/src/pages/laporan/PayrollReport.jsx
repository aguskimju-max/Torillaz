import React from "react";
import DataTable from "@/components/common/DataTable";
import ExportButtons from "@/components/common/ExportButtons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rupiah } from "@/lib/format";

const EXPORT_COLS = [
  { label: "No. Slip", value: (r) => r.no }, { label: "Karyawan", value: (r) => r.karyawan_nama }, { label: "Jabatan", value: (r) => r.jabatan_nama },
  { label: "Gaji Pokok", value: (r) => (r.gaji_diperoleh != null ? r.gaji_diperoleh : r.gaji_pokok), align: "right" }, { label: "Lembur", value: (r) => r.upah_lembur, align: "right" }, { label: "Potongan", value: (r) => r.total_potongan, align: "right" },
  { label: "Gaji Bersih", value: (r) => r.gaji_bersih, align: "right" }, { label: "Status", value: (r) => r.status },
];

const TABLE_COLS = [
  { key: "karyawan_nama", label: "Karyawan" }, { key: "jabatan_nama", label: "Jabatan" },
  { key: "gaji_pokok", label: "Gaji Pokok", align: "right", render: (r) => rupiah(r.gaji_diperoleh != null ? r.gaji_diperoleh : r.gaji_pokok) }, { key: "total_potongan", label: "Potongan", align: "right", render: (r) => rupiah(r.total_potongan) },
  { key: "gaji_bersih", label: "Gaji Bersih", align: "right", render: (r) => <span className="font-semibold text-emerald-700">{rupiah(r.gaji_bersih)}</span> }, { key: "status", label: "Status" },
];

export function PayrollReport({ payroll, periode, setPeriode }) {
  return (
    <>
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4 flex items-end gap-3">
        <div><Label className="mb-1.5 block">Periode</Label><Input data-testid="rep-payroll-periode" type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className="w-44" /></div>
        <div className="flex-1" />
        <ExportButtons testId="rep-payroll-export" filename={`Laporan-Payroll-${periode}`} title={`Laporan Payroll ${periode}`} orientation="landscape" rows={payroll?.items || []} columns={EXPORT_COLS} />
      </div>
      <div className="mb-3 text-sm text-slate-600">Total gaji periode: <b className="text-emerald-700">{rupiah(payroll?.total_gaji)}</b></div>
      <DataTable testId="rep-payroll-table" columns={TABLE_COLS} rows={payroll?.items || []} total={payroll?.total || 0} emptyText="Belum ada payroll pada periode ini" />
    </>
  );
}
