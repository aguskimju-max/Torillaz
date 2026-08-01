import React from "react";
import { ShoppingCart, TrendingUp, Boxes } from "lucide-react";
import KpiCard from "@/components/common/KpiCard";
import { Button } from "@/components/ui/button";
import { rupiah, tanggal } from "@/lib/format";
import { labaRugiPDF } from "@/lib/pdf";
import { RangeBar } from "./RangeBar";

export function LabaRugiReport({ range, setRange, lr, company }) {
  return (
    <>
      <RangeBar range={range} setRange={setRange}>
        <Button variant="outline" data-testid="rep-lr-pdf" disabled={!lr} onClick={() => labaRugiPDF(lr, company, `${tanggal(range.start)} — ${tanggal(range.end)}`)}>Export PDF</Button>
      </RangeBar>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard testId="rep-lr-pendapatan" icon={TrendingUp} accent="emerald" label="Pendapatan" value={rupiah(lr?.pendapatan)} />
        <KpiCard testId="rep-lr-hpp" icon={Boxes} accent="amber" label="HPP" value={rupiah(lr?.hpp)} />
        <KpiCard testId="rep-lr-beban" icon={ShoppingCart} accent="rose" label="Total Beban" value={rupiah(lr?.total_beban)} />
        <KpiCard testId="rep-lr-bersih" icon={TrendingUp} accent="emerald" label="Laba Bersih" value={rupiah(lr?.laba_bersih)} />
      </div>
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-xl">
        <div className="flex justify-between py-1 text-slate-600"><span>Pendapatan</span><span>{rupiah(lr?.pendapatan)}</span></div>
        <div className="flex justify-between py-1 text-slate-600"><span>HPP</span><span>({rupiah(lr?.hpp)})</span></div>
        <div className="flex justify-between py-1 font-semibold border-t border-slate-200 mt-1"><span>Laba Kotor</span><span className="text-emerald-700">{rupiah(lr?.laba_kotor)}</span></div>
        {(lr?.beban || []).map((b, i) => <div key={i} className="flex justify-between py-1 text-slate-600 pl-3"><span>{b.kategori}</span><span>({rupiah(b.jumlah)})</span></div>)}
        <div className="flex justify-between py-1 font-semibold border-t border-slate-200 mt-1"><span>Total Beban</span><span className="text-rose-600">({rupiah(lr?.total_beban)})</span></div>
        <div className="flex justify-between py-2 border-t-2 border-emerald-600 mt-2 font-bold"><span>Laba Bersih</span><span className="text-emerald-700">{rupiah(lr?.laba_bersih)}</span></div>
      </div>
    </>
  );
}
