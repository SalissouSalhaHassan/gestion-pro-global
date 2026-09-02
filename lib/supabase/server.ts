import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxairvfgklibhamkpeqq.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YWlydmZna2xpYmhhbWtwZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTYyNzgsImV4cCI6MjEwMzgzMjI3OH0.Juzca1wdXt7wXTTEXvqzZd4qiMWsSKavukA1c-PDYck'

  // Extract organization_id from gp_session cookie
  let orgId = ''
  const sessionRaw = cookieStore.get('gp_session')?.value
  if (sessionRaw) {
    try {
      const decoded = sessionRaw.includes('%') ? decodeURIComponent(sessionRaw) : sessionRaw
      const parsed = JSON.parse(decoded)
      if (parsed?.organization_id) {
        orgId = parsed.organization_id
      }
    } catch {}
  }

  return createServerClient(
    url,
    key,
    {
      global: {
        headers: orgId ? { 'x-organization-id': orgId } : {},
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // يتم التجاهل إذا تم استدعاء هذا من مكون Server Component
          }
        },
      },
    }
  )
}