import { redis } from '../config/database';
import config from '../config/environment';

export class OrderNumberGenerator {
  private static prefix = config.orderNumberPrefix;

  /**
   * Generate daily sequential order number (GF250806-001)
   */
  static async generateDailySequential(): Promise<string> {
    const now = new Date();
    const dateStr = now.getFullYear().toString().slice(-2) + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    
    const counterKey = `order_counter:${dateStr}`;
    
    try {
      // Use Redis INCR for atomic counter increment
      const dailyCounter = await redis.incr(counterKey);
      
      // Set expiry for the counter (48 hours to handle timezone issues)
      if (dailyCounter === 1) {
        await redis.expire(counterKey, 48 * 60 * 60);
      }
      
      return `${this.prefix}${dateStr}-${dailyCounter.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Redis error, falling back to timestamp:', error);
      return this.generateTimestampBased();
    }
  }

  /**
   * Generate long random order number (GF-ABC123DEF456)
   */
  static generateLongRandom(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = `${this.prefix}-`;
    
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Fallback: timestamp-based order number
   */
  static generateTimestampBased(): string {
    return `${this.prefix}${Date.now().toString().slice(-8)}`;
  }

  /**
   * Validate order number format
   */
  static isValidFormat(orderNumber: string): boolean {
    const patterns = [
      new RegExp(`^${this.prefix}\\d{6}-\\d{3}$`), // Daily sequential: GF250806-001
      new RegExp(`^${this.prefix}-[A-Z0-9]{12}$`),  // Long random: GF-ABC123DEF456
      new RegExp(`^${this.prefix}\\d{8,}$`)         // Timestamp: GF12345678
    ];
    
    return patterns.some(pattern => pattern.test(orderNumber));
  }
}

/**
 * Get order statistics for admin dashboard
 */
export async function getOrderStats(date: string): Promise<{ count: number; latestNumber: string }> {
  const counterKey = `order_counter:${date}`;
  
  try {
    const count = await redis.get(counterKey);
    const orderCount = count ? parseInt(count, 10) : 0;
    const latestNumber = orderCount > 0 
      ? `${config.orderNumberPrefix}${date}-${orderCount.toString().padStart(3, '0')}` 
      : '';
    
    return { count: orderCount, latestNumber };
  } catch (error) {
    console.error('Error getting order stats:', error);
    return { count: 0, latestNumber: '' };
  }
}