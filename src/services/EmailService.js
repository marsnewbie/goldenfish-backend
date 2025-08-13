// Email service for sending order confirmations and notifications
const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = 'Golden Fish <orders@goldenfish.co.uk>';
    this.adminEmail = 'ringorderai@gmail.com';
  }

  // Send order confirmation email to customer
  async sendOrderConfirmation(orderData) {
    try {
      console.log('📧 Sending order confirmation email:', {
        to: orderData.customer.email,
        orderNumber: orderData.orderNumber
      });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: orderData.customer.email,
        subject: `Order Confirmation - ${orderData.orderNumber}`,
        html: this.generateOrderConfirmationHTML(orderData)
      });

      if (error) {
        console.error('❌ Email sending error:', error);
        throw new Error(error.message);
      }

      console.log('✅ Order confirmation email sent successfully:', {
        emailId: data.id,
        to: orderData.customer.email
      });

      return { success: true, emailId: data.id };

    } catch (error) {
      console.error('❌ Failed to send order confirmation email:', error);
      throw error;
    }
  }

  // Send order notification to restaurant admin
  async sendOrderNotification(orderData) {
    try {
      console.log('📧 Sending order notification to admin:', {
        orderNumber: orderData.orderNumber,
        total: orderData.total
      });

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: this.adminEmail,
        subject: `New Order - ${orderData.orderNumber} - £${orderData.total}`,
        html: this.generateOrderNotificationHTML(orderData)
      });

      if (error) {
        console.error('❌ Admin notification error:', error);
        // Don't throw - admin notification failure shouldn't break order
        return { success: false, error: error.message };
      }

      console.log('✅ Admin notification sent successfully:', {
        emailId: data.id
      });

      return { success: true, emailId: data.id };

    } catch (error) {
      console.error('❌ Failed to send admin notification:', error);
      // Don't throw - admin notification failure shouldn't break order
      return { success: false, error: error.message };
    }
  }

  // Generate customer order confirmation HTML
  generateOrderConfirmationHTML(orderData) {
    const items = orderData.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          ${item.name}
          ${item.options ? `<br><small style="color: #666;">${item.options}</small>` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
          £${item.total_price ? item.total_price.toFixed(2) : (item.unit_price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - ${orderData.orderNumber}</title>
      </head>
      <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🐟 Golden Fish</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Order Confirmation</p>
          </div>

          <!-- Order Details -->
          <div style="padding: 30px;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 5px 0; color: #059669;">Order Confirmed!</h2>
              <p style="margin: 0; color: #065f46;">Thank you for your order. We're preparing your delicious meal.</p>
            </div>

            <!-- Order Info -->
            <table style="width: 100%; margin-bottom: 20px;">
              <tr>
                <td style="padding: 5px 0;"><strong>Order Number:</strong></td>
                <td style="padding: 5px 0; text-align: right;">${orderData.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Customer:</strong></td>
                <td style="padding: 5px 0; text-align: right;">${orderData.customer.name}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Phone:</strong></td>
                <td style="padding: 5px 0; text-align: right;">${orderData.customer.phone}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Order Type:</strong></td>
                <td style="padding: 5px 0; text-align: right;">${orderData.delivery.type === 'delivery' ? 'Delivery' : 'Collection'}</td>
              </tr>
              ${orderData.delivery.type === 'delivery' ? `
              <tr>
                <td style="padding: 5px 0;"><strong>Delivery Address:</strong></td>
                <td style="padding: 5px 0; text-align: right; font-size: 14px;">
                  ${orderData.delivery.address}<br>
                  ${orderData.delivery.postcode}
                </td>
              </tr>
              ` : ''}
            </table>

            <!-- Order Items -->
            <h3 style="border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 15px;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f9f9f9;">
                  <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                  <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${items}
              </tbody>
            </table>

            <!-- Pricing -->
            <table style="width: 100%; margin-bottom: 20px;">
              <tr>
                <td style="padding: 5px 0; text-align: right;"><strong>Subtotal:</strong></td>
                <td style="padding: 5px 0 5px 20px; text-align: right;">£${orderData.pricing.subtotal.toFixed(2)}</td>
              </tr>
              ${orderData.pricing.deliveryFee > 0 ? `
              <tr>
                <td style="padding: 5px 0; text-align: right;"><strong>Delivery Fee:</strong></td>
                <td style="padding: 5px 0 5px 20px; text-align: right;">£${orderData.pricing.deliveryFee.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 2px solid #dc2626; font-size: 18px;">
                <td style="padding: 10px 0; text-align: right;"><strong>Total:</strong></td>
                <td style="padding: 10px 0 10px 20px; text-align: right; color: #dc2626;"><strong>£${orderData.pricing.total.toFixed(2)}</strong></td>
              </tr>
            </table>

            <!-- Special Instructions -->
            ${orderData.specialInstructions ? `
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
              <h4 style="margin: 0 0 5px 0; color: #92400e;">Special Instructions:</h4>
              <p style="margin: 0; color: #92400e;">${orderData.specialInstructions}</p>
            </div>
            ` : ''}

            <!-- Estimated Time -->
            <div style="text-align: center; background: #e0f2fe; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 5px 0; color: #0369a1;">⏰ Estimated ${orderData.delivery.type === 'delivery' ? 'Delivery' : 'Collection'} Time</h3>
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #0369a1;">${orderData.estimatedTime} minutes</p>
            </div>

            <!-- Contact Info -->
            <div style="text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px;">
              <p><strong>Golden Fish Chinese Takeaway</strong></p>
              <p>Phone: 01904 123456 | Email: orders@goldenfish.co.uk</p>
              <p style="margin-top: 15px;">Thank you for choosing Golden Fish! 🐟</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate admin order notification HTML
  generateOrderNotificationHTML(orderData) {
    const items = orderData.items.map(item => `
      <li>${item.quantity}x ${item.name} - £${item.total_price ? item.total_price.toFixed(2) : (item.unit_price * item.quantity).toFixed(2)}
        ${item.options ? `<br><small style="color: #666;">Options: ${item.options}</small>` : ''}
      </li>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Order - ${orderData.orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">🚨 NEW ORDER RECEIVED</h1>
          
          <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #92400e;">Order: ${orderData.orderNumber}</h2>
            <p style="margin: 5px 0 0 0; font-size: 18px; color: #92400e;"><strong>Total: £${orderData.pricing.total.toFixed(2)}</strong></p>
          </div>

          <h3>Customer Details:</h3>
          <ul>
            <li><strong>Name:</strong> ${orderData.customer.name}</li>
            <li><strong>Phone:</strong> ${orderData.customer.phone}</li>
            <li><strong>Email:</strong> ${orderData.customer.email}</li>
            <li><strong>Order Type:</strong> ${orderData.delivery.type === 'delivery' ? 'DELIVERY' : 'COLLECTION'}</li>
            ${orderData.delivery.type === 'delivery' ? `
            <li><strong>Address:</strong> ${orderData.delivery.address}, ${orderData.delivery.postcode}</li>
            ${orderData.delivery.instructions ? `<li><strong>Delivery Instructions:</strong> ${orderData.delivery.instructions}</li>` : ''}
            ` : ''}
          </ul>

          <h3>Order Items:</h3>
          <ul style="list-style: none; padding: 0;">
            ${items}
          </ul>

          ${orderData.specialInstructions ? `
          <h3>Special Instructions:</h3>
          <p style="background: #fff3cd; padding: 10px; border-radius: 4px; border: 1px solid #ffc107;">
            ${orderData.specialInstructions}
          </p>
          ` : ''}

          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; padding: 15px; margin-top: 20px;">
            <h3 style="margin: 0; color: #0c5460;">Action Required:</h3>
            <p style="margin: 5px 0 0 0;">
              1. Acknowledge this order in your POS system<br>
              2. Start preparation (Est. time: ${orderData.estimatedTime} mins)<br>
              3. ${orderData.delivery.type === 'delivery' ? 'Prepare for delivery' : 'Customer will collect'}
            </p>
          </div>

          <p style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
            This is an automated notification from Golden Fish ordering system
          </p>
        </div>
      </body>
      </html>
    `;
  }

  // Send password reset email (future use)
  async sendPasswordReset(email, resetToken) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Password Reset - Golden Fish',
        html: `
          <p>You requested a password reset for your Golden Fish account.</p>
          <p>Click here to reset your password: <a href="https://test-ordering-page.vercel.app/reset-password?token=${resetToken}">Reset Password</a></p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        `
      });

      if (error) throw new Error(error.message);
      return { success: true, emailId: data.id };

    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();