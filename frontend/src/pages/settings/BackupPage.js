import React, { useState } from "react";
import { DatabaseBackup, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";

export default function BackupPage() {
  const [loading, setLoading] = useState(false);

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

  return (
    <div>
      <PageHeader title="Backup Data" subtitle="Unduh salinan seluruh data sistem dalam format JSON" />
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 max-w-lg">
        <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
          <DatabaseBackup className="h-6 w-6" />
        </div>
        <h3 className="font-heading font-semibold text-lg text-slate-900">Backup Database</h3>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Membuat cadangan seluruh master data, transaksi stok, pengguna, dan konfigurasi.
          Simpan file ini di tempat aman. Restore dapat dilakukan oleh administrator.
        </p>
        <Button data-testid="backup-btn" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading} onClick={doBackup}>
          <Download className="h-4 w-4 mr-1.5" /> {loading ? "Memproses..." : "Unduh Backup"}
        </Button>
        <div className="mt-6 flex items-start gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
          Data terenkripsi saat transit (HTTPS). Hanya pengguna dengan izin export yang dapat mengakses.
        </div>
      </div>
    </div>
  );
}
