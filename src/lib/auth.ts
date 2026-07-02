import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  // Map Better Auth's internal user model to the `users` table (via @@map in schema).
  // additionalFields tells Better Auth about our custom columns so they are included
  // in the session response. passwordHash is intentionally excluded — it must never
  // be returned to the client.
  user: {
    modelName: 'users',
    additionalFields: {
      role:           { type: 'string', input: false },
      failedAttempts: { type: 'number', input: false },
      lockedAt:       { type: 'date',   required: false, input: false },
      pendingEmail:   { type: 'string', required: false, input: false },
      lastLoginAt:    { type: 'date',   required: false, input: false },
    },
  },
  // No emailAndPassword plugin — sign-in is fully custom (see app/api/auth/sign-in).
  // Sessions are created manually via Prisma in the sign-in route and validated here
  // via auth.api.getSession() in server components and route handlers.
  advanced: {
    database: {
      // Let Prisma generate IDs via @default(cuid()) rather than Better Auth's own ID generator.
      generateId: false,
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session['user']

// Convenience: the session cookie name Better Auth reads.
// Must stay in sync if auth config changes cookiePrefix.
export const SESSION_COOKIE = 'better-auth.session_token'
