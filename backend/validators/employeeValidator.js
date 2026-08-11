const { isValidEmail, ALLOWED_ROLES } = require('./authValidator');

const isValidDate = (dateString) => {
  if (typeof dateString !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const d = new Date(dateString);
  return d instanceof Date && !isNaN(d.getTime());
};

const validateCreateEmployeeInput = ({
  email,
  password,
  role,
  firstName,
  lastName,
  employeeCode,
  departmentId,
  managerId,
  joiningDate,
}) => {
  const errors = [];

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters long.');
  }

  if (role !== undefined && role !== null && role !== '' && !ALLOWED_ROLES.includes(role)) {
    errors.push(`Invalid role. Allowed roles are: ${ALLOWED_ROLES.join(', ')}.`);
  }

  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    errors.push('First name is required.');
  }

  if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
    errors.push('Last name is required.');
  }

  if (!employeeCode || typeof employeeCode !== 'string' || !employeeCode.trim()) {
    errors.push('Employee code is required.');
  }

  if (!departmentId || isNaN(parseInt(departmentId, 10)) || parseInt(departmentId, 10) <= 0) {
    errors.push('A valid department ID is required.');
  }

  if (managerId !== undefined && managerId !== null && managerId !== '') {
    if (isNaN(parseInt(managerId, 10)) || parseInt(managerId, 10) <= 0) {
      errors.push('Manager ID must be a positive integer.');
    }
  }

  if (!joiningDate || !isValidDate(joiningDate)) {
    errors.push('A valid joining date in YYYY-MM-DD format is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const validateUpdateEmployeeInput = ({
  firstName,
  lastName,
  departmentId,
  managerId,
  joiningDate,
  email,
  role,
}) => {
  const errors = [];

  if (firstName !== undefined && (!firstName || typeof firstName !== 'string' || !firstName.trim())) {
    errors.push('First name cannot be empty.');
  }

  if (lastName !== undefined && (!lastName || typeof lastName !== 'string' || !lastName.trim())) {
    errors.push('Last name cannot be empty.');
  }

  if (departmentId !== undefined && (isNaN(parseInt(departmentId, 10)) || parseInt(departmentId, 10) <= 0)) {
    errors.push('Department ID must be a valid positive integer.');
  }

  if (managerId !== undefined && managerId !== null && managerId !== '') {
    if (isNaN(parseInt(managerId, 10)) || parseInt(managerId, 10) <= 0) {
      errors.push('Manager ID must be a valid positive integer.');
    }
  }

  if (joiningDate !== undefined && !isValidDate(joiningDate)) {
    errors.push('Joining date must be a valid date in YYYY-MM-DD format.');
  }

  if (email !== undefined && !isValidEmail(email)) {
    errors.push('Provided email address is invalid.');
  }

  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    errors.push(`Invalid role. Allowed roles are: ${ALLOWED_ROLES.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateCreateEmployeeInput,
  validateUpdateEmployeeInput,
};
