import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './environment';

// Supabase configuration for backend
const SUPABASE_URL = 'https://cyitrtjkoqxkolvtsydx.supabase.co';
const SUPABASE_SERVICE_KEY = config.supabaseServiceKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5aXRydGprb3F4a29sdnRzeWR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDUzMzEwMiwiZXhwIjoyMDcwMTA5MTAyfQ.tAsqtcGc-hqTdhYDHl4clsVcR-AG3LZudH305wClF4Y'; // Service role key with full access

// Initialize Supabase client for backend operations
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'X-Client-Info': 'goldenfish-backend@1.0.0'
      }
    }
  }
);

/**
 * Verify user JWT token from frontend
 */
export async function verifyUserToken(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      // Don't log errors for expected invalid tokens to reduce noise
      throw new Error('Invalid token');
    }
    
    console.log('✅ Token verified for user:', user.email);
    return user;
  } catch (error) {
    // Only log unexpected errors, not authentication failures
    if ((error as Error).message !== 'Invalid token') {
      console.error('⚠️ Unexpected token verification error:', error);
    }
    throw new Error('Authentication failed');
  }
}

/**
 * Simplified user profile - no database dependencies
 * Returns mock data for single restaurant setup
 */
export async function getUserProfile(userId: string) {
  try {
    console.log('🔍 Getting simplified user profile for:', userId);

    // Return mock profile data for single restaurant
    const mockProfile = {
      id: userId,
      first_name: null,
      last_name: null,
      phone: null,
      auth_method: 'magic_link',
      last_sign_in_at: new Date().toISOString(),
      sign_in_count: 1
    };

    const mockTenant = {
      id: 'golden-fish-default',
      name: 'Golden Fish',
      slug: 'golden-fish',
      type: 'restaurant'
    };

    return {
      profile: mockProfile,
      tenants: [{ tenants: mockTenant, role: 'customer' }],
      currentTenant: mockTenant
    };
  } catch (error) {
    console.error('Error in simplified user profile:', error);
    // Return basic structure even on error - maintain same type structure
    return {
      profile: {
        id: userId,
        first_name: null,
        last_name: null,
        phone: null,
        auth_method: 'unknown',
        last_sign_in_at: new Date().toISOString(),
        sign_in_count: 0
      },
      tenants: [],
      currentTenant: null
    };
  }
}

/**
 * Simplified user profile handling - no database dependencies
 * Just log user info for debugging
 */
export async function ensureUserProfile(user: any) {
  try {
    // Simplified approach - just log the user and return basic info
    console.log('✅ User authenticated:', {
      id: user.id,
      email: user.email,
      auth_method: getAuthMethod(user)
    });

    // Return mock profile data to maintain API compatibility
    return {
      id: user.id,
      first_name: user.user_metadata?.first_name || null,
      last_name: user.user_metadata?.last_name || null,
      auth_method: getAuthMethod(user),
      last_sign_in_at: new Date().toISOString(),
      sign_in_count: 1
    };
  } catch (error) {
    console.error('Error in simplified user profile:', error);
    // Don't throw error - just return basic user info
    return {
      id: user.id,
      first_name: null,
      last_name: null,
      auth_method: 'unknown',
      last_sign_in_at: new Date().toISOString(),
      sign_in_count: 1
    };
  }
}

function getAuthMethod(user: any): string {
  const provider = user.app_metadata?.provider;
  switch (provider) {
    case 'google': return 'oauth_google';
    case 'apple': return 'oauth_apple';
    case 'email': return 'magic_link';
    default: return 'unknown';
  }
}

export default supabase;