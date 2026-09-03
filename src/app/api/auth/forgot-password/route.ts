import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, sendPasswordResetEmail } from '@/lib/auth-utils'

/**
 * Self-serve password reset request. Always responds { success: true } for
 * unknown emails so the endpoint can't be used to enumerate accounts — the
 * only failure surfaced to the client is when the email itself can't be sent
 * for an existing account (502), which the UI reports.
 */
export async function POST(request: NextRequest) {
  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: true })
  }

  const { email } = body
  if (typeof email !== 'string' || !email) {
    return NextResponse.json({ success: true })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) {
    return NextResponse.json({ success: true })
  }

  // Cooldown: if an unused reset token was minted recently, skip the send so
  // this unauthenticated endpoint can't be used to flood the inbox.
  const recent = await prisma.unlockToken.findFirst({
    where: {
      userId: user.id,
      type: 'reset',
      usedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
    },
  })
  if (recent) {
    return NextResponse.json({ success: true })
  }

  const { raw, hash } = generateToken()
  const token = await prisma.unlockToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      type: 'reset',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })

  const sent = await sendPasswordResetEmail(user.email, raw)
  if (!sent) {
    // Don't leave a dead token behind — the emailed link would 404.
    await prisma.unlockToken.delete({ where: { id: token.id } }).catch(() => {})
    return NextResponse.json(
      { error: 'Email could not be sent. Please try again later.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}
