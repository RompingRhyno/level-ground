import { prisma } from "./prisma";
import type { PageSection } from "@/types/sections";

/**
 * Extract all asset IDs referenced by static galleries in a sections array.
 * Only reads from sections with mode: "static" — never from dynamic galleries.
 */
export function extractStaticAssetIds(sections: PageSection[]): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    if (
      section.type === "gallery" &&
      section.mode === "static" &&
      Array.isArray(section.assetIds)
    ) {
      ids.push(...section.assetIds);
    }
  }
  return [...new Set(ids)];
}

/**
 * Returns true if any section is a dynamic gallery (mode: "dynamic").
 * Source of truth for dynamic gallery detection — JSON scan only.
 */
export function hasDynamicGallery(sections: PageSection[]): boolean {
  return sections.some(
    (s) => s.type === "gallery" && s.mode === "dynamic"
  );
}

/**
 * Derive all page slugs that contain at least one dynamic gallery.
 * Full JSON scan of all pages — used as the source of truth for dynamic invalidation.
 * Called on every media dataset mutation event.
 */
export async function resolveDynamicAffectedPages(): Promise<string[]> {
  const pages = (await prisma.page.findMany({
    select: { slug: true, sections: true },
  })) as { slug: string; sections: unknown }[];
  return pages
    .filter((p) => hasDynamicGallery(p.sections as PageSection[]))
    .map((p) => p.slug);
}

