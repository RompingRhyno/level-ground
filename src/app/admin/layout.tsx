import AdminNav from "@/components/admin/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <AdminNav />
      <main className="p-6">{children}</main>
    </div>
  );
}
