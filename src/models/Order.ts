// Modern checkout data structures
export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  customizations?: string[];
  isFreeItem?: boolean;
}

export interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface DeliveryInfo {
  method: 'delivery' | 'pickup';
  address?: string;
  city?: string;
  postcode?: string;
  instructions?: string;
}

export interface PaymentInfo {
  method: 'cash' | 'card';
}

export interface Promotion {
  id: string;
  name: string;
  type: 'amount_off' | 'percentage_off' | 'free_item';
  discount?: number;
}

export interface CreateOrderData {
  // Authentication info
  accountType: 'guest' | 'magic-link';
  isLoggedIn: boolean;
  
  // Customer details
  customer: Customer;
  
  // Order details
  delivery: DeliveryInfo;
  payment: PaymentInfo;
  items: OrderItem[];
  promotions?: Promotion[];
  specialInstructions?: string;
}

// Legacy delivery address interface for database compatibility
export interface DeliveryAddress {
  street: string;
  city: string;
  postcode: string;
  instructions?: string;
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