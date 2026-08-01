from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone
import calendar

from db import db, oid, now_iso, get_next_code, serialize, log_audit
from rbac import require
from finance_router import post_cash_txn

router = APIRouter(prefix="/api/hr", tags=["hr"])

ATT_STATUS = {"hadir", "izin", "sakit", "alpha", "libur"}


async def _karyawan(kid):
    return await db.master_karyawan.find_one({"_id": oid(kid), "deleted_at": None})


async def _jabatan_map():
    return {str(d["_id"]): d.get("nama") async for d in db.master_jabatan.find({})}


# ---------------- ABSENSI ----------------
@router.get("/attendance")
async def list_attendance(tanggal: Optional[str] = None, karyawan_id: Optional[str] = None,
                          start: Optional[str] = None, end: Optional[str] = None,
                          page: int = 1, limit: int = 50, user=Depends(require("hr", "view"))):
    flt = {}
    if tanggal:
        flt["tanggal"] = tanggal
    elif start or end:
        rng = {}
        if start:
            rng["$gte"] = start
        if end:
            rng["$lte"] = end
        flt["tanggal"] = rng
    if karyawan_id and karyawan_id != "all":
        flt["karyawan_id"] = karyawan_id
    total = await db.hr_attendance.count_documents(flt)
    cursor = db.hr_attendance.find(flt).sort("tanggal", -1).skip((page - 1) * limit).limit(limit)
    return {"items": [serialize(d) async for d in cursor], "total": total, "page": page, "limit": limit}


@router.post("/attendance/bulk")
async def save_attendance(payload: dict = Body(...), user=Depends(require("hr", "add"))):
    tanggal = payload.get("tanggal")
    if not tanggal:
        raise HTTPException(status_code=400, detail="Tanggal wajib diisi")
    entries = payload.get("entries") or []
    saved = 0
    for e in entries:
        kid = e.get("karyawan_id")
        status = e.get("status") or "hadir"
        if not kid or status not in ATT_STATUS:
            continue
        kar = await _karyawan(kid)
        doc = {
            "karyawan_id": kid, "karyawan_nama": kar.get("nama") if kar else "?",
            "tanggal": tanggal, "status": status,
            "jam_masuk": e.get("jam_masuk") or "", "jam_keluar": e.get("jam_keluar") or "",
            "jam_lembur": float(e.get("jam_lembur") or 0),
            "catatan": e.get("catatan") or "",
            "updated_at": now_iso(), "updated_by": user["name"],
        }
        await db.hr_attendance.update_one(
            {"karyawan_id": kid, "tanggal": tanggal},
            {"$set": doc, "$setOnInsert": {"created_at": now_iso()}}, upsert=True)
        saved += 1
    await log_audit(user, "create", "hr", "attendance", tanggal, f"Simpan absensi {tanggal} ({saved} karyawan)")
    return {"ok": True, "saved": saved}


@router.delete("/attendance/{att_id}")
async def delete_attendance(att_id: str, user=Depends(require("hr", "delete"))):
    await db.hr_attendance.delete_one({"_id": oid(att_id)})
    return {"ok": True}


async def _recap(karyawan_id, periode):
    r = {"hadir": 0, "izin": 0, "sakit": 0, "alpha": 0, "libur": 0, "jam_lembur": 0.0}
    async for a in db.hr_attendance.find({"karyawan_id": karyawan_id, "tanggal": {"$regex": f"^{periode}"}}):
        st = a.get("status", "hadir")
        if st in r:
            r[st] += 1
        r["jam_lembur"] += float(a.get("jam_lembur") or 0)
    return r


@router.get("/attendance/recap")
async def attendance_recap(periode: str, user=Depends(require("hr", "view"))):
    jab = await _jabatan_map()
    rows = []
    async for kar in db.master_karyawan.find({"deleted_at": None, "is_active": True}).sort("nama", 1):
        kid = str(kar["_id"])
        r = await _recap(kid, periode)
        rows.append({
            "karyawan_id": kid, "karyawan_nama": kar.get("nama"),
            "jabatan_nama": jab.get(str(kar.get("jabatan_id"))) or "-",
            "hadir": r["hadir"], "izin": r["izin"], "sakit": r["sakit"],
            "alpha": r["alpha"], "libur": r["libur"], "jam_lembur": r["jam_lembur"],
            "tercatat": r["hadir"] + r["izin"] + r["sakit"] + r["alpha"] + r["libur"],
        })
    return {"periode": periode, "items": rows}


