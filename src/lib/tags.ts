import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export type TagRecord = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  createdAt: Date;
};

/** Returns all registered tags from the Tag table, sorted alphabetically. */
export function getTags(): Promise<TagRecord[]> {
  return unstable_cache(
    async () => {
      return prisma.tag.findMany({ orderBy: { name: "asc" } });
    },
    ["tags"],
    { tags: ["tags"] }
  )();
}

/** Returns a tag record by slug if it exists in the Tag table, null otherwise. */
export function getTagBySlug(slug: string): Promise<TagRecord | null> {
  return unstable_cache(
    async () => {
      return prisma.tag.findUnique({ where: { slug } });
    },
    [`tag-${slug}`],
    { tags: [`tag:${slug}`] }
  )();
}

/**
 * Returns a map of tag slug → first asset publicUrl for each tag,
 * by finding folders tagged with each slug and taking their first image.
 */
export async function getFirstAssetUrlsByTagSlugs(
  slugs: string[]
): Promise<Record<string, string>> {
  if (!slugs.length) return {};

  const folders = await prisma.folder.findMany({
    where: { tags: { hasSome: slugs } },
    select: { slug: true, tags: true },
  });
  if (!folders.length) return {};

  const tagToFolders: Record<string, string[]> = {};
  for (const f of folders) {
    for (const tag of f.tags) {
      if (slugs.includes(tag)) {
        (tagToFolders[tag] ??= []).push(f.slug);
      }
    }
  }

  const allFolderSlugs = [...new Set(folders.map((f) => f.slug))];
  const assets = await prisma.asset.findMany({
    where: { folder: { in: allFolderSlugs }, publicUrl: { not: null } },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { folder: true, publicUrl: true, mime: true },
  });

  const folderFirstImage: Record<string, string> = {};
  for (const a of assets) {
    if (!a.folder || folderFirstImage[a.folder] || !a.publicUrl) continue;
    if (a.mime && !a.mime.startsWith("image/")) continue;
    folderFirstImage[a.folder] = a.publicUrl;
  }

  const result: Record<string, string> = {};
  for (const [tag, fSlugs] of Object.entries(tagToFolders)) {
    for (const fSlug of fSlugs) {
      if (folderFirstImage[fSlug]) { result[tag] = folderFirstImage[fSlug]; break; }
    }
  }
  return result;
}


