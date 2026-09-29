import { unstable_cache } from "next/cache";
import { CACHE_REVALIDATE_SECONDS } from "./cache";
import { prisma } from "./prisma";

export type FolderRecord = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  tags: string[];
  order: number;
  hidden: boolean;
  createdAt: Date;
};

export type FolderCard = FolderRecord & {
  assetCount: number;
  coverUrl: string | null;
};

/** All folders, in display order (manual order first, then alphabetical). */
export function getFolders(): Promise<FolderRecord[]> {
  return unstable_cache(
    async () => {
      return prisma.folder.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    },
    ["folders"],
    { tags: ["folders"], revalidate: CACHE_REVALIDATE_SECONDS }
  )();
}

/** Folders visible on the public collection index (`/projects`). */
export function getVisibleFolders(): Promise<FolderRecord[]> {
  return unstable_cache(
    async () => {
      return prisma.folder.findMany({
        where: { hidden: false },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      });
    },
    ["visible-folders"],
    { tags: ["folders"], revalidate: CACHE_REVALIDATE_SECONDS }
  )();
}

export function getFolderBySlug(slug: string): Promise<FolderRecord | null> {
  return unstable_cache(
    async () => {
      return prisma.folder.findUnique({ where: { slug } });
    },
    [`folder-${slug}`],
    { tags: [`folder:${slug}`], revalidate: CACHE_REVALIDATE_SECONDS }
  )();
}

/** Returns a map of folder slug → the folder's own tags array, sorted. */
export async function getTagsByFolderSlugs(
  slugs: string[]
): Promise<Record<string, string[]>> {
  if (!slugs.length) return {};

  const folders = await prisma.folder.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, tags: true },
  });

  return Object.fromEntries(
    folders.map((f) => [f.slug, [...f.tags].sort()])
  );
}

/** Returns folder slugs that have the given tag slug in their tags array. */
export async function getFoldersByTag(tagSlug: string): Promise<string[]> {
  const folders = await prisma.folder.findMany({
    where: { tags: { has: tagSlug } },
    select: { slug: true },
  });
  return folders.map((f) => f.slug);
}

type CoverAsset = {
  folder: string | null;
  publicUrl: string | null;
  mime: string | null;
  meta: unknown;
};

/** Poster URL recorded by the uploader for video assets, if any. */
export function posterUrlOf(meta: unknown): string | null {
  const poster = (meta as { poster?: unknown } | null)?.poster;
  return typeof poster === "string" && poster.length > 0 ? poster : null;
}

/**
 * Cover resolution for folder cards, in order of preference:
 *   1. first image asset by `orderIndex` (then `createdAt`)
 *   2. first video asset's captured poster frame
 *   3. nothing → caller renders its placeholder
 *
 * `next/image` cannot render an mp4, so a video URL is never a valid cover on its own.
 */
export function pickCover(assets: CoverAsset[]): string | null {
  let poster: string | null = null;
  for (const asset of assets) {
    if (!asset.publicUrl) continue;
    // A transition group is never a cover (it has no single frame to show on a card) — `image/x-transition`
    // is TRANSITION_MIME in src/lib/transition.ts. Hidden assets are already ordered last, so the first
    // image here is a visible one.
    if (asset.mime === "image/x-transition") continue;
    const isImage = !asset.mime || asset.mime.startsWith("image/");
    if (isImage) return asset.publicUrl;
    if (asset.mime?.startsWith("video/") && !poster) poster = posterUrlOf(asset.meta);
  }
  return poster;
}

/**
 * Returns a map of folder slug → cover URL (image, else video poster) for each slug in the list.
 * Slugs with no usable cover are omitted.
 */
export async function getFolderCovers(slugs: string[]): Promise<Record<string, string>> {
  if (!slugs.length) return {};

  const assets = (await prisma.asset.findMany({
    where: { folder: { in: slugs } },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { folder: true, publicUrl: true, mime: true, meta: true },
  })) as CoverAsset[];

  const byFolder: Record<string, CoverAsset[]> = {};
  for (const asset of assets) {
    if (!asset.folder) continue;
    (byFolder[asset.folder] ??= []).push(asset);
  }

  const result: Record<string, string> = {};
  for (const [slug, list] of Object.entries(byFolder)) {
    const cover = pickCover(list);
    if (cover) result[slug] = cover;
  }
  return result;
}

/** Folder cards for the admin grid: cover, asset count, order, visibility. */
export async function getFolderCards(): Promise<FolderCard[]> {
  const [folders, grouped] = await Promise.all([
    prisma.folder.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
    prisma.asset.groupBy({
      by: ["folder"],
      _count: { _all: true },
      where: { folder: { not: null } },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of grouped as { folder: string | null; _count: { _all: number } }[]) {
    if (row.folder) counts[row.folder] = row._count._all;
  }

  const covers = await getFolderCovers(folders.map((f) => f.slug));

  return folders.map((folder) => ({
    ...folder,
    assetCount: counts[folder.slug] ?? 0,
    coverUrl: covers[folder.slug] ?? null,
  }));
}

/**
 * Rewrite a folder slug inside page section JSON (pure).
 *
 * Folder slugs are embedded in page data: `gallery.filters.folder`, `collection-index.entityImages`
 * keys and `collection-index.entityOrder` entries. Missing this sweep silently breaks those pages
 * when a folder is renamed.
 */
export function rewriteFolderSlug(
  sections: unknown,
  oldSlug: string,
  newSlug: string
): { sections: unknown; changed: boolean } {
  let changed = false;

  const visit = (node: any): any => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;

    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "entityOrder" && Array.isArray(value)) {
        const next = value.map((v) => (v === oldSlug ? ((changed = true), newSlug) : v));
        out[key] = next;
        continue;
      }
      if (key === "entityImages" && value && typeof value === "object" && !Array.isArray(value)) {
        const next: Record<string, any> = {};
        for (const [slug, url] of Object.entries(value as Record<string, any>)) {
          if (slug === oldSlug) {
            changed = true;
            next[newSlug] = url;
          } else {
            next[slug] = url;
          }
        }
        out[key] = next;
        continue;
      }
      if (key === "folder" && value === oldSlug) {
        changed = true;
        out[key] = newSlug;
        continue;
      }
      out[key] = visit(value);
    }
    return out;
  };

  const rewritten = visit(sections);
  return { sections: rewritten, changed };
}

/** Slugify a folder name (mirrors the tag/route slug rules used elsewhere). */
export function slugifyFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Find a free slug, appending `-2`, `-3`, … when taken. Returns the base slug when free.
 * `ignoreId` excludes the folder being renamed.
 */
export async function resolveUniqueFolderSlug(base: string, ignoreId?: number): Promise<string> {
  const fallback = base || `folder-${Date.now()}`;
  let candidate = fallback;
  for (let i = 2; i < 100; i++) {
    const existing = await prisma.folder.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${fallback}-${i}`;
  }
  return `${fallback}-${Date.now()}`;
}
