import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * Public Order Routes
 */

// Create new order
router.post('/', 
  rateLimiter.orderCreation, // Rate limit: 5 orders per 10 minutes per IP
  OrderController.createOrder
);

// Get order by number (for customer tracking)
router.get('/:orderNumber', 
  rateLimiter.orderLookup, // Rate limit: 10 requests per minute per IP
  OrderController.getOrderByNumber
);

/**
 * Admin Order Routes (TODO: Add authentication middleware)
 */

// Get all orders (admin only)
router.get('/', 
  // TODO: Add admin authentication middleware
  rateLimiter.standard,
  OrderController.getOrders
);

// Update order status (admin only)
router.put('/:id/status', 
  // TODO: Add admin authentication middleware
  rateLimiter.standard,
  OrderController.updateOrderStatus
);

// Get order statistics (admin only)
router.get('/stats/dashboard', 
  // TODO: Add admin authentication middleware
  rateLimiter.standard,
  OrderController.getOrderStats
);

export default router;