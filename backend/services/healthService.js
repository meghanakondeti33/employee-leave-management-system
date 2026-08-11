const { testConnection } = require('../config/db');

/**
 * Service to check database connection status
 */
const checkDbHealth = async () => {
  try {
    await testConnection();
    return { connected: true, message: 'Database connection successful' };
  } catch (error) {
    return { connected: false, error: error.message, code: error.code };
  }
};

module.exports = {
  checkDbHealth,
};
