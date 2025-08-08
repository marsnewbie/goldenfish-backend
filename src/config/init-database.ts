import { supabase } from './supabase-client';

// Initialize database tables for Golden Fish ordering system
export async function initializeDatabase() {
  console.log('🔄 Initializing Supabase database tables...');

  try {
    // Create users table
    await createUsersTable();
    
    // Create user_addresses table
    await createUserAddressesTable();
    
    // Create orders table
    await createOrdersTable();
    
    // Create a test user
    await createTestUser();
    
    console.log('✅ Database initialization completed successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function createUsersTable() {
  const { error } = await supabase.rpc('create_users_table');
  if (error && !error.message.includes('already exists')) {
    // Create via SQL if RPC doesn't work
    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20),
          password_hash VARCHAR(255) NOT NULL,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
          created_at TIMESTAMP DEFAULT NOW(),
          last_login_at TIMESTAMP,
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      `
    });
    
    if (sqlError) console.log('Users table creation:', sqlError.message);
  }
}

async function createUserAddressesTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        street VARCHAR(200) NOT NULL,
        city VARCHAR(100) NOT NULL,
        postcode VARCHAR(20) NOT NULL,
        instructions TEXT,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
    `
  });
  
  if (error) console.log('User addresses table creation:', error.message);
}

async function createOrdersTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        customer_name VARCHAR(200) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('delivery', 'collection')),
        delivery_address JSONB,
        items JSONB NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
        special_instructions TEXT,
        estimated_time VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    `
  });
  
  if (error) console.log('Orders table creation:', error.message);
}

async function createTestUser() {
  // Check if test user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'test@goldenfish.co.uk')
    .single();

  if (!existingUser) {
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
}

// Export for use in app startup
export default initializeDatabase;