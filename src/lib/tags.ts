import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export type TagRecord = {
  slug: string;
  name: string;
};

/** Returns all unique tags across all assets, sorted alphabetically. */
export function getTags(): Promise<TagRecord[]> {
  return unstable_cache(
    async () => {
      const assets = await prisma.asset.findMany({
        select: { tags: true },
        where: { tags: { isEmpty: false } },
      });
      const tagSet = new Set<string>();
      for (const asset of assets) {
        for (const tag of asset.tags) {
          if (tag) tagSet.add(tag);
        }
      }
      return Array.from(tagSet)
        .sort()
        .map((t) => ({ slug: t, name: t }));
    },
    ["tags"],
    { tags: ["tags"] }
  )();
}

/**
 * Returns a map of tag slug → first asset publicUrl (by createdAt ASC)
 * for each slug in the provided list. Tags with no image asset are omitted.
 */
export async function getFirstAssetUrlsByTagSlugs(
  slugs: string[]
): Promise<Record<string, string>> {
  if (!slugs.length) return {};

  const assets = await prisma.asset.findMany({
    where: {
      tags: { hasSome: slugs },
      publicUrl: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: { tags: true, publicUrl: true, mime: true },
  });

  const result: Record<string, string> = {};
  for (const asset of assets) {
    if (!asset.publicUrl) continue;
    if (asset.mime && !asset.mime.startsWith("image/")) continue;
    for (const tag of asset.tags) {
      if (slugs.includes(tag) && !result[tag]) {
        result[tag] = asset.publicUrl;
      }
    }
  }
  return result;
}

/** Returns a tag if any asset carries it, null otherwise. */
export function getTagBySlug(slug: string): Promise<TagRecord | null> {
  return unstable_cache(
    async () => {
      const asset = await prisma.asset.findFirst({
        where: { tags: { has: slug } },
        select: { id: true },
      });
      if (!asset) return null;
      return { slug, name: slug };
    },
    [`tag-${slug}`],
    { tags: [`tag:${slug}`] }
  )();
}
