const { checkDbHealth } = require('../services/healthService');

/**
 * Controller for basic API health check
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Employee Leave Management API is running',
  });
};

/**
 * Controller for database connectivity health check
 */
const getDbHealthStatus = async (req, res, next) => {
  try {
    const dbStatus = await checkDbHealth();
    if (dbStatus.connected) {
      return res.status(200).json({
        status: 'ok',
        database: dbStatus,
      });
    }
    return res.status(503).json({
      status: 'error',
      database: dbStatus,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealthStatus,
  getDbHealthStatus,
};
