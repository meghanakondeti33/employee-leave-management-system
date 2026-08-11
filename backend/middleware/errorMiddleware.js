/**
 * Centralized error handling middleware
 * Hides stack traces from API response for security
 */
const errorMiddleware = (err, req, res, next) => {
  // Log error internally for debugging
  console.error('[Error]:', err.message || err);

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorMiddleware;
