import type { PageConfig } from "@/types/sections";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

/**
 * Map DB record to `PageConfig` shape.
 */
function mapDbPageToConfig(db: any): PageConfig {
  return {
    slug: db.slug,
    label: db.label,
    sections: db.sections as PageConfig["sections"],
    type: db.type ?? "page",
  };
}

export async function getPages(): Promise<PageConfig[]> {
  const dbPages = await prisma.page.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] });
  return dbPages.map(mapDbPageToConfig);
}

export function getNavPages(): Promise<Pick<PageConfig, "slug" | "label">[]> {
  return unstable_cache(
    async () => {
      const dbPages = await prisma.page.findMany({
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: { slug: true, label: true },
        where: { type: "page" },
      });
      return dbPages as Pick<PageConfig, "slug" | "label">[];
    },
    ["nav-pages"],
    { tags: ["global:nav"] }
  )();
}

export function getPageBySlug(slug: string): Promise<PageConfig | null> {
  return unstable_cache(
    async () => {
      const dbPage = await prisma.page.findUnique({ where: { slug } });
      if (!dbPage) return null;
      return mapDbPageToConfig(dbPage);
    },
    [`page-${slug}`],
    { tags: [`page:${slug}`] }
  )();
}

/** Sets the `order` of each page by the position of its slug in the provided array. */
export async function reorderPages(slugs: string[]): Promise<void> {
  await Promise.all(
    slugs.map((slug, i) => prisma.page.update({ where: { slug }, data: { order: i } }))
  );
}

/**
 * Finds the collection-index config whose routeBase matches the given slug
 * segment (e.g. "projects" matches routeBase "/projects" or "projects").
 * Returns the source and detailTemplateSlug needed to render the detail page.
 */
export async function getCollectionRouteConfig(
  collectionSlug: string
): Promise<{ source: "folders" | "tags"; detailTemplateSlug: string } | null> {
  const pages = await prisma.page.findMany({ select: { sections: true } });
  for (const page of pages) {
    const sections = page.sections as any[];
    for (const section of sections) {
      if (section.type === "collection-index" && section.detailTemplateSlug) {
        const routeBase = (section.routeBase as string ?? "").replace(/^\//, "");
        if (routeBase === collectionSlug) {
          return {
            source: section.source ?? "folders",
            detailTemplateSlug: section.detailTemplateSlug,
          };
        }
      }
    }
  }
  return null;
}

export async function upsertPage(page: PageConfig) {

  // sections stored as JSON
  const sections = page.sections;
  const type = page.type ?? "page";

  const result = await prisma.page.upsert({
    where: { slug: page.slug },
    create: { slug: page.slug, label: page.label, sections, type },
    update: { label: page.label, sections, type },
  });

  return mapDbPageToConfig(result);
}

/**
 * For every collection-index section in the given section list, ensures a
 * template page with type "template" exists for its `detailTemplateSlug`.
 * Creates missing templates with an empty sections array; never overwrites
 * an existing page.
 */
export async function ensureCollectionTemplates(
  sections: PageConfig["sections"]
): Promise<string[]> {
  // Build slug → source map from all collection-index sections
  const slugToSource = new Map<string, "folders" | "tags">();
  sections
    .filter((s: any) => s.type === "collection-index" && s.detailTemplateSlug)
    .forEach((s: any) => {
      if (!slugToSource.has(s.detailTemplateSlug)) {
        slugToSource.set(s.detailTemplateSlug, s.source ?? "folders");
      }
    });

  if (!slugToSource.size) return [];

  const created: string[] = [];
  for (const [slug, source] of slugToSource) {
    const label = slug
      .split("-")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const result = await prisma.page.upsert({
      where: { slug },
      create: { slug, label, sections: [{ type: "collection-item", source, layout: "grid", lightbox: true }] as any, type: "template" },
      update: { type: "template" }, // correct type even if page pre-existed with wrong type
    });
    if (result.type === "template") created.push(slug);
  }
  return created;
}
