from fastapi import APIRouter, Request, HTTPException, Depends, Body, Query
from typing import Optional

from db import db, oid, now_iso, get_next_code, serialize, log_audit
from rbac import require

router = APIRouter(prefix="/api/master", tags=["master"])

# entity_key -> config
MASTER = {
    "perusahaan": {"coll": "master_perusahaan", "prefix": "COMP", "label": "Perusahaan"},
    "cabang": {"coll": "master_cabang", "prefix": "CB", "label": "Cabang"},
    "gudang": {"coll": "master_gudang", "prefix": "GD", "label": "Gudang"},
    "rak": {"coll": "master_rak", "prefix": "RK", "label": "Rak / Lokasi"},
    "kategori": {"coll": "master_kategori", "prefix": "KAT", "label": "Kategori"},
    "satuan": {"coll": "master_satuan", "prefix": "UOM", "label": "Satuan"},
    "merek": {"coll": "master_merek", "prefix": "MRK", "label": "Merek"},
    "supplier": {"coll": "master_supplier", "prefix": "SUP", "label": "Supplier"},
    "pelanggan": {"coll": "master_pelanggan", "prefix": "CUST", "label": "Pelanggan"},
    "bahan_baku": {"coll": "master_bahan_baku", "prefix": "BB", "label": "Bahan Baku"},
    "barang_jadi": {"coll": "master_barang_jadi", "prefix": "BJ", "label": "Barang Jadi"},
    "karyawan": {"coll": "master_karyawan", "prefix": "EMP", "label": "Karyawan"},
    "jabatan": {"coll": "master_jabatan", "prefix": "JB", "label": "Jabatan"},
    "divisi": {"coll": "master_divisi", "prefix": "DIV", "label": "Divisi"},
    "rekening": {"coll": "master_rekening", "prefix": "AKUN", "label": "Rekening Kas/Bank"},
    "pajak": {"coll": "master_pajak", "prefix": "TAX", "label": "Pajak"},
    "biaya": {"coll": "master_biaya", "prefix": "BY", "label": "Biaya Operasional"},
    "metode_pembayaran": {"coll": "master_metode", "prefix": "PM", "label": "Metode Pembayaran"},
}

# fields that must never be mass-assigned from client
PROTECTED = {"_id", "id", "kode", "created_at", "created_by", "updated_at",
             "updated_by", "deleted_at"}


def cfg(entity: str):
    c = MASTER.get(entity)
    if not c:
        raise HTTPException(status_code=404, detail="Master data tidak ditemukan")
    return c


def clean_payload(payload: dict) -> dict:
    return {k: v for k, v in (payload or {}).items() if k not in PROTECTED}


@router.get("/{entity}")
async def list_entity(entity: str, request: Request,
                      q: Optional[str] = None, page: int = 1, limit: int = 20,
                      active: Optional[str] = None,
                      user=Depends(require("master", "view"))):
    c = cfg(entity)
    coll = db[c["coll"]]
    flt = {"deleted_at": None}
    if active == "true":
        flt["is_active"] = True
    elif active == "false":
        flt["is_active"] = False
    # generic exact filters via f_<field>=value
    for k, v in request.query_params.items():
        if k.startswith("f_") and v not in (None, ""):
            flt[k[2:]] = v
    if q:
        flt["$or"] = [
            {"nama": {"$regex": q, "$options": "i"}},
            {"kode": {"$regex": q, "$options": "i"}},
        ]
    total = await coll.count_documents(flt)
    page = max(1, page)
    cursor = coll.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    items = [serialize(d) async for d in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/{entity}/options")
async def options(entity: str, user=Depends(require("master", "view"))):
    c = cfg(entity)
    coll = db[c["coll"]]
    cursor = coll.find({"deleted_at": None, "is_active": True}).sort("nama", 1)
    return [serialize(d) async for d in cursor]


@router.get("/{entity}/{item_id}")
async def get_one(entity: str, item_id: str, user=Depends(require("master", "view"))):
    c = cfg(entity)
    doc = await db[c["coll"]].find_one({"_id": oid(item_id), "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return serialize(doc)


@router.post("/{entity}")
async def create_entity(entity: str, payload: dict = Body(...),
                        user=Depends(require("master", "add"))):
    c = cfg(entity)
    data = clean_payload(payload)
    if not data.get("nama"):
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    kode = payload.get("kode") or await get_next_code(c["prefix"])
    if await db[c["coll"]].find_one({"kode": kode, "deleted_at": None}):
        raise HTTPException(status_code=400, detail="Kode sudah digunakan")
    doc = {
        **data,
        "kode": kode,
        "is_active": payload.get("is_active", True),
        "created_at": now_iso(),
        "created_by": user["name"],
        "updated_at": now_iso(),
        "updated_by": user["name"],
        "deleted_at": None,
    }
    res = await db[c["coll"]].insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user, "create", "master", entity, str(res.inserted_id),
                    f"Tambah {c['label']}: {data.get('nama')}", after=data)
    return serialize(doc)


@router.put("/{entity}/{item_id}")
async def update_entity(entity: str, item_id: str, payload: dict = Body(...),
                        user=Depends(require("master", "edit"))):
    c = cfg(entity)
    existing = await db[c["coll"]].find_one({"_id": oid(item_id), "deleted_at": None})
    if not existing:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    data = clean_payload(payload)
    if "is_active" in payload:
        data["is_active"] = payload["is_active"]
    data["updated_at"] = now_iso()
    data["updated_by"] = user["name"]
    await db[c["coll"]].update_one({"_id": oid(item_id)}, {"$set": data})
    before = {k: existing.get(k) for k in data.keys()}
    await log_audit(user, "update", "master", entity, item_id,
                    f"Ubah {c['label']}: {existing.get('nama')}", before=before, after=data)
    doc = await db[c["coll"]].find_one({"_id": oid(item_id)})
    return serialize(doc)


@router.delete("/{entity}/{item_id}")
async def delete_entity(entity: str, item_id: str,
                        user=Depends(require("master", "delete"))):
    c = cfg(entity)
    existing = await db[c["coll"]].find_one({"_id": oid(item_id), "deleted_at": None})
    if not existing:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await db[c["coll"]].update_one({"_id": oid(item_id)},
                                   {"$set": {"deleted_at": now_iso(), "is_active": False,
                                             "updated_by": user["name"]}})
    await log_audit(user, "delete", "master", entity, item_id,
                    f"Hapus {c['label']}: {existing.get('nama')}", before=serialize(existing))
    return {"ok": True}
