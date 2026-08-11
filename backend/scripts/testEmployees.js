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

const executeEmployeeTests = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING PHASE 4 EMPLOYEE & RBAC INTEGRATION TESTS`);
  console.log(`==================================================\n`);

  const connection = await pool.getConnection();

  try {
    // 1. Cleanup old test data cleanly
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query("DELETE FROM employees WHERE employee_code LIKE 'TEST_%'");
    await connection.query("DELETE FROM users WHERE email LIKE '%@emptest.com'");
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

    const defaultPasswordHash = await bcrypt.hash('Password123', 10);

    // 3. Seed Admin User & Employee
    const [adminUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('admin@emptest.com', ?, 'admin')", [defaultPasswordHash]);
    const [adminEmp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'System', 'Admin', 'TEST_ADM001', '2026-01-01')",
      [adminUser.insertId, departmentId]
    );

    // 4. Seed Manager User & Employee
    const [mgrUser] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('manager@emptest.com', ?, 'manager')", [defaultPasswordHash]);
    const [mgrEmp] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Engineering', 'Manager', 'TEST_MGR001', '2026-01-01')",
      [mgrUser.insertId, departmentId]
    );

    // 5. Seed Employee 1 (Managed by Manager)
    const [emp1User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp1@emptest.com', ?, 'employee')", [defaultPasswordHash]);
    const [emp1Rec] = await connection.query(
      "INSERT INTO employees (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, ?, 'Meghana', 'Kondeti', 'TEST_EMP001', '2026-08-11')",
      [emp1User.insertId, departmentId, mgrEmp.insertId]
    );

    // 6. Seed Employee 2 (Not Managed by Manager)
    const [emp2User] = await connection.query("INSERT INTO users (email, password_hash, role) VALUES ('emp2@emptest.com', ?, 'employee')", [defaultPasswordHash]);
    const [emp2Rec] = await connection.query(
      "INSERT INTO employees (user_id, department_id, first_name, last_name, employee_code, joining_date) VALUES (?, ?, 'Unmanaged', 'User', 'TEST_EMP002', '2026-08-11')",
      [emp2User.insertId, departmentId]
    );

    connection.release();

    // Generate JWT Tokens
    const adminToken = jwt.sign({ userId: adminUser.insertId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const mgrToken = jwt.sign({ userId: mgrUser.insertId, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const emp1Token = jwt.sign({ userId: emp1User.insertId, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const adminEmpId = adminEmp.insertId;
    const mgrEmpId = mgrEmp.insertId;
    const emp1Id = emp1Rec.insertId;
    const emp2Id = emp2Rec.insertId;

    let createdTestEmpId = null;
    let passedCount = 0;
    let totalTests = 0;

    // --- ADMIN TESTS ---
    console.log('\n--- ADMIN PERMISSION TESTS ---');

    totalTests++;
    if (await runTest('ADMIN: Create new employee (POST /api/employees)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          email: 'newcreated@emptest.com',
          password: 'Password123',
          role: 'employee',
          firstName: 'New',
          lastName: 'Created',
          employeeCode: 'TEST_NEW001',
          departmentId,
          managerId: mgrEmpId,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      if (data.employee) createdTestEmpId = data.employee.id;
      return { passed: res.status === 201 && data.success === true && !!data.employee, status: res.status, expectedStatus: 201, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ADMIN: List all employees (GET /api/employees)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && Array.isArray(data.employees) && data.employees.length >= 4, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ADMIN: View any employee by ID (GET /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp1Id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.employee.id === emp1Id, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ADMIN: Update employee profile (PUT /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${createdTestEmpId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ firstName: 'UpdatedName' }),
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.employee.first_name === 'UpdatedName', status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ADMIN: Delete employee safely (DELETE /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${createdTestEmpId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    // --- MANAGER TESTS ---
    console.log('\n--- MANAGER PERMISSION TESTS ---');

    totalTests++;
    if (await runTest('MANAGER: View team employees (GET /api/employees)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${mgrToken}` },
      });
      const data = await res.json();
      const allManaged = data.employees.every((e) => e.manager_id === mgrEmpId);
      return { passed: res.status === 200 && data.success === true && allManaged && data.employees.some((e) => e.id === emp1Id), status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('MANAGER: View team member detail (GET /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp1Id}`, {
        headers: { Authorization: `Bearer ${mgrToken}` },
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.employee.id === emp1Id, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('MANAGER: View unrelated employee -> 403 (GET /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp2Id}`, {
        headers: { Authorization: `Bearer ${mgrToken}` },
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('MANAGER: Attempt create employee -> 403 (POST /api/employees)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mgrToken}` },
        body: JSON.stringify({
          email: 'mgrobject@emptest.com',
          password: 'Password123',
          firstName: 'Illegal',
          lastName: 'Create',
          employeeCode: 'TEST_ILL001',
          departmentId,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('MANAGER: Attempt delete employee -> 403 (DELETE /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${mgrToken}` },
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    // --- EMPLOYEE TESTS ---
    console.log('\n--- EMPLOYEE PERMISSION TESTS ---');

    totalTests++;
    if (await runTest('EMPLOYEE: View own profile (GET /api/employees/me)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/me`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.employee.id === emp1Id, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('EMPLOYEE: View own employee record (GET /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp1Id}`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const data = await res.json();
      return { passed: res.status === 200 && data.success === true && data.employee.id === emp1Id, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('EMPLOYEE: View another employee record -> 403 (GET /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp2Id}`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('EMPLOYEE: List directory attempt -> 403 (GET /api/employees)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('EMPLOYEE: Attempt create employee -> 403 (POST /api/employees)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emp1Token}` },
        body: JSON.stringify({
          email: 'empobject@emptest.com',
          password: 'Password123',
          firstName: 'Illegal',
          lastName: 'Create',
          employeeCode: 'TEST_ILL002',
          departmentId,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('EMPLOYEE: Attempt update employee -> 403 (PUT /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp1Id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emp1Token}` },
        body: JSON.stringify({ firstName: 'Hacked' }),
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('EMPLOYEE: Attempt delete employee -> 403 (DELETE /api/employees/:id)', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/${emp1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const data = await res.json();
      return { passed: res.status === 403 && data.success === false, status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
    })) passedCount++;

    // --- VALIDATION & ERROR TESTS ---
    console.log('\n--- VALIDATION & ERROR HANDLING TESTS ---');

    totalTests++;
    if (await runTest('ERROR: Duplicate email -> 409 Conflict', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          email: 'emp1@emptest.com',
          password: 'Password123',
          firstName: 'Dup',
          lastName: 'Email',
          employeeCode: 'TEST_UNIQUE001',
          departmentId,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      return { passed: res.status === 409 && data.success === false, status: res.status, expectedStatus: 409, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ERROR: Duplicate employee code -> 409 Conflict', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          email: 'dupcode@emptest.com',
          password: 'Password123',
          firstName: 'Dup',
          lastName: 'Code',
          employeeCode: 'TEST_EMP001',
          departmentId,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      return { passed: res.status === 409 && data.success === false, status: res.status, expectedStatus: 409, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ERROR: Nonexistent department ID -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          email: 'baddept@emptest.com',
          password: 'Password123',
          firstName: 'Bad',
          lastName: 'Dept',
          employeeCode: 'TEST_BADDEPT',
          departmentId: 999999,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ERROR: Nonexistent manager ID -> 400 Bad Request', async () => {
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          email: 'badmgr@emptest.com',
          password: 'Password123',
          firstName: 'Bad',
          lastName: 'Mgr',
          employeeCode: 'TEST_BADMGR',
          departmentId,
          managerId: 999999,
          joiningDate: '2026-08-11',
        }),
      });
      const data = await res.json();
      return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
    })) passedCount++;

    totalTests++;
    if (await runTest('ERROR: Nonexistent employee ID -> 404 Not Found', async () => {
      const res = await fetch(`${BASE_URL}/api/employees/999999`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      return { passed: res.status === 404 && data.success === false, status: res.status, expectedStatus: 404, message: JSON.stringify(data) };
    })) passedCount++;

    console.log(`\n==================================================`);
    console.log(`EMPLOYEE & RBAC TEST RESULTS: ${passedCount}/${totalTests} PASSED`);
    console.log(`==================================================\n`);

    process.exit(passedCount === totalTests ? 0 : 1);
  } catch (err) {
    if (connection) connection.release();
    console.error('Fatal Test Execution Error:', err.message);
    process.exit(1);
  }
};

executeEmployeeTests();
