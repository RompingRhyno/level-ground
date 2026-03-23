import RenderSections from "@/components/RenderSections";
import { getPageBySlug } from "@/lib/pages";
import { notFound } from "next/navigation";

export default async function HomePage() {
  const page = await getPageBySlug("home");
  if (!page) return notFound();
  return <RenderSections sections={page.sections} />;
}
