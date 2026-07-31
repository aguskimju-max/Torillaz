from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone

from db import db, oid, now_iso, get_next_code, serialize, log_audit
from rbac import require
from stock_router import (get_item, gudang_name, available_qty, avg_price_of,
                          consume_stock_fifo, apply_delta, record_movement)

router = APIRouter(prefix="/api/production", tags=["production"])


# --------------- BOM / RESEP ---------------
async def _enrich_bom_items(items):
    out = []
    for it in items or []:
        bb = await db.master_bahan_baku.find_one({"_id": oid(it["item_id"])})
        out.append({
            "item_id": it["item_id"],
            "item_nama": bb.get("nama") if bb else "?",
            "kode": bb.get("kode") if bb else "",
            "satuan": (bb.get("satuan_nama") if bb else "") or "",
            "qty": float(it.get("qty") or 0),
        })
    return out


@router.get("/bom")
async def list_bom(q: Optional[str] = None, page: int = 1, limit: int = 20,
                   user=Depends(require("produksi", "view"))):
    flt = {"deleted_at": None}
    if q:
        flt["barang_jadi_nama"] = {"$regex": q, "$options": "i"}
    total = await db.master_bom.count_documents(flt)
    cursor = db.master_bom.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    return {"items": [serialize(d) async for d in cursor], "total": total, "page": page, "limit": limit}


