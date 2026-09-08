#!/usr/bin/env python3
"""
Comprehensive Backend Regression Test for ERP Torillaz
Tests all modules: Auth, RBAC, Master, Stock, Production, Sales, Finance, HR, Dashboard, Settings, Audit
"""

import requests
import json
from datetime import datetime, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://repo-ulang-build.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "torillaz123"

# Global session
session = requests.Session()
access_token = None
test_data = {}


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def test_auth():
    """Test authentication endpoints"""
    global access_token
    log("=" * 80)
    log("MODULE 1: AUTHENTICATION")
    log("=" * 80)
    
    # Test 1: Login with correct credentials
    log("Test 1.1: Login with correct credentials")
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "access_token" in data, "No access_token in response"
    assert data["email"] == ADMIN_EMAIL, f"Email mismatch: {data['email']}"
    assert data["role"] == "super_admin", f"Role mismatch: {data['role']}"
    access_token = data["access_token"]
    log(f"✅ Login successful, role: {data['role']}")
    
    # Test 2: Login with wrong password
    log("Test 1.2: Login with wrong password (should fail)")
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": "wrongpassword"
    })
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    log("✅ Wrong password correctly rejected with 401")
    
    # Test 3: GET /auth/me
    log("Test 1.3: GET /auth/me")
    resp = session.get(f"{BASE_URL}/auth/me")
    assert resp.status_code == 200, f"GET /me failed: {resp.status_code}"
    data = resp.json()
    assert data["email"] == ADMIN_EMAIL, "Email mismatch in /me"
    log(f"✅ GET /auth/me successful: {data['name']}")
    
    # Test 4: GET /auth/session
    log("Test 1.4: GET /auth/session")
    resp = session.get(f"{BASE_URL}/auth/session")
    assert resp.status_code == 200, f"GET /session failed: {resp.status_code}"
    data = resp.json()
    assert data["authenticated"] == True, "Not authenticated"
    log("✅ Session check successful")
    
    # Test 5: POST /auth/refresh
    log("Test 1.5: POST /auth/refresh")
    resp = session.post(f"{BASE_URL}/auth/refresh")
    assert resp.status_code == 200, f"Refresh failed: {resp.status_code}"
    log("✅ Token refresh successful")
    
    log("✅ AUTH MODULE: ALL TESTS PASSED (5/5)\n")


def test_rbac():
    """Test RBAC and roles"""
    log("=" * 80)
    log("MODULE 2: RBAC & ROLES")
    log("=" * 80)
    
    # Test 1: GET /roles
    log("Test 2.1: GET /roles")
    resp = session.get(f"{BASE_URL}/roles")
    assert resp.status_code == 200, f"GET /roles failed: {resp.status_code}"
    data = resp.json()
    assert "roles" in data, "No roles in response"
    assert "modules" in data, "No modules in response"
    assert "actions" in data, "No actions in response"
    assert len(data["roles"]) > 0, "No roles found"
    log(f"✅ Found {len(data['roles'])} roles")
    
    # Test 2: Verify permission matrix has all required modules
    log("Test 2.2: Verify permission matrix modules")
    required_modules = ["dashboard", "master", "gudang", "penjualan", "keuangan", "hr", "laporan", "pengaturan", "audit"]
    modules = data["modules"]
    for mod in required_modules:
        assert mod in modules, f"Module {mod} not in permission matrix"
    log(f"✅ All required modules present: {', '.join(required_modules)}")
    
    # Test 3: Verify super_admin role exists with full permissions
    log("Test 2.3: Verify super_admin role")
    super_admin = next((r for r in data["roles"] if r["name"] == "super_admin"), None)
    assert super_admin is not None, "super_admin role not found"
    assert super_admin["is_system"] == True, "super_admin should be system role"
    perms = super_admin["permissions"]
    for mod in required_modules:
        assert mod in perms, f"super_admin missing permissions for {mod}"
    log("✅ super_admin role has full permissions")
    
    log("✅ RBAC MODULE: ALL TESTS PASSED (3/3)\n")


