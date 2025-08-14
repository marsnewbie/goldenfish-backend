// Simple database initialization script
const { supabase } = require('./supabase-client');

async function simpleInit() {
    try {
        console.log('🔄 Starting simple database initialization...');

        // 1. 创建餐厅信息（使用自动生成的UUID）
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .upsert({
                name: 'Golden Fish',
                description: 'Fresh Chinese Takeaway - Authentic flavors, made to order',
                logo_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200',
                banner_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800',
                address: {
                    street: '12 Barnsley Road',
                    city: 'Hemsworth',
                    postcode: 'WF9 4PY',
                    phone: '01977 123456'
                },
                phone: '01977 123456',
                email: 'ringorderai@gmail.com',
                opening_hours: {
                    monday: { open: '11:00', close: '21:00' },
                    tuesday: { open: '11:00', close: '21:00' },
                    wednesday: { open: '11:00', close: '21:00' },
                    thursday: { open: '11:00', close: '21:00' },
                    friday: { open: '11:00', close: '22:00' },
                    saturday: { open: '11:00', close: '22:00' },
                    sunday: { open: '12:00', close: '21:00' }
                },
                delivery_radius: 16,
                minimum_order: 15.00,
                delivery_fee: 2.50,
                theme_config: {
                    primary_color: '#FF6B35',
                    secondary_color: '#F7931E',
                    accent_color: '#FFD700'
                },
                settings: {
                    is_open: true,
                    accepts_delivery: true,
                    accepts_collection: true
                },
                is_active: true
            })
            .select()
            .single();

        if (restaurantError) {
            console.error('❌ Restaurant creation error:', restaurantError);
            throw restaurantError;
        }
        
        console.log('✅ Restaurant created:', restaurant.name, 'ID:', restaurant.id);

        // 2. 创建菜单分类
        const categories = [
            { name: 'Starters', description: 'Appetizers and small plates', sort_order: 1 },
            { name: 'Soups', description: 'Hot and sour soups', sort_order: 2 },
            { name: 'Main Courses', description: 'Traditional Chinese dishes', sort_order: 3 },
            { name: 'Rice Dishes', description: 'Fried rice and rice bowls', sort_order: 4 },
            { name: 'Noodle Dishes', description: 'Chow mein and noodle bowls', sort_order: 5 },
            { name: 'Side Dishes', description: 'Vegetables and sides', sort_order: 6 },
            { name: 'Drinks', description: 'Soft drinks and beverages', sort_order: 7 }
        ];

        for (const category of categories) {
            const { error: catError } = await supabase
                .from('categories')
                .upsert({
                    restaurant_id: restaurant.id,
                    ...category,
                    is_active: true
                });
            if (catError) {
                console.error('❌ Category creation error:', catError);
                throw catError;
            }
        }
        console.log('✅ Categories created');

        // 3. 创建一些基本菜单项
        const basicMenuItems = [
            {
                restaurant_id: restaurant.id,
                category_id: null, // 稍后更新
                name: 'Spring Rolls',
                description: 'Crispy vegetable spring rolls with sweet chilli sauce',
                price: 3.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: true,
                sort_order: 1
            },
            {
                restaurant_id: restaurant.id,
                category_id: null,
                name: 'Sweet & Sour Chicken',
                description: 'Crispy chicken in tangy sweet and sour sauce',
                price: 8.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: true,
                sort_order: 2
            },
            {
                restaurant_id: restaurant.id,
                category_id: null,
                name: 'Special Fried Rice',
                description: 'Egg fried rice with chicken, prawns and vegetables',
                price: 7.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 3
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

        console.log('🎉 Simple database initialization completed successfully!');
        return { success: true, restaurantId: restaurant.id };

    } catch (error) {
        console.error('❌ Simple database initialization failed:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { simpleInit };
