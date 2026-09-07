from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional
from datetime import datetime, timezone, timedelta

from db import db, oid, now_iso, get_next_code, serialize, log_audit
from rbac import require
from stock_router import get_item, gudang_name, available_qty, consume_stock_fifo
from finance_router import post_cash_txn

router = APIRouter(prefix="/api/sales", tags=["sales"])


async def _build_items(raw_items):
    items = []
    subtotal = 0
    total_hpp = 0
    for it in raw_items or []:
        bj = await get_item("barang_jadi", it["item_id"])
        qty = float(it.get("qty") or 0)
        harga = float(it.get("harga") or 0)
        diskon = float(it.get("diskon") or 0)
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Qty item harus lebih dari 0")
        line = round(qty * harga - diskon, 2)
        subtotal += line
        total_hpp += qty * float(bj.get("harga_pokok") or 0)
        items.append({"item_id": it["item_id"], "item_nama": bj.get("nama"),
                      "kode": bj.get("kode"), "satuan": bj.get("satuan_nama") or "",
                      "qty": qty, "harga": harga, "diskon": diskon, "subtotal": line,
                      "harga_label": it.get("harga_label") or "Standar",
                      "hpp": float(bj.get("harga_pokok") or 0)})
    return items, round(subtotal, 2), round(total_hpp, 2)


@router.post("/order")
async def create_order(payload: dict = Body(...), user=Depends(require("penjualan", "add"))):
    if not payload.get("pelanggan_id") or not payload.get("gudang_id"):
        raise HTTPException(status_code=400, detail="Pelanggan & gudang wajib dipilih")
    pel = await db.master_pelanggan.find_one({"_id": oid(payload["pelanggan_id"])})
    if not pel:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    items, subtotal, total_hpp = await _build_items(payload.get("items"))
    if not items:
        raise HTTPException(status_code=400, detail="Minimal satu item penjualan")

    pajak_persen = 0
    pajak_nama = None
    if payload.get("pajak_id"):
        pjk = await db.master_pajak.find_one({"_id": oid(payload["pajak_id"])})
        if pjk:
            pajak_persen = float(pjk.get("persen") or 0)
            pajak_nama = pjk.get("nama")
    pajak_nominal = round(subtotal * pajak_persen / 100, 2)
    total = round(subtotal + pajak_nominal, 2)
    tipe = payload.get("tipe") or "tunai"
    tanggal = payload.get("tanggal") or now_iso()[:10]
    jatuh_tempo = payload.get("jatuh_tempo")
    if tipe == "kredit" and not jatuh_tempo:
        term = int(pel.get("term") or 0)
        jatuh_tempo = (datetime.fromisoformat(tanggal) + timedelta(days=term)).date().isoformat()

    no = await get_next_code("SO")
    doc = {
        "no_so": no, "no_invoice": None, "no_surat_jalan": None,
        "tanggal": tanggal, "pelanggan_id": payload["pelanggan_id"], "pelanggan_nama": pel.get("nama"),
        "gudang_id": payload["gudang_id"], "items": items,
        "subtotal": subtotal, "pajak_id": payload.get("pajak_id"), "pajak_nama": pajak_nama,
        "pajak_persen": pajak_persen, "pajak_nominal": pajak_nominal, "total": total,
        "total_hpp": total_hpp, "laba_kotor": round(total - pajak_nominal - total_hpp, 2),
        "tipe": tipe, "jatuh_tempo": jatuh_tempo, "metode": payload.get("metode"),
        "rekening_id": payload.get("rekening_id"), "catatan": payload.get("catatan"),
        "status": "draft", "terbayar": 0, "sisa": total, "pembayaran": [],
        "created_at": now_iso(), "created_by": user["name"],
    }
    res = await db.sales_orders.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user, "create", "penjualan", "sales_order", no,
                    f"Sales Order {no} - {pel.get('nama')} total {total}")
    return serialize(doc)


@router.get("/orders")
async def list_orders(q: Optional[str] = None, status: Optional[str] = None,
                      page: int = 1, limit: int = 20, user=Depends(require("penjualan", "view"))):
    flt = {}
    if status and status != "all":
        flt["status"] = status
    if q:
        flt["$or"] = [{"no_so": {"$regex": q, "$options": "i"}},
                      {"pelanggan_nama": {"$regex": q, "$options": "i"}},
                      {"no_invoice": {"$regex": q, "$options": "i"}}]
    total = await db.sales_orders.count_documents(flt)
    cursor = db.sales_orders.find(flt).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    return {"items": [serialize(d) async for d in cursor], "total": total, "page": page, "limit": limit}


