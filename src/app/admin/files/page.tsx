import AdminFilesPageWrapper from "@/components/admin/AdminFilesPageWrapper";

export const dynamic = "force-dynamic";

export default function AdminFilesPage() {

  // Render client components that will fetch data themselves
  return (
    <div>
      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', paddingBottom: '2rem' }}>
        <div className="mx-auto px-6">
          <h1 className="text-2xl font-semibold">Files</h1>
          <p className="text-sm text-gray-600">Upload and manage media stored in Cloudflare R2.</p>
        </div>
      </div>

      <AdminFilesPageWrapper />
    </div>
  );
}
