import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cyitrtjkoqxkolvtsydx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5aXRydGprb3F4a29sdnRzeWR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDUzMzEwMiwiZXhwIjoyMDcwMTA5MTAyfQ.tAsqtcGc-hqTdhYDHl4clsVcR-AG3LZudH305wClF4Y';

// Backend Supabase client with service role key
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});