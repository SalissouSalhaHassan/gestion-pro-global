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
    let userRecord: any = null;

    // Check direct username match first
    const { data: directUser, error: directError } = await supabase
      .from('users')
      .select('*')
      .ilike('utilisateur', trimmedUser)
      .eq('mot_de_passe', password)
      .maybeSingle();

    if (directUser) {
      userRecord = directUser;
    } else if (trimmedUser.includes('@')) {
      // Check if user entered organization email or user email
      const { data: matchedOrg } = await supabase
        .from('organizations')
        .select('id, name, currency, is_active')
        .ilike('email', trimmedUser)
        .maybeSingle();

      if (matchedOrg) {
        // Find user for this organization with matching password (prefer admin)
        const { data: orgUsers } = await supabase
          .from('users')
          .select('*')
          .eq('organization_id', matchedOrg.id)
          .eq('mot_de_passe', password)
          .order('admin', { ascending: false });

        if (orgUsers && orgUsers.length > 0) {
          userRecord = orgUsers[0];
        }
      }
    }

    if (!userRecord) {
      console.warn('Auth Login failed for:', trimmedUser);
      return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 });
    }

    // 2. Fetch and verify organization & subscription status
    const orgId = userRecord.organization_id || '00000000-0000-0000-0000-000000000001';
    let orgName = 'GESTION PRO GLOBAL';
    let orgCurrency = 'FCFA';
    let plan = 'pro';

    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, currency, is_active, subscriptions(plan, status, trial_ends_at, current_period_end)')
        .eq('id', orgId)
        .maybeSingle();

      if (orgData) {
        if (orgData.is_active === false) {
          return NextResponse.json(
            { error: 'Ce compte ou organisation est suspendu. Veuillez contacter le support.' },
            { status: 403 }
          );
        }

        orgName = orgData.name || orgName;
        orgCurrency = orgData.currency || orgCurrency;

        const sub = Array.isArray(orgData.subscriptions) ? orgData.subscriptions[0] : orgData.subscriptions;
        if (sub) {
          plan = sub.plan || plan;
          if (sub.status === 'expired' || sub.status === 'canceled') {
            return NextResponse.json(
              { error: 'Votre abonnement a expiré. Veuillez renouveler votre formule sur GESTION PRO GLOBAL.' },
              { status: 403 }
            );
          }
        }
      }
    } catch (orgErr) {
      console.warn('Organization lookup warning:', orgErr);
    }

    // 3. Fetch user permissions (optional but good for parity)
    let permissionKeys: string[] = [];
    try {
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('permissions(permission_key)')
        .eq('role_id', userRecord.role_id);
      if (perms) {
        permissionKeys = perms.map((p: any) => p.permissions?.permission_key).filter(Boolean);
      }
    } catch (e) {
      console.warn("role_permissions lookup warning:", e);
    }

    // Fetch user depots from user_warehouses as fallback
    let userDepotsList: string[] = [];
    try {
      const { data: userWarehouses } = await supabase
        .from('user_warehouses')
        .select('depot_id, depots(nom)')
        .eq('user_id', userRecord.id);

      if (userWarehouses) {
        userDepotsList = userWarehouses.map((uw: any) => uw.depots?.nom).filter(Boolean);
      }
    } catch (e) {
      console.warn("user_warehouses lookup warning:", e);
    }

    const depotsString = userDepotsList.length > 0 ? userDepotsList.join(", ") : (userRecord.depots || "");

    // Determine primary depot (emplacement) dynamically with safe fallback
    let primaryDepot = userRecord.emplacement || '';
    if (!primaryDepot && userDepotsList.length > 0) {
      primaryDepot = userDepotsList[0];
    }
    if (!primaryDepot) primaryDepot = 'BOUTIQUE';

    // 4. Create session data (parity with cookie logic)
    const adminVal = userRecord.admin?.toString().toLowerCase();
    const isAdmin = (adminVal === 'oui' || adminVal === 'admin' || adminVal === 'administrateur');
    
    const sessionData = {
      id: userRecord.id,
      username: userRecord.utilisateur,
      role: userRecord.role_id,
      admin: isAdmin ? 'Oui' : 'Non',
      emplacement: primaryDepot,
      depots: depotsString,
      organization_id: orgId,
      organization_name: orgName,
      currency: orgCurrency,
      plan: plan,
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
      organization_name: orgName,
      currency: orgCurrency,
      plan: plan,
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

