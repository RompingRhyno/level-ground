import { prisma } from "@/lib/prisma";
import { hashToken, isStrongPassword } from "@/lib/auth-utils";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function UnlockPage({ searchParams }: PageProps) {
  const { token: rawToken } = await searchParams;

  if (!rawToken) {
    return <TokenError message="Missing unlock token." />;
  }

  const tokenHash = hashToken(rawToken);
  const record = await prisma.unlockToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { email: true } } },
  });

  const isReset = record?.type === "reset";

  if (
    !record ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    (record.type !== "unlock" && record.type !== "reset")
  ) {
    return <TokenError message="This link is invalid or has expired." />;
  }

  async function doUnlock(formData: FormData) {
    "use server";
    const action = formData.get("action");
    const newPassword = formData.get("newPassword") as string | null;

    const rec = await prisma.unlockToken.findUnique({ where: { tokenHash } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      throw new Error("Token expired");
    }

    if (action === "reset") {
      if (!newPassword || !isStrongPassword(newPassword)) {
        // Re-render with error — in a real app use useFormState; for simplicity redirect with query
        redirect(`/admin/unlock?token=${rawToken}&error=weak`);
      }
      const passwordHash = await hash(newPassword, 12);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: rec.userId },
          data: { passwordHash, lockedAt: null, failedAttempts: 0 },
        }),
        prisma.unlockToken.update({
          where: { id: rec.id },
          data: { usedAt: new Date() },
        }),
        // Revoke existing sessions so old credentials can't be replayed
        prisma.session.deleteMany({ where: { userId: rec.userId } }),
      ]);
    } else {
      // Unlock only — keep existing password
      await prisma.$transaction([
        prisma.user.update({
          where: { id: rec.userId },
          data: { lockedAt: null, failedAttempts: 0 },
        }),
        prisma.unlockToken.update({
          where: { id: rec.id },
          data: { usedAt: new Date() },
        }),
      ]);
    }

    redirect("/admin/login?unlocked=1");
  }

  const hasError = (await searchParams).error === "weak";

  return (
    <div
      className="w-full max-w-sm rounded-xl p-8 shadow-lg"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <h1
        className="text-xl font-semibold mb-2"
        style={{ color: "var(--color-text-heading)" }}
      >
        {isReset ? "Reset password" : "Account locked"}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-primary)" }}>
        {isReset ? (
          <>
            Choose a new password for <strong>{record.user.email}</strong>
          </>
        ) : (
          <>
            Account: <strong>{record.user.email}</strong>
          </>
        )}
      </p>

      <form action={doUnlock} className="flex flex-col gap-4">
        {/* New password — only required for reset action */}
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--color-text-primary)" }}
          >
            New password <span className="text-xs opacity-60">(leave blank to unlock only)</span>
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
            }}
          />
          {hasError && (
            <p className="text-xs text-red-600 mt-1">
              Password must be at least 12 characters and contain a number or special character.
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-2">
          {!isReset && (
            <button
              type="submit"
              name="action"
              value="unlock"
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
            >
              Unlock only
            </button>
          )}
          <button
            type="submit"
            name="action"
            value="reset"
            className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={
              isReset
                ? { backgroundColor: "var(--color-brand-logo)", color: "#fff" }
                : {
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-heading)",
                  }
            }
          >
            Reset password
          </button>
        </div>
      </form>
    </div>
  );
}

function TokenError({ message }: { message: string }) {
  return (
    <div
      className="w-full max-w-sm rounded-xl p-8 shadow-lg text-center"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <p style={{ color: "var(--color-text-primary)" }}>{message}</p>
    </div>
  );
}