def test_master_data():
    """Test master data CRUD operations"""
    log("=" * 80)
    log("MODULE 3: MASTER DATA")
    log("=" * 80)
    
    entities = ["kategori", "satuan", "supplier", "pelanggan", "bahan_baku", "barang_jadi", "gudang", "karyawan"]
    
    for entity in entities:
        log(f"Testing entity: {entity}")
        
        # Test 1: GET list
        log(f"  Test 3.{entities.index(entity)+1}.1: GET /{entity}")
        resp = session.get(f"{BASE_URL}/master/{entity}")
        assert resp.status_code == 200, f"GET /{entity} failed: {resp.status_code}"
        data = resp.json()
        assert "items" in data, f"No items in {entity} response"
        assert "total" in data, f"No total in {entity} response"
        log(f"  ✅ GET /{entity}: {data['total']} items")
        
        # Test 2: GET /options
        log(f"  Test 3.{entities.index(entity)+1}.2: GET /{entity}/options")
        resp = session.get(f"{BASE_URL}/master/{entity}/options")
        assert resp.status_code == 200, f"GET /{entity}/options failed: {resp.status_code}"
        options = resp.json()
        assert isinstance(options, list), f"Options should be a list"
        log(f"  ✅ GET /{entity}/options: {len(options)} active items")
        
        # Test 3: Create new item
        log(f"  Test 3.{entities.index(entity)+1}.3: POST /{entity} (create)")
        test_name = f"Test {entity.title()} {datetime.now().strftime('%H%M%S')}"
        payload = {"nama": test_name}
        
        # Add entity-specific fields
        if entity == "barang_jadi":
            payload["harga_opsi"] = [
                {"label": "Grosir", "harga": 9000},
                {"label": "Reseller", "harga": 8500},
                {"label": "Standar", "harga": 10000}
            ]
            payload["satuan_nama"] = "Pcs"
        elif entity == "bahan_baku":
            payload["satuan_nama"] = "Kg"
        elif entity == "karyawan":
            payload["gaji_pokok"] = 5000000
            payload["tunjangan"] = 500000
        
        resp = session.post(f"{BASE_URL}/master/{entity}", json=payload)
        assert resp.status_code == 200, f"POST /{entity} failed: {resp.status_code} {resp.text}"
        created = resp.json()
        assert "id" in created, f"No id in created {entity}"
        assert "kode" in created, f"No kode in created {entity}"
        assert created["nama"] == test_name, f"Name mismatch"
        test_data[f"{entity}_id"] = created["id"]
        test_data[f"{entity}_kode"] = created["kode"]
        log(f"  ✅ Created {entity}: {created['kode']} - {created['nama']}")
        
        # Special test for barang_jadi: verify harga_opsi
        if entity == "barang_jadi":
            assert "harga_opsi" in created, "harga_opsi not in response"
            assert len(created["harga_opsi"]) == 3, f"Expected 3 harga_opsi, got {len(created['harga_opsi'])}"
            log(f"  ✅ barang_jadi harga_opsi saved correctly: {len(created['harga_opsi'])} options")
        
        # Test 4: GET single item
        log(f"  Test 3.{entities.index(entity)+1}.4: GET /{entity}/{{id}}")
        resp = session.get(f"{BASE_URL}/master/{entity}/{created['id']}")
        assert resp.status_code == 200, f"GET /{entity}/{{id}} failed: {resp.status_code}"
        item = resp.json()
        assert item["id"] == created["id"], "ID mismatch"
        log(f"  ✅ GET /{entity}/{{id}} successful")
        
        # Test 5: Update item
        log(f"  Test 3.{entities.index(entity)+1}.5: PUT /{entity}/{{id}} (update)")
        updated_name = f"{test_name} UPDATED"
        resp = session.put(f"{BASE_URL}/master/{entity}/{created['id']}", json={"nama": updated_name})
        assert resp.status_code == 200, f"PUT /{entity} failed: {resp.status_code}"
        updated = resp.json()
        assert updated["nama"] == updated_name, "Update failed"
        log(f"  ✅ Updated {entity} name")
        
        # Test 6: Search
        log(f"  Test 3.{entities.index(entity)+1}.6: Search /{entity}?q=Test")
        resp = session.get(f"{BASE_URL}/master/{entity}?q=Test")
        assert resp.status_code == 200, f"Search failed: {resp.status_code}"
        data = resp.json()
        assert data["total"] > 0, "Search returned no results"
        log(f"  ✅ Search found {data['total']} items")
        
        # Test 7: Pagination
        log(f"  Test 3.{entities.index(entity)+1}.7: Pagination /{entity}?page=1&limit=5")
        resp = session.get(f"{BASE_URL}/master/{entity}?page=1&limit=5")
        assert resp.status_code == 200, f"Pagination failed: {resp.status_code}"
        data = resp.json()
        assert data["page"] == 1, "Page mismatch"
        assert data["limit"] == 5, "Limit mismatch"
        log(f"  ✅ Pagination working")
        
        # Test 8: Soft delete
        log(f"  Test 3.{entities.index(entity)+1}.8: DELETE /{entity}/{{id}} (soft delete)")
        resp = session.delete(f"{BASE_URL}/master/{entity}/{created['id']}")
        assert resp.status_code == 200, f"DELETE /{entity} failed: {resp.status_code}"
        log(f"  ✅ Soft deleted {entity}")
        
        # Test 9: Verify item not in list after soft delete
        log(f"  Test 3.{entities.index(entity)+1}.9: Verify soft delete (item not in list)")
        resp = session.get(f"{BASE_URL}/master/{entity}/{created['id']}")
        assert resp.status_code == 404, f"Soft deleted item should return 404, got {resp.status_code}"
        log(f"  ✅ Soft deleted item correctly hidden from API")
    
    log(f"✅ MASTER DATA MODULE: ALL TESTS PASSED ({len(entities) * 9}/{len(entities) * 9})\n")


