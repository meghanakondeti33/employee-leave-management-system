/**
 * Validation rules for authentication requests
 */

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email.trim());
};

const ALLOWED_ROLES = ['employee', 'manager', 'admin'];

/**
 * Validate registration request body
 */
const validateRegisterInput = ({ email, password, role }) => {
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required.');
  } else if (!isValidEmail(email)) {
    errors.push('Invalid email format.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (role !== undefined && role !== null && role !== '') {
    if (!ALLOWED_ROLES.includes(role)) {
      errors.push(`Invalid role. Allowed roles are: ${ALLOWED_ROLES.join(', ')}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate login request body
 */
const validateLoginInput = ({ email, password }) => {
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required.');
  } else if (!isValidEmail(email)) {
    errors.push('Invalid email format.');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  isValidEmail,
  ALLOWED_ROLES,
  validateRegisterInput,
  validateLoginInput,
};
