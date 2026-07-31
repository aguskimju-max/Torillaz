import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Wallet, Receipt, FileText } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rupiah, tanggal } from "@/lib/format";
import { labaRugiPDF } from "@/lib/pdf";

const firstOfMonth = () => new Date().toISOString().slice(0, 8) + "01";
const today = () => new Date().toISOString().slice(0, 10);

export default function LabaRugiPage() {
  const [range, setRange] = useState({ start: firstOfMonth(), end: today() });
  const [applied, setApplied] = useState({ start: firstOfMonth(), end: today() });

  const { data, isLoading } = useQuery({
    queryKey: ["laba-rugi", applied.start, applied.end],
    queryFn: async () => (await api.get("/finance/laba-rugi", { params: applied })).data,
  });
  const { data: perusahaan } = useQuery({ queryKey: ["perusahaan-list"], queryFn: async () => (await api.get("/master/perusahaan", { params: { limit: 1 } })).data });
  const company = perusahaan?.items?.[0];

  const r = data || {};
  const periodLabel = `${tanggal(applied.start)} — ${tanggal(applied.end)}`;

  const Row = ({ label, value, indent, bold, negative, tone }) => (
    <div className={`flex items-center justify-between py-2 ${indent ? "pl-4" : ""} ${bold ? "font-semibold text-slate-800" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className={tone === "emerald" ? "text-emerald-700 font-semibold" : tone === "rose" ? "text-rose-600" : ""}>{negative ? `(${rupiah(value)})` : rupiah(value)}</span>
    </div>
  );

  return (
    <div>
      <PageHeader title="Laporan Laba / Rugi" subtitle="Dihitung otomatis dari penjualan, HPP, dan beban operasional">
        <Button variant="outline" data-testid="lr-export-pdf" disabled={!data} onClick={() => labaRugiPDF(r, company, periodLabel)}>
          <FileText className="h-4 w-4 mr-1.5 text-rose-600" /> Export PDF
        </Button>
      </PageHeader>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-5 flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <Label className="mb-1.5 block">Dari Tanggal</Label>
          <Input data-testid="lr-start" type="date" value={range.start} onChange={(e) => setRange((p) => ({ ...p, start: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-1.5 block">Sampai Tanggal</Label>
          <Input data-testid="lr-end" type="date" value={range.end} onChange={(e) => setRange((p) => ({ ...p, end: e.target.value }))} />
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="lr-apply" onClick={() => setApplied(range)}>Terapkan</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testId="lr-pendapatan" icon={TrendingUp} accent="emerald" label="Pendapatan" value={rupiah(r.pendapatan)} />
        <KpiCard testId="lr-laba-kotor" icon={Wallet} accent="sky" label="Laba Kotor" value={rupiah(r.laba_kotor)} sub={`HPP ${rupiah(r.hpp)}`} />
        <KpiCard testId="lr-beban" icon={Receipt} accent="amber" label="Total Beban" value={rupiah(r.total_beban)} />
        <KpiCard testId="lr-laba-bersih" icon={TrendingDown} accent={(r.laba_bersih || 0) >= 0 ? "emerald" : "rose"} label="Laba Bersih" value={rupiah(r.laba_bersih)} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl" data-testid="lr-statement">
        <h3 className="font-heading font-semibold text-slate-800 mb-1">Laporan Laba Rugi</h3>
        <p className="text-xs text-slate-400 mb-4">Periode {periodLabel}</p>

        <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mt-2">Pendapatan</div>
        <Row label="Penjualan" value={r.pendapatan} indent />
        <Row label="Harga Pokok Penjualan (HPP)" value={r.hpp} indent negative />
        <div className="border-t border-slate-200 my-1" />
        <Row label="Laba Kotor" value={r.laba_kotor} bold tone="emerald" />

        <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mt-4">Beban Operasional</div>
        {(r.beban || []).length === 0 && <div className="pl-4 py-2 text-slate-400 text-sm">Tidak ada beban pada periode ini</div>}
        {(r.beban || []).map((b, i) => <Row key={i} label={b.kategori} value={b.jumlah} indent negative />)}
        <div className="border-t border-slate-200 my-1" />
        <Row label="Total Beban" value={r.total_beban} bold negative tone="rose" />

        <div className="border-t-2 border-emerald-600 mt-3 pt-3 flex items-center justify-between">
          <span className="font-heading text-lg font-bold text-slate-900">Laba Bersih</span>
          <span data-testid="lr-net" className={`font-heading text-lg font-bold ${(r.laba_bersih || 0) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{rupiah(r.laba_bersih)}</span>
        </div>
        {isLoading && <p className="text-sm text-slate-400 mt-3">Memuat...</p>}
      </div>
    </div>
  );
}
