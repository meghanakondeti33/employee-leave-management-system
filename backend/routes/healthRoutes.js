const express = require('express');
const { getHealthStatus, getDbHealthStatus } = require('../controllers/healthController');

const router = express.Router();

// Basic health check route: GET /api/health
router.get('/', getHealthStatus);

// Database connectivity check route: GET /api/health/db
router.get('/db', getDbHealthStatus);

module.exports = router;
