const express = require('express');
const { getAuditLogs } = require('../controllers/auditController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Admin-only audit log retrieval route
router.get('/', authenticate, authorize('admin'), getAuditLogs);

module.exports = router;