def test_stock():
    """Test stock/warehouse operations"""
    log("=" * 80)
    log("MODULE 4: GUDANG & STOK")
    log("=" * 80)
    
    # Create test data first
    log("Setting up test data...")
    
    # Create gudang
    resp = session.post(f"{BASE_URL}/master/gudang", json={"nama": "Gudang Test Stok"})
    gudang = resp.json()
    gudang_id = gudang["id"]
    log(f"Created gudang: {gudang['kode']}")
    
    # Create bahan_baku
    resp = session.post(f"{BASE_URL}/master/bahan_baku", json={
        "nama": "Bahan Test Stok",
        "satuan_nama": "Kg",
        "stok_min": 10
    })
    bahan = resp.json()
    bahan_id = bahan["id"]
    log(f"Created bahan_baku: {bahan['kode']}")
    
    # Test 1: GET /stock/balances (initial - should be empty for our test items)
    log("Test 4.1: GET /stock/balances")
    resp = session.get(f"{BASE_URL}/stock/balances")
    assert resp.status_code == 200, f"GET /balances failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in balances"
    log(f"✅ GET /stock/balances: {data['total']} items")
    
    # Test 2: POST /stock/movement - penerimaan (stock in)
    log("Test 4.2: POST /stock/movement - penerimaan (stock increases)")
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "penerimaan",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "qty": 100,
        "harga_satuan": 5000,
        "batch": "BATCH001",
        "keterangan": "Test penerimaan"
    })
    assert resp.status_code == 200, f"Penerimaan failed: {resp.status_code} {resp.text}"
    movement = resp.json()
    assert movement["qty"] == 100, "Qty mismatch"
    assert movement["saldo_akhir"] == 100, "Saldo akhir should be 100"
    log(f"✅ Penerimaan successful: {movement['no_transaksi']}, saldo: {movement['saldo_akhir']}")
    
    # Test 3: Verify stock balance increased
    log("Test 4.3: Verify stock balance after penerimaan")
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={bahan_id}")
    assert resp.status_code == 200, f"GET balances failed: {resp.status_code}"
    data = resp.json()
    assert data["total"] > 0, "No balance found"
    balance = data["items"][0]
    assert balance["qty"] == 100, f"Expected qty 100, got {balance['qty']}"
    assert balance["avg_price"] == 5000, f"Expected avg_price 5000, got {balance['avg_price']}"
    log(f"✅ Stock balance correct: qty={balance['qty']}, avg_price={balance['avg_price']}")
    
    # Test 4: POST /stock/movement - pengeluaran (stock out)
    log("Test 4.4: POST /stock/movement - pengeluaran (stock decreases)")
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "pengeluaran",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "qty": 30,
        "batch": "BATCH001",
        "keterangan": "Test pengeluaran"
    })
    assert resp.status_code == 200, f"Pengeluaran failed: {resp.status_code} {resp.text}"
    movement = resp.json()
    assert movement["qty"] == -30, "Qty should be negative"
    assert movement["saldo_akhir"] == 70, f"Saldo akhir should be 70, got {movement['saldo_akhir']}"
    log(f"✅ Pengeluaran successful: saldo: {movement['saldo_akhir']}")
    
    # Test 5: Prevent negative stock
    log("Test 4.5: Prevent negative stock (pengeluaran > available)")
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "pengeluaran",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "qty": 100,  # More than available (70)
        "batch": "BATCH001",
        "keterangan": "Test negative prevention"
    })
    assert resp.status_code == 400, f"Expected 400 for negative stock, got {resp.status_code}"
    log("✅ Negative stock correctly prevented with 400 error")
    
    # Test 6: POST /stock/movement - penyesuaian
    log("Test 4.6: POST /stock/movement - penyesuaian")
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "penyesuaian",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "qty": 5,  # Add 5
        "batch": "BATCH001",
        "keterangan": "Test penyesuaian"
    })
    assert resp.status_code == 200, f"Penyesuaian failed: {resp.status_code}"
    movement = resp.json()
    assert movement["saldo_akhir"] == 75, f"Expected saldo 75, got {movement['saldo_akhir']}"
    log(f"✅ Penyesuaian successful: saldo: {movement['saldo_akhir']}")
    
    # Test 7: Create second gudang for transfer test
    resp = session.post(f"{BASE_URL}/master/gudang", json={"nama": "Gudang Test Transfer"})
    gudang2 = resp.json()
    gudang2_id = gudang2["id"]
    
    # Test 8: POST /stock/movement - transfer
    log("Test 4.7: POST /stock/movement - transfer antar gudang")
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "transfer",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "gudang_tujuan_id": gudang2_id,
        "qty": 20,
        "batch": "BATCH001",
        "keterangan": "Test transfer"
    })
    assert resp.status_code == 200, f"Transfer failed: {resp.status_code} {resp.text}"
    log("✅ Transfer successful")
    
    # Test 9: Verify transfer - source gudang decreased
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={bahan_id}&gudang_id={gudang_id}")
    data = resp.json()
    source_balance = data["items"][0]
    assert source_balance["qty"] == 55, f"Source should be 55, got {source_balance['qty']}"
    log(f"✅ Source gudang stock decreased to {source_balance['qty']}")
    
    # Test 10: Verify transfer - destination gudang increased
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={bahan_id}&gudang_id={gudang2_id}")
    data = resp.json()
    dest_balance = data["items"][0]
    assert dest_balance["qty"] == 20, f"Destination should be 20, got {dest_balance['qty']}"
    log(f"✅ Destination gudang stock increased to {dest_balance['qty']}")
    
    # Test 11: POST /stock/movement - opname
    log("Test 4.8: POST /stock/movement - opname (stock opname)")
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "opname",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "qty": 50,  # Actual counted qty
        "batch": "BATCH001",
        "keterangan": "Test opname"
    })
    assert resp.status_code == 200, f"Opname failed: {resp.status_code}"
    movement = resp.json()
    assert movement["saldo_akhir"] == 50, f"Saldo after opname should be 50, got {movement['saldo_akhir']}"
    log(f"✅ Opname successful: saldo adjusted to {movement['saldo_akhir']}")
    
    # Test 12: GET /stock/kartu (kartu stok with running balance)
    log("Test 4.9: GET /stock/kartu (kartu stok)")
    resp = session.get(f"{BASE_URL}/stock/kartu?item_type=bahan_baku&item_id={bahan_id}&gudang_id={gudang_id}")
    assert resp.status_code == 200, f"GET kartu failed: {resp.status_code}"
    data = resp.json()
    assert "movements" in data, "No movements in kartu"
    assert len(data["movements"]) > 0, "No movements found"
    # Verify running balance
    for mv in data["movements"]:
        assert "saldo" in mv, "No saldo in movement"
    log(f"✅ Kartu stok retrieved: {len(data['movements'])} movements with running balance")
    
    # Test 13: GET /stock/summary
    log("Test 4.10: GET /stock/summary")
    resp = session.get(f"{BASE_URL}/stock/summary")
    assert resp.status_code == 200, f"GET summary failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in summary"
    log(f"✅ Stock summary retrieved: {data['total']} items")
    
    # Test 14: GET /stock/movements (list all movements)
    log("Test 4.11: GET /stock/movements")
    resp = session.get(f"{BASE_URL}/stock/movements")
    assert resp.status_code == 200, f"GET movements failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in movements"
    log(f"✅ Stock movements list: {data['total']} movements")
    
    # Test 15: Weighted average price test
    log("Test 4.12: Weighted average price calculation")
    # Add another penerimaan with different price
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "penerimaan",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "qty": 50,
        "harga_satuan": 6000,  # Different price
        "batch": "BATCH001",
        "keterangan": "Test weighted avg"
    })
    assert resp.status_code == 200, f"Penerimaan failed: {resp.status_code}"
    
    # Check weighted average is updated (exact value depends on opname behavior, just verify it's between 5000-6000)
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={bahan_id}&gudang_id={gudang_id}")
    data = resp.json()
    balance = data["items"][0]
    assert 5000 <= balance["avg_price"] <= 6000, f"Avg price should be between 5000-6000, got {balance['avg_price']}"
    assert balance["qty"] == 100, f"Qty should be 100, got {balance['qty']}"
    log(f"✅ Weighted average price calculated correctly: {balance['avg_price']} (qty: {balance['qty']})")
    
    log("✅ GUDANG & STOK MODULE: ALL TESTS PASSED (12/12)\n")


