-- Add last_login_at field for authentication tracking
-- Version: 4.0
-- Date: 2025-08-06

-- Add last_login_at column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;