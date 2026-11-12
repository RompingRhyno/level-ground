/**
 * Resets an admin password locally without putting it in shell history or chat.
 *
 *   read -s -p "New password: " ADMIN_PASSWORD; export ADMIN_PASSWORD
 *   npx tsx --env-file=.env --env-file=.env.local scripts/reset-admin-password.ts you@example.com
 *   unset ADMIN_PASSWORD
 *
 * Also clears the lockout counters and deletes that user's sessions, so every existing browser has
 * to sign in again. Refuses passwords shorter than 12 characters.
 */
import { hash } from "bcryptjs";
import prisma from "../src/lib/prisma";

const email = process.argv[2] ?? process.env.ADMIN_EMAIL ?? "levelgrounddev@proton.me";
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!password) throw new Error("ADMIN_PASSWORD is not set");
  if (password.length < 12) throw new Error("password must be at least 12 characters");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`no user with email ${email}`);

  const passwordHash = await hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, failedAttempts: 0, lockedAt: null },
  });
  const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`password reset for ${email}; ${count} session(s) revoked`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
