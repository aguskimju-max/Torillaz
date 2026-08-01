import React from "react";
import { Users, Wallet, Clock } from "lucide-react";
import KpiCard from "@/components/common/KpiCard";
import { rupiah } from "@/lib/format";

export function PayrollKpis({ summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
      <KpiCard testId="payroll-karyawan" icon={Users} accent="sky" label="Karyawan Aktif" value={summary?.karyawan_aktif || 0} />
      <KpiCard testId="payroll-gaji-bulan" icon={Wallet} accent="emerald" label={`Gaji Periode ${summary?.periode || ""}`} value={rupiah(summary?.gaji_bulan)} />
      <KpiCard testId="payroll-belum" icon={Clock} accent="amber" label="Belum Dibayar" value={summary?.belum_dibayar || 0} sub="slip menunggu pembayaran" />
    </div>
  );
}
