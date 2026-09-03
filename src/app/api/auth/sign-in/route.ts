import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { generateToken, sendUnlockEmail } from '@/lib/auth-utils'
import { SESSION_COOKIE } from '@/lib/auth'

const MAX_ATTEMPTS = 3
const SESSION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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
  if (!email || !password) return unauthorized()

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return unauthorized()
  if (user.lockedAt) return locked()
  if (!user.passwordHash) return unauthorized()

  const valid = await compare(password, user.passwordHash)

  if (!valid) {
    const attempts = user.failedAttempts + 1

    if (attempts >= MAX_ATTEMPTS) {
      const { raw, hash } = generateToken()
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: attempts, lockedAt: new Date() },
        }),
        prisma.unlockToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        }),
        prisma.unlockToken.create({
          data: {
            userId: user.id,
            tokenHash: hash,
            type: 'unlock',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        }),
      ])
      const emailSent = await sendUnlockEmail(user.email, raw, attempts)
      // Surface send failure so the UI can tell the user the email never went
      // out instead of leaving them waiting on an inbox that stays empty.
      return locked(emailSent)
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: attempts },
      })
    }

    return unauthorized()
  }

  // ── Credentials valid: create session ────────────────────────────────────
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_MS)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lastLoginAt: now },
    }),
    prisma.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
          request.headers.get('x-real-ip') ??
          undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      },
    }),
  ])

  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  })
  return response
}
