import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YWlydmZna2xpYmhhbWtwZXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODI1NjI3OCwiZXhwIjoyMTAzODMyMjc4fQ.TSNVs8_Yo3jb-7L6syqhn68xMu1iYn2Q_PXEKSa6WSQ';

/**
 * Returns an administrative Supabase client using the Service Role Key.
 * Bypasses Row Level Security (RLS) for server-only backend operations
 * such as authentication, administrative verification, and organization provisioning.
 * 
 * NEVER import or use this function in client components.
 */
export function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
