const { fetchAuditLogs } = require('../services/auditService');

/**
 * GET /api/audit-logs
 * Admin only endpoint for retrieving paginated audit logs with optional filters
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, userId, entityType, page, limit } = req.query;

    const result = await fetchAuditLogs({
      action,
      userId,
      entityType,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
};
