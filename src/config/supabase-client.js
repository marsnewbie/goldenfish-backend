// Supabase client configuration for backend
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://cyitrtjkoqxkolvtsydx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5aXRydGprb3F4a29sdnRzeWR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDUzMzEwMiwiZXhwIjoyMDcwMTA5MTAyfQ.tAsqtcGc-hqTdhYDHl4clsVcR-AG3LZudH305wClF4Y';

// Backend Supabase client with service role key for full database access
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

module.exports = { supabase };