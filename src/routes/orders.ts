import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { orderCreationLimiter, orderLookupLimiter, standardLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * Public Order Routes
 */

// Create new order
router.post('/', 
  orderCreationLimiter, // Rate limit: 5 orders per 10 minutes per IP
  OrderController.createOrder
);

// Get order by number (for customer tracking)
router.get('/:orderNumber', 
  orderLookupLimiter, // Rate limit: 10 requests per minute per IP
  OrderController.getOrderByNumber
);

/**
 * Admin Order Routes (TODO: Add authentication middleware)
 */

// Get all orders (admin only)
router.get('/', 
  // TODO: Add admin authentication middleware
  standardLimiter,
  OrderController.getOrders
);

// Update order status (admin only)
router.put('/:id/status', 
  // TODO: Add admin authentication middleware
  standardLimiter,
  OrderController.updateOrderStatus
);

// Get order statistics (admin only)
router.get('/stats/dashboard', 
  // TODO: Add admin authentication middleware
  standardLimiter,
  OrderController.getOrderStats
);

export default router;