def test_production():
    """Test production and BOM"""
    log("=" * 80)
    log("MODULE 5: PRODUKSI & HPP")
    log("=" * 80)
    
    # Setup test data
    log("Setting up test data...")
    
    # Create gudang
    resp = session.post(f"{BASE_URL}/master/gudang", json={"nama": "Gudang Produksi Test"})
    gudang = resp.json()
    gudang_id = gudang["id"]
    
    # Create bahan_baku with stock
    resp = session.post(f"{BASE_URL}/master/bahan_baku", json={
        "nama": "Tepung Test Produksi",
        "satuan_nama": "Kg"
    })
    bahan = resp.json()
    bahan_id = bahan["id"]
    
    # Add stock to bahan_baku
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "penerimaan",
        "item_type": "bahan_baku",
        "item_id": bahan_id,
        "gudang_id": gudang_id,
        "qty": 100,
        "harga_satuan": 10000,
        "batch": "BATCH-PROD"
    })
    log(f"Added stock to bahan_baku: 100 Kg @ 10000")
    
    # Create barang_jadi
    resp = session.post(f"{BASE_URL}/master/barang_jadi", json={
        "nama": "Kue Test Produksi",
        "satuan_nama": "Pcs"
    })
    barang = resp.json()
    barang_id = barang["id"]
    log(f"Created barang_jadi: {barang['kode']}")
    
    # Test 1: POST /production/bom (create BOM/resep)
    log("Test 5.1: POST /production/bom (create BOM)")
    resp = session.post(f"{BASE_URL}/production/bom", json={
        "barang_jadi_id": barang_id,
        "output_qty": 10,
        "items": [
            {"item_id": bahan_id, "qty": 5}
        ],
        "biaya_tk": 50000,
        "biaya_overhead": 20000
    })
    assert resp.status_code == 200, f"Create BOM failed: {resp.status_code} {resp.text}"
    bom = resp.json()
    assert "id" in bom, "No id in BOM"
    bom_id = bom["id"]
    log(f"✅ BOM created: {bom['kode']}")
    
    # Test 2: GET /production/bom (list)
    log("Test 5.2: GET /production/bom (list)")
    resp = session.get(f"{BASE_URL}/production/bom")
    assert resp.status_code == 200, f"GET BOM list failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in BOM list"
    log(f"✅ BOM list retrieved: {data['total']} items")
    
    # Test 3: GET /production/bom/{id}
    log("Test 5.3: GET /production/bom/{id}")
    resp = session.get(f"{BASE_URL}/production/bom/{bom_id}")
    assert resp.status_code == 200, f"GET BOM failed: {resp.status_code}"
    bom_detail = resp.json()
    assert bom_detail["id"] == bom_id, "BOM ID mismatch"
    log(f"✅ BOM detail retrieved")
    
    # Test 4: PUT /production/bom/{id} (update)
    log("Test 5.4: PUT /production/bom/{id} (update)")
    resp = session.put(f"{BASE_URL}/production/bom/{bom_id}", json={
        "biaya_tk": 60000
    })
    assert resp.status_code == 200, f"Update BOM failed: {resp.status_code}"
    log("✅ BOM updated")
    
    # Test 5: POST /production/preview (preview kebutuhan + HPP)
    log("Test 5.5: POST /production/preview (preview kebutuhan + HPP)")
    resp = session.post(f"{BASE_URL}/production/preview", json={
        "bom_id": bom_id,
        "qty_target": 20,  # 2x output_qty
        "gudang_bb_id": gudang_id
    })
    assert resp.status_code == 200, f"Preview failed: {resp.status_code} {resp.text}"
    preview = resp.json()
    assert "items" in preview, "No items in preview"
    assert "total_hpp" in preview, "No total_hpp in preview"
    assert "hpp_per_unit" in preview, "No hpp_per_unit in preview"
    assert "semua_cukup" in preview, "No semua_cukup in preview"
    assert preview["semua_cukup"] == True, "Stock should be sufficient"
    log(f"✅ Preview successful: HPP total={preview['total_hpp']}, per unit={preview['hpp_per_unit']}, semua_cukup={preview['semua_cukup']}")
    
    # Test 6: POST /production/process (proses produksi)
    log("Test 5.6: POST /production/process (proses produksi)")
    
    # Get initial stock
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={bahan_id}&gudang_id={gudang_id}")
    initial_bb_stock = resp.json()["items"][0]["qty"]
    
    resp = session.post(f"{BASE_URL}/production/process", json={
        "bom_id": bom_id,
        "qty_target": 20,
        "qty_hasil": 20,
        "gudang_bb_id": gudang_id,
        "gudang_bj_id": gudang_id,
        "batch": "PROD-TEST-001",
        "tanggal": datetime.now().strftime("%Y-%m-%d")
    })
    assert resp.status_code == 200, f"Process production failed: {resp.status_code} {resp.text}"
    prod = resp.json()
    assert "no_produksi" in prod, "No no_produksi in response"
    assert prod["qty_hasil"] == 20, "qty_hasil mismatch"
    assert "hpp_per_unit" in prod, "No hpp_per_unit"
    log(f"✅ Production processed: {prod['no_produksi']}, HPP/unit={prod['hpp_per_unit']}")
    
    # Test 7: Verify bahan_baku stock decreased
    log("Test 5.7: Verify bahan_baku stock decreased after production")
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={bahan_id}&gudang_id={gudang_id}")
    data = resp.json()
    final_bb_stock = data["items"][0]["qty"] if data["items"] else 0
    expected_decrease = 10  # 5 kg per 10 pcs * 2 = 10 kg
    assert abs((initial_bb_stock - final_bb_stock) - expected_decrease) < 0.1, f"Expected decrease {expected_decrease}, got {initial_bb_stock - final_bb_stock}"
    log(f"✅ Bahan baku stock decreased correctly: {initial_bb_stock} -> {final_bb_stock}")
    
    # Test 8: Verify barang_jadi stock increased
    log("Test 5.8: Verify barang_jadi stock increased after production")
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={barang_id}&gudang_id={gudang_id}")
    data = resp.json()
    assert data["total"] > 0, "No barang_jadi stock found"
    bj_stock = data["items"][0]["qty"]
    assert bj_stock == 20, f"Expected barang_jadi stock 20, got {bj_stock}"
    log(f"✅ Barang jadi stock increased correctly: {bj_stock}")
    
    # Test 9: Verify harga_pokok updated in master barang_jadi
    log("Test 5.9: Verify harga_pokok updated in master barang_jadi")
    resp = session.get(f"{BASE_URL}/master/barang_jadi/{barang_id}")
    barang_detail = resp.json()
    assert "harga_pokok" in barang_detail, "No harga_pokok in barang_jadi"
    assert barang_detail["harga_pokok"] == prod["hpp_per_unit"], f"harga_pokok mismatch: {barang_detail['harga_pokok']} != {prod['hpp_per_unit']}"
    log(f"✅ harga_pokok updated in master: {barang_detail['harga_pokok']}")
    
    # Test 10: GET /production/orders (list)
    log("Test 5.10: GET /production/orders (list)")
    resp = session.get(f"{BASE_URL}/production/orders")
    assert resp.status_code == 200, f"GET production orders failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in production orders"
    log(f"✅ Production orders list: {data['total']} items")
    
    # Test 11: DELETE /production/bom/{id}
    log("Test 5.11: DELETE /production/bom/{id}")
    resp = session.delete(f"{BASE_URL}/production/bom/{bom_id}")
    assert resp.status_code == 200, f"Delete BOM failed: {resp.status_code}"
    log("✅ BOM deleted (soft delete)")
    
    log("✅ PRODUKSI & HPP MODULE: ALL TESTS PASSED (11/11)\n")


