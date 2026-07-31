from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, EmailStr
from typing import Optional

from db import db, oid, now_iso, serialize, log_audit
from rbac import require, DEFAULT_ROLES, MODULES, ACTIONS, MODULE_LABELS
from security import hash_password

router = APIRouter(prefix="/api", tags=["settings"])


# ---------------- USERS ----------------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    is_active: bool = True


@router.get("/users")
async def list_users(q: Optional[str] = None, page: int = 1, limit: int = 20,
                     user=Depends(require("pengaturan", "view"))):
    flt = {}
    if q:
        flt["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                      {"email": {"$regex": q, "$options": "i"}}]
    total = await db.users.count_documents(flt)
    page = max(1, page)
    cursor = db.users.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    items = [serialize(d) async for d in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("/users")
async def create_user(body: UserCreate, user=Depends(require("pengaturan", "add"))):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    if not await db.roles.find_one({"name": body.role}):
        raise HTTPException(status_code=400, detail="Role tidak valid")
    doc = {
        "name": body.name, "email": email, "password_hash": hash_password(body.password),
        "role": body.role, "is_active": body.is_active,
        "created_at": now_iso(), "created_by": user["name"], "updated_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user, "create", "pengaturan", "user", str(res.inserted_id),
                    f"Tambah pengguna: {email} ({body.role})")
    return serialize(doc)


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: dict = Body(...),
                      user=Depends(require("pengaturan", "edit"))):
    existing = await db.users.find_one({"_id": oid(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    update = {}
    for f in ("name", "role", "is_active"):
        if f in payload:
            update[f] = payload[f]
    if payload.get("password"):
        update["password_hash"] = hash_password(payload["password"])
    if payload.get("email"):
        new_email = payload["email"].lower().strip()
        clash = await db.users.find_one({"email": new_email, "_id": {"$ne": oid(user_id)}})
        if clash:
            raise HTTPException(status_code=400, detail="Email sudah digunakan")
        update["email"] = new_email
    update["updated_at"] = now_iso()
    await db.users.update_one({"_id": oid(user_id)}, {"$set": update})
    await log_audit(user, "update", "pengaturan", "user", user_id,
                    f"Ubah pengguna: {existing.get('email')}")
    return serialize(await db.users.find_one({"_id": oid(user_id)}))


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require("pengaturan", "delete"))):
    existing = await db.users.find_one({"_id": oid(user_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if str(existing["_id"]) == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    if existing.get("role") == "super_admin":
        count = await db.users.count_documents({"role": "super_admin", "is_active": True})
        if count <= 1:
            raise HTTPException(status_code=400, detail="Minimal harus ada 1 Super Admin aktif")
    await db.users.delete_one({"_id": oid(user_id)})
    await log_audit(user, "delete", "pengaturan", "user", user_id,
                    f"Hapus pengguna: {existing.get('email')}")
    return {"ok": True}


# ---------------- ROLES ----------------
@router.get("/roles")
async def list_roles(user=Depends(require("pengaturan", "view"))):
    roles = [serialize(d) async for d in db.roles.find({}).sort("name", 1)]
    return {"roles": roles, "modules": MODULES, "actions": ACTIONS,
            "module_labels": MODULE_LABELS}


@router.post("/roles")
async def create_role(payload: dict = Body(...), user=Depends(require("pengaturan", "add"))):
    name = (payload.get("name") or "").strip().lower().replace(" ", "_")
    if not name:
        raise HTTPException(status_code=400, detail="Nama role wajib diisi")
    if await db.roles.find_one({"name": name}):
        raise HTTPException(status_code=400, detail="Role sudah ada")
    doc = {"name": name, "label": payload.get("label") or name,
           "permissions": payload.get("permissions", {}), "is_system": False,
           "created_at": now_iso()}
    res = await db.roles.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user, "create", "pengaturan", "role", name, f"Tambah role: {name}")
    return serialize(doc)


@router.put("/roles/{name}")
async def update_role(name: str, payload: dict = Body(...),
                      user=Depends(require("pengaturan", "edit"))):
    role = await db.roles.find_one({"name": name})
    if not role:
        raise HTTPException(status_code=404, detail="Role tidak ditemukan")
    update = {}
    if "permissions" in payload:
        update["permissions"] = payload["permissions"]
    if "label" in payload:
        update["label"] = payload["label"]
    await db.roles.update_one({"name": name}, {"$set": update})
    await log_audit(user, "update", "pengaturan", "role", name, f"Ubah hak akses role: {name}")
    return serialize(await db.roles.find_one({"name": name}))


@router.delete("/roles/{name}")
async def delete_role(name: str, user=Depends(require("pengaturan", "delete"))):
    role = await db.roles.find_one({"name": name})
    if not role:
        raise HTTPException(status_code=404, detail="Role tidak ditemukan")
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Role sistem tidak dapat dihapus")
    if await db.users.find_one({"role": name}):
        raise HTTPException(status_code=400, detail="Role masih digunakan oleh pengguna")
    await db.roles.delete_one({"name": name})
    await log_audit(user, "delete", "pengaturan", "role", name, f"Hapus role: {name}")
    return {"ok": True}
