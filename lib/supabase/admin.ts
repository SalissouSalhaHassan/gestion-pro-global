import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

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
