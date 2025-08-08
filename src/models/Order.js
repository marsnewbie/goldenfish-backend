// Order model for order management
const { supabase } = require('../config/supabase-client');

class Order {
  constructor(data) {
    this.id = data.id;
    this.orderNumber = data.order_number || data.orderNumber;
    this.userId = data.user_id || data.userId;
    
    // Customer info
    this.customerName = data.customer_name || data.customerName;
    this.customerEmail = data.customer_email || data.customerEmail;
    this.customerPhone = data.customer_phone || data.customerPhone;
    
    // Order details
    this.items = typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || []);
    this.deliveryType = data.delivery_type || data.deliveryType || 'pickup';
    this.deliveryAddress = data.delivery_address ? 
      (typeof data.delivery_address === 'string' ? 
        JSON.parse(data.delivery_address) : data.delivery_address) : null;
    this.deliveryInstructions = data.delivery_instructions || data.deliveryInstructions;
    this.specialInstructions = data.special_instructions || data.specialInstructions;
    
    // Pricing
    this.subtotal = parseFloat(data.subtotal || 0);
    this.deliveryFee = parseFloat(data.delivery_fee || data.deliveryFee || 0);
    this.discount = parseFloat(data.discount || 0);
    this.total = parseFloat(data.total || 0);
    
