import type { Metadata } from "next";
import type { PageConfig, PageSection } from "@/types/sections";
import { SERVICE_NAME_BY_SLUG } from "@/lib/services";

/**
 * Site-wide SEO facts and the small helpers every route composes its metadata from.
 *
 * Titles follow the legacy site's own shape: `<something> | Level Ground Landscape` — the business
 * name, verbatim, because that is what it is called everywhere. Page copy supplies the specific part.
 */

/**
 * Absolute origin for canonicals/OG/schema. The env var is sometimes stored without a scheme
 * (e.g. "level-ground-seven.vercel.app"), so normalize rather than trusting it.
 */
const RAW_SITE = (process.env.NEXT_PUBLIC_BASE_URL ?? "").trim().replace(/\/$/, "");
export const SITE_URL = RAW_SITE
  ? RAW_SITE.startsWith("http")
    ? RAW_SITE
    : `https://${RAW_SITE}`
  : "http://localhost:3000";

/** The brand string every generated title ends with. */
export const SUFFIX = "Level Ground Landscape";

/**
 * Pre-launch indexing lock. Every page carries `<meta name="robots" content="noindex, nofollow">`
 * while this is on. Set `SITE_NOINDEX=1` in the deployment's environment until cutover — Vercel
 * preview deployments are covered automatically via `VERCEL_ENV`. robots.txt deliberately stays
 * permissive: crawlers must be able to fetch a page to see the directive. Removal is one of the
 * cutover steps in `docs/handoff.md`; env changes only apply to new deployments, so the flip needs
 * a redeploy.
 */
export const NOINDEX = process.env.SITE_NOINDEX === "1" || process.env.VERCEL_ENV === "preview";

/**
 * Confirmed business facts (the operator supplied these; they match the Google listing). Keep them
 * here so the schema block and any future surface read from one place.
 */
export const BUSINESS = {
  name: "Level Ground Landscape",
  street: "2768 W Broadway",
  locality: "Vancouver",
  region: "BC",
  postalCode: "V6K 4P4",
  country: "CA",
  phone: "+1-778-223-5005",
  email: "info@levelgroundlandscape.com",
  instagram: "https://www.instagram.com/level_ground_landscape/",
  areas: ["Vancouver", "Lower Mainland"],
} as const;

/** A page's title: the hand-set override verbatim, else `<label> | Level Ground Landscape`. */
export function pageTitle(page: Pick<PageConfig, "label" | "metaTitle">): string {
  const explicit = page.metaTitle?.trim();
  return explicit || `${page.label} | ${SUFFIX}`;
}

/** Project titles are name-only (the legacy site's own pattern), so they never truncate in a SERP. */
export function projectTitle(name: string): string {
  return `${name} | ${SUFFIX}`;
}

/** Cap a description at a SERP-friendly length, on a word boundary. */
export function clampDescription(text: string, max = 158): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 0)).replace(/[,;:.]$/, "")}…`;
}

function findSection(sections: PageSection[], type: string): Record<string, unknown> | null {
  for (const s of sections) if (s.type === type) return s as unknown as Record<string, unknown>;
  return null;
}

/** The page's hero image, used as its og:image. Absolute already when it lives on R2. */
export function heroImage(sections: PageSection[]): string | null {
  const hero = findSection(sections, "hero");
  const img = (hero?.image as string | undefined)?.trim();
  return img || null;
}

/**
 * A page's description: the hand-set override, else the hero subheading (the copy the operator
 * already wrote for the page's lead paragraph).
 */
export function pageDescription(
  page: Pick<PageConfig, "metaDescription">,
  sections: PageSection[]
): string | null {
  const hero = findSection(sections, "hero");
  const text = page.metaDescription?.trim() || ((hero?.subheading as string | undefined) ?? "").trim();
  return text ? clampDescription(text) : null;
}

/** Compose a project description from its folder copy, or its covers when there is none. */
export function projectDescription(name: string, description: string | null, coverNames: string[]): string {
  const own = description?.trim();
  if (own) return clampDescription(own);
  const covers = coverNames.slice(0, 3);
  const list =
    covers.length === 0
      ? ""
      : covers.length === 1
        ? covers[0]
        : `${covers.slice(0, -1).join(", ")} and ${covers[covers.length - 1]}`;
  return clampDescription(
    `A residential landscaping project in Vancouver by ${SUFFIX}${list ? ` — ${list}` : ""}.`
  );
}

/**
 * The `Service` nodes for a service page: one per section anchor. The service pages carry a section
 * per service (10 on installation, 2 on maintenance) and each section's anchor is the service slug,
 * so the anchors are the source of truth — sections gain or lose a service and the schema follows.
 */
export function serviceSchemaNodes(anchors: string[], pagePath: string): Record<string, unknown>[] {
  return anchors
    .filter((slug) => SERVICE_NAME_BY_SLUG[slug])
    .map((slug) => ({
      "@type": "Service",
      "@id": `${SITE_URL}${pagePath}#${slug}`,
      name: SERVICE_NAME_BY_SLUG[slug],
      url: `${SITE_URL}${pagePath}#${slug}`,
      areaServed: BUSINESS.areas.map((a) => ({ "@type": "Place", name: a })),
      provider: { "@id": `${SITE_URL}/#localbusiness` },
    }));
}

/** The `CreativeWork` node for a project page: the portfolio piece itself. */
export function projectSchemaNode({
  entityPath,
  name,
  description,
  image,
  coverNames,
}: {
  entityPath: string;
  name: string;
  description: string;
  image: string | null;
  coverNames: string[];
}): Record<string, unknown> {
  return {
    "@type": "CreativeWork",
    "@id": `${SITE_URL}${entityPath}#project`,
    name,
    description,
    url: `${SITE_URL}${entityPath}`,
    ...(image ? { image } : {}),
    creator: { "@id": `${SITE_URL}/#organization` },
    ...(coverNames.length ? { about: coverNames.slice(0, 4).map((n) => ({ "@type": "Thing", name: n })) } : {}),
  };
}

/** The Metadata every public route returns, so canonicals/OG/Twitter cannot drift per route. */
export function buildMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
}): Metadata {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;
  const desc = description ?? undefined;
  return {
    title: { absolute: title },
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: SUFFIX,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}
