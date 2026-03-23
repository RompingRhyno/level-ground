import type { PageConfig } from "@/types/sections";
import { prisma } from "./prisma";
import { pages as mockPages } from "./mockPages";

/**
 * Map DB record to `PageConfig` shape.
 */
function mapDbPageToConfig(db: any): PageConfig {
  return {
    slug: db.slug,
    label: db.label,
    sections: db.sections as PageConfig["sections"],
  };
}

export async function getPages(): Promise<PageConfig[]> {
  const dbPages = await prisma.page.findMany({ orderBy: { id: "asc" } });

  if (!dbPages || dbPages.length === 0) {
    // fallback to in-repo mock pages for dev or initial state
    return mockPages;
  }

  return dbPages.map(mapDbPageToConfig);
}

export async function getPageBySlug(slug: string): Promise<PageConfig | null> {
  const dbPage = await prisma.page.findUnique({ where: { slug } });
  if (!dbPage) return null;
  return mapDbPageToConfig(dbPage);
}

export async function upsertPage(page: PageConfig) {
  // sections stored as JSON
  const sections = page.sections;

  const result = await prisma.page.upsert({
    where: { slug: page.slug },
    create: { slug: page.slug, label: page.label, sections },
    update: { label: page.label, sections },
  });

  return mapDbPageToConfig(result);
}
