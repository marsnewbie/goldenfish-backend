# Golden Fish Backend API

Restaurant order management system built with Node.js, TypeScript, and PostgreSQL.

## 🚀 Features

- **Order Management**: Complete order lifecycle from creation to completion
- **Email Notifications**: Automated confirmation and status update emails via Resend
- **Real-time Updates**: WebSocket support for live order tracking
- **Rate Limiting**: Protection against abuse with Redis-backed rate limiting
- **Multi-tenant Ready**: Designed for multiple restaurant support
- **Admin Dashboard**: Order statistics and management interface

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15+ with Redis caching
- **Email**: Resend API
- **Real-time**: Socket.IO
- **Deployment**: Railway

## 📋 Prerequisites

- Node.js 18 or higher
- Railway account (or PostgreSQL + Redis locally)
- Resend API account

## 🔧 Installation

1. **Clone and install dependencies**:
```bash
cd goldenfish-backend
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your Railway database URLs and Resend API key
```

3. **Run database migrations**:
```bash
npm run migrate
```

4. **Start development server**:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 🗄️ Database Schema

### Core Tables
- `restaurants` - Restaurant configuration and settings
- `orders` - Order records with full customer and item details
- `users` - Customer accounts (optional registration)
- `order_status_history` - Audit trail for order status changes
- `email_logs` - Email delivery tracking

### Default Data
- Restaurant: "Golden Fish" (ID: 1)
- Admin User: username `admin`, password `admin123` ⚠️ **CHANGE IN PRODUCTION**

## 📡 API Endpoints

### Public Endpoints

```http
POST /api/orders
Content-Type: application/json

{
  "customerInfo": {
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john@example.com",
    "phone": "07123456789",
    "accountType": "guest"
  },
  "items": [
    {
      "name": "Special Curry",
      "price": 12.80,
      "qty": 1,
      "selectedOptions": {
        "base": {"name": "Rice", "price": 0}
      }
    }
  ],
  "deliveryType": "delivery",
  "deliveryAddress": {
    "street": "123 Test Street",
    "city": "York", 
    "postcode": "YO10 3BP"
  },
  "paymentMethod": "card",
  "totals": {
    "subtotal": 12.80,
    "deliveryFee": 2.50,
    "discount": 0,
    "total": 15.30
  }
}
```

```http
GET /api/orders/{orderNumber}
```

### Admin Endpoints (🔒 Authentication required)

```http
GET /api/orders?status=received&limit=20
PUT /api/orders/{id}/status
GET /api/orders/stats/dashboard
```

## 🔌 WebSocket Events

### Customer Order Tracking
```javascript
socket.emit('track_order', 'GF250806-001');
socket.on('order_update', (data) => {
  console.log('Order status:', data.status);
});
```

### Admin Dashboard
```javascript
socket.emit('join_admin');
socket.on('admin_order_update', (data) => {
  console.log('New order update:', data);
});
```

## 🚀 Railway Deployment

1. **Create Railway project**:
```bash
railway login
railway init
railway link [your-project-id]
```

2. **Add PostgreSQL and Redis**:
```bash
railway add postgresql
railway add redis
```

3. **Set environment variables**:
```bash
railway variables:set RESEND_API_KEY=re_jTuYL41J_DpqE9iM23spyFRds7R8rua9x
railway variables:set EMAIL_FROM=onlineorder@ringorderai.com
railway variables:set CORS_ORIGINS=https://test-ordering-page.vercel.app
railway variables:set JWT_SECRET=your-secure-jwt-secret
```

4. **Deploy**:
```bash
npm run build
railway deploy
```

5. **Run migrations**:
```bash
railway run npm run migrate
```

## 📧 Email Configuration

The system uses Resend for email delivery. Email templates include:

- **Order Confirmation**: Sent immediately after order creation
- **Status Updates**: Sent when order status changes (preparing, ready, completed)

All emails are professionally designed with order details, pricing, and restaurant branding.

## 🔒 Security Features

- **Rate Limiting**: Prevents order spam and API abuse
- **Input Validation**: Comprehensive data validation with Joi
- **CORS Protection**: Restricts API access to authorized domains  
- **SQL Injection Prevention**: Parameterized queries throughout
- **Error Handling**: Secure error responses without data leakage

## 🧪 Testing

```bash
npm test
```

## 📊 Monitoring

Health check endpoint:
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-06T...",
  "service": "golden-fish-api",
  "version": "1.0.0"
}
```

## 🔄 Order Status Flow

1. `received` - Order created and confirmed
2. `preparing` - Kitchen started preparation  
3. `ready` - Order ready for pickup/delivery
4. `completed` - Order fulfilled
5. `cancelled` - Order cancelled (any stage)

## 🎯 Next Steps

- [ ] Implement admin authentication middleware
- [ ] Add payment processing (Stripe/PayPal)
- [ ] Build admin dashboard UI
- [ ] Add SMS notifications
- [ ] Implement menu management API
- [ ] Add order analytics and reporting

---

## 📞 Support

For issues or questions:
- Check Railway logs: `railway logs`
- Review API documentation
- Contact: marsnewbie6655@gmail.com