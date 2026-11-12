import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session-cookie'
import { sessionCookieOptions, signInWithPassword } from '@/lib/sign-in'

function unauthorized() {
  return NextResponse.json(
    { error: 'Invalid credentials or account locked' },
    { status: 401 },
  )
}

/** 423 Locked — account is locked out. Safe to reveal for a private admin panel. */
function locked(emailSent?: boolean) {
  return NextResponse.json(
    {
      error: 'Account locked. Check your email for the unlock link.',
      ...(emailSent === false ? { emailSent: false } : {}),
    },
    { status: 423 },
  )
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return unauthorized()
  }

  const { email, password } = body
  if (typeof email !== 'string' || typeof password !== 'string') return unauthorized()

  const result = await signInWithPassword(email, password, {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  })

  if (!result.ok) return result.status === 423 ? locked(result.emailSent) : unauthorized()

  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt))
  return response
}
