from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from bson import ObjectId

from db import db, oid, serialize, log_audit
from security import get_current_user
from rbac import require
from stock_router import ITEM_COLL
from seed import seed_admin

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/notifications")
async def notifications(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    soon = (now + timedelta(days=30)).date().isoformat()
    today = now.date().isoformat()
    alerts = []
    async for b in db.stock_balances.find({}):
        item = await db[ITEM_COLL[b["item_type"]]].find_one({"_id": oid(b["item_id"])})
        if not item:
            continue
        stok_min = float(item.get("stok_min") or 0)
        qty = b.get("qty", 0)
        nama = item.get("nama")
        if qty < 0:
            alerts.append({"type": "stok_negatif", "level": "danger",
                           "title": "Stok Negatif",
                           "message": f"{nama} memiliki stok negatif ({qty})"})
        elif qty <= stok_min:
            alerts.append({"type": "stok_minimum", "level": "warning",
                           "title": "Stok Minimum",
                           "message": f"{nama} di bawah/mencapai stok minimum ({qty} <= {stok_min})"})
        exp = b.get("expired_date")
        if exp and qty > 0:
            if exp < today:
                alerts.append({"type": "expired", "level": "danger",
                               "title": "Produk Kadaluarsa",
                               "message": f"{nama} (batch {b.get('batch')}) sudah kadaluarsa ({exp})"})
            elif exp <= soon:
                alerts.append({"type": "mendekati_expired", "level": "warning",
                               "title": "Mendekati Kadaluarsa",
                               "message": f"{nama} (batch {b.get('batch')}) akan kadaluarsa {exp}"})
    order = {"danger": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: order.get(a["level"], 3))
    return {"count": len(alerts), "alerts": alerts}


@router.get("/audit")
async def audit_logs(q: Optional[str] = None, action: Optional[str] = None,
                     module: Optional[str] = None, page: int = 1, limit: int = 20,
                     user=Depends(require("audit", "view"))):
    flt = {}
    if action:
        flt["action"] = action
    if module:
        flt["module"] = module
    if q:
        flt["$or"] = [{"description": {"$regex": q, "$options": "i"}},
                      {"user_name": {"$regex": q, "$options": "i"}}]
    total = await db.audit_logs.count_documents(flt)
    page = max(1, page)
    cursor = db.audit_logs.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    items = [serialize(d) async for d in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit}


BACKUP_COLLECTIONS = [
    "users", "roles", "master_perusahaan", "master_cabang", "master_gudang", "master_rak",
    "master_kategori", "master_satuan", "master_merek", "master_supplier", "master_pelanggan",
    "master_bahan_baku", "master_barang_jadi", "master_karyawan", "master_jabatan",
    "master_divisi", "master_rekening", "master_pajak", "master_biaya", "master_metode",
    "stock_movements", "stock_balances", "counters",
]


@router.get("/backup")
async def backup(user=Depends(require("pengaturan", "export"))):
    data = {}
    for coll in BACKUP_COLLECTIONS:
        docs = []
        async for d in db[coll].find({}):
            d = dict(d)
            if "_id" in d:
                d["id"] = str(d.pop("_id"))
            docs.append(d)
        data[coll] = docs
    await log_audit(user, "export", "pengaturan", "backup", None, "Backup data diunduh")
    return {"generated_at": datetime.now(timezone.utc).isoformat(),
            "version": 2, "collections": data}


class RestoreInput(BaseModel):
    generated_at: Optional[str] = None
    version: Optional[int] = None
    collections: Dict[str, List[Dict[str, Any]]]


def _to_mongo(doc: dict) -> dict:
    """Reverse of export: 'id' string -> '_id' (ObjectId if valid, else raw string)."""
    doc = dict(doc)
    raw_id = doc.pop("id", None)
    if raw_id is not None:
        obj = oid(raw_id)
        doc["_id"] = obj if obj is not None else raw_id
    return doc


@router.post("/backup/restore")
async def restore_backup(body: RestoreInput, user=Depends(require("pengaturan", "edit"))):
    if not body.collections:
        raise HTTPException(status_code=400, detail="File backup tidak berisi data koleksi")

    valid = {k: v for k, v in body.collections.items() if k in BACKUP_COLLECTIONS}
    skipped = [k for k in body.collections if k not in BACKUP_COLLECTIONS]
    if not valid:
        raise HTTPException(status_code=400,
                            detail="Tidak ada koleksi yang dikenali dalam file backup")

    # Preserve password hashes: old backups (version 1) stripped password_hash.
    existing_hashes = {}
    async for u in db.users.find({}, {"email": 1, "password_hash": 1}):
        if u.get("email") and u.get("password_hash"):
            existing_hashes[u["email"]] = u["password_hash"]

    restored = {}
    for coll, docs in valid.items():
        mongo_docs = []
        for d in docs:
            if not isinstance(d, dict):
                continue
            md = _to_mongo(d)
            if coll == "users" and not md.get("password_hash"):
                kept = existing_hashes.get((md.get("email") or "").lower())
                if kept:
                    md["password_hash"] = kept
            mongo_docs.append(md)
        await db[coll].delete_many({})
        if mongo_docs:
            try:
                await db[coll].insert_many(mongo_docs, ordered=False)
            except Exception as e:
                raise HTTPException(status_code=400,
                                    detail=f"Gagal memulihkan koleksi '{coll}': {e}")
        restored[coll] = len(mongo_docs)

    # Safety net: super admin dari environment harus selalu bisa login setelah restore.
    if "users" in valid:
        await seed_admin()

    total = sum(restored.values())
    await log_audit(user, "restore", "pengaturan", "backup", None,
                    f"Restore backup: {total} dokumen, {len(restored)} koleksi "
                    f"(sumber: {body.generated_at or 'tidak diketahui'})")
    return {"restored": restored, "total": total, "skipped": skipped}
