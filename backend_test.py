#!/usr/bin/env python3
"""
Backend API Test Suite for ERP Backup & Restore Feature
Tests the backup export and restore functionality
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://repo-ulang-build.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin"
ADMIN_PASSWORD = "torillaz123"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"{Colors.GREEN}✓{Colors.RESET} {test_name}")
    
    def add_fail(self, test_name: str, reason: str):
        self.failed += 1
        error_msg = f"{test_name}: {reason}"
        self.errors.append(error_msg)
        print(f"{Colors.RED}✗{Colors.RESET} {test_name}")
        print(f"  {Colors.RED}Reason: {reason}{Colors.RESET}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"Test Summary: {self.passed}/{total} passed")
        if self.failed > 0:
            print(f"{Colors.RED}Failed tests:{Colors.RESET}")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}\n")
        return self.failed == 0

def login() -> Optional[str]:
    """Login and return access token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            if token:
                print(f"{Colors.GREEN}✓{Colors.RESET} Login successful")
                return token
            else:
                print(f"{Colors.RED}✗{Colors.RESET} Login response missing access_token")
                return None
        else:
            print(f"{Colors.RED}✗{Colors.RESET} Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.RESET} Login error: {str(e)}")
        return None

def test_backup_export(token: str, result: TestResult) -> Optional[Dict[str, Any]]:
    """Test GET /api/backup - should return version 2 with password_hash"""
    test_name = "GET /api/backup - Export backup with version 2"
    
    try:
        response = requests.get(
            f"{BASE_URL}/backup",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            result.add_fail(test_name, f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        
        # Check version field
        if data.get("version") != 2:
            result.add_fail(test_name, f"Expected version 2, got {data.get('version')}")
            return None
        
        # Check generated_at field
        if "generated_at" not in data:
            result.add_fail(test_name, "Missing 'generated_at' field")
            return None
        
        # Check collections field
        if "collections" not in data:
            result.add_fail(test_name, "Missing 'collections' field")
            return None
        
        collections = data["collections"]
        
        # Check users collection has password_hash
        if "users" not in collections:
            result.add_fail(test_name, "Missing 'users' collection")
            return None
        
        users = collections["users"]
        if not users:
            result.add_fail(test_name, "Users collection is empty")
            return None
        
        # Verify users have 'id' field (not '_id') and 'password_hash'
        user_with_hash = False
        for user in users:
            if "_id" in user:
                result.add_fail(test_name, f"User has '_id' field instead of 'id': {user}")
                return None
            if "id" not in user:
                result.add_fail(test_name, f"User missing 'id' field: {user}")
                return None
            if "password_hash" in user and user["password_hash"]:
                user_with_hash = True
        
        if not user_with_hash:
            result.add_fail(test_name, "No user has 'password_hash' field")
            return None
        
        # Check counters collection exists and has string IDs
        if "counters" in collections:
            counters = collections["counters"]
            for counter in counters:
                if "_id" in counter:
                    result.add_fail(test_name, f"Counter has '_id' instead of 'id': {counter}")
                    return None
                if "id" not in counter:
                    result.add_fail(test_name, f"Counter missing 'id' field: {counter}")
                    return None
                # Counter IDs should be strings like "KAT", "SUP", etc.
                counter_id = counter["id"]
                if not isinstance(counter_id, str):
                    result.add_fail(test_name, f"Counter id should be string, got {type(counter_id)}: {counter_id}")
                    return None
        
        result.add_pass(test_name)
        return data
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return None

def test_create_kategori(token: str, result: TestResult) -> Optional[str]:
    """Create a test kategori and return its ID"""
    test_name = "POST /api/master/kategori - Create test kategori"
    
    try:
        response = requests.post(
            f"{BASE_URL}/master/kategori",
            headers={"Authorization": f"Bearer {token}"},
            json={"nama": "Kategori Test Restore"},
            timeout=10
        )
        
        if response.status_code not in [200, 201]:
            result.add_fail(test_name, f"Expected 200/201, got {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        kategori_id = data.get("id")
        
        if not kategori_id:
            result.add_fail(test_name, "Response missing 'id' field")
            return None
        
        result.add_pass(test_name)
        return kategori_id
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return None

def test_get_kategori_list(token: str, result: TestResult) -> Optional[list]:
    """Get list of kategori"""
    test_name = "GET /api/master/kategori - Get kategori list"
    
    try:
        response = requests.get(
            f"{BASE_URL}/master/kategori",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            result.add_fail(test_name, f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        items = data.get("items", [])
        
        result.add_pass(test_name)
        return items
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return None

def test_restore_backup(token: str, backup_data: Dict[str, Any], result: TestResult) -> bool:
    """Test POST /api/backup/restore"""
    test_name = "POST /api/backup/restore - Restore backup data"
    
    try:
        response = requests.post(
            f"{BASE_URL}/backup/restore",
            headers={"Authorization": f"Bearer {token}"},
            json=backup_data,
            timeout=60
        )
        
        if response.status_code != 200:
            result.add_fail(test_name, f"Expected 200, got {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        
        # Check response structure
        if "restored" not in data:
            result.add_fail(test_name, "Response missing 'restored' field")
            return False
        
        if "total" not in data:
            result.add_fail(test_name, "Response missing 'total' field")
            return False
        
        if "skipped" not in data:
            result.add_fail(test_name, "Response missing 'skipped' field")
            return False
        
        # Check total > 0
        if data["total"] <= 0:
            result.add_fail(test_name, f"Expected total > 0, got {data['total']}")
            return False
        
        # Check restored contains collections
        restored = data["restored"]
        expected_collections = ["users", "master_kategori", "stock_balances"]
        for coll in expected_collections:
            if coll not in restored:
                result.add_fail(test_name, f"Expected '{coll}' in restored collections")
                return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def test_verify_kategori_removed(token: str, kategori_name: str, result: TestResult) -> bool:
    """Verify that the test kategori was removed after restore"""
    test_name = f"Verify kategori '{kategori_name}' removed after restore"
    
    try:
        items = test_get_kategori_list(token, TestResult())  # Don't count this in main result
        
        if items is None:
            result.add_fail(test_name, "Failed to get kategori list")
            return False
        
        # Check if test kategori exists
        for item in items:
            if item.get("nama") == kategori_name:
                result.add_fail(test_name, f"Kategori '{kategori_name}' still exists after restore")
                return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def test_login_after_restore(result: TestResult) -> Optional[str]:
    """Test that admin login still works after restore"""
    test_name = "Login after restore - Verify admin credentials work"
    
    token = login()
    if token:
        result.add_pass(test_name)
        return token
    else:
        result.add_fail(test_name, "Login failed after restore")
        return None

def test_stock_consistency(token: str, result: TestResult) -> bool:
    """Test GET /api/stock/summary - Verify stock data consistency"""
    test_name = "GET /api/stock/summary - Verify stock consistency after restore"
    
    try:
        response = requests.get(
            f"{BASE_URL}/stock/summary",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            result.add_fail(test_name, f"Expected 200, got {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        
        # Just verify we get a response with items
        if "items" not in data:
            result.add_fail(test_name, "Response missing 'items' field")
            return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def test_audit_log_restore(token: str, result: TestResult) -> bool:
    """Test GET /api/audit?action=restore - Verify audit log has restore entry"""
    test_name = "GET /api/audit?action=restore - Verify restore audit log"
    
    try:
        response = requests.get(
            f"{BASE_URL}/audit?action=restore",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code != 200:
            result.add_fail(test_name, f"Expected 200, got {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        items = data.get("items", [])
        
        # Check if there's at least one restore entry
        restore_found = False
        for item in items:
            if item.get("action") == "restore":
                restore_found = True
                break
        
        if not restore_found:
            result.add_fail(test_name, "No restore entry found in audit log")
            return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def test_restore_error_empty_collections(token: str, result: TestResult) -> bool:
    """Test POST /api/backup/restore with empty collections - should return 400"""
    test_name = "POST /api/backup/restore - Error case: empty collections"
    
    try:
        response = requests.post(
            f"{BASE_URL}/backup/restore",
            headers={"Authorization": f"Bearer {token}"},
            json={"collections": {}},
            timeout=10
        )
        
        if response.status_code != 400:
            result.add_fail(test_name, f"Expected 400, got {response.status_code}")
            return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def test_restore_error_unknown_collection(token: str, result: TestResult) -> bool:
    """Test POST /api/backup/restore with unknown collection - should return 400"""
    test_name = "POST /api/backup/restore - Error case: unknown collection"
    
    try:
        response = requests.post(
            f"{BASE_URL}/backup/restore",
            headers={"Authorization": f"Bearer {token}"},
            json={"collections": {"koleksi_asing": [{"id": "x"}]}},
            timeout=10
        )
        
        if response.status_code != 400:
            result.add_fail(test_name, f"Expected 400, got {response.status_code}")
            return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def test_restore_error_no_auth(result: TestResult) -> bool:
    """Test POST /api/backup/restore without auth - should return 401"""
    test_name = "POST /api/backup/restore - Error case: no authentication"
    
    try:
        response = requests.post(
            f"{BASE_URL}/backup/restore",
            json={"collections": {"users": []}},
            timeout=10
        )
        
        if response.status_code != 401:
            result.add_fail(test_name, f"Expected 401, got {response.status_code}")
            return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def test_backward_compat_v1_backup(token: str, backup_data: Dict[str, Any], result: TestResult) -> bool:
    """Test restore of v1 backup (without password_hash) - should preserve existing hashes"""
    test_name = "POST /api/backup/restore - Backward compatibility: v1 backup without password_hash"
    
    try:
        # Create a v1 backup by removing password_hash from all users
        v1_backup = json.loads(json.dumps(backup_data))  # Deep copy
        
        if "collections" in v1_backup and "users" in v1_backup["collections"]:
            for user in v1_backup["collections"]["users"]:
                if "password_hash" in user:
                    del user["password_hash"]
        
        # Set version to 1 (or remove it)
        v1_backup["version"] = 1
        
        # Restore v1 backup
        response = requests.post(
            f"{BASE_URL}/backup/restore",
            headers={"Authorization": f"Bearer {token}"},
            json=v1_backup,
            timeout=60
        )
        
        if response.status_code != 200:
            result.add_fail(test_name, f"Expected 200, got {response.status_code}: {response.text}")
            return False
        
        # Try to login with admin credentials - should still work
        # because seed_admin() is called after restore
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if login_response.status_code != 200:
            result.add_fail(test_name, f"Login failed after v1 restore: {login_response.status_code}")
            return False
        
        result.add_pass(test_name)
        return True
        
    except Exception as e:
        result.add_fail(test_name, f"Exception: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*60}")
    print("ERP Backup & Restore Feature Test Suite")
    print(f"{'='*60}{Colors.RESET}\n")
    print(f"Base URL: {BASE_URL}\n")
    
    result = TestResult()
    
    # Step 1: Login
    print(f"{Colors.YELLOW}Step 1: Authentication{Colors.RESET}")
    token = login()
    if not token:
        print(f"\n{Colors.RED}Cannot proceed without authentication{Colors.RESET}\n")
        return 1
    print()
    
    # Step 2: Test backup export
    print(f"{Colors.YELLOW}Step 2: Test Backup Export{Colors.RESET}")
    backup_data = test_backup_export(token, result)
    if not backup_data:
        print(f"\n{Colors.RED}Cannot proceed without backup data{Colors.RESET}\n")
        return 1
    print()
    
    # Step 3: Create test kategori
    print(f"{Colors.YELLOW}Step 3: Create Test Data (Kategori){Colors.RESET}")
    kategori_id = test_create_kategori(token, result)
    if not kategori_id:
        print(f"\n{Colors.RED}Failed to create test kategori{Colors.RESET}\n")
        return 1
    
    # Verify kategori exists
    items_before = test_get_kategori_list(token, result)
    if items_before is None:
        print(f"\n{Colors.RED}Failed to get kategori list{Colors.RESET}\n")
        return 1
    
    kategori_count_before = len(items_before)
    print(f"  Kategori count before restore: {kategori_count_before}")
    print()
    
    # Step 4: Test restore
    print(f"{Colors.YELLOW}Step 4: Test Backup Restore{Colors.RESET}")
    restore_success = test_restore_backup(token, backup_data, result)
    if not restore_success:
        print(f"\n{Colors.RED}Restore failed{Colors.RESET}\n")
        return 1
    print()
    
    # Step 5: Verify data reverted
    print(f"{Colors.YELLOW}Step 5: Verify Data Reverted{Colors.RESET}")
    test_verify_kategori_removed(token, "Kategori Test Restore", result)
    print()
    
    # Step 6: Verify login after restore
    print(f"{Colors.YELLOW}Step 6: Verify Login After Restore{Colors.RESET}")
    new_token = test_login_after_restore(result)
    if not new_token:
        print(f"\n{Colors.RED}Login failed after restore{Colors.RESET}\n")
        return 1
    print()
    
    # Step 7: Verify stock consistency
    print(f"{Colors.YELLOW}Step 7: Verify Stock Consistency{Colors.RESET}")
    test_stock_consistency(new_token, result)
    print()
    
    # Step 8: Verify audit log
    print(f"{Colors.YELLOW}Step 8: Verify Audit Log{Colors.RESET}")
    test_audit_log_restore(new_token, result)
    print()
    
    # Step 9: Error cases
    print(f"{Colors.YELLOW}Step 9: Test Error Cases{Colors.RESET}")
    test_restore_error_empty_collections(new_token, result)
    test_restore_error_unknown_collection(new_token, result)
    test_restore_error_no_auth(result)
    print()
    
    # Step 10: Backward compatibility
    print(f"{Colors.YELLOW}Step 10: Test Backward Compatibility (v1 backup){Colors.RESET}")
    test_backward_compat_v1_backup(new_token, backup_data, result)
    print()
    
    # Summary
    success = result.summary()
    
    if success:
        print(f"{Colors.GREEN}All tests passed!{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.RED}Some tests failed. See details above.{Colors.RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
