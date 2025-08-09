// 企业级送餐费计算服务 - 支持1000+商家的专业配置系统
// 基于Uber Eats、JustEat、DoorDash等行业领导者的最佳实践

const { supabase } = require('../config/supabase-client');

/**
 * 🏢 企业级送餐费定价服务
 * 支持两种行业标准的定价模式：
 * 1. 基于距离的定价 (Distance-based) - 类似Uber Eats动态定价
 * 2. 基于邮编的定价 (Postcode-based) - 类似JustEat区域定价
 */
class DeliveryPricingService {
    constructor() {
        // Google Maps Distance Matrix API配置（企业级实现）
        this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.distanceApiUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    }

    /**
     * 🎯 核心方法：计算送餐费
     * @param {Object} params - 计算参数
     * @param {string} params.restaurantId - 餐厅ID  
     * @param {string} params.customerPostcode - 客户邮编
     * @param {string} params.customerAddress - 客户地址（距离计算用）
     * @param {number} params.orderValue - 订单金额
     * @returns {Promise<Object>} 计算结果
     */
    async calculateDeliveryFee(params) {
        const { restaurantId, customerPostcode, customerAddress, orderValue = 0 } = params;

        try {
            // 1. 获取餐厅配置
            const restaurantConfig = await this.getRestaurantConfig(restaurantId);
            if (!restaurantConfig) {
                throw new Error('Restaurant configuration not found');
            }

            // 2. 检查是否在送餐范围内
            const deliveryAvailable = await this.isDeliveryAvailable(
                restaurantConfig, 
                customerPostcode, 
                customerAddress
            );

            if (!deliveryAvailable.available) {
                return {
                    success: false,
                    error: 'Outside delivery area',
                    message: deliveryAvailable.message || 'Sorry, we do not deliver to this area'
                };
            }

            // 3. 根据定价模式计算费用
            let deliveryFee = 0;
            let calculationMethod = '';

            if (restaurantConfig.pricing_mode === 'distance') {
                const result = await this.calculateDistanceBasedFee(restaurantConfig, customerAddress);
                deliveryFee = result.fee;
                calculationMethod = `distance-based (${result.distance}km)`;
            } else if (restaurantConfig.pricing_mode === 'postcode') {
                const result = await this.calculatePostcodeBasedFee(restaurantConfig, customerPostcode);
                deliveryFee = result.fee;
                calculationMethod = `postcode-based (${result.zone})`;
            }

            // 4. 应用订单价值折扣（类似Uber Eats的动态定价）
            const finalFee = this.applyOrderValueDiscounts(deliveryFee, orderValue, restaurantConfig);

            // 5. 检查最低订单要求
            const minimumOrderCheck = this.checkMinimumOrder(orderValue, restaurantConfig, customerPostcode);

            return {
                success: true,
                deliveryFee: finalFee,
                originalFee: deliveryFee,
                calculationMethod,
                minimumOrder: minimumOrderCheck,
                estimatedTime: await this.estimateDeliveryTime(restaurantConfig, customerAddress),
                zone: deliveryAvailable.zone
            };

        } catch (error) {
            console.error('❌ Delivery fee calculation error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Unable to calculate delivery fee. Please try again.'
            };
        }
    }

    /**
     * 📊 获取餐厅配置（支持多租户）
     */
    async getRestaurantConfig(restaurantId) {
        const { data, error } = await supabase
            .from('restaurant_delivery_config')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .single();

        if (error) {
            console.error('Database error:', error);
            return null;
        }

        return data;
    }