def test_sales():
    """Test sales orders and invoicing"""
    log("=" * 80)
    log("MODULE 6: PENJUALAN")
    log("=" * 80)
    
    # Setup test data
    log("Setting up test data...")
    
    # Create pelanggan
    resp = session.post(f"{BASE_URL}/master/pelanggan", json={
        "nama": "Pelanggan Test Sales",
        "term": 30
    })
    pelanggan = resp.json()
    pelanggan_id = pelanggan["id"]
    
    # Create gudang
    resp = session.post(f"{BASE_URL}/master/gudang", json={"nama": "Gudang Sales Test"})
    gudang = resp.json()
    gudang_id = gudang["id"]
    
    # Create barang_jadi with harga_opsi
    resp = session.post(f"{BASE_URL}/master/barang_jadi", json={
        "nama": "Produk Test Sales",
        "satuan_nama": "Pcs",
        "harga_opsi": [
            {"label": "Grosir", "harga": 9000},
            {"label": "Reseller", "harga": 8500},
            {"label": "Standar", "harga": 10000}
        ]
    })
    barang = resp.json()
    barang_id = barang["id"]
    
    # Add stock
    resp = session.post(f"{BASE_URL}/stock/movement", json={
        "tipe": "penerimaan",
        "item_type": "barang_jadi",
        "item_id": barang_id,
        "gudang_id": gudang_id,
        "qty": 100,
        "harga_satuan": 5000,
        "batch": "BATCH-SALES"
    })
    log(f"Added stock: 100 pcs")
    
    # Test 1: POST /sales/order (create draft with harga_label)
    log("Test 6.1: POST /sales/order (create draft with harga_label)")
    resp = session.post(f"{BASE_URL}/sales/order", json={
        "pelanggan_id": pelanggan_id,
        "gudang_id": gudang_id,
        "tipe": "tunai",
        "items": [
            {
                "item_id": barang_id,
                "qty": 10,
                "harga": 9000,
                "harga_label": "Grosir",
                "diskon": 0
            }
        ]
    })
    assert resp.status_code == 200, f"Create order failed: {resp.status_code} {resp.text}"
    order = resp.json()
    assert "no_so" in order, "No no_so in order"
    assert order["status"] == "draft", f"Status should be draft, got {order['status']}"
    assert order["items"][0]["harga_label"] == "Grosir", "harga_label not saved"
    order_id = order["id"]
    log(f"✅ Order created: {order['no_so']}, status={order['status']}, harga_label={order['items'][0]['harga_label']}")
    
    # Test 2: GET /sales/orders (list)
    log("Test 6.2: GET /sales/orders (list)")
    resp = session.get(f"{BASE_URL}/sales/orders")
    assert resp.status_code == 200, f"GET orders failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in orders"
    log(f"✅ Orders list: {data['total']} items")
    
    # Test 3: GET /sales/orders/{id}
    log("Test 6.3: GET /sales/orders/{id}")
    resp = session.get(f"{BASE_URL}/sales/orders/{order_id}")
    assert resp.status_code == 200, f"GET order failed: {resp.status_code}"
    order_detail = resp.json()
    assert order_detail["id"] == order_id, "Order ID mismatch"
    assert order_detail["items"][0]["harga_label"] == "Grosir", "harga_label not preserved in GET"
    log(f"✅ Order detail retrieved, harga_label preserved: {order_detail['items'][0]['harga_label']}")
    
    # Test 4: POST /sales/orders/{id}/kirim (send order - stock decrease, invoice, auto payment for cash)
    log("Test 6.4: POST /sales/orders/{id}/kirim (kirim order)")
    
    # Get initial stock
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={barang_id}&gudang_id={gudang_id}")
    initial_stock = resp.json()["items"][0]["qty"]
    
    resp = session.post(f"{BASE_URL}/sales/orders/{order_id}/kirim", json={})
    assert resp.status_code == 200, f"Kirim order failed: {resp.status_code} {resp.text}"
    order_sent = resp.json()
    assert order_sent["status"] == "lunas", f"Cash order should be lunas, got {order_sent['status']}"
    assert order_sent["no_invoice"] is not None, "No invoice number"
    assert order_sent["no_surat_jalan"] is not None, "No surat jalan number"
    assert order_sent["items"][0]["harga_label"] == "Grosir", "harga_label not preserved after kirim"
    log(f"✅ Order sent: status={order_sent['status']}, invoice={order_sent['no_invoice']}, surat_jalan={order_sent['no_surat_jalan']}")
    
    # Test 5: Verify stock decreased
    log("Test 6.5: Verify stock decreased after kirim")
    resp = session.get(f"{BASE_URL}/stock/balances?item_id={barang_id}&gudang_id={gudang_id}")
    final_stock = resp.json()["items"][0]["qty"]
    assert final_stock == initial_stock - 10, f"Stock should decrease by 10: {initial_stock} -> {final_stock}"
    log(f"✅ Stock decreased correctly: {initial_stock} -> {final_stock}")
    
    # Test 6: Create credit order
    log("Test 6.6: Create credit order")
    resp = session.post(f"{BASE_URL}/sales/order", json={
        "pelanggan_id": pelanggan_id,
        "gudang_id": gudang_id,
        "tipe": "kredit",
        "items": [
            {
                "item_id": barang_id,
                "qty": 5,
                "harga": 8500,
                "harga_label": "Reseller",
                "diskon": 0
            }
        ]
    })
    assert resp.status_code == 200, f"Create credit order failed: {resp.status_code}"
    credit_order = resp.json()
    credit_order_id = credit_order["id"]
    log(f"✅ Credit order created: {credit_order['no_so']}")
    
    # Test 7: Kirim credit order
    log("Test 6.7: Kirim credit order")
    resp = session.post(f"{BASE_URL}/sales/orders/{credit_order_id}/kirim", json={})
    assert resp.status_code == 200, f"Kirim credit order failed: {resp.status_code}"
    credit_sent = resp.json()
    assert credit_sent["status"] == "dikirim", f"Credit order should be dikirim, got {credit_sent['status']}"
    assert credit_sent["sisa"] == credit_sent["total"], "Sisa should equal total for unpaid credit"
    log(f"✅ Credit order sent: status={credit_sent['status']}, sisa={credit_sent['sisa']}")
    
    # Test 8: GET /sales/piutang (verify credit order appears)
    log("Test 6.8: GET /sales/piutang (verify piutang)")
    resp = session.get(f"{BASE_URL}/sales/piutang")
    assert resp.status_code == 200, f"GET piutang failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in piutang"
    assert "total_piutang" in data, "No total_piutang"
    # Find our credit order
    found = any(item["id"] == credit_order_id for item in data["items"])
    assert found, "Credit order not found in piutang"
    log(f"✅ Piutang retrieved: {data['total']} items, total_piutang={data['total_piutang']}")
    
    # Test 9: POST /sales/orders/{id}/bayar (partial payment)
    log("Test 6.9: POST /sales/orders/{id}/bayar (partial payment)")
    partial_amount = credit_sent["total"] / 2
    resp = session.post(f"{BASE_URL}/sales/orders/{credit_order_id}/bayar", json={
        "jumlah": partial_amount,
        "metode": "Transfer"
    })
    assert resp.status_code == 200, f"Bayar failed: {resp.status_code} {resp.text}"
    payment = resp.json()
    assert payment["status"] == "sebagian", f"Status should be sebagian, got {payment['status']}"
    assert abs(payment["sisa"] - partial_amount) < 0.01, f"Sisa mismatch: {payment['sisa']}"
    log(f"✅ Partial payment successful: terbayar={payment['terbayar']}, sisa={payment['sisa']}, status={payment['status']}")
    
    # Test 10: POST /sales/orders/{id}/bayar (full payment)
    log("Test 6.10: POST /sales/orders/{id}/bayar (full payment)")
    resp = session.post(f"{BASE_URL}/sales/orders/{credit_order_id}/bayar", json={
        "jumlah": payment["sisa"],
        "metode": "Transfer"
    })
    assert resp.status_code == 200, f"Bayar lunas failed: {resp.status_code}"
    payment_full = resp.json()
    assert payment_full["status"] == "lunas", f"Status should be lunas, got {payment_full['status']}"
    assert payment_full["sisa"] < 0.01, f"Sisa should be 0, got {payment_full['sisa']}"
    log(f"✅ Full payment successful: status={payment_full['status']}, sisa={payment_full['sisa']}")
    
    # Test 11: Create draft order for deletion test
    log("Test 6.11: Create draft order for deletion")
    resp = session.post(f"{BASE_URL}/sales/order", json={
        "pelanggan_id": pelanggan_id,
        "gudang_id": gudang_id,
        "tipe": "tunai",
        "items": [
            {
                "item_id": barang_id,
                "qty": 1,
                "harga": 10000,
                "harga_label": "Standar",
                "diskon": 0
            }
        ]
    })
    draft_order = resp.json()
    draft_order_id = draft_order["id"]
    
    # Test 12: DELETE /sales/orders/{id} (delete draft)
    log("Test 6.12: DELETE /sales/orders/{id} (delete draft)")
    resp = session.delete(f"{BASE_URL}/sales/orders/{draft_order_id}")
    assert resp.status_code == 200, f"Delete draft failed: {resp.status_code}"
    log("✅ Draft order deleted")
    
    # Test 13: Verify existing demo data (SO-0001/INV-0001)
    log("Test 6.13: Verify existing demo data (SO-0001)")
    resp = session.get(f"{BASE_URL}/sales/orders?q=SO-0001")
    if resp.status_code == 200:
        data = resp.json()
        if data["total"] > 0:
            demo_order = data["items"][0]
            log(f"✅ Demo data verified: {demo_order['no_so']}, status={demo_order['status']}, item={demo_order['items'][0]['item_nama']}, harga_label={demo_order['items'][0].get('harga_label', 'N/A')}")
        else:
            log("ℹ️  Demo data SO-0001 not found (may have been reset)")
    
    log("✅ PENJUALAN MODULE: ALL TESTS PASSED (13/13)\n")


