import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyAndDecodeSession } from '@/lib/session'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  // --- 1. API ROUTES EXCEPTION (FOR MOBILE/CORS) ---
  if (pathname.startsWith('/api/')) {
    console.log(`Proxy: Request to ${pathname} [${request.method}]`);
    console.log('Proxy: All Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));
    
    // Handle OPTIONS (Preflight) explicitly
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const response = NextResponse.next()
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxairvfgklibhamkpeqq.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YWlydmZna2xpYmhhbWtwZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTYyNzgsImV4cCI6MjEwMzgzMjI3OH0.Juzca1wdXt7wXTTEXvqzZd4qiMWsSKavukA1c-PDYck'

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // --- 2. CUSTOM AUTH PROTECTION (WEB PAGES ONLY) ---
  const gpSessionCookie = request.cookies.get('gp_session')?.value
  let sessionData: any = null

  if (gpSessionCookie) {
    try {
      sessionData = await verifyAndDecodeSession(gpSessionCookie);
    } catch (e) {
      console.error('Proxy: Failed to verify session cookie');
    }
  }

  // Si l'utilisateur n'est pas connecté et essaie d'ouvrir une page protégée, on le renvoie vers /login
  if (!sessionData && !pathname.startsWith('/login') && pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si l'utilisateur est connecté et ouvre /login, on le redirige vers /dashboard
  if (sessionData && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Allow unauthorized notice page itself without looping
  if (pathname === '/dashboard/unauthorized') {
    return supabaseResponse;
  }

  // --- 3. DEFENSE IN DEPTH: MULTI-TIER ROUTE GUARDS ---
  const username = (sessionData?.username || "").toLowerCase();
  const orgId = sessionData?.organization_id;
  const isMasterOrg = orgId === "00000000-0000-0000-0000-000000000001";
  const isSuperAdmin = username === "superadmin" || (isMasterOrg && username === "admin");
  const isAdmin = isSuperAdmin || sessionData?.admin === "Oui" || sessionData?.admin === "oui" || sessionData?.role === 1 || sessionData?.role === "1" || sessionData?.role === "admin";

  // Tier 1: Platform Super Admin Routes (Strict Master Console)
  const superAdminRoutes = ['/dashboard/platform', '/dashboard/super-admin', '/dashboard/permissions'];
  if (superAdminRoutes.some(path => pathname.startsWith(path))) {
    if (!isSuperAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard/unauthorized';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Tier 2: Tenant Administrator Routes (Company settings, users, depots, backups)
  const adminRoutes = ['/dashboard/users', '/dashboard/settings', '/dashboard/depots', '/dashboard/data-hub'];
  if (adminRoutes.some(path => pathname.startsWith(path))) {
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard/unauthorized';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Tier 3: Operational RBAC Protected Routes (For non-admin staff)
  if (!isAdmin && pathname.startsWith('/dashboard/')) {
    const userPerms: string[] = Array.isArray(sessionData?.permissions) ? sessionData.permissions : [];

    const routePermissions: Record<string, string> = {
      '/dashboard/pos': 'pos.access',
      '/dashboard/invoices': 'sale.invoices_view',
      '/dashboard/devis': 'sale.proforma_create',
      '/dashboard/articles': 'stock.articles',
      '/dashboard/stock': 'stock.inventory',
      '/dashboard/inventory': 'stock.inventory',
      '/dashboard/clients': 'client.access',
      '/dashboard/advances': 'deposit.access',
      '/dashboard/suppliers': 'supplier.access',
      '/dashboard/purchases': 'purchase.access',
      '/dashboard/bons-commande': 'purchase.access',
      '/dashboard/expenses': 'expense.access',
      '/dashboard/reports/cash-balance': 'expense.cash_balance',
      '/dashboard/reports/profit-loss': 'report.finance',
      '/dashboard/reports/commissions': 'report.finance',
      '/dashboard/finance': 'report.finance',
      '/dashboard/audit': 'report.activity_log',
      '/dashboard/mouvements': 'report.activity_log',
      '/dashboard/ciment': 'cement.access',
      '/dashboard/loyers': 'rent.access',
      '/dashboard/vehicles': 'vehicles.access',
      '/dashboard/deliveries': 'vehicles.access',
    };

    for (const [route, reqPerm] of Object.entries(routePermissions)) {
      if (pathname.startsWith(route)) {
        if (!userPerms.includes(reqPerm)) {
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard/unauthorized';
          return NextResponse.redirect(url);
        }
        break;
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher:['/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