@router.get("/bom/{bom_id}")
async def get_bom(bom_id: str, user=Depends(require("produksi", "view"))):
    doc = await db.master_bom.find_one({"_id": oid(bom_id), "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="BOM tidak ditemukan")
    return serialize(doc)


@router.post("/bom")
async def create_bom(payload: dict = Body(...), user=Depends(require("produksi", "add"))):
    bj = await get_item("barang_jadi", payload.get("barang_jadi_id"))
    items = await _enrich_bom_items(payload.get("items"))
    if not items:
        raise HTTPException(status_code=400, detail="Minimal satu bahan baku pada resep")
    kode = await get_next_code("BOM")
    doc = {
        "kode": kode,
        "barang_jadi_id": payload["barang_jadi_id"],
        "barang_jadi_nama": bj.get("nama"),
        "nama": f"Resep {bj.get('nama')}",
        "output_qty": float(payload.get("output_qty") or 1),
        "satuan_output": bj.get("satuan_nama") or "",
        "items": items,
        "biaya_tk": float(payload.get("biaya_tk") or 0),
        "biaya_overhead": float(payload.get("biaya_overhead") or 0),
        "is_active": True, "deleted_at": None,
        "created_at": now_iso(), "created_by": user["name"],
        "updated_at": now_iso(), "updated_by": user["name"],
    }
    res = await db.master_bom.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user, "create", "produksi", "bom", str(res.inserted_id), f"Tambah resep {bj.get('nama')}")
    return serialize(doc)


@router.put("/bom/{bom_id}")
async def update_bom(bom_id: str, payload: dict = Body(...), user=Depends(require("produksi", "edit"))):
    existing = await db.master_bom.find_one({"_id": oid(bom_id), "deleted_at": None})
    if not existing:
        raise HTTPException(status_code=404, detail="BOM tidak ditemukan")
    upd = {"updated_at": now_iso(), "updated_by": user["name"]}
    if payload.get("barang_jadi_id"):
        bj = await get_item("barang_jadi", payload["barang_jadi_id"])
        upd["barang_jadi_id"] = payload["barang_jadi_id"]
        upd["barang_jadi_nama"] = bj.get("nama")
        upd["nama"] = f"Resep {bj.get('nama')}"
        upd["satuan_output"] = bj.get("satuan_nama") or ""
    if "output_qty" in payload:
        upd["output_qty"] = float(payload["output_qty"] or 1)
    if "items" in payload:
        upd["items"] = await _enrich_bom_items(payload["items"])
    if "biaya_tk" in payload:
        upd["biaya_tk"] = float(payload["biaya_tk"] or 0)
    if "biaya_overhead" in payload:
        upd["biaya_overhead"] = float(payload["biaya_overhead"] or 0)
    if "is_active" in payload:
        upd["is_active"] = payload["is_active"]
    await db.master_bom.update_one({"_id": oid(bom_id)}, {"$set": upd})
    await log_audit(user, "update", "produksi", "bom", bom_id, f"Ubah resep {existing.get('barang_jadi_nama')}")
    return serialize(await db.master_bom.find_one({"_id": oid(bom_id)}))


@router.delete("/bom/{bom_id}")
async def delete_bom(bom_id: str, user=Depends(require("produksi", "delete"))):
    existing = await db.master_bom.find_one({"_id": oid(bom_id), "deleted_at": None})
    if not existing:
        raise HTTPException(status_code=404, detail="BOM tidak ditemukan")
    await db.master_bom.update_one({"_id": oid(bom_id)}, {"$set": {"deleted_at": now_iso(), "is_active": False}})
    await log_audit(user, "delete", "produksi", "bom", bom_id, f"Hapus resep {existing.get('barang_jadi_nama')}")
    return {"ok": True}


# --------------- PRODUCTION ---------------
@router.post("/preview")
async def preview(payload: dict = Body(...), user=Depends(require("produksi", "view"))):
    bom = await db.master_bom.find_one({"_id": oid(payload.get("bom_id")), "deleted_at": None})
    if not bom:
        raise HTTPException(status_code=404, detail="Resep/BOM tidak ditemukan")
    qty_target = float(payload.get("qty_target") or 0)
    gudang_bb = payload.get("gudang_bb_id")
    if qty_target <= 0:
        raise HTTPException(status_code=400, detail="Jumlah produksi harus lebih dari 0")
    factor = qty_target / float(bom.get("output_qty") or 1)
    rows = []
    biaya_bahan = 0
    semua_cukup = True
    for it in bom.get("items", []):
        need = round(it["qty"] * factor, 4)
        avail = await available_qty("bahan_baku", it["item_id"], gudang_bb) if gudang_bb else 0
        avg = await avg_price_of("bahan_baku", it["item_id"], gudang_bb)
        cukup = avail + 1e-9 >= need
        if not cukup:
            semua_cukup = False
        biaya_bahan += need * avg
        rows.append({"item_nama": it["item_nama"], "satuan": it["satuan"], "butuh": need,
                     "tersedia": avail, "cukup": cukup, "harga": avg, "biaya": round(need * avg, 2)})
    biaya_tk = float(payload.get("biaya_tk") if payload.get("biaya_tk") is not None else bom.get("biaya_tk", 0)) * factor
    biaya_overhead = float(payload.get("biaya_overhead") if payload.get("biaya_overhead") is not None else bom.get("biaya_overhead", 0)) * factor
    total = biaya_bahan + biaya_tk + biaya_overhead
    return {
        "items": rows, "semua_cukup": semua_cukup,
        "biaya_bahan": round(biaya_bahan, 2), "biaya_tk": round(biaya_tk, 2),
        "biaya_overhead": round(biaya_overhead, 2), "total_hpp": round(total, 2),
        "hpp_per_unit": round(total / qty_target, 2) if qty_target else 0,
    }


@router.post("/process")
async def process(payload: dict = Body(...), user=Depends(require("produksi", "add"))):
    bom = await db.master_bom.find_one({"_id": oid(payload.get("bom_id")), "deleted_at": None})
    if not bom:
        raise HTTPException(status_code=404, detail="Resep/BOM tidak ditemukan")
    qty_target = float(payload.get("qty_target") or 0)
    qty_hasil = float(payload.get("qty_hasil") if payload.get("qty_hasil") not in (None, "") else qty_target)
    qty_reject = float(payload.get("qty_reject") or 0)
    qty_waste = float(payload.get("qty_waste") or 0)
    gudang_bb = payload.get("gudang_bb_id")
    gudang_bj = payload.get("gudang_bj_id")
    if qty_target <= 0 or qty_hasil <= 0:
        raise HTTPException(status_code=400, detail="Jumlah produksi & hasil harus lebih dari 0")
    if not gudang_bb or not gudang_bj:
        raise HTTPException(status_code=400, detail="Gudang bahan baku & barang jadi wajib dipilih")

    factor = qty_target / float(bom.get("output_qty") or 1)
    no = await get_next_code("PRD")
    gbb_nama = await gudang_name(gudang_bb)
    biaya_bahan = 0
    used = []
    for it in bom.get("items", []):
        need = round(it["qty"] * factor, 4)
        item = await get_item("bahan_baku", it["item_id"])
        cost = await consume_stock_fifo("bahan_baku", it["item_id"], gudang_bb, need, item,
                                        gbb_nama, user, "produksi_keluar", no, f"Konsumsi produksi {no}")
        biaya_bahan += cost
        used.append({"item_id": it["item_id"], "item_nama": item.get("nama"), "qty": need,
                     "satuan": item.get("satuan_nama"), "biaya": round(cost, 2)})

    biaya_tk = float(payload.get("biaya_tk") or 0)
    biaya_overhead = float(payload.get("biaya_overhead") or 0)
    total_hpp = round(biaya_bahan + biaya_tk + biaya_overhead, 2)
    hpp_per_unit = round(total_hpp / qty_hasil, 2) if qty_hasil > 0 else 0

    bj = await get_item("barang_jadi", bom["barang_jadi_id"])
    gbj_nama = await gudang_name(gudang_bj)
    batch = payload.get("batch") or (no)
    expired = payload.get("expired_date")
    _, new_qty, _ = await apply_delta("barang_jadi", bom["barang_jadi_id"], gudang_bj, batch,
                                      expired, qty_hasil, hpp_per_unit)
    await record_movement(no, "produksi_masuk", bj, "barang_jadi", bom["barang_jadi_id"], gudang_bj,
                          gbj_nama, batch, expired, qty_hasil, hpp_per_unit, new_qty,
                          f"Hasil produksi {no}", user, ref=no)

    reject_rate = round(qty_reject / (qty_hasil + qty_reject) * 100, 2) if (qty_hasil + qty_reject) > 0 else 0
    achievement = round(qty_hasil / qty_target * 100, 2) if qty_target > 0 else 0
    doc = {
        "no_produksi": no, "tanggal": payload.get("tanggal") or now_iso()[:10],
        "bom_id": payload["bom_id"], "barang_jadi_id": bom["barang_jadi_id"],
        "barang_jadi_nama": bj.get("nama"), "satuan": bj.get("satuan_nama"),
        "qty_target": qty_target, "qty_hasil": qty_hasil, "qty_reject": qty_reject, "qty_waste": qty_waste,
        "gudang_bb_id": gudang_bb, "gudang_bj_id": gudang_bj, "batch": batch, "expired_date": expired,
        "bahan_terpakai": used, "biaya_bahan": round(biaya_bahan, 2),
        "biaya_tk": biaya_tk, "biaya_overhead": biaya_overhead,
        "total_hpp": total_hpp, "hpp_per_unit": hpp_per_unit,
        "reject_rate": reject_rate, "achievement": achievement, "status": "selesai",
        "created_at": now_iso(), "created_by": user["name"],
    }
    res = await db.production_orders.insert_one(doc)
    doc["_id"] = res.inserted_id
    await db.master_barang_jadi.update_one({"_id": oid(bom["barang_jadi_id"])},
                                           {"$set": {"harga_pokok": hpp_per_unit}})
    await log_audit(user, "create", "produksi", "production_order", no,
                    f"Produksi {bj.get('nama')} {qty_hasil} unit, HPP/unit {hpp_per_unit}")
    return serialize(doc)


@router.get("/orders")
async def list_orders(q: Optional[str] = None, page: int = 1, limit: int = 20,
                      user=Depends(require("produksi", "view"))):
    flt = {}
    if q:
        flt["$or"] = [{"no_produksi": {"$regex": q, "$options": "i"}},
                      {"barang_jadi_nama": {"$regex": q, "$options": "i"}}]
    total = await db.production_orders.count_documents(flt)
    cursor = db.production_orders.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    return {"items": [serialize(d) async for d in cursor], "total": total, "page": page, "limit": limit}