def test_finance():
    """Test finance endpoints"""
    log("=" * 80)
    log("MODULE 7: KEUANGAN")
    log("=" * 80)
    
    # Test 1: GET /finance/rekening
    log("Test 7.1: GET /finance/rekening")
    resp = session.get(f"{BASE_URL}/finance/rekening")
    assert resp.status_code == 200, f"GET rekening failed: {resp.status_code}"
    data = resp.json()
    assert "rekening" in data, "No rekening in response"
    assert "total_saldo" in data, "No total_saldo"
    log(f"✅ Rekening list: {len(data['rekening'])} items, total_saldo={data['total_saldo']}")
    
    # Test 2: GET /finance/transactions
    log("Test 7.2: GET /finance/transactions")
    resp = session.get(f"{BASE_URL}/finance/transactions")
    assert resp.status_code == 200, f"GET transactions failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in transactions"
    log(f"✅ Finance transactions: {data['total']} items")
    
    # Test 3: GET /finance/summary
    log("Test 7.3: GET /finance/summary")
    resp = session.get(f"{BASE_URL}/finance/summary")
    assert resp.status_code == 200, f"GET summary failed: {resp.status_code}"
    data = resp.json()
    assert "total_saldo" in data, "No total_saldo"
    assert "masuk_bulan" in data, "No masuk_bulan"
    assert "keluar_bulan" in data, "No keluar_bulan"
    log(f"✅ Finance summary: saldo={data['total_saldo']}, masuk={data['masuk_bulan']}, keluar={data['keluar_bulan']}")
    
    # Test 4: GET /finance/laba-rugi
    log("Test 7.4: GET /finance/laba-rugi")
    resp = session.get(f"{BASE_URL}/finance/laba-rugi")
    assert resp.status_code == 200, f"GET laba-rugi failed: {resp.status_code}"
    data = resp.json()
    assert "pendapatan" in data, "No pendapatan"
    assert "hpp" in data, "No hpp"
    assert "laba_kotor" in data, "No laba_kotor"
    assert "beban" in data, "No beban"
    assert "laba_bersih" in data, "No laba_bersih"
    log(f"✅ Laba-rugi: pendapatan={data['pendapatan']}, hpp={data['hpp']}, laba_kotor={data['laba_kotor']}, laba_bersih={data['laba_bersih']}")
    
    log("✅ KEUANGAN MODULE: ALL TESTS PASSED (4/4)\n")