    /**
     * 🗺️ 基于距离的送餐费计算 (类似Uber Eats)
     * 支持分层定价：0-1km £1, 1-2km £2, 2-3km £3, 3km+ 不送
     */
    async calculateDistanceBasedFee(config, customerAddress) {
        if (!this.googleMapsApiKey) {
            throw new Error('Google Maps API key not configured');
        }

        // 调用Google Distance Matrix API
        const distanceData = await this.getDistanceFromGoogle(
            config.restaurant_address,
            customerAddress
        );

        const distanceKm = distanceData.distance / 1000; // 转换为公里
        
        // 根据距离区间计算费用
        const distanceRules = config.distance_rules || [];
        
        for (const rule of distanceRules.sort((a, b) => a.max_distance - b.max_distance)) {
            if (distanceKm <= rule.max_distance) {
                return {
                    fee: rule.fee,
                    distance: distanceKm.toFixed(1),
                    travelTime: Math.round(distanceData.duration / 60) // 分钟
                };
            }
        }

        // 超出最大送餐距离
        throw new Error(`Delivery not available beyond ${Math.max(...distanceRules.map(r => r.max_distance))}km`);
    }

    /**
     * 📮 基于邮编的送餐费计算 (类似JustEat)
     * 支持精确匹配：YO10 3BP £2.50, 前缀匹配：YO10 £3.00, YO £4.00
     */
    async calculatePostcodeBasedFee(config, customerPostcode) {
        const postcodeRules = config.postcode_rules || [];
        const normalizedPostcode = this.normalizePostcode(customerPostcode);

        // 1. 尝试精确匹配（最高优先级）
        const exactMatch = postcodeRules.find(rule => 
            rule.postcode_pattern.toUpperCase() === normalizedPostcode
        );
        if (exactMatch) {
            return { fee: exactMatch.fee, zone: exactMatch.postcode_pattern };
        }

        // 2. 尝试前缀匹配（按长度倒序，优先匹配最具体的）
        const prefixMatches = postcodeRules
            .filter(rule => normalizedPostcode.startsWith(rule.postcode_pattern.toUpperCase()))
            .sort((a, b) => b.postcode_pattern.length - a.postcode_pattern.length);

        if (prefixMatches.length > 0) {
            const match = prefixMatches[0];
            return { fee: match.fee, zone: match.postcode_pattern };
        }

        // 3. 使用默认费用
        if (config.default_delivery_fee) {
            return { fee: config.default_delivery_fee, zone: 'default' };
        }

        throw new Error('Postcode not in delivery area');
    }

    /**
     * 🌍 检查送餐可用性
     */
    async isDeliveryAvailable(config, customerPostcode, customerAddress) {
        try {
            if (config.pricing_mode === 'distance' && customerAddress) {
                const maxDistance = Math.max(...(config.distance_rules || []).map(r => r.max_distance));
                const distanceData = await this.getDistanceFromGoogle(config.restaurant_address, customerAddress);
                const distanceKm = distanceData.distance / 1000;
                
                return {
                    available: distanceKm <= maxDistance,
                    zone: `${distanceKm.toFixed(1)}km`,
                    message: distanceKm > maxDistance ? `Maximum delivery distance is ${maxDistance}km` : null
                };
            } else if (config.pricing_mode === 'postcode') {
                const result = await this.calculatePostcodeBasedFee(config, customerPostcode);
                return {
                    available: true,
                    zone: result.zone
                };
            }
            
            return { available: false, message: 'Invalid delivery configuration' };
        } catch (error) {
            return { available: false, message: error.message };
        }
    }

