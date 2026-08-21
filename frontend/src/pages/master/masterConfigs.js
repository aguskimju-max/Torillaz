// Configuration-driven master data definitions.
// fmt: 'money' | 'date' | 'bool' | 'ref' (needs refSource)
const STD = { key: "is_active", label: "Status", fmt: "bool" };

export const MASTER_CONFIGS = {
  perusahaan: {
    title: "Data Perusahaan",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "telepon", label: "Telepon" }, { key: "email", label: "Email" }, STD],
    fields: [
      { name: "nama", label: "Nama Perusahaan", type: "text", required: true },
      { name: "alamat", label: "Alamat", type: "textarea" },
      { name: "telepon", label: "Telepon", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "npwp", label: "NPWP", type: "text" },
    ],
  },
  cabang: {
    title: "Cabang / Lokasi Usaha",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "alamat", label: "Alamat" }, { key: "telepon", label: "Telepon" }, STD],
    fields: [
      { name: "nama", label: "Nama Cabang", type: "text", required: true },
      { name: "alamat", label: "Alamat", type: "textarea" },
      { name: "telepon", label: "Telepon", type: "text" },
    ],
  },
  gudang: {
    title: "Gudang",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "lokasi", label: "Lokasi" }, { key: "tipe", label: "Tipe" }, STD],
    fields: [
      { name: "nama", label: "Nama Gudang", type: "text", required: true },
      { name: "lokasi", label: "Lokasi", type: "text" },
      { name: "tipe", label: "Tipe", type: "select", options: [{ value: "bahan_baku", label: "Bahan Baku" }, { value: "barang_jadi", label: "Barang Jadi" }, { value: "umum", label: "Umum" }] },
    ],
  },
  rak: {
    title: "Rak / Lokasi Penyimpanan",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "gudang_id", label: "Gudang", fmt: "ref", refSource: "gudang" }, STD],
    fields: [
      { name: "nama", label: "Nama Rak", type: "text", required: true },
      { name: "gudang_id", label: "Gudang", type: "select", source: "gudang" },
    ],
  },
  kategori: {
    title: "Kategori Produk",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "tipe", label: "Tipe" }, STD],
    fields: [
      { name: "nama", label: "Nama Kategori", type: "text", required: true },
      { name: "tipe", label: "Tipe", type: "select", options: [{ value: "bahan_baku", label: "Bahan Baku" }, { value: "barang_jadi", label: "Barang Jadi" }] },
    ],
  },
  satuan: {
    title: "Satuan",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "simbol", label: "Simbol" }, STD],
    fields: [
      { name: "nama", label: "Nama Satuan", type: "text", required: true },
      { name: "simbol", label: "Simbol", type: "text", placeholder: "Kg, Pcs, Ltr" },
    ],
  },
  merek: {
    title: "Merek",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, STD],
    fields: [{ name: "nama", label: "Nama Merek", type: "text", required: true }],
  },
  supplier: {
    title: "Supplier",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "telepon", label: "Telepon" }, { key: "alamat", label: "Alamat" }, { key: "term", label: "Term (hari)" }, STD],
    fields: [
      { name: "nama", label: "Nama Supplier", type: "text", required: true },
      { name: "telepon", label: "Telepon", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "alamat", label: "Alamat", type: "textarea" },
      { name: "npwp", label: "NPWP", type: "text" },
      { name: "term", label: "Term Pembayaran (hari)", type: "number" },
    ],
  },
  pelanggan: {
    title: "Pelanggan",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "nama_toko", label: "Toko/Stand" }, { key: "telepon", label: "Telepon" }, { key: "kategori", label: "Kategori" }, { key: "latitude", label: "Lokasi", fmt: "maps" }, STD],
    fields: [
      { name: "nama", label: "Nama Pelanggan", type: "text", required: true },
      { name: "nama_toko", label: "Nama Toko / Stand", type: "text", placeholder: "cth: Toko Berkah / Stand A12" },
      { name: "telepon", label: "Telepon", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "alamat", label: "Alamat", type: "textarea" },
      { name: "lokasi", label: "Koordinat Lokasi (GPS)", type: "geo" },
      { name: "kategori", label: "Kategori", type: "select", options: [{ value: "Retail", label: "Retail" }, { value: "Grosir", label: "Grosir" }, { value: "Distributor", label: "Distributor" }] },
      { name: "term", label: "Term Pembayaran (hari)", type: "number" },
    ],
  },
  bahan_baku: {
    title: "Bahan Baku",
    columns: [
      { key: "kode", label: "Kode" }, { key: "nama", label: "Nama" },
      { key: "kategori_id", label: "Kategori", fmt: "ref", refSource: "kategori" },
      { key: "satuan_nama", label: "Satuan" },
      { key: "stok_min", label: "Stok Min", align: "right" },
      { key: "harga_beli", label: "Harga Beli", fmt: "money", align: "right" }, STD,
    ],
    fields: [
      { name: "nama", label: "Nama Bahan Baku", type: "text", required: true },
      { name: "kategori_id", label: "Kategori", type: "select", source: "kategori" },
      { name: "satuan_id", label: "Satuan", type: "select", source: "satuan", satuanName: true },
      { name: "stok_min", label: "Stok Minimum", type: "number" },
      { name: "stok_max", label: "Stok Maksimum", type: "number" },
      { name: "harga_beli", label: "Harga Beli", type: "number" },
      { name: "use_batch", label: "Gunakan Batch/Lot", type: "switch" },
      { name: "use_expired", label: "Gunakan Expired Date", type: "switch" },
    ],
  },
  barang_jadi: {
    title: "Barang Jadi",
    columns: [
      { key: "kode", label: "Kode" }, { key: "nama", label: "Nama" },
      { key: "kategori_id", label: "Kategori", fmt: "ref", refSource: "kategori" },
      { key: "satuan_nama", label: "Satuan" },
      { key: "stok_min", label: "Stok Min", align: "right" },
      { key: "harga_jual", label: "Harga Jual", fmt: "money", align: "right" }, STD,
    ],
    fields: [
      { name: "nama", label: "Nama Barang Jadi", type: "text", required: true },
      { name: "kategori_id", label: "Kategori", type: "select", source: "kategori" },
      { name: "satuan_id", label: "Satuan", type: "select", source: "satuan", satuanName: true },
      { name: "stok_min", label: "Stok Minimum", type: "number" },
      { name: "stok_max", label: "Stok Maksimum", type: "number" },
      { name: "harga_pokok", label: "Harga Pokok (HPP)", type: "number" },
      { name: "harga_jual", label: "Harga Jual", type: "number" },
      { name: "use_batch", label: "Gunakan Batch/Lot", type: "switch" },
      { name: "use_expired", label: "Gunakan Expired Date", type: "switch" },
    ],
  },
  karyawan: {
    title: "Karyawan",
    columns: [
      { key: "kode", label: "ID" }, { key: "nama", label: "Nama" }, { key: "nik", label: "NIK" },
      { key: "jabatan_id", label: "Jabatan", fmt: "ref", refSource: "jabatan" },
      { key: "divisi_id", label: "Divisi", fmt: "ref", refSource: "divisi" },
      { key: "gaji_pokok", label: "Gaji Pokok", fmt: "money", align: "right" }, STD,
    ],
    fields: [
      { name: "nama", label: "Nama Karyawan", type: "text", required: true },
      { name: "nik", label: "NIK", type: "text" },
      { name: "jabatan_id", label: "Jabatan", type: "select", source: "jabatan" },
      { name: "divisi_id", label: "Divisi", type: "select", source: "divisi" },
      { name: "tanggal_masuk", label: "Tanggal Masuk", type: "date" },
      { name: "status", label: "Status", type: "select", options: [{ value: "Tetap", label: "Tetap" }, { value: "Kontrak", label: "Kontrak" }, { value: "Harian", label: "Harian" }] },
      { name: "gaji_pokok", label: "Gaji Pokok", type: "number" },
      { name: "tunjangan", label: "Tunjangan", type: "number" },
      { name: "tarif_lembur", label: "Tarif Lembur / Jam", type: "number" },
      { name: "rekening", label: "Rekening Pembayaran", type: "text" },
    ],
  },
  jabatan: {
    title: "Jabatan",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, STD],
    fields: [{ name: "nama", label: "Nama Jabatan", type: "text", required: true }],
  },
  divisi: {
    title: "Divisi / Departemen",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, STD],
    fields: [{ name: "nama", label: "Nama Divisi", type: "text", required: true }],
  },
  rekening: {
    title: "Rekening Kas / Bank",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "tipe", label: "Tipe" }, { key: "no_rekening", label: "No. Rekening" }, { key: "saldo_awal", label: "Saldo Awal", fmt: "money", align: "right" }, STD],
    fields: [
      { name: "nama", label: "Nama Rekening", type: "text", required: true },
      { name: "tipe", label: "Tipe", type: "select", options: [{ value: "kas", label: "Kas" }, { value: "bank", label: "Bank" }] },
      { name: "no_rekening", label: "No. Rekening", type: "text" },
      { name: "saldo_awal", label: "Saldo Awal", type: "number" },
    ],
  },
  pajak: {
    title: "Pajak",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "persen", label: "Persen (%)", align: "right" }, STD],
    fields: [
      { name: "nama", label: "Nama Pajak", type: "text", required: true },
      { name: "persen", label: "Persen (%)", type: "number" },
    ],
  },
  metode_pembayaran: {
    title: "Metode Pembayaran",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, STD],
    fields: [{ name: "nama", label: "Nama Metode", type: "text", required: true }],
  },
  biaya: {
    title: "Biaya Operasional",
    columns: [{ key: "kode", label: "Kode" }, { key: "nama", label: "Nama" }, { key: "tipe", label: "Tipe" }, STD],
    fields: [
      { name: "nama", label: "Nama Biaya", type: "text", required: true },
      { name: "tipe", label: "Tipe", type: "select", options: [{ value: "operasional", label: "Operasional" }, { value: "produksi", label: "Produksi" }, { value: "tenaga_kerja", label: "Tenaga Kerja" }] },
    ],
  },
};
