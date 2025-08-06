-- User Authentication Enhancement
-- Version: 2.0
-- Date: 2025-08-06

-- Update users table for better authentication support
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Update existing password_hash column to be more secure
-- (Keep existing data if any)

-- Create user_addresses table for saved addresses
CREATE TABLE IF NOT EXISTS user_addresses (
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

-- Create user_sessions table for token management (optional, for future use)
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON user_addresses(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_email_status ON users(email, status);

-- Add updated_at trigger for user_addresses
CREATE TRIGGER IF NOT EXISTS update_user_addresses_updated_at 
BEFORE UPDATE ON user_addresses 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for user_sessions  
CREATE TRIGGER IF NOT EXISTS update_user_sessions_updated_at 
BEFORE UPDATE ON user_sessions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a test user for development (password: test123)
-- Password hash for 'test123' using bcryptjs with 12 rounds
INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, status, created_at) 
VALUES (
    'test@goldenfish.co.uk',
    '$2a$12$rMaFzFz7qQq5rNgZJ7cFl.wJ8rV5x5XzKd5pXJ9Zq5pqZrTlrOxkG',
    'Test',
    'User',
    '01904123456',
    'registered',
    'active',
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Add a test address for the test user
INSERT INTO user_addresses (user_id, street, city, postcode, instructions, is_default)
SELECT 
    u.id,
    '123 Test Street',
    'York',
    'YO10 3BP',
    'Test delivery address',
    true
FROM users u 
WHERE u.email = 'test@goldenfish.co.uk'
AND NOT EXISTS (
    SELECT 1 FROM user_addresses ua WHERE ua.user_id = u.id
);

-- Update existing orders to link with users where possible
-- This will try to match existing orders with registered users by email
UPDATE orders 
SET user_id = u.id
FROM users u
WHERE orders.customer_email = u.email 
AND orders.user_id IS NULL
AND u.user_type = 'registered';