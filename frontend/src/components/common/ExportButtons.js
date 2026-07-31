import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportExcel, exportPDFTable } from "@/lib/export";

export default function ExportButtons({ filename, title, subtitle, columns, rows, orientation, disabled, testId = "export" }) {
  const [busy, setBusy] = useState(false);
  const columnStyles = {};
  columns.forEach((c, i) => { if (c.align === "right") columnStyles[i] = { halign: "right" }; });

  const run = async (kind) => {
    try {
      setBusy(true);
      const data = typeof rows === "function" ? await rows() : rows;
      if (!data || data.length === 0) { toast.error("Tidak ada data untuk diekspor"); return; }
      if (kind === "excel") exportExcel(filename, columns, data);
      else exportPDFTable(filename, title || filename, columns, data, { subtitle, orientation, columnStyles });
      toast.success(`Export ${kind === "excel" ? "Excel" : "PDF"} berhasil`);
    } catch (e) {
      toast.error("Gagal mengekspor data");
    } finally { setBusy(false); }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || busy} data-testid={`${testId}-btn`}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />} Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white">
        <DropdownMenuItem data-testid={`${testId}-excel`} onClick={() => run("excel")}><FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Export Excel</DropdownMenuItem>
        <DropdownMenuItem data-testid={`${testId}-pdf`} onClick={() => run("pdf")}><FileText className="h-4 w-4 mr-2 text-rose-600" /> Export PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
