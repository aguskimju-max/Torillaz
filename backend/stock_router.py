from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import Optional

from db import db, oid, now_iso, get_next_code, serialize, log_audit
from rbac import require

router = APIRouter(prefix="/api/stock", tags=["stock"])

ITEM_COLL = {"bahan_baku": "master_bahan_baku", "barang_jadi": "master_barang_jadi"}
TIPE_PREFIX = {
    "penerimaan": "RCV", "pengeluaran": "ISS", "penyesuaian": "ADJ",
    "transfer": "TRF", "opname": "OPN", "produksi_out": "PRO", "produksi_in": "PRI",
}
TIPE_LABEL = {
    "penerimaan": "Penerimaan", "pengeluaran": "Pengeluaran", "penyesuaian": "Penyesuaian",
    "transfer_keluar": "Transfer Keluar", "transfer_masuk": "Transfer Masuk",
    "opname": "Stock Opname",
}


async def get_item(item_type: str, item_id: str):
    coll = ITEM_COLL.get(item_type)
    if not coll:
        raise HTTPException(status_code=400, detail="Tipe item tidak valid")
    doc = await db[coll].find_one({"_id": oid(item_id), "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    return doc


async def _balance_key(item_type, item_id, gudang_id, batch):
    return {"item_type": item_type, "item_id": item_id,
            "gudang_id": gudang_id, "batch": batch or "-"}


async def apply_delta(item_type, item_id, gudang_id, batch, expired_date,
                      delta_qty, in_price=None, allow_negative=False, tanggal_produksi=None):
    key = await _balance_key(item_type, item_id, gudang_id, batch)
    bal = await db.stock_balances.find_one(key)
    cur_qty = bal["qty"] if bal else 0
    cur_avg = bal["avg_price"] if bal else 0
    new_qty = round(cur_qty + delta_qty, 4)
    if new_qty < 0 and not allow_negative:
        raise HTTPException(status_code=400,
                            detail=f"Stok tidak mencukupi (tersedia {cur_qty}, diminta {abs(delta_qty)})")
    if delta_qty > 0 and in_price is not None:
        total_val = cur_qty * cur_avg + delta_qty * in_price
        new_avg = round(total_val / new_qty, 4) if new_qty > 0 else in_price
    else:
        new_avg = cur_avg
    setdoc = {"qty": new_qty, "avg_price": new_avg, "expired_date": expired_date,
              "updated_at": now_iso()}
    if tanggal_produksi is not None:
        setdoc["tanggal_produksi"] = tanggal_produksi
    await db.stock_balances.update_one(key, {"$set": setdoc}, upsert=True)
    return cur_qty, new_qty, new_avg


async def record_movement(no, tipe, item, item_type, item_id, gudang_id, gudang_nama,
                          batch, expired_date, qty, harga, saldo_akhir, keterangan, user,
                          ref=None, tanggal_produksi=None):
    doc = {
        "no_transaksi": no,
        "tipe": tipe,
        "item_type": item_type,
        "item_id": item_id,
        "item_kode": item.get("kode"),
        "item_nama": item.get("nama"),
        "satuan": item.get("satuan_nama") or item.get("satuan"),
        "gudang_id": gudang_id,
        "gudang_nama": gudang_nama,
        "batch": batch or "-",
        "expired_date": expired_date,
        "tanggal_produksi": tanggal_produksi,
        "qty": qty,
        "harga_satuan": harga or 0,
        "total": round((harga or 0) * abs(qty), 2),
        "saldo_akhir": saldo_akhir,
        "keterangan": keterangan or "",
        "ref": ref,
        "created_at": now_iso(),
        "created_by": user["name"],
    }
    await db.stock_movements.insert_one(doc)
    return doc


async def gudang_name(gudang_id):
    if not gudang_id:
        return None
    g = await db.master_gudang.find_one({"_id": oid(gudang_id)})
    return g.get("nama") if g else gudang_id


async def available_qty(item_type, item_id, gudang_id):
    total = 0
    async for b in db.stock_balances.find(
            {"item_type": item_type, "item_id": item_id, "gudang_id": gudang_id}):
        total += b.get("qty", 0)
    return round(total, 4)


async def avg_price_of(item_type, item_id, gudang_id=None):
    flt = {"item_type": item_type, "item_id": item_id}
    if gudang_id:
        flt["gudang_id"] = gudang_id
    qty = val = 0
    async for b in db.stock_balances.find(flt):
        qty += b.get("qty", 0)
        val += b.get("qty", 0) * b.get("avg_price", 0)
    return round(val / qty, 4) if qty > 0 else 0


async def consume_stock_fifo(item_type, item_id, gudang_id, qty, item, gudang_nama,
                             user, tipe, no, keterangan=""):
    """Reduce stock across batches FIFO/FEFO. Returns total cost consumed."""
    avail = await available_qty(item_type, item_id, gudang_id)
    if avail + 1e-9 < qty:
        raise HTTPException(status_code=400,
                            detail=f"Stok {item.get('nama')} tidak cukup (tersedia {avail}, butuh {qty})")
    remaining = qty
    cost_total = 0.0
    cursor = db.stock_balances.find(
        {"item_type": item_type, "item_id": item_id, "gudang_id": gudang_id, "qty": {"$gt": 0}}
    ).sort([("expired_date", 1), ("updated_at", 1)])
    balances = [b async for b in cursor]
    for b in balances:
        if remaining <= 1e-9:
            break
        take = min(b["qty"], remaining)
        avg = b.get("avg_price", 0)
        cost_total += take * avg
        _, new_qty, _ = await apply_delta(item_type, item_id, gudang_id,
                                          b.get("batch"), b.get("expired_date"), -take)
        await record_movement(no, tipe, item, item_type, item_id, gudang_id, gudang_nama,
                              b.get("batch"), b.get("expired_date"), -take, avg, new_qty,
                              keterangan, user, ref=no)
        remaining -= take
    return round(cost_total, 2)


@router.post("/simple-in")
async def simple_stock_in(payload: dict = Body(...), user=Depends(require("gudang", "add"))):
    """Simplified stock-in for finished goods: product + production date + qty + warehouse."""
    item_id = payload.get("item_id")
    gudang_id = payload.get("gudang_id")
    tanggal_produksi = payload.get("tanggal_produksi")
    expired_date = payload.get("expired_date") or None
    qty = float(payload.get("qty") or 0)
    if not item_id or not gudang_id:
        raise HTTPException(status_code=400, detail="Produk dan gudang wajib diisi")
    if not tanggal_produksi:
        raise HTTPException(status_code=400, detail="Tanggal produksi wajib diisi")
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Jumlah harus lebih dari 0")
    item = await get_item("barang_jadi", item_id)
    gnama = await gudang_name(gudang_id)
    # group stock per production date so each production lot is tracked as its own batch
    batch = tanggal_produksi
    harga = float(item.get("harga_pokok") or item.get("hpp") or 0)
    _, new_qty, _ = await apply_delta("barang_jadi", item_id, gudang_id, batch, expired_date,
                                      qty, harga, tanggal_produksi=tanggal_produksi)
    no = await get_next_code(TIPE_PREFIX["penerimaan"])
    ket = f"Input stok · produksi {tanggal_produksi}"
    mv = await record_movement(no, "penerimaan", item, "barang_jadi", item_id, gudang_id,
                               gnama, batch, expired_date, qty, harga, new_qty, ket, user,
                               tanggal_produksi=tanggal_produksi)
    await log_audit(user, "create", "gudang", "stock_movement", no,
                    f"Input stok {item.get('nama')} qty {qty} (produksi {tanggal_produksi})")
    return serialize(mv)


@router.post("/movement")
async def create_movement(payload: dict = Body(...), user=Depends(require("gudang", "add"))):
    tipe = payload.get("tipe")
    if tipe not in ("penerimaan", "pengeluaran", "penyesuaian", "transfer", "opname"):
        raise HTTPException(status_code=400, detail="Tipe transaksi tidak valid")
    item_type = payload.get("item_type")
    item_id = payload.get("item_id")
    gudang_id = payload.get("gudang_id")
    batch = payload.get("batch") or "-"
    expired_date = payload.get("expired_date")
    keterangan = payload.get("keterangan")
    qty = float(payload.get("qty") or 0)
    harga = float(payload.get("harga_satuan") or 0)

    if not item_type or not item_id or not gudang_id:
        raise HTTPException(status_code=400, detail="Item dan gudang wajib diisi")
    item = await get_item(item_type, item_id)
    gnama = await gudang_name(gudang_id)
    mv = None

    if tipe == "penerimaan":
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Qty harus lebih dari 0")
        _, new_qty, _ = await apply_delta(item_type, item_id, gudang_id, batch, expired_date, qty, harga)
        no = await get_next_code(TIPE_PREFIX["penerimaan"])
        mv = await record_movement(no, "penerimaan", item, item_type, item_id, gudang_id,
                                    gnama, batch, expired_date, qty, harga, new_qty, keterangan, user)

    elif tipe == "pengeluaran":
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Qty harus lebih dari 0")
        _, new_qty, avg = await apply_delta(item_type, item_id, gudang_id, batch, expired_date, -qty)
        no = await get_next_code(TIPE_PREFIX["pengeluaran"])
        mv = await record_movement(no, "pengeluaran", item, item_type, item_id, gudang_id,
                                    gnama, batch, expired_date, -qty, avg, new_qty, keterangan, user)

    elif tipe == "penyesuaian":
        # qty is a signed delta (+ tambah / - kurang)
        if qty == 0:
            raise HTTPException(status_code=400, detail="Qty penyesuaian tidak boleh 0")
        _, new_qty, avg = await apply_delta(item_type, item_id, gudang_id, batch, expired_date,
                                            qty, harga if qty > 0 else None)
        no = await get_next_code(TIPE_PREFIX["penyesuaian"])
        mv = await record_movement(no, "penyesuaian", item, item_type, item_id, gudang_id,
                                    gnama, batch, expired_date, qty, harga, new_qty, keterangan, user)

    elif tipe == "opname":
        # qty is the actual counted quantity; system computes selisih
        key = await _balance_key(item_type, item_id, gudang_id, batch)
        bal = await db.stock_balances.find_one(key)
        cur_qty = bal["qty"] if bal else 0
        avg = bal["avg_price"] if bal else harga
        selisih = round(qty - cur_qty, 4)
        await db.stock_balances.update_one(
            key, {"$set": {"qty": qty, "avg_price": avg, "expired_date": expired_date,
                           "updated_at": now_iso()}}, upsert=True)
        no = await get_next_code(TIPE_PREFIX["opname"])
        ket = (keterangan or "") + f" | Sistem: {cur_qty}, Fisik: {qty}, Selisih: {selisih}"
        mv = await record_movement(no, "opname", item, item_type, item_id, gudang_id,
                                    gnama, batch, expired_date, selisih, avg, qty, ket, user)

    elif tipe == "transfer":
        gudang_tujuan = payload.get("gudang_tujuan_id")
        if not gudang_tujuan or gudang_tujuan == gudang_id:
            raise HTTPException(status_code=400, detail="Gudang tujuan tidak valid")
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Qty harus lebih dari 0")
        key = await _balance_key(item_type, item_id, gudang_id, batch)
        bal = await db.stock_balances.find_one(key)
        avg = bal["avg_price"] if bal else 0
        _, out_qty, _ = await apply_delta(item_type, item_id, gudang_id, batch, expired_date, -qty)
        _, in_qty, _ = await apply_delta(item_type, item_id, gudang_tujuan, batch, expired_date, qty, avg)
        no = await get_next_code(TIPE_PREFIX["transfer"])
        gnama_t = await gudang_name(gudang_tujuan)
        mv = await record_movement(no, "transfer_keluar", item, item_type, item_id, gudang_id,
                                    gnama, batch, expired_date, -qty, avg, out_qty,
                                    f"Transfer ke {gnama_t}. {keterangan or ''}", user, ref=no)
        await record_movement(no, "transfer_masuk", item, item_type, item_id, gudang_tujuan,
                              gnama_t, batch, expired_date, qty, avg, in_qty,
                              f"Transfer dari {gnama}. {keterangan or ''}", user, ref=no)

    else:
        raise HTTPException(status_code=400, detail="Tipe transaksi tidak valid")

    await log_audit(user, "create", "gudang", "stock_movement", mv.get("no_transaksi"),
                    f"{TIPE_LABEL.get(mv['tipe'], tipe)} {item.get('nama')} qty {qty}")
    return serialize(mv)


@router.post("/opname-bulk")
async def opname_bulk(payload: dict = Body(...), user=Depends(require("gudang", "add"))):
    """Penyesuaian stok massal berdasarkan hasil hitung fisik (stok aktual).

    Payload: {keterangan?: str, items: [{item_type, item_id, gudang_id,
              batch?, expired_date?, qty_aktual}]}
    Untuk tiap baris: selisih = qty_aktual - qty sistem. Baris dengan selisih 0 dilewati.
    Saldo di-set ke qty_aktual dan dicatat sebagai movement tipe "opname".
    """
    items = payload.get("items") or []
    keterangan = (payload.get("keterangan") or "").strip()
    if not items:
        raise HTTPException(status_code=400, detail="Tidak ada item untuk disesuaikan")
    if len(items) > 200:
        raise HTTPException(status_code=400, detail="Maksimal 200 item per penyesuaian")

    results = []
    skipped = 0
    for row in items:
        item_type = row.get("item_type")
        item_id = row.get("item_id")
        gudang_id = row.get("gudang_id")
        batch = row.get("batch") or "-"
        expired_date = row.get("expired_date")
        if not item_type or not item_id or not gudang_id:
            raise HTTPException(status_code=400, detail="Item dan gudang wajib diisi pada setiap baris")
        try:
            qty_aktual = float(row.get("qty_aktual"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Qty aktual tidak valid")
        if qty_aktual < 0:
            raise HTTPException(status_code=400, detail="Qty aktual tidak boleh negatif")

        item = await get_item(item_type, item_id)
        gnama = await gudang_name(gudang_id)
        key = await _balance_key(item_type, item_id, gudang_id, batch)
        bal = await db.stock_balances.find_one(key)
        cur_qty = bal["qty"] if bal else 0
        avg = bal["avg_price"] if bal else 0
        if not expired_date and bal:
            expired_date = bal.get("expired_date")
        selisih = round(qty_aktual - cur_qty, 4)
        if selisih == 0:
            skipped += 1
            continue

        await db.stock_balances.update_one(
            key, {"$set": {"qty": qty_aktual, "avg_price": avg, "expired_date": expired_date,
                           "updated_at": now_iso()}}, upsert=True)
        no = await get_next_code(TIPE_PREFIX["opname"])
        ket = (keterangan + " | " if keterangan else "") + \
            f"Penyesuaian stok aktual · Sistem: {cur_qty}, Fisik: {qty_aktual}, Selisih: {selisih:+g}"
        await record_movement(no, "opname", item, item_type, item_id, gudang_id,
                              gnama, batch, expired_date, selisih, avg, qty_aktual, ket, user)
        results.append({
            "no_transaksi": no, "item_nama": item.get("nama"), "item_kode": item.get("kode"),
            "gudang_nama": gnama, "batch": batch,
            "qty_sistem": cur_qty, "qty_aktual": qty_aktual, "selisih": selisih,
        })

    if results:
        detail_txt = ", ".join(f"{r['item_nama']} ({r['selisih']:+g})" for r in results[:10])
        if len(results) > 10:
            detail_txt += f", +{len(results) - 10} item lainnya"
        await log_audit(user, "create", "gudang", "stock_opname_bulk",
                        results[0]["no_transaksi"],
                        f"Penyesuaian stok aktual {len(results)} item: {detail_txt}")
    return {"adjusted": len(results), "skipped": skipped, "results": results}


@router.get("/movements")
async def list_movements(item_type: Optional[str] = None, item_id: Optional[str] = None,
                         gudang_id: Optional[str] = None, tipe: Optional[str] = None,
                         q: Optional[str] = None, page: int = 1, limit: int = 20,
                         user=Depends(require("gudang", "view"))):
    flt = {}
    if item_type:
        flt["item_type"] = item_type
    if item_id:
        flt["item_id"] = item_id
    if gudang_id:
        flt["gudang_id"] = gudang_id
    if tipe:
        flt["tipe"] = tipe
    if q:
        flt["$or"] = [{"no_transaksi": {"$regex": q, "$options": "i"}},
                      {"item_nama": {"$regex": q, "$options": "i"}}]
    total = await db.stock_movements.count_documents(flt)
    page = max(1, page)
    cursor = db.stock_movements.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    items = [serialize(d) async for d in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/balances")
async def list_balances(item_type: Optional[str] = None, gudang_id: Optional[str] = None,
                        item_id: Optional[str] = None,
                        low_only: Optional[str] = None, q: Optional[str] = None,
                        page: int = 1, limit: int = 50,
                        user=Depends(require("gudang", "view"))):
    flt = {}
    if item_type:
        flt["item_type"] = item_type
    if gudang_id:
        flt["gudang_id"] = gudang_id
    if item_id:
        flt["item_id"] = item_id
    cursor = db.stock_balances.find(flt)
    rows = []
    async for b in cursor:
        item = await db[ITEM_COLL[b["item_type"]]].find_one({"_id": oid(b["item_id"])})
        if not item:
            continue
        if q and q.lower() not in (item.get("nama", "").lower() + item.get("kode", "").lower()):
            continue
        g = await db.master_gudang.find_one({"_id": oid(b["gudang_id"])}) if b.get("gudang_id") else None
        stok_min = float(item.get("stok_min") or 0)
        row = {
            "item_id": b["item_id"], "item_type": b["item_type"],
            "item_kode": item.get("kode"), "item_nama": item.get("nama"),
            "satuan": item.get("satuan_nama") or item.get("satuan"),
            "gudang_id": b.get("gudang_id"), "gudang_nama": g.get("nama") if g else "-",
            "batch": b.get("batch"), "expired_date": b.get("expired_date"),
            "tanggal_produksi": b.get("tanggal_produksi"),
            "qty": b.get("qty", 0), "avg_price": b.get("avg_price", 0),
            "nilai": round(b.get("qty", 0) * b.get("avg_price", 0), 2),
            "stok_min": stok_min, "stok_max": float(item.get("stok_max") or 0),
            "is_low": b.get("qty", 0) <= stok_min,
        }
        if low_only == "true" and not row["is_low"]:
            continue
        rows.append(row)
    rows.sort(key=lambda r: r["item_nama"])
    total = len(rows)
    start = (max(1, page) - 1) * limit
    return {"items": rows[start:start + limit], "total": total, "page": page, "limit": limit}


@router.get("/summary")
async def stock_summary(item_type: Optional[str] = None, low_only: Optional[str] = None,
                        q: Optional[str] = None, user=Depends(require("gudang", "view"))):
    """Rekap total stok per item (dijumlahkan lintas gudang & batch)."""
    flt = {}
    if item_type:
        flt["item_type"] = item_type
    agg = {}
    skip = set()
    async for b in db.stock_balances.find(flt):
        key = (b["item_type"], b["item_id"])
        if key in skip:
            continue
        entry = agg.get(key)
        if not entry:
            item = await db[ITEM_COLL[b["item_type"]]].find_one({"_id": oid(b["item_id"])})
            if not item or (q and q.lower() not in (item.get("nama", "").lower() + item.get("kode", "").lower())):
                skip.add(key)
                continue
            entry = {
                "item_id": b["item_id"], "item_type": b["item_type"],
                "item_kode": item.get("kode"), "item_nama": item.get("nama"),
                "satuan": item.get("satuan_nama") or item.get("satuan"),
                "stok_min": float(item.get("stok_min") or 0),
                "total_qty": 0.0, "total_nilai": 0.0, "lokasi": 0,
            }
            agg[key] = entry
        qty = b.get("qty", 0)
        entry["total_qty"] = round(entry["total_qty"] + qty, 4)
        entry["total_nilai"] = round(entry["total_nilai"] + qty * b.get("avg_price", 0), 2)
        entry["lokasi"] += 1
    rows = list(agg.values())
    for r in rows:
        r["is_low"] = r["total_qty"] <= r["stok_min"]
    if low_only == "true":
        rows = [r for r in rows if r["is_low"]]
    rows.sort(key=lambda r: r["item_nama"])
    return {"items": rows, "total": len(rows)}


@router.get("/kartu")
async def kartu_stok(item_type: str, item_id: str, gudang_id: Optional[str] = None,
                     user=Depends(require("gudang", "view"))):
    flt = {"item_type": item_type, "item_id": item_id}
    if gudang_id:
        flt["gudang_id"] = gudang_id
    cursor = db.stock_movements.find(flt).sort("created_at", 1)
    saldo = 0
    rows = []
    async for m in cursor:
        saldo = round(saldo + m.get("qty", 0), 4)
        d = serialize(m)
        d["saldo"] = saldo
        rows.append(d)
    item = await db[ITEM_COLL[item_type]].find_one({"_id": oid(item_id)})
    rows.reverse()
    return {"item": serialize(item) if item else None, "movements": rows, "saldo": saldo}
