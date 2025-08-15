// 🚚 企业级送餐费API路由
// 支持1000+商家的专业送餐费计算系统
const express = require('express');
const { body, validationResult } = require('express-validator');
const DeliveryPricingService = require('../services/DeliveryPricingService');
const { standardLimiter } = require('../middleware/rateLimiter');
const { supabase } = require('../config/supabase-client');

const router = express.Router();
const deliveryService = new DeliveryPricingService();

/**
 * @route   POST /api/delivery/check-postcode
 * @desc    检查邮编是否在配送范围内
 * @access  Public
 */
router.post('/check-postcode',
    standardLimiter,
    [
        body('postcode')
            .trim()
            .isLength({ min: 2, max: 10 })
            .withMessage('Valid UK postcode is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array().map(err => err.msg)
                });
            }

            const { postcode } = req.body;
            const cleanPostcode = postcode.toUpperCase().replace(/\s+/g, '');

            console.log('🔍 Checking postcode:', cleanPostcode);

            // 检查配送区域
            const { data: zones, error } = await supabase
                .from('delivery_zones')
                .select('*')
                .eq('is_available', true);

            if (error) {
                console.error('❌ Database error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Database error',
                    details: error.message
                });
            }

            // 查找匹配的邮编前缀
            const matchedZone = zones.find(zone => 
                cleanPostcode.startsWith(zone.postcode_prefix.replace(/\s+/g, ''))
            );

            if (matchedZone) {
                console.log('✅ Postcode in delivery zone:', matchedZone);
                return res.json({
                    success: true,
                    deliveryFee: matchedZone.delivery_fee,
                    zone: matchedZone.postcode_prefix,
                    message: `Delivery available to ${matchedZone.postcode_prefix}`
                });
            } else {
                console.log('❌ Postcode not in delivery zone:', cleanPostcode);
                return res.json({
                    success: false,
                    message: 'Sorry, we do not deliver to this postcode. You can place an order for collection.'
                });
            }

        } catch (error) {
            console.error('❌ Postcode check error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking postcode'
            });
        }
    }
);

/**
 * @route   GET /api/delivery/times
 * @desc    获取可用的配送时间
 * @access  Public
 */
router.get('/times', async (req, res) => {
    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // 生成未来2小时的配送时间
        const deliveryTimes = [];
        let startHour = currentHour + 1;
        
        for (let i = 0; i < 8; i++) {
            const hour = (startHour + i) % 24;
            if (hour >= 11 && hour <= 21) { // 营业时间
                deliveryTimes.push({
                    value: `${hour.toString().padStart(2, '0')}:00`,
                    label: `${hour.toString().padStart(2, '0')}:00`
                });
                deliveryTimes.push({
                    value: `${hour.toString().padStart(2, '0')}:30`,
                    label: `${hour.toString().padStart(2, '0')}:30`
                });
            }
        }

        res.json({
            success: true,
            times: deliveryTimes
        });

    } catch (error) {
        console.error('❌ Delivery times error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting delivery times'
        });
    }
});

/**
 * @route   POST /api/delivery/calculate-fee
 * @desc    计算送餐费 - 企业级API
 * @access  Public
 */
