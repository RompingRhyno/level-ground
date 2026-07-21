import { notFound } from "next/navigation";
import RenderSections from "@/components/RenderSections";
import { getPageBySlug, getAllCollectionRoutes } from "@/lib/pages";
import { getFolderBySlug } from "@/lib/folders";
import { getTagBySlug } from "@/lib/tags";
import type { CollectionIndexSection } from "@/types/sections";

type Props = { params: Promise<{ path: string[] }>; searchParams: Promise<{ tag?: string }> };

export async function generateStaticParams() {
  return getAllCollectionRoutes();
}

export const dynamicParams = true;

export default async function CatchAllPage({ params, searchParams }: Props) {
  const { path } = await params;
  const { tag } = await searchParams;

  // Single-segment: page resolution
  if (path.length === 1) {
    const [slug] = path;
    const page = await getPageBySlug(slug);
    if (!page) return notFound();
    return <RenderSections sections={page.sections} pageSlug={slug} filterTag={tag} />;
  }

  // Two-segment: entity detail resolution
  if (path.length === 2) {
    const [collectionName, entitySlug] = path;

    // Find the collection index page
    const collectionPage = await getPageBySlug(collectionName);
    if (!collectionPage) return notFound();

    // Locate the primary collection-index section (only primary owns routing)
    const indexSection = collectionPage.sections.find(
      (s): s is CollectionIndexSection =>
        s.type === "collection-index" && ((s as any).mode ?? "primary") === "primary"
    );
    if (!indexSection) return notFound();

    // Resolve the entity
    let entityName: string | null = null;
    if (indexSection.source === "folders") {
      const folder = await getFolderBySlug(entitySlug);
      if (!folder) return notFound();
      entityName = folder.name;
    } else if (indexSection.source === "tags") {
      const tag = await getTagBySlug(entitySlug);
      if (!tag) return notFound();
      entityName = tag.name;
    } else {
      return notFound();
    }

    // Load the detail template page
    const templatePage = await getPageBySlug(indexSection.detailTemplateSlug);
    const sections = templatePage?.sections ?? [];

    return <RenderSections sections={sections} pageSlug={entitySlug} />;
  }

  return notFound();
}
