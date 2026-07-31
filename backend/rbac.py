from fastapi import Depends, HTTPException
from security import get_current_user

MODULES = ["dashboard", "master", "gudang", "laporan", "pengaturan", "audit",
           "pembelian", "produksi", "penjualan", "keuangan", "hr"]
ACTIONS = ["view", "add", "edit", "delete", "approve", "print", "export"]

MODULE_LABELS = {
    "dashboard": "Dashboard",
    "master": "Master Data",
    "gudang": "Gudang & Stok",
    "laporan": "Laporan",
    "pengaturan": "Pengaturan",
    "audit": "Audit Trail",
    "pembelian": "Pembelian",
    "produksi": "Produksi",
    "penjualan": "Penjualan",
    "keuangan": "Keuangan",
    "hr": "HR & Payroll",
}


def _all():
    return {m: list(ACTIONS) for m in MODULES}


def _pick(spec):
    """spec: dict module->actions list; returns full permission dict."""
    perms = {}
    for m, acts in spec.items():
        perms[m] = list(acts)
    return perms


VIEW_ONLY = ["view", "print", "export"]
FULL = list(ACTIONS)
NO_DELETE = ["view", "add", "edit", "approve", "print", "export"]

DEFAULT_ROLES = [
    {"name": "super_admin", "label": "Super Admin", "is_system": True, "permissions": _all()},
    {"name": "owner", "label": "Owner / Direktur", "is_system": True, "permissions": _all()},
    {"name": "manager", "label": "Manager", "is_system": True,
     "permissions": _pick({m: NO_DELETE for m in MODULES})},
    {"name": "admin", "label": "Admin", "is_system": True,
     "permissions": _pick({"dashboard": VIEW_ONLY, "master": FULL, "gudang": FULL,
                           "laporan": VIEW_ONLY, "audit": ["view"]})},
    {"name": "finance", "label": "Finance", "is_system": True,
     "permissions": _pick({"dashboard": VIEW_ONLY, "master": ["view"], "keuangan": FULL,
                           "laporan": VIEW_ONLY})},
    {"name": "purchasing", "label": "Purchasing", "is_system": True,
     "permissions": _pick({"dashboard": VIEW_ONLY, "master": NO_DELETE, "pembelian": FULL,
                           "gudang": ["view"], "laporan": VIEW_ONLY})},
    {"name": "warehouse", "label": "Warehouse / Gudang", "is_system": True,
     "permissions": _pick({"dashboard": VIEW_ONLY, "master": NO_DELETE, "gudang": FULL,
                           "laporan": VIEW_ONLY})},
    {"name": "produksi", "label": "Produksi", "is_system": True,
     "permissions": _pick({"dashboard": VIEW_ONLY, "master": ["view"], "produksi": FULL,
                           "gudang": ["view"], "laporan": VIEW_ONLY})},
    {"name": "sales", "label": "Sales", "is_system": True,
     "permissions": _pick({"dashboard": VIEW_ONLY, "master": NO_DELETE, "penjualan": FULL,
                           "laporan": VIEW_ONLY})},
    {"name": "hr", "label": "HR / Payroll", "is_system": True,
     "permissions": _pick({"dashboard": VIEW_ONLY, "master": NO_DELETE, "hr": FULL,
                           "laporan": VIEW_ONLY})},
]


def require(module: str, action: str):
    async def dep(user=Depends(get_current_user)):
        perms = user.get("permissions") or {}
        allowed = perms.get(module, [])
        if action not in allowed:
            raise HTTPException(status_code=403,
                                detail=f"Anda tidak memiliki hak akses untuk {action} pada modul {MODULE_LABELS.get(module, module)}")
        return user
    return dep
