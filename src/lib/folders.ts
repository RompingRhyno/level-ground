import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export type FolderRecord = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
};

export function getFolders(): Promise<FolderRecord[]> {
  return unstable_cache(
    async () => {
      return prisma.folder.findMany({ orderBy: { name: "asc" } });
    },
    ["folders"],
    { tags: ["folders"] }
  )();
}

export function getFolderBySlug(slug: string): Promise<FolderRecord | null> {
  return unstable_cache(
    async () => {
      return prisma.folder.findUnique({ where: { slug } });
    },
    [`folder-${slug}`],
    { tags: [`folder:${slug}`] }
  )();
}

/**
 * Returns a map of folder slug → sorted unique tags across all assets in that folder.
 */
export async function getTagsByFolderSlugs(
  slugs: string[]
): Promise<Record<string, string[]>> {
  if (!slugs.length) return {};

  const assets = await prisma.asset.findMany({
    where: { folder: { in: slugs }, tags: { isEmpty: false } },
    select: { folder: true, tags: true },
  });

  const result: Record<string, Set<string>> = {};
  for (const asset of assets) {
    if (!asset.folder) continue;
    if (!result[asset.folder]) result[asset.folder] = new Set();
    for (const tag of asset.tags) result[asset.folder].add(tag);
  }
  return Object.fromEntries(
    Object.entries(result).map(([slug, set]) => [slug, [...set].sort()])
  );
}

/**
 * Returns a map of folder slug → first asset publicUrl (by orderIndex ASC)
 * for each slug in the provided list. Slugs with no image asset are omitted.
 */
export async function getFirstAssetUrlsByFolderSlugs(
  slugs: string[]
): Promise<Record<string, string>> {
  if (!slugs.length) return {};

  const assets = await prisma.asset.findMany({
    where: {
      folder: { in: slugs },
      publicUrl: { not: null },
    },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { folder: true, publicUrl: true, mime: true },
  });

  const result: Record<string, string> = {};
  for (const asset of assets) {
    if (!asset.folder || result[asset.folder] || !asset.publicUrl) continue;
    // Prefer explicit images; skip non-image mimes when mime is known
    if (asset.mime && !asset.mime.startsWith("image/")) continue;
    result[asset.folder] = asset.publicUrl;
  }
  return result;
}
