from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone

from db import db, oid, now_iso, get_next_code, serialize, log_audit
from rbac import require

router = APIRouter(prefix="/api/finance", tags=["finance"])


async def _rekening_nama(rekening_id):
    if not rekening_id:
        return None
    r = await db.master_rekening.find_one({"_id": oid(rekening_id)})
    return r.get("nama") if r else None


async def post_cash_txn(rekening_id, tipe, jumlah, kategori, keterangan, tanggal, user,
                        ref_type="manual", ref_id=None, is_beban=False):
    """Create a cash/bank ledger entry. Skips silently if no rekening chosen."""
    if not rekening_id:
        return None
    no = await get_next_code("KAS")
    doc = {
        "no": no, "tanggal": (tanggal or now_iso()[:10])[:10], "tipe": tipe,
        "jumlah": round(float(jumlah), 2),
        "kategori": kategori or ("Penjualan" if tipe == "masuk" else "Lainnya"),
        "rekening_id": rekening_id, "rekening_nama": await _rekening_nama(rekening_id),
        "keterangan": keterangan, "ref_type": ref_type, "ref_id": ref_id,
        "is_beban": bool(is_beban),
        "created_at": now_iso(),
        "created_by": user.get("name") if isinstance(user, dict) else str(user),
    }
    res = await db.finance_transactions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def _saldo_map():
    agg = {}
    async for t in db.finance_transactions.find({}):
        rid = t.get("rekening_id")
        if not rid:
            continue
        a = agg.setdefault(rid, {"masuk": 0, "keluar": 0})
        if t.get("tipe") == "masuk":
            a["masuk"] += t.get("jumlah", 0)
        else:
            a["keluar"] += t.get("jumlah", 0)
    return agg


@router.get("/rekening")
async def rekening_saldo(user=Depends(require("keuangan", "view"))):
    agg = await _saldo_map()
    rows, total = [], 0
    async for r in db.master_rekening.find({"deleted_at": None}).sort("nama", 1):
        rid = str(r["_id"])
        mv = agg.get(rid, {"masuk": 0, "keluar": 0})
        awal = float(r.get("saldo_awal") or 0)
        saldo = round(awal + mv["masuk"] - mv["keluar"], 2)
        total += saldo
        rows.append({"id": rid, "nama": r.get("nama"), "tipe": r.get("tipe"),
                     "no_rekening": r.get("no_rekening"), "saldo_awal": awal,
                     "masuk": round(mv["masuk"], 2), "keluar": round(mv["keluar"], 2), "saldo": saldo})
    return {"rekening": rows, "total_saldo": round(total, 2)}


@router.get("/transactions")
async def list_txn(tipe: Optional[str] = None, rekening_id: Optional[str] = None,
                   start: Optional[str] = None, end: Optional[str] = None,
                   q: Optional[str] = None, page: int = 1, limit: int = 20,
                   user=Depends(require("keuangan", "view"))):
    flt = {}
    if tipe and tipe != "all":
        flt["tipe"] = tipe
    if rekening_id and rekening_id != "all":
        flt["rekening_id"] = rekening_id
    if start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        flt["tanggal"] = rng
    if q:
        flt["$or"] = [{"no": {"$regex": q, "$options": "i"}},
                      {"kategori": {"$regex": q, "$options": "i"}},
                      {"keterangan": {"$regex": q, "$options": "i"}}]
    total = await db.finance_transactions.count_documents(flt)
    cursor = db.finance_transactions.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    return {"items": [serialize(d) async for d in cursor], "total": total, "page": page, "limit": limit}


