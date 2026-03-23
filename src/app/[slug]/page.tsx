import RenderSections from "@/components/RenderSections";
import { getPageBySlug } from "@/lib/pages";
import { notFound } from "next/navigation";

type Props = { params: { slug: string } };

export default async function Page({ params }: Props) {
  const { slug } = await params;

  const page = await getPageBySlug(slug);

  if (!page) return notFound();

  return <RenderSections sections={page.sections} />;
}