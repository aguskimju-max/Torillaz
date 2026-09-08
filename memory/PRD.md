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
  Kolom Harga di Invoice & Nota menampilkan label harga per item (mis. "(Grosir)") di bawah nominal;
  item tanpa harga_label (order lama) hanya tampil harga (backward compatible).
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
  Rumus gaji (update 2026-07-31): gaji_harian = gaji_pokok ÷ hari_kerja; gaji_diperoleh = gaji_harian × hari_hadir
  (bayar per kehadiran, tanpa potongan alpha). Gross = gaji_diperoleh + tunjangan + lembur; potongan = BPJS + pajak + kasbon.
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

## Implemented (2026-08-01) — Reset Data Dummy + Rekap Absensi
- **Reset / Hapus Data Dummy** (/pengaturan/reset, settings_router.py): endpoint GET /api/reset/summary
  (hitung data per modul) & POST /api/reset (hapus per-modul atau "all"). Konfirmasi ketik "HAPUS".
  Akun & role TIDAK ikut terhapus. Counter di-reset hanya pada full wipe. Master gudang/rak/metode
  sengaja TIDAK ikut dihapus (keputusan user) — dianggap setup tetap.
- **Bugfix**: target reset "produksi" sebelumnya menyasar koleksi `boms` (tidak ada); diperbaiki ke
  `master_bom` agar BOM/Resep benar-benar terhapus. Terverifikasi (produksi count = 3).
- **Rekap Absensi Bulanan** di PayrollPage: tabel rekap (Hadir/Izin/Sakit/Alpha/Libur/Lembur) per karyawan
  dari GET /api/hr/attendance/recap, tampil sebelum tabel payroll agar bisa dicek sebelum generate.
- Tested: backend curl (summary + recap + reset POST non-destruktif) PASS; screenshot kedua halaman render OK.

## Implemented (2026-08-01) — Menu Rekap Absensi
- Menu baru **Rekap Absensi** (/hr/rekap-absensi) di grup HR & Payroll (setelah Absensi).
- Backend: `GET /api/hr/attendance/monthly?periode=YYYY-MM` → matriks harian per karyawan
  (status per tanggal + jam lembur) + ringkasan (hadir/izin/sakit/alpha/libur/lembur/tercatat) + jumlah hari.
- Frontend (RekapAbsensiPage.js): pilih periode (bulan), tabel Ringkasan (dengan baris TOTAL),
  legenda H/I/S/A/L, matriks Detail Harian (kolom tgl 1..N, sel berwarna sesuai status, titik indigo
  bila ada lembur), Export Excel/PDF (ExportButtons).
- Tested: backend curl (matriks + ringkasan) PASS; screenshot halaman render OK sesuai data absensi.

## Code Review Fixes (2026-08-01)
- SalesPage.js: item baris form penjualan kini pakai key stabil (`_rid`) via helper newRow(), bukan index array — cegah potensi data ketukar saat hapus/tambah baris.
- Hapus console.error sisa di lib/pdf.js (fallback logo) & context/AuthContext.js (logout) untuk production readiness.
- CATATAN false-positive (tidak diubah, memang sudah benar): `is None`/`is not None` di db.py/stock_router/production_router (idiom Python benar); deps hook di AuthContext/RolesPage/ProductionPage/SalesPage (setter useState & konstanta modul memang stabil; deps debounce sengaja dibatasi); key index pada tabel READ-ONLY (preview/detail) aman; `mv`/`days_in_month` selalu ter-assign sebelum dipakai.
- SENGAJA DILEWATI (risiko regresi pada logic bisnis yang sudah teruji, sesuai arahan): refactor kompleksitas dashboard()/process()/generate_payroll() & split komponen LaporanPage/PayrollPage/Dashboard.

