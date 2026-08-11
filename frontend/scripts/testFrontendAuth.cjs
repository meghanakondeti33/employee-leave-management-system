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

const verifyFrontendIntegration = async () => {
  console.log(`\n==================================================`);
  console.log(`RUNNING FRONTEND AUTHENTICATION INTEGRATION TESTS`);
  console.log(`==================================================\n`);

  let passedCount = 0;
  let totalTests = 0;

  // Test 1: Invalid Login Attempt
  totalTests++;
  if (await runTest('1. API client handles invalid login (401)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@p7test.com', password: 'WrongPassword' }),
    });
    const data = await res.json();
    return { passed: res.status === 401 && data.success === false && data.message === 'Invalid email or password', message: JSON.stringify(data) };
  })) passedCount++;

  // Test 2: Employee Login & Session Restoration
  let empToken = null;
  totalTests++;
  if (await runTest('2. Employee login returns JWT token and user profile', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@p7test.com', password: 'Password123' }),
    });
    const data = await res.json();
    if (data.token) empToken = data.token;
    return { passed: res.status === 200 && data.success === true && data.user.role === 'employee', message: JSON.stringify(data) };
  })) passedCount++;

  // Test 3: Session Restoration via GET /api/auth/me
  totalTests++;
  if (await runTest('3. Session restoration (GET /api/auth/me) with Bearer token', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const data = await res.json();
    return { passed: res.status === 200 && data.success === true && data.user.email === 'emp@p7test.com', message: JSON.stringify(data) };
  })) passedCount++;

  // Test 4: Expired / Invalid Token Handling
  totalTests++;
  if (await runTest('4. Invalid token causes GET /api/auth/me to return 401 (triggers logout)', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer invalid_junk_token` },
    });
    return { passed: res.status === 401, message: `Status: ${res.status}` };
  })) passedCount++;

  // Test 5: Admin Login & Role Verification
  let adminToken = null;
  totalTests++;
  if (await runTest('5. Admin login returns admin role profile', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@p7test.com', password: 'Password123' }),
    });
    const data = await res.json();
    if (data.token) adminToken = data.token;
    return { passed: res.status === 200 && data.success === true && data.user.role === 'admin', message: JSON.stringify(data) };
  })) passedCount++;

  console.log(`\n==================================================`);
  console.log(`FRONTEND AUTH INTEGRATION RESULTS: ${passedCount}/${totalTests} PASSED`);
  console.log(`==================================================\n`);

  process.exitCode = passedCount === totalTests ? 0 : 1;
};

verifyFrontendIntegration();
