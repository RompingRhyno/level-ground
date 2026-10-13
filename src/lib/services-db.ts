/**
 * DB side of the service vocabulary. `services.ts` stays pure (types, the seeded defaults, the
 * href helper) because next.config imports it for the redirect map; everything that needs the live
 * list — which can include services created from the tag modal — reads through here.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SERVICES, type Service, type ServiceGroup } from "@/lib/services";

const SERVICES_CACHE_SECONDS = 300;

/** The live service list, cached; falls back to the static seed if the table is empty. */
export const getServices = unstable_cache(
  async (): Promise<Service[]> => {
    try {
      // Alphabetical by name, the order every service surface displays — the stored `order` column
      // is creation order and no longer decides anything user-visible.
      const rows = await prisma.service.findMany();
      if (!rows.length) return SERVICES;
      return rows
        .map((row) => ({
          slug: row.slug,
          name: row.name,
          group: (row.group === "maintenance" ? "maintenance" : "installation") as ServiceGroup,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return SERVICES;
    }
  },
  ["services-list"],
  { tags: ["global:services"], revalidate: SERVICES_CACHE_SECONDS }
);

/** Name lookup over the live list. */
export async function serviceNameBySlug(): Promise<Record<string, string>> {
  const list = await getServices();
  return Object.fromEntries(list.map((s) => [s.slug, s.name]));
}

/** Where a cover's service lives on the public site, using the live list. */
export async function serviceAnchorHrefLive(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const list = await getServices();
  const service = list.find((s) => s.slug === slug);
  if (!service) return null;
  const page = service.group === "maintenance" ? "/landscape-maintenance" : "/landscape-design-installation";
  return `${page}#${service.slug}`;
}

/** Slugify a service name: same rules as folder/tag slugs. */
export function slugifyServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/_+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
