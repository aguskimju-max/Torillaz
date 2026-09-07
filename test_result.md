#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Pada menu Backup Data, tambahkan tools import/restore sehingga data yang di-backup bisa langsung digunakan kembali."

backend:
  - task: "Backup export menyertakan password_hash (versi 2)"
    implemented: true
    working: true
    file: "/app/backend/misc_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/backup kini mengembalikan dokumen mentah (id string, password_hash user disertakan) + field version:2 + audit log export."
      - working: true
        agent: "testing"
        comment: "✅ PASSED - GET /api/backup verified: returns version:2, generated_at timestamp, collections object. Users collection contains password_hash field (not stripped), uses 'id' field instead of '_id'. Counters collection has string IDs (e.g., 'KAT', 'SUP') as expected. All 12 test scenarios passed including data integrity checks."
  - task: "Endpoint restore backup POST /api/backup/restore"
    implemented: true
    working: true
    file: "/app/backend/misc_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Restore replace-mode: whitelist BACKUP_COLLECTIONS, konversi id->_id (ObjectId atau string utk counters), preserve password_hash user lama jika file backup versi 1 (tanpa hash), seed_admin dipanggil setelah restore users agar admin env (admin/torillaz123) selalu bisa login, audit log restore. Return {restored, total, skipped}. Permission: pengaturan.edit."
      - working: true
        agent: "testing"
        comment: "✅ PASSED - POST /api/backup/restore fully functional: (1) Successfully restores backup data with correct response structure {restored, total, skipped}. (2) Data reverted correctly - test kategori created before restore was removed after restore. (3) Login works after restore (admin/torillaz123) - seed_admin ensures admin credentials preserved. (4) Stock consistency maintained - GET /api/stock/summary returns valid data. (5) Audit log records restore action - GET /api/audit?action=restore shows restore entry. (6) Error handling works: 400 for empty collections, 400 for unknown collections, 401 without auth. (7) Backward compatibility verified - v1 backup (without password_hash) restores successfully and login still works."

frontend:
  - task: "BackupPage: kartu Import/Restore Data"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/pages/settings/BackupPage.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Pilih file JSON -> preview ringkasan koleksi+jumlah -> dialog konfirmasi destruktif -> POST /backup/restore -> toast sukses + invalidateQueries. data-testid: restore-file-input, restore-pick-btn, restore-preview, restore-btn, restore-confirm-dialog, restore-confirm, restore-cancel, restore-success."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Sales order menyimpan harga_label (pilihan harga per item)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Fitur restore backup baru. Login super admin: email 'admin' password 'torillaz123' (bukan format email, validasi sudah dilonggarkan). Test alur: login -> GET /api/backup (cek users punya password_hash & version 2) -> ubah sedikit data (mis. tambah 1 kategori via POST /api/master/kategori) -> POST /api/backup/restore dengan body hasil backup -> verifikasi kategori tambahan hilang (data kembali seperti backup), login admin masih bisa, stok/balances konsisten, audit log ada entry restore. Juga test error: body tanpa collections -> 400, koleksi tak dikenal -> masuk skipped."
  - agent: "testing"
    message: "✅ ALL BACKEND TESTS PASSED (12/12) - Backup & restore feature fully functional. Created comprehensive test suite at /app/backend_test.py covering: (1) Backup export with version 2 and password_hash preservation, (2) Full restore workflow with data reversion verification, (3) Login persistence after restore, (4) Stock consistency checks, (5) Audit logging, (6) Error handling (empty/unknown collections, no auth), (7) Backward compatibility with v1 backups. All scenarios passed successfully. Both backend tasks marked as working:true. Frontend testing NOT performed as per protocol."

  - agent: "testing"
    message: "✅ SALES ORDER HARGA_LABEL FEATURE - ALL TESTS PASSED (12/12). Tested at /app/backend_test_harga_label.py. Feature working perfectly: (1) Master barang_jadi stores and retrieves harga_opsi:[{label,harga}] correctly, (2) Sales order items save harga_label per item, (3) Backward compatibility confirmed - missing harga_label defaults to 'Standar', (4) Regression test passed - cash orders can be sent/kirim with stock deduction and auto-payment (status becomes 'lunas'), harga_label preserved throughout. No issues found. Task marked as working:true."

  - task: "Sales order menyimpan harga_label (pilihan harga per item)"
    implemented: true
    working: true
    file: "/app/backend/sales_router.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Master barang_jadi kini dapat menyimpan harga_opsi:[{label,harga}] (generic payload, tanpa perubahan backend master). sales_router._build_items menyimpan harga_label per item (default 'Standar'). Frontend: pricelist field di form barang jadi, dropdown harga di SalesPage (tanpa input manual)."
      - working: true
        agent: "testing"
        comment: "✅ PASSED (12/12 tests) - Sales order harga_label feature fully functional. (1) Master barang_jadi successfully stores harga_opsi array with {label, harga} structure - verified via PUT /api/master/barang_jadi/{id} and GET endpoints. (2) harga_opsi appears correctly in /api/master/barang_jadi/options endpoint. (3) Sales order items save harga_label correctly - POST /api/sales/order with harga_label:'Grosir' creates order with correct label and price (9000). (4) harga_label preserved in GET /api/sales/orders/{id} and list view. (5) Backward compatibility verified - orders without harga_label default to 'Standar'. (6) Regression test passed - cash order can be sent via POST /api/sales/orders/{id}/kirim, stock decreases correctly, invoice generated, status becomes 'lunas' (auto-payment for cash sales), and harga_label preserved after kirim. All scenarios working as expected."
