import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, RotateCcw, Save, Boxes, SlidersHorizontal, TrendingUp, TrendingDown, Search } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { angka, tanggal } from "@/lib/format";

const rowKey = (r) => `${r.item_type}|${r.item_id}|${r.gudang_id}|${r.batch || "-"}`;

export default function PenyesuaianStokPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [itemType, setItemType] = useState("all");
  const [gudangId, setGudangId] = useState("all");
  const [edits, setEdits] = useState({});
  const [keterangan, setKeterangan] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: gudangs } = useQuery({
    queryKey: ["options", "gudang"],
    queryFn: async () => (await api.get("/master/gudang/options")).data,
  });

  const params = { limit: 500 };
  if (q) params.q = q;
  if (itemType !== "all") params.item_type = itemType;
  if (gudangId !== "all") params.gudang_id = gudangId;

  const { data, isLoading } = useQuery({
    queryKey: ["balances", "penyesuaian", q, itemType, gudangId],
    queryFn: async () => (await api.get("/stock/balances", { params })).data,
  });
  const rows = data?.items || [];

  const setEdit = (key, val) => setEdits((p) => ({ ...p, [key]: val }));
  const clearEdit = (key) => setEdits((p) => {
    const n = { ...p };
    delete n[key];
    return n;
  });

  const changes = useMemo(() => {
    const list = [];
    for (const r of rows) {
      const key = rowKey(r);
      const raw = edits[key];
      if (raw === undefined || raw === "") continue;
      const aktual = Number(raw);
      if (Number.isNaN(aktual) || aktual < 0) continue;
      const selisih = Math.round((aktual - (r.qty || 0)) * 10000) / 10000;
      if (selisih === 0) continue;
      list.push({ ...r, key, qty_aktual: aktual, selisih });
    }
    return list;
  }, [rows, edits]);

  const plusCount = changes.filter((c) => c.selisih > 0).length;
  const minusCount = changes.filter((c) => c.selisih < 0).length;

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        keterangan,
        items: changes.map((c) => ({
          item_type: c.item_type, item_id: c.item_id, gudang_id: c.gudang_id,
          batch: c.batch, expired_date: c.expired_date, qty_aktual: c.qty_aktual,
        })),
      };
      return (await api.post("/stock/opname-bulk", payload)).data;
    },
    onSuccess: (res) => {
      toast.success(`Penyesuaian berhasil: ${res.adjusted} item disesuaikan dengan stok aktual`);
      setEdits({});
      setKeterangan("");
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["balances"] });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const selisihCell = (s, satuan) => (
    <span className={s > 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
      {s > 0 ? "+" : ""}{angka(s)} {satuan}
    </span>
  );

  return (
    <div>
      <PageHeader
        title="Penyesuaian Stok"
        subtitle="Sesuaikan stok sistem dengan hasil hitung fisik (stok aktual) per jenis barang, gudang & batch"
      >
        <Button
          variant="outline"
          data-testid="reset-penyesuaian"
          onClick={() => { setEdits({}); setKeterangan(""); }}
          disabled={changes.length === 0}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
        </Button>
        <Button
          data-testid="simpan-penyesuaian"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setConfirmOpen(true)}
          disabled={changes.length === 0}
        >
          <Save className="h-4 w-4 mr-1.5" /> Simpan Penyesuaian ({changes.length})
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <KpiCard testId="adj-total-baris" icon={Boxes} accent="sky" label="Baris Stok" value={angka(rows.length)} sub="Item × gudang × batch" />
        <KpiCard testId="adj-diubah" icon={SlidersHorizontal} accent="emerald" label="Akan Disesuaikan" value={angka(changes.length)} sub="Baris dengan selisih" />
        <KpiCard testId="adj-plus" icon={TrendingUp} accent="emerald" label="Selisih Tambah" value={angka(plusCount)} sub="Stok aktual > sistem" />
        <KpiCard testId="adj-minus" icon={TrendingDown} accent={minusCount ? "rose" : "slate"} label="Selisih Kurang" value={angka(minusCount)} sub="Stok aktual < sistem" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            data-testid="adj-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode/nama item..."
            className="pl-9 bg-white"
          />
        </div>
        <Select value={itemType} onValueChange={setItemType}>
          <SelectTrigger data-testid="adj-filter-jenis" className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Semua Jenis</SelectItem>
            <SelectItem value="bahan_baku">Bahan Baku</SelectItem>
            <SelectItem value="barang_jadi">Barang Jadi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gudangId} onValueChange={setGudangId}>
          <SelectTrigger data-testid="adj-filter-gudang" className="w-48 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Semua Gudang</SelectItem>
            {(gudangs || []).map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>{g.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full border-collapse" data-testid="adj-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <th className="py-3 px-4 text-left whitespace-nowrap">Kode</th>
              <th className="py-3 px-4 text-left">Nama Item</th>
              <th className="py-3 px-4 text-left whitespace-nowrap">Jenis</th>
              <th className="py-3 px-4 text-left whitespace-nowrap">Gudang</th>
              <th className="py-3 px-4 text-left whitespace-nowrap">Batch / Produksi</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Stok Sistem</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Stok Aktual</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100">
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="py-3 px-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                ))}
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400">
                  <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Tidak ada stok tercatat untuk filter ini
                </td>
              </tr>
            )}
            {!isLoading && rows.map((r) => {
              const key = rowKey(r);
              const raw = edits[key];
              const hasEdit = raw !== undefined && raw !== "";
              const aktual = hasEdit ? Number(raw) : null;
              const valid = hasEdit && !Number.isNaN(aktual) && aktual >= 0;
              const selisih = valid ? Math.round((aktual - (r.qty || 0)) * 10000) / 10000 : 0;
              const changed = valid && selisih !== 0;
              return (
                <tr key={key} className={`border-b border-slate-100 ${changed ? "bg-amber-50/60" : "hover:bg-slate-50/60"}`}>
                  <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">{r.item_kode}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{r.item_nama}</td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <StatusBadge variant={r.item_type === "bahan_baku" ? "warning" : "success"}>
                      {r.item_type === "bahan_baku" ? "Bahan Baku" : "Barang Jadi"}
                    </StatusBadge>
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">{r.gudang_nama}</td>
                  <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">
                    {r.tanggal_produksi ? tanggal(r.tanggal_produksi) : (r.batch && r.batch !== "-" ? r.batch : "-")}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap font-semibold">
                    {angka(r.qty)} <span className="text-slate-400 font-normal">{r.satuan}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      data-testid={`adj-input-${r.item_kode}-${r.batch || "-"}`}
                      value={raw ?? ""}
                      onChange={(e) => e.target.value === "" ? clearEdit(key) : setEdit(key, e.target.value)}
                      placeholder={angka(r.qty)}
                      className={`w-28 ml-auto text-right bg-white ${changed ? "border-amber-400 ring-1 ring-amber-300" : ""}`}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    {changed ? selisihCell(selisih, r.satuan) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          Isi kolom <b>Stok Aktual</b> hanya pada baris yang berbeda dengan hitung fisik. Baris tanpa isian tidak akan diubah.
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-white max-w-2xl" data-testid="adj-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" /> Konfirmasi Penyesuaian Stok
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-500 -mt-1">
            {changes.length} baris akan disesuaikan ke stok aktual. Periksa kembali sebelum menyimpan.
          </div>
          <div className="overflow-auto max-h-[45vh] rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-left px-3 py-2">Gudang</th>
                  <th className="text-right px-3 py-2">Sistem</th>
                  <th className="text-right px-3 py-2">Aktual</th>
                  <th className="text-right px-3 py-2">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.key} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-800">{c.item_nama}</span>
                      {c.batch && c.batch !== "-" && <span className="text-slate-400 text-xs block">Batch {c.batch}</span>}
                    </td>
                    <td className="px-3 py-2">{c.gudang_nama}</td>
                    <td className="px-3 py-2 text-right">{angka(c.qty)} {c.satuan}</td>
                    <td className="px-3 py-2 text-right font-semibold">{angka(c.qty_aktual)} {c.satuan}</td>
                    <td className="px-3 py-2 text-right">{selisihCell(c.selisih, c.satuan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Keterangan (opsional)</label>
            <Textarea
              data-testid="adj-keterangan"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Mis. hasil stock opname bulanan, koreksi selisih gudang..."
              rows={2}
              className="bg-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={mut.isPending}>Batal</Button>
            <Button
              data-testid="adj-confirm-submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || changes.length === 0}
            >
              {mut.isPending ? "Menyimpan..." : `Sesuaikan ${changes.length} Item`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
