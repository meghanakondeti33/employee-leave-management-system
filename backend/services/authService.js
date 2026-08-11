const { pool } = require('../config/db');

/**
 * Service handling database operations for users
 */

/**
 * Find user record by email address
 * @param {string} email 
 * @returns {Promise<Object|null>}
 */
const findUserByEmail = async (email) => {
  const query = 'SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE email = ?';
  const [rows] = await pool.query(query, [email.trim().toLowerCase()]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Find user record by primary key ID (excluding password_hash by default)
 * @param {number} id 
 * @returns {Promise<Object|null>}
 */
const findUserById = async (id) => {
  const query = 'SELECT id, email, role, created_at, updated_at FROM users WHERE id = ?';
  const [rows] = await pool.query(query, [id]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Insert a new user into the database
 * @param {Object} userData 
 * @param {string} userData.email
 * @param {string} userData.passwordHash
 * @param {string} userData.role
 * @returns {Promise<Object>} Created user object (id, email, role)
 */
const createUser = async ({ email, passwordHash, role }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const query = 'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)';
  const [result] = await pool.query(query, [normalizedEmail, passwordHash, role]);

  return {
    id: result.insertId,
    email: normalizedEmail,
    role,
  };
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
};