@router.get("/attendance/monthly")
async def attendance_monthly(periode: str, user=Depends(require("hr", "view"))):
    try:
        year, month = int(periode[:4]), int(periode[5:7])
        days_in_month = calendar.monthrange(year, month)[1]
    except Exception:
        raise HTTPException(status_code=400, detail="Periode tidak valid (format YYYY-MM)")
    jab = await _jabatan_map()
    records = {}
    async for a in db.hr_attendance.find({"tanggal": {"$regex": f"^{periode}"}}):
        records.setdefault(a.get("karyawan_id"), []).append(a)
    rows = []
    async for kar in db.master_karyawan.find({"deleted_at": None, "is_active": True}).sort("nama", 1):
        kid = str(kar["_id"])
        daily, lembur_daily = {}, {}
        summary = {"hadir": 0, "izin": 0, "sakit": 0, "alpha": 0, "libur": 0, "jam_lembur": 0.0}
        for a in records.get(kid, []):
            tgl = a.get("tanggal", "")
            try:
                day = str(int(tgl[8:10]))
            except Exception:
                continue
            st = a.get("status", "hadir")
            daily[day] = st
            lem = float(a.get("jam_lembur") or 0)
            if lem:
                lembur_daily[day] = lem
            if st in summary:
                summary[st] += 1
            summary["jam_lembur"] += lem
        rows.append({
            "karyawan_id": kid, "karyawan_nama": kar.get("nama"),
            "jabatan_nama": jab.get(str(kar.get("jabatan_id"))) or "-",
            "daily": daily, "lembur_daily": lembur_daily,
            "hadir": summary["hadir"], "izin": summary["izin"], "sakit": summary["sakit"],
            "alpha": summary["alpha"], "libur": summary["libur"], "jam_lembur": summary["jam_lembur"],
            "tercatat": summary["hadir"] + summary["izin"] + summary["sakit"] + summary["alpha"] + summary["libur"],
        })
    return {"periode": periode, "days": days_in_month, "items": rows}


# ---------------- KASBON ----------------
@router.get("/kasbon")
async def list_kasbon(status: Optional[str] = None, karyawan_id: Optional[str] = None,
                      page: int = 1, limit: int = 50, user=Depends(require("hr", "view"))):
    flt = {}
    if status and status != "all":
        flt["status"] = status
    if karyawan_id and karyawan_id != "all":
        flt["karyawan_id"] = karyawan_id
    total = await db.hr_kasbon.count_documents(flt)
    cursor = db.hr_kasbon.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    total_aktif = 0
    async for k in db.hr_kasbon.find({"status": "aktif"}):
        total_aktif += k.get("sisa", 0)
    return {"items": [serialize(d) async for d in cursor], "total": total,
            "total_aktif": round(total_aktif, 2), "page": page, "limit": limit}


@router.post("/kasbon")
async def create_kasbon(payload: dict = Body(...), user=Depends(require("hr", "add"))):
    kar = await _karyawan(payload.get("karyawan_id"))
    if not kar:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    jumlah = float(payload.get("jumlah") or 0)
    if jumlah <= 0:
        raise HTTPException(status_code=400, detail="Jumlah kasbon harus lebih dari 0")
    no = await get_next_code("KSB")
    doc = {
        "no": no, "karyawan_id": payload["karyawan_id"], "karyawan_nama": kar.get("nama"),
        "tanggal": payload.get("tanggal") or now_iso()[:10], "jumlah": round(jumlah, 2),
        "sisa": round(jumlah, 2), "keterangan": payload.get("keterangan") or "",
        "status": "aktif", "riwayat": [],
        "created_at": now_iso(), "created_by": user["name"],
    }
    res = await db.hr_kasbon.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user, "create", "hr", "kasbon", no, f"Kasbon {kar.get('nama')} {jumlah}")
    return serialize(doc)


@router.post("/kasbon/{kid}/bayar")
async def bayar_kasbon(kid: str, payload: dict = Body(...), user=Depends(require("hr", "edit"))):
    k = await db.hr_kasbon.find_one({"_id": oid(kid)})
    if not k:
        raise HTTPException(status_code=404, detail="Kasbon tidak ditemukan")
    jumlah = float(payload.get("jumlah") or 0)
    if jumlah <= 0 or jumlah > k["sisa"] + 0.01:
        raise HTTPException(status_code=400, detail=f"Jumlah tidak valid (sisa {k['sisa']})")
    sisa = round(k["sisa"] - jumlah, 2)
    status = "lunas" if sisa <= 0.009 else "aktif"
    await db.hr_kasbon.update_one({"_id": oid(kid)}, {
        "$set": {"sisa": max(sisa, 0), "status": status},
        "$push": {"riwayat": {"tanggal": now_iso()[:10], "jumlah": jumlah, "cara": "manual", "by": user["name"]}}})
    return {"ok": True, "sisa": max(sisa, 0), "status": status}


