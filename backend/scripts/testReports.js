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

const executeReportTests = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING PHASE 8 REPORTS AND ANALYTICS TESTS`);
  console.log(`==================================================\n`);

  const connection = await pool.getConnection();

  try {
    // 1. Clean test data
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query("DELETE FROM audit_logs WHERE description LIKE 'TEST_P8_%'");
    await connection.query("DELETE FROM leave_requests WHERE reason LIKE 'TEST_P8_%'");
    await connection.query("DELETE FROM leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE employee_code LIKE 'TEST_P8_%')");
    await connection.query("DELETE FROM employees WHERE employee_code LIKE 'TEST_P8_%'");
    await connection.query("DELETE FROM users WHERE email LIKE '%@p8test.com'");
    await connection.query("DELETE FROM leave_policies WHERE name = 'TEST P8 Policy'");
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Department
    let departmentId;
    const [deptRows] = await connection.query("SELECT id FROM departments WHERE name = 'Engineering'");
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
    } else {
      const [newDept] = await connection.query("INSERT INTO departments (name, description) VALUES ('Engineering', 'Software Engineering Department')");
      departmentId = newDept.insertId;
    }

    const [policyRes] = await connection.query(
      "INSERT INTO leave_policies (name, description, annual_limit) VALUES ('TEST P8 Policy', 'Test P8 Policy', 20)"
    );
    const leavePolicyId = policyRes.insertId;

    const defaultPasswordHash = await bcrypt.hash('Password123', 10);

    // 3. Admin Setup
    const [admUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('admin@p8test.com', ?, 'admin')", [defaultPasswordHash]);
    const [admEmp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Admin', 'P8', 'TEST_P8_ADM', '2026-01-01')",
      [admUser.insertId, departmentId]
    );

    // 4. Team 1: Manager 1 + Employee 1
    const [m1User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('mgr1@p8test.com', ?, 'manager')", [defaultPasswordHash]);
    const [m1Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Manager', 'One', 'TEST_P8_M1', '2026-01-01')",
      [m1User.insertId, departmentId]
    );

    const [e1User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp1@p8test.com', ?, 'employee')", [defaultPasswordHash]);
    const [e1Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, ?, 'Employee', 'One', 'TEST_P8_E1', '2026-01-01')",
      [e1User.insertId, departmentId, m1Emp.insertId]
    );

    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 20.00, 5.00, 15.00)",
      [e1Emp.insertId, leavePolicyId]
    );

    // 5. Team 2: Manager 2 + Employee 2
    const [m2User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('mgr2@p8test.com', ?, 'manager')", [defaultPasswordHash]);
    const [m2Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Manager', 'Two', 'TEST_P8_M2', '2026-01-01')",
      [m2User.insertId, departmentId]
    );

    const [e2User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp2@p8test.com', ?, 'employee')", [defaultPasswordHash]);
    const [e2Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, ?, 'Employee', 'Two', 'TEST_P8_E2', '2026-01-01')",
      [e2User.insertId, departmentId, m2Emp.insertId]
    );

    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 20.00, 2.00, 18.00)",
      [e2Emp.insertId, leavePolicyId]
    );

    // Seed Leave Requests:
    // Employee 1 (Team 1): 1 approved (5 days), 1 pending (3 days)
    await connection.query(
      "INSERT INTO leave_requests (employee_id, leave_policy_id, start_date, end_date, days, reason, status, approved_by) VALUES (?, ?, '2026-03-10', '2026-03-14', 5.00, 'TEST_P8_E1 App', 'approved', ?)",
      [e1Emp.insertId, leavePolicyId, m1Emp.insertId]
    );
    await connection.query(
      "INSERT INTO leave_requests (employee_id, leave_policy_id, start_date, end_date, days, reason, status) VALUES (?, ?, '2026-04-01', '2026-04-03', 3.00, 'TEST_P8_E1 Pend', 'pending')",
      [e1Emp.insertId, leavePolicyId]
    );

    // Employee 2 (Team 2): 1 approved (2 days), 1 rejected (4 days)
    await connection.query(
      "INSERT INTO leave_requests (employee_id, leave_policy_id, start_date, end_date, days, reason, status, approved_by) VALUES (?, ?, '2026-05-10', '2026-05-11', 2.00, 'TEST_P8_E2 App', 'approved', ?)",
      [e2Emp.insertId, leavePolicyId, m2Emp.insertId]
    );
    await connection.query(
      "INSERT INTO leave_requests (employee_id, leave_policy_id, start_date, end_date, days, reason, status, approved_by, rejection_reason) VALUES (?, ?, '2026-06-01', '2026-06-04', 4.00, 'TEST_P8_E2 Rej', 'rejected', ?, 'Project deadline')",
      [e2Emp.insertId, leavePolicyId, m2Emp.insertId]
    );

    connection.release();

    const adminToken = jwt.sign({ userId: admUser.insertId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const m1Token = jwt.sign({ userId: m1User.insertId, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const e1Token = jwt.sign({ userId: e1User.insertId, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    let passedCount = 0;
    let totalTests = 0;

    // Test 1: Admin overview -> 200 OK
    totalTests++;
    if (await runTest('1. Admin overview report (GET /api/reports/overview)', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/overview`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && typeof data.data.totalEmployees === 'number', status: res.status, expectedStatus: 200, message: JSON.stringify(data.data) };
    })) passedCount++;

    // Test 2: Admin leave summary -> 200 OK
    totalTests++;
    if (await runTest('2. Admin leave summary report (GET /api/reports/leave-summary)', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/leave-summary`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && typeof data.summary.approved === 'number', status: res.status, expectedStatus: 200, message: JSON.stringify(data.summary) };
    })) passedCount++;

    // Test 3: Admin department summary -> 200 OK
    totalTests++;
    if (await runTest('3. Admin department summary report (GET /api/reports/department-summary)', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/department-summary`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && Array.isArray(data.data), status: res.status, expectedStatus: 200, message: `Count: ${data.data.length}` };
    })) passedCount++;

    // Test 4: Admin leave trends -> 200 OK
    totalTests++;
    if (await runTest('4. Admin leave trends report (GET /api/reports/leave-trends)', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/leave-trends`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && Array.isArray(data.data), status: res.status, expectedStatus: 200, message: `Months: ${data.data.length}` };
    })) passedCount++;

    // Test 5: Manager overview -> 200 OK
    totalTests++;
    if (await runTest('5. Manager 1 overview report (GET /api/reports/overview)', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/overview`, { headers: { Authorization: `Bearer ${m1Token}` } });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.data.totalEmployees === 1, status: res.status, expectedStatus: 200, message: JSON.stringify(data.data) };
    })) passedCount++;

    // Test 6: Manager report data restricted to team
    totalTests++;
    if (await runTest('6. Manager 1 report data strictly restricted to Team 1', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/leave-summary`, { headers: { Authorization: `Bearer ${m1Token}` } });
      const data = await res.json();
      // Team 1 has 1 approved and 1 pending request. Team 2 has rejected request. Manager 1 summary rejected should be 0.
      const isTeamRestricted = data.summary.approved === 1 && data.summary.pending === 1 && data.summary.rejected === 0;
      return { passed: res.status === 200 && isTeamRestricted, status: res.status, expectedStatus: 200, message: JSON.stringify(data.summary) };
    })) passedCount++;

    // Test 7: Employee report access -> 403 Forbidden
    totalTests++;
    if (await runTest('7. Employee report access attempt -> 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/overview`, { headers: { Authorization: `Bearer ${e1Token}` } });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 8: Invalid year -> 400 Bad Request
    totalTests++;
    if (await runTest('8. Invalid year parameter -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/leave-summary?year=invalid_year`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 9: Year filter -> 200 OK
    totalTests++;
    if (await runTest('9. Year filter (?year=2026) returns correct filtered report', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/leave-trends?year=2026`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      const allMatches2026 = data.data.every((t) => t.month.startsWith('2026-'));
      return { passed: res.status === 200 && data.success === true && allMatches2026, status: res.status, expectedStatus: 200, message: `Count: ${data.data.length}` };
    })) passedCount++;

    // Test 10: Verify results directly using MySQL queries
    totalTests++;
    if (await runTest('10. Verification of report metrics against direct MySQL SQL queries', async () => {
      const [sqlRes] = await pool.query("SELECT COUNT(*) AS pendingCount FROM leave_requests WHERE status = 'pending'");
      const res = await fetch(`${BASE_URL}/api/reports/overview`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      const matchesDB = data.data.pendingLeaveRequests === sqlRes[0].pendingCount;
      return { passed: res.status === 200 && matchesDB, status: res.status, expectedStatus: 200, message: `API Pending: ${data.data.pendingLeaveRequests}, DB Pending: ${sqlRes[0].pendingCount}` };
    })) passedCount++;

    console.log(`\n==================================================`);
    console.log(`REPORTS AND ANALYTICS TEST RESULTS: ${passedCount}/${totalTests} PASSED`);
    console.log(`==================================================\n`);

    await pool.end();
    process.exitCode = passedCount === totalTests ? 0 : 1;
  } catch (err) {
    if (connection) connection.release();
    console.error('Fatal Test Execution Error:', err.message);
    try { await pool.end(); } catch (e) {}
    process.exitCode = 1;
  }
};

executeReportTests();
