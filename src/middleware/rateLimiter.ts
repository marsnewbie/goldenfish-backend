import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { redis } from '../config/database';
// import config from '../config/environment'; // Not needed currently

// Temporarily use memory for rate limiting due to Redis compatibility issues
const useRedis = false; // TODO: Fix Redis compatibility with rate-limiter-flexible

const rateLimiterOptions = {
  storeClient: useRedis ? redis : undefined,
  keyPrefix: 'rl_goldenfish',
  execEvenly: true,
};

/**
 * Rate limiters for different endpoints
 */
export const rateLimiter = {
  // Order creation: 5 orders per 10 minutes per IP
  orderCreation: useRedis 
    ? new RateLimiterRedis({
        ...rateLimiterOptions,
        points: 5,
        duration: 600, // 10 minutes
      })
    : new RateLimiterMemory({
        points: 5,
        duration: 600,
      }),

  // Order lookup: 10 requests per minute per IP
  orderLookup: useRedis
    ? new RateLimiterRedis({
        ...rateLimiterOptions,
        points: 10,
        duration: 60, // 1 minute
      })
    : new RateLimiterMemory({
        points: 10,
        duration: 60,
      }),

  // Standard API: 30 requests per minute per IP
  standard: useRedis
    ? new RateLimiterRedis({
        ...rateLimiterOptions,
        points: 30,
        duration: 60, // 1 minute
      })
    : new RateLimiterMemory({
        points: 30,
        duration: 60,
      }),

  // Admin API: 100 requests per minute per IP
  admin: useRedis
    ? new RateLimiterRedis({
        ...rateLimiterOptions,
        points: 100,
        duration: 60, // 1 minute
      })
    : new RateLimiterMemory({
        points: 100,
        duration: 60,
      }),
};

/**
 * Rate limiter middleware factory
 */
function createRateLimiterMiddleware(limiter: RateLimiterRedis | RateLimiterMemory) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Use IP address as key
      const key = req.ip || req.connection.remoteAddress || 'unknown';
      
      await limiter.consume(key);
      next();
    } catch (rateLimiterRes) {
      // Rate limit exceeded
      const secs = Math.round((rateLimiterRes as any).msBeforeNext / 1000) || 1;
      
      res.set('Retry-After', String(secs));
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${secs} seconds.`,
        retryAfter: secs
      });
    }
  };
}

// Export middleware functions
export const orderCreationLimiter = createRateLimiterMiddleware(rateLimiter.orderCreation);
export const orderLookupLimiter = createRateLimiterMiddleware(rateLimiter.orderLookup);
export const standardLimiter = createRateLimiterMiddleware(rateLimiter.standard);
export const adminLimiter = createRateLimiterMiddleware(rateLimiter.admin);