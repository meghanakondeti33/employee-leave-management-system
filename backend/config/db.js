const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Create reusable MySQL connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'employee_leave_management',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Verify database connectivity
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    if (error.code === 'ER_BAD_DB_ERROR') {
      try {
        const rootConn = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          port: parseInt(process.env.DB_PORT, 10) || 3306,
        });
        const dbName = process.env.DB_NAME || 'employee_leave_management';
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await rootConn.end();

        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return true;
      } catch (createErr) {
        throw error;
      }
    }
    throw error;
  }
};

module.exports = {
  pool,
  testConnection,
};
