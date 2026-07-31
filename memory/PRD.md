# PRD — Sistem Manajemen Usaha Terpadu (ERP)

## Problem Statement (original)
Membangun Business Management System (ERP) satu pintu untuk manufaktur makanan, bertahap:
(1) Database & Login → (2) Master Data → (3) Gudang & Stok → (4) Pembelian → (5) Produksi & HPP →
(6) Penjualan → (7) Keuangan → (8) HR & Payroll → (9) Dashboard & Laporan → (10) Testing & Deploy.
Single source of truth: satu input transaksi memperbarui seluruh modul terkait otomatis.

## User Choices
- Scope awal: Fase 1-3 (Login + Master Data + Gudang & Stok)
- Auth: JWT custom (email+password) + RBAC
- Notifikasi: in-app (bell/alert)
- Bisnis: manufaktur/produksi makanan
- Desain: modern & profesional (bebas)

## Architecture
- Backend: FastAPI (modular routers) + MongoDB (motor). Files: server.py, db.py, security.py, rbac.py,
  auth_router.py, master_router.py, stock_router.py, dashboard_router.py, misc_router.py, settings_router.py, seed.py
- Frontend: React + React Router + TanStack Query + Tailwind + shadcn/ui + Recharts. Emerald/slate theme,
  fonts Work Sans (heading) + IBM Plex Sans (body) + JetBrains Mono.
- Auth: bcrypt + JWT (httpOnly cookies + Bearer fallback), brute-force lockout keyed by email, refresh token.
- RBAC: roles collection with permission matrix {module: [actions]}; require(module, action) dependency.
  Modules: dashboard, master, gudang, laporan, pengaturan, audit, (future: pembelian, produksi, penjualan, keuangan, hr).
  Actions: view, add, edit, delete, approve, print, export.

## Personas
- Super Admin / Owner: akses penuh, monitoring.
- Manager/Admin: operasional lintas modul.
- Warehouse/Purchasing/Finance/Sales/Produksi/HR: akses modul spesifik.

## Implemented (2026-07-31) — Phase 1-3
- **Auth & RBAC**: login/logout/me/refresh, 10 seeded roles + editable permission matrix, admin seeding
  (aguskimju@gmail.com), brute-force lockout, audit on login.
- **Master Data (generic engine)**: perusahaan, cabang, gudang, rak, kategori, satuan, merek, supplier,
  pelanggan, bahan_baku, barang_jadi, karyawan, jabatan, divisi, rekening, pajak, metode_pembayaran, biaya.
  Auto kode, soft delete, created/updated by, search + pagination, options endpoint for dropdowns.
- **Gudang & Stok (single source of truth)**: stock_balances keyed by (item_type, item_id, gudang, batch);
  movements ledger; penerimaan/pengeluaran/penyesuaian/transfer/opname; negative-stock prevention;
  weighted-average price; kartu stok (running saldo); stok list with status badges; batch/lot + expired.
- **Dashboard**: KPI cards (nilai persediaan BB/BJ, counts, low stock, expiring, transaksi hari ini),
  chart pergerakan stok 7 hari, top nilai persediaan, perlu restock, transaksi terbaru; auto-refresh.
- **Notifikasi in-app**: bell dengan alert stok minimum, stok negatif, expired/mendekati expired.
- **Pengaturan**: Users CRUD, Roles & permission matrix editor, Backup (JSON export).
- **Audit Trail**: log create/update/delete/login dengan filter.
- Sample data manufaktur makanan + saldo stok awal ter-seed otomatis.
- Tested: 23/23 backend pytest PASSED; frontend flows PASSED.

## Implemented (2026-07-31) — Phase 5 (Produksi & HPP) + Phase 6 (Penjualan)
- **Produksi & HPP**: Resep/BOM CRUD (BomPage), halaman Produksi & HPP (ProductionPage):
  pilih resep → preview kebutuhan bahan (FEFO, cek cukup/tidak) + hitung HPP otomatis
  (biaya bahan + tenaga kerja + overhead) → proses produksi (konsumsi stok BB, tambah stok BJ,
  update harga_pokok BJ). Detail order menampilkan bahan terpakai + rincian HPP/unit.
- **Penjualan (single source of truth)**: SalesPage — buat Sales Order (draft) → Kirim
  (potong stok BJ + terbitkan Surat Jalan + Invoice; tunai otomatis lunas, kredit → piutang)
  → Terima Pembayaran (sebagian/lunas). Filter tab status, hitung subtotal/pajak/total live,
  harga jual auto-fill.
- **Piutang** (PiutangPage): KPI total piutang & jumlah jatuh tempo, daftar tagihan belum lunas
  dengan badge overdue/sebagian, aksi bayar langsung.
- **Cetak dokumen PDF** (lib/pdf.js via jspdf + jspdf-autotable): Invoice, Nota, Surat Jalan
  dengan header perusahaan, tabel item, ringkasan total & status pembayaran → download PDF.
