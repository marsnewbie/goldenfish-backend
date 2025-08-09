-- 🏢 企业级送餐系统数据库迁移
-- 基于Uber Eats、JustEat等行业标准设计
-- Execute this in Supabase SQL Editor

-- 1. 添加缺失的orders表字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'pickup' CHECK (delivery_type IN ('delivery', 'pickup', 'collection')),
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_postcode VARCHAR(20),
ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
ADD COLUMN IF NOT EXISTS selected_time VARCHAR(10), -- 'asap' or 'HH:MM'
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- 2. 创建企业级餐厅送餐配置表
CREATE TABLE IF NOT EXISTS restaurant_delivery_config (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL DEFAULT 1,
    restaurant_name VARCHAR(200) NOT NULL DEFAULT 'Golden Fish Restaurant',
    restaurant_address TEXT NOT NULL DEFAULT 'York, UK',
    
    -- 定价模式：'distance' (按距离) 或 'postcode' (按邮编)
    pricing_mode VARCHAR(20) DEFAULT 'postcode' CHECK (pricing_mode IN ('distance', 'postcode')),
    
    -- 邮编规则 (JSON格式，类似JustEat)
    postcode_rules JSONB DEFAULT '[
        {"postcode_pattern": "YO10 3BP", "fee": 2.50},
        {"postcode_pattern": "YO10 3B", "fee": 2.75},
        {"postcode_pattern": "YO10", "fee": 3.00},
        {"postcode_pattern": "YO1", "fee": 3.50},
        {"postcode_pattern": "YO", "fee": 4.00}
    ]',
    
    -- 距离规则 (JSON格式，类似Uber Eats)
    distance_rules JSONB DEFAULT '[
        {"max_distance": 1, "fee": 1.50},
        {"max_distance": 2, "fee": 2.50},
        {"max_distance": 3, "fee": 3.50},
        {"max_distance": 5, "fee": 5.00}
    ]',
    
    -- 订单价值折扣 (企业级功能)
    order_value_discounts JSONB DEFAULT '[
        {"min_order_value": 25, "type": "free_delivery", "value": 0},
        {"min_order_value": 20, "type": "fixed_reduction", "value": 1.00},
        {"min_order_value": 15, "type": "percentage", "value": 50}
    ]',
    
    -- 最低订单要求
    minimum_order_rules JSONB DEFAULT '[
        {"applies_to": "all", "minimum_amount": 12.00},
        {"applies_to": "postcode", "postcode_pattern": "YO1", "minimum_amount": 15.00}
    ]',
    
    -- 默认配置
    default_delivery_fee DECIMAL(10,2) DEFAULT 3.50,
    preparation_time_minutes INTEGER DEFAULT 35,
    max_delivery_distance_km DECIMAL(5,2) DEFAULT 5.0,
    
    -- 营业状态
    is_active BOOLEAN DEFAULT true,
    delivery_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 插入默认餐厅配置（Golden Fish）
INSERT INTO restaurant_delivery_config (
    restaurant_id,
    restaurant_name,
    restaurant_address,
    pricing_mode
) VALUES (
    1,
    'Golden Fish Restaurant',
    'University of York, Heslington, York YO10 5DD, UK',
    'postcode'
) ON CONFLICT DO NOTHING;

-- 4. 创建性能优化索引
CREATE INDEX IF NOT EXISTS idx_orders_delivery_postcode ON orders(delivery_postcode);
CREATE INDEX IF NOT EXISTS idx_orders_selected_time ON orders(selected_time);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_config_restaurant_id ON restaurant_delivery_config(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_config_active ON restaurant_delivery_config(is_active);

-- 5. 创建GIN索引以支持JSONB查询（企业级性能优化）
CREATE INDEX IF NOT EXISTS idx_postcode_rules_gin ON restaurant_delivery_config USING GIN (postcode_rules);
CREATE INDEX IF NOT EXISTS idx_distance_rules_gin ON restaurant_delivery_config USING GIN (distance_rules);

-- 6. 添加更新时间自动触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurant_config_updated_at
    BEFORE UPDATE ON restaurant_delivery_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 创建餐厅配置查看视图 (便于管理)
CREATE OR REPLACE VIEW restaurant_delivery_summary AS
SELECT 
    id,
    restaurant_name,
    pricing_mode,
    default_delivery_fee,
    preparation_time_minutes,
    max_delivery_distance_km,
    jsonb_array_length(postcode_rules) as postcode_rules_count,
    jsonb_array_length(distance_rules) as distance_rules_count,
    is_active,
    delivery_enabled,
    updated_at
FROM restaurant_delivery_config;

-- 🎉 数据库迁移完成
SELECT 'Enterprise delivery system database migration completed successfully!' as result;