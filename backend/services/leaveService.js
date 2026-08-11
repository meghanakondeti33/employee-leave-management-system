const { pool } = require('../config/db');
const { createAuditLog } = require('./auditService');

const SELECT_LEAVE_BASE = `
  SELECT 
    lr.id,
    lr.employee_id,
    lr.leave_policy_id,
    lp.name AS leave_policy_name,
    DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
    DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
    lr.days,
    lr.reason,
    lr.status,
    lr.approved_by,
    lr.approved_at,
    lr.rejection_reason,
    lr.created_at,
    lr.updated_at
  FROM leave_requests lr
  JOIN leave_policies lp ON lr.leave_policy_id = lp.id
`;

/**
 * Check if leave policy exists
 * @param {number} policyId 
 */
const checkPolicyExists = async (policyId) => {
  const [rows] = await pool.query('SELECT id, name, annual_limit FROM leave_policies WHERE id = ?', [policyId]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Verify if employee has sufficient remaining leave balance for the specified year
 */
const checkLeaveBalance = async (employeeId, policyId, year, requestedDays) => {
  const [rows] = await pool.query(
    'SELECT id, allocated_days, used_days, remaining_days FROM leave_balances WHERE employee_id = ? AND leave_policy_id = ? AND year = ?',
    [employeeId, policyId, year]
  );

  if (rows.length === 0) {
    return { exists: false, hasBalance: false, remainingDays: 0 };
  }

  const balanceRecord = rows[0];
  const remainingDays = parseFloat(balanceRecord.remaining_days);
  const hasBalance = remainingDays >= requestedDays;

  return {
    exists: true,
    hasBalance,
    remainingDays,
    balanceRecord,
  };
};

/**
 * Check for overlapping active (pending or approved) leave requests
 */
const checkOverlappingLeaves = async (employeeId, startDate, endDate, excludeRequestId = null) => {
  let query = `
    SELECT id, start_date, end_date, status 
    FROM leave_requests 
    WHERE employee_id = ? 
      AND status IN ('pending', 'approved') 
      AND start_date <= ? 
      AND end_date >= ?
  `;
  const params = [employeeId, endDate, startDate];

  if (excludeRequestId) {
    query += ' AND id != ?';
    params.push(excludeRequestId);
  }

  const [rows] = await pool.query(query, params);
  return rows.length > 0;
};

/**
 * Insert new leave request with status 'pending' and log LEAVE_REQUESTED
 */
const createLeaveRequest = async ({ employeeId, leavePolicyId, startDate, endDate, days, reason, actingUserId = null }) => {
  const query = `
    INSERT INTO leave_requests (employee_id, leave_policy_id, start_date, end_date, days, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `;
  const [result] = await pool.query(query, [employeeId, leavePolicyId, startDate, endDate, days, reason.trim()]);
  const newId = result.insertId;

  if (actingUserId) {
    await createAuditLog({
      userId: actingUserId,
      action: 'LEAVE_REQUESTED',
      entityType: 'leave_request',
      entityId: newId,
      description: 'Submitted leave request',
    });
  }

  return await findLeaveRequestById(newId);
};

/**
 * Fetch all leave requests belonging to a specific employee with optional status filter
 */
const findEmployeeLeaveRequests = async (employeeId, statusFilter = null) => {
  let query = `${SELECT_LEAVE_BASE} WHERE lr.employee_id = ?`;
  const params = [employeeId];

  if (statusFilter) {
    query += ' AND lr.status = ?';
    params.push(statusFilter);
  }

  query += ' ORDER BY lr.created_at DESC';

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Fetch single leave request by ID
 */
const findLeaveRequestById = async (requestId) => {
  const query = `${SELECT_LEAVE_BASE} WHERE lr.id = ?`;
  const [rows] = await pool.query(query, [requestId]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Update leave request status (e.g. 'cancelled')
 */
const updateLeaveRequestStatus = async (requestId, status) => {
  await pool.query('UPDATE leave_requests SET status = ? WHERE id = ?', [status, requestId]);
  return await findLeaveRequestById(requestId);
};

/**
 * Approve leave request inside a transaction with pessimistic row locking and audit logging
 */
const approveLeaveRequestTransaction = async ({ requestId, actingUserId, actingRole }) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and fetch leave request row
    const [reqRows] = await connection.query(
      `SELECT id, employee_id, leave_policy_id, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, end_date, days, status 
       FROM leave_requests 
       WHERE id = ? FOR UPDATE`,
      [requestId]
    );

    if (reqRows.length === 0) {
      await connection.rollback();
      const err = new Error('Leave request not found.');
      err.statusCode = 404;
      throw err;
    }

    const request = reqRows[0];

    // 2. State transition check: Request must be pending
    if (request.status !== 'pending') {
      await connection.rollback();
      const err = new Error(`Only pending leave requests can be approved. Current status is '${request.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Find acting employee (decision maker)
    const [actingEmpRows] = await connection.query('SELECT id FROM employees WHERE user_id = ?', [actingUserId]);
    if (actingEmpRows.length === 0) {
      await connection.rollback();
      const err = new Error('Acting user employee profile not found.');
      err.statusCode = 404;
      throw err;
    }
    const actingEmpId = actingEmpRows[0].id;

    // 4. Team authorization check for Manager role
    if (actingRole === 'manager') {
      const [targetEmpRows] = await connection.query('SELECT manager_id FROM employees WHERE id = ?', [request.employee_id]);
      if (targetEmpRows.length === 0 || targetEmpRows[0].manager_id !== actingEmpId) {
        await connection.rollback();
        const err = new Error('Forbidden: Managers can only approve leave requests for employees in their team.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 5. Lock and check leave balance row for current request year
    const requestYear = new Date(request.start_date).getFullYear();
    const [balRows] = await connection.query(
      `SELECT id, allocated_days, used_days, remaining_days 
       FROM leave_balances 
       WHERE employee_id = ? AND leave_policy_id = ? AND year = ? FOR UPDATE`,
      [request.employee_id, request.leave_policy_id, requestYear]
    );

    if (balRows.length === 0) {
      await connection.rollback();
      const err = new Error(`Leave balance record not found for the employee for year ${requestYear}.`);
      err.statusCode = 400;
      throw err;
    }

    const balance = balRows[0];
    const requestedDays = parseFloat(request.days);
    const remainingDays = parseFloat(balance.remaining_days);

    // 6. Re-verify available balance under row lock
    if (remainingDays < requestedDays) {
      await connection.rollback();
      const err = new Error('Insufficient leave balance');
      err.statusCode = 400;
      throw err;
    }

    // 7. Calculate new balance values
    const newUsedDays = parseFloat(balance.used_days) + requestedDays;
    const newRemainingDays = remainingDays - requestedDays;

    // 8. Update leave balance
    await connection.query(
      'UPDATE leave_balances SET used_days = ?, remaining_days = ? WHERE id = ?',
      [newUsedDays, newRemainingDays, balance.id]
    );

    // 9. Update leave request status to approved
    await connection.query(
      'UPDATE leave_requests SET status = \'approved\', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [actingEmpId, requestId]
    );

    // 10. Audit Log inside transaction
    await createAuditLog(
      {
        userId: actingUserId,
        action: 'LEAVE_APPROVED',
        entityType: 'leave_request',
        entityId: requestId,
        description: 'Approved leave request',
      },
      connection
    );

    await connection.commit();
    connection.release();

    const [updatedRows] = await pool.query(
      `SELECT id, status, approved_by AS approvedBy, DATE_FORMAT(approved_at, '%Y-%m-%dT%H:%i:%s.000Z') AS approvedAt 
       FROM leave_requests WHERE id = ?`,
      [requestId]
    );

    return updatedRows[0];
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
      connection.release();
    }
    throw error;
  }
};

/**
 * Reject leave request inside a transaction without modifying leave balance
 */
const rejectLeaveRequestTransaction = async ({ requestId, rejectionReason, actingUserId, actingRole }) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and fetch leave request row
    const [reqRows] = await connection.query(
      `SELECT id, employee_id, status 
       FROM leave_requests 
       WHERE id = ? FOR UPDATE`,
      [requestId]
    );

    if (reqRows.length === 0) {
      await connection.rollback();
      const err = new Error('Leave request not found.');
      err.statusCode = 404;
      throw err;
    }

    const request = reqRows[0];

    // 2. State transition check: Request must be pending
    if (request.status !== 'pending') {
      await connection.rollback();
      const err = new Error(`Only pending leave requests can be rejected. Current status is '${request.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Find acting employee (decision maker)
    const [actingEmpRows] = await connection.query('SELECT id FROM employees WHERE user_id = ?', [actingUserId]);
    if (actingEmpRows.length === 0) {
      await connection.rollback();
      const err = new Error('Acting user employee profile not found.');
      err.statusCode = 404;
      throw err;
    }
    const actingEmpId = actingEmpRows[0].id;

    // 4. Team authorization check for Manager role
    if (actingRole === 'manager') {
      const [targetEmpRows] = await connection.query('SELECT manager_id FROM employees WHERE id = ?', [request.employee_id]);
      if (targetEmpRows.length === 0 || targetEmpRows[0].manager_id !== actingEmpId) {
        await connection.rollback();
        const err = new Error('Forbidden: Managers can only reject leave requests for employees in their team.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 5. Update leave request status to rejected with reason (Leave balance is UNCHANGED)
    await connection.query(
      `UPDATE leave_requests 
       SET status = 'rejected', rejection_reason = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [rejectionReason.trim(), actingEmpId, requestId]
    );

    // 6. Audit Log inside transaction
    await createAuditLog(
      {
        userId: actingUserId,
        action: 'LEAVE_REJECTED',
        entityType: 'leave_request',
        entityId: requestId,
        description: 'Rejected leave request',
      },
      connection
    );

    await connection.commit();
    connection.release();

    const [updatedRows] = await pool.query(
      `SELECT id, status, rejection_reason AS rejectionReason, approved_by AS approvedBy, DATE_FORMAT(approved_at, '%Y-%m-%dT%H:%i:%s.000Z') AS approvedAt 
       FROM leave_requests WHERE id = ?`,
      [requestId]
    );

    return updatedRows[0];
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) {}
      connection.release();
    }
    throw error;
  }
};

module.exports = {
  checkPolicyExists,
  checkLeaveBalance,
  checkOverlappingLeaves,
  createLeaveRequest,
  findEmployeeLeaveRequests,
  findLeaveRequestById,
  updateLeaveRequestStatus,
  approveLeaveRequestTransaction,
  rejectLeaveRequestTransaction,
};
