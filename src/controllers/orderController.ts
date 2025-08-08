import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { CreateOrderData, OrderStatusUpdate } from '../models/Order';
import Joi from 'joi';

// Validation schemas - Updated for modern checkout
const createOrderSchema = Joi.object({
  // Account and authentication info
  accountType: Joi.string().valid('guest', 'magic-link').required(),
  isLoggedIn: Joi.boolean().required(),
  
  // Customer information
  customer: Joi.object({
    firstName: Joi.string().required().min(1).max(50),
    lastName: Joi.string().required().min(1).max(50),
    email: Joi.string().email().required(),
    phone: Joi.string().required().pattern(/^(\+44|0)[1-9]\d{8,10}$/)
  }).required(),
  
  // Delivery information  
  delivery: Joi.object({
    method: Joi.string().valid('delivery', 'pickup').required(),
    address: Joi.string().when('method', {
      is: 'delivery',
      then: Joi.required().min(5).max(200),
      otherwise: Joi.allow('')
    }),
    city: Joi.string().when('method', {
      is: 'delivery', 
      then: Joi.required().min(2).max(100),
      otherwise: Joi.allow('')
    }),
    postcode: Joi.string().when('method', {
      is: 'delivery',
      then: Joi.required().pattern(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i),
      otherwise: Joi.allow('')
    }),
    instructions: Joi.string().max(500).allow('')
  }).required(),
  
  // Payment information
  payment: Joi.object({
    method: Joi.string().valid('cash', 'card').required()
  }).required(),
  
  // Order items
  items: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    price: Joi.number().positive().required(),
    quantity: Joi.number().integer().positive().required(),
    customizations: Joi.array().items(Joi.string()).optional(),
    isFreeItem: Joi.boolean().optional()
  })).required(),
  
  // Promotions applied
  promotions: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    type: Joi.string().valid('amount_off', 'percentage_off', 'free_item').required(),
    discount: Joi.number().optional()
  })).optional(),
  
  // Special instructions
  specialInstructions: Joi.string().max(500).allow('')
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('received', 'preparing', 'ready', 'completed', 'cancelled').required(),
  notes: Joi.string().max(500).optional(),
  estimatedTime: Joi.number().integer().positive().optional()
});

export class OrderController {
  /**
   * POST /api/orders - Create new order
   */
  static async createOrder(req: Request, res: Response): Promise<void> {
    try {
      // Validate request data
      const { error, value } = createOrderSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const orderData: CreateOrderData = value;
      
      console.log('📋 Creating new order:', {
        customerEmail: orderData.customer.email,
        deliveryMethod: orderData.delivery.method,
        itemCount: orderData.items.length,
        accountType: orderData.accountType,
        isLoggedIn: orderData.isLoggedIn
      });

      // Create order
      const result = await OrderService.createOrder(orderData);
      
      res.status(201).json({
        success: true,
        data: {
          orderNumber: result.order.orderNumber,
          orderId: result.order.id,
          estimatedTime: result.order.estimatedTime,
          emailSent: result.emailSent,
          status: result.order.status
        },
        message: 'Order created successfully'
      });

    } catch (error) {
      console.error('❌ Error in createOrder controller:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/orders/:orderNumber - Get order by number
   */
  static async getOrderByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { orderNumber } = req.params;
      
      if (!orderNumber) {
        res.status(400).json({
          success: false,
          error: 'Order number is required'
        });
        return;
      }

      const order = await OrderService.getOrderByNumber(orderNumber);
      
      if (!order) {
        res.status(404).json({
          success: false,
          error: 'Order not found'
        });
        return;
      }

      res.json({
        success: true,
        data: order
      });

    } catch (error) {
      console.error('❌ Error in getOrderByNumber controller:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/orders - Get orders (admin)
   */
  static async getOrders(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string;
      const limit = parseInt(req.query.limit as string || '50', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);

      const result = await OrderService.getOrders(status, limit, offset);
      
      res.json({
        success: true,
        data: result.orders,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.total > offset + limit
        }
      });

    } catch (error) {
      console.error('❌ Error in getOrders controller:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get orders',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/orders/:id/status - Update order status (admin)
   */
  static async updateOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const orderId = parseInt(req.params.id, 10);
      
      if (!orderId || isNaN(orderId)) {
        res.status(400).json({
          success: false,
          error: 'Valid order ID is required'
        });
        return;
      }

      // Validate request data
      const { error, value } = updateOrderStatusSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
        return;
      }

      const updateData: OrderStatusUpdate = {
        orderId,
        ...value
      };

      const updatedOrder = await OrderService.updateOrderStatus(updateData);
      
      res.json({
        success: true,
        data: updatedOrder,
        message: 'Order status updated successfully'
      });

    } catch (error) {
      console.error('❌ Error in updateOrderStatus controller:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Order not found'
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update order status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/orders/stats - Get order statistics (admin)
   */
  static async getOrderStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await OrderService.getOrderStats();
      
      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Error in getOrderStats controller:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}