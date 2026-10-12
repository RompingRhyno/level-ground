/**
 * DB side of the generated alt text. The sentence shape lives in `alt.ts` (pure); this file owns
 * the writes, so every mutation that changes a folder's tags, its name, or a tag's name refreshes
 * the affected photos in the same request — reordering tags in the media library is enough, no
 * manual regeneration step.
 */

import { prisma } from "@/lib/prisma";
import { altTextForTagNames } from "@/lib/alt";

/** Recompute the generated alt for one folder's visible photos. Returns how many rows changed. */
export async function regenerateFolderAlts(folderSlug: string): Promise<number> {
  const folder = await prisma.folder.findUnique({
    where: { slug: folderSlug },
    select: { name: true, tags: true },
  });
  if (!folder) return 0;

  const covers = (folder.tags ?? []).filter((t) => t !== "before" && t !== "after");
  const tagRows = covers.length
    ? await prisma.tag.findMany({ where: { slug: { in: covers } }, select: { slug: true, name: true } })
    : [];
  const names = covers.map((slug) => tagRows.find((t) => t.slug === slug)?.name ?? slug);
  const alt = altTextForTagNames(folder.name, names);

  const result = await prisma.asset.updateMany({
    where: { folder: folderSlug, hidden: false, mime: { startsWith: "image/" }, NOT: { mime: "image/x-transition" } },
    data: { alt },
  });
  return result.count;
}

/** Recompute for every folder carrying any of these tags — the rename/delete paths. */
export async function regenerateAltsForTags(tagSlugs: string[]): Promise<number> {
  if (!tagSlugs.length) return 0;
  const folders = await prisma.folder.findMany({
    where: { tags: { hasSome: tagSlugs } },
    select: { slug: true },
  });
  let total = 0;
  for (const folder of folders) {
    total += await regenerateFolderAlts(folder.slug);
  }
  return total;
}
