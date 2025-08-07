-- Modern Multi-Tenant Restaurant Ordering System (2025)
-- Supabase Database Schema with Row Level Security (RLS)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================
-- TENANTS (Restaurant Chains/Franchises)
-- ================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'restaurant', -- restaurant, chain, franchise
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Business Information
    business_name VARCHAR(255),
    business_type VARCHAR(100),
    tax_id VARCHAR(50),
    
    -- Contact Information
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United Kingdom',
    
    -- Settings (JSON for flexible configuration)
    settings JSONB DEFAULT '{}',
    
    -- Branding
    logo_url VARCHAR(500),
    brand_colors JSONB DEFAULT '{}',
    
    -- Subscription/Billing
    plan VARCHAR(50) DEFAULT 'free',
    trial_ends_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- RLS for tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- ================================
-- USER_TENANTS (Many-to-Many: Users can belong to multiple tenants)
-- ================================

CREATE TABLE IF NOT EXISTS user_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'customer', -- owner, admin, manager, staff, customer
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    permissions JSONB DEFAULT '[]',
    
    -- Metadata
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id),
    
    UNIQUE(user_id, tenant_id)
);

-- RLS for user_tenants
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- ================================
-- USER_PROFILES (Extended user information)
-- ================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Personal Information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    date_of_birth DATE,
    
    -- Preferences
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Europe/London',
    marketing_consent BOOLEAN DEFAULT FALSE,
    
    -- Authentication Metadata
    auth_method VARCHAR(50), -- magic_link, passkey, oauth_google, oauth_apple
    last_sign_in_at TIMESTAMPTZ,
    sign_in_count INTEGER DEFAULT 0,
    
    -- Address Book (Default addresses)
    default_delivery_address JSONB,
    addresses JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ================================
-- RESTAURANTS (Individual restaurant locations)
-- ================================

CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    cuisine_type VARCHAR(100),
    
    -- Contact Information
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Address
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'United Kingdom',
    
    -- Geographic Data
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Operating Information
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, temporarily_closed
    opening_hours JSONB NOT NULL DEFAULT '{}',
    delivery_radius_km DECIMAL(5, 2) DEFAULT 5.0,
    
    -- Delivery Settings
    delivery_zones JSONB DEFAULT '[]',
    minimum_order_amount DECIMAL(10, 2) DEFAULT 15.00,
    delivery_fee DECIMAL(10, 2) DEFAULT 2.50,
    free_delivery_threshold DECIMAL(10, 2),
    
    -- Online Ordering
    online_ordering_enabled BOOLEAN DEFAULT TRUE,
    delivery_enabled BOOLEAN DEFAULT TRUE,
    pickup_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- RLS for restaurants
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- ================================
-- ORDERS (Updated to match existing structure)
-- ================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Relationships
    restaurant_id UUID REFERENCES restaurants(id),
    tenant_id UUID, -- For RLS
    customer_id UUID REFERENCES auth.users(id), -- NULL for guest orders
    
    -- Order Information
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, preparing, ready, completed, cancelled
    order_type VARCHAR(20) NOT NULL, -- delivery, pickup
    
    -- Customer Information (for guest orders and compatibility)
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Delivery Information (updated structure)
    delivery_address JSONB,
    delivery_instructions TEXT,
    delivery_fee DECIMAL(10, 2) DEFAULT 0,
    
    -- Pricing
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Payment
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    
    -- Timing
    estimated_preparation_time INTEGER, -- minutes
    estimated_delivery_time INTEGER, -- minutes
    requested_time TIMESTAMPTZ,
    
    -- Special Instructions
    special_instructions TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ================================
-- ORDER_ITEMS (Updated structure)
-- ================================

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id UUID, -- For RLS
    
    -- Item Information
    menu_item_id UUID, -- References menu_items when available
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pricing
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price DECIMAL(10, 2) NOT NULL,
    
    -- Customizations
    customizations JSONB DEFAULT '[]',
    modifiers JSONB DEFAULT '[]',
    special_instructions TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ================================
-- ROW LEVEL SECURITY POLICIES
-- ================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view their own tenant relationships" ON user_tenants;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view restaurants from their tenants" ON restaurants;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can view items from their orders" ON order_items;

-- Tenants: Users can only see tenants they belong to
CREATE POLICY "Users can view their own tenants" ON tenants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut 
            WHERE ut.tenant_id = tenants.id 
            AND ut.user_id = auth.uid()
            AND ut.status = 'active'
        )
    );

-- User Tenants: Users can only see their own relationships
CREATE POLICY "Users can view their own tenant relationships" ON user_tenants
    FOR SELECT USING (user_id = auth.uid());

-- User Profiles: Users can only see/edit their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- Restaurants: Public read access for active restaurants
CREATE POLICY "Public can view active restaurants" ON restaurants
    FOR SELECT USING (
        status = 'active'
        AND online_ordering_enabled = true
    );

-- Orders: Users can see their own orders
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (
        customer_id = auth.uid()
        OR customer_id IS NULL -- Guest orders (handled by application logic)
    );

CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (
        customer_id = auth.uid()
        OR customer_id IS NULL -- Guest orders
    );

-- Order Items: Users can see items from their orders
CREATE POLICY "Users can view items from their orders" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
        )
    );

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- User Tenants
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_status ON user_tenants(status);

-- Restaurants
CREATE INDEX IF NOT EXISTS idx_restaurants_tenant_id ON restaurants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status);
CREATE INDEX IF NOT EXISTS idx_restaurants_postal_code ON restaurants(postal_code);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ================================
-- FUNCTIONS AND TRIGGERS
-- ================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'ORD-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || 
                           LPAD((RANDOM() * 999)::INT::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for new user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================
-- SAMPLE DATA FOR TESTING
-- ================================

-- Insert sample tenant (only if doesn't exist)
INSERT INTO tenants (name, slug, business_name, email, plan, settings) 
SELECT 'Golden Fish Group', 'golden-fish', 'Golden Fish Restaurant Group Ltd', 'admin@goldenfish.co.uk', 'premium', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'golden-fish');

-- Get tenant ID for restaurant creation
DO $$
DECLARE
    tenant_uuid UUID;
BEGIN
    SELECT id INTO tenant_uuid FROM tenants WHERE slug = 'golden-fish' LIMIT 1;
    
    IF tenant_uuid IS NOT NULL THEN
        -- Insert sample restaurant (only if doesn't exist)
        INSERT INTO restaurants (
            tenant_id, name, slug, address_line1, city, postal_code, phone,
            opening_hours, delivery_zones
        )
        SELECT 
            tenant_uuid,
            'Golden Fish York',
            'golden-fish-york',
            '123 Golden Fish Street',
            'York',
            'YO10 3BP',
            '01904 123456',
            '{"monday": "closed", "tuesday": {"open": "17:00", "close": "23:00"}, "wednesday": {"open": "17:00", "close": "23:00"}, "thursday": {"open": "17:00", "close": "23:00"}, "friday": {"open": "17:00", "close": "00:00"}, "saturday": {"open": "17:00", "close": "00:00"}, "sunday": {"open": "17:00", "close": "22:30"}}'::jsonb,
            '[{"postcode": "YO10", "fee": 2.50}, {"postcode": "YO1", "fee": 3.00}]'::jsonb
        WHERE NOT EXISTS (
            SELECT 1 FROM restaurants 
            WHERE tenant_id = tenant_uuid AND slug = 'golden-fish-york'
        );
    END IF;
END $$;