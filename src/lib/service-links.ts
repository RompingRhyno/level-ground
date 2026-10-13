/**
 * The one resolver for "where does a service live on the public site".
 *
 * A service's section may live on **any** page. It is the gallery carrying `service === slug`; for
 * sections not yet re-bound through the editor, a gallery whose free-text `anchor` equals the slug
 * still counts (the convention the hand-typed links relied on), so nothing breaks mid-migration.
 *
 * Links resolve to wherever that section is. A service without a section falls back to its group's
 * service page with no hash — always somewhere sensible, never a dead anchor.
 *
 * Deliberately not cached itself: it composes `getServices()` and `getPages()`, both of which carry
 * their own cache tags, so a service edit or a page edit invalidates the map by construction. The
 * old failures in this area were all staleness between layers; do not add caching here.
 */

import { getServices } from "@/lib/services-db";
import { getPages } from "@/lib/pages";
import type { ServiceGroup } from "@/lib/services";

export type ServiceLink = {
  slug: string;
  name: string;
  group: ServiceGroup;
  /** Page slug hosting the bound section ("home" for the root page), null when none exists. */
  page: string | null;
  /** The section id — the service slug itself, derived from the binding. Null when none exists. */
  anchor: string | null;
  hasSection: boolean;
  /** Root-relative href: `/page#slug`, or the group's service page when no section exists. */
  href: string;
};

const GROUP_PAGE: Record<ServiceGroup, string> = {
  installation: "/landscape-design-installation",
  maintenance: "/landscape-maintenance",
};

function pagePath(pageSlug: string): string {
  return pageSlug === "home" ? "/" : `/${pageSlug}`;
}

type SectionShape = { type?: string; service?: string; anchor?: string };

export async function getServiceLinkMap(): Promise<ServiceLink[]> {
  const [services, pages] = await Promise.all([getServices(), getPages()]);

  return services.map((service) => {
    let hostPage: string | null = null;
    for (const page of pages) {
      const sections = (page.sections ?? []) as unknown as SectionShape[];
      const hit = sections.some(
        (s) =>
          s.type === "gallery" &&
          (s.service === service.slug || (!s.service && s.anchor === service.slug))
      );
      if (hit) {
        hostPage = page.slug;
        break;
      }
    }

    return {
      slug: service.slug,
      name: service.name,
      group: service.group,
      page: hostPage,
      anchor: hostPage ? service.slug : null,
      hasSection: !!hostPage,
      href: hostPage ? `${pagePath(hostPage)}#${service.slug}` : GROUP_PAGE[service.group],
    };
  });
}

/** slug → resolved href, for surfaces that render many service links at once. */
export async function getServiceHrefMap(): Promise<Record<string, string>> {
  const map = await getServiceLinkMap();
  return Object.fromEntries(map.map((s) => [s.slug, s.href]));
}

export async function resolveServiceHref(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const map = await getServiceLinkMap();
  return map.find((s) => s.slug === slug)?.href ?? null;
}

/** Whether a section is the designated one for its service — every other host would be a duplicate. */
export async function linkedServiceSlugs(): Promise<Set<string>> {
  const map = await getServiceLinkMap();
  return new Set(map.filter((s) => s.hasSection).map((s) => s.slug));
}