@router.delete("/kasbon/{kid}")
async def delete_kasbon(kid: str, user=Depends(require("hr", "delete"))):
    await db.hr_kasbon.delete_one({"_id": oid(kid)})
    return {"ok": True}


async def _deduct_kasbon(karyawan_id, amount, user):
    """Reduce active kasbon balances by amount (oldest first)."""
    remaining = amount
    async for k in db.hr_kasbon.find({"karyawan_id": karyawan_id, "status": "aktif"}).sort("created_at", 1):
        if remaining <= 0.009:
            break
        take = min(k["sisa"], remaining)
        sisa = round(k["sisa"] - take, 2)
        remaining = round(remaining - take, 2)
        await db.hr_kasbon.update_one({"_id": k["_id"]}, {
            "$set": {"sisa": max(sisa, 0), "status": "lunas" if sisa <= 0.009 else "aktif"},
            "$push": {"riwayat": {"tanggal": now_iso()[:10], "jumlah": take, "cara": "payroll", "by": user["name"]}}})


# ---------------- PAYROLL ----------------
async def _active_kasbon_sisa(karyawan_id):
    total = 0
    async for k in db.hr_kasbon.find({"karyawan_id": karyawan_id, "status": "aktif"}):
        total += k.get("sisa", 0)
    return round(total, 2)


@router.post("/payroll/generate")
async def generate_payroll(payload: dict = Body(...), user=Depends(require("hr", "add"))):
    periode = payload.get("periode")
    if not periode:
        raise HTTPException(status_code=400, detail="Periode (YYYY-MM) wajib diisi")
    hari_kerja = float(payload.get("hari_kerja") or 26)
    bpjs_persen = float(payload.get("bpjs_persen") or 0)
    pajak_persen = float(payload.get("pajak_persen") or 0)
    jab = await _jabatan_map()
    created = 0
    async for kar in db.master_karyawan.find({"deleted_at": None, "is_active": True}):
        kid = str(kar["_id"])
        existing = await db.hr_payroll.find_one({"periode": periode, "karyawan_id": kid})
        if existing and existing.get("status") == "dibayar":
            continue
        rec = await _recap(kid, periode)
        gaji_pokok = float(kar.get("gaji_pokok") or 0)
        tunjangan = float(kar.get("tunjangan") or 0)
        tarif_lembur = float(kar.get("tarif_lembur") or 0)
        gaji_harian = round(gaji_pokok / hari_kerja, 2) if hari_kerja else 0
        gaji_diperoleh = round(gaji_harian * rec["hadir"], 2)
        upah_lembur = round(rec["jam_lembur"] * tarif_lembur, 2)
        bpjs = round((gaji_diperoleh + tunjangan) * bpjs_persen / 100, 2)
        pajak = round((gaji_diperoleh + tunjangan) * pajak_persen / 100, 2)
        gross = round(gaji_diperoleh + tunjangan + upah_lembur, 2)
        before_kasbon = round(gross - bpjs - pajak, 2)
        kasbon_sisa = await _active_kasbon_sisa(kid)
        kasbon_potong = round(min(kasbon_sisa, max(before_kasbon, 0)), 2)
        total_potongan = round(bpjs + pajak + kasbon_potong, 2)
        gaji_bersih = round(gross - total_potongan, 2)
        doc = {
            "periode": periode, "karyawan_id": kid, "karyawan_nama": kar.get("nama"),
            "jabatan_nama": jab.get(str(kar.get("jabatan_id"))) or "-",
            "gaji_pokok": gaji_pokok, "gaji_harian": gaji_harian, "gaji_diperoleh": gaji_diperoleh,
            "tunjangan": tunjangan,
            "hari_hadir": rec["hadir"], "hari_izin": rec["izin"], "hari_sakit": rec["sakit"],
            "hari_alpha": rec["alpha"], "hari_kerja": hari_kerja,
            "jam_lembur": rec["jam_lembur"], "tarif_lembur": tarif_lembur, "upah_lembur": upah_lembur,
            "potongan_alpha": 0, "bpjs_persen": bpjs_persen, "bpjs": bpjs,
            "pajak_persen": pajak_persen, "pajak": pajak,
            "kasbon_potong": kasbon_potong, "total_potongan": total_potongan,
            "gross": gross, "gaji_bersih": gaji_bersih,
            "rekening": kar.get("rekening") or "",
            "updated_at": now_iso(), "updated_by": user["name"],
        }
        if existing:
            await db.hr_payroll.update_one({"_id": existing["_id"]}, {"$set": doc})
        else:
            no = await get_next_code("SLP")
            doc.update({"no": no, "status": "draft", "tanggal_bayar": None,
                        "created_at": now_iso(), "created_by": user["name"]})
            await db.hr_payroll.insert_one(doc)
        created += 1
    await log_audit(user, "create", "hr", "payroll", periode, f"Generate payroll {periode} ({created})")
    return {"ok": True, "count": created, "periode": periode}


