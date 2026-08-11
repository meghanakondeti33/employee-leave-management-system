const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = require('../config/db');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const testResults = [];

const recordTest = (category, testName, passed, expectedStatus, actualStatus, message = '') => {
  const result = {
    category,
    testName,
    status: passed ? 'PASS' : 'FAIL',
    expectedStatus,
    actualStatus,
    message,
  };
  testResults.push(result);
  if (passed) {
    console.log(`  ✅ [PASS] ${testName} (Status: ${actualStatus})`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} - Expected: ${expectedStatus}, Got: ${actualStatus}. Detail: ${message}`);
  }
  return passed;
};

const executeSecurityAndQualitySuite = async () => {
  console.log(`\n==================================================`);
  console.log(`PHASE 11 SECURITY, AUTHORIZATION & BUSINESS RULE AUDIT`);
  console.log(`==================================================\n`);

  const connection = await pool.getConnection();

  try {
    // Teardown previous test data
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query("DELETE FROM audit_logs WHERE description LIKE 'TEST_P11_%' OR action LIKE 'TEST_%'");
    await connection.query("DELETE FROM leave_requests WHERE reason LIKE 'TEST_P11_%'");
    await connection.query("DELETE FROM leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE employee_code LIKE 'TEST_P11_%')");
    await connection.query("DELETE FROM employees WHERE employee_code LIKE 'TEST_P11_%'");
    await connection.query("DELETE FROM users WHERE email LIKE '%@p11test.com'");
    await connection.query("DELETE FROM leave_policies WHERE name = 'TEST P11 Policy'");
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Setup Department & Policy
    let departmentId;
    const [deptRows] = await connection.query("SELECT id FROM departments WHERE name = 'Engineering'");
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
    } else {
      const [newDept] = await connection.query("INSERT INTO departments (name, description) VALUES ('Engineering', 'Software Engineering Department')");
      departmentId = newDept.insertId;
    }

    const [policyRes] = await connection.query(
      "INSERT INTO leave_policies (name, description, annual_limit) VALUES ('TEST P11 Policy', 'Test P11 Policy', 10)"
    );
    const leavePolicyId = policyRes.insertId;

    const defaultPasswordHash = await bcrypt.hash('Password123', 10);

    // Setup Users
    const [admUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('admin@p11test.com', ?, 'admin')", [defaultPasswordHash]);
    const [admEmp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Admin', 'P11', 'TEST_P11_ADM', '2026-01-01')",
      [admUser.insertId, departmentId]
    );

    const [m1User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('mgr1@p11test.com', ?, 'manager')", [defaultPasswordHash]);
    const [m1Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Manager', 'One', 'TEST_P11_M1', '2026-01-01')",
      [m1User.insertId, departmentId]
    );

    const [e1User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp1@p11test.com', ?, 'employee')", [defaultPasswordHash]);
    const [e1Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, ?, 'Employee', 'One', 'TEST_P11_E1', '2026-01-01')",
      [e1User.insertId, departmentId, m1Emp.insertId]
    );

    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 10.00, 0.00, 10.00)",
      [e1Emp.insertId, leavePolicyId]
    );

    connection.release();

    const adminToken = jwt.sign({ userId: admUser.insertId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const mgr1Token = jwt.sign({ userId: m1User.insertId, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const emp1Token = jwt.sign({ userId: e1User.insertId, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // --------------------------------------------------
    // CATEGORY 1: SQL INJECTION PROTECTION
    // --------------------------------------------------
    console.log(`\n--- 1. SQL Injection Protection Tests ---`);

    // SQLi Test 1: Login injection
    const resSql1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: "' OR '1'='1", password: "' OR '1'='1" }),
    });
    const dataSql1 = await resSql1.json();
    recordTest('SQL Injection', "SQLi Login payload (' OR '1'='1) rejected by validator", (resSql1.status === 400 || resSql1.status === 401) && dataSql1.success === false, '400/401', resSql1.status);

    // SQLi Test 2: Drop table in query filter
    const resSql2 = await fetch(`${BASE_URL}/api/audit-logs?action='; DROP TABLE users; --`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataSql2 = await resSql2.json();
    recordTest('SQL Injection', 'SQLi DROP TABLE payload safely parameterized', resSql2.status === 200 && Array.isArray(dataSql2.data), 200, resSql2.status);

    // --------------------------------------------------
    // CATEGORY 2: AUTHENTICATION & SECRET PRIVACY
    // --------------------------------------------------
    console.log(`\n--- 2. Authentication & Secret Privacy Tests ---`);

    const resMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${emp1Token}` },
    });
    const dataMe = await resMe.json();
    const noPasswordExposed = dataMe.user && !('password' in dataMe.user) && !('password_hash' in dataMe.user);
    recordTest('Authentication Privacy', 'GET /api/auth/me strips password and password_hash', resMe.status === 200 && noPasswordExposed, 200, resMe.status);

    const resInvalidToken = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid_garbage_token' },
    });
    recordTest('Authentication Verification', 'Invalid Bearer token returns 401 Unauthorized', resInvalidToken.status === 401, 401, resInvalidToken.status);

    // --------------------------------------------------
    // CATEGORY 3: AUTHORIZATION (RBAC) MATRIX
    // --------------------------------------------------
    console.log(`\n--- 3. Authorization (RBAC) Matrix Tests ---`);

    // Employee cannot create employee
    const resRbac1 = await fetch(`${BASE_URL}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emp1Token}` },
      body: JSON.stringify({ email: 'fake@p11test.com', password: 'Password123', firstName: 'Fake', lastName: 'Emp', employeeCode: 'TEST_P11_F', departmentId: 1, joiningDate: '2026-01-01' }),
    });
    recordTest('RBAC Protection', 'Employee role prohibited from POST /api/employees (403)', resRbac1.status === 403, 403, resRbac1.status);

    // Employee cannot access audit logs
    const resRbac2 = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${emp1Token}` },
    });
    recordTest('RBAC Protection', 'Employee role prohibited from GET /api/audit-logs (403)', resRbac2.status === 403, 403, resRbac2.status);

    // Employee cannot access reports
    const resRbac3 = await fetch(`${BASE_URL}/api/reports/overview`, {
      headers: { Authorization: `Bearer ${emp1Token}` },
    });
    recordTest('RBAC Protection', 'Employee role prohibited from GET /api/reports/overview (403)', resRbac3.status === 403, 403, resRbac3.status);

    // --------------------------------------------------
    // CATEGORY 4: INPUT VALIDATION & EDGE CASES
    // --------------------------------------------------
    console.log(`\n--- 4. Input Validation & Edge Case Tests ---`);

    const resVal1 = await fetch(`${BASE_URL}/api/employees/invalid_id_param`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest('Input Validation', 'Non-integer URL parameter returns 400 Bad Request', resVal1.status === 400, 400, resVal1.status);

    const resVal2 = await fetch(`${BASE_URL}/api/reports/leave-summary?year=malformed_year`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordTest('Input Validation', 'Malformed year parameter returns 400 Bad Request', resVal2.status === 400, 400, resVal2.status);

    // --------------------------------------------------
    // CATEGORY 5: LEAVE BUSINESS RULES & INVARIANTS
    // --------------------------------------------------
    console.log(`\n--- 5. Leave Business Rules & Balance Invariant Tests ---`);

    // Date Range Validation: End date prior to start date
    const resRule1 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emp1Token}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-08-20', endDate: '2026-08-10', reason: 'TEST_P11_Invalid Dates' }),
    });
    recordTest('Business Rules', 'End date before start date rejected with 400 Bad Request', resRule1.status === 400, 400, resRule1.status);

    // Create valid 3-day pending leave request (2026-09-10 to 2026-09-12)
    const resReq = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emp1Token}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-09-10', endDate: '2026-09-12', reason: 'TEST_P11_Leave 1' }),
    });
    const dataReq = await resReq.json();
    const leave1Id = dataReq.leaveRequest.id;

    // Overlap Validation: Attempting overlapping leave
    const resRule2 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emp1Token}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-09-11', endDate: '2026-09-15', reason: 'TEST_P11_Overlap' }),
    });
    recordTest('Business Rules', 'Overlapping leave request rejected with 409 Conflict', resRule2.status === 409, 409, resRule2.status);

    // Manager 1 approves leave1Id
    await fetch(`${BASE_URL}/api/leaves/${leave1Id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${mgr1Token}` },
    });

    // Attempting to cancel approved request
    const resRule3 = await fetch(`${BASE_URL}/api/leaves/${leave1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${emp1Token}` },
    });
    recordTest('Business Rules', 'Cancelling approved leave request rejected with 400 Bad Request', resRule3.status === 400, 400, resRule3.status);

    // Balance Invariant Verification in DB
    const [balRows] = await pool.query("SELECT used_days, remaining_days, allocated_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ?", [e1Emp.insertId, leavePolicyId]);
    const uDays = parseFloat(balRows[0].used_days);
    const rDays = parseFloat(balRows[0].remaining_days);
    const aDays = parseFloat(balRows[0].allocated_days);
    const invariantsHold = uDays >= 0 && rDays >= 0 && uDays <= aDays && uDays + rDays === aDays;
    recordTest('Balance Invariants', 'Balance invariants (used >= 0, remaining >= 0, used <= allocated) hold true', invariantsHold, 200, 200);

    // --------------------------------------------------
    // CATEGORY 6: TRANSACTION SAFETY & CONCURRENCY
    // --------------------------------------------------
    console.log(`\n--- 6. Transaction Safety & Concurrency Tests ---`);

    // Create 2nd pending request for concurrency testing (2 days: 2026-10-20 to 2026-10-21)
    const resReq2 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emp1Token}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-10-20', endDate: '2026-10-21', reason: 'TEST_P11_Concurrency' }),
    });
    const dataReq2 = await resReq2.json();
    const leave2Id = dataReq2.leaveRequest.id;

    // Concurrent approval execution under SELECT ... FOR UPDATE
    const [resA, resB] = await Promise.all([
      fetch(`${BASE_URL}/api/leaves/${leave2Id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${mgr1Token}` } }),
      fetch(`${BASE_URL}/api/leaves/${leave2Id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${mgr1Token}` } }),
    ]);
    const statuses = [resA.status, resB.status].sort();
    const concurrencySafe = statuses[0] === 200 && statuses[1] === 400;
    recordTest('Concurrency Safety', 'Pessimistic row-locking prevents double approval (One 200, One 400)', concurrencySafe, '200,400', statuses.join(','));

    // --------------------------------------------------
    // CATEGORY 7: ERROR RESPONSE SANITIZATION
    // --------------------------------------------------
    console.log(`\n--- 7. Error Response Sanitization Tests ---`);

    const resErr = await fetch(`${BASE_URL}/api/employees/999999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataErr = await resErr.json();
    const isCleanError = resErr.status === 404 && dataErr.success === false && !('stack' in dataErr) && !('sql' in dataErr);
    recordTest('Error Handling', 'API errors sanitize stack traces and raw SQL strings', isCleanError, 404, resErr.status);

    // --------------------------------------------------
    // SUMMARY REPORT GENERATION
    // --------------------------------------------------
    console.log(`\n==================================================`);
    console.log(`PHASE 11 FINAL TEST SUITE RESULTS SUMMARY`);
    console.log(`==================================================\n`);

    const passCount = testResults.filter((r) => r.status === 'PASS').length;
    const failCount = testResults.filter((r) => r.status === 'FAIL').length;
    const totalCount = testResults.length;

    console.log(`TOTAL TESTS EXECUTED: ${totalCount}`);
    console.log(`PASSED: ${passCount}`);
    console.log(`FAILED: ${failCount}`);
    console.log(`BLOCKED: 0\n`);

    await pool.end();
    process.exitCode = failCount === 0 ? 0 : 1;
  } catch (err) {
    if (connection) connection.release();
    console.error('Fatal Test Execution Error:', err.message);
    try { await pool.end(); } catch (e) {}
    process.exitCode = 1;
  }
};

executeSecurityAndQualitySuite();
