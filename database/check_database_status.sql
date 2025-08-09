-- 🔍 数据库状态检查脚本
-- 用于验证当前数据库结构和数据完整性
-- 遵循Supabase/PostgreSQL最佳实践

-- 1. 检查所有表的存在状态
SELECT 
    'TABLE_STATUS' as check_type,
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (VALUES 
    ('users'),
    ('user_addresses'),
    ('categories'),
    ('products'),
    ('product_options'),
    ('product_option_choices'),
    ('orders'),
    ('order_items'),
    ('restaurant_delivery_config')
) AS expected_tables(table_name)
ORDER BY table_name;

-- 2. 检查orders表的关键字段
SELECT 
    'ORDERS_COLUMNS' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查restaurant_delivery_config表状态
SELECT 
    'DELIVERY_CONFIG_STATUS' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'restaurant_delivery_config' 
                AND table_schema = 'public'
        ) THEN '✅ TABLE_EXISTS'
        ELSE '❌ TABLE_MISSING'
    END as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM restaurant_delivery_config 
            WHERE restaurant_id = 1
        ) THEN '✅ DEFAULT_CONFIG_EXISTS'
        ELSE '❌ DEFAULT_CONFIG_MISSING'
    END as config_status;

-- 4. 检查索引状态
SELECT 
    'INDEX_STATUS' as check_type,
    indexname as index_name,
    tablename as table_name,
    indexdef as definition
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND (
        tablename = 'orders' 
        OR tablename = 'restaurant_delivery_config'
    )
ORDER BY tablename, indexname;

-- 5. 检查数据完整性
SELECT 
    'DATA_INTEGRITY' as check_type,
    'orders_count' as metric,
    COUNT(*)::text as value
FROM orders
UNION ALL
SELECT 
    'DATA_INTEGRITY',
    'categories_count',
    COUNT(*)::text
FROM categories
UNION ALL
SELECT 
    'DATA_INTEGRITY',
    'products_count',
    COUNT(*)::text
FROM products
UNION ALL
SELECT 
    'DATA_INTEGRITY',
    'delivery_configs_count',
    COUNT(*)::text
FROM restaurant_delivery_config;

-- 6. 检查视图状态
SELECT 
    'VIEW_STATUS' as check_type,
    table_name as view_name,
    CASE 
        WHEN table_type = 'VIEW' THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name = 'restaurant_delivery_summary';

-- 7. 检查触发器状态
SELECT 
    'TRIGGER_STATUS' as check_type,
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
    AND event_object_table = 'restaurant_delivery_config';

-- 8. 汇总报告
SELECT 
    '🎯 DATABASE_HEALTH_SUMMARY' as report_type,
    'All systems status check completed' as message,
    NOW() as checked_at;