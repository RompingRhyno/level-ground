import { installationPage } from "@/lib/mockPages";
import RenderSections from "@/components/RenderSections";

export default function LandscapeDesignInstallationPage() {
  return (
    <main>
      <RenderSections sections={installationPage.sections} />
    </main>
  );
}
