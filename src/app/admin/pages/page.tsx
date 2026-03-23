import Link from "next/link";
import { getPages } from "@/lib/pages";

export default async function AdminPagesList() {
  const pages = await getPages();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Pages</h2>

      <table className="w-full border border-gray-200 bg-white">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left">Label</th>
            <th className="px-4 py-2 text-left">Slug</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>

        <tbody>
          {pages.map((page) => (
            <tr key={page.slug} className="border-b">
              <td className="px-4 py-2 font-medium">{page.label}</td>
              <td className="px-4 py-2 text-gray-600">{page.slug}</td>
              <td className="px-4 py-2 text-right">
                <Link href={`/admin/pages/${page.slug}`} className="text-blue-600 underline">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
