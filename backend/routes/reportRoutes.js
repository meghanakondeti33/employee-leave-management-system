const express = require('express');
const {
  getOverview,
  getLeaveSummary,
  getDepartmentSummary,
  getLeaveTrends,
} = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// All reporting routes require authentication and manager/admin authorization
router.use(authenticate);
router.use(authorize('manager', 'admin'));

router.get('/overview', getOverview);
router.get('/leave-summary', getLeaveSummary);
router.get('/department-summary', getDepartmentSummary);
router.get('/leave-trends', getLeaveTrends);

module.exports = router;
