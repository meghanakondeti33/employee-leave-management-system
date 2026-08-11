const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { pool } = require('../config/db');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const runTest = async (testNumber, title, action) => {
  try {
    const result = await action();
    if (result.passed) {
      console.log(`✅ Test ${testNumber}: ${title} [PASSED] (Status: ${result.status})`);
    } else {
      console.error(`❌ Test ${testNumber}: ${title} [FAILED] Expected: ${result.expectedStatus}, Got: ${result.status} - Message: ${result.message}`);
    }
    return result.passed;
  } catch (error) {
    console.error(`❌ Test ${testNumber}: ${title} [EXCEPTION] ${error.message}`);
    return false;
  }
};

const executeAuthTests = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING PHASE 3 AUTHENTICATION TEST SUITE`);
  console.log(`==================================================\n`);

  // Clear existing test users to ensure repeatable tests
  await pool.query("DELETE FROM users WHERE email LIKE '%@authtest.com'");

  let employeeToken = '';
  let adminToken = '';
  let passedCount = 0;
  let totalTests = 12;

  // Test 1: Register employee (Valid) -> 201
  const t1 = await runTest(1, 'Register valid employee', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@authtest.com', password: 'Password123', role: 'employee' }),
    });
    const data = await res.json();
    return { passed: res.status === 201 && data.success === true && data.user.email === 'emp@authtest.com' && !data.user.password_hash, status: res.status, expectedStatus: 201, message: JSON.stringify(data) };
  });
  if (t1) passedCount++;

  // Test 2: Register duplicate email -> 400
  const t2 = await runTest(2, 'Register duplicate email', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@authtest.com', password: 'Password123', role: 'employee' }),
    });
    const data = await res.json();
    return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
  });
  if (t2) passedCount++;

  // Test 3: Register invalid email -> 400
  const t3 = await runTest(3, 'Register invalid email format', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email-format', password: 'Password123' }),
    });
    const data = await res.json();
    return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
  });
  if (t3) passedCount++;

  // Test 4: Register weak password -> 400
  const t4 = await runTest(4, 'Register weak password (<6 chars)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'weak@authtest.com', password: '123' }),
    });
    const data = await res.json();
    return { passed: res.status === 400 && data.success === false, status: res.status, expectedStatus: 400, message: JSON.stringify(data) };
  });
  if (t4) passedCount++;

  // Test 5: Login with correct password -> 200
  const t5 = await runTest(5, 'Login with correct password', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@authtest.com', password: 'Password123' }),
    });
    const data = await res.json();
    if (data.token) employeeToken = data.token;
    return { passed: res.status === 200 && data.success === true && !!data.token && data.user.role === 'employee', status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
  });
  if (t5) passedCount++;

  // Test 6: Login with incorrect password -> 401
  const t6 = await runTest(6, 'Login with incorrect password', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@authtest.com', password: 'WrongPassword' }),
    });
    const data = await res.json();
    return { passed: res.status === 401 && data.success === false && data.message === 'Invalid email or password', status: res.status, expectedStatus: 401, message: JSON.stringify(data) };
  });
  if (t6) passedCount++;

  // Test 7: Login with nonexistent email -> 401
  const t7 = await runTest(7, 'Login with nonexistent email', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@authtest.com', password: 'Password123' }),
    });
    const data = await res.json();
    return { passed: res.status === 401 && data.success === false && data.message === 'Invalid email or password', status: res.status, expectedStatus: 401, message: JSON.stringify(data) };
  });
  if (t7) passedCount++;

  // Test 8: GET /api/auth/me without token -> 401
  const t8 = await runTest(8, 'GET /api/auth/me without authorization header', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    const data = await res.json();
    return { passed: res.status === 401 && data.success === false, status: res.status, expectedStatus: 401, message: JSON.stringify(data) };
  });
  if (t8) passedCount++;

  // Test 9: GET /api/auth/me with invalid token -> 401
  const t9 = await runTest(9, 'GET /api/auth/me with invalid/fake token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer fake.invalid.jwt.token' },
    });
    const data = await res.json();
    return { passed: res.status === 401 && data.success === false, status: res.status, expectedStatus: 401, message: JSON.stringify(data) };
  });
  if (t9) passedCount++;

  // Test 10: GET /api/auth/me with valid token -> 200
  const t10 = await runTest(10, 'GET /api/auth/me with valid employee token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const data = await res.json();
    return { passed: res.status === 200 && data.success === true && data.user.email === 'emp@authtest.com' && !data.user.password_hash, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
  });
  if (t10) passedCount++;

  // Setup Admin user directly in DB for RBAC test
  const adminHash = await bcrypt.hash('AdminPassword123', 10);
  const [adminResult] = await pool.query("INSERT INTO users (email, password_hash, role) VALUES ('admin@authtest.com', ?, 'admin')", [adminHash]);
  adminToken = jwt.sign({ userId: adminResult.insertId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Test 11: authorize("admin") with employee token -> 403 Forbidden
  const t11 = await runTest(11, 'Access admin route with employee token (authorize("admin"))', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/test-admin`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const data = await res.json();
    return { passed: res.status === 403 && data.success === false && data.message === 'Forbidden', status: res.status, expectedStatus: 403, message: JSON.stringify(data) };
  });
  if (t11) passedCount++;

  // Test 12: authorize("admin") with admin token -> 200 OK
  const t12 = await runTest(12, 'Access admin route with admin token (authorize("admin"))', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/test-admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    return { passed: res.status === 200 && data.success === true, status: res.status, expectedStatus: 200, message: JSON.stringify(data) };
  });
  if (t12) passedCount++;

  console.log(`\n==================================================`);
  console.log(`AUTH TEST RESULTS: ${passedCount}/${totalTests} PASSED`);
  console.log(`==================================================\n`);

  process.exit(passedCount === totalTests ? 0 : 1);
};

executeAuthTests();
