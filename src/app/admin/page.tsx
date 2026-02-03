import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <Link
        href="/admin/pages"
        className="inline-block rounded bg-black px-4 py-2 text-white"
      >
        Manage Pages
      </Link>
    </div>
  );
}
