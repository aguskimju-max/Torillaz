import React from "react";
import DataTable from "@/components/common/DataTable";
import ExportButtons from "@/components/common/ExportButtons";
import { rupiah, angka } from "@/lib/format";

const EXPORT_COLS = [
  { label: "Kode", value: (r) => r.item_kode || "" }, { label: "Nama", value: (r) => r.item_nama || "" }, { label: "Gudang", value: (r) => r.gudang_nama || "" },
  { label: "Batch", value: (r) => r.batch || "" }, { label: "Qty", value: (r) => r.qty, align: "right" }, { label: "Satuan", value: (r) => r.satuan || "" },
  { label: "Harga Rata2", value: (r) => r.avg_price, align: "right" }, { label: "Nilai", value: (r) => r.nilai, align: "right" },
];

const TABLE_COLS = [
  { key: "item_nama", label: "Item", render: (r) => <div><div className="font-medium">{r.item_nama}</div><div className="text-xs text-slate-400">{r.item_kode}</div></div> },
  { key: "gudang_nama", label: "Gudang" }, { key: "batch", label: "Batch", render: (r) => r.batch || "-" },
  { key: "qty", label: "Qty", align: "right", render: (r) => `${angka(r.qty)} ${r.satuan || ""}` },
  { key: "nilai", label: "Nilai", align: "right", render: (r) => rupiah(r.nilai) },
];

export function PersediaanReport({ stok }) {
  return (
    <>
      <div className="flex justify-end mb-4">
        <ExportButtons testId="rep-stok-export" filename="Laporan-Persediaan" title="Laporan Persediaan / Stok" orientation="landscape" rows={stok?.items || []} columns={EXPORT_COLS} />
      </div>
      <DataTable testId="rep-stok-table" columns={TABLE_COLS} rows={stok?.items || []} total={stok?.total || 0} />
    </>
  );
}