@router.post("/transactions")
async def create_txn(payload: dict = Body(...), user=Depends(require("keuangan", "add"))):
    tipe = payload.get("tipe")
    if tipe not in ("masuk", "keluar"):
        raise HTTPException(status_code=400, detail="Tipe transaksi tidak valid")
    jumlah = float(payload.get("jumlah") or 0)
    if jumlah <= 0:
        raise HTTPException(status_code=400, detail="Jumlah harus lebih dari 0")
    if not payload.get("rekening_id"):
        raise HTTPException(status_code=400, detail="Rekening wajib dipilih")
    doc = await post_cash_txn(
        payload["rekening_id"], tipe, jumlah, payload.get("kategori"),
        payload.get("keterangan"), payload.get("tanggal"), user,
        ref_type="manual", is_beban=(tipe == "keluar" and payload.get("is_beban", True)))
    await log_audit(user, "create", "keuangan", "cash_txn", doc["no"],
                    f"Kas {tipe} {jumlah} - {doc['kategori']}")
    return serialize(doc)


@router.delete("/transactions/{txn_id}")
async def delete_txn(txn_id: str, user=Depends(require("keuangan", "delete"))):
    t = await db.finance_transactions.find_one({"_id": oid(txn_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if t.get("ref_type") != "manual":
        raise HTTPException(status_code=400, detail="Transaksi otomatis dari modul lain tidak bisa dihapus manual")
    await db.finance_transactions.delete_one({"_id": oid(txn_id)})
    await log_audit(user, "delete", "keuangan", "cash_txn", t.get("no"), f"Hapus kas {t.get('no')}")
    return {"ok": True}


@router.get("/summary")
async def summary(user=Depends(require("keuangan", "view"))):
    now = datetime.now(timezone.utc)
    month = now.strftime("%Y-%m")
    agg = await _saldo_map()
    total_saldo = 0
    async for r in db.master_rekening.find({"deleted_at": None}):
        rid = str(r["_id"])
        mv = agg.get(rid, {"masuk": 0, "keluar": 0})
        total_saldo += float(r.get("saldo_awal") or 0) + mv["masuk"] - mv["keluar"]
    masuk_bulan = keluar_bulan = 0
    async for t in db.finance_transactions.find({"tanggal": {"$regex": f"^{month}"}}):
        if t.get("tipe") == "masuk":
            masuk_bulan += t.get("jumlah", 0)
        else:
            keluar_bulan += t.get("jumlah", 0)
    return {"total_saldo": round(total_saldo, 2), "masuk_bulan": round(masuk_bulan, 2),
            "keluar_bulan": round(keluar_bulan, 2)}


@router.get("/laba-rugi")
async def laba_rugi(start: Optional[str] = None, end: Optional[str] = None,
                    user=Depends(require("keuangan", "view"))):
    now = datetime.now(timezone.utc)
    if not start:
        start = now.strftime("%Y-%m-01")
    if not end:
        end = now.date().isoformat()
    valid = {"dikirim", "sebagian", "lunas"}
    pendapatan = hpp = pajak = 0
    async for so in db.sales_orders.find({}):
        if so.get("status") not in valid:
            continue
        tgl = (so.get("tanggal") or "")[:10]
        if not (start <= tgl <= end):
            continue
        pendapatan += so.get("subtotal", 0)
        hpp += so.get("total_hpp", 0)
        pajak += so.get("pajak_nominal", 0)
    laba_kotor = round(pendapatan - hpp, 2)

    beban_map = {}
    total_beban = 0
    async for t in db.finance_transactions.find({"tipe": "keluar"}):
        if not t.get("is_beban", True):
            continue
        tgl = (t.get("tanggal") or "")[:10]
        if not (start <= tgl <= end):
            continue
        kat = t.get("kategori") or "Lainnya"
        beban_map[kat] = beban_map.get(kat, 0) + t.get("jumlah", 0)
        total_beban += t.get("jumlah", 0)
    beban = [{"kategori": k, "jumlah": round(v, 2)} for k, v in sorted(beban_map.items(), key=lambda x: -x[1])]
    return {
        "start": start, "end": end,
        "pendapatan": round(pendapatan, 2), "hpp": round(hpp, 2), "laba_kotor": laba_kotor,
        "beban": beban, "total_beban": round(total_beban, 2), "pajak": round(pajak, 2),
        "laba_bersih": round(laba_kotor - total_beban, 2),
    }
