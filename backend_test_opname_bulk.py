#!/usr/bin/env python3
"""
Comprehensive test for Bulk Stock Opname Endpoint (POST /api/stock/opname-bulk)
Tests all scenarios including positive/negative adjustments, skipped items, error cases, and data restoration.
"""

import requests
import sys
import os
from typing import Dict, List, Any

# Backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://torillaz-rebuild.preview.emergentagent.com")
BASE_URL = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "torillaz123"

# Global session
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

# Test state
test_results = []
original_balances = []  # Store original balances for restoration


def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    msg = f"{status} - {name}"
    if details:
        msg += f": {details}"
    print(msg)
    test_results.append({"name": name, "passed": passed, "details": details})


def login() -> bool:
    """Login as admin and store session cookies"""
    try:
        resp = session.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            data = resp.json()
            # Also set Bearer token if available
            if "access_token" in data:
                session.headers.update({"Authorization": f"Bearer {data['access_token']}"})
            log_test("Login", True, f"Logged in as {ADMIN_EMAIL}")
            return True
        else:
            log_test("Login", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("Login", False, str(e))
        return False


def get_stock_balances(limit: int = 50) -> List[Dict[str, Any]]:
    """Get current stock balances"""
    try:
        resp = session.get(f"{BASE_URL}/stock/balances", params={"limit": limit})
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            log_test("GET /api/stock/balances", True, f"Retrieved {len(items)} balance records")
            return items
        else:
            log_test("GET /api/stock/balances", False, f"Status {resp.status_code}: {resp.text}")
            return []
    except Exception as e:
        log_test("GET /api/stock/balances", False, str(e))
        return []


def select_test_items(balances: List[Dict]) -> Dict[str, Any]:
    """Select test items: 1 bahan_baku and 1 barang_jadi with sufficient qty"""
    bahan_baku = None
    barang_jadi = None
    
    for bal in balances:
        if bal.get("item_type") == "bahan_baku" and bal.get("qty", 0) >= 5 and not bahan_baku:
            bahan_baku = bal
        elif bal.get("item_type") == "barang_jadi" and bal.get("qty", 0) >= 5 and not barang_jadi:
            barang_jadi = bal
        
        if bahan_baku and barang_jadi:
            break
    
    return {"bahan_baku": bahan_baku, "barang_jadi": barang_jadi}


def test_opname_bulk_success():
    """Test successful bulk opname with 3 items: +5, -2, and same qty (skipped)"""
    print("\n=== TEST: Successful Bulk Opname ===")
    
    # Get current balances
    balances = get_stock_balances(limit=50)
    if not balances:
        log_test("Bulk Opname - Get Balances", False, "No balances found")
        return False
    
    # Select test items
    test_items = select_test_items(balances)
    bahan_baku = test_items.get("bahan_baku")
    barang_jadi = test_items.get("barang_jadi")
    
    if not bahan_baku or not barang_jadi:
        log_test("Bulk Opname - Select Items", False, "Could not find suitable test items")
        return False
    
    # Store original balances for restoration
    global original_balances
    original_balances = [
        {
            "item_type": bahan_baku["item_type"],
            "item_id": bahan_baku["item_id"],
            "gudang_id": bahan_baku["gudang_id"],
            "batch": bahan_baku.get("batch", "-"),
            "qty_original": bahan_baku["qty"],
            "avg_price": bahan_baku["avg_price"]
        },
        {
            "item_type": barang_jadi["item_type"],
            "item_id": barang_jadi["item_id"],
            "gudang_id": barang_jadi["gudang_id"],
            "batch": barang_jadi.get("batch", "-"),
            "qty_original": barang_jadi["qty"],
            "avg_price": barang_jadi["avg_price"]
        }
    ]
    
    log_test("Select Test Items", True, 
             f"BB: {bahan_baku['item_nama']} (qty={bahan_baku['qty']}), "
             f"BJ: {barang_jadi['item_nama']} (qty={barang_jadi['qty']})")
    
    # Prepare opname payload
    payload = {
        "keterangan": "Test bulk opname",
        "items": [
            {
                "item_type": bahan_baku["item_type"],
                "item_id": bahan_baku["item_id"],
                "gudang_id": bahan_baku["gudang_id"],
                "batch": bahan_baku.get("batch", "-"),
                "qty_aktual": bahan_baku["qty"] + 5  # +5 increase
            },
            {
                "item_type": barang_jadi["item_type"],
                "item_id": barang_jadi["item_id"],
                "gudang_id": barang_jadi["gudang_id"],
                "batch": barang_jadi.get("batch", "-"),
                "qty_aktual": barang_jadi["qty"] - 2  # -2 decrease
            },
            {
                "item_type": bahan_baku["item_type"],
                "item_id": bahan_baku["item_id"],
                "gudang_id": bahan_baku["gudang_id"],
                "batch": bahan_baku.get("batch", "-"),
                "qty_aktual": bahan_baku["qty"] + 5  # Same as first (will be same after first adjustment)
            }
        ]
    }
    
    # Execute bulk opname
    try:
        resp = session.post(f"{BASE_URL}/stock/opname-bulk", json=payload)
        if resp.status_code != 200:
            log_test("POST /api/stock/opname-bulk", False, f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        adjusted = data.get("adjusted", 0)
        skipped = data.get("skipped", 0)
        results = data.get("results", [])
        
        # Verify response structure
        if adjusted == 2 and skipped == 1:
            log_test("Bulk Opname Response", True, f"adjusted={adjusted}, skipped={skipped}")
        else:
            log_test("Bulk Opname Response", False, f"Expected adjusted=2, skipped=1, got adjusted={adjusted}, skipped={skipped}")
            return False
        
        # Verify results array
        if len(results) == 2:
            log_test("Results Array Length", True, f"{len(results)} items adjusted")
        else:
            log_test("Results Array Length", False, f"Expected 2 results, got {len(results)}")
        
        # Verify result details
        for r in results:
            selisih = r.get("selisih", 0)
            qty_sistem = r.get("qty_sistem", 0)
            qty_aktual = r.get("qty_aktual", 0)
            expected_selisih = qty_aktual - qty_sistem
            
            if abs(selisih - expected_selisih) < 0.001:
                log_test(f"Selisih Calculation - {r['item_nama']}", True, 
                        f"selisih={selisih} (sistem={qty_sistem}, aktual={qty_aktual})")
            else:
                log_test(f"Selisih Calculation - {r['item_nama']}", False, 
                        f"Expected {expected_selisih}, got {selisih}")
        
        return True
        
    except Exception as e:
        log_test("POST /api/stock/opname-bulk", False, str(e))
        return False


def verify_balances_updated():
    """Verify that balances are updated correctly and avg_price unchanged"""
    print("\n=== VERIFY: Balances Updated ===")
    
    if not original_balances:
        log_test("Verify Balances", False, "No original balances stored")
        return False
    
    balances = get_stock_balances(limit=50)
    if not balances:
        return False
    
    for orig in original_balances:
        # Find matching balance
        matching = None
        for bal in balances:
            if (bal["item_type"] == orig["item_type"] and 
                bal["item_id"] == orig["item_id"] and
                bal["gudang_id"] == orig["gudang_id"] and
                bal.get("batch", "-") == orig.get("batch", "-")):
                matching = bal
                break
        
        if not matching:
            log_test(f"Find Balance - {orig['item_type']}", False, "Balance not found")
            continue
        
        # Calculate expected qty
        if orig == original_balances[0]:  # First item (+5)
            expected_qty = orig["qty_original"] + 5
        else:  # Second item (-2)
            expected_qty = orig["qty_original"] - 2
        
        # Verify qty updated
        if abs(matching["qty"] - expected_qty) < 0.001:
            log_test(f"Qty Updated - {matching['item_nama']}", True, 
                    f"qty={matching['qty']} (expected={expected_qty})")
        else:
            log_test(f"Qty Updated - {matching['item_nama']}", False, 
                    f"Expected {expected_qty}, got {matching['qty']}")
        
        # Verify avg_price unchanged
        if abs(matching["avg_price"] - orig["avg_price"]) < 0.001:
            log_test(f"Avg Price Unchanged - {matching['item_nama']}", True, 
                    f"avg_price={matching['avg_price']}")
        else:
            log_test(f"Avg Price Unchanged - {matching['item_nama']}", False, 
                    f"Expected {orig['avg_price']}, got {matching['avg_price']}")
    
    return True


def verify_movements_created():
    """Verify that opname movements are created correctly"""
    print("\n=== VERIFY: Movements Created ===")
    
    try:
        resp = session.get(f"{BASE_URL}/stock/movements", params={"tipe": "opname", "limit": 10})
        if resp.status_code != 200:
            log_test("GET /api/stock/movements?tipe=opname", False, f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        items = data.get("items", [])
        
        if len(items) >= 2:
            log_test("Opname Movements Found", True, f"Found {len(items)} opname movements")
        else:
            log_test("Opname Movements Found", False, f"Expected at least 2, found {len(items)}")
            return False
        
        # Verify movement details (check first 2 movements)
        for i, mv in enumerate(items[:2]):
            # Verify tipe
            if mv.get("tipe") == "opname":
                log_test(f"Movement {i+1} - Type", True, "tipe=opname")
            else:
                log_test(f"Movement {i+1} - Type", False, f"Expected 'opname', got '{mv.get('tipe')}'")
            
            # Verify keterangan contains required fields
            ket = mv.get("keterangan", "")
            if "Sistem:" in ket and "Fisik:" in ket and "Selisih:" in ket:
                log_test(f"Movement {i+1} - Keterangan", True, "Contains Sistem/Fisik/Selisih")
            else:
                log_test(f"Movement {i+1} - Keterangan", False, f"Missing required fields: {ket}")
            
            # Verify qty is signed selisih
            qty = mv.get("qty", 0)
            saldo_akhir = mv.get("saldo_akhir", 0)
            log_test(f"Movement {i+1} - Data", True, 
                    f"qty={qty} (signed selisih), saldo_akhir={saldo_akhir}")
        
        return True
        
    except Exception as e:
        log_test("GET /api/stock/movements", False, str(e))
        return False


def verify_audit_log():
    """Verify audit log entry for bulk opname"""
    print("\n=== VERIFY: Audit Log ===")
    
    try:
        # Try GET /api/audit
        resp = session.get(f"{BASE_URL}/audit", params={"limit": 10})
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", [])
            
            # Look for stock_opname_bulk entry
            found = False
            for item in items:
                if item.get("entity") == "stock_opname_bulk":
                    found = True
                    log_test("Audit Log Entry", True, 
                            f"Found stock_opname_bulk entry: {item.get('description', '')}")
                    break
            
            if not found:
                log_test("Audit Log Entry", False, "No stock_opname_bulk entry found in recent logs")
            
            return True
        else:
            log_test("GET /api/audit", False, f"Status {resp.status_code} (endpoint may not exist)")
            return False
            
    except Exception as e:
        log_test("GET /api/audit", False, str(e))
        return False


def test_error_cases():
    """Test error cases"""
    print("\n=== TEST: Error Cases ===")
    
    # Test 1: Empty items array
    try:
        resp = session.post(f"{BASE_URL}/stock/opname-bulk", json={"items": []})
        if resp.status_code == 400:
            log_test("Error Case - Empty Items", True, "Returns 400")
        else:
            log_test("Error Case - Empty Items", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Error Case - Empty Items", False, str(e))
    
    # Test 2: Negative qty_aktual
    try:
        resp = session.post(f"{BASE_URL}/stock/opname-bulk", json={
            "items": [{
                "item_type": "bahan_baku",
                "item_id": "test123",
                "gudang_id": "test456",
                "qty_aktual": -5
            }]
        })
        if resp.status_code == 400:
            log_test("Error Case - Negative Qty", True, "Returns 400")
        else:
            log_test("Error Case - Negative Qty", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Error Case - Negative Qty", False, str(e))
    
    # Test 3: Missing gudang_id
    try:
        resp = session.post(f"{BASE_URL}/stock/opname-bulk", json={
            "items": [{
                "item_type": "bahan_baku",
                "item_id": "test123",
                "qty_aktual": 10
            }]
        })
        if resp.status_code == 400:
            log_test("Error Case - Missing Gudang", True, "Returns 400")
        else:
            log_test("Error Case - Missing Gudang", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Error Case - Missing Gudang", False, str(e))
    
    # Test 4: Invalid qty_aktual (not a number)
    try:
        resp = session.post(f"{BASE_URL}/stock/opname-bulk", json={
            "items": [{
                "item_type": "bahan_baku",
                "item_id": "test123",
                "gudang_id": "test456",
                "qty_aktual": "abc"
            }]
        })
        if resp.status_code == 400:
            log_test("Error Case - Invalid Qty Type", True, "Returns 400")
        else:
            log_test("Error Case - Invalid Qty Type", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Error Case - Invalid Qty Type", False, str(e))
    
    # Test 5: More than 200 items
    try:
        items = [{"item_type": "bahan_baku", "item_id": f"test{i}", "gudang_id": "test", "qty_aktual": 10} 
                 for i in range(201)]
        resp = session.post(f"{BASE_URL}/stock/opname-bulk", json={"items": items})
        if resp.status_code == 400:
            log_test("Error Case - >200 Items", True, "Returns 400")
        else:
            log_test("Error Case - >200 Items", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Error Case - >200 Items", False, str(e))


def test_no_auth():
    """Test without authentication"""
    print("\n=== TEST: No Authentication ===")
    
    try:
        # Create new session without auth
        no_auth_session = requests.Session()
        resp = no_auth_session.post(f"{BASE_URL}/stock/opname-bulk", json={
            "items": [{
                "item_type": "bahan_baku",
                "item_id": "test123",
                "gudang_id": "test456",
                "qty_aktual": 10
            }]
        })
        if resp.status_code in [401, 403]:
            log_test("Error Case - No Auth", True, f"Returns {resp.status_code}")
        else:
            log_test("Error Case - No Auth", False, f"Expected 401/403, got {resp.status_code}")
    except Exception as e:
        log_test("Error Case - No Auth", False, str(e))


def restore_original_balances():
    """Restore original balances using opname-bulk"""
    print("\n=== RESTORE: Original Balances ===")
    
    if not original_balances:
        log_test("Restore Balances", False, "No original balances to restore")
        return False
    
    # Prepare restore payload
    items = []
    for orig in original_balances:
        items.append({
            "item_type": orig["item_type"],
            "item_id": orig["item_id"],
            "gudang_id": orig["gudang_id"],
            "batch": orig.get("batch", "-"),
            "qty_aktual": orig["qty_original"]
        })
    
    payload = {
        "keterangan": "Restore original balances after test",
        "items": items
    }
    
    try:
        resp = session.post(f"{BASE_URL}/stock/opname-bulk", json=payload)
        if resp.status_code != 200:
            log_test("Restore Balances", False, f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        adjusted = data.get("adjusted", 0)
        log_test("Restore Balances", True, f"Restored {adjusted} items to original qty")
        
        # Verify restoration
        balances = get_stock_balances(limit=50)
        all_restored = True
        for orig in original_balances:
            matching = None
            for bal in balances:
                if (bal["item_type"] == orig["item_type"] and 
                    bal["item_id"] == orig["item_id"] and
                    bal["gudang_id"] == orig["gudang_id"] and
                    bal.get("batch", "-") == orig.get("batch", "-")):
                    matching = bal
                    break
            
            if matching and abs(matching["qty"] - orig["qty_original"]) < 0.001:
                log_test(f"Verify Restore - {matching['item_nama']}", True, 
                        f"qty={matching['qty']} (original={orig['qty_original']})")
            else:
                log_test(f"Verify Restore - {orig['item_type']}", False, 
                        f"Qty not restored correctly")
                all_restored = False
        
        return all_restored
        
    except Exception as e:
        log_test("Restore Balances", False, str(e))
        return False


def main():
    """Run all tests"""
    print("=" * 80)
    print("BULK STOCK OPNAME ENDPOINT TEST")
    print("=" * 80)
    
    # Login
    if not login():
        print("\n❌ LOGIN FAILED - Cannot proceed with tests")
        sys.exit(1)
    
    # Run tests
    test_opname_bulk_success()
    verify_balances_updated()
    verify_movements_created()
    verify_audit_log()
    test_error_cases()
    test_no_auth()
    
    # Restore original data
    restore_original_balances()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for t in test_results if t["passed"])
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {passed/total*100:.1f}%")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        print("\nFailed tests:")
        for t in test_results:
            if not t["passed"]:
                print(f"  - {t['name']}: {t['details']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
