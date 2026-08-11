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

const executeLeaveTests = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING PHASE 5 LEAVE REQUEST INTEGRATION TESTS`);
  console.log(`==================================================\n`);

  const connection = await pool.getConnection();

  try {
    // 1. Cleanup old test data cleanly
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query("DELETE FROM leave_requests WHERE reason LIKE 'TEST_%'");
    await connection.query("DELETE FROM leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE employee_code LIKE 'TEST_LV_%')");
    await connection.query("DELETE FROM employees WHERE employee_code LIKE 'TEST_LV_%'");
    await connection.query("DELETE FROM users WHERE email LIKE '%@leavetest.com'");
    await connection.query("DELETE FROM leave_policies WHERE name = 'TEST Casual Leave'");
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Ensure default department exists
    let departmentId;
    const [deptRows] = await connection.query("SELECT id FROM departments WHERE name = 'Engineering'");
    if (deptRows.length > 0) {
      departmentId = deptRows[0].id;
    } else {
      const [newDept] = await connection.query("INSERT INTO departments (name, description) VALUES ('Engineering', 'Software Engineering Department')");
      departmentId = newDept.insertId;
    }

    // 3. Create test leave policy
    const [policyResult] = await connection.query(
      "INSERT INTO leave_policies (name, description, annual_limit) VALUES ('TEST Casual Leave', 'Test Casual Leave Policy', 12)"
    );
    const leavePolicyId = policyResult.insertId;

    const defaultPasswordHash = await bcrypt.hash('Password123', 10);

    // 4. Seed Employee A
    const [empAUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('empa@leavetest.com', ?, 'employee')", [defaultPasswordHash]);
    const [empARec] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Employee', 'A', 'TEST_LV_001', '2026-01-01')",
      [empAUser.insertId, departmentId]
    );
    const empAId = empARec.insertId;

    // Seed Employee A Leave Balance (12 days for 2026)
    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 12.00, 0.00, 12.00)",
      [empAId, leavePolicyId]
    );

    // 5. Seed Employee B
    const [empBUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('empb@leavetest.com', ?, 'employee')", [defaultPasswordHash]);
    const [empBRec] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Employee', 'B', 'TEST_LV_002', '2026-01-01')",
      [empBUser.insertId, departmentId]
    );
    const empBId = empBRec.insertId;

    // Seed Employee B Leave Balance (12 days for 2026)
    await connection.query(
      "INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 12.00, 0.00, 12.00)",
      [empBId, leavePolicyId]
    );

    connection.release();

    // Generate Tokens
    const tokenEmpA = jwt.sign({ userId: empAUser.insertId, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const tokenEmpB = jwt.sign({ userId: empBUser.insertId, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    let createdRequestId = null;
    let approvedRequestId = null;
    let passedCount = 0;
    let totalTests = 0;

    // Test 1: Create valid leave request -> 201
    totalTests++;
    if (await runTest('1. Create valid leave request (2026-08-20 to 2026-08-22)', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpA}` },
        body: JSON.stringify({
          leavePolicyId,
          startDate: '2026-08-20',
          endDate: '2026-08-22',
          reason: 'TEST_Personal work',
        }),
      });
      const data = await res.json();
      if (data.leaveRequest) createdRequestId = data.leaveRequest.id;
      return {
        passed: res.status === 201 && data.success === true && parseFloat(data.leaveRequest.days) === 3 && data.leaveRequest.status === 'pending',
        status: res.status,
        expectedStatus: 201,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 2: Check request in MySQL & verify remaining_days is UNCHANGED
    totalTests++;
    if (await runTest('2. Check request status in MySQL and verify leave balance remains UNCHANGED', async () => {
      const [reqRows] = await pool.query('SELECT status, days FROM leave_requests WHERE id = ?', [createdRequestId]);
      const [balRows] = await pool.query('SELECT used_days, remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ? AND year = 2026', [empAId, leavePolicyId]);
      
      const reqPending = reqRows.length > 0 && reqRows[0].status === 'pending' && parseFloat(reqRows[0].days) === 3;
      const balUnchanged = balRows.length > 0 && parseFloat(balRows[0].used_days) === 0 && parseFloat(balRows[0].remaining_days) === 12;

      return {
        passed: reqPending && balUnchanged,
        status: 200,
        expectedStatus: 200,
        message: `Request status: ${reqRows[0]?.status}, Remaining Days: ${balRows[0]?.remaining_days}`,
      };
    })) passedCount++;

    // Test 3: View own requests -> 200
    totalTests++;
    if (await runTest('3. View own leave requests (GET /api/leaves/my)', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/my`, {
        headers: { Authorization: `Bearer ${tokenEmpA}` },
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.success === true && Array.isArray(data.leaveRequests) && data.leaveRequests.some((r) => r.id === createdRequestId),
        status: res.status,
        expectedStatus: 200,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 4: View own request by ID -> 200
    totalTests++;
    if (await runTest('4. View own leave request by ID (GET /api/leaves/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${createdRequestId}`, {
        headers: { Authorization: `Bearer ${tokenEmpA}` },
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.success === true && data.leaveRequest.id === createdRequestId,
        status: res.status,
        expectedStatus: 200,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 5: View another employee's request -> 403
    totalTests++;
    if (await runTest('5. View another employee\'s leave request -> 403 Forbidden', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${createdRequestId}`, {
        headers: { Authorization: `Bearer ${tokenEmpB}` },
      });
      const data = await res.json();
      return {
        passed: res.status === 403 && data.success === false,
        status: res.status,
        expectedStatus: 403,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 6: Invalid date range -> 400
    totalTests++;
    if (await runTest('6. Invalid date range (endDate < startDate) -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpA}` },
        body: JSON.stringify({
          leavePolicyId,
          startDate: '2026-08-25',
          endDate: '2026-08-20',
          reason: 'TEST_Invalid date range',
        }),
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.success === false,
        status: res.status,
        expectedStatus: 400,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 7: Insufficient balance -> 400
    totalTests++;
    if (await runTest('7. Insufficient balance (request 20 days when remaining is 12) -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpA}` },
        body: JSON.stringify({
          leavePolicyId,
          startDate: '2026-10-01',
          endDate: '2026-10-20', // 20 days
          reason: 'TEST_Exceed balance',
        }),
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.success === false && data.message === 'Insufficient leave balance.',
        status: res.status,
        expectedStatus: 400,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 8: Overlapping pending request -> 409
    totalTests++;
    if (await runTest('8. Overlapping pending request (2026-08-21 to 2026-08-23) -> 409 Conflict', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpA}` },
        body: JSON.stringify({
          leavePolicyId,
          startDate: '2026-08-21',
          endDate: '2026-08-23',
          reason: 'TEST_Overlap pending',
        }),
      });
      const data = await res.json();
      return {
        passed: res.status === 409 && data.success === false,
        status: res.status,
        expectedStatus: 409,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Seed an approved request directly in DB for Test 9 & Test 12
    const [approvedRes] = await pool.query(
      "INSERT INTO leave_requests (employee_id, leave_policy_id, start_date, end_date, days, reason, status) VALUES (?, ?, '2026-09-01', '2026-09-05', 5, 'TEST_Approved Leave', 'approved')",
      [empAId, leavePolicyId]
    );
    approvedRequestId = approvedRes.insertId;

    // Test 9: Overlapping approved request -> 409
    totalTests++;
    if (await runTest('9. Overlapping approved request (2026-09-04 to 2026-09-07) -> 409 Conflict', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpA}` },
        body: JSON.stringify({
          leavePolicyId,
          startDate: '2026-09-04',
          endDate: '2026-09-07',
          reason: 'TEST_Overlap approved',
        }),
      });
      const data = await res.json();
      return {
        passed: res.status === 409 && data.success === false,
        status: res.status,
        expectedStatus: 409,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 10: Cancel pending request -> 200
    totalTests++;
    if (await runTest('10. Cancel pending request (DELETE /api/leaves/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${createdRequestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenEmpA}` },
      });
      const data = await res.json();
      return {
        passed: res.status === 200 && data.success === true && data.leaveRequest.status === 'cancelled',
        status: res.status,
        expectedStatus: 200,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 11: Cancel already cancelled request -> 400
    totalTests++;
    if (await runTest('11. Cancel already cancelled request -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${createdRequestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenEmpA}` },
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.success === false,
        status: res.status,
        expectedStatus: 400,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 12: Cancel approved request -> 400
    totalTests++;
    if (await runTest('12. Cancel approved request -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/${approvedRequestId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenEmpA}` },
      });
      const data = await res.json();
      return {
        passed: res.status === 400 && data.success === false,
        status: res.status,
        expectedStatus: 400,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    // Test 13: Missing JWT -> 401
    totalTests++;
    if (await runTest('13. Request without JWT token -> 401 Unauthorized', async () => {
      const res = await fetch(`${BASE_URL}/api/leaves/my`);
      const data = await res.json();
      return {
        passed: res.status === 401 && data.success === false,
        status: res.status,
        expectedStatus: 401,
        message: JSON.stringify(data),
      };
    })) passedCount++;

    console.log(`\n==================================================`);
    console.log(`LEAVE INTEGRATION TEST RESULTS: ${passedCount}/${totalTests} PASSED`);
    console.log(`==================================================\n`);

    process.exit(passedCount === totalTests ? 0 : 1);
  } catch (err) {
    if (connection) connection.release();
    console.error('Fatal Test Execution Error:', err.message);
    process.exit(1);
  }
};

executeLeaveTests();
