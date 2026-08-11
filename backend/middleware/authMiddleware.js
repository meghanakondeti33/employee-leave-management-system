const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT authentication token
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access token required. Please provide Authorization header in Bearer format.',
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token missing.',
    });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET configuration missing');
    }

    const decoded = jwt.verify(token, secret);
    
    // Attach decoded user information to req.user
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or malformed authentication token.',
    });
  }
};

module.exports = {
  authenticate,
};
