// Orders routes - order management and tracking
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Order = require('../models/Order');
const { protect, admin, optionalAuth } = require('../middleware/auth');
const { standardLimiter, authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Input validation middleware
const validateCreateOrder = [
  body('customer.firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  
  body('customer.lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  
  body('customer.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('customer.phone')
    .custom((value) => {
      // Remove spaces and normalize the phone number
      const cleaned = value.replace(/[\s\-\(\)]/g, '');
      
      // Handle different UK mobile formats
      let normalized = cleaned;
      if (normalized.startsWith('+447')) {
        normalized = '0' + normalized.substring(3);
      } else if (normalized.startsWith('447')) {
        normalized = '0' + normalized.substring(2);
      } else if (normalized.startsWith('7') && normalized.length === 10) {
        normalized = '0' + normalized;
      }
      
      // Validate UK mobile format: 07xxxxxxxxx (11 digits total)
      const ukMobileRegex = /^07[0-9]{9}$/;
      if (!ukMobileRegex.test(normalized)) {
        throw new Error('Please provide a valid UK mobile number');
      }
      
      return true;
    }),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  
  body('items.*.name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required'),
  
  body('items.*.price')
    .isFloat({ min: 0 })
    .withMessage('Item price must be a positive number'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1'),
  
  body('delivery.method')
    .isIn(['delivery', 'pickup', 'collection'])
    .withMessage('Delivery method must be delivery, pickup, or collection'),

  // Delivery address validation (required for delivery)
  body('delivery.address')
    .if(body('delivery.method').equals('delivery'))
    .notEmpty()
    .withMessage('Delivery address is required for delivery orders'),

  body('delivery.postcode')
    .if(body('delivery.method').equals('delivery'))
    .matches(/^[A-Z]{1,2}[0-9]{1,2}\s?[0-9][A-Z]{2}$/i)
    .withMessage('Please provide a valid UK postcode'),

  // Selected time validation (optional but if provided should be valid)
  body('delivery.selectedTime')
    .optional()
    .matches(/^(asap|([01]?[0-9]|2[0-3]):[0-5][0-9])$/i)
    .withMessage('Selected time must be either "asap" or in HH:MM format'),

  // Delivery fee validation (for delivery orders)
  body('totals.delivery')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Delivery fee must be a positive number'),
  
  body('totals.subtotal')
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a positive number'),
  
  body('totals.total')
    .isFloat({ min: 0 })
    .withMessage('Total must be a positive number')
];

const validateStatusUpdate = [
  body('status')
    .isIn(['received', 'preparing', 'ready', 'completed', 'cancelled'])
    .withMessage('Invalid order status'),
  
  body('estimatedTime')
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage('Estimated time must be between 1 and 180 minutes'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

// @route   POST /api/orders
// @desc    Create new order
// @access  Public
router.post('/', standardLimiter, optionalAuth, validateCreateOrder, async (req, res) => {
  try {
    console.log('📝 Creating new order:', {
      customerEmail: req.body.customer?.email,
      itemCount: req.body.items?.length,
      total: req.body.totals?.total,
      deliveryMethod: req.body.delivery?.method
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

    // Add user ID if authenticated
    if (req.user) {
      req.body.customer.id = req.user.id;
    }

    // Create order
    const order = await Order.create(req.body);

    console.log('✅ Order created successfully:', {
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: order.total
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: order.toJSON(),
        orderNumber: order.orderNumber,  // Frontend expects this directly
        orderId: order.id,
        total: order.total
      }
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);
    
    if (error.message.includes('validation') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create order. Please try again.'
    });
  }
});

// @route   GET /api/orders/:orderNumber
// @desc    Get order by order number (for tracking)
// @access  Public
router.get('/:orderNumber', standardLimiter, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    console.log('📋 Looking up order:', orderNumber);

    if (!orderNumber || orderNumber.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order number'
      });
    }

    const order = await Order.findByOrderNumber(orderNumber);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('✅ Order found:', {
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total
    });

    res.json({
      success: true,
      data: {
        order: order.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Order lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
});

// User-specific routes (require authentication)

// @route   GET /api/orders/user/history
// @desc    Get user's order history
// @access  Private
router.get('/user/history', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    console.log('📋 Fetching order history for user:', {
      userId: req.user.id,
      page,
      limit
    });

    const orders = await Order.findByUserId(req.user.id, limit, offset);

    res.json({
      success: true,
      data: {
        orders: orders.map(order => order.toJSON()),
        pagination: {
          page,
          limit,
          total: orders.length,
          hasMore: orders.length === limit
        }
      }
    });

  } catch (error) {
    console.error('❌ User orders fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order history'
    });
  }
});

// Admin routes (require admin privileges)

// @route   GET /api/orders
// @desc    Get all orders with filtering and pagination
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Build filters
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.deliveryType) filters.deliveryType = req.query.deliveryType;
    if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod;
    if (req.query.paymentStatus) filters.paymentStatus = req.query.paymentStatus;
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;

    console.log('📋 Admin fetching orders with filters:', {
      filters,
      page,
      limit
    });

    const orders = await Order.findAll(filters, limit, offset);

    res.json({
      success: true,
      data: {
        orders: orders.map(order => order.toJSON()),
        pagination: {
          page,
          limit,
          total: orders.length,
          hasMore: orders.length === limit
        },
        filters
      }
    });

  } catch (error) {
    console.error('❌ Admin orders fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// @route   GET /api/orders/:id
// @desc    Get single order by ID (admin)
// @access  Private/Admin
router.get('/admin/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 Admin fetching order:', id);

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const order = await Order.findById(parseInt(id));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('✅ Admin order found:', {
      orderNumber: order.orderNumber,
      status: order.status
    });

    res.json({
      success: true,
      data: {
        order: order.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Admin order fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
router.put('/:id/status', protect, admin, validateStatusUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, estimatedTime } = req.body;

    console.log('📝 Updating order status:', {
      orderId: id,
      newStatus: status,
      estimatedTime
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

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const order = await Order.findById(parseInt(id));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update status
    await order.updateStatus(status, notes, estimatedTime);

    console.log('✅ Order status updated:', {
      orderNumber: order.orderNumber,
      newStatus: order.status
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: order.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Order status update error:', error);
    
    if (error.message.includes('Invalid status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// @route   PUT /api/orders/:id/payment-status
// @desc    Update payment status
// @access  Private/Admin
router.put('/:id/payment-status', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    console.log('📝 Updating payment status:', {
      orderId: id,
      paymentStatus
    });

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    const order = await Order.findById(parseInt(id));
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update payment status
    await order.updatePaymentStatus(paymentStatus);

    console.log('✅ Payment status updated:', {
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus
    });

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: {
        order: order.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Payment status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
});

// @route   GET /api/orders/admin/stats
// @desc    Get order statistics
// @access  Private/Admin
router.get('/admin/stats', protect, admin, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    console.log('📊 Fetching order statistics:', {
      dateFrom,
      dateTo
    });

    const stats = await Order.getStats(dateFrom, dateTo);

    console.log('✅ Statistics generated:', {
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue
    });

    res.json({
      success: true,
      data: {
        stats,
        dateRange: {
          from: dateFrom,
          to: dateTo
        }
      }
    });

  } catch (error) {
    console.error('❌ Statistics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;