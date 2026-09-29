import AdminFilesClient from "@/components/admin/files/AdminFilesClient";
import { getFolderCards } from "@/lib/folders";

export const dynamic = "force-dynamic";

/**
 * Media library — one card per project folder. Folders can be reordered by drag and dropped on
 * to upload straight into them; every file belongs to a folder, so there is no loose-file view.
 */
export default async function AdminFilesPage() {
  const folders = await getFolderCards();

  return (
    <div>
      <div className="mx-auto max-w-7xl px-1 pb-6">
        <h1 className="text-2xl font-semibold">Media</h1>
        <p className="text-sm text-(--color-text-dark)">
          Project folders hold the photos and videos used across the site. Create a folder per job.
        </p>
      </div>
      <AdminFilesClient initialFolders={folders} />
    </div>
  );
}
