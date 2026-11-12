import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateToken, sendUnlockEmail } from "@/lib/auth-utils";

const MAX_ATTEMPTS = 3;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SignInResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; status: 401 | 423; emailSent?: boolean };

/**
 * Password sign-in shared by the JSON endpoint (the hydrated form) and the form-encoded endpoint
 * (the no-JavaScript fallback). Keeping the lockout, hashing and session rules in one place means a
 * browser that fails to hydrate cannot bypass the attempt counter.
 */
export async function signInWithPassword(
  rawEmail: string,
  password: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<SignInResult> {
  if (!rawEmail || !password) return { ok: false, status: 401 };

  // A stray space or a capital letter used to miss the row entirely, which returns 401 without
  // touching the lockout counter — indistinguishable from a wrong password.
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] sign-in rejected: no user with that address");
    }
    return { ok: false, status: 401 };
  }
  if (user.lockedAt) return { ok: false, status: 423 };
  if (!user.passwordHash) return { ok: false, status: 401 };

  const valid = await compare(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedAttempts + 1;
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] sign-in rejected: wrong password (attempt ${attempts})`);
    }

    if (attempts >= MAX_ATTEMPTS) {
      const { raw, hash } = generateToken();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: attempts, lockedAt: new Date() },
        }),
        prisma.unlockToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.unlockToken.create({
          data: {
            userId: user.id,
            tokenHash: hash,
            type: "unlock",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        }),
      ]);
      const emailSent = await sendUnlockEmail(user.email, raw, attempts);
      return { ok: false, status: 423, emailSent };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: attempts },
    });
    return { ok: false, status: 401 };
  }

  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MS);

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
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  if (process.env.NODE_ENV !== "production") console.info("[auth] sign-in ok");
  return { ok: true, token, expiresAt };
}

/** Cookie options shared by both sign-in entry points and sign-out. */
export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  };
}
