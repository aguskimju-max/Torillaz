import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function exportExcel(filename, columns, rows) {
  const header = columns.map((c) => c.label);
  const data = (rows || []).map((r) => columns.map((c) => c.value(r)));
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = columns.map((c) => ({ wch: c.width || 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPDFTable(filename, title, columns, rows, opts = {}) {
  const doc = new jsPDF(opts.orientation === "landscape" ? { orientation: "landscape" } : {});
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(51, 65, 85);
  doc.text(title, 14, 16);
  let startY = 22;
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(opts.subtitle, 14, 21);
    startY = 26;
  }
  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: (rows || []).map((r) => columns.map((c) => c.value(r))),
    startY,
    theme: "striped",
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: opts.columnStyles || {},
    margin: { left: 14, right: 14 },
  });
  doc.save(`${filename}.pdf`);
}
