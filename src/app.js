// Modern Express.js app with proper separation of concerns
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

// Import routes
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const menuRoutes = require('./routes/menu');
const authRoutes = require('./routes/auth'); // Legacy compatibility
const deliveryRoutes = require('./routes/delivery'); // 企业级送餐费计算

// Import middleware
const { standardLimiter } = require('./middleware/rateLimiter');

// Create Express application
const app = express();

// Trust proxy (for Railway deployment)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https://cyitrtjkoqxkolvtsydx.supabase.co"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // 智能CORS配置 - 支持动态Vercel URL和开发环境
    const allowedOrigins = [
      'https://test-ordering-page.vercel.app', // 生产域名
      // 开发环境
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      // 环境变量中的额外域名
      ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [])
    ];

    // 检查是否为Vercel预览部署URL
    const isVercelPreviewURL = (origin) => {
      return origin && (
        origin.startsWith('https://test-ordering-page-') && 
        origin.includes('-marssnewbies-projects.vercel.app')
      );
    };
    
    if (allowedOrigins.indexOf(origin) !== -1 || isVercelPreviewURL(origin)) {
      if (isVercelPreviewURL(origin)) {
        console.log('✅ CORS allowed for Vercel preview:', origin);
      }
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked origin:', origin);
      // 在开发环境允许所有域名，生产环境严格控制
      const allowInDevelopment = process.env.NODE_ENV !== 'production';
      callback(null, allowInDevelopment);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Request logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    skip: (req, res) => {
      // Skip logging health checks in production
      return req.url === '/health' && process.env.NODE_ENV === 'production';
    }
  }));
}

// Custom request logging for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📋 ${timestamp} - ${req.method} ${req.originalUrl}`);
  
  // Log body for POST/PUT requests (but not passwords)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const logBody = { ...req.body };
    if (logBody.password) logBody.password = '[REDACTED]';
    if (logBody.passwordConfirm) logBody.passwordConfirm = '[REDACTED]';
    console.log('📦 Request body:', JSON.stringify(logBody, null, 2));
  }
  
  next();
});

// Rate limiting
app.use('/api/', standardLimiter);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'golden-fish-api',
    version: '1.0.1',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    api_version: 'v1',
    endpoints: {
      auth: '/api/users/login',
      register: '/api/users/register',
      menu: '/api/menu',
      orders: '/api/orders'
    }
  });
});

// API Routes
app.use('/api/users', userRoutes);     // User registration, login, profile
app.use('/api/menu', menuRoutes);      // Menu items CRUD
app.use('/api/orders', orderRoutes);   // Order management
app.use('/api/auth', authRoutes);      // Legacy auth compatibility
app.use('/api/delivery', deliveryRoutes); // 企业级送餐费计算

// Database initialization endpoint (for manual setup)
app.post('/api/init-db', async (req, res) => {
  try {
    console.log('🔄 Manual database initialization requested...');
    
    // For security, require admin key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'goldenfish_admin_2025') {
      return res.status(403).json({
        success: false,
        message: 'Admin key required for database initialization'
      });
    }

    const { initializeDatabase } = require('./config/init-database');
    const result = await initializeDatabase();
    
    res.json({
      success: result.success,
      message: result.success ? 'Database initialized successfully' : 'Database initialization failed',
      details: result.error || 'All tables created and test data inserted',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Database initialization failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database migration endpoint (for schema updates)
app.post('/api/migrate-db', async (req, res) => {
  try {
    console.log('🔄 Database migration requested...');
    
    // For security, require admin key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'goldenfish_admin_2025') {
      return res.status(403).json({
        success: false,
        message: 'Admin key required for database migration'
      });
    }

    const fs = require('fs');
    const path = require('path');
    const { supabase } = require('./config/supabase-client');
    
    // Read migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_order_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      message: 'Database migration completed successfully',
      details: 'Missing fields added to orders table',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Database migration failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    message: 'Golden Fish Restaurant API',
    version: '1.0.1',
    description: 'Modern ordering system API with user authentication, menu management, and order processing',
    endpoints: {
      health: '/health',
      api_health: '/api/health',
      auth: {
        register: 'POST /api/users/register',
        login: 'POST /api/users/login',
        profile: 'GET /api/users/profile (authenticated)',
        verify: 'POST /api/users/verify-token'
      },
      menu: {
        list: 'GET /api/menu',
        categories: 'GET /api/menu/categories',
        item: 'GET /api/menu/:id'
      },
      orders: {
        create: 'POST /api/orders',
        list: 'GET /api/orders (authenticated)',
        details: 'GET /api/orders/:id (authenticated)'
      }
    },
    documentation: 'https://github.com/your-repo/api-docs',
    timestamp: new Date().toISOString()
  });
});

// API documentation endpoint (basic)
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Golden Fish API Documentation',
    version: '1.0.1',
    baseURL: req.protocol + '://' + req.get('host') + '/api',
    authentication: 'Bearer token in Authorization header',
    endpoints: {
      'POST /users/register': {
        description: 'Register new user account',
        body: {
          firstName: 'string (required)',
          lastName: 'string (required)', 
          email: 'string (required, valid email)',
          phone: 'string (required, UK format)',
          password: 'string (required, min 6 chars)'
        }
      },
      'POST /users/login': {
        description: 'Login user and get JWT token',
        body: {
          email: 'string (required)',
          password: 'string (required)'
        }
      },
      'GET /menu': {
        description: 'Get all menu items',
        query: {
          category: 'string (optional, filter by category)',
          featured: 'boolean (optional)'
        }
      },
      'POST /orders': {
        description: 'Create new order',
        authentication: 'optional (for registered users)',
        body: {
          customer: 'object (name, email, phone)',
          items: 'array (menu items with quantities)',
          delivery: 'object (method, address if delivery)',
          totals: 'object (subtotal, deliveryFee, total)'
        }
      }
    }
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      root: '/',
      health: '/health',
      docs: '/api/docs',
      users: '/api/users/*',
      menu: '/api/menu/*',
      orders: '/api/orders/*'
    }
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled application error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: isDevelopment ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: error.stack })
  });
});

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
  
  // Close server and cleanup
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server function
async function startServer() {
  try {
    const port = process.env.PORT || 3000;
    
    app.listen(port, () => {
      console.log('🚀 Golden Fish API Server Started');
      console.log(`📍 Port: ${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Started: ${new Date().toISOString()}`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔗 Local API: http://localhost:${port}`);
        console.log(`💚 Health Check: http://localhost:${port}/health`);
        console.log(`📚 Documentation: http://localhost:${port}/api/docs`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Export for testing and external use
module.exports = { app, startServer };