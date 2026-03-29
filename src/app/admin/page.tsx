import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="flex gap-3">
        <Link href="/admin/pages" className="inline-block rounded bg-black px-4 py-2 text-white">Manage Pages</Link>
        <Link href="/admin/files" className="inline-block rounded bg-gray-800 px-4 py-2 text-white">Manage Media</Link>
      </div>
    </div>
  );
}
