// Simplified order service using Supabase
import { supabase } from '../config/supabase-client';
import { OrderNumberGenerator } from '../utils/orderNumber';
import { EmailService } from './emailService';

export interface CreateOrderData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderType: 'delivery' | 'collection';
  deliveryAddress?: {
    street: string;
    city: string;
    postcode: string;
    instructions?: string;
  };
  items: any[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  specialInstructions?: string;
  userId?: number;
}

export class OrderService {
  static async createOrder(data: CreateOrderData) {
    try {
      const orderNumber = OrderNumberGenerator.generateTimestampBased();
      
      const { data: orderData, error } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: data.userId || null,
          customer_name: data.customerName,
          customer_email: data.customerEmail,
          customer_phone: data.customerPhone,
          order_type: data.orderType,
          delivery_address: data.deliveryAddress || null,
          items: data.items,
          subtotal: data.subtotal,
          delivery_fee: data.deliveryFee,
          total_amount: data.totalAmount,
          special_instructions: data.specialInstructions,
          order_status: 'pending',
          estimated_time: data.orderType === 'delivery' ? '30-40 minutes' : '20-25 minutes'
        })
        .select()
        .single();

      if (error) throw error;

      // Send confirmation email
      let emailSent = false;
      try {
        await EmailService.sendOrderConfirmation({
          orderNumber,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          items: data.items,
          totals: {
            subtotal: data.subtotal,
            deliveryFee: data.deliveryFee,
            discount: 0,
            total: data.totalAmount
          },
          deliveryType: data.orderType,
          deliveryAddress: data.deliveryAddress,
          specialInstructions: data.specialInstructions,
          contact: {
            phone: data.customerPhone
          },
          estimatedTime: parseInt(orderData.estimated_time?.split('-')[0] || '30')
        });
        emailSent = true;
      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }

      return { 
        order: orderData, 
        emailSent 
      };
    } catch (error) {
      console.error('Order creation failed:', error);
      throw error;
    }
  }
}