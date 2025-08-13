// Supabase client configuration for backend
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://hfrijjfeorzpibzqnmeg.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmcmlqamZlb3J6cGlienFubWVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTA3ODU2NCwiZXhwIjoyMDcwNjU0NTY0fQ.ltVqL29OTmlsRYnlb7Q294kI6ymDNS10aTtdWNBRoj4';

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