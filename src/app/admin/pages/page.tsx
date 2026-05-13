import { getPages } from "@/lib/pages";
import AdminPagesClient from "@/components/admin/AdminPagesClient";

export default async function AdminPagesList() {
  const pages = await getPages();
  const pageList = pages.map(({ slug, label }) => ({ slug, label }));

  return (
    <div>
      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', paddingBottom: '2rem' }}>
        <div className="mx-auto px-6">
          <h1 className="text-2xl font-semibold">Pages</h1>
          <p className="text-sm text-gray-600">Create and manage pages, layouts, and section content.</p>
        </div>
      </div>

      <AdminPagesClient initialPages={pageList} />
    </div>
  );
}
