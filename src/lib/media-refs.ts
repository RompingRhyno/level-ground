import { prisma } from "./prisma";
import type { PageSection } from "@/types/sections";
import { extractStaticAssetIds } from "./gallery-utils";

/**
 * Static media-reference tracking.
 *
 * Galleries store asset IDs, but every other media-bearing section stores a literal URL
 * (`hero.image`, `video.videoUrl`, `services[].image`, …). Those URL references are what the
 * "used on N pages" guard and the delete warning depend on, so they are resolved back to asset
 * rows here and recorded in `MediaUsage` alongside static-gallery references.
 *
 * Deliberately an allow-list per section type — a blind URL scan would also pick up `buttonHref`,
 * `routeBase` and other non-media strings. Relative paths (`/services-installation.jpg`) are
 * ignored: they are files in `public/`, not library assets.
 */

export type UrlRef = { path: string; url: string };

/** Section fields that hold a single media URL. */
const SECTION_URL_FIELDS: Record<string, string[]> = {
  hero: ["image"],
  twoColumn: ["image"],
  banner: ["image"],
  video: ["videoUrl"],
  contact: ["image"],
};

export function isMediaUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/** Extract every static media URL referenced by a page's sections. */
export function extractUrlRefs(sections: PageSection[] | null | undefined): UrlRef[] {
  const refs: UrlRef[] = [];
  const push = (path: string, value: unknown) => {
    if (isMediaUrl(value)) refs.push({ path, url: value.trim() });
  };

  (sections ?? []).forEach((section: any, index) => {
    if (!section || typeof section !== "object") return;
    const prefix = `[${index}]`;

    for (const field of SECTION_URL_FIELDS[section.type] ?? []) {
      push(`${prefix}.${field}`, section[field]);
    }

    if (section.type === "services" && Array.isArray(section.services)) {
      section.services.forEach((service: any, i: number) =>
        push(`${prefix}.services[${i}].image`, service?.image),
      );
    }

    if (section.type === "collection-index" && section.entityImages && typeof section.entityImages === "object") {
      for (const [slug, url] of Object.entries(section.entityImages as Record<string, unknown>)) {
        push(`${prefix}.entityImages.${slug}`, url);
      }
    }
  });

  return refs;
}

/** Decoded/comparable form of a URL (stored URLs may contain raw spaces, refs may be percent-encoded). */
export function normaliseUrl(url: string): string {
  const trimmed = url.trim();
  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

/** Every stored form a reference could plausibly match. */
export function urlCandidates(url: string): string[] {
  const raw = url.trim();
  const decoded = normaliseUrl(raw);
  return [
    ...new Set([
      raw,
      decoded,
      raw.replace(/ /g, "%20"),
      decoded.replace(/ /g, "%20"),
    ]),
  ];
}

/** Resolve referenced URLs to asset IDs (one query, exact matches over candidate forms). */
export async function resolveAssetIdsByUrls(urls: string[]): Promise<string[]> {
  const candidates = [...new Set(urls.flatMap(urlCandidates))];
  if (!candidates.length) return [];
  const rows = await prisma.asset.findMany({
    where: { publicUrl: { in: candidates } },
    select: { id: true },
  });
  return [...new Set(rows.map((r) => r.id))];
}

/**
 * Rebuild `MediaUsage` for a page: static-gallery asset IDs ∪ URL references resolved to assets.
 * Deletes and reinserts — no incremental merge.
 */
export async function reconcileMediaUsage(
  pageSlug: string,
  sections: PageSection[] | null | undefined,
): Promise<string[]> {
  const staticIds = extractStaticAssetIds((sections ?? []) as PageSection[]);
  const urlIds = await resolveAssetIdsByUrls(extractUrlRefs(sections).map((r) => r.url));
  const assetIds = [...new Set([...staticIds, ...urlIds])];

  await prisma.$transaction(async (tx: any) => {
    await tx.mediaUsage.deleteMany({ where: { pageSlug } });
    if (assetIds.length > 0) {
      await tx.mediaUsage.createMany({
        data: assetIds.map((assetId) => ({ assetId, pageSlug })),
        skipDuplicates: true,
      });
    }
  });

  return assetIds;
}

/** assetId → page slugs that reference it. */
export async function usageForAssets(assetIds: string[]): Promise<Record<string, string[]>> {
  if (!assetIds.length) return {};
  const rows = await prisma.mediaUsage.findMany({
    where: { assetId: { in: assetIds } },
    select: { assetId: true, pageSlug: true },
  });
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    (map[row.assetId] ??= []).push(row.pageSlug);
  }
  for (const key of Object.keys(map)) map[key].sort();
  return map;
}
