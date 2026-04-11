import FileUploader from "@/components/admin/FileUploader";
import AdminFilesApp from "@/components/admin/AdminFilesApp";

export const dynamic = "force-dynamic";

export default function AdminFilesPage() {

  // Render client components that will fetch data themselves
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-sm text-gray-600">Upload and manage media stored in Cloudflare R2.</p>
      </div>

      <div>
        <div>
          <h2 className="text-lg font-medium">Upload</h2>
          <div className="mt-2">
            <FileUploader />
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-medium">Files</h2>
          <div className="mt-2">
            <AdminFilesApp />
          </div>
        </div>
      </div>
    </div>
  );
}
