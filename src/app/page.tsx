import RenderSections from "@/components/RenderSections";
import { homePage } from "@/lib/mockPages";

export default function HomePage() {
  return <RenderSections sections={homePage.sections} />;
}