@router.get("/payroll")
async def list_payroll(periode: Optional[str] = None, status: Optional[str] = None,
                       page: int = 1, limit: int = 50, user=Depends(require("hr", "view"))):
    flt = {}
    if periode:
        flt["periode"] = periode
    if status and status != "all":
        flt["status"] = status
    total = await db.hr_payroll.count_documents(flt)
    cursor = db.hr_payroll.find(flt).sort("karyawan_nama", 1).skip((page - 1) * limit).limit(limit)
    items = [serialize(d) async for d in cursor]
    total_gaji = sum(i.get("gaji_bersih", 0) for i in items)
    belum = sum(1 for i in items if i.get("status") != "dibayar")
    return {"items": items, "total": total, "total_gaji": round(total_gaji, 2),
            "belum_dibayar": belum, "page": page, "limit": limit}


@router.get("/payroll/{pid}")
async def get_payroll(pid: str, user=Depends(require("hr", "view"))):
    doc = await db.hr_payroll.find_one({"_id": oid(pid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Slip gaji tidak ditemukan")
    return serialize(doc)


@router.post("/payroll/{pid}/bayar")
async def bayar_payroll(pid: str, payload: dict = Body(default={}), user=Depends(require("hr", "approve"))):
    p = await db.hr_payroll.find_one({"_id": oid(pid)})
    if not p:
        raise HTTPException(status_code=404, detail="Slip gaji tidak ditemukan")
    if p.get("status") == "dibayar":
        raise HTTPException(status_code=400, detail="Gaji sudah dibayar")
    rekening_id = payload.get("rekening_id")
    if p.get("kasbon_potong", 0) > 0:
        await _deduct_kasbon(p["karyawan_id"], p["kasbon_potong"], user)
    if rekening_id:
        await post_cash_txn(rekening_id, "keluar", p["gaji_bersih"], "Gaji Karyawan",
                            f"Gaji {p['periode']} - {p['karyawan_nama']}",
                            now_iso()[:10], user, ref_type="payroll", ref_id=p["no"], is_beban=True)
    await db.hr_payroll.update_one({"_id": oid(pid)}, {
        "$set": {"status": "dibayar", "tanggal_bayar": now_iso()[:10], "rekening_id": rekening_id}})
    await log_audit(user, "update", "hr", "payroll", p["no"],
                    f"Bayar gaji {p['karyawan_nama']} {p['periode']} = {p['gaji_bersih']}")
    return {"ok": True}


@router.delete("/payroll/{pid}")
async def delete_payroll(pid: str, user=Depends(require("hr", "delete"))):
    p = await db.hr_payroll.find_one({"_id": oid(pid)})
    if not p:
        raise HTTPException(status_code=404, detail="Slip gaji tidak ditemukan")
    if p.get("status") == "dibayar":
        raise HTTPException(status_code=400, detail="Slip yang sudah dibayar tidak bisa dihapus")
    await db.hr_payroll.delete_one({"_id": oid(pid)})
    return {"ok": True}


@router.get("/summary")
async def summary(user=Depends(require("hr", "view"))):
    now = datetime.now(timezone.utc)
    periode = now.strftime("%Y-%m")
    karyawan_aktif = await db.master_karyawan.count_documents({"deleted_at": None, "is_active": True})
    kasbon_aktif = 0
    async for k in db.hr_kasbon.find({"status": "aktif"}):
        kasbon_aktif += k.get("sisa", 0)
    gaji_bulan = belum = 0
    async for p in db.hr_payroll.find({"periode": periode}):
        gaji_bulan += p.get("gaji_bersih", 0)
        if p.get("status") != "dibayar":
            belum += 1
    return {"karyawan_aktif": karyawan_aktif, "kasbon_aktif": round(kasbon_aktif, 2),
            "gaji_bulan": round(gaji_bulan, 2), "belum_dibayar": belum, "periode": periode}
