/**
 * Catch-all middleware for non-existent routes
 */
const notFoundMiddleware = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};

module.exports = notFoundMiddleware;
