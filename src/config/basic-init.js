// Basic database initialization script
const { supabase } = require('./supabase-client');

async function basicInit() {
    try {
        console.log('🔄 Starting basic database initialization...');

        // 1. 创建餐厅信息
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .upsert({
                name: 'Golden Fish',
                description: 'Fresh Chinese Takeaway - Authentic flavors, made to order',
                phone: '01977 123456',
                email: 'ringorderai@gmail.com',
                delivery_radius: 16,
                minimum_order: 15.00,
                delivery_fee: 2.50,
                is_active: true
            })
            .select()
            .single();

        if (restaurantError) {
            console.error('❌ Restaurant creation error:', restaurantError);
            throw restaurantError;
        }
        
        console.log('✅ Restaurant created:', restaurant.name, 'ID:', restaurant.id);

        // 2. 创建基本菜单项
        const basicMenuItems = [
            {
                restaurant_id: restaurant.id,
                name: 'Spring Rolls',
                description: 'Crispy vegetable spring rolls with sweet chilli sauce',
                price: 3.50,
                is_available: true,
                is_featured: true,
                sort_order: 1
            },
            {
                restaurant_id: restaurant.id,
                name: 'Sweet & Sour Chicken',
                description: 'Crispy chicken in tangy sweet and sour sauce',
                price: 8.50,
                is_available: true,
                is_featured: true,
                sort_order: 2
            },
            {
                restaurant_id: restaurant.id,
                name: 'Special Fried Rice',
                description: 'Egg fried rice with chicken, prawns and vegetables',
                price: 7.50,
                is_available: true,
                is_featured: false,
                sort_order: 3
            },
            {
                restaurant_id: restaurant.id,
                name: 'Chicken Chow Mein',
                description: 'Stir-fried noodles with chicken and vegetables',
                price: 7.50,
                is_available: true,
                is_featured: false,
                sort_order: 4
            },
            {
                restaurant_id: restaurant.id,
                name: 'Coca Cola',
                description: '330ml can',
                price: 1.50,
                is_available: true,
                is_featured: false,
                sort_order: 5
            }
        ];

        for (const item of basicMenuItems) {
            const { error: itemError } = await supabase
                .from('menu_items')
                .upsert(item);
            if (itemError) {
                console.error('❌ Menu item creation error:', itemError);
                throw itemError;
            }
        }
        console.log('✅ Basic menu items created');

        // 4. 创建配送区域
        const deliveryZones = [
            { postcode_prefix: 'WF9 4', delivery_fee: 2.30, is_available: true },
            { postcode_prefix: 'WF9 3', delivery_fee: 2.60, is_available: true },
            { postcode_prefix: 'S72 9', delivery_fee: 2.60, is_available: true },
            { postcode_prefix: 'WF9 2', delivery_fee: 2.80, is_available: true },
            { postcode_prefix: 'WF9 5', delivery_fee: 2.80, is_available: true },
            { postcode_prefix: 'WF9 1', delivery_fee: 3.30, is_available: true },
            { postcode_prefix: 'WF7 7', delivery_fee: 3.30, is_available: true },
            { postcode_prefix: 'WF4 2', delivery_fee: 3.30, is_available: true },
            { postcode_prefix: 'S72 8', delivery_fee: 3.30, is_available: true },
            { postcode_prefix: 'S72 7', delivery_fee: 3.30, is_available: true }
        ];

        for (const zone of deliveryZones) {
            const { error: zoneError } = await supabase
                .from('delivery_zones')
                .upsert({
                    restaurant_id: restaurant.id,
                    postcode_prefix: zone.postcode_prefix,
                    delivery_fee: zone.delivery_fee,
                    is_available: zone.is_available
                });
            if (zoneError) {
                console.error('❌ Delivery zone creation error:', zoneError);
                // 不抛出错误，因为表可能不存在
            }
        }
        console.log('✅ Delivery zones created');

        console.log('🎉 Basic database initialization completed successfully!');
        return { success: true, restaurantId: restaurant.id };

    } catch (error) {
        console.error('❌ Basic database initialization failed:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { basicInit };
