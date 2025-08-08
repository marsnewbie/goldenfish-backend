-- 🎯 Golden Fish Database Schema - Execute in Supabase SQL Editor
-- Copy and paste ALL of this SQL into Supabase Dashboard > SQL Editor and click RUN

-- 1. Drop existing tables if they exist (start fresh)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS user_addresses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create user_addresses table
CREATE TABLE user_addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  street VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL,
  postcode VARCHAR(20) NOT NULL,
  instructions TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('delivery', 'collection')),
  delivery_address JSONB,
  items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  special_instructions TEXT,
  estimated_time VARCHAR(50),
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create menu_items table (for proper menu management)
CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  image_url VARCHAR(500),
  spicy BOOLEAN DEFAULT false,
  vegetarian BOOLEAN DEFAULT false,
  available BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_available ON menu_items(available);

-- 7. Create test user (password: test123)
INSERT INTO users (email, first_name, last_name, phone, password_hash, status)
VALUES (
  'test@goldenfish.co.uk', 
  'Test', 
  'User', 
  '01904123456', 
  '$2a$12$rMaFzFz7qQq5rNgZJ7cFl.wJ8rV5x5XzKd5pXJ9Zq5pqZrTlrOxkG', 
  'active'
) ON CONFLICT (email) DO NOTHING;

-- 8. Insert sample menu items
INSERT INTO menu_items (name, description, price, category, spicy, vegetarian, available, featured, sort_order) VALUES
-- Appetizers
('Spring Rolls (2 pieces)', 'Crispy spring rolls served with sweet chili sauce', 4.50, 'Appetizers', false, true, true, false, 1),
('Prawn Crackers', 'Traditional prawn crackers', 2.50, 'Appetizers', false, false, true, false, 2),
('Chicken Satay (4 pieces)', 'Grilled chicken skewers with peanut sauce', 6.80, 'Appetizers', false, false, true, true, 3),

-- Main Courses
('Sweet & Sour Chicken', 'Battered chicken with pineapple and peppers in sweet & sour sauce', 12.80, 'Main Courses', false, false, true, true, 1),
('Kung Po Chicken', 'Spicy chicken with peanuts and vegetables', 13.20, 'Main Courses', true, false, true, false, 2),
('Beef Black Bean', 'Tender beef with onions and peppers in black bean sauce', 14.50, 'Main Courses', false, false, true, false, 3),
('Special Fried Rice', 'Fried rice with chicken, prawns, and mixed vegetables', 11.80, 'Main Courses', false, false, true, true, 4),

-- Vegetarian
('Ma Po Tofu', 'Silky tofu in spicy Sichuan sauce', 10.50, 'Vegetarian', true, true, true, false, 1),
('Vegetable Spring Rolls', 'Fresh vegetables wrapped in rice paper', 8.80, 'Vegetarian', false, true, true, false, 2),
('Buddha\'s Delight', 'Mixed vegetables and tofu in brown sauce', 11.20, 'Vegetarian', false, true, true, true, 3),

-- Drinks
('Chinese Tea (pot)', 'Traditional jasmine tea', 3.50, 'Drinks', false, true, true, false, 1),
('Coca Cola (can)', 'Classic Coca Cola', 2.00, 'Drinks', false, true, true, false, 2),
('Fresh Orange Juice', 'Freshly squeezed orange juice', 3.80, 'Drinks', false, true, true, false, 3);

-- 9. Create admin user (password: admin123)
INSERT INTO users (email, first_name, last_name, phone, password_hash, status)
VALUES (
  'admin@goldenfish.co.uk', 
  'Admin', 
  'User', 
  '01904999999', 
  '$2a$12$K8ZkjH9.qJGRHvqpqCXRuOQy7gHsIXyD1WgK8QRJzYvLgKT0TcJtm', 
  'active'
) ON CONFLICT (email) DO NOTHING;

-- 10. Reload schema cache
NOTIFY pgrst, 'reload schema';

-- 11. Verify setup
SELECT 'Database setup completed successfully!' as result;

-- 12. Show created tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'user_addresses', 'orders', 'menu_items');

-- 13. Show test data
SELECT 'Test Users:' as info;
SELECT id, email, first_name, last_name FROM users;

SELECT 'Menu Items Count:' as info;
SELECT category, COUNT(*) as item_count FROM menu_items GROUP BY category ORDER BY category;

-- IMPORTANT: After running this SQL, wait 30 seconds for schema cache to reload
-- Then test the backend authentication API