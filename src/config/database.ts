import { Pool } from 'pg';
import { createClient } from 'redis';
import config from './environment';

// PostgreSQL connection pool - use individual params to avoid IPv6
export const db = new Pool({
  host: 'db.cyitrtjkoqxkolvtsydx.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Qwer63722484!',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Redis client
export const redis = createClient({
  url: config.redisUrl,
});

// Database connection handlers
export async function connectDatabase(): Promise<void> {
  try {
    // Test PostgreSQL connection
    const client = await db.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();

    // Connect to Redis
    if (!redis.isOpen) {
      await redis.connect();
      console.log('✅ Redis connected successfully');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await db.end();
    if (redis.isOpen) {
      await redis.quit();
    }
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', disconnectDatabase);
process.on('SIGINT', disconnectDatabase);