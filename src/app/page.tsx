import RenderSections from "@/components/RenderSections";
import { homePageSections } from "@/lib/mockPages";

export default function HomePage() {
  return <RenderSections sections={homePageSections} />;
}