// Database initialization script
const { supabase } = require('./supabase-client');

async function initializeDatabase() {
    try {
        console.log('🔄 Starting database initialization...');

        // 1. 创建餐厅信息
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .upsert({
                id: '550e8400-e29b-41d4-a716-446655440000',
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

        if (restaurantError) throw restaurantError;
        console.log('✅ Restaurant created:', restaurant.name);

        // 2. 创建菜单分类
        const categories = [
            { name: 'Starters', description: 'Appetizers and small plates', sort_order: 1 },
            { name: 'Soups', description: 'Hot and sour soups', sort_order: 2 },
            { name: 'Main Courses', description: 'Traditional Chinese dishes', sort_order: 3 },
            { name: 'Rice Dishes', description: 'Fried rice and rice bowls', sort_order: 4 },
            { name: 'Noodle Dishes', description: 'Chow mein and noodle bowls', sort_order: 5 },
            { name: 'Side Dishes', description: 'Vegetables and sides', sort_order: 6 },
            { name: 'Drinks', description: 'Soft drinks and beverages', sort_order: 7 },
            { name: 'Desserts', description: 'Sweet treats', sort_order: 8 }
        ];

        for (const category of categories) {
            const { error: catError } = await supabase
                .from('categories')
                .upsert({
                    restaurant_id: restaurant.id,
                    ...category,
                    is_active: true
                });
            if (catError) throw catError;
        }
        console.log('✅ Categories created');

        // 3. 创建菜单项
        const menuItems = [
            // Starters
            {
                category_name: 'Starters',
                name: 'Spring Rolls',
                description: 'Crispy vegetable spring rolls with sweet chilli sauce',
                price: 3.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: true,
                sort_order: 1,
                options: {
                    required: false,
                    choices: [
                        { name: 'Extra Sweet Chilli Sauce', price: 0.50 },
                        { name: 'Extra Spring Rolls', price: 1.50 }
                    ]
                }
            },
            {
                category_name: 'Starters',
                name: 'Crispy Duck',
                description: 'Half crispy duck with pancakes and hoisin sauce',
                price: 12.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: true,
                sort_order: 2,
                options: {
                    required: false,
                    choices: [
                        { name: 'Extra Pancakes', price: 1.00 },
                        { name: 'Extra Hoisin Sauce', price: 0.50 }
                    ]
                }
            },
            {
                category_name: 'Starters',
                name: 'Prawn Crackers',
                description: 'Light and crispy prawn crackers',
                price: 2.00,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 3
            },

            // Soups
            {
                category_name: 'Soups',
                name: 'Hot & Sour Soup',
                description: 'Spicy and tangy soup with mushrooms and tofu',
                price: 4.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 1,
                options: {
                    required: true,
                    choices: [
                        { name: 'Mild', price: 0 },
                        { name: 'Medium', price: 0 },
                        { name: 'Hot', price: 0 }
                    ]
                }
            },
            {
                category_name: 'Soups',
                name: 'Chicken Sweetcorn Soup',
                description: 'Creamy soup with chicken and sweetcorn',
                price: 4.00,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 2
            },

            // Main Courses
            {
                category_name: 'Main Courses',
                name: 'Sweet & Sour Chicken',
                description: 'Crispy chicken in tangy sweet and sour sauce',
                price: 8.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: true,
                sort_order: 1,
                options: {
                    required: true,
                    choices: [
                        { name: 'Chicken', price: 0 },
                        { name: 'Pork', price: 0 },
                        { name: 'Beef', price: 1.00 },
                        { name: 'King Prawn', price: 2.50 }
                    ]
                }
            },
            {
                category_name: 'Main Courses',
                name: 'Kung Pao Chicken',
                description: 'Spicy diced chicken with peanuts and vegetables',
                price: 9.00,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 2,
                options: {
                    required: true,
                    choices: [
                        { name: 'Mild', price: 0 },
                        { name: 'Medium', price: 0 },
                        { name: 'Hot', price: 0 }
                    ]
                }
            },
            {
                category_name: 'Main Courses',
                name: 'Beef in Black Bean Sauce',
                description: 'Tender beef with black bean sauce and vegetables',
                price: 9.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 3
            },

            // Rice Dishes
            {
                category_name: 'Rice Dishes',
                name: 'Special Fried Rice',
                description: 'Egg fried rice with chicken, prawns and vegetables',
                price: 7.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 1
            },
            {
                category_name: 'Rice Dishes',
                name: 'Chicken Fried Rice',
                description: 'Egg fried rice with chicken and vegetables',
                price: 6.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 2
            },

            // Noodle Dishes
            {
                category_name: 'Noodle Dishes',
                name: 'Chicken Chow Mein',
                description: 'Stir-fried noodles with chicken and vegetables',
                price: 7.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 1
            },
            {
                category_name: 'Noodle Dishes',
                name: 'Beef Chow Mein',
                description: 'Stir-fried noodles with beef and vegetables',
                price: 8.00,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 2
            },

            // Side Dishes
            {
                category_name: 'Side Dishes',
                name: 'Steamed Rice',
                description: 'Plain steamed rice',
                price: 2.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 1
            },
            {
                category_name: 'Side Dishes',
                name: 'Mixed Vegetables',
                description: 'Stir-fried mixed vegetables',
                price: 4.00,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 2
            },

            // Drinks
            {
                category_name: 'Drinks',
                name: 'Coca Cola',
                description: '330ml can',
                price: 1.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 1
            },
            {
                category_name: 'Drinks',
                name: 'Diet Coke',
                description: '330ml can',
                price: 1.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 2
            },
            {
                category_name: 'Drinks',
                name: 'Sprite',
                description: '330ml can',
                price: 1.50,
                image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300',
                is_available: true,
                is_featured: false,
                sort_order: 3
            }
        ];

        // 获取分类ID
        const { data: categoryData } = await supabase
            .from('categories')
            .select('id, name')
            .eq('restaurant_id', restaurant.id);

        const categoryMap = {};
        categoryData.forEach(cat => {
            categoryMap[cat.name] = cat.id;
        });

        // 创建菜单项
        for (const item of menuItems) {
            const { error: itemError } = await supabase
                .from('menu_items')
                .upsert({
                    restaurant_id: restaurant.id,
                    category_id: categoryMap[item.category_name],
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    image_url: item.image_url,
                    is_available: item.is_available,
                    is_featured: item.is_featured,
                    sort_order: item.sort_order,
                    options: item.options || null
                });
            if (itemError) throw itemError;
        }
        console.log('✅ Menu items created');

        // 4. 创建配送区域规则
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

        // 创建配送区域表（如果不存在）
        const { error: zoneTableError } = await supabase
            .from('delivery_zones')
            .select('*')
            .limit(1);

        if (zoneTableError) {
            console.log('⚠️ Delivery zones table might already exist');
        }

        // 插入配送区域数据
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
                console.log('⚠️ Zone might already exist:', zone.postcode_prefix);
            }
        }
        console.log('✅ Delivery zones created');

        console.log('🎉 Database initialization completed successfully!');
        return { success: true };

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { initializeDatabase };