const express = require('express');
const {
  createLeaveRequest,
  getMyLeaveRequests,
  getLeaveRequestById,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
} = require('../controllers/leaveController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// All leave endpoints require authentication
router.use(authenticate);

// Submit leave request
router.post('/', createLeaveRequest);

// View own leave requests (supports ?status=pending|approved|rejected|cancelled)
router.get('/my', getMyLeaveRequests);

// View individual leave request by ID
router.get('/:id', getLeaveRequestById);

// Cancel pending leave request
router.delete('/:id', cancelLeaveRequest);

// Manager / Admin approval and rejection endpoints
router.put('/:id/approve', authorize('manager', 'admin'), approveLeaveRequest);
router.put('/:id/reject', authorize('manager', 'admin'), rejectLeaveRequest);

module.exports = router;
