import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
// import { Server as SocketIOServer } from 'socket.io'; // Removed for Railway simplicity
// import { createServer } from 'http'; // Removed for Railway simplicity
import config from './config/environment';
import { connectDatabase } from './config/database';
import orderRoutes from './routes/orders';

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

// API routes
app.use('/api/orders', orderRoutes);

// Migration endpoint (for Railway deployment)
app.post('/migrate', async (_req: Request, res: Response) => {
  try {
    const { runMigrations } = await import('./migrations/run');
    await runMigrations();
    res.json({ success: true, message: 'Database migrations completed successfully' });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ success: false, error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' });
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
    
    // Ensure database connection (reconnect if needed)
    try {
      await connectDatabase();
      console.log('✅ Database connection established');
    } catch (dbError) {
      console.warn('⚠️  Database connection warning:', dbError);
    }
    
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