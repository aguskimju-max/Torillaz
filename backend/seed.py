import os
from datetime import datetime, timezone, timedelta

from db import db, now_iso, get_next_code
from security import hash_password, verify_password
from rbac import DEFAULT_ROLES


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.audit_logs.create_index("created_at")
    await db.stock_movements.create_index([("item_id", 1), ("created_at", 1)])
    await db.stock_balances.create_index(
        [("item_type", 1), ("item_id", 1), ("gudang_id", 1), ("batch", 1)], unique=True)


async def seed_roles():
    for r in DEFAULT_ROLES:
        existing = await db.roles.find_one({"name": r["name"]})
        if not existing:
            await db.roles.insert_one({**r, "created_at": now_iso()})
        else:
            # keep permissions for system roles in sync with latest matrix
            if existing.get("is_system"):
                await db.roles.update_one({"name": r["name"]},
                                          {"$set": {"permissions": r["permissions"],
                                                    "label": r["label"]}})


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    name = os.environ.get("ADMIN_NAME", "Administrator")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "name": name, "email": email, "password_hash": hash_password(password),
            "role": "super_admin", "is_active": True, "created_at": now_iso(),
            "created_by": "system",
        })
    elif not verify_password(password, existing.get("password_hash", "")):
        await db.users.update_one({"email": email},
                                  {"$set": {"password_hash": hash_password(password),
                                            "role": "super_admin", "is_active": True}})
        await db.login_attempts.delete_one({"identifier": f"email:{email}"})


async def _mk(coll, prefix, nama, **extra):
    kode = await get_next_code(prefix)
    doc = {"kode": kode, "nama": nama, "is_active": True, "deleted_at": None,
           "created_at": now_iso(), "created_by": "system",
           "updated_at": now_iso(), "updated_by": "system", **extra}
    res = await db[coll].insert_one(doc)
    return str(res.inserted_id), doc


async def seed_sample_data():
    if await db.master_kategori.count_documents({}) > 0:
        return
    # company
    await _mk("master_perusahaan", "COMP", "PT Boga Rasa Nusantara",
              alamat="Jl. Industri Raya No. 12, Bekasi", telepon="021-8899000",
              email="info@bogarasa.co.id", npwp="01.234.567.8-901.000")
    # kategori
    kat_bb, _ = await _mk("master_kategori", "KAT", "Bahan Baku", tipe="bahan_baku")
    kat_kemasan, _ = await _mk("master_kategori", "KAT", "Kemasan", tipe="bahan_baku")
    kat_bj, _ = await _mk("master_kategori", "KAT", "Produk Jadi", tipe="barang_jadi")
    # satuan
    sat_kg, _ = await _mk("master_satuan", "UOM", "Kilogram", simbol="Kg")
    sat_gr, _ = await _mk("master_satuan", "UOM", "Gram", simbol="Gr")
    sat_ltr, _ = await _mk("master_satuan", "UOM", "Liter", simbol="Ltr")
    sat_pcs, _ = await _mk("master_satuan", "UOM", "Pcs", simbol="Pcs")
    sat_box, _ = await _mk("master_satuan", "UOM", "Box", simbol="Box")
    # gudang
    gd_bb, _ = await _mk("master_gudang", "GD", "Gudang Bahan Baku", lokasi="Lantai 1", tipe="bahan_baku")
    gd_bj, _ = await _mk("master_gudang", "GD", "Gudang Barang Jadi", lokasi="Lantai 2", tipe="barang_jadi")
    # rak
    await _mk("master_rak", "RK", "Rak A-01", gudang_id=gd_bb)
    await _mk("master_rak", "RK", "Rak A-02", gudang_id=gd_bb)
    await _mk("master_rak", "RK", "Rak B-01", gudang_id=gd_bj)
    # supplier
    sup1, _ = await _mk("master_supplier", "SUP", "CV Sumber Tepung", telepon="0812111222",
                        alamat="Cikarang", email="sales@sumbertepung.co.id", term=30)
    await _mk("master_supplier", "SUP", "PT Manis Sejahtera", telepon="0813444555",
              alamat="Karawang", email="order@manissejahtera.co.id", term=14)
    # pelanggan
    await _mk("master_pelanggan", "CUST", "Toko Kue Bahagia", telepon="0821000111",
              alamat="Jakarta Timur", kategori="Retail", term=0)
    await _mk("master_pelanggan", "CUST", "Distributor Snack Jaya", telepon="0822333444",
              alamat="Bandung", kategori="Grosir", term=30)
    # jabatan & divisi
    jb_staff, _ = await _mk("master_jabatan", "JB", "Staff Produksi")
    jb_spv, _ = await _mk("master_jabatan", "JB", "Supervisor")
    div_prod, _ = await _mk("master_divisi", "DIV", "Produksi")
    div_gd, _ = await _mk("master_divisi", "DIV", "Gudang")
    # karyawan
    await _mk("master_karyawan", "EMP", "Budi Santoso", nik="3201010101900001",
              jabatan_id=jb_spv, divisi_id=div_prod, gaji_pokok=5000000,
              tanggal_masuk="2023-01-10", status="Tetap")
    await _mk("master_karyawan", "EMP", "Siti Aminah", nik="3201010202920002",
              jabatan_id=jb_staff, divisi_id=div_gd, gaji_pokok=3500000,
              tanggal_masuk="2023-06-01", status="Tetap")
    # bahan baku
    bb_defs = [
        ("Tepung Terigu", kat_bb, sat_kg, 50, 500, 12000, True),
        ("Gula Pasir", kat_bb, sat_kg, 30, 300, 14000, True),
        ("Mentega", kat_bb, sat_kg, 20, 150, 45000, True),
        ("Coklat Bubuk", kat_bb, sat_kg, 10, 100, 85000, True),
        ("Box Kemasan", kat_kemasan, sat_box, 100, 1000, 2500, False),
    ]
    bb_ids = {}
    for nama, kat, sat, smin, smax, harga, use_exp in bb_defs:
        satdoc = await db.master_satuan.find_one({"_id": __import__("bson").ObjectId(sat)})
        _id, _ = await _mk("master_bahan_baku", "BB", nama, kategori_id=kat, satuan_id=sat,
                           satuan_nama=satdoc.get("simbol") if satdoc else "",
                           stok_min=smin, stok_max=smax, harga_beli=harga,
                           use_expired=use_exp, use_batch=True)
        bb_ids[nama] = _id
    # barang jadi
    bj_defs = [
        ("Roti Coklat", kat_bj, sat_pcs, 100, 2000, 5000, 8000),
        ("Kue Kering Premium", kat_bj, sat_box, 20, 500, 25000, 40000),
    ]
    bj_ids = {}
    for nama, kat, sat, smin, smax, hpp, jual in bj_defs:
        satdoc = await db.master_satuan.find_one({"_id": __import__("bson").ObjectId(sat)})
        _id, _ = await _mk("master_barang_jadi", "BJ", nama, kategori_id=kat, satuan_id=sat,
                           satuan_nama=satdoc.get("simbol") if satdoc else "",
                           stok_min=smin, stok_max=smax, harga_pokok=hpp, harga_jual=jual,
                           use_expired=True, use_batch=True)
        bj_ids[nama] = _id
    # rekening & pajak & metode & biaya
    await _mk("master_rekening", "AKUN", "Kas Utama", tipe="kas", saldo_awal=10000000)
    await _mk("master_rekening", "AKUN", "Bank BCA", tipe="bank", no_rekening="1234567890", saldo_awal=50000000)
    await _mk("master_pajak", "TAX", "PPN 11%", persen=11)
    await _mk("master_metode", "PM", "Tunai")
    await _mk("master_metode", "PM", "Transfer Bank")
    await _mk("master_biaya", "BY", "Listrik & Air", tipe="operasional")
    await _mk("master_biaya", "BY", "Gaji Karyawan", tipe="tenaga_kerja")

    # seed initial stock via movements so dashboard has data
    await _seed_stock(bb_ids, bj_ids, gd_bb, gd_bj)


