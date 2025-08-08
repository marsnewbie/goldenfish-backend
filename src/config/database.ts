// Professional Supabase integration for Golden Fish ordering system
import { supabase } from './supabase-client';
import { createClient } from 'redis';
import config from './environment';

// Database interface using Supabase client
export const db = {
  // Compatible wrapper for existing query interface
  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    try {
      // Convert SQL query to Supabase format based on query type
      if (sql.includes('SELECT') && sql.includes('FROM users')) {
        return await this.handleUserQuery(params);
      } else if (sql.includes('INSERT INTO users')) {
        return await this.handleUserInsert(params);
      } else if (sql.includes('UPDATE users')) {
        return await this.handleUserUpdate(params);
      } else if (sql.includes('user_addresses')) {
        return await this.handleAddressQuery(params);
      } else {
        console.warn('Unsupported query type, returning empty result:', sql.substring(0, 50));
        return { rows: [] };
      }
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  async handleUserQuery(params: any[]): Promise<{ rows: any[] }> {
    const email = params[0];
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, password_hash, created_at, last_login_at, status')
      .eq('email', email)
      .eq('status', 'active');

    if (error) throw error;
    return { rows: data || [] };
  },

  async handleUserInsert(params: any[]): Promise<{ rows: any[] }> {
    const [email, firstName, lastName, phone, passwordHash] = params;
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        password_hash: passwordHash,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select('id, email, first_name, last_name, phone, created_at')
      .single();

    if (error) throw error;
    return { rows: [data] };
  },

  async handleUserUpdate(params: any[]): Promise<{ rows: any[] }> {
    const userId = params[0];
    const { data, error } = await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId)
      .select();

    if (error) throw error;
    return { rows: data || [] };
  },

  async handleAddressQuery(params: any[]): Promise<{ rows: any[] }> {
    const userId = params[0];
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (error) throw error;
    return { rows: data || [] };
  }
};

// Redis client (simplified for compatibility)
export const redis = createClient({
  url: config.redisUrl,
});

// Database connection handlers (stubs for compatibility)
export async function connectDatabase(): Promise<void> {
  console.log('✅ Using Supabase client - no direct connection needed');
  // Test Supabase connection
  try {
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connection tested successfully');
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    // Don't throw - allow app to start and handle errors per request
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
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