## Refactor Komponen (2026-08-01) — behavior-preserving
- Dashboard dipecah → `pages/dashboard/{DashboardKpis, SalesTrendChart, MovementChart, RankedList, StockLists}.jsx`. Dashboard.js kini orchestrator tipis.
- Laporan dipecah per-tab → `pages/laporan/{RangeBar, PenjualanReport, LabaRugiReport, PersediaanReport, ProduksiReport, PayrollReport}.jsx`; kolom tabel/ekspor jadi konstanta modul (hindari re-render). LaporanPage.js menyimpan state+query, render komponen tab.
- Payroll dipecah → `pages/hr/payroll/{PayrollKpis, PayrollRecap, SlipDetailDialog, BayarDialog, DeleteSlipDialog}.jsx`. PayrollPage.js menyimpan state+mutasi+kolom.
- Semua data-testid & perilaku dipertahankan persis. Backend tidak diubah.
- Tested: testing_agent frontend regression 100% PASS (iteration_5.json) — semua halaman render, tab switch, dialog, export tanpa error.

## Fix 401 Console (2026-08-01)
- Root cause: frontend memprobe sesi via `GET /api/auth/me` saat load/logout; ketika belum login endpoint balas 401 → browser mencatat 401 di console (bukan dari polling notifikasi seperti dugaan awal).
- Fix: tambah endpoint non-error `GET /api/auth/session` (Depends optional_current_user) yang balas 200 `{authenticated, user}`; AuthContext.fetchMe kini pakai `/auth/session`. Route bisnis terproteksi TETAP 401 (keamanan utuh). `/auth/me` dibiarkan.
- Tested: curl (unauth 200 authenticated:false, auth 200 + user), screenshot reproduksi login→logout = 0 error 4xx di console. Login/logout tetap normal.

## Penyederhanaan Gudang & Stok (2026-08-04)
- Tujuan user: pemakaian lebih sederhana karena menu Gudang & Stok terlalu ribet. Dashboard tetap, modul lain tetap ada.
- Menu "Gudang & Stok" disederhanakan → **Input Stok**, **Stok Saat Ini**, **Riwayat Stok**. Operasi lanjutan (Penerimaan, Pengeluaran, Penyesuaian, Transfer, Opname) dipindah ke grup terpisah **"Stok Lanjutan"** (tidak dihapus, route tetap).
- Halaman baru **Input Stok** (`/stok/input`, StokInputPage.js): form ringkas Produk + Gudang + Tanggal Produksi + Kadaluarsa (opsional) + Jumlah. Tombol **"Produk Baru"** untuk menambah barang jadi langsung (nama, satuan, harga jual, harga pokok). Tabel stok produk terkini di sampingnya.
- Backend: endpoint baru `POST /api/stock/simple-in` (barang jadi; batch = tanggal produksi tiap lot; harga otomatis dari harga_pokok produk). `apply_delta()` & `record_movement()` kini menyimpan `tanggal_produksi`; `list_balances` mengembalikan `tanggal_produksi`.
- Penjualan tetap seperti sekarang & tetap mengurangi stok otomatis (FEFO saat KIRIM) — regresi terverifikasi (stok 45→43).
- Bug Radix Select (nilai ke-reset "" untuk item yang baru dibuat karena belum ter-register) diperbaiki: label trigger dirender dari state (`selected`) + `onValueChange` mengabaikan reset kosong. Terverifikasi: buat produk inline → langsung terpilih → input stok sukses → muncul di tabel.

## Pelanggan: Nama Toko/Stand + Koordinat GPS (2026-08-21)
- Form pelanggan (master) kini punya field **Nama Toko / Stand** dan **Koordinat Lokasi (GPS)**.
- Field GPS baru (type `geo` di CrudDrawer): tombol **"Ambil Lokasi Sekarang"** memakai Geolocation API HP (butuh izin + HTTPS) untuk isi latitude/longitude otomatis; bisa juga input manual; ada tautan **"Buka Arah (Google Maps)"** (mode directions `maps/dir/?api=1&destination=lat,lng`).
- Tabel daftar pelanggan menampilkan kolom Toko/Stand + kolom **Lokasi** berisi link **"Arah"** ke Google Maps directions.
- Backend tidak berubah (master generic menyimpan field `nama_toko`, `latitude`, `longitude` via clean_payload). Terverifikasi: create pelanggan menyimpan toko + koordinat; form & list render + link maps benar.

