import { createBrowserClient } from '@supabase/ssr'
import { parseSessionPayload } from '@/lib/session'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxairvfgklibhamkpeqq.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YWlydmZna2xpYmhhbWtwZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTYyNzgsImV4cCI6MjEwMzgzMjI3OH0.Juzca1wdXt7wXTTEXvqzZd4qiMWsSKavukA1c-PDYck'

  let orgId = ''
  if (typeof document !== 'undefined') {
    const sessionCookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='))
    if (sessionCookie) {
      try {
        const val = sessionCookie.split('=')[1]
        const parsed = parseSessionPayload(val)
        if (parsed?.organization_id) {
          orgId = parsed.organization_id
        }
      } catch {}
    }
  }

  return createBrowserClient(url, key, {
    global: {
      headers: orgId ? { 'x-organization-id': orgId } : {},
    },
  })
}