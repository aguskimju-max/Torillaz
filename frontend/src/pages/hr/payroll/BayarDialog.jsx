import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rupiah } from "@/lib/format";

export function BayarDialog({ bayar, onOpenChange, rekening, setRekening, rekList, onSubmit, pending }) {
  return (
    <Dialog open={!!bayar} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-sm" data-testid="payroll-bayar-dialog">
        <DialogHeader><DialogTitle className="font-heading">Bayar Gaji · {bayar?.karyawan_nama}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-500">Gaji bersih: <b className="text-emerald-700">{rupiah(bayar?.gaji_bersih)}</b></p>
          <div>
            <Label className="mb-1.5 block">Bayar dari Rekening</Label>
            <Select value={rekening} onValueChange={setRekening}>
              <SelectTrigger data-testid="payroll-rekening" className="bg-white"><SelectValue placeholder="Pilih rekening..." /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="none">Tanpa catat kas</SelectItem>{(rekList?.rekening || []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nama} ({rupiah(r.saldo)})</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-1">Jika rekening dipilih, otomatis tercatat sebagai kas keluar (beban gaji) & kasbon dipotong.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="payroll-bayar-submit" disabled={pending} onClick={onSubmit}>Bayar Gaji</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
