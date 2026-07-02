import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { auth } from "@/lib/auth";
import {
  generateToken,
  isStrongPassword,
  sendPasswordChangedNotice,
  sendEmailChangeVerification,
  sendEmailChangeNotice,
} from "@/lib/auth-utils";
import { compare, hash } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true, pendingEmail: true },
  });
  if (!user) redirect("/admin/login");

  // ── Change password ───────────────────────────────────────────────────────
  async function changePassword(formData: FormData) {
    "use server";
    const currentPwd = formData.get("currentPassword") as string;
    const newPwd = formData.get("newPassword") as string;

    if (!currentPwd || !newPwd) redirect("/admin/settings?pwdError=missing");

    const u = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { passwordHash: true, email: true },
    });
    if (!u?.passwordHash) redirect("/admin/settings?pwdError=missing");

    const valid = await compare(currentPwd, u.passwordHash);
    if (!valid) redirect("/admin/settings?pwdError=wrong");

    if (!isStrongPassword(newPwd)) redirect("/admin/settings?pwdError=weak");

    const newHash = await hash(newPwd, 12);
    await prisma.user.update({ where: { id: user!.id }, data: { passwordHash: newHash } });

    // Revoke all other sessions immediately
    await auth.api.revokeOtherSessions({ headers: await headers() });

    void sendPasswordChangedNotice(u.email);
    redirect("/admin/settings?pwdSuccess=1");
  }

  // ── Change email ──────────────────────────────────────────────────────────
  async function changeEmail(formData: FormData) {
    "use server";
    const currentPwd = formData.get("currentPassword") as string;
    const newEmail = (formData.get("newEmail") as string)?.trim().toLowerCase();

    if (!currentPwd || !newEmail) redirect("/admin/settings?emailError=missing");

    const u = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { passwordHash: true, email: true },
    });
    if (!u?.passwordHash) redirect("/admin/settings?emailError=auth");

    const valid = await compare(currentPwd, u.passwordHash);
    if (!valid) redirect("/admin/settings?emailError=wrong");

    const conflict = await prisma.user.findFirst({
      where: { email: newEmail, NOT: { id: user!.id } },
    });
    if (conflict) redirect("/admin/settings?emailError=taken");

    const { raw, hash: tokenHash } = generateToken();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user!.id }, data: { pendingEmail: newEmail } }),
      prisma.unlockToken.deleteMany({
        where: { userId: user!.id, type: "email_change", usedAt: null },
      }),
      prisma.unlockToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          type: "email_change",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ]);

    void sendEmailChangeVerification(newEmail, raw);
    void sendEmailChangeNotice(u.email);
    redirect("/admin/settings?emailSuccess=1");
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-8">
      <h2 className="text-xl font-semibold" style={{ color: "var(--color-text-heading)" }}>
        Settings
      </h2>

      {/* ── Change password ── */}
      <section
        className="rounded-xl p-6"
        style={{ backgroundColor: "var(--color-bg-secondary)" }}
      >
        <h3 className="font-semibold mb-4" style={{ color: "var(--color-text-heading)" }}>
          Change password
        </h3>
        {params.pwdSuccess && (
          <p className="text-sm text-green-600 mb-3">Password updated successfully.</p>
        )}
        <form action={changePassword} className="flex flex-col gap-3">
          <Field id="currentPassword" label="Current password" type="password" autoComplete="current-password" />
          <Field id="newPassword" label="New password" type="password" autoComplete="new-password" hint="Minimum 12 characters with at least one number or special character." />
          {params.pwdError === "wrong" && <p className="text-xs text-red-600">Current password is incorrect.</p>}
          {params.pwdError === "weak" && <p className="text-xs text-red-600">New password is not strong enough.</p>}
          {params.pwdError === "missing" && <p className="text-xs text-red-600">Please fill in all fields.</p>}
          <button
            type="submit"
            className="mt-1 self-start rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
          >
            Update password
          </button>
        </form>
      </section>

      {/* ── Change email ── */}
      <section
        className="rounded-xl p-6"
        style={{ backgroundColor: "var(--color-bg-secondary)" }}
      >
        <h3 className="font-semibold mb-1" style={{ color: "var(--color-text-heading)" }}>
          Change email
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-primary)" }}>
          Current: <strong>{user.email}</strong>
          {user.pendingEmail && (
            <> — pending confirmation: <strong>{user.pendingEmail}</strong></>
          )}
        </p>
        {params.emailSuccess && (
          <p className="text-sm text-green-600 mb-3">Verification email sent to your new address.</p>
        )}
        <form action={changeEmail} className="flex flex-col gap-3">
          <Field id="newEmail" label="New email address" type="email" autoComplete="email" />
          <Field id="currentPassword" label="Current password" type="password" autoComplete="current-password" />
          {params.emailError === "wrong" && <p className="text-xs text-red-600">Password is incorrect.</p>}
          {params.emailError === "taken" && <p className="text-xs text-red-600">That email address is already in use.</p>}
          {params.emailError === "missing" && <p className="text-xs text-red-600">Please fill in all fields.</p>}
          <button
            type="submit"
            className="mt-1 self-start rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
          >
            Request email change
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={{
          borderColor: "var(--color-border)",
          backgroundColor: "var(--color-bg-primary)",
          color: "var(--color-text-primary)",
        }}
      />
      {hint && (
        <p className="text-xs mt-1 opacity-60" style={{ color: "var(--color-text-primary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
