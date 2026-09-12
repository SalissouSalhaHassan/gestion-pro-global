import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { signSession, signSessionCookie } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Identifiant et mot de passe requis' }, { status: 400 });
    }

    const trimmedUser = String(username).trim();
    const supabase = getAdminClient();

    // 1. Verify user in database (bypasses RLS on server, case-insensitive)
    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .ilike('utilisateur', trimmedUser)
      .eq('mot_de_passe', password)
      .maybeSingle();

    if (fetchError || !userRecord) {
      console.warn('Auth Login failed for:', trimmedUser, fetchError?.message);
      return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 });
    }

    // 2. Fetch user permissions (optional but good for parity)
    const { data: perms } = await supabase
      .from('role_permissions')
      .select('permissions(permission_key)')
      .eq('role_id', userRecord.role_id);

    const permissionKeys = perms?.map((p: any) => p.permissions.permission_key) || [];

    // Fetch user depots from user_warehouses as fallback
    const { data: userWarehouses } = await supabase
      .from('user_warehouses')
      .select('depot_id, is_primary, depots(nom)')
      .eq('user_id', userRecord.id);

    const userDepotsList = userWarehouses?.map((uw: any) => uw.depots?.nom).filter(Boolean) || [];
    const depotsString = userDepotsList.length > 0 ? userDepotsList.join(", ") : (userRecord.depots || "");

    // Determine primary depot (emplacement) dynamically with safe fallback
    let primaryDepot = userRecord.emplacement || '';
    if (!primaryDepot && userWarehouses && userWarehouses.length > 0) {
      const primaryUw = (userWarehouses as any[]).find((uw: any) => uw.is_primary) || userWarehouses[0];
      primaryDepot = primaryUw.depots?.nom || '';
    }

    // 3. Create session data (parity with cookie logic)
    const adminVal = userRecord.admin?.toString().toLowerCase();
    const isAdmin = (adminVal === 'oui' || adminVal === 'admin' || adminVal === 'administrateur');
    
    const sessionData = {
      id: userRecord.id,
      username: userRecord.utilisateur,
      role: userRecord.role_id,
      admin: isAdmin ? 'Oui' : 'Non',
      emplacement: primaryDepot,
      depots: depotsString,
      organization_id: userRecord.organization_id || '00000000-0000-0000-0000-000000000001',
      permissions: permissionKeys,
    };

    const sessionToken = await signSession(sessionData);
    const sessionSignature = await signSessionCookie(sessionToken);

    const response = NextResponse.json({
      access_token: sessionToken,
      signature: sessionSignature,
      token_type: 'bearer',
      role: isAdmin ? 'admin' : 'vendeur',
      username: userRecord.utilisateur,
      user_id: userRecord.id,
      depots: sessionData.depots,
      emplacement: sessionData.emplacement,
      organization_id: sessionData.organization_id,
      permissions: permissionKeys,
      isAdmin: isAdmin
    });

    // Set cookies for web clients
    response.cookies.set('gp_session', sessionToken, {
      path: '/',
      maxAge: 86400 * 7, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    response.cookies.set('gp_session_sig', sessionSignature, {
      path: '/',
      maxAge: 86400 * 7, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });


    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

