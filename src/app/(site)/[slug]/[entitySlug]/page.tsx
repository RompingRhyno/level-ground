import { notFound } from "next/navigation";
import RenderSections from "@/components/RenderSections";
import { getCollectionRouteConfig, getPageBySlug } from "@/lib/pages";

type Props = { params: Promise<{ slug: string; entitySlug: string }> };

export default async function CollectionItemPage({ params }: Props) {
  const { slug, entitySlug } = await params;

  const routeConfig = await getCollectionRouteConfig(slug);
  if (!routeConfig) return notFound();

  const templatePage = await getPageBySlug(routeConfig.detailTemplateSlug);
  if (!templatePage) return notFound();

  return (
    <RenderSections
      sections={templatePage.sections}
      pageSlug={templatePage.slug}
      entityContext={{ entitySlug, source: routeConfig.source }}
    />
  );
}
