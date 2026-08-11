const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validateRegisterInput, validateLoginInput } = require('../validators/authValidator');
const { findUserByEmail, findUserById, createUser } = require('../services/authService');
const { createAuditLog } = require('../services/auditService');

const SALT_ROUNDS = 10;

/**
 * Controller for user registration
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    // Validate request input
    const validation = validateRegisterInput({ email, password, role });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' '),
      });
    }

    // Security check: Prevent public self-registration as admin
    // Admin accounts must be created through internal/administrative operations
    const assignedRole = role || 'employee';
    if (assignedRole === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Self-registration as admin is not permitted. Only employee and manager roles may be created.',
      });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user into database
    const newUser = await createUser({
      email,
      passwordHash,
      role: assignedRole,
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for user login
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate request input
    const validation = validateLoginInput({ email, password });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors.join(' '),
      });
    }

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      // Use generic error message to prevent email enumeration
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Verify password hash
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      // Record failed login audit attempt for known user
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        description: 'Failed login attempt for user account',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token with non-sensitive claims
    const payload = {
      userId: user.id,
      role: user.role,
    };

    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    if (!secret) {
      throw new Error('JWT_SECRET configuration missing');
    }

    const token = jwt.sign(payload, secret, { expiresIn });

    // Record successful login audit log
    await createAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: user.id,
      description: 'User logged in successfully',
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to fetch current authenticated user
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
};
