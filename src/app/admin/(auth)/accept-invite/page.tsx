import { prisma } from "@/lib/prisma";
import { hashToken, isStrongPassword } from "@/lib/auth-utils";
import { hash } from "bcryptjs";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  const { token: rawToken, error } = await searchParams;

  if (!rawToken) {
    return <TokenError message="Missing invitation token." />;
  }

  const tokenHash = hashToken(rawToken);
  const record = await prisma.unlockToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { email: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || record.type !== "invite") {
    return <TokenError message="This invitation link is invalid or has expired." />;
  }

  async function acceptInvite(formData: FormData) {
    "use server";
    const newPassword = formData.get("password") as string;

    if (!newPassword || !isStrongPassword(newPassword)) {
      redirect(`/admin/accept-invite?token=${rawToken}&error=weak`);
    }

    const rec = await prisma.unlockToken.findUnique({ where: { tokenHash } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      throw new Error("Token expired");
    }

    const passwordHash = await hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: rec.userId },
        data: { passwordHash, emailVerified: true },
      }),
      prisma.unlockToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    ]);

    redirect("/admin/login?invited=1");
  }

  return (
    <div
      className="w-full max-w-sm rounded-xl p-8 shadow-lg"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <h1
        className="text-xl font-semibold mb-2"
        style={{ color: "var(--color-text-heading)" }}
      >
        Accept invitation
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-primary)" }}>
        Set a password for <strong>{record.user.email}</strong>
      </p>

      <form action={acceptInvite} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--color-text-primary)" }}
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
            }}
          />
          {error === "weak" && (
            <p className="text-xs text-red-600 mt-1">
              Password must be at least 12 characters and contain a number or special character.
            </p>
          )}
          <p className="text-xs mt-1 opacity-60" style={{ color: "var(--color-text-primary)" }}>
            Minimum 12 characters with at least one number or special character.
          </p>
        </div>

        <button
          type="submit"
          className="mt-2 w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
        >
          Set password &amp; sign in
        </button>
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