async def _seed_stock(bb_ids, bj_ids, gd_bb, gd_bj):
    from stock_router import apply_delta, record_movement
    now = datetime.now(timezone.utc)
    user = {"name": "system"}
    entries = [
        ("bahan_baku", bb_ids["Tepung Terigu"], gd_bb, 200, 12000, 12),
        ("bahan_baku", bb_ids["Gula Pasir"], gd_bb, 120, 14000, 9),
        ("bahan_baku", bb_ids["Mentega"], gd_bb, 15, 45000, 3),   # below min -> alert
        ("bahan_baku", bb_ids["Coklat Bubuk"], gd_bb, 40, 85000, 6),
        ("bahan_baku", bb_ids["Box Kemasan"], gd_bb, 800, 2500, None),
        ("barang_jadi", bj_ids["Roti Coklat"], gd_bj, 500, 5000, 5),
        ("barang_jadi", bj_ids["Kue Kering Premium"], gd_bj, 15, 25000, 4),  # below min
    ]
    coll = {"bahan_baku": "master_bahan_baku", "barang_jadi": "master_barang_jadi"}
    for item_type, item_id, gudang, qty, harga, exp_days in entries:
        item = await db[coll[item_type]].find_one({"_id": __import__("bson").ObjectId(item_id)})
        g = await db.master_gudang.find_one({"_id": __import__("bson").ObjectId(gudang)})
        exp = ((now + timedelta(days=exp_days * 30)).date().isoformat() if exp_days else None)
        batch = "BATCH-" + now.strftime("%y%m")
        _, new_qty, _ = await apply_delta(item_type, item_id, gudang, batch, exp, qty, harga)
        no = await get_next_code("RCV")
        await record_movement(no, "penerimaan", item, item_type, item_id, gudang,
                              g.get("nama"), batch, exp, qty, harga, new_qty,
                              "Saldo awal (seed)", user)


async def write_test_credentials():
    path = "/app/memory/test_credentials.md"
    email = os.environ["ADMIN_EMAIL"]
    pwd = os.environ["ADMIN_PASSWORD"]
    content = f"""# Test Credentials

## Super Admin (full access)
- Email: {email}
- Password: {pwd}
- Role: super_admin

## Auth Endpoints
- POST /api/auth/login  (body: {{"email","password"}})
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/refresh

Auth uses httpOnly cookies (access_token + refresh_token). Login also returns access_token in body for Bearer usage.

## Notes
- RBAC roles seeded: super_admin, owner, manager, admin, finance, purchasing, warehouse, produksi, sales, hr.
- Additional users can be created at /pengaturan/pengguna (module: pengaturan).
- Sample master data + initial stock are seeded automatically on first run.
"""
    with open(path, "w") as f:
        f.write(content)


async def run_all():
    await ensure_indexes()
    await seed_roles()
    await seed_admin()
    await seed_sample_data()
    await write_test_credentials()
