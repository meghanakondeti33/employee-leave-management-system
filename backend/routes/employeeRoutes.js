const express = require('express');
const {
  getMe,
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');

const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Apply authentication middleware to all employee routes
router.use(authenticate);

// Current employee profile endpoint
router.get('/me', getMe);

// Employee collection endpoint (Role-dependent logic inside controller)
router.get('/', getEmployees);

// Specific employee endpoint (Role/ownership-dependent logic inside controller)
router.get('/:id', getEmployeeById);

// Admin-only endpoints
router.post('/', authorize('admin'), createEmployee);
router.put('/:id', authorize('admin'), updateEmployee);
router.delete('/:id', authorize('admin'), deleteEmployee);

module.exports = router;
