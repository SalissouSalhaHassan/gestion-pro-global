import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // --- CUSTOM AUTH PROTECTION ---
  const gpSessionCookie = request.cookies.get('gp_session')?.value
  let sessionData: any = null

  if (gpSessionCookie) {
    try {
      sessionData = JSON.parse(decodeURIComponent(gpSessionCookie))
    } catch (e) {
      console.error('Middleware: Failed to parse session cookie')
    }
  }

  // Si l'utilisateur n'est pas connecté et essaie d'ouvrir une page protégée, on le renvoie vers /login
  if (!sessionData && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si l'utilisateur est connecté et ouvre /login, on le redirige vers /dashboard
  if (sessionData && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // --- ROLE-BASED PROTECTION ---
  const adminRoutes = ['/dashboard/users', '/dashboard/permissions', '/dashboard/settings', '/dashboard/depots'];
  const isTargetingAdminRoute = adminRoutes.some(path => request.nextUrl.pathname.startsWith(path));

  if (isTargetingAdminRoute && (!sessionData || (sessionData.admin !== "Oui" && sessionData.role !== 1))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/unauthorized'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}


export const config = {
  matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
