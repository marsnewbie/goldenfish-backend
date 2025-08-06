-- Simplified User Authentication Tables
-- Version: 2.0-simple
-- Date: 2025-08-06

-- Add authentication columns to existing users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create user_addresses table (simplified)
CREATE TABLE IF NOT EXISTS user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    street VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,  
    postcode VARCHAR(20) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email_status ON users(email, status);

-- Create a test user (password: test123)
-- Hash: $2a$12$5Kv0nFKVlNr.MsQWLTYDveUIGGExPXe8wO5PSx7KULVQA9a1QZyJW
INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, status) 
VALUES (
    'test@goldenfish.co.uk',
    '$2a$12$5Kv0nFKVlNr.MsQWLTYDveUIGGExPXe8wO5PSx7KULVQA9a1QZyJW',
    'Test', 'User', '01904123456', 'registered', 'active'
) ON CONFLICT (email) DO NOTHING;