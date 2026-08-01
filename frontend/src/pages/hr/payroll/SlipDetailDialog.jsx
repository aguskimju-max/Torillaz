import React from "react";
import { FileText, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rupiah, angka } from "@/lib/format";
import { slipGajiPDF } from "@/lib/pdf";

const Line = ({ label, value, minus, bold, tone }) => (
  <div className={`flex justify-between py-1 ${bold ? "font-semibold text-slate-800" : "text-slate-600"}`}>
    <span>{label}</span><span className={tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-700 font-semibold" : ""}>{minus ? `(${rupiah(value)})` : rupiah(value)}</span>
  </div>
);

export function SlipDetailDialog({ detail, onOpenChange, company, hasPerm, onBayar }) {
  return (
    <Dialog open={!!detail} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md" data-testid="payroll-detail">
        <DialogHeader><DialogTitle className="font-heading">Slip Gaji · {detail?.karyawan_nama}</DialogTitle></DialogHeader>
        {detail && (
          <div className="text-sm">
            <div className="flex justify-between text-xs text-slate-400 mb-2"><span>{detail.no}</span><span>Periode {detail.periode}</span></div>
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mt-2">Pendapatan</div>
            <Line label={`Gaji Pokok (${detail.hari_hadir} hr × ${rupiah(detail.gaji_harian != null ? detail.gaji_harian : (detail.hari_kerja ? detail.gaji_pokok / detail.hari_kerja : 0))})`} value={detail.gaji_diperoleh != null ? detail.gaji_diperoleh : detail.gaji_pokok} />
            <Line label="Tunjangan" value={detail.tunjangan} />
            <Line label={`Lembur (${angka(detail.jam_lembur)} jam)`} value={detail.upah_lembur} />
            <div className="border-t border-slate-200 my-1" />
            <Line label="Total Pendapatan" value={detail.gross} bold />
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mt-3">Potongan</div>
            <Line label={`BPJS (${angka(detail.bpjs_persen)}%)`} value={detail.bpjs} minus tone="rose" />
            <Line label={`Pajak (${angka(detail.pajak_persen)}%)`} value={detail.pajak} minus tone="rose" />
            <Line label="Potongan Kasbon" value={detail.kasbon_potong} minus tone="rose" />
            <div className="border-t border-slate-200 my-1" />
            <Line label="Total Potongan" value={detail.total_potongan} bold tone="rose" />
            <div className="border-t-2 border-emerald-600 mt-2 pt-2"><Line label="GAJI BERSIH" value={detail.gaji_bersih} bold tone="emerald" /></div>
            <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" data-testid="payroll-slip-pdf" onClick={() => slipGajiPDF(detail, company)}><FileText className="h-4 w-4 mr-1.5 text-rose-600" /> Download Slip</Button>
              {detail.status !== "dibayar" && hasPerm("hr", "approve") && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onBayar(detail)}><HandCoins className="h-4 w-4 mr-1.5" /> Bayar</Button>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
