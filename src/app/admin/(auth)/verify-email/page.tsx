import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token: rawToken } = await searchParams;

  if (!rawToken) {
    return <Message text="Missing verification token." isError />
  }

  const tokenHash = hashToken(rawToken);
  const record = await prisma.unlockToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, pendingEmail: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || record.type !== "email_change") {
    return <Message text="This link is invalid or has expired." isError />;
  }

  if (!record.user.pendingEmail) {
    return <Message text="No pending email change found." isError />;
  }

  // Check the pending email isn't already taken by another user
  const conflict = await prisma.user.findFirst({
    where: { email: record.user.pendingEmail, NOT: { id: record.userId } },
  });
  if (conflict) {
    return <Message text="That email address is already in use." isError />;
  }

  async function confirmChange() {
    "use server";
    const rec = await prisma.unlockToken.findUnique({ where: { tokenHash } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      throw new Error("Token expired");
    }
    const user = await prisma.user.findUnique({ where: { id: rec.userId } });
    if (!user?.pendingEmail) throw new Error("No pending email");

    await prisma.$transaction([
      prisma.user.update({
        where: { id: rec.userId },
        data: { email: user.pendingEmail, pendingEmail: null },
      }),
      prisma.unlockToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      // Revoke all sessions — user must sign in again with new email
      prisma.session.deleteMany({ where: { userId: rec.userId } }),
    ]);

    redirect("/admin/login?email-changed=1");
  }

  return (
    <div
      className="w-full max-w-sm rounded-xl p-8 shadow-lg text-center"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <h1
        className="text-xl font-semibold mb-4"
        style={{ color: "var(--color-text-heading)" }}
      >
        Verify new email
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-primary)" }}>
        Confirm your new email address: <strong>{record.user.pendingEmail}</strong>
      </p>
      <form action={confirmChange}>
        <button
          type="submit"
          className="w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
        >
          Confirm email change
        </button>
      </form>
    </div>
  );
}

function Message({ text, isError }: { text: string; isError?: boolean }) {
  return (
    <div
      className="w-full max-w-sm rounded-xl p-8 shadow-lg text-center"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <p
        className="text-sm"
        style={{ color: isError ? "var(--color-error, #dc2626)" : "var(--color-text-primary)" }}
      >
        {text}
      </p>
    </div>
  );
}
