import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data: users, error } = await supabase.from('users').select('id, utilisateur, mot_de_passe');
    return NextResponse.json({
      hasEnvServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      envKeyPrefix: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').substring(0, 15),
      error: error ? error.message : null,
      usersFound: users ? users.length : 0,
      usernames: users ? users.map((u: any) => u.utilisateur) : []
    });
  } catch (err: any) {
    return NextResponse.json({ exception: err.message }, { status: 500 });
  }
}
