const { pool } = require('../config/db');

/**
 * Overview metrics report
 */
const getOverviewReport = async ({ role, managerEmpId }) => {
  if (role === 'admin') {
    const [empCount] = await pool.query('SELECT COUNT(*) AS total FROM employees');
    const [deptCount] = await pool.query('SELECT COUNT(*) AS total FROM departments');
    const [reqCounts] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected
      FROM leave_requests
    `);
    const [balTotals] = await pool.query(`
      SELECT 
        COALESCE(SUM(used_days), 0) AS totalUsed,
        COALESCE(SUM(remaining_days), 0) AS totalRemaining
      FROM leave_balances
    `);

    return {
      totalEmployees: empCount[0].total,
      totalDepartments: deptCount[0].total,
      pendingLeaveRequests: parseInt(reqCounts[0].pending, 10),
      approvedLeaveRequests: parseInt(reqCounts[0].approved, 10),
      rejectedLeaveRequests: parseInt(reqCounts[0].rejected, 10),
      totalLeaveDaysUsed: parseFloat(balTotals[0].totalUsed),
      totalLeaveDaysRemaining: parseFloat(balTotals[0].totalRemaining),
    };
  } else if (role === 'manager') {
    const [empCount] = await pool.query('SELECT COUNT(*) AS total FROM employees WHERE manager_id = ?', [managerEmpId]);
    const [reqCounts] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
        COALESCE(SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.manager_id = ?
    `, [managerEmpId]);
    const [balTotals] = await pool.query(`
      SELECT 
        COALESCE(SUM(lb.used_days), 0) AS totalUsed,
        COALESCE(SUM(lb.remaining_days), 0) AS totalRemaining
      FROM leave_balances lb
      JOIN employees e ON lb.employee_id = e.id
      WHERE e.manager_id = ?
    `, [managerEmpId]);

    return {
      totalEmployees: empCount[0].total,
      pendingLeaveRequests: parseInt(reqCounts[0].pending, 10),
      approvedLeaveRequests: parseInt(reqCounts[0].approved, 10),
      rejectedLeaveRequests: parseInt(reqCounts[0].rejected, 10),
      totalLeaveDaysUsed: parseFloat(balTotals[0].totalUsed),
      totalLeaveDaysRemaining: parseFloat(balTotals[0].totalRemaining),
    };
  }
};

/**
 * Leave summary grouped by status
 */
const getLeaveSummaryReport = async ({ role, managerEmpId, year }) => {
  const whereClauses = [];
  const params = [];

  if (role === 'manager') {
    whereClauses.push('e.manager_id = ?');
    params.push(managerEmpId);
  }

  if (year) {
    whereClauses.push('YEAR(lr.start_date) = ?');
    params.push(year);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const query = `
    SELECT 
      COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
      COALESCE(SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected,
      COALESCE(SUM(CASE WHEN lr.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.id
    ${whereSQL}
  `;

  const [rows] = await pool.query(query, params);
  const result = rows[0];

  return {
    pending: parseInt(result.pending, 10),
    approved: parseInt(result.approved, 10),
    rejected: parseInt(result.rejected, 10),
    cancelled: parseInt(result.cancelled, 10),
  };
};

/**
 * Department leave summary statistics
 */
const getDepartmentSummaryReport = async ({ role, managerEmpId }) => {
  if (role === 'admin') {
    const query = `
      SELECT 
        d.id AS departmentId,
        d.name AS departmentName,
        COUNT(DISTINCT e.id) AS employeeCount,
        COUNT(lr.id) AS leaveRequests,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days ELSE 0 END), 0) AS approvedLeaveDays
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
      GROUP BY d.id, d.name
      ORDER BY d.id ASC
    `;
    const [rows] = await pool.query(query);
    return rows.map((r) => ({
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      employeeCount: parseInt(r.employeeCount, 10),
      leaveRequests: parseInt(r.leaveRequests, 10),
      approvedLeaveDays: parseFloat(r.approvedLeaveDays),
    }));
  } else if (role === 'manager') {
    const query = `
      SELECT 
        d.id AS departmentId,
        d.name AS departmentName,
        COUNT(DISTINCT e.id) AS employeeCount,
        COUNT(lr.id) AS leaveRequests,
        COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days ELSE 0 END), 0) AS approvedLeaveDays
      FROM departments d
      JOIN employees e ON e.department_id = d.id AND e.manager_id = ?
      LEFT JOIN leave_requests lr ON lr.employee_id = e.id
      GROUP BY d.id, d.name
      ORDER BY d.id ASC
    `;
    const [rows] = await pool.query(query, [managerEmpId]);
    return rows.map((r) => ({
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      employeeCount: parseInt(r.employeeCount, 10),
      leaveRequests: parseInt(r.leaveRequests, 10),
      approvedLeaveDays: parseFloat(r.approvedLeaveDays),
    }));
  }
};

/**
 * Monthly consumed leave trends for approved requests
 */
const getLeaveTrendsReport = async ({ role, managerEmpId, year }) => {
  const whereClauses = ["lr.status = 'approved'"];
  const params = [];

  if (role === 'manager') {
    whereClauses.push('e.manager_id = ?');
    params.push(managerEmpId);
  }

  if (year) {
    whereClauses.push('YEAR(lr.start_date) = ?');
    params.push(year);
  }

  const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

  const query = `
    SELECT 
      DATE_FORMAT(lr.start_date, '%Y-%m') AS month,
      COALESCE(SUM(lr.days), 0) AS leaveDays
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.id
    ${whereSQL}
    GROUP BY DATE_FORMAT(lr.start_date, '%Y-%m')
    ORDER BY month ASC
  `;

  const [rows] = await pool.query(query, params);
  return rows.map((r) => ({
    month: r.month,
    leaveDays: parseFloat(r.leaveDays),
  }));
};

module.exports = {
  getOverviewReport,
  getLeaveSummaryReport,
  getDepartmentSummaryReport,
  getLeaveTrendsReport,
};
