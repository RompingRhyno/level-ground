import type { Metadata } from "next";
import JumpToTop from "@/components/JumpToTop";
import RenderSections from "@/components/RenderSections";
import { getPageBySlug } from "@/lib/pages";
import { buildMetadata, pageDescription, pageOgImage, pageTitle } from "@/lib/seo";
import { notFound } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("home");
  if (!page) return {};
  return buildMetadata({
    title: pageTitle(page),
    description: pageDescription(page, page.sections),
    path: "/",
    image: pageOgImage(page.sections),
  });
}

export function generateStaticParams() {
  return [];
}

export const dynamicParams = true;

export default async function HomePage() {
  const page = await getPageBySlug("home");
  if (!page) return notFound();
  return (
    <>
      <RenderSections sections={page.sections} pageSlug="home" alternate={page.alternateSections} />
      {page.jumpToTop ? <JumpToTop /> : null}
    </>
  );
}
