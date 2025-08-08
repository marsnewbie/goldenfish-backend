import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
// import { Server as SocketIOServer } from 'socket.io'; // Removed for Railway simplicity
// import { createServer } from 'http'; // Removed for Railway simplicity
import config from './config/environment';
// import { connectDatabase } from './config/database'; // Now using Supabase client
import orderRoutes from './routes/orders';
import authRoutes from './routes/auth';

// Create Express app
const app: Application = express();
// Simplified for Railway - removed Socket.IO

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`📋 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'golden-fish-api',
    version: '1.0.0'
  });
});

// Auth health check endpoint
app.get('/health/auth', async (_req: Request, res: Response) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'golden-fish-auth',
      version: '1.0.0',
      auth_system: 'traditional_jwt',
      auth_endpoints: {
        signin: '/api/auth/signin',
        signup: '/api/auth/signup',
        verify: '/api/auth/verify'
      }
    });
  } catch (error) {
    console.error('❌ Auth health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'golden-fish-auth',
      error: 'Auth system check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database diagnostic endpoint
app.get('/debug/database', async (_req: Request, res: Response) => {
  try {
    // Check if users table exists and its structure
    const tableCheck = await import('./config/database').then(db => 
      db.db.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `)
    );

    // Count users
    const userCount = await import('./config/database').then(db => 
      db.db.query('SELECT COUNT(*) as count FROM users')
    );

    // Check for test user
    const testUser = await import('./config/database').then(db => 
      db.db.query("SELECT id, email, first_name, last_name FROM users WHERE email = 'test@goldenfish.co.uk'")
    );

    res.json({
      status: 'debug',
      timestamp: new Date().toISOString(),
      database: {
        users_table_structure: tableCheck.rows,
        total_users: userCount.rows[0]?.count || 0,
        test_user_exists: testUser.rows.length > 0,
        test_user_data: testUser.rows[0] || null
      }
    });
  } catch (error) {
    console.error('❌ Database debug failed:', error);
    res.status(500).json({
      status: 'debug_failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
});

// API routes
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes); // Traditional JWT authentication

// Database initialization endpoint
app.post('/migrate', async (_req: Request, res: Response) => {
  try {
    console.log('🔄 Initializing Supabase database...');
    const { initializeDatabase } = await import('./config/init-database');
    const result = await initializeDatabase();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Database initialized successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Database initialization failed',
        details: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Golden Fish Order Management API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      orders: '/api/orders',
      docs: '/api/docs' // TODO: Add Swagger documentation
    },
    timestamp: new Date().toISOString()
  });
});

// Real-time features removed for Railway simplicity

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handler (simplified for Railway)
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
export async function startServer(): Promise<void> {
  try {
    console.log('🔄 Starting server...');
    
    // Using Supabase client - no need for manual database connection
    console.log('✅ Using Supabase client for database operations');
    
    // Railway simple port setup
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`🚀 Golden Fish API Server started`);
      console.log(`📍 Listening on port ${port}`);
      
      if (config.nodeEnv === 'development') {
        console.log(`🔗 API available at: http://localhost:${config.port}`);
        console.log(`📋 Health check: http://localhost:${config.port}/health`);
        console.log(`📦 Create order: POST http://localhost:${config.port}/api/orders`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Export for testing and external usage
export { app };

// Utility function to broadcast order updates (simplified)
export function broadcastOrderUpdate(orderNumber: string, status: string, _data: any): void {
  console.log(`📢 Order update: ${orderNumber} -> ${status}`);
  // Real-time features removed for Railway simplicity
}