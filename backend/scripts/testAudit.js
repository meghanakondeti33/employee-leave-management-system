const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = require('../config/db');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const runTest = async (testName, action) => {
  try {
    const result = await action();
    if (result.passed) {
      console.log(`✅ [PASSED] ${testName} (Status: ${result.status})`);
    } else {
      console.error(`❌ [FAILED] ${testName} - Expected: ${result.expectedStatus}, Got: ${result.status}. Response: ${result.message}`);
    }
    return result.passed;
  } catch (error) {
    console.error(`❌ [EXCEPTION] ${testName}: ${error.message}`);
    return false;
  }
};

const executeAuditTests = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING PHASE 7 AUDIT LOGGING INTEGRATION TESTS`);
  console.log(`==================================================\n`);

  const connection = await pool.getConnection();

  try {
    // 1. Clean test data
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query("DELETE FROM audit_logs WHERE description LIKE 'TEST_P7_%' OR action LIKE 'TEST_%'");
    await connection.query("DELETE FROM leave_requests WHERE reason LIKE 'TEST_P7_%'");
    await connection.query("DELETE FROM leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE employee_code LIKE 'TEST_P7_%')");
    await connection.query("DELETE FROM employees WHERE employee_code LIKE 'TEST_P7_%'");
    await connection.query("DELETE FROM users WHERE email LIKE '%@p7test.com'");
    await connection.query("DELETE FROM leave_policies WHERE name = 'TEST P7 Policy'");
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Department & Policy
    let departmentId;
    const [deptRows] = await connection.query("SELECT id FROM departments WHERE name = 'Engineering'");
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
    } else {
      const [newDept] = await connection.query("INSERT INTO departments (name, description) VALUES ('Engineering', 'Software Engineering Department')");
      departmentId = newDept.insertId;
    }

    const [policyRes] = await connection.query(
      "INSERT INTO leave_policies (name, description, annual_limit) VALUES ('TEST P7 Policy', 'Test P7 Policy', 15)"
    );
    const leavePolicyId = policyRes.insertId;

    const defaultPasswordHash = await bcrypt.hash('Password123', 10);

    // 3. Admin & Manager & Employee Setup
    const [adminUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('admin@p7test.com', ?, 'admin')", [defaultPasswordHash]);
    const [adminEmp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Admin', 'P7', 'TEST_P7_ADM', '2026-01-01')",
      [adminUser.insertId, departmentId]
    );

    const [mgrUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('mgr@p7test.com', ?, 'manager')", [defaultPasswordHash]);
    const [mgrEmp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Manager', 'P7', 'TEST_P7_MGR', '2026-01-01')",
      [mgrUser.insertId, departmentId]
    );

    const [empUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp@p7test.com', ?, 'employee')", [defaultPasswordHash]);
    const [empRec] = await connection.query(
      "INSERT INTO employees (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, ?, 'Employee', 'P7', 'TEST_P7_EMP', '2026-01-01')",
      [empUser.insertId, departmentId, mgrEmp.insertId]
    );

    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 15.00, 0.00, 15.00)",
      [empRec.insertId, leavePolicyId]
    );

    connection.release();

    const adminToken = jwt.sign({ userId: adminUser.insertId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const mgrToken = jwt.sign({ userId: mgrUser.insertId, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const empToken = jwt.sign({ userId: empUser.insertId, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    let createdEmpId = null;
    let leave1Id = null;
    let leave2Id = null;
    let leave3Id = null;
    let passedCount = 0;
    let totalTests = 0;

    // Test 1: Successful Login -> LOGIN_SUCCESS
    totalTests++;
    if (await runTest('1. Successful Login generates LOGIN_SUCCESS audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'emp@p7test.com', password: 'Password123' }),
      });
      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LOGIN_SUCCESS'", [empUser.insertId]);
      return { passed: res.status === 200 && rows.length > 0, status: res.status, expectedStatus: 200, message: `Audit count: ${rows.length}` };
    })) passedCount++;

    // Test 2: Failed Login -> LOGIN_FAILED
    totalTests++;
    if (await runTest('2. Failed Login generates LOGIN_FAILED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'emp@p7test.com', password: 'WrongPassword' }),
      });
      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LOGIN_FAILED'", [empUser.insertId]);
      return { passed: res.status === 401 && rows.length > 0, status: res.status, expectedStatus: 401, message: `Audit count: ${rows.length}` };
    })) passedCount++;

    // Test 3: Admin creates employee -> EMPLOYEE_CREATED
    totalTests++;
    if (await runTest('3. Admin creates employee generates EMPLOYEE_CREATED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          email: 'created@p7test.com',
          password: 'Password123',
          role: 'employee',
          firstName: 'Created',
          lastName: 'Emp',
          employeeCode: 'TEST_P7_CREATED',
          departmentId,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      if (data.employee) createdEmpId = data.employee.id;

      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'EMPLOYEE_CREATED'", [adminUser.insertId]);
      return { passed: res.status === 201 && rows.length > 0 && rows[0].entity_id === createdEmpId, status: res.status, expectedStatus: 201, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 4: Admin updates employee -> EMPLOYEE_UPDATED
    totalTests++;
    if (await runTest('4. Admin updates employee generates EMPLOYEE_UPDATED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${createdEmpId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ firstName: 'UpdatedP7' }),
      });
      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'EMPLOYEE_UPDATED'", [adminUser.insertId]);
      return { passed: res.status === 200 && rows.length > 0 && rows[0].entity_id === createdEmpId, status: res.status, expectedStatus: 200, message: `Audit count: ${rows.length}` };
    })) passedCount++;

    // Test 5: Employee requests leave -> LEAVE_REQUESTED
    totalTests++;
    if (await runTest('5. Employee requests leave generates LEAVE_REQUESTED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
        body: JSON.stringify({ leavePolicyId, startDate: '2026-08-20', endDate: '2026-08-22', reason: 'TEST_P7_Leave 1' }),
      });
      const data = await res.json();
      if (data.leaveRequest) leave1Id = data.leaveRequest.id;

      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LEAVE_REQUESTED'", [empUser.insertId]);
      return { passed: res.status === 201 && rows.length > 0 && rows[0].entity_id === leave1Id, status: res.status, expectedStatus: 201, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 6: Manager approves leave -> LEAVE_APPROVED
    totalTests++;
    if (await runTest('6. Manager approves leave generates LEAVE_APPROVED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${leave1Id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${mgrToken}` },
      });
      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LEAVE_APPROVED'", [mgrUser.insertId]);
      return { passed: res.status === 200 && rows.length > 0 && rows[0].entity_id === leave1Id, status: res.status, expectedStatus: 200, message: `Audit count: ${rows.length}` };
    })) passedCount++;

    // Create 2nd leave request for rejection
    const resL2 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-09-01', endDate: '2026-09-03', reason: 'TEST_P7_Leave 2' }),
    });
    const dataL2 = await resL2.json();
    leave2Id = dataL2.leaveRequest.id;

    // Test 7: Manager rejects leave -> LEAVE_REJECTED
    totalTests++;
    if (await runTest('7. Manager rejects leave generates LEAVE_REJECTED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${leave2Id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
        body: JSON.stringify({ rejectionReason: 'High workload' }),
      });
      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LEAVE_REJECTED'", [mgrUser.insertId]);
      return { passed: res.status === 200 && rows.length > 0 && rows[0].entity_id === leave2Id, status: res.status, expectedStatus: 200, message: `Audit count: ${rows.length}` };
    })) passedCount++;

    // Create 3rd leave request for cancellation
    const resL3 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-10-10', endDate: '2026-10-12', reason: 'TEST_P7_Leave 3' }),
    });
    const dataL3 = await resL3.json();
    leave3Id = dataL3.leaveRequest.id;

    // Test 8: Employee cancels pending leave -> LEAVE_CANCELLED
    totalTests++;
    if (await runTest('8. Employee cancels leave generates LEAVE_CANCELLED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${leave3Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'LEAVE_CANCELLED'", [empUser.insertId]);
      return { passed: res.status === 200 && rows.length > 0 && rows[0].entity_id === leave3Id, status: res.status, expectedStatus: 200, message: `Audit count: ${rows.length}` };
    })) passedCount++;

    // Test 9: Admin updates/deletes employee -> EMPLOYEE_DELETED
    totalTests++;
    if (await runTest('9. Admin deletes employee generates EMPLOYEE_DELETED audit log', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${createdEmpId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const [rows] = await pool.query("SELECT * FROM audit_logs WHERE user_id = ? AND action = 'EMPLOYEE_DELETED'", [adminUser.insertId]);
      return { passed: res.status === 200 && rows.length > 0 && rows[0].entity_id === createdEmpId, status: res.status, expectedStatus: 200, message: `Audit count: ${rows.length}` };
    })) passedCount++;

    // Test 10: Admin audit API (GET /api/audit-logs) -> 200 OK (newest first)
    totalTests++;
    if (await runTest('10. GET /api/audit-logs returns logs ordered newest first for Admin', async () => {
      const res = await fetch(`${BASE_URL}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      const isNewestFirst = data.data.length >= 2 && new Date(data.data[0].createdAt) >= new Date(data.data[1].createdAt);
      return { passed: res.status === 200 && data.success === true && Array.isArray(data.data) && isNewestFirst, status: res.status, expectedStatus: 200, message: JSON.stringify(data.pagination) };
    })) passedCount++;

    // Test 11: Audit API Filtering by action, userId, entityType
    totalTests++;
    if (await runTest('11. Filter audit logs (?action=LEAVE_APPROVED & ?entityType=leave_request)', async () => {
      const res = await fetch(`${BASE_URL}/api/audit-logs?action=LEAVE_APPROVED&entityType=leave_request`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      const allMatchFilter = data.data.every((log) => log.action === 'LEAVE_APPROVED' && log.entityType === 'leave_request');
      return { passed: res.status === 200 && data.success === true && data.data.length > 0 && allMatchFilter, status: res.status, expectedStatus: 200, message: `Matches: ${data.data.length}` };
    })) passedCount++;

    // Test 12: Audit API Pagination (?page=1&limit=5)
    totalTests++;
    if (await runTest('12. Audit log pagination (?page=1&limit=5)', async () => {
      const res = await fetch(`${BASE_URL}/api/audit-logs?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      const validPagination = data.pagination.page === 1 && data.pagination.limit === 5 && data.data.length <= 5 && data.pagination.total >= 5;
      return { passed: res.status === 200 && data.success === true && validPagination, status: res.status, expectedStatus: 200, message: JSON.stringify(data.pagination) };
    })) passedCount++;

    // Test 13: RBAC checks for /api/audit-logs (Employee -> 403, Manager -> 403)
    totalTests++;
    if (await runTest('13. RBAC protection: Employee & Manager get 403 on GET /api/audit-logs', async () => {
      const resEmp = await fetch(`${BASE_URL}/api/audit-logs`, { headers: { Authorization: `Bearer ${empToken}` } });
      const resMgr = await fetch(`${BASE_URL}/api/audit-logs`, { headers: { Authorization: `Bearer ${mgrToken}` } });
      return { passed: resEmp.status === 403 && resMgr.status === 403, status: `Emp:${resEmp.status}, Mgr:${resMgr.status}`, expectedStatus: 'Emp:403, Mgr:403', message: 'Forbidden verified' };
    })) passedCount++;

    // Test 14: Sensitive Data Check (Zero leak of passwords or secrets)
    totalTests++;
    if (await runTest('14. Security verification: Zero leak of passwords, hashes, or tokens in audit logs', async () => {
      const [allLogs] = await pool.query("SELECT description FROM audit_logs");
      const leakFound = allLogs.some((l) => {
        const desc = (l.description || '').toLowerCase();
        return desc.includes('password') || desc.includes('secret') || desc.includes('bearer') || desc.includes('$2b$');
      });
      return { passed: !leakFound, status: 200, expectedStatus: 200, message: leakFound ? 'LEAK DETECTED' : 'Clean audit descriptions' };
    })) passedCount++;

    console.log(`\n==================================================`);
    console.log(`AUDIT LOG INTEGRATION TEST RESULTS: ${passedCount}/${totalTests} PASSED`);
    console.log(`==================================================\n`);

    process.exit(passedCount === totalTests ? 0 : 1);
  } catch (err) {
    if (connection) connection.release();
    console.error('Fatal Test Execution Error:', err.message);
    process.exit(1);
  }
};

executeAuditTests();
