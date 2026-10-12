import type { Metadata } from "next";
import RenderSections from "@/components/RenderSections";
import { getPageBySlug, getAllPageSlugs } from "@/lib/pages";
import { buildMetadata, heroImage, pageDescription, pageTitle } from "@/lib/seo";
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

  return <RenderSections sections={page.sections} pageSlug={slug} />;
}
