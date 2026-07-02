import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/auth'

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null

  return session
}