import type { PageSection } from "@/types/sections";
import { getServices } from "@/lib/services-db";
import { ServiceLinksView } from "./ServiceLinksView";

/** Server wrapper for the public page: the live vocabulary, narrowed to this page's service sections. */
export default async function ServiceLinks({ sections }: { sections: PageSection[] }) {
  const services = await getServices();
  const shownSlugs = sections
    .filter((s) => s.type === "gallery" && (s as { service?: string }).service)
    .map((s) => (s as { service?: string }).service as string);
  return <ServiceLinksView services={services} shownSlugs={shownSlugs} />;
}