@router.get("/orders/{so_id}")
async def get_order(so_id: str, user=Depends(require("penjualan", "view"))):
    doc = await db.sales_orders.find_one({"_id": oid(so_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Sales Order tidak ditemukan")
    return serialize(doc)


async def _record_payment(so, jumlah, rekening_id, metode, tanggal, user):
    no_bayar = await get_next_code("PAY")
    terbayar = round(so.get("terbayar", 0) + jumlah, 2)
    sisa = round(so["total"] - terbayar, 2)
    status = "lunas" if sisa <= 0.009 else "sebagian"
    payment = {"no_bayar": no_bayar, "tanggal": tanggal, "jumlah": jumlah,
               "rekening_id": rekening_id, "metode": metode, "created_by": user["name"],
               "created_at": now_iso()}
    await db.sales_orders.update_one(
        {"_id": so["_id"]},
        {"$set": {"terbayar": terbayar, "sisa": max(sisa, 0), "status": status},
         "$push": {"pembayaran": payment}})
    await db.customer_payments.insert_one({**payment, "so_id": str(so["_id"]), "no_so": so["no_so"],
                                           "pelanggan_nama": so.get("pelanggan_nama")})
    if rekening_id:
        await post_cash_txn(rekening_id, "masuk", jumlah, "Penjualan",
                            f"Pembayaran {so['no_so']} - {so.get('pelanggan_nama')}",
                            tanggal, user, ref_type="penjualan", ref_id=so["no_so"])
    return terbayar, max(sisa, 0), status


@router.post("/orders/{so_id}/kirim")
async def kirim(so_id: str, payload: dict = Body(default={}), user=Depends(require("penjualan", "approve"))):
    so = await db.sales_orders.find_one({"_id": oid(so_id)})
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order tidak ditemukan")
    if so["status"] != "draft":
        raise HTTPException(status_code=400, detail="Order sudah diproses/dikirim")
    gnama = await gudang_name(so["gudang_id"])
    # validate stock for all items first
    for it in so["items"]:
        avail = await available_qty("barang_jadi", it["item_id"], so["gudang_id"])
        if avail + 1e-9 < it["qty"]:
            raise HTTPException(status_code=400,
                                detail=f"Stok {it['item_nama']} tidak cukup (tersedia {avail}, butuh {it['qty']})")
    # deliver: stock out
    for it in so["items"]:
        item = await get_item("barang_jadi", it["item_id"])
        await consume_stock_fifo("barang_jadi", it["item_id"], so["gudang_id"], it["qty"],
                                 item, gnama, user, "penjualan", so["no_so"], f"Penjualan {so['no_so']}")
    no_sj = await get_next_code("SJ")
    no_inv = await get_next_code("INV")
    upd = {"status": "dikirim", "no_surat_jalan": no_sj, "no_invoice": no_inv}
    await db.sales_orders.update_one({"_id": oid(so_id)}, {"$set": upd})
    so = await db.sales_orders.find_one({"_id": oid(so_id)})
    # auto payment for cash sales
    if so["tipe"] == "tunai":
        await _record_payment(so, so["total"], payload.get("rekening_id") or so.get("rekening_id"),
                              payload.get("metode") or "Tunai", now_iso()[:10], user)
    await log_audit(user, "update", "penjualan", "sales_order", so["no_so"],
                    f"Kirim & invoice {so['no_so']} ({no_sj}/{no_inv})")
    return serialize(await db.sales_orders.find_one({"_id": oid(so_id)}))


@router.post("/orders/{so_id}/bayar")
async def bayar(so_id: str, payload: dict = Body(...), user=Depends(require("penjualan", "add"))):
    so = await db.sales_orders.find_one({"_id": oid(so_id)})
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order tidak ditemukan")
    if so["status"] == "draft":
        raise HTTPException(status_code=400, detail="Kirim/proses order dulu sebelum menerima pembayaran")
    if so["status"] == "lunas":
        raise HTTPException(status_code=400, detail="Order sudah lunas")
    jumlah = float(payload.get("jumlah") or 0)
    if jumlah <= 0:
        raise HTTPException(status_code=400, detail="Jumlah pembayaran harus lebih dari 0")
    if jumlah > so["sisa"] + 0.01:
        raise HTTPException(status_code=400, detail=f"Jumlah melebihi sisa piutang ({so['sisa']})")
    terbayar, sisa, status = await _record_payment(
        so, jumlah, payload.get("rekening_id"), payload.get("metode") or "Transfer",
        payload.get("tanggal") or now_iso()[:10], user)
    await log_audit(user, "update", "penjualan", "sales_order", so["no_so"],
                    f"Pembayaran {jumlah} untuk {so['no_so']}, sisa {sisa}")
    return {"terbayar": terbayar, "sisa": sisa, "status": status}


@router.delete("/orders/{so_id}")
async def delete_order(so_id: str, user=Depends(require("penjualan", "delete"))):
    so = await db.sales_orders.find_one({"_id": oid(so_id)})
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order tidak ditemukan")
    if so["status"] != "draft":
        raise HTTPException(status_code=400, detail="Hanya order draft yang bisa dihapus")
    await db.sales_orders.delete_one({"_id": oid(so_id)})
    await log_audit(user, "delete", "penjualan", "sales_order", so["no_so"], f"Hapus draft {so['no_so']}")
    return {"ok": True}


@router.get("/piutang")
async def piutang(page: int = 1, limit: int = 50, user=Depends(require("penjualan", "view"))):
    flt = {"sisa": {"$gt": 0}, "status": {"$in": ["dikirim", "sebagian"]}}
    total = await db.sales_orders.count_documents(flt)
    cursor = db.sales_orders.find(flt).sort("jatuh_tempo", 1).skip((page - 1) * limit).limit(limit)
    today = now_iso()[:10]
    rows = []
    for d in [serialize(x) async for x in cursor]:
        jt = d.get("jatuh_tempo")
        d["overdue"] = bool(jt and jt < today)
        rows.append(d)
    total_piutang = 0
    async for x in db.sales_orders.find(flt):
        total_piutang += x.get("sisa", 0)
    return {"items": rows, "total": total, "total_piutang": round(total_piutang, 2), "page": page, "limit": limit}
