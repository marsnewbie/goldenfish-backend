import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { CreateOrderData, OrderStatusUpdate } from '../models/Order';
import Joi from 'joi';

// Validation schemas
const createOrderSchema = Joi.object({
  customerInfo: Joi.object({
    firstName: Joi.string().required().min(1).max(50),
    lastName: Joi.string().required().min(1).max(50),
    email: Joi.string().email().required(),
    phone: Joi.string().required().pattern(/^(\+44|0)[1-9]\d{8,10}$/),
    accountType: Joi.string().valid('guest', 'register').required(),
    password: Joi.string().min(6).when('accountType', {
      is: 'register',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  }).required(),
  
  items: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    price: Joi.number().positive().required(),
    qty: Joi.number().integer().positive().required(),
    selectedOptions: Joi.object().optional(),
    isFreeItem: Joi.boolean().optional()
  })).min(1).required(),
  
  deliveryType: Joi.string().valid('delivery', 'collection').required(),
  
  deliveryAddress: Joi.object({
    street: Joi.string().required().min(5).max(200),
    city: Joi.string().required().min(2).max(100),
    postcode: Joi.string().required().pattern(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i),
    instructions: Joi.string().max(500).optional()
  }).when('deliveryType', {
    is: 'delivery',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  
  specialInstructions: Joi.string().max(500).allow('').optional(),
  paymentMethod: Joi.string().valid('card', 'cash', 'paypal').required(),
  
  totals: Joi.object({
    subtotal: Joi.number().positive().required(),
    deliveryFee: Joi.number().min(0).required(),
    discount: Joi.number().min(0).required(),
    total: Joi.number().positive().required()
  }).required()
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
        customerEmail: orderData.customerInfo.email,
        deliveryType: orderData.deliveryType,
        itemCount: orderData.items.length,
        total: orderData.totals.total
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