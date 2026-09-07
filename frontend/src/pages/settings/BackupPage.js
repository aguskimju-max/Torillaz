import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, Download, ShieldCheck, Upload, FileJson, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const COLL_LABELS = {
  users: "Pengguna", roles: "Roles", master_perusahaan: "Perusahaan", master_cabang: "Cabang",
  master_gudang: "Gudang", master_rak: "Rak", master_kategori: "Kategori", master_satuan: "Satuan",
  master_merek: "Merek", master_supplier: "Supplier", master_pelanggan: "Pelanggan",
  master_bahan_baku: "Bahan Baku", master_barang_jadi: "Barang Jadi", master_karyawan: "Karyawan",
  master_jabatan: "Jabatan", master_divisi: "Divisi", master_rekening: "Rekening",
  master_pajak: "Pajak", master_biaya: "Biaya", master_metode: "Metode Pembayaran",
  stock_movements: "Riwayat Stok", stock_balances: "Saldo Stok", counters: "Penomoran",
};

export default function BackupPage() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [parsed, setParsed] = useState(null); // {fileName, data, summary:[{coll,count}], total}
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null); // {total, collections}

  const doBackup = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/backup");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-erp-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup berhasil diunduh");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.collections !== "object" || data.collections === null) {
          toast.error("File tidak valid: bukan file backup ERP (tidak ada 'collections')");
          setParsed(null);
          return;
        }
        const summary = Object.entries(data.collections)
          .filter(([, docs]) => Array.isArray(docs))
          .map(([coll, docs]) => ({ coll, count: docs.length }));
        if (summary.length === 0) {
          toast.error("File backup kosong / tidak berisi koleksi data");
          setParsed(null);
          return;
        }
        const total = summary.reduce((s, x) => s + x.count, 0);
        setParsed({ fileName: file.name, generatedAt: data.generated_at, data, summary, total });
      } catch {
        toast.error("File tidak valid: gagal membaca JSON");
        setParsed(null);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const doRestore = async () => {
    if (!parsed) return;
    setRestoring(true);
    try {
      const { data } = await api.post("/backup/restore", parsed.data);
      setResult({ total: data.total, collections: Object.keys(data.restored).length });
      setParsed(null);
      toast.success(`Restore berhasil: ${data.total} data dari ${Object.keys(data.restored).length} koleksi dipulihkan`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRestoring(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div>
      <PageHeader title="Backup Data" subtitle="Unduh salinan seluruh data sistem, atau pulihkan (import) dari file backup" />
      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        {/* ==== Backup / Export ==== */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <DatabaseBackup className="h-6 w-6" />
          </div>
          <h3 className="font-heading font-semibold text-lg text-slate-900">Backup Database</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Membuat cadangan seluruh master data, transaksi stok, pengguna, dan konfigurasi
            dalam satu file JSON. Simpan file ini di tempat aman.
          </p>
          <Button data-testid="backup-btn" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading} onClick={doBackup}>
            <Download className="h-4 w-4 mr-1.5" /> {loading ? "Memproses..." : "Unduh Backup"}
          </Button>
          <div className="mt-6 flex items-start gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
            Data terenkripsi saat transit (HTTPS). Hanya pengguna dengan izin export yang dapat mengakses.
          </div>
        </div>

        {/* ==== Import / Restore ==== */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Upload className="h-6 w-6" />
          </div>
          <h3 className="font-heading font-semibold text-lg text-slate-900">Import / Restore Data</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Pulihkan data dari file backup JSON. Seluruh data saat ini akan <span className="font-semibold text-slate-700">diganti</span> dengan
            isi file backup sehingga langsung siap digunakan.
          </p>

          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            data-testid="restore-file-input" onChange={onFileChange} />
          <Button data-testid="restore-pick-btn" variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
            disabled={restoring} onClick={() => fileRef.current?.click()}>
            <FileJson className="h-4 w-4 mr-1.5" /> Pilih File Backup (.json)
          </Button>

          {parsed && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="restore-preview">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <FileJson className="h-4 w-4 text-amber-600" /> {parsed.fileName}
              </div>
              {parsed.generatedAt && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Dibuat: {new Date(parsed.generatedAt).toLocaleString("id-ID")}
                </div>
              )}
              <div className="mt-3 max-h-44 overflow-y-auto pr-1 space-y-1">
                {parsed.summary.map(({ coll, count }) => (
                  <div key={coll} className="flex justify-between text-xs">
                    <span className="text-slate-600">{COLL_LABELS[coll] || coll}</span>
                    <span className="font-mono text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Total data</span>
                <span className="font-mono text-slate-900">{parsed.total}</span>
              </div>
              <Button data-testid="restore-btn" className="mt-4 w-full bg-amber-600 hover:bg-amber-700"
                disabled={restoring} onClick={() => setConfirmOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" /> {restoring ? "Memulihkan..." : "Restore Sekarang"}
              </Button>
            </div>
          )}

          {result && (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2"
              data-testid="restore-success">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-800">
                Restore berhasil — {result.total} data dari {result.collections} koleksi telah dipulihkan dan siap digunakan.
              </div>
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 text-xs text-slate-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            Restore mengganti seluruh data. Disarankan unduh backup terbaru terlebih dahulu sebelum melakukan restore.
          </div>
        </div>
      </div>

      {/* Konfirmasi restore */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="restore-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Konfirmasi Restore Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh data saat ini (master data, stok, pengguna, dll) akan <b>DIHAPUS dan DIGANTI</b> dengan
              isi file backup <b>{parsed?.fileName}</b> ({parsed?.total} data).
              Tindakan ini tidak dapat dibatalkan. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="restore-cancel">Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="restore-confirm" className="bg-amber-600 hover:bg-amber-700"
              disabled={restoring} onClick={(e) => { e.preventDefault(); doRestore(); }}>
              {restoring ? "Memulihkan..." : "Ya, Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
