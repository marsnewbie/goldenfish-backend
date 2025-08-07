import { Router, Request, Response } from 'express';
import { verifyUserToken, getUserProfile, ensureUserProfile } from '../config/supabase';
import { standardLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * Middleware to verify Supabase JWT token
 */
async function verifySupabaseAuth(req: Request, res: Response, next: Function) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided'
      });
      return;
    }

    // Verify token with Supabase
    const user = await verifyUserToken(token);
    
    // Add user to request object
    (req as any).user = user;
    next();
    
  } catch (error) {
    console.error('❌ Supabase token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'Authentication failed'
    });
    return;
  }
}

/**
 * Get user profile with tenant information
 * Used by frontend to load user data after Supabase authentication
 */
router.get('/profile', standardLimiter, verifySupabaseAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log('📋 Getting user profile:', { userId: user.id, email: user.email });

    // Ensure user profile exists in our system
    await ensureUserProfile(user);

    // Get complete profile with tenant info
    const profileData = await getUserProfile(user.id);

    console.log('✅ Profile retrieved:', { 
      userId: user.id, 
      tenantsCount: profileData.tenants.length 
    });

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: profileData.profile?.first_name,
          lastName: profileData.profile?.last_name,
          phone: profileData.profile?.phone,
          lastSignIn: profileData.profile?.last_sign_in_at,
          authMethod: profileData.profile?.auth_method
        },
        tenant: profileData.currentTenant,
        tenants: profileData.tenants.map((ut: any) => ({
          id: ut.tenants?.id,
          name: ut.tenants?.name,
          slug: ut.tenants?.slug,
          role: ut.role
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve user profile'
    });
  }
});

/**
 * Update user profile
 */
router.put('/profile', standardLimiter, verifySupabaseAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const updates = req.body;

    console.log('📝 Updating user profile:', { userId: user.id, updates: Object.keys(updates) });

    // Update profile in Supabase
    const { supabase } = await import('../config/supabase');
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        first_name: updates.firstName,
        last_name: updates.lastName,
        phone: updates.phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Profile updated:', { userId: user.id });

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile: data
      }
    });

  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update profile'
    });
  }
});

/**
 * Get user's order history (authenticated)
 */
router.get('/orders', standardLimiter, verifySupabaseAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;

    console.log('📋 Getting user orders:', { userId: user.id, page, limit });

    // Get orders from Supabase
    const { supabase } = await import('../config/supabase');
    
    const { data: orders, error, count } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          name,
          quantity,
          unit_price,
          total_price,
          customizations
        )
      `, { count: 'exact' })
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    console.log('✅ Orders retrieved:', { userId: user.id, count: orders?.length || 0 });

    return res.json({
      success: true,
      data: {
        orders: orders || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting user orders:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve orders'
    });
  }
});

/**
 * Save user delivery address
 */
router.post('/addresses', standardLimiter, verifySupabaseAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { address, isDefault = false } = req.body;

    console.log('💾 Saving user address:', { userId: user.id, isDefault });

    // Update user profile with new address
    const { supabase } = await import('../config/supabase');
    
    // If this is the default address, update the profile
    if (isDefault) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          default_delivery_address: address,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }
    }

    // Add to addresses array
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('addresses')
      .eq('id', user.id)
      .single();

    const addresses = profile?.addresses || [];
    const newAddress = {
      id: Date.now().toString(),
      ...address,
      isDefault,
      createdAt: new Date().toISOString()
    };

    // If this is default, remove default from others
    if (isDefault) {
      addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    addresses.unshift(newAddress);

    const { error } = await supabase
      .from('user_profiles')
      .update({
        addresses: addresses.slice(0, 5), // Keep only 5 most recent
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    console.log('✅ Address saved:', { userId: user.id, addressCount: addresses.length });

    return res.json({
      success: true,
      message: 'Address saved successfully',
      data: {
        address: newAddress
      }
    });

  } catch (error) {
    console.error('❌ Error saving address:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to save address'
    });
  }
});

export default router;
export { verifySupabaseAuth };