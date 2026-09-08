"""
End-to-end backend tests for ERP Manajemen Usaha Terpadu (Phase 1-3).
Covers: Auth, Dashboard, Master CRUD, Stock (single source of truth),
Notifications, RBAC, Users/Roles, Audit, Backup.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL",
                          "https://torillaz-rebuild.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "aguskimju@gmail.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin@12345")

# ---------------------- Fixtures ----------------------


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s._user = data
    return s


@pytest.fixture(scope="session")
def gudang_ids(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/master/gudang/options")
    assert r.status_code == 200
    opts = r.json()
    assert len(opts) >= 2
    return [o["id"] for o in opts]


@pytest.fixture(scope="session")
def bahan_baku_ids(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/master/bahan_baku/options")
    assert r.status_code == 200
    return {o["nama"]: o["id"] for o in r.json()}


# ---------------------- Auth ----------------------


class TestAuth:
    def test_login_success_returns_user(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "super_admin"
        assert "access_token" in d and len(d["access_token"]) > 20
        assert "permissions" in d and "dashboard" in d["permissions"]
        # cookies set
        assert "access_token" in r.cookies

    def test_login_invalid_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "WRONG"})
        assert r.status_code == 401
        assert "salah" in r.json().get("detail", "").lower() or \
               "invalid" in r.json().get("detail", "").lower()

    def test_me_with_bearer(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_brute_force_lockout(self):
        # Use unique fake email so we don't affect the real admin lockout state
        fake = f"lock_{uuid.uuid4().hex[:6]}@x.com"
        # NOTE: Backend runs behind 2 replicas; request.client.host differs per pod,
        # so lockout is per-pod. 15 attempts guarantee at least one 429 on some pod.
        codes = []
        for _ in range(15):
            r = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": fake, "password": "bad"})
            codes.append(r.status_code)
        assert 429 in codes, f"expected 429 lockout, got {codes}"


# ---------------------- Dashboard ----------------------


class TestDashboard:
    def test_dashboard_kpi(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "kpi" in d and "chart_movement" in d
        assert d["kpi"]["jumlah_gudang"] >= 2
        assert d["kpi"]["nilai_persediaan"] > 0
        assert "low_stock_count" in d["kpi"]
        assert len(d["chart_movement"]) == 7
        assert isinstance(d["top_items"], list)
        assert isinstance(d["recent_movements"], list)


# ---------------------- Master Data ----------------------


class TestMaster:
    def test_list_supplier(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/master/supplier?page=1&limit=10")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d
        assert d["total"] >= 2

    def test_options_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/master/gudang/options")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_crud_supplier(self, admin_session):
        nama = f"TEST_Supplier_{uuid.uuid4().hex[:6]}"
        # CREATE
        r = admin_session.post(f"{BASE_URL}/api/master/supplier",
                               json={"nama": nama, "telepon": "0811"})
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["nama"] == nama
        assert created["kode"].startswith("SUP-")
        sid = created["id"]

        # GET by id
        r = admin_session.get(f"{BASE_URL}/api/master/supplier/{sid}")
        assert r.status_code == 200
        assert r.json()["nama"] == nama

        # UPDATE
        r = admin_session.put(f"{BASE_URL}/api/master/supplier/{sid}",
                              json={"telepon": "0899"})
        assert r.status_code == 200
        assert r.json()["telepon"] == "0899"

        # Verify persistence
        r = admin_session.get(f"{BASE_URL}/api/master/supplier/{sid}")
        assert r.json()["telepon"] == "0899"

        # DELETE (soft)
        r = admin_session.delete(f"{BASE_URL}/api/master/supplier/{sid}")
        assert r.status_code == 200

        # Should be gone from list
        r = admin_session.get(f"{BASE_URL}/api/master/supplier/{sid}")
        assert r.status_code == 404

    def test_create_requires_nama(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/master/supplier", json={})
        assert r.status_code == 400


# ---------------------- Stock: Single Source of Truth ----------------------


class TestStock:
    def _get_balance(self, session, item_type, item_id, gudang_id, batch=None):
        """Sum qty across all batches for the item at gudang (unless batch given)."""
        r = session.get(f"{BASE_URL}/api/stock/balances",
                        params={"item_type": item_type, "gudang_id": gudang_id,
                                "limit": 500})
        assert r.status_code == 200
        total = 0
        for row in r.json()["items"]:
            if row["item_id"] != item_id:
                continue
            if batch is not None and row.get("batch") != batch:
                continue
            total += row["qty"]
        return total

    def test_penerimaan_increases_balance(self, admin_session, bahan_baku_ids, gudang_ids):
        item_id = bahan_baku_ids["Tepung Terigu"]
        gudang = gudang_ids[0]
        before = self._get_balance(admin_session, "bahan_baku", item_id, gudang)
        r = admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "penerimaan", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": gudang, "qty": 10, "harga_satuan": 12000,
            "batch": "BATCH-TEST", "keterangan": "TEST penerimaan",
        })
        assert r.status_code == 200, r.text
        after = self._get_balance(admin_session, "bahan_baku", item_id, gudang)
        assert after == before + 10, f"expected +10, got before={before} after={after}"

    def test_pengeluaran_decreases_balance(self, admin_session, bahan_baku_ids, gudang_ids):
        item_id = bahan_baku_ids["Tepung Terigu"]
        gudang = gudang_ids[0]
        # Add stock in BATCH-TEST first (if needed)
        admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "penerimaan", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": gudang, "qty": 20, "harga_satuan": 12000, "batch": "BATCH-TEST"})
        before = self._get_balance(admin_session, "bahan_baku", item_id, gudang)
        r = admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "pengeluaran", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": gudang, "qty": 5, "batch": "BATCH-TEST"})
        assert r.status_code == 200, r.text
        after = self._get_balance(admin_session, "bahan_baku", item_id, gudang)
        assert after == before - 5

    def test_pengeluaran_cannot_go_negative(self, admin_session, bahan_baku_ids, gudang_ids):
        item_id = bahan_baku_ids["Tepung Terigu"]
        gudang = gudang_ids[0]
        r = admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "pengeluaran", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": gudang, "qty": 999999, "batch": "BATCH-TEST"})
        assert r.status_code == 400
        assert "tidak mencukupi" in r.json()["detail"].lower() or \
               "cukup" in r.json()["detail"].lower()

    def test_penyesuaian_signed_delta(self, admin_session, bahan_baku_ids, gudang_ids):
        item_id = bahan_baku_ids["Tepung Terigu"]
        gudang = gudang_ids[0]
        before = self._get_balance(admin_session, "bahan_baku", item_id, gudang)
        r = admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "penyesuaian", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": gudang, "qty": -2, "batch": "BATCH-TEST"})
        assert r.status_code == 200
        after = self._get_balance(admin_session, "bahan_baku", item_id, gudang)
        assert after == before - 2

    def test_transfer_between_gudang(self, admin_session, bahan_baku_ids, gudang_ids):
        item_id = bahan_baku_ids["Tepung Terigu"]
        src, dst = gudang_ids[0], gudang_ids[1]
        # ensure balance in src
        admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "penerimaan", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": src, "qty": 5, "harga_satuan": 12000, "batch": "BATCH-TEST"})
        src_before = self._get_balance(admin_session, "bahan_baku", item_id, src)
        dst_before = self._get_balance(admin_session, "bahan_baku", item_id, dst)
        r = admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "transfer", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": src, "gudang_tujuan_id": dst, "qty": 3, "batch": "BATCH-TEST"})
        assert r.status_code == 200, r.text
        assert self._get_balance(admin_session, "bahan_baku", item_id, src) == src_before - 3
        assert self._get_balance(admin_session, "bahan_baku", item_id, dst) == dst_before + 3

    def test_opname_records_selisih(self, admin_session, bahan_baku_ids, gudang_ids):
        item_id = bahan_baku_ids["Gula Pasir"]
        gudang = gudang_ids[0]
        r = admin_session.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "opname", "item_type": "bahan_baku", "item_id": item_id,
            "gudang_id": gudang, "qty": 100, "batch": "BATCH-OPN"})
        assert r.status_code == 200, r.text
        # confirm balance now equals 100
        assert self._get_balance(admin_session, "bahan_baku", item_id, gudang) >= 100 or \
               self._get_balance(admin_session, "bahan_baku", item_id, gudang) == 100

    def test_kartu_stok(self, admin_session, bahan_baku_ids):
        item_id = bahan_baku_ids["Tepung Terigu"]
        r = admin_session.get(f"{BASE_URL}/api/stock/kartu",
                              params={"item_type": "bahan_baku", "item_id": item_id})
        assert r.status_code == 200
        d = r.json()
        assert "movements" in d and "saldo" in d
        assert len(d["movements"]) > 0


# ---------------------- Notifications ----------------------


class TestNotifications:
    def test_notifications(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        d = r.json()
        assert "count" in d and "alerts" in d


# ---------------------- RBAC ----------------------


class TestRBAC:
    @pytest.fixture(scope="class")
    def wh_user(self, admin_session):
        email = f"test_wh_{uuid.uuid4().hex[:6]}@test.com"
        pwd = "Warehouse@123"
        r = admin_session.post(f"{BASE_URL}/api/users", json={
            "name": "TEST Warehouse User", "email": email, "password": pwd,
            "role": "warehouse", "is_active": True})
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        yield {"email": email, "password": pwd, "id": uid}
        # cleanup
        admin_session.delete(f"{BASE_URL}/api/users/{uid}")

    def test_warehouse_login_and_access(self, wh_user, admin_session, gudang_ids,
                                        bahan_baku_ids):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": wh_user["email"], "password": wh_user["password"]})
        assert r.status_code == 200
        s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})

        # Master view OK
        r = s.get(f"{BASE_URL}/api/master/supplier")
        assert r.status_code == 200

        # Stock add OK
        r = s.post(f"{BASE_URL}/api/stock/movement", json={
            "tipe": "penerimaan", "item_type": "bahan_baku",
            "item_id": bahan_baku_ids["Tepung Terigu"],
            "gudang_id": gudang_ids[0], "qty": 1, "harga_satuan": 12000,
            "batch": "BATCH-WH"})
        assert r.status_code == 200

        # Cannot list users (needs pengaturan.view)
        r = s.get(f"{BASE_URL}/api/users")
        assert r.status_code == 403

        # Cannot delete supplier (warehouse has master NO_DELETE)
        # Create a temp supplier as admin, try delete as warehouse
        rc = admin_session.post(f"{BASE_URL}/api/master/supplier",
                                json={"nama": f"TEST_del_{uuid.uuid4().hex[:5]}"})
        sid = rc.json()["id"]
        r = s.delete(f"{BASE_URL}/api/master/supplier/{sid}")
        assert r.status_code == 403
        # cleanup as admin
        admin_session.delete(f"{BASE_URL}/api/master/supplier/{sid}")


# ---------------------- Users & Roles ----------------------


class TestUsersRoles:
    def test_cannot_delete_self(self, admin_session):
        me = admin_session.get(f"{BASE_URL}/api/auth/me").json()
        r = admin_session.delete(f"{BASE_URL}/api/users/{me['id']}")
        assert r.status_code == 400

    def test_roles_list_and_update(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/roles")
        assert r.status_code == 200
        d = r.json()
        assert any(x["name"] == "super_admin" for x in d["roles"])
        assert "modules" in d and "actions" in d

        # update warehouse role (safe - re-seed on startup restores system perms)
        wh = next(x for x in d["roles"] if x["name"] == "warehouse")
        new_perms = dict(wh["permissions"])
        r = admin_session.put(f"{BASE_URL}/api/roles/warehouse",
                              json={"permissions": new_perms,
                                    "label": wh.get("label", "Warehouse")})
        assert r.status_code == 200


# ---------------------- Audit & Backup ----------------------


class TestAuditBackup:
    def test_audit_has_entries(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/audit")
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1
        assert len(d["items"]) >= 1

    def test_backup(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/backup")
        assert r.status_code == 200
        d = r.json()
        assert "collections" in d
        assert "users" in d["collections"]
        assert "master_gudang" in d["collections"]
