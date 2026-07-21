import RenderSections from "@/components/RenderSections";
import { getPageBySlug } from "@/lib/pages";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export default async function HomePage() {
  const page = await getPageBySlug("home");
  if (!page) return notFound();
  return <RenderSections sections={page.sections} pageSlug="home" />;
}
