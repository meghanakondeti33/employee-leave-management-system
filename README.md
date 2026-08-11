# Employee Leave & Workforce Management System

An enterprise-grade, full-stack Employee Leave & Workforce Management System built with **Node.js, Express.js, MySQL, React 19, and Vite**.

The application provides end-to-end management of workforce leave lifecycles—featuring transaction-safe balance deductions, pessimistic row locking (`FOR UPDATE`), role-based authorization (Employee, Manager, Admin), centralized security audit logging, and organization-wide analytics reports.

---

## 1. System Architecture

The project follows a clean, decoupled client-server architecture with a 4-layer backend design:

```
+-------------------------------------------------------------+
|                     React 19 Frontend                       |
|          (Vite + React Router + Context API + CSS)          |
+-------------------------------------------------------------+
                              |
                              | REST API (JSON / Bearer JWT)
                              v
+-------------------------------------------------------------+
|                     Express.js Backend                      |
|  [ Routes ] -> [ Middleware ] -> [ Controllers ] -> [ Services ] |
+-------------------------------------------------------------+
                              |
                              | Parameterized SQL Queries
                              v
+-------------------------------------------------------------+
|                      MySQL Database                         |
|   (users, departments, employees, leave_policies,          |
|    leave_balances, leave_requests, audit_logs)              |
+-------------------------------------------------------------+
```

---

## 2. Technology Stack

- **Backend**: Node.js, Express.js, `mysql2/promise` pool, `bcrypt`, `jsonwebtoken`, `cors`, `dotenv`
- **Frontend**: React 19, Vite, React Router v7, Context API, Vanilla CSS3 (Custom Design System with Dark Mode Aesthetics)
- **Database**: MySQL 8.0+ Relational Database Engine
- **Testing**: Node.js Automated Security, API Integration, and End-to-End Smoke Testing Suites

---

## 3. Features by Role

### 👤 Employee
- Personal dashboard with real-time leave balance overview and application counts.
- Submit leave requests with policy selection, date range duration previews, and reason inputs.
- Filter personal leave history by status (`pending`, `approved`, `rejected`, `cancelled`).
- View rejection reasons and approval timestamps.
- Soft-cancel pending leave requests before manager review.

### 👔 Manager
- Team operations dashboard displaying team size, pending approvals queue, approved count, and team leave consumption summaries.
- Team member directory listing direct reports.
- Review pending leave applications for direct reports.
- Transaction-safe leave approval with automated balance deduction.
- Leave rejection requiring mandatory rejection reason feedback.

### 🛡️ System Admin
- Organization-wide executive dashboard displaying total employees, departments, and active leave metrics.
- Complete Employee Management (CRUD): Create new employees with transactional user provisioning, search employee directory, edit profile details, and delete employee records.
- Reports & Analytics: Leave status distribution percentages, department leave summaries, and monthly leave consumption trend progress bars.
- Security Audit Log Trail: Centralized audit log table tracking user logins, employee profile mutations, and leave approvals with action/entity filtering and pagination.

---

## 4. Repository Directory Structure

```text
EmployeeLeaveManagement/
├── backend/
│   ├── config/             # Database connection pool configuration
│   ├── controllers/        # Request handlers & response builders
│   ├── database/           # Schema SQL script (schema.sql)
│   ├── middleware/         # Auth JWT verification & RBAC authorization
│   ├── routes/             # API endpoint route declarations
│   ├── services/           # Business logic, SQL queries & transactions
│   ├── validators/         # Request body input validation rules
│   ├── utils/              # Helper utilities
│   ├── scripts/            # Automated test suites
│   ├── .env.example        # Environment template file
│   ├── package.json        # Backend dependencies & scripts
│   └── server.js           # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI controls (Badges, Modals, Spinners, Cards)
│   │   ├── context/        # AuthContext session provider
│   │   ├── layouts/        # AppLayout shell with role navigation
│   │   ├── pages/          # Role pages (Admin, Manager, Employee, Leaves, Profile)
│   │   ├── services/       # Decoupled Fetch API client wrapper
│   │   ├── index.css       # Custom design system stylesheet
│   │   ├── App.jsx         # Role-routed application container
│   │   └── main.jsx        # React DOM entry point
│   ├── scripts/            # Integration & UI test scripts
│   ├── .env.example        # Environment template file
│   ├── package.json        # Frontend dependencies & scripts
│   └── vite.config.js      # Vite build configuration
├── docs/                   # Documentation & Interview Prep Guide
├── scripts/                # End-to-End final smoke test script
└── README.md               # Main system documentation
```

