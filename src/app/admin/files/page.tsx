import prisma from "@/lib/prisma";
import FileUploader from "@/components/admin/FileUploader";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage() {
  const assets = await prisma.asset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-sm text-gray-600">Upload and manage media stored in Cloudflare R2.</p>
      </div>

      <div>
        <h2 className="text-lg font-medium">Upload</h2>
        <div className="mt-2">
          <FileUploader />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium">Recent files</h2>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {assets.map((a: any) => (
            <div key={a.id} className="border rounded p-2">
              <div className="text-sm font-medium">{a.filename || a.storageKey}</div>
              <div className="text-xs text-gray-500">{a.mime}</div>
              <div className="mt-2">
                {a.publicUrl ? <img src={a.publicUrl} alt={a.alt || ""} className="w-full h-32 object-cover" /> : <div className="h-32 bg-gray-100" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