## Peta Semua Pelanggan (2026-08-21)
- Menu baru **Peta Pelanggan** (`/peta-pelanggan`, di grup Master Data setelah Pelanggan).
- Peta interaktif memakai **Leaflet + OpenStreetMap** (tanpa API key/biaya). Setiap pelanggan berkoordinat tampil sebagai pin; auto fit-bounds ke semua pin.
- Klik pin → popup berisi nama toko, nama pelanggan, telepon, alamat, dan tautan **"Buka Arah"** (Google Maps directions). Sidebar "Daftar Toko" berisi semua pelanggan + link "Arah". Indikator "N dari M pelanggan berkoordinat".
- Dependency baru: `leaflet@1.9.4`, `react-leaflet@5.0.0` (React 19 compatible). Ikon marker di-load dari CDN cloudflare (hindari isu bundler PNG).
- Data uji: 3 pelanggan diberi koordinat (Jakarta x2, Surabaya). Terverifikasi: 3 pin render, popup + directions link benar.

## Sederhanakan Keluar-Masuk Barang (2026-08-21)
- **Stok masuk** hanya lewat menu **Produksi** (halaman Input Stok di-rename → judul "Produksi", "Form Produksi", tombol "Simpan Produksi", toast "Produksi tercatat, stok bertambah"). Route tetap `/stok/input`.
- **Stok keluar** otomatis dari **Penjualan** (FEFO saat kirim — sudah ada, tidak diubah).
- Menu **Gudang & Stok** kini hanya: Produksi · Stok Saat Ini · Riwayat Stok.
- DISEMBUNYIKAN dari sidebar (route & data tetap, reversible): grup **Stok Lanjutan** (Penerimaan, Pengeluaran, Penyesuaian, Transfer, Opname) dan modul lama **Produksi (Resep/BOM + Produksi & HPP)**.
- Terverifikasi (screenshot + console): sidebar tidak lagi menampilkan Stok Lanjutan / Resep-BOM / Produksi & HPP; menampilkan Produksi + Stok Saat Ini + Riwayat Stok; halaman Produksi render benar.

## Code Review Fixes Round 2 (2026-08-21)
- Backend `stock_router.create_movement`: init `mv = None` (defensif; semua cabang valid sudah assign mv). Tidak mengubah perilaku.
- Frontend `BomPage.js`: item baris resep pakai key stabil (`_rid`) via newRow(), bukan index array — cegah nilai baris tertukar saat hapus baris (pola sama seperti SalesPage). `_rid` di-strip sebelum kirim ke backend. Tambah data-testid `bom-remove-<idx>`.
- False-positive (tidak diubah, memang benar): `is None`/`is not None` (db.py, stock_router, production_router); deps hook (setter useState/konstanta modul/debounce stabil); key index pada tabel READ-ONLY & skeleton loader; `days_in_month` selalu ter-assign; catch logout sengaja senyap.
- Sengaja dilewati (risiko regresi pada logika teruji): refactor kompleksitas backend dashboard()/process()/generate_payroll() & pemecahan komponen besar SalesPage/KasBankPage.
- Terverifikasi (testing_agent iteration_7): backend stok 7/7 PASS; BOM hapus baris tengah → nilai baris lain tetap benar (qty 11 & 33); save+edit OK; penjualan tetap mengurangi stok.

## Stok Saat Ini: Rekap Total + Detail (2026-08-21)
- Halaman **Stok Saat Ini** kini menampilkan **rekap total per item** (dijumlahkan lintas gudang & batch): Kode, Nama Item, Total Qty, jumlah Lokasi/Batch, Nilai Total, Status (Aman/Stok Minimum/Negatif).
- Tombol **Detail** per item → dialog rincian lengkap per gudang & batch (Gudang, Batch/Tgl Produksi, Kadaluarsa, Qty, Harga Rata², Nilai) + baris Total.
- Backend baru: `GET /api/stock/summary` (agregasi per item_id) + tambah filter `item_id` di `GET /api/stock/balances` untuk drill-down detail.
- Filter (jenis item, stok minimum) + search + Export Excel (rekap) dipertahankan.
- Terverifikasi (curl + screenshot): rekap 9 item benar; detail per batch cocok (mis. total 6 = 3+3).

