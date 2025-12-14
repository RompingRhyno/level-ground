// app/about/page.tsx
import { pages } from "@/lib/mockPages";
import { RenderSections } from "@/components/RenderSections";

export const dynamic = "force-static";

export default function AboutPage() {
  const page = pages["about"];

  return <RenderSections sections={page.sections} />;
}
