import { Resend } from 'resend';
import config from '../config/environment';

const resend = new Resend(config.resendApiKey);

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    price: number;
    qty: number;
    selectedOptions?: any;
    isFreeItem?: boolean;
  }>;
  totals: {
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
  };
  deliveryType: 'delivery' | 'collection';
  deliveryAddress?: {
    street: string;
    city: string;
    postcode: string;
    instructions?: string;
  };
  specialInstructions?: string;
  contact: {
    phone: string;
  };
  estimatedTime: number;
}

export class EmailService {
  /**
   * Send order confirmation email to customer
   */
  static async sendOrderConfirmation(data: OrderEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log('📧 Sending order confirmation email...', {
        orderNumber: data.orderNumber,
        customerEmail: data.customerEmail
      });

      const emailHtml = this.generateOrderConfirmationHtml(data);
      
      const result = await resend.emails.send({
        from: config.emailFrom,
        to: [data.customerEmail],
        subject: `Order Confirmation #${data.orderNumber} - Golden Fish`,
        html: emailHtml,
      });

      console.log('✅ Order confirmation email sent successfully:', result);
      
      return {
        success: true,
        messageId: result.data?.id
      };
    } catch (error) {
      console.error('❌ Failed to send order confirmation email:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error'
      };
    }
  }

  /**
   * Send order status update email to customer
   */
  static async sendOrderUpdate(
    orderNumber: string,
    customerEmail: string,
    customerName: string,
    status: string,
    message?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const statusMessages = {
        preparing: 'Your order is being prepared',
        ready: 'Your order is ready!',
        completed: 'Your order has been completed',
        cancelled: 'Your order has been cancelled'
      };

      const result = await resend.emails.send({
        from: config.emailFrom,
        to: [customerEmail],
        subject: `Order Update #${orderNumber} - Golden Fish`,
        html: this.generateOrderUpdateHtml(
          orderNumber,
          customerName,
          statusMessages[status as keyof typeof statusMessages] || status,
          message
        ),
      });

      console.log('✅ Order update email sent successfully:', result);
      
      return {
        success: true,
        messageId: result.data?.id
      };
    } catch (error) {
      console.error('❌ Failed to send order update email:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error'
      };
    }
  }

  /**
   * Generate HTML for order confirmation email
   */
  private static generateOrderConfirmationHtml(data: OrderEmailData): string {
    // Generate order items HTML
    let itemsHtml = '';
    data.items.forEach(item => {
      let itemPrice = item.price;
      let optionsText = '';

      if (item.selectedOptions) {
        Object.values(item.selectedOptions).forEach(option => {
          if (Array.isArray(option)) {
            option.forEach((opt: any) => itemPrice += opt.price || 0);
          } else {
            itemPrice += (option as any).price || 0;
          }
        });

        optionsText = Object.entries(item.selectedOptions)
          .map(([_group, choice]) => {
            if (Array.isArray(choice)) {
              return choice.map((c: any) => c.name).join(', ');
            }
            return (choice as any).name;
          })
          .join(' • ');
      }

      const lineTotal = itemPrice * item.qty;
      itemsHtml += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
            <strong>${item.name} ${item.isFreeItem ? '(FREE)' : ''}</strong>
            ${optionsText ? `<br><small style="color: #666;">${optionsText}</small>` : ''}
            <br><small>Qty: ${item.qty}</small>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">
            £${lineTotal.toFixed(2)}
          </td>
        </tr>
      `;
    });

    // Generate delivery info
    let deliveryInfo = '';
    if (data.deliveryType === 'delivery' && data.deliveryAddress) {
      deliveryInfo = `
        <h3 style="color: #333;">Delivery Address</h3>
        <p>
          ${data.deliveryAddress.street}<br>
          ${data.deliveryAddress.city}, ${data.deliveryAddress.postcode}
          ${data.deliveryAddress.instructions ? `<br><strong>Instructions:</strong> ${data.deliveryAddress.instructions}` : ''}
        </p>
      `;
    } else {
      deliveryInfo = `
        <h3 style="color: #333;">Collection</h3>
        <p>Your order will be ready for collection in ${data.estimatedTime} minutes at:<br>
        <strong>Golden Fish</strong><br>
        123 Golden Fish Street, York YO10 3BP</p>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation - Golden Fish</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #00d084; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Order Confirmed!</h1>
          <p style="margin: 5px 0 0 0;">Order #${data.orderNumber}</p>
        </div>
        
        <div style="background: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Thank you for your order, ${data.customerName}!</h2>
          
          <p>We've received your order and will prepare it shortly. Here are your order details:</p>
          
          <h3 style="color: #333;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            ${itemsHtml}
            <tr style="background: #f8f9fa;">
              <td style="padding: 10px; font-weight: bold;">Subtotal</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">£${data.totals.subtotal.toFixed(2)}</td>
            </tr>
            ${data.totals.deliveryFee > 0 ? `
            <tr>
              <td style="padding: 10px;">Delivery Fee</td>
              <td style="padding: 10px; text-align: right;">£${data.totals.deliveryFee.toFixed(2)}</td>
            </tr>` : ''}
            ${data.totals.discount > 0 ? `
            <tr style="color: #00d084;">
              <td style="padding: 10px;">Discount</td>
              <td style="padding: 10px; text-align: right;">-£${data.totals.discount.toFixed(2)}</td>
            </tr>` : ''}
            <tr style="background: #f8f9fa; font-size: 18px;">
              <td style="padding: 15px; font-weight: bold;">Total</td>
              <td style="padding: 15px; text-align: right; font-weight: bold;">£${data.totals.total.toFixed(2)}</td>
            </tr>
          </table>
          
          ${deliveryInfo}
          
          <h3 style="color: #333;">Contact Information</h3>
          <p>
            <strong>Name:</strong> ${data.customerName}<br>
            <strong>Phone:</strong> ${data.contact.phone}<br>
            <strong>Email:</strong> ${data.customerEmail}
          </p>
          
          ${data.specialInstructions ? `
          <h3 style="color: #333;">Special Instructions</h3>
          <p>${data.specialInstructions}</p>
          ` : ''}
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #333; margin-top: 0;">Estimated ${data.deliveryType === 'delivery' ? 'Delivery' : 'Collection'} Time</h3>
            <p style="margin-bottom: 0; font-size: 18px; color: #00d084;">
              <strong>${data.estimatedTime} minutes</strong>
            </p>
          </div>
          
          <hr style="margin: 25px 0; border: none; border-top: 1px solid #e0e0e0;">
          
          <p style="text-align: center; color: #666; margin: 0;">
            Thank you for choosing Golden Fish!<br>
            If you have any questions, please call us at 01904 123456
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML for order update email
   */
  private static generateOrderUpdateHtml(
    orderNumber: string,
    customerName: string,
    status: string,
    message?: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Update - Golden Fish</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #00d084; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">Order Update</h1>
          <p style="margin: 5px 0 0 0;">Order #${orderNumber}</p>
        </div>
        
        <div style="background: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Hello ${customerName}!</h2>
          
          <p style="font-size: 18px; color: #00d084; font-weight: 600;">${status}</p>
          
          ${message ? `<p>${message}</p>` : ''}
          
          <hr style="margin: 25px 0; border: none; border-top: 1px solid #e0e0e0;">
          
          <p style="text-align: center; color: #666; margin: 0;">
            Thank you for choosing Golden Fish!<br>
            If you have any questions, please call us at 01904 123456
          </p>
        </div>
      </body>
      </html>
    `;
  }
}