import RenderSections from "@/components/RenderSections";
import { getPageBySlug } from "@/lib/pages";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ tag?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tag } = await searchParams;

  const page = await getPageBySlug(slug);

  if (!page) return notFound();

  return <RenderSections sections={page.sections} pageSlug={slug} filterTag={tag} />;
}
