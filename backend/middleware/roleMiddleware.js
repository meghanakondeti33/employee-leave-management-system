/**
 * Reusable authorization middleware factory for role-based access control (RBAC)
 * @param {...string} allowedRoles - List of roles permitted to access the route
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    next();
  };
};

module.exports = {
  authorize,
};
