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
                      delta_qty, in_price=None, allow_negative=False):
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
    await db.stock_balances.update_one(
        key,
        {"$set": {"qty": new_qty, "avg_price": new_avg, "expired_date": expired_date,
                  "updated_at": now_iso()}},
        upsert=True,
    )
    return cur_qty, new_qty, new_avg


async def record_movement(no, tipe, item, item_type, item_id, gudang_id, gudang_nama,
                          batch, expired_date, qty, harga, saldo_akhir, keterangan, user,
                          ref=None):
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

    await log_audit(user, "create", "gudang", "stock_movement", mv.get("no_transaksi"),
                    f"{TIPE_LABEL.get(mv['tipe'], tipe)} {item.get('nama')} qty {qty}")
    return serialize(mv)


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
                        low_only: Optional[str] = None, q: Optional[str] = None,
                        page: int = 1, limit: int = 50,
                        user=Depends(require("gudang", "view"))):
    flt = {}
    if item_type:
        flt["item_type"] = item_type
    if gudang_id:
        flt["gudang_id"] = gudang_id
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
