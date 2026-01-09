import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public pages that don't require authentication
  const publicPaths = ['/', '/auth/login', '/auth/callback']
  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  // Create response object for cookie manipulation
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Check authentication session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Refresh session if exists
  if (session) {
    await supabase.auth.getUser()
  }

  // Redirect to login if not authenticated
  if (!session) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/accounts/:path*',
    '/posts/:path*',
    '/engagement/:path*',
    '/loops/:path*',
    '/templates/:path*',
    '/dm-rules/:path*',
    '/proxies/:path*',
    '/settings/:path*',
    '/twitter-apps/:path*',
  ],
}
