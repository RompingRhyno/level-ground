import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { pickCover } from "./folders";

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
 * Returns a map of tag slug → cover URL for each tag, by finding folders tagged with each slug
 * and taking the first usable cover (image, else a video's captured poster frame).
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
    where: { folder: { in: allFolderSlugs } },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { folder: true, publicUrl: true, mime: true, meta: true },
  });

  const assetsByFolder: Record<string, typeof assets> = {};
  for (const a of assets) {
    if (!a.folder) continue;
    (assetsByFolder[a.folder] ??= []).push(a);
  }

  const folderCover: Record<string, string> = {};
  for (const [slug, list] of Object.entries(assetsByFolder)) {
    const cover = pickCover(list);
    if (cover) folderCover[slug] = cover;
  }

  const result: Record<string, string> = {};
  for (const [tag, fSlugs] of Object.entries(tagToFolders)) {
    for (const fSlug of fSlugs) {
      if (folderCover[fSlug]) { result[tag] = folderCover[fSlug]; break; }
    }
  }
  return result;
}
