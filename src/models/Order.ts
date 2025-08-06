export interface OrderItem {
  name: string;
  price: number;
  qty: number;
  selectedOptions?: Record<string, any>;
  isFreeItem?: boolean;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  postcode: string;
  instructions?: string;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountType: 'guest' | 'register';
  password?: string;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
}

export interface CreateOrderData {
  customerInfo: CustomerInfo;
  items: OrderItem[];
  deliveryType: 'delivery' | 'collection';
  deliveryAddress?: DeliveryAddress;
  specialInstructions?: string;
  paymentMethod: string;
  totals: OrderTotals;
}

export interface Order {
  id: number;
  orderNumber: string;
  restaurantId: number;
  userId?: number;
  
  // Customer info
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  
  // Order details
  items: OrderItem[];
  deliveryType: 'delivery' | 'collection';
  deliveryAddress?: DeliveryAddress;
  deliveryInstructions?: string;
  specialInstructions?: string;
  
  // Pricing
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  
  // Status and timing
  status: 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  
  estimatedTime: number; // minutes
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderStatusUpdate {
  orderId: number;
  status: Order['status'];
  notes?: string;
  estimatedTime?: number;
}