## Ringkasan Grand-Total di Stok Saat Ini (2026-08-21)
- Ditambahkan 3 kartu KPI di atas tabel rekap Stok Saat Ini: **Total Nilai Persediaan** (grand-total nilai seluruh stok), **Jumlah Item**, **Item Stok Minimum** — dihitung dari data `/stock/summary`.
- Terverifikasi (screenshot): Total Nilai Rp 14.902.143, 9 item, 1 stok minimum.

## Rebuild dari Repositori Torillaz (2026-09-07)
- Kode lokal diverifikasi identik dengan `github.com/aguskimju-max/Torillaz` (commit fccd232, sinkron origin/main).
- Dependencies backend (pip) & frontend (yarn) di-install ulang; backend + frontend restart via supervisor.
- Verifikasi: backend health 200, seed selesai, login super admin OK, dashboard render penuh (KPI, sidebar semua modul, branding Torillaz) via URL preview.

## Ganti Kredensial Super Admin (2026-09-07)
- Super admin kini: email `admin`, password `torillaz123` (akun lama aguskimju@gmail.com dihapus, ADMIN_EMAIL/ADMIN_PASSWORD di backend/.env diubah).
- Validasi `EmailStr` → `str` di auth_router (login) & settings_router (user CRUD) agar username non-email diterima; input login frontend `type="email"` → `type="text"`.
- Terverifikasi: login `admin` via UI preview → dashboard OK; kredensial lama ditolak (401).

## Backup: Import/Restore Data (2026-09-07)
- Backend: `GET /api/backup` versi 2 (sertakan password_hash users, id string, audit log export).
  `POST /api/backup/restore` (izin pengaturan.edit): replace-mode per koleksi whitelist, konversi id→_id
  (ObjectId / string utk counters), preserve hash user lama utk backup v1, panggil seed_admin setelah
  restore users (admin env selalu bisa login), audit log restore, return {restored,total,skipped}.
- Frontend BackupPage: kartu "Import / Restore Data" — pilih file .json → preview ringkasan koleksi+jumlah
  → dialog konfirmasi destruktif → restore → toast + invalidateQueries + panel sukses.
- Tested: backend 12/12 PASS (termasuk backward-compat backup v1, error 400/401, audit, konsistensi stok);
  UI desktop+mobile render tanpa overflow.

## Pilihan Harga Jual per Barang (2026-09-07)
- Master Barang Jadi: field baru `harga_opsi:[{label,harga}]` (fleksibel, tambah/hapus per barang) via tipe field
  `pricelist` di CrudDrawer (validasi baris lengkap, strip _rid, Number cast). Kolom "Opsi Harga" di tabel
  (fmt pricelist di MasterPage). `harga_jual` tetap = harga Standar.
- SalesPage: kolom harga per item kini dropdown "Standar — Rp X" + semua harga_opsi; TIDAK ada input manual
  (keputusan user). Pilih item → auto Standar; state harga_label per baris; payload item kirim harga_label.
  Detail order menampilkan label harga non-standar.
- Backend: sales_router._build_items simpan `harga_label` (default "Standar"). Master generik tanpa perubahan.
- Tested: backend 12/12 PASS (simpan/ambil harga_opsi, order dgn/tanpa harga_label, kirim + stok berkurang,
  label bertahan seumur order); UI terverifikasi (form master, dropdown harga, subtotal benar).

## Next Tasks
- (Menunggu arahan user) Fase 4 (Pembelian): PR, PO, Penerimaan Barang, Hutang Supplier — terhubung ke stok & keuangan.
- (Backlog) Sistem Notifikasi & Alert: stok minimum, produk expired, jatuh tempo pembayaran.