- Rute terdaftar di App.js: /produksi/bom, /produksi/order, /penjualan, /penjualan/piutang.
- Tested: frontend flows 100% PASSED (iteration_2.json), no bugs.

## Implemented (2026-07-31) — Phase 7 (Keuangan Sederhana) + Export Laporan
- **Keuangan (finance_router.py)**: Kas & Bank ledger (finance_transactions), saldo rekening
  otomatis (saldo_awal + masuk - keluar). Endpoints: /finance/summary, /finance/rekening,
  /finance/transactions (list/create/delete manual), /finance/laba-rugi.
- **Kas & Bank page** (KasBankPage): KPI total saldo + pemasukan/pengeluaran bulan ini, kartu
  saldo per rekening, catat Kas Masuk/Kas Keluar (kategori biaya operasional dari master),
  filter tab & rekening, hapus transaksi manual (transaksi otomatis tidak bisa dihapus).
- **Laba/Rugi page** (LabaRugiPage): laporan otomatis Pendapatan (penjualan) - HPP = Laba Kotor,
  dikurangi Beban Operasional (per kategori dari kas keluar) = Laba Bersih. Filter rentang tanggal,
  Export PDF (labaRugiPDF).
- **SSOT**: pembayaran penjualan (kirim tunai / bayar) dengan rekening otomatis membuat kas masuk
  kategori "Penjualan" (ref_type=penjualan, is_beban=false).
- **Export Excel/PDF** (lib/export.js xlsx + jspdf-autotable, komponen ExportButtons): tombol Export
  pada daftar Penjualan, Produksi, dan Kartu Stok (dropdown Excel/PDF, fetch semua data terfilter).
- Rute: /keuangan/kas-bank, /keuangan/laba-rugi. RBAC modul "keuangan".
- Tested: iteration_3.json 100% PASSED (backend curl + frontend). 1 bug diperbaiki (import
  ExportButtons di KartuStokPage).

## Backlog (prioritized)
### P0 (next phases per user roadmap)
- Fase 4 Pembelian: PR → PO → Penerimaan → Invoice supplier → Pembayaran, hutang, retur.
### P1
- Fase 7 Keuangan (LANJUTAN): arus kas (cash flow), piutang/hutang aging, transfer antar rekening.
- Fase 9 Laporan & KPI lengkap: export Excel/PDF, drill-down, filter multi-dimensi.
### P2
- Barcode/QR scan kamera, import Excel, multi-level approval, forecasting stok/penjualan, notifikasi email/WA, restore backup, DB transactions untuk ledger.

## Implemented (2026-07-31) — Phase 8 (HR & Payroll) + Phase 9 (Dashboard & Laporan)
- **HR backend (hr_router.py)**: absensi harian (upsert per karyawan+tanggal), kasbon (ajukan/bayar/potong
  otomatis saat payroll), payroll generate otomatis (gaji pokok + tunjangan + lembur − alpha − BPJS% − pajak% −
  kasbon), bayar payroll → kas keluar "Gaji Karyawan" (beban) + kasbon lunas, /hr/summary.
- **HR frontend**: AbsensiPage (grid harian), KasbonPage, PayrollPage (generate + detail + slip PDF + bayar).
- **Slip Gaji PDF** (slipGajiPDF) berlogo.
- **Dashboard Fase 9**: KPI penjualan/keuangan (omzet hari/bulan, laba kotor, piutang, total produksi),
  grafik Tren Omzet 7 hari (LineChart), daftar Produk Terlaris.
- **Halaman Laporan** (/laporan): tab Penjualan, Laba/Rugi, Persediaan, Produksi, Payroll — filter tanggal +
  Export Excel/PDF (ExportButtons) di tiap tab.
- Nav group baru: HR & Payroll (Data Karyawan/Absensi/Kasbon/Penggajian) + Laporan. Modul RBAC hr & laporan.
- Tested: backend curl end-to-end PASS; frontend iteration_4.json 100% PASS, no bugs.

## Deployment (2026-07-31)
- Menambah endpoint `GET /health` (level app, tanpa prefix /api) di server.py untuk probe
  liveness/readiness Kubernetes — root cause deploy gagal (probe 404).
- Optimasi dashboard_router.py: hilangkan N+1 (batch-load master items ke dict), ganti query
  per-hari (movement & sales chart) jadi single ranged query + bucketing memori, tambah projection
  pada recent movements. Penting untuk MongoDB Atlas (tiap query = round-trip jaringan).
- Deployment checks: compilation/env/CORS/mongo semua OK.

## Next Tasks
- Mulai Fase 4 (Pembelian) yang terhubung ke stok penerimaan & hutang supplier.
- Lanjut Fase 7 (Keuangan sederhana).