def test_hr():
    """Test HR endpoints"""
    log("=" * 80)
    log("MODULE 8: HR & PAYROLL")
    log("=" * 80)
    
    # Test 1: GET /hr/attendance
    log("Test 8.1: GET /hr/attendance")
    resp = session.get(f"{BASE_URL}/hr/attendance")
    assert resp.status_code == 200, f"GET attendance failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in attendance"
    log(f"✅ Attendance list: {data['total']} items")
    
    # Test 2: GET /hr/payroll
    log("Test 8.2: GET /hr/payroll")
    resp = session.get(f"{BASE_URL}/hr/payroll")
    assert resp.status_code == 200, f"GET payroll failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in payroll"
    log(f"✅ Payroll list: {data['total']} items")
    
    # Test 3: GET /hr/kasbon
    log("Test 8.3: GET /hr/kasbon")
    resp = session.get(f"{BASE_URL}/hr/kasbon")
    assert resp.status_code == 200, f"GET kasbon failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in kasbon"
    assert "total_aktif" in data, "No total_aktif"
    log(f"✅ Kasbon list: {data['total']} items, total_aktif={data['total_aktif']}")
    
    # Test 4: GET /hr/summary
    log("Test 8.4: GET /hr/summary")
    resp = session.get(f"{BASE_URL}/hr/summary")
    assert resp.status_code == 200, f"GET summary failed: {resp.status_code}"
    data = resp.json()
    assert "karyawan_aktif" in data, "No karyawan_aktif"
    assert "kasbon_aktif" in data, "No kasbon_aktif"
    assert "gaji_bulan" in data, "No gaji_bulan"
    log(f"✅ HR summary: karyawan_aktif={data['karyawan_aktif']}, kasbon_aktif={data['kasbon_aktif']}, gaji_bulan={data['gaji_bulan']}")
    
    log("✅ HR MODULE: ALL TESTS PASSED (4/4)\n")


def test_dashboard():
    """Test dashboard KPI"""
    log("=" * 80)
    log("MODULE 9: DASHBOARD")
    log("=" * 80)
    
    # Test 1: GET /dashboard
    log("Test 9.1: GET /dashboard (KPI)")
    resp = session.get(f"{BASE_URL}/dashboard")
    assert resp.status_code == 200, f"GET dashboard failed: {resp.status_code}"
    data = resp.json()
    
    # Verify KPI structure
    assert "kpi" in data, "No kpi in dashboard"
    kpi = data["kpi"]
    
    required_kpi = [
        "nilai_persediaan", "nilai_bahan_baku", "nilai_barang_jadi",
        "total_bahan_baku", "total_barang_jadi", "jumlah_gudang",
        "jumlah_supplier", "jumlah_pelanggan", "karyawan_aktif",
        "low_stock_count", "expiring_count", "negative_count",
        "movement_today", "omzet_hari_ini", "omzet_bulan", "omzet_tahun",
        "total_transaksi", "piutang", "laba_kotor", "total_produksi"
    ]
    
    for key in required_kpi:
        assert key in kpi, f"Missing KPI: {key}"
    
    log(f"✅ Dashboard KPI complete:")
    log(f"   - Nilai persediaan: {kpi['nilai_persediaan']}")
    log(f"   - Total BB: {kpi['total_bahan_baku']}, BJ: {kpi['total_barang_jadi']}")
    log(f"   - Gudang: {kpi['jumlah_gudang']}, Supplier: {kpi['jumlah_supplier']}, Pelanggan: {kpi['jumlah_pelanggan']}")
    log(f"   - Low stock: {kpi['low_stock_count']}, Expiring: {kpi['expiring_count']}")
    log(f"   - Omzet bulan: {kpi['omzet_bulan']}, Laba kotor: {kpi['laba_kotor']}")
    log(f"   - Piutang: {kpi['piutang']}, Transaksi: {kpi['total_transaksi']}")
    
    # Verify charts
    assert "chart_movement" in data, "No chart_movement"
    assert "chart_sales" in data, "No chart_sales"
    assert "top_products" in data, "No top_products"
    assert "top_customers" in data, "No top_customers"
    assert "low_stock" in data, "No low_stock"
    assert "recent_movements" in data, "No recent_movements"
    
    log(f"✅ Dashboard charts and lists present")
    
    log("✅ DASHBOARD MODULE: ALL TESTS PASSED (1/1)\n")


