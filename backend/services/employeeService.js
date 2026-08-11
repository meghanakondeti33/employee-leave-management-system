const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { createAuditLog } = require('./auditService');

const SALT_ROUNDS = 10;

const SELECT_EMPLOYEE_BASE = `
  SELECT 
    e.id,
    e.user_id,
    e.first_name,
    e.last_name,
    e.employee_code,
    DATE_FORMAT(e.joining_date, '%Y-%m-%d') AS joining_date,
    e.created_at,
    e.updated_at,
    u.email,
    u.role,
    d.id AS department_id,
    d.name AS department_name,
    e.manager_id,
    CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
    mu.email AS manager_email
  FROM employees e
  JOIN users u ON e.user_id = u.id
  JOIN departments d ON e.department_id = d.id
  LEFT JOIN employees m ON e.manager_id = m.id
  LEFT JOIN users mu ON m.user_id = mu.id
`;

/**
 * Find employee record by User ID
 * @param {number} userId 
 */
const findEmployeeByUserId = async (userId) => {
  const query = `${SELECT_EMPLOYEE_BASE} WHERE e.user_id = ?`;
  const [rows] = await pool.query(query, [userId]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Find employee record by Employee Primary Key ID
 * @param {number} employeeId 
 */
const findEmployeeById = async (employeeId) => {
  const query = `${SELECT_EMPLOYEE_BASE} WHERE e.id = ?`;
  const [rows] = await pool.query(query, [employeeId]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Find all employee records (Admin view)
 */
const findAllEmployees = async () => {
  const query = `${SELECT_EMPLOYEE_BASE} ORDER BY e.id ASC`;
  const [rows] = await pool.query(query);
  return rows;
};

/**
 * Find employees managed by a specific Manager (Manager team view)
 * @param {number} managerEmployeeId 
 */
const findEmployeesByManagerId = async (managerEmployeeId) => {
  const query = `${SELECT_EMPLOYEE_BASE} WHERE e.manager_id = ? ORDER BY e.id ASC`;
  const [rows] = await pool.query(query, [managerEmployeeId]);
  return rows;
};

/**
 * Check if department exists
 * @param {number} departmentId 
 */
const checkDepartmentExists = async (departmentId) => {
  const [rows] = await pool.query('SELECT id FROM departments WHERE id = ?', [departmentId]);
  return rows.length > 0;
};

/**
 * Check if email or employee code already exists
 * @param {string} email 
 * @param {string} employeeCode 
 * @param {number|null} excludeEmployeeId 
 */
const checkEmailOrCodeExists = async (email, employeeCode, excludeEmployeeId = null) => {
  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  const normalizedCode = employeeCode ? employeeCode.trim() : null;

  if (normalizedEmail) {
    let emailQuery = 'SELECT u.id FROM users u';
    const params = [normalizedEmail];

    if (excludeEmployeeId) {
      emailQuery += ' JOIN employees e ON e.user_id = u.id WHERE u.email = ? AND e.id != ?';
      params.push(excludeEmployeeId);
    } else {
      emailQuery += ' WHERE u.email = ?';
    }

    const [rows] = await pool.query(emailQuery, params);
    if (rows.length > 0) return { exists: true, field: 'email' };
  }

  if (normalizedCode) {
    let codeQuery = 'SELECT id FROM employees WHERE employee_code = ?';
    const params = [normalizedCode];

    if (excludeEmployeeId) {
      codeQuery += ' AND id != ?';
      params.push(excludeEmployeeId);
    }

    const [rows] = await pool.query(codeQuery, params);
    if (rows.length > 0) return { exists: true, field: 'employeeCode' };
  }

  return { exists: false };
};

/**
 * Create user and employee in a database transaction with audit logging
 */
const createEmployeeWithTransaction = async ({
  email,
  password,
  role = 'employee',
  firstName,
  lastName,
  employeeCode,
  departmentId,
  managerId,
  joiningDate,
  actingUserId,
}) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 2. Insert into users table
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email.trim().toLowerCase(), passwordHash, role]
    );
    const userId = userResult.insertId;

    // 3. Insert into employees table
    const [employeeResult] = await connection.query(
      `INSERT INTO employees 
        (user_id, department_id, manager_id, first_name, last_name, employee_code, joining_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        departmentId,
        managerId || null,
        firstName.trim(),
        lastName.trim(),
        employeeCode.trim(),
        joiningDate,
      ]
    );

    const newEmployeeId = employeeResult.insertId;

    // 4. Audit Log inside transaction
    if (actingUserId) {
      await createAuditLog(
        {
          userId: actingUserId,
          action: 'EMPLOYEE_CREATED',
          entityType: 'employee',
          entityId: newEmployeeId,
          description: `Created employee profile for ${firstName.trim()} ${lastName.trim()} (${employeeCode.trim()})`,
        },
        connection
      );
    }

    await connection.commit();
    connection.release();

    return await findEmployeeById(newEmployeeId);
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
};

/**
 * Update employee record with audit logging
 */
const updateEmployee = async (employeeId, updateData, actingUserId = null) => {
  const employee = await findEmployeeById(employeeId);
  if (!employee) return null;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Update user details if email or role provided
    if (updateData.email || updateData.role) {
      const userUpdates = [];
      const userParams = [];

      if (updateData.email) {
        userUpdates.push('email = ?');
        userParams.push(updateData.email.trim().toLowerCase());
      }
      if (updateData.role) {
        userUpdates.push('role = ?');
        userParams.push(updateData.role);
      }

      userParams.push(employee.user_id);

      await connection.query(
        `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`,
        userParams
      );
    }

    // Update employee profile fields
    const empUpdates = [];
    const empParams = [];

    if (updateData.firstName !== undefined) {
      empUpdates.push('first_name = ?');
      empParams.push(updateData.firstName.trim());
    }
    if (updateData.lastName !== undefined) {
      empUpdates.push('last_name = ?');
      empParams.push(updateData.lastName.trim());
    }
    if (updateData.departmentId !== undefined) {
      empUpdates.push('department_id = ?');
      empParams.push(updateData.departmentId);
    }
    if (updateData.managerId !== undefined) {
      empUpdates.push('manager_id = ?');
      empParams.push(updateData.managerId || null);
    }
    if (updateData.joiningDate !== undefined) {
      empUpdates.push('joining_date = ?');
      empParams.push(updateData.joiningDate);
    }

    if (empUpdates.length > 0) {
      empParams.push(employeeId);
      await connection.query(
        `UPDATE employees SET ${empUpdates.join(', ')} WHERE id = ?`,
        empParams
      );
    }

    // Audit Log inside transaction
    if (actingUserId) {
      await createAuditLog(
        {
          userId: actingUserId,
          action: 'EMPLOYEE_UPDATED',
          entityType: 'employee',
          entityId: employeeId,
          description: `Updated employee profile for ID ${employeeId}`,
        },
        connection
      );
    }

    await connection.commit();
    connection.release();

    return await findEmployeeById(employeeId);
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
};

/**
 * Delete employee and associated user record safely using transaction with audit logging
 */
const deleteEmployeeWithTransaction = async (employeeId, actingUserId = null) => {
  const employee = await findEmployeeById(employeeId);
  if (!employee) return false;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Unlink direct reports (SET manager_id = NULL) to avoid breaking hierarchy
    await connection.query(
      'UPDATE employees SET manager_id = NULL WHERE manager_id = ?',
      [employeeId]
    );

    // 2. Audit Log inside transaction before deleting records
    if (actingUserId) {
      await createAuditLog(
        {
          userId: actingUserId,
          action: 'EMPLOYEE_DELETED',
          entityType: 'employee',
          entityId: employeeId,
          description: `Deleted employee profile for ID ${employeeId}`,
        },
        connection
      );
    }

    // 3. Delete employee record
    await connection.query('DELETE FROM employees WHERE id = ?', [employeeId]);

    // 4. Delete linked user account
    await connection.query('DELETE FROM users WHERE id = ?', [employee.user_id]);

    await connection.commit();
    connection.release();
    return true;
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
};

module.exports = {
  findEmployeeByUserId,
  findEmployeeById,
  findAllEmployees,
  findEmployeesByManagerId,
  checkDepartmentExists,
  checkEmailOrCodeExists,
  createEmployeeWithTransaction,
  updateEmployee,
  deleteEmployeeWithTransaction,
};
