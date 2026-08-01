import React from "react";
import DataTable from "@/components/common/DataTable";
import ExportButtons from "@/components/common/ExportButtons";
import { rupiah, angka, tanggal } from "@/lib/format";

const EXPORT_COLS = [
  { label: "No. Produksi", value: (r) => r.no_produksi }, { label: "Tanggal", value: (r) => tanggal(r.tanggal) }, { label: "Produk", value: (r) => r.barang_jadi_nama || "" },
  { label: "Hasil", value: (r) => r.qty_hasil, align: "right" }, { label: "HPP/Unit", value: (r) => r.hpp_per_unit, align: "right" }, { label: "Total HPP", value: (r) => r.total_hpp, align: "right" },
];

const TABLE_COLS = [
  { key: "no_produksi", label: "No. Produksi", render: (r) => <span className="font-mono text-xs">{r.no_produksi}</span> }, { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
  { key: "barang_jadi_nama", label: "Produk" }, { key: "qty_hasil", label: "Hasil", align: "right", render: (r) => angka(r.qty_hasil) },
  { key: "hpp_per_unit", label: "HPP/Unit", align: "right", render: (r) => rupiah(r.hpp_per_unit) }, { key: "total_hpp", label: "Total HPP", align: "right", render: (r) => rupiah(r.total_hpp) },
];

export function ProduksiReport({ prod }) {
  return (
    <>
      <div className="flex justify-end mb-4">
        <ExportButtons testId="rep-prod-export" filename="Laporan-Produksi" title="Laporan Produksi & HPP" orientation="landscape" rows={prod?.items || []} columns={EXPORT_COLS} />
      </div>
      <DataTable testId="rep-prod-table" columns={TABLE_COLS} rows={prod?.items || []} total={prod?.total || 0} />
    </>
  );
}