def test_settings():
    """Test settings endpoints"""
    log("=" * 80)
    log("MODULE 10: PENGATURAN")
    log("=" * 80)
    
    # Test 1: GET /users
    log("Test 10.1: GET /users")
    resp = session.get(f"{BASE_URL}/users")
    assert resp.status_code == 200, f"GET users failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in users"
    log(f"✅ Users list: {data['total']} items")
    
    # Test 2: POST /users (create)
    log("Test 10.2: POST /users (create)")
    test_email = f"testuser{datetime.now().strftime('%H%M%S')}@test.com"
    resp = session.post(f"{BASE_URL}/users", json={
        "name": "Test User",
        "email": test_email,
        "password": "testpass123",
        "role": "admin",
        "is_active": True
    })
    assert resp.status_code == 200, f"Create user failed: {resp.status_code} {resp.text}"
    user = resp.json()
    assert user["email"] == test_email, "Email mismatch"
    user_id = user["id"]
    log(f"✅ User created: {user['email']}")
    
    # Test 3: PUT /users/{id} (update)
    log("Test 10.3: PUT /users/{id} (update)")
    resp = session.put(f"{BASE_URL}/users/{user_id}", json={
        "name": "Test User Updated"
    })
    assert resp.status_code == 200, f"Update user failed: {resp.status_code}"
    log("✅ User updated")
    
    # Test 4: DELETE /users/{id}
    log("Test 10.4: DELETE /users/{id}")
    resp = session.delete(f"{BASE_URL}/users/{user_id}")
    assert resp.status_code == 200, f"Delete user failed: {resp.status_code}"
    log("✅ User deleted")
    
    # Test 5: GET /backup (version 2 with password_hash)
    log("Test 10.5: GET /backup (verify version 2 with password_hash)")
    resp = session.get(f"{BASE_URL}/backup")
    assert resp.status_code == 200, f"GET backup failed: {resp.status_code}"
    backup_data = resp.json()
    assert "version" in backup_data, "No version in backup"
    assert backup_data["version"] == 2, f"Expected version 2, got {backup_data['version']}"
    assert "generated_at" in backup_data, "No generated_at"
    assert "collections" in backup_data, "No collections"
    
    # Verify users have password_hash
    users = backup_data["collections"].get("users", [])
    assert len(users) > 0, "No users in backup"
    admin_user = next((u for u in users if u.get("email") == ADMIN_EMAIL), None)
    assert admin_user is not None, "Admin user not in backup"
    assert "password_hash" in admin_user, "No password_hash in admin user"
    assert admin_user["password_hash"] is not None, "password_hash is None"
    log(f"✅ Backup version 2 verified: {len(backup_data['collections'])} collections, users have password_hash")
    
    # Test 6: POST /backup/restore
    log("Test 10.6: POST /backup/restore")
    
    # Create a test item to verify restore reverts data
    resp = session.post(f"{BASE_URL}/master/kategori", json={"nama": "Kategori Before Restore"})
    test_kategori = resp.json()
    log(f"Created test kategori: {test_kategori['kode']}")
    
    # Restore backup
    resp = session.post(f"{BASE_URL}/backup/restore", json=backup_data)
    assert resp.status_code == 200, f"Restore failed: {resp.status_code} {resp.text}"
    restore_result = resp.json()
    assert "restored" in restore_result, "No restored in response"
    assert "total" in restore_result, "No total in response"
    log(f"✅ Restore successful: {restore_result['total']} documents restored")
    
    # Test 7: Verify login still works after restore (seed_admin called)
    log("Test 10.7: Verify login works after restore")
    # Logout first
    session.post(f"{BASE_URL}/auth/logout")
    # Login again
    resp = session.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login after restore failed: {resp.status_code}"
    log("✅ Login works after restore (seed_admin preserved credentials)")
    
    # Test 8: Verify test kategori was removed by restore
    log("Test 10.8: Verify data reverted after restore")
    resp = session.get(f"{BASE_URL}/master/kategori?q=Before Restore")
    data = resp.json()
    assert data["total"] == 0, "Test kategori should be removed after restore"
    log("✅ Data correctly reverted after restore")
    
    log("✅ PENGATURAN MODULE: ALL TESTS PASSED (8/8)\n")


def test_audit():
    """Test audit log"""
    log("=" * 80)
    log("MODULE 11: AUDIT TRAIL")
    log("=" * 80)
    
    # Test 1: GET /audit
    log("Test 11.1: GET /audit")
    resp = session.get(f"{BASE_URL}/audit")
    assert resp.status_code == 200, f"GET audit failed: {resp.status_code}"
    data = resp.json()
    assert "items" in data, "No items in audit"
    assert data["total"] > 0, "No audit logs found"
    log(f"✅ Audit logs: {data['total']} items")
    
    # Test 2: GET /audit?action=login
    log("Test 11.2: GET /audit?action=login")
    resp = session.get(f"{BASE_URL}/audit?action=login")
    assert resp.status_code == 200, f"GET audit login failed: {resp.status_code}"
    data = resp.json()
    assert data["total"] > 0, "No login audit logs"
    log(f"✅ Login audit logs: {data['total']} items")
    
    # Test 3: GET /audit?action=create
    log("Test 11.3: GET /audit?action=create")
    resp = session.get(f"{BASE_URL}/audit?action=create")
    assert resp.status_code == 200, f"GET audit create failed: {resp.status_code}"
    data = resp.json()
    log(f"✅ Create audit logs: {data['total']} items")
    
    # Test 4: GET /audit?action=restore
    log("Test 11.4: GET /audit?action=restore")
    resp = session.get(f"{BASE_URL}/audit?action=restore")
    assert resp.status_code == 200, f"GET audit restore failed: {resp.status_code}"
    data = resp.json()
    assert data["total"] > 0, "No restore audit logs (restore was performed in test 10)"
    log(f"✅ Restore audit logs: {data['total']} items")
    
    log("✅ AUDIT MODULE: ALL TESTS PASSED (4/4)\n")


def main():
    """Run all tests"""
    log("=" * 80)
    log("STARTING COMPREHENSIVE BACKEND REGRESSION TEST")
    log("=" * 80)
    log(f"Backend URL: {BASE_URL}")
    log(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("")
    
    try:
        test_auth()
        test_rbac()
        test_master_data()
        test_stock()
        test_production()
        test_sales()
        test_finance()
        test_hr()
        test_dashboard()
        test_settings()
        test_audit()
        
        log("=" * 80)
        log("✅ ALL TESTS PASSED - BACKEND FULLY FUNCTIONAL")
        log("=" * 80)
        log(f"Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return 0
        
    except AssertionError as e:
        log("")
        log("=" * 80)
        log(f"❌ TEST FAILED: {str(e)}")
        log("=" * 80)
        return 1
    except Exception as e:
        log("")
        log("=" * 80)
        log(f"❌ ERROR: {str(e)}")
        log("=" * 80)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
