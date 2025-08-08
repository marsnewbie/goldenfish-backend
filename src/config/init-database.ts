import { supabase } from './supabase-client';

// Simplified database initialization - checks if tables exist
export async function initializeDatabase() {
  console.log('🔄 Checking Supabase database tables...');

  try {
    // Check if tables exist by trying to select from them
    await checkUsersTable();
    await checkUserAddressesTable();
    await checkOrdersTable();
    await ensureTestUser();
    
    console.log('✅ Database verification completed successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function checkUsersTable() {
  const { error } = await supabase
    .from('users')
    .select('id')
    .limit(1);
    
  if (error) {
    console.log('❌ Users table does not exist or is not accessible');
    console.log('Please run setup-supabase-tables.sql in Supabase Dashboard');
    throw new Error('Users table missing');
  } else {
    console.log('✅ Users table exists');
  }
}

async function checkUserAddressesTable() {
  const { error } = await supabase
    .from('user_addresses')
    .select('id')
    .limit(1);
    
  if (error) {
    console.log('❌ User addresses table does not exist or is not accessible');
    throw new Error('User addresses table missing');
  } else {
    console.log('✅ User addresses table exists');
  }
}

async function checkOrdersTable() {
  const { error } = await supabase
    .from('orders')
    .select('id')
    .limit(1);
    
  if (error) {
    console.log('❌ Orders table does not exist or is not accessible');
    throw new Error('Orders table missing');
  } else {
    console.log('✅ Orders table exists');
  }
}

async function ensureTestUser() {
  try {
    // Check if test user exists
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'test@goldenfish.co.uk')
      .limit(1);

    if (selectError) {
      console.log('Error checking test user:', selectError.message);
      return;
    }

    if (!existingUser || existingUser.length === 0) {
      // Create test user with bcrypt hash for password 'test123'
      const { error } = await supabase
        .from('users')
        .insert({
          email: 'test@goldenfish.co.uk',
          first_name: 'Test',
          last_name: 'User',
          phone: '01904123456',
          password_hash: '$2a$12$rMaFzFz7qQq5rNgZJ7cFl.wJ8rV5x5XzKd5pXJ9Zq5pqZrTlrOxkG', // test123
          status: 'active'
        });

      if (error) {
        console.log('Test user creation error:', error.message);
      } else {
        console.log('✅ Test user created: test@goldenfish.co.uk / test123');
      }
    } else {
      console.log('✅ Test user already exists');
    }
  } catch (error) {
    console.log('Error in ensureTestUser:', error);
  }
}

// Export for use in app startup
export default initializeDatabase;