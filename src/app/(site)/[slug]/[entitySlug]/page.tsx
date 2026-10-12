import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JumpToTop from "@/components/JumpToTop";
import RenderSections from "@/components/RenderSections";
import { getCollectionRouteConfig, getPageBySlug, getAllCollectionRoutes } from "@/lib/pages";
import { getFolderBySlug } from "@/lib/folders";
import { prisma } from "@/lib/prisma";
import { buildMetadata, projectDescription, projectSchemaNode, projectTitle } from "@/lib/seo";

type Props = { params: Promise<{ slug: string; entitySlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, entitySlug } = await params;
  const routeConfig = await getCollectionRouteConfig(slug);
  if (!routeConfig || routeConfig.source !== "folders") return {};

  const folder = await getFolderBySlug(entitySlug);
  if (!folder || folder.hidden) return {};

  // Covers (tag names) feed the composed description when the folder has no copy of its own;
  // before/after markers are not covers.
  const coverSlugs = folder.tags.filter((t) => t !== "before" && t !== "after");
  const tagRows = coverSlugs.length
    ? await prisma.tag.findMany({ where: { slug: { in: coverSlugs } }, select: { slug: true, name: true } })
    : [];
  const coverNames = coverSlugs.map((s) => tagRows.find((t) => t.slug === s)?.name ?? s);

  // The project's cover image (its first visible photo) is the og:image, the same rule the index uses.
  const firstAsset = await prisma.asset.findFirst({
    where: { folder: entitySlug, publicUrl: { not: null }, hidden: false, mime: { startsWith: "image/" } },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { publicUrl: true },
  });

  return buildMetadata({
    title: projectTitle(folder.name),
    description: projectDescription(folder.name, folder.description ?? null, coverNames),
    path: `/${slug}/${entitySlug}`,
    image: firstAsset?.publicUrl ?? null,
  });
}

export async function generateStaticParams() {
  return getAllCollectionRoutes().then((routes) =>
    routes.map(({ path: [slug, entitySlug] }) => ({ slug, entitySlug }))
  );
}

export const dynamicParams = true;

export default async function CollectionItemPage({ params }: Props) {
  const { slug, entitySlug } = await params;

  const routeConfig = await getCollectionRouteConfig(slug);
  if (!routeConfig) return notFound();

  // Folders removed from /projects (hidden) — and renamed slugs — resolve to the 404 page
  // rather than rendering a page that the index no longer links to.
  let projectNode: Record<string, unknown> | null = null;
  if (routeConfig.source === "folders") {
    const folder = await getFolderBySlug(entitySlug);
    if (!folder || folder.hidden) return notFound();

    // The project's CreativeWork: its own copy, its cover photo, and the covers (tag names) it
    // demonstrates — the same data its title/description/og:image are built from.
    const coverSlugs = folder.tags.filter((t) => t !== "before" && t !== "after");
    const tagRows = coverSlugs.length
      ? await prisma.tag.findMany({ where: { slug: { in: coverSlugs } }, select: { slug: true, name: true } })
      : [];
    const coverNames = coverSlugs.map((s) => tagRows.find((t) => t.slug === s)?.name ?? s);
    const firstAsset = await prisma.asset.findFirst({
      where: { folder: entitySlug, publicUrl: { not: null }, hidden: false, mime: { startsWith: "image/" } },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { publicUrl: true },
    });

    projectNode = projectSchemaNode({
      entityPath: `/${slug}/${entitySlug}`,
      name: folder.name,
      description: projectDescription(folder.name, folder.description ?? null, coverNames),
      image: firstAsset?.publicUrl ?? null,
      coverNames,
    });
  }

  const templatePage = await getPageBySlug(routeConfig.detailTemplateSlug);
  if (!templatePage) return notFound();

  return (
    <>
      {projectNode ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ "@context": "https://schema.org", ...projectNode }),
          }}
        />
      ) : null}
      <RenderSections
        sections={templatePage.sections}
        pageSlug={templatePage.slug}
        entityContext={{ entitySlug, source: routeConfig.source }}
      />
      {templatePage.jumpToTop ? <JumpToTop /> : null}
    </>
  );
}
