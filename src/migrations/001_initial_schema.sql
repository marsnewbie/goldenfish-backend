-- Golden Fish Database Schema
-- Version: 1.0
-- Date: 2024-12-06

-- Enable UUID extension for potential future use
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Restaurants table (multi-tenant support for future)
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address JSONB,
    opening_hours JSONB DEFAULT '{}',
    delivery_zones JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default restaurant
INSERT INTO restaurants (slug, name, email, phone, address, opening_hours, delivery_zones) VALUES (
    'golden-fish',
    'Golden Fish',
    'orders@goldenfish.co.uk',
    '01904 123456',
    '{"street": "123 Golden Fish Street", "city": "York", "postcode": "YO10 3BP"}',
    '{
        "monday": null,
        "tuesday": {"open": "17:00", "close": "23:00"},
        "wednesday": {"open": "17:00", "close": "23:00"},
        "thursday": {"open": "17:00", "close": "23:00"},
        "friday": {"open": "17:00", "close": "23:30"},
        "saturday": {"open": "17:00", "close": "23:30"},
        "sunday": {"open": "17:00", "close": "22:30"}
    }',
    '{
        "YO10": {"fee": 2.50, "minimum": 15.00},
        "YO11": {"fee": 3.00, "minimum": 20.00},
        "YO12": {"fee": 3.50, "minimum": 25.00}
    }'
);

-- Users table (supports both guest and registered users)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255), -- NULL for guest users
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    addresses JSONB DEFAULT '[]',
    user_type VARCHAR(20) DEFAULT 'guest', -- 'guest', 'registered'
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    restaurant_id INTEGER REFERENCES restaurants(id) DEFAULT 1,
    user_id INTEGER REFERENCES users(id),
    
    -- Customer information (stored for record keeping)
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    
    -- Order details
    items JSONB NOT NULL,
    delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('delivery', 'collection')),
    delivery_address JSONB,
    delivery_instructions TEXT,
    special_instructions TEXT,
    
    -- Pricing
    subtotal DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Status and payment
    status VARCHAR(20) DEFAULT 'received' CHECK (status IN ('received', 'preparing', 'ready', 'completed', 'cancelled')),
    payment_method VARCHAR(20) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    
    -- Timing
    estimated_time INTEGER NOT NULL, -- minutes
    actual_prep_time INTEGER, -- minutes (filled when completed)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Order status history (audit trail)
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    notes TEXT,
    changed_by VARCHAR(100), -- admin user who changed status
    created_at TIMESTAMP DEFAULT NOW()
);

-- Menu categories (for future menu management)
CREATE TABLE menu_categories (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Menu items (for future menu management)
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES menu_categories(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(8,2) NOT NULL,
    image_url VARCHAR(255),
    options JSONB DEFAULT '{}', -- customization options
    allergens JSONB DEFAULT '[]', -- allergen information
    nutritional_info JSONB DEFAULT '{}',
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin users table (for management access)
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'staff')),
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- Password hash for 'admin123' using bcryptjs with 12 rounds
INSERT INTO admin_users (username, email, password_hash, first_name, last_name, role) VALUES (
    'admin',
    'admin@goldenfish.co.uk',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDd.k56m4Y8Z8zy',
    'Admin',
    'User',
    'super_admin'
);

-- Email logs (for tracking email delivery)
CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    email_type VARCHAR(50) NOT NULL, -- 'order_confirmation', 'status_update', etc.
    recipient_email VARCHAR(100) NOT NULL,
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
    external_id VARCHAR(100), -- Resend message ID
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_email_logs_order_id ON email_logs(order_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON menu_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW active_orders AS
SELECT 
    o.*,
    r.name as restaurant_name,
    EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 as minutes_since_created
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.status IN ('received', 'preparing', 'ready')
ORDER BY o.created_at ASC;

CREATE VIEW order_stats_today AS
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
    COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN status = 'completed' THEN actual_prep_time END), 0) as avg_prep_time
FROM orders 
WHERE DATE(created_at) = CURRENT_DATE;

-- Grant permissions (adjust as needed for your Railway setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;