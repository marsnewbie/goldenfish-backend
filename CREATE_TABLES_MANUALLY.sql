-- 🎯 Golden Fish Database Schema - Execute in Supabase SQL Editor
-- Copy and paste ALL of this SQL into Supabase Dashboard > SQL Editor and click RUN

-- 1. Drop existing tables if they exist (start fresh)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_option_choices CASCADE;
DROP TABLE IF EXISTS product_options CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
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
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
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
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  -- Customer information
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  customer_address TEXT,
  -- Order totals
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create order_items table (individual items in each order)
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  options_summary TEXT, -- JSON or text summary of chosen options
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Create products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  image_url VARCHAR(500),
  spicy BOOLEAN DEFAULT false,
  vegetarian BOOLEAN DEFAULT false,
  available BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Create product_options table (for items with choices like portion sizes)
CREATE TABLE product_options (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  required BOOLEAN DEFAULT false,
  max_choices INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Create product_option_choices table (choices for each option)
CREATE TABLE product_option_choices (
  id SERIAL PRIMARY KEY,
  product_option_id INTEGER REFERENCES product_options(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  additional_price DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_available ON products(available);
CREATE INDEX idx_product_options_product_id ON product_options(product_id);
CREATE INDEX idx_product_option_choices_option_id ON product_option_choices(product_option_id);

-- 7. Create test user (password: test123)
INSERT INTO users (email, first_name, last_name, phone, password_hash, role, status)
VALUES (
  'test@goldenfish.co.uk', 
  'Test', 
  'User', 
  '01904123456', 
  '$2a$12$rMaFzFz7qQq5rNgZJ7cFl.wJ8rV5x5XzKd5pXJ9Zq5pqZrTlrOxkG',
  'customer',
  'active'
) ON CONFLICT (email) DO NOTHING;

-- 10. Insert sample categories
INSERT INTO categories (name, sort_order) VALUES
('Appetisers', 1),
('Soup', 2),
('Main Courses', 3),
('Vegetarian', 4),
('Rice & Noodles', 5),
('Drinks', 6);

-- 11. Insert sample products (based on Wonderful Chinese menu)
INSERT INTO products (name, description, price, category_id, spicy, vegetarian, available, featured, sort_order) VALUES
-- Appetisers (category_id = 1)
('Special Mixed Hors D''oeuvres', 'Minimum for 2 Persons. Served with Sweet & Sour Sauce. Includes Seaweed, Sesame Prawn Toast, Mini Spring Rolls, Spare Ribs, Crispy Won Tons & Chicken Wings.', 11.70, 1, false, false, true, true, 1),
('Crispy Seaweed', NULL, 5.50, 1, false, true, true, false, 2),
('Crispy Aromatic Duck', 'Served with Cucumber, Spring Onion, Pancakes & Hoi Sin Sauce.', 0.00, 1, false, false, true, true, 3),
('Sesame Prawn Toast (4 pieces)', 'Deep fried prawn toast with sesame seeds', 6.80, 1, false, false, true, false, 4),

-- Main Courses (category_id = 3) 
('Sweet & Sour Chicken', 'Battered chicken with pineapple and peppers in sweet & sour sauce', 12.80, 3, false, false, true, true, 1),
('Kung Po Chicken', 'Spicy chicken with peanuts and vegetables', 13.20, 3, true, false, true, false, 2),
('Beef Black Bean', 'Tender beef with onions and peppers in black bean sauce', 14.50, 3, false, false, true, false, 3),
('Lemon Chicken', 'Battered chicken with lemon sauce', 12.50, 3, false, false, true, false, 4),

-- Vegetarian (category_id = 4)
('Ma Po Tofu', 'Silky tofu in spicy Sichuan sauce', 10.50, 4, true, true, true, false, 1),
('Buddha\'s Delight', 'Mixed vegetables and tofu in brown sauce', 11.20, 4, false, true, true, true, 2),
('Sweet & Sour Vegetables', 'Mixed vegetables in sweet & sour sauce', 9.80, 4, false, true, true, false, 3),

-- Rice & Noodles (category_id = 5)
('Special Fried Rice', 'Fried rice with chicken, prawns, and mixed vegetables', 11.80, 5, false, false, true, true, 1),
('Chicken Chow Mein', 'Stir-fried noodles with chicken and vegetables', 10.50, 5, false, false, true, false, 2),
('Beef Ho Fun', 'Wide rice noodles with beef in soy sauce', 12.20, 5, false, false, true, false, 3),

-- Drinks (category_id = 6)
('Chinese Tea (pot)', 'Traditional jasmine tea', 3.50, 6, false, true, true, false, 1),
('Coca Cola (can)', 'Classic Coca Cola', 2.00, 6, false, true, true, false, 2),
('Fresh Orange Juice', 'Freshly squeezed orange juice', 3.80, 6, false, true, true, false, 3);

-- 12. Insert product options (for Crispy Aromatic Duck - product_id should be 3)
INSERT INTO product_options (product_id, name, required) VALUES (3, 'Choose Portion', TRUE);

-- 13. Insert product option choices (assuming the above option got id = 1)
INSERT INTO product_option_choices (product_option_id, name, additional_price, sort_order) VALUES
(1, 'Quarter (for 2 persons)', 9.50, 1),
(1, 'Half (for 3-4 persons)', 18.00, 2),
(1, 'Whole (for 6-8 persons)', 34.00, 3);

-- 14. Create admin user (password: admin123)
INSERT INTO users (email, first_name, last_name, phone, password_hash, role, status)
VALUES (
  'admin@goldenfish.co.uk', 
  'Admin', 
  'User', 
  '01904999999', 
  '$2a$12$K8ZkjH9.qJGRHvqpqCXRuOQy7gHsIXyD1WgK8QRJzYvLgKT0TcJtm',
  'admin', 
  'active'
) ON CONFLICT (email) DO NOTHING;

-- 15. Reload schema cache
NOTIFY pgrst, 'reload schema';

-- 16. Verify setup
SELECT 'Database setup completed successfully!' as result;

-- 17. Show created tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'user_addresses', 'orders', 'order_items', 'categories', 'products', 'product_options', 'product_option_choices')
ORDER BY table_name;

-- 18. Show test data
SELECT 'Test Users:' as info;
SELECT id, email, first_name, last_name, role FROM users;

SELECT 'Categories:' as info;
SELECT id, name, sort_order FROM categories ORDER BY sort_order;

SELECT 'Products Count by Category:' as info;
SELECT c.name as category, COUNT(p.id) as item_count 
FROM categories c 
LEFT JOIN products p ON c.id = p.category_id 
GROUP BY c.name, c.sort_order 
ORDER BY c.sort_order;

SELECT 'Products with Options:' as info;
SELECT p.name, po.name as option_name, COUNT(poc.id) as choice_count
FROM products p
JOIN product_options po ON p.id = po.product_id
JOIN product_option_choices poc ON po.id = poc.product_option_id
GROUP BY p.name, po.name;

-- IMPORTANT: After running this SQL, wait 30 seconds for schema cache to reload
-- Then test the backend menu API: GET /api/menu