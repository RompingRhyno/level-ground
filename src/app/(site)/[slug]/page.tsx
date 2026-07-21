import RenderSections from "@/components/RenderSections";
import { getPageBySlug, getAllPageSlugs } from "@/lib/pages";
import { notFound } from "next/navigation";

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
