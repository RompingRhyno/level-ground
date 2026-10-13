/**
 * The service vocabulary — the categories a cover tag sits under.
 *
 * `Tag.service` stores a service slug; this file is the display side of it (name and order), because
 * services are not rows of their own. Order here is presentation order: installation services first,
 * then maintenance, matching docs/services-revamp-plan.md.
 *
 * Tags are the specific covers (Patio, Hedges, Micro clover…) and services are the categories above
 * them, so a service page or filter gathers its covers by asking which tags carry its slug.
 */

export type ServiceGroup = "installation" | "maintenance";

export type Service = { slug: string; name: string; group: ServiceGroup };

/**
 * The seeded services, and the fallback whenever the live list has not loaded yet — kept in
 * alphabetical order by name, because that is the order every service surface displays (service
 * pills, index filters, the tag box's headings, the pickers' dropdowns). `getServices()` sorts
 * its DB read the same way; keep the two in step by name, not by the order they were created in.
 */
export const SERVICES: Service[] = [
  { slug: "decking", name: "Decking", group: "installation" },
  { slug: "fencing", name: "Fencing", group: "installation" },
  { slug: "garden-beds-and-boxes", name: "Garden beds & boxes", group: "installation" },
  { slug: "garden-maintenance", name: "Garden maintenance", group: "maintenance" },
  { slug: "irrigation", name: "Irrigation", group: "installation" },
  { slug: "lawn-installation", name: "Lawn installation", group: "installation" },
  { slug: "lawn-maintenance", name: "Lawn maintenance", group: "maintenance" },
  { slug: "outdoor-lighting", name: "Outdoor Lighting", group: "installation" },
  { slug: "pavers-and-patios", name: "Pavers & Patios", group: "installation" },
  { slug: "planting", name: "Planting", group: "installation" },
  { slug: "retaining-walls", name: "Retaining walls", group: "installation" },
  { slug: "rock-and-gravel-features", name: "Rock & gravel features", group: "installation" },
];

export const SERVICE_NAME_BY_SLUG: Record<string, string> = Object.fromEntries(
  SERVICES.map((s) => [s.slug, s.name])
);

/** The two service pages: installation services anchor into the first, maintenance into the second. */
const SERVICE_PAGE_BY_GROUP: Record<ServiceGroup, string> = {
  installation: "/landscape-design-installation",
  maintenance: "/landscape-maintenance",
};

/**
 * Where a cover's service lives on the public site: the service page plus that service's section
 * anchor (the 12 service sections are the only anchors on those two pages). Null for a tag with no
 * or an unknown service, so callers can fall back to something else.
 */
export function serviceAnchorHref(serviceSlug: string | null | undefined): string | null {
  if (!serviceSlug) return null;
  const service = SERVICES.find((s) => s.slug === serviceSlug);
  if (!service) return null;
  return `${SERVICE_PAGE_BY_GROUP[service.group]}#${service.slug}`;
}

const ORDER = new Map(SERVICES.map((s, i) => [s.slug, i]));

/** Sort service slugs into the canonical display order; unknown slugs last, alphabetically. */
export function sortServiceSlugs(slugs: string[]): string[] {
  return [...new Set(slugs)].sort((a, b) => {
    const ai = ORDER.get(a);
    const bi = ORDER.get(b);
    if (ai === undefined && bi === undefined) return a.localeCompare(b);
    if (ai === undefined) return 1;
    if (bi === undefined) return -1;
    return ai - bi;
  });
}
