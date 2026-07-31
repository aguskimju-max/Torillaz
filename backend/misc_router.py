from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta

from db import db, oid, serialize
from security import get_current_user
from rbac import require
from stock_router import ITEM_COLL

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
            docs.append(serialize(d))
        data[coll] = docs
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "collections": data}
