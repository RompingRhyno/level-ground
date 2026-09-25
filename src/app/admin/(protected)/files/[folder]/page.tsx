import { notFound } from "next/navigation";
import FolderPageClient from "@/components/admin/files/FolderPageClient";
import { getFolderCards } from "@/lib/folders";
import { usageForAssets } from "@/lib/media-refs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Single project folder: files, ordering, tags, description and folder-level actions.
 * The folder lives in the URL so browser back works and folders are linkable.
 */
export default async function AdminFolderPage({ params }: { params: Promise<{ folder: string }> }) {
  const { folder: folderSlug } = await params;

  const [folders, tags, assets] = await Promise.all([
    getFolderCards(),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.asset.findMany({
      where: { folder: folderSlug },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const folder = folders.find((entry) => entry.slug === folderSlug);
  if (!folder) notFound();

  const usage = await usageForAssets(assets.map((asset) => asset.id));

  return (
    <FolderPageClient
      initialFolder={folder}
      initialAssets={assets.map((asset) => ({ ...asset, usedOn: usage[asset.id] ?? [] }))}
      initialTags={tags}
      initialFolders={folders}
    />
  );
}
