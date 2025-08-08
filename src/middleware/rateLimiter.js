// Rate limiting middleware
const rateLimit = require('express-rate-limit');

// Standard rate limiter for API endpoints
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again in 15 minutes.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`🚫 Rate limit exceeded for IP: ${req.ip} - ${req.method} ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again in 15 minutes.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(15 * 60), // seconds
      timestamp: new Date().toISOString()
    });
  }
});

// Strict rate limiter for auth endpoints (login, register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again in 15 minutes.',
    error: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    console.warn(`🚫 Auth rate limit exceeded for IP: ${req.ip} - ${req.method} ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts from this IP, please try again in 15 minutes.',
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(15 * 60), // seconds
      timestamp: new Date().toISOString()
    });
  }
});

// Loose rate limiter for public endpoints (menu browsing, etc.)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again in 15 minutes.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚫 Public rate limit exceeded for IP: ${req.ip} - ${req.method} ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again in 15 minutes.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(15 * 60), // seconds
      timestamp: new Date().toISOString()
    });
  }
});

// Admin action limiter (creating/updating/deleting)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 admin actions per windowMs
  message: {
    success: false,
    message: 'Too many admin actions from this IP, please try again in 15 minutes.',
    error: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🚫 Admin rate limit exceeded for IP: ${req.ip} - ${req.method} ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      message: 'Too many admin actions from this IP, please try again in 15 minutes.',
      error: 'ADMIN_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(15 * 60), // seconds
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = {
  standardLimiter,
  authLimiter,
  publicLimiter,
  adminLimiter
};