import { db } from '../config/database';
import { CreateOrderData, Order, OrderStatusUpdate } from '../models/Order';
import { OrderNumberGenerator } from '../utils/orderNumber';
import { EmailService } from './emailService';
import config from '../config/environment';

export class OrderService {
  /**
   * Create a new order
   */
  static async createOrder(data: CreateOrderData): Promise<{ order: Order; emailSent: boolean }> {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate order number
      const orderNumber = await OrderNumberGenerator.generateDailySequential();
      
      // Handle user association for authenticated users
      let userId: string | null = null;
      let userType = 'guest';
      
      if (data.isLoggedIn && data.accountType === 'magic-link') {
        userType = 'registered';
        
        // For Supabase authenticated users, we'll get the user ID from the JWT token
        // This will be handled by the auth middleware in the future
        // For now, we'll store the email as reference
        console.log('🔐 Order placed by authenticated user:', data.customer.email);
      }
      
      console.log('👤 User info:', { 
        accountType: data.accountType, 
        isLoggedIn: data.isLoggedIn, 
        userType 
      });
      
      // Calculate estimated time based on delivery method
      const estimatedTime = data.delivery.method === 'delivery' 
        ? config.defaultPrepTimes.delivery 
        : config.defaultPrepTimes.collection;
      
      // Calculate totals from items and promotions
      const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const deliveryFee = data.delivery.method === 'delivery' ? 2.50 : 0; // Default delivery fee
      const discount = data.promotions?.reduce((sum, promo) => sum + (promo.discount || 0), 0) || 0;
      const total = subtotal + deliveryFee - discount;

      // Prepare delivery address if delivery method
      const deliveryAddress = data.delivery.method === 'delivery' ? {
        address: data.delivery.address,
        city: data.delivery.city,
        postcode: data.delivery.postcode,
        instructions: data.delivery.instructions
      } : null;

      // Insert order with new structure
      const orderResult = await client.query(`
        INSERT INTO orders (
          order_number, restaurant_id, user_id,
          customer_name, customer_email, customer_phone,
          items, delivery_type, delivery_address, delivery_instructions, special_instructions,
          subtotal, delivery_fee, discount, total,
          status, payment_method, payment_status,
          estimated_time, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
        ) RETURNING *
      `, [
        orderNumber,
        1, // Default restaurant ID
        userId,
        `${data.customer.firstName} ${data.customer.lastName}`,
        data.customer.email,
        data.customer.phone,
        JSON.stringify(data.items),
        data.delivery.method,
        deliveryAddress ? JSON.stringify(deliveryAddress) : null,
        data.delivery.instructions || null,
        data.specialInstructions || null,
        subtotal,
        deliveryFee,
        discount,
        total,
        'received',
        data.payment.method,
        'pending',
        estimatedTime
      ]);
      
      const order = orderResult.rows[0];
      
      // Insert initial status history
      await client.query(`
        INSERT INTO order_status_history (order_id, status, notes, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [order.id, 'received', 'Order received and confirmed']);
      
      await client.query('COMMIT');
      
      // Send confirmation email with updated data structure
      const emailResult = await EmailService.sendOrderConfirmation({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        items: data.items,
        totals: { subtotal, deliveryFee, discount, total },
        deliveryType: data.delivery.method,
        deliveryAddress: deliveryAddress,
        specialInstructions: data.specialInstructions,
        contact: {
          phone: data.customer.phone
        },
        estimatedTime,
        accountType: data.accountType,
        isLoggedIn: data.isLoggedIn
      });
      
      console.log('✅ Order created successfully:', {
        orderNumber: order.order_number,
        orderId: order.id,
        emailSent: emailResult.success
      });
      
      return {
        order: this.formatOrder(order),
        emailSent: emailResult.success
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error creating order:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get order by order number
   */
  static async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const result = await db.query(
        'SELECT * FROM orders WHERE order_number = $1',
        [orderNumber]
      );
      
      return result.rows.length > 0 ? this.formatOrder(result.rows[0]) : null;
    } catch (error) {
      console.error('❌ Error getting order by number:', error);
      throw error;
    }
  }
  
  /**
   * Get orders for admin dashboard
   */
  static async getOrders(
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ orders: Order[]; total: number }> {
    try {
      const whereClause = status ? 'WHERE status = $3' : '';
      const params = status ? [limit, offset, status] : [limit, offset];
      
      // Get orders
      const ordersResult = await db.query(`
        SELECT * FROM orders 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `, params);
      
      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total FROM orders ${whereClause}
      `, status ? [status] : []);
      
      return {
        orders: ordersResult.rows.map(this.formatOrder),
        total: parseInt(countResult.rows[0].total, 10)
      };
    } catch (error) {
      console.error('❌ Error getting orders:', error);
      throw error;
    }
  }
  
  /**
   * Update order status
   */
  static async updateOrderStatus(data: OrderStatusUpdate): Promise<Order> {
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update order
      const orderResult = await client.query(`
        UPDATE orders 
        SET status = $1, estimated_time = COALESCE($2, estimated_time), updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [data.status, data.estimatedTime, data.orderId]);
      
      if (orderResult.rows.length === 0) {
        throw new Error(`Order not found with ID: ${data.orderId}`);
      }
      
      const order = orderResult.rows[0];
      
      // Insert status history
      await client.query(`
        INSERT INTO order_status_history (order_id, status, notes, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [data.orderId, data.status, data.notes || null]);
      
      await client.query('COMMIT');
      
      // Send update email to customer
      if (['preparing', 'ready', 'completed'].includes(data.status)) {
        await EmailService.sendOrderUpdate(
          order.order_number,
          order.customer_email,
          order.customer_name,
          data.status,
          data.notes
        );
      }
      
      console.log('✅ Order status updated:', {
        orderNumber: order.order_number,
        orderId: order.id,
        status: data.status
      });
      
      return this.formatOrder(order);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error updating order status:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get order statistics for dashboard
   */
  static async getOrderStats(): Promise<{
    today: { count: number; revenue: number };
    pending: number;
    preparing: number;
    ready: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Today's stats
      const todayResult = await db.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
        FROM orders 
        WHERE DATE(created_at) = $1 AND status != 'cancelled'
      `, [today]);
      
      // Status counts
      const statusResult = await db.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM orders 
        WHERE status IN ('received', 'preparing', 'ready')
        AND DATE(created_at) = $1
        GROUP BY status
      `, [today]);
      
      const statusCounts = statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count, 10);
        return acc;
      }, {} as Record<string, number>);
      
      return {
        today: {
          count: parseInt(todayResult.rows[0].count, 10),
          revenue: parseFloat(todayResult.rows[0].revenue)
        },
        pending: statusCounts.received || 0,
        preparing: statusCounts.preparing || 0,
        ready: statusCounts.ready || 0
      };
    } catch (error) {
      console.error('❌ Error getting order stats:', error);
      throw error;
    }
  }
  
  /**
   * Format database order record to Order interface
   */
  private static formatOrder(row: any): Order {
    return {
      id: row.id,
      orderNumber: row.order_number,
      restaurantId: row.restaurant_id,
      userId: row.user_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
      deliveryType: row.delivery_type,
      deliveryAddress: row.delivery_address ? 
        (typeof row.delivery_address === 'string' ? 
          JSON.parse(row.delivery_address) : row.delivery_address) : undefined,
      deliveryInstructions: row.delivery_instructions,
      specialInstructions: row.special_instructions,
      subtotal: parseFloat(row.subtotal),
      deliveryFee: parseFloat(row.delivery_fee || 0),
      discount: parseFloat(row.discount || 0),
      total: parseFloat(row.total),
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      estimatedTime: row.estimated_time,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}