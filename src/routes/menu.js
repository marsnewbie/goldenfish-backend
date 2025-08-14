// Menu routes - menu items CRUD operations
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const MenuItem = require('../models/MenuItem');
const { admin, optionalAuth } = require('../middleware/auth');
const { standardLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Input validation middleware
const validateMenuItem = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('category')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category must be between 1 and 100 characters'),
  
  body('imageUrl')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Image URL must be less than 500 characters'),
  
  body('spicy')
    .optional()
    .isBoolean()
    .withMessage('Spicy must be a boolean'),
  
  body('vegetarian')
    .optional()
    .isBoolean()
    .withMessage('Vegetarian must be a boolean'),
  
  body('available')
    .optional()
    .isBoolean()
    .withMessage('Available must be a boolean'),
  
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a positive integer')
];

// Query validation for filtering
const validateMenuQuery = [
  query('category')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Category filter cannot be empty'),
  
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  
  query('spicy')
    .optional()
    .isBoolean()
    .withMessage('Spicy must be a boolean'),
  
  query('vegetarian')
    .optional()
    .isBoolean()
    .withMessage('Vegetarian must be a boolean'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search term cannot be empty')
];

// @route   GET /api/menu
// @desc    Get complete menu data (categories + products + options)
// @access  Public
router.get('/', standardLimiter, async (req, res) => {
  try {
    console.log('📋 Fetching complete menu data');

    // Fetch categories
    const { data: categories, error: catError } = await require('../config/supabase-client').supabase
      .from('categories')
      .select('*')
      .order('sort_order');

    if (catError) {
      console.error('Categories fetch error:', catError);
      throw catError;
    }

    // Fetch menu items
    const { data: products, error: prodError } = await require('../config/supabase-client').supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category_id, sort_order, name');

    if (prodError) {
      console.error('Products fetch error:', prodError);
      throw prodError;
    }

    // For now, return products without options (we'll add options later)
    const productsWithOptions = products.map(prod => ({
      ...prod,
      options: []
    }));

    console.log(`✅ Found ${categories.length} categories, ${products.length} products`);

    res.json({
      success: true,
      data: {
        categories: categories || [],
        products: productsWithOptions || []
      }
    });

  } catch (error) {
    console.error('❌ Menu fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu data'
    });
  }
});

// @route   GET /api/menu/categories
// @desc    Get all available menu categories
// @access  Public
router.get('/categories', standardLimiter, async (req, res) => {
  try {
    console.log('📋 Fetching menu categories');
    
    const categories = await MenuItem.getCategories();
    
    console.log(`✅ Found ${categories.length} categories:`, categories);

    res.json({
      success: true,
      data: {
        categories,
        total: categories.length
      }
    });

  } catch (error) {
    console.error('❌ Categories fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// @route   GET /api/menu/featured
// @desc    Get featured menu items
// @access  Public
router.get('/featured', standardLimiter, async (req, res) => {
  try {
    console.log('📋 Fetching featured menu items');
    
    const featuredItems = await MenuItem.findFeatured();
    
    console.log(`✅ Found ${featuredItems.length} featured items`);

    res.json({
      success: true,
      data: {
        items: featuredItems.map(item => item.toJSON()),
        total: featuredItems.length
      }
    });

  } catch (error) {
    console.error('❌ Featured items fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured items'
    });
  }
});

// @route   GET /api/menu/:id
// @desc    Get single menu item by ID
// @access  Public
router.get('/:id', standardLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 Fetching menu item:', id);

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item ID'
      });
    }

    const menuItem = await MenuItem.findById(parseInt(id));
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    console.log('✅ Menu item found:', menuItem.name);

    res.json({
      success: true,
      data: {
        item: menuItem.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Menu item fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu item'
    });
  }
});

// Admin routes (require authentication and admin privileges)

// @route   POST /api/menu
// @desc    Create new menu item
// @access  Private/Admin
router.post('/', admin, validateMenuItem, async (req, res) => {
  try {
    console.log('📝 Creating new menu item:', { 
      name: req.body.name, 
      category: req.body.category,
      price: req.body.price
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

    const menuItem = await MenuItem.create(req.body);
    
    console.log('✅ Menu item created:', { 
      id: menuItem.id, 
      name: menuItem.name 
    });

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: {
        item: menuItem.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Menu item creation error:', error);
    
    if (error.message.includes('validation') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create menu item'
    });
  }
});

// @route   PUT /api/menu/:id
// @desc    Update menu item
// @access  Private/Admin
router.put('/:id', admin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 Updating menu item:', id, req.body);

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item ID'
      });
    }

    // Validate only provided fields
    const providedFields = Object.keys(req.body);
    const validationRules = [];

    if (providedFields.includes('name')) {
      validationRules.push(
        body('name')
          .trim()
          .isLength({ min: 1, max: 200 })
          .withMessage('Name must be between 1 and 200 characters')
      );
    }

    if (providedFields.includes('price')) {
      validationRules.push(
        body('price')
          .isFloat({ min: 0 })
          .withMessage('Price must be a positive number')
      );
    }

    if (providedFields.includes('category')) {
      validationRules.push(
        body('category')
          .trim()
          .isLength({ min: 1, max: 100 })
          .withMessage('Category must be between 1 and 100 characters')
      );
    }

    // Run validation if we have rules
    if (validationRules.length > 0) {
      await Promise.all(validationRules.map(rule => rule.run(req)));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }
    }

    const updatedMenuItem = await MenuItem.update(parseInt(id), req.body);
    
    console.log('✅ Menu item updated:', { 
      id: updatedMenuItem.id, 
      name: updatedMenuItem.name 
    });

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: {
        item: updatedMenuItem.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Menu item update error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    if (error.message.includes('validation') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update menu item'
    });
  }
});

// @route   DELETE /api/menu/:id
// @desc    Delete menu item (soft delete)
// @access  Private/Admin
router.delete('/:id', admin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting menu item:', id);

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item ID'
      });
    }

    const deletedMenuItem = await MenuItem.delete(parseInt(id));
    
    if (!deletedMenuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    console.log('✅ Menu item soft deleted:', { 
      id: deletedMenuItem.id, 
      name: deletedMenuItem.name 
    });

    res.json({
      success: true,
      message: 'Menu item deleted successfully',
      data: {
        item: deletedMenuItem.toJSON()
      }
    });

  } catch (error) {
    console.error('❌ Menu item deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete menu item'
    });
  }
});

module.exports = router;