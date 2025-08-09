-- Migration: Add missing fields to orders table
-- Execute this in Supabase SQL Editor

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'pickup' CHECK (delivery_type IN ('delivery', 'pickup', 'collection')),
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_postcode VARCHAR(20),
ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
ADD COLUMN IF NOT EXISTS selected_time VARCHAR(10), -- 'asap' or 'HH:MM'
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Create index for delivery_postcode lookups
CREATE INDEX IF NOT EXISTS idx_orders_delivery_postcode ON orders(delivery_postcode);

-- Create index for selected_time lookups  
CREATE INDEX IF NOT EXISTS idx_orders_selected_time ON orders(selected_time);

-- Create index for delivery_type lookups
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type);