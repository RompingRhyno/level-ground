import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session-cookie'
import { sessionCookieOptions, signInWithPassword } from '@/lib/sign-in'

/**
 * Plain HTML form fallback for the sign-in page.
 *
 * The form posts here when the client bundle has not hydrated (a browser that failed to run the
 * React handler, an extension blocking scripts, a stale chunk). Without it, such a browser does a
 * native GET back to /admin/login, which looks exactly like "the page refreshed and cleared the
 * fields" and never reaches the sign-in logic at all.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const email = String(form?.get('email') ?? '')
  const password = String(form?.get('password') ?? '')

  const result = await signInWithPassword(email, password, {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  })

  if (!result.ok) {
    const query = result.status === 423 ? 'locked' : 'invalid'
    return NextResponse.redirect(new URL(`/admin/login?error=${query}`, request.url), 303)
  }

  const response = NextResponse.redirect(new URL('/admin', request.url), 303)
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt))
  return response
}
