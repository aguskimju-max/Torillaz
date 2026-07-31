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

## Backlog (prioritized)
### P0 (next phases per user roadmap)
- Fase 4 Pembelian: PR → PO → Penerimaan → Invoice supplier → Pembayaran, hutang, retur.
- Fase 5 Produksi & HPP: BOM/resep, rencana & perintah produksi, konsumsi bahan → hasil produksi, HPP.
- Fase 6 Penjualan: Sales Order → Surat Jalan → Invoice → Pembayaran, piutang, retur, cetak nota/invoice.
### P1
- Fase 7 Keuangan: kas/bank masuk-keluar, arus kas, laba rugi, piutang/hutang aging.
- Fase 8 HR & Payroll: absensi, lembur, kasbon, payroll otomatis, slip gaji.
- Fase 9 Laporan & KPI lengkap: export Excel/PDF, drill-down, filter multi-dimensi.
### P2
- Barcode/QR scan kamera, import Excel, multi-level approval, forecasting stok/penjualan, notifikasi email/WA, restore backup, DB transactions untuk ledger.

## Next Tasks
- Mulai Fase 4 (Pembelian) yang terhubung ke stok penerimaan & hutang.
