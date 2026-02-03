import { maintenancePage } from "@/lib/mockPages";
import RenderSections from "@/components/RenderSections";

export default function LandscapeMaintenancePage() {
  return (
    <main>
      <RenderSections sections={maintenancePage.sections} />
    </main>
  );
}