    // Status and timing
    this.status = data.status || 'received';
    this.paymentMethod = data.payment_method || data.paymentMethod || 'cash';
    this.paymentStatus = data.payment_status || data.paymentStatus || 'pending';
    this.estimatedTime = parseInt(data.estimated_time || data.estimatedTime || 30);
    
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  // Generate unique order number
  static generateOrderNumber() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePart = Math.floor(now.getTime() / 1000).toString().slice(-4);
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `GF${datePart}${timePart}${randomPart}`;
  }

  // Create new order
  static async create(orderData) {
    this.validateCreateInput(orderData);
    
    const orderNumber = this.generateOrderNumber();
    
    // Prepare order data for database
    const dbData = {
      order_number: orderNumber,
      user_id: orderData.customer.id || null,
      customer_name: `${orderData.customer.firstName} ${orderData.customer.lastName}`.trim(),
      customer_email: orderData.customer.email,
      customer_phone: orderData.customer.phone,
      items: JSON.stringify(orderData.items || []),
      delivery_type: orderData.delivery.method === 'delivery' ? 'delivery' : 'pickup',
      delivery_address: orderData.delivery.method === 'delivery' ? JSON.stringify({
        street: orderData.delivery.address,
        city: orderData.delivery.city,
        postcode: orderData.delivery.postcode,
        instructions: orderData.delivery.instructions
      }) : null,
      special_instructions: orderData.specialInstructions,
      subtotal: orderData.totals.subtotal,
      delivery_fee: orderData.totals.deliveryFee || 0,
      discount: orderData.totals.discount || 0,
      total: orderData.totals.total,
      payment_method: orderData.payment?.method || 'cash',
      payment_status: 'pending',
      status: 'received',
      estimated_time: this.calculateEstimatedTime(orderData.items || [])
    };

    const { data, error } = await supabase
      .from('orders')
      .insert(dbData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating order:', error);
      throw new Error('Failed to create order');
    }
    
    console.log('✅ Order created successfully:', {
      orderNumber,
      total: data.total,
      items: orderData.items?.length || 0
    });

    return new Order(data);
  }

  // Find order by ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error finding order:', error);
      throw new Error('Failed to find order');
    }
    
    return data ? new Order(data) : null;
  }

  // Find order by order number
  static async findByOrderNumber(orderNumber) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error finding order by number:', error);
      throw new Error('Failed to find order');
    }
    
    return data ? new Order(data) : null;
  }

  // Find orders by user ID
  static async findByUserId(userId, limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error finding user orders:', error);
      throw new Error('Failed to find user orders');
    }
    
    return (data || []).map(order => new Order(order));
  }

  // Get all orders with filtering and pagination
  static async findAll(filters = {}, limit = 50, offset = 0) {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.deliveryType) {
      query = query.eq('delivery_type', filters.deliveryType);
    }
    
    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }
    
    if (filters.paymentStatus) {
      query = query.eq('payment_status', filters.paymentStatus);
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching orders:', error);
      throw new Error('Failed to fetch orders');
    }
    
    return (data || []).map(order => new Order(order));
  }

  // Update order status
  async updateStatus(newStatus, notes = null, estimatedTime = null) {
    const validStatuses = ['received', 'preparing', 'ready', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const updates = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (estimatedTime !== null) {
      updates.estimated_time = parseInt(estimatedTime);
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', this.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating order status:', error);
      throw new Error('Failed to update order status');
    }

    // Update instance properties
    this.status = data.status;
    this.estimatedTime = data.estimated_time;
    this.updatedAt = data.updated_at;

    console.log('✅ Order status updated:', {
      orderNumber: this.orderNumber,
      oldStatus: this.status,
      newStatus: newStatus
    });

    return this;
  }

  // Update payment status
  async updatePaymentStatus(paymentStatus) {
    const validStatuses = ['pending', 'paid', 'failed'];
    
    if (!validStatuses.includes(paymentStatus)) {
      throw new Error(`Invalid payment status: ${paymentStatus}`);
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }

    this.paymentStatus = data.payment_status;
    this.updatedAt = data.updated_at;

    return this;
  }

  // Get order statistics
  static async getStats(dateFrom = null, dateTo = null) {
    let query = supabase
      .from('orders')
      .select('*');

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching order stats:', error);
      throw new Error('Failed to fetch order statistics');
    }

    const orders = (data || []).map(order => new Order(order));
    
    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
      averageOrderValue: orders.length > 0 ? 
        orders.reduce((sum, order) => sum + order.total, 0) / orders.length : 0,
      statusBreakdown: {},
      deliveryTypeBreakdown: {},
      paymentMethodBreakdown: {}
    };

    // Calculate breakdowns
    orders.forEach(order => {
      // Status breakdown
      stats.statusBreakdown[order.status] = 
        (stats.statusBreakdown[order.status] || 0) + 1;
      
      // Delivery type breakdown
      stats.deliveryTypeBreakdown[order.deliveryType] = 
        (stats.deliveryTypeBreakdown[order.deliveryType] || 0) + 1;
      
      // Payment method breakdown
      stats.paymentMethodBreakdown[order.paymentMethod] = 
        (stats.paymentMethodBreakdown[order.paymentMethod] || 0) + 1;
    });

    return stats;
  }

  // Convert to API response format
  toJSON() {
    return {
      id: this.id,
      orderNumber: this.orderNumber,
      userId: this.userId,
      customer: {
        name: this.customerName,
        email: this.customerEmail,
        phone: this.customerPhone
      },
      items: this.items,
      delivery: {
        type: this.deliveryType,
        address: this.deliveryAddress,
        instructions: this.deliveryInstructions
      },
      pricing: {
        subtotal: this.subtotal,
        deliveryFee: this.deliveryFee,
        discount: this.discount,
        total: this.total
      },
      status: this.status,
      payment: {
        method: this.paymentMethod,
        status: this.paymentStatus
      },
      specialInstructions: this.specialInstructions,
      estimatedTime: this.estimatedTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Calculate estimated preparation time based on order items
  static calculateEstimatedTime(items) {
    if (!items || items.length === 0) return 30;
    
    let baseTime = 20; // Base preparation time
    let additionalTime = items.length * 3; // 3 minutes per item
    
    // Add extra time for complex items (items with customizations)
    const complexItems = items.filter(item => item.customizations && item.customizations.length > 0);
    additionalTime += complexItems.length * 5;
    
    return Math.min(baseTime + additionalTime, 90); // Cap at 90 minutes
  }

  // Validation
  static validateCreateInput(data) {
    const errors = [];
    
    // Customer validation
    if (!data.customer) {
      errors.push('Customer information is required');
    } else {
      if (!data.customer.firstName || !data.customer.lastName) {
        errors.push('Customer first name and last name are required');
      }
      if (!data.customer.email) {
        errors.push('Customer email is required');
      }
      if (!data.customer.phone) {
        errors.push('Customer phone number is required');
      }
    }
    
    // Items validation
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('Order must contain at least one item');
    } else {
      data.items.forEach((item, index) => {
        if (!item.name || !item.price || !item.quantity) {
          errors.push(`Item ${index + 1} is missing required fields (name, price, quantity)`);
        }
        if (item.quantity <= 0) {
          errors.push(`Item ${index + 1} must have a positive quantity`);
        }
        if (item.price < 0) {
          errors.push(`Item ${index + 1} must have a positive price`);
        }
      });
    }
    
    // Totals validation
    if (!data.totals) {
      errors.push('Order totals are required');
    } else {
      if (typeof data.totals.subtotal !== 'number' || data.totals.subtotal < 0) {
        errors.push('Valid subtotal is required');
      }
      if (typeof data.totals.total !== 'number' || data.totals.total < 0) {
        errors.push('Valid total is required');
      }
    }
    
    // Delivery validation
    if (!data.delivery) {
      errors.push('Delivery information is required');
    } else {
      if (data.delivery.method === 'delivery') {
        if (!data.delivery.address || !data.delivery.city || !data.delivery.postcode) {
          errors.push('Delivery address, city, and postcode are required for delivery orders');
        }
      }
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }
}

module.exports = Order;