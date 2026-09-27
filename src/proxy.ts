import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Public admin auth pages — no session required.
const PUBLIC_ADMIN = [
  '/admin/login',
  '/admin/unlock',
  '/admin/verify-email',
  '/admin/accept-invite',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── /api/auth/* — our sign-in, sign-out and password/unlock endpoints.
  //    They authenticate themselves; pass through unconditionally.
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  // ── /api/contact — public form submission endpoint.
  if (pathname.startsWith('/api/contact')) return NextResponse.next()

  // ── Public admin auth pages (login, unlock, etc.)
  if (PUBLIC_ADMIN.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE)?.value,
  )

  // ── /admin/* — require a session cookie; redirect to login if absent.
  //    Role checks (e.g. owner-only pages) belong to the page, through getSession() / the
  //    requireSession() guard in route handlers — the proxy is a fast first-pass filter that
  //    only tests whether a cookie is present.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!hasSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  // ── /api/* (not already excluded above) — return 401 for unauthenticated requests.
  if (pathname.startsWith('/api/')) {
    if (!hasSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
