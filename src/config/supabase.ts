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
      throw new Error('Invalid token');
    }
    
    return user;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Authentication failed');
  }
}

/**
 * Get user profile with tenant information
 */
export async function getUserProfile(userId: string) {
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    // Get user tenants
    const { data: userTenants, error: tenantsError } = await supabase
      .from('user_tenants')
      .select(`
        tenant_id,
        role,
        tenants (
          id,
          name,
          slug,
          type,
          settings
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (tenantsError) {
      throw tenantsError;
    }

    return {
      profile,
      tenants: userTenants || [],
      currentTenant: userTenants?.[0]?.tenants || null
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

/**
 * Create user profile if it doesn't exist
 */
export async function ensureUserProfile(user: any) {
  try {
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      return existingProfile;
    }

    // Create new profile
    const { data: newProfile, error } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        first_name: user.user_metadata?.first_name,
        last_name: user.user_metadata?.last_name,
        auth_method: getAuthMethod(user),
        last_sign_in_at: new Date().toISOString(),
        sign_in_count: 1
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return newProfile;
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    throw error;
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