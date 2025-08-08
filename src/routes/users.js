// User routes - registration, login, profile management
const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, admin, generateToken, verifyToken } = require('../middleware/auth');
const { standardLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Input validation middleware
const validateRegistration = [
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

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// @route   POST /api/users/register
// @desc    Register new user
// @access  Public
router.post('/register', standardLimiter, validateRegistration, async (req, res) => {
  try {
    console.log('📝 User registration attempt:', { 
      email: req.body.email, 
      timestamp: new Date().toISOString() 
    });

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => err.msg)
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

    console.log('✅ User registration successful:', { 
      userId: user.id, 
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toSafeObject(),
        token
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// @route   POST /api/users/login
// @desc    Login user
// @access  Public
router.post('/login', standardLimiter, validateLogin, async (req, res) => {
  try {
    console.log('🔐 User login attempt:', { 
      email: req.body.email, 
      timestamp: new Date().toISOString() 
    });

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => err.msg)
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login time
    await user.updateLastLogin();

    // Generate JWT token
    const token = generateToken(user);

    // Get user's saved addresses
    const addresses = await user.getAddresses();

    console.log('✅ User login successful:', { 
      userId: user.id, 
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      addressCount: addresses.length
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          ...user.toSafeObject(),
          savedAddresses: addresses
        },
        token
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// @route   POST /api/users/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    console.log('👋 User logout:', { 
      userId: req.user.id,
      email: req.user.email 
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const addresses = await req.user.getAddresses();
    const recentOrders = await req.user.getOrders(5); // Get last 5 orders

    res.json({
      success: true,
      data: {
        user: {
          ...req.user.toSafeObject(),
          savedAddresses: addresses,
          recentOrders: recentOrders
        }
      }
    });
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// @route   POST /api/users/verify-token
// @desc    Verify if token is valid
// @access  Public
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.id || decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        valid: true
      }
    });

  } catch (error) {
    console.error('❌ Token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// @route   GET /api/users/orders
// @desc    Get user's order history
// @access  Private
router.get('/orders', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const orders = await req.user.getOrders(limit, offset);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          hasMore: orders.length === limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Orders fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Admin routes

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const { data, error } = await require('../config/supabase-client').supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, status, created_at, last_login_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        users: data || [],
        total: data ? data.length : 0
      }
    });

  } catch (error) {
    console.error('❌ Admin users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

module.exports = router;