import RenderSections from "@/components/RenderSections";
import { getPageBySlug } from "@/lib/pages";
import { pages as mockPages } from "@/lib/mockPages";
import { notFound } from "next/navigation";

type Props = { params: { slug: string } };

export default async function Page({ params }: Props) {
  const { slug } = params;

  const page = (await getPageBySlug(slug)) ?? mockPages.find((p) => p.slug === slug);

  if (!page) return notFound();

  return <RenderSections sections={page.sections} />;
}
