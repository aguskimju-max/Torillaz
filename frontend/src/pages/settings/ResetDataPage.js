import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ResetDataPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [typed, setTyped] = useState("");

  const { data, refetch } = useQuery({ queryKey: ["reset-summary"], queryFn: async () => (await api.get("/reset/summary")).data });
  const targets = data?.targets || [];

  const resetMut = useMutation({
    mutationFn: async (keys) => (await api.post("/reset", { targets: keys })).data,
    onSuccess: (d) => {
      const total = Object.values(d.deleted || {}).reduce((a, b) => a + b, 0);
      toast.success(`Berhasil menghapus ${total} data`);
      setSelected({}); setConfirm(null); setTyped("");
      qc.invalidateQueries();
      refetch();
    },
    onError: (e) => { toast.error(apiError(e)); setConfirm(null); },
  });

  const toggle = (k) => setSelected((p) => ({ ...p, [k]: !p[k] }));
  const selectedKeys = targets.filter((t) => selected[t.key]).map((t) => t.key);
  const selectedCount = targets.filter((t) => selected[t.key]).reduce((a, t) => a + t.count, 0);
  const ask = (keys, label) => { setTyped(""); setConfirm({ keys, label }); };

  return (
    <div>
      <PageHeader title="Reset / Hapus Data Dummy" subtitle="Hapus data contoh agar bisa diisi dengan data asli Anda" />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-5 flex gap-3" data-testid="reset-warning">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">Tindakan ini permanen dan tidak bisa dibatalkan.</p>
          <p className="mt-1">Akun pengguna & role TIDAK ikut terhapus. Disarankan menghapus data transaksi lebih dulu sebelum data master, dan lakukan Backup Data terlebih dahulu.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm divide-y divide-slate-100" data-testid="reset-list">
        {targets.map((t) => (
          <div key={t.key} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50" data-testid={`reset-item-${t.key}`}>
            <Checkbox checked={!!selected[t.key]} onCheckedChange={() => toggle(t.key)} data-testid={`reset-check-${t.key}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800">{t.label}</div>
              <div className="text-xs text-slate-400">{t.count} data</div>
            </div>
            <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50" disabled={t.count === 0} data-testid={`reset-single-${t.key}`} onClick={() => ask([t.key], t.label)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Hapus
            </Button>
          </div>
        ))}
        {targets.length === 0 && <div className="px-4 py-8 text-center text-slate-400">Memuat...</div>}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <Button variant="outline" disabled={selectedKeys.length === 0} data-testid="reset-selected-btn" onClick={() => ask(selectedKeys, `${selectedKeys.length} modul terpilih (${selectedCount} data)`)}>
          Hapus Data Terpilih ({selectedKeys.length})
        </Button>
        <Button className="bg-rose-600 hover:bg-rose-700" data-testid="reset-all-btn" onClick={() => ask(["all"], "SEMUA data dummy (transaksi + master)")}>
          <ShieldAlert className="h-4 w-4 mr-1.5" /> Hapus Semua Data Dummy
        </Button>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Data</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus permanen: <b>{confirm?.label}</b>. Ketik <b>HAPUS</b> untuk melanjutkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input data-testid="reset-confirm-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ketik HAPUS" className="my-2" />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" disabled={typed !== "HAPUS" || resetMut.isPending} data-testid="reset-confirm-btn" onClick={(e) => { if (typed !== "HAPUS") { e.preventDefault(); return; } resetMut.mutate(confirm.keys); }}>
              {resetMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
