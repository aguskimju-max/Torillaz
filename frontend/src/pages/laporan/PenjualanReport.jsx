import React from "react";
import DataTable from "@/components/common/DataTable";
import ExportButtons from "@/components/common/ExportButtons";
import { rupiah, tanggal } from "@/lib/format";
import { RangeBar } from "./RangeBar";

const EXPORT_COLS = [
  { label: "No. SO", value: (r) => r.no_so }, { label: "Tanggal", value: (r) => tanggal(r.tanggal) }, { label: "Pelanggan", value: (r) => r.pelanggan_nama || "" },
  { label: "Invoice", value: (r) => r.no_invoice || "" }, { label: "Tipe", value: (r) => r.tipe }, { label: "Total", value: (r) => r.total, align: "right" },
  { label: "Terbayar", value: (r) => r.terbayar, align: "right" }, { label: "Sisa", value: (r) => r.sisa, align: "right" }, { label: "Status", value: (r) => r.status },
];

const TABLE_COLS = [
  { key: "no_so", label: "No. SO", render: (r) => <span className="font-mono text-xs">{r.no_so}</span> }, { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
  { key: "pelanggan_nama", label: "Pelanggan" }, { key: "total", label: "Total", align: "right", render: (r) => rupiah(r.total) },
  { key: "sisa", label: "Sisa", align: "right", render: (r) => rupiah(r.sisa) }, { key: "status", label: "Status" },
];

export function PenjualanReport({ range, setRange, salesRows, salesTotal }) {
  return (
    <>
      <RangeBar range={range} setRange={setRange}>
        <ExportButtons testId="rep-sales-export" filename={`Laporan-Penjualan-${range.start}_${range.end}`} title="Laporan Penjualan" subtitle={`${range.start} s/d ${range.end}`} orientation="landscape" rows={salesRows} columns={EXPORT_COLS} />
      </RangeBar>
      <div className="mb-3 text-sm text-slate-600">Total omzet periode: <b className="text-emerald-700">{rupiah(salesTotal)}</b> · {salesRows.length} transaksi</div>
      <DataTable testId="rep-sales-table" columns={TABLE_COLS} rows={salesRows} total={salesRows.length} />
    </>
  );
}
