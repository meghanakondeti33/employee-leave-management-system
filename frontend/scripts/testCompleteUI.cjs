const path = require('path');
const dotenv = require('../../backend/node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const BASE_URL = 'http://localhost:5000/api';

const runTest = async (testName, action) => {
  try {
    const result = await action();
    if (result.passed) {
      console.log(`✅ [PASSED] ${testName}`);
    } else {
      console.error(`❌ [FAILED] ${testName} - Details: ${result.message}`);
    }
    return result.passed;
  } catch (error) {
    console.error(`❌ [EXCEPTION] ${testName}: ${error.message}`);
    return false;
  }
};

const executeCompleteUITests = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING PHASE 10 COMPLETE APPLICATION INTEGRATION TESTS`);
  console.log(`==================================================\n`);

  let passedCount = 0;
  let totalTests = 0;

  // 1. Employee Login & Workflows
  let empToken = null;
  totalTests++;
  if (await runTest('1. Employee authenticates and retrieves session token', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@p7test.com', password: 'Password123' }),
    });
    const data = await res.json();
    if (data.token) empToken = data.token;
    return { passed: res.status === 200 && data.success === true && data.user.role === 'employee', message: JSON.stringify(data) };
  })) passedCount++;

  // Fetch valid policy ID for test
  const { pool } = require('../../backend/config/db');
  let leavePolicyId = 1;
  const [pRows] = await pool.query('SELECT id FROM leave_policies LIMIT 1');
  if (pRows.length > 0) {
    leavePolicyId = pRows[0].id;
  } else {
    const [pIns] = await pool.query("INSERT INTO leave_policies (name, description, annual_limit) VALUES ('Annual Leave', 'Default Annual Leave', 20)");
    leavePolicyId = pIns.insertId;
  }

  // Seed balance for Employee 1 for test policy if missing
  const [empRec] = await pool.query("SELECT id FROM employees WHERE user_id = (SELECT id FROM users WHERE email = 'emp@p7test.com')");
  if (empRec.length > 0) {
    const [bRows] = await pool.query("SELECT id FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ?", [empRec[0].id, leavePolicyId]);
    if (bRows.length === 0) {
      await pool.query("INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 20.00, 0.00, 20.00)", [empRec[0].id, leavePolicyId]);
    }
  }

  let createdLeaveId = null;
  totalTests++;
  if (await runTest('2. Employee submits leave application (POST /api/leaves)', async () => {
    const res = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({ leavePolicyId, startDate: '2026-11-10', endDate: '2026-11-12', reason: 'UI Test Leave' }),
    });
    const data = await res.json();
    if (data.leaveRequest) createdLeaveId = data.leaveRequest.id;
    return { passed: res.status === 201 && data.success === true && data.leaveRequest.status === 'pending', message: JSON.stringify(data) };
  })) passedCount++;

  totalTests++;
  if (await runTest('3. Employee cancels pending leave application (DELETE /api/leaves/:id)', async () => {
    const res = await fetch(`${BASE_URL}/leaves/${createdLeaveId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const data = await res.json();
    return { passed: res.status === 200 && data.success === true && data.leaveRequest.status === 'cancelled', message: JSON.stringify(data) };
  })) passedCount++;

  // 2. Manager Login & Workflows
  let mgrToken = null;
  totalTests++;
  if (await runTest('4. Manager authenticates and retrieves team directory', async () => {
    const resAuth = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mgr@p7test.com', password: 'Password123' }),
    });
    const dataAuth = await resAuth.json();
    if (dataAuth.token) mgrToken = dataAuth.token;

    const resTeam = await fetch(`${BASE_URL}/employees`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    const dataTeam = await resTeam.json();
    return { passed: resAuth.status === 200 && resTeam.status === 200 && Array.isArray(dataTeam.employees), message: `Team count: ${dataTeam.employees?.length}` };
  })) passedCount++;

  // 3. Admin Login & Workflows
  let adminToken = null;
  totalTests++;
  if (await runTest('5. Admin authenticates and accesses overview report', async () => {
    const resAuth = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@p7test.com', password: 'Password123' }),
    });
    const dataAuth = await resAuth.json();
    if (dataAuth.token) adminToken = dataAuth.token;

    const resOverview = await fetch(`${BASE_URL}/reports/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataOverview = await resOverview.json();
    return { passed: resAuth.status === 200 && resOverview.status === 200 && typeof dataOverview.data.totalEmployees === 'number', message: JSON.stringify(dataOverview.data) };
  })) passedCount++;

  let createdEmpId = null;
  totalTests++;
  if (await runTest('6. Admin creates employee profile (POST /api/employees)', async () => {
    const res = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        email: 'uicreated@p7test.com',
        password: 'Password123',
        role: 'employee',
        firstName: 'UICreated',
        lastName: 'Test',
        employeeCode: 'TEST_UI_100',
        departmentId: 1,
        joiningDate: '2026-08-11',
      }),
    });
    const data = await res.json();
    if (data.employee) createdEmpId = data.employee.id;
    return { passed: res.status === 201 && data.success === true, message: JSON.stringify(data) };
  })) passedCount++;

  totalTests++;
  if (await runTest('7. Admin updates employee profile (PUT /api/employees/:id)', async () => {
    const res = await fetch(`${BASE_URL}/employees/${createdEmpId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ firstName: 'UIUpdated' }),
    });
    const data = await res.json();
    return { passed: res.status === 200 && data.success === true && data.employee.first_name === 'UIUpdated', message: JSON.stringify(data) };
  })) passedCount++;

  totalTests++;
  if (await runTest('8. Admin deletes employee profile (DELETE /api/employees/:id)', async () => {
    const res = await fetch(`${BASE_URL}/employees/${createdEmpId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    return { passed: res.status === 200 && data.success === true, message: JSON.stringify(data) };
  })) passedCount++;

  totalTests++;
  if (await runTest('9. Admin accesses security audit log trail (GET /api/audit-logs)', async () => {
    const res = await fetch(`${BASE_URL}/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    return { passed: res.status === 200 && data.success === true && Array.isArray(data.data), message: `Audit entries: ${data.data.length}` };
  })) passedCount++;

  console.log(`\n==================================================`);
  console.log(`COMPLETE APPLICATION UI INTEGRATION RESULTS: ${passedCount}/${totalTests} PASSED`);
  console.log(`==================================================\n`);

  try { await pool.end(); } catch (e) {}
  process.exitCode = passedCount === totalTests ? 0 : 1;
};

executeCompleteUITests();
