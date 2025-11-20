import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Global singleton for browser
declare global {
  interface Window {
    __supabaseClient?: ReturnType<typeof createSupabaseClient>
  }
}

export function createClient() {
  if (typeof window === 'undefined') {
    // Server-side: always create new instance
    return createSupabaseClient(supabaseUrl, supabaseAnonKey)
  }

  // Client-side: use global singleton
  if (!window.__supabaseClient) {
    window.__supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'xlo-auth',
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    })
  }
  return window.__supabaseClient
}
