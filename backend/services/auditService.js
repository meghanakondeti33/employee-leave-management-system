const { pool } = require('../config/db');

/**
 * Create a new audit log entry
 * @param {Object} auditData 
 * @param {number} auditData.userId - User ID performing or target of the action
 * @param {string} auditData.action - Action name (e.g. LOGIN_SUCCESS, EMPLOYEE_CREATED, LEAVE_APPROVED)
 * @param {string} auditData.entityType - Entity category (e.g. user, employee, leave_request)
 * @param {number|null} [auditData.entityId] - ID of affected entity
 * @param {string|null} [auditData.description] - Human-readable description (no secrets)
 * @param {Object|null} [connection] - Optional MySQL transaction connection
 */
const createAuditLog = async (
  { userId, action, entityType, entityId = null, description = null },
  connection = null
) => {
  const query = `
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description)
    VALUES (?, ?, ?, ?, ?)
  `;
  const params = [userId, action, entityType, entityId, description];

  if (connection) {
    await connection.query(query, params);
  } else {
    await pool.query(query, params);
  }
};

/**
 * Fetch paginated audit logs with optional filter parameters (Admin view)
 */
const fetchAuditLogs = async ({ action, userId, entityType, page = 1, limit = 20 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const whereClauses = [];
  const queryParams = [];

  if (action) {
    whereClauses.push('action = ?');
    queryParams.push(action.trim());
  }

  if (userId) {
    whereClauses.push('user_id = ?');
    queryParams.push(parseInt(userId, 10));
  }

  if (entityType) {
    whereClauses.push('entity_type = ?');
    queryParams.push(entityType.trim());
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 1. Total count query
  const countQuery = `SELECT COUNT(*) AS total FROM audit_logs ${whereSQL}`;
  const [countRows] = await pool.query(countQuery, queryParams);
  const total = countRows[0].total;
  const totalPages = Math.ceil(total / limitNum) || 1;

  // 2. Paginated data query
  const dataQuery = `
    SELECT 
      id,
      user_id AS userId,
      action,
      entity_type AS entityType,
      entity_id AS entityId,
      description,
      DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
    FROM audit_logs
    ${whereSQL}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  const dataParams = [...queryParams, limitNum, offset];
  const [rows] = await pool.query(dataQuery, dataParams);

  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    },
  };
};

module.exports = {
  createAuditLog,
  fetchAuditLogs,
};
