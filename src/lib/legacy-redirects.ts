/**
 * The legacy WordPress site's URLs, mapped to this site's routes. Declared here as plain data so
 * next.config.ts can consume it without reading files at build time. Generated from
 * docs/folder-mapping-descriptions.csv (the 25 old project URLs) and docs/seo-audit-legacy-site.md
 * (the pages and the 21 taxonomy archives).
 *
 * Redirects only execute where this site is served, so nothing here affects the old host; the map
 * goes live with the domain cutover (see docs/handoff.md).
 */

/** Legacy pages. /contact keeps its path but the trailing slash still needs the redirect. */
export const LEGACY_PAGE_REDIRECTS: [string, string][] = [
  ["/residential-landscaping-installation", "/landscape-design-installation"],
  ["/project-gallery", "/projects"],
  ["/residential-landscaping-maintenance", "/landscape-maintenance"],
  ["/about-level-ground-landscape", "/about"],
  ["/contact", "/contact"],
];

/** Legacy project URLs -> /projects/<folder>. */
export const LEGACY_PROJECT_REDIRECTS: [string, string][] = [
  ["/projects/elliott-street-softscape", "/projects/elliott-st"],
  ["/projects/wiltshire-street-patio-installation", "/projects/wiltshire-st"],
  ["/projects/west-vancouver-landscaping-installation", "/projects/west-vancouver"],
  ["/projects/micro-clover-lawn-alternative", "/projects/west-14th"],
  ["/projects/decking-west-6th-avenue", "/projects/west-6th"],
  ["/projects/elmhurst-drive", "/projects/elmhurst-dr"],
  ["/projects/west-31st-patio-installation", "/projects/west-31st"],
  ["/projects/west-24th", "/projects/west-24th"],
  ["/projects/install-outdoor-patio", "/projects/south-surrey"],
  ["/projects/west-11th-residential-landscaping-installation", "/projects/west-11th"],
  ["/projects/alder-street-composite-decking", "/projects/alder-st"],
  ["/projects/duke-street-decking", "/projects/duke-st"],
  ["/projects/cypress-street-boulevard-garden", "/projects/cypress-st"],
  ["/projects/west-32nd-lawn-installation", "/projects/west-32nd"],
  ["/projects/bayswater-walkway-installation", "/projects/bayswater-st"],
  ["/projects/dunbar-street-patio-installation", "/projects/dunbar-st-backyard"],
  ["/projects/east-22nd-new-lawn-install", "/projects/east-22nd"],
  ["/projects/west-35th", "/projects/west-35th"],
  ["/projects/west-9th-artificial-turf-installation", "/projects/west-9th"],
  ["/projects/dunbar-patio-installation", "/projects/dunbar-st-patio"],
  ["/projects/low-maintenance-backyard", "/projects/east-12th"],
  ["/projects/renewed-backyard-with-putting-green", "/projects/cartier-st"],
  ["/projects/condo-landscape-installation", "/projects/east-broadway-condo"],
  ["/projects/curb-appeal", "/projects/west-35th-curb"],
  ["/projects/backyard-patio-installation", "/projects/west-29th"],
];

/**
 * Legacy taxonomy archives. The first element is the term; the second is the service slug whose
 * section on the installation page is the destination. Null means the term was retired (its work
 * is spread across services now), so it lands at the top of that page instead.
 */
export const LEGACY_ARCHIVE_TERMS: [string, string | null][] = [
  ["aggregate_slabs", "pavers-and-patios"],
  ["artificial_grass", "lawn-installation"],
  ["boulevard", null],
  ["concrete_slabs", "pavers-and-patios"],
  ["decking", "decking"],
  ["driveway", "pavers-and-patios"],
  ["excavation", null],
  ["fencing", "fencing"],
  ["gravel", "rock-and-gravel-features"],
  ["hedges", "planting"],
  ["lighting", "outdoor-lighting"],
  ["micro_clover", "lawn-installation"],
  ["new_lawn", "lawn-installation"],
  ["patio", "pavers-and-patios"],
  ["planting", "planting"],
  ["retaining_wall", "retaining-walls"],
  ["topsoil", "planting"],
  ["trees", "planting"],
  ["vegetable_box", "garden-beds-and-boxes"],
  ["walkway", "pavers-and-patios"],
  ["water_feature", null],
];

/**
 * This site's own earlier slugs, before the slugify rules collapsed the triple hyphens that a
 * " - " in a folder name used to produce. Nothing external ever linked them (they existed only on
 * the pre-launch host), but stale bookmarks and caches land right.
 */
export const RENAMED_SLUG_REDIRECTS: [string, string][] = [
  ["/projects/dunbar-st---backyard", "/projects/dunbar-st-backyard"],
  ["/projects/dunbar-st---patio", "/projects/dunbar-st-patio"],
  ["/projects/east-broadway---condo", "/projects/east-broadway-condo"],
  ["/projects/west-35th---curb", "/projects/west-35th-curb"],
];

/** The prefix all 21 archive URLs share. */
export const LEGACY_ARCHIVE_PREFIX = "/residential_landscaping_install";
