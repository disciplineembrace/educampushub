import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit'

// Routes that should NOT be rate-limited or blocked
const ALLOWED_ADMIN_ROUTES = ['/cnx-admin-panel', '/api/cnx-admin', '/api/cnx-admin-auth', '/api/cnx-admin-forgot-password', '/api/cnx-admin-init']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  // ─── Rate Limiting (API routes only) ──────────────────────────
  if (pathname.startsWith('/api/')) {
    // Skip rate limiting for admin routes
    const isAdminRoute = ALLOWED_ADMIN_ROUTES.some(route => pathname.startsWith(route))
    
    if (!isAdminRoute) {
      const clientId = getClientIdentifier(request, pathname)
      const result = checkRateLimit(clientId, pathname)

      // Set rate limit headers
      response.headers.set('X-RateLimit-Limit', String(result.limit))
      response.headers.set('X-RateLimit-Remaining', String(result.remaining))
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))

      if (!result.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
            },
          }
        )
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads/).*)',
  ],
}
