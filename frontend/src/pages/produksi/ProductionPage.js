import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Factory, CheckCircle2, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import ExportButtons from "@/components/common/ExportButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rupiah, angka, tanggal } from "@/lib/format";

const EMPTY = {
  bom_id: "", qty_target: "", gudang_bb_id: "", gudang_bj_id: "",
  qty_hasil: "", qty_reject: "", qty_waste: "", batch: "", expired_date: "",
  biaya_tk: "", biaya_overhead: "", tanggal: new Date().toISOString().slice(0, 10),
};

export default function ProductionPage() {
  const { hasPerm } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(null);
  const [detail, setDetail] = useState(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["prod-orders", q, page],
    queryFn: async () => (await api.get("/production/orders", { params: { q, page, limit } })).data,
  });
  const { data: bomData } = useQuery({ queryKey: ["bom-opts"], queryFn: async () => (await api.get("/production/bom", { params: { limit: 100 } })).data });
  const { data: gudang } = useQuery({ queryKey: ["options", "gudang"], queryFn: async () => (await api.get("/master/gudang/options")).data });

  const boms = bomData?.items || [];
  const selectedBom = boms.find((b) => b.id === form.bom_id);

  // auto preview when bom + qty + gudang bb chosen (debounced)
  useEffect(() => {
    let active = true;
    if (!form.bom_id || !form.gudang_bb_id || !(Number(form.qty_target) > 0)) { setPreview(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = (await api.post("/production/preview", {
          bom_id: form.bom_id, qty_target: Number(form.qty_target), gudang_bb_id: form.gudang_bb_id,
        })).data;
        if (active) {
          setPreview(res);
          setForm((p) => ({ ...p, biaya_tk: String(res.biaya_tk), biaya_overhead: String(res.biaya_overhead) }));
        }
      } catch { if (active) setPreview(null); }
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [form.bom_id, form.qty_target, form.gudang_bb_id]);

  useEffect(() => { if (!open) { setForm(EMPTY); setPreview(null); } }, [open]);

  const qtyHasil = Number(form.qty_hasil) > 0 ? Number(form.qty_hasil) : Number(form.qty_target) || 0;
  const totalHpp = useMemo(() => {
    const bahan = preview?.biaya_bahan || 0;
    return bahan + (Number(form.biaya_tk) || 0) + (Number(form.biaya_overhead) || 0);
  }, [preview, form.biaya_tk, form.biaya_overhead]);
  const hppUnit = qtyHasil > 0 ? totalHpp / qtyHasil : 0;

  const processMut = useMutation({
    mutationFn: async () => (await api.post("/production/process", {
      bom_id: form.bom_id, qty_target: Number(form.qty_target), qty_hasil: qtyHasil,
      qty_reject: Number(form.qty_reject) || 0, qty_waste: Number(form.qty_waste) || 0,
      gudang_bb_id: form.gudang_bb_id, gudang_bj_id: form.gudang_bj_id,
      batch: form.batch || undefined, expired_date: form.expired_date || undefined,
      biaya_tk: Number(form.biaya_tk) || 0, biaya_overhead: Number(form.biaya_overhead) || 0,
      tanggal: form.tanggal,
    })).data,
    onSuccess: (d) => {
      toast.success(`Produksi ${d.no_produksi} selesai · HPP/unit ${rupiah(d.hpp_per_unit)}`);
      qc.invalidateQueries({ queryKey: ["prod-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const submit = () => {
    if (!form.bom_id) return toast.error("Pilih resep/BOM");
    if (!(Number(form.qty_target) > 0)) return toast.error("Jumlah produksi harus > 0");
    if (!form.gudang_bb_id || !form.gudang_bj_id) return toast.error("Pilih gudang bahan baku & barang jadi");
    if (preview && !preview.semua_cukup) return toast.error("Stok bahan baku tidak mencukupi");
    processMut.mutate();
  };

  const prodExportColumns = [
    { label: "No. Produksi", value: (r) => r.no_produksi, width: 14 },
    { label: "Tanggal", value: (r) => tanggal(r.tanggal), width: 14 },
    { label: "Produk", value: (r) => r.barang_jadi_nama || "", width: 24 },
    { label: "Target", value: (r) => r.qty_target, align: "right", width: 12 },
    { label: "Hasil", value: (r) => r.qty_hasil, align: "right", width: 12 },
    { label: "HPP/Unit", value: (r) => r.hpp_per_unit, align: "right", width: 16 },
    { label: "Total HPP", value: (r) => r.total_hpp, align: "right", width: 16 },
    { label: "Capaian %", value: (r) => r.achievement, align: "right", width: 12 },
  ];
  const fetchAllProd = async () => (await api.get("/production/orders", { params: { q, page: 1, limit: 2000 } })).data.items;

  const columns = [
    { key: "no_produksi", label: "No. Produksi", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.no_produksi}</span> },
    { key: "tanggal", label: "Tanggal", render: (r) => tanggal(r.tanggal) },
    { key: "barang_jadi_nama", label: "Produk" },
    { key: "qty_hasil", label: "Hasil", align: "right", render: (r) => `${angka(r.qty_hasil)} ${r.satuan || ""}` },
    { key: "hpp_per_unit", label: "HPP / Unit", align: "right", render: (r) => rupiah(r.hpp_per_unit) },
    { key: "total_hpp", label: "Total HPP", align: "right", render: (r) => rupiah(r.total_hpp) },
    { key: "achievement", label: "Capaian", align: "right", render: (r) => <StatusBadge variant={r.achievement >= 100 ? "success" : "warning"}>{angka(r.achievement)}%</StatusBadge> },
    { key: "_aksi", label: "", align: "right", render: (r) => (
      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`prod-view-${r.id}`} onClick={() => setDetail(r)}><Eye className="h-4 w-4 text-slate-500" /></Button>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Produksi & HPP" subtitle="Jalankan produksi dari resep, hitung kebutuhan bahan & HPP otomatis">
        <ExportButtons testId="prod-export" filename="Produksi" title="Laporan Produksi & HPP" columns={prodExportColumns} rows={fetchAllProd} orientation="landscape" />
        {hasPerm("produksi", "add") && (
          <Button data-testid="prod-add-btn" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>
            <Factory className="h-4 w-4 mr-1.5" /> Proses Produksi
          </Button>
        )}
      </PageHeader>

      <DataTable testId="prod-table" columns={columns} rows={data?.items || []} loading={isLoading} total={data?.total || 0}
        page={page} limit={limit} onPageChange={setPage} search={q} onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Cari no produksi / produk..." onRowClick={setDetail} />

      {/* Create / process */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="bg-white w-full sm:max-w-xl overflow-y-auto" data-testid="prod-drawer">
          <SheetHeader><SheetTitle className="font-heading">Proses Produksi</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-1.5 block">Resep / BOM <span className="text-rose-500">*</span></Label>
              <Select value={form.bom_id} onValueChange={(v) => setForm((p) => ({ ...p, bom_id: v }))}>
                <SelectTrigger data-testid="prod-bom" className="bg-white"><SelectValue placeholder="Pilih resep..." /></SelectTrigger>
                <SelectContent className="bg-white max-h-64">
                  {boms.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.kode} · {b.barang_jadi_nama}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedBom && <p className="text-xs text-slate-400 mt-1">Output resep: {angka(selectedBom.output_qty)} {selectedBom.satuan_output} · {(selectedBom.items || []).length} bahan</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Jumlah Produksi <span className="text-rose-500">*</span></Label>
                <Input data-testid="prod-qty-target" type="number" step="any" value={form.qty_target} onChange={(e) => setForm((p) => ({ ...p, qty_target: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Tanggal</Label>
                <Input data-testid="prod-tanggal" type="date" value={form.tanggal} onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Gudang Bahan Baku <span className="text-rose-500">*</span></Label>
                <Select value={form.gudang_bb_id} onValueChange={(v) => setForm((p) => ({ ...p, gudang_bb_id: v }))}>
                  <SelectTrigger data-testid="prod-gudang-bb" className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent className="bg-white max-h-64">{(gudang || []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Gudang Barang Jadi <span className="text-rose-500">*</span></Label>
                <Select value={form.gudang_bj_id} onValueChange={(v) => setForm((p) => ({ ...p, gudang_bj_id: v }))}>
                  <SelectTrigger data-testid="prod-gudang-bj" className="bg-white"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent className="bg-white max-h-64">{(gudang || []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Material requirement preview */}
            {preview && (
              <div className="rounded-lg border border-slate-200 overflow-hidden" data-testid="prod-preview">
                <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kebutuhan Bahan Baku</div>
                <table className="w-full text-sm">
                  <tbody>
                    {preview.items.map((it, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700">{it.item_nama}</td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{angka(it.butuh)} {it.satuan}</td>
                        <td className="px-3 py-1.5 text-right text-xs text-slate-400">ada {angka(it.tersedia)}</td>
                        <td className="px-3 py-1.5 text-right w-8">{it.cukup ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" /> : <XCircle className="h-4 w-4 text-rose-500 inline" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!preview.semua_cukup && <div className="px-3 py-2 text-xs text-rose-600 bg-rose-50 border-t border-rose-100">Stok bahan baku tidak mencukupi untuk produksi ini.</div>}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1.5 block">Hasil (Qty)</Label>
                <Input data-testid="prod-qty-hasil" type="number" step="any" placeholder={form.qty_target || "0"} value={form.qty_hasil} onChange={(e) => setForm((p) => ({ ...p, qty_hasil: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Reject</Label>
                <Input data-testid="prod-qty-reject" type="number" step="any" value={form.qty_reject} onChange={(e) => setForm((p) => ({ ...p, qty_reject: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Waste</Label>
                <Input data-testid="prod-qty-waste" type="number" step="any" value={form.qty_waste} onChange={(e) => setForm((p) => ({ ...p, qty_waste: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Batch / Lot</Label>
                <Input data-testid="prod-batch" placeholder="Auto jika kosong" value={form.batch} onChange={(e) => setForm((p) => ({ ...p, batch: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Kadaluarsa</Label>
                <Input data-testid="prod-expired" type="date" value={form.expired_date} onChange={(e) => setForm((p) => ({ ...p, expired_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Biaya Tenaga Kerja</Label>
                <Input data-testid="prod-tk" type="number" value={form.biaya_tk} onChange={(e) => setForm((p) => ({ ...p, biaya_tk: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">Biaya Overhead</Label>
                <Input data-testid="prod-oh" type="number" value={form.biaya_overhead} onChange={(e) => setForm((p) => ({ ...p, biaya_overhead: e.target.value }))} />
              </div>
            </div>

            {/* HPP summary */}
            {preview && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-1.5" data-testid="prod-hpp">
                <div className="flex justify-between text-sm text-slate-600"><span>Biaya Bahan</span><span>{rupiah(preview.biaya_bahan)}</span></div>
                <div className="flex justify-between text-sm text-slate-600"><span>Tenaga Kerja</span><span>{rupiah(form.biaya_tk)}</span></div>
                <div className="flex justify-between text-sm text-slate-600"><span>Overhead</span><span>{rupiah(form.biaya_overhead)}</span></div>
                <div className="flex justify-between text-sm font-semibold text-slate-800 pt-1.5 border-t border-emerald-200"><span>Total HPP</span><span>{rupiah(totalHpp)}</span></div>
                <div className="flex justify-between text-base font-bold text-emerald-700"><span>HPP / Unit</span><span data-testid="prod-hpp-unit">{rupiah(hppUnit)}</span></div>
              </div>
            )}
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="prod-submit" disabled={processMut.isPending} onClick={submit}>Proses Produksi</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="bg-white max-w-lg" data-testid="prod-detail">
          <DialogHeader><DialogTitle className="font-heading">{detail?.no_produksi}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400 text-xs">Produk</span><div className="font-medium">{detail.barang_jadi_nama}</div></div>
                <div><span className="text-slate-400 text-xs">Tanggal</span><div className="font-medium">{tanggal(detail.tanggal)}</div></div>
                <div><span className="text-slate-400 text-xs">Target / Hasil</span><div className="font-medium">{angka(detail.qty_target)} / {angka(detail.qty_hasil)} {detail.satuan}</div></div>
                <div><span className="text-slate-400 text-xs">Reject / Waste</span><div className="font-medium">{angka(detail.qty_reject)} / {angka(detail.qty_waste)}</div></div>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase">Bahan Terpakai</div>
                <table className="w-full">
                  <tbody>
                    {(detail.bahan_terpakai || []).map((b, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{b.item_nama}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{angka(b.qty)} {b.satuan}</td>
                        <td className="px-3 py-1.5 text-right">{rupiah(b.biaya)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-1">
                <div className="flex justify-between"><span className="text-slate-600">Biaya Bahan</span><span>{rupiah(detail.biaya_bahan)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Tenaga Kerja</span><span>{rupiah(detail.biaya_tk)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Overhead</span><span>{rupiah(detail.biaya_overhead)}</span></div>
                <div className="flex justify-between font-semibold pt-1 border-t border-emerald-200"><span>Total HPP</span><span>{rupiah(detail.total_hpp)}</span></div>
                <div className="flex justify-between font-bold text-emerald-700"><span>HPP / Unit</span><span>{rupiah(detail.hpp_per_unit)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