---

## 5. Database Schema & Relational Structure

The database consists of 7 normalized relational tables:

```text
users (id, email, password_hash, role, created_at, updated_at)
  │
  ├── 1:1 ──> employees (id, user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date)
               │          │                 │
               │          └── 1:N (Manager) ┘
               │
               ├── 1:N ──> leave_balances (id, employee_id, leave_policy_id, year, allocated_days, used_days, remaining_days)
               │
               └── 1:N ──> leave_requests (id, employee_id, leave_policy_id, start_date, end_date, days, status, reason, rejection_reason, approved_at)

departments (id, name, description, created_at)
leave_policies (id, name, description, annual_limit, created_at)
audit_logs (id, user_id, action, entity_type, entity_id, description, created_at)
```

---

## 6. Authentication & RBAC Access Matrix

Authentication is backed by **JSON Web Tokens (JWT)** and **bcrypt** password hashing.

| Endpoint | Method | Role Allowed | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | Public | Register user account |
| `/api/auth/login` | POST | Public | Authenticate user & issue JWT |
| `/api/auth/me` | GET | Authenticated | Fetch current profile |
| `/api/employees` | GET | Admin / Manager | List employees |
| `/api/employees` | POST | Admin | Provision user + employee profile |
| `/api/employees/:id` | PUT / DELETE | Admin | Modify or delete employee record |
| `/api/leaves` | POST | Employee | Submit new leave application |
| `/api/leaves/my` | GET | Employee / Manager | Fetch leave requests |
| `/api/leaves/:id` | DELETE | Employee | Soft-cancel pending leave request |
| `/api/leaves/:id/approve` | PUT | Manager / Admin | Approve leave & deduct balance |
| `/api/leaves/:id/reject` | PUT | Manager / Admin | Reject leave request |
| `/api/reports/overview` | GET | Admin / Manager | View dashboard analytics |
| `/api/reports/...` | GET | Admin | View summary distribution & trends |
| `/api/audit-logs` | GET | Admin | View security activity audit logs |

---

## 7. Local Setup & Installation

### Prerequisites
- Node.js (v18+)
- MySQL Server (v8.0+)
- npm or yarn

### 1. Database Setup
Create the database and execute the schema:
```bash
mysql -u root -p < backend/database/schema.sql
```

### 2. Backend Setup
Navigate to the `backend` directory, install dependencies, and configure environment variables:
```bash
cd backend
npm install
cp .env.example .env
```
Ensure your `.env` contains valid database credentials:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=employee_leave_management
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=1h
```
Start the backend server:
```bash
npm run dev
# Server will listen on http://localhost:5000
```

### 3. Frontend Setup
In a separate terminal, navigate to the `frontend` directory, install dependencies, and start the development server:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
# Frontend will run on http://localhost:5173
```

---

## 8. Testing Suite

The application includes automated test suites covering Security, Authorization, Business Rules, and UI Integration:

### Run Backend Security & Quality Test Suite
```bash
cd backend
node scripts/testPhase11Security.js
```

### Run Frontend Integration Test Suite
```bash
cd frontend
node scripts/testCompleteUI.cjs
```

### Run End-to-End System Smoke Test
```bash
node scripts/finalSmokeTest.js
```

---

## 9. Production Build & Deployment Readiness

- **Frontend Production Build**:
  ```bash
  cd frontend
  npm run build
  ```
  Generates optimized static assets in `frontend/dist/`.
- **Environment Decoupling**: API endpoint URLs are read dynamically from `process.env.PORT` on the backend and `import.meta.env.VITE_API_BASE_URL` on the frontend.
- **Production Checklist**:
  1. Configure HTTPS on backend API domain.
  2. Set a 64+ byte random string for `JWT_SECRET`.
  3. Restrict `CLIENT_ORIGIN` to the production frontend domain.
  4. Ensure MySQL server operates behind secure firewall rules.
