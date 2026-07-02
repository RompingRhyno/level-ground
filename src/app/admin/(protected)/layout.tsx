import AdminNav from "@/components/admin/AdminNav";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <AdminNav role={session.user.role as "owner" | "admin"} />
      <main className="p-6">{children}</main>
    </div>
  );
}
