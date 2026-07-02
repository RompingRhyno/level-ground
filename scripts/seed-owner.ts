#!/usr/bin/env ts-node
/**
 * Seed an owner user. Run once after deploying to a fresh database.
 *
 * Usage:
 *   OWNER_EMAIL=you@example.com \
 *   OWNER_PASSWORD_HASH='$2b$12$...' \
 *   npx ts-node scripts/seed-owner.ts
 *
 * Generate the hash first:
 *   npx ts-node scripts/hash-password.ts "your-secure-password"
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'

async function main() {
  const { prisma } = await import('../src/lib/prisma')
  const email = process.env.OWNER_EMAIL
  const passwordHash = process.env.OWNER_PASSWORD_HASH
  if (!email || !passwordHash) {
    console.error('Set OWNER_EMAIL and OWNER_PASSWORD_HASH environment variables.')
    process.exit(1)
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Owner already exists: ${existing.email} (id: ${existing.id})`)
    await prisma.$disconnect()
    return
  }
  const user = await prisma.user.create({
    data: {
      name: email,
      email,
      emailVerified: true,
      passwordHash,
      role: 'owner',
    },
  })
  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: await hash(randomBytes(32).toString('base64'), 12),
    },
  })
  console.log(`Owner created: ${user.email} (id: ${user.id})`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})