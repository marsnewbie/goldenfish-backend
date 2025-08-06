import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import config from './config/environment';
import { connectDatabase } from './config/database';
import orderRoutes from './routes/orders';

// Create Express app
const app: Application = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

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
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`📋 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'golden-fish-api',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/orders', orderRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
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

// Socket.IO for real-time order updates
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Join order tracking room
  socket.on('track_order', (orderNumber: string) => {
    socket.join(`order_${orderNumber}`);
    console.log(`👀 Client ${socket.id} tracking order: ${orderNumber}`);
  });
  
  // Join admin room for all order updates
  socket.on('join_admin', () => {
    socket.join('admin');
    console.log(`👨‍💼 Admin client joined: ${socket.id}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Store io instance globally for use in services
(global as any).io = io;

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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to databases
    await connectDatabase();
    
    // Start HTTP server
    httpServer.listen(config.port, () => {
      console.log('🚀 Golden Fish API Server started');
      console.log(`📍 Server running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`📧 Email service: ${config.emailFrom}`);
      console.log(`🔗 CORS origins: ${config.corsOrigins.join(', ')}`);
      console.log(`⚡ Socket.IO enabled for real-time updates`);
      
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

// Export for testing
export { app, io };

// Start server if not in test environment
if (require.main === module) {
  startServer();
}

// Utility function to broadcast order updates
export function broadcastOrderUpdate(orderNumber: string, status: string, data: any): void {
  if ((global as any).io) {
    // Notify customer tracking this order
    (global as any).io.to(`order_${orderNumber}`).emit('order_update', {
      orderNumber,
      status,
      ...data
    });
    
    // Notify admin dashboard
    (global as any).io.to('admin').emit('admin_order_update', {
      orderNumber,
      status,
      ...data,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📢 Broadcasted order update: ${orderNumber} -> ${status}`);
  }
}