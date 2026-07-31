from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta

from db import db, oid, serialize
from rbac import require
from stock_router import ITEM_COLL

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def _inventory_value(item_type=None):
    flt = {}
    if item_type:
        flt["item_type"] = item_type
    total = 0
    async for b in db.stock_balances.find(flt):
        total += b.get("qty", 0) * b.get("avg_price", 0)
    return round(total, 2)


@router.get("")
async def dashboard(user=Depends(require("dashboard", "view"))):
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()

    nilai_bb = await _inventory_value("bahan_baku")
    nilai_bj = await _inventory_value("barang_jadi")

    # counts
    jumlah_gudang = await db.master_gudang.count_documents({"deleted_at": None, "is_active": True})
    jumlah_supplier = await db.master_supplier.count_documents({"deleted_at": None, "is_active": True})
    jumlah_pelanggan = await db.master_pelanggan.count_documents({"deleted_at": None, "is_active": True})
    karyawan_aktif = await db.master_karyawan.count_documents({"deleted_at": None, "is_active": True})
    total_bb = await db.master_bahan_baku.count_documents({"deleted_at": None, "is_active": True})
    total_bj = await db.master_barang_jadi.count_documents({"deleted_at": None, "is_active": True})

    # low stock + expiry + negative
    low_stock, expiring, negative = [], [], []
    soon = (now + timedelta(days=30)).date().isoformat()
    async for b in db.stock_balances.find({}):
        item = await db[ITEM_COLL[b["item_type"]]].find_one({"_id": oid(b["item_id"])})
        if not item:
            continue
        stok_min = float(item.get("stok_min") or 0)
        qty = b.get("qty", 0)
        info = {"nama": item.get("nama"), "kode": item.get("kode"),
                "qty": qty, "stok_min": stok_min,
                "satuan": item.get("satuan_nama") or item.get("satuan"),
                "batch": b.get("batch"), "expired_date": b.get("expired_date")}
        if qty < 0:
            negative.append(info)
        elif qty <= stok_min:
            low_stock.append(info)
        exp = b.get("expired_date")
        if exp and exp <= soon and qty > 0:
            expiring.append(info)

    # movement chart last 7 days
    chart = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        masuk = keluar = 0
        async for m in db.stock_movements.find({"created_at": {"$regex": f"^{day}"}}):
            if m.get("qty", 0) > 0:
                masuk += m["qty"]
            else:
                keluar += abs(m["qty"])
        chart.append({"tanggal": day, "masuk": round(masuk, 2), "keluar": round(keluar, 2)})

    # top items by inventory value
    tops = []
    async for b in db.stock_balances.find({}):
        item = await db[ITEM_COLL[b["item_type"]]].find_one({"_id": oid(b["item_id"])})
        if not item:
            continue
        nilai = b.get("qty", 0) * b.get("avg_price", 0)
        tops.append({"nama": item.get("nama"), "nilai": round(nilai, 2), "qty": b.get("qty", 0)})
    tops.sort(key=lambda x: x["nilai"], reverse=True)

    # recent movements
    recent = [serialize(d) async for d in db.stock_movements.find({}).sort("created_at", -1).limit(8)]

    movement_today = await db.stock_movements.count_documents({"created_at": {"$regex": f"^{today}"}})

    # sales metrics
    month_prefix = now.strftime("%Y-%m")
    year_prefix = now.strftime("%Y")
    valid_status = {"dikirim", "sebagian", "lunas"}
    omzet_hari = omzet_bulan = omzet_tahun = laba_kotor = piutang_total = 0
    total_transaksi = 0
    top_products = {}
    top_customers = {}
    async for so in db.sales_orders.find({}):
        if so.get("status") in valid_status:
            t = so.get("total", 0)
            tgl = so.get("tanggal", "") or ""
            if tgl.startswith(today):
                omzet_hari += t
            if tgl.startswith(month_prefix):
                omzet_bulan += t
                laba_kotor += so.get("laba_kotor", 0)
            if tgl.startswith(year_prefix):
                omzet_tahun += t
                total_transaksi += 1
                top_customers[so.get("pelanggan_nama", "-")] = top_customers.get(so.get("pelanggan_nama", "-"), 0) + t
                for it in so.get("items", []):
                    top_products[it["item_nama"]] = top_products.get(it["item_nama"], 0) + it.get("subtotal", 0)
        if so.get("sisa", 0) > 0 and so.get("status") in {"dikirim", "sebagian"}:
            piutang_total += so.get("sisa", 0)

    chart_sales = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        oms = 0
        async for so in db.sales_orders.find({"tanggal": {"$regex": f"^{day}"}}):
            if so.get("status") in valid_status:
                oms += so.get("total", 0)
        chart_sales.append({"tanggal": day, "omzet": round(oms, 2)})

    top_produk = sorted([{"nama": k, "nilai": round(v, 2)} for k, v in top_products.items()],
                        key=lambda x: x["nilai"], reverse=True)[:10]
    top_pelanggan = sorted([{"nama": k, "nilai": round(v, 2)} for k, v in top_customers.items()],
                          key=lambda x: x["nilai"], reverse=True)[:10]
    total_produksi = await db.production_orders.count_documents({})

    return {
        "kpi": {
            "nilai_persediaan": round(nilai_bb + nilai_bj, 2),
            "nilai_bahan_baku": nilai_bb,
            "nilai_barang_jadi": nilai_bj,
            "total_bahan_baku": total_bb,
            "total_barang_jadi": total_bj,
            "jumlah_gudang": jumlah_gudang,
            "jumlah_supplier": jumlah_supplier,
            "jumlah_pelanggan": jumlah_pelanggan,
            "karyawan_aktif": karyawan_aktif,
            "low_stock_count": len(low_stock),
            "expiring_count": len(expiring),
            "negative_count": len(negative),
            "movement_today": movement_today,
            "omzet_hari_ini": round(omzet_hari, 2),
            "omzet_bulan": round(omzet_bulan, 2),
            "omzet_tahun": round(omzet_tahun, 2),
            "total_transaksi": total_transaksi,
            "piutang": round(piutang_total, 2),
            "laba_kotor": round(laba_kotor, 2),
            "total_produksi": total_produksi,
            "saldo_kas": 0, "hutang": 0,
        },
        "chart_movement": chart,
        "chart_sales": chart_sales,
        "top_products": top_produk,
        "top_customers": top_pelanggan,
        "top_items": tops[:10],
        "low_stock": low_stock[:10],
        "expiring": sorted(expiring, key=lambda x: x.get("expired_date") or "")[:10],
        "recent_movements": recent,
    }
