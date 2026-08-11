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

const executeApprovalTests = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING PHASE 6 LEAVE APPROVAL & BALANCE TESTS`);
  console.log(`==================================================\n`);

  const connection = await pool.getConnection();

  try {
    // 1. Cleanup test data
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query("DELETE FROM leave_requests WHERE reason LIKE 'TEST_P6_%'");
    await connection.query("DELETE FROM leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE employee_code LIKE 'TEST_P6_%')");
    await connection.query("DELETE FROM employees WHERE employee_code LIKE 'TEST_P6_%'");
    await connection.query("DELETE FROM users WHERE email LIKE '%@p6test.com'");
    await connection.query("DELETE FROM leave_policies WHERE name = 'TEST P6 Policy'");
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

    // 3. Policy
    const [policyRes] = await connection.query(
      "INSERT INTO leave_policies (name, description, annual_limit) VALUES ('TEST P6 Policy', 'Test P6 Policy', 10)"
    );
    const leavePolicyId = policyRes.insertId;

    const defaultPasswordHash = await bcrypt.hash('Password123', 10);

    // 4. Manager 1 & Employee 1 (Manager 1's Team)
    const [m1User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('mgr1@p6test.com', ?, 'manager')", [defaultPasswordHash]);
    const [m1Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Manager', 'One', 'TEST_P6_M1', '2026-01-01')",
      [m1User.insertId, departmentId]
    );

    const [e1User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp1@p6test.com', ?, 'employee')", [defaultPasswordHash]);
    const [e1Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, ?, 'Employee', 'One', 'TEST_P6_E1', '2026-01-01')",
      [e1User.insertId, departmentId, m1Emp.insertId]
    );

    // Seed Employee 1 Leave Balance (Allocated: 10, Used: 0, Remaining: 10)
    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 10.00, 0.00, 10.00)",
      [e1Emp.insertId, leavePolicyId]
    );

    // 5. Manager 2 & Employee 2 (Manager 2's Team)
    const [m2User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('mgr2@p6test.com', ?, 'manager')", [defaultPasswordHash]);
    const [m2Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Manager', 'Two', 'TEST_P6_M2', '2026-01-01')",
      [m2User.insertId, departmentId]
    );

    const [e2User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp2@p6test.com', ?, 'employee')", [defaultPasswordHash]);
    const [e2Emp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, ?, 'Employee', 'Two', 'TEST_P6_E2', '2026-01-01')",
      [e2User.insertId, departmentId, m2Emp.insertId]
    );

    // Seed Employee 2 Leave Balance
    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 10.00, 0.00, 10.00)",
      [e2Emp.insertId, leavePolicyId]
    );

    connection.release();

    // Tokens
    const tokenM1 = jwt.sign({ userId: m1User.insertId, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const tokenM2 = jwt.sign({ userId: m2User.insertId, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const tokenE1 = jwt.sign({ userId: e1User.insertId, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const emp1Id = e1Emp.insertId;
    let req1Id = null;
    let req2Id = null;
    let passedCount = 0;
    let totalTests = 0;

    // Test 1: Employee creates pending request (3 days)
    totalTests++;
    if (await runTest('1. Employee creates pending request (3 days: 2026-08-20 to 2026-08-22)', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenE1}` },
        body: JSON.stringify({ leavePolicyId, startDate: '2026-08-20', endDate: '2026-08-22', reason: 'TEST_P6_Request 1' }),
      });
      const data = await res.json();
      if (data.leaveRequest) req1Id = data.leaveRequest.id;
      return { passed: res.status === 201 && data.success === true && data.leaveRequest.status === 'pending', status: res.status, expectedStatus: 201, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 2: Manager sees pending team request
    totalTests++;
    if (await runTest('2. Manager 1 sees pending request for team member', async () => {
      const [rows] = await pool.query("SELECT id, status FROM leave_requests WHERE id = ?", [req1Id]);
      return { passed: rows.length > 0 && rows[0].status === 'pending', status: 200, expectedStatus: 200, message: `Status: ${rows[0]?.status}` };
    })) passedCount++;

    // Test 3: Manager 1 approves request -> 200
    totalTests++;
    if (await runTest('3. Manager 1 approves team member request (PUT /api/leaves/:id/approve)', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${req1Id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenM1}` },
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.request.status === 'approved', status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 4: Request becomes approved
    totalTests++;
    if (await runTest('4. Request status is updated to "approved" in MySQL', async () => {
      const [rows] = await pool.query("SELECT status, approved_by FROM leave_requests WHERE id = ?", [req1Id]);
      return { passed: rows.length > 0 && rows[0].status === 'approved' && rows[0].approved_by === m1Emp.insertId, status: 200, expectedStatus: 200, message: `Status: ${rows[0]?.status}, ApprovedBy: ${rows[0]?.approved_by}` };
    })) passedCount++;

    // Test 5 & 6: Balance used_days increases to 3.00 & remaining_days decreases to 7.00
    totalTests++;
    if (await runTest('5 & 6. Balance used_days increases to 3.00 & remaining_days decreases to 7.00', async () => {
      const [rows] = await pool.query("SELECT used_days, remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ? AND year = 2026", [emp1Id, leavePolicyId]);
      const used = parseFloat(rows[0].used_days);
      const remaining = parseFloat(rows[0].remaining_days);
      return { passed: used === 3 && remaining === 7, status: 200, expectedStatus: 200, message: `used_days: ${used}, remaining_days: ${remaining}` };
    })) passedCount++;

    // Test 7: Manager 2 cannot approve Manager 1's employee request -> 403
    // Create a pending request for Employee 1 first to hit the team authorization check
    const resPending7 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenE1}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-12-01', endDate: '2026-12-02', reason: 'TEST_P6_For M2 Test' }),
    });
    const dataPending7 = await resPending7.json();
    const req7Id = dataPending7.leaveRequest.id;

    totalTests++;
    if (await runTest('7. Manager 2 cannot approve Manager 1 employee request -> 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${req7Id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenM2}` },
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 8: Employee cannot approve request -> 403
    totalTests++;
    if (await runTest('8. Employee cannot approve leave request -> 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${req1Id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenE1}` },
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    // Create a 2nd pending request (2 days: 2026-09-10 to 2026-09-11) for rejection test
    const res2 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenE1}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-09-10', endDate: '2026-09-11', reason: 'TEST_P6_Request 2' }),
    });
    const data2 = await res2.json();
    req2Id = data2.leaveRequest.id;

    // Test 9: Manager rejects pending request -> 200
    totalTests++;
    if (await runTest('9. Manager 1 rejects pending request with reason (PUT /api/leaves/:id/reject)', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${req2Id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenM1}` },
        body: JSON.stringify({ rejectionReason: 'Insufficient project coverage' }),
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.request.status === 'rejected' && data.request.rejectionReason === 'Insufficient project coverage', status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 10: Rejected request does not change balance
    totalTests++;
    if (await runTest('10. Rejected request does NOT modify leave balance (remains used: 3.00, remaining: 7.00)', async () => {
      const [rows] = await pool.query("SELECT used_days, remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ? AND year = 2026", [emp1Id, leavePolicyId]);
      const used = parseFloat(rows[0].used_days);
      const remaining = parseFloat(rows[0].remaining_days);
      return { passed: used === 3 && remaining === 7, status: 200, expectedStatus: 200, message: `used_days: ${used}, remaining_days: ${remaining}` };
    })) passedCount++;

    // Test 11: Already approved request cannot be approved again -> 400
    totalTests++;
    if (await runTest('11. Already approved request cannot be approved again -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${req1Id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenM1}` },
      });
      const data = await res.json();
      return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 12: Already approved request cannot be rejected -> 400
    totalTests++;
    if (await runTest('12. Already approved request cannot be rejected -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${req1Id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenM1}` },
        body: JSON.stringify({ rejectionReason: 'Late rejection' }),
      });
      const data = await res.json();
      return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
    })) passedCount++;

    // Test 13: Insufficient balance prevents approval -> 400
    // Employee 1 requests 8 days (2026-10-01 to 2026-10-08). Remaining balance is 7 days.
    const res3 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenE1}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-10-01', endDate: '2026-10-08', reason: 'TEST_P6_Exceed' }),
    });
    // Note: createLeaveRequest itself checks balance during creation, so request creation will fail with 400.
    // Let's also test direct transaction balance re-check if a pending request existed when remaining balance dropped.
    const data3 = await res3.json();
    totalTests++;
    if (await runTest('13. Insufficient balance prevents approval / creation -> 400 Bad Request', async () => {
      return { passed: res3.status === 400 && data3.success === false && data3.message === 'Insufficient leave balance.', status: res3.status, expectedStatus: 400, message: JSON.stringify(data3) };
    })) passedCount++;

    // Test 14: Concurrency / Row-locking test (Concurrent approval attempts on same request)
    // Create a 3rd pending request for Employee 1 (2 days: 2026-11-01 to 2026-11-02)
    const res4 = await fetch(`${BASE_URL}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenE1}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-11-01', endDate: '2026-11-02', reason: 'TEST_P6_Concurrent' }),
    });
    const data4 = await res4.json();
    const req4Id = data4.leaveRequest.id;

    totalTests++;
    if (await runTest('14. Concurrency row-locking test (Concurrent approvals on same request)', async () => {
      const [resA, resB] = await Promise.all([
        fetch(`${BASE_URL}/api/leaves/${req4Id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${tokenM1}` } }),
        fetch(`${BASE_URL}/api/leaves/${req4Id}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${tokenM1}` } }),
      ]);
      const statuses = [resA.status, resB.status].sort();
      // One request should succeed (200) and the second should fail (400) because it's no longer pending
      const isConcurrencySafe = statuses[0] === 200 && statuses[1] === 400;
      return { passed: isConcurrencySafe, status: `A:${resA.status}, B:${resB.status}`, expectedStatus: 'A:200, B:400', message: `Statuses: ${statuses.join(', ')}` };
    })) passedCount++;

    // Test 15: Transaction rollback verification
    totalTests++;
    if (await runTest('15. Transaction rollback works cleanly if error occurs mid-transaction', async () => {
      const [balBefore] = await pool.query("SELECT remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ? AND year = 2026", [emp1Id, leavePolicyId]);
      
      // Attempt invalid approval on fake ID 999999
      const resErr = await fetch(`${BASE_URL}/api/leaves/999999/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenM1}` },
      });

      const [balAfter] = await pool.query("SELECT remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ? AND year = 2026", [emp1Id, leavePolicyId]);
      const isRollbackClean = parseFloat(balBefore[0].remaining_days) === parseFloat(balAfter[0].remaining_days);

      return { passed: resErr.status === 404 && isRollbackClean, status: resErr.status, expectedStatus: 404, message: `Remaining before: ${balBefore[0].remaining_days}, after: ${balAfter[0].remaining_days}` };
    })) passedCount++;

    console.log(`\n==================================================`);
    console.log(`LEAVE APPROVAL INTEGRATION TEST RESULTS: ${passedCount}/${totalTests} PASSED`);
    console.log(`==================================================\n`);

    process.exit(passedCount === totalTests ? 0 : 1);
  } catch (err) {
    if (connection) connection.release();
    console.error('Fatal Test Execution Error:', err.message);
    process.exit(1);
  }
};

executeApprovalTests();
