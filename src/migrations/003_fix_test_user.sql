-- Fix test user password hash
-- Version: 3.0
-- Date: 2025-08-06

-- Update or insert test user with correct password hash
INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, status) 
VALUES (
    'test@goldenfish.co.uk',
    '$2a$12$5Kv0nFKVlNr.MsQWLTYDveUIGGExPXe8wO5PSx7KULVQA9a1QZyJW',
    'Test', 'User', '01904123456', 'registered', 'active'
) 
ON CONFLICT (email) DO UPDATE SET
    password_hash = '$2a$12$5Kv0nFKVlNr.MsQWLTYDveUIGGExPXe8wO5PSx7KULVQA9a1QZyJW',
    user_type = 'registered',
    status = 'active';

-- Add test address for test user
INSERT INTO user_addresses (user_id, street, city, postcode, is_default)
SELECT 
    u.id,
    '123 Test Street',
    'York', 
    'YO10 3BP',
    true
FROM users u 
WHERE u.email = 'test@goldenfish.co.uk'
ON CONFLICT DO NOTHING;