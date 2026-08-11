const path = require('path');
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { pool } = require('../backend/config/db');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api`;

const logStep = (stepNum, description, passed, detail = '') => {
  if (passed) {
    console.log(`  ✅ [STEP ${stepNum} PASSED] ${description}`);
  } else {
    console.error(`  ❌ [STEP ${stepNum} FAILED] ${description} - ${detail}`);
  }
};

const runSmokeTest = async () => {
  console.log(`\n==================================================`);
  console.log(`EXECUTION OF PHASE 12 END-TO-END SYSTEM SMOKE TEST`);
  console.log(`==================================================\n`);

  let totalSteps = 0;
  let passedSteps = 0;

  try {
    // 1. Health check reachability
    totalSteps++;
    const resHealth = await fetch(`http://localhost:${process.env.PORT || 5000}/api/health`);
    const dataHealth = await resHealth.json();
    const step1Ok = resHealth.status === 200 && dataHealth.status === 'ok';
    if (step1Ok) passedSteps++;
    logStep(1, 'Backend API Server reachable & healthy (/api/health)', step1Ok);

    // 2. Admin Login
    totalSteps++;
    const resAdmLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@p7test.com', password: 'Password123' }),
    });
    const dataAdmLogin = await resAdmLogin.json();
    const adminToken = dataAdmLogin.token;
    const step2Ok = resAdmLogin.status === 200 && !!adminToken;
    if (step2Ok) passedSteps++;
    logStep(2, 'Admin User Login & JWT Token issuance', step2Ok);

    // 3. Manager Login
    totalSteps++;
    const resMgrLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mgr@p7test.com', password: 'Password123' }),
    });
    const dataMgrLogin = await resMgrLogin.json();
    const mgrToken = dataMgrLogin.token;
    const step3Ok = resMgrLogin.status === 200 && !!mgrToken;
    if (step3Ok) passedSteps++;
    logStep(3, 'Manager User Login & JWT Token issuance', step3Ok);

    // 4. Employee Login
    totalSteps++;
    const resEmpLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@p7test.com', password: 'Password123' }),
    });
    const dataEmpLogin = await resEmpLogin.json();
    const empToken = dataEmpLogin.token;
    const step4Ok = resEmpLogin.status === 200 && !!empToken;
    if (step4Ok) passedSteps++;
    logStep(4, 'Employee User Login & JWT Token issuance', step4Ok);

    // 5. Profile Retrieval via GET /api/auth/me
    totalSteps++;
    const resMe = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const dataMe = await resMe.json();
    const step5Ok = resMe.status === 200 && dataMe.user.email === 'emp@p7test.com';
    if (step5Ok) passedSteps++;
    logStep(5, 'Employee Session restoration via GET /api/auth/me', step5Ok);

    // 6. Look up active leave policy and link manager
    const [policies] = await pool.query('SELECT id FROM leave_policies LIMIT 1');
    const policyId = policies.length > 0 ? policies[0].id : 1;

    const [mgrRecs] = await pool.query("SELECT id FROM employees WHERE user_id = (SELECT id FROM users WHERE email = 'mgr@p7test.com')");
    const mgrEmpId = mgrRecs[0].id;

    const [empRecs] = await pool.query("SELECT id FROM employees WHERE user_id = (SELECT id FROM users WHERE email = 'emp@p7test.com')");
    const empId = empRecs[0].id;

    // Ensure emp@p7test.com manager_id points to mgr@p7test.com
    await pool.query('UPDATE employees SET manager_id = ? WHERE id = ?', [mgrEmpId, empId]);

    // Ensure Employee balance exists
    const [balRecs] = await pool.query('SELECT remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ?', [empId, policyId]);
    if (balRecs.length === 0) {
      await pool.query('INSERT INTO leave_balances (employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days) VALUES (?, ?, 2026, 20.00, 0.00, 20.00)', [empId, policyId]);
    }

    // 7. Submit Leave Request with dynamic date
    const randomDay = 10 + Math.floor(Math.random() * 15);
    const startDateStr = `2026-12-${String(randomDay).padStart(2, '0')}`;
    const endDateStr = `2026-12-${String(randomDay + 1).padStart(2, '0')}`;

    totalSteps++;
    const resLeaveReq = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({ leavePolicyId: policyId, startDate: startDateStr, endDate: endDateStr, reason: 'Smoke Test Leave' }),
    });
    const dataLeaveReq = await resLeaveReq.json();
    const leaveId = dataLeaveReq.leaveRequest?.id;
    const step7Ok = resLeaveReq.status === 201 && dataLeaveReq.leaveRequest?.status === 'pending';
    if (step7Ok) passedSteps++;
    logStep(7, 'Employee submits new leave request (Status: Pending)', step7Ok);

    // 8. Manager approves leave request
    totalSteps++;
    const resApprove = await fetch(`${BASE_URL}/leaves/${leaveId}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataApprove = await resApprove.json();
    const step8Ok = resApprove.status === 200 && (dataApprove.leaveRequest?.status === 'approved' || dataApprove.request?.status === 'approved');
    if (step8Ok) passedSteps++;
    logStep(8, 'Admin/Manager approves leave request (Status: Approved)', step8Ok);

    // 9. Verify updated leave balance in DB
    totalSteps++;
    const [updatedBal] = await pool.query('SELECT used_days, remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ?', [empId, policyId]);
    const usedDays = parseFloat(updatedBal[0].used_days);
    const step9Ok = usedDays > 0;
    if (step9Ok) passedSteps++;
    logStep(9, 'Database verified leave balance deduction (Used Days updated)', step9Ok);

    // 10. Admin opens Reports
    totalSteps++;
    const resOverview = await fetch(`${BASE_URL}/reports/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataOverview = await resOverview.json();
    const step10Ok = resOverview.status === 200 && typeof dataOverview.data.totalEmployees === 'number';
    if (step10Ok) passedSteps++;
    logStep(10, 'Admin fetches system overview analytics (/api/reports/overview)', step10Ok);

    // 11. Admin opens Audit Logs
    totalSteps++;
    const resAudit = await fetch(`${BASE_URL}/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataAudit = await resAudit.json();
    const step11Ok = resAudit.status === 200 && Array.isArray(dataAudit.data) && dataAudit.data.length > 0;
    if (step11Ok) passedSteps++;
    logStep(11, 'Admin fetches security audit log trail (/api/audit-logs)', step11Ok);

    // 12. Protected route rejection test
    totalSteps++;
    const resBadToken = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer expired_or_malformed_token' },
    });
    const step12Ok = resBadToken.status === 401;
    if (step12Ok) passedSteps++;
    logStep(12, 'Protected route rejects invalid token with 401 Unauthorized', step12Ok);

    console.log(`\n==================================================`);
    console.log(`FINAL SMOKE TEST SUMMARY: ${passedSteps}/${totalSteps} STEPS PASSED`);
    console.log(`==================================================\n`);

    await pool.end();
    process.exitCode = passedSteps === totalSteps ? 0 : 1;
  } catch (err) {
    console.error('Smoke Test Fatal Error:', err.message);
    try { await pool.end(); } catch (e) {}
    process.exitCode = 1;
  }
};

runSmokeTest();
