// Authentication middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require valid JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'goldenfish_jwt_secret_2025');
      
      // Get user from database
      const user = await User.findById(decoded.id || decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.'
        });
      }

      // Check if user is still active
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Account is not active.'
        });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format.'
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Token verification failed.'
        });
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Admin only routes
const admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isAdmin()) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

// Optional auth - don't fail if no token, but populate user if present
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'goldenfish_jwt_secret_2025');
        const user = await User.findById(decoded.id || decoded.userId);
        
        if (user && user.status === 'active') {
          req.user = user;
        }
      } catch (jwtError) {
        // Ignore invalid tokens in optional auth
        console.warn('Optional auth token invalid:', jwtError.message);
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without auth
  }
};

// Generate JWT token
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    type: 'user'
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'goldenfish_jwt_secret_2025',
    { expiresIn: '30d' }
  );
};

// Verify token (for token validation endpoint)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'goldenfish_jwt_secret_2025');
  } catch (error) {
    throw error;
  }
};

module.exports = {
  protect,
  admin,
  optionalAuth,
  generateToken,
  verifyToken
};