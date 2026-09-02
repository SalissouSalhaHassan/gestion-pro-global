import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
      sessionData = JSON.parse(decodeURIComponent(gpSessionCookie))
    } catch (e) {
      console.error('Proxy: Failed to parse session cookie')
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

  // --- 3. ROLE-BASED PROTECTION ---
  const adminRoutes = ['/dashboard/users', '/dashboard/permissions', '/dashboard/settings', '/dashboard/depots'];
  const isTargetingAdminRoute = adminRoutes.some(path => pathname.startsWith(path));

  if (isTargetingAdminRoute && (!sessionData || (sessionData.admin !== "Oui" && sessionData.role !== 1))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/unauthorized'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher:['/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
