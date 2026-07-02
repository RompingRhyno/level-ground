import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateToken, sendInviteEmail } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function InviteUserPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "owner") redirect("/admin");

  const { success, error } = await searchParams;

  async function handleInvite(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    if (!email) redirect("/admin/users/invite?error=missing");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect("/admin/users/invite?error=exists");

    const { raw, hash: tokenHash } = generateToken();

    const user = await prisma.user.create({
      data: { name: email, email, emailVerified: false, role: "admin" },
    });

    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: await hash(randomBytes(32).toString("base64"), 12),
      },
    });

    await prisma.unlockToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "invite",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    await sendInviteEmail(email, raw);
    redirect("/admin/users/invite?success=1");
  }

  return (
    <div className="max-w-sm mx-auto">
      <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--color-text-heading)" }}>
        Invite user
      </h2>

      {success && (
        <p className="text-sm text-green-600 mb-4">Invitation sent successfully.</p>
      )}

      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: "var(--color-bg-secondary)" }}
      >
        <form action={handleInvite} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--color-text-primary)" }}
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
              }}
            />
            {error === "exists" && (
              <p className="text-xs text-red-600 mt-1">A user with that email already exists.</p>
            )}
            {error === "missing" && (
              <p className="text-xs text-red-600 mt-1">Please enter an email address.</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
          >
            Send invitation
          </button>
        </form>
      </div>

      <a
        href="/admin/users"
        className="mt-4 inline-block text-sm hover:underline"
        style={{ color: "var(--color-text-primary)" }}
      >
        ← Back to users
      </a>
    </div>
  );
}
