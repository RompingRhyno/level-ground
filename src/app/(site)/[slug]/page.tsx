import type { Metadata } from "next";
import RenderSections from "@/components/RenderSections";
import { getPageBySlug, getAllPageSlugs } from "@/lib/pages";
import { buildMetadata, heroImage, pageDescription, pageTitle, serviceSchemaNodes } from "@/lib/seo";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return {};
  return buildMetadata({
    title: pageTitle(page),
    description: pageDescription(page, page.sections),
    path: `/${slug}`,
    image: heroImage(page.sections),
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
      <RenderSections sections={page.sections} pageSlug={slug} />
    </>
  );
}
