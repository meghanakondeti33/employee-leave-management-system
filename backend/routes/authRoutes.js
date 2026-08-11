const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Public Authentication Routes
router.post('/register', register);
router.post('/login', login);

// Protected Route (Requires Valid JWT)
router.get('/me', authenticate, getMe);

// Admin-Only Route for RBAC Middleware Verification
router.get('/test-admin', authenticate, authorize('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Access granted to admin-only resource',
  });
});

module.exports = router;
