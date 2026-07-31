from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta

from db import db, serialize
from rbac import require
from stock_router import ITEM_COLL

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def _load_item_maps():
    """Batch-load all master items once to avoid N+1 lookups per stock balance."""
    maps = {}
    for item_type, coll in ITEM_COLL.items():
        maps[item_type] = {str(d["_id"]): d async for d in db[coll].find({})}
    return maps


@router.get("")
async def dashboard(user=Depends(require("dashboard", "view"))):
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    soon = (now + timedelta(days=30)).date().isoformat()

    item_maps = await _load_item_maps()

    # single pass over stock balances (no per-record lookups)
    balances = [b async for b in db.stock_balances.find({})]
    nilai_bb = nilai_bj = 0
    low_stock, expiring, negative, tops = [], [], [], []
    for b in balances:
        item = item_maps.get(b["item_type"], {}).get(b["item_id"])
        if not item:
            continue
        qty = b.get("qty", 0)
        avg = b.get("avg_price", 0)
        nilai = qty * avg
        if b["item_type"] == "bahan_baku":
            nilai_bb += nilai
        else:
            nilai_bj += nilai
        stok_min = float(item.get("stok_min") or 0)
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
        tops.append({"nama": item.get("nama"), "nilai": round(nilai, 2), "qty": qty})
    tops.sort(key=lambda x: x["nilai"], reverse=True)

    # counts
    jumlah_gudang = await db.master_gudang.count_documents({"deleted_at": None, "is_active": True})
    jumlah_supplier = await db.master_supplier.count_documents({"deleted_at": None, "is_active": True})
    jumlah_pelanggan = await db.master_pelanggan.count_documents({"deleted_at": None, "is_active": True})
    karyawan_aktif = await db.master_karyawan.count_documents({"deleted_at": None, "is_active": True})
    total_bb = await db.master_bahan_baku.count_documents({"deleted_at": None, "is_active": True})
    total_bj = await db.master_barang_jadi.count_documents({"deleted_at": None, "is_active": True})

    # movement chart last 7 days (single ranged query, bucketed in memory)
    day7 = (now - timedelta(days=6)).date().isoformat()
    buckets = {}
    async for m in db.stock_movements.find(
            {"created_at": {"$gte": day7}},
            {"created_at": 1, "qty": 1}):
        day = (m.get("created_at") or "")[:10]
        bk = buckets.setdefault(day, {"masuk": 0, "keluar": 0})
        q = m.get("qty", 0)
        if q > 0:
            bk["masuk"] += q
        else:
            bk["keluar"] += abs(q)
    chart = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        bk = buckets.get(day, {"masuk": 0, "keluar": 0})
        chart.append({"tanggal": day, "masuk": round(bk["masuk"], 2), "keluar": round(bk["keluar"], 2)})

    # recent movements (projection only needed fields)
    recent = [serialize(d) async for d in db.stock_movements.find(
        {}, {"no_transaksi": 1, "tipe": 1, "item_nama": 1, "qty": 1, "created_at": 1})
        .sort("created_at", -1).limit(8)]

    movement_today = await db.stock_movements.count_documents({"created_at": {"$regex": f"^{today}"}})

    # sales metrics (single pass over sales orders)
    month_prefix = now.strftime("%Y-%m")
    year_prefix = now.strftime("%Y")
    valid_status = {"dikirim", "sebagian", "lunas"}
    omzet_hari = omzet_bulan = omzet_tahun = laba_kotor = piutang_total = 0
    total_transaksi = 0
    top_products, top_customers, sales_by_day = {}, {}, {}
    async for so in db.sales_orders.find({}):
        status = so.get("status")
        if status in valid_status:
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
            day = tgl[:10]
            if day >= day7:
                sales_by_day[day] = sales_by_day.get(day, 0) + t
        if so.get("sisa", 0) > 0 and status in {"dikirim", "sebagian"}:
            piutang_total += so.get("sisa", 0)

    chart_sales = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        chart_sales.append({"tanggal": day, "omzet": round(sales_by_day.get(day, 0), 2)})

    top_produk = sorted([{"nama": k, "nilai": round(v, 2)} for k, v in top_products.items()],
                        key=lambda x: x["nilai"], reverse=True)[:10]
    top_pelanggan = sorted([{"nama": k, "nilai": round(v, 2)} for k, v in top_customers.items()],
                          key=lambda x: x["nilai"], reverse=True)[:10]
    total_produksi = await db.production_orders.count_documents({})

    return {
        "kpi": {
            "nilai_persediaan": round(nilai_bb + nilai_bj, 2),
            "nilai_bahan_baku": round(nilai_bb, 2),
            "nilai_barang_jadi": round(nilai_bj, 2),
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
