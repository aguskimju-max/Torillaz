import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { rupiah, angka, tanggal } from "@/lib/format";

const EMERALD = [5, 150, 105];
const SLATE = [51, 65, 85];
const GREY = [120, 120, 120];

const LOGO_URL = "/tortillaz-logo.png";
let _logoCache;
async function loadLogo() {
  if (_logoCache !== undefined) return _logoCache;
  try {
    const resp = await fetch(LOGO_URL);
    const blob = await resp.blob();
    _logoCache = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onloadend = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch (e) { _logoCache = null; }
  return _logoCache;
}

function drawHeader(doc, company, title, docNo, logoData) {
  const c = company || {};
  let tx = 14;
  if (logoData) {
    try { doc.addImage(logoData, "PNG", 14, 8, 34, 24); tx = 52; } catch (e) {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...SLATE);
  doc.text(c.nama || "Torillaz Tortilla", tx, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  let y = 20.5;
  if (c.alamat) { doc.text(String(c.alamat), tx, y); y += 4; }
  const line2 = [c.telepon && `Telp: ${c.telepon}`, c.email].filter(Boolean).join("   ");
  if (line2) { doc.text(line2, tx, y); y += 4; }
  if (c.npwp) { doc.text(`NPWP: ${c.npwp}`, tx, y); y += 4; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...EMERALD);
  doc.text(title, 196, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  if (docNo) doc.text(docNo, 196, 22, { align: "right" });

  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.8);
  doc.line(14, 34, 196, 34);
  return 40;
}

function infoBlock(doc, y, so, customer, extraRight = []) {
  const cust = customer || {};
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text("Kepada:", 14, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.text(so.pelanggan_nama || "-", 14, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  let ly = y + 10.5;
  if (cust.alamat) { doc.text(String(cust.alamat), 14, ly); ly += 4; }
  if (cust.telepon) { doc.text(`Telp: ${cust.telepon}`, 14, ly); ly += 4; }

  const rightRows = [
    ["Tanggal", tanggal(so.tanggal)],
    ...extraRight,
  ];
  let ry = y;
  rightRows.forEach(([k, v]) => {
    doc.setTextColor(...GREY);
    doc.text(`${k}`, 150, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE);
    doc.text(String(v), 196, ry, { align: "right" });
    doc.setFont("helvetica", "normal");
    ry += 5;
  });
  return Math.max(ly, ry) + 4;
}

function totalsBlock(doc, startY, so) {
  const rows = [["Subtotal", rupiah(so.subtotal)]];
  if (so.pajak_nominal) rows.push([`Pajak ${so.pajak_nama || ""} (${angka(so.pajak_persen)}%)`, rupiah(so.pajak_nominal)]);
  let y = startY + 6;
  doc.setFontSize(9);
  rows.forEach(([k, v]) => {
    doc.setTextColor(...GREY);
    doc.text(k, 140, y);
    doc.setTextColor(...SLATE);
    doc.text(v, 196, y, { align: "right" });
    y += 5.5;
  });
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.4);
  doc.line(138, y - 2, 196, y - 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...EMERALD);
  doc.text("TOTAL", 140, y + 3);
  doc.text(rupiah(so.total), 196, y + 3, { align: "right" });
  doc.setFont("helvetica", "normal");
  return y + 8;
}

function paymentInfo(doc, y, so) {
  const status = (so.status || "").toUpperCase();
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`Status: `, 14, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(status === "LUNAS" ? EMERALD[0] : 200, status === "LUNAS" ? EMERALD[1] : 120, status === "LUNAS" ? EMERALD[2] : 0);
  doc.text(status, 28, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GREY);
  doc.text(`Terbayar: ${rupiah(so.terbayar)}    Sisa: ${rupiah(so.sisa)}`, 14, y + 5);
}

function itemsTable(doc, startY, so, withPrice) {
  const head = withPrice
    ? [["#", "Produk", "Qty", "Satuan", "Harga", "Diskon", "Subtotal"]]
    : [["#", "Kode", "Produk", "Qty", "Satuan"]];
  const body = (so.items || []).map((it, i) =>
    withPrice
      ? [i + 1, it.item_nama, angka(it.qty), it.satuan || "", rupiah(it.harga), rupiah(it.diskon || 0), rupiah(it.subtotal)]
      : [i + 1, it.kode || "", it.item_nama, angka(it.qty), it.satuan || ""]
  );
  autoTable(doc, {
    head, body, startY,
    theme: "grid",
    headStyles: { fillColor: EMERALD, fontSize: 8.5, halign: "center", textColor: 255 },
    bodyStyles: { fontSize: 8.5, textColor: SLATE },
    columnStyles: withPrice
      ? { 0: { halign: "center", cellWidth: 8 }, 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } }
      : { 0: { halign: "center", cellWidth: 8 }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  return doc.lastAutoTable.finalY;
}

function footerNote(doc, text) {
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(text, 105, 288, { align: "center" });
}

export async function invoicePDF(so, company, customer) {
  const doc = new jsPDF();
  const logo = await loadLogo();
  let y = drawHeader(doc, company, "INVOICE", so.no_invoice || so.no_so, logo);
  y = infoBlock(doc, y, so, customer, [
    ["No. Invoice", so.no_invoice || "-"],
    ["Jatuh Tempo", so.tipe === "kredit" ? tanggal(so.jatuh_tempo) : "Tunai"],
  ]);
  const tableEnd = itemsTable(doc, y, so, true);
  const afterTotals = totalsBlock(doc, tableEnd, so);
  paymentInfo(doc, afterTotals + 2, so);
  footerNote(doc, "Terima kasih atas kepercayaan Anda. Dokumen ini sah tanpa tanda tangan basah.");
  doc.save(`Invoice-${so.no_invoice || so.no_so}.pdf`);
}

export async function notaPDF(so, company, customer) {
  const doc = new jsPDF();
  const logo = await loadLogo();
  let y = drawHeader(doc, company, "NOTA", so.no_so, logo);
  y = infoBlock(doc, y, so, customer, [["No. SO", so.no_so], ["No. Invoice", so.no_invoice || "-"]]);
  const tableEnd = itemsTable(doc, y, so, true);
  const afterTotals = totalsBlock(doc, tableEnd, so);
  paymentInfo(doc, afterTotals + 2, so);
  footerNote(doc, "Barang yang sudah dibeli tidak dapat ditukar/dikembalikan tanpa persetujuan.");
  doc.save(`Nota-${so.no_so}.pdf`);
}

export async function suratJalanPDF(so, company, customer) {
  const doc = new jsPDF();
  const logo = await loadLogo();
  let y = drawHeader(doc, company, "SURAT JALAN", so.no_surat_jalan || so.no_so, logo);
  y = infoBlock(doc, y, so, customer, [
    ["No. Surat Jalan", so.no_surat_jalan || "-"],
    ["No. SO", so.no_so],
  ]);
  const tableEnd = itemsTable(doc, y, so, false);
  const sy = tableEnd + 20;
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text("Hormat Kami,", 30, sy, { align: "center" });
  doc.text("Penerima,", 165, sy, { align: "center" });
  doc.setDrawColor(180);
  doc.line(14, sy + 22, 60, sy + 22);
  doc.line(140, sy + 22, 196, sy + 22);
  doc.text("( ______________ )", 37, sy + 27, { align: "center" });
  doc.text("( ______________ )", 168, sy + 27, { align: "center" });
  footerNote(doc, "Mohon periksa barang sebelum menandatangani surat jalan ini.");
  doc.save(`SuratJalan-${so.no_surat_jalan || so.no_so}.pdf`);
}

export async function labaRugiPDF(report, company, periodLabel) {
  const doc = new jsPDF();
  const logo = await loadLogo();
  const y = drawHeader(doc, company, "LABA / RUGI", periodLabel, logo);
  const body = [];
  body.push([{ content: "PENDAPATAN", styles: { fontStyle: "bold", textColor: GREY } }, ""]);
  body.push(["   Penjualan", rupiah(report.pendapatan)]);
  body.push(["   Harga Pokok Penjualan (HPP)", `(${rupiah(report.hpp)})`]);
  body.push([{ content: "Laba Kotor", styles: { fontStyle: "bold" } }, { content: rupiah(report.laba_kotor), styles: { fontStyle: "bold" } }]);
  body.push([{ content: "BEBAN OPERASIONAL", styles: { fontStyle: "bold", textColor: GREY } }, ""]);
  if ((report.beban || []).length === 0) body.push(["   (tidak ada beban)", rupiah(0)]);
  (report.beban || []).forEach((b) => body.push([`   ${b.kategori}`, `(${rupiah(b.jumlah)})`]));
  body.push([{ content: "Total Beban", styles: { fontStyle: "bold" } }, { content: `(${rupiah(report.total_beban)})`, styles: { fontStyle: "bold" } }]);
  autoTable(doc, {
    startY: y, body, theme: "plain",
    styles: { fontSize: 10, textColor: SLATE, cellPadding: 1.8 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  let fy = doc.lastAutoTable.finalY + 4;
  doc.setDrawColor(...EMERALD);
  doc.setLineWidth(0.6);
  doc.line(14, fy, 196, fy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...EMERALD);
  doc.text("LABA BERSIH", 14, fy + 8);
  doc.text(rupiah(report.laba_bersih), 196, fy + 8, { align: "right" });
  doc.save(`LabaRugi-${report.start}_${report.end}.pdf`);
}
