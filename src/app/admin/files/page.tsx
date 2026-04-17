import FileUploader from "@/components/admin/FileUploader";
import AdminFilesApp from "@/components/admin/AdminFilesApp";

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

      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', backgroundColor: 'var(--color-bg-secondary)', padding: '1rem 0' }}>
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-lg font-medium">Upload</h2>
          <div className="mt-2">
            <FileUploader />
          </div>
        </div>
      </div>

      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', padding: '1rem 0' }}>
        <div className="max-w-5xl mx-auto px-4">
          <AdminFilesApp />
        </div>
      </div>
    </div>
  );
}
