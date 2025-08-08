// Legacy auth routes for backward compatibility
const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Input validation middleware
const validateSignin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateSignup = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .matches(/^(\+44|0)[1-9]\d{8,10}$/)
    .withMessage('Please provide a valid UK phone number'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// @route   POST /api/auth/signin
// @desc    Sign in user (legacy endpoint)
// @access  Public
router.post('/signin', authLimiter, validateSignin, async (req, res) => {
  try {
    console.log('🔐 Legacy signin attempt:', { 
      email: req.body.email, 
      timestamp: new Date().toISOString() 
    });

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errors.array().map(err => err.msg)
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Update last login time
    await user.updateLastLogin();

    // Generate JWT token
    const token = generateToken(user);

    // Get user's saved addresses
    const addresses = await user.getAddresses();

    console.log('✅ Legacy signin successful:', { 
      userId: user.id, 
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      addressCount: addresses.length
    });

    res.json({
      success: true,
      message: 'Sign in successful',
      data: {
        user: {
          ...user.toSafeObject(),
          savedAddresses: addresses
        },
        token,
        expiresIn: '30d'
      }
    });

  } catch (error) {
    console.error('❌ Legacy signin error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Authentication service temporarily unavailable'
    });
  }
});

// @route   POST /api/auth/signup
// @desc    Sign up new user (legacy endpoint)
// @access  Public
router.post('/signup', authLimiter, validateSignup, async (req, res) => {
  try {
    console.log('📝 Legacy signup attempt:', { 
      email: req.body.email, 
      timestamp: new Date().toISOString() 
    });

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errors.array().map(err => err.msg)
      });
    }

    const { firstName, lastName, email, phone, password } = req.body;

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password
    });

    // Generate JWT token
    const token = generateToken(user);

    console.log('✅ Legacy signup successful:', { 
      userId: user.id, 
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          ...user.toSafeObject(),
          savedAddresses: []
        },
        token,
        expiresIn: '30d'
      }
    });

  } catch (error) {
    console.error('❌ Legacy signup error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'An account with this email already exists. Please sign in instead.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Account creation service temporarily unavailable'
    });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify token (legacy endpoint)
// @access  Public
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.userId || decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('❌ Legacy token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
});

module.exports = router;