router.post('/calculate-fee', 
    standardLimiter,
    [
        body('restaurantId')
            .optional()
            .isString()
            .withMessage('Valid restaurant ID is required'),
        
        body('customerPostcode')
            .trim()
            .isLength({ min: 2, max: 10 })
            .withMessage('Valid UK postcode is required'),
        
        body('customerAddress')
            .optional()
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage('Customer address must be between 5-200 characters'),
            
        body('orderValue')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Order value must be a positive number')
    ],
    async (req, res) => {
        try {
            // 验证输入
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array().map(err => err.msg)
                });
            }

            const { restaurantId, customerPostcode, customerAddress, orderValue } = req.body;

            console.log('🚚 Calculating delivery fee:', {
                restaurantId,
                customerPostcode,
                orderValue: orderValue || 0
            });

            // 调用企业级送餐费计算服务
            const result = await deliveryService.calculateDeliveryFee({
                restaurantId,
                customerPostcode,
                customerAddress,
                orderValue: orderValue || 0
            });

            if (result.success) {
                console.log('✅ Delivery fee calculated:', {
                    fee: result.deliveryFee,
                    method: result.calculationMethod,
                    zone: result.zone
                });

                res.json({
                    success: true,
                    data: {
                        deliveryFee: result.deliveryFee,
                        originalFee: result.originalFee,
                        calculationMethod: result.calculationMethod,
                        zone: result.zone,
                        estimatedTime: result.estimatedTime,
                        minimumOrder: result.minimumOrder,
                        timestamp: new Date().toISOString()
                    }
                });
            } else {
                console.warn('❌ Delivery fee calculation failed:', result.error);
                res.status(400).json({
                    success: false,
                    message: result.message || 'Unable to calculate delivery fee',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('❌ Delivery fee API error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error calculating delivery fee',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

/**
 * @route   GET /api/delivery/zones/:restaurantId  
 * @desc    获取餐厅送餐区域配置 - 管理员API
 * @access  Public (可加权限控制)
 */
router.get('/zones/:restaurantId', standardLimiter, async (req, res) => {
    try {
        const { restaurantId } = req.params;

        if (!restaurantId || isNaN(parseInt(restaurantId))) {
            return res.status(400).json({
                success: false,
                message: 'Valid restaurant ID is required'
            });
        }

        const config = await deliveryService.getRestaurantConfig(parseInt(restaurantId));
        
        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Restaurant configuration not found'
            });
        }

        res.json({
            success: true,
            data: {
                restaurantId: config.restaurant_id,
                restaurantName: config.restaurant_name,
                pricingMode: config.pricing_mode,
                postcodeRules: config.postcode_rules || [],
                distanceRules: config.distance_rules || [],
                orderValueDiscounts: config.order_value_discounts || [],
                minimumOrderRules: config.minimum_order_rules || [],
                defaultDeliveryFee: config.default_delivery_fee,
                maxDeliveryDistance: config.max_delivery_distance_km,
                preparationTime: config.preparation_time_minutes,
                isActive: config.is_active,
                deliveryEnabled: config.delivery_enabled
            }
        });

    } catch (error) {
        console.error('❌ Get delivery zones error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery zones'
        });
    }
});

/**
 * @route   POST /api/delivery/validate-postcode
 * @desc    验证邮编是否在送餐范围内 - 快速检查API
 * @access  Public
 */
router.post('/validate-postcode',
    standardLimiter,
    [
        body('restaurantId')
            .isInt({ min: 1 })
            .withMessage('Valid restaurant ID is required'),
        
        body('postcode')
            .trim()
            .isLength({ min: 2, max: 10 })
            .withMessage('Valid UK postcode is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array().map(err => err.msg)
                });
            }

            const { restaurantId, postcode } = req.body;

            // 快速验证，不计算详细费用
            const result = await deliveryService.calculateDeliveryFee({
                restaurantId,
                customerPostcode: postcode,
                orderValue: 0
            });

            res.json({
                success: true,
                data: {
                    available: result.success,
                    zone: result.zone || null,
                    estimatedFee: result.success ? result.deliveryFee : null,
                    message: result.success ? 'Delivery available' : result.message
                }
            });

        } catch (error) {
            console.error('❌ Postcode validation error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to validate postcode'
            });
        }
    }
);

/**
 * @route   GET /api/delivery/health
 * @desc    送餐服务健康检查
 * @access  Public
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Enterprise Delivery Pricing Service',
        version: '1.0.0',
        features: [
            'Distance-based pricing (Google Maps integration)',
            'Postcode-based zone pricing',
            'Order value discounts',
            'Minimum order requirements',
            'Multi-tenant restaurant support'
        ],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;