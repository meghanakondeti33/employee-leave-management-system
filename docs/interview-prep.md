# Technical Interview Preparation Guide

This guide provides technical interview questions and concise, authoritative answers based directly on the actual implementation of the **Employee Leave & Workforce Management System**.

---

## 1. Architecture & Design

### Q1: Why did you choose React for the frontend and Node.js + Express for the backend?
**Answer**:
- **Separation of Concerns & Decoupled Scaling**: Building a RESTful API on Express allows the backend services to be consumed by any client interface (React, mobile apps, CLI) without altering business logic.
- **Asynchronous Non-Blocking I/O**: Node.js handles concurrent REST API requests efficiently using single-threaded event-driven non-blocking I/O, ideal for standard CRUD operations and aggregation queries.
- **Component-Driven Declarative UI**: React's virtual DOM and state management allow role-specific dashboards, modal forms, and dynamic data tables to re-render efficiently without full page refreshes.

### Q2: How is the backend architecture structured?
**Answer**:
The backend follows a strict 4-layer unidirectional architecture:
$$\text{Routes} \longrightarrow \text{Controllers} \longrightarrow \text{Services} \longrightarrow \text{MySQL Database (Pool)}$$
- **Routes**: Define HTTP endpoints, attach URL validation rules, and apply authentication/authorization middleware (`authenticate`, `authorize`).
- **Controllers**: Handle HTTP request extraction, invoke service functions, and construct standardized JSON responses.
- **Services**: Execute domain business logic (e.g. balance deduction, overlap checks, transaction boundary control, audit logging).
- **Config / Database**: Manage the connection pool (`mysql2/promise`) and environment configurations.

---

## 2. Authentication & Authorization

### Q3: How does the JWT authentication flow work in your system?
**Answer**:
1. User submits email and password to `POST /api/auth/login`.
2. Controller calls `authService.loginUser`, which queries `users` by email and compares the plaintext password against `password_hash` using `bcrypt.compare`.
3. Upon success, a JWT signed with `JWT_SECRET` containing payload `{ userId, role }` and an expiration (e.g., `1h`) is issued to the client.
4. The client stores the token in `localStorage` and attaches it as `Authorization: Bearer <token>` on subsequent requests.
5. The `authenticate` middleware extracts and verifies the token using `jwt.verify`. If valid, it attaches `{ userId, role }` to `req.user`; otherwise, it returns `401 Unauthorized`.

### Q4: Where is Role-Based Access Control (RBAC) enforced, and why not rely on the frontend?
**Answer**:
Authorization is strictly enforced on the **backend** using the `authorize(...allowedRoles)` middleware factory. Frontend role checks (such as conditionally hiding sidebar links in `AppLayout.jsx` or guarding routes in `ProtectedRoute.jsx`) are strictly for User Experience (UX). Since any client can inspect or forge frontend state or call APIs directly using tools like Postman, backend authorization checks before service execution are non-negotiable.

---

## 3. Database & Concurrency

### Q5: Why did you choose MySQL over MongoDB for this system?
**Answer**:
- **Relational Integrity & Schema Enforcement**: Leave management requires strict data integrity, foreign key constraints (e.g., an employee must belong to a valid department, leave balances must map to valid employees and policies), and schema consistency.
- **ACID Transactions**: Leave approvals require multi-table atomic updates (updating leave request status, deducting balance remaining days, and inserting an audit log). Relational ACID transactions ensure either all operations commit or none do.

### Q6: How do you prevent double approvals or race conditions under concurrent requests?
**Answer**:
We utilize **Pessimistic Row Locking** (`SELECT ... FOR UPDATE`) within an explicit database transaction:
```sql
SELECT * FROM leave_requests WHERE id = ? FOR UPDATE;
```
When a manager approves a leave request:
1. A dedicated connection is checked out from `pool.getConnection()`.
2. `connection.beginTransaction()` is called.
3. The leave request row is queried with `FOR UPDATE`, locking that specific row until transaction completion.
4. If another concurrent request attempts to approve the same request, it blocks until the lock is released, sees the status is no longer `pending`, and receives a `400 Bad Request` rejection.
5. Balance deduction and audit logging occur atomically, followed by `connection.commit()`.

### Q7: How do you prevent overlapping leave requests?
**Answer**:
Overlapping leave requests are validated in `leaveService.js` before insertion using the standard interval overlap formula:
$$\text{ExistingStart} \le \text{NewEnd} \quad \text{AND} \quad \text{ExistingEnd} \ge \text{NewStart}$$
```sql
SELECT id FROM leave_requests 
WHERE employee_id = ? 
  AND status IN ('pending', 'approved') 
  AND start_date <= ? 
  AND end_date >= ?
```
If any matching active request exists, a `409 Conflict` response is immediately returned.

---

## 4. Security & Quality Assurance

### Q8: How do you protect the backend against SQL Injection attacks?
**Answer**:
All SQL queries in the service layer use **Parameterized Queries** (`?` placeholders) managed by `mysql2/promise`. User input is never concatenated directly into SQL strings. Malicious inputs such as `' OR '1'='1` or `'; DROP TABLE users; --` are safely escaped by the database driver as literal string parameters.

### Q9: How are sensitive fields and internal errors handled?
**Answer**:
- **Password Security**: Passwords are hashed using `bcrypt` (10 rounds). User objects returned in API responses explicitly omit `password` and `password_hash`.
- **Error Response Sanitization**: A centralized `errorMiddleware` catches all uncaught exceptions. Internal stack traces, raw SQL queries, and environment details are logged server-side but stripped from the JSON response returned to the client.

---

## 5. Engineering Challenges & Trade-offs

### Q10: What was the biggest technical challenge during development?
**Answer**:
Managing transactional balance deductions safely alongside role-scoped managerial authorization. Ensuring that managers could only act on leave requests belonging to employees within their direct team required joining `employees`, `users`, and `departments` within pessimistic row-locked transaction blocks while maintaining clean separation between controllers and services.
