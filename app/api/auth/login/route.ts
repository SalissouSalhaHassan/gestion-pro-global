import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Identifiant et mot de passe requis' }, { status: 400 });
    }

    const supabase = await createClient();
    console.log('DEBUG: Auth Login - URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
    console.log('DEBUG: Auth Login attempting for:', username);

    // 1. Verify user in database
    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('utilisateur', username)
      .eq('mot_de_passe', password)
      .maybeSingle();

    if (fetchError || !userRecord) {
      console.log('DEBUG: Auth Login failed for:', username);
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
      permissions: permissionKeys,
    };

    const sessionToken = encodeURIComponent(JSON.stringify(sessionData));

    const response = NextResponse.json({
      access_token: sessionToken,
      token_type: 'bearer',
      role: isAdmin ? 'admin' : 'vendeur',
      username: userRecord.utilisateur,
      user_id: userRecord.id,
      depots: sessionData.depots,
      emplacement: sessionData.emplacement,
      permissions: permissionKeys,
      isAdmin: isAdmin
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

