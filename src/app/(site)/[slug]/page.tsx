import type { Metadata } from "next";
import JumpToTop from "@/components/JumpToTop";
import RenderSections from "@/components/RenderSections";
import { getPageBySlug, getAllPageSlugs } from "@/lib/pages";
import { prisma } from "@/lib/prisma";
import { buildMetadata, pageDescription, pageOgImage, pageTitle, serviceSchemaNodes } from "@/lib/seo";
import { notFound } from "next/navigation";

/** The first visible project's cover photo: the og:image for an index page that has no image itself. */
async function firstFolderImage(): Promise<string | null> {
  const folder = await prisma.folder.findFirst({
    where: { hidden: false },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { slug: true },
  });
  if (!folder) return null;
  const asset = await prisma.asset.findFirst({
    where: { folder: folder.slug, publicUrl: { not: null }, hidden: false, mime: { startsWith: "image/" } },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { publicUrl: true },
  });
  return asset?.publicUrl ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return {};
  const ownImage = pageOgImage(page.sections);
  const isIndex = page.sections.some((s) => s.type === "collection-index");
  return buildMetadata({
    title: pageTitle(page),
    description: pageDescription(page, page.sections),
    path: `/${slug}`,
    // An index page carries no picture of its own; its first project's cover stands in.
    image: ownImage ?? (isIndex ? await firstFolderImage() : null),
  });
}

export async function generateStaticParams() {
  const slugs = await getAllPageSlugs();
  // "home" is handled by the root page.tsx, not this route
  return slugs.filter((s) => s !== "home").map((slug) => ({ slug }));
}

export const dynamicParams = true;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const page = await getPageBySlug(slug);

  if (!page) return notFound();

  // Service sections carry their service slug as the section anchor (10 on installation, 2 on
  // maintenance), so the schema follows the anchors rather than a hand-kept list.
  const anchors = page.sections
    .map((s) => (s as { anchor?: string }).anchor)
    .filter((a): a is string => typeof a === "string" && a.length > 0);
  const serviceNodes = anchors.length ? serviceSchemaNodes(anchors, `/${slug}`) : [];

  return (
    <>
      {serviceNodes.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ "@context": "https://schema.org", "@graph": serviceNodes }),
          }}
        />
      ) : null}
      <RenderSections sections={page.sections} pageSlug={slug} alternate={page.alternateSections} />
      {page.jumpToTop ? <JumpToTop /> : null}
    </>
  );
}