    /**
     * 🚗 Google Maps Distance Matrix API调用
     */
    async getDistanceFromGoogle(origin, destination) {
        const params = new URLSearchParams({
            origins: origin,
            destinations: destination,
            units: 'metric',
            mode: 'driving',
            key: this.googleMapsApiKey
        });

        const response = await fetch(`${this.distanceApiUrl}?${params}`);
        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Google Maps API error: ${data.status}`);
        }

        const element = data.rows[0].elements[0];
        if (element.status !== 'OK') {
            throw new Error(`Distance calculation failed: ${element.status}`);
        }

        return {
            distance: element.distance.value, // meters
            duration: element.duration.value, // seconds
            distanceText: element.distance.text,
            durationText: element.duration.text
        };
    }

    /**
     * 💰 应用订单价值折扣
     */
    applyOrderValueDiscounts(baseFee, orderValue, config) {
        const discounts = config.order_value_discounts || [];
        
        for (const discount of discounts.sort((a, b) => b.min_order_value - a.min_order_value)) {
            if (orderValue >= discount.min_order_value) {
                if (discount.type === 'percentage') {
                    return baseFee * (1 - discount.value / 100);
                } else if (discount.type === 'fixed_reduction') {
                    return Math.max(0, baseFee - discount.value);
                } else if (discount.type === 'free_delivery') {
                    return 0;
                }
            }
        }
        
        return baseFee;
    }

    /**
     * 📊 检查最低订单要求
     */
    checkMinimumOrder(orderValue, config, customerPostcode) {
        const minimumOrders = config.minimum_order_rules || [];
        
        for (const rule of minimumOrders) {
            if (rule.applies_to === 'all' || 
                (rule.applies_to === 'postcode' && customerPostcode.startsWith(rule.postcode_pattern))) {
                return {
                    required: rule.minimum_amount,
                    current: orderValue,
                    met: orderValue >= rule.minimum_amount,
                    shortfall: Math.max(0, rule.minimum_amount - orderValue)
                };
            }
        }
        
        return { required: 0, current: orderValue, met: true, shortfall: 0 };
    }

    /**
     * ⏰ 预估送餐时间
     */
    async estimateDeliveryTime(config, customerAddress) {
        const basePreparationTime = config.preparation_time_minutes || 30;
        
        if (config.pricing_mode === 'distance' && customerAddress && this.googleMapsApiKey) {
            try {
                const distanceData = await this.getDistanceFromGoogle(config.restaurant_address, customerAddress);
                const travelTime = Math.round(distanceData.duration / 60);
                return basePreparationTime + travelTime + 5; // 5分钟缓冲
            } catch (error) {
                console.warn('Failed to calculate travel time:', error);
            }
        }
        
        return basePreparationTime + 15; // 默认添加15分钟送餐时间
    }

    /**
     * 📮 邮编标准化
     */
    normalizePostcode(postcode) {
        const cleaned = postcode.replace(/\s/g, '').toUpperCase();
        if (cleaned.length > 3) {
            return cleaned.slice(0, -3) + ' ' + cleaned.slice(-3);
        }
        return cleaned;
    }

    /**
     * 🏪 创建默认餐厅配置（用于测试）
     */
    async createDefaultRestaurantConfig(restaurantId, restaurantAddress) {
        const defaultConfig = {
            restaurant_id: restaurantId,
            restaurant_address: restaurantAddress,
            pricing_mode: 'postcode', // 'distance' 或 'postcode'
            
            // 基于邮编的规则 (JustEat模式)
            postcode_rules: [
                { postcode_pattern: 'YO10 3BP', fee: 2.50 },
                { postcode_pattern: 'YO10 3B', fee: 2.75 },
                { postcode_pattern: 'YO10', fee: 3.00 },
                { postcode_pattern: 'YO1', fee: 3.50 },
                { postcode_pattern: 'YO', fee: 4.00 }
            ],
            
            // 基于距离的规则 (Uber Eats模式)
            distance_rules: [
                { max_distance: 1, fee: 1.50 },
                { max_distance: 2, fee: 2.50 },
                { max_distance: 3, fee: 3.50 },
                { max_distance: 5, fee: 5.00 }
            ],
            
            // 订单价值折扣
            order_value_discounts: [
                { min_order_value: 25, type: 'free_delivery', value: 0 },
                { min_order_value: 20, type: 'fixed_reduction', value: 1.00 },
                { min_order_value: 15, type: 'percentage', value: 50 }
            ],
            
            // 最低订单要求
            minimum_order_rules: [
                { applies_to: 'all', minimum_amount: 12.00 },
                { applies_to: 'postcode', postcode_pattern: 'YO1', minimum_amount: 15.00 }
            ],
            
            default_delivery_fee: 3.50,
            preparation_time_minutes: 35,
            max_delivery_distance_km: 5,
            
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return defaultConfig;
    }
}

module.exports = DeliveryPricingService;