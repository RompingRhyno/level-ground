import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateToken, sendInviteEmail } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "owner") redirect("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      lockedAt: true,
    },
  });

  async function revokeUser(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    if (!userId) return;

    const sess = await getSession();
    if (!sess || sess.user.role !== "owner") throw new Error("Unauthorized");
    if (userId === sess.user.id) throw new Error("Cannot delete yourself");

    await prisma.user.delete({ where: { id: userId } });
    redirect("/admin/users");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: "var(--color-text-heading)" }}>
          Users
        </h2>
        <a
          href="/admin/users/invite"
          className="rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--color-brand-logo)", color: "#fff" }}
        >
          Invite user
        </a>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-bg-secondary)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--color-border)" }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-text-heading)" }}>Email</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-text-heading)" }}>Role</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-text-heading)" }}>Last login</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--color-text-heading)" }}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                <td className="px-4 py-3" style={{ color: "var(--color-text-primary)" }}>{u.email}</td>
                <td className="px-4 py-3 capitalize" style={{ color: "var(--color-text-primary)" }}>{u.role}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-text-primary)" }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  {u.lockedAt ? (
                    <span className="text-red-600 text-xs font-medium">Locked</span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== session.user.id && (
                    <form action={revokeUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline"
                        onClick={(e) => {
                          if (!confirm(`Remove ${u.email}? This cannot be undone.`)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Re-export invite action so InvitePage can be a separate file
export async function sendInvite(email: string) {
  const { raw, hash: tokenHash } = generateToken();

  // Create user without a password hash; they set it via the invite link
  const user = await prisma.user.create({
    data: {
      name: email,
      email,
      emailVerified: false,
      role: "admin",
